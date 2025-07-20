/**
 * WebDAV服务入口文件
 *
 * 基于主流WebDAV实现设计，提供完整的WebDAV协议支持
 */

import { handlePropfind } from "./methods/propfind.js";
import { handleOptions } from "./methods/options.js";
import { handlePut } from "./methods/put.js";
import { handleGet } from "./methods/get.js";
import { handleDelete } from "./methods/delete.js";
import { handleMkcol } from "./methods/mkcol.js";
import { handleMove } from "./methods/move.js";
import { handleCopy } from "./methods/copy.js";
import { handleLock } from "./methods/lock.js";
import { handleUnlock } from "./methods/unlock.js";
import { handleProppatch } from "./methods/proppatch.js";

import { HTTPException } from "hono/http-exception";
import { ApiStatus } from "../constants/index.js";
import { createWebDAVErrorResponse } from "./utils/errorUtils.js";
import { createAuthService, AuthType, PermissionType } from "../services/authService.js";
import { storeAuthInfo, getAuthInfo, isWebDAVClient } from "./utils/authCache.js";

/**
 * WebDAV服务配置
 */
const WEBDAV_CONFIG = {
  // 支持的HTTP方法
  SUPPORTED_METHODS: ["OPTIONS", "PROPFIND", "GET", "HEAD", "PUT", "DELETE", "MKCOL", "COPY", "MOVE", "LOCK", "UNLOCK", "PROPPATCH"],

  // 路径前缀处理
  PATH_PREFIX: "/dav",

  // 安全配置
  SECURITY: {
    MAX_PATH_LENGTH: 2048,
    CACHE_TTL: 300, // 5分钟认证缓存
    MAX_AUTH_ATTEMPTS: 5,
    RATE_LIMIT_WINDOW: 60000, // 1分钟
  },

  // 客户端兼容性配置
  CLIENT_COMPATIBILITY: {
    WINDOWS_WEBDAV: {
      userAgentPattern: /Microsoft-WebDAV-MiniRedir|Windows.*WebDAV/i,
      authHeader: 'Basic realm="WebDAV", Bearer realm="WebDAV"',
    },
    DART_CLIENT: {
      userAgentPattern: /Dart\/.*dart:io/i,
      authHeader: 'Basic realm="WebDAV"',
    },
    DEFAULT: {
      authHeader: 'Basic realm="WebDAV", Bearer realm="WebDAV"',
    },
  },
};

/**
 * 创建标准化的未授权响应
 * 根据客户端类型提供最佳的认证挑战
 *
 * @param {string} message - 响应消息
 * @param {string} userAgent - 用户代理字符串
 * @param {Object} options - 额外选项
 * @returns {Response} 401响应对象
 */
function createUnauthorizedResponse(message = "Unauthorized", userAgent = "", options = {}) {
  const headers = {
    "Content-Type": "text/plain",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };

  // 根据客户端类型设置最适合的WWW-Authenticate头
  let authHeader = WEBDAV_CONFIG.CLIENT_COMPATIBILITY.DEFAULT.authHeader;

  for (const [clientType, config] of Object.entries(WEBDAV_CONFIG.CLIENT_COMPATIBILITY)) {
    if (clientType !== "DEFAULT" && config.userAgentPattern.test(userAgent)) {
      authHeader = config.authHeader;
      console.log(`WebDAV认证: 为${clientType}客户端提供专用认证头`);
      break;
    }
  }

  headers["WWW-Authenticate"] = authHeader;

  // 添加CORS头支持跨域WebDAV客户端
  if (options.includeCors) {
    headers["Access-Control-Allow-Origin"] = "*";
    headers["Access-Control-Allow-Methods"] = WEBDAV_CONFIG.SUPPORTED_METHODS.join(", ");
    headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Depth, If, Lock-Token, Overwrite, Destination";
  }

  return new Response(message, {
    status: ApiStatus.UNAUTHORIZED,
    headers: headers,
  });
}

/**
 * 验证API密钥的挂载权限
 *
 * @param {D1Database} db - D1数据库实例
 * @param {string} apiKey - API密钥
 * @returns {Promise<boolean>} 是否具有挂载权限
 */
