/**
 * WebDAV缓存工具函数
 * 用于在WebDAV操作后清理目录缓存
 */
import { clearCacheForFilePath } from "../../utils/DirectoryCache.js";

/**
 * 在WebDAV操作后清理相关的目录缓存
 * @param {D1Database} db - D1数据库实例
 * @param {string} s3SubPath - S3中的子路径
 * @param {Object} s3Config - S3配置对象
 * @param {boolean} isDirectory - 是否为目录操作
 */
export async function clearCacheAfterWebDAVOperation(db, s3SubPath, s3Config, isDirectory = false) {
  try {
    if (!db || !s3SubPath || !s3Config || !s3Config.id) {
      console.warn("无法清理缓存，参数不完整");
      return;
    }

    // 对于目录操作，直接使用目录路径
    // 对于文件操作，需要获取文件的父目录路径
    let storagePath = s3SubPath;

    // 如果S3配置有默认文件夹，需要添加到存储路径前
    if (s3Config.default_folder) {
      const defaultFolder = s3Config.default_folder.endsWith("/") ? s3Config.default_folder : s3Config.default_folder + "/";
      storagePath = defaultFolder + storagePath;
    }

    // 调用DirectoryCache中的函数清理缓存
    await clearCacheForFilePath(db, storagePath, s3Config.id);

    console.log(`WebDAV操作后缓存已清理 - 路径: ${storagePath}, S3配置ID: ${s3Config.id}`);
  } catch (error) {
    // 记录错误但不抛出，避免影响主要操作
    console.error("WebDAV缓存清理错误:", error);
  }
}
