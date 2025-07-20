/**
 * WebDAV锁定管理器
 * 负责管理WebDAV锁定状态的创建、维护和清理
 */

import { HTTPException } from "hono/http-exception";
import { ApiStatus } from "../../constants/index.js";
import { generateLockToken, parseIfHeaderRFC4918, checkIfConditions } from "./lockUtils.js";

export class LockManager {
  /**
   * 构造函数
   */
  constructor() {
    // 锁定存储 - 双索引设计
    this.locksByPath = new Map(); // path -> lockInfo
    this.locksByToken = new Map(); // token -> lockInfo

    // 过期队列 - 按过期时间排序
    this.expiryQueue = [];

    // 锁令牌计数器
    this.nextTokenId = 1;

    // 缓存清理机制（适配Cloudflare Workers）
    this.cleanupInterval = null;
    this.cleanupTimeout = 5 * 60 * 1000; // 5分钟清理一次
    this.cleanupStarted = false; // 标记清理机制是否已启动
    this.lastCleanupTime = 0; // 上次清理时间

    // 统计信息
    this.stats = {
      created: 0,
      refreshed: 0,
      expired: 0,
      unlocked: 0,
      conflicts: 0,
    };

    // 不在构造函数中启动定时器，避免Cloudflare Workers全局作用域限制
  }

  /**
   * 确保清理机制已启动，并执行延迟清理
   * @private
   */
  _ensureCleanupTimer() {
    if (!this.cleanupStarted) {
      this.cleanupStarted = true;
      this._startCleanupTimer();
    }

    // 检查是否需要执行清理
    const now = Date.now();
    if (now - this.lastCleanupTime > this.cleanupTimeout) {
      this.lastCleanupTime = now;
      this._cleanupExpiredLocks();
    }
  }

  /**
   * 创建新的锁定
   * @param {string} path - 资源路径
   * @param {string} owner - 锁定所有者
   * @param {number} timeoutSeconds - 超时时间（秒）
   * @param {string} depth - 锁定深度（"0" 或 "infinity"）
   * @param {string} scope - 锁定范围（"exclusive"）
   * @param {string} type - 锁定类型（"write"）
   * @returns {Object} 锁定信息
   */
  createLock(path, owner, timeoutSeconds = 600, depth = "0", scope = "exclusive", type = "write") {
    // 确保清理定时器已启动
    this._ensureCleanupTimer();
    // 检查路径是否已被锁定
    const existingLock = this.locksByPath.get(path);
    if (existingLock && !this._isExpired(existingLock)) {
      this.stats.conflicts++;
      throw new HTTPException(ApiStatus.LOCKED, {
        message: `资源已被锁定: ${path}`,
        details: { lockToken: existingLock.token },
      });
    }

    // 生成锁令牌
    const token = generateLockToken(this.nextTokenId++);
    const now = Date.now();
    const expiresAt = now + timeoutSeconds * 1000;

    // 创建锁定信息
    const lockInfo = {
      token,
      path,
      owner,
      depth,
      scope,
      type,
      createdAt: now,
      expiresAt,
      timeoutSeconds,
    };

    // 存储锁定信息
    this.locksByPath.set(path, lockInfo);
    this.locksByToken.set(token, lockInfo);

    // 添加到过期队列
    this._addToExpiryQueue(lockInfo);

    this.stats.created++;
    console.log(`WebDAV锁定已创建 - 路径: ${path}, 令牌: ${token}, 超时: ${timeoutSeconds}秒`);

    return lockInfo;
  }

