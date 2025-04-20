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
import multer from "multer";
import { Readable } from "stream";

// 项目依赖
import { checkAndInitDatabase } from "./src/utils/database.js";
import app from "./src/index.js";
import { handleFileDownload } from "./src/routes/fileViewRoutes.js";
import { ApiStatus } from "./src/constants/index.js";

// ES模块兼容性处理：获取__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 日志级别常量
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

// 当前日志级别，可通过环境变量设置
const CURRENT_LOG_LEVEL = process.env.LOG_LEVEL ? parseInt(process.env.LOG_LEVEL) : LOG_LEVELS.INFO;

/**
 * 统一的日志函数
 * @param {string} level - 日志级别 ('error', 'warn', 'info', 'debug')
 * @param {string} message - 日志消息
 * @param {Object} [data] - 附加数据对象
 */
function logMessage(level, message, data = null) {
  const logLevel = LOG_LEVELS[level.toUpperCase()];
  if (logLevel <= CURRENT_LOG_LEVEL) {
    if (data) {
      console[level.toLowerCase()](message, data);
    } else {
      console[level.toLowerCase()](message);
    }
  }
}

// ==========================================
// SQLite适配器类 - 提供与Cloudflare D1数据库兼容的接口
// ==========================================

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
    logMessage("info", `初始化SQLite数据库: ${this.dbPath}`);
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
          logMessage("error", "SQL执行错误:", { error, sql: this.sql, params: this.params });
          throw error;
        }
      },

      async all() {
        try {
          const results = await this._db.all(this.sql, ...this.params);
          return { results };
        } catch (error) {
          logMessage("error", "SQL查询错误:", { error, sql: this.sql, params: this.params });
          throw error;
        }
      },

      async first() {
        try {
          return await this._db.get(this.sql, ...this.params);
        } catch (error) {
          logMessage("error", "SQL查询错误:", { error, sql: this.sql, params: this.params });
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
      logMessage("error", "SQL执行错误:", { error, sql });
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
  // 生成唯一错误ID用于日志跟踪
  const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

  // 记录详细错误信息但过滤敏感数据
  const sanitizedErrorMessage = error.message ? error.message.replace(/key|password|token|secret|auth/gi, (match) => "*".repeat(match.length)) : defaultMessage;

  // 在日志中包含错误ID方便后续追踪
  logMessage("error", `[${errorId}] 服务器错误:`, {
    status,
    message: sanitizedErrorMessage,
    stack: error.stack ? error.stack.split("\n").slice(0, 3).join("\n") : null,
  });

  // 对外部响应隐藏技术细节
  return {
    code: status,
    message: defaultMessage,
    errorId: errorId, // 包含错误ID便于用户报告问题
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
logMessage("info", `数据库文件路径: ${dbPath}`);

// 初始化SQLite适配器
const sqliteAdapter = createSQLiteAdapter(dbPath);
let isDbInitialized = false;

// ==========================================
// WebDAV支持配置 - 集中WebDAV相关定义
// ==========================================

// WebDAV支持的HTTP方法
const WEBDAV_METHODS = ["GET", "HEAD", "PUT", "POST", "DELETE", "OPTIONS", "PROPFIND", "PROPPATCH", "MKCOL", "COPY", "MOVE", "LOCK", "UNLOCK"];

// CORS配置 - WebDAV方法支持
const corsOptions = {
  origin: "*", // 允许的域名，如果未设置则允许所有
  methods: WEBDAV_METHODS.join(","), // 使用上面定义的WebDAV方法
  credentials: true,
  optionsSuccessStatus: 204,
  maxAge: 86400, // 缓存预检请求结果24小时
  exposedHeaders: ["ETag", "Content-Type", "Content-Length", "Last-Modified"],
};

// ==========================================
// 中间件和服务器配置
// ==========================================

// 明确告知Express处理WebDAV方法
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
    logMessage("debug", `直接WebDAV路由处理: ${method} ${req.path}`);
    next();
  });
});

// ==========================================
// 中间件配置（按功能分组）
// ==========================================

// 配置multer临时存储和限制
const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tempDir = path.join(dataDir, "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    // 为上传的文件创建唯一文件名
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

// 创建multer配置
const upload = multer({
  storage: multerStorage,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB大小限制
  },
});

