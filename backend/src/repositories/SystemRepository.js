/**
 * 系统设置Repository类
 * 负责系统设置相关的数据访问操作
 */

import { BaseRepository } from "./BaseRepository.js";
import { DbTables } from "../constants/index.js";

export class SystemRepository extends BaseRepository {
  /**
   * 根据键名查找系统设置
   * @param {string} key - 设置键名
   * @returns {Promise<Object|null>} 系统设置对象或null
   */
  async findByKey(key) {
    if (!key) return null;

    return await this.findOne(DbTables.SYSTEM_SETTINGS, { key });
  }

  /**
   * 获取系统设置（findByKey的别名）
   * @param {string} key - 设置键名
   * @returns {Promise<Object|null>} 系统设置对象或null
   */
  async getSetting(key) {
    return await this.findByKey(key);
  }

  /**
   * 获取所有系统设置
   * @returns {Promise<Array>} 系统设置列表
   */
  async findAll() {
    return await this.findMany(DbTables.SYSTEM_SETTINGS, {}, { orderBy: "key ASC" });
  }

  /**
   * 创建或更新系统设置
   * @param {string} key - 设置键名
   * @param {string} value - 设置值
   * @param {string} description - 设置描述（可选）
   * @returns {Promise<Object>} 操作结果
   */
  async upsertSetting(key, value, description = null) {
    const existing = await this.findByKey(key);

    if (existing) {
      // 更新现有设置
      return await this.execute(
        `UPDATE ${DbTables.SYSTEM_SETTINGS}
         SET value = ?, updated_at = CURRENT_TIMESTAMP
         WHERE key = ?`,
        [value, key]
      );
    } else {
      // 创建新设置
      return await this.execute(
        `INSERT INTO ${DbTables.SYSTEM_SETTINGS} (key, value, description, updated_at)
         VALUES (?, ?, ?, datetime('now'))`,
        [key, value, description]
      );
    }
  }

  /**
   * 更新最大上传大小设置
   * @param {number} maxUploadSize - 最大上传大小(MB)
   * @returns {Promise<Object>} 操作结果
   */
  async updateMaxUploadSize(maxUploadSize) {
    // 验证是否为有效数字
    if (isNaN(maxUploadSize) || maxUploadSize <= 0) {
      throw new Error("最大上传大小必须为正整数");
    }

    return await this.upsertSetting("max_upload_size", maxUploadSize.toString(), "单次最大上传文件大小限制");
  }

  /**
   * 更新WebDAV上传模式设置
   * @param {string} webdavUploadMode - WebDAV上传模式
   * @returns {Promise<Object>} 操作结果
   */
  async updateWebdavUploadMode(webdavUploadMode) {
    // 验证是否为有效的上传模式
    const validModes = ["multipart", "direct"];
    if (!validModes.includes(webdavUploadMode)) {
      throw new Error("WebDAV上传模式无效，有效值为: multipart, direct");
    }

    return await this.upsertSetting("webdav_upload_mode", webdavUploadMode, "WebDAV上传模式（multipart, direct）");
  }

  /**
   * 批量更新系统设置
   * @param {Object} settings - 设置键值对
   * @returns {Promise<Object>} 操作结果
   */
  async batchUpsertSettings(settings) {
    const keys = Object.keys(settings);
    let updatedCount = 0;
    let createdCount = 0;

    for (const key of keys) {
      const value = settings[key];
      const existing = await this.findByKey(key);

      if (existing) {
        await this.execute(
          `UPDATE ${DbTables.SYSTEM_SETTINGS} 
           SET value = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE key = ?`,
          [value, key]
        );
        updatedCount++;
      } else {
        const now = new Date().toISOString();
        await this.create(DbTables.SYSTEM_SETTINGS, {
          key,
          value,
          created_at: now,
          updated_at: now,
        });
        createdCount++;
      }
    }

    return {
      updatedCount,
      createdCount,
      totalCount: updatedCount + createdCount,
      message: `已更新${updatedCount}个设置，创建${createdCount}个设置`,
    };
  }

  /**
   * 删除系统设置
   * @param {string} key - 设置键名
   * @returns {Promise<Object>} 删除结果
   */
  async deleteSetting(key) {
    const result = await this.execute(`DELETE FROM ${DbTables.SYSTEM_SETTINGS} WHERE key = ?`, [key]);

    return {
      deletedCount: result.meta?.changes || 0,
      message: result.meta?.changes > 0 ? `已删除设置: ${key}` : `设置不存在: ${key}`,
    };
  }

  /**
   * 检查设置是否存在
   * @param {string} key - 设置键名
   * @returns {Promise<boolean>} 是否存在
   */
  async existsByKey(key) {
    return await this.exists(DbTables.SYSTEM_SETTINGS, { key });
  }

  /**
   * 获取系统统计数据
   * @returns {Promise<Object>} 统计数据
   */
  async getDashboardStats() {
    // 获取各种数据的统计
    const stats = {};

    // 文本分享总数
    stats.totalPastes = await this.count(DbTables.PASTES);

    // 文件上传总数
    stats.totalFiles = await this.count(DbTables.FILES);

    // API密钥总数
    stats.totalApiKeys = await this.count(DbTables.API_KEYS);

    // S3配置总数
    stats.totalS3Configs = await this.count(DbTables.S3_CONFIGS);

    return stats;
  }

