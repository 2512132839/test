/**
 * 系统管理服务API
 * 统一管理所有系统相关的API调用，包括系统设置、仪表盘统计等
 */

import { get, post, put } from "../client";

/******************************************************************************
 * 系统设置API
 ******************************************************************************/

/**
 * 获取系统设置
 * @returns {Promise<Object>} 系统设置响应
 */
export function getSystemSettings() {
  return get("/admin/system-settings");
}

/**
 * 更新系统设置
 * @param {Object} settings - 要更新的设置
 * @param {number} [settings.max_upload_size] - 最大上传大小(MB)，前端可能会根据不同单位(KB/MB/GB)转换后再传入
 * @returns {Promise<Object>} 更新结果
 */
export function updateSystemSettings(settings) {
  return put("/admin/system-settings", settings);
}

/**
 * 获取代理签名设置
 * @returns {Promise<Object>} 代理签名设置响应
 */
export function getProxySignSettings() {
  return get("/admin/proxy-sign-settings");
}

/**
 * 更新代理签名设置
 * @param {Object} settings - 代理签名设置
 * @param {boolean} settings.signAll - 是否签名所有
 * @param {number} settings.expires - 签名过期时间（秒）
 * @returns {Promise<Object>} 更新结果
 */
export function updateProxySignSettings(settings) {
  return post("/admin/proxy-sign-settings", settings);
}

/******************************************************************************
 * 仪表盘统计API
 ******************************************************************************/

/**
 * 获取仪表盘统计数据
 * @returns {Promise<Object>} 包含文本和文件数量及存储空间使用情况的统计数据
 */
export function getDashboardStats() {
  return get("/admin/dashboard/stats");
}

/******************************************************************************
 * 系统信息API
 ******************************************************************************/

/**
 * 获取系统最大上传大小限制
 * @returns {Promise<number>} 最大上传大小(MB)
 */
export async function getMaxUploadSize() {
  try {
    const response = await get("system/max-upload-size");
    if (response && response.data && response.data.max_upload_size) {
      return response.data.max_upload_size;
    }
    return 100; // 默认值
  } catch (error) {
    console.error("获取最大上传大小失败:", error);
    return 100; // 出错时返回默认值
  }
}

/******************************************************************************
 * 系统维护API
 ******************************************************************************/

/**
 * 清理所有过期的文本分享（仅管理员）
 * @returns {Promise<Object>} 清理结果
 */
export function clearExpiredPastes() {
  return post("/admin/pastes/clear-expired", { clearExpired: true });
}

/**
 * 清理目录缓存（管理员）
 * @param {Object} options - 清理选项
 * @param {string} [options.mountId] - 要清理的挂载点ID
 * @param {string} [options.s3ConfigId] - S3配置ID
 * @returns {Promise<Object>} 清理结果
 */
export function clearCacheAdmin(options = {}) {
  return post("/admin/cache/clear", options);
}

/**
 * 清理目录缓存（API密钥用户）
 * @param {Object} options - 清理选项
 * @param {string} [options.mountId] - 要清理的挂载点ID
 * @param {string} [options.s3ConfigId] - S3配置ID
 * @returns {Promise<Object>} 清理结果
 */
export function clearCacheUser(options = {}) {
  return post("/user/cache/clear", options);
}

/**
 * 获取缓存统计信息
 * @returns {Promise<Object>} 缓存统计数据
 */
export function getCacheStats() {
  return get("/admin/cache/stats");
}

/**
 * 系统健康检查
 * @returns {Promise<Object>} 健康检查结果
 */
export function healthCheck() {
  return get("/health");
}

/**
 * 获取系统版本信息
 * @returns {Promise<Object>} 版本信息
 */
export function getVersionInfo() {
  return get("/version");
}
