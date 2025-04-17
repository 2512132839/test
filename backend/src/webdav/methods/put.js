/**
 * 处理WebDAV PUT请求
 * 用于上传文件内容
 */
import { findMountPointByPath, normalizeS3SubPath, updateMountLastUsed, checkDirectoryExists } from "../utils/webdavUtils.js";
import { createS3Client } from "../../utils/s3Utils.js";
import { PutObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getMimeType } from "../../utils/fileUtils.js";
import { initializeMultipartUpload, uploadPart, completeMultipartUpload, abortMultipartUpload } from "../../services/multipartUploadService.js";
import { clearCacheAfterWebDAVOperation } from "../utils/cacheUtils.js";

// 分片上传阈值，设为5MB以符合S3对分片的最小大小要求
const MULTIPART_THRESHOLD = 5 * 1024 * 1024; // 5MB

// 针对Windows/RaiDrive客户端的分片上传阈值降低
const WINDOWS_CLIENT_MULTIPART_THRESHOLD = 1 * 1024 * 1024; // 1MB

// 上传分片重试配置
const MAX_RETRIES = 3; // 最大重试次数
const RETRY_DELAY_BASE = 1000; // 基础重试延迟（毫秒）

// 日志上传进度的间隔（字节）
const PROGRESS_LOG_INTERVAL = 20 * 1024 * 1024; // 每20MB记录一次进度

/**
 * 识别客户端类型
 * @param {Object} c - Hono上下文
 * @returns {Object} 包含客户端类型信息的对象
 */
function identifyClient(c) {
  const userAgent = c.req.header("User-Agent") || "";

  // 客户端类型识别
  const isWindowsClient = userAgent.includes("Microsoft") || userAgent.includes("Windows");
  const isRaiDriveClient = userAgent.includes("RaiDrive") || userAgent.includes("WebDAV Drive");
  const isMacClient = userAgent.includes("Darwin") || userAgent.includes("Mac");

  // 特定客户端类型标识
  const isWindowsExplorerClient = isWindowsClient && (userAgent.includes("Microsoft-WebDAV-MiniRedir") || userAgent.includes("Explorer"));

  // 检测是否使用Chunked传输编码的客户端
  const isChunkedClient = c.req.header("Transfer-Encoding")?.toLowerCase().includes("chunked") || false;

  return {
    isWindowsClient,
    isRaiDriveClient,
    isMacClient,
    isWindowsExplorerClient,
    // 是否为可能导致0KB文件问题的客户端类型
    isPotentiallyProblematicClient: isWindowsClient || isRaiDriveClient,
    // 是否为使用分块传输的客户端
    isChunkedClient,
    userAgent,
  };
}

/**
 * 在Worker中连接两个Uint8Array
 * @param {Uint8Array} arr1 - 第一个数组
 * @param {Uint8Array} arr2 - 第二个数组
 * @returns {Uint8Array} 合并后的数组
 */
function concatenateArrayBuffers(arr1, arr2) {
  const result = new Uint8Array(arr1.length + arr2.length);
  result.set(arr1, 0);
  result.set(arr2, arr1.length);
  return result;
}

/**
 * 确保数据是有效的ArrayBuffer或Uint8Array
 * @param {*} data - 输入数据
 * @returns {ArrayBuffer} 有效的ArrayBuffer
 */
function ensureArrayBuffer(data) {
  if (data instanceof ArrayBuffer) {
    return data;
  } else if (data instanceof Uint8Array) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  } else if (data && data.buffer && data.buffer instanceof ArrayBuffer) {
    // 处理其他TypedArray类型
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  } else if (typeof data === "string") {
    // 如果是字符串，转换为UTF-8编码的ArrayBuffer
    return new TextEncoder().encode(data).buffer;
  } else if (!data) {
    // 如果为空，返回空ArrayBuffer
    return new ArrayBuffer(0);
  }
  // 如果无法转换，抛出错误
  throw new Error("无法将数据转换为ArrayBuffer");
}

/**
 * 带重试机制的分片上传函数
 * @param {object} params - 上传参数
 * @returns {Promise<object>} 上传结果
 */
