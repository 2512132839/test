/**
 * WebDAV统一认证核心
 * - 统一认证流程，支持Bearer、ApiKey、Basic三种认证
 */

import { createWebDAVDetector } from "./WebDAVDetector.js";
import { WebDAVPermissionChecker } from "./PermissionChecker.js";
import { WebDAVAuthCache } from "./AuthCache.js";
import { getWebDAVConfig, getAuthHeader } from "../config/WebDAVConfig.js";
import { createAuthService } from "../../../services/authService.js";

/**
 * 认证结果类型枚举
 */
export const AuthResultType = {
  SUCCESS: "success",
  CHALLENGE: "challenge",
  FORBIDDEN: "forbidden",
  UNAUTHORIZED: "unauthorized",
  NOT_WEBDAV: "not_webdav",
  ERROR: "error",
};

/**
 * 全局共享的认证缓存实例
 * 确保所有WebDAVAuth实例共享同一个缓存
 */
let globalAuthCache = null;

/**
 * WebDAV统一认证核心类
 */
export class WebDAVAuth {
  constructor(db) {
    this.db = db;
    this.authService = createAuthService(db);
    this.detector = createWebDAVDetector();
    this.permissionChecker = new WebDAVPermissionChecker();

    // 使用全局共享的缓存实例
    if (!globalAuthCache) {
      globalAuthCache = new WebDAVAuthCache();
      console.log("WebDAV认证: 创建全局共享缓存实例");
    }
    this.authCache = globalAuthCache;

    this.config = getWebDAVConfig();
  }

  /**
   * 统一认证入口
   * 处理所有WebDAV认证逻辑
   *
   * @param {Object} request - 标准化请求对象
   * @param {string} request.method - HTTP方法
   * @param {Object} request.headers - HTTP头部
   * @param {string} request.url - 请求URL
   * @param {string} request.clientIp - 客户端IP
   * @param {string} request.userAgent - 用户代理
   * @returns {Promise<Object>} 认证结果
   */
  async authenticate(request) {
    try {
      // 第1步：协议检测
      if (!this.detector.detectWebDAVRequest(request)) {
        return {
          type: AuthResultType.NOT_WEBDAV,
          message: "非WebDAV请求",
        };
      }

      console.log(`WebDAV认证开始: ${request.method} ${request.url}`);

      // 第2步：Authorization头认证
      if (request.headers.authorization) {
        const authResult = await this.performHeaderAuthentication(request);
        if (authResult.type === AuthResultType.SUCCESS) {
          return authResult;
        }
        // 如果有认证头但认证失败，直接返回错误，不尝试缓存
        if (authResult.type === AuthResultType.FORBIDDEN) {
          return authResult;
        }
      }

      // 第3步：认证缓存尝试
      const cacheResult = await this.tryAuthenticationCache(request);
      if (cacheResult.type === AuthResultType.SUCCESS) {
        return cacheResult;
      }

      // 第4步：发送认证挑战
      return this.generateAuthChallenge(request);
    } catch (error) {
      console.error("WebDAV认证错误:", error);
      return {
        type: AuthResultType.ERROR,
        message: "认证过程发生错误",
        error: error.message,
      };
    }
  }

  /**
   * 执行Authorization头认证
   * @param {Object} request - 请求对象
   * @returns {Promise<Object>} 认证结果
   */
  async performHeaderAuthentication(request) {
    try {
      const authResult = await this.authService.authenticate(request.headers.authorization);

      if (!authResult.isAuthenticated) {
        console.log("WebDAV认证失败: 认证头无效");
        return {
          type: AuthResultType.UNAUTHORIZED,
          message: "认证头无效",
        };
      }

      // WebDAV权限检查
      const permissionResult = this.permissionChecker.checkWebDAVPermission(authResult, request.method);
      if (!permissionResult.hasPermission) {
        console.log(`WebDAV认证失败: ${permissionResult.reason}`);
        return {
          type: AuthResultType.FORBIDDEN,
          message: permissionResult.reason,
        };
      }

      // 认证成功，缓存认证信息
      await this.cacheAuthenticationResult(request, authResult);

      console.log(`WebDAV认证成功: 用户类型=${authResult.isAdmin() ? "admin" : "apiKey"}`);

      return {
        type: AuthResultType.SUCCESS,
        authResult: authResult,
        userType: authResult.isAdmin() ? "admin" : "apiKey",
        userId: authResult.getUserId(),
        permissions: permissionResult.permissions,
      };
    } catch (error) {
      console.error("WebDAV头部认证错误:", error);
      return {
        type: AuthResultType.ERROR,
        message: "头部认证失败",
        error: error.message,
      };
    }
  }

