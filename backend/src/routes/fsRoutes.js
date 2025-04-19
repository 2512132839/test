/**
 * 文件系统API路由
 * 提供RESTful API接口用于前端访问和操作挂载的文件系统
 */
import { Hono } from "hono";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { apiKeyFileMiddleware } from "../middlewares/apiKeyMiddleware.js";
import { createErrorResponse, generateFileId } from "../utils/common.js";
import { ApiStatus } from "../constants/index.js";
import { HTTPException } from "hono/http-exception";
import { listDirectory, getFileInfo, downloadFile, createDirectory, uploadFile, removeItem, renameItem, previewFile, batchRemoveItems } from "../services/fsService.js";
import { findMountPointByPath } from "../webdav/utils/webdavUtils.js";
import { generatePresignedPutUrl, buildS3Url } from "../utils/s3Utils.js";
import { directoryCacheManager } from "../utils/DirectoryCache.js";
import { handleInitMultipartUpload, handleUploadPart, handleCompleteMultipartUpload, handleAbortMultipartUpload } from "../controllers/multipartUploadController.js";

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

  c.header("Access-Control-Allow-Headers", "Content-Type, Content-Length, Authorization, X-Requested-With");
  c.header("Access-Control-Expose-Headers", "ETag, Content-Length, Content-Disposition, Access-Control-Allow-Origin");
  c.header("Access-Control-Allow-Credentials", "true");
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

  // 对于预览和下载请求，添加一个更长的缓存时间
  if (c.req.path.includes("/preview") || c.req.path.includes("/download")) {
    c.header("Access-Control-Max-Age", "3600"); // 1小时
  }
}

// 管理员文件系统访问
fsRoutes.use("/api/admin/fs/*", authMiddleware);

// API密钥用户文件系统访问
fsRoutes.use("/api/user/fs/*", apiKeyFileMiddleware);

