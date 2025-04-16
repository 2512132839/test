/**
 * 文件系统API路由
 * 提供RESTful API接口用于前端访问和操作挂载的文件系统
 */
import { Hono } from "hono";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { apiKeyFileMiddleware } from "../middlewares/apiKeyMiddleware.js";
import { createErrorResponse } from "../utils/common.js";
import { ApiStatus } from "../constants/index.js";
import { HTTPException } from "hono/http-exception";
import { listDirectory, getFileInfo, downloadFile, createDirectory, uploadFile, removeItem, renameItem, previewFile, batchRemoveItems } from "../services/fsService.js";
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
  c.header("Access-Control-Expose-Headers", "ETag, Content-Length, Content-Disposition");
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

export default fsRoutes;
