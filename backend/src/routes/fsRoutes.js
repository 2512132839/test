/**
 * 统一文件系统API路由
 * 重构版本：统一 /api/fs/* 路由，内部处理管理员和API密钥用户认证
 * 消除原有的 /api/admin/fs/* 和 /api/user/fs/* 重复代码
 */
import { Hono } from "hono";
import { baseAuthMiddleware } from "../middlewares/permissionMiddleware.js";
import { PermissionType } from "../utils/permissionUtils.js";
import { createErrorResponse, generateFileId } from "../utils/common.js";
import { ApiStatus } from "../constants/index.js";
import { HTTPException } from "hono/http-exception";
import {
  listDirectory,
  getFileInfo,
  downloadFile,
  createDirectory,
  uploadFile,
  removeItem,
  renameItem,
  batchRemoveItems,
  getFilePresignedUrl,
  updateFile,
  batchCopyItems,
} from "../services/fsService.js";
import { searchFiles } from "../services/searchService.js";
import { findMountPointByPath } from "../webdav/utils/webdavUtils.js";
import { generatePresignedPutUrl, buildS3Url } from "../utils/s3Utils.js";
import { clearCache } from "../utils/DirectoryCache.js";
import { handleInitMultipartUpload, handleUploadPart, handleCompleteMultipartUpload, handleAbortMultipartUpload } from "../controllers/multipartUploadController.js";
import { checkPathPermissionForOperation } from "../services/apiKeyService.js";

// 创建文件系统路由处理程序
const fsRoutes = new Hono();

/**
 * 设置CORS标头
 * @param {HonoContext} c - Hono上下文
 */
function setCorsHeaders(c) {
  // 获取请求的origin并返回相同的值作为Access-Control-Allow-Origin
  // 这是为了支持credentials的情况下正确处理CORS
  const origin = c.req.header("Origin");
  c.header("Access-Control-Allow-Origin", origin || "*");

  c.header("Access-Control-Allow-Headers", "Content-Type, Content-Length, Authorization, X-Requested-With, Range");
  c.header("Access-Control-Expose-Headers", "ETag, Content-Length, Content-Disposition");
  c.header("Access-Control-Allow-Credentials", "true");
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

  // 对于预览和下载请求，添加适当的缓存时间
  if (c.req.path.includes("/preview") || c.req.path.includes("/download")) {
    c.header("Access-Control-Max-Age", "3600"); // 1小时
  }
}

/**
 * 统一的文件系统认证中间件
 * 处理管理员和API密钥用户的认证，并设置统一的用户信息到上下文
 */
const unifiedFsAuthMiddleware = async (c, next) => {
  const authResult = c.get("authResult");

  if (!authResult || !authResult.isAuthenticated) {
    throw new HTTPException(ApiStatus.UNAUTHORIZED, { message: "需要认证访问" });
  }

  if (authResult.isAdmin()) {
    // 管理员用户
    c.set("userInfo", {
      type: "admin",
      id: authResult.getUserId(),
      hasFullAccess: true,
    });
  } else if (authResult.hasPermission(PermissionType.FILE)) {
    // API密钥用户
    c.set("userInfo", {
      type: "apiKey",
      info: authResult.keyInfo, 
      hasFullAccess: false,
    });
  } else {
    throw new HTTPException(ApiStatus.FORBIDDEN, { message: "需要文件权限" });
  }

  await next();
};

/**
 * 检查路径权限
 * @param {Object} userInfo - 用户信息对象
 * @param {string} path - 要检查的路径
 * @returns {boolean} 是否有权限
 */
const checkPathPermission = (userInfo, path) => {
  if (userInfo.hasFullAccess) {
    return true; // 管理员拥有所有权限
  }

  // API密钥用户需要检查路径权限
  return checkPathPermissionForOperation(userInfo.info.basicPath, path);
};

/**
 * 获取服务层调用参数
 * @param {Object} userInfo - 用户信息对象
 * @returns {Object} 服务层参数
 */
const getServiceParams = (userInfo) => {
  if (userInfo.type === "admin") {
    return { userIdOrInfo: userInfo.id, userType: "admin" };
  } else {
    return { userIdOrInfo: userInfo.info, userType: "apiKey" };
  }
};

/**
 * 获取创建者标识
 * @param {Object} userInfo - 用户信息对象
 * @returns {string} 创建者标识
 */