// 列出目录内容 - 管理员版本
fsRoutes.get("/api/admin/fs/list", async (c) => {
  const db = c.env.DB;
  const path = c.req.query("path") || "/";
  const adminId = c.get("adminId");

  try {
    const result = await listDirectory(db, path, adminId, "admin", c.env.ENCRYPTION_SECRET);
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

// 列出目录内容 - API密钥用户版本
fsRoutes.get("/api/user/fs/list", async (c) => {
  const db = c.env.DB;
  const path = c.req.query("path") || "/";
  const apiKeyId = c.get("apiKeyId");

  try {
    const result = await listDirectory(db, path, apiKeyId, "apiKey", c.env.ENCRYPTION_SECRET);
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

// 获取文件信息 - 管理员版本
fsRoutes.get("/api/admin/fs/get", async (c) => {
  const db = c.env.DB;
  const path = c.req.query("path");
  const adminId = c.get("adminId");

  if (!path) {
    return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供文件路径"), ApiStatus.BAD_REQUEST);
  }

  try {
    const result = await getFileInfo(db, path, adminId, "admin", c.env.ENCRYPTION_SECRET);
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

// 获取文件信息 - API密钥用户版本
fsRoutes.get("/api/user/fs/get", async (c) => {
  const db = c.env.DB;
  const path = c.req.query("path");
  const apiKeyId = c.get("apiKeyId");

  if (!path) {
    return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供文件路径"), ApiStatus.BAD_REQUEST);
  }

  try {
    const result = await getFileInfo(db, path, apiKeyId, "apiKey", c.env.ENCRYPTION_SECRET);
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

// 下载文件 - 管理员版本
fsRoutes.get("/api/admin/fs/download", async (c) => {
  const db = c.env.DB;
  const path = c.req.query("path");
  const adminId = c.get("adminId");

  // 设置CORS头部
  setCorsHeaders(c);

  if (!path) {
    return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供文件路径"), ApiStatus.BAD_REQUEST);
  }

  try {
    return await downloadFile(db, path, adminId, "admin", c.env.ENCRYPTION_SECRET);
  } catch (error) {
    // 确保即使发生错误，也添加CORS头部
    setCorsHeaders(c);
    console.error("下载文件错误:", error);
    if (error instanceof HTTPException) {
      return c.json(createErrorResponse(error.status, error.message), error.status);
    }
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "下载文件失败"), ApiStatus.INTERNAL_ERROR);
  }
});

// 预览文件 - 管理员版本
fsRoutes.get("/api/admin/fs/preview", async (c) => {
  const db = c.env.DB;
  const path = c.req.query("path");
  const adminId = c.get("adminId");

  // 设置CORS头部
  setCorsHeaders(c);

  if (!path) {
    return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供文件路径"), ApiStatus.BAD_REQUEST);
  }

  try {
    return await previewFile(db, path, adminId, "admin", c.env.ENCRYPTION_SECRET);
  } catch (error) {
    // 确保即使发生错误，也添加CORS头部
    setCorsHeaders(c);
    console.error("预览文件错误:", error);
    if (error instanceof HTTPException) {
      return c.json(createErrorResponse(error.status, error.message), error.status);
    }
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "预览文件失败"), ApiStatus.INTERNAL_ERROR);
  }
});

// 下载文件 - API密钥用户版本
fsRoutes.get("/api/user/fs/download", async (c) => {
  const db = c.env.DB;
  const path = c.req.query("path");
  const apiKeyId = c.get("apiKeyId");

  // 设置CORS头部
  setCorsHeaders(c);

  if (!path) {
    return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供文件路径"), ApiStatus.BAD_REQUEST);
  }

  try {
    return await downloadFile(db, path, apiKeyId, "apiKey", c.env.ENCRYPTION_SECRET);
  } catch (error) {
    // 确保即使发生错误，也添加CORS头部
    setCorsHeaders(c);
    console.error("下载文件错误:", error);
    if (error instanceof HTTPException) {
      return c.json(createErrorResponse(error.status, error.message), error.status);
    }
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "下载文件失败"), ApiStatus.INTERNAL_ERROR);
  }
});

// 预览文件 - API密钥用户版本
fsRoutes.get("/api/user/fs/preview", async (c) => {
  const db = c.env.DB;
  const path = c.req.query("path");
  const apiKeyId = c.get("apiKeyId");

  // 设置CORS头部
  setCorsHeaders(c);

  if (!path) {
    return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供文件路径"), ApiStatus.BAD_REQUEST);
  }

  try {
    return await previewFile(db, path, apiKeyId, "apiKey", c.env.ENCRYPTION_SECRET);
  } catch (error) {
    // 确保即使发生错误，也添加CORS头部
    setCorsHeaders(c);
    console.error("预览文件错误:", error);
    if (error instanceof HTTPException) {
      return c.json(createErrorResponse(error.status, error.message), error.status);
    }
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "预览文件失败"), ApiStatus.INTERNAL_ERROR);
  }
});

// 创建目录 - 管理员版本
fsRoutes.post("/api/admin/fs/mkdir", async (c) => {
  const db = c.env.DB;
  const adminId = c.get("adminId");
  const body = await c.req.json();
  const path = body.path;

  if (!path) {
    return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供目录路径"), ApiStatus.BAD_REQUEST);
  }

  try {
    await createDirectory(db, path, adminId, "admin", c.env.ENCRYPTION_SECRET);
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

// 创建目录 - API密钥用户版本
fsRoutes.post("/api/user/fs/mkdir", async (c) => {
  const db = c.env.DB;
  const apiKeyId = c.get("apiKeyId");
  const body = await c.req.json();
  const path = body.path;

  if (!path) {
    return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供目录路径"), ApiStatus.BAD_REQUEST);
  }

  try {
    await createDirectory(db, path, apiKeyId, "apiKey", c.env.ENCRYPTION_SECRET);
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

// 上传文件 - 管理员版本
fsRoutes.post("/api/admin/fs/upload", async (c) => {
  const db = c.env.DB;
  const adminId = c.get("adminId");

  try {
    const formData = await c.req.formData();
    const file = formData.get("file");
    const path = formData.get("path");
    const useMultipart = formData.get("use_multipart") === "true";

    if (!file || !path) {
      return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供文件和路径"), ApiStatus.BAD_REQUEST);
    }

    const result = await uploadFile(db, path, file, adminId, "admin", c.env.ENCRYPTION_SECRET, useMultipart);

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

// 上传文件 - API密钥用户版本
fsRoutes.post("/api/user/fs/upload", async (c) => {
  const db = c.env.DB;
  const apiKeyId = c.get("apiKeyId");

  try {
    const formData = await c.req.formData();
    const file = formData.get("file");
    const path = formData.get("path");
    const useMultipart = formData.get("use_multipart") === "true";

    if (!file || !path) {
      return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供文件和路径"), ApiStatus.BAD_REQUEST);
    }

    const result = await uploadFile(db, path, file, apiKeyId, "apiKey", c.env.ENCRYPTION_SECRET, useMultipart);

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

// 删除文件或目录 - 管理员版本
fsRoutes.delete("/api/admin/fs/remove", async (c) => {
  const db = c.env.DB;
  const adminId = c.get("adminId");
  const path = c.req.query("path");

  if (!path) {
    return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供路径"), ApiStatus.BAD_REQUEST);
  }

  try {
    await removeItem(db, path, adminId, "admin", c.env.ENCRYPTION_SECRET);
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

// 删除文件或目录 - API密钥用户版本
fsRoutes.delete("/api/user/fs/remove", async (c) => {
  const db = c.env.DB;
  const apiKeyId = c.get("apiKeyId");
  const path = c.req.query("path");

  if (!path) {
    return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供路径"), ApiStatus.BAD_REQUEST);
  }

  try {
    await removeItem(db, path, apiKeyId, "apiKey", c.env.ENCRYPTION_SECRET);
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

// 批量删除文件或目录 - 管理员版本
fsRoutes.post("/api/admin/fs/batch-remove", async (c) => {
  const db = c.env.DB;
  const adminId = c.get("adminId");
  const body = await c.req.json();
  const paths = body.paths;

  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供有效的路径数组"), ApiStatus.BAD_REQUEST);
  }

  try {
    const result = await batchRemoveItems(db, paths, adminId, "admin", c.env.ENCRYPTION_SECRET);
    return c.json({
      code: ApiStatus.SUCCESS,
      message: `批量删除完成，成功: ${result.success}，失败: ${result.failed.length}`,
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

// 批量删除文件或目录 - API密钥用户版本
fsRoutes.post("/api/user/fs/batch-remove", async (c) => {
  const db = c.env.DB;
  const apiKeyId = c.get("apiKeyId");
  const body = await c.req.json();
  const paths = body.paths;

  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供有效的路径数组"), ApiStatus.BAD_REQUEST);
  }

  try {
    const result = await batchRemoveItems(db, paths, apiKeyId, "apiKey", c.env.ENCRYPTION_SECRET);
    return c.json({
      code: ApiStatus.SUCCESS,
      message: `批量删除完成，成功: ${result.success}，失败: ${result.failed.length}`,
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

// 重命名文件或目录 - 管理员版本
fsRoutes.post("/api/admin/fs/rename", async (c) => {
  const db = c.env.DB;
  const adminId = c.get("adminId");
  const body = await c.req.json();
  const oldPath = body.oldPath;
  const newPath = body.newPath;

  if (!oldPath || !newPath) {
    return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供源路径和目标路径"), ApiStatus.BAD_REQUEST);
  }

  try {
    await renameItem(db, oldPath, newPath, adminId, "admin", c.env.ENCRYPTION_SECRET);
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

// 重命名文件或目录 - API密钥用户版本
fsRoutes.post("/api/user/fs/rename", async (c) => {
  const db = c.env.DB;
  const apiKeyId = c.get("apiKeyId");
  const body = await c.req.json();
  const oldPath = body.oldPath;
  const newPath = body.newPath;

  if (!oldPath || !newPath) {
    return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供源路径和目标路径"), ApiStatus.BAD_REQUEST);
  }

  try {
    await renameItem(db, oldPath, newPath, apiKeyId, "apiKey", c.env.ENCRYPTION_SECRET);
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

// ================ 分片上传相关路由 ================

// OPTIONS处理 - 管理员版本，专门处理预检请求
fsRoutes.options("/api/admin/fs/multipart/:action", (c) => {
  setCorsHeaders(c);
  c.header("Access-Control-Allow-Methods", "OPTIONS, POST");
  c.header("Access-Control-Max-Age", "86400");
  return c.text("", 204);
});

// 专门处理OPTIONS请求 - 管理员分片上传
fsRoutes.options("/api/admin/fs/multipart/part", (c) => {
  setCorsHeaders(c);
  c.header("Access-Control-Allow-Methods", "OPTIONS, POST");
  c.header("Access-Control-Max-Age", "86400"); // 24小时缓存预检响应
  return c.text("", 204); // No Content
});

// 初始化分片上传 - 管理员版本
fsRoutes.post("/api/admin/fs/multipart/init", authMiddleware, async (c) => {
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

// 上传分片 - 管理员版本
// 确保可以处理大型请求
fsRoutes.post("/api/admin/fs/multipart/part", authMiddleware, async (c) => {
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

// 完成分片上传 - 管理员版本
fsRoutes.post("/api/admin/fs/multipart/complete", authMiddleware, async (c) => {
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

// 中止分片上传 - 管理员版本
fsRoutes.post("/api/admin/fs/multipart/abort", authMiddleware, async (c) => {
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

// OPTIONS处理 - API密钥用户版本，专门处理预检请求
fsRoutes.options("/api/user/fs/multipart/:action", (c) => {
  setCorsHeaders(c);
  c.header("Access-Control-Allow-Methods", "OPTIONS, POST");
  c.header("Access-Control-Max-Age", "86400");
  return c.text("", 204);
});

// 专门处理OPTIONS请求 - 用户分片上传
fsRoutes.options("/api/user/fs/multipart/part", (c) => {
  setCorsHeaders(c);
  c.header("Access-Control-Allow-Methods", "OPTIONS, POST");
  c.header("Access-Control-Max-Age", "86400"); // 24小时缓存预检响应
  return c.text("", 204); // No Content
});

// 初始化分片上传 - API密钥用户版本
fsRoutes.post("/api/user/fs/multipart/init", apiKeyFileMiddleware, async (c) => {
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

// 上传分片 - API密钥用户版本
// 确保可以处理大型请求
fsRoutes.post("/api/user/fs/multipart/part", apiKeyFileMiddleware, async (c) => {
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

// 完成分片上传 - API密钥用户版本
fsRoutes.post("/api/user/fs/multipart/complete", apiKeyFileMiddleware, async (c) => {
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

// 中止分片上传 - API密钥用户版本
fsRoutes.post("/api/user/fs/multipart/abort", apiKeyFileMiddleware, async (c) => {
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

// ================ 预签名URL直传相关路由 ================

// 获取预签名上传URL - 管理员版本
fsRoutes.post("/api/admin/fs/presign", authMiddleware, async (c) => {
  try {
    // 获取必要的上下文
    const db = c.env.DB;
    const adminId = c.get("adminId");
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

    // 直接使用findMountPointByPath而不是getFileInfo来获取挂载点信息
    const mountResult = await findMountPointByPath(db, path, adminId, "admin");

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
      return c.json(createErrorResponse(ApiStatus.NOT_FOUND, "未找到存储配置"), ApiStatus.NOT_FOUND);
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

    // S3路径构建
    let s3Path = relativePathInMount;
    if (s3Config.default_folder) {
      s3Path = s3Config.default_folder.endsWith("/") ? s3Config.default_folder + s3Path : s3Config.default_folder + "/" + s3Path;
    }

    // 确保s3Path不为空
    if (!s3Path) {
      s3Path = fileName;
    }

    console.log(`生成预签名URL，路径: ${s3Path}`);

    // 生成预签名URL
    const presignedUrl = await generatePresignedPutUrl(s3Config, s3Path, contentType, encryptionSecret);

    // 构建S3直接访问URL
    const s3Url = buildS3Url(s3Config, s3Path);

    // 生成文件ID，用于后续提交更新
    const fileId = generateFileId();

    // 生成文件slug（使用文件ID的前8位作为slug）
    const fileSlug = "M-" + fileId.substring(0, 5);

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

// 获取预签名上传URL - API密钥用户版本
fsRoutes.post("/api/user/fs/presign", apiKeyFileMiddleware, async (c) => {
  try {
    // 获取必要的上下文
    const db = c.env.DB;
    const apiKeyId = c.get("apiKeyId");
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

    // 直接使用findMountPointByPath而不是getFileInfo来获取挂载点信息
    const mountResult = await findMountPointByPath(db, path, apiKeyId, "apiKey");

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
      return c.json(createErrorResponse(ApiStatus.NOT_FOUND, "未找到存储配置"), ApiStatus.NOT_FOUND);
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

    // S3路径构建
    let s3Path = relativePathInMount;
    if (s3Config.default_folder) {
      s3Path = s3Config.default_folder.endsWith("/") ? s3Config.default_folder + s3Path : s3Config.default_folder + "/" + s3Path;
    }

    // 确保s3Path不为空
    if (!s3Path) {
      s3Path = fileName;
    }

    console.log(`生成预签名URL，路径: ${s3Path}`);

    // 生成预签名URL
    const presignedUrl = await generatePresignedPutUrl(s3Config, s3Path, contentType, encryptionSecret);

    // 构建S3直接访问URL
    const s3Url = buildS3Url(s3Config, s3Path);

    // 生成文件ID，用于后续提交更新
    const fileId = generateFileId();

    // 生成文件slug（使用文件ID的前8位作为slug）
    const fileSlug = "M-" + fileId.substring(0, 8);

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

// 提交预签名URL上传成功 - 管理员版本
fsRoutes.post("/api/admin/fs/presign/commit", authMiddleware, async (c) => {
  try {
    // 获取必要的上下文
    const db = c.env.DB;
    const adminId = c.get("adminId");

    // 解析请求数据
    const body = await c.req.json();
    const fileId = body.fileId;
    const s3Path = body.s3Path;
    const s3Url = body.s3Url;
    const targetPath = body.targetPath;
    const s3ConfigId = body.s3ConfigId;
    const mountId = body.mountId;
    const etag = body.etag;
    const contentType = body.contentType || "application/octet-stream";
    const fileSize = body.fileSize || 0;

    if (!fileId || !s3Path || !s3ConfigId || !targetPath) {
      return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供完整的上传信息"), ApiStatus.BAD_REQUEST);
    }

    // 获取S3配置
    const s3Config = await db.prepare("SELECT * FROM s3_configs WHERE id = ?").bind(s3ConfigId).first();

    if (!s3Config) {
      return c.json(createErrorResponse(ApiStatus.NOT_FOUND, "未找到存储配置"), ApiStatus.NOT_FOUND);
    }

    // 提取文件名 - 改进的文件名提取逻辑
    // 尝试从targetPath中提取文件名
    let fileName = targetPath.split("/").filter(Boolean).pop();
    // 如果targetPath中没有提取到有效文件名，则尝试从s3Path中提取
    if (!fileName) {
      fileName = s3Path.split("/").filter(Boolean).pop();
    }
    // 如果两者都未提取到有效文件名，使用默认名称
    if (!fileName) {
      fileName = "unnamed_file";
    }

    // 生成slug（使用文件ID的前8位作为slug）
    const fileSlug = "M-" + fileId.substring(0, 5);

    // 记录文件上传成功
    await db
        .prepare(
            `
      INSERT INTO files (
        id, filename, storage_path, s3_url, mimetype, size, s3_config_id, slug, etag, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
        )
        .bind(fileId, fileName, s3Path, s3Url, contentType, fileSize, s3ConfigId, fileSlug, etag, adminId)
        .run();

    // 提取父路径
    const parentPath = targetPath.substring(0, targetPath.lastIndexOf("/") + 1);

    // 刷新目录缓存
    if (mountId && parentPath) {
      const invalidatedCount = directoryCacheManager.invalidatePathAndAncestors(mountId, parentPath);
      console.log(`缓存已刷新（包含所有父路径）：挂载点=${mountId}, 路径=${parentPath}, 清理了${invalidatedCount}个缓存条目`);
    } else {
      console.warn(`跳过缓存刷新，参数不完整: mountId=${mountId}, parentPath=${parentPath}`);
    }

    return c.json({
      code: ApiStatus.SUCCESS,
      message: "文件上传成功",
      data: {
        fileId,
        path: targetPath,
        name: fileName,
        size: fileSize,
        type: contentType,
      },
      success: true,
    });
  } catch (error) {
    console.error("提交预签名上传错误:", error);
    if (error instanceof HTTPException) {
      return c.json(createErrorResponse(error.status, error.message), error.status);
    }
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "提交上传信息失败"), ApiStatus.INTERNAL_ERROR);
  }
});

// 提交预签名URL上传成功 - API密钥用户版本
fsRoutes.post("/api/user/fs/presign/commit", apiKeyFileMiddleware, async (c) => {
  try {
    // 获取必要的上下文
    const db = c.env.DB;
    const apiKeyId = c.get("apiKeyId");

    // 解析请求数据
    const body = await c.req.json();
    const fileId = body.fileId;
    const s3Path = body.s3Path;
    const s3Url = body.s3Url;
    const targetPath = body.targetPath;
    const s3ConfigId = body.s3ConfigId;
    const mountId = body.mountId;
    const etag = body.etag;
    const contentType = body.contentType || "application/octet-stream";
    const fileSize = body.fileSize || 0;

    if (!fileId || !s3Path || !s3ConfigId || !targetPath) {
      return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请提供完整的上传信息"), ApiStatus.BAD_REQUEST);
    }

    // 获取S3配置
    const s3Config = await db.prepare("SELECT * FROM s3_configs WHERE id = ?").bind(s3ConfigId).first();

    if (!s3Config) {
      return c.json(createErrorResponse(ApiStatus.NOT_FOUND, "未找到存储配置"), ApiStatus.NOT_FOUND);
    }

    // 提取文件名 - 改进的文件名提取逻辑
    // 尝试从targetPath中提取文件名
    let fileName = targetPath.split("/").filter(Boolean).pop();
    // 如果targetPath中没有提取到有效文件名，则尝试从s3Path中提取
    if (!fileName) {
      fileName = s3Path.split("/").filter(Boolean).pop();
    }
    // 如果两者都未提取到有效文件名，使用默认名称
    if (!fileName) {
      fileName = "unnamed_file";
    }

    // 生成slug（使用文件ID的前8位作为slug）
    const fileSlug = "M-" + fileId.substring(0, 5);

    // 记录文件上传成功
    await db
        .prepare(
            `
      INSERT INTO files (
        id, filename, storage_path, s3_url, mimetype, size, s3_config_id, slug, etag, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
        )
        .bind(fileId, fileName, s3Path, s3Url, contentType, fileSize, s3ConfigId, fileSlug, etag, `apikey:${apiKeyId}`)
        .run();

    // 提取父路径
    const parentPath = targetPath.substring(0, targetPath.lastIndexOf("/") + 1);

    // 刷新目录缓存
    if (mountId && parentPath) {
      const invalidatedCount = directoryCacheManager.invalidatePathAndAncestors(mountId, parentPath);
      console.log(`缓存已刷新（包含所有父路径）：挂载点=${mountId}, 路径=${parentPath}, 清理了${invalidatedCount}个缓存条目`);
    } else {
      console.warn(`跳过缓存刷新，参数不完整: mountId=${mountId}, parentPath=${parentPath}`);
    }

    return c.json({
      code: ApiStatus.SUCCESS,
      message: "文件上传成功",
      data: {
        fileId,
        path: targetPath,
        name: fileName,
        size: fileSize,
        type: contentType,
      },
      success: true,
    });
  } catch (error) {
    console.error("提交预签名上传错误:", error);
    if (error instanceof HTTPException) {
      return c.json(createErrorResponse(error.status, error.message), error.status);
    }
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "提交上传信息失败"), ApiStatus.INTERNAL_ERROR);
  }
});

export default fsRoutes;
