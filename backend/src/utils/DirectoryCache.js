/**
 * 目录缓存管理器 - 简单内存缓存实现
 * 提供目录列表的缓存功能，用于提高频繁访问目录的性能
 */
class DirectoryCacheManager {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {number} options.maxItems - 最大缓存项数量，默认为500
   * @param {number} options.maxMemoryMB - 最大内存使用量(MB)，默认为100
   * @param {number} options.prunePercentage - 清理时删除的缓存项百分比，默认为20%
   */
  constructor(options = {}) {
    // 默认配置
    this.config = {
      maxItems: options.maxItems || 500,
      prunePercentage: options.prunePercentage || 20, // 默认清理20%
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
   * 生成安全的缓存键
   * @param {string} mountId - 挂载点ID
   * @param {string} path - 目录路径
   * @returns {string} - 缓存键
   */
  generateKey(mountId, path) {
    // 使用 Base64 编码路径，避免特殊字符问题
    const encodedPath = Buffer.from(path).toString("base64");
    return `${mountId}:${encodedPath}`;
  }

  /**
   * 获取缓存的目录列表
   * @param {string} mountId - 挂载点ID
   * @param {string} path - 目录路径
   * @returns {Object|null} - 缓存的目录列表，如果缓存未命中则返回null
   */
  get(mountId, path) {
    const key = this.generateKey(mountId, path);
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
    this.cache.set(key, cacheItem); // 重新设置以更新Map中的顺序

    this.stats.hits++;
    return cacheItem.data;
  }

  /**
   * 设置目录列表缓存
   * @param {string} mountId - 挂载点ID
   * @param {string} path - 目录路径
   * @param {Object} data - 要缓存的目录列表数据
   * @param {number} ttlSeconds - 缓存的生存时间（秒）
   */
  set(mountId, path, data, ttlSeconds) {
    const key = this.generateKey(mountId, path);
    const now = Date.now();
    const expiresAt = now + ttlSeconds * 1000;

    // 更新缓存
    this.cache.set(key, {
      data,
      expiresAt,
      lastAccessed: now,
    });

    // 检查是否需要清理缓存
    if (this.cache.size > this.config.maxItems) {
      this.prune();
    }
  }

  /**
   * 使指定目录的缓存失效
   * @param {string} mountId - 挂载点ID
   * @param {string} path - 目录路径
   * @returns {boolean} - 如果缓存项存在并被删除则返回true，否则返回false
   */
  invalidate(mountId, path) {
    const key = this.generateKey(mountId, path);
    const existed = this.cache.has(key);

    if (existed) {
      this.cache.delete(key);
      this.stats.invalidations++;
      console.log(`目录缓存已失效 - 挂载点:${mountId}, 路径:${path}`);
    }

    return existed;
  }

  /**
   * 使指定挂载点的所有缓存失效
   * @param {string} mountId - 挂载点ID
   * @returns {number} - 被删除的缓存项数量
   */
  invalidateMount(mountId) {
    let count = 0;
    const keysToDelete = [];

    // 找出所有属于该挂载点的缓存键
    for (const [key] of this.cache.entries()) {
      if (key.startsWith(`${mountId}:`)) {
        keysToDelete.push(key);
      }
    }

    // 删除找到的所有键
    for (const key of keysToDelete) {
      this.cache.delete(key);
      count++;
    }

    if (count > 0) {
      this.stats.invalidations += count;
      console.log(`挂载点缓存已全部失效 - 挂载点:${mountId}, 删除项:${count}`);
    }

    return count;
  }

  /**
   * 使所有缓存失效
   * @returns {number} - 被删除的缓存项数量
   */
  invalidateAll() {
    const count = this.cache.size;
    this.cache.clear();

    if (count > 0) {
      this.stats.invalidations += count;
      console.log(`所有缓存已失效 - 删除项:${count}`);
    }

    return count;
  }

  /**
   * 使指定路径及其所有父路径的缓存失效
   * 例如: 对于路径 /a/b/c，会使 /a/b/c、/a/b 和 /a 的缓存失效
   * @param {string} mountId - 挂载点ID
   * @param {string} path - 目录路径
   * @returns {number} - 被删除的缓存项数量
   */
  invalidatePathAndAncestors(mountId, path) {
    // 确保路径格式标准化
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    let currentPath = normalizedPath;
    let count = 0;

    // 清除当前路径的缓存
    if (this.invalidate(mountId, currentPath)) {
      count++;
    }

    // 逐级向上清除父路径的缓存
    while (currentPath !== "/" && currentPath.includes("/")) {
      // 获取父路径
      currentPath = currentPath.substring(0, currentPath.lastIndexOf("/"));
      if (currentPath === "") currentPath = "/";

      // 清除父路径的缓存
      if (this.invalidate(mountId, currentPath)) {
        count++;
      }

      // 如果已经到达根路径，停止循环
      if (currentPath === "/") break;
    }

    if (count > 0) {
      console.log(`路径及父路径缓存已失效 - 挂载点:${mountId}, 路径:${path}, 删除项:${count}`);
    }

    return count;
  }

  /**
   * 清理过期的缓存项或过多的缓存项
   */
  prune() {
    const now = Date.now();
    const entries = [...this.cache.entries()];
    let prunedCount = 0;

    // 找出已过期的项目
    const expiredEntries = entries.filter(([_, item]) => now > item.expiresAt);

    // 如果有足够的过期项目，直接清理它们
    if (expiredEntries.length >= Math.ceil((entries.length * this.config.prunePercentage) / 100)) {
      for (const [key] of expiredEntries) {
        this.cache.delete(key);
        prunedCount++;
      }
    } else {
      // 否则，使用LRU策略：按最后访问时间排序并删除最久未访问的项目
      entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

      const toDelete = Math.ceil((entries.length * this.config.prunePercentage) / 100);
      for (let i = 0; i < toDelete; i++) {
        if (i < entries.length) {
          const [key] = entries[i];
          this.cache.delete(key);
          prunedCount++;
        }
      }
    }

    // 更新统计信息
    if (prunedCount > 0) {
      this.stats.pruned += prunedCount;
      console.log(`缓存清理完成 - 删除项:${prunedCount}`);
    }
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计数据，包括命中率和大小
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
const directoryCacheManager = new DirectoryCacheManager();

/**
 * 统一的缓存清理函数 - 可根据挂载点ID或S3配置ID清理缓存
 * @param {Object} options - 清理选项
 * @param {string} [options.mountId] - 要清理的挂载点ID
 * @param {D1Database} [options.db] - 数据库连接（当使用s3ConfigId时必需）
 * @param {string} [options.s3ConfigId] - S3配置ID，将清理所有关联的挂载点
 * @returns {Promise<number>} 清除的缓存项数量
 */
export async function clearCache(options = {}) {
  const { mountId, db, s3ConfigId } = options;
  let totalCleared = 0;

  try {
    // 场景1: 直接提供挂载点ID - 清理单个挂载点
    if (mountId) {
      const clearedCount = directoryCacheManager.invalidateMount(mountId);
      console.log(`已清理挂载点 ${mountId} 的目录缓存，共 ${clearedCount} 项`);
      totalCleared += clearedCount;
    }

    // 场景2: 提供S3配置ID - 查找并清理所有关联挂载点
    if (db && s3ConfigId) {
      // 获取与S3配置相关的所有挂载点
      const mounts = await db
          .prepare(
              `SELECT m.id
           FROM storage_mounts m
           WHERE m.storage_type = 'S3' AND m.storage_config_id = ?`
          )
          .bind(s3ConfigId)
          .all();

      if (!mounts?.results?.length) {
        console.log(`未找到与S3配置 ${s3ConfigId} 关联的挂载点`);
      } else {
        // 清理每个关联挂载点的缓存
        for (const mount of mounts.results) {
          const clearedCount = directoryCacheManager.invalidateMount(mount.id);
          totalCleared += clearedCount;
        }

        if (totalCleared > 0) {
          console.log(`已清理 ${mounts.results.length} 个挂载点的目录缓存，共 ${totalCleared} 项`);
        }
      }

      // 清理S3URL缓存
      try {
        const { clearS3UrlCache } = await import("./S3UrlCache.js");
        const s3UrlCleared = await clearS3UrlCache({ s3ConfigId });
        totalCleared += s3UrlCleared;
        console.log(`已清理S3配置 ${s3ConfigId} 的URL缓存，共 ${s3UrlCleared} 项`);
      } catch (error) {
        console.warn("清理S3URL缓存失败:", error);
      }
    }

    // 如果没有提供有效参数，清理所有缓存
    if (!mountId && !s3ConfigId) {
      const dirCleared = directoryCacheManager.invalidateAll();
      totalCleared += dirCleared;

      try {
        const { clearS3UrlCache } = await import("./S3UrlCache.js");
        const s3UrlCleared = await clearS3UrlCache();
        totalCleared += s3UrlCleared;
        console.log(`已清理所有缓存：目录缓存 ${dirCleared} 项，URL缓存 ${s3UrlCleared} 项`);
      } catch (error) {
        console.warn("清理S3URL缓存失败:", error);
      }
    }

    return totalCleared;
  } catch (error) {
    console.error("清理缓存时出错:", error);
    return 0;
  }
}

// 导出单例实例和类 (单例用于实际应用，类用于测试和特殊场景)
export { directoryCacheManager, DirectoryCacheManager };
