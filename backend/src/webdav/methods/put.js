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

  return {
    isWindowsClient,
    isRaiDriveClient,
    isMacClient,
    isWindowsExplorerClient,
    // 是否为可能导致0KB文件问题的客户端类型
    isPotentiallyProblematicClient: isWindowsClient || isRaiDriveClient,
    userAgent,
  };
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
  try {
    // 识别客户端类型
    const clientInfo = identifyClient(c);

    // 记录客户端信息，帮助调试
    console.log(`WebDAV PUT - 客户端类型: ${clientInfo.userAgent}`);

    // 检查并记录Content-Length头信息
    const contentLengthHeader = c.req.header("Content-Length");
    const declaredContentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : -1;

    if (declaredContentLength === 0) {
      console.log(`WebDAV PUT - 警告: Content-Length为0，可能是意图创建空文件或请求异常`);
    } else if (declaredContentLength > 0) {
      console.log(`WebDAV PUT - Content-Length: ${declaredContentLength} 字节`);
    } else {
      console.log(`WebDAV PUT - 未提供Content-Length头或无效值`);
    }

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

    // 创建S3客户端
    const s3Client = await createS3Client(s3Config, c.env.ENCRYPTION_SECRET);

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

    // 获取请求体，使用不同的方法确保完整读取
    let body;

    try {
      // 完整读取请求体
      body = await c.req.arrayBuffer();

      // 验证数据完整性 - 检查Content-Length头与实际接收的数据大小
      if (declaredContentLength > 0 && body.byteLength !== declaredContentLength) {
        // 数据大小不匹配，可能是数据传输过程中的问题
        console.error(`WebDAV PUT - 数据完整性错误: Content-Length声明 ${declaredContentLength} 字节，但实际接收 ${body.byteLength} 字节`);

        // 如果收到的数据为0字节，但声明了非0大小，这可能是Windows/RaiDrive客户端的特定问题
        if (body.byteLength === 0 && clientInfo.isPotentiallyProblematicClient) {
          return new Response("请求数据不完整: 可能由于请求缓冲区配置问题，请尝试使用其他WebDAV客户端或联系管理员", {
            status: 400, // Bad Request
            headers: { "Content-Type": "text/plain" },
          });
        }
      }

      // 对于Windows/RaiDrive客户端，如果收到0字节数据但声明非0大小，返回特定错误
      if (body.byteLength === 0 && declaredContentLength > 0 && clientInfo.isPotentiallyProblematicClient) {
        return new Response("因请求缓冲区配置，未能完整接收数据。请使用分片上传或其他客户端", {
          status: 400, // Bad Request
          headers: { "Content-Type": "text/plain" },
        });
      }

      console.log(`WebDAV PUT - 成功读取请求体: ${body.byteLength} 字节`);
    } catch (readError) {
      console.error(`WebDAV PUT - 读取请求体出错:`, readError);
      return new Response(`读取请求数据失败: ${readError.message}`, {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // 为可能导致问题的客户端降低分片上传阈值
    const effectiveThreshold = clientInfo.isPotentiallyProblematicClient ? WINDOWS_CLIENT_MULTIPART_THRESHOLD : MULTIPART_THRESHOLD;

    // 根据文件大小决定使用普通上传还是分片上传
    if (body.byteLength > 0 && body.byteLength > effectiveThreshold) {
      // 大文件：使用分片上传
      console.log(
        `WebDAV PUT - 文件名: ${filename}, 大小: ${body.byteLength}字节, 使用分片上传 (针对${
          clientInfo.isPotentiallyProblematicClient ? "特定客户端" : "标准"
        }阈值: ${effectiveThreshold}字节)`
      );

      let uploadId = null;
      let s3Key = null;

      try {
        // 初始化分片上传
        const initResult = await initializeMultipartUpload(db, path, contentType, body.byteLength, userId, userType, c.env.ENCRYPTION_SECRET, filename);

        uploadId = initResult.uploadId;
        s3Key = initResult.key;
        const recommendedPartSize = initResult.recommendedPartSize || effectiveThreshold;

        // 计算分片数
        const totalParts = Math.ceil(body.byteLength / recommendedPartSize);
        const parts = [];

        console.log(`WebDAV PUT - 开始分片上传，总分片数: ${totalParts}`);

        // 循环上传每个分片
        for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
          // 计算当前分片的起始和结束位置
          const start = (partNumber - 1) * recommendedPartSize;
          const end = Math.min(partNumber * recommendedPartSize, body.byteLength);
          const isLastPart = partNumber === totalParts;

          // 提取分片数据
          const partData = body.slice(start, end);

          console.log(`WebDAV PUT - 上传分片 #${partNumber}/${totalParts}, 大小: ${partData.byteLength}字节`);

          // 上传分片
          const partResult = await uploadPart(db, path, uploadId, partNumber, partData, userId, userType, c.env.ENCRYPTION_SECRET, s3Key);

          // 记录分片信息
          parts.push({
            partNumber: partNumber,
            etag: partResult.etag,
          });
        }

        console.log(`WebDAV PUT - 所有分片上传完成，开始完成分片上传`);

        // 完成分片上传
        await completeMultipartUpload(db, path, uploadId, parts, userId, userType, c.env.ENCRYPTION_SECRET, s3Key);

        // 清理缓存
        await finalizePutOperation(db, s3Client, s3Config, s3SubPath);

        console.log(`WebDAV PUT - 分片上传完成成功`);
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
    } else {
      // 小文件或空文件：使用普通上传
      if (body.byteLength === 0) {
        // 对于可能有问题的客户端，如果我们收到0字节数据但通过Content-Length声明了非零大小，这是一个错误情况
        if (declaredContentLength > 0 && clientInfo.isPotentiallyProblematicClient) {
          console.error(`WebDAV PUT - 疑似0KB文件问题: 声明大小${declaredContentLength}字节，但收到0字节`);
          return new Response("检测到可能的0KB文件问题，请使用其他WebDAV客户端或配置", {
            status: 400,
            headers: { "Content-Type": "text/plain" },
          });
        }

        console.log(`WebDAV PUT - 检测到0字节文件，使用普通上传`);
      } else {
        console.log(`WebDAV PUT - 文件大小(${body.byteLength}字节) <= 阈值(${effectiveThreshold}字节)，使用普通上传`);
      }

      // 上传到S3
      const putParams = {
        Bucket: s3Config.bucket_name,
        Key: s3SubPath,
        Body: body,
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
