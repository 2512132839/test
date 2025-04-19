import { DbTables } from "../constants/index.js";
import { ApiStatus } from "../constants/index.js";
import { createErrorResponse, generateFileId, generateShortId, getSafeFileName, getFileNameAndExt, formatFileSize, getLocalTimeString } from "../utils/common.js";
import { getMimeType } from "../utils/fileUtils.js";
import { generatePresignedPutUrl, buildS3Url, deleteFileFromS3, generatePresignedUrl, createS3Client } from "../utils/s3Utils.js";
import { validateAdminToken } from "../services/adminService.js";
import { checkAndDeleteExpiredApiKey } from "../services/apiKeyService.js";
import { hashPassword } from "../utils/crypto.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { S3ProviderTypes } from "../constants/index.js";
import { ConfiguredRetryStrategy } from "@smithy/util-retry";
import { directoryCacheManager, clearCacheForFilePath } from "../utils/DirectoryCache.js";

// 默认最大上传限制（MB）
const DEFAULT_MAX_UPLOAD_SIZE_MB = 100;

/**
 * 生成唯一的文件slug
 * @param {D1Database} db - D1数据库实例
 * @param {string} customSlug - 自定义slug
 * @param {boolean} override - 是否覆盖已存在的slug
 * @returns {Promise<string>} 生成的唯一slug
 */
async function generateUniqueFileSlug(db, customSlug = null, override = false) {
  // 如果提供了自定义slug，验证其格式并检查是否已存在
  if (customSlug) {
    // 验证slug格式：只允许字母、数字、横杠和下划线
    const slugFormatRegex = /^[a-zA-Z0-9_-]+$/;
    if (!slugFormatRegex.test(customSlug)) {
      throw new Error("链接后缀格式无效，只能使用字母、数字、下划线和横杠");
    }

    // 检查slug是否已存在
    const existingFile = await db.prepare(`SELECT id FROM ${DbTables.FILES} WHERE slug = ?`).bind(customSlug).first();

    // 如果存在并且不覆盖，抛出错误；否则允许使用
    if (existingFile && !override) {
      throw new Error("链接后缀已被占用，请使用其他链接后缀");
    } else if (existingFile && override) {
      console.log(`允许覆盖已存在的链接后缀: ${customSlug}`);
    }

    return customSlug;
  }

  // 生成随机slug (6个字符)
  let attempts = 0;
  const maxAttempts = 10;
  while (attempts < maxAttempts) {
    const randomSlug = generateShortId();

    // 检查是否已存在
    const existingFile = await db.prepare(`SELECT id FROM ${DbTables.FILES} WHERE slug = ?`).bind(randomSlug).first();
    if (!existingFile) {
      return randomSlug;
    }

    attempts++;
  }

  throw new Error("无法生成唯一链接后缀，请稍后再试");
}

/**
 * 注册S3文件上传相关API路由
 * @param {Object} app - Hono应用实例
 */
