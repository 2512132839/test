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
        success: false
      },
      status: ApiStatus.FORBIDDEN
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
        success: false
      },
      status: ApiStatus.UNAUTHORIZED
    };
  }

  /**
   * 统一的权限检查方法
   * 用于在路由中进行复杂的权限检查
   */
  static checkPermissions(c, options = {}) {
    const {
      requireAuth = true,
      permissions = [],
      requireAll = false,
      checkPath = false,
      requestPath = null,
      allowAdmin = true,
      customCheck = null
    } = options;

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
        hasPermission = permissions.every(permission => 
          authResult.hasPermission(permission)
        );
      } else {
        hasPermission = permissions.some(permission => 
          authResult.hasPermission(permission)
        );
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
      requestPath
    });
  }

  /**
   * 快捷方法：检查文件权限
   */
  static checkFilePermission(c, checkPath = false, requestPath = null) {
    return this.checkPermissions(c, {
      permissions: [PermissionType.FILE],
      checkPath,
      requestPath
    });
  }

  /**
   * 快捷方法：检查挂载权限
   */
  static checkMountPermission(c, checkPath = false, requestPath = null) {
    return this.checkPermissions(c, {
      permissions: [PermissionType.MOUNT],
      checkPath,
      requestPath
    });
  }

  /**
   * 快捷方法：检查管理员权限
   */
  static checkAdminPermission(c) {
    return this.checkPermissions(c, {
      permissions: [PermissionType.ADMIN],
      allowAdmin: false // 强制检查管理员权限
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
      requestPath
    });
  }
}

/**
 * 权限检查装饰器
 * 用于简化路由中的权限检查代码
 */
export function withPermissionCheck(permissionOptions) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(c) {
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