const getCreatedBy = (userInfo) => {
  if (userInfo.type === "admin") {
    return userInfo.id;
  } else {
    return `apikey:${userInfo.info.id}`;
  }
};

// 应用基础认证和统一文件系统认证中间件到所有 /api/fs/* 路由
fsRoutes.use("/api/fs/*", baseAuthMiddleware, unifiedFsAuthMiddleware);

// ================ OPTIONS 请求处理 ================

// 处理预览和下载接口的OPTIONS请求
fsRoutes.options("/api/fs/preview", (c) => {
  setCorsHeaders(c);
  return c.text("", 204); // No Content
});

fsRoutes.options("/api/fs/download", (c) => {
  setCorsHeaders(c);
  return c.text("", 204); // No Content
});

// OPTIONS处理 - 分片上传相关，专门处理预检请求
fsRoutes.options("/api/fs/multipart/:action", (c) => {
  setCorsHeaders(c);
  c.header("Access-Control-Allow-Methods", "OPTIONS, POST");
  c.header("Access-Control-Max-Age", "86400");
  return c.text("", 204);
});

// 专门处理OPTIONS请求 - 分片上传
fsRoutes.options("/api/fs/multipart/part", (c) => {
  setCorsHeaders(c);
  c.header("Access-Control-Allow-Methods", "OPTIONS, POST");
  c.header("Access-Control-Max-Age", "86400"); // 24小时缓存预检响应
  return c.text("", 204); // No Content
});

// ================ 基础文件系统操作 ================

// 列出目录内容
fsRoutes.get("/api/fs/list", async (c) => {
  const db = c.env.DB;
  const path = c.req.query("path") || "/";
  const userInfo = c.get("userInfo");
  const { userIdOrInfo, userType } = getServiceParams(userInfo);

  try {
    const result = await listDirectory(db, path, userIdOrInfo, userType, c.env.ENCRYPTION_SECRET);
    return c.json({
      code: ApiStatus.SUCCESS,
      message: "获取目录列表成功",
      data: result,
      success: true,
    });
  } catch (error) {
    console.error("获取目录列表错误:", error);
    if (error instanceof HTTPException) {
      return c.json(createErrorResponse(error.status, error.message), error.status);
    }
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "获取目录列表失败"), ApiStatus.INTERNAL_ERROR);
  }
});

// 获取文件信息
fsRoutes.get("/api/fs/get", async (c) => {
  const db = c.env.DB;
  const path = c.req.query("path");
  const userInfo = c.get("userInfo");
  const { userIdOrInfo, userType } = getServiceParams(userInfo);

  if (!path) {
    return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供文件路径"), ApiStatus.BAD_REQUEST);
  }

  try {
    const result = await getFileInfo(db, path, userIdOrInfo, userType, c.env.ENCRYPTION_SECRET);
    return c.json({
      code: ApiStatus.SUCCESS,
      message: "获取文件信息成功",
      data: result,
      success: true,
    });
  } catch (error) {
    console.error("获取文件信息错误:", error);
    if (error instanceof HTTPException) {
      return c.json(createErrorResponse(error.status, error.message), error.status);
    }
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "获取文件信息失败"), ApiStatus.INTERNAL_ERROR);
  }
});

// 下载文件
fsRoutes.get("/api/fs/download", async (c) => {
  const db = c.env.DB;
  const path = c.req.query("path");
  const userInfo = c.get("userInfo");
  const { userIdOrInfo, userType } = getServiceParams(userInfo);

  if (!path) {
    setCorsHeaders(c);
    return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供文件路径"), ApiStatus.BAD_REQUEST);
  }

  try {
    const response = await downloadFile(db, path, userIdOrInfo, userType, c.env.ENCRYPTION_SECRET, c.req.raw);
    setCorsHeaders(c);
    return response;
  } catch (error) {
    console.error("下载文件错误:", error);
    setCorsHeaders(c);
    if (error instanceof HTTPException) {
      return c.json(createErrorResponse(error.status, error.message), error.status);
    }
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "下载文件失败"), ApiStatus.INTERNAL_ERROR);
  }
});

