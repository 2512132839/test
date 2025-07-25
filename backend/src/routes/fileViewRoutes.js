import { Hono } from "hono";
import { RepositoryFactory } from "../repositories/index.js";
import { verifyPassword } from "../utils/crypto.js";
import { generatePresignedUrl, deleteFileFromS3 } from "../utils/s3Utils.js";
import { DbTables } from "../constants/index.js";

const app = new Hono();
import {
  getMimeTypeGroup,
  MIME_GROUPS,
  isImageType,
  isVideoType,
  isAudioType,
  isDocumentType,
  isConfigType,
  getMimeTypeAndGroupFromFile,
  shouldUseTextPlainForPreview,
  getContentTypeAndDisposition,
  isOfficeFile,
} from "../utils/fileUtils.js";

/**
 * 从数据库获取文件信息
 * @param {D1Database} db - D1数据库实例
 * @param {string} slug - 文件的slug
 * @param {boolean} includePassword - 是否包含密码
 * @returns {Promise<Object|null>} 文件信息或null
 */
async function getFileBySlug(db, slug, includePassword = true) {
  // 使用 FileRepository 获取文件信息
  const repositoryFactory = new RepositoryFactory(db);
  const fileRepository = repositoryFactory.getFileRepository();

  const file = await fileRepository.findBySlug(slug);

  // 如果不需要密码字段，移除密码字段
  if (!includePassword && file) {
    const { password, ...fileWithoutPassword } = file;
    return fileWithoutPassword;
  }

  return file;
}

/**
 * 检查文件是否可访问
 * @param {D1Database} db - D1数据库实例
 * @param {Object} file - 文件对象
 * @param {string} encryptionSecret - 加密密钥
 * @returns {Promise<Object>} 包含是否可访问及原因的对象
 */
async function isFileAccessible(db, file, encryptionSecret) {
  if (!file) {
    return { accessible: false, reason: "not_found" };
  }

  // 检查文件是否过期
  if (file.expires_at) {
    const now = new Date().toISOString();
    if (file.expires_at < now) {
      // 文件已过期，执行删除
      await checkAndDeleteExpiredFile(db, file, encryptionSecret);
      return { accessible: false, reason: "expired" };
    }
  }

  // 检查最大查看次数
  if (file.max_views && file.max_views > 0 && file.views > file.max_views) {
    // 已超过最大查看次数，执行删除
    await checkAndDeleteExpiredFile(db, file, encryptionSecret);
    return { accessible: false, reason: "max_views" };
  }

  return { accessible: true };
}

/**
 * 检查并删除过期文件
 * @param {D1Database} db - D1数据库实例
 * @param {Object} file - 文件对象
 * @param {string} encryptionSecret - 加密密钥
 * @returns {Promise<boolean>} 是否已删除
 */
async function checkAndDeleteExpiredFile(db, file, encryptionSecret) {
  try {
    if (!file) return false;

    let isExpired = false;
    const now = new Date();

    // 检查是否过期 - 使用字符串比较更准确
    if (file.expires_at && file.expires_at < now.toISOString()) {
      isExpired = true;
    }

    // 检查是否超过最大查看次数
    if (file.max_views && file.max_views > 0 && file.views > file.max_views) {
      isExpired = true;
    }

    // 如果已过期，尝试删除
    if (isExpired) {
      // 如果是S3存储类型，尝试从S3删除
      if (file.storage_type === "S3" && file.storage_config_id && file.storage_path) {
        const repositoryFactory = new RepositoryFactory(db);
        const s3ConfigRepository = repositoryFactory.getS3ConfigRepository();

        const s3Config = (await s3ConfigRepository.findByIdAndAdminWithSecrets(file.storage_config_id, null)) || (await s3ConfigRepository.findById(file.storage_config_id));
        if (s3Config) {
          try {
            await deleteFileFromS3(s3Config, file.storage_path, encryptionSecret);
          } catch (error) {
            console.error("从S3删除过期文件失败:", error);
            // 即使S3删除失败，仍继续数据库删除
          }
        }
      }

      // 使用 FileRepository 从数据库删除文件记录
      const repositoryFactory = new RepositoryFactory(db);
      const fileRepository = repositoryFactory.getFileRepository();
      await fileRepository.deleteFile(file.id);

      console.log(`文件(${file.id})已过期或超过最大查看次数，已删除`);
      return true;
    }

    return false;
  } catch (error) {
    console.error("检查和删除过期文件出错:", error);
    return false;
  }
}

