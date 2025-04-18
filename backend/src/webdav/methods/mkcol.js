/**
 * 处理WebDAV MKCOL请求
 * 用于创建目录
 */
import { findMountPointByPath, normalizeS3SubPath, updateMountLastUsed, checkDirectoryExists } from "../utils/webdavUtils.js";
import { createS3Client } from "../../utils/s3Utils.js";
import { PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
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

    // 标记是否为根目录请求
    const isRootDir = !validS3SubPath || validS3SubPath === "";

    if (isRootDir) {
      // A. 根目录的处理 - 新版本，不创建特殊标记文件
      console.log(`WebDAV MKCOL: 检测到根目录请求，验证S3桶可访问性`);

      try {
        // 验证S3桶的可访问性 - 尝试列出根级别的前几个对象
        const listParams = {
          Bucket: s3Config.bucket_name,
          MaxKeys: 1, // 只需要验证是否可以列出对象
          // 不指定Prefix，这样会列出桶根级别的对象
        };

        // 尝试列出桶内容来验证访问权限
        await s3Client.send(new ListObjectsV2Command(listParams));
        console.log(`WebDAV MKCOL: 成功验证S3桶 ${s3Config.bucket_name} 的可访问性`);
      } catch (bucketError) {
        // 即使验证失败也继续，因为这可能只是因为桶为空或权限问题
        // 但第三方客户端只关心MKCOL请求成功与否
        console.warn(`WebDAV MKCOL: S3桶可访问性验证出现问题，但仍将返回成功状态: ${bucketError.message}`);
      }

      // 更新挂载点的最后使用时间
      await updateMountLastUsed(db, mount.id);

      // 对于根目录请求，直接返回成功状态码，不创建任何特殊标记文件
      return new Response(null, {
        status: 201, // Created
        headers: {
          "Content-Type": "text/plain",
          "Content-Length": "0",
        },
      });
    }

    // B. 子目录的处理
    // 检查目录是否已存在
    const dirExists = await checkDirectoryExists(s3Client, s3Config.bucket_name, validS3SubPath);

    if (dirExists) {
      // *** 核心修改点: 如果目录已存在，不返回405错误，而是返回成功
      console.log(`WebDAV MKCOL: 目录 ${validS3SubPath} 已存在，返回成功以支持第三方工具`);
      return new Response(null, {
        status: 201, // 返回201而不是405，让客户端认为操作成功了
        headers: {
          "Content-Type": "text/plain",
          "Content-Length": "0",
        },
      });
    }

    // 检查父目录是否存在
    if (validS3SubPath.includes("/")) {
      const parentPath = validS3SubPath.substring(0, validS3SubPath.lastIndexOf("/", validS3SubPath.length - 2) + 1);

      if (parentPath) {
        const parentExists = await checkDirectoryExists(s3Client, s3Config.bucket_name, parentPath);

        if (!parentExists) {
          // 原始代码返回409错误，但我们可以在这里尝试自动创建父目录，类似PUT的处理方式
          console.log(`MKCOL请求: 父目录 ${parentPath} 不存在，正在自动创建...`);

          try {
            // 创建一个空对象作为目录标记
            const createDirParams = {
              Bucket: s3Config.bucket_name,
              Key: parentPath,
              Body: "", // 空内容
              ContentType: "application/x-directory", // 目录内容类型
            };

            const createDirCommand = new PutObjectCommand(createDirParams);
            await s3Client.send(createDirCommand);
            console.log(`MKCOL请求: 已成功创建父目录 ${parentPath}`);
          } catch (dirError) {
            console.error(`MKCOL请求: 创建父目录 ${parentPath} 失败:`, dirError);
            return new Response("父目录不存在", { status: 409 }); // Conflict
          }
        }
      }
    }

    // 在S3中创建目录（通过创建一个空对象，键以斜杠结尾）
    const putParams = {
      Bucket: s3Config.bucket_name,
      Key: validS3SubPath, // 使用验证后的路径
      ContentLength: 0,
      Body: "",
      ContentType: "application/x-directory", // 目录内容类型
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
