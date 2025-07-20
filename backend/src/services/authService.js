/**
 * 统一权限认证服务
 * 提供所有权限认证相关的核心功能
 */

import { DbTables, ApiStatus } from "../constants/index.js";
import { validateAdminToken } from "./adminService.js";
import { checkAndDeleteExpiredApiKey } from "./apiKeyService.js";
import { verifyPassword } from "../utils/crypto.js";
import { HTTPException } from "hono/http-exception";

/**
 * 权限类型枚举
 */
export const PermissionType = {
  TEXT: "text",
  FILE: "file",
  MOUNT: "mount",
  ADMIN: "admin",
};

/**
 * 认证类型枚举
 */
export const AuthType = {
  ADMIN: "admin",
  API_KEY: "apikey",
  NONE: "none",
};

/**
 * 权限级别枚举
 */
export const PermissionLevel = {
  READ: "read",
  WRITE: "write",
  ADMIN: "admin",
};

/**
 * 认证结果接口
 */
export class AuthResult {
  constructor({ isAuthenticated = false, authType = AuthType.NONE, userId = null, permissions = {}, basicPath = "/", keyInfo = null, adminId = null, isAdmin = false } = {}) {
    this.isAuthenticated = isAuthenticated;
    this.authType = authType;
    this.userId = userId;
    this.permissions = permissions;
    this.basicPath = basicPath;
    this.keyInfo = keyInfo;
    this.adminId = adminId;
    this._isAdmin = isAdmin; //避免命名冲突
  }

  /**
   * 检查是否有指定权限
   */
  hasPermission(permissionType) {
    // 管理员拥有所有权限（包括Bearer认证和Basic认证的管理员）
    if (this.authType === AuthType.ADMIN || this._isAdmin === true) {
      return true;
    }
    return this.permissions[permissionType] === true;
  }

  /**
   * 检查是否为管理员
   */
  isAdmin() {
    return this.authType === AuthType.ADMIN || this._isAdmin === true;
  }

  /**
   * 获取用户标识
   */
  getUserId() {
    return this.userId || this.adminId;
  }
}

/**
 * 统一权限认证服务类
 */
export class AuthService {
  constructor(db) {
    this.db = db;
  }

  /**
   * 从请求头解析认证信息
   */
  parseAuthHeader(authHeader) {
    if (!authHeader) {
      return { type: null, token: null };
    }

    if (authHeader.startsWith("Bearer ")) {
      return { type: "bearer", token: authHeader.substring(7) };
    }

    if (authHeader.startsWith("ApiKey ")) {
      return { type: "apikey", token: authHeader.substring(7) };
    }

    if (authHeader.startsWith("Basic ")) {
      return { type: "basic", token: authHeader.substring(6) };
    }

    return { type: null, token: null };
  }

  /**
   * 验证管理员认证
   */
  async validateAdminAuth(token) {
    try {
      const adminId = await validateAdminToken(this.db, token);

      if (!adminId) {
        return new AuthResult();
      }

      return new AuthResult({
        isAuthenticated: true,
        authType: AuthType.ADMIN,
        adminId: adminId,
        userId: adminId,
        permissions: {
          [PermissionType.TEXT]: true,
          [PermissionType.FILE]: true,
          [PermissionType.MOUNT]: true,
          [PermissionType.ADMIN]: true,
        },
        basicPath: "/",
      });
    } catch (error) {
      console.error("管理员认证验证失败:", error);
      return new AuthResult();
    }
  }