/**
 * 增加文件查看次数并检查是否超过限制
 * @param {D1Database} db - D1数据库实例
 * @param {Object} file - 文件对象
 * @param {string} encryptionSecret - 加密密钥
 * @returns {Promise<Object>} 包含更新后的文件信息和状态
 */
async function incrementAndCheckFileViews(db, file, encryptionSecret) {
  // 使用 FileRepository 递增访问计数
  const repositoryFactory = new RepositoryFactory(db);
  const fileRepository = repositoryFactory.getFileRepository();

  await fileRepository.incrementViews(file.id);

  // 重新获取更新后的文件信息（包含存储配置）
  const updatedFile = await fileRepository.findByIdWithStorageConfig(file.id);

  // 检查是否超过最大访问次数
  if (updatedFile.max_views && updatedFile.max_views > 0 && updatedFile.views > updatedFile.max_views) {
    // 已超过最大查看次数，执行删除
    await checkAndDeleteExpiredFile(db, updatedFile, encryptionSecret);
    return {
      isExpired: true,
      reason: "max_views",
      file: updatedFile,
    };
  }

  return {
    isExpired: false,
    file: updatedFile,
  };
}

/**
 * 处理文件下载请求
 * @param {string} slug - 文件slug
 * @param {Object} env - 环境变量
 * @param {Request} request - 原始请求
 * @param {boolean} forceDownload - 是否强制下载
 * @returns {Promise<Response>} 响应对象
 */