async function uploadPartWithRetry(db, path, uploadId, partNumber, partData, userId, userType, encryptionSecret, s3Key, maxRetries = MAX_RETRIES) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 确保partData是有效的ArrayBuffer
      const validData = ensureArrayBuffer(partData);

      return await uploadPart(db, path, uploadId, partNumber, validData, userId, userType, encryptionSecret, s3Key);
    } catch (error) {
      lastError = error;
      console.warn(`WebDAV PUT - 分片 #${partNumber} 上传失败 (尝试 ${attempt}/${maxRetries}): ${error.message}`);

      if (attempt < maxRetries) {
        // 指数退避策略 (1秒, 2秒, 4秒...)
        const delayMs = RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
        console.log(`WebDAV PUT - 等待 ${delayMs}ms 后重试...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // 所有重试都失败，抛出最后一个错误
  console.error(`WebDAV PUT - 分片 #${partNumber} 在 ${maxRetries} 次尝试后仍然失败`);
  throw lastError;
}

/**
 * 流式处理文件上传的辅助函数
 * @param {ReadableStream} stream - 请求体流
 * @param {number} partSize - 每个分片的大小
 * @param {function} uploadCallback - 上传分片的回调函数
 * @param {object} options - 额外选项
 * @returns {Promise<Array>} 上传的分片列表
 */
async function processStreamInChunks(stream, partSize, uploadCallback, options = {}) {
  const reader = stream.getReader();
  const startTime = Date.now();

  let buffer = new Uint8Array(0);
  let partNumber = 1;
  const parts = [];
  let totalProcessed = 0;
  let lastProgressLog = 0;

  // 检查是否为特殊客户端
  const isSpecialClient = options.isSpecialClient || false;

  if (isSpecialClient) {
    console.log(`WebDAV PUT - 检测到特殊客户端，启用特殊流处理模式`);
    // 对于特殊客户端，可以添加额外的处理逻辑
  }

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // 处理最后剩余的缓冲区数据（可能小于partSize）
        if (buffer.length > 0) {
          console.log(`WebDAV PUT - 上传最后一个分片 #${partNumber}, 大小: ${buffer.length}字节`);
          const partResult = await uploadCallback(partNumber, buffer);
          parts.push({
            partNumber: partNumber,
            etag: partResult.etag,
          });
          totalProcessed += buffer.length;
        }
        break;
      }

      // 将新读取的数据添加到缓冲区
      if (value && value.byteLength > 0) {
        buffer = concatenateArrayBuffers(buffer, new Uint8Array(value));
        totalProcessed += value.byteLength;

        // 记录上传进度
        if (totalProcessed - lastProgressLog >= PROGRESS_LOG_INTERVAL) {
          console.log(`WebDAV PUT - 上传进度: ${(totalProcessed / (1024 * 1024)).toFixed(2)}MB`);
          lastProgressLog = totalProcessed;
        }
      }

      // 当缓冲区达到或超过分片大小时进行上传
      while (buffer.length >= partSize) {
        // 从缓冲区提取一个完整分片
        const partData = buffer.slice(0, partSize);
        // 保留剩余数据到缓冲区
        buffer = buffer.slice(partSize);

        const estimatedTotalParts = Math.ceil(totalProcessed / partSize);
        console.log(`WebDAV PUT - 上传分片 #${partNumber}/${estimatedTotalParts}, 大小: ${partData.length}字节`);

        try {
          const partResult = await uploadCallback(partNumber, partData);

          parts.push({
            partNumber: partNumber,
            etag: partResult.etag,
          });

          partNumber++;
        } catch (error) {
          console.error(`WebDAV PUT - 分片 #${partNumber} 上传失败，将中止流处理: ${error.message}`);
          throw error; // 重新抛出错误以允许外部处理程序进行清理
        }
      }
    }

    return { parts, totalProcessed };
  } finally {
    reader.releaseLock();
  }
}

/**
 * 处理PUT请求
 * @param {Object} c - Hono上下文
 * @param {string} path - 请求路径
 * @param {string} userId - 用户ID
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {D1Database} db - D1数据库实例
 */