// 1. 基础中间件 - CORS和HTTP方法处理
// ==========================================
server.use(cors(corsOptions));
server.use(methodOverride("X-HTTP-Method-Override"));
server.use(methodOverride("X-HTTP-Method"));
server.use(methodOverride("X-Method-Override"));
server.disable("x-powered-by");

// WebDAV基础方法支持
server.use((req, res, next) => {
  if (req.path.startsWith("/dav")) {
    res.setHeader("Access-Control-Allow-Methods", WEBDAV_METHODS.join(","));
    res.setHeader("Allow", WEBDAV_METHODS.join(","));

    // 对于OPTIONS请求，直接响应以支持预检请求
    if (req.method === "OPTIONS") {
      // 添加WebDAV特定的响应头
      res.setHeader("DAV", "1,2");
      res.setHeader("MS-Author-Via", "DAV");
      return res.status(204).end();
    }
  }
  next();
});

// 2. 请求体处理中间件
// ==========================================
// 处理原始请求体（XML、二进制等）
server.use(
    express.raw({
      type: ["application/xml", "text/xml", "application/octet-stream"],
      limit: "1gb", // 设置合理的大小限制
      verify: (req, res, buf, encoding) => {
        // 对于WebDAV方法，特别是MKCOL，记录详细信息以便调试
        if ((req.method === "MKCOL" || req.method === "PUT") && buf && buf.length > 10 * 1024 * 1024) {
          logMessage("debug", `大型WebDAV ${req.method} 请求体:`, {
            contentType: req.headers["content-type"],
            size: buf ? buf.length : 0,
          });
        }

        // 安全检查：检测潜在的异常XML或二进制内容
        if (buf && req.path.startsWith("/dav") && (req.headers["content-type"] || "").includes("xml") && buf.length > 0) {
          // 检查是否为有效的XML开头标记，简单验证
          const xmlStart = buf.slice(0, Math.min(50, buf.length)).toString();
          if (!xmlStart.trim().startsWith("<?xml") && !xmlStart.trim().startsWith("<")) {
            logMessage("warn", `可疑的XML请求体: ${req.method} ${req.path} - 内容不以XML标记开头`, {
              contentType: req.headers["content-type"],
              bodyPreview: xmlStart.replace(/[\x00-\x1F\x7F-\xFF]/g, ".").substring(0, 30),
            });
          }
        }
      },
    })
);

// 处理请求体大小限制错误
server.use((err, req, res, next) => {
  if (err.type === "entity.too.large") {
    logMessage("error", `请求体过大错误:`, {
      method: req.method,
      path: req.path,
      contentLength: req.headers["content-length"] || "未知",
      limit: err.limit,
    });
    return res.status(413).json({
      error: "请求体过大",
      message: `上传内容超过限制 (${err.limit})`,
      maxSize: err.limit,
    });
  }

  // 增强：处理内容类型解析错误
  if (err.status === 415 || (err.message && err.message.includes("content type"))) {
    logMessage("error", `内容类型错误:`, {
      method: req.method,
      path: req.path,
      contentType: req.headers["content-type"] || "未知",
    });
    return res.status(415).json({
      error: "不支持的内容类型",
      message: `服务器无法处理请求的内容类型 ${req.headers["content-type"] || "未指定"}`,
    });
  }

  next(err);
});

// 处理表单数据
server.use(
    express.urlencoded({
      extended: true,
      limit: "1gb",
    })
);

// 处理JSON请求体
server.use(
    express.json({
      type: ["application/json", "application/json; charset=utf-8", "+json", "*/json"],
      limit: "1gb",
    })
);

// 3. WebDAV专用中间件
// ==========================================
// WebDAV请求日志记录
server.use((req, res, next) => {
  // 仅记录关键WebDAV操作，减少不必要的日志
  if (["MKCOL", "COPY", "MOVE", "DELETE", "PUT"].includes(req.method) && req.path.startsWith("/dav")) {
    logMessage("debug", `关键WebDAV请求: ${req.method} ${req.path}`);
  }

  next();
});

// WebDAV详细处理中间件
server.use("/dav", (req, res, next) => {
  // 明确设置允许的方法
  res.setHeader("Allow", WEBDAV_METHODS.join(","));

  // 仅在INFO级别记录关键WebDAV请求信息
  logMessage("info", `WebDAV请求: ${req.method} ${req.path}`, {
    contentType: req.headers["content-type"] || "无",
    contentLength: req.headers["content-length"] || "无",
  });

  // 针对MKCOL方法的特殊处理
  if (req.method === "MKCOL") {
    // 仅记录Windows客户端的MKCOL请求
    if ((req.headers["user-agent"] || "").includes("Microsoft") || (req.headers["user-agent"] || "").includes("Windows")) {
      logMessage("debug", `Windows客户端的MKCOL请求: ${req.path}`);
    }
  }

  next();
});