  /**
   * 刷新锁定的超时时间
   * @param {string} token - 锁令牌
   * @param {number} timeoutSeconds - 新的超时时间（秒）
   * @returns {Object|null} 更新后的锁定信息
   */
  refreshLock(token, timeoutSeconds = 600) {
    const lockInfo = this.locksByToken.get(token);
    if (!lockInfo) {
      return null;
    }

    // 检查锁是否已过期
    if (this._isExpired(lockInfo)) {
      this._removeLock(lockInfo);
      return null;
    }

    // 更新过期时间
    const now = Date.now();
    lockInfo.expiresAt = now + timeoutSeconds * 1000;
    lockInfo.timeoutSeconds = timeoutSeconds;

    // 重新添加到过期队列
    this._removeFromExpiryQueue(lockInfo);
    this._addToExpiryQueue(lockInfo);

    this.stats.refreshed++;
    console.log(`WebDAV锁定已刷新 - 令牌: ${token}, 新超时: ${timeoutSeconds}秒`);

    return lockInfo;
  }

  /**
   * 检查路径是否被锁定
   * @param {string} path - 资源路径
   * @param {string} ifHeader - If头的值（可选）
   * @returns {Object|null} 锁定信息或null
   */
  checkLock(path, ifHeader = null) {
    // 确保清理机制运行
    this._ensureCleanupTimer();
    // 首先检查当前路径的锁定
    const lockInfo = this.locksByPath.get(path);
    if (lockInfo) {
      // 检查锁是否已过期
      if (this._isExpired(lockInfo)) {
        this._removeLock(lockInfo);
      } else {
        // 如果提供了If头，验证锁令牌
        if (ifHeader) {
          const parsedIf = parseIfHeaderRFC4918(ifHeader);
          if (checkIfConditions(parsedIf, path, lockInfo.token)) {
            return null; // 条件满足，允许操作
          }
        }
        return lockInfo; // 有锁定且条件不满足
      }
    }

    // 检查父路径的infinity锁定
    const parentLock = this._checkParentLocks(path);
    if (parentLock) {
      // 如果提供了If头，验证锁令牌
      if (ifHeader) {
        const parsedIf = parseIfHeaderRFC4918(ifHeader);
        if (checkIfConditions(parsedIf, parentLock.path, parentLock.token)) {
          return null; // 条件满足，允许操作
        }
      }
      return parentLock; // 父路径被锁定且条件不满足
    }

    return null; // 没有锁定
  }

  /**
   * 删除锁定
   * @param {string} token - 锁令牌
   * @returns {boolean} 是否成功删除
   */
  unlock(token) {
    const lockInfo = this.locksByToken.get(token);
    if (!lockInfo) {
      return false;
    }

    this._removeLock(lockInfo);
    this.stats.unlocked++;
    console.log(`WebDAV锁定已删除 - 令牌: ${token}, 路径: ${lockInfo.path}`);

    return true;
  }

