/**
 * 权限工具类
 * 提供在路由中进行权限检查的便捷方法
 */

import { createAuthService, PermissionType, AuthType } from "../services/authService.js";
import { ApiStatus } from "../constants/index.js";

/**
 * 权限检查工具类
 */
export class PermissionUtils {
  /**
   * 从上下文中获取认证结果
   */
  static getAuthResult(c) {
    return c.get("authResult");
  }

  /**
   * 从上下文中获取认证服务
   */
  static getAuthService(c) {
    return c.get("authService");
  }

  /**
   * 检查是否已认证
   */
  static isAuthenticated(c) {
    const authResult = this.getAuthResult(c);
    return authResult && authResult.isAuthenticated;
  }

  /**
   * 检查是否为管理员
   */
  static isAdmin(c) {
    const authResult = this.getAuthResult(c);
    return authResult && authResult.isAdmin();
  }

  /**
   * 检查是否有指定权限
   */
  static hasPermission(c, permissionType) {
    const authResult = this.getAuthResult(c);
    return authResult && authResult.hasPermission(permissionType);
  }

  /**
   * 检查路径权限
   */
  static hasPathPermission(c, requestPath) {
    const authResult = this.getAuthResult(c);
    const authService = this.getAuthService(c);

    if (!authResult || !authService) {
      return false;
    }

    return authService.checkPathPermission(authResult, requestPath);
  }

  /**
   * 获取用户ID
   */
  static getUserId(c) {
    const authResult = this.getAuthResult(c);
    return authResult ? authResult.getUserId() : null;
  }

  /**
   * 获取认证类型
   */
  static getAuthType(c) {
    const authResult = this.getAuthResult(c);
    return authResult ? authResult.authType : AuthType.NONE;
  }

  /**
   * 获取基础路径
   */
  static getBasicPath(c) {
    const authResult = this.getAuthResult(c);
    return authResult ? authResult.basicPath : "/";
  }

  /**
   * 获取API密钥信息
   */
  static getApiKeyInfo(c) {
    const authResult = this.getAuthResult(c);
    return authResult && authResult.authType === AuthType.API_KEY ? authResult.keyInfo : null;
  }

  /**
   * 创建权限检查响应
   * 用于在路由中进行权限检查并返回统一的错误响应
   */
  static createPermissionResponse(hasPermission, message = "权限不足") {
    if (hasPermission) {
      return { success: true };
    }

    return {
      success: false,
      response: {
        code: ApiStatus.FORBIDDEN,
        message: message,
        data: null,
        success: false,
      },
      status: ApiStatus.FORBIDDEN,
    };
  }

  /**
   * 创建认证检查响应
   */
  static createAuthResponse(isAuthenticated, message = "需要认证访问") {
    if (isAuthenticated) {
      return { success: true };
    }

    return {
      success: false,
      response: {
        code: ApiStatus.UNAUTHORIZED,
        message: message,
        data: null,
        success: false,
      },
      status: ApiStatus.UNAUTHORIZED,
    };
  }

  /**
   * 统一的权限检查方法
   * 用于在路由中进行复杂的权限检查
   */
  static checkPermissions(c, options = {}) {
    const { requireAuth = true, permissions = [], requireAll = false, checkPath = false, requestPath = null, allowAdmin = true, customCheck = null } = options;

    const authResult = this.getAuthResult(c);
    const authService = this.getAuthService(c);

    // 检查认证
    if (requireAuth && (!authResult || !authResult.isAuthenticated)) {
      return this.createAuthResponse(false);
    }

    // 管理员绕过权限检查
    if (allowAdmin && authResult && authResult.isAdmin()) {
      return { success: true };
    }

    // 检查权限
    if (permissions.length > 0) {
      let hasPermission = false;

      if (requireAll) {
        hasPermission = permissions.every((permission) => authResult.hasPermission(permission));
      } else {
        hasPermission = permissions.some((permission) => authResult.hasPermission(permission));
      }

      if (!hasPermission) {
        return this.createPermissionResponse(false, `需要以下权限: ${permissions.join(", ")}`);
      }
    }

    // 检查路径权限
    if (checkPath && authService) {
      const pathToCheck = requestPath || "/";

      if (!authService.checkPathPermission(authResult, pathToCheck)) {
        return this.createPermissionResponse(false, "路径权限不足");
      }
    }

    // 自定义检查
    if (customCheck && typeof customCheck === "function") {
      const customResult = customCheck(authResult, authService);
      if (!customResult) {
        return this.createPermissionResponse(false, "自定义权限检查失败");
      }
    }

    return { success: true };
  }

  /**
   * 快捷方法：检查文本权限
   */
  static checkTextPermission(c, checkPath = false, requestPath = null) {
    return this.checkPermissions(c, {
      permissions: [PermissionType.TEXT],
      checkPath,
      requestPath,
    });
  }

  /**
   * 快捷方法：检查文件权限
   */
  static checkFilePermission(c, checkPath = false, requestPath = null) {
    return this.checkPermissions(c, {
      permissions: [PermissionType.FILE],
      checkPath,
      requestPath,
    });
  }

  /**
   * 快捷方法：检查挂载权限
   */
  static checkMountPermission(c, checkPath = false, requestPath = null) {
    return this.checkPermissions(c, {
      permissions: [PermissionType.MOUNT],
      checkPath,
      requestPath,
    });
  }

  /**
   * 快捷方法：检查管理员权限
   */
  static checkAdminPermission(c) {
    return this.checkPermissions(c, {
      permissions: [PermissionType.ADMIN],
      allowAdmin: false, // 强制检查管理员权限
    });
  }