async function verifyApiKeyMountPermission(db, apiKey) {
  try {
    const result = await db.prepare("SELECT mount_permission FROM api_keys WHERE key = ?").bind(apiKey).first();

    if (!result) {
      console.log("WebDAV权限验证: API密钥无效");
      return false;
    }

    const hasMountPermission = String(result.mount_permission) === "1" || result.mount_permission === true;

    if (!hasMountPermission) {
      console.log("WebDAV权限验证: 挂载权限不足");
    }

    return hasMountPermission;
  } catch (error) {
    console.error("WebDAV权限验证: 验证过程出错", error);
    return false;
  }
}

/**
 * 执行路径安全检查
 * 防止路径遍历攻击和其他安全威胁
 *
 * @param {string} path - 要检查的路径
 * @throws {HTTPException} 路径不安全时抛出异常
 */
function validatePathSecurity(path) {
  // 检查路径长度
  if (path.length > WEBDAV_CONFIG.SECURITY.MAX_PATH_LENGTH) {
    throw new HTTPException(400, {
      message: `Path too long: maximum ${WEBDAV_CONFIG.SECURITY.MAX_PATH_LENGTH} characters allowed`,
    });
  }

  // 检查路径遍历攻击
  const dangerousPatterns = ["../", "..\\", "%2e%2e", "%2E%2E", "..%2f", "..%2F", "..%5c", "..%5C"];

  for (const pattern of dangerousPatterns) {
    if (path.includes(pattern)) {
      console.warn("WebDAV安全警告: 检测到路径遍历攻击尝试:", path);
      throw new HTTPException(400, {
        message: "Invalid path: path traversal not allowed",
      });
    }
  }

  // 检查控制字符
  if (/[\x00-\x1f\x7f]/.test(path)) {
    console.warn("WebDAV安全警告: 检测到控制字符:", path);
    throw new HTTPException(400, {
      message: "Invalid path: control characters not allowed",
    });
  }

  // 检查空字节注入
  if (path.includes("\0")) {
    console.warn("WebDAV安全警告: 检测到空字节注入:", path);
    throw new HTTPException(400, {
      message: "Invalid path: null bytes not allowed",
    });
  }
}

/**
 * 标准化路径处理
 * 移除WebDAV前缀并规范化路径格式
 *
 * @param {string} rawPath - 原始路径
 * @returns {string} 标准化后的路径
 */
function normalizePath(rawPath) {
  let path;

  // 安全的URL解码
  try {
    path = decodeURIComponent(rawPath);
  } catch (error) {
    console.warn("WebDAV路径解码失败:", error.message);
    throw new HTTPException(400, { message: "Invalid path encoding" });
  }

  // 移除WebDAV前缀
  path = path.replace(new RegExp(`^${WEBDAV_CONFIG.PATH_PREFIX}/?`), "/");

  // 确保路径以/开头
  if (path === "" || path === "/") {
    path = "/";
  } else if (!path.startsWith("/")) {
    path = "/" + path;
  }

  return path;
}

/**
 * WebDAV认证中间件
 *
 * 基于主流WebDAV服务器的认证模式设计
 * 支持多种认证方式：Bearer Token、API Key、Basic Auth
 *
 * @param {Object} c - Hono上下文
 * @param {Function} next - 下一个中间件
 */
