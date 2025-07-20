/**
 * 挂载管理器
 * 负责管理存储驱动实例的创建、缓存和生命周期
 * 基于挂载点配置动态创建和管理存储驱动
 */

import { StorageFactory } from "../factory/StorageFactory.js";
import { HTTPException } from "hono/http-exception";
import { ApiStatus } from "../../constants/index.js";
import { findMountPointByPath } from "../fs/utils/MountResolver.js";

export class MountManager {
  /**
   * 构造函数
   * @param {D1Database} db - 数据库实例
   * @param {string} encryptionSecret - 加密密钥
   */
  constructor(db, encryptionSecret) {
    this.db = db;
    this.encryptionSecret = encryptionSecret;

    // 存储驱动实例缓存
    this.driverCache = new Map();

    // 缓存清理定时器
    this.cleanupInterval = null;
    this.cacheTimeout = 30 * 60 * 1000; // 30分钟缓存超时
    this.cleanupStarted = false; // 标记清理机制是否已启动
    this.lastCleanupTime = 0; // 上次清理时间

    // 不在构造函数中启动定时器，避免Cloudflare Workers全局作用域限制
  }

  /**
   * 根据路径获取存储驱动
   * @param {string} path - 文件路径
   * @param {string|Object} userIdOrInfo - 用户ID或API密钥信息
   * @param {string} userType - 用户类型
   * @returns {Promise<Object>} 包含驱动实例和挂载信息的对象
   */
  async getDriverByPath(path, userIdOrInfo, userType) {
    // 查找挂载点
    const mountResult = await findMountPointByPath(this.db, path, userIdOrInfo, userType);

    if (mountResult.error) {
      throw new HTTPException(mountResult.error.status, { message: mountResult.error.message });
    }

    const { mount, subPath } = mountResult;

    // 获取存储驱动
    const driver = await this.getDriver(mount);

    return {
      driver,
      mount,
      subPath,
      mountPath: mountResult.mountPath,
    };
  }

  /**
   * 根据挂载点获取存储驱动
   * @param {Object} mount - 挂载点对象
   * @returns {Promise<StorageDriver>} 存储驱动实例
   */
  async getDriver(mount) {
    // 确保清理机制运行
    this._ensureCleanupTimer();

    const cacheKey = this._generateCacheKey(mount);

    // 检查缓存
    const cachedDriver = this.driverCache.get(cacheKey);
    if (cachedDriver && cachedDriver.driver.isInitialized()) {
      // 更新最后访问时间
      cachedDriver.lastAccessed = Date.now();
      console.log(`存储驱动缓存命中: ${mount.storage_type}/${mount.storage_config_id}`);
      return cachedDriver.driver;
    }

    // 创建新的驱动实例
    const driver = await this._createDriver(mount);

    // 缓存驱动实例
    this.driverCache.set(cacheKey, {
      driver,
      lastAccessed: Date.now(),
      mountId: mount.id,
      storageType: mount.storage_type,
      configId: mount.storage_config_id,
    });

    console.log(`创建新的存储驱动实例: ${mount.storage_type}/${mount.storage_config_id}`);
    return driver;
  }

  /**
   * 创建存储驱动实例
   * @private
   * @param {Object} mount - 挂载点对象
   * @returns {Promise<StorageDriver>} 存储驱动实例
   */
  async _createDriver(mount) {
    // 获取存储配置
    const config = await this._getStorageConfig(mount);

    // 使用工厂创建驱动
    const driver = await StorageFactory.createDriver(mount.storage_type, config, this.encryptionSecret);

    return driver;
  }

  /**
   * 获取存储配置
   * @private
   * @param {Object} mount - 挂载点对象
   * @returns {Promise<Object>} 存储配置
   */
  async _getStorageConfig(mount) {
    switch (mount.storage_type) {
      case "S3":
        return await this._getS3Config(mount.storage_config_id);

      // 未来扩展其他存储类型
      // case "WebDAV":
      //   return await this._getWebDAVConfig(mount.storage_config_id);

      default:
        throw new HTTPException(ApiStatus.BAD_REQUEST, {
          message: `不支持的存储类型: ${mount.storage_type}`,
        });
    }
  }

