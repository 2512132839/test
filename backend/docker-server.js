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
// 内存监控与管理
// ==========================================

// 内存使用阈值（MB）- 超过此值将发出警告
const MEMORY_WARN_THRESHOLD = process.env.MEMORY_WARN_THRESHOLD || 300; // 默认300MB
// 内存监控间隔（毫秒）
const MEMORY_MONITOR_INTERVAL = process.env.MEMORY_MONITOR_INTERVAL || 60000; // 默认1分钟

// 保存请求级别的内存使用数据
const requestMemoryUsage = new Map();

/**
 * 格式化内存大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的内存大小
 */
function formatMemorySize(bytes) {
  if (bytes < 1024) return bytes + " B";
  else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
  else if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + " MB";
  else return (bytes / 1024 / 1024 / 1024).toFixed(2) + " GB";
}

/**
 * 获取当前内存使用情况
 * @returns {Object} 内存使用数据
 */
function getMemoryUsage() {
  const memoryUsage = process.memoryUsage();
  return {
    rss: formatMemorySize(memoryUsage.rss),
    heapTotal: formatMemorySize(memoryUsage.heapTotal),
    heapUsed: formatMemorySize(memoryUsage.heapUsed),
    external: formatMemorySize(memoryUsage.external || 0),
    arrayBuffers: formatMemorySize(memoryUsage.arrayBuffers || 0),
    rawRss: memoryUsage.rss,
    rawHeapTotal: memoryUsage.heapTotal,
    rawHeapUsed: memoryUsage.heapUsed,
  };
}

/**
 * 记录内存使用情况
 * @param {string} label - 记录标识
 * @param {boolean} [force=false] - 是否强制记录（忽略日志级别）
 */
function logMemoryUsage(label = "周期性内存检查", force = false) {
  const memory = getMemoryUsage();

  // 检查是否超过警告阈值
  const isOverThreshold = memory.rawHeapUsed > MEMORY_WARN_THRESHOLD * 1024 * 1024;

  // 如果强制记录、超过阈值或日志级别为DEBUG，则记录内存使用情况
  if (force || isOverThreshold || CURRENT_LOG_LEVEL >= LOG_LEVELS.DEBUG) {
    const logLevel = isOverThreshold ? "warn" : "info";
    logMessage(logLevel, `${label} - 内存使用情况:`, {
      rss: memory.rss,
      heapTotal: memory.heapTotal,
      heapUsed: memory.heapUsed,
      external: memory.external,
      timestamp: new Date().toISOString(),
    });

    // 如果可能，尝试触发垃圾回收
    if (isOverThreshold && global.gc) {
      logMessage("info", "内存使用超过阈值，尝试强制垃圾回收");
      global.gc();

      // 垃圾回收后再次记录内存使用情况
      setTimeout(() => {
        const afterGC = getMemoryUsage();
        logMessage("info", "垃圾回收后内存使用情况:", {
          rss: afterGC.rss,
          heapTotal: afterGC.heapTotal,
          heapUsed: afterGC.heapUsed,
          freed: formatMemorySize(memory.rawHeapUsed - afterGC.rawHeapUsed),
          timestamp: new Date().toISOString(),
        });
      }, 100);
    }
  }

  return memory;
}

/**
 * 跟踪请求的内存使用
 * @param {string} requestId - 请求ID
 * @param {string} phase - 阶段 ('start', 'end', 'process', etc.)
 * @param {Object} [extraData] - 额外数据
 */
function trackRequestMemory(requestId, phase, extraData = {}) {
  // 只在DEBUG级别或以上记录请求内存使用
  if (CURRENT_LOG_LEVEL < LOG_LEVELS.DEBUG) return;

  const memory = getMemoryUsage();
  const timestamp = Date.now();

  if (!requestMemoryUsage.has(requestId)) {
    requestMemoryUsage.set(requestId, {
      phases: [],
      startTime: timestamp,
    });
  }

  const requestData = requestMemoryUsage.get(requestId);
  requestData.phases.push({
    phase,
    memory,
    timestamp,
    ...extraData,
  });

  // 保存回Map
  requestMemoryUsage.set(requestId, requestData);
}

/**
 * 生成请求ID
 * @returns {string} 唯一请求ID
 */
function generateRequestId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/**
 * 完成请求内存跟踪并记录结果
 * @param {string} requestId - 请求ID
 * @param {string} [status='completed'] - 请求状态
 */
