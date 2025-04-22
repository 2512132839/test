/**
 * 分片上传控制器
 * 处理文件分片上传的API
 */
import { HTTPException } from "hono/http-exception";
import { ApiStatus } from "../constants/index.js";
import { initializeMultipartUpload, uploadPart, completeMultipartUpload, abortMultipartUpload } from "../services/multipartUploadService.js";

/**
 * 从Hono上下文中获取用户ID和类型
 * @param {HonoContext} c - Hono上下文
 * @returns {Object} 包含userId和userType的对象
 */
async function getUserIdAndTypeFromContext(c) {
  // 检查上下文中是否存在adminId (由authMiddleware设置)
  const adminId = c.get("adminId");
  if (adminId) {
    return { userId: adminId, userType: "admin" };
  }

  // 检查上下文中是否存在apiKeyId (由apiKeyMiddleware设置)
  const apiKeyId = c.get("apiKeyId");
  if (apiKeyId) {
    return { userId: apiKeyId, userType: "apiKey" };
  }

  // 如果两者都不存在，则抛出未授权错误
  throw new HTTPException(ApiStatus.UNAUTHORIZED, { message: "未授权访问" });
}

/**
 * 验证数据库连接并获取db对象
 * @param {HonoContext} c - Hono上下文
 * @returns {D1Database} D1数据库实例
 */
function getDatabase(c) {
  const db = c.env.DB;
  if (!db) {
    throw new HTTPException(ApiStatus.INTERNAL_ERROR, { message: "服务器配置错误" });
  }
  return db;
}

/**
 * 初始化分片上传
 * @param {HonoContext} c - Hono上下文
 * @returns {Response} 包含uploadId等信息的响应
 */
export async function handleInitMultipartUpload(c) {
  try {
    // 获取数据库
    const db = getDatabase(c);

    // 从上下文获取用户ID和类型
    const { userId, userType } = await getUserIdAndTypeFromContext(c);

    // 获取请求参数
    const { path, contentType, fileSize, filename } = await c.req.json();

    // 验证必要参数
    if (!path) {
      throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "路径不能为空" });
    }

    // 初始化分片上传
    const result = await initializeMultipartUpload(db, path, contentType || "application/octet-stream", fileSize, userId, userType, c.env.ENCRYPTION_SECRET, filename);

    // 返回初始化信息
    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(ApiStatus.INTERNAL_ERROR, { message: "初始化分片上传失败" });
  }
}

/**
 * 上传文件分片
 * @param {HonoContext} c - Hono上下文
 * @returns {Response} 包含分片上传状态的响应
 */
export async function handleUploadPart(c) {
  try {
    // 获取数据库
    const db = getDatabase(c);

    // 从上下文获取用户ID和类型
    const { userId, userType } = await getUserIdAndTypeFromContext(c);

    // 获取请求参数
    const path = c.req.query("path");
    const uploadId = c.req.query("uploadId");
    const partNumber = parseInt(c.req.query("partNumber"), 10);
    const isLastPart = c.req.query("isLastPart") === "true";
    const s3Key = c.req.query("key"); // 获取传入的S3键值，确保使用与初始化相同的路径

    // 验证必要参数
    if (!path || !uploadId || isNaN(partNumber) || partNumber < 1) {
      throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "缺少必要参数或参数无效" });
    }

    // 获取分片数据
    let partData;
    try {
      partData = await c.req.arrayBuffer();
    } catch (error) {
      throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "读取分片数据失败，请检查请求格式" });
    }

    // 如果分片为空，拒绝请求
    if (!partData || partData.byteLength === 0) {
      throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "分片数据不能为空" });
    }

    // 记录实际接收到的分片大小，帮助调试
    console.log(`接收到分片 #${partNumber}, isLastPart: ${isLastPart}, 大小: ${partData.byteLength} 字节`);
    // S3会合并这些小分片，只要最终能成功上传即可

    // 上传分片
    const result = await uploadPart(db, path, uploadId, partNumber, partData, userId, userType, c.env.ENCRYPTION_SECRET, s3Key);

    // 返回分片上传结果
    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(ApiStatus.INTERNAL_ERROR, { message: `上传分片失败: ${error.message}` });
  }
}

/**
 * 完成分片上传
 * @param {HonoContext} c - Hono上下文
 * @returns {Response} 包含上传完成状态的响应
 */
export async function handleCompleteMultipartUpload(c) {
  try {
    // 获取数据库
    const db = getDatabase(c);

    // 从上下文获取用户ID和类型
    const { userId, userType } = await getUserIdAndTypeFromContext(c);

    // 获取请求参数
    const { path, uploadId, parts, key, contentType, fileSize } = await c.req.json();

    // 验证必要参数
    if (!path || !uploadId || !Array.isArray(parts) || parts.length === 0) {
      throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "缺少必要参数或参数无效" });
    }

    // 完成分片上传
    const result = await completeMultipartUpload(
      db,
      path,
      uploadId,
      parts,
      userId,
      userType,
      c.env.ENCRYPTION_SECRET,
      key,
      contentType || "application/octet-stream", // 添加MIME类型
      fileSize || 0 // 添加文件大小
    );

    // 返回完成结果
    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(ApiStatus.INTERNAL_ERROR, { message: "完成分片上传失败" });
  }
}

/**
 * 中止分片上传
 * @param {HonoContext} c - Hono上下文
 * @returns {Response} 包含中止状态的响应
 */
export async function handleAbortMultipartUpload(c) {
  try {
    // 获取数据库
    const db = getDatabase(c);

    // 从上下文获取用户ID和类型
    const { userId, userType } = await getUserIdAndTypeFromContext(c);

    // 获取请求参数
    const { path, uploadId, key } = await c.req.json();

    // 验证必要参数
    if (!path || !uploadId) {
      throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "缺少必要参数" });
    }

    // 中止分片上传
    const result = await abortMultipartUpload(db, path, uploadId, userId, userType, c.env.ENCRYPTION_SECRET, key);

    // 返回中止结果
    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(ApiStatus.INTERNAL_ERROR, { message: "中止分片上传失败" });
  }
}
