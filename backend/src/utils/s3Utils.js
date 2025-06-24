/**
 * S3存储操作相关工具函数
 */

import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ConfiguredRetryStrategy } from "@smithy/util-retry";
import { decryptValue } from "./crypto.js";
import { S3ProviderTypes } from "../constants/index.js";
import { getMimeTypeGroup, MIME_GROUPS, getMimeTypeFromFilename, getFileExtension, shouldUseTextPlainForPreview, getContentTypeAndDisposition } from "./fileUtils.js";

/**
 * 创建S3客户端
 * @param {Object} config - S3配置对象
 * @param {string} encryptionSecret - 用于解密凭证的密钥
 * @returns {Promise<S3Client>} S3客户端实例
 */
export async function createS3Client(config, encryptionSecret) {
  // 解密敏感配置
  const accessKeyId = await decryptValue(config.access_key_id, encryptionSecret);
  const secretAccessKey = await decryptValue(config.secret_access_key, encryptionSecret);

  // 创建S3客户端配置
  const clientConfig = {
    endpoint: config.endpoint_url,
    region: config.region || "auto",
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: config.path_style === 1, // 使用路径样式访问
  };

  // 设置适当的超时时间
  clientConfig.requestTimeout = 30000; // 全局默认超时30秒

  // 设置默认重试策略
  let maxRetries = 3; // 默认最大重试次数
  let retryBackoffStrategy = (attempt) => Math.min(Math.pow(2, attempt) * 500, 10000); // 默认指数退避策略

  // 为不同服务商设置特定配置
  switch (config.provider_type) {
    case S3ProviderTypes.B2:
      // Backblaze B2特定配置
      clientConfig.signatureVersion = "v4";
      clientConfig.customUserAgent = "CloudPaste/1.0";
      clientConfig.requestTimeout = 60000;
      maxRetries = 4;
      // 禁用 B2 不支持的校验和功能
      clientConfig.requestChecksumCalculation = "WHEN_REQUIRED";
      clientConfig.responseChecksumValidation = "WHEN_REQUIRED";
      break;

    case S3ProviderTypes.R2:
      // Cloudflare R2配置
      clientConfig.requestTimeout = 30000;
      // 禁用 R2 不支持的校验和功能
      clientConfig.requestChecksumCalculation = "WHEN_REQUIRED";
      clientConfig.responseChecksumValidation = "WHEN_REQUIRED";
      break;

    case S3ProviderTypes.AWS:
      // AWS配置
      clientConfig.signatureVersion = "v4";
      clientConfig.requestTimeout = 30000;
      maxRetries = 3;
      // 禁用校验和功能以保持一致性
      clientConfig.requestChecksumCalculation = "WHEN_REQUIRED";
      clientConfig.responseChecksumValidation = "WHEN_REQUIRED";
      break;

    case S3ProviderTypes.OTHER:
      clientConfig.signatureVersion = "v4";
      // 禁用可能不兼容的校验和功能
      clientConfig.requestChecksumCalculation = "WHEN_REQUIRED";
      clientConfig.responseChecksumValidation = "WHEN_REQUIRED";
      break;
  }

  // 应用重试策略
  clientConfig.retryStrategy = new ConfiguredRetryStrategy(maxRetries, retryBackoffStrategy);

  // 日志记录所选服务商和配置
  console.log(
      `正在创建S3客户端 (${config.provider_type}), endpoint: ${config.endpoint_url}, region: ${config.region || "auto"}, pathStyle: ${
          config.path_style ? "是" : "否"
      }, maxRetries: ${maxRetries}, checksumMode: ${clientConfig.requestChecksumCalculation || "默认"}`
  );

  // 返回创建的S3客户端
  return new S3Client(clientConfig);
}

/**
 * 构建S3文件公共访问URL
 * @param {Object} s3Config - S3配置
 * @param {string} storagePath - S3存储路径
 * @returns {string} 访问URL
 */
export function buildS3Url(s3Config, storagePath) {
  const bucketName = s3Config.bucket_name;
  const endpointUrl = s3Config.endpoint_url;

  // 去除endpoint_url末尾的斜杠(如果有)
  const endpoint = endpointUrl.endsWith("/") ? endpointUrl.slice(0, -1) : endpointUrl;

  // 确保storagePath不以斜杠开始
  const normalizedPath = storagePath.startsWith("/") ? storagePath.slice(1) : storagePath;

  // 根据配置选择合适的URL格式(路径样式vs虚拟主机样式)
  if (s3Config.path_style === 1) {
    // 路径样式: https://endpoint/bucket/key
    return `${endpoint}/${bucketName}/${normalizedPath}`;
  } else {
    // 虚拟主机样式: https://bucket.endpoint/key

    // 提取endpoint的域名部分
    let domain = endpoint;
    try {
      const url = new URL(endpoint);
      domain = url.host;
    } catch (e) {
      // 处理无效URL，保持原样
    }

    return `${endpoint.split("//")[0]}//${bucketName}.${domain}/${normalizedPath}`;
  }
}

