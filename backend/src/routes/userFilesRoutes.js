import { DbTables } from "../constants/index.js";
import { ApiStatus } from "../constants/index.js";
import { createErrorResponse } from "../utils/common.js";
import { deleteFileFromS3 } from "../utils/s3Utils.js";
import { hashPassword, verifyPassword } from "../utils/crypto.js";
import {
  getFileBySlug,
  isFileAccessible,
  incrementAndCheckFileViews,
  generateFileDownloadUrl,
  getPublicFileInfo,
  getUserFileList,
  getUserFileDetail,
} from "../services/fileService.js";
import { clearCache } from "../utils/DirectoryCache.js";
import { baseAuthMiddleware, createFlexiblePermissionMiddleware } from "../middlewares/permissionMiddleware.js";
import { PermissionUtils, PermissionType } from "../utils/permissionUtils.js";
import { RepositoryFactory } from "../repositories/index.js";

// 创建文件权限中间件（管理员或API密钥文件权限）
const requireFilePermissionMiddleware = createFlexiblePermissionMiddleware({
  permissions: [PermissionType.FILE],
  allowAdmin: true,
});

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
            const repositoryFactory = new RepositoryFactory(db);
            const fileRepository = repositoryFactory.getFileRepository();
            const fileStillExists = await fileRepository.findById(file.id);
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
          const repositoryFactory = new RepositoryFactory(db);
          const fileRepository = repositoryFactory.getFileRepository();
          const fileStillExists = await fileRepository.findById(file.id);
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

      // 获取明文密码（与管理员接口保持一致）
      let fileWithPassword = result.file;
      if (result.file.password) {
        // 使用 RepositoryFactory 获取明文密码
        const repositoryFactory = new RepositoryFactory(db);
        const fileRepository = repositoryFactory.getFileRepository();
        const passwordInfo = await fileRepository.getFilePassword(result.file.id);
        if (passwordInfo && passwordInfo.plain_password) {
          fileWithPassword = {
            ...result.file,
            plain_password: passwordInfo.plain_password,
          };
        }
      }

      // 使用getPublicFileInfo函数构建完整的响应，包括代理链接
      const publicInfo = getPublicFileInfo(fileWithPassword, false, urlsObj);

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
  app.get("/api/user/files", baseAuthMiddleware, requireFilePermissionMiddleware, async (c) => {
    const db = c.env.DB;
    const apiKeyId = PermissionUtils.getUserId(c);
    const apiKeyInfo = PermissionUtils.getApiKeyInfo(c);

    try {
      // 获取查询参数
      const limit = parseInt(c.req.query("limit") || "30");
      const offset = parseInt(c.req.query("offset") || "0");

      // 使用FileService获取用户文件列表
      const result = await getUserFileList(db, apiKeyId, { limit, offset });

      return c.json({
        code: ApiStatus.SUCCESS,
        message: "获取文件列表成功",
        data: result,
        key_info: apiKeyInfo, // 返回API密钥信息
        success: true,
      });
    } catch (error) {
      console.error("获取API密钥用户文件列表错误:", error);
      return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "获取文件列表失败"), ApiStatus.INTERNAL_ERROR);
    }
  });

  // API密钥用户获取单个文件详情
  app.get("/api/user/files/:id", baseAuthMiddleware, requireFilePermissionMiddleware, async (c) => {
    const db = c.env.DB;
    const apiKeyId = PermissionUtils.getUserId(c);
    const { id } = c.req.param();
    const encryptionSecret = c.env.ENCRYPTION_SECRET || "default-encryption-key";

    try {
      // 使用FileService获取用户文件详情
      const result = await getUserFileDetail(db, id, apiKeyId, encryptionSecret, c.req.raw);

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

  // 批量删除文件（API密钥用户）
  app.delete("/api/user/files/batch-delete", baseAuthMiddleware, requireFilePermissionMiddleware, async (c) => {
    const db = c.env.DB;
    const apiKeyId = PermissionUtils.getUserId(c);
    const body = await c.req.json();
    const ids = body.ids;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供有效的文件ID数组"), ApiStatus.BAD_REQUEST);
    }

    // 结果统计
    const result = {
      success: 0,
      failed: [],
    };

    const encryptionSecret = c.env.ENCRYPTION_SECRET || "default-encryption-key";
    const s3ConfigIds = new Set(); // 收集需要清理缓存的S3配置ID
    const repositoryFactory = new RepositoryFactory(db);
    const fileRepository = repositoryFactory.getFileRepository();

    for (const id of ids) {
      try {
        // 获取文件信息（只能删除自己的文件）
        const file = await fileRepository.findByIdAndCreator(id, `apikey:${apiKeyId}`);

        if (!file) {
          result.failed.push({
            id: id,
            error: "文件不存在或无权删除",
          });
          continue;
        }

        // 收集S3配置ID用于缓存清理（仅对S3存储类型）
        if (file.storage_type === "S3" && file.storage_config_id) {
          s3ConfigIds.add(file.storage_config_id);
        }

        // 尝试从S3中删除文件
        try {
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
          console.error(`从S3删除文件错误 (ID: ${id}):`, s3Error);
          // 即使S3删除失败，也继续从数据库中删除记录
        }

        // 使用 FileRepository 从数据库中删除记录
        await fileRepository.deleteFile(id);

        result.success++;
      } catch (error) {
        console.error(`删除文件失败 (ID: ${id}):`, error);
        result.failed.push({
          id: id,
          error: error.message || "删除失败",
        });
      }
    }

    // 清除与文件相关的缓存
    try {
      for (const s3ConfigId of s3ConfigIds) {
        await clearCache({ db, s3ConfigId });
      }
      console.log(`批量删除操作完成后缓存已刷新：${s3ConfigIds.size} 个S3配置`);
    } catch (cacheError) {
      console.warn(`执行缓存清理时出错: ${cacheError.message}`);
    }

    return c.json({
      code: ApiStatus.SUCCESS,
      message: `批量删除完成，成功: ${result.success}，失败: ${result.failed.length}`,
      data: result,
      success: true,
    });
  });

  // API密钥用户更新自己文件的元数据
  app.put("/api/user/files/:id", baseAuthMiddleware, requireFilePermissionMiddleware, async (c) => {
    const db = c.env.DB;
    const apiKeyId = PermissionUtils.getUserId(c);
    const { id } = c.req.param();
    const body = await c.req.json();

    try {
      // 使用 FileRepository 检查文件是否存在且属于当前API密钥用户
      const repositoryFactory = new RepositoryFactory(db);
      const fileRepository = repositoryFactory.getFileRepository();

      const existingFile = await fileRepository.findOne(DbTables.FILES, {
        id: id,
        created_by: `apikey:${apiKeyId}`,
      });

      if (!existingFile) {
        return c.json(createErrorResponse(ApiStatus.NOT_FOUND, "文件不存在或无权更新"), ApiStatus.NOT_FOUND);
      }

      // 构建更新数据对象
      const updateData = {};

      // 处理可更新的字段
      if (body.remark !== undefined) {
        updateData.remark = body.remark;
      }

      if (body.slug !== undefined) {
        // 检查slug是否可用 (不与其他文件冲突)
        const slugExistsCheck = await fileRepository.findBySlugExcludingId(body.slug, id);

        if (slugExistsCheck) {
          return c.json(createErrorResponse(ApiStatus.CONFLICT, "此链接后缀已被其他文件使用"), ApiStatus.CONFLICT);
        }

        updateData.slug = body.slug;
      }

      // 处理过期时间
      if (body.expires_at !== undefined) {
        updateData.expires_at = body.expires_at;
      }

      // 处理Worker代理访问设置
      if (body.use_proxy !== undefined) {
        updateData.use_proxy = body.use_proxy ? 1 : 0;
      }

      // 处理最大查看次数
      if (body.max_views !== undefined) {
        updateData.max_views = body.max_views;
        updateData.views = 0; // 当修改max_views时，重置views计数为0
      }

      // 处理密码变更
      if (body.password !== undefined) {
        if (body.password) {
          // 设置新密码
          const passwordHash = await hashPassword(body.password);
          updateData.password = passwordHash;

          // 使用 FileRepository 更新或插入明文密码
          await fileRepository.upsertFilePasswordRecord(id, body.password);
        } else {
          // 明确提供了空密码，表示要清除密码
          updateData.password = null;

          // 使用 FileRepository 删除明文密码记录
          await fileRepository.deleteFilePasswordRecord(id);
        }
      }

      // 如果没有要更新的字段
      if (Object.keys(updateData).length === 0) {
        return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "没有提供有效的更新字段"), ApiStatus.BAD_REQUEST);
      }

      // 添加更新时间
      updateData.updated_at = new Date().toISOString();

      // 使用 Repository 更新文件（只能更新自己创建的文件）
      await fileRepository.updateFile(id, updateData);

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
