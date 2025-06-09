/**
 * 统一权限认证中间件
 * 基于新的权限认证服务实现的中间件集合
 */

import { createAuthService, PermissionType } from "../services/authService.js";
import { ApiStatus } from "../constants/index.js";
import { HTTPException } from "hono/http-exception";

/**
 * 基础认证中间件
 * 解析认证信息并存储到上下文中，但不强制要求认证
 */
export const baseAuthMiddleware = async (c, next) => {
  const authService = createAuthService(c.env.DB);
  const authHeader = c.req.header("Authorization");

  try {
    const authResult = await authService.authenticate(authHeader);

    // 将认证结果存储到上下文中
    c.set("authResult", authResult);
    c.set("authService", authService);

    await next();
  } catch (error) {
    console.error("基础认证中间件错误:", error);
    throw new HTTPException(ApiStatus.INTERNAL_ERROR, {
      message: "认证处理失败: " + error.message,
    });
  }
};

/**
 * 要求认证的中间件
 * 必须通过认证才能继续
 */
export const requireAuthMiddleware = async (c, next) => {
  const authResult = c.get("authResult");

  if (!authResult || !authResult.isAuthenticated) {
    throw new HTTPException(ApiStatus.UNAUTHORIZED, {
      message: "需要认证访问",
    });
  }

  await next();
};

/**
 * 要求管理员权限的中间件
 */
export const requireAdminMiddleware = async (c, next) => {
  const authResult = c.get("authResult");

  if (!authResult || !authResult.isAuthenticated || !authResult.isAdmin()) {
    throw new HTTPException(ApiStatus.FORBIDDEN, {
      message: "需要管理员权限",
    });
  }

  await next();
};

/**
 * 要求文本权限的中间件
 */
export const requireTextPermissionMiddleware = async (c, next) => {
  const authResult = c.get("authResult");

  if (!authResult || !authResult.isAuthenticated) {
    throw new HTTPException(ApiStatus.UNAUTHORIZED, {
      message: "需要认证访问",
    });
  }

  if (!authResult.hasPermission(PermissionType.TEXT)) {
    throw new HTTPException(ApiStatus.FORBIDDEN, {
      message: "需要文本权限",
    });
  }

  await next();
};

/**
 * 要求文件权限的中间件
 */
export const requireFilePermissionMiddleware = async (c, next) => {
  const authResult = c.get("authResult");

  if (!authResult || !authResult.isAuthenticated) {
    throw new HTTPException(ApiStatus.UNAUTHORIZED, {
      message: "需要认证访问",
    });
  }

  if (!authResult.hasPermission(PermissionType.FILE)) {
    throw new HTTPException(ApiStatus.FORBIDDEN, {
      message: "需要文件权限",
    });
  }

  await next();
};

/**
 * 要求挂载权限的中间件
 */
export const requireMountPermissionMiddleware = async (c, next) => {
  const authResult = c.get("authResult");

  if (!authResult || !authResult.isAuthenticated) {
    throw new HTTPException(ApiStatus.UNAUTHORIZED, {
      message: "需要认证访问",
    });
  }

  if (!authResult.hasPermission(PermissionType.MOUNT)) {
    throw new HTTPException(ApiStatus.FORBIDDEN, {
      message: "需要挂载权限",
    });
  }

  await next();
};

/**
 * 创建路径权限检查中间件
 * @param {string} permissionType - 权限类型
 * @returns {Function} 中间件函数
 */
export const createPathPermissionMiddleware = (permissionType) => {
  return async (c, next) => {
    const authResult = c.get("authResult");
    const authService = c.get("authService");

    if (!authResult || !authResult.isAuthenticated) {
      throw new HTTPException(ApiStatus.UNAUTHORIZED, {
        message: "需要认证访问",
      });
    }

    if (!authResult.hasPermission(permissionType)) {
      throw new HTTPException(ApiStatus.FORBIDDEN, {
        message: `需要${permissionType}权限`,
      });
    }

    // 检查路径权限（从请求参数或查询参数中获取路径）
    const requestPath = c.req.param("path") || c.req.query("path") || "/";

    if (!authService.checkPathPermission(authResult, requestPath)) {
      throw new HTTPException(ApiStatus.FORBIDDEN, {
        message: "路径权限不足",
      });
    }

    await next();
  };
};

/**
 * 文件权限和路径检查中间件
 */
export const requireFilePathPermissionMiddleware = createPathPermissionMiddleware(PermissionType.FILE);

/**
 * 挂载权限和路径检查中间件
 */
export const requireMountPathPermissionMiddleware = createPathPermissionMiddleware(PermissionType.MOUNT);

/**
 * 灵活的权限检查中间件
 * 支持多种权限类型的组合检查
 * @param {Object} options - 权限选项
 * @param {Array<string>} options.permissions - 需要的权限列表（任一满足即可）
 * @param {boolean} options.requireAll - 是否需要所有权限（默认false，任一满足即可）
 * @param {boolean} options.checkPath - 是否检查路径权限（默认false）
 * @param {boolean} options.allowAdmin - 是否允许管理员绕过权限检查（默认true）
 * @returns {Function} 中间件函数
 */
export const createFlexiblePermissionMiddleware = (options = {}) => {
  const { permissions = [], requireAll = false, checkPath = false, allowAdmin = true } = options;

  return async (c, next) => {
    const authResult = c.get("authResult");
    const authService = c.get("authService");

    if (!authResult || !authResult.isAuthenticated) {
      throw new HTTPException(ApiStatus.UNAUTHORIZED, {
        message: "需要认证访问",
      });
    }

    // 管理员绕过权限检查
    if (allowAdmin && authResult.isAdmin()) {
      await next();
      return;
    }

    // 检查权限
    if (permissions.length > 0) {
      let hasPermission = false;

      if (requireAll) {
        // 需要所有权限
        hasPermission = permissions.every((permission) => authResult.hasPermission(permission));
      } else {
        // 任一权限满足即可
        hasPermission = permissions.some((permission) => authResult.hasPermission(permission));
      }

      if (!hasPermission) {
        throw new HTTPException(ApiStatus.FORBIDDEN, {
          message: `需要以下权限之一: ${permissions.join(", ")}`,
        });
      }
    }

    // 检查路径权限
    if (checkPath) {
      const requestPath = c.req.param("path") || c.req.query("path") || "/";

      if (!authService.checkPathPermission(authResult, requestPath)) {
        throw new HTTPException(ApiStatus.FORBIDDEN, {
          message: "路径权限不足",
        });
      }
    }

    await next();
  };
};

/**
 * 支持自定义授权头的认证中间件
 * 用于处理 X-Custom-Auth-Key 头的特殊情况
 */
export const customAuthMiddleware = async (c, next) => {
  const authService = createAuthService(c.env.DB);

  // 首先尝试标准认证
  const authHeader = c.req.header("Authorization");
  let authResult = await authService.authenticate(authHeader);

  // 如果标准认证失败，尝试自定义授权头
  if (!authResult.isAuthenticated) {
    const customAuthKey = c.req.header("X-Custom-Auth-Key");
    if (customAuthKey) {
      // 构造 ApiKey 格式的授权头
      const customAuthHeader = `ApiKey ${customAuthKey}`;
      authResult = await authService.authenticate(customAuthHeader);
    }
  }

  // 将认证结果存储到上下文中
  c.set("authResult", authResult);
  c.set("authService", authService);

  await next();
};
