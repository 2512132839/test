/**
 * 处理WebDAV PUT请求
 * 用于上传文件内容
 */
import { MountManager } from "../../storage/managers/MountManager.js";
import { FileSystem } from "../../storage/fs/FileSystem.js";
import { getMimeTypeFromFilename } from "../../utils/fileUtils.js";
import { handleWebDAVError } from "../utils/errorUtils.js";
import { clearDirectoryCache } from "../../cache/index.js";

import { getLockManager } from "../utils/LockManager.js";
import { checkLockPermission } from "../utils/lockUtils.js";

// 分片上传阈值，设为5MB以符合S3对分片的最小大小要求
const MULTIPART_THRESHOLD = 5 * 1024 * 1024; // 5MB

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
 * 高效合并缓冲区列表到指定大小
 * @param {Uint8Array[]} bufferList - 缓冲区列表
 * @param {number} targetSize - 目标大小
 * @returns {Uint8Array} 合并后的数组
 */
function combineBuffers(bufferList, targetSize) {
  const result = new Uint8Array(targetSize);
  let offset = 0;
  let remaining = targetSize;

  for (const buffer of bufferList) {
    if (remaining <= 0) break;

    const copySize = Math.min(buffer.length, remaining);
    result.set(buffer.subarray(0, copySize), offset);
    offset += copySize;
    remaining -= copySize;
  }

  return result;
}

/**
 * 移除已使用的缓冲区数据
 * @param {Uint8Array[]} bufferList - 缓冲区列表
 * @param {number} usedSize - 已使用的大小
 * @returns {{remainingBuffers: Uint8Array[], remainingSize: number}} 剩余的缓冲区和大小
 */
function removeUsedBuffers(bufferList, usedSize) {
  const remainingBuffers = [];
  let remainingSize = 0;
  let processedSize = 0;

  for (const buffer of bufferList) {
    if (processedSize + buffer.length <= usedSize) {
      // 整个缓冲区都被使用了
      processedSize += buffer.length;
    } else if (processedSize < usedSize) {
      // 部分缓冲区被使用了
      const usedFromThisBuffer = usedSize - processedSize;
      const remainingFromThisBuffer = buffer.subarray(usedFromThisBuffer);
      remainingBuffers.push(remainingFromThisBuffer);
      remainingSize += remainingFromThisBuffer.length;
      processedSize = usedSize;
    } else {
      // 这个缓冲区完全没有被使用
      remainingBuffers.push(buffer);
      remainingSize += buffer.length;
    }
  }

  return { remainingBuffers, remainingSize };
}

/**
 * 确保数据是ArrayBuffer格式
 * @param {any} data - 输入数据
 * @returns {ArrayBuffer} ArrayBuffer格式的数据
 */
function ensureArrayBuffer(data) {
  if (data instanceof ArrayBuffer) {
    return data;
  }
  if (data instanceof Uint8Array) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }
  throw new Error("数据必须是ArrayBuffer或Uint8Array格式");
}

/**
 * 检查文件大小差异是否可接受
 * @param {number} actualSize - 实际大小
 * @param {number} declaredSize - 声明大小
 * @returns {boolean} 是否可接受
 */
function checkSizeDifference(actualSize, declaredSize) {
  const difference = Math.abs(actualSize - declaredSize);
  const percentageDiff = (difference / declaredSize) * 100;

  // 允许5%的差异或者最多1MB的差异
  return percentageDiff <= 5 || difference <= 1024 * 1024;
}

/**
 * 带重试机制的分片上传
 * @param {string} path - 文件路径
 * @param {string} uploadId - 上传ID
 * @param {number} partNumber - 分片编号
 * @param {ArrayBuffer} partData - 分片数据
 * @param {string|Object} userIdOrInfo - 用户ID或信息
 * @param {string} userType - 用户类型
 * @param {string} s3Key - S3键
 * @param {FileSystem} fileSystem - 文件系统实例
 * @param {number} maxRetries - 最大重试次数
 * @returns {Promise<Object>} 上传结果
 */