  /**
   * 验证Basic认证
   */
  async validateBasicAuth(basicToken) {
    try {
      // 解码Base64编码的用户名:密码
      const decoded = atob(basicToken);

      // 使用indexOf查找分隔符，因为密码中可能包含冒号
      const separatorIndex = decoded.indexOf(":");
      if (separatorIndex === -1) {
        console.log("WebDAV认证失败: 无效的认证格式");
        return new AuthResult();
      }

      const username = decoded.substring(0, separatorIndex);
      const password = decoded.substring(separatorIndex + 1);

      if (!username || !password) {
        return new AuthResult();
      }

      // 情况1: 管理员登录
      try {
        console.log(`WebDAV认证: 开始验证管理员用户凭证，用户名: ${username}`);
        // 查询是否存在具有匹配用户名的管理员
        const admin = await this.db.prepare(`SELECT id, username, password FROM ${DbTables.ADMINS} WHERE username = ?`).bind(username).first();

        if (admin) {
          console.log("WebDAV认证: 找到管理员账户，开始验证密码");
          try {
            // 使用verifyPassword验证密码
            const isPasswordValid = await verifyPassword(password, admin.password);

            if (isPasswordValid) {
              console.log("WebDAV认证: 管理员密码验证成功");
              return new AuthResult({
                isAuthenticated: true,
                authType: "basic", // Basic认证方式的管理员
                adminId: admin.id,
                userId: admin.id,
                permissions: {
                  [PermissionType.TEXT]: true,
                  [PermissionType.FILE]: true,
                  [PermissionType.MOUNT]: true,
                  [PermissionType.ADMIN]: true,
                },
                basicPath: "/",
                isAdmin: true, // 明确标记为管理员
              });
            } else {
              console.log("WebDAV认证: 管理员密码验证失败");
            }
          } catch (verifyError) {
            console.error("WebDAV认证: 密码验证出错", verifyError);
          }
        } else {
          console.log(`WebDAV认证: 未找到匹配的管理员账户，用户名: ${username}`);
        }
      } catch (error) {
        console.error("WebDAV认证: 验证管理员过程出错", error);
      }

      // 情况2: API密钥用户登录 (密钥值为用户名和密码)
      try {
        // 查询是否存在对应的API密钥，获取完整信息
        const keyRecord = await this.db
          .prepare(
            `SELECT id, key, name, basic_path, text_permission, file_permission, mount_permission, expires_at
             FROM ${DbTables.API_KEYS}
             WHERE key = ?`
          )
          .bind(username)
          .first();

        if (keyRecord) {
          // 检查mount_permission
          const hasMountPermission = String(keyRecord.mount_permission) === "1" || keyRecord.mount_permission === true;

          if (hasMountPermission) {
            // 对于API密钥，用户名和密码应相同
            if (username === password) {
              // 检查是否过期
              if (await checkAndDeleteExpiredApiKey(this.db, keyRecord)) {
                return new AuthResult();
              }

              // 更新最后使用时间
              await this.db
                .prepare(
                  `UPDATE ${DbTables.API_KEYS}
                   SET last_used = CURRENT_TIMESTAMP
                   WHERE id = ?`
                )
                .bind(keyRecord.id)
                .run();

              // 构建权限对象
              const permissions = {
                [PermissionType.TEXT]: keyRecord.text_permission === 1,
                [PermissionType.FILE]: keyRecord.file_permission === 1,
                [PermissionType.MOUNT]: keyRecord.mount_permission === 1,
                [PermissionType.ADMIN]: false,
              };

              const keyInfo = {
                id: keyRecord.id,
                name: keyRecord.name,
                key: keyRecord.key,
                basicPath: keyRecord.basic_path || "/",
                permissions: permissions,
              };

              return new AuthResult({
                isAuthenticated: true,
                authType: AuthType.API_KEY,
                userId: keyRecord.id,
                permissions: permissions,
                basicPath: keyRecord.basic_path || "/",
                keyInfo: keyInfo,
              });
            }
          }
        }
      } catch (error) {
        console.error("WebDAV认证: API密钥验证过程出错", error);
      }

      return new AuthResult();
    } catch (error) {
      console.error("Basic认证验证失败:", error);
      return new AuthResult();
    }
  }

