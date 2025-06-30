/**
 * S3预签名URL缓存管理器
 * 基于现有DirectoryCache架构，专门用于缓存S3预签名URL
 * 支持多租户、权限隔离、智能过期和自定义域名优化
 */

class S3UrlCacheManager {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   */
  constructor(options = {}) {
    this.config = {
      maxItems: options.maxItems || 1000, // 最大缓存项数量
      prunePercentage: options.prunePercentage || 20, // 清理百分比
      defaultTtl: options.defaultTtl || 3600, // 默认TTL(秒)
      customHostTtl: options.customHostTtl || 86400 * 7, // 自定义域名TTL(7天)
    };

    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      expired: 0,
      invalidations: 0,
      pruned: 0,
    };
  }

  /**
   * 生成缓存键 - 支持多租户和权限隔离
   * @param {string} s3ConfigId - S3配置ID
   * @param {string} storagePath - 存储路径
   * @param {boolean} forceDownload - 是否强制下载
   * @param {string} userType - 用户类型(admin/apiKey)
   * @param {string} userId - 用户ID
   * @returns {string} 缓存键
   */
  generateCacheKey(s3ConfigId, storagePath, forceDownload, userType, userId) {
    // 参数验证
    if (!s3ConfigId || !storagePath || !userType || !userId) {
      throw new Error(`缓存键生成失败：缺少必要参数 s3ConfigId=${s3ConfigId}, storagePath=${storagePath}, userType=${userType}, userId=${userId}`);
    }

    // 多租户隔离：不同用户类型和ID的缓存分离
    const userScope = `${userType}:${userId}`;
    const downloadFlag = forceDownload ? "dl" : "pv"; // download/preview
    const encodedPath = Buffer.from(storagePath).toString("base64");
    return `s3url:${s3ConfigId}:${userScope}:${downloadFlag}:${encodedPath}`;
  }

  /**
   * 获取缓存的预签名URL
   * @param {string} s3ConfigId - S3配置ID
   * @param {string} storagePath - 存储路径
   * @param {boolean} forceDownload - 是否强制下载
   * @param {string} userType - 用户类型
   * @param {string} userId - 用户ID
   * @returns {string|null} 缓存的URL或null
   */
  get(s3ConfigId, storagePath, forceDownload, userType, userId) {
    try {
      const key = this.generateCacheKey(s3ConfigId, storagePath, forceDownload, userType, userId);
      const cacheItem = this.cache.get(key);

      if (!cacheItem) {
        this.stats.misses++;
        return null;
      }

      // 检查缓存是否过期
      if (Date.now() > cacheItem.expiresAt) {
        this.cache.delete(key);
        this.stats.expired++;
        return null;
      }

      // LRU策略：更新最后访问时间
      cacheItem.lastAccessed = Date.now();
      this.cache.set(key, cacheItem);

      this.stats.hits++;
      return cacheItem.url;
    } catch (error) {
      console.warn("S3URL缓存获取失败:", error.message);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * 设置预签名URL缓存
   * @param {string} s3ConfigId - S3配置ID
   * @param {string} storagePath - 存储路径
   * @param {boolean} forceDownload - 是否强制下载
   * @param {string} userType - 用户类型
   * @param {string} userId - 用户ID
   * @param {string} url - 预签名URL
   * @param {Object} s3Config - S3配置对象
   */
  set(s3ConfigId, storagePath, forceDownload, userType, userId, url, s3Config) {
    try {
      const key = this.generateCacheKey(s3ConfigId, storagePath, forceDownload, userType, userId);
      const now = Date.now();

      // 智能TTL计算
      let ttl;
      if (s3Config.custom_host) {
        // 自定义域名：长期缓存(7天)，因为不会过期
        ttl = this.config.customHostTtl;
      } else {
        // 预签名URL：使用S3配置的过期时间，但留10%缓冲时间
        const configTtl = s3Config.signature_expires_in || this.config.defaultTtl;
        ttl = Math.floor(configTtl * 0.9); // 90%的有效期，避免边界过期
      }

      const expiresAt = now + ttl * 1000;

      // 检查缓存项数量限制，必要时清理
      this.checkSizeAndPrune();

      // 更新缓存
      this.cache.set(key, {
        url,
        expiresAt,
        lastAccessed: now,
        s3ConfigId,
        userType,
        userId,
        isCustomHost: !!s3Config.custom_host,
      });
    } catch (error) {
      console.warn("S3URL缓存设置失败:", error.message);
      // 缓存失败不应该影响主流程，静默处理
    }
  }

  /**
   * 清理指定S3配置的所有缓存
   * @param {string} s3ConfigId - S3配置ID
   * @returns {number} 清理的缓存项数量
   */
  invalidateS3Config(s3ConfigId) {
    let clearedCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (item.s3ConfigId === s3ConfigId) {
        this.cache.delete(key);
        clearedCount++;
      }
    }

    this.stats.invalidations += clearedCount;
    return clearedCount;
  }

  /**
   * 清理指定用户的所有缓存
   * @param {string} userType - 用户类型
   * @param {string} userId - 用户ID
   * @returns {number} 清理的缓存项数量
   */
  invalidateUser(userType, userId) {
    let clearedCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (item.userType === userType && item.userId === userId) {
        this.cache.delete(key);
        clearedCount++;
      }
    }

    this.stats.invalidations += clearedCount;
    return clearedCount;
  }

  /**
   * 清理所有缓存
   * @returns {number} 清理的缓存项数量
   */
  invalidateAll() {
    const clearedCount = this.cache.size;
    this.cache.clear();
    this.stats.invalidations += clearedCount;
    return clearedCount;
  }

  /**
   * 检查缓存大小并在必要时清理
   */
  checkSizeAndPrune() {
    if (this.cache.size > this.config.maxItems) {
      this.pruneCache();
    }
  }

  /**
   * 清理缓存 - LRU策略
   */
  pruneCache() {
    const targetSize = Math.floor((this.cache.size * (100 - this.config.prunePercentage)) / 100);

    // 按最后访问时间排序
    const entries = Array.from(this.cache.entries()).sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    let prunedCount = 0;
    while (this.cache.size > targetSize && prunedCount < entries.length) {
      const [key] = entries[prunedCount];
      this.cache.delete(key);
      prunedCount++;
    }

    this.stats.pruned += prunedCount;
    console.log(`S3URL缓存清理完成，清理了 ${prunedCount} 项，当前缓存项: ${this.cache.size}`);
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
    };
  }
}