// 创建目录
fsRoutes.post("/api/fs/mkdir", async (c) => {
  const db = c.env.DB;
  const userInfo = c.get("userInfo");
  const { userIdOrInfo, userType } = getServiceParams(userInfo);
  const body = await c.req.json();
  const path = body.path;

  if (!path) {
    return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供目录路径"), ApiStatus.BAD_REQUEST);
  }

  // 检查路径权限（仅对API密钥用户）
  if (!checkPathPermission(userInfo, path)) {
    return c.json(createErrorResponse(ApiStatus.FORBIDDEN, "没有权限在此路径创建目录"), ApiStatus.FORBIDDEN);
  }

  try {
    await createDirectory(db, path, userIdOrInfo, userType, c.env.ENCRYPTION_SECRET);
    return c.json({
      code: ApiStatus.SUCCESS,
      message: "目录创建成功",
      success: true,
    });
  } catch (error) {
    console.error("创建目录错误:", error);
    if (error instanceof HTTPException) {
      return c.json(createErrorResponse(error.status, error.message), error.status);
    }
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "创建目录失败"), ApiStatus.INTERNAL_ERROR);
  }
});

// 上传文件
fsRoutes.post("/api/fs/upload", async (c) => {
  const db = c.env.DB;
  const userInfo = c.get("userInfo");
  const { userIdOrInfo, userType } = getServiceParams(userInfo);

  try {
    const formData = await c.req.formData();
    const file = formData.get("file");
    const path = formData.get("path");
    const useMultipart = formData.get("use_multipart") === "true";

    if (!file || !path) {
      return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供文件和路径"), ApiStatus.BAD_REQUEST);
    }

    // 检查路径权限（仅对API密钥用户）
    if (!checkPathPermission(userInfo, path)) {
      return c.json(createErrorResponse(ApiStatus.FORBIDDEN, "没有权限在此路径上传文件"), ApiStatus.FORBIDDEN);
    }

    const result = await uploadFile(db, path, file, userIdOrInfo, userType, c.env.ENCRYPTION_SECRET, useMultipart);

    // 如果是分片上传，返回相关信息
    if (result.useMultipart) {
      return c.json({
        code: ApiStatus.SUCCESS,
        message: "需要使用分片上传",
        data: result,
        success: true,
      });
    }

    // 常规上传成功
    return c.json({
      code: ApiStatus.SUCCESS,
      message: "文件上传成功",
      data: result,
      success: true,
    });
  } catch (error) {
    console.error("上传文件错误:", error);
    if (error instanceof HTTPException) {
      return c.json(createErrorResponse(error.status, error.message), error.status);
    }
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "上传文件失败"), ApiStatus.INTERNAL_ERROR);
  }
});

// 删除文件或目录
fsRoutes.delete("/api/fs/remove", async (c) => {
  const db = c.env.DB;
  const userInfo = c.get("userInfo");
  const { userIdOrInfo, userType } = getServiceParams(userInfo);
  const path = c.req.query("path");

  if (!path) {
    return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供路径"), ApiStatus.BAD_REQUEST);
  }

  // 检查路径权限（仅对API密钥用户）
  if (!checkPathPermission(userInfo, path)) {
    return c.json(createErrorResponse(ApiStatus.FORBIDDEN, "没有权限删除此路径的文件"), ApiStatus.FORBIDDEN);
  }

  try {
    await removeItem(db, path, userIdOrInfo, userType, c.env.ENCRYPTION_SECRET);
    return c.json({
      code: ApiStatus.SUCCESS,
      message: "删除成功",
      success: true,
    });
  } catch (error) {
    console.error("删除错误:", error);
    if (error instanceof HTTPException) {
      return c.json(createErrorResponse(error.status, error.message), error.status);
    }
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "删除失败"), ApiStatus.INTERNAL_ERROR);
  }
});

// 重命名文件或目录
fsRoutes.post("/api/fs/rename", async (c) => {
  const db = c.env.DB;
  const userInfo = c.get("userInfo");
  const { userIdOrInfo, userType } = getServiceParams(userInfo);
  const body = await c.req.json();
  const oldPath = body.oldPath;
  const newPath = body.newPath;

  if (!oldPath || !newPath) {
    return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供原路径和新路径"), ApiStatus.BAD_REQUEST);
  }

  // 检查路径权限（仅对API密钥用户）
  if (!checkPathPermission(userInfo, oldPath) || !checkPathPermission(userInfo, newPath)) {
    return c.json(createErrorResponse(ApiStatus.FORBIDDEN, "没有权限重命名此路径的文件"), ApiStatus.FORBIDDEN);
  }

  try {
    await renameItem(db, oldPath, newPath, userIdOrInfo, userType, c.env.ENCRYPTION_SECRET);
    return c.json({
      code: ApiStatus.SUCCESS,
      message: "重命名成功",
      success: true,
    });
  } catch (error) {
    console.error("重命名错误:", error);
    if (error instanceof HTTPException) {
      return c.json(createErrorResponse(error.status, error.message), error.status);
    }
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "重命名失败"), ApiStatus.INTERNAL_ERROR);
  }
});