/**
 * 生成S3文件的上传预签名URL
 * @param {Object} s3Config - S3配置
 * @param {string} storagePath - S3存储路径
 * @param {string} mimetype - 文件的MIME类型
 * @param {string} encryptionSecret - 用于解密凭证的密钥
 * @param {number} expiresIn - URL过期时间（秒），如果为null则使用S3配置的默认值
 * @returns {Promise<string>} 预签名URL
 */
export async function generatePresignedPutUrl(s3Config, storagePath, mimetype, encryptionSecret, expiresIn = null) {
  // 如果没有指定过期时间，使用S3配置中的默认值
  const finalExpiresIn = expiresIn || s3Config.signature_expires_in || 3600;
  try {
    // 创建S3客户端
    const s3Client = await createS3Client(s3Config, encryptionSecret);

    // 确保storagePath不以斜杠开始
    const normalizedPath = storagePath.startsWith("/") ? storagePath.slice(1) : storagePath;

    // 创建PutObjectCommand
    // 在预签名URL中指定ContentType，确保MIME类型正确传递
    const command = new PutObjectCommand({
      Bucket: s3Config.bucket_name,
      Key: normalizedPath,
      ContentType: mimetype,
    });

    // 针对不同服务商添加特定头部或参数
    const commandOptions = { expiresIn: finalExpiresIn };

    // 某些服务商可能对预签名URL有不同处理
    switch (s3Config.provider_type) {
      case S3ProviderTypes.B2:
        // B2特殊处理 - 某些情况可能需要添加特定头部
        // 例如Content-SHA1处理，但一般在前端上传时添加
        break;

      case S3ProviderTypes.OTHER:
        break;
    }

    // 生成预签名URL，应用服务商特定选项
    const url = await getSignedUrl(s3Client, command, commandOptions);

    // 保留关键调试日志：确认预签名URL包含ContentType参数
    console.log(`生成预签名PUT URL - 文件[${normalizedPath}], ContentType[${mimetype}]`);

    return url;
  } catch (error) {
    console.error("生成上传预签名URL出错:", error);
    throw new Error("无法生成文件上传链接: " + (error.message || "未知错误"));
  }
}

/**
 * 生成自定义域名的直链URL（无签名）
 * @param {Object} s3Config - S3配置
 * @param {string} storagePath - S3存储路径
 * @returns {string} 自定义域名直链URL
 */
function generateCustomHostDirectUrl(s3Config, storagePath) {
  const normalizedPath = storagePath.startsWith("/") ? storagePath.slice(1) : storagePath;
  const customHost = s3Config.custom_host.endsWith("/") ? s3Config.custom_host.slice(0, -1) : s3Config.custom_host;

  // 根据path_style配置决定是否包含bucket名称
  if (s3Config.path_style) {
    return `${customHost}/${s3Config.bucket_name}/${normalizedPath}`;
  } else {
    return `${customHost}/${normalizedPath}`;
  }
}

/**
 * 替换URL中的主机名
 * @param {string} originalUrl - 原始URL
 * @param {string} customHost - 自定义主机
 * @returns {string} 替换主机后的URL
 */
function replaceHostInUrl(originalUrl, customHost) {
  try {
    const url = new URL(originalUrl);
    const customUrl = new URL(customHost);
    url.hostname = customUrl.hostname;
    url.protocol = customUrl.protocol;
    if (customUrl.port) {
      url.port = customUrl.port;
    }
    return url.toString();
  } catch (error) {
    console.error("替换URL主机失败:", error);
    return originalUrl;
  }
}

/**
 * 生成原始S3预签名URL（内部函数）
 * @param {Object} s3Config - S3配置
 * @param {string} storagePath - S3存储路径
 * @param {string} encryptionSecret - 用于解密凭证的密钥
 * @param {number} expiresIn - URL过期时间（秒）
 * @param {boolean} forceDownload - 是否强制下载（而非预览）
 * @param {string} mimetype - 文件的MIME类型（可选）
 * @returns {Promise<string>} 原始S3预签名URL
 */
