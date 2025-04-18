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
import methodOverride from "method-override";

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

// WebDAV支持的HTTP方法
const WEBDAV_METHODS = ["GET", "HEAD", "PUT", "POST", "DELETE", "OPTIONS", "PROPFIND", "PROPPATCH", "MKCOL", "COPY", "MOVE", "LOCK", "UNLOCK"];

// 明确告知Express处理这些方法
WEBDAV_METHODS.forEach((method) => {
  server[method.toLowerCase()] = function (path, ...handlers) {
    return server.route(path).all(function (req, res, next) {
      if (req.method === method) {
        return next();
      }
      next("route");
    }, ...handlers);
  };
});

// 为WebDAV方法添加直接路由，确保它们能被正确处理
WEBDAV_METHODS.forEach((method) => {
  server[method.toLowerCase()]("/dav*", (req, res, next) => {
    console.log(`直接WebDAV路由处理: ${method} ${req.path}`);
    next();
  });
});

// CORS配置
const corsOptions = {
  origin: "*", // 允许的域名，如果未设置则允许所有
  methods: WEBDAV_METHODS.join(","), // 使用上面定义的WebDAV方法
  credentials: true,
  optionsSuccessStatus: 204,
  maxAge: 86400, // 缓存预检请求结果24小时
  exposedHeaders: ["ETag", "Content-Type", "Content-Length", "Last-Modified"],
};

// 中间件配置
server.use(cors(corsOptions));

// 添加method-override中间件支持WebDAV方法
server.use(methodOverride("X-HTTP-Method-Override"));
server.use(methodOverride("X-HTTP-Method"));
server.use(methodOverride("X-Method-Override"));

// 禁用WebDAV模块 (如果有的话)
server.disable("x-powered-by");

// 确保所有WebDAV方法都被允许
server.use((req, res, next) => {
  if (req.path.startsWith("/dav")) {
    res.setHeader("Access-Control-Allow-Methods", WEBDAV_METHODS.join(","));
    res.setHeader("Allow", WEBDAV_METHODS.join(","));

    // 对于OPTIONS请求，直接响应以支持预检请求
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }
  }
  next();
});

// 添加原始请求体处理中间件
server.use(
    express.raw({
      type: [
        "application/xml",
        "text/xml",
        "application/octet-stream",
        // 添加更多WebDAV请求可能使用的内容类型
        "text/plain",
        "application/x-www-form-urlencoded",
        "multipart/form-data",
        // 通配符处理，为WebDAV方法接受所有内容类型
        "*/xml",
        "*/*",
      ],
      limit: "1gb", // 设置合理的大小限制
      verify: (req, res, buf, encoding) => {
        // 对于WebDAV方法，特别是MKCOL，记录详细信息以便调试
        if (req.method === "MKCOL" || req.method === "PUT") {
          console.log(`WebDAV ${req.method} 原始请求体验证: Content-Type=${req.headers["content-type"]}, 大小=${buf ? buf.length : 0}字节`);
        }
      },
    })
);

// 添加处理413错误（请求体过大）的中间件
server.use((err, req, res, next) => {
  if (err.type === "entity.too.large") {
    console.error(`请求体过大错误: ${req.method} ${req.path}, 可能超过了限制`);
    return res.status(413).send("请求体过大");
  }
  next(err);
});

// 添加urlencoded中间件处理表单类型请求
server.use(
    express.urlencoded({
      extended: true,
      limit: "1gb",
    })
);

// 处理JSON请求体
server.use(
    express.json({
      type: ["application/json"],
      limit: "1gb",
    })
);

// 添加自定义中间件以支持WebDAV方法
server.use((req, res, next) => {
  // 记录WebDAV请求以便调试
  if (["PROPFIND", "PROPPATCH", "MKCOL", "COPY", "MOVE", "LOCK", "UNLOCK", "DELETE", "PUT"].includes(req.method)) {
    console.log(`WebDAV请求被Express接收: ${req.method} ${req.path}`);
  }

  next();
});