// 4. 数据库初始化中间件
// ==========================================
server.use(async (req, res, next) => {
  try {
    if (!isDbInitialized) {
      logMessage("info", "首次请求，检查数据库状态...");
      isDbInitialized = true;
      try {
        await sqliteAdapter.init();
        await checkAndInitDatabase(sqliteAdapter);
      } catch (error) {
        logMessage("error", "数据库初始化出错:", { error });
      }
    }

    // 注入环境变量
    req.env = {
      DB: sqliteAdapter,
      ENCRYPTION_SECRET: process.env.ENCRYPTION_SECRET || "default-encryption-key",
    };

    next();
  } catch (error) {
    logMessage("error", "请求处理中间件错误:", { error });
    res.status(ApiStatus.INTERNAL_ERROR).json(createErrorResponse(error));
  }
});

// 5. 文件上传专用中间件 - 处理multipart/form-data请求
// ==========================================
// 处理管理员文件上传
server.post("/api/admin/fs/upload", upload.single("file"), (req, res, next) => {
  // 将multer处理后的文件信息添加到req中
  if (req.file) {
    logMessage("info", `通过multer处理管理员文件上传: ${req.file.originalname}, 大小: ${req.file.size} 字节`);
    // 将临时文件路径添加到req中，便于后续处理
    req.multerFile = req.file;
  } else {
    logMessage("warn", "管理员文件上传请求中未找到文件");
  }
  next();
});

// 处理用户文件上传
server.post("/api/user/fs/upload", upload.single("file"), (req, res, next) => {
  // 将multer处理后的文件信息添加到req中
  if (req.file) {
    logMessage("info", `通过multer处理用户文件上传: ${req.file.originalname}, 大小: ${req.file.size} 字节`);
    // 将临时文件路径添加到req中，便于后续处理
    req.multerFile = req.file;
  } else {
    logMessage("warn", "用户文件上传请求中未找到文件");
  }
  next();
});

// 添加multer错误处理中间件
server.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    logMessage("error", "Multer错误:", { code: err.code, field: err.field, message: err.message });

    // 处理不同类型的multer错误
    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        return res.status(413).json({
          success: false,
          code: ApiStatus.PAYLOAD_TOO_LARGE,
          message: "文件大小超过限制 (1GB)",
        });
      case "LIMIT_UNEXPECTED_FILE":
        return res.status(400).json({
          success: false,
          code: ApiStatus.BAD_REQUEST,
          message: `意外的文件字段: ${err.field}`,
        });
      default:
        return res.status(500).json({
          success: false,
          code: ApiStatus.INTERNAL_ERROR,
          message: "文件上传出错",
          error: err.message,
        });
    }
  }
  next(err);
});

// ==========================================
// 路由处理
// ==========================================

/**
 * 文件下载路由处理
 * 支持文件下载和预览功能
 */
server.get("/api/file-download/:slug", async (req, res) => {
  try {
    const response = await handleFileDownload(req.params.slug, req.env, createAdaptedRequest(req), true);
    await convertWorkerResponseToExpress(response, res);
  } catch (error) {
    logMessage("error", "文件下载错误:", { error });
    res.status(ApiStatus.INTERNAL_ERROR).json(createErrorResponse(error, ApiStatus.INTERNAL_ERROR, "文件下载失败"));
  }
});

server.get("/api/file-view/:slug", async (req, res) => {
  try {
    const response = await handleFileDownload(req.params.slug, req.env, createAdaptedRequest(req), false);
    await convertWorkerResponseToExpress(response, res);
  } catch (error) {
    logMessage("error", "文件预览错误:", { error });
    res.status(ApiStatus.INTERNAL_ERROR).json(createErrorResponse(error, ApiStatus.INTERNAL_ERROR, "文件预览失败"));
  }
});