  /**
   * 尝试认证缓存
   * @param {Object} request - 请求对象
   * @returns {Promise<Object>} 认证结果
   */
  async tryAuthenticationCache(request) {
    try {
      const cachedAuth = this.authCache.getAuthInfo(request.clientIp, request.userAgent);

      if (!cachedAuth) {
        return {
          type: AuthResultType.UNAUTHORIZED,
          message: "无缓存认证信息",
        };
      }

      console.log("WebDAV认证: 使用缓存认证信息");

      // 验证缓存的认证信息是否仍然有效
      if (cachedAuth.isAdmin) {
        // 管理员认证，直接通过
        return {
          type: AuthResultType.SUCCESS,
          authResult: cachedAuth.authResult,
          userType: "admin",
          userId: cachedAuth.userId,
          fromCache: true,
        };
      } else if (cachedAuth.apiKey) {
        // API密钥用户，重新验证权限
        const authResult = await this.authService.validateApiKeyAuth(cachedAuth.apiKey);
        if (authResult.isAuthenticated) {
          const permissionResult = this.permissionChecker.checkWebDAVPermission(authResult, request.method);
          if (permissionResult.hasPermission) {
            return {
              type: AuthResultType.SUCCESS,
              authResult: authResult,
              userType: "apiKey",
              userId: authResult.getUserId(),
              permissions: permissionResult.permissions,
              fromCache: true,
            };
          } else {
            console.log("WebDAV认证: 缓存的API密钥权限已失效");
          }
        } else {
          console.log("WebDAV认证: 缓存的API密钥已失效");
        }
      }

      // 缓存失效，清除缓存
      this.authCache.clearAuthInfo(request.clientIp, request.userAgent);

      return {
        type: AuthResultType.UNAUTHORIZED,
        message: "缓存认证信息已失效",
      };
    } catch (error) {
      console.error("WebDAV缓存认证错误:", error);
      return {
        type: AuthResultType.ERROR,
        message: "缓存认证失败",
        error: error.message,
      };
    }
  }

  /**
   * 生成认证挑战
   * @param {Object} request - 请求对象
   * @returns {Object} 认证挑战结果
   */
  generateAuthChallenge(request) {
    console.log("WebDAV认证: 发送认证挑战");

    // 根据请求特征决定使用标准或简化认证头
    const useSimpleAuth = this.shouldUseSimpleAuth(request);
    const authHeader = getAuthHeader(useSimpleAuth);

    if (useSimpleAuth) {
      console.log("WebDAV认证: 使用简化认证头（兼容特殊客户端）");
    }

    return {
      type: AuthResultType.CHALLENGE,
      message: "需要WebDAV认证",
      headers: {
        "WWW-Authenticate": authHeader,
      },
      statusCode: 401,
    };
  }

  /**
   * 判断是否应该使用简化认证头
   * @param {Object} request - 请求对象
   * @returns {boolean} 是否使用简化认证头
   */
  shouldUseSimpleAuth(request) {
    const userAgent = request.userAgent || "";

    // Dart客户端需要简化认证头
    return userAgent.includes("Dart/") && userAgent.includes("dart:io");
  }

  /**
   * 缓存认证结果
   * @param {Object} request - 请求对象
   * @param {Object} authResult - 认证结果
   */
  async cacheAuthenticationResult(request, authResult) {
    try {
      const authInfo = {
        userId: authResult.getUserId(),
        isAdmin: authResult.isAdmin(),
        apiKey: authResult.isAdmin() ? null : authResult.keyInfo?.key,
        apiKeyInfo: authResult.isAdmin() ? null : authResult.keyInfo,
        authResult: authResult,
        timestamp: Date.now(),
      };

      this.authCache.storeAuthInfo(request.clientIp, request.userAgent, authInfo);
      console.log("WebDAV认证: 认证信息已缓存");
    } catch (error) {
      console.error("WebDAV认证缓存失败:", error);
      // 缓存失败不影响认证流程
    }
  }

  /**
   * 清理过期缓存
   */
  cleanupExpiredCache() {
    this.authCache.cleanup();
  }

  /**
   * 获取认证统计信息
   * @returns {Object} 统计信息
   */
  getAuthStats() {
    return {
      cacheStats: this.authCache.getStats(),
      detectorStats: this.detector.getDetectionStats(),
      config: {
        cacheTTL: this.config.SECURITY.CACHE_TTL,
        maxAuthAttempts: this.config.SECURITY.MAX_AUTH_ATTEMPTS,
      },
    };
  }

  /**
   * 获取全局缓存实例（用于调试）
   * @returns {WebDAVAuthCache} 全局缓存实例
   */
  static getGlobalCache() {
    return globalAuthCache;
  }

  /**
   * 重置全局缓存（用于测试）
   */
  static resetGlobalCache() {
    if (globalAuthCache) {
      globalAuthCache.clearAll();
      globalAuthCache = null;
      console.log("WebDAV认证: 全局缓存已重置");
    }
  }
}

/**
 * 创建WebDAV认证实例
 * @param {D1Database} db - 数据库实例
 * @returns {WebDAVAuth} 认证实例
 */
export function createWebDAVAuth(db) {
  return new WebDAVAuth(db);
}
