/**
 * 处理WebDAV DELETE请求
 * 用于删除文件或目录
 */
import { findMountPointByPath, normalizeS3SubPath, updateMountLastUsed, checkDirectoryExists } from "../utils/webdavUtils.js";
import { createS3Client } from "../../utils/s3Utils.js";
import { DeleteObjectCommand, ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";
import { clearCacheAfterWebDAVOperation } from "../utils/cacheUtils.js";

/**
 * 处理DELETE请求
 * @param {Object} c - Hono上下文
 * @param {string} path - 请求路径
 * @param {string} userId - 用户ID
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {D1Database} db - D1数据库实例
 */
export async function handleDelete(c, path, userId, userType, db) {
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

    const { mount, subPath } = mountResult;

    // 提取挂载点路径部分和子路径部分
    const pathParts = path.split("/").filter((p) => p);

    // 不允许删除挂载点根目录
    if (pathParts.length === 1) {
      return new Response("不能删除挂载点根目录", {
        status: 405, // Method Not Allowed
        headers: { "Content-Type": "text/plain" },
      });
    }

    // 获取挂载点对应的S3配置
    const s3Config = await db.prepare("SELECT * FROM s3_configs WHERE id = ?").bind(mount.storage_config_id).first();

    if (!s3Config) {
      return new Response("存储配置不存在", { status: 404 });
    }

    // 创建S3客户端
    const s3Client = await createS3Client(s3Config, c.env.ENCRYPTION_SECRET);

    // 判断是否为目录路径（以斜杠结尾）
    const isDirectory = path.endsWith("/");

    // 规范化S3子路径
    const s3SubPath = normalizeS3SubPath(subPath, s3Config, isDirectory);

    if (isDirectory) {
      // 目录删除 - 需要先列出目录中的所有对象
      // 先检查目录是否存在
      const dirExists = await checkDirectoryExists(s3Client, s3Config.bucket_name, s3SubPath);

      if (!dirExists) {
        return new Response("目录不存在", { status: 404 });
      }

      // 列出目录中的所有对象
      const listParams = {
        Bucket: s3Config.bucket_name,
        Prefix: s3SubPath,
      };

      const listCommand = new ListObjectsV2Command(listParams);
      const listResponse = await s3Client.send(listCommand);

      // 删除目录下所有对象
      if (listResponse.Contents && listResponse.Contents.length > 0) {
        for (const item of listResponse.Contents) {
          const deleteParams = {
            Bucket: s3Config.bucket_name,
            Key: item.Key,
          };

          const deleteCommand = new DeleteObjectCommand(deleteParams);
          await s3Client.send(deleteCommand);
        }
      }

      // 清理缓存 - 对于目录操作，应清理该目录的缓存
      await clearCacheAfterWebDAVOperation(db, s3SubPath, s3Config, true);
    } else {
      // 文件删除 - 检查文件是否存在
      try {
        const headParams = {
          Bucket: s3Config.bucket_name,
          Key: s3SubPath,
        };

        const headCommand = new HeadObjectCommand(headParams);
        await s3Client.send(headCommand);
      } catch (error) {
        if (error.$metadata && error.$metadata.httpStatusCode === 404) {
          return new Response("文件不存在", { status: 404 });
        }
        throw error;
      }

      // 删除文件
      const deleteParams = {
        Bucket: s3Config.bucket_name,
        Key: s3SubPath,
      };

      const deleteCommand = new DeleteObjectCommand(deleteParams);
      await s3Client.send(deleteCommand);

      // 清理缓存 - 对于文件操作，应清理文件所在目录的缓存
      await clearCacheAfterWebDAVOperation(db, s3SubPath, s3Config, false);
    }

    // 更新挂载点的最后使用时间
    await updateMountLastUsed(db, mount.id);

    // 返回成功响应
    return new Response(null, {
      status: 204, // No Content
      headers: {
        "Content-Type": "text/plain",
        "Content-Length": "0",
      },
    });
  } catch (error) {
    console.error("DELETE请求处理错误:", error);
    // 特殊处理404错误
    if (error.$metadata && error.$metadata.httpStatusCode === 404) {
      return new Response("文件或目录不存在", { status: 404 });
    }

    // 生成唯一错误ID用于日志追踪
    const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    console.error(`DELETE错误详情[${errorId}]:`, error);

    // 对外部仅返回通用错误信息和错误ID，不暴露具体错误
    return new Response(`内部服务器错误 (错误ID: ${errorId})`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