  /**
   * 获取最近一周的数据趋势
   * @returns {Promise<Object>} 趋势数据
   */
  async getWeeklyTrends() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();

    // 文本分享趋势
    const pastesQuery = `
      SELECT
        date(created_at) as date,
        COUNT(*) as count
      FROM ${DbTables.PASTES}
      WHERE created_at >= ?
      GROUP BY date(created_at)
      ORDER BY date ASC
    `;
    const pastesResult = await this.query(pastesQuery, [sevenDaysAgoISO]);

    // 文件上传趋势
    const filesQuery = `
      SELECT
        date(created_at) as date,
        COUNT(*) as count
      FROM ${DbTables.FILES}
      WHERE created_at >= ?
      GROUP BY date(created_at)
      ORDER BY date ASC
    `;
    const filesResult = await this.query(filesQuery, [sevenDaysAgoISO]);

    return {
      pastes: pastesResult.results || [],
      files: filesResult.results || [],
    };
  }

  /**
   * 获取存储使用情况统计
   * @returns {Promise<Object>} 存储统计
   */
  async getStorageStats() {
    // 获取所有S3配置的使用情况
    const s3ConfigsQuery = `
      SELECT
        s.id, s.name, s.provider_type, s.total_storage_bytes,
        COUNT(f.id) as file_count,
        COALESCE(SUM(f.size), 0) as total_size
      FROM ${DbTables.S3_CONFIGS} s
      LEFT JOIN ${DbTables.FILES} f ON s.id = f.storage_config_id AND f.storage_type = 'S3'
      GROUP BY s.id, s.name, s.provider_type, s.total_storage_bytes
      ORDER BY s.name ASC
    `;

    const s3ConfigsResult = await this.query(s3ConfigsQuery);
    const s3Configs = s3ConfigsResult.results || [];

    // 计算总存储使用量
    const totalStorageUsed = s3Configs.reduce((total, config) => total + (config.total_size || 0), 0);

    // 转换数据格式
    const s3Buckets = s3Configs.map((config) => {
      const usedStorage = config.total_size || 0;
      const totalStorage = config.total_storage_bytes || 0;
      const usagePercent = totalStorage > 0 ? Math.min(100, Math.round((usedStorage / totalStorage) * 100)) : 0;

      return {
        ...config,
        usedStorage,
        totalStorage,
        fileCount: config.file_count || 0,
        usagePercent,
        providerType: config.provider_type,
      };
    });

    return {
      totalStorageUsed,
      s3Buckets,
    };
  }

  /**
   * 清理过期数据
   * @returns {Promise<Object>} 清理结果
   */
  async cleanupExpiredData() {
    const now = new Date().toISOString();
    let totalCleaned = 0;

    // 清理过期的文本分享
    const expiredPastes = await this.execute(
      `DELETE FROM ${DbTables.PASTES}
       WHERE expires_at IS NOT NULL AND expires_at < ?`,
      [now]
    );
    const pastesCount = expiredPastes.meta?.changes || 0;
    totalCleaned += pastesCount;

    // 清理过期的API密钥
    const expiredApiKeys = await this.execute(
      `DELETE FROM ${DbTables.API_KEYS}
       WHERE expires_at IS NOT NULL AND expires_at < ?`,
      [now]
    );
    const apiKeysCount = expiredApiKeys.meta?.changes || 0;
    totalCleaned += apiKeysCount;

    // 清理超过最大查看次数的文本分享
    const overLimitPastes = await this.execute(
      `DELETE FROM ${DbTables.PASTES}
       WHERE max_views IS NOT NULL AND max_views > 0 AND views >= max_views`
    );
    const overLimitCount = overLimitPastes.meta?.changes || 0;
    totalCleaned += overLimitCount;

    return {
      totalCleaned,
      details: {
        expiredPastes: pastesCount,
        expiredApiKeys: apiKeysCount,
        overLimitPastes: overLimitCount,
      },
      message: `清理完成，共清理${totalCleaned}条过期数据`,
    };
  }

  /**
   * 获取代理签名全局配置
   * @returns {Promise<Object>} 全局配置
   */
  async getProxySignConfig() {
    const signAllSetting = await this.findByKey("proxy_sign_all");
    const expiresSetting = await this.findByKey("proxy_sign_expires");

    return {
      signAll: signAllSetting?.value === "true",
      expires: parseInt(expiresSetting?.value) || 0,
    };
  }

  /**
   * 更新代理签名全局配置
   * @param {Object} config - 配置对象
   * @param {boolean} config.signAll - 是否签名所有
   * @param {number} config.expires - 过期时间（秒）
   * @returns {Promise<Object>} 操作结果
   */
  async updateProxySignConfig(config) {
    const { signAll, expires } = config;

    // 验证参数
    if (typeof signAll !== "boolean") {
      throw new Error("signAll 必须是布尔值");
    }

    if (typeof expires !== "number" || expires < 0) {
      throw new Error("expires 必须是非负数");
    }

    // 批量更新设置
    const settings = {
      proxy_sign_all: signAll.toString(),
      proxy_sign_expires: expires.toString(),
    };

    return await this.batchUpsertSettings(settings);
  }

  /**
   * 获取系统设置值（带默认值）
   * @param {string} key - 设置键名
   * @param {string} defaultValue - 默认值
   * @returns {Promise<string>} 设置值
   */
  async getSettingValue(key, defaultValue = "") {
    const setting = await this.findByKey(key);
    return setting?.value || defaultValue;
  }
}
