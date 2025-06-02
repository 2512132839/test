/**
 * WebDAV缓存工具函数
 * 用于在WebDAV操作后清理目录缓存
 */
import { clearCache } from "../../utils/DirectoryCache.js";

/**
 * 在WebDAV操作后清理相关的目录缓存
 * @param {D1Database} db - D1数据库实例
 * @param {string} s3SubPath - S3中的子路径
 * @param {Object} s3Config - S3配置对象
 * @param {boolean} isDirectory - 是否为目录操作
 */
export async function clearCacheAfterWebDAVOperation(db, s3SubPath, s3Config, isDirectory = false) {
  try {
    if (!db || !s3Config || !s3Config.id) {
      console.warn("无法清理缓存，参数不完整");
      return;
    }

    // 调用统一的clearCache函数清理缓存
    // 对于WebDAV操作，清理整个挂载点的缓存以确保一致性
    await clearCache({ db, s3ConfigId: s3Config.id });

    console.log(`WebDAV操作后缓存已清理 - S3配置ID: ${s3Config.id}, 路径: ${s3SubPath}`);
  } catch (error) {
    // 记录错误但不抛出，避免影响主要操作
    console.error("WebDAV缓存清理错误:", error);
  }
}
