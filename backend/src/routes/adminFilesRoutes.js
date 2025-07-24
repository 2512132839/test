import { DbTables } from "../constants/index.js";
import { ApiStatus } from "../constants/index.js";
import { createErrorResponse } from "../utils/common.js";
import { deleteFileFromS3 } from "../utils/s3Utils.js";
import { hashPassword } from "../utils/crypto.js";
import { generateFileDownloadUrl, getAdminFileList, getAdminFileDetail } from "../services/fileService.js";
import { directoryCacheManager, clearCache } from "../utils/DirectoryCache.js";
import { baseAuthMiddleware, requireAdminMiddleware } from "../middlewares/permissionMiddleware.js";
import { PermissionUtils } from "../utils/permissionUtils.js";
import { RepositoryFactory } from "../repositories/index.js";

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
  app.get("/api/admin/files", baseAuthMiddleware, requireAdminMiddleware, async (c) => {
    const db = c.env.DB;

    try {
      // 获取查询参数
      const limit = parseInt(c.req.query("limit") || "30");
      const offset = parseInt(c.req.query("offset") || "0");
      const createdBy = c.req.query("created_by");
      const s3ConfigId = c.req.query("s3_config_id");
      const storageConfigId = c.req.query("storage_config_id");
      const storageType = c.req.query("storage_type");

      // 构建查询选项
      const options = {
        limit,
        offset,
      };

      if (createdBy) options.createdBy = createdBy;
      if (s3ConfigId) options.s3ConfigId = s3ConfigId;

      // 使用FileService获取文件列表
      const result = await getAdminFileList(db, options);

      return c.json({
        code: ApiStatus.SUCCESS,
        message: "获取文件列表成功",
        data: result,
        success: true,
      });
    } catch (error) {
      console.error("获取管理员文件列表错误:", error);
      return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "获取文件列表失败"), ApiStatus.INTERNAL_ERROR);
    }
  });

  // 获取单个文件详情（仅管理员权限）
  app.get("/api/admin/files/:id", baseAuthMiddleware, requireAdminMiddleware, async (c) => {
    const db = c.env.DB;
    const { id } = c.req.param();
    const encryptionSecret = c.env.ENCRYPTION_SECRET || "default-encryption-key";

    try {
      // 使用FileService获取文件详情
      const result = await getAdminFileDetail(db, id, encryptionSecret, c.req.raw);

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

  // 批量删除文件（管理员）
  app.delete("/api/admin/files/batch-delete", baseAuthMiddleware, requireAdminMiddleware, async (c) => {
    const db = c.env.DB;
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

    // 使用 Repository 获取文件信息
    const repositoryFactory = new RepositoryFactory(db);
    const fileRepository = repositoryFactory.getFileRepository();

    for (const id of ids) {
      try {
        // 使用 FileRepository 获取文件信息（包含存储配置）
        const file = await fileRepository.findByIdWithStorageConfig(id);

        if (!file) {
          result.failed.push({
            id: id,
            error: "文件不存在",
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

        // 使用 FileRepository 删除记录和关联的密码记录
        // 首先删除密码记录
        await fileRepository.deleteFilePasswordRecord(id);
        // 然后删除文件记录
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

  // 管理员更新文件元数据
  app.put("/api/admin/files/:id", baseAuthMiddleware, requireAdminMiddleware, async (c) => {
    const db = c.env.DB;
    const { id } = c.req.param();
    const body = await c.req.json();

    try {
      // 使用 FileRepository 检查文件是否存在
      const repositoryFactory = new RepositoryFactory(db);
      const fileRepository = repositoryFactory.getFileRepository();

      const existingFile = await fileRepository.findById(id);

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
        // 使用 FileRepository 检查slug是否可用 (不与其他文件冲突)
        const existingFile = await fileRepository.findBySlug(body.slug);

        if (existingFile && existingFile.id !== id) {
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

      // 处理密码变更（明文密码记录）
      if (body.password !== undefined) {
        if (body.password) {
          // 使用 FileRepository 更新或插入明文密码
          await fileRepository.upsertFilePasswordRecord(id, body.password);
        } else {
          // 使用 FileRepository 删除明文密码记录
          await fileRepository.deleteFilePasswordRecord(id);
        }
      }

      // 使用 Repository 的动态更新方法
      const updateData = {};

      // 重新构建更新数据对象
      if (body.remark !== undefined) {
        updateData.remark = body.remark;
      }
      if (body.slug !== undefined) {
        updateData.slug = body.slug;
      }
      if (body.expires_at !== undefined) {
        updateData.expires_at = body.expires_at;
      }
      if (body.use_proxy !== undefined) {
        updateData.use_proxy = body.use_proxy ? 1 : 0;
      }
      if (body.max_views !== undefined) {
        updateData.max_views = body.max_views;
        updateData.views = 0; // 重置views计数
      }
      if (body.password !== undefined) {
        if (body.password) {
          const passwordHash = await hashPassword(body.password);
          updateData.password = passwordHash;
        } else {
          updateData.password = null;
        }
      }
      updateData.updated_at = new Date().toISOString();

      await fileRepository.updateFile(id, updateData);

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