export const webdavAuthMiddleware = async (c, next) => {
  const db = c.env.DB;
  const authService = createAuthService(db);
  const authHeader = c.req.header("Authorization");
  const userAgent = c.req.header("User-Agent") || "Unknown";

  // 获取客户端标识信息
  const clientIp = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || c.req.header("X-Real-IP") || "unknown";

  // 安全日志记录（清理敏感信息）
  const sanitizedPath = c.req.path.replace(/[^\w\-\/\.]/g, "_");
  const truncatedUserAgent = userAgent.substring(0, 50) + (userAgent.length > 50 ? "..." : "");
  console.log(`WebDAV认证请求: ${c.req.method} ${sanitizedPath}, 客户端: ${truncatedUserAgent}`);

  try {
    // 第一步：尝试使用认证头进行认证
    if (authHeader) {
      const authResult = await authService.authenticate(authHeader);

      if (authResult.isAuthenticated) {
        // 检查挂载权限
        if (!authResult.hasPermission(PermissionType.MOUNT)) {
          console.log("WebDAV认证失败: 缺少挂载权限");
          return createUnauthorizedResponse("Unauthorized: Mount permission required", userAgent);
        }

        // 设置认证上下文
        await setAuthenticationContext(c, authResult, clientIp, userAgent);
        return next();
      }
    }

    // 第二步：尝试使用认证缓存
    if (!authHeader) {
      const cachedAuth = await tryAuthenticationCache(c, db, clientIp, userAgent);
      if (cachedAuth) {
        return next();
      }
    }

    // 第三步：检测WebDAV客户端并发送认证挑战
    if (isWebDAVClient(userAgent)) {
      console.log(`WebDAV认证: 检测到WebDAV客户端，发送认证挑战`);
      return createUnauthorizedResponse("Authentication required for WebDAV access", userAgent, {
        includeCors: true,
      });
    }

    // 第四步：通用认证失败响应
    console.log("WebDAV认证失败: 缺少有效认证");
    return createUnauthorizedResponse("Unauthorized: Missing or invalid authentication", userAgent);
  } catch (error) {
    console.error("WebDAV认证错误:", error);
    return createUnauthorizedResponse("Unauthorized: Authentication error", userAgent);
  }
};

/**
 * 设置认证上下文信息
 *
 * @param {Object} c - Hono上下文
 * @param {Object} authResult - 认证结果
 * @param {string} clientIp - 客户端IP
 * @param {string} userAgent - 用户代理
 */
async function setAuthenticationContext(c, authResult, clientIp, userAgent) {
  if (authResult.authType === AuthType.ADMIN || authResult.isAdmin()) {
    // 管理员用户
    c.set("userId", authResult.adminId);
    c.set("userType", "admin");

    const authInfo = {
      userId: authResult.adminId,
      isAdmin: true,
      authType: authResult.authType,
    };
    c.set("authInfo", authInfo);

    // 缓存认证信息 - 使用现有的authCache.js API
    storeAuthInfo(clientIp, userAgent, authInfo);
  } else if (authResult.authType === AuthType.API_KEY || authResult.keyInfo) {
    // API密钥用户
    const apiKeyInfo = {
      id: authResult.keyInfo.id,
      name: authResult.keyInfo.name,
      basicPath: authResult.basicPath,
    };

    c.set("userId", apiKeyInfo);
    c.set("userType", "apiKey");

    const authInfo = {
      userId: authResult.userId,
      isAdmin: false,
      apiKey: authResult.keyInfo ? authResult.keyInfo.key : "unknown",
      authType: authResult.authType,
      apiKeyInfo: apiKeyInfo,
    };
    c.set("authInfo", authInfo);

    // 缓存认证信息 - 使用现有的authCache.js API
    storeAuthInfo(clientIp, userAgent, authInfo);
  } else {
    throw new Error(`Unknown authentication type: ${authResult.authType}`);
  }

  console.log(`WebDAV认证成功: 用户类型=${authResult.authType}`);
}

/**
 * 尝试使用认证缓存
 *
 * @param {Object} c - Hono上下文
 * @param {D1Database} db - 数据库实例
 * @param {string} clientIp - 客户端IP
 * @param {string} userAgent - 用户代理
 * @returns {Promise<boolean>} 是否成功使用缓存认证
 */
