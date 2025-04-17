/**
 * WebDAV服务入口文件
 * 提供WebDAV挂载服务，支持Windows、macOS等系统对存储的访问
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
import { verifyPassword } from "../utils/crypto.js";
import { createWebDAVErrorResponse } from "./utils/errorUtils.js";
import { validateAdminToken } from "../services/adminService.js";
import { checkAndDeleteExpiredApiKey } from "../services/apiKeyService.js";
import { getLocalTimeString } from "../utils/common.js";
import { storeAuthInfo, getAuthInfo } from "./utils/authCache.js";

/**
 * 创建未授权响应
 * @param {string} message - 响应消息
 * @return {Response} 401响应对象
 */
function createUnauthorizedResponse(message = "Unauthorized") {
  return new Response(message, {
    status: ApiStatus.UNAUTHORIZED,
    headers: {
      // 同时支持Basic和Bearer认证方式
      "WWW-Authenticate": 'Basic realm="WebDAV", Bearer realm="WebDAV"',
      "Content-Type": "text/plain",
    },
  });
}

/**
 * WebDAV认证中间件
 * 验证用户是否有权限访问WebDAV服务
 */
export const webdavAuthMiddleware = async (c, next) => {
  const db = c.env.DB;
  const authHeader = c.req.header("Authorization");
  const userAgent = c.req.header("User-Agent") || "未知";

  // 获取客户端IP地址
  const clientIp = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || c.req.header("X-Real-IP") || "unknown";

  // 记录请求信息，包括用户代理
  console.log(`WebDAV认证请求: ${c.req.method} ${c.req.path}, 用户代理: ${userAgent.substring(0, 50)}${userAgent.length > 50 ? "..." : ""}`);

  // 如果没有认证头，检查缓存的认证信息
  if (!authHeader) {
    // 尝试从缓存获取认证信息
    const cachedAuth = getAuthInfo(clientIp, userAgent);

    // 如果找到缓存的认证信息，直接使用
    if (cachedAuth) {
      console.log(`WebDAV认证: 使用缓存的认证信息 (${clientIp.substring(0, 10)})`);

      // 根据缓存的认证类型设置上下文
      if (cachedAuth.isAdmin) {
        c.set("userId", cachedAuth.userId);
        c.set("userType", "admin");
        c.set("authInfo", cachedAuth);
        return next();
      } else if (cachedAuth.apiKey) {
        c.set("userId", cachedAuth.userId);
        c.set("userType", "apiKey");
        c.set("authInfo", cachedAuth);
        return next();
      }
    }

    // 如果没有缓存或缓存无效，返回401
    console.log("WebDAV认证失败: 缺少认证头");
    return createUnauthorizedResponse("Unauthorized: Missing authentication header");
  }

  // 1. 尝试Basic认证
  if (authHeader.toLowerCase().startsWith("basic ")) {
    console.log("WebDAV认证: 尝试Basic认证");
    return await handleBasicAuth(c, next, authHeader, db, clientIp, userAgent);
  }

  // 2. 尝试Bearer令牌认证
  if (authHeader.startsWith("Bearer ")) {
    console.log("WebDAV认证: 尝试Bearer令牌认证");
    return await handleBearerAuth(c, next, authHeader, db, clientIp, userAgent);
  }

  // 3. 不支持的认证方式
  console.log(`WebDAV认证失败: 不支持的认证方式 "${authHeader.split(" ")[0]}"`);
  return createUnauthorizedResponse("Unauthorized: Unsupported authentication method");
};

/**
 * 处理Basic认证
 * @param {Object} c - Hono上下文
 * @param {Function} next - 下一个中间件
 * @param {string} authHeader - 认证头
 * @param {D1Database} db - D1数据库实例
 * @param {string} clientIp - 客户端IP
 * @param {string} userAgent - 用户代理
 * @returns {Promise<Response>} 响应对象
 */