async function generateOriginalPresignedUrl(s3Config, storagePath, encryptionSecret, expiresIn, forceDownload = false, mimetype = null) {
  try {
    // 创建S3客户端
    const s3Client = await createS3Client(s3Config, encryptionSecret);

    // 确保storagePath不以斜杠开始
    const normalizedPath = storagePath.startsWith("/") ? storagePath.slice(1) : storagePath;

    // 提取文件名，用于Content-Disposition头
    const fileName = normalizedPath.split("/").pop();

    // 统一从文件名推断MIME类型，不依赖传入的mimetype参数
    const effectiveMimetype = getMimeTypeFromFilename(fileName);
    console.log(`S3文件下载：从文件名[${fileName}]推断MIME类型: ${effectiveMimetype}`);

    // 创建GetObjectCommand
    const commandParams = {
      Bucket: s3Config.bucket_name,
      Key: normalizedPath,
    };

    // 使用统一的函数获取内容类型和处置方式
    const { contentType, contentDisposition } = getContentTypeAndDisposition({
      filename: fileName,
      mimetype: effectiveMimetype,
      forceDownload: forceDownload,
    });

    // 设置S3预签名URL的内容类型和处置方式
    commandParams.ResponseContentType = contentType;
    commandParams.ResponseContentDisposition = contentDisposition;

    // 针对特定服务商添加额外参数
    switch (s3Config.provider_type) {
      case S3ProviderTypes.B2:
        // B2可能需要特殊响应头
        break;
    }

    const command = new GetObjectCommand(commandParams);

    // 生成预签名URL
    const url = await getSignedUrl(s3Client, command, { expiresIn });

    return url;
  } catch (error) {
    console.error("生成预签名URL出错:", error);
    throw new Error("无法生成文件下载链接: " + (error.message || "未知错误"));
  }
}

/**
 * 生成S3文件的下载预签名URL（支持自定义域名）
 * @param {Object} s3Config - S3配置
 * @param {string} storagePath - S3存储路径
 * @param {string} encryptionSecret - 用于解密凭证的密钥
 * @param {number} expiresIn - URL过期时间（秒），如果为null则使用S3配置的默认值
 * @param {boolean} forceDownload - 是否强制下载（而非预览）
 * @param {string} mimetype - 文件的MIME类型（可选）
 * @returns {Promise<string>} 预签名URL或自定义域名URL
 */
export async function generatePresignedUrl(s3Config, storagePath, encryptionSecret, expiresIn = null, forceDownload = false, mimetype = null) {
  // 如果没有指定过期时间，使用S3配置中的默认值
  const finalExpiresIn = expiresIn || s3Config.signature_expires_in || 3600;

  // 如果配置了自定义域名
  if (s3Config.custom_host) {
    if (s3Config.custom_host_signature) {
      // 需要签名的自定义域名：生成预签名URL后替换域名
      const presignedUrl = await generateOriginalPresignedUrl(s3Config, storagePath, encryptionSecret, finalExpiresIn, forceDownload, mimetype);
      return replaceHostInUrl(presignedUrl, s3Config.custom_host);
    } else {
      // 不需要签名的自定义域名：直接返回自定义域名直链
      return generateCustomHostDirectUrl(s3Config, storagePath);
    }
  } else {
    // 没有自定义域名：使用原始S3预签名URL
    return await generateOriginalPresignedUrl(s3Config, storagePath, encryptionSecret, finalExpiresIn, forceDownload, mimetype);
  }
}

/**
 * 从S3存储中删除文件
 * @param {Object} s3Config - S3配置信息
 * @param {string} storagePath - 存储路径
 * @param {string} encryptionSecret - 加密密钥
 * @returns {Promise<boolean>} 是否成功删除
 */
export async function deleteFileFromS3(s3Config, storagePath, encryptionSecret) {
  try {
    const s3Client = await createS3Client(s3Config, encryptionSecret);

    const deleteParams = {
      Bucket: s3Config.bucket_name,
      Key: storagePath,
    };

    await s3Client.send(new DeleteObjectCommand(deleteParams));
    console.log(`成功从S3存储中删除文件: ${storagePath}`);
    return true;
  } catch (error) {
    console.error(`从S3删除文件错误: ${error.message || error}`);
    return false;
  }
}

/**
 * 检查S3对象是否存在
 * @param {S3Client} s3Client - S3客户端实例
 * @param {string} bucketName - 存储桶名称
 * @param {string} key - 对象键名
 * @returns {Promise<boolean>} 对象是否存在
 */
