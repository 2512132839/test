import { DbTables, DEFAULT_MAX_UPLOAD_SIZE_MB } from "../constants/index.js";

/**
 * 获取所有系统设置
 * @param {D1Database} db - D1数据库实例
 * @returns {Promise<Array>} 系统设置列表
 */
export async function getAllSystemSettings(db) {
  try {
    // 获取所有系统设置
    const settings = await db
      .prepare(
        `
        SELECT key, value, description, updated_at
        FROM ${DbTables.SYSTEM_SETTINGS}
        ORDER BY key ASC
      `
      )
      .all();

    return settings.results;
  } catch (error) {
    console.error("获取系统设置错误:", error);
    throw new Error("获取系统设置失败: " + error.message);
  }
}

/**
 * 更新系统设置
 * @param {D1Database} db - D1数据库实例
 * @param {Object} settings - 要更新的设置
 * @returns {Promise<void>}
 */
export async function updateSystemSettings(db, settings) {
  try {
    // 处理更新最大上传大小的请求
    if (settings.max_upload_size !== undefined) {
      let maxUploadSize = parseInt(settings.max_upload_size);

      // 验证是否为有效数字
      if (isNaN(maxUploadSize) || maxUploadSize <= 0) {
        throw new Error("最大上传大小必须为正整数");
      }

      // 更新数据库
      await db
        .prepare(
          `
          INSERT OR REPLACE INTO ${DbTables.SYSTEM_SETTINGS} (key, value, description, updated_at)
          VALUES ('max_upload_size', ?, '单次最大上传文件大小限制', datetime('now'))
        `
        )
        .bind(maxUploadSize.toString())
        .run();
    }

    // 处理WebDAV上传模式设置
    if (settings.webdav_upload_mode !== undefined) {
      const webdavUploadMode = settings.webdav_upload_mode;

      // 验证是否为有效的上传模式
      const validModes = ["auto", "proxy", "multipart", "direct"];
      if (!validModes.includes(webdavUploadMode)) {
        throw new Error("WebDAV上传模式无效，有效值为: auto, proxy, multipart, direct");
      }

      // 更新数据库
      await db
        .prepare(
          `
          INSERT OR REPLACE INTO ${DbTables.SYSTEM_SETTINGS} (key, value, description, updated_at)
          VALUES ('webdav_upload_mode', ?, 'WebDAV上传模式（auto, proxy, multipart, direct）', datetime('now'))
        `
        )
        .bind(webdavUploadMode)
        .run();
    }

    // 可以在这里添加其他设置的更新逻辑
  } catch (error) {
    console.error("更新系统设置错误:", error);
    throw new Error("更新系统设置失败: " + error.message);
  }
}

/**
 * 获取最大上传文件大小限制
 * @param {D1Database} db - D1数据库实例
 * @returns {Promise<number>} 最大上传大小(MB)
 */
export async function getMaxUploadSize(db) {
  try {
    // 获取最大上传大小设置
    const maxUploadSize = await db
      .prepare(
        `
        SELECT value FROM ${DbTables.SYSTEM_SETTINGS}
        WHERE key = 'max_upload_size'
      `
      )
      .first();

    // 返回默认值或数据库中的值
    return maxUploadSize ? parseInt(maxUploadSize.value) : DEFAULT_MAX_UPLOAD_SIZE_MB;
  } catch (error) {
    console.error("获取最大上传大小错误:", error);
    // 发生错误时返回默认值
    return DEFAULT_MAX_UPLOAD_SIZE_MB;
  }
}

/**
 * 获取仪表盘统计数据
 * @param {D1Database} db - D1数据库实例
 * @param {string} adminId - 管理员ID
 * @returns {Promise<Object>} 仪表盘统计数据
 */