async function tryAuthenticationCache(c, db, clientIp, userAgent) {
  try {
    // 使用现有的authCache.js API
    const cachedAuth = getAuthInfo(clientIp, userAgent);

    if (!cachedAuth) {
      return false;
    }

    console.log(`WebDAV认证: 使用缓存的认证信息`);

    // 验证缓存的认证信息
    if (cachedAuth.isAdmin) {
      c.set("userId", cachedAuth.userId);
      c.set("userType", "admin");
      c.set("authInfo", cachedAuth);
      return true;
    } else if (cachedAuth.apiKey) {
      // 重新验证API密钥权限
      const hasMountPermission = await verifyApiKeyMountPermission(db, cachedAuth.apiKey);
      if (!hasMountPermission) {
        console.log("WebDAV认证: 缓存的API密钥权限已失效");
        return false;
      }

      // 重新获取API密钥信息
      const apiKey = await db.prepare("SELECT id, name, basic_path FROM api_keys WHERE id = ?").bind(cachedAuth.userId).first();

      if (apiKey) {
        const apiKeyInfo = {
          id: apiKey.id,
          name: apiKey.name,
          basicPath: apiKey.basic_path || "/",
        };
        c.set("userId", apiKeyInfo);
        c.set("userType", "apiKey");
        c.set("authInfo", { ...cachedAuth, apiKeyInfo });
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("WebDAV认证缓存处理错误:", error);
    return false;
  }
}

/**
 * WebDAV主处理函数
 *
 *
 * @param {Object} c - Hono上下文
 * @returns {Response} HTTP响应
 */
export async function handleWebDAV(c) {
  const method = c.req.method;
  const url = new URL(c.req.url);

  // 路径处理和安全检查
  const rawPath = url.pathname;
  let path;

  try {
    // 标准化路径
    path = normalizePath(rawPath);

    // 安全检查
    validatePathSecurity(path);
  } catch (error) {
    if (error instanceof HTTPException) {
      return new Response(error.message, {
        status: error.status,
        headers: { "Content-Type": "text/plain" },
      });
    }
    throw error;
  }

  // 获取认证上下文
  const userId = c.get("userId");
  const userType = c.get("userType");
  const authInfo = c.get("authInfo");
  const db = c.env.DB;

  try {
    // API密钥用户的权限重新验证
    if (userType === "apiKey" && authInfo && authInfo.apiKey) {
      const hasMountPermission = await verifyApiKeyMountPermission(db, authInfo.apiKey);
      if (!hasMountPermission) {
        console.log(`WebDAV请求拒绝: ${method} ${path}, 挂载权限已撤销`);
        return createUnauthorizedResponse("Unauthorized: Mount permission revoked", c.req.header("User-Agent") || "");
      }
    }

    // 记录请求日志
    console.log(`WebDAV请求: ${method} ${path}, 用户类型: ${userType}`);

    // 方法分发 - 基于主流WebDAV服务器的方法处理模式
    let response;
    switch (method) {
      case "OPTIONS":
        response = await handleOptions(c, path, userId, userType, db);
        break;
      case "PROPFIND":
        response = await handlePropfind(c, path, userId, userType, db);
        break;
      case "GET":
      case "HEAD":
        response = await handleGet(c, path, userId, userType, db);
        break;
      case "PUT":
        response = await handlePut(c, path, userId, userType, db);
        break;
      case "DELETE":
        response = await handleDelete(c, path, userId, userType, db);
        break;
      case "MKCOL":
        response = await handleMkcol(c, path, userId, userType, db);
        break;
      case "MOVE":
        response = await handleMove(c, path, userId, userType, db);
        break;
      case "COPY":
        response = await handleCopy(c, path, userId, userType, db);
        break;
      case "LOCK":
        response = await handleLock(c, path, userId, userType, db);
        break;
      case "UNLOCK":
        response = await handleUnlock(c, path, userId, userType, db);
        break;
      case "PROPPATCH":
        response = await handleProppatch(c, path, userId, userType, db);
        break;
      default:
        console.warn(`WebDAV不支持的方法: ${method}`);
        throw new HTTPException(ApiStatus.METHOD_NOT_ALLOWED, {
          message: `Method ${method} not supported`,
        });
    }

    // 记录响应日志
    console.log(`WebDAV响应: ${method} ${path}, 状态码: ${response.status}`);
    return response;
  } catch (error) {
    console.error(`WebDAV处理错误: ${method} ${path}`, error);

    // 标准化错误处理
    if (error instanceof HTTPException) {
      return new Response(error.message, {
        status: error.status,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // 通用错误响应
    return createWebDAVErrorResponse("Internal Server Error", 500);
  }
}