// 创建单例实例
const s3UrlCacheManager = new S3UrlCacheManager();

/**
 * 统一的S3URL缓存清理函数
 * @param {Object} options - 清理选项
 * @param {string} [options.s3ConfigId] - S3配置ID
 * @param {string} [options.userType] - 用户类型
 * @param {string} [options.userId] - 用户ID
 * @returns {number} 清除的缓存项数量
 */
export async function clearS3UrlCache(options = {}) {
  const { s3ConfigId, userType, userId } = options;
  let totalCleared = 0;

  try {
    if (s3ConfigId) {
      totalCleared = s3UrlCacheManager.invalidateS3Config(s3ConfigId);
      console.log(`已清理S3配置 ${s3ConfigId} 的URL缓存，共 ${totalCleared} 项`);
    } else if (userType && userId) {
      totalCleared = s3UrlCacheManager.invalidateUser(userType, userId);
      console.log(`已清理用户 ${userType}:${userId} 的URL缓存，共 ${totalCleared} 项`);
    } else {
      totalCleared = s3UrlCacheManager.invalidateAll();
      console.log(`已清理所有S3URL缓存，共 ${totalCleared} 项`);
    }

    return totalCleared;
  } catch (error) {
    console.error("清理S3URL缓存时出错:", error);
    return 0;
  }
}

// 导出单例实例和类
export { s3UrlCacheManager, S3UrlCacheManager };
