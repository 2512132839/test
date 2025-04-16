import { DbTables } from "../constants/index.js";
import { ApiStatus } from "../constants/index.js";
import { createErrorResponse } from "../utils/common.js";
import { deleteFileFromS3 } from "../utils/s3Utils.js";
import { hashPassword, verifyPassword } from "../utils/crypto.js";
import { getFileBySlug, isFileAccessible, incrementAndCheckFileViews, generateFileDownloadUrl, getPublicFileInfo } from "../services/fileService.js";
import { directoryCacheManager, clearCacheForFilePath } from "../utils/DirectoryCache.js";

/**
 * 用户文件路由
 * 负责公共文件访问和API密钥用户文件管理功能
 */

/**
 * 注册用户文件相关API路由
 * @param {Object} app - Hono应用实例
 */
export function registerUserFilesRoutes(app) {
  // 获取公开文件（无需认证）
  app.get("/api/public/files/:slug", async (c) => {
    const db = c.env.DB;
    const { slug } = c.req.param();
    const encryptionSecret = c.env.ENCRYPTION_SECRET || "default-encryption-key";

    try {
      // 查询文件详情
      const file = await getFileBySlug(db, slug);

      // 检查文件是否可访问
      const accessCheck = await isFileAccessible(db, file, encryptionSecret);
      if (!accessCheck.accessible) {
        if (accessCheck.reason === "expired") {
          return c.json(createErrorResponse(ApiStatus.GONE, "文件已过期"), ApiStatus.GONE);
        }
        return c.json(createErrorResponse(ApiStatus.NOT_FOUND, "文件不存在"), ApiStatus.NOT_FOUND);
      }

      // 检查是否需要密码
      const requiresPassword = !!file.password;

      // 如果不需要密码，立即增加访问次数并检查是否超过限制
      if (!requiresPassword) {
        // 增加访问次数并检查限制
        const result = await incrementAndCheckFileViews(db, file, encryptionSecret);

        // 如果文件已过期，返回相应的错误
        if (result.isExpired) {
          // 确保文件被删除
          try {
            // 再次检查文件是否仍然存在
            const fileStillExists = await db.prepare(`SELECT id FROM ${DbTables.FILES} WHERE id = ?`).bind(file.id).first();
            if (fileStillExists) {
              console.log(`文件(${file.id})达到最大访问次数但未被删除，再次尝试删除...`);
              // 导入并使用 checkAndDeleteExpiredFile 函数
              const { checkAndDeleteExpiredFile } = await import("../routes/fileViewRoutes.js");
              await checkAndDeleteExpiredFile(db, result.file, encryptionSecret);
            }
          } catch (error) {
            console.error(`尝试再次删除文件(${file.id})时出错:`, error);
          }
          return c.json(createErrorResponse(ApiStatus.GONE, "文件已达到最大查看次数"), ApiStatus.GONE);
        }

        // 生成文件下载URL
        const urlsObj = await generateFileDownloadUrl(db, result.file, encryptionSecret, c.req.raw);

        // 构建公开信息
        const publicInfo = getPublicFileInfo(result.file, requiresPassword, urlsObj);

        return c.json({
          code: ApiStatus.SUCCESS,
          message: "获取文件成功",
          data: publicInfo,
          success: true,
        });
      } else {
        // 文件需要密码验证，只返回基本信息
        const publicInfo = getPublicFileInfo(file, true);

        return c.json({
          code: ApiStatus.SUCCESS,
          message: "获取文件成功",
          data: publicInfo,
          success: true,
        });
      }
    } catch (error) {
      console.error("获取公开文件错误:", error);
      return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "获取文件失败"), ApiStatus.INTERNAL_ERROR);
    }
  });

  // 验证文件密码
  app.post("/api/public/files/:slug/verify", async (c) => {
    const db = c.env.DB;
    const { slug } = c.req.param();
    const body = await c.req.json();
    const encryptionSecret = c.env.ENCRYPTION_SECRET || "default-encryption-key";

    if (!body.password) {
      return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "密码是必需的"), ApiStatus.BAD_REQUEST);
    }

    try {
      // 查询文件详情
      const file = await getFileBySlug(db, slug);

      // 检查文件是否可访问
      const accessCheck = await isFileAccessible(db, file, encryptionSecret);
      if (!accessCheck.accessible) {
        if (accessCheck.reason === "expired") {
          return c.json(createErrorResponse(ApiStatus.GONE, "文件已过期"), ApiStatus.GONE);
        }
        return c.json(createErrorResponse(ApiStatus.NOT_FOUND, "文件不存在"), ApiStatus.NOT_FOUND);
      }

      // 验证密码
      if (!file.password) {
        return c.json({
          code: ApiStatus.BAD_REQUEST,
          message: "此文件不需要密码",
          data: {
            url: file.s3_url,
          },
          success: true,
        });
      }

      const passwordValid = await verifyPassword(body.password, file.password);

      if (!passwordValid) {
        return c.json(createErrorResponse(ApiStatus.UNAUTHORIZED, "密码不正确"), ApiStatus.UNAUTHORIZED);
      }

      // 密码验证成功，增加查看次数并检查限制
      const result = await incrementAndCheckFileViews(db, file, encryptionSecret);

      // 如果文件已过期，返回相应的错误
      if (result.isExpired) {
        // 确保文件被删除
        try {
          // 再次检查文件是否仍然存在
          const fileStillExists = await db.prepare(`SELECT id FROM ${DbTables.FILES} WHERE id = ?`).bind(file.id).first();
          if (fileStillExists) {
            console.log(`文件(${file.id})达到最大访问次数但未被删除，再次尝试删除...`);
            // 导入并使用 checkAndDeleteExpiredFile 函数
            const { checkAndDeleteExpiredFile } = await import("../routes/fileViewRoutes.js");
            await checkAndDeleteExpiredFile(db, result.file, encryptionSecret);
          }
        } catch (error) {
          console.error(`尝试再次删除文件(${file.id})时出错:`, error);
        }
        return c.json(createErrorResponse(ApiStatus.GONE, "文件已达到最大查看次数"), ApiStatus.GONE);
      }

      // 生成文件下载URL
      const urlsObj = await generateFileDownloadUrl(db, result.file, encryptionSecret, c.req.raw);

      // 使用getPublicFileInfo函数构建完整的响应，包括代理链接
      const publicInfo = getPublicFileInfo(result.file, false, urlsObj);

      return c.json({
        code: ApiStatus.SUCCESS,
        message: "密码验证成功",
        data: publicInfo,
        success: true,
      });
    } catch (error) {
      console.error("验证文件密码错误:", error);
      return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "验证密码失败"), ApiStatus.INTERNAL_ERROR);
    }
  });

  // API密钥用户获取自己的文件列表
  app.get("/api/user/files", async (c) => {
    const db = c.env.DB;
    const apiKeyId = c.get("apiKeyId");
    const apiKeyInfo = c.get("apiKeyInfo");

    try {
      // 查询用户文件（支持分页）
      const limit = parseInt(c.req.query("limit") || "30");
      const offset = parseInt(c.req.query("offset") || "0");

      // 获取用户文件列表
      const files = await db
        .prepare(
          `
          SELECT 
            f.id, f.filename, f.slug, f.storage_path, f.s3_url, 
            f.mimetype, f.size, f.remark, f.created_at, f.views,
            f.max_views, f.expires_at, f.etag, f.password IS NOT NULL as has_password,
            f.created_by, f.use_proxy,
            s.name as s3_config_name,
            s.provider_type as s3_provider_type,
            s.id as s3_config_id
          FROM ${DbTables.FILES} f
          LEFT JOIN ${DbTables.S3_CONFIGS} s ON f.s3_config_id = s.id
          WHERE f.created_by = ?
          ORDER BY f.created_at DESC
          LIMIT ? OFFSET ?
        `
        )
        .bind(`apikey:${apiKeyId}`, limit, offset)
        .all();

      // 获取总数
      const countResult = await db.prepare(`SELECT COUNT(*) as total FROM ${DbTables.FILES} WHERE created_by = ?`).bind(`apikey:${apiKeyId}`).first();

      const total = countResult ? countResult.total : 0;

      // 处理文件信息，包括密码
      let processedFiles = await Promise.all(
        files.results.map(async (file) => {
          const result = { ...file };

          // 确保has_password是布尔类型
          result.has_password = !!result.has_password;

          // 如果文件有密码保护，获取明文密码
          if (result.has_password) {
            const passwordEntry = await db.prepare(`SELECT plain_password FROM ${DbTables.FILE_PASSWORDS} WHERE file_id = ?`).bind(result.id).first();

            if (passwordEntry && passwordEntry.plain_password) {
              result.plain_password = passwordEntry.plain_password;
            }
          }

          return result;
        })
      );

      // 为API密钥创建者添加密钥名称
      let keyNamesMap = new Map();

      // 收集所有需要查询名称的密钥ID
      const apiKeyIds = processedFiles.filter((file) => file.created_by && file.created_by.startsWith("apikey:")).map((file) => file.created_by.substring(7));

      // 如果有需要查询名称的密钥
      if (apiKeyIds.length > 0) {
        // 使用Set去重
        const uniqueKeyIds = [...new Set(apiKeyIds)];

        // 为每个唯一的密钥ID查询名称
        for (const keyId of uniqueKeyIds) {
          const keyInfo = await db.prepare(`SELECT id, name FROM ${DbTables.API_KEYS} WHERE id = ?`).bind(keyId).first();

          if (keyInfo) {
            keyNamesMap.set(keyId, keyInfo.name);
          }
        }

        // 为每个结果添加key_name字段
        processedFiles = processedFiles.map((file) => {
          if (file.created_by && file.created_by.startsWith("apikey:")) {
            const keyId = file.created_by.substring(7);
            const keyName = keyNamesMap.get(keyId);
            if (keyName) {
              return { ...file, key_name: keyName };
            }
          }
          return file;
        });
      }

      return c.json({
        code: ApiStatus.SUCCESS,
        message: "获取文件列表成功",
        data: {
          files: processedFiles,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
          },
        },
        key_info: apiKeyInfo, // 返回API密钥信息
        success: true,
      });
    } catch (error) {
      console.error("获取API密钥用户文件列表错误:", error);
      return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "获取文件列表失败"), ApiStatus.INTERNAL_ERROR);
    }
  });

  // API密钥用户获取单个文件详情
  app.get("/api/user/files/:id", async (c) => {
    const db = c.env.DB;
    const apiKeyId = c.get("apiKeyId");
    const { id } = c.req.param();
    const encryptionSecret = c.env.ENCRYPTION_SECRET || "default-encryption-key";

    try {
      // 查询文件详情
      const file = await db
        .prepare(
          `
          SELECT 
            f.id, f.filename, f.slug, f.storage_path, f.s3_url, 
            f.mimetype, f.size, f.remark, f.created_at, f.views,
            f.max_views, f.expires_at, f.etag, f.password IS NOT NULL as has_password,
            f.created_by, f.use_proxy,
            s.name as s3_config_name,
            s.provider_type as s3_provider_type,
            s.id as s3_config_id
          FROM ${DbTables.FILES} f
          LEFT JOIN ${DbTables.S3_CONFIGS} s ON f.s3_config_id = s.id
          WHERE f.id = ? AND f.created_by = ?
        `
        )
        .bind(id, `apikey:${apiKeyId}`)
        .first();

      if (!file) {
        return c.json(createErrorResponse(ApiStatus.NOT_FOUND, "文件不存在或无权访问"), ApiStatus.NOT_FOUND);
      }

      // 检查用户是否有权限查看该文件
      if (file.created_by !== `apikey:${apiKeyId}`) {
        return c.json(createErrorResponse(ApiStatus.FORBIDDEN, "没有权限查看此文件"), ApiStatus.FORBIDDEN);
      }

      // 生成文件下载URL
      const urlsObj = await generateFileDownloadUrl(db, file, encryptionSecret, c.req.raw);

      // 构建响应
      const result = {
        ...file,
        urls: urlsObj,
      };

      // 如果文件有密码保护，获取明文密码
      if (file.has_password) {
        const passwordEntry = await db.prepare(`SELECT plain_password FROM ${DbTables.FILE_PASSWORDS} WHERE file_id = ?`).bind(file.id).first();

        if (passwordEntry && passwordEntry.plain_password) {
          result.plain_password = passwordEntry.plain_password;
        }
      }

      // 如果是API密钥创建的文件，添加API密钥名称
      if (result.created_by && result.created_by.startsWith("apikey:")) {
        const keyId = result.created_by.substring(7);
        const keyInfo = await db.prepare(`SELECT id, name FROM ${DbTables.API_KEYS} WHERE id = ?`).bind(keyId).first();
        if (keyInfo) {
          result.key_name = keyInfo.name;
        }
      }

      return c.json({
        code: ApiStatus.SUCCESS,
        message: "获取文件成功",
        data: result,
        success: true,
      });
    } catch (error) {
      console.error("获取文件错误:", error);
      return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "获取文件失败"), ApiStatus.INTERNAL_ERROR);
    }
  });

  // API密钥用户删除自己的文件
  app.delete("/api/user/files/:id", async (c) => {
    const db = c.env.DB;
    const apiKeyId = c.get("apiKeyId");
    const { id } = c.req.param();

    try {
      // 获取文件信息
      const file = await db
        .prepare(
          `
          SELECT f.*, s.endpoint_url, s.bucket_name, s.region, s.access_key_id, s.secret_access_key, s.path_style
          FROM ${DbTables.FILES} f
          LEFT JOIN ${DbTables.S3_CONFIGS} s ON f.s3_config_id = s.id
          WHERE f.id = ? AND f.created_by = ?
        `
        )
        .bind(id, `apikey:${apiKeyId}`)
        .first();

      if (!file) {
        return c.json(createErrorResponse(ApiStatus.NOT_FOUND, "文件不存在或无权删除"), ApiStatus.NOT_FOUND);
      }

      // 尝试从S3中删除文件
      try {
        const encryptionSecret = c.env.ENCRYPTION_SECRET || "default-encryption-key";
        if (file.storage_path && file.bucket_name) {
          const s3Config = {
            id: file.id,
            endpoint_url: file.endpoint_url,
            bucket_name: file.bucket_name,
            region: file.region,
            access_key_id: file.access_key_id,
            secret_access_key: file.secret_access_key,
            path_style: file.path_style,
          };
          await deleteFileFromS3(s3Config, file.storage_path, encryptionSecret);
        }
      } catch (s3Error) {
        console.error("从S3删除文件错误:", s3Error);
        // 即使S3删除失败，也继续从数据库中删除记录
      }

      // 从数据库中删除记录
      await db.prepare(`DELETE FROM ${DbTables.FILES} WHERE id = ?`).bind(id).run();

      // 清除与文件相关的缓存
      await clearCacheForFilePath(db, file.storage_path, file.s3_config_id);

      return c.json({
        code: ApiStatus.SUCCESS,
        message: "文件删除成功",
        success: true,
      });
    } catch (error) {
      console.error("删除API密钥用户文件错误:", error);
      return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "删除文件失败"), ApiStatus.INTERNAL_ERROR);
    }
  });

  // API密钥用户更新自己文件的元数据
  app.put("/api/user/files/:id", async (c) => {
    const db = c.env.DB;
    const apiKeyId = c.get("apiKeyId");
    const { id } = c.req.param();
    const body = await c.req.json();

    try {
      // 检查文件是否存在且属于当前API密钥用户
      const existingFile = await db.prepare(`SELECT id FROM ${DbTables.FILES} WHERE id = ? AND created_by = ?`).bind(id, `apikey:${apiKeyId}`).first();

      if (!existingFile) {
        return c.json(createErrorResponse(ApiStatus.NOT_FOUND, "文件不存在或无权更新"), ApiStatus.NOT_FOUND);
      }

      // 构建更新字段和参数
      const updateFields = [];
      const bindParams = [];

      // 处理可更新的字段
      if (body.remark !== undefined) {
        updateFields.push("remark = ?");
        bindParams.push(body.remark);
      }

      if (body.slug !== undefined) {
        // 检查slug是否可用 (不与其他文件冲突)
        const slugExistsCheck = await db.prepare(`SELECT id FROM ${DbTables.FILES} WHERE slug = ? AND id != ?`).bind(body.slug, id).first();

        if (slugExistsCheck) {
          return c.json(createErrorResponse(ApiStatus.CONFLICT, "此链接后缀已被其他文件使用"), ApiStatus.CONFLICT);
        }

        updateFields.push("slug = ?");
        bindParams.push(body.slug);
      }

      // 处理过期时间
      if (body.expires_at !== undefined) {
        updateFields.push("expires_at = ?");
        bindParams.push(body.expires_at);
      }

      // 处理Worker代理访问设置
      if (body.use_proxy !== undefined) {
        updateFields.push("use_proxy = ?");
        bindParams.push(body.use_proxy ? 1 : 0);
      }

      // 处理最大查看次数
      if (body.max_views !== undefined) {
        updateFields.push("max_views = ?");
        bindParams.push(body.max_views);

        // 当修改max_views时，重置views计数为0
        updateFields.push("views = 0");
      }

      // 处理密码变更
      if (body.password !== undefined) {
        if (body.password) {
          // 设置新密码
          const passwordHash = await hashPassword(body.password);
          updateFields.push("password = ?");
          bindParams.push(passwordHash);

          // 更新或插入明文密码到FILE_PASSWORDS表
          const plainPasswordExists = await db.prepare(`SELECT file_id FROM ${DbTables.FILE_PASSWORDS} WHERE file_id = ?`).bind(id).first();

          if (plainPasswordExists) {
            // 更新现有的密码记录
            await db.prepare(`UPDATE ${DbTables.FILE_PASSWORDS} SET plain_password = ?, updated_at = ? WHERE file_id = ?`).bind(body.password, new Date().toISOString(), id).run();
          } else {
            // 插入新的密码记录
            await db
              .prepare(`INSERT INTO ${DbTables.FILE_PASSWORDS} (file_id, plain_password, created_at, updated_at) VALUES (?, ?, ?, ?)`)
              .bind(id, body.password, new Date().toISOString(), new Date().toISOString())
              .run();
          }
        } else {
          // 明确提供了空密码，表示要清除密码
          updateFields.push("password = NULL");

          // 删除明文密码记录
          await db.prepare(`DELETE FROM ${DbTables.FILE_PASSWORDS} WHERE file_id = ?`).bind(id).run();
        }
      }
      // 注意：如果body.password未定义，则表示不修改密码，保持原密码不变

      // 添加更新时间
      updateFields.push("updated_at = ?");
      bindParams.push(new Date().toISOString());

      // 添加查询条件：文件ID和创建者
      bindParams.push(id);
      bindParams.push(`apikey:${apiKeyId}`);

      // 如果没有要更新的字段
      if (updateFields.length === 0) {
        return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "没有提供有效的更新字段"), ApiStatus.BAD_REQUEST);
      }

      // 执行更新
      await db
        .prepare(
          `
          UPDATE ${DbTables.FILES}
          SET ${updateFields.join(", ")}
          WHERE id = ? AND created_by = ?
        `
        )
        .bind(...bindParams)
        .run();

      return c.json({
        code: ApiStatus.SUCCESS,
        message: "文件元数据更新成功",
        success: true,
      });
    } catch (error) {
      console.error("更新API密钥用户文件元数据错误:", error);
      return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "更新文件元数据失败"), ApiStatus.INTERNAL_ERROR);
    }
  });
}
