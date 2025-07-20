/**
 * URL上传服务
 * 负责URL验证、元信息获取和处理逻辑
 */

import { DbTables } from "../constants/index.js";
import { generateFileId, generateShortId, getFileNameAndExt, getSafeFileName } from "../utils/common.js";
import { buildS3Url, generatePresignedPutUrl } from "../utils/s3Utils.js";
import { S3Client, PutObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { createS3Client } from "../utils/s3Utils.js";
import { clearCache } from "../utils/DirectoryCache.js";
import { getEnhancedUrlMetadata as getEnhancedMimeMetadata } from "../utils/enhancedMimeUtils.js";
import { PermissionUtils } from "../utils/permissionUtils.js";
import { normalizeS3SubPath } from "../storage/drivers/s3/utils/S3PathUtils.js";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { hashPassword } from "../utils/crypto.js";
import { updateParentDirectoriesModifiedTimeHelper } from "../storage/drivers/s3/utils/S3DirectoryUtils.js";

// 分片上传配置
const DEFAULT_PART_SIZE = 5 * 1024 * 1024; // 5MB默认分片大小
const MIN_PARTS = 1; // 最小分片数，确保每个文件至少被分为1片
const MAX_PART_SIZE = 50 * 1024 * 1024; // 50MB最大分片大小

/**
 * 格式化文件大小为人类可读格式
 * @param {number} bytes - 文件大小（字节）
 * @returns {string} 格式化后的文件大小
 */
function formatFileSize(bytes) {
  if (bytes === 0 || bytes === undefined || bytes === null) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * 根据文件大小计算最优分片大小
 * 小文件使用较大的分片以减少分片数量，但保证至少有MIN_PARTS个分片
 * 大文件使用默认分片大小以确保可靠性
 * @param {number} fileSize - 文件大小（字节）
 * @returns {number} 最优分片大小（字节）
 */
function calculateOptimalPartSize(fileSize) {
  // 如果按默认分片大小会导致分片数少于MIN_PARTS
  if (fileSize / DEFAULT_PART_SIZE < MIN_PARTS) {
    // 计算分片大小，确保正好有MIN_PARTS个分片
    const optimalPartSize = Math.ceil(fileSize / MIN_PARTS);
    // 确保分片大小不超过最大值
    return Math.min(optimalPartSize, MAX_PART_SIZE);
  }

  // 否则使用默认分片大小
  return DEFAULT_PART_SIZE;
}

/**
 * 验证URL并获取文件元信息（增强版）
 * @param {string} url - 要验证的URL
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 包含文件元信息的对象
 * @throws {Error} 如果URL无效或无法访问
 */
export async function validateAndGetUrlMetadata(url, options = {}) {
  const { enableEnhancedMimeDetection = true } = options;

  try {
    // 验证URL格式
    const parsedUrl = new URL(url);

    // 确保协议为http或https
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new Error("仅支持HTTP/HTTPS协议的URL");
    }

    // 如果启用增强MIME检测，优先使用增强检测
    if (enableEnhancedMimeDetection) {
      try {
        // 先获取基本元数据以获取真实文件名
        let realFilename = null;
        try {
          const headResponse = await fetch(url, { method: "HEAD" });
          if (headResponse.ok) {
            const contentDisposition = headResponse.headers.get("Content-Disposition");
            realFilename = extractFilenameFromContentDisposition(contentDisposition);

            if (!realFilename) {
              const urlObj = new URL(url);
              realFilename = urlObj.pathname.split("/").pop();
              try {
                realFilename = decodeURIComponent(realFilename);
              } catch (e) {
                // 解码失败，保持原样
              }
            }
          }
        } catch (headError) {
          // HEAD请求失败，从URL提取文件名
          const urlObj = new URL(url);
          realFilename = urlObj.pathname.split("/").pop();
        }

        console.log(`🚀 使用增强MIME检测: ${url}, 真实文件名: ${realFilename}`);
        const enhancedMetadata = await getEnhancedMimeMetadata(url, realFilename, options);

        if (enhancedMetadata && !enhancedMetadata.error) {
          // 转换为兼容格式
          const metadata = {
            url: enhancedMetadata.url,
            filename: enhancedMetadata.filename,
            contentType: enhancedMetadata.enhancedContentType || enhancedMetadata.contentType,
            size: enhancedMetadata.size,
            lastModified: enhancedMetadata.lastModified,
            method: "ENHANCED",
            corsSupported: enhancedMetadata.corsSupported,
            // 增强信息
            detectionMethod: enhancedMetadata.detectionMethod,
            detectionConfidence: enhancedMetadata.detectionConfidence,
            fileTypeLibraryUsed: enhancedMetadata.fileTypeLibraryUsed,
          };

          console.log(`✅ 增强检测成功: ${metadata.contentType} (置信度: ${metadata.detectionConfidence})`);
          return metadata;
        }
      } catch (enhancedError) {
        console.warn("增强MIME检测失败，回退到传统方法:", enhancedError.message);
      }
    }

    // 回退到传统检测方法
    console.log(`📡 使用传统HEAD/Range检测: ${url}`);

    // 首先尝试HEAD请求获取元信息
    let response;
    let method = "HEAD";
    let metadata = {};
    let corsSupported = false;

    try {
      // 尝试HEAD请求
      response = await fetch(url, {
        method: "HEAD",
        headers: {
          "User-Agent": "CloudPaste/1.0",
        },
      });

      // 如果HEAD请求返回404或其他错误，尝试使用Range请求
      if (!response.ok) {
        throw new Error("HEAD请求失败，尝试Range请求");
      }

      corsSupported = isCorsSupported(response);
    } catch (headError) {
      // HEAD请求失败，尝试Range请求获取少量数据
      console.log("HEAD请求失败，尝试使用Range请求:", headError.message);
      method = "GET";

      try {
        response = await fetch(url, {
          method: "GET",
          headers: {
            Range: "bytes=0-1023", // 只获取前1KB数据
            "User-Agent": "CloudPaste/1.0",
          },
        });

        if (!response.ok && response.status !== 206) {
          throw new Error(`Range请求失败，状态码: ${response.status}`);
        }

        corsSupported = isCorsSupported(response);
      } catch (rangeError) {
        throw new Error(`无法访问此URL: ${rangeError.message}`);
      }
    }

    // 从响应头获取文件信息
    const contentType = response.headers.get("Content-Type") || "application/octet-stream";
    const contentLength = response.headers.get("Content-Length");
    const contentDisposition = response.headers.get("Content-Disposition");
    const lastModified = response.headers.get("Last-Modified");

    // 尝试从Content-Disposition获取文件名
    let filename = extractFilenameFromContentDisposition(contentDisposition);

    // 如果无法从Content-Disposition获取，则从URL路径中提取
    if (!filename) {
      filename = parsedUrl.pathname.split("/").pop();
      // 解码URL编码的文件名
      try {
        filename = decodeURIComponent(filename);
      } catch (e) {
        // 如果解码失败，保持原样
      }
    }

    // 如果还是无法获取有效文件名，使用域名加时间戳作为文件名
    if (!filename || filename === "" || filename === "/") {
      const timestamp = new Date().getTime();
      const host = parsedUrl.hostname.replace(/\./g, "_");
      filename = `${host}_${timestamp}`;

      // 如果有Content-Type，尝试添加适当的扩展名
      if (contentType && contentType !== "application/octet-stream") {
        const ext = getExtensionFromMimeType(contentType);
        if (ext) {
          filename += ext;
        }
      }
    }

    // 构建元数据对象
    metadata = {
      url: url,
      filename: filename,
      contentType: contentType,
      size: contentLength ? parseInt(contentLength) : null,
      lastModified: lastModified,
      method: method,
      corsSupported: corsSupported,
    };

    return metadata;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("Invalid URL")) {
      throw new Error("无效的URL格式");
    }
    throw error;
  }
}

