import { DbTables } from "../constants/index.js";
import { ApiStatus } from "../constants/index.js";
import { createErrorResponse } from "../utils/common.js";
import { deleteFileFromS3 } from "../utils/s3Utils.js";
import { hashPassword } from "../utils/crypto.js";
import { generateFileDownloadUrl } from "../services/fileService.js";
import { directoryCacheManager, clearCacheForFilePath } from "../utils/DirectoryCache.js";

/**
 * 管理员文件路由
 * 负责管理员的文件查询和管理功能
 */

/**
 * 注册管理员文件相关API路由
 * @param {Object} app - Hono应用实例
 */
export function registerAdminFilesRoutes(app) {
  // 获取文件列表（仅管理员权限）
  app.get("/api/admin/files", async (c) => {
    const db = c.env.DB;
    const adminId = c.get("adminId");

    try {
      // 查询所有文件（可选带分页）
      const limit = parseInt(c.req.query("limit") || "30");
      const offset = parseInt(c.req.query("offset") || "0");
      const createdBy = c.req.query("created_by");
      const s3ConfigId = c.req.query("s3_config_id");

      // 构建查询条件
      let whereClauses = [];
      let queryParams = [];

      if (createdBy) {
        whereClauses.push("created_by = ?");
        queryParams.push(createdBy);
      }

      if (s3ConfigId) {
        whereClauses.push("s3_config_id = ?");
        queryParams.push(s3ConfigId);
      }

      // 构建WHERE子句
      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      // 获取文件列表
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
          ${whereClause}
          ORDER BY f.created_at DESC
          LIMIT ? OFFSET ?
        `
        )
        .bind(...queryParams, limit, offset)
        .all();

      // 获取总数
      const countParams = [...queryParams];
      const countResult = await db
        .prepare(`SELECT COUNT(*) as total FROM ${DbTables.FILES} ${whereClause}`)
        .bind(...countParams)
        .first();

      const total = countResult ? countResult.total : 0;

      // 处理查询结果，为API密钥创建者添加密钥名称
      let results = files.results;
      let keyNamesMap = new Map();

      // 获取文件密码和添加API密钥名称
      for (const file of results) {
        // 确保has_password是布尔类型
        file.has_password = !!file.has_password;

        // 如果文件有密码保护，获取明文密码
        if (file.has_password) {
          const passwordEntry = await db.prepare(`SELECT plain_password FROM ${DbTables.FILE_PASSWORDS} WHERE file_id = ?`).bind(file.id).first();
          if (passwordEntry && passwordEntry.plain_password) {
            file.plain_password = passwordEntry.plain_password;
          }
        }
      }

      // 收集所有需要查询名称的密钥ID
      const apiKeyIds = results.filter((file) => file.created_by && file.created_by.startsWith("apikey:")).map((file) => file.created_by.substring(7));

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
        results = results.map((file) => {
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
          files: results,
          pagination: {
            total,
            limit,
            offset,
          },
        },
        success: true,
      });
    } catch (error) {
      console.error("获取管理员文件列表错误:", error);
      return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "获取文件列表失败"), ApiStatus.INTERNAL_ERROR);
    }
  });

  // 获取单个文件详情（仅管理员权限）
  app.get("/api/admin/files/:id", async (c) => {
    const db = c.env.DB;
    const { id } = c.req.param();
    const encryptionSecret = c.env.ENCRYPTION_SECRET || "default-encryption-key";

    try {
      // 查询文件详情
      const file = await db
        .prepare(
          `
          SELECT 
            f.id, f.filename, f.slug, f.storage_path, f.s3_url, 
            f.mimetype, f.size, f.remark, f.created_at, f.updated_at,
            f.views, f.max_views, f.expires_at, f.use_proxy,
            f.etag, f.password IS NOT NULL as has_password,
            f.created_by,
            s.name as s3_config_name,
            s.provider_type as s3_provider_type,
            s.id as s3_config_id
          FROM ${DbTables.FILES} f
          LEFT JOIN ${DbTables.S3_CONFIGS} s ON f.s3_config_id = s.id
          WHERE f.id = ?
        `
        )
        .bind(id)
        .first();

      if (!file) {
        return c.json(createErrorResponse(ApiStatus.NOT_FOUND, "文件不存在"), ApiStatus.NOT_FOUND);
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

  // 删除文件（管理员）
  app.delete("/api/admin/files/:id", async (c) => {
    const db = c.env.DB;
    const { id } = c.req.param();

    try {
      // 获取文件信息
      const file = await db
        .prepare(
          `
          SELECT f.*, s.endpoint_url, s.bucket_name, s.region, s.access_key_id, s.secret_access_key, s.path_style
          FROM ${DbTables.FILES} f
          LEFT JOIN ${DbTables.S3_CONFIGS} s ON f.s3_config_id = s.id
          WHERE f.id = ?
        `
        )
        .bind(id)
        .first();

      if (!file) {
        return c.json(createErrorResponse(ApiStatus.NOT_FOUND, "文件不存在"), ApiStatus.NOT_FOUND);
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

      // 从数据库中删除记录和关联的密码记录
      // 首先删除密码记录
      await db.prepare(`DELETE FROM ${DbTables.FILE_PASSWORDS} WHERE file_id = ?`).bind(id).run();
      // 然后删除文件记录
      await db.prepare(`DELETE FROM ${DbTables.FILES} WHERE id = ?`).bind(id).run();

      // 清除与文件相关的缓存
      await clearCacheForFilePath(db, file.storage_path, file.s3_config_id);

      return c.json({
        code: ApiStatus.SUCCESS,
        message: "文件删除成功",
        success: true,
      });
    } catch (error) {
      console.error("删除管理员文件错误:", error);
      return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "删除文件失败"), ApiStatus.INTERNAL_ERROR);
    }
  });

  // 管理员更新文件元数据
  app.put("/api/admin/files/:id", async (c) => {
    const db = c.env.DB;
    const { id } = c.req.param();
    const body = await c.req.json();

    try {
      // 检查文件是否存在
      const existingFile = await db.prepare(`SELECT id FROM ${DbTables.FILES} WHERE id = ?`).bind(id).first();

      if (!existingFile) {
        return c.json(createErrorResponse(ApiStatus.NOT_FOUND, "文件不存在"), ApiStatus.NOT_FOUND);
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

      // 添加查询条件：文件ID
      bindParams.push(id);

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
          WHERE id = ?
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
      console.error("更新管理员文件元数据错误:", error);
      return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "更新文件元数据失败"), ApiStatus.INTERNAL_ERROR);
    }
  });
}
