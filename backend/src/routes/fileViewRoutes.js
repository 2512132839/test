import { DbTables } from "../constants/index.js";
import { verifyPassword } from "../utils/crypto.js";
import { generatePresignedUrl, deleteFileFromS3 } from "../utils/s3Utils.js";

/**
 * 从数据库获取文件信息
 * @param {D1Database} db - D1数据库实例
 * @param {string} slug - 文件的slug
 * @param {boolean} includePassword - 是否包含密码
 * @returns {Promise<Object|null>} 文件信息或null
 */
async function getFileBySlug(db, slug, includePassword = true) {
  const fields = includePassword
    ? "f.id, f.filename, f.storage_path, f.s3_url, f.mimetype, f.size, f.remark, f.password, f.max_views, f.views, f.expires_at, f.created_at, f.s3_config_id, f.created_by, f.use_proxy, f.slug"
    : "f.id, f.filename, f.storage_path, f.s3_url, f.mimetype, f.size, f.remark, f.max_views, f.views, f.expires_at, f.created_at, f.s3_config_id, f.created_by, f.use_proxy, f.slug";

  return await db
    .prepare(
      `
      SELECT ${fields}
      FROM ${DbTables.FILES} f
      WHERE f.slug = ?
    `
    )
    .bind(slug)
    .first();
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
  if (file.expires_at && new Date(file.expires_at) < new Date()) {
    // 文件已过期，执行删除
    await checkAndDeleteExpiredFile(db, file, encryptionSecret);
    return { accessible: false, reason: "expired" };
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

    // 检查是否过期
    if (file.expires_at && new Date(file.expires_at) < now) {
      isExpired = true;
    }

    // 检查是否超过最大查看次数
    if (file.max_views && file.max_views > 0 && file.views > file.max_views) {
      isExpired = true;
    }

    // 如果已过期，尝试删除
    if (isExpired) {
      // 如果有S3配置，尝试从S3删除
      if (file.s3_config_id && file.storage_path) {
        const s3Config = await db.prepare(`SELECT * FROM ${DbTables.S3_CONFIGS} WHERE id = ?`).bind(file.s3_config_id).first();
        if (s3Config) {
          try {
            await deleteFileFromS3(s3Config, file.storage_path, encryptionSecret);
          } catch (error) {
            console.error("从S3删除过期文件失败:", error);
            // 即使S3删除失败，仍继续数据库删除
          }
        }
      }

      // 从数据库删除文件记录
      await db.prepare(`DELETE FROM ${DbTables.FILES} WHERE id = ?`).bind(file.id).run();

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
  // 首先递增访问计数
  await db.prepare(`UPDATE ${DbTables.FILES} SET views = views + 1, updated_at = ? WHERE id = ?`).bind(new Date().toISOString(), file.id).run();

  // 重新获取更新后的文件信息
  const updatedFile = await db
    .prepare(
      `
      SELECT 
        f.id, f.filename, f.storage_path, f.s3_url, f.mimetype, f.size, 
        f.remark, f.password, f.max_views, f.views, f.created_by,
        f.expires_at, f.created_at, f.s3_config_id, f.use_proxy, f.slug
      FROM ${DbTables.FILES} f
      WHERE f.id = ?
    `
    )
    .bind(file.id)
    .first();

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
        // 再次检查文件是否被成功删除，如果没有则再次尝试删除
        const fileStillExists = await db.prepare(`SELECT id FROM ${DbTables.FILES} WHERE id = ?`).bind(file.id).first();
        if (fileStillExists) {
          console.log(`文件(${file.id})仍然存在，再次尝试删除...`);
          await checkAndDeleteExpiredFile(db, result.file, encryptionSecret);
        }
      } catch (error) {
        console.error(`尝试再次删除文件(${file.id})时出错:`, error);
      }
      return new Response("文件已达到最大查看次数", { status: 410 });
    }

    // 如果没有S3配置或存储路径，则返回404
    if (!result.file.s3_config_id || !result.file.storage_path) {
      return new Response("文件存储信息不完整", { status: 404 });
    }

    // 获取S3配置
    const s3Config = await db.prepare(`SELECT * FROM ${DbTables.S3_CONFIGS} WHERE id = ?`).bind(result.file.s3_config_id).first();
    if (!s3Config) {
      return new Response("无法获取存储配置信息", { status: 500 });
    }

    try {
      // 生成预签名URL，有效期1小时
      const presignedUrl = await generatePresignedUrl(s3Config, result.file.storage_path, encryptionSecret, 3600, forceDownload);

      // 准备文件名和内容类型
      const filename = result.file.filename;
      const contentType = result.file.mimetype || "application/octet-stream";

      // 代理请求到实际的文件URL
      const fileRequest = new Request(presignedUrl);
      const response = await fetch(fileRequest);

      // 创建一个新的响应，包含正确的文件名和Content-Type
      const headers = new Headers(response.headers);

      // 根据是否强制下载设置Content-Disposition
      if (forceDownload) {
        headers.set("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
      } else {
        // 对于预览，我们不设置Content-Disposition或设置为inline
        headers.set("Content-Disposition", `inline; filename="${encodeURIComponent(filename)}"`);
      }

      // 确保设置正确的内容类型
      headers.set("Content-Type", contentType);

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

/**
 * 注册文件查看/下载路由
 * @param {Object} app - Hono应用实例
 */
export function registerFileViewRoutes(app) {
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
}

// 导出handleFileDownload函数和checkAndDeleteExpiredFile函数
export { handleFileDownload, checkAndDeleteExpiredFile };