// 通配符路由 - 处理所有其他API请求
server.use("*", async (req, res) => {
  try {
    const response = await app.fetch(createAdaptedRequest(req), req.env, {});
    await convertWorkerResponseToExpress(response, res);
  } catch (error) {
    // 使用更安全的错误记录和响应生成
    const status = error.status && typeof error.status === "number" ? error.status : ApiStatus.INTERNAL_ERROR;
    res.status(status).json(createErrorResponse(error, status));
  }
});

// ==========================================
// 工具函数
// ==========================================

/**
 * 工具函数：创建适配的Request对象
 * 将Express请求转换为Cloudflare Workers兼容的Request对象
 */
function createAdaptedRequest(expressReq) {
  const url = new URL(expressReq.originalUrl, `http://${expressReq.headers.host || "localhost"}`);

  // 获取请求体内容
  let body = undefined;

  // 特殊处理文件上传请求 - 使用multer处理后的文件
  if (expressReq.multerFile && (expressReq.path === "/api/admin/fs/upload" || expressReq.path === "/api/user/fs/upload")) {
    logMessage("info", "处理multer上传的文件，创建FormData", {
      path: expressReq.multerFile.path,
      originalname: expressReq.multerFile.originalname,
      size: expressReq.multerFile.size,
    });

    try {
      // 读取文件内容
      const fileBuffer = fs.readFileSync(expressReq.multerFile.path);

      // 创建表单对象 - 使用原生FormData或我们的polyfill
      let formData;

      // 检查是否使用原生FormData还是我们的polyfill
      if (typeof FormData.prototype.getBuffer === "function") {
        // 使用我们的polyfill
        formData = new FormData();
        formData.append("file", fileBuffer, expressReq.multerFile.originalname);

        // 添加其他表单字段
        if (expressReq.body && typeof expressReq.body === "object") {
          Object.keys(expressReq.body).forEach((key) => {
            if (key !== "file") {
              // 避免重复添加文件
              formData.append(key, expressReq.body[key]);
            }
          });
        }

        // 获取编码后的buffer和content-type
        const { buffer, contentType } = formData.getBuffer();
        body = buffer;

        // 更新Content-Type头
        expressReq.headers["content-type"] = contentType;
      } else {
        // 使用原生的FormData
        formData = new FormData();

        // 安全地创建Blob对象 - 避免使用实验性的File构造函数
        let fileBlob;
        try {
          fileBlob = new Blob([fileBuffer], { type: expressReq.multerFile.mimetype || "application/octet-stream" });
        } catch (blobError) {
          logMessage("warn", "创建Blob对象失败，尝试使用Buffer作为fallback", { error: blobError.message });
          fileBlob = fileBuffer; // 如果Blob创建失败，直接使用Buffer
        }

        // 将文件添加到FormData
        formData.append("file", fileBlob, expressReq.multerFile.originalname);

        // 添加其他表单字段
        if (expressReq.body && typeof expressReq.body === "object") {
          Object.keys(expressReq.body).forEach((key) => {
            if (key !== "file") {
              // 避免重复添加文件
              formData.append(key, expressReq.body[key]);
            }
          });
        }

        body = formData;
      }

      // 请求处理完成后清理临时文件
      process.nextTick(() => {
        try {
          if (fs.existsSync(expressReq.multerFile.path)) {
            fs.unlinkSync(expressReq.multerFile.path);
            logMessage("debug", `已删除临时文件: ${expressReq.multerFile.path}`);
          }
        } catch (error) {
          logMessage("warn", `删除临时文件失败: ${expressReq.multerFile.path}`, { error });
        }
      });
    } catch (error) {
      logMessage("error", "读取上传文件失败:", { error, path: expressReq.multerFile.path });
    }
  }
  // 常规请求处理
  else if (["POST", "PUT", "PATCH", "PROPFIND", "PROPPATCH", "MKCOL", "COPY", "MOVE", "DELETE"].includes(expressReq.method)) {
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
          logMessage("debug", `WebDAV请求: 添加默认Content-Type (${contentType}) 到 ${expressReq.method} 请求`);
        }
      }
    }

    // MKCOL请求特殊处理: 即使有请求体也允许处理
    if (expressReq.method === "MKCOL") {
      // 对于MKCOL，如果有请求体就记录但不严格要求特定格式
      if (expressReq.body) {
        logMessage("debug", `MKCOL请求包含请求体，内容类型: ${contentType}, 请求体类型: ${typeof expressReq.body}`);
        // 对于MKCOL，我们总是设置一个空字符串作为请求体
        // 这样可以避免API处理逻辑中的415错误
        body = "";

        // 安全增强：检查请求体大小，防止DOS攻击
        if (Buffer.isBuffer(expressReq.body) && expressReq.body.length > 1024) {
          logMessage("warn", `MKCOL请求包含异常大的请求体 (${expressReq.body.length} 字节)，可能是客户端错误或恶意请求`);
        }
      }
    }
    // 正常处理其他请求类型
    else {
      // 如果是JSON请求且已经被解析
      if ((contentType.includes("application/json") || contentType.includes("json")) && expressReq.body && typeof expressReq.body === "object") {
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
            logMessage("warn", `无法将请求体转换为JSON字符串: ${e.message}`);
            body = String(expressReq.body);
          }
        }
      }
    }
  }

  const requestInit = {
    method: expressReq.method,
    headers: expressReq.headers,
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

  // 记录详细的响应信息，便于调试
  const contentType = workerResponse.headers.get("content-type") || "";
  const contentLength = workerResponse.headers.get("content-length") || "未知";

  logMessage("debug", `处理响应: 状态码=${workerResponse.status}, 内容类型=${contentType}, 内容长度=${contentLength}`);

  // 设置响应头
  workerResponse.headers.forEach((value, key) => {
    expressRes.set(key, value);
  });

  if (workerResponse.body) {
    // 特别关注文件上传响应
    if (expressRes.req && (expressRes.req.path === "/api/admin/fs/upload" || expressRes.req.path === "/api/user/fs/upload")) {
      logMessage("info", `处理文件上传响应: 状态码=${workerResponse.status}, 内容类型=${contentType}`);
    }

    // 处理不同类型的响应
    if (contentType.includes("application/json")) {
      // JSON响应
      try {
        const jsonData = await workerResponse.json();
        logMessage("debug", `发送JSON响应: ${JSON.stringify(jsonData).substring(0, 200)}${JSON.stringify(jsonData).length > 200 ? "..." : ""}`);
        expressRes.json(jsonData);
      } catch (error) {
        logMessage("error", "解析JSON响应失败:", { error });
        // 尝试发送原始响应
        const text = await workerResponse.text();
        expressRes.type(contentType).send(text);
      }
    } else if (contentType.includes("application/xml") || contentType.includes("text/xml")) {
      // XML响应，常见于WebDAV请求
      const text = await workerResponse.text();
      logMessage("debug", `发送XML响应: ${text.substring(0, 200)}${text.length > 200 ? "..." : ""}`);
      expressRes.type(contentType).send(text);
    } else if (contentType.includes("text/")) {
      // 文本响应
      const text = await workerResponse.text();
      logMessage("debug", `发送文本响应: ${text.substring(0, 200)}${text.length > 200 ? "..." : ""}`);
      expressRes.type(contentType).send(text);
    } else {
      // 二进制响应
      try {
        const buffer = await workerResponse.arrayBuffer();
        logMessage("debug", `发送二进制响应: ${buffer.byteLength} 字节`);
        expressRes.send(Buffer.from(buffer));
      } catch (error) {
        logMessage("error", "处理二进制响应失败:", { error });
        // 尝试使用流式方式发送
        const readable = workerResponse.body;
        readable.pipe(expressRes);
      }
    }
  } else {
    logMessage("debug", "响应无内容，结束请求");
    expressRes.end();
  }
}