/**
 * 检查响应是否支持CORS
 * @param {Response} response - fetch响应对象
 * @returns {boolean} 是否支持CORS
 */
function isCorsSupported(response) {
  // 检查是否有CORS相关响应头
  const corsHeaders = ["Access-Control-Allow-Origin", "Access-Control-Allow-Methods", "Access-Control-Allow-Headers"];

  for (const header of corsHeaders) {
    if (response.headers.get(header)) {
      return true;
    }
  }

  return false;
}

/**
 * 从Content-Disposition头提取文件名
 * @param {string} contentDisposition - Content-Disposition头的值
 * @returns {string|null} 提取的文件名或null
 */
function extractFilenameFromContentDisposition(contentDisposition) {
  if (!contentDisposition) return null;

  // 支持这两种格式:
  // Content-Disposition: attachment; filename="filename.jpg"
  // Content-Disposition: attachment; filename*=UTF-8''filename.jpg

  let filename = null;

  // 尝试提取常规filename
  const filenameRegex = /filename\s*=\s*"?([^";]+)"?/i;
  const matches = contentDisposition.match(filenameRegex);
  if (matches && matches[1]) {
    filename = matches[1];
  }

  // 尝试提取filename*
  const filenameStarRegex = /filename\*\s*=\s*([^']+)'[^']*'([^;]+)/i;
  const starMatches = contentDisposition.match(filenameStarRegex);
  if (starMatches && starMatches[2]) {
    try {
      // 解码URL编码的文件名
      filename = decodeURIComponent(starMatches[2]);
    } catch (e) {
      // 如果解码失败，使用原始文件名
      filename = starMatches[2];
    }
  }

  return filename;
}

/**
 * 从MIME类型获取文件扩展名
 * @param {string} mimeType - MIME类型
 * @returns {string|null} 文件扩展名（包含.）或null
 */
function getExtensionFromMimeType(mimeType) {
  const mimeToExtMap = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "text/plain": ".txt",
    "text/html": ".html",
    "text/css": ".css",
    "text/javascript": ".js",
    "application/json": ".json",
    "application/pdf": ".pdf",
    "application/zip": ".zip",
    "application/x-rar-compressed": ".rar",
    "application/x-tar": ".tar",
    "application/x-gzip": ".gz",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.ms-powerpoint": ".ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "audio/mpeg": ".mp3",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/ogg": ".ogv",
  };

  // 先尝试精确匹配
  if (mimeToExtMap[mimeType]) {
    return mimeToExtMap[mimeType];
  }

  // 如果没有精确匹配，尝试类型匹配
  const mainType = mimeType.split("/")[0];
  switch (mainType) {
    case "image":
      return ".img";
    case "text":
      return ".txt";
    case "audio":
      return ".audio";
    case "video":
      return ".video";
    case "application":
      return ".bin";
    default:
      return null;
  }
}

/**
 * 代理转发URL内容（用于不支持CORS的资源）
 * @param {string} url - 源URL
 * @returns {Promise<Response>} 可直接返回的Response流
 * @throws {Error} 如果URL无法访问
 */
export async function proxyUrlContent(url) {
  try {
    // 验证URL格式
    const parsedUrl = new URL(url);

    // 确保协议为http或https
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new Error("仅支持HTTP/HTTPS协议的URL");
    }

    // 请求源URL并流式返回内容
    const response = await fetch(url, {
      headers: {
        "User-Agent": "CloudPaste/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`源服务器返回错误状态码: ${response.status}`);
    }

    // 创建一个新的响应，添加CORS头
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");

    // 返回新的响应，保持原始响应的流
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: headers,
    });
  } catch (error) {
    throw new Error(`代理URL内容失败: ${error.message}`);
  }
}