  /**
   * 获取S3配置
   * @private
   * @param {string} configId - 配置ID
   * @returns {Promise<Object>} S3配置
   */
  async _getS3Config(configId) {
    const config = await this.db.prepare("SELECT * FROM s3_configs WHERE id = ?").bind(configId).first();

    if (!config) {
      throw new HTTPException(ApiStatus.NOT_FOUND, { message: "S3配置不存在" });
    }

    return config;
  }

  /**
   * 生成缓存键
   * @private
   * @param {Object} mount - 挂载点对象
   * @returns {string} 缓存键
   */
  _generateCacheKey(mount) {
    return `${mount.storage_type}:${mount.storage_config_id}`;
  }

  /**
   * 清理过期的驱动实例
   * @private
   */
  _cleanupExpiredDrivers() {
    const now = Date.now();
    const expiredKeys = [];

    for (const [key, cached] of this.driverCache.entries()) {
      if (now - cached.lastAccessed > this.cacheTimeout) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      const cached = this.driverCache.get(key);
      if (cached && cached.driver) {
        // 清理驱动资源
        cached.driver.cleanup().catch((error) => {
          console.error(`清理存储驱动失败: ${error.message}`);
        });
      }
      this.driverCache.delete(key);
      console.log(`清理过期存储驱动: ${key}`);
    }

    if (expiredKeys.length > 0) {
      console.log(`清理了 ${expiredKeys.length} 个过期存储驱动实例`);
    }
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
    if (now - this.lastCleanupTime > 10 * 60 * 1000) {
      // 10分钟清理一次
      this.lastCleanupTime = now;
      this._cleanupExpiredDrivers();
    }
  }

  /**
   * 启动清理定时器
   * 在Cloudflare Workers环境中，使用延迟清理而不是定时器
   * @private
   */
  _startCleanupTimer() {
    // 每次操作时检查是否需要清理
    console.log("挂载管理器清理机制已启动（延迟清理模式）");
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
   * 清理指定挂载点的驱动缓存
   * @param {string} mountId - 挂载点ID
   */
  async clearMountCache(mountId) {
    const keysToRemove = [];

    for (const [key, cached] of this.driverCache.entries()) {
      if (cached.mountId === mountId) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      const cached = this.driverCache.get(key);
      if (cached && cached.driver) {
        await cached.driver.cleanup();
      }
      this.driverCache.delete(key);
      console.log(`清理挂载点驱动缓存: ${mountId} -> ${key}`);
    }
  }

  /**
   * 清理指定存储配置的驱动缓存
   * @param {string} storageType - 存储类型
   * @param {string} configId - 配置ID
   */
  async clearConfigCache(storageType, configId) {
    const cacheKey = `${storageType}:${configId}`;
    const cached = this.driverCache.get(cacheKey);

    if (cached && cached.driver) {
      await cached.driver.cleanup();
      this.driverCache.delete(cacheKey);
      console.log(`清理存储配置驱动缓存: ${cacheKey}`);
    }
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计
   */
  getCacheStats() {
    const stats = {
      totalCached: this.driverCache.size,
      byStorageType: {},
      oldestAccess: null,
      newestAccess: null,
    };

    let oldestTime = Date.now();
    let newestTime = 0;

    for (const [key, cached] of this.driverCache.entries()) {
      const storageType = cached.storageType;
      if (!stats.byStorageType[storageType]) {
        stats.byStorageType[storageType] = 0;
      }
      stats.byStorageType[storageType]++;

      if (cached.lastAccessed < oldestTime) {
        oldestTime = cached.lastAccessed;
      }
      if (cached.lastAccessed > newestTime) {
        newestTime = cached.lastAccessed;
      }
    }

    if (this.driverCache.size > 0) {
      stats.oldestAccess = new Date(oldestTime).toISOString();
      stats.newestAccess = new Date(newestTime).toISOString();
    }

    return stats;
  }

  /**
   * 清理所有驱动缓存
   */
  async clearAllCache() {
    const promises = [];

    for (const [key, cached] of this.driverCache.entries()) {
      if (cached.driver) {
        promises.push(cached.driver.cleanup());
      }
    }

    await Promise.all(promises);
    this.driverCache.clear();
    console.log("已清理所有存储驱动缓存");
  }

  /**
   * 销毁管理器
   */
  async destroy() {
    this._stopCleanupTimer();
    await this.clearAllCache();
    console.log("挂载管理器已销毁");
  }
}
