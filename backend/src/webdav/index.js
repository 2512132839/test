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

import { createWebDAVErrorResponse } from "./utils/errorUtils.js";
import { createAuthService, AuthType, PermissionType } from "../services/authService.js";
import { storeAuthInfo, getAuthInfo, isWebDAVClient } from "./utils/authCache.js";

/**
 * 创建未授权响应
 * @param {string} message - 响应消息
 * @param {string} userAgent - 用户代理字符串，用于判断客户端类型
 * @return {Response} 401响应对象
 */
function createUnauthorizedResponse(message = "Unauthorized", userAgent = "") {
  // 创建响应头
  const headers = {
    "Content-Type": "text/plain",
  };

  // 根据客户端类型设置不同的WWW-Authenticate头
  if (userAgent.includes("Dart/") && userAgent.includes("dart:io")) {
    // Dart客户端需要更简单的认证头格式
    console.log("WebDAV认证: 为Dart客户端提供简化的认证头");
    headers["WWW-Authenticate"] = 'Basic realm="WebDAV"';
  } else if (userAgent.includes("Microsoft-WebDAV-MiniRedir") || (userAgent.includes("Windows") && userAgent.includes("WebDAV"))) {
    // Windows WebDAV客户端需要标准格式
    headers["WWW-Authenticate"] = 'Basic realm="WebDAV", Bearer realm="WebDAV"';
  } else {
    // 默认格式，支持Basic和Bearer认证
    headers["WWW-Authenticate"] = 'Basic realm="WebDAV", Bearer realm="WebDAV"';
  }

  // 返回401响应
  return new Response(message, {
    status: ApiStatus.UNAUTHORIZED,
    headers: headers,
  });
}

/**
 * WebDAV认证中间件
 * 验证用户是否有权限访问WebDAV服务
 */
export const webdavAuthMiddleware = async (c, next) => {
  const db = c.env.DB;
  const authService = createAuthService(db);
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
        // 对于API密钥用户，需要重新获取完整的API密钥信息
        try {
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
            return next();
          }
        } catch (error) {
          console.error("WebDAV认证: 获取缓存API密钥信息失败", error);
          // 如果获取失败，清除缓存并要求重新认证
        }
      }
    }

    // 检测到WebDAV客户端但没有认证缓存，需要提供认证挑战
    if (isWebDAVClient(userAgent)) {
      console.log(`WebDAV认证: 检测到WebDAV客户端 (${userAgent.substring(0, 30)}...)，发送认证挑战`);
      return createUnauthorizedResponse(`Authentication required for WebDAV access`, userAgent);
    }

    // 非WebDAV客户端，通用错误响应
    console.log("WebDAV认证失败: 缺少认证头");
    return createUnauthorizedResponse("Unauthorized: Missing authentication header", userAgent);
  }

  // 使用新的权限认证服务进行认证
  try {
    const authResult = await authService.authenticate(authHeader);

    if (!authResult.isAuthenticated) {
      console.log("WebDAV认证失败: 认证无效");
      return createUnauthorizedResponse("Unauthorized: Invalid credentials", userAgent);
    }

    // 检查是否有挂载权限
    if (!authResult.hasPermission(PermissionType.MOUNT)) {
      console.log("WebDAV认证失败: 缺少挂载权限");
      return createUnauthorizedResponse("Unauthorized: Mount permission required", userAgent);
    }

    // 设置上下文信息
    if (authResult.authType === AuthType.ADMIN || authResult.isAdmin()) {
      c.set("userId", authResult.adminId);
      c.set("userType", "admin");

      // 认证信息 - 需要包含认证类型信息以便后续权限验证
      const authInfo = {
        userId: authResult.adminId,
        isAdmin: true,
        authType: authResult.authType,
      };
      c.set("authInfo", authInfo);

      // 存储认证信息到缓存
      storeAuthInfo(clientIp, userAgent, authInfo);
    } else if (authResult.authType === AuthType.API_KEY || authResult.keyInfo) {
      const apiKeyInfo = {
        id: authResult.keyInfo.id,
        name: authResult.keyInfo.name,
        basicPath: authResult.basicPath,
      };

      c.set("userId", apiKeyInfo);
      c.set("userType", "apiKey");

      // 认证信息
      const authInfo = {
        userId: authResult.userId,
        isAdmin: false,
        apiKey: authResult.keyInfo ? authResult.keyInfo.key : "unknown",
        authType: authResult.authType,
        apiKeyInfo: apiKeyInfo,
      };
      c.set("authInfo", authInfo);

      // 存储认证信息到缓存
      storeAuthInfo(clientIp, userAgent, authInfo);
    } else {
      //如果发生说明有逻辑错误
      console.error("WebDAV认证: 未知的认证结果类型", {
        authType: authResult.authType,
        isAdmin: authResult.isAdmin(),
        hasKeyInfo: !!authResult.keyInfo,
      });
      return createUnauthorizedResponse("Unauthorized: Unknown authentication type", userAgent);
    }

    console.log(`WebDAV认证成功: 用户类型=${authResult.authType}`);
    return next();
  } catch (error) {
    console.error("WebDAV认证错误:", error);
    return createUnauthorizedResponse("Unauthorized: Authentication error", userAgent);
  }
};

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
          return createUnauthorizedResponse("Unauthorized: Mount permission revoked", c.req.header("User-Agent") || "");
        }
      }
      // 处理Bearer认证类型的API密钥
      else if (authInfo.authType === "bearer" && authInfo.apiKey) {
        const hasMountPermission = await verifyApiKeyMountPermission(db, authInfo.apiKey);

        if (!hasMountPermission) {
          console.log(`WebDAV请求拒绝: ${method} ${path}, 挂载权限不足（Bearer认证）`);
          return createUnauthorizedResponse("Unauthorized: Mount permission revoked", c.req.header("User-Agent") || "");
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