// 添加专门的WebDAV处理中间件
server.use("/dav", (req, res, next) => {
  // 明确设置允许的方法
  res.setHeader("Allow", WEBDAV_METHODS.join(","));

  // 记录详细的WebDAV请求信息
  console.log(`WebDAV专用中间件捕获请求: ${req.method} ${req.path}`);

  // 记录更详细的请求头信息，用于调试
  console.log(`WebDAV请求头: ${req.method} ${req.path}`, {
    "Content-Type": req.headers["content-type"] || "无",
    "Content-Length": req.headers["content-length"] || "无",
    "User-Agent": req.headers["user-agent"] || "无",
    Authorization: req.headers["authorization"] ? "已提供" : "无",
    Depth: req.headers["depth"] || "无",
    Destination: req.headers["destination"] || "无",
    Overwrite: req.headers["overwrite"] || "无",
  });

  // WebDAV的OPTIONS请求特殊处理
  if (req.method === "OPTIONS") {
    console.log("处理WebDAV OPTIONS请求");
    res.setHeader("Allow", WEBDAV_METHODS.join(","));
    res.setHeader("DAV", "1,2");
    res.setHeader("MS-Author-Via", "DAV");
    return res.status(200).end();
  }

  // 针对MKCOL方法的特殊处理
  if (req.method === "MKCOL") {
    console.log(`处理WebDAV MKCOL请求: ${req.path}`);
    // 对于Windows客户端，可能会发送一些特殊的头部
    const isWindowsClient = (req.headers["user-agent"] || "").includes("Microsoft") || (req.headers["user-agent"] || "").includes("Windows");
    if (isWindowsClient) {
      console.log(`检测到Windows客户端的MKCOL请求: ${req.path}`);
    }
  }

  // 针对PUT方法的特殊处理
  if (req.method === "PUT") {
    console.log(`处理WebDAV PUT请求: ${req.path}, Content-Type: ${req.headers["content-type"] || "无"}`);
  }

  // 针对DELETE方法的特殊处理
  if (req.method === "DELETE") {
    console.log(`处理WebDAV DELETE请求: ${req.path}`);
  }

  next();
});

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
    // 特殊处理WebDAV请求
    if (req.path.startsWith("/dav")) {
      console.log(`WebDAV请求被路由: ${req.method} ${req.path}, Headers: ${JSON.stringify(Object.keys(req.headers))}`);

      // 针对DELETE方法的特殊处理
      if (req.method === "DELETE") {
        console.log(`WebDAV DELETE请求: ${req.path}`);
      }
    }

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

  // 获取请求体内容
  let body = undefined;
  if (["POST", "PUT", "PATCH", "PROPFIND", "PROPPATCH", "MKCOL", "COPY", "MOVE", "DELETE"].includes(expressReq.method)) {
    // 检查请求体的类型和内容
    let contentType = expressReq.headers["content-type"] || "";

    // 对于WebDAV请求特殊处理
    const isWebDAVRequest = expressReq.path.startsWith("/dav");
    if (isWebDAVRequest) {
      // 确认Content-Type字段存在，如果不存在则设置一个默认值
      if (!contentType) {
        if (expressReq.method === "MKCOL") {
          // 为MKCOL设置默认的Content-Type
          contentType = "application/octet-stream";
          console.log(`WebDAV请求: 添加默认Content-Type (${contentType}) 到 ${expressReq.method} 请求`);
        }
      }
    }

    // MKCOL请求特殊处理: 即使有请求体也允许处理
    if (expressReq.method === "MKCOL") {
      // 对于MKCOL，如果有请求体就记录但不严格要求特定格式
      if (expressReq.body) {
        console.log(`MKCOL请求包含请求体，内容类型: ${contentType}, 请求体类型: ${typeof expressReq.body}`);
        // 对于MKCOL，我们总是设置一个空字符串作为请求体
        // 这样可以避免API处理逻辑中的415错误
        body = "";
      }
    }
    // 正常处理其他请求类型
    else {
      // 如果是JSON请求且已经被解析
      if (contentType.includes("application/json") && expressReq.body && typeof expressReq.body === "object") {
        body = JSON.stringify(expressReq.body);
      }
      // 如果是XML或二进制数据，使用Buffer
      else if (
          (contentType.includes("application/xml") || contentType.includes("text/xml") || contentType.includes("application/octet-stream")) &&
          Buffer.isBuffer(expressReq.body)
      ) {
        body = expressReq.body;
      }
      // 针对form-urlencoded类型的处理
      else if (contentType.includes("application/x-www-form-urlencoded") && expressReq.body && typeof expressReq.body === "object") {
        // 将表单数据转换为字符串
        const formData = new URLSearchParams();
        for (const key in expressReq.body) {
          formData.append(key, expressReq.body[key]);
        }
        body = formData.toString();
      }
      // 如果是其他类型的请求体，如果有原始数据就使用
      else if (expressReq.body) {
        if (Buffer.isBuffer(expressReq.body)) {
          body = expressReq.body;
        } else if (typeof expressReq.body === "string") {
          body = expressReq.body;
        } else {
          // 尝试将其他类型转换为字符串
          try {
            body = JSON.stringify(expressReq.body);
          } catch (e) {
            console.warn(`无法将请求体转换为JSON字符串: ${e.message}`);
            body = String(expressReq.body);
          }
        }
      }
    }
  }

  // 创建自定义的头部对象，以便添加或修改特定头部
  const headers = new Headers();
  for (const [key, value] of Object.entries(expressReq.headers)) {
    if (value !== undefined) {
      headers.set(key, value);
    }
  }

  // 检查并记录请求体信息，用于调试
  if (expressReq.path.startsWith("/dav")) {
    console.log(
        `WebDAV请求体: 方法=${expressReq.method}, 路径=${expressReq.path}, 内容类型=${expressReq.headers["content-type"] || "无"}, 请求体类型=${body ? typeof body : "无"}`
    );
  }

  // 处理特殊情况：DELETE方法通常没有请求体，但需要确保方法传递正确
  const requestInit = {
    method: expressReq.method,
    headers: headers,
  };

  // 只有在有请求体时才添加body参数
  if (body !== undefined) {
    requestInit.body = body;
  }

  return new Request(url, requestInit);
}

