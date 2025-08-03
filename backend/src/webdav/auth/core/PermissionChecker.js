/**
 * WebDAV权限检查器
 * 基于位标志权限系统的WebDAV权限验证
 *
 */

import { Permission } from "../../../constants/permissions.js";
import { getMethodPermission, isReadOperation, isWriteOperation } from "../config/WebDAVConfig.js";

/**
 * 权限检查结果类
 */
class PermissionCheckResult {
  constructor(hasPermission, reason = null, permissions = null) {
    this.hasPermission = hasPermission;
    this.reason = reason;
    this.permissions = permissions;
  }
}

/**
 * WebDAV权限检查器类
 */
export class WebDAVPermissionChecker {
  constructor() {
    this.permissions = Permission;
  }

  /**
   * 检查WebDAV权限
   * 根据HTTP方法和用户权限进行精确检查
   *
   * @param {Object} authResult - 认证结果对象
   * @param {string} method - HTTP方法
   * @returns {PermissionCheckResult} 权限检查结果
   */
  checkWebDAVPermission(authResult, method) {
    try {
      // 管理员绕过所有权限检查
      if (authResult.isAdmin()) {
        return new PermissionCheckResult(true, "管理员权限", { admin: true, webdavRead: true, webdavManage: true });
      }

      // 检查用户是否已认证
      if (!authResult.isAuthenticated) {
        return new PermissionCheckResult(false, "用户未认证");
      }

      // 获取方法所需的权限
      const requiredPermission = getMethodPermission(method);
      if (!requiredPermission) {
        return new PermissionCheckResult(false, `不支持的HTTP方法: ${method}`);
      }

      // 检查具体权限
      return this.checkSpecificPermission(authResult, method, requiredPermission);
    } catch (error) {
      console.error("WebDAV权限检查错误:", error);
      return new PermissionCheckResult(false, "权限检查过程发生错误");
    }
  }

  /**
   * 检查特定权限
   * @param {Object} authResult - 认证结果
   * @param {string} method - HTTP方法
   * @param {string} requiredPermission - 所需权限
   * @returns {PermissionCheckResult} 检查结果
   */
  checkSpecificPermission(authResult, method, requiredPermission) {
    const upperMethod = method.toUpperCase();

    // 根据权限类型进行检查
    switch (requiredPermission) {
      case "WEBDAV_READ":
        return this.checkReadPermission(authResult, upperMethod);

      case "WEBDAV_MANAGE":
        return this.checkManagePermission(authResult, upperMethod);

      default:
        return new PermissionCheckResult(false, `未知的权限类型: ${requiredPermission}`);
    }
  }

  /**
   * 检查WebDAV读取权限
   * @param {Object} authResult - 认证结果
   * @param {string} method - HTTP方法
   * @returns {PermissionCheckResult} 检查结果
   */
  checkReadPermission(authResult, method) {
    const hasReadPermission = authResult.hasPermission(this.permissions.WEBDAV_READ);

    if (!hasReadPermission) {
      return new PermissionCheckResult(false, `${method}操作需要WebDAV读取权限`);
    }

    return new PermissionCheckResult(true, `${method}操作权限验证通过`, {
      webdavRead: true,
      webdavManage: authResult.hasPermission(this.permissions.WEBDAV_MANAGE),
      method: method,
      operation: "read",
    });
  }

  /**
   * 检查WebDAV管理权限
   * @param {Object} authResult - 认证结果
   * @param {string} method - HTTP方法
   * @returns {PermissionCheckResult} 检查结果
   */
  checkManagePermission(authResult, method) {
    const hasManagePermission = authResult.hasPermission(this.permissions.WEBDAV_MANAGE);

    if (!hasManagePermission) {
      return new PermissionCheckResult(false, `${method}操作需要WebDAV管理权限`);
    }
    return new PermissionCheckResult(true, `${method}操作权限验证通过`, {
      webdavRead: authResult.hasPermission(this.permissions.WEBDAV_READ),
      webdavManage: true,
      method: method,
      operation: "manage",
    });
  }

  /**
   * 批量检查多个方法的权限
   * @param {Object} authResult - 认证结果
   * @param {Array} methods - HTTP方法数组
   * @returns {Object} 权限检查结果映射
   */
  checkMultiplePermissions(authResult, methods) {
    const results = {};

    for (const method of methods) {
      results[method] = this.checkWebDAVPermission(authResult, method);
    }

    return results;
  }

  /**
   * 获取用户的WebDAV权限摘要
   * @param {Object} authResult - 认证结果
   * @returns {Object} 权限摘要
   */
  getPermissionSummary(authResult) {
    if (authResult.isAdmin()) {
      return {
        isAdmin: true,
        webdavRead: true,
        webdavManage: true,
        allowedOperations: ["read", "manage"],
        restrictedOperations: [],
      };
    }

    if (!authResult.isAuthenticated) {
      return {
        isAdmin: false,
        webdavRead: false,
        webdavManage: false,
        allowedOperations: [],
        restrictedOperations: ["read", "manage"],
      };
    }

    const hasRead = authResult.hasPermission(this.permissions.WEBDAV_READ);
    const hasManage = authResult.hasPermission(this.permissions.WEBDAV_MANAGE);

    const allowedOperations = [];
    const restrictedOperations = [];

    if (hasRead) {
      allowedOperations.push("read");
    } else {
      restrictedOperations.push("read");
    }

    if (hasManage) {
      allowedOperations.push("manage");
    } else {
      restrictedOperations.push("manage");
    }

    return {
      isAdmin: false,
      webdavRead: hasRead,
      webdavManage: hasManage,
      allowedOperations,
      restrictedOperations,
    };
  }

  /**
   * 检查路径权限（API密钥用户）
   * @param {Object} authResult - 认证结果
   * @param {string} requestPath - 请求路径
   * @returns {boolean} 是否有路径权限
   */
  checkPathPermission(authResult, requestPath) {
    // 管理员有所有路径权限
    if (authResult.isAdmin()) {
      return true;
    }

    // API密钥用户检查基本路径权限
    if (authResult.keyInfo && authResult.keyInfo.basicPath) {
      const basicPath = authResult.keyInfo.basicPath;

      // 移除WebDAV前缀进行路径比较
      const cleanPath = requestPath.replace(/^\/dav/, "") || "/";

      // 检查路径是否在允许范围内
      return cleanPath.startsWith(basicPath);
    }

    return false;
  }

  /**
   * 验证权限检查器配置
   * @returns {boolean} 配置是否有效
   */
  validateConfiguration() {
    try {
      // 检查权限常量是否存在
      const requiredPermissions = ["WEBDAV_READ", "WEBDAV_MANAGE"];

      for (const permission of requiredPermissions) {
        if (!(permission in this.permissions)) {
          console.error(`权限检查器配置错误: 缺少权限常量${permission}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error("权限检查器配置验证失败:", error);
      return false;
    }
  }

  /**
   * 获取权限检查统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      supportedPermissions: Object.keys(this.permissions).filter((key) => key.startsWith("WEBDAV_")),
      permissionValues: {
        WEBDAV_READ: this.permissions.WEBDAV_READ,
        WEBDAV_MANAGE: this.permissions.WEBDAV_MANAGE,
      },
    };
  }
}

/**
 * 创建权限检查器实例
 * @returns {WebDAVPermissionChecker} 权限检查器实例
 */
export function createWebDAVPermissionChecker() {
  const checker = new WebDAVPermissionChecker();

  if (!checker.validateConfiguration()) {
    throw new Error("WebDAV权限检查器配置无效");
  }

  return checker;
}

// 导出权限检查结果类
export { PermissionCheckResult };