async function uploadPartWithRetry(path, uploadId, partNumber, partData, userIdOrInfo, userType, s3Key, fileSystem, maxRetries = MAX_RETRIES) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 确保partData是有效的ArrayBuffer
      const validData = ensureArrayBuffer(partData);

      return await fileSystem.uploadBackendPart(path, userIdOrInfo, userType, uploadId, partNumber, validData, s3Key);
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
 * 真正的流式上传 - 使用AWS SDK Upload类
 * - 零内存缓冲：直接传递ReadableStream给AWS SDK
 * - 自动分片管理：AWS SDK处理所有分片逻辑
 * - 并发上传：支持多个分片同时上传
 * - CPU优化：Worker只作为流的管道
 *
 * @param {ReadableStream} stream - 输入流
 * @param {Object} uploadContext - 上传上下文
 * @param {FileSystem} fileSystem - 文件系统实例
 * @param {Object} options - 选项参数
 * @returns {Promise<Object>} 上传结果
 */
async function trueStreamingUpload(stream, uploadContext, fileSystem, options = {}) {
  const { contentLength = 0, contentType = "application/octet-stream", path, userIdOrInfo, userType } = options;

  try {
    // 动态导入Upload类
    const { Upload } = await import("@aws-sdk/lib-storage");

    console.log(`WebDAV PUT - 开始真正流式上传，文件大小: ${(contentLength / (1024 * 1024)).toFixed(2)}MB`);

    // 通过FileSystem获取正确的driver和s3Client
    const { driver } = await fileSystem.mountManager.getDriverByPath(path, userIdOrInfo, userType);

    if (!driver.s3Client) {
      throw new Error("无法获取S3客户端实例");
    }

    console.log(`WebDAV PUT - 获取S3客户端成功，驱动类型: ${driver.getType()}`);

    // 从driver配置中获取bucket信息
    const bucketName = driver.config.bucket_name;
    if (!bucketName) {
      throw new Error("无法获取S3 bucket名称");
    }

    console.log(`WebDAV PUT - 使用S3 bucket: ${bucketName}, key: ${uploadContext.key}`);

    // 创建Upload实例
    const upload = new Upload({
      client: driver.s3Client,
      params: {
        Bucket: bucketName,
        Key: uploadContext.key,
        Body: stream, // 直接传递ReadableStream！
        ContentType: contentType,
      },
      // 上传配置
      queueSize: 3, // 最多3个分片并发上传
      partSize: 5 * 1024 * 1024, // 5MB分片大小
      leavePartsOnError: false, // 出错时清理分片
    });

    // 监听上传进度
    let lastProgressLog = 0;
    upload.on("httpUploadProgress", (progress) => {
      const { loaded = 0, total = contentLength } = progress;

      // 每20MB记录一次进度
      if (loaded - lastProgressLog >= PROGRESS_LOG_INTERVAL) {
        const progressMB = (loaded / (1024 * 1024)).toFixed(2);
        const totalMB = total > 0 ? (total / (1024 * 1024)).toFixed(2) : "未知";
        const percentage = total > 0 ? ((loaded / total) * 100).toFixed(1) : "未知";
        console.log(`WebDAV PUT - 流式上传进度: ${progressMB}MB / ${totalMB}MB (${percentage}%)`);
        lastProgressLog = loaded;
      }
    });

    // 执行上传
    const startTime = Date.now();
    const result = await upload.done();
    const duration = Date.now() - startTime;
    const speedMBps = contentLength > 0 ? (contentLength / 1024 / 1024 / (duration / 1000)).toFixed(2) : "未知";

    console.log(`WebDAV PUT - 流式上传完成，用时: ${duration}ms，平均速度: ${speedMBps}MB/s`);

    return {
      result,
      totalProcessed: contentLength,
      partCount: Math.ceil(contentLength / (5 * 1024 * 1024)) || 1,
    };
  } catch (error) {
    console.error("WebDAV PUT - 流式上传失败:", error);
    throw error;
  }
}

/**
 * CPU优化的分片上传（备用方案）
 * - 使用缓冲区列表避免频繁合并
 * - 减少内存复制操作
 * - 优化CPU时间使用
 *
 * @param {ReadableStream} stream - 输入流
 * @param {number} partSize - 分片大小（通常5MB）
 * @param {Function} uploadPartCallback - 上传分片的回调函数
 * @param {Object} options - 选项参数
 * @returns {Promise<{parts: Array, totalProcessed: number}>} 处理结果
 */
