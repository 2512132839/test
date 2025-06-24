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
      maxMemoryMB: options.maxMemoryMB || 100, // 默认最大内存使用量为100MB
      prunePercentage: options.prunePercentage || 20, // 默认清理20%
    };

    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      expired: 0,
      invalidations: 0,
      pruned: 0,
      estimatedMemoryUsage: 0, // 估算的内存使用量(bytes)
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
      // 更新内存使用估算
      this.stats.estimatedMemoryUsage -= cacheItem.estimatedSize || 0;
      return null;
    }

    // LRU策略：更新最后访问时间
    cacheItem.lastAccessed = Date.now();
    this.cache.set(key, cacheItem); // 重新设置以更新Map中的顺序

    this.stats.hits++;
    return cacheItem.data;
  }

  /**
   * 估算对象大小(字节)
   * @param {Object} obj - 要估算大小的对象
   * @returns {number} - 估算的大小(bytes)
   */
  estimateSize(obj) {
    if (obj === null || obj === undefined) return 0;

    // 基本类型大小估算
    if (typeof obj === "boolean") return 4;
    if (typeof obj === "number") return 8;
    if (typeof obj === "string") return obj.length * 2; // UTF-16编码每个字符2字节

    // 对于数组和对象，递归计算
    if (Array.isArray(obj)) {
      return obj.reduce((size, item) => size + this.estimateSize(item), 0);
    }

    if (typeof obj === "object") {
      return Object.entries(obj).reduce((size, [key, value]) => {
        return size + key.length * 2 + this.estimateSize(value);
      }, 0);
    }

    return 0;
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

    // 估算数据大小
    const estimatedSize = this.estimateSize(data);

    // 检查是否为现有缓存项更新
    if (this.cache.has(key)) {
      const oldItem = this.cache.get(key);
      this.stats.estimatedMemoryUsage -= oldItem.estimatedSize || 0;
    }

    // 更新缓存
    this.cache.set(key, {
      data,
      expiresAt,
      lastAccessed: now,
      estimatedSize,
    });

    // 更新内存使用估算
    this.stats.estimatedMemoryUsage += estimatedSize;

    // 检查是否需要清理缓存
    const maxMemoryBytes = this.config.maxMemoryMB * 1024 * 1024;
    if (this.cache.size > this.config.maxItems || this.stats.estimatedMemoryUsage > maxMemoryBytes) {
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
      // 更新内存使用估算
      const cacheItem = this.cache.get(key);
      this.stats.estimatedMemoryUsage -= cacheItem.estimatedSize || 0;

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
    let memorySaved = 0;
    const keysToDelete = [];

    // 找出所有属于该挂载点的缓存键
    for (const [key, item] of this.cache.entries()) {
      if (key.startsWith(`${mountId}:`)) {
        keysToDelete.push(key);
        memorySaved += item.estimatedSize || 0;
      }
    }

    // 删除找到的所有键
    for (const key of keysToDelete) {
      this.cache.delete(key);
      count++;
    }

    if (count > 0) {
      this.stats.invalidations += count;
      // 更新内存使用估算
      this.stats.estimatedMemoryUsage -= memorySaved;
      console.log(`挂载点缓存已全部失效 - 挂载点:${mountId}, 删除项:${count}, 释放内存:${(memorySaved / 1024 / 1024).toFixed(2)}MB`);
    }

    return count;
  }

  /**
   * 使所有缓存失效
   * @returns {number} - 被删除的缓存项数量
   */
  invalidateAll() {
    const count = this.cache.size;
    const memorySaved = this.stats.estimatedMemoryUsage;

    this.cache.clear();

    if (count > 0) {
      this.stats.invalidations += count;
      // 重置内存使用估算
      this.stats.estimatedMemoryUsage = 0;
      console.log(`所有缓存已失效 - 删除项:${count}, 释放内存:${(memorySaved / 1024 / 1024).toFixed(2)}MB`);
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
    let memorySaved = 0;

    // 清除当前路径的缓存
    if (this.invalidate(mountId, currentPath)) {
      const cacheItem = this.cache.get(this.generateKey(mountId, currentPath));
      if (cacheItem) {
        memorySaved += cacheItem.estimatedSize || 0;
      }
      count++;
    }

    // 逐级向上清除父路径的缓存
    while (currentPath !== "/" && currentPath.includes("/")) {
      // 获取父路径
      currentPath = currentPath.substring(0, currentPath.lastIndexOf("/"));
      if (currentPath === "") currentPath = "/";

      // 清除父路径的缓存
      if (this.invalidate(mountId, currentPath)) {
        const cacheItem = this.cache.get(this.generateKey(mountId, currentPath));
        if (cacheItem) {
          memorySaved += cacheItem.estimatedSize || 0;
        }
        count++;
      }

      // 如果已经到达根路径，停止循环
      if (currentPath === "/") break;
    }

    if (count > 0) {
      console.log(`路径及父路径缓存已失效 - 挂载点:${mountId}, 路径:${path}, 删除项:${count}, 释放内存:${(memorySaved / 1024 / 1024).toFixed(2)}MB`);
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
    let memorySaved = 0;

    // 找出已过期的项目
    const expiredEntries = entries.filter(([_, item]) => now > item.expiresAt);

    // 如果有足够的过期项目，直接清理它们
    if (expiredEntries.length >= Math.ceil((entries.length * this.config.prunePercentage) / 100)) {
      for (const [key, item] of expiredEntries) {
        this.cache.delete(key);
        prunedCount++;
        memorySaved += item.estimatedSize || 0;
      }
    } else {
      // 否则，使用LRU策略：按最后访问时间排序并删除最久未访问的项目
      entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

      const toDelete = Math.ceil((entries.length * this.config.prunePercentage) / 100);
      for (let i = 0; i < toDelete; i++) {
        if (i < entries.length) {
          const [key, item] = entries[i];
          this.cache.delete(key);
          prunedCount++;
          memorySaved += item.estimatedSize || 0;
        }
      }
    }

    // 更新统计信息
    if (prunedCount > 0) {
      this.stats.pruned += prunedCount;
      this.stats.estimatedMemoryUsage -= memorySaved;
      console.log(`缓存清理完成 - 删除项:${prunedCount}, 释放内存:${(memorySaved / 1024 / 1024).toFixed(2)}MB`);
    }
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计数据，包括命中率和大小
   */
  getStats() {
    // 计算命中率
    const totalAccesses = this.stats.hits + this.stats.misses + this.stats.expired;
    const hitRate = totalAccesses > 0 ? this.stats.hits / totalAccesses : 0;

    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: hitRate,
      memoryUsageMB: (this.stats.estimatedMemoryUsage / (1024 * 1024)).toFixed(2),
      averageItemSizeKB: this.cache.size > 0 ? (this.stats.estimatedMemoryUsage / this.cache.size / 1024).toFixed(2) : 0,
      config: this.config,
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
      console.log(`已清理挂载点 ${mountId} 的所有缓存，共 ${clearedCount} 项`);
      return clearedCount;
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
        return 0;
      }

      // 清理每个关联挂载点的缓存
      for (const mount of mounts.results) {
        const clearedCount = directoryCacheManager.invalidateMount(mount.id);
        totalCleared += clearedCount;
      }

      if (totalCleared > 0) {
        console.log(`已清理 ${mounts.results.length} 个挂载点的缓存，共 ${totalCleared} 项`);
      }

      return totalCleared;
    }

    // 如果没有提供有效参数
    console.warn("缓存清理失败：未提供有效的挂载点ID或S3配置信息");
    return 0;
  } catch (error) {
    console.error("清理缓存时出错:", error);
    return 0;
  }
}

// /**
//  * 为文件路径清除相关缓存 - 兼容性函数，内部调用clearCache
//  * @param {D1Database} db - 数据库连接
//  * @param {string} filePath - 文件路径
//  * @param {string} s3ConfigId - S3配置ID
//  * @returns {Promise<number>} 清除的缓存项数量
//  * @deprecated 请直接使用 clearCache 函数
//  */
// export async function clearCacheForFilePath(db, filePath, s3ConfigId) {
//   console.warn("clearCacheForFilePath 已废弃，请使用 clearCache 函数");
//   return await clearCache({ db, s3ConfigId });
// }

// /**
//  * 为指定路径清除缓存 - 兼容性函数，内部调用clearCache
//  * @param {string} mountId - 挂载点ID
//  * @param {string} path - 路径
//  * @param {boolean} recursive - 是否递归清除（已忽略）
//  * @param {string} reason - 清除原因（已忽略）
//  * @param {Object} s3Config - S3配置（已忽略）
//  * @returns {number} 清除的缓存项数量
//  * @deprecated 请直接使用 clearCache 函数
//  */
// export function clearCacheForPath(mountId, path, recursive, reason, s3Config) {
//   console.warn("clearCacheForPath 已废弃，请使用 clearCache 函数");
//   return directoryCacheManager.invalidateMount(mountId);
// }

// 导出单例实例和类 (单例用于实际应用，类用于测试和特殊场景)
export { directoryCacheManager, DirectoryCacheManager };