async function handleFileDownload(slug, env, request, forceDownload = false) {
  const db = env.DB;
  const encryptionSecret = env.ENCRYPTION_SECRET || "default-encryption-key";

  try {
    // 查询文件详情
    const file = await getFileBySlug(db, slug);

    // 检查文件是否存在
    if (!file) {
      return new Response("文件不存在", { status: 404 });
    }

    // 检查文件是否受密码保护
    if (file.password) {
      // 如果有密码，检查URL中是否包含密码参数
      const url = new URL(request.url);
      const passwordParam = url.searchParams.get("password");

      if (!passwordParam) {
        return new Response("需要密码访问此文件", { status: 401 });
      }

      // 验证密码
      const passwordValid = await verifyPassword(passwordParam, file.password);
      if (!passwordValid) {
        return new Response("密码错误", { status: 403 });
      }
    }

    // 检查文件是否可访问
    const accessCheck = await isFileAccessible(db, file, encryptionSecret);
    if (!accessCheck.accessible) {
      if (accessCheck.reason === "expired") {
        return new Response("文件已过期", { status: 410 });
      }
      return new Response("文件不可访问", { status: 403 });
    }

    // 文件预览和下载端点默认不增加访问计数

    let result = { isExpired: false, file };

    // 如果文件已到达最大访问次数限制
    if (result.isExpired) {
      // 这里已经在incrementAndCheckFileViews函数中尝试删除了文件，但为确保删除成功，再次检查文件是否还存在
      console.log(`文件(${file.id})已达到最大查看次数，准备删除...`);
      try {
        // 使用 FileRepository 再次检查文件是否被成功删除
        const repositoryFactory = new RepositoryFactory(db);
        const fileRepository = repositoryFactory.getFileRepository();

        const fileStillExists = await fileRepository.findById(file.id);
        if (fileStillExists) {
          console.log(`文件(${file.id})仍然存在，再次尝试删除...`);
          await checkAndDeleteExpiredFile(db, result.file, encryptionSecret);
        }
      } catch (error) {
        console.error(`尝试再次删除文件(${file.id})时出错:`, error);
      }
      return new Response("文件已达到最大查看次数", { status: 410 });
    }

    // 检查文件存储信息
    if (!result.file.storage_config_id || !result.file.storage_path || !result.file.storage_type) {
      return new Response("文件存储信息不完整", { status: 404 });
    }

    // 根据存储类型获取配置
    if (result.file.storage_type !== "S3") {
      return new Response("暂不支持此存储类型的预览", { status: 501 });
    }

    // 获取S3配置
    const repositoryFactory = new RepositoryFactory(db);
    const s3ConfigRepository = repositoryFactory.getS3ConfigRepository();
    const s3Config = await s3ConfigRepository.findById(result.file.storage_config_id);
    if (!s3Config) {
      return new Response("无法获取存储配置信息", { status: 500 });
    }

    try {
      // 获取文件名
      const filename = result.file.filename;

      // 使用fileUtils中的getMimeTypeAndGroupFromFile函数获取正确的MIME类型和分组
      const {
        mimeType: contentType,
        mimeGroup,
        wasRefined,
      } = getMimeTypeAndGroupFromFile({
        filename,
        mimetype: result.file.mimetype,
      });

      // 判断文件是否为Office文件类型
      const isOffice = isOfficeFile(contentType, filename);

      // Office文件特殊处理：如果是预览请求（非强制下载），重定向到Office在线预览服务
      if (isOffice && !forceDownload) {
        // 获取URL中的密码参数（如果有）
        const url = new URL(request.url);
        const passwordParam = url.searchParams.get("password");

        // 构建Office预览API调用的URL参数
        let apiUrl = `/api/office-preview/${slug}`;
        if (passwordParam) {
          apiUrl += `?password=${encodeURIComponent(passwordParam)}`;
        }

        // 创建内部请求以获取Office预览URL
        const internalRequest = new Request(`${url.origin}${apiUrl}`);
        const response = await fetch(internalRequest);

        // 如果请求失败，返回错误
        if (!response.ok) {
          const errorData = await response.json();
          return new Response(errorData.error || "获取Office预览URL失败", { status: response.status });
        }

        // 解析响应获取直接URL
        const data = await response.json();
        if (!data.url) {
          return new Response("无法获取Office预览URL", { status: 500 });
        }

        // 生成Microsoft Office在线预览URL
        const encodedUrl = encodeURIComponent(data.url);
        const officePreviewUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodedUrl}`;

        // 返回重定向到Microsoft预览服务
        return new Response(null, {
          status: 302, // 临时重定向
          headers: {
            Location: officePreviewUrl,
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // 生成预签名URL，使用S3配置的默认时效，传递MIME类型以确保正确的Content-Type
      // 注意：文件分享页面没有用户上下文，禁用缓存避免权限泄露
      const presignedUrl = await generatePresignedUrl(s3Config, result.file.storage_path, encryptionSecret, null, forceDownload, contentType, { enableCache: false });

      //处理Range请求
      const rangeHeader = request.headers.get("Range");
      const fileRequestHeaders = {};

      // 如果有Range请求，转发给S3
      if (rangeHeader) {
        fileRequestHeaders["Range"] = rangeHeader;
        console.log(`🎬 代理Range请求: ${rangeHeader}`);
      }

      // 代理请求到实际的文件URL
      const fileRequest = new Request(presignedUrl, {
        headers: fileRequestHeaders,
      });
      const response = await fetch(fileRequest);

      // 创建一个新的响应，包含正确的文件名和Content-Type
      const headers = new Headers();

      // 复制原始响应的所有头信息
      for (const [key, value] of response.headers.entries()) {
        // 排除我们将要自定义的头
        if (!["content-disposition", "content-type", "access-control-allow-origin"].includes(key.toLowerCase())) {
          headers.set(key, value);
        }
      }

      // 设置CORS头，允许所有源访问，支持Range请求
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type, Content-Disposition, Range");
      headers.set("Access-Control-Expose-Headers", "Content-Type, Content-Disposition, Content-Length, Content-Range, Accept-Ranges");

      // 🎯 添加Accept-Ranges头，告诉客户端支持Range请求
      headers.set("Accept-Ranges", "bytes");

      // 使用统一的内容类型和处置方式函数
      const { contentType: finalContentType, contentDisposition } = getContentTypeAndDisposition({
        filename,
        mimetype: contentType,
        forceDownload,
      });

      // 设置Content-Type和Content-Disposition
      headers.set("Content-Type", finalContentType);
      headers.set("Content-Disposition", contentDisposition);

      // 对HTML文件添加安全头部
      if (finalContentType.includes("text/html")) {
        headers.set("X-XSS-Protection", "1; mode=block");
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("Content-Security-Policy", "default-src 'self'; img-src * data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline';");
      }

      // 打印日志，便于调试
      console.log(`Worker代理模式：文件[${filename}]，最终内容类型[${finalContentType}]，内容处置[${contentDisposition}]`);

      // 返回响应
      return new Response(response.body, {
        status: response.status,
        headers: headers,
      });
    } catch (error) {
      console.error("代理文件下载出错:", error);
      return new Response("获取文件失败: " + error.message, { status: 500 });
    }
  } catch (error) {
    console.error("处理文件下载错误:", error);
    return new Response("服务器处理错误: " + error.message, { status: 500 });
  }
}

// 处理API路径下的文件下载请求 /api/file-download/:slug
app.get("/api/file-download/:slug", async (c) => {
  const slug = c.req.param("slug");
  return await handleFileDownload(slug, c.env, c.req.raw, true); // 强制下载
});

// 处理API路径下的文件预览请求 /api/file-view/:slug
app.get("/api/file-view/:slug", async (c) => {
  const slug = c.req.param("slug");
  return await handleFileDownload(slug, c.env, c.req.raw, false); // 预览
});

// 处理Office文件直接预览URL请求 /api/office-preview/:slug
app.get("/api/office-preview/:slug", async (c) => {
  const slug = c.req.param("slug");
  const db = c.env.DB;
  const encryptionSecret = c.env.ENCRYPTION_SECRET || "default-encryption-key";

  try {
    // 查询文件详情
    const file = await getFileBySlug(db, slug);

    // 检查文件是否存在
    if (!file) {
      return c.json({ error: "文件不存在" }, 404);
    }

    // 检查文件是否受密码保护
    if (file.password) {
      // 如果有密码，检查URL中是否包含密码参数
      const url = new URL(c.req.url);
      const passwordParam = url.searchParams.get("password");

      if (!passwordParam) {
        return c.json({ error: "需要密码访问此文件" }, 401);
      }

      // 验证密码
      const passwordValid = await verifyPassword(passwordParam, file.password);
      if (!passwordValid) {
        return c.json({ error: "密码错误" }, 403);
      }
    }

    // 检查文件是否可访问
    const accessCheck = await isFileAccessible(db, file, encryptionSecret);
    if (!accessCheck.accessible) {
      if (accessCheck.reason === "expired") {
        return c.json({ error: "文件已过期" }, 410);
      }
      return c.json({ error: "文件不可访问" }, 403);
    }

    // 检查文件是否为Office文件
    const isOffice = isOfficeFile(file.mimetype, file.filename);
    if (!isOffice) {
      return c.json({ error: "不是Office文件类型" }, 400);
    }

    // 检查文件存储信息
    if (!file.storage_config_id || !file.storage_path || !file.storage_type) {
      return c.json({ error: "文件存储信息不完整" }, 404);
    }

    // 检查存储类型
    if (file.storage_type !== "S3") {
      return c.json({ error: "暂不支持此存储类型的Office预览" }, 501);
    }

    // 获取S3配置
    const repositoryFactory = new RepositoryFactory(db);
    const s3ConfigRepository = repositoryFactory.getS3ConfigRepository();
    const s3Config = await s3ConfigRepository.findById(file.storage_config_id);
    if (!s3Config) {
      return c.json({ error: "无法获取存储配置信息" }, 500);
    }

    // 计算访问次数（暂不增加计数器，因为这只是获取URL）
    // 但需要考虑已有的访问次数
    if (file.max_views && file.max_views > 0 && file.views >= file.max_views) {
      return c.json({ error: "文件已达到最大查看次数" }, 410);
    }

    try {
      // Office预览使用S3配置的默认时效
      // 生成临时预签名URL，适用于Office预览
      // 注意：Office预览没有用户上下文，禁用缓存避免权限泄露
      const presignedUrl = await generatePresignedUrl(s3Config, file.storage_path, encryptionSecret, null, false, file.mimetype, { enableCache: false });

      // 返回直接访问URL
      return c.json({
        url: presignedUrl,
        filename: file.filename,
        mimetype: file.mimetype,
        expires_in: s3Config.signature_expires_in || 3600,
        is_temporary: true,
      });
    } catch (error) {
      console.error("生成Office预览URL出错:", error);
      return c.json({ error: "生成预览URL失败: " + error.message }, 500);
    }
  } catch (error) {
    console.error("处理Office预览URL请求错误:", error);
    return c.json({ error: "服务器处理错误: " + error.message }, 500);
  }
});

// 导出handleFileDownload函数和checkAndDeleteExpiredFile函数
export { handleFileDownload, checkAndDeleteExpiredFile };

export default app;