// 批量删除文件或目录
fsRoutes.post("/api/fs/batch-remove", async (c) => {
  const db = c.env.DB;
  const userInfo = c.get("userInfo");
  const { userIdOrInfo, userType } = getServiceParams(userInfo);
  const body = await c.req.json();
  const paths = body.paths;

  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供有效的路径数组"), ApiStatus.BAD_REQUEST);
  }

  // 检查所有路径的操作权限（仅对API密钥用户）
  if (!userInfo.hasFullAccess) {
    for (const path of paths) {
      if (!checkPathPermission(userInfo, path)) {
        return c.json(createErrorResponse(ApiStatus.FORBIDDEN, `没有权限删除路径: ${path}`), ApiStatus.FORBIDDEN);
      }
    }
  }

  try {
    const result = await batchRemoveItems(db, paths, userIdOrInfo, userType, c.env.ENCRYPTION_SECRET);
    return c.json({
      code: ApiStatus.SUCCESS,
      message: "批量删除完成",
      data: result,
      success: true,
    });
  } catch (error) {
    console.error("批量删除错误:", error);
    if (error instanceof HTTPException) {
      return c.json(createErrorResponse(error.status, error.message), error.status);
    }
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "批量删除失败"), ApiStatus.INTERNAL_ERROR);
  }
});

// ================ 分片上传相关路由 ================

// 初始化分片上传
fsRoutes.post("/api/fs/multipart/init", async (c) => {
  try {
    setCorsHeaders(c);
    return await handleInitMultipartUpload(c);
  } catch (error) {
    setCorsHeaders(c);
    if (error instanceof HTTPException) {
      return c.json(
        {
          success: false,
          message: error.message,
          code: error.status,
        },
        error.status
      );
    }
    return c.json(
      {
        success: false,
        message: error.message || "初始化分片上传失败",
        code: ApiStatus.INTERNAL_ERROR,
      },
      ApiStatus.INTERNAL_ERROR
    );
  }
});

// 上传分片
fsRoutes.post("/api/fs/multipart/part", async (c) => {
  try {
    // 设置CORS头部
    setCorsHeaders(c);

    // 调用实际的处理函数
    return await handleUploadPart(c);
  } catch (error) {
    // 确保即使发生错误，也添加CORS头部
    setCorsHeaders(c);

    // 返回适当的错误响应
    if (error instanceof HTTPException) {
      return c.json(
        {
          success: false,
          message: error.message,
          code: error.status,
        },
        error.status
      );
    }

    return c.json(
      {
        success: false,
        message: error.message || "上传分片失败",
        code: ApiStatus.INTERNAL_ERROR,
      },
      ApiStatus.INTERNAL_ERROR
    );
  }
});

// 完成分片上传
fsRoutes.post("/api/fs/multipart/complete", async (c) => {
  try {
    setCorsHeaders(c);
    return await handleCompleteMultipartUpload(c);
  } catch (error) {
    setCorsHeaders(c);
    if (error instanceof HTTPException) {
      return c.json(
        {
          success: false,
          message: error.message,
          code: error.status,
        },
        error.status
      );
    }
    return c.json(
      {
        success: false,
        message: error.message || "完成分片上传失败",
        code: ApiStatus.INTERNAL_ERROR,
      },
      ApiStatus.INTERNAL_ERROR
    );
  }
});

// 中止分片上传
fsRoutes.post("/api/fs/multipart/abort", async (c) => {
  try {
    setCorsHeaders(c);
    return await handleAbortMultipartUpload(c);
  } catch (error) {
    setCorsHeaders(c);
    if (error instanceof HTTPException) {
      return c.json(
        {
          success: false,
          message: error.message,
          code: error.status,
        },
        error.status
      );
    }
    return c.json(
      {
        success: false,
        message: error.message || "中止分片上传失败",
        code: ApiStatus.INTERNAL_ERROR,
      },
      ApiStatus.INTERNAL_ERROR
    );
  }
});