/**
 * 为URL上传准备S3预签名URL和文件记录
 * @param {D1Database} db - D1数据库实例
 * @param {string} s3ConfigId - S3配置ID
 * @param {Object} metadata - 文件元数据
 * @param {string} createdBy - 创建者标识 (admin:ID或apikey:ID)
 * @param {string} encryptionSecret - 加密密钥
 * @param {Object} [options] - 额外选项
 * @param {string} [options.slug] - 自定义slug
 * @param {string} [options.remark] - 自定义备注
 * @param {string} [options.path] - 自定义存储路径
 * @returns {Promise<Object>} 包含fileId、uploadUrl和其他上传信息
 */
export async function prepareUrlUpload(db, s3ConfigId, metadata, createdBy, encryptionSecret, options = {}) {
  // 获取S3配置
  const s3Config = await db.prepare(`SELECT * FROM ${DbTables.S3_CONFIGS} WHERE id = ?`).bind(s3ConfigId).first();

  if (!s3Config) {
    throw new Error("指定的S3配置不存在");
  }

  // 生成文件ID
  const fileId = generateFileId();

  // 处理文件名
  const { name: fileName, ext: fileExt } = getFileNameAndExt(metadata.filename);
  const safeFileName = getSafeFileName(fileName).substring(0, 50); // 限制长度

  // 生成短ID和存储路径
  const shortId = generateShortId();

  // 处理自定义路径
  let customPath = "";
  if (options.path) {
    customPath = options.path.startsWith("/") ? options.path.substring(1) : options.path;
    // 确保路径以'/'结尾
    if (customPath && customPath.trim() !== "") {
      customPath = customPath.trim();
      if (!customPath.endsWith("/")) {
        customPath += "/";
      }
    }
  }

  // 组合最终路径
  let storagePath;
  if (options.authType === "apikey" && options.apiKeyInfo && options.apiKeyInfo.basicPath && options.apiKeyInfo.basicPath !== "/") {
    // 对于API密钥用户，检查权限并使用挂载点匹配逻辑来正确提取子路径
    // 获取API密钥可访问的挂载点
    const mounts = await PermissionUtils.getAccessibleMounts(db, options.apiKeyInfo, "apiKey");

    // 检查当前S3配置是否在API密钥的权限范围内
    const hasPermission = mounts.some((mount) => mount.storage_config_id === s3Config.id);
    if (!hasPermission) {
      throw new Error("没有权限使用此存储配置");
    }

    // 按照路径长度降序排序，以便优先匹配最长的路径
    mounts.sort((a, b) => b.mount_path.length - a.mount_path.length);

    let actualStoragePath = "";

    // 查找匹配的挂载点
    for (const mount of mounts) {
      // 只处理与当前S3配置匹配的挂载点
      if (mount.storage_config_id !== s3Config.id) continue;

      const mountPath = mount.mount_path.startsWith("/") ? mount.mount_path : "/" + mount.mount_path;

      // 如果basic_path匹配挂载点或者是挂载点的子路径
      if (options.apiKeyInfo.basicPath === mountPath || options.apiKeyInfo.basicPath === mountPath + "/" || options.apiKeyInfo.basicPath.startsWith(mountPath + "/")) {
        // 计算子路径
        let subPath = options.apiKeyInfo.basicPath.substring(mountPath.length);
        if (!subPath.startsWith("/")) {
          subPath = "/" + subPath;
        }

        // 使用normalizeS3SubPath来规范化子路径
        actualStoragePath = normalizeS3SubPath(subPath, s3Config, true);
        break;
      }
    }

    // 获取默认文件夹路径
    const folderPath = s3Config.default_folder ? (s3Config.default_folder.endsWith("/") ? s3Config.default_folder : s3Config.default_folder + "/") : "";

    // 路径组合：实际存储路径 + 默认文件夹 + 用户自定义路径 + 文件名
    storagePath = actualStoragePath + folderPath + customPath + shortId + "-" + safeFileName + fileExt;
  } else {
    // 对于管理员用户或没有basic_path的API密钥用户，使用默认文件夹
    const folderPath = s3Config.default_folder ? (s3Config.default_folder.endsWith("/") ? s3Config.default_folder : s3Config.default_folder + "/") : "";
    storagePath = folderPath + customPath + shortId + "-" + safeFileName + fileExt;
  }

  // 处理自定义slug或生成一个随机slug
  let slug;
  if (options.slug) {
    // 验证自定义slug格式（只允许字母、数字、连字符和下划线）
    const slugRegex = /^[a-zA-Z0-9_-]+$/;
    if (!slugRegex.test(options.slug)) {
      throw new Error("自定义链接格式无效，只允许字母、数字、连字符和下划线");
    }

    // 检查slug是否已被占用
    const existingSlug = await db.prepare(`SELECT id FROM ${DbTables.FILES} WHERE slug = ?`).bind(options.slug).first();
    if (existingSlug) {
      throw new Error("自定义链接已被占用，请选择其他链接标识");
    }

    slug = options.slug;
  } else {
    // 没有提供自定义slug，使用随机生成的
    slug = generateShortId();
  }

  // 处理备注
  let remark;
  if (options.remark) {
    remark = options.remark;
  } else {
    remark = `从URL上传: ${metadata.url.substring(0, 255)}`; // 保存源URL作为备注，限制长度
  }

  // 生成S3 URL
  const s3Url = buildS3Url(s3Config, storagePath);

  // 生成预签名上传URL，使用S3配置的默认时效
  const uploadUrl = await generatePresignedPutUrl(s3Config, storagePath, metadata.contentType, encryptionSecret);

  // 创建文件记录
  await db
    .prepare(
      `
      INSERT INTO ${DbTables.FILES} (
        id, slug, filename, storage_path, s3_url,
        s3_config_id, mimetype, size, etag,
        created_by, created_at, updated_at, remark
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?
      )
    `
    )
    .bind(
      fileId,
      slug,
      metadata.filename,
      storagePath,
      s3Url,
      s3ConfigId,
      metadata.contentType || "application/octet-stream",
      metadata.size || 0, // 初始大小可能为0或来自元数据
      null, // 初始ETag为null，在上传完成后更新
      createdBy,
      remark
    )
    .run();

  // 返回上传信息
  return {
    file_id: fileId,
    upload_url: uploadUrl,
    storage_path: storagePath,
    s3_url: s3Url,
    slug: slug,
    provider_type: s3Config.provider_type,
    filename: metadata.filename,
    contentType: metadata.contentType,
    size: metadata.size,
    cors_supported: metadata.corsSupported,
  };
}

