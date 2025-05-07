/**
 * S3存储操作相关工具函数
 */

import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ConfiguredRetryStrategy } from "@smithy/util-retry";
import { decryptValue } from "./crypto.js";
import { S3ProviderTypes } from "../constants/index.js";
import { getMimeTypeGroup, MIME_GROUPS, getMimeTypeFromFilename, getFileExtension, shouldUseTextPlainForPreview } from "./fileUtils.js";

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
 * @param {number} expiresIn - URL过期时间（秒），默认为1小时
 * @returns {Promise<string>} 预签名URL
 */
export async function generatePresignedPutUrl(s3Config, storagePath, mimetype, encryptionSecret, expiresIn = 3600) {
  try {
    // 创建S3客户端
    const s3Client = await createS3Client(s3Config, encryptionSecret);

    // 确保storagePath不以斜杠开始
    const normalizedPath = storagePath.startsWith("/") ? storagePath.slice(1) : storagePath;

    // 创建PutObjectCommand
    const command = new PutObjectCommand({
      Bucket: s3Config.bucket_name,
      Key: normalizedPath,
      ContentType: mimetype,
    });

    // 针对不同服务商添加特定头部或参数
    const commandOptions = { expiresIn };

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

    return url;
  } catch (error) {
    console.error("生成上传预签名URL出错:", error);
    throw new Error("无法生成文件上传链接: " + (error.message || "未知错误"));
  }
}

/**
 * 生成S3文件的下载预签名URL
 * @param {Object} s3Config - S3配置
 * @param {string} storagePath - S3存储路径
 * @param {string} encryptionSecret - 用于解密凭证的密钥
 * @param {number} expiresIn - URL过期时间（秒），默认为1小时
 * @param {boolean} forceDownload - 是否强制下载（而非预览）
 * @param {string} mimetype - 文件的MIME类型（可选）
 * @returns {Promise<string>} 预签名URL
 */
export async function generatePresignedUrl(s3Config, storagePath, encryptionSecret, expiresIn = 3600, forceDownload = false, mimetype = null) {
  try {
    // 创建S3客户端
    const s3Client = await createS3Client(s3Config, encryptionSecret);

    // 确保storagePath不以斜杠开始
    const normalizedPath = storagePath.startsWith("/") ? storagePath.slice(1) : storagePath;

    // 提取文件名，用于Content-Disposition头
    const fileName = normalizedPath.split("/").pop();

    // 检查文件是否应该使用text/plain预览
    const shouldUseTextPlain = shouldUseTextPlainForPreview(mimetype, fileName);

    // 如果未提供MIME类型，从文件名推断
    let effectiveMimetype = mimetype;
    if (!effectiveMimetype || effectiveMimetype === "application/octet-stream") {
      effectiveMimetype = getMimeTypeFromFilename(fileName);
      console.log(`未提供MIME类型或为通用类型，从文件名[${fileName}]推断MIME类型: ${effectiveMimetype}`);
    }

    // 创建GetObjectCommand
    const commandParams = {
      Bucket: s3Config.bucket_name,
      Key: normalizedPath,
    };

    // 处理Content-Disposition头
    if (forceDownload) {
      // 强制下载模式设置为attachment
      commandParams.ResponseContentDisposition = `attachment; filename="${encodeURIComponent(fileName)}"`;
    } else {
      // 预览模式设置为inline
      commandParams.ResponseContentDisposition = `inline; filename="${encodeURIComponent(fileName)}"`;
    }

    // 判断MIME类型分组
    const mimeGroup = getMimeTypeGroup(effectiveMimetype);

    // 对于应该使用text/plain预览的文件进行特殊处理
    if (shouldUseTextPlain && !forceDownload) {
      commandParams.ResponseContentType = `text/plain; charset=UTF-8`;
    } else {
      // 其他文件类型正常处理
      // 设置Content-Type，对所有文本类内容都添加charset=UTF-8
      const needsCharset =
        mimeGroup === MIME_GROUPS.TEXT ||
        mimeGroup === MIME_GROUPS.CODE ||
        mimeGroup === MIME_GROUPS.CONFIG ||
        mimeGroup === MIME_GROUPS.MARKDOWN ||
        effectiveMimetype === "application/json" ||
        effectiveMimetype === "application/xml" ||
        effectiveMimetype === "application/javascript" ||
        effectiveMimetype === "application/typescript";

      if (needsCharset) {
        commandParams.ResponseContentType = `${effectiveMimetype}; charset=UTF-8`;
        console.log(`为文件[${fileName}]设置内容类型: ${effectiveMimetype}; charset=UTF-8 (分组: ${mimeGroup})`);
      } else {
        commandParams.ResponseContentType = effectiveMimetype;
        console.log(`为文件[${fileName}]设置内容类型: ${effectiveMimetype} (分组: ${mimeGroup})`);
      }
    }

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