// ================ 预签名URL相关路由 ================

// 获取预签名上传URL
fsRoutes.post("/api/fs/presign", async (c) => {
  try {
    // 获取必要的上下文
    const db = c.env.DB;
    const userInfo = c.get("userInfo");
    const { userIdOrInfo, userType } = getServiceParams(userInfo);
    const encryptionSecret = c.env.ENCRYPTION_SECRET || "default-encryption-key";

    // 解析请求数据
    const body = await c.req.json();
    const path = body.path;
    const fileName = body.fileName;
    const contentType = body.contentType || "application/octet-stream";
    const fileSize = body.fileSize || 0;

    if (!path || !fileName) {
      return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供上传路径和文件名"), ApiStatus.BAD_REQUEST);
    }

    // 检查操作权限（仅对API密钥用户）
    const tempTargetPath = path.endsWith("/") ? path + fileName : path + "/" + fileName;
    if (!checkPathPermission(userInfo, tempTargetPath)) {
      return c.json(createErrorResponse(ApiStatus.FORBIDDEN, "没有权限在此路径上传文件"), ApiStatus.FORBIDDEN);
    }

    // 直接使用findMountPointByPath而不是getFileInfo来获取挂载点信息
    const mountResult = await findMountPointByPath(db, path, userIdOrInfo, userType);

    // 处理错误情况
    if (mountResult.error) {
      return c.json(createErrorResponse(mountResult.error.status, mountResult.error.message), mountResult.error.status);
    }

    const { mount, subPath } = mountResult;

    if (!mount || mount.storage_type !== "S3") {
      return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "当前路径不支持预签名URL上传"), ApiStatus.BAD_REQUEST);
    }

    // 获取S3配置
    const s3Config = await db.prepare("SELECT * FROM s3_configs WHERE id = ?").bind(mount.storage_config_id).first();
    if (!s3Config) {
      return c.json(createErrorResponse(ApiStatus.NOT_FOUND, "存储配置不存在"), ApiStatus.NOT_FOUND);
    }

    // 构建完整的目标路径
    const targetPath = path.endsWith("/") ? path + fileName : path + "/" + fileName;

    // 计算文件相对于挂载点的路径
    let relativePathInMount;
    if (mount.mount_path === "/") {
      relativePathInMount = targetPath.substring(1); // 移除开头的斜杠
    } else {
      relativePathInMount = targetPath.substring(mount.mount_path.length);
      // 确保相对路径以斜杠开头
      if (!relativePathInMount.startsWith("/")) {
        relativePathInMount = "/" + relativePathInMount;
      }
      // 移除开头的斜杠以符合S3路径要求
      relativePathInMount = relativePathInMount.substring(1);
    }

    // S3路径构建 - 与目录列表逻辑保持一致，只使用root_prefix
    const rootPrefix = s3Config.root_prefix ? (s3Config.root_prefix.endsWith("/") ? s3Config.root_prefix : s3Config.root_prefix + "/") : "";
    let s3Path = rootPrefix + relativePathInMount;

    // 确保s3Path不为空
    if (!s3Path) {
      s3Path = fileName;
    }

    console.log(`生成预签名URL，路径: ${s3Path}`);

    // 统一从文件名推断MIME类型，确保预签名上传使用正确的Content-Type
    const { getMimeTypeFromFilename } = await import("../utils/fileUtils.js");
    const finalContentType = getMimeTypeFromFilename(fileName);
    console.log(`预签名上传：从文件名[${fileName}]推断MIME类型: ${finalContentType}`);

    // 生成预签名URL，使用S3配置的默认时效
    const presignedUrl = await generatePresignedPutUrl(s3Config, s3Path, finalContentType, encryptionSecret);

    // 构建S3直接访问URL
    const s3Url = buildS3Url(s3Config, s3Path);

    // 生成文件ID，用于后续提交更新
    const fileId = generateFileId();

    return c.json({
      code: ApiStatus.SUCCESS,
      message: "获取预签名URL成功",
      data: {
        presignedUrl,
        fileId,
        s3Path,
        s3Url,
        mountId: mount.id,
        s3ConfigId: s3Config.id,
        targetPath,
        contentType: finalContentType,
      },
      success: true,
    });
  } catch (error) {
    console.error("获取预签名URL错误:", error);
    if (error instanceof HTTPException) {
      return c.json(createErrorResponse(error.status, error.message), error.status);
    }
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "获取预签名URL失败"), ApiStatus.INTERNAL_ERROR);
  }
});