export async function checkS3ObjectExists(s3Client, bucketName, key) {
  try {
    const headParams = {
      Bucket: bucketName,
      Key: key,
    };

    const headCommand = new HeadObjectCommand(headParams);
    await s3Client.send(headCommand);
    return true;
  } catch (error) {
    if (error.$metadata && error.$metadata.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * 获取S3对象元数据
 * @param {S3Client} s3Client - S3客户端实例
 * @param {string} bucketName - 存储桶名称
 * @param {string} key - 对象键名
 * @returns {Promise<Object|null>} 对象元数据，不存在时返回null
 */
export async function getS3ObjectMetadata(s3Client, bucketName, key) {
  try {
    const headParams = {
      Bucket: bucketName,
      Key: key,
    };

    const headCommand = new HeadObjectCommand(headParams);
    return await s3Client.send(headCommand);
  } catch (error) {
    if (error.$metadata && error.$metadata.httpStatusCode === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * 列出S3目录内容
 * @param {S3Client} s3Client - S3客户端实例
 * @param {string} bucketName - 存储桶名称
 * @param {string} prefix - 目录前缀
 * @param {string} delimiter - 分隔符，默认为'/'
 * @param {string} continuationToken - 分页令牌
 * @returns {Promise<Object>} 目录内容
 */
export async function listS3Directory(s3Client, bucketName, prefix, delimiter = "/", continuationToken = undefined) {
  const listParams = {
    Bucket: bucketName,
    Prefix: prefix,
    Delimiter: delimiter,
    ContinuationToken: continuationToken,
  };

  const command = new ListObjectsV2Command(listParams);
  return await s3Client.send(command);
}

/**
 * 递归获取目录中所有文件的预签名URL
 * @param {S3Client} s3Client - 源S3客户端
 * @param {Object} sourceS3Config - 源S3配置
 * @param {Object} targetS3Config - 目标S3配置
 * @param {string} sourcePath - 源目录路径
 * @param {string} targetPath - 目标目录路径
 * @param {string} encryptionSecret - 加密密钥
 * @param {number} expiresIn - URL过期时间（秒）
 * @returns {Promise<Array>} 包含文件预签名URL的数组
 */
export async function getDirectoryPresignedUrls(s3Client, sourceS3Config, targetS3Config, sourcePath, targetPath, encryptionSecret, expiresIn = 3600) {
  // 确保目录路径以斜杠结尾
  const sourcePrefix = sourcePath.endsWith("/") ? sourcePath : sourcePath + "/";
  const targetPrefix = targetPath.endsWith("/") ? targetPath : targetPath + "/";

  // 存储结果
  const items = [];

  // 递归列出目录中的所有文件
  let continuationToken = undefined;

  do {
    // 列出源目录内容
    const listResponse = await listS3Directory(s3Client, sourceS3Config.bucket_name, sourcePrefix, "/", continuationToken);

    // 检查是否有内容
    if (listResponse.Contents && listResponse.Contents.length > 0) {
      // 处理每个对象
      for (const item of listResponse.Contents) {
        const sourceKey = item.Key;

        // 跳过目录标记（与前缀完全匹配的对象）
        if (sourceKey === sourcePrefix) {
          continue;
        }

        // 计算相对路径和目标路径
        const relativePath = sourceKey.substring(sourcePrefix.length);
        const targetKey = targetPrefix + relativePath;

        // 为每个文件生成下载和上传的预签名URL
        const downloadUrl = await generatePresignedUrl(sourceS3Config, sourceKey, encryptionSecret, expiresIn);

        // 获取文件的content-type
        let contentType = "application/octet-stream";
        try {
          const headResponse = await getS3ObjectMetadata(s3Client, sourceS3Config.bucket_name, sourceKey);
          if (headResponse) {
            contentType = headResponse.ContentType || contentType;
          }
        } catch (error) {
          console.warn(`获取文件元数据失败，使用默认content-type: ${error.message}`);
        }

        // 计算相对路径信息（用于前端构建目录结构）
        const pathParts = relativePath.split("/");
        const fileName = pathParts.pop();

        // 统一从文件名推断MIME类型，不依赖源文件的MIME类型
        const { getMimeTypeFromFilename } = await import("../utils/fileUtils.js");
        contentType = getMimeTypeFromFilename(fileName);
        console.log(`目录复制：从文件名[${fileName}]推断MIME类型: ${contentType}`);

        // 生成上传预签名URL
        const uploadUrl = await generatePresignedPutUrl(targetS3Config, targetKey, contentType, encryptionSecret, expiresIn);

        // 计算相对目录路径
        const relativeDir = pathParts.join("/");

        // 添加到结果集
        items.push({
          sourceKey,
          targetKey,
          fileName,
          relativeDir,
          contentType,
          size: item.Size,
          downloadUrl,
          uploadUrl,
        });
      }
    }

    // 更新令牌用于下一次循环
    continuationToken = listResponse.IsTruncated ? listResponse.NextContinuationToken : undefined;
  } while (continuationToken);

  return items;
}