// ==========================================
// Blob和File的兼容性处理（用于解决"buffer.File is an experimental feature"问题）
// ==========================================

// 在Node.js环境中，如果没有全局的Blob类，创建一个polyfill
if (typeof global.Blob === "undefined") {
  class NodeBlob {
    constructor(parts, options = {}) {
      this.parts = parts;
      this.type = options.type || "";

      // 计算总大小
      this.size = parts.reduce((acc, part) => {
        if (Buffer.isBuffer(part)) {
          return acc + part.length;
        } else if (typeof part === "string") {
          return acc + Buffer.byteLength(part);
        } else if (part instanceof ArrayBuffer) {
          return acc + part.byteLength;
        } else {
          return acc + 0;
        }
      }, 0);
    }

    // 创建可读流
    stream() {
      const readable = new Readable();
      for (const part of this.parts) {
        if (Buffer.isBuffer(part) || typeof part === "string") {
          readable.push(part);
        } else if (part instanceof ArrayBuffer) {
          readable.push(Buffer.from(part));
        }
      }
      readable.push(null);
      return readable;
    }

    // 转换为Buffer
    async arrayBuffer() {
      const chunks = [];
      for (const part of this.parts) {
        if (Buffer.isBuffer(part)) {
          chunks.push(part);
        } else if (typeof part === "string") {
          chunks.push(Buffer.from(part));
        } else if (part instanceof ArrayBuffer) {
          chunks.push(Buffer.from(part));
        }
      }
      return Buffer.concat(chunks).buffer;
    }

    // 转换为文本
    async text() {
      const buffer = await this.arrayBuffer();
      return Buffer.from(buffer).toString();
    }
  }

  // 设置全局Blob
  global.Blob = NodeBlob;
}

