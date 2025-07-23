import { DEFAULT_MAX_UPLOAD_SIZE_MB } from "../constants/index.js";
import { getS3ConfigsWithUsage } from "./s3ConfigService.js";
import { RepositoryFactory } from "../repositories/index.js";

/**
 * 获取所有系统设置
 * @param {D1Database} db - D1数据库实例
 * @returns {Promise<Array>} 系统设置列表
 */
export async function getAllSystemSettings(db) {
  try {
    // 使用 SystemRepository
    const repositoryFactory = new RepositoryFactory(db);
    const systemRepository = repositoryFactory.getSystemRepository();

    return await systemRepository.findAll();
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
    // 使用 SystemRepository
    const repositoryFactory = new RepositoryFactory(db);
    const systemRepository = repositoryFactory.getSystemRepository();

    // 处理更新最大上传大小的请求
    if (settings.max_upload_size !== undefined) {
      const maxUploadSize = parseInt(settings.max_upload_size);
      await systemRepository.updateMaxUploadSize(maxUploadSize);
    }

    // 处理WebDAV上传模式设置
    if (settings.webdav_upload_mode !== undefined) {
      await systemRepository.updateWebdavUploadMode(settings.webdav_upload_mode);
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
    // 使用 SystemRepository
    const repositoryFactory = new RepositoryFactory(db);
    const systemRepository = repositoryFactory.getSystemRepository();

    // 获取最大上传大小设置
    const setting = await systemRepository.findByKey("max_upload_size");

    // 返回默认值或数据库中的值
    return setting ? parseInt(setting.value) : DEFAULT_MAX_UPLOAD_SIZE_MB;
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

    // 使用 SystemRepository
    const repositoryFactory = new RepositoryFactory(db);
    const systemRepository = repositoryFactory.getSystemRepository();

    // 获取基础统计数据
    const basicStats = await systemRepository.getDashboardStats();

    // 获取所有S3存储配置的使用情况
    const s3ConfigsWithUsage = await getS3ConfigsWithUsage(db);

    // 获取最近一周的趋势数据
    const weeklyTrends = await systemRepository.getWeeklyTrends();

    // 处理每日数据，补全缺失的日期
    const lastWeekPastes = processWeeklyData(weeklyTrends.pastes);
    const lastWeekFiles = processWeeklyData(weeklyTrends.files);

    // 总体存储使用情况
    const totalStorageUsed = s3ConfigsWithUsage.reduce((total, config) => total + (config.usage?.total_size || 0), 0);

    // 转换S3配置数据格式
    const s3Buckets = s3ConfigsWithUsage.map((config) => {
      const usedStorage = config.usage?.total_size || 0;
      const totalStorage = config.total_storage_bytes || 0;

      // 计算使用百分比
      const usagePercent = totalStorage > 0 ? Math.min(100, Math.round((usedStorage / totalStorage) * 100)) : 0;

      return {
        ...config,
        usedStorage,
        totalStorage,
        fileCount: config.usage?.file_count || 0, // 额外的文件数量信息
        usagePercent, // 个别存储桶的使用百分比
        providerType: config.provider_type,
      };
    });

    return {
      totalPastes: basicStats.totalPastes,
      totalFiles: basicStats.totalFiles,
      totalApiKeys: basicStats.totalApiKeys,
      totalS3Configs: basicStats.totalS3Configs,
      totalStorageUsed,
      s3Buckets,
      lastWeekPastes,
      lastWeekFiles,
    };
  } catch (error) {
    console.error("获取仪表盘统计数据失败:", error);
    throw new Error("获取仪表盘统计数据失败: " + error.message);
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