/**
 * 工具函数：将Worker Response转换为Express响应
 * 处理不同类型的响应（JSON、二进制、XML等）
 */
async function convertWorkerResponseToExpress(workerResponse, expressRes) {
  expressRes.status(workerResponse.status);

  workerResponse.headers.forEach((value, key) => {
    expressRes.set(key, value);
  });

  if (workerResponse.body) {
    const contentType = workerResponse.headers.get("content-type") || "";

    // 处理不同类型的响应
    if (contentType.includes("application/json")) {
      // JSON响应
      const jsonData = await workerResponse.json();
      expressRes.json(jsonData);
    } else if (contentType.includes("application/xml") || contentType.includes("text/xml")) {
      // XML响应，常见于WebDAV请求
      const text = await workerResponse.text();
      expressRes.type(contentType).send(text);
    } else if (contentType.includes("text/")) {
      // 文本响应
      const text = await workerResponse.text();
      expressRes.type(contentType).send(text);
    } else {
      // 二进制响应
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

  // Web.config文件支持WebDAV方法
  try {
    const webConfigPath = path.join(__dirname, "Web.config");
    const webConfigContent = `<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <modules>
      <remove name="WebDAVModule" />
    </modules>
    <handlers>
      <remove name="WebDAV" />
    </handlers>
    <validation validateIntegratedModeConfiguration="false" />
    <security>
      <requestFiltering>
        <verbs>
          <add verb="OPTIONS" allowed="true" />
          <add verb="PROPFIND" allowed="true" />
          <add verb="PROPPATCH" allowed="true" />
          <add verb="MKCOL" allowed="true" />
          <add verb="COPY" allowed="true" />
          <add verb="MOVE" allowed="true" />
          <add verb="DELETE" allowed="true" />
          <add verb="PUT" allowed="true" />
          <add verb="LOCK" allowed="true" />
          <add verb="UNLOCK" allowed="true" />
        </verbs>
      </requestFiltering>
    </security>
  </system.webServer>
</configuration>`;

    fs.writeFileSync(webConfigPath, webConfigContent);
    console.log(`已创建Web.config文件以支持WebDAV方法: ${webConfigPath}`);
  } catch (error) {
    console.warn("创建Web.config文件失败:", error.message);
  }
});
