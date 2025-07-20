/**
 * URL上传路由
 * 处理URL验证、元信息获取和代理URL内容的路由
 */
import { DbTables } from "../constants/index.js";
import { ApiStatus } from "../constants/index.js";
import { createErrorResponse, formatFileSize } from "../utils/common.js";
import { baseAuthMiddleware, createFlexiblePermissionMiddleware } from "../middlewares/permissionMiddleware.js";
import { PermissionUtils, PermissionType } from "../utils/permissionUtils.js";
import {
  validateAndGetUrlMetadata,
  proxyUrlContent,
  prepareUrlUpload,
  initializeMultipartUpload,
  completeMultipartUpload,
  abortMultipartUpload,
} from "../services/urlUploadService.js";
import { hashPassword } from "../utils/crypto.js";
import { deleteFileFromS3 } from "../utils/s3Utils.js";
import { clearCache } from "../utils/DirectoryCache.js";

// 创建文件权限中间件（管理员或API密钥文件权限）
const requireFilePermissionMiddleware = createFlexiblePermissionMiddleware({
  permissions: [PermissionType.FILE],
  allowAdmin: true,
});

/**
 * 注册URL上传相关API路由
 * @param {Object} app - Hono应用实例
 */
export function registerUrlUploadRoutes(app) {
  // API路由：验证URL并获取文件元信息
  app.post("/api/url/info", async (c) => {
    try {
      const body = await c.req.json();

      // 验证URL参数是否存在
      if (!body.url) {
        return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "缺少URL参数"), ApiStatus.BAD_REQUEST);
      }

      // 验证URL并获取文件元信息
      const metadata = await validateAndGetUrlMetadata(body.url);

      // 返回成功响应
      return c.json({
        code: ApiStatus.SUCCESS,
        message: "URL验证成功",
        data: metadata,
        success: true,
      });
    } catch (error) {
      console.error("URL验证错误:", error);

      // 确定适当的状态码
      let statusCode = ApiStatus.INTERNAL_ERROR;
      if (error.message.includes("无效的URL") || error.message.includes("仅支持HTTP")) {
        statusCode = ApiStatus.BAD_REQUEST;
      } else if (error.message.includes("无法访问")) {
        statusCode = ApiStatus.BAD_REQUEST;
      }

      return c.json(createErrorResponse(statusCode, error.message), statusCode);
    }
  });

  // API路由：代理URL内容（用于不支持CORS的资源）
  app.get("/api/url/proxy", async (c) => {
    try {
      // 从查询参数获取URL
      const url = c.req.query("url");

      if (!url) {
        return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "缺少URL参数"), ApiStatus.BAD_REQUEST);
      }

      // 代理URL内容
      const response = await proxyUrlContent(url);

      // 直接返回响应流
      return response;
    } catch (error) {
      console.error("代理URL内容错误:", error);

      // 确定适当的状态码
      let statusCode = ApiStatus.INTERNAL_ERROR;
      if (error.message.includes("无效的URL") || error.message.includes("仅支持HTTP")) {
        statusCode = ApiStatus.BAD_REQUEST;
      } else if (error.message.includes("源服务器返回错误状态码")) {
        statusCode = ApiStatus.BAD_REQUEST;
      }

      return c.json(createErrorResponse(statusCode, error.message), statusCode);
    }
  });

  // API路由：为URL上传准备预签名URL和文件记录
  app.post("/api/url/presign", baseAuthMiddleware, requireFilePermissionMiddleware, async (c) => {
    const db = c.env.DB;

    try {
      // 获取认证信息
      const isAdmin = PermissionUtils.isAdmin(c);
      const userId = PermissionUtils.getUserId(c);
      const authType = PermissionUtils.getAuthType(c);

      const body = await c.req.json();

      // 验证必要参数
      if (!body.url) {
        return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "缺少URL参数"), ApiStatus.BAD_REQUEST);
      }

      if (!body.s3_config_id) {
        return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "缺少S3配置ID参数"), ApiStatus.BAD_REQUEST);
      }

      // 验证S3配置ID
      const s3Config = await db
        .prepare(
          `
          SELECT id FROM ${DbTables.S3_CONFIGS}
          WHERE id = ? AND ${isAdmin ? "admin_id = ?" : "is_public = 1"}
        `
        )
        .bind(...(isAdmin ? [body.s3_config_id, userId] : [body.s3_config_id]))
        .first();

      if (!s3Config) {
        return c.json(createErrorResponse(ApiStatus.NOT_FOUND, "指定的S3配置不存在或无权访问"), ApiStatus.NOT_FOUND);
      }

      // 获取URL元信息
      let metadata;

      // 如果客户端已经提供了元信息，则使用客户端提供的信息
      if (body.metadata && body.metadata.filename && body.metadata.contentType) {
        metadata = body.metadata;
        metadata.url = body.url; // 确保URL字段存在
      } else {
        // 否则获取URL元信息
        metadata = await validateAndGetUrlMetadata(body.url);
      }

      // 如果客户端提供了自定义文件名，则使用客户端提供的文件名
      if (body.filename) {
        metadata.filename = body.filename;
      }

      // 准备创建者标识
      const createdBy = authType === "admin" ? userId : `apikey:${userId}`;

      // 获取加密密钥
      const encryptionSecret = c.env.ENCRYPTION_SECRET || "default-encryption-key";

      // 准备额外选项
      const options = {
        slug: body.slug || null,
        remark: body.remark || null,
        path: body.path || null,
        authType: authType, // 传递认证类型
        apiKeyInfo: authType === "apikey" ? PermissionUtils.getApiKeyInfo(c) : null, // 传递API密钥信息
      };

      // 准备URL上传
      const uploadInfo = await prepareUrlUpload(db, body.s3_config_id, metadata, createdBy, encryptionSecret, options);

      // 返回成功响应
      return c.json({
        code: ApiStatus.SUCCESS,
        message: "URL上传准备就绪",
        data: uploadInfo,
        success: true,
      });
    } catch (error) {
      console.error("URL上传准备错误:", error);

      // 确定适当的状态码
      let statusCode = ApiStatus.INTERNAL_ERROR;
      if (error.message.includes("无效的URL") || error.message.includes("仅支持HTTP")) {
        statusCode = ApiStatus.BAD_REQUEST;
      } else if (error.message.includes("无法访问")) {
        statusCode = ApiStatus.BAD_REQUEST;
      } else if (error.message.includes("S3配置不存在")) {
        statusCode = ApiStatus.NOT_FOUND;
      }

      return c.json(createErrorResponse(statusCode, error.message), statusCode);
    }
  });

  // API路由：URL上传完成后的提交确认
  app.post("/api/url/commit", baseAuthMiddleware, requireFilePermissionMiddleware, async (c) => {
    const db = c.env.DB;

    try {
      // 获取认证信息
      const isAdmin = PermissionUtils.isAdmin(c);
      const userId = PermissionUtils.getUserId(c);
      const authType = PermissionUtils.getAuthType(c);

      const body = await c.req.json();

      // 验证必要字段
      if (!body.file_id) {
        return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "缺少文件ID参数"), ApiStatus.BAD_REQUEST);
      }

      // ETag参数是可选的，某些S3兼容服务（如又拍云）可能由于CORS限制无法返回ETag
      // 如果没有ETag，我们仍然允许提交，但会记录警告
      if (!body.etag) {
        console.warn(`URL上传提交时未提供ETag: ${body.file_id}，可能是由于CORS限制导致前端无法获取ETag响应头`);
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
      if (isAdmin && file.created_by && file.created_by !== userId) {
        return c.json(createErrorResponse(ApiStatus.FORBIDDEN, "您无权更新此文件"), ApiStatus.FORBIDDEN);
      }

      if (authType === "apikey" && file.created_by && file.created_by !== `apikey:${userId}`) {
        return c.json(createErrorResponse(ApiStatus.FORBIDDEN, "此API密钥无权更新此文件"), ApiStatus.FORBIDDEN);
      }

      // 获取S3配置
      const s3ConfigQuery = isAdmin ? `SELECT * FROM ${DbTables.S3_CONFIGS} WHERE id = ? AND admin_id = ?` : `SELECT * FROM ${DbTables.S3_CONFIGS} WHERE id = ? AND is_public = 1`;

      const s3ConfigParams = isAdmin ? [file.s3_config_id, userId] : [file.s3_config_id];
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

      // 处理备注字段 - 如果没有提供备注，则保留原有备注
      const remark = body.remark || null;

      // 处理自定义链接字段 (slug)
      let newSlug = null;
      let slugUpdateRequired = false;
      if (body.slug) {
        // 验证slug是否合法（只允许字母、数字、连字符和下划线）
        const slugRegex = /^[a-zA-Z0-9_-]+$/;
        if (!slugRegex.test(body.slug)) {
          return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "自定义链接格式无效，只允许字母、数字、连字符和下划线"), ApiStatus.BAD_REQUEST);
        }

        // 检查slug是否已被占用（排除当前文件）
        const existingSlug = await db.prepare(`SELECT id FROM ${DbTables.FILES} WHERE slug = ? AND id != ?`).bind(body.slug, body.file_id).first();
        if (existingSlug) {
          return c.json(createErrorResponse(ApiStatus.CONFLICT, "自定义链接已被其他文件占用"), ApiStatus.CONFLICT);
        }

        newSlug = body.slug;
        slugUpdateRequired = true;
      }

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
      const creator = authType === "admin" ? userId : `apikey:${userId}`;

      // 构建SQL更新语句
      let updateSql = `
        UPDATE ${DbTables.FILES}
        SET
          etag = ?,
          created_by = ?,
          remark = ?,
          password = ?,
          expires_at = ?,
          max_views = ?,
          updated_at = CURRENT_TIMESTAMP,
          size = CASE WHEN ? IS NOT NULL THEN ? ELSE size END
      `;

      // 如果提供了自定义slug，则添加到更新语句中
      if (slugUpdateRequired) {
        updateSql += `, slug = ?`;
      }

      updateSql += ` WHERE id = ?`;

      // 准备绑定参数
      const bindParams = [
        body.etag || null, // 如果ETag为空，保存为null
        creator,
        remark,
        passwordHash,
        expiresAt,
        maxViews,
        fileSize !== null ? 1 : null, // 条件参数
        fileSize, // 文件大小值
      ];

      // 如果需要更新slug，添加相应参数
      if (slugUpdateRequired) {
        bindParams.push(newSlug);
      }

      // 添加file_id作为最后一个参数
      bindParams.push(body.file_id);

      // 更新文件记录
      await db
        .prepare(updateSql)
        .bind(...bindParams)
        .run();

      // 处理明文密码保存
      if (body.password) {
        // 检查是否已存在密码记录
        const passwordExists = await db.prepare(`SELECT file_id FROM ${DbTables.FILE_PASSWORDS} WHERE file_id = ?`).bind(body.file_id).first();

        if (passwordExists) {
          // 更新现有密码
          await db.prepare(`UPDATE ${DbTables.FILE_PASSWORDS} SET plain_password = ?, updated_at = CURRENT_TIMESTAMP WHERE file_id = ?`).bind(body.password, body.file_id).run();
        } else {
          // 插入新密码
          await db
            .prepare(`INSERT INTO ${DbTables.FILE_PASSWORDS} (file_id, plain_password, created_at, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
            .bind(body.file_id, body.password)
            .run();
        }
      }

      // 更新父目录的修改时间
      try {
        const s3Config = await db.prepare(`SELECT * FROM ${DbTables.S3_CONFIGS} WHERE id = ?`).bind(file.s3_config_id).first();
        if (s3Config) {
          const encryptionSecret = c.env.ENCRYPTION_SECRET || "default-encryption-key";
          const { updateParentDirectoriesModifiedTimeHelper } = await import("../storage/drivers/s3/utils/S3DirectoryUtils.js");
          await updateParentDirectoriesModifiedTimeHelper(s3Config, file.storage_path, encryptionSecret);
        }
      } catch (error) {
        console.warn(`更新父目录修改时间失败:`, error);
      }

      // 清除与文件相关的缓存 - 使用统一的clearCache函数
      await clearCache({ db, s3ConfigId: file.s3_config_id });

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
        success: true,
      });
    } catch (error) {
      console.error("提交文件错误:", error);
      return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, "提交文件失败: " + error.message), ApiStatus.INTERNAL_ERROR);
    }
  });

  // API路由：初始化分片上传流程
  app.post("/api/url/multipart/init", baseAuthMiddleware, requireFilePermissionMiddleware, async (c) => {
    const db = c.env.DB;

    // 获取认证信息
    const isAdmin = PermissionUtils.isAdmin(c);
    const userId = PermissionUtils.getUserId(c);
    const authType = PermissionUtils.getAuthType(c);

    try {
      const body = await c.req.json();

      // 验证必要参数
      if (!body.url) {
        return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "缺少URL参数"), ApiStatus.BAD_REQUEST);
      }

      if (!body.s3_config_id) {
        return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "缺少S3配置ID参数"), ApiStatus.BAD_REQUEST);
      }

      // 验证S3配置ID
      const s3Config = await db
        .prepare(
          `
          SELECT id FROM ${DbTables.S3_CONFIGS}
          WHERE id = ? AND ${isAdmin ? "admin_id = ?" : "is_public = 1"}
        `
        )
        .bind(...(isAdmin ? [body.s3_config_id, userId] : [body.s3_config_id]))
        .first();

      if (!s3Config) {
        return c.json(createErrorResponse(ApiStatus.NOT_FOUND, "指定的S3配置不存在或无权访问"), ApiStatus.NOT_FOUND);
      }

      // 获取URL元信息
      let metadata;

      // 如果客户端已经提供了元信息，则使用客户端提供的信息
      if (body.metadata && body.metadata.filename && body.metadata.contentType) {
        metadata = body.metadata;
        metadata.url = body.url; // 确保URL字段存在
      } else {
        // 否则获取URL元信息
        metadata = await validateAndGetUrlMetadata(body.url);
      }

      // 如果客户端提供了自定义文件名，则使用客户端提供的文件名
      if (body.filename) {
        metadata.filename = body.filename;
      }

      // 准备创建者标识
      const createdBy = isAdmin ? userId : `apikey:${userId}`;

      // 获取加密密钥
      const encryptionSecret = c.env.ENCRYPTION_SECRET || "default-encryption-key";

      // 准备额外选项
      const options = {
        slug: body.slug || null,
        remark: body.remark || null,
        password: body.password || null,
        expires_in: body.expires_in || null,
        max_views: body.max_views || null,
        partSize: body.part_size || null,
        totalSize: body.total_size || metadata.size || 0,
        partCount: body.part_count || null,
        path: body.path || null,
        authType: authType, // 传递认证类型
        apiKeyInfo: authType === "apikey" ? PermissionUtils.getApiKeyInfo(c) : null, // 传递API密钥信息
      };

      // 初始化分片上传
      const result = await initializeMultipartUpload(db, body.url, body.s3_config_id, metadata, createdBy, encryptionSecret, options);

      // 返回成功响应
      return c.json({
        code: ApiStatus.SUCCESS,
        message: "分片上传初始化成功",
        data: result,
        success: true,
      });
    } catch (error) {
      console.error("初始化分片上传错误:", error);

      // 确定适当的状态码
      let statusCode = ApiStatus.INTERNAL_ERROR;
      if (error.message.includes("无效的URL") || error.message.includes("仅支持HTTP")) {
        statusCode = ApiStatus.BAD_REQUEST;
      } else if (error.message.includes("无法访问")) {
        statusCode = ApiStatus.BAD_REQUEST;
      } else if (error.message.includes("S3配置不存在")) {
        statusCode = ApiStatus.NOT_FOUND;
      } else if (error.message.includes("自定义链接")) {
        statusCode = ApiStatus.BAD_REQUEST;
      }

      return c.json(createErrorResponse(statusCode, error.message), statusCode);
    }
  });

  // API路由：完成分片上传流程
  app.post("/api/url/multipart/complete", baseAuthMiddleware, requireFilePermissionMiddleware, async (c) => {
    const db = c.env.DB;

    // 获取认证信息
    const isAdmin = PermissionUtils.isAdmin(c);
    const userId = PermissionUtils.getUserId(c);
    const authType = PermissionUtils.getAuthType(c);

    try {
      const body = await c.req.json();

      // 验证必要参数
      if (!body.file_id) {
        return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "缺少文件ID参数"), ApiStatus.BAD_REQUEST);
      }

      if (!body.parts) {
        return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "缺少分片列表参数"), ApiStatus.BAD_REQUEST);
      }

      if (!body.upload_id) {
        return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "缺少上传ID参数"), ApiStatus.BAD_REQUEST);
      }

      // 查询文件记录
      const file = await db
        .prepare(
          `
          SELECT id, created_by, s3_config_id
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
      if (isAdmin && file.created_by && file.created_by !== userId) {
        return c.json(createErrorResponse(ApiStatus.FORBIDDEN, "您无权完成此文件的上传"), ApiStatus.FORBIDDEN);
      }

      if (authType === "apikey" && file.created_by && file.created_by !== `apikey:${userId}`) {
        return c.json(createErrorResponse(ApiStatus.FORBIDDEN, "此API密钥无权完成此文件的上传"), ApiStatus.FORBIDDEN);
      }

      // 获取加密密钥
      const encryptionSecret = c.env.ENCRYPTION_SECRET || "default-encryption-key";

      // 完成分片上传，使用前端传递的uploadId
      const result = await completeMultipartUpload(db, body.file_id, body.upload_id, body.parts, encryptionSecret);

      // 返回成功响应
      return c.json({
        code: ApiStatus.SUCCESS,
        message: "分片上传已完成",
        data: result,
        success: true,
      });
    } catch (error) {
      console.error("完成分片上传错误:", error);

      // 确定适当的状态码
      let statusCode = ApiStatus.INTERNAL_ERROR;

      if (error.message.includes("文件不存在")) {
        statusCode = ApiStatus.NOT_FOUND;
      } else if (error.message.includes("无效的分片信息")) {
        statusCode = ApiStatus.BAD_REQUEST;
      }

      return c.json(createErrorResponse(statusCode, error.message), statusCode);
    }
  });

  // API路由：终止分片上传流程
  app.post("/api/url/multipart/abort", baseAuthMiddleware, requireFilePermissionMiddleware, async (c) => {
    const db = c.env.DB;

    // 获取认证信息
    const isAdmin = PermissionUtils.isAdmin(c);
    const userId = PermissionUtils.getUserId(c);
    const authType = PermissionUtils.getAuthType(c);

    try {
      const body = await c.req.json();

      // 验证必要参数
      if (!body.file_id) {
        return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "缺少文件ID参数"), ApiStatus.BAD_REQUEST);
      }

      if (!body.upload_id) {
        return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "缺少上传ID参数"), ApiStatus.BAD_REQUEST);
      }

      // 查询文件记录
      const file = await db
        .prepare(
          `
          SELECT id, created_by, s3_config_id
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
      if (isAdmin && file.created_by && file.created_by !== userId) {
        return c.json(createErrorResponse(ApiStatus.FORBIDDEN, "您无权终止此文件的上传"), ApiStatus.FORBIDDEN);
      }

      if (authType === "apikey" && file.created_by && file.created_by !== `apikey:${userId}`) {
        return c.json(createErrorResponse(ApiStatus.FORBIDDEN, "此API密钥无权终止此文件的上传"), ApiStatus.FORBIDDEN);
      }

      // 获取加密密钥
      const encryptionSecret = c.env.ENCRYPTION_SECRET || "default-encryption-key";

      // 终止分片上传，使用前端传递的uploadId
      const result = await abortMultipartUpload(db, body.file_id, body.upload_id, encryptionSecret);

      // 返回成功响应
      return c.json({
        code: ApiStatus.SUCCESS,
        message: "分片上传已终止",
        data: result,
        success: true,
      });
    } catch (error) {
      console.error("终止分片上传错误:", error);

      // 确定适当的状态码
      let statusCode = ApiStatus.INTERNAL_ERROR;

      if (error.message.includes("文件不存在")) {
        statusCode = ApiStatus.NOT_FOUND;
      }

      return c.json(createErrorResponse(statusCode, error.message), statusCode);
    }
  });

  // API路由：取消URL上传并删除文件记录
  app.post("/api/url/cancel", baseAuthMiddleware, requireFilePermissionMiddleware, async (c) => {
    const db = c.env.DB;

    // 使用新的权限工具获取用户信息
    const isAdmin = PermissionUtils.isAdmin(c);
    const userId = PermissionUtils.getUserId(c);
    const authType = PermissionUtils.getAuthType(c);

    let authorizedBy = "";
    let adminId = null;
    let apiKeyId = null;

    if (isAdmin) {
      authorizedBy = "admin";
      adminId = userId;
    } else if (authType === "apikey") {
      authorizedBy = "apikey";
      apiKeyId = userId;
    } else {
      return c.json(createErrorResponse(ApiStatus.FORBIDDEN, "需要管理员权限或有效的API密钥才能取消URL上传"), ApiStatus.FORBIDDEN);
    }

    try {
      const body = await c.req.json();

      // 验证必要参数
      if (!body.file_id) {
        return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "缺少文件ID参数"), ApiStatus.BAD_REQUEST);
      }

      // 查询文件记录
      const file = await db
        .prepare(
          `
          SELECT id, created_by, s3_config_id, storage_path
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
        return c.json(createErrorResponse(ApiStatus.FORBIDDEN, "您无权取消此文件的上传"), ApiStatus.FORBIDDEN);
      }

      if (authorizedBy === "apikey" && file.created_by && file.created_by !== `apikey:${apiKeyId}`) {
        return c.json(createErrorResponse(ApiStatus.FORBIDDEN, "此API密钥无权取消此文件的上传"), ApiStatus.FORBIDDEN);
      }

      // 获取S3配置
      const s3Config = await db.prepare(`SELECT * FROM ${DbTables.S3_CONFIGS} WHERE id = ?`).bind(file.s3_config_id).first();

      if (!s3Config) {
        // 如果S3配置不存在，仍然尝试删除文件记录
        console.warn(`找不到S3配置(ID=${file.s3_config_id})，仅删除文件记录`);
      } else {
        // 尝试从S3删除文件
        try {
          const encryptionSecret = c.env.ENCRYPTION_SECRET || "default-encryption-key";
          await deleteFileFromS3(s3Config, file.storage_path, encryptionSecret);
          console.log(`已从S3删除文件: ${file.storage_path}`);
        } catch (s3Error) {
          // 如果S3删除失败，记录错误但继续删除数据库记录
          console.error(`从S3删除文件失败: ${s3Error.message}`);
        }
      }

      // 删除文件密码记录（如果存在）
      await db.prepare(`DELETE FROM ${DbTables.FILE_PASSWORDS} WHERE file_id = ?`).bind(file.id).run();

      // 删除文件记录
      await db.prepare(`DELETE FROM ${DbTables.FILES} WHERE id = ?`).bind(file.id).run();

      // 清除与文件相关的缓存 - 使用统一的clearCache函数
      try {
        await clearCache({ db, s3ConfigId: file.s3_config_id });
      } catch (cacheError) {
        console.warn(`清除文件缓存失败: ${cacheError.message}`);
      }

      // 返回成功响应
      return c.json({
        code: ApiStatus.SUCCESS,
        message: "URL上传已成功取消",
        data: {
          file_id: file.id,
          status: "cancelled",
          message: "文件记录已被删除",
        },
        success: true,
      });
    } catch (error) {
      console.error("取消URL上传错误:", error);

      // 确定适当的状态码
      let statusCode = ApiStatus.INTERNAL_ERROR;
      if (error.message.includes("文件不存在")) {
        statusCode = ApiStatus.NOT_FOUND;
      }

      return c.json(createErrorResponse(statusCode, "取消URL上传失败: " + error.message), statusCode);
    }
  });
}