// 提交预签名URL上传完成
fsRoutes.post("/api/fs/presign/commit", async (c) => {
  try {
    // 获取必要的上下文
    const db = c.env.DB;
    const userInfo = c.get("userInfo");

    // 解析请求数据
    const body = await c.req.json();
    const fileId = body.fileId;
    const s3Path = body.s3Path;
    const s3Url = body.s3Url;
    const targetPath = body.targetPath;
    const s3ConfigId = body.s3ConfigId;
    const mountId = body.mountId;
    const etag = body.etag;
    const fileSize = body.fileSize || 0;

    if (!fileId || !s3Path || !s3ConfigId || !targetPath) {
      return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供完整的上传信息"), ApiStatus.BAD_REQUEST);
    }

    // 提取文件名
    const fileName = targetPath.split("/").filter(Boolean).pop();

    // 统一从文件名推断MIME类型，确保数据库存储正确的MIME类型
    const { getMimeTypeFromFilename } = await import("../utils/fileUtils.js");
    const contentType = getMimeTypeFromFilename(fileName);
    console.log(`预签名上传提交：从文件名[${fileName}]推断MIME类型: ${contentType}`);

    // 生成slug（使用文件ID的前8位作为slug）
    const fileSlug = "M-" + fileId.substring(0, 5);

    // 获取创建者标识
    const createdBy = getCreatedBy(userInfo);

    // 记录文件上传成功
    await db
      .prepare(
        `
      INSERT INTO files (
        id, filename, storage_path, s3_url, mimetype, size, s3_config_id, slug, etag, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
      )
      .bind(fileId, fileName, s3Path, s3Url, contentType, fileSize, s3ConfigId, fileSlug, etag, createdBy)
      .run();

    // 执行缓存清理
    try {
      await clearCache({ mountId: mountId });
      console.log(`预签名上传完成后缓存已刷新：挂载点=${mountId}, 文件=${fileName}`);
    } catch (cacheError) {
      console.warn(`执行缓存清理时出错: ${cacheError.message}`);
      // 缓存清理失败不应影响整体操作
    }

    return c.json({
      code: ApiStatus.SUCCESS,
      message: "文件上传记录成功",
      data: {
        fileId,
        fileName,
        targetPath,
        fileSize,
        contentType,
      },
      success: true,
    });
  } catch (error) {
    console.error("提交预签名上传完成错误:", error);
    if (error instanceof HTTPException) {
      return c.json(createErrorResponse(error.status, error.message), error.status);
    }
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "提交预签名上传完成失败"), ApiStatus.INTERNAL_ERROR);
  }
});

// 获取文件直链(预签名URL)
fsRoutes.get("/api/fs/file-link", async (c) => {
  const db = c.env.DB;
  const path = c.req.query("path");
  const userInfo = c.get("userInfo");
  const { userIdOrInfo, userType } = getServiceParams(userInfo);
  // 如果前端传入null或空值，则使用S3配置的默认签名时间，否则使用传入的值
  const expiresInParam = c.req.query("expires_in");
  const expiresIn = expiresInParam && expiresInParam !== "null" ? parseInt(expiresInParam) : null;
  const forceDownload = c.req.query("force_download") === "true";

  if (!path) {
    return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供文件路径"), ApiStatus.BAD_REQUEST);
  }

  try {
    const result = await getFilePresignedUrl(db, path, userIdOrInfo, userType, c.env.ENCRYPTION_SECRET, expiresIn, forceDownload);
    return c.json({
      code: ApiStatus.SUCCESS,
      message: "获取文件直链成功",
      data: result,
      success: true,
    });
  } catch (error) {
    console.error("获取文件直链错误:", error);
    if (error instanceof HTTPException) {
      return c.json(createErrorResponse(error.status, error.message), error.status);
    }
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "获取文件直链失败"), ApiStatus.INTERNAL_ERROR);
  }
});

// 更新文件内容
fsRoutes.post("/api/fs/update", async (c) => {
  const db = c.env.DB;
  const userInfo = c.get("userInfo");
  const { userIdOrInfo, userType } = getServiceParams(userInfo);
  const body = await c.req.json();
  const path = body.path;
  const content = body.content;

  if (!path || content === undefined) {
    return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供文件路径和内容"), ApiStatus.BAD_REQUEST);
  }

  // 检查路径权限（仅对API密钥用户）
  if (!checkPathPermission(userInfo, path)) {
    return c.json(createErrorResponse(ApiStatus.FORBIDDEN, "没有权限更新此路径的文件"), ApiStatus.FORBIDDEN);
  }

  try {
    const result = await updateFile(db, path, content, userIdOrInfo, userType, c.env.ENCRYPTION_SECRET);
    return c.json({
      code: ApiStatus.SUCCESS,
      message: "文件更新成功",
      data: result,
      success: true,
    });
  } catch (error) {
    console.error("更新文件错误:", error);
    if (error instanceof HTTPException) {
      return c.json(createErrorResponse(error.status, error.message), error.status);
    }
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "更新文件失败"), ApiStatus.INTERNAL_ERROR);
  }
});

// 批量复制文件或目录
fsRoutes.post("/api/fs/batch-copy", async (c) => {
  const db = c.env.DB;
  const userInfo = c.get("userInfo");
  const { userIdOrInfo, userType } = getServiceParams(userInfo);
  const body = await c.req.json();
  const items = body.items;
  const skipExisting = body.skipExisting !== false; // 默认为true

  if (!items || !Array.isArray(items) || items.length === 0) {
    return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供有效的复制项数组"), ApiStatus.BAD_REQUEST);
  }

  // 检查所有源路径和目标路径的操作权限（仅对API密钥用户）
  if (!userInfo.hasFullAccess) {
    for (const item of items) {
      if (!checkPathPermission(userInfo, item.sourcePath)) {
        return c.json(createErrorResponse(ApiStatus.FORBIDDEN, `没有权限访问源路径: ${item.sourcePath}`), ApiStatus.FORBIDDEN);
      }
      if (!checkPathPermission(userInfo, item.targetPath)) {
        return c.json(createErrorResponse(ApiStatus.FORBIDDEN, `没有权限访问目标路径: ${item.targetPath}`), ApiStatus.FORBIDDEN);
      }
    }
  }

  try {
    const result = await batchCopyItems(db, items, userIdOrInfo, userType, c.env.ENCRYPTION_SECRET, skipExisting);

    // 检查是否有跨存储复制操作
    if (result.hasCrossStorageOperations) {
      return c.json({
        code: ApiStatus.SUCCESS,
        message: `批量复制请求处理完成，包含跨存储操作`,
        data: {
          crossStorage: true,
          requiresClientSideCopy: true,
          standardCopyResults: {
            success: result.success,
            skipped: result.skipped,
            failed: result.failed.length,
          },
          crossStorageResults: result.crossStorageResults,
          failed: result.failed,
          details: result.details,
        },
        success: true,
      });
    }

    // 标准复制操作结果
    return c.json({
      code: ApiStatus.SUCCESS,
      message: `批量复制完成，成功: ${result.success}，跳过: ${result.skipped}，失败: ${result.failed.length}`,
      data: {
        crossStorage: false,
        success: result.success,
        skipped: result.skipped,
        failed: result.failed.length,
        details: result.details,
      },
      success: true,
    });
  } catch (error) {
    console.error("批量复制错误:", error);
    if (error instanceof HTTPException) {
      return c.json(createErrorResponse(error.status, error.message), error.status);
    }
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "批量复制失败"), ApiStatus.INTERNAL_ERROR);
  }
});

// 提交批量跨存储复制完成
fsRoutes.post("/api/fs/batch-copy-commit", async (c) => {
  const db = c.env.DB;
  const userInfo = c.get("userInfo");
  const body = await c.req.json();
  const { targetMountId, files } = body;

  if (!targetMountId || !Array.isArray(files) || files.length === 0) {
    return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供有效的目标挂载点ID和文件列表"), ApiStatus.BAD_REQUEST);
  }

  try {
    // 获取挂载点信息
    const mount = await db.prepare("SELECT * FROM storage_mounts WHERE id = ?").bind(targetMountId).first();
    if (!mount) {
      return c.json(createErrorResponse(ApiStatus.NOT_FOUND, "目标挂载点不存在"), ApiStatus.NOT_FOUND);
    }

    // 获取S3配置
    const s3Config = await db.prepare("SELECT * FROM s3_configs WHERE id = ?").bind(mount.storage_config_id).first();
    if (!s3Config) {
      return c.json(createErrorResponse(ApiStatus.NOT_FOUND, "存储配置不存在"), ApiStatus.NOT_FOUND);
    }

    // 用于存储结果
    const results = {
      success: [],
      failed: [],
    };

    // 处理每个文件
    for (const file of files) {
      try {
        const { targetPath, s3Path, contentType, fileSize, etag } = file;

        if (!targetPath || !s3Path) {
          results.failed.push({
            targetPath: targetPath || "未指定",
            error: "目标路径或S3路径不能为空",
          });
          continue;
        }

        // 提取文件名
        const fileName = targetPath.split("/").filter(Boolean).pop();

        results.success.push({
          targetPath,
          fileName,
        });
      } catch (fileError) {
        console.error("处理单个文件复制提交时出错:", fileError);
        results.failed.push({
          targetPath: file.targetPath || "未知路径",
          error: fileError.message || "处理文件时出错",
        });
      }
    }

    // 执行缓存清理 - 使用统一的clearCache函数
    try {
      await clearCache({ mountId: mount.id });
      console.log(`批量复制完成后缓存已刷新：挂载点=${mount.id}, 共处理了${results.success.length}个文件`);
    } catch (cacheError) {
      console.warn(`执行缓存清理时出错: ${cacheError.message}`);
      // 缓存清理失败不应影响整体操作
    }

    // 根据结果判断整体是否成功
    const hasFailures = results.failed.length > 0;
    const hasSuccess = results.success.length > 0;

    // 如果有失败且没有任何成功的项目，则认为完全失败
    const overallSuccess = hasSuccess;

    // 生成合适的消息
    let message;
    if (hasFailures && hasSuccess) {
      message = `批量复制部分完成，成功: ${results.success.length}，失败: ${results.failed.length}`;
    } else if (hasFailures) {
      message = `批量复制失败，成功: ${results.success.length}，失败: ${results.failed.length}`;
    } else {
      message = `批量复制完成，成功: ${results.success.length}，失败: ${results.failed.length}`;
    }

    return c.json({
      code: overallSuccess ? ApiStatus.SUCCESS : ApiStatus.ACCEPTED,
      message: message,
      data: results,
      success: overallSuccess,
    });
  } catch (error) {
    console.error("提交批量复制完成错误:", error);
    if (error instanceof HTTPException) {
      return c.json(createErrorResponse(error.status, error.message), error.status);
    }
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "提交批量复制完成失败"), ApiStatus.INTERNAL_ERROR);
  }
});

/**
 * 提取搜索参数
 * @param {Record<string, string>} queryParams - 查询参数对象
 * @returns {Object} 搜索参数对象
 */
function extractSearchParams(queryParams) {
  const query = queryParams.q || "";
  const scope = queryParams.scope || "global"; // global, mount, directory
  const mountId = queryParams.mount_id || "";
  const path = queryParams.path || "";
  const limit = parseInt(queryParams.limit) || 50;
  const offset = parseInt(queryParams.offset) || 0;

  return {
    query,
    scope,
    mountId,
    path,
    limit: Math.min(limit, 200), // 限制最大返回数量
    offset: Math.max(offset, 0),
  };
}

// 搜索文件
fsRoutes.get("/api/fs/search", async (c) => {
  const db = c.env.DB;
  const searchParams = extractSearchParams(c.req.query());
  const userInfo = c.get("userInfo");
  const { userIdOrInfo, userType } = getServiceParams(userInfo);

  // 参数验证
  if (!searchParams.query || searchParams.query.trim().length < 2) {
    return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "搜索查询至少需要2个字符"), ApiStatus.BAD_REQUEST);
  }

  try {
    const result = await searchFiles(db, searchParams, userIdOrInfo, userType, c.env.ENCRYPTION_SECRET);
    return c.json({
      code: ApiStatus.SUCCESS,
      message: "搜索完成",
      data: result,
      success: true,
    });
  } catch (error) {
    console.error("搜索文件错误:", error);
    if (error instanceof HTTPException) {
      return c.json(createErrorResponse(error.status, error.message), error.status);
    }
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "搜索文件失败"), ApiStatus.INTERNAL_ERROR);
  }
});

export default fsRoutes;
