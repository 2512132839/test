/**
 * 处理WebDAV MKCOL请求
 * 用于创建目录
 */
import { findMountPointByPath, normalizeS3SubPath, updateMountLastUsed, checkDirectoryExists } from "../utils/webdavUtils.js";
import { createS3Client } from "../../utils/s3Utils.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { clearCacheAfterWebDAVOperation } from "../utils/cacheUtils.js";

/**
 * 处理MKCOL请求
 * @param {Object} c - Hono上下文
 * @param {string} path - 请求路径
 * @param {string} userId - 用户ID
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {D1Database} db - D1数据库实例
 */
export async function handleMkcol(c, path, userId, userType, db) {
  try {
    // 使用统一函数查找挂载点
    const mountResult = await findMountPointByPath(db, path, userId, userType);

    // 处理错误情况
    if (mountResult.error) {
      return new Response(mountResult.error.message, {
        status: mountResult.error.status,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // 检查请求是否包含正文（MKCOL请求不应包含正文）
    const body = await c.req.text();
    if (body.length > 0) {
      return new Response("MKCOL请求不应包含正文", {
        status: 415, // Unsupported Media Type
        headers: { "Content-Type": "text/plain" },
      });
    }

    const { mount, subPath } = mountResult;

    // 获取挂载点对应的S3配置
    const s3Config = await db.prepare("SELECT * FROM s3_configs WHERE id = ?").bind(mount.storage_config_id).first();

    if (!s3Config) {
      return new Response("存储配置不存在", { status: 404 });
    }

    // 创建S3客户端
    const s3Client = await createS3Client(s3Config, c.env.ENCRYPTION_SECRET);

    // 规范化S3子路径（确保以斜杠结尾，表示目录）
    const s3SubPath = normalizeS3SubPath(subPath, s3Config, true);

    // 验证S3子路径，确保不为空
    // 防止空Key值导致的"Empty value provided for input HTTP label: Key"错误
    let validS3SubPath = s3SubPath;
    if (!validS3SubPath || validS3SubPath === "") {
      // 如果路径为空，使用根目录标记
      validS3SubPath = "_MARK_ROOT_DONT_DELETE_ME/";
      console.log(`WebDAV MKCOL: 检测到空路径，使用默认值 "${validS3SubPath}"`);
    }

    // 检查目录是否已存在
    const dirExists = await checkDirectoryExists(s3Client, s3Config.bucket_name, validS3SubPath);

    if (dirExists) {
      return new Response("目录已存在", { status: 405 }); // Method Not Allowed
    }

    // 检查父目录是否存在
    if (validS3SubPath.includes("/")) {
      const parentPath = validS3SubPath.substring(0, validS3SubPath.lastIndexOf("/", validS3SubPath.length - 2) + 1);

      if (parentPath) {
        const parentExists = await checkDirectoryExists(s3Client, s3Config.bucket_name, parentPath);

        if (!parentExists) {
          return new Response("父目录不存在", { status: 409 }); // Conflict
        }
      }
    }

    // 在S3中创建目录（通过创建一个空对象，键以斜杠结尾）
    const putParams = {
      Bucket: s3Config.bucket_name,
      Key: validS3SubPath, // 使用验证后的路径
      ContentLength: 0,
      Body: "",
    };

    const putCommand = new PutObjectCommand(putParams);
    await s3Client.send(putCommand);

    // 清理缓存 - 对于创建目录操作，应清理该目录及父目录的缓存
    await clearCacheAfterWebDAVOperation(db, validS3SubPath, s3Config, true);

    // 更新挂载点的最后使用时间
    await updateMountLastUsed(db, mount.id);

    // 返回成功响应
    return new Response(null, {
      status: 201, // Created
      headers: {
        "Content-Type": "text/plain",
        "Content-Length": "0",
      },
    });
  } catch (error) {
    console.error("MKCOL请求处理错误:", error);
    // 生成唯一错误ID用于日志追踪
    const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    console.error(`MKCOL错误详情[${errorId}]:`, error);

    // 对外部仅返回通用错误信息和错误ID，不暴露具体错误
    return new Response(`内部服务器错误 (错误ID: ${errorId})`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