async function handleBasicAuth(c, next, authHeader, db, clientIp, userAgent) {
  try {
    // 提取并解析Base64认证信息
    const base64Credentials = authHeader.substring(6).trim(); // 移除"Basic "前缀（长度为6）并修剪空格

    let credentials;
    try {
      credentials = atob(base64Credentials);
    } catch (decodeError) {
      console.error("WebDAV认证: Base64解码失败");
      return createUnauthorizedResponse("Unauthorized: Invalid Base64 encoding");
    }

    // 使用indexOf查找分隔符，因为密码中可能包含冒号
    const separatorIndex = credentials.indexOf(":");
    if (separatorIndex === -1) {
      console.log("WebDAV认证失败: 无效的认证格式");
      return createUnauthorizedResponse("Unauthorized: Invalid credentials format");
    }

    const username = credentials.substring(0, separatorIndex);
    const password = credentials.substring(separatorIndex + 1);

    // 减少日志详细程度，保护敏感信息
    console.log("WebDAV认证: 开始验证用户凭证");

    // 情况1: 管理员登录
    try {
      // 查询是否存在具有匹配用户名的管理员
      const admin = await db.prepare("SELECT id, username, password FROM admins WHERE username = ?").bind(username).first();

      if (admin) {
        try {
          // 使用verifyPassword验证密码
          const isPasswordValid = await verifyPassword(password, admin.password);

          if (isPasswordValid) {
            // 设置管理员ID到上下文
            c.set("userId", admin.id);
            c.set("userType", "admin");

            // 认证信息
            const authInfo = {
              userId: admin.id,
              username,
              password,
              isAdmin: true,
              authType: "basic",
            };

            // 设置认证信息以便后续重新验证
            c.set("authInfo", authInfo);

            // 存储认证信息到缓存
            storeAuthInfo(clientIp, userAgent, authInfo);

            return next();
          }
          // 简化日志
          console.log("WebDAV认证: 管理员验证失败");
        } catch (verifyError) {
          console.error("WebDAV认证: 密码验证出错");
        }
      }
    } catch (error) {
      console.error("WebDAV认证: 验证管理员过程出错");
    }

    // 情况2: API密钥用户登录 (密钥值为用户名和密码)
    try {
      // 查询是否存在对应的API密钥
      console.log("WebDAV认证: 尝试API密钥验证");
      const apiKey = await db.prepare("SELECT id, key, mount_permission FROM api_keys WHERE key = ?").bind(username).first();

      if (apiKey) {
        // 简化mount_permission检查，D1数据库可能返回数字字段为字符串
        const hasMountPermission = String(apiKey.mount_permission) === "1" || apiKey.mount_permission === true;

        if (hasMountPermission) {
          // 对于API密钥，用户名和密码应相同
          if (username === password) {
            // 设置API密钥ID到上下文
            c.set("userId", apiKey.id);
            c.set("userType", "apiKey");

            // 认证信息
            const authInfo = {
              userId: apiKey.id,
              username,
              password,
              isAdmin: false,
              apiKey: username,
              authType: "basic",
            };

            // 设置认证信息以便后续重新验证
            c.set("authInfo", authInfo);

            // 存储认证信息到缓存
            storeAuthInfo(clientIp, userAgent, authInfo);

            return next();
          } else {
            console.log("WebDAV认证: API密钥验证失败");
          }
        } else {
          console.log("WebDAV认证: API密钥缺少挂载权限");
        }
      }
    } catch (error) {
      console.error("WebDAV认证: API密钥验证过程出错");
    }

    // 认证失败，返回401
    console.log("WebDAV认证: Basic认证失败");
    return createUnauthorizedResponse("Unauthorized: Invalid username or password");
  } catch (error) {
    console.error("WebDAV认证: Basic认证处理过程出错");
    return createUnauthorizedResponse("Unauthorized: Authentication error");
  }
}