export async function getDashboardStats(db, adminId) {
  try {
    if (!adminId) {
      throw new Error("未授权");
    }

    // 获取统计数据
    // 1. 文本分享总数
    const totalPastesResult = await db.prepare(`SELECT COUNT(*) as count FROM ${DbTables.PASTES}`).first();
    const totalPastes = totalPastesResult ? totalPastesResult.count : 0;

    // 2. 文件上传总数
    const totalFilesResult = await db.prepare(`SELECT COUNT(*) as count FROM ${DbTables.FILES}`).first();
    const totalFiles = totalFilesResult ? totalFilesResult.count : 0;

    // 3. API密钥总数
    const totalApiKeysResult = await db.prepare(`SELECT COUNT(*) as count FROM ${DbTables.API_KEYS}`).first();
    const totalApiKeys = totalApiKeysResult ? totalApiKeysResult.count : 0;

    // 4. S3配置总数
    const totalS3ConfigsResult = await db.prepare(`SELECT COUNT(*) as count FROM ${DbTables.S3_CONFIGS}`).first();
    const totalS3Configs = totalS3ConfigsResult ? totalS3ConfigsResult.count : 0;

    // 5. 获取所有S3存储配置的使用情况
    const s3ConfigsWithUsage = await getS3ConfigsWithUsage(db);

    // 6. 最近一周的数据
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 文本分享趋势
    const lastWeekPastesQuery = `
      SELECT 
        date(created_at) as date, 
        COUNT(*) as count 
      FROM ${DbTables.PASTES} 
      WHERE created_at >= ?
      GROUP BY date(created_at)
      ORDER BY date ASC
    `;

    const lastWeekPastesResult = await db.prepare(lastWeekPastesQuery).bind(sevenDaysAgo.toISOString()).all();

    // 文件上传趋势
    const lastWeekFilesQuery = `
      SELECT 
        date(created_at) as date, 
        COUNT(*) as count 
      FROM ${DbTables.FILES} 
      WHERE created_at >= ?
      GROUP BY date(created_at)
      ORDER BY date ASC
    `;

    const lastWeekFilesResult = await db.prepare(lastWeekFilesQuery).bind(sevenDaysAgo.toISOString()).all();

    // 处理每日数据，补全缺失的日期
    const lastWeekPastes = processWeeklyData(lastWeekPastesResult.results || []);
    const lastWeekFiles = processWeeklyData(lastWeekFilesResult.results || []);

    // 总体存储使用情况
    const totalStorageUsed = s3ConfigsWithUsage.reduce((total, config) => total + config.usedStorage, 0);

    return {
      totalPastes,
      totalFiles,
      totalApiKeys,
      totalS3Configs,
      totalStorageUsed,
      s3Buckets: s3ConfigsWithUsage,
      lastWeekPastes,
      lastWeekFiles,
    };
  } catch (error) {
    console.error("获取仪表盘统计数据失败:", error);
    throw new Error("获取仪表盘统计数据失败: " + error.message);
  }
}

/**
 * 获取S3配置使用情况统计
 * @param {D1Database} db - D1数据库实例
 * @returns {Promise<Array>} S3配置使用情况
 */
async function getS3ConfigsWithUsage(db) {
  try {
    // 获取所有S3配置
    const configsResult = await db
      .prepare(
        `SELECT 
          id, name, provider_type, bucket_name, 
          endpoint_url, region, path_style, default_folder, 
          is_public, total_storage_bytes
        FROM ${DbTables.S3_CONFIGS}
        ORDER BY name ASC`
      )
      .all();

    if (!configsResult.results || configsResult.results.length === 0) {
      return [];
    }

    const configs = configsResult.results;
    const result = [];

    // 计算每个配置的使用情况
    for (const config of configs) {
      // 获取该配置下的文件总大小
      const usageResult = await db
        .prepare(
          `SELECT SUM(size) as total_size, COUNT(*) as file_count
           FROM ${DbTables.FILES}
           WHERE s3_config_id = ?`
        )
        .bind(config.id)
        .first();

      const usedStorage = usageResult ? usageResult.total_size || 0 : 0;
      const fileCount = usageResult ? usageResult.file_count || 0 : 0;

      // 设置总容量值
      let totalStorage = config.total_storage_bytes || 0;

      // 如果没有设置总容量或为0，为不同提供商设置默认值
      if (!totalStorage) {
        if (config.provider_type === "Cloudflare R2") {
          totalStorage = 10 * 1024 * 1024 * 1024; // 10GB
        } else if (config.provider_type === "Backblaze B2") {
          totalStorage = 102 * 1024 * 1024 * 1024; // 10GB
        } else {
          totalStorage = 5 * 1024 * 1024 * 1024; // 5GB
        }
      }

      result.push({
        id: config.id,
        name: config.name,
        providerType: config.provider_type,
        bucketName: config.bucket_name,
        usedStorage: usedStorage,
        totalStorage: totalStorage,
        fileCount: fileCount,
        // 计算使用百分比
        usagePercent: totalStorage > 0 ? Math.min(100, Math.round((usedStorage / totalStorage) * 100)) : 0,
      });
    }

    return result;
  } catch (error) {
    console.error("获取S3配置使用情况失败:", error);
    return [];
  }
}

/**
 * 处理每周数据，确保有7天的数据
 * @param {Array} data - 包含日期和数量的数据
 * @returns {Array} 处理后的数据
 */
function processWeeklyData(data) {
  const result = new Array(7).fill(0);

  if (!data || data.length === 0) return result;

  // 获取过去7天的日期
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split("T")[0]); // 格式：YYYY-MM-DD
  }

  // 将数据映射到对应日期
  data.forEach((item) => {
    const itemDate = item.date.split("T")[0]; // 处理可能的时间部分
    const index = dates.indexOf(itemDate);
    if (index !== -1) {
      result[index] = item.count;
    }
  });

  return result;
}