/**
 * 从S3 SDK获取对应的签名V4实现
 * @param {Object} s3Config - S3配置信息
 * @returns {Function} 签名函数
 */
async function getSignatureFunction(s3Config) {
  return getSignedUrl;
}

/**
 * 初始化分片上传并生成预签名URLs
 * @param {D1Database} db - D1数据库实例
 * @param {string} url - 要上传的URL
 * @param {string} s3ConfigId - S3配置ID
 * @param {Object} metadata - 文件元数据，从验证URL步骤获得
 * @param {string} createdBy - 创建者标识 (admin:ID或apikey:ID)
 * @param {string} encryptionSecret - 加密密钥
 * @param {Object} options - 额外选项
 * @param {number} options.partSize - 分片大小（字节）
 * @param {number} options.totalSize - 估计的总文件大小（字节）
 * @param {number} options.partCount - 分片数量
 * @param {string} options.slug - 自定义slug
 * @param {string} options.remark - 自定义备注
 * @param {string} options.password - 加密密码
 * @param {number} options.expires_in - 过期时间（小时）
 * @param {number} options.max_views - 最大查看次数
 * @param {string} options.path - 自定义存储路径
 * @returns {Promise<Object>} 包含文件ID、uploadId和预签名URL列表的对象
 */
export async function initializeMultipartUpload(db, url, s3ConfigId, metadata, createdBy, encryptionSecret, options = {}) {
  // 获取S3配置
  const s3Config = await db.prepare(`SELECT * FROM ${DbTables.S3_CONFIGS} WHERE id = ?`).bind(s3ConfigId).first();

  if (!s3Config) {
    throw new Error("指定的S3配置不存在");
  }

  // 生成文件ID
  const fileId = generateFileId();

  // 处理文件名
  const { name: fileName, ext: fileExt } = getFileNameAndExt(metadata.filename);
  const safeFileName = getSafeFileName(fileName).substring(0, 50); // 限制长度

  // 生成短ID和存储路径
  const shortId = generateShortId();

  // 处理自定义路径
  let customPath = "";
  if (options.path) {
    customPath = options.path.startsWith("/") ? options.path.substring(1) : options.path;
    // 确保路径以'/'结尾
    if (customPath && customPath.trim() !== "") {
      customPath = customPath.trim();
      if (!customPath.endsWith("/")) {
        customPath += "/";
      }
    }
  }

  // 组合最终路径
  let storagePath;
  if (options.authType === "apikey" && options.apiKeyInfo && options.apiKeyInfo.basicPath && options.apiKeyInfo.basicPath !== "/") {
    // 对于API密钥用户，检查权限并使用挂载点匹配逻辑来正确提取子路径
    // 获取API密钥可访问的挂载点
    const mounts = await PermissionUtils.getAccessibleMounts(db, options.apiKeyInfo, "apiKey");

    // 检查当前S3配置是否在API密钥的权限范围内
    const hasPermission = mounts.some((mount) => mount.storage_config_id === s3Config.id);
    if (!hasPermission) {
      throw new Error("没有权限使用此存储配置");
    }

    // 按照路径长度降序排序，以便优先匹配最长的路径
    mounts.sort((a, b) => b.mount_path.length - a.mount_path.length);

    let actualStoragePath = "";

    // 查找匹配的挂载点
    for (const mount of mounts) {
      // 只处理与当前S3配置匹配的挂载点
      if (mount.storage_config_id !== s3Config.id) continue;

      const mountPath = mount.mount_path.startsWith("/") ? mount.mount_path : "/" + mount.mount_path;

      // 如果basic_path匹配挂载点或者是挂载点的子路径
      if (options.apiKeyInfo.basicPath === mountPath || options.apiKeyInfo.basicPath === mountPath + "/" || options.apiKeyInfo.basicPath.startsWith(mountPath + "/")) {
        // 计算子路径
        let subPath = options.apiKeyInfo.basicPath.substring(mountPath.length);
        if (!subPath.startsWith("/")) {
          subPath = "/" + subPath;
        }

        // 使用normalizeS3SubPath来规范化子路径
        actualStoragePath = normalizeS3SubPath(subPath, s3Config, true);
        break;
      }
    }

    // 获取默认文件夹路径
    const folderPath = s3Config.default_folder ? (s3Config.default_folder.endsWith("/") ? s3Config.default_folder : s3Config.default_folder + "/") : "";

    // 路径组合：实际存储路径 + 默认文件夹 + 用户自定义路径 + 文件名
    storagePath = actualStoragePath + folderPath + customPath + shortId + "-" + safeFileName + fileExt;
  } else {
    // 对于管理员用户或没有basic_path的API密钥用户，使用默认文件夹
    const folderPath = s3Config.default_folder ? (s3Config.default_folder.endsWith("/") ? s3Config.default_folder : s3Config.default_folder + "/") : "";
    storagePath = folderPath + customPath + shortId + "-" + safeFileName + fileExt;
  }

  // 处理自定义slug或生成随机slug
  let slug;
  if (options.slug) {
    // 验证自定义slug格式（只允许字母、数字、连字符和下划线）
    const slugRegex = /^[a-zA-Z0-9_-]+$/;
    if (!slugRegex.test(options.slug)) {
      throw new Error("自定义链接格式无效，只允许字母、数字、连字符和下划线");
    }

    // 检查slug是否已被占用
    const existingSlug = await db.prepare(`SELECT id FROM ${DbTables.FILES} WHERE slug = ?`).bind(options.slug).first();
    if (existingSlug) {
      throw new Error("自定义链接已被占用，请选择其他链接标识");
    }

    slug = options.slug;
  } else {
    // 没有提供自定义slug，使用随机生成的
    slug = generateShortId();
  }

  // 处理备注
  let remark;
  if (options.remark) {
    remark = options.remark;
  } else {
    remark = `从URL分片上传: ${url.substring(0, 255)}`; // 保存源URL作为备注，限制长度
  }

  // 处理密码
  let passwordHash = null;
  if (options.password) {
    // 使用与s3UploadRoutes相同的哈希方法
    passwordHash = await hashPassword(options.password);
  }

  // 处理过期时间
  let expiresAt = null;
  if (options.expires_in) {
    const expiresInHours = parseInt(options.expires_in);
    if (!isNaN(expiresInHours) && expiresInHours > 0) {
      const expiresDate = new Date();
      expiresDate.setHours(expiresDate.getHours() + expiresInHours);
      expiresAt = expiresDate.toISOString();
    }
  }

  // 处理最大查看次数
  const maxViews = options.max_views ? parseInt(options.max_views) : null;

  // 生成S3 URL
  const s3Url = buildS3Url(s3Config, storagePath);

  // 创建S3客户端
  const s3Client = await createS3Client(s3Config, encryptionSecret);

  try {
    // 初始化分片上传
    const createCommand = new CreateMultipartUploadCommand({
      Bucket: s3Config.bucket_name,
      Key: storagePath,
      ContentType: metadata.contentType || "application/octet-stream",
    });

    console.log(`正在初始化分片上传: ${storagePath}`);
    const createResult = await s3Client.send(createCommand);
    const uploadId = createResult.UploadId;

    if (!uploadId) {
      throw new Error("初始化分片上传失败：未返回uploadId");
    }

    console.log(`分片上传初始化成功，uploadId: ${uploadId}`);

    // 确定分片大小和数量
    const partSize = options.partSize || DEFAULT_PART_SIZE;
    const totalSize = options.totalSize || metadata.size || 0;
    const partCount = options.partCount || Math.max(1, Math.ceil(totalSize / partSize));

    // 获取签名函数
    const getSignedUrl = await getSignatureFunction(s3Config);

    // 为每个分片生成预签名URL
    const presignedUrls = [];
    for (let partNumber = 1; partNumber <= partCount; partNumber++) {
      const uploadPartCommand = new UploadPartCommand({
        Bucket: s3Config.bucket_name,
        Key: storagePath,
        UploadId: uploadId,
        PartNumber: partNumber,
      });

      // 生成预签名URL，使用S3配置的默认时效
      const presignedUrl = await getSignedUrl(s3Client, uploadPartCommand, { expiresIn: s3Config.signature_expires_in || 3600 });

      presignedUrls.push({
        partNumber: partNumber,
        url: presignedUrl,
      });
    }

    // 创建文件记录
    await db
      .prepare(
        `
        INSERT INTO ${DbTables.FILES} (
          id, slug, filename, storage_path, s3_url,
          s3_config_id, mimetype, size, etag,
          created_by, created_at, updated_at, remark,
          password, expires_at, max_views
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?,
          ?, ?, ?
        )
      `
      )
      .bind(
        fileId,
        slug,
        metadata.filename,
        storagePath,
        s3Url,
        s3ConfigId,
        metadata.contentType || "application/octet-stream",
        totalSize, // 初始大小
        null, // 初始ETag为null，在上传完成后更新
        createdBy,
        remark,
        passwordHash,
        expiresAt,
        maxViews
      )
      .run();

    // 如果设置了密码，保存明文密码记录（用于分享）
    if (options.password) {
      await db
        .prepare(`INSERT INTO ${DbTables.FILE_PASSWORDS} (file_id, plain_password, created_at, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
        .bind(fileId, options.password)
        .run();
    }

    // 返回分片上传信息
    return {
      file_id: fileId,
      upload_id: uploadId,
      storage_path: storagePath,
      s3_url: s3Url,
      slug: slug,
      presigned_urls: presignedUrls,
      part_size: partSize,
      total_size: totalSize,
      part_count: partCount,
      provider_type: s3Config.provider_type,
      filename: metadata.filename,
      content_type: metadata.contentType,
      cors_supported: metadata.corsSupported,
      has_password: !!passwordHash,
      expires_at: expiresAt,
      max_views: maxViews,
      url: `/file/${slug}`, // 文件的最终URL
    };
  } catch (error) {
    console.error(`初始化分片上传失败: ${error.message}`, error);
    throw new Error(`初始化分片上传失败: ${error.message}`);
  }
}

/**
 * 完成分片上传流程
 * @param {D1Database} db - D1数据库实例
 * @param {string} fileId - 文件ID
 * @param {string} uploadId - 上传ID，由前端传入
 * @param {Array<Object>} parts - 已上传的分片信息数组，每个对象包含 {partNumber, etag}
 * @param {string} encryptionSecret - 加密密钥
 * @returns {Promise<Object>} 包含完成的文件信息
 */
export async function completeMultipartUpload(db, fileId, uploadId, parts, encryptionSecret) {
  // 查询文件信息
  const file = await db
    .prepare(
      `
      SELECT 
        id, slug, filename, storage_path, s3_url, 
        s3_config_id, mimetype, remark
      FROM ${DbTables.FILES}
      WHERE id = ?
        `
    )
    .bind(fileId)
    .first();

  if (!file) {
    throw new Error("文件不存在或已被删除");
  }

  // 获取S3配置
  const s3Config = await db.prepare(`SELECT * FROM ${DbTables.S3_CONFIGS} WHERE id = ?`).bind(file.s3_config_id).first();

  if (!s3Config) {
    throw new Error("无法找到对应的S3配置");
  }

  // 创建S3客户端
  const s3Client = await createS3Client(s3Config, encryptionSecret);

  try {
    console.log(`正在完成分片上传: ${file.storage_path}, uploadId=${uploadId}`);

    // 验证并排序分片信息
    if (!Array.isArray(parts) || parts.length === 0) {
      throw new Error("无效的分片信息");
    }

    // 确保分片按照partNumber排序
    const sortedParts = [...parts].sort((a, b) => a.partNumber - b.partNumber);

    // 准备CompleteMultipartUpload命令
    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: s3Config.bucket_name,
      Key: file.storage_path,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sortedParts.map((part) => ({
          PartNumber: part.partNumber,
          ETag: part.etag,
        })),
      },
    });

    // 发送完成命令
    const completeResult = await s3Client.send(completeCommand);
    const etag = completeResult.ETag ? completeResult.ETag.replace(/"/g, "") : null;

    console.log(`分片上传已完成: ${file.storage_path}, ETag=${etag}`);

    // 计算总大小
    let totalSize = 0;
    if (parts.length > 0 && parts[0].size) {
      // 如果分片信息包含大小，计算总大小
      totalSize = parts.reduce((sum, part) => sum + (part.size || 0), 0);
    }

    // 更新文件记录
    await db
      .prepare(
        `
        UPDATE ${DbTables.FILES}
        SET
          etag = ?,
          size = CASE WHEN ? > 0 THEN ? ELSE size END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      )
      .bind(
        etag,
        totalSize > 0 ? 1 : 0, // 条件
        totalSize,
        fileId
      )
      .run();

    // 更新父目录的修改时间
    await updateParentDirectoriesModifiedTimeHelper(s3Config, file.storage_path, encryptionSecret);

    // 清除与文件相关的缓存 - 使用统一的clearCache函数
    try {
      await clearCache({ db, s3ConfigId: file.s3_config_id });
    } catch (cacheError) {
      console.warn(`清除文件缓存失败: ${cacheError.message}`);
    }

    // 获取更新后的文件信息
    const updatedFile = await db
      .prepare(
        `
        SELECT 
          id, slug, filename, storage_path, s3_url, 
          mimetype, size, etag, 
          created_at, updated_at, remark
        FROM ${DbTables.FILES}
        WHERE id = ?
      `
      )
      .bind(fileId)
      .first();

    // 返回完成的文件信息
    return {
      file_id: updatedFile.id,
      slug: updatedFile.slug,
      filename: updatedFile.filename,
      storage_path: updatedFile.storage_path,
      s3_url: updatedFile.s3_url,
      mimetype: updatedFile.mimetype,
      size: updatedFile.size,
      etag: updatedFile.etag,
      created_at: updatedFile.created_at,
      updated_at: updatedFile.updated_at,
      url: `/file/${updatedFile.slug}`,
      status: "completed",
      message: "分片上传已成功完成",
    };
  } catch (error) {
    console.error(`完成分片上传失败: ${error.message}`, error);
    throw new Error(`完成分片上传失败: ${error.message}`);
  }
}

/**
 * 终止分片上传流程
 * @param {D1Database} db - D1数据库实例
 * @param {string} fileId - 文件ID
 * @param {string} uploadId - 上传ID，由前端传入
 * @param {string} encryptionSecret - 加密密钥
 * @returns {Promise<Object>} 包含操作结果的对象
 */
export async function abortMultipartUpload(db, fileId, uploadId, encryptionSecret) {
  // 查询文件信息
  const file = await db
    .prepare(
      `
      SELECT 
        id, slug, filename, storage_path, s3_url, 
        s3_config_id, mimetype, remark
      FROM ${DbTables.FILES}
      WHERE id = ?
    `
    )
    .bind(fileId)
    .first();

  if (!file) {
    throw new Error("文件不存在或已被删除");
  }

  // 获取S3配置
  const s3Config = await db.prepare(`SELECT * FROM ${DbTables.S3_CONFIGS} WHERE id = ?`).bind(file.s3_config_id).first();

  if (!s3Config) {
    throw new Error("无法找到对应的S3配置");
  }

  // 创建S3客户端
  const s3Client = await createS3Client(s3Config, encryptionSecret);

  try {
    console.log(`正在终止分片上传: ${file.storage_path}, uploadId=${uploadId}`);

    // 准备AbortMultipartUpload命令
    const abortCommand = new AbortMultipartUploadCommand({
      Bucket: s3Config.bucket_name,
      Key: file.storage_path,
      UploadId: uploadId,
    });

    // 发送终止命令
    await s3Client.send(abortCommand);

    console.log(`分片上传已终止: ${file.storage_path}`);

    // 决定是删除文件记录还是仅清除uploadId
    // 对于URL上传，我们选择删除整个文件记录，因为中止通常意味着用户放弃了整个上传
    await db.prepare(`DELETE FROM ${DbTables.FILES} WHERE id = ?`).bind(fileId).run();

    // 同时删除可能存在的密码记录
    await db.prepare(`DELETE FROM ${DbTables.FILE_PASSWORDS} WHERE file_id = ?`).bind(fileId).run();

    // 清除与文件相关的缓存 - 使用统一的clearCache函数
    try {
      await clearCache({ db, s3ConfigId: file.s3_config_id });
    } catch (cacheError) {
      console.warn(`清除文件缓存失败: ${cacheError.message}`);
    }

    // 返回操作结果
    return {
      file_id: fileId,
      status: "aborted",
      message: "分片上传已成功终止",
    };
  } catch (error) {
    console.error(`终止分片上传失败: ${error.message}`, error);

    // 即使S3操作失败，我们也尝试清理数据库记录
    try {
      console.log("尝试清理数据库记录...");
      await db.prepare(`DELETE FROM ${DbTables.FILES} WHERE id = ?`).bind(fileId).run();

      await db.prepare(`DELETE FROM ${DbTables.FILE_PASSWORDS} WHERE file_id = ?`).bind(fileId).run();

      // 尝试清除缓存 - 使用统一的clearCache函数
      try {
        await clearCache({ db, s3ConfigId: file.s3_config_id });
      } catch (cacheError) {
        console.warn(`清除文件缓存失败: ${cacheError.message}`);
      }
    } catch (dbError) {
      console.error(`清理数据库记录失败: ${dbError.message}`);
    }

    throw new Error(`终止分片上传失败: ${error.message}`);
  }
}