function finishRequestMemoryTracking(requestId, status = "completed") {
  // 只在DEBUG级别或以上记录请求内存使用
  if (CURRENT_LOG_LEVEL < LOG_LEVELS.DEBUG) return;

  if (requestMemoryUsage.has(requestId)) {
    const data = requestMemoryUsage.get(requestId);
    const now = Date.now();
    const duration = now - data.startTime;

    // 获取开始和结束阶段的内存使用
    const startPhase = data.phases.find((p) => p.phase === "start");
    const endPhase = data.phases.find((p) => p.phase === "end") || data.phases[data.phases.length - 1];

    if (startPhase && endPhase && startPhase !== endPhase) {
      const memoryDiff = endPhase.memory.rawHeapUsed - startPhase.memory.rawHeapUsed;
      const isSignificant = Math.abs(memoryDiff) > 10 * 1024 * 1024; // 10MB变化视为显著

      if (isSignificant || duration > 1000) {
        logMessage("debug", `请求 ${requestId} ${status} - 内存使用情况:`, {
          duration: `${duration}ms`,
          memoryChange: formatMemorySize(memoryDiff),
          startHeapUsed: startPhase.memory.heapUsed,
          endHeapUsed: endPhase.memory.heapUsed,
          phases: data.phases.length,
        });
      }
    }

    // 清理请求数据
    requestMemoryUsage.delete(requestId);
  }
}

// 定期内存使用监控
setInterval(() => {
  logMemoryUsage();

  // 清理超过5分钟的请求记录（可能是未正确清理的请求）
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;

  for (const [requestId, data] of requestMemoryUsage.entries()) {
    if (data.startTime < fiveMinutesAgo) {
      logMessage("warn", `请求 ${requestId} 的内存记录未正确清理，已超时`, {
        startTime: new Date(data.startTime).toISOString(),
        phases: data.phases.length,
      });
      requestMemoryUsage.delete(requestId);
    }
  }
}, MEMORY_MONITOR_INTERVAL);

// 启动时记录初始内存状态
logMemoryUsage("服务器启动", true);

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
// 处理multipart/form-data请求体的中间件
server.use((req, res, next) => {
  if (req.method === "POST" && req.headers["content-type"] && req.headers["content-type"].includes("multipart/form-data")) {
    // 生成唯一请求ID用于内存跟踪
    const requestId = generateRequestId();
    req.requestId = requestId;

    // 开始跟踪请求内存使用
    trackRequestMemory(requestId, "start", {
      path: req.path,
      method: req.method,
      contentType: req.headers["content-type"],
      contentLength: req.headers["content-length"] || "未知",
    });

    logMessage("debug", `检测到multipart/form-data请求: ${req.path}，请求ID: ${requestId}`);

    // 设置大小限制，避免过大的请求
    const MAX_SIZE = 300 * 1024 * 1024; // 300MB限制
    let totalSize = 0;
    let isTooLarge = false;

    // 对于multipart请求，我们需要保存原始数据
    const chunks = [];

    req.on("data", (chunk) => {
      // 累计大小
      totalSize += chunk.length;

      // 检查是否超过限制
      if (totalSize > MAX_SIZE) {
        if (!isTooLarge) {
          isTooLarge = true;
          logMessage("warn", `请求体超过最大限制 (${MAX_SIZE / 1024 / 1024}MB)，可能导致内存问题`, {
            requestId,
            path: req.path,
            totalSize: formatMemorySize(totalSize),
            limit: formatMemorySize(MAX_SIZE),
          });

          // 记录内存检查点
          trackRequestMemory(requestId, "size_exceeded", {
            totalSize: formatMemorySize(totalSize),
            limit: formatMemorySize(MAX_SIZE),
          });
        }
      }

      chunks.push(chunk);
    });

    req.on("end", () => {
      // 记录内存检查点
      trackRequestMemory(requestId, "chunks_loaded", {
        chunkCount: chunks.length,
        totalSize: formatMemorySize(totalSize),
      });

      if (isTooLarge) {
        logMessage("warn", `完成接收超大请求体: ${formatMemorySize(totalSize)}`, { requestId });
      }

      // 保存原始请求体
      req.rawBody = Buffer.concat(chunks);

      // 在请求处理完成后执行清理
      res.on("finish", () => {
        // 释放内存
        req.rawBody = null;

        // 记录和完成内存跟踪
        trackRequestMemory(requestId, "end");
        finishRequestMemoryTracking(requestId);

        // 建议垃圾回收
        if (totalSize > 50 * 1024 * 1024 && global.gc) {
          // 50MB
          logMessage("debug", `请求处理完成，尝试触发垃圾回收，请求大小: ${formatMemorySize(totalSize)}`, { requestId });
          setTimeout(() => {
            global.gc();
          }, 100);
        }
      });

      logMessage("debug", `multipart请求体已保存，大小: ${formatMemorySize(req.rawBody.length)}`, { requestId });

      // 记录内存检查点
      trackRequestMemory(requestId, "body_created", {
        bodySize: formatMemorySize(req.rawBody.length),
      });

      next();
    });

    req.on("error", (err) => {
      logMessage("error", `读取multipart请求体错误:`, { error: err, requestId });

      // 记录错误并完成内存跟踪
      trackRequestMemory(requestId, "error", { error: err.message });
      finishRequestMemoryTracking(requestId, "error");

      next(err);
    });

    // 请求超时处理
    req.setTimeout(300000, () => {
      // 5分钟超时
      logMessage("error", `处理multipart请求超时`, { requestId, path: req.path });
      trackRequestMemory(requestId, "timeout");
      finishRequestMemoryTracking(requestId, "timeout");
    });
  } else {
    // 非multipart请求，直接传递给下一个中间件
    next();
  }
});

