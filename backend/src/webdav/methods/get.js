/**
 * 处理WebDAV GET请求
 * 用于获取文件内容
 */
import { findMountPointByPath, normalizeS3SubPath, updateMountLastUsed } from "../utils/webdavUtils.js";
import { createS3Client } from "../../utils/s3Utils.js";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { handleWebDAVError, createWebDAVErrorResponse } from "../utils/errorUtils.js";

/**
 * 处理GET请求
 * @param {Object} c - Hono上下文
 * @param {string} path - 请求路径
 * @param {string} userId - 用户ID
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {D1Database} db - D1数据库实例
 */
export async function handleGet(c, path, userId, userType, db) {
  const isHead = c.req.method === "HEAD";

  try {
    // 使用统一函数查找挂载点
    const mountResult = await findMountPointByPath(db, path, userId, userType);

    // 处理错误情况
    if (mountResult.error) {
      return createWebDAVErrorResponse(mountResult.error.message, mountResult.error.status);
    }

    const { mount, subPath } = mountResult;

    // 获取挂载点对应的S3配置
    const s3Config = await db.prepare("SELECT * FROM s3_configs WHERE id = ?").bind(mount.storage_config_id).first();

    if (!s3Config) {
      return createWebDAVErrorResponse("存储配置不存在", 404);
    }

    // 创建S3客户端
    const s3Client = await createS3Client(s3Config, c.env.ENCRYPTION_SECRET);

    // 规范化S3子路径 (文件不添加斜杠)
    const s3SubPath = normalizeS3SubPath(subPath, s3Config, false);

    // 更新最后使用时间
    await updateMountLastUsed(db, mount.id);

    // 检查对象是否存在
    try {
      const headParams = {
        Bucket: s3Config.bucket_name,
        Key: s3SubPath,
      };

      const headCommand = new HeadObjectCommand(headParams);
      const headResponse = await s3Client.send(headCommand);

      // 如果是HEAD请求，返回头信息
      if (isHead) {
        return new Response(null, {
          status: 200,
          headers: {
            "Content-Length": String(headResponse.ContentLength || 0),
            "Content-Type": headResponse.ContentType || "application/octet-stream",
            "Last-Modified": headResponse.LastModified ? headResponse.LastModified.toUTCString() : new Date().toUTCString(),
            ETag: headResponse.ETag || "",
            "Accept-Ranges": "bytes",
          },
        });
      }

      // 获取文件内容
      const getParams = {
        Bucket: s3Config.bucket_name,
        Key: s3SubPath,
      };

      // 处理Range请求
      const rangeHeader = c.req.header("Range");
      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (match) {
          const start = parseInt(match[1], 10);
          const end = match[2] ? parseInt(match[2], 10) : undefined;

          if (!isNaN(start)) {
            getParams.Range = `bytes=${start}-${end !== undefined ? end : ""}`;
          }
        }
      }

      const getCommand = new GetObjectCommand(getParams);
      const getResponse = await s3Client.send(getCommand);

      // 构建响应头
      const headers = {
        "Content-Type": getResponse.ContentType || "application/octet-stream",
        "Content-Length": String(getResponse.ContentLength || 0),
        "Last-Modified": getResponse.LastModified ? getResponse.LastModified.toUTCString() : new Date().toUTCString(),
        ETag: getResponse.ETag || "",
        "Accept-Ranges": "bytes",
      };

      // 处理分片响应
      if (getResponse.ContentRange) {
        headers["Content-Range"] = getResponse.ContentRange;
        return new Response(getResponse.Body, {
          status: 206, // Partial Content
          headers,
        });
      }

      // 处理完整响应
      return new Response(getResponse.Body, {
        status: 200,
        headers,
      });
    } catch (error) {
      if (error.$metadata && error.$metadata.httpStatusCode === 404) {
        return createWebDAVErrorResponse("文件不存在", 404);
      }
      throw error;
    }
  } catch (error) {
    // 使用统一的错误处理
    return handleWebDAVError("GET", error);
  }
}