export function registerS3UploadRoutes(app) {
  // 获取预签名上传URL
  app.post("/api/s3/presign", async (c) => {
    const db = c.env.DB;

    // 身份验证
    const authHeader = c.req.header("Authorization");
    let isAuthorized = false;
    let authorizedBy = "";
    let adminId = null;
    let apiKeyId = null;

    // 检查Bearer令牌 (管理员)
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      adminId = await validateAdminToken(c.env.DB, token);

      if (adminId) {
        isAuthorized = true;
        authorizedBy = "admin";
      }
    }
    // 检查API密钥
    else if (authHeader && authHeader.startsWith("ApiKey ")) {
      const apiKey = authHeader.substring(7);

      // 查询数据库中的API密钥记录
      const keyRecord = await db
          .prepare(
              `
          SELECT id, name, file_permission, expires_at
          FROM ${DbTables.API_KEYS}
          WHERE key = ?
        `
          )
          .bind(apiKey)
          .first();

      // 如果密钥存在且有文件权限
      if (keyRecord && keyRecord.file_permission === 1) {
        // 检查是否过期
        if (!(await checkAndDeleteExpiredApiKey(db, keyRecord))) {
          isAuthorized = true;
          authorizedBy = "apikey";
          // 记录API密钥ID
          apiKeyId = keyRecord.id;

          // 更新最后使用时间
          await db
              .prepare(
                  `
              UPDATE ${DbTables.API_KEYS}
              SET last_used = ?
              WHERE id = ?
            `
              )
              .bind(getLocalTimeString(), keyRecord.id)
              .run();
        }
      }
    }

    // 如果都没有授权，则返回权限错误
    if (!isAuthorized) {
      return c.json(createErrorResponse(ApiStatus.FORBIDDEN, "需要管理员权限或有效的API密钥才能获取上传预签名URL"), ApiStatus.FORBIDDEN);
    }

    try {
      // 解析请求数据
      const body = await c.req.json();

      // 检查必要字段
      if (!body.s3_config_id) {
        return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "必须提供 s3_config_id"), ApiStatus.BAD_REQUEST);
      }

      if (!body.filename) {
        return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "必须提供 filename"), ApiStatus.BAD_REQUEST);
      }

      // 获取系统最大上传限制
      const maxUploadSizeResult = await db
          .prepare(
              `
          SELECT value FROM ${DbTables.SYSTEM_SETTINGS}
          WHERE key = 'max_upload_size'
        `
          )
          .first();

      const maxUploadSizeMB = maxUploadSizeResult ? parseInt(maxUploadSizeResult.value) : DEFAULT_MAX_UPLOAD_SIZE_MB;
      const maxUploadSizeBytes = maxUploadSizeMB * 1024 * 1024;

      // 如果请求中包含了文件大小，则检查大小是否超过限制
      if (body.size && body.size > maxUploadSizeBytes) {
        return c.json(
            createErrorResponse(ApiStatus.BAD_REQUEST, `文件大小超过系统限制，最大允许 ${formatFileSize(maxUploadSizeBytes)}，当前文件 ${formatFileSize(body.size)}`),
            ApiStatus.BAD_REQUEST
        );
      }

      // 获取S3配置
      const s3Config = await db
          .prepare(
              `
          SELECT * FROM ${DbTables.S3_CONFIGS}
          WHERE id = ?
        `
          )
          .bind(body.s3_config_id)
          .first();

      if (!s3Config) {
        return c.json(createErrorResponse(ApiStatus.NOT_FOUND, "指定的S3配置不存在"), ApiStatus.NOT_FOUND);
      }

      // 检查存储空间是否足够（在预签名阶段进行检查）
      if (body.size && s3Config.total_storage_bytes !== null) {
        // 获取当前存储桶已使用的总容量
        const usageResult = await db
            .prepare(
                `
            SELECT SUM(size) as total_used
            FROM ${DbTables.FILES}
            WHERE s3_config_id = ?
          `
            )
            .bind(body.s3_config_id)
            .first();

        const currentUsage = usageResult?.total_used || 0;
        const fileSize = parseInt(body.size);

        // 计算上传后的总使用量
        const totalAfterUpload = currentUsage + fileSize;

        // 如果上传后会超出总容量限制，则返回错误
        if (totalAfterUpload > s3Config.total_storage_bytes) {
          const remainingSpace = Math.max(0, s3Config.total_storage_bytes - currentUsage);
          const formattedRemaining = formatFileSize(remainingSpace);
          const formattedFileSize = formatFileSize(fileSize);
          const formattedTotal = formatFileSize(s3Config.total_storage_bytes);

          return c.json(
              createErrorResponse(ApiStatus.BAD_REQUEST, `存储空间不足。文件大小(${formattedFileSize})超过剩余空间(${formattedRemaining})。存储桶总容量限制为${formattedTotal}。`),
              ApiStatus.BAD_REQUEST
          );
        }
      }

      // 如果是管理员授权，确认配置属于该管理员
      if (authorizedBy === "admin" && s3Config.admin_id !== adminId) {
        return c.json(createErrorResponse(ApiStatus.FORBIDDEN, "您无权使用此S3配置"), ApiStatus.FORBIDDEN);
      }

      // 生成文件ID
      const fileId = generateFileId();

      // 生成slug (不冲突的唯一短链接)
      let slug;
      try {
        slug = await generateUniqueFileSlug(db, body.slug, body.override === "true");
      } catch (error) {
        // 如果是slug冲突，返回HTTP 409状态码
        if (error.message.includes("链接后缀已被占用")) {
          return c.json(createErrorResponse(ApiStatus.CONFLICT, error.message), ApiStatus.CONFLICT);
        }
        throw error; // 其他错误继续抛出
      }

      // 如果启用了覆盖并且找到了已存在的slug，删除旧文件
      if (body.override === "true" && body.slug) {
        const existingFile = await db.prepare(`SELECT id, storage_path, s3_config_id FROM ${DbTables.FILES} WHERE slug = ?`).bind(body.slug).first();
        if (existingFile) {
          console.log(`覆盖模式：删除已存在的文件记录 Slug: ${body.slug}`);

          try {
            // 获取S3配置以便删除实际文件
            const s3Config = await db.prepare(`SELECT * FROM ${DbTables.S3_CONFIGS} WHERE id = ?`).bind(existingFile.s3_config_id).first();

            // 如果找到S3配置，先尝试删除S3存储中的实际文件
            if (s3Config) {
              const encryptionSecret = c.env.ENCRYPTION_SECRET || "default-encryption-key";
              const deleteResult = await deleteFileFromS3(s3Config, existingFile.storage_path, encryptionSecret);
              if (deleteResult) {
                console.log(`成功从S3删除文件: ${existingFile.storage_path}`);
              } else {
                console.warn(`无法从S3删除文件: ${existingFile.storage_path}，但将继续删除数据库记录`);
              }
            }

            // 删除旧文件的数据库记录
            await db.prepare(`DELETE FROM ${DbTables.FILES} WHERE id = ?`).bind(existingFile.id).run();

            // 删除关联的密码记录（如果有）
            await db.prepare(`DELETE FROM ${DbTables.FILE_PASSWORDS} WHERE file_id = ?`).bind(existingFile.id).run();

            // 清除与文件相关的缓存
            await clearCacheForFilePath(db, existingFile.storage_path, existingFile.s3_config_id);
          } catch (deleteError) {
            console.error(`删除旧文件记录时出错: ${deleteError.message}`);
            // 继续流程，不中断上传
          }
        }
      }

      // 处理文件路径
      const customPath = body.path || "";

      // 处理文件名
      const { name: fileName, ext: fileExt } = getFileNameAndExt(body.filename);
      const safeFileName = getSafeFileName(fileName).substring(0, 50); // 限制长度

      // 生成短ID
      const shortId = generateShortId();

      // 获取默认文件夹路径
      const folderPath = s3Config.default_folder ? (s3Config.default_folder.endsWith("/") ? s3Config.default_folder : s3Config.default_folder + "/") : "";

      // 组合最终路径 - 使用短ID-原始文件名的格式
      const storagePath = folderPath + customPath + shortId + "-" + safeFileName + fileExt;

      // 获取内容类型
      const mimetype = body.mimetype || getMimeType(body.filename);

      // 获取加密密钥
      const encryptionSecret = c.env.ENCRYPTION_SECRET || "default-encryption-key";

      // 生成预签名URL
      const upload_url = await generatePresignedPutUrl(s3Config, storagePath, mimetype, encryptionSecret, 3600);

      // 构建完整S3 URL
      const s3_url = buildS3Url(s3Config, storagePath);

      await db
          .prepare(
              `
          INSERT INTO ${DbTables.FILES} (
            id, slug, filename, storage_path, s3_url, 
            s3_config_id, mimetype, size, etag,
            created_by, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, 
            ?, ?, ?, ?,
            ?, ?, ?
          )
        `
          )
          .bind(
              fileId,
              slug,
              body.filename,
              storagePath,
              s3_url,
              body.s3_config_id,
              mimetype,
              0, // 初始大小为0，在上传完成后更新
              null, // 初始ETag为null，在上传完成后更新
              authorizedBy === "admin" ? adminId : authorizedBy === "apikey" ? `apikey:${apiKeyId}` : null, // 使用与传统上传一致的格式标记API密钥用户
              getLocalTimeString(), // 使用本地时间
              getLocalTimeString() // 使用本地时间
          )
          .run();

      // 返回预签名URL和文件信息
      return c.json({
        code: ApiStatus.SUCCESS,
        message: "获取预签名URL成功",
        data: {
          file_id: fileId,
          upload_url,
          storage_path: storagePath,
          s3_url,
          slug,
          provider_type: s3Config.provider_type, // 添加提供商类型，便于前端适配不同S3服务
        },
        success: true,
      });
    } catch (error) {
      console.error("获取预签名URL错误:", error);
      return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, "获取预签名URL失败: " + error.message), ApiStatus.INTERNAL_ERROR);
    }
  });

  // 文件上传完成后的提交确认
  app.post("/api/s3/commit", async (c) => {
    const db = c.env.DB;

    // 身份验证
    const authHeader = c.req.header("Authorization");
    let isAuthorized = false;
    let authorizedBy = "";
    let adminId = null;
    let apiKeyId = null;

    // 检查Bearer令牌 (管理员)
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      adminId = await validateAdminToken(c.env.DB, token);

      if (adminId) {
        isAuthorized = true;
        authorizedBy = "admin";
      }
    }
    // 检查API密钥
    else if (authHeader && authHeader.startsWith("ApiKey ")) {
      const apiKey = authHeader.substring(7);

      // 查询数据库中的API密钥记录
      const keyRecord = await db
          .prepare(
              `
          SELECT id, name, file_permission, expires_at
          FROM ${DbTables.API_KEYS}
          WHERE key = ?
        `
          )
          .bind(apiKey)
          .first();

      // 如果密钥存在且有文件权限
      if (keyRecord && keyRecord.file_permission === 1) {
        // 检查是否过期
        if (!(await checkAndDeleteExpiredApiKey(db, keyRecord))) {
          isAuthorized = true;
          authorizedBy = "apikey";
          // 记录API密钥ID
          apiKeyId = keyRecord.id;

          // 更新最后使用时间
          await db
              .prepare(
                  `
              UPDATE ${DbTables.API_KEYS}
              SET last_used = ?
              WHERE id = ?
            `
              )
              .bind(getLocalTimeString(), keyRecord.id)
              .run();
        }
      }
    }

    // 如果都没有授权，则返回权限错误
    if (!isAuthorized) {
      return c.json(createErrorResponse(ApiStatus.FORBIDDEN, "需要管理员权限或有效的API密钥才能完成文件上传"), ApiStatus.FORBIDDEN);
    }

    try {
      const body = await c.req.json();

      // 验证必要字段
      if (!body.file_id) {
        return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "缺少文件ID参数"), ApiStatus.BAD_REQUEST);
      }

      if (!body.etag) {
        return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "缺少ETag参数"), ApiStatus.BAD_REQUEST);
      }

      // 查询待提交的文件信息
      const file = await db
          .prepare(
              `
          SELECT id, filename, storage_path, s3_config_id, size, s3_url, slug, created_by
          FROM ${DbTables.FILES}
          WHERE id = ?
        `
          )
          .bind(body.file_id)
          .first();

      if (!file) {
        return c.json(createErrorResponse(ApiStatus.NOT_FOUND, "文件不存在或已被删除"), ApiStatus.NOT_FOUND);
      }

      // 验证权限
      if (authorizedBy === "admin" && file.created_by && file.created_by !== adminId) {
        return c.json(createErrorResponse(ApiStatus.FORBIDDEN, "您无权更新此文件"), ApiStatus.FORBIDDEN);
      }

      if (authorizedBy === "apikey" && file.created_by && file.created_by !== `apikey:${apiKeyId}`) {
        return c.json(createErrorResponse(ApiStatus.FORBIDDEN, "此API密钥无权更新此文件"), ApiStatus.FORBIDDEN);
      }

      // 获取S3配置
      const s3ConfigQuery =
          authorizedBy === "admin" ? `SELECT * FROM ${DbTables.S3_CONFIGS} WHERE id = ? AND admin_id = ?` : `SELECT * FROM ${DbTables.S3_CONFIGS} WHERE id = ? AND is_public = 1`;

      const s3ConfigParams = authorizedBy === "admin" ? [file.s3_config_id, adminId] : [file.s3_config_id];
      const s3Config = await db
          .prepare(s3ConfigQuery)
          .bind(...s3ConfigParams)
          .first();

      if (!s3Config) {
        return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "无效的S3配置ID或无权访问该配置"), ApiStatus.BAD_REQUEST);
      }

      // 检查存储桶容量限制
      if (s3Config.total_storage_bytes !== null) {
        // 获取当前存储桶已使用的总容量（不包括当前待提交的文件）
        const usageResult = await db
            .prepare(
                `
            SELECT SUM(size) as total_used
            FROM ${DbTables.FILES}
            WHERE s3_config_id = ? AND id != ?
          `
            )
            .bind(file.s3_config_id, file.id)
            .first();

        const currentUsage = usageResult?.total_used || 0;
        const fileSize = parseInt(body.size || 0);

        // 计算提交后的总使用量
        const totalAfterCommit = currentUsage + fileSize;

        // 如果提交后会超出总容量限制，则返回错误并删除临时文件
        if (totalAfterCommit > s3Config.total_storage_bytes) {
          // 删除临时文件
          try {
            const encryptionSecret = c.env.ENCRYPTION_SECRET || "default-encryption-key";
            await deleteFileFromS3(s3Config, file.storage_path, encryptionSecret);
          } catch (deleteError) {
            console.error("删除超出容量限制的临时文件失败:", deleteError);
          }

          // 删除文件记录
          await db.prepare(`DELETE FROM ${DbTables.FILES} WHERE id = ?`).bind(file.id).run();

          const remainingSpace = Math.max(0, s3Config.total_storage_bytes - currentUsage);
          const formattedRemaining = formatFileSize(remainingSpace);
          const formattedFileSize = formatFileSize(fileSize);
          const formattedTotal = formatFileSize(s3Config.total_storage_bytes);

          return c.json(
              createErrorResponse(
                  ApiStatus.BAD_REQUEST,
                  `存储空间不足。文件大小(${formattedFileSize})超过剩余空间(${formattedRemaining})。存储桶总容量限制为${formattedTotal}。文件已被删除。`
              ),
              ApiStatus.BAD_REQUEST
          );
        }
      }

      // 处理元数据字段
      // 处理密码
      let passwordHash = null;
      if (body.password) {
        passwordHash = await hashPassword(body.password);
      }

      // 处理过期时间
      let expiresAt = null;
      if (body.expires_in) {
        const expiresInHours = parseInt(body.expires_in);
        if (!isNaN(expiresInHours) && expiresInHours > 0) {
          const expiresDate = new Date();
          expiresDate.setHours(expiresDate.getHours() + expiresInHours);
          expiresAt = expiresDate.toISOString();
        }
      }

      // 处理备注字段
      const remark = body.remark || null;

      // 处理最大查看次数
      const maxViews = body.max_views ? parseInt(body.max_views) : null;

      // 处理文件大小
      let fileSize = null;
      if (body.size) {
        fileSize = parseInt(body.size);
        if (isNaN(fileSize) || fileSize < 0) {
          fileSize = 0; // 防止无效值
        }
      }

      // 更新ETag和创建者
      const creator = authorizedBy === "admin" ? adminId : `apikey:${apiKeyId}`;
      const now = getLocalTimeString();

      // 更新文件记录
      await db
          .prepare(
              `
        UPDATE ${DbTables.FILES}
        SET 
          etag = ?, 
          created_by = ?, 
          remark = ?,
          password = ?,
          expires_at = ?,
          max_views = ?,
          updated_at = ?,
          size = CASE WHEN ? IS NOT NULL THEN ? ELSE size END
        WHERE id = ?
      `
          )
          .bind(
              body.etag,
              creator,
              remark,
              passwordHash,
              expiresAt,
              maxViews,
              now,
              fileSize !== null ? 1 : null, // 条件参数
              fileSize, // 文件大小值
              body.file_id
          )
          .run();

      // 处理明文密码保存
      if (body.password) {
        // 检查是否已存在密码记录
        const passwordExists = await db.prepare(`SELECT file_id FROM ${DbTables.FILE_PASSWORDS} WHERE file_id = ?`).bind(body.file_id).first();

        if (passwordExists) {
          // 更新现有密码
          await db.prepare(`UPDATE ${DbTables.FILE_PASSWORDS} SET plain_password = ?, updated_at = ? WHERE file_id = ?`).bind(body.password, now, body.file_id).run();
        } else {
          // 插入新密码
          await db
              .prepare(`INSERT INTO ${DbTables.FILE_PASSWORDS} (file_id, plain_password, created_at, updated_at) VALUES (?, ?, ?, ?)`)
              .bind(body.file_id, body.password, now, now)
              .run();
        }
      }

      // 清除与文件相关的缓存
      await clearCacheForFilePath(db, file.storage_path, file.s3_config_id);

      // 获取更新后的文件记录
      const updatedFile = await db
          .prepare(
              `
        SELECT 
          id, slug, filename, storage_path, s3_url, 
          mimetype, size, remark, 
          created_at, updated_at
        FROM ${DbTables.FILES}
        WHERE id = ?
      `
          )
          .bind(body.file_id)
          .first();

      // 返回成功响应
      return c.json({
        code: ApiStatus.SUCCESS,
        message: "文件提交成功",
        data: {
          ...updatedFile,
          hasPassword: !!passwordHash,
          expiresAt: expiresAt,
          maxViews: maxViews,
          url: `/file/${updatedFile.slug}`,
        },
        success: true, // 添加兼容字段
      });
    } catch (error) {
      console.error("提交文件错误:", error);
      return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, "提交文件失败: " + error.message), ApiStatus.INTERNAL_ERROR);
    }
  });

  // 一步完成文件上传的API
  app.put("/api/upload-direct/:filename", async (c) => {
    const db = c.env.DB;
    const filename = c.req.param("filename");

    // 身份验证 - 支持API Key和自定义授权头
    const authHeader = c.req.header("Authorization");
    const customAuthKey = c.req.header("X-Custom-Auth-Key");
    let isAuthorized = false;
    let authorizedBy = "";
    let adminId = null;
    let apiKeyId = null;
    let s3ConfigId = null;

    // 首先检查自定义授权头
    if (customAuthKey) {
      // 查询数据库中是否有匹配的API密钥
      const keyRecord = await db
          .prepare(
              `SELECT id, name, file_permission, expires_at
           FROM ${DbTables.API_KEYS}
           WHERE key = ?`
          )
          .bind(customAuthKey)
          .first();

      // 如果密钥存在且有文件权限
      if (keyRecord && keyRecord.file_permission === 1) {
        // 检查是否过期
        if (!(await checkAndDeleteExpiredApiKey(db, keyRecord))) {
          isAuthorized = true;
          authorizedBy = "apikey";
          apiKeyId = keyRecord.id;

          // 从查询参数中获取S3配置ID
          s3ConfigId = c.req.query("s3_config_id");

          // 更新最后使用时间
          await db
              .prepare(
                  `UPDATE ${DbTables.API_KEYS}
               SET last_used = ?
               WHERE id = ?`
              )
              .bind(getLocalTimeString(), keyRecord.id)
              .run();
        }
      }
    }
    // 如果没有自定义授权头，检查标准Authorization头
    else if (authHeader) {
      // 检查Bearer令牌 (管理员)
      if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        adminId = await validateAdminToken(c.env.DB, token);

        if (adminId) {
          isAuthorized = true;
          authorizedBy = "admin";

          // 从查询参数中获取S3配置ID
          s3ConfigId = c.req.query("s3_config_id");
        }
      }
      // 检查API密钥
      else if (authHeader.startsWith("ApiKey ")) {
        const apiKey = authHeader.substring(7);

        // 查询数据库中的API密钥记录
        const keyRecord = await db
            .prepare(
                `SELECT id, name, file_permission, expires_at
             FROM ${DbTables.API_KEYS}
             WHERE key = ?`
            )
            .bind(apiKey)
            .first();

        // 如果密钥存在且有文件权限
        if (keyRecord && keyRecord.file_permission === 1) {
          // 检查是否过期
          if (!(await checkAndDeleteExpiredApiKey(db, keyRecord))) {
            isAuthorized = true;
            authorizedBy = "apikey";
            apiKeyId = keyRecord.id;

            // 从查询参数中获取S3配置ID
            s3ConfigId = c.req.query("s3_config_id");

            // 更新最后使用时间
            await db
                .prepare(
                    `UPDATE ${DbTables.API_KEYS}
                 SET last_used = ?
                 WHERE id = ?`
                )
                .bind(getLocalTimeString(), keyRecord.id)
                .run();
          }
        }
      }
    }

    // 如果未授权，返回错误
    if (!isAuthorized) {
      return c.json(createErrorResponse(ApiStatus.FORBIDDEN, "需要有效的API密钥或管理员权限才能上传文件"), ApiStatus.FORBIDDEN);
    }

    // 处理API密钥用户提供的S3配置ID，确保只能使用公开的配置
    if (authorizedBy === "apikey" && s3ConfigId) {
      // 验证指定的S3配置是否存在且公开
      const configCheck = await db.prepare(`SELECT id FROM ${DbTables.S3_CONFIGS} WHERE id = ? AND is_public = 1`).bind(s3ConfigId).first();

      if (!configCheck) {
        return c.json(createErrorResponse(ApiStatus.FORBIDDEN, "API密钥用户只能使用公开的S3配置或默认配置"), ApiStatus.FORBIDDEN);
      }

      console.log(`API密钥用户使用指定的公开S3配置: ${s3ConfigId}`);
    }

    // 如果没有指定S3配置ID，尝试获取默认配置
    if (!s3ConfigId) {
      let defaultConfigQuery;
      let params = [];

      if (authorizedBy === "admin") {
        // 管理员用户 - 获取该管理员的默认配置
        defaultConfigQuery = `
          SELECT id, name FROM ${DbTables.S3_CONFIGS} 
          WHERE admin_id = ? AND is_default = 1
          LIMIT 1
        `;
        params.push(adminId);
      } else {
        // API密钥用户 - 获取公开的默认配置
        defaultConfigQuery = `
          SELECT id, name FROM ${DbTables.S3_CONFIGS} 
          WHERE is_public = 1 AND is_default = 1
          LIMIT 1
        `;
      }

      const defaultConfig = await db
          .prepare(defaultConfigQuery)
          .bind(...params)
          .first();

      if (defaultConfig) {
        s3ConfigId = defaultConfig.id;
        console.log(`使用默认S3配置: ${defaultConfig.name} (${s3ConfigId})`);
      } else {
        // 如果没有找到默认配置，尝试获取任意一个适合的配置
        if (authorizedBy === "admin") {
          // 管理员 - 获取该管理员的任意配置
          const anyConfig = await db.prepare(`SELECT id, name FROM ${DbTables.S3_CONFIGS} WHERE admin_id = ? LIMIT 1`).bind(adminId).first();

          if (anyConfig) {
            s3ConfigId = anyConfig.id;
            console.log(`未找到默认配置，使用管理员的配置: ${anyConfig.name} (${s3ConfigId})`);
          } else {
            return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "您的账户下没有可用的S3配置，请先创建配置或指定有效的S3配置ID"), ApiStatus.BAD_REQUEST);
          }
        } else {
          // API密钥 - 获取任意公开配置
          const anyPublicConfig = await db.prepare(`SELECT id, name FROM ${DbTables.S3_CONFIGS} WHERE is_public = 1 LIMIT 1`).first();

          if (anyPublicConfig) {
            s3ConfigId = anyPublicConfig.id;
            console.log(`未找到默认配置，使用公开配置: ${anyPublicConfig.name} (${s3ConfigId})`);
          } else {
            return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "系统中没有公开可用的S3配置，请联系管理员设置公开配置或指定有效的S3配置ID"), ApiStatus.BAD_REQUEST);
          }
        }
      }
    }

    // 获取并验证S3配置
    try {
      const s3Config = await db.prepare(`SELECT * FROM ${DbTables.S3_CONFIGS} WHERE id = ?`).bind(s3ConfigId).first();

      if (!s3Config) {
        return c.json(createErrorResponse(ApiStatus.NOT_FOUND, "指定的S3配置不存在"), ApiStatus.NOT_FOUND);
      }

      // 额外的权限检查：确保管理员只能使用自己的配置，API密钥用户只能使用公开配置
      if (authorizedBy === "admin" && s3Config.admin_id !== adminId) {
        return c.json(createErrorResponse(ApiStatus.FORBIDDEN, "您无权使用此S3配置"), ApiStatus.FORBIDDEN);
      }

      if (authorizedBy === "apikey" && s3Config.is_public !== 1) {
        return c.json(createErrorResponse(ApiStatus.FORBIDDEN, "API密钥用户只能使用公开的S3配置"), ApiStatus.FORBIDDEN);
      }

      // 获取文件内容
      const fileContent = await c.req.arrayBuffer();
      const fileSize = fileContent.byteLength;

      // 获取系统最大上传限制
      const maxUploadSizeResult = await db.prepare(`SELECT value FROM ${DbTables.SYSTEM_SETTINGS} WHERE key = 'max_upload_size'`).first();

      const maxUploadSizeMB = maxUploadSizeResult ? parseInt(maxUploadSizeResult.value) : DEFAULT_MAX_UPLOAD_SIZE_MB;
      const maxUploadSizeBytes = maxUploadSizeMB * 1024 * 1024;

      // 检查文件大小是否超过限制
      if (fileSize > maxUploadSizeBytes) {
        return c.json(
            createErrorResponse(ApiStatus.BAD_REQUEST, `文件大小超过系统限制，最大允许 ${formatFileSize(maxUploadSizeBytes)}，当前文件 ${formatFileSize(fileSize)}`),
            ApiStatus.BAD_REQUEST
        );
      }

      // 检查存储空间是否足够
      if (s3Config.total_storage_bytes !== null) {
        // 获取当前存储桶已使用的总容量
        const usageResult = await db.prepare(`SELECT SUM(size) as total_used FROM ${DbTables.FILES} WHERE s3_config_id = ?`).bind(s3ConfigId).first();

        const currentUsage = usageResult?.total_used || 0;

        // 计算上传后的总使用量
        const totalAfterUpload = currentUsage + fileSize;

        // 如果上传后会超出总容量限制，则返回错误
        if (totalAfterUpload > s3Config.total_storage_bytes) {
          const remainingSpace = Math.max(0, s3Config.total_storage_bytes - currentUsage);
          const formattedRemaining = formatFileSize(remainingSpace);
          const formattedFileSize = formatFileSize(fileSize);
          const formattedTotal = formatFileSize(s3Config.total_storage_bytes);

          return c.json(
              createErrorResponse(ApiStatus.BAD_REQUEST, `存储空间不足。文件大小(${formattedFileSize})超过剩余空间(${formattedRemaining})。存储桶总容量限制为${formattedTotal}。`),
              ApiStatus.BAD_REQUEST
          );
        }
      }

      // 从查询参数获取其他选项
      const customSlug = c.req.query("slug");
      const customPath = c.req.query("path") || "";
      const remark = c.req.query("remark") || "";
      const password = c.req.query("password");
      const expiresInHours = c.req.query("expires_in") ? parseInt(c.req.query("expires_in")) : 0;
      const maxViews = c.req.query("max_views") ? parseInt(c.req.query("max_views")) : 0;
      // 添加 override 参数
      const override = c.req.query("override") === "true";

      // 生成文件ID和唯一Slug
      const fileId = generateFileId();
      let slug;
      try {
        // 传递 override 参数给函数
        slug = await generateUniqueFileSlug(db, customSlug, override);
      } catch (error) {
        // 如果是slug冲突，返回HTTP 409状态码
        if (error.message.includes("链接后缀已被占用")) {
          return c.json(createErrorResponse(ApiStatus.CONFLICT, error.message), ApiStatus.CONFLICT);
        }
        throw error;
      }

      // 如果启用了覆盖并且找到了已存在的slug，删除旧文件
      if (override && customSlug) {
        const existingFile = await db.prepare(`SELECT id, storage_path, s3_config_id, created_by FROM ${DbTables.FILES} WHERE slug = ?`).bind(customSlug).first();
        if (existingFile) {
          console.log(`覆盖模式：检查文件记录  Slug: ${customSlug}`);

          // 检查当前用户是否为文件创建者
          const currentCreator = authorizedBy === "admin" ? adminId : authorizedBy === "apikey" ? `apikey:${apiKeyId}` : null;
          if (existingFile.created_by !== currentCreator) {
            console.log(`覆盖操作被拒绝：用户 ${currentCreator} 尝试覆盖 ${existingFile.created_by} 创建的文件`);
            return c.json(createErrorResponse(ApiStatus.FORBIDDEN, "您无权覆盖其他用户创建的文件"), ApiStatus.FORBIDDEN);
          }

          console.log(`覆盖模式：删除已存在的文件记录  Slug: ${customSlug}`);

          try {
            // 获取S3配置以便删除实际文件
            const s3Config = await db.prepare(`SELECT * FROM ${DbTables.S3_CONFIGS} WHERE id = ?`).bind(existingFile.s3_config_id).first();

            // 如果找到S3配置，先尝试删除S3存储中的实际文件
            if (s3Config) {
              const encryptionSecret = c.env.ENCRYPTION_SECRET || "default-encryption-key";
              const deleteResult = await deleteFileFromS3(s3Config, existingFile.storage_path, encryptionSecret);
              if (deleteResult) {
                console.log(`成功从S3删除文件: ${existingFile.storage_path}`);
              } else {
                console.warn(`无法从S3删除文件: ${existingFile.storage_path}，但将继续删除数据库记录`);
              }
            }

            // 删除旧文件的数据库记录
            await db.prepare(`DELETE FROM ${DbTables.FILES} WHERE id = ?`).bind(existingFile.id).run();

            // 删除关联的密码记录（如果有）
            await db.prepare(`DELETE FROM ${DbTables.FILE_PASSWORDS} WHERE file_id = ?`).bind(existingFile.id).run();

            // 清除与文件相关的缓存
            await clearCacheForFilePath(db, existingFile.storage_path, existingFile.s3_config_id);
          } catch (deleteError) {
            console.error(`删除旧文件记录时出错: ${deleteError.message}`);
            // 继续流程，不中断上传
          }
        }
      }

      // 正确获取Content-Type，如果没有提供，根据文件扩展名推断
      let contentType = c.req.header("Content-Type");

      // 如果Content-Type包含字符集，移除它，因为可能会导致预览问题
      if (contentType && contentType.includes(";")) {
        contentType = contentType.split(";")[0].trim();
      }

      // 如果没有Content-Type或者是通用类型，则根据文件扩展名推断
      if (!contentType || contentType === "application/octet-stream") {
        contentType = getMimeType(filename);
      }

      console.log(`文件上传 - 文件名: ${filename}, Content-Type: ${contentType}`);

      // 处理文件名
      const { name: fileName, ext: fileExt } = getFileNameAndExt(filename);
      const safeFileName = getSafeFileName(fileName).substring(0, 50); // 限制长度

      // 生成短ID
      const shortId = generateShortId();

      // 获取默认文件夹路径
      const folderPath = s3Config.default_folder ? (s3Config.default_folder.endsWith("/") ? s3Config.default_folder : s3Config.default_folder + "/") : "";

      // 组合最终路径
      const storagePath = folderPath + customPath + shortId + "-" + safeFileName + fileExt;

      // 获取加密密钥
      const encryptionSecret = c.env.ENCRYPTION_SECRET || "default-encryption-key";

      // 创建S3客户端
      const s3Client = await createS3Client(s3Config, encryptionSecret);

      // 确保storagePath不以斜杠开始
      const normalizedPath = storagePath.startsWith("/") ? storagePath.slice(1) : storagePath;

      // 创建上传命令 - 确保正确设置Content-Type
      const uploadParams = {
        Bucket: s3Config.bucket_name,
        Key: normalizedPath,
        Body: new Uint8Array(fileContent),
        ContentType: contentType,
      };

      console.log(`上传文件到S3 - Bucket: ${s3Config.bucket_name}, Key: ${normalizedPath}, ContentType: ${contentType}`);

      // 针对不同服务商的特定处理
      let etag = null;
      switch (s3Config.provider_type) {
        case S3ProviderTypes.B2:
          // B2特殊处理 - 使用预签名URL方式，避免AWS SDK自动添加不支持的校验和头部
          try {
            // 生成预签名URL - 使用现有函数
            console.log(`为B2上传生成预签名URL...`);
            const presignedUrl = await generatePresignedPutUrl(s3Config, storagePath, contentType, encryptionSecret, 3600);

            // 直接使用fetch和预签名URL上传内容
            console.log(`使用预签名URL上传文件到B2...`);

            // 只需要包含内容类型头部，其他授权信息已经包含在URL中
            const headers = {
              "Content-Type": contentType,
              "Content-Length": fileContent.byteLength.toString(),
            };

            // 发送PUT请求
            const response = await fetch(presignedUrl, {
              method: "PUT",
              headers: headers,
              body: fileContent,
              duplex: "half", // 添加duplex选项以支持Node.js 18+的fetch API要求
            });

            // 检查响应状态
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`B2预签名URL上传失败 (${response.status}): ${errorText}`);
            }

            // 提取ETag
            etag = response.headers.get("ETag");
            if (etag) {
              // 移除ETag中的引号
              etag = etag.replace(/"/g, "");
            }

            console.log(`B2预签名URL上传成功 - ETag: ${etag}`);
          } catch (b2Error) {
            // 详细的错误记录
            console.error(`B2上传错误:`, b2Error);

            // 重新抛出错误
            throw new Error(`无法上传到B2存储: ${b2Error.message || "未知错误"}`);
          }
          break;

        case S3ProviderTypes.R2:
          // R2特定处理
          try {
            const r2Result = await s3Client.send(new PutObjectCommand(uploadParams));
            etag = r2Result.ETag ? r2Result.ETag.replace(/"/g, "") : null;
            console.log(`R2上传成功 - ETag: ${etag}`);
          } catch (r2Error) {
            console.error(`R2上传错误:`, r2Error);
            throw r2Error;
          }
          break;

        default:
          // 默认处理 (AWS S3或其他兼容存储)
          try {
            const s3Result = await s3Client.send(new PutObjectCommand(uploadParams));
            etag = s3Result.ETag ? s3Result.ETag.replace(/"/g, "") : null;
            console.log(`标准S3上传成功 - ETag: ${etag}`);
          } catch (s3Error) {
            console.error(`S3上传错误:`, s3Error);
            throw s3Error;
          }
          break;
      }

      // 构建完整S3 URL
      const s3Url = buildS3Url(s3Config, storagePath);

      // 计算过期时间
      let expiresAt = null;
      if (expiresInHours > 0) {
        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + expiresInHours);
        // 使用统一格式并保留完整时区信息，确保准确的过期时间计算
        expiresAt = expiryDate.toISOString();
      }

      // 默认使用代理 (1 = 使用代理, 0 = 直接访问)
      const useProxy = c.req.query("use_proxy") !== "0" ? 1 : 0;

      // 如果设置了密码，先生成密码哈希
      let passwordHash = null;
      if (password) {
        passwordHash = await hashPassword(password);
      }

      // 保存文件记录到数据库
      const now = getLocalTimeString();
      await db
          .prepare(
              `INSERT INTO ${DbTables.FILES} (
            id, slug, filename, storage_path, s3_url, 
            s3_config_id, mimetype, size, etag,
            created_by, created_at, updated_at, 
            remark, expires_at, max_views, use_proxy,
            password
          ) VALUES (
            ?, ?, ?, ?, ?, 
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?,
            ?
          )`
          )
          .bind(
              fileId,
              slug,
              filename,
              storagePath,
              s3Url,
              s3ConfigId,
              contentType,
              fileSize,
              etag,
              authorizedBy === "admin" ? adminId : authorizedBy === "apikey" ? `apikey:${apiKeyId}` : null,
              now,
              now,
              remark,
              expiresAt,
              maxViews > 0 ? maxViews : null,
              useProxy,
              passwordHash // 添加密码哈希作为新参数
          )
          .run();

      // 如果设置了密码，保存明文密码记录
      if (password) {
        await db.prepare(`INSERT INTO ${DbTables.FILE_PASSWORDS} (file_id, plain_password, created_at, updated_at) VALUES (?, ?, ?, ?)`).bind(fileId, password, now, now).run();
      }

      // 清除与文件相关的缓存
      await clearCacheForFilePath(db, storagePath, s3ConfigId);

      // 生成预签名URL (有效期1小时)
      const previewDirectUrl = await generatePresignedUrl(s3Config, storagePath, encryptionSecret, 3600, false);
      const downloadDirectUrl = await generatePresignedUrl(s3Config, storagePath, encryptionSecret, 3600, true);

      // 构建API路径URL
      const baseUrl = c.req.url.split("/api/")[0];
      const previewProxyUrl = `${baseUrl}/api/file-view/${slug}`;
      const downloadProxyUrl = `${baseUrl}/api/file-download/${slug}`;

      // 如果提供了密码，在URL中添加密码参数
      const previewProxyUrlWithPassword = password ? `${previewProxyUrl}?password=${encodeURIComponent(password)}` : previewProxyUrl;
      const downloadProxyUrlWithPassword = password ? `${downloadProxyUrl}?password=${encodeURIComponent(password)}` : downloadProxyUrl;

      // 构建响应数据
      return c.json({
        code: ApiStatus.SUCCESS,
        message: "文件上传成功",
        data: {
          id: fileId,
          slug,
          filename,
          mimetype: contentType,
          size: fileSize,
          remark,
          created_at: now,
          requires_password: !!passwordHash,
          views: 0,
          max_views: maxViews > 0 ? maxViews : null,
          expires_at: expiresAt,
          // 访问URL - 如果有密码则使用带密码的代理URL，或者直接URL
          previewUrl: useProxy ? previewProxyUrlWithPassword : previewDirectUrl,
          downloadUrl: useProxy ? downloadProxyUrlWithPassword : downloadDirectUrl,
          // 直接S3访问URL (预签名) - 不包含密码参数
          s3_direct_preview_url: previewDirectUrl,
          s3_direct_download_url: downloadDirectUrl,
          // 代理访问URL (通过服务器) - 带密码参数
          proxy_preview_url: previewProxyUrlWithPassword,
          proxy_download_url: downloadProxyUrlWithPassword,
          // 其他信息
          use_proxy: useProxy,
          created_by: authorizedBy === "admin" ? adminId : authorizedBy === "apikey" ? `apikey:${apiKeyId}` : null,
        },
        success: true,
      });
    } catch (error) {
      console.error("直接上传文件错误:", error);
      return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, "上传文件失败: " + error.message), ApiStatus.INTERNAL_ERROR);
    }
  });
}