/**
 * 处理Bearer令牌认证
 * @param {Object} c - Hono上下文
 * @param {Function} next - 下一个中间件
 * @param {string} authHeader - 认证头
 * @param {D1Database} db - D1数据库实例
 * @param {string} clientIp - 客户端IP
 * @param {string} userAgent - 用户代理
 * @returns {Promise<Response>} 响应对象
 */
async function handleBearerAuth(c, next, authHeader, db, clientIp, userAgent) {
  try {
    const token = authHeader.substring(7); // 移除"Bearer "前缀

    // 验证令牌不为空
    if (!token || token.trim() === "") {
      console.log("WebDAV认证: Bearer令牌为空");
      return createUnauthorizedResponse("Unauthorized: Empty Bearer token");
    }

    // 尝试验证管理员令牌
    try {
      const adminId = await validateAdminToken(db, token);

      if (adminId) {
        // 认证信息
        const authInfo = {
          userId: adminId,
          token,
          isAdmin: true,
          authType: "bearer",
        };

        // 令牌有效，设置管理员ID到上下文
        c.set("userId", adminId);
        c.set("userType", "admin");

        // 设置认证信息以便后续重新验证
        c.set("authInfo", authInfo);

        // 存储认证信息到缓存
        storeAuthInfo(clientIp, userAgent, authInfo);

        console.log("WebDAV认证: Bearer令牌认证成功（管理员）");
        return next();
      }
    } catch (adminError) {
      console.error("WebDAV认证: 管理员令牌验证出错", adminError);
      // 继续尝试API密钥验证
    }

    // 管理员令牌验证失败，尝试API密钥验证
    try {
      console.log("WebDAV认证: 尝试API密钥Bearer验证");
      // 查询是否存在对应的API密钥
      const apiKey = await db.prepare("SELECT id, key, mount_permission, expires_at FROM api_keys WHERE key = ?").bind(token).first();

      if (!apiKey) {
        console.log("WebDAV认证: 未找到对应的API密钥");
        // 不立即返回错误，让流程继续到统一的失败处理
      } else {
        // 检查API密钥是否过期
        try {
          if (await checkAndDeleteExpiredApiKey(db, apiKey)) {
            console.log("WebDAV认证: API密钥已过期");
            return createUnauthorizedResponse("Unauthorized: API key expired");
          }

          // 简化mount_permission检查，D1数据库可能返回数字字段为字符串
          const hasMountPermission = String(apiKey.mount_permission) === "1" || apiKey.mount_permission === true;

          if (hasMountPermission) {
            // 更新最后使用时间
            try {
              await db.prepare("UPDATE api_keys SET last_used = ? WHERE id = ?").bind(getLocalTimeString(), apiKey.id).run();
            } catch (updateError) {
              // 更新最后使用时间失败不阻止认证流程
              console.warn("WebDAV认证: 更新API密钥最后使用时间失败", updateError);
            }

            // 认证信息
            const authInfo = {
              userId: apiKey.id,
              token, // 存储原始令牌
              isAdmin: false,
              apiKey: token, // 使用令牌作为apiKey值
              authType: "bearer",
            };

            // 设置API密钥ID到上下文
            c.set("userId", apiKey.id);
            c.set("userType", "apiKey");

            // 设置认证信息以便后续重新验证
            c.set("authInfo", authInfo);

            // 存储认证信息到缓存
            storeAuthInfo(clientIp, userAgent, authInfo);

            console.log("WebDAV认证: Bearer令牌认证成功（API密钥）");
            return next();
          } else {
            console.log("WebDAV认证: API密钥缺少挂载权限");
          }
        } catch (expireCheckError) {
          console.error("WebDAV认证: API密钥过期检查出错", expireCheckError);
          // 出错时按照未过期处理，避免误判
        }
      }
    } catch (apiKeyError) {
      console.error("WebDAV认证: API密钥验证过程出错", apiKeyError);
    }

    // 所有认证方式均失败
    console.log("WebDAV认证: Bearer令牌认证失败");
    return createUnauthorizedResponse("Unauthorized: Invalid token");
  } catch (error) {
    console.error("WebDAV认证: Bearer认证处理过程出错", error);
    return createUnauthorizedResponse("Unauthorized: Bearer authentication error");
  }
}