async function bufferedMultipartUpload(stream, partSize, uploadPartCallback, options = {}) {
  const { contentLength = 0 } = options;

  const reader = stream.getReader();
  const parts = [];
  let partNumber = 1;

  // 使用缓冲区列表而不是频繁合并
  let bufferList = [];
  let totalBufferSize = 0;
  let totalProcessed = 0;
  let lastProgressLog = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // 处理剩余的数据（最后一个分片可以小于5MB）
        if (totalBufferSize > 0) {
          console.log(`WebDAV PUT - 处理最后分片 #${partNumber}，大小: ${(totalBufferSize / (1024 * 1024)).toFixed(2)}MB`);

          // 高效合并剩余数据
          const finalChunk = combineBuffers(bufferList, totalBufferSize);
          const partResult = await uploadPartCallback(partNumber, finalChunk.buffer);
          parts.push(partResult);
          totalProcessed += totalBufferSize;
        }
        break;
      }

      // 添加到缓冲区列表（避免立即合并）
      const chunk = new Uint8Array(value);
      bufferList.push(chunk);
      totalBufferSize += chunk.length;

      // 达到分片大小时才进行合并和上传
      while (totalBufferSize >= partSize) {
        console.log(`WebDAV PUT - 上传分片 #${partNumber}，大小: ${(partSize / (1024 * 1024)).toFixed(2)}MB`);

        // 高效合并数据到分片大小
        const partData = combineBuffers(bufferList, partSize);

        // 更新缓冲区列表（移除已使用的数据）
        const { remainingBuffers, remainingSize } = removeUsedBuffers(bufferList, partSize);
        bufferList = remainingBuffers;
        totalBufferSize = remainingSize;

        // 记录分片上传时间
        const partStartTime = Date.now();
        const partResult = await uploadPartCallback(partNumber, partData.buffer);
        const partDuration = Date.now() - partStartTime;
        const partSpeedMBps = (partData.length / 1024 / 1024 / (partDuration / 1000)).toFixed(2);

        console.log(`WebDAV PUT - 分片 #${partNumber} 上传完成，用时: ${partDuration}ms，速度: ${partSpeedMBps}MB/s`);

        parts.push(partResult);
        totalProcessed += partData.length;
        partNumber++;

        // 记录进度（每20MB记录一次）
        if (totalProcessed - lastProgressLog >= PROGRESS_LOG_INTERVAL) {
          const progressMB = (totalProcessed / (1024 * 1024)).toFixed(2);
          const totalMB = contentLength > 0 ? (contentLength / (1024 * 1024)).toFixed(2) : "未知";
          console.log(`WebDAV PUT - 上传进度: ${progressMB}MB / ${totalMB}MB`);
          lastProgressLog = totalProcessed;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { parts, totalProcessed };
}

/**
 * 主流实现风格的分片上传管理器
 * 提供完整的multipart upload生命周期管理，包括错误恢复
 * @param {ReadableStream} stream - 输入流
 * @param {Object} uploadContext - 上传上下文
 * @param {FileSystem} fileSystem - 文件系统实例
 * @param {Object} options - 选项参数
 * @returns {Promise<Object>} 上传结果
 */
async function managedMultipartUpload(stream, uploadContext, fileSystem, options = {}) {
  const { path, userId, userType, uploadId, s3Key, recommendedPartSize } = uploadContext;
  const { contentLength = 0 } = options;

  let abortCalled = false;

  try {
    // 创建优化的上传回调函数
    const uploadPartCallback = async (partNumber, partData) => {
      return await uploadPartWithRetry(path, uploadId, partNumber, partData, userId, userType, s3Key, fileSystem);
    };
    const streamStartTime = Date.now();
    // 既然选择了分片模式，直接使用真正的流式上传（最优方案）
    let uploadResult;

    // 优先尝试真正的流式上传
    try {
      console.log(`WebDAV PUT - 尝试真正流式上传 (${(contentLength / (1024 * 1024)).toFixed(2)}MB)`);

      const streamingContext = {
        key: s3Key, // 使用正确的S3 key，bucket从driver获取
      };

      uploadResult = await trueStreamingUpload(stream, streamingContext, fileSystem, {
        contentLength,
        contentType: options.contentType,
        path: path,
        userIdOrInfo: userId,
        userType: userType,
      });

      console.log(`WebDAV PUT - 真正流式上传成功`);
    } catch (streamingError) {
      console.warn(`WebDAV PUT - 流式上传失败，回退到缓冲模式:`, streamingError.message);
      // 回退到缓冲模式
      uploadResult = await bufferedMultipartUpload(stream, recommendedPartSize, uploadPartCallback, {
        contentLength,
        ...options,
      });
    }

    const { parts = [], totalProcessed = 0, partCount = 0 } = uploadResult;
    const streamDuration = Date.now() - streamStartTime;

    // 完成multipart upload
    const actualPartCount = parts.length || partCount || 0;
    console.log(`WebDAV PUT - 流式上传完成，共${actualPartCount}个分片，总大小: ${(totalProcessed / (1024 * 1024)).toFixed(2)}MB，用时: ${streamDuration}ms`);

    // 检查是否有分片上传 - 处理0字节文件的特殊情况
    if (actualPartCount === 0 && totalProcessed === 0) {
      console.log(`WebDAV PUT - 检测到0字节文件，取消分片上传并使用直接上传`);

      // 取消分片上传
      try {
        await fileSystem.abortBackendMultipartUpload(path, userId, userType, uploadId, s3Key);
        console.log(`WebDAV PUT - 已取消分片上传`);
      } catch (abortError) {
        console.warn(`WebDAV PUT - 取消分片上传失败: ${abortError.message}`);
      }

      // 使用直接上传创建空文件
      const filename = path.split("/").pop();
      const contentType = options.contentType || "application/octet-stream";
      const emptyFile = new File([""], filename, { type: contentType });
      const result = await fileSystem.uploadFile(path, emptyFile, userId, userType, {
        useMultipart: false,
      });

      return {
        success: true,
        result,
        totalProcessed: 0,
        partCount: 0,
      };
    }

    // 如果是真正的流式上传，已经完成了整个上传过程
    if (uploadResult.result && !parts.length) {
      console.log(`WebDAV PUT - 真正流式上传已完成，无需调用completeBackendMultipartUpload`);
      return {
        success: true,
        result: uploadResult.result,
        totalProcessed,
        partCount: actualPartCount,
      };
    }

    // 缓冲模式需要完成multipart upload
    const result = await fileSystem.completeBackendMultipartUpload(path, userId, userType, uploadId, parts, s3Key);

    return {
      success: true,
      result,
      totalProcessed,
      partCount: parts.length,
    };
  } catch (error) {
    // 错误处理：自动abort multipart upload
    if (!abortCalled) {
      abortCalled = true;
      try {
        console.warn(`WebDAV PUT - 分片上传失败，正在清理multipart upload: ${error.message}`);
        await fileSystem.abortBackendMultipartUpload(path, userId, userType, uploadId, s3Key);
        console.log(`WebDAV PUT - multipart upload已成功清理`);
      } catch (abortError) {
        console.error(`WebDAV PUT - 清理multipart upload失败: ${abortError.message}`);
      }
    }

    throw error;
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
    console.log(`WebDAV PUT请求: 路径 ${path}, 用户类型: ${userType}`);

    // 获取锁定管理器实例
    const lockManager = getLockManager();

    // 检查锁定状态
    const ifHeader = c.req.header("If");
    const lockConflict = checkLockPermission(lockManager, path, ifHeader, "PUT");
    if (lockConflict) {
      console.log(`WebDAV PUT - 锁定冲突: ${path}`);
      return new Response(lockConflict.message, {
        status: lockConflict.status,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // 识别客户端类型
    const clientInfo = identifyClient(c);
    console.log(`WebDAV PUT - 客户端信息: ${JSON.stringify(clientInfo)}`);

    // 获取请求头信息
    const contentLength = c.req.header("Content-Length");
    const transferEncoding = c.req.header("Transfer-Encoding");
    const isChunked = transferEncoding && transferEncoding.toLowerCase().includes("chunked");

    // 正确检查是否为空文件
    let declaredContentLength = 0;
    let emptyBodyCheck = false;

    if (contentLength !== undefined) {
      // 有Content-Length头，使用明确的长度
      declaredContentLength = parseInt(contentLength, 10);
      emptyBodyCheck = declaredContentLength === 0;
    } else if (isChunked) {
      // Chunked传输，长度未知，不是空文件
      declaredContentLength = -1; // 表示未知长度
      emptyBodyCheck = false;
    } else {
      // 既没有Content-Length也没有chunked，可能是空文件或错误请求
      declaredContentLength = 0;
      emptyBodyCheck = true;
    }

    console.log(
        `WebDAV PUT - Content-Length: ${contentLength}, Transfer-Encoding: ${transferEncoding}, 是否chunked: ${isChunked}, 声明大小: ${declaredContentLength}字节, 空文件检查: ${emptyBodyCheck}`
    );

    // 从路径中提取文件名
    const filename = path.split("/").pop();

    // 获取请求内容类型
    let contentType = c.req.header("Content-Type") || "application/octet-stream";

    // 如果Content-Type包含字符集，移除它
    if (contentType && contentType.includes(";")) {
      contentType = contentType.split(";")[0].trim();
    }

    // 统一从文件名推断MIME类型，不依赖客户端提供的Content-Type
    contentType = getMimeTypeFromFilename(filename);
    console.log(`WebDAV PUT - 从文件名[${filename}]推断MIME类型: ${contentType}`);

    // 创建FileSystem实例
    const mountManager = new MountManager(db, c.env.ENCRYPTION_SECRET);
    const fileSystem = new FileSystem(mountManager);

    // 获取系统设置中的WebDAV上传模式
    let webdavUploadMode = "direct"; // 默认为直接上传模式
    try {
      // 使用Repository查询系统设置
      const { RepositoryFactory } = await import("../../repositories/index.js");
      const repositoryFactory = new RepositoryFactory(db);
      const systemRepository = repositoryFactory.getSystemRepository();

      const uploadModeSetting = await systemRepository.getSettingMetadata("webdav_upload_mode");
      if (uploadModeSetting && uploadModeSetting.value) {
        webdavUploadMode = uploadModeSetting.value;
      }
    } catch (error) {
      console.warn(`WebDAV PUT - 获取上传模式设置失败，使用默认模式:`, error);
    }

    console.log(`WebDAV PUT - 当前上传模式设置: ${webdavUploadMode}`);

    // 根据系统设置决定使用哪种上传模式
    // 判断是否应该使用直接上传模式：
    // 如果设置为'direct'，则使用直接上传模式，否则使用分片上传模式
    // 注意：空文件已经有专门的处理逻辑
    const shouldUseDirect = webdavUploadMode === "direct";

    // 处理空文件的情况
    if (emptyBodyCheck) {
      console.log(`WebDAV PUT - 检测到0字节文件，使用FileSystem直接上传`);

      // 创建一个空的File对象
      const emptyFile = new File([""], filename, { type: contentType });

      // 使用FileSystem上传空文件
      const result = await fileSystem.uploadFile(path, emptyFile, userId, userType, {
        useMultipart: false,
      });

      // 清理缓存
      const { mount } = await mountManager.getDriverByPath(path, userId, userType);
      if (mount) {
        await clearDirectoryCache({ mountId: mount.id });
      }

      console.log(`WebDAV PUT - 空文件上传成功: ${JSON.stringify(result)}`);

      // 返回成功响应
      return new Response(null, {
        status: 201, // Created
        headers: {
          "Content-Type": "text/plain",
          "Content-Length": "0",
        },
      });
    }

    // 直接上传模式
    if (shouldUseDirect) {
      console.log(`WebDAV PUT - 使用直接上传模式`);

      try {
        // 读取请求体
        const bodyStream = c.req.body;
        if (!bodyStream) {
          return new Response("请求体不可用", {
            status: 400,
            headers: { "Content-Type": "text/plain" },
          });
        }

        // 读取所有数据
        const reader = bodyStream.getReader();
        const chunks = [];
        let bytesRead = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          bytesRead += value.length;
        }

        // 合并所有数据块
        const fileData = new Uint8Array(bytesRead);
        let offset = 0;
        for (const chunk of chunks) {
          fileData.set(chunk, offset);
          offset += chunk.length;
        }

        console.log(`WebDAV PUT - 开始直接上传 ${bytesRead} 字节到FileSystem`);

        // 创建File对象
        const file = new File([fileData], filename, { type: contentType });

        // 使用FileSystem直接上传
        const result = await fileSystem.uploadFile(path, file, userId, userType, {
          useMultipart: false,
        });

        // 清理缓存
        const { mount } = await mountManager.getDriverByPath(path, userId, userType);
        if (mount) {
          await clearDirectoryCache({ mountId: mount.id });
        }

        const uploadDuration = Math.ceil((Date.now() - requestStartTime) / 1000);
        const uploadSpeedMBps = (bytesRead / 1024 / 1024 / uploadDuration).toFixed(2);

        console.log(`WebDAV PUT - 直接上传成功，总用时: ${uploadDuration}秒，平均速度: ${uploadSpeedMBps}MB/s`);
        console.log(`WebDAV PUT - 上传结果: ${JSON.stringify(result)}`);

        // 返回成功响应
        return new Response(null, {
          status: 201, // Created
          headers: {
            "Content-Type": "text/plain",
            "Content-Length": "0",
          },
        });
      } catch (error) {
        console.error(`WebDAV PUT - 直接上传失败:`, error);
        throw error;
      }
    }

    // 分片上传模式
    if (!shouldUseDirect) {
      console.log(`WebDAV PUT - 使用分片上传模式`);

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
        // 直接使用真正的流式上传，跳过传统的初始化步骤
        console.log(`WebDAV PUT - 直接使用流式上传，跳过初始化步骤`);

        // 获取driver来构建S3 key
        const { driver, mount, subPath } = await fileSystem.mountManager.getDriverByPath(path, userId, userType);

        // 使用S3StorageDriver的_normalizeFilePath方法构建正确的S3 key
        const s3Key = driver._normalizeFilePath(subPath, path, filename);

        console.log(`WebDAV PUT - 使用S3 key: ${s3Key}`);

        // 直接调用真正的流式上传
        const streamingContext = {
          key: s3Key,
        };

        const streamingOptions = {
          contentLength: declaredContentLength,
          contentType,
          path: path,
          userIdOrInfo: userId,
          userType: userType,
        };

        const uploadResult = await trueStreamingUpload(bodyStream, streamingContext, fileSystem, streamingOptions);

        const { result: completeResult, totalProcessed, partCount } = uploadResult;

        // 检查上传数据是否完整
        if (declaredContentLength > 0 && totalProcessed < declaredContentLength) {
          const acceptable = checkSizeDifference(totalProcessed, declaredContentLength);
          if (!acceptable) {
            console.warn(
                `WebDAV PUT - 警告：文件数据不完整，声明大小：${declaredContentLength}字节，实际上传：${totalProcessed}字节，差异：${(
                    (declaredContentLength - totalProcessed) /
                    (1024 * 1024)
                ).toFixed(2)}MB`
            );
          }
        }

        // 清理缓存
        if (mount) {
          await clearDirectoryCache({ mountId: mount.id });
        }

        const uploadDuration = Math.ceil((Date.now() - requestStartTime) / 1000);
        const uploadSpeedMBps = (totalProcessed / 1024 / 1024 / uploadDuration).toFixed(2);

        console.log(`WebDAV PUT - 分片上传完成，${partCount}个分片，总用时: ${uploadDuration}秒，平均速度: ${uploadSpeedMBps}MB/s`);
        console.log(`WebDAV PUT - 完成结果: ${JSON.stringify(completeResult)}`);

        // 成功完成分片上传后返回成功响应
        return new Response(null, {
          status: 201, // Created
          headers: {
            "Content-Type": "text/plain",
            "Content-Length": "0",
          },
        });
      } catch (error) {
        console.error(`WebDAV PUT - 主流风格分片上传失败:`, error);
        // 注意：managedMultipartUpload已经自动处理了multipart upload的清理
        throw error;
      }
    }

    // 如果没有匹配的上传模式，返回错误
    return new Response("不支持的上传模式", {
      status: 400,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    console.error("WebDAV PUT处理错误:", error);
    return handleWebDAVError("PUT", error);
  }
}
