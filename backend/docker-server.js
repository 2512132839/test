// docker-server.js - Express服务器实现
// 用于在Docker环境中运行的Express服务器，提供与Cloudflare Workers兼容的API接口

// 核心依赖
import express from "express";
import cors from "cors";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// 项目依赖
import { checkAndInitDatabase } from "./src/utils/database.js";
import app from "./src/index.js";
import { handleFileDownload } from "./src/routes/fileViewRoutes.js";
import { ApiStatus } from "./src/constants/index.js";

// ES模块兼容性处理：获取__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * SQLite适配器类 - 提供与Cloudflare D1数据库兼容的接口
 * 用于在Docker环境中模拟D1数据库的行为
 */
class SQLiteAdapter {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
  }

  async init() {
    console.log(`初始化SQLite数据库: ${this.dbPath}`);
    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database,
    });

    // 启用外键约束，确保数据完整性
    await this.db.exec("PRAGMA foreign_keys = ON;");
    return this;
  }

  // 模拟D1的prepare方法，提供与Cloudflare D1兼容的接口
  prepare(sql) {
    return {
      sql,
      params: [],
      _db: this.db,

      bind(...args) {
        this.params = args;
        return this;
      },

      async run() {
        try {
          await this._db.run(this.sql, ...this.params);
          return { success: true };
        } catch (error) {
          console.error("SQL执行错误:", error, "SQL:", this.sql, "params:", this.params);
          throw error;
        }
      },

      async all() {
        try {
          const results = await this._db.all(this.sql, ...this.params);
          return { results };
        } catch (error) {
          console.error("SQL查询错误:", error, "SQL:", this.sql, "params:", this.params);
          throw error;
        }
      },

      async first() {
        try {
          return await this._db.get(this.sql, ...this.params);
        } catch (error) {
          console.error("SQL查询错误:", error, "SQL:", this.sql, "params:", this.params);
          throw error;
        }
      },
    };
  }

  // 直接执行SQL语句的方法
  async exec(sql) {
    try {
      return await this.db.exec(sql);
    } catch (error) {
      console.error("SQL执行错误:", error, "SQL:", sql);
      throw error;
    }
  }
}

// 创建SQLite适配器实例的工厂函数
function createSQLiteAdapter(dbPath) {
  return new SQLiteAdapter(dbPath);
}

/**
 * 统一的错误响应处理函数
 * @param {Error} error - 错误对象
 * @param {number} status - HTTP状态码
 * @param {string} defaultMessage - 默认错误消息
 */
function createErrorResponse(error, status = ApiStatus.INTERNAL_ERROR, defaultMessage = "服务器内部错误") {
  return {
    code: status,
    message: error.message || defaultMessage,
    error: error.message,
    success: false,
    data: null,
  };
}

// Express应用程序设置
const server = express();
const PORT = process.env.PORT || 8787;

// 数据目录和数据库设置
const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "cloudpaste.db");
console.log(`数据库文件路径: ${dbPath}`);

// 初始化SQLite适配器
const sqliteAdapter = createSQLiteAdapter(dbPath);
let isDbInitialized = false;

// CORS配置
const corsOptions = {
  origin: "*", // 允许的域名，如果未设置则允许所有
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204,
  maxAge: 86400, // 缓存预检请求结果24小时
};

// 中间件配置
server.use(cors(corsOptions));
server.use(express.json());

// 数据库初始化中间件
server.use(async (req, res, next) => {
  try {
    if (!isDbInitialized) {
      console.log("首次请求，检查数据库状态...");
      isDbInitialized = true;
      try {
        await sqliteAdapter.init();
        await checkAndInitDatabase(sqliteAdapter);
      } catch (error) {
        console.error("数据库初始化出错:", error);
      }
    }

    // 注入环境变量
    req.env = {
      DB: sqliteAdapter,
      ENCRYPTION_SECRET: process.env.ENCRYPTION_SECRET || "default-encryption-key",
    };

    next();
  } catch (error) {
    console.error("请求处理中间件错误:", error);
    res.status(ApiStatus.INTERNAL_ERROR).json(createErrorResponse(error));
  }
});

/**
 * 文件下载路由处理
 * 支持文件下载和预览功能
 */
server.get("/api/file-download/:slug", async (req, res) => {
  try {
    const response = await handleFileDownload(req.params.slug, req.env, createAdaptedRequest(req), true);
    await convertWorkerResponseToExpress(response, res);
  } catch (error) {
    console.error("文件下载错误:", error);
    res.status(ApiStatus.INTERNAL_ERROR).json(createErrorResponse(error, ApiStatus.INTERNAL_ERROR, "文件下载失败"));
  }
});

server.get("/api/file-view/:slug", async (req, res) => {
  try {
    const response = await handleFileDownload(req.params.slug, req.env, createAdaptedRequest(req), false);
    await convertWorkerResponseToExpress(response, res);
  } catch (error) {
    console.error("文件预览错误:", error);
    res.status(ApiStatus.INTERNAL_ERROR).json(createErrorResponse(error, ApiStatus.INTERNAL_ERROR, "文件预览失败"));
  }
});

// 通配符路由 - 处理所有其他API请求
server.use("*", async (req, res) => {
  try {
    const response = await app.fetch(createAdaptedRequest(req), req.env, {});
    await convertWorkerResponseToExpress(response, res);
  } catch (error) {
    console.error("请求处理错误:", error);
    const status = error.status && typeof error.status === "number" ? error.status : ApiStatus.INTERNAL_ERROR;
    res.status(status).json(createErrorResponse(error, status));
  }
});

/**
 * 工具函数：创建适配的Request对象
 * 将Express请求转换为Cloudflare Workers兼容的Request对象
 */
function createAdaptedRequest(expressReq) {
  const url = new URL(expressReq.originalUrl, `http://${expressReq.headers.host || "localhost"}`);
  return new Request(url, {
    method: expressReq.method,
    headers: expressReq.headers,
    body: ["POST", "PUT", "PATCH"].includes(expressReq.method) && expressReq.body ? JSON.stringify(expressReq.body) : undefined,
  });
}

/**
 * 工具函数：将Worker Response转换为Express响应
 * 处理不同类型的响应（JSON、二进制等）
 */
async function convertWorkerResponseToExpress(workerResponse, expressRes) {
  expressRes.status(workerResponse.status);

  workerResponse.headers.forEach((value, key) => {
    expressRes.set(key, value);
  });

  if (workerResponse.body) {
    const contentType = workerResponse.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const jsonData = await workerResponse.json();
      expressRes.json(jsonData);
    } else {
      const buffer = await workerResponse.arrayBuffer();
      expressRes.send(Buffer.from(buffer));
    }
  } else {
    expressRes.end();
  }
}

// 启动服务器
server.listen(PORT, "0.0.0.0", () => {
  console.log(`CloudPaste后端服务运行在 http://0.0.0.0:${PORT}`);
});