export async function handlePut(c, path, userId, userType, db) {
  const requestStartTime = Date.now();

  try {
    // 识别客户端类型
    const clientInfo = identifyClient(c);

    // 记录客户端信息，帮助调试
    console.log(`WebDAV PUT - 客户端类型: ${clientInfo.userAgent}`);

    // 检查并记录Content-Length和Transfer-Encoding头信息
    const contentLengthHeader = c.req.header("Content-Length");
    const transferEncodingHeader = c.req.header("Transfer-Encoding") || "";
    const isChunkedEncoding = transferEncodingHeader.toLowerCase().includes("chunked");
    const declaredContentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : -1;

    // 记录头信息情况
    if (declaredContentLength === 0) {
      console.log(`WebDAV PUT - 警告: Content-Length为0，可能是意图创建空文件或请求异常`);
    } else if (declaredContentLength > 0) {
      console.log(`WebDAV PUT - Content-Length: ${declaredContentLength} 字节`);
    } else {
      console.log(`WebDAV PUT - 未提供Content-Length头或无效值`);
    }

    if (isChunkedEncoding) {
      console.log(`WebDAV PUT - 检测到Transfer-Encoding: chunked，将基于实际数据大小决定上传方式`);
    }

    // 为了处理空文件的情况，我们需要检查是否有请求体
    const emptyBodyCheck = declaredContentLength === 0;

    // 使用统一函数查找挂载点
    const mountResult = await findMountPointByPath(db, path, userId, userType);

    // 处理错误情况
    if (mountResult.error) {
      return new Response(mountResult.error.message, {
        status: mountResult.error.status,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const { mount, subPath } = mountResult;

    // 获取挂载点对应的S3配置
    const s3Config = await db.prepare("SELECT * FROM s3_configs WHERE id = ?").bind(mount.storage_config_id).first();

    if (!s3Config) {
      return new Response("存储配置不存在", { status: 404 });
    }

    // 判断是否为目录路径（以斜杠结尾）
    const isDirectory = path.endsWith("/");
    if (isDirectory) {
      return new Response("不能向目录路径上传文件内容", {
        status: 405, // Method Not Allowed
        headers: { "Content-Type": "text/plain" },
      });
    }

    // 规范化S3子路径 (文件不添加斜杠)
    const s3SubPath = normalizeS3SubPath(subPath, s3Config, false);

    // 从路径中提取文件名
    const filename = s3SubPath.split("/").pop();

    // 获取请求内容类型
    let contentType = c.req.header("Content-Type") || "application/octet-stream";

    // 如果Content-Type包含字符集，移除它
    if (contentType && contentType.includes(";")) {
      contentType = contentType.split(";")[0].trim();
    }

    // 如果Content-Type未设置或为通用类型，从文件名推断
    if (!contentType || contentType === "application/octet-stream") {
      contentType = getMimeType(filename);
    }

    console.log(`WebDAV PUT - 文件名: ${filename}, Content-Type: ${contentType}`);

    // 创建S3客户端
    const s3Client = await createS3Client(s3Config, c.env.ENCRYPTION_SECRET);

    // 检查父目录是否存在
    if (s3SubPath.includes("/")) {
      const parentPath = s3SubPath.substring(0, s3SubPath.lastIndexOf("/") + 1);
      const parentExists = await checkDirectoryExists(s3Client, s3Config.bucket_name, parentPath);

      if (!parentExists) {
        // 自动创建父目录而不是返回409错误
        console.log(`PUT请求: 父目录 ${parentPath} 不存在，正在自动创建...`);

        try {
          // 创建一个空对象作为目录标记
          const createDirParams = {
            Bucket: s3Config.bucket_name,
            Key: parentPath,
            Body: "", // 空内容
            ContentType: "application/x-directory", // 目录内容类型
          };

          const createDirCommand = new PutObjectCommand(createDirParams);
          await s3Client.send(createDirCommand);
          console.log(`PUT请求: 已成功创建父目录 ${parentPath}`);
        } catch (dirError) {
          console.error(`PUT请求: 创建父目录 ${parentPath} 失败:`, dirError);
          // 即使创建目录失败，我们也尝试继续上传文件
          // 某些S3实现可能不需要显式目录对象
        }
      }
    }

    // 为可能导致问题的客户端降低分片上传阈值
    const effectiveThreshold = clientInfo.isPotentiallyProblematicClient ? WINDOWS_CLIENT_MULTIPART_THRESHOLD : MULTIPART_THRESHOLD;

    // 处理空文件的情况
    if (emptyBodyCheck) {
      console.log(`WebDAV PUT - 检测到0字节文件，使用普通上传`);

      // 上传到S3
      const putParams = {
        Bucket: s3Config.bucket_name,
        Key: s3SubPath,
        Body: "", // 空内容
        ContentType: contentType,
      };

      // 直接上传文件
      const putCommand = new PutObjectCommand(putParams);
      await s3Client.send(putCommand);

      // 清理缓存
      await finalizePutOperation(db, s3Client, s3Config, s3SubPath);

      // 更新挂载点的最后使用时间
      await updateMountLastUsed(db, mount.id);

      // 返回成功响应
      return new Response(null, {
        status: 201, // Created
        headers: {
          "Content-Type": "text/plain",
          "Content-Length": "0",
        },
      });
    }

    // 获取请求体流
    const bodyStream = c.req.body;

    if (!bodyStream) {
      return new Response("请求体不可用", {
        status: 400,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // 处理非空文件 - 使用流式分片上传
    console.log(`WebDAV PUT - 文件名: ${filename}, 开始流式分片上传`);

    let uploadId = null;
    let s3Key = null;

    try {
      // 初始化分片上传
      const initResult = await initializeMultipartUpload(db, path, contentType, declaredContentLength, userId, userType, c.env.ENCRYPTION_SECRET, filename);

      uploadId = initResult.uploadId;
      s3Key = initResult.key;
      const recommendedPartSize = initResult.recommendedPartSize || effectiveThreshold;

      console.log(`WebDAV PUT - 初始化分片上传成功，开始流式处理 (分片大小: ${(recommendedPartSize / (1024 * 1024)).toFixed(2)}MB)`);

      // 创建一个带重试机制的上传分片回调函数
      const uploadPartCallback = async (partNumber, partData) => {
        return await uploadPartWithRetry(db, path, uploadId, partNumber, partData, userId, userType, c.env.ENCRYPTION_SECRET, s3Key);
      };

      // 处理流并上传分片，添加特殊客户端信息
      const { parts, totalProcessed } = await processStreamInChunks(bodyStream, recommendedPartSize, uploadPartCallback, {
        isSpecialClient: clientInfo.isPotentiallyProblematicClient || clientInfo.isChunkedClient,
      });

      console.log(`WebDAV PUT - 所有分片上传完成，开始完成分片上传，总共上传了 ${totalProcessed} 字节`);

      // 完成分片上传
      const completeResult = await completeMultipartUpload(db, path, uploadId, parts, userId, userType, c.env.ENCRYPTION_SECRET, s3Key, contentType, totalProcessed);

      // 清理缓存
      await finalizePutOperation(db, s3Client, s3Config, s3SubPath);

      const uploadDuration = Math.ceil((Date.now() - requestStartTime) / 1000);
      const uploadSpeedMBps = (totalProcessed / 1024 / 1024 / uploadDuration).toFixed(2);

      console.log(`WebDAV PUT - 分片上传完成成功，总用时: ${uploadDuration}秒，平均速度: ${uploadSpeedMBps}MB/s`);

      // 成功完成分片上传后返回成功响应
      return new Response(null, {
        status: 201, // Created
        headers: {
          "Content-Type": "text/plain",
          "Content-Length": "0",
        },
      });
    } catch (error) {
      console.error(`WebDAV PUT - 分片上传过程中出错:`, error);

      // 如果是在分片上传过程中出错，尝试中止上传
      if (uploadId) {
        try {
          console.log(`WebDAV PUT - 尝试中止分片上传: ${uploadId}`);
          await abortMultipartUpload(db, path, uploadId, userId, userType, c.env.ENCRYPTION_SECRET, s3Key);
          console.log(`WebDAV PUT - 已成功中止分片上传: ${uploadId}`);
        } catch (abortError) {
          console.error(`WebDAV PUT - 中止分片上传失败:`, abortError);
        }
      }

      throw error; // 继续抛出原始错误
    }
  } catch (error) {
    console.error("PUT请求处理错误:", error);
    // 生成唯一错误ID用于日志追踪
    const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    console.error(`PUT错误详情[${errorId}]:`, error);

    // 对外部仅返回通用错误信息和错误ID，不暴露具体错误
    return new Response(`内部服务器错误 (错误ID: ${errorId})`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

async function finalizePutOperation(db, s3Client, s3Config, s3SubPath) {
  try {
    // 更新缓存 - 清除相关目录的缓存
    await clearCacheAfterWebDAVOperation(db, s3SubPath, s3Config);
    return true;
  } catch (error) {
    console.error("PUT操作后清理缓存错误:", error);
    // 即使缓存清理失败也返回true，不影响主流程
    return true;
  }
}