  /**
   * 验证API密钥认证
   */
  async validateApiKeyAuth(apiKey) {
    try {
      // 查询API密钥记录
      const keyRecord = await this.db
        .prepare(
          `SELECT id, name, text_permission, file_permission, mount_permission, basic_path, expires_at
           FROM ${DbTables.API_KEYS}
           WHERE key = ?`
        )
        .bind(apiKey)
        .first();

      if (!keyRecord) {
        return new AuthResult();
      }

      // 检查是否过期
      if (await checkAndDeleteExpiredApiKey(this.db, keyRecord)) {
        return new AuthResult();
      }

      // 更新最后使用时间
      await this.db
        .prepare(
          `UPDATE ${DbTables.API_KEYS}
           SET last_used = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .bind(keyRecord.id)
        .run();

      // 构建权限对象
      const permissions = {
        [PermissionType.TEXT]: keyRecord.text_permission === 1,
        [PermissionType.FILE]: keyRecord.file_permission === 1,
        [PermissionType.MOUNT]: keyRecord.mount_permission === 1,
        [PermissionType.ADMIN]: false,
      };

      const keyInfo = {
        id: keyRecord.id,
        name: keyRecord.name,
        key: apiKey,
        basicPath: keyRecord.basic_path || "/",
        permissions: permissions,
      };

      return new AuthResult({
        isAuthenticated: true,
        authType: AuthType.API_KEY,
        userId: keyRecord.id,
        permissions: permissions,
        basicPath: keyRecord.basic_path || "/",
        keyInfo: keyInfo,
      });
    } catch (error) {
      console.error("API密钥认证验证失败:", error);
      return new AuthResult();
    }
  }

  /**
   * 统一认证方法
   * @param {string} authHeader - Authorization 头
   * @returns {Promise<AuthResult>} 认证结果
   */
  async authenticate(authHeader) {
    const { type, token } = this.parseAuthHeader(authHeader);

    if (!type || !token) {
      return new AuthResult();
    }

    switch (type) {
      case "bearer":
        return await this.validateAdminAuth(token);
      case "apikey":
        return await this.validateApiKeyAuth(token);
      case "basic":
        return await this.validateBasicAuth(token);
      default:
        return new AuthResult();
    }
  }

  /**
   * 检查权限
   * @param {AuthResult} authResult - 认证结果
   * @param {string} requiredPermission - 需要的权限类型
   * @returns {boolean} 是否有权限
   */
  checkPermission(authResult, requiredPermission) {
    if (!authResult.isAuthenticated) {
      return false;
    }

    return authResult.hasPermission(requiredPermission);
  }

  /**
   * 检查路径权限
   * @param {AuthResult} authResult - 认证结果
   * @param {string} requestPath - 请求路径
   * @returns {boolean} 是否有路径权限
   */
  checkPathPermission(authResult, requestPath) {
    if (!authResult.isAuthenticated) {
      return false;
    }

    // 管理员有所有路径权限
    if (authResult.isAdmin()) {
      return true;
    }

    // API密钥检查基础路径权限 - 使用统一的权限检查逻辑
    if (authResult.authType === AuthType.API_KEY) {
      const basicPath = authResult.basicPath || "/";

      // 直接导入PermissionUtils并使用其静态方法
      const { PermissionUtils } = require("../utils/permissionUtils.js");
      return PermissionUtils.checkPathPermission(basicPath, requestPath);
    }

    return false;
  }

  /**
   * 要求特定权限的认证
   * @param {string} authHeader - Authorization 头
   * @param {string} requiredPermission - 需要的权限类型
   * @param {string} requestPath - 请求路径（可选）
   * @returns {Promise<AuthResult>} 认证结果
   * @throws {HTTPException} 认证失败时抛出异常
   */
  async requirePermission(authHeader, requiredPermission, requestPath = null) {
    const authResult = await this.authenticate(authHeader);

    if (!authResult.isAuthenticated) {
      throw new HTTPException(ApiStatus.UNAUTHORIZED, {
        message: "需要认证访问",
      });
    }

    if (!this.checkPermission(authResult, requiredPermission)) {
      throw new HTTPException(ApiStatus.FORBIDDEN, {
        message: `需要${requiredPermission}权限`,
      });
    }

    if (requestPath && !this.checkPathPermission(authResult, requestPath)) {
      throw new HTTPException(ApiStatus.FORBIDDEN, {
        message: "路径权限不足",
      });
    }

    return authResult;
  }

  /**
   * 要求管理员权限
   * @param {string} authHeader - Authorization 头
   * @returns {Promise<AuthResult>} 认证结果
   * @throws {HTTPException} 认证失败时抛出异常
   */
  async requireAdmin(authHeader) {
    const authResult = await this.authenticate(authHeader);

    if (!authResult.isAuthenticated || !authResult.isAdmin()) {
      throw new HTTPException(ApiStatus.FORBIDDEN, {
        message: "需要管理员权限",
      });
    }

    return authResult;
  }
}

/**
 * 创建认证服务实例
 */
export function createAuthService(db) {
  return new AuthService(db);
}