  /**
   * 快捷方法：检查文件或挂载权限（任一即可）
   */
  static checkFileOrMountPermission(c, checkPath = false, requestPath = null) {
    return this.checkPermissions(c, {
      permissions: [PermissionType.FILE, PermissionType.MOUNT],
      requireAll: false,
      checkPath,
      requestPath,
    });
  }

  // ==================== 路径权限检查方法 ====================

  /**
   * 检查API密钥是否有访问指定路径的权限（严格权限）
   * 只允许访问basicPath及其子路径
   * @param {string} basicPath - API密钥的基本路径
   * @param {string} requestPath - 请求访问的路径
   * @returns {boolean} 是否有权限
   */
  static checkPathPermission(basicPath, requestPath) {
    if (!basicPath || !requestPath) {
      return false;
    }

    // 标准化路径 - 确保以/开头，不以/结尾（除非是根路径）
    const normalizeBasicPath = basicPath === "/" ? "/" : basicPath.replace(/\/+$/, "");
    const normalizeRequestPath = requestPath.replace(/\/+$/, "") || "/";

    // 如果基本路径是根路径，允许访问所有路径
    if (normalizeBasicPath === "/") {
      return true;
    }

    // 检查请求路径是否在基本路径范围内
    return normalizeRequestPath === normalizeBasicPath || normalizeRequestPath.startsWith(normalizeBasicPath + "/");
  }

  /**
   * 检查API密钥是否有访问指定路径的权限（导航权限）
   * 允许访问从根路径到基本路径的所有父级路径，以便用户能够导航
   * @param {string} basicPath - API密钥的基本路径
   * @param {string} requestPath - 请求访问的路径
   * @returns {boolean} 是否有权限
   */
  static checkPathPermissionForNavigation(basicPath, requestPath) {
    if (!basicPath || !requestPath) {
      return false;
    }

    // 标准化路径 - 确保以/开头，不以/结尾（除非是根路径）
    const normalizeBasicPath = basicPath === "/" ? "/" : basicPath.replace(/\/+$/, "");
    const normalizeRequestPath = requestPath.replace(/\/+$/, "") || "/";

    // 如果基本路径是根路径，允许访问所有路径
    if (normalizeBasicPath === "/") {
      return true;
    }

    // 检查请求路径是否在基本路径范围内（有完整权限）
    if (normalizeRequestPath === normalizeBasicPath || normalizeRequestPath.startsWith(normalizeBasicPath + "/")) {
      return true;
    }

    // 允许访问基本路径的父级路径（用于导航），但这些路径只有查看权限，没有操作权限
    if (normalizeBasicPath.startsWith(normalizeRequestPath + "/") || normalizeRequestPath === "/") {
      return true;
    }

    return false;
  }

  /**
   * 检查是否有操作权限（创建、删除、上传等）
   * 只有在基本路径范围内才允许操作
   * @param {string} basicPath - API密钥的基本路径
   * @param {string} requestPath - 请求访问的路径
   * @returns {boolean} 是否有权限
   */
  static checkPathPermissionForOperation(basicPath, requestPath) {
    if (!basicPath || !requestPath) {
      return false;
    }

    // 标准化路径
    const normalizeBasicPath = basicPath === "/" ? "/" : basicPath.replace(/\/+$/, "");
    const normalizeRequestPath = requestPath.replace(/\/+$/, "") || "/";

    // 如果基本路径是根路径，允许所有操作
    if (normalizeBasicPath === "/") {
      return true;
    }

    // 只有在基本路径范围内才允许操作
    return normalizeRequestPath === normalizeBasicPath || normalizeRequestPath.startsWith(normalizeBasicPath + "/");
  }

  // ==================== 挂载点权限检查方法 ====================

  /**
   * 根据用户类型和权限获取可访问的挂载点
   * @param {D1Database} db - 数据库实例
   * @param {string|Object} userIdOrInfo - 用户ID或API密钥信息
   * @param {string} userType - 用户类型 (admin 或 apiKey)
   * @returns {Promise<Array>} 可访问的挂载点列表
   */
  static async getAccessibleMounts(db, userIdOrInfo, userType) {
    if (userType === "admin") {
      const { getMountsByAdmin } = await import("../services/storageMountService.js");
      return await getMountsByAdmin(db, userIdOrInfo);
    } else if (userType === "apiKey") {
      const apiKeyInfo = typeof userIdOrInfo === "object" ? userIdOrInfo : { basicPath: "/" };
      const { getAccessibleMountsByBasicPath } = await import("../services/apiKeyService.js");
      return await getAccessibleMountsByBasicPath(db, apiKeyInfo.basicPath);
    } else {
      throw new Error(`不支持的用户类型: ${userType}`);
    }
  }

  /**
   * 检查用户是否有权限访问指定挂载点
   * @param {D1Database} db - 数据库实例
   * @param {string} mountId - 挂载点ID
   * @param {string|Object} userIdOrInfo - 用户ID或API密钥信息
   * @param {string} userType - 用户类型
   * @returns {Promise<boolean>} 是否有权限
   */
  static async checkMountAccess(db, mountId, userIdOrInfo, userType) {
    try {
      const mounts = await this.getAccessibleMounts(db, userIdOrInfo, userType);
      return mounts.some((mount) => mount.id === mountId);
    } catch (error) {
      console.error("检查挂载点权限失败:", error);
      return false;
    }
  }
}

/**
 * 权限检查装饰器
 * 用于简化路由中的权限检查代码
 */
export function withPermissionCheck(permissionOptions) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (c) {
      const permissionResult = PermissionUtils.checkPermissions(c, permissionOptions);

      if (!permissionResult.success) {
        return c.json(permissionResult.response, permissionResult.status);
      }

      return await originalMethod.call(this, c);
    };

    return descriptor;
  };
}

/**
 * 导出权限类型常量，方便在其他文件中使用
 */
export { PermissionType, AuthType } from "../services/authService.js";