  /**
   * 获取锁定信息
   * @param {string} path - 资源路径
   * @returns {Object|null} 锁定信息
   */
  getLock(path) {
    const lockInfo = this.locksByPath.get(path);
    if (!lockInfo) {
      return null;
    }

    // 检查锁是否已过期
    if (this._isExpired(lockInfo)) {
      this._removeLock(lockInfo);
      return null;
    }

    return lockInfo;
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      ...this.stats,
      activeLocks: this.locksByPath.size,
      memoryUsage: this._calculateMemoryUsage(),
    };
  }

  /**
   * 通过令牌获取锁定信息
   * @param {string} token - 锁令牌
   * @returns {Object|null} 锁定信息或null
   */
  getLockByToken(token) {
    const lockInfo = this.locksByToken.get(token);
    if (!lockInfo) {
      return null;
    }

    // 检查锁是否已过期
    if (this._isExpired(lockInfo)) {
      this._removeLock(lockInfo);
      return null;
    }

    return lockInfo;
  }

  /**
   * 清理所有锁定
   */
  clearAllLocks() {
    this.locksByPath.clear();
    this.locksByToken.clear();
    this.expiryQueue = [];
    console.log("所有WebDAV锁定已清理");
  }

  /**
   * 销毁管理器
   */
  destroy() {
    this._stopCleanupTimer();
    this.clearAllLocks();
    console.log("WebDAV锁定管理器已销毁");
  }

  // ===== 私有方法 =====

  /**
   * 检查锁定是否已过期
   * @param {Object} lockInfo - 锁定信息
   * @returns {boolean} 是否过期
   * @private
   */
  _isExpired(lockInfo) {
    return Date.now() > lockInfo.expiresAt;
  }

  /**
   * 删除锁定信息
   * @param {Object} lockInfo - 锁定信息
   * @private
   */
  _removeLock(lockInfo) {
    this.locksByPath.delete(lockInfo.path);
    this.locksByToken.delete(lockInfo.token);
    this._removeFromExpiryQueue(lockInfo);
  }

  /**
   * 添加到过期队列
   * @param {Object} lockInfo - 锁定信息
   * @private
   */
  _addToExpiryQueue(lockInfo) {
    this.expiryQueue.push(lockInfo);
    this.expiryQueue.sort((a, b) => a.expiresAt - b.expiresAt);
  }

  /**
   * 从过期队列中移除
   * @param {Object} lockInfo - 锁定信息
   * @private
   */
  _removeFromExpiryQueue(lockInfo) {
    const index = this.expiryQueue.findIndex((item) => item.token === lockInfo.token);
    if (index !== -1) {
      this.expiryQueue.splice(index, 1);
    }
  }

  /**
   * 检查父路径的infinity锁定
   * @param {string} path - 资源路径
   * @returns {Object|null} 父路径的锁定信息或null
   * @private
   */
  _checkParentLocks(path) {
    // 分割路径，从父路径开始检查
    const pathParts = path.split("/").filter((p) => p);

    // 从最近的父路径开始，逐级向上检查
    for (let i = pathParts.length - 1; i > 0; i--) {
      const parentPath = "/" + pathParts.slice(0, i).join("/");
      const parentLock = this.locksByPath.get(parentPath);

      if (parentLock && !this._isExpired(parentLock) && parentLock.depth === "infinity") {
        console.log(`发现父路径infinity锁定 - 父路径: ${parentPath}, 子路径: ${path}`);
        return parentLock;
      }
    }

    // 检查根路径的锁定
    const rootLock = this.locksByPath.get("/");
    if (rootLock && !this._isExpired(rootLock) && rootLock.depth === "infinity") {
      console.log(`发现根路径infinity锁定 - 子路径: ${path}`);
      return rootLock;
    }

    return null;
  }

  /**
   * 清理过期的锁定
   * @private
   */
  _cleanupExpiredLocks() {
    const now = Date.now();
    let expiredCount = 0;

    // 从过期队列头部开始清理
    while (this.expiryQueue.length > 0 && this.expiryQueue[0].expiresAt <= now) {
      const expiredLock = this.expiryQueue.shift();
      this.locksByPath.delete(expiredLock.path);
      this.locksByToken.delete(expiredLock.token);
      expiredCount++;
    }

    if (expiredCount > 0) {
      this.stats.expired += expiredCount;
      console.log(`清理了 ${expiredCount} 个过期的WebDAV锁定`);
    }
  }

  /**
   * 启动清理定时器
   * 在Cloudflare Workers环境中，使用延迟清理而不是定时器
   * @private
   */
  _startCleanupTimer() {
    // 每次操作时检查是否需要清理
    console.log("锁定管理器清理机制已启动（延迟清理模式）");
  }

  /**
   * 停止清理定时器
   * @private
   */
  _stopCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 计算内存使用量
   * @returns {number} 内存使用量（字节）
   * @private
   */
  _calculateMemoryUsage() {
    // 简单估算内存使用量
    const lockCount = this.locksByPath.size;
    const avgLockSize = 200; // 每个锁定对象的平均大小
    return lockCount * avgLockSize * 2; // 双索引存储
  }
}

// 延迟创建全局单例实例，避免Cloudflare Workers全局作用域限制
let lockManager = null;

/**
 * 获取全局锁定管理器实例
 * @returns {LockManager} 锁定管理器实例
 */
export function getLockManager() {
  if (!lockManager) {
    lockManager = new LockManager();
  }
  return lockManager;
}