/**
 * 重新验证API密钥的挂载权限
 * @param {D1Database} db - D1数据库实例
 * @param {string} apiKey - API密钥
 * @returns {Promise<boolean>} 是否具有挂载权限
 */
async function verifyApiKeyMountPermission(db, apiKey) {
  try {
    // 查询API密钥的挂载权限
    const result = await db.prepare("SELECT mount_permission FROM api_keys WHERE key = ?").bind(apiKey).first();

    if (!result) {
      // 简化日志，不暴露API密钥信息
      console.log("WebDAV权限验证: API密钥无效");
      return false;
    }

    // 检查挂载权限
    const hasMountPermission = String(result.mount_permission) === "1" || result.mount_permission === true;

    if (!hasMountPermission) {
      console.log("WebDAV权限验证: 挂载权限不足");
    }

    return hasMountPermission;
  } catch (error) {
    // 简化错误日志输出
    console.error("WebDAV权限验证: 验证过程出错");
    return false;
  }
}

/**
 * WebDAV处理主函数
 * 根据请求方法分发到不同的处理函数
 */
export async function handleWebDAV(c) {
  const method = c.req.method;
  const url = new URL(c.req.url);

  // 改进路径处理：先解码，然后移除前缀
  let path = decodeURIComponent(url.pathname);

  // 正则表达式替换确保正确处理所有变体
  path = path.replace(/^\/dav\/?/, "/");

  // 如果结果是空字符串，则使用根路径
  if (path === "") {
    path = "/";
  }

  const userId = c.get("userId");
  const userType = c.get("userType");
  const authInfo = c.get("authInfo");
  const db = c.env.DB;

  try {
    // 对于API密钥用户，每次操作时重新验证挂载权限
    if (userType === "apiKey" && authInfo) {
      // 根据认证类型判断如何验证权限
      if (authInfo.authType === "basic" && authInfo.apiKey) {
        const hasMountPermission = await verifyApiKeyMountPermission(db, authInfo.apiKey);

        if (!hasMountPermission) {
          console.log(`WebDAV请求拒绝: ${method} ${path}, 挂载权限不足（Basic认证）`);
          return createUnauthorizedResponse("Unauthorized: Mount permission revoked");
        }
      }
      // 处理Bearer认证类型的API密钥
      else if (authInfo.authType === "bearer" && authInfo.apiKey) {
        const hasMountPermission = await verifyApiKeyMountPermission(db, authInfo.apiKey);

        if (!hasMountPermission) {
          console.log(`WebDAV请求拒绝: ${method} ${path}, 挂载权限不足（Bearer认证）`);
          return createUnauthorizedResponse("Unauthorized: Mount permission revoked");
        }
      }
      // 未来可以添加其他认证类型的权限验证
    }

    // 精简日志，不记录用户ID
    console.log(`WebDAV请求: ${method} ${path}, 用户类型: ${userType}, 认证类型: ${authInfo?.authType || "未知"}`);

    // 根据不同的请求方法分发到对应的处理函数
    let response;
    switch (method) {
      case "OPTIONS":
        response = await handleOptions(c);
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
        throw new HTTPException(ApiStatus.METHOD_NOT_ALLOWED, { message: "不支持的请求方法" });
    }

    // 精简日志，只记录状态码
    console.log(`WebDAV响应: ${method} ${path}, 状态码: ${response.status}`);
    return response;
  } catch (error) {
    console.error(`WebDAV处理错误: ${method} ${path}`, error);

    // 使用HTTP异常处理
    if (error instanceof HTTPException) {
      return new Response(error.message, {
        status: error.status,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // 返回通用错误响应
    return createWebDAVErrorResponse("内部服务器错误", 500);
  }
}