// 处理原始请求体（XML、二进制等）
server.use(
    express.raw({
      type: ["application/xml", "text/xml", "application/octet-stream"],
      limit: "1gb", // 设置合理的大小限制
      verify: (req, res, buf, encoding) => {
        // 记录大型请求的内存使用
        if (buf && buf.length > 50 * 1024 * 1024) {
          // 10MB
          logMessage("debug", `大型请求体 (${req.method} ${req.path}):`, {
            contentType: req.headers["content-type"],
            size: formatMemorySize(buf.length),
            requrestId: req.requestId,
          });

          // 如果有请求ID，跟踪内存使用
          if (req.requestId) {
            trackRequestMemory(req.requestId, "raw_body_processed", {
              size: formatMemorySize(buf.length),
            });
          }
        }

        // 对于WebDAV方法，特别是MKCOL，记录详细信息以便调试
        if ((req.method === "MKCOL" || req.method === "PUT") && buf && buf.length > 50 * 1024 * 1024) {
          logMessage("debug", `大型WebDAV ${req.method} 请求体:`, {
            contentType: req.headers["content-type"],
            size: buf ? formatMemorySize(buf.length) : 0,
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

  // 处理multipart/form-data解析错误
  if (
      err.message &&
      (err.message.includes("Unexpected end of form") || err.message.includes("Unexpected end of multipart data") || err.message.includes("Multipart: Boundary not found"))
  ) {
    logMessage("error", `Multipart解析错误:`, {
      method: req.method,
      path: req.path,
      contentType: req.headers["content-type"] || "未知",
      error: err.message,
    });
    return res.status(400).json({
      error: "无效的表单数据",
      message: "无法解析multipart/form-data请求，请检查表单格式是否正确",
      detail: err.message,
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

  // 跟踪内存使用（如果有请求ID）
  if (expressReq.requestId) {
    trackRequestMemory(expressReq.requestId, "adapt_request_start");
  }

  // 获取请求体内容
  let body = undefined;
  if (["POST", "PUT", "PATCH", "PROPFIND", "PROPPATCH", "MKCOL", "COPY", "MOVE", "DELETE"].includes(expressReq.method)) {
    // 检查请求体的类型和内容
    let contentType = expressReq.headers["content-type"] || "";

    // 特殊处理multipart/form-data请求
    if (contentType.includes("multipart/form-data") && expressReq.rawBody) {
      // 使用预先保存的原始请求体
      logMessage("debug", `处理multipart/form-data请求: ${expressReq.path}，使用原始请求体，大小: ${formatMemorySize(expressReq.rawBody.length)}字节`, {
        requestId: expressReq.requestId,
      });

      body = expressReq.rawBody;

      // 跟踪内存使用
      if (expressReq.requestId) {
        trackRequestMemory(expressReq.requestId, "adapt_body_assigned", {
          bodySize: formatMemorySize(expressReq.rawBody.length),
        });
      }
    }
    // 对于WebDAV请求特殊处理
    else if (expressReq.path.startsWith("/dav")) {
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
          logMessage("warn", `MKCOL请求包含异常大的请求体 (${formatMemorySize(expressReq.body.length)})，可能是客户端错误或恶意请求`);
        }
      }
    }
    // 正常处理其他请求类型
    else if (!body) {
      // 只有在没有设置body的情况下才处理
      // 如果是JSON请求且已经被解析
      if ((contentType.includes("application/json") || contentType.includes("json")) && expressReq.body && typeof expressReq.body === "object") {
        body = JSON.stringify(expressReq.body);
      }
      // 如果是XML或二进制数据，使用Buffer
      else if (
          (contentType.includes("application/xml") || contentType.includes("text/xml") || contentType.includes("application/octet-stream")) &&
          Buffer.isBuffer(expressReq.body)
      ) {
        // 对于大型Buffer，记录内存使用
        if (expressReq.body.length > 50 * 1024 * 1024) {
          logMessage("debug", `处理大型二进制请求体: ${formatMemorySize(expressReq.body.length)}`, {
            requestId: expressReq.requestId,
            contentType,
          });

          // 跟踪内存使用
          if (expressReq.requestId) {
            trackRequestMemory(expressReq.requestId, "adapt_binary_body", {
              size: formatMemorySize(expressReq.body.length),
            });
          }
        }

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

  const request = new Request(url, requestInit);

  // 跟踪内存使用（如果有请求ID）
  if (expressReq.requestId) {
    trackRequestMemory(expressReq.requestId, "adapt_request_complete");

    // 将请求ID附加到请求对象上，方便后续跟踪
    // 注意：这是非标准的，因为Request对象不支持自定义属性
    // 我们在这里只是为了内部跟踪目的而添加
    Object.defineProperty(request, "requestId", {
      value: expressReq.requestId,
      enumerable: false,
    });
  }

  return request;
}

/**
 * 工具函数：将Worker Response转换为Express响应
 * 处理不同类型的响应（JSON、二进制、XML等）
 */
async function convertWorkerResponseToExpress(workerResponse, expressRes) {
  // 获取请求ID（如果存在）
  const requestId = expressRes.req?.requestId;

  // 如果存在请求ID，跟踪内存使用
  if (requestId) {
    trackRequestMemory(requestId, "convert_response_start");
  }

  expressRes.status(workerResponse.status);

  workerResponse.headers.forEach((value, key) => {
    expressRes.set(key, value);
  });

  if (workerResponse.body) {
    const contentType = workerResponse.headers.get("content-type") || "";

    try {
      // 处理不同类型的响应
      if (contentType.includes("application/json")) {
        // JSON响应
        const jsonData = await workerResponse.json();

        // 跟踪大型JSON响应
        if (requestId && JSON.stringify(jsonData).length > 1024 * 1024) {
          trackRequestMemory(requestId, "large_json_response", {
            size: formatMemorySize(JSON.stringify(jsonData).length),
          });
        }

        expressRes.json(jsonData);
      } else if (contentType.includes("application/xml") || contentType.includes("text/xml")) {
        // XML响应，常见于WebDAV请求
        const text = await workerResponse.text();

        // 跟踪大型XML响应
        if (requestId && text.length > 1024 * 1024) {
          trackRequestMemory(requestId, "large_xml_response", {
            size: formatMemorySize(text.length),
          });
        }

        expressRes.type(contentType).send(text);
      } else if (contentType.includes("text/")) {
        // 文本响应
        const text = await workerResponse.text();

        // 跟踪大型文本响应
        if (requestId && text.length > 1024 * 1024) {
          trackRequestMemory(requestId, "large_text_response", {
            size: formatMemorySize(text.length),
          });
        }

        expressRes.type(contentType).send(text);
      } else {
        // 二进制响应
        const buffer = await workerResponse.arrayBuffer();

        // 跟踪大型二进制响应
        if (requestId && buffer.byteLength > 50 * 1024 * 1024) {
          trackRequestMemory(requestId, "large_binary_response", {
            size: formatMemorySize(buffer.byteLength),
          });

          // 记录日志
          logMessage("debug", `发送大型二进制响应: ${formatMemorySize(buffer.byteLength)}`, {
            requestId,
            contentType,
          });
        }

        const responseBuffer = Buffer.from(buffer);
        expressRes.send(responseBuffer);
      }
    } catch (error) {
      // 记录错误
      logMessage("error", "处理响应时出错:", {
        error,
        requestId,
        status: workerResponse.status,
        contentType,
      });

      // 如果有请求ID，跟踪错误
      if (requestId) {
        trackRequestMemory(requestId, "response_error", {
          error: error.message,
        });
      }

      // 返回错误响应
      expressRes.status(500).json({
        error: "处理响应失败",
        message: error.message,
      });
    }
  } else {
    expressRes.end();
  }

  // 如果存在请求ID，跟踪完成状态
  if (requestId) {
    trackRequestMemory(requestId, "convert_response_complete");
  }
}

// 启动服务器
server.listen(PORT, "0.0.0.0", () => {
  logMessage("info", `CloudPaste后端服务运行在 http://0.0.0.0:${PORT}`);

  // 设置Docker容器内存监控
  setupDockerMemoryMonitoring();

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

/**
 * 设置Docker容器内存监控
 * 定期检查并记录容器的内存使用情况
 */
function setupDockerMemoryMonitoring() {
  // 容器内存监控间隔（毫秒）
  const DOCKER_MEMORY_CHECK_INTERVAL = process.env.DOCKER_MEMORY_CHECK_INTERVAL || 300000; // 默认5分钟

  // 尝试检测是否在Docker环境中运行
  const isInDocker = fs.existsSync("/.dockerenv") || (fs.existsSync("/proc/1/cgroup") && fs.readFileSync("/proc/1/cgroup", "utf8").includes("docker"));

  if (isInDocker) {
    logMessage("info", "检测到Docker环境，启用容器内存监控");

    // 初始容器内存检查
    setTimeout(checkDockerMemoryUsage, 10000); // 启动10秒后进行首次检查

    // 定期检查容器内存
    setInterval(checkDockerMemoryUsage, DOCKER_MEMORY_CHECK_INTERVAL);
  } else {
    logMessage("info", "未检测到Docker环境，跳过容器内存监控");
  }
}

/**
 * 检查Docker容器内存使用情况
 */
function checkDockerMemoryUsage() {
  try {
    // 获取容器内存限制
    let memoryLimit = 0;
    if (fs.existsSync("/sys/fs/cgroup/memory/memory.limit_in_bytes")) {
      memoryLimit = parseInt(fs.readFileSync("/sys/fs/cgroup/memory/memory.limit_in_bytes", "utf8").trim());
    } else if (fs.existsSync("/sys/fs/cgroup/memory.max")) {
      // cgroups v2
      const maxMem = fs.readFileSync("/sys/fs/cgroup/memory.max", "utf8").trim();
      if (maxMem !== "max") {
        memoryLimit = parseInt(maxMem);
      }
    }

    // 获取容器内存使用情况
    let memoryUsage = 0;
    if (fs.existsSync("/sys/fs/cgroup/memory/memory.usage_in_bytes")) {
      memoryUsage = parseInt(fs.readFileSync("/sys/fs/cgroup/memory/memory.usage_in_bytes", "utf8").trim());
    } else if (fs.existsSync("/sys/fs/cgroup/memory.current")) {
      // cgroups v2
      memoryUsage = parseInt(fs.readFileSync("/sys/fs/cgroup/memory.current", "utf8").trim());
    }

    // 计算内存使用百分比
    const memoryPercentage = memoryLimit > 0 ? ((memoryUsage / memoryLimit) * 100).toFixed(2) : 0;

    // 获取当前进程内存使用
    const nodeMemory = process.memoryUsage();

    // 记录内存使用情况
    logMessage("info", "Docker容器内存使用情况:", {
      containerMemoryUsage: formatMemorySize(memoryUsage),
      containerMemoryLimit: memoryLimit > 0 ? formatMemorySize(memoryLimit) : "未设置",
      containerMemoryPercentage: `${memoryPercentage}%`,
      nodeRss: formatMemorySize(nodeMemory.rss),
      nodeHeapTotal: formatMemorySize(nodeMemory.heapTotal),
      nodeHeapUsed: formatMemorySize(nodeMemory.heapUsed),
      timestamp: new Date().toISOString(),
    });

    // 检查严重内存不足情况
    if (memoryPercentage > 85) {
      logMessage("warn", `容器内存使用率过高 (${memoryPercentage}%)，可能导致OOM`, {
        containerMemoryUsage: formatMemorySize(memoryUsage),
        containerMemoryLimit: formatMemorySize(memoryLimit),
        nodeRss: formatMemorySize(nodeMemory.rss),
      });

      // 尝试强制垃圾回收
      if (global.gc) {
        logMessage("info", "内存使用率过高，尝试强制垃圾回收");
        global.gc();
      }
    }
  } catch (error) {
    logMessage("error", "检查Docker内存使用失败:", { error: error.message });
  }
}