// 如果没有全局FormData，提供一个基本实现
if (typeof global.FormData === "undefined") {
  class NodeFormData {
    constructor() {
      this.parts = new Map();
    }

    append(name, value, filename) {
      if (!this.parts.has(name)) {
        this.parts.set(name, []);
      }

      this.parts.get(name).push({
        value,
        filename,
      });
    }

    // 转换为请求体
    getBuffer() {
      // 实现一个简单的multipart/form-data编码
      const boundary = `----WebKitFormBoundary${Math.random().toString(16).substr(2)}`;
      const chunks = [];

      for (const [name, values] of this.parts.entries()) {
        for (const { value, filename } of values) {
          chunks.push(Buffer.from(`--${boundary}\r\n`));

          if (filename) {
            // 文件部分
            chunks.push(Buffer.from(`Content-Disposition: form-data; name="${name}"; filename="${filename}"\r\n`));
            chunks.push(Buffer.from(`Content-Type: application/octet-stream\r\n\r\n`));

            if (Buffer.isBuffer(value)) {
              chunks.push(value);
            } else if (value instanceof NodeBlob) {
              chunks.push(Buffer.from(value.arrayBuffer()));
            } else {
              chunks.push(Buffer.from(String(value)));
            }
          } else {
            // 普通表单字段
            chunks.push(Buffer.from(`Content-Disposition: form-data; name="${name}"\r\n\r\n`));
            chunks.push(Buffer.from(String(value)));
          }

          chunks.push(Buffer.from("\r\n"));
        }
      }

      // 添加结束边界
      chunks.push(Buffer.from(`--${boundary}--\r\n`));

      return {
        buffer: Buffer.concat(chunks),
        contentType: `multipart/form-data; boundary=${boundary}`,
      };
    }
  }

  // 设置全局FormData
  global.FormData = NodeFormData;
}

// 启动服务器
server.listen(PORT, "0.0.0.0", () => {
  logMessage("info", `CloudPaste后端服务运行在 http://0.0.0.0:${PORT}`);

  // 创建临时文件目录
  const tempDir = path.join(dataDir, "temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    logMessage("info", `创建临时文件目录: ${tempDir}`);
  }

  // 设置定期清理临时文件的任务
  const cleanupInterval = 1 * 60 * 60 * 1000; // 1小时清理一次
  setInterval(() => {
    try {
      let filesRemoved = 0;
      if (fs.existsSync(tempDir)) {
        // 获取所有临时文件
        const files = fs.readdirSync(tempDir);

        // 当前时间
        const now = Date.now();

        // 遍历文件，删除超过2小时的文件
        for (const file of files) {
          const filePath = path.join(tempDir, file);
          try {
            const stats = fs.statSync(filePath);
            // 文件修改时间超过2小时则删除
            if (now - stats.mtimeMs > 2 * 60 * 60 * 1000) {
              fs.unlinkSync(filePath);
              filesRemoved++;
            }
          } catch (error) {
            logMessage("warn", `清理临时文件出错: ${filePath}`, { error });
          }
        }
      }

      if (filesRemoved > 0) {
        logMessage("info", `定期清理完成，删除了 ${filesRemoved} 个临时文件`);
      } else {
        logMessage("debug", "定期清理完成，没有需要删除的临时文件");
      }
    } catch (error) {
      logMessage("error", "临时文件清理任务出错:", { error });
    }
  }, cleanupInterval);

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
    logMessage("info", `已创建Web.config文件以支持WebDAV方法: ${webConfigPath}`);
  } catch (error) {
    logMessage("warn", "创建Web.config文件失败:", { message: error.message });
  }
});
