/**
 * 分片上传服务
 * 提供S3/R2兼容的分片上传功能，用于处理大文件上传，绕过Worker的请求大小限制
 */
import { HTTPException } from "hono/http-exception";
import { ApiStatus } from "../constants/index.js";
import { findMountPointByPath, normalizeS3SubPath, updateMountLastUsed, checkDirectoryExists } from "../webdav/utils/webdavUtils.js";
import { createS3Client, buildS3Url } from "../utils/s3Utils.js";
import { CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, ListPartsCommand } from "@aws-sdk/client-s3";
import { generateFileId } from "../utils/common.js";
import { directoryCacheManager, clearCache } from "../utils/DirectoryCache.js";
// 移除了 getLocalTimeString 导入，现在使用 CURRENT_TIMESTAMP

/**
 * 获取S3资源（挂载点、配置、客户端）
 * @param {D1Database} db - D1数据库实例
 * @param {string} path - 文件路径
 * @param {string|Object} userIdOrInfo - 用户ID（管理员）或API密钥信息对象（API密钥用户）
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {string} encryptionSecret - 加密密钥
 * @returns {Promise<Object>} 包含mount、s3Config和s3Client的对象
 * @throws {HTTPException} 如果获取资源过程中出错
 */
async function getS3Resources(db, path, userIdOrInfo, userType, encryptionSecret) {
  // 查找挂载点
  const mountResult = await findMountPointByPath(db, path, userIdOrInfo, userType);

  // 处理错误情况
  if (mountResult.error) {
    throw new HTTPException(mountResult.error.status, { message: mountResult.error.message });
  }

  const { mount, subPath } = mountResult;

  // 获取S3配置
  const s3Config = await db.prepare("SELECT * FROM s3_configs WHERE id = ?").bind(mount.storage_config_id).first();
  if (!s3Config) {
    throw new HTTPException(ApiStatus.NOT_FOUND, { message: "存储配置不存在" });
  }

  // 创建S3客户端
  const s3Client = await createS3Client(s3Config, encryptionSecret);

  return {
    mount,
    subPath,
    s3Config,
    s3Client,
  };
}

/**
 * 规范化文件路径
 * @param {string} subPath - 子路径
 * @param {Object} s3Config - S3配置
 * @param {string} path - 完整路径，用于提取文件名
 * @param {string} customFilename - 自定义文件名（可选），优先级高于从path中提取的文件名
 * @returns {string} 规范化后的S3路径
 */
function normalizeFilePath(subPath, s3Config, path, customFilename) {
  // 规范化S3子路径 (不添加斜杠，因为是文件)
  let s3SubPath = normalizeS3SubPath(subPath, s3Config, false);

  // 获取文件名，优先使用自定义文件名，其次从路径中提取
  const fileName = customFilename || path.split("/").filter(Boolean).pop() || "unnamed_file";

  // 与目录列表逻辑保持一致，只使用root_prefix
  const rootPrefix = s3Config.root_prefix ? (s3Config.root_prefix.endsWith("/") ? s3Config.root_prefix : s3Config.root_prefix + "/") : "";

  let fullPrefix = rootPrefix;

  // 添加s3SubPath (如果不是空)
  if (s3SubPath && s3SubPath !== "/") {
    fullPrefix += s3SubPath;
  }

  // 确保前缀总是以斜杠结尾 (如果不为空)
  if (fullPrefix && !fullPrefix.endsWith("/")) {
    fullPrefix += "/";
  }

  // 构建最终路径
  return fullPrefix + fileName;
}

/**
 * 通用错误处理包装函数
 * @param {Function} fn - 要执行的异步函数
 * @param {string} operationName - 操作名称，用于错误日志
 * @param {string} defaultErrorMessage - 默认错误消息
 * @returns {Promise<any>} 函数执行结果
 * @throws {HTTPException} 统一处理后的HTTP异常
 */
async function handleMultipartError(fn, operationName, defaultErrorMessage) {
  try {
    return await fn();
  } catch (error) {
    console.error(`${operationName}错误:`, error);
    // 如果已经是HTTPException，直接抛出
    if (error instanceof HTTPException) {
      throw error;
    }
    // 其他错误转换为内部服务器错误
    throw new HTTPException(ApiStatus.INTERNAL_ERROR, { message: error.message || defaultErrorMessage });
  }
}

/**
 * 初始化分片上传
 * @param {D1Database} db - D1数据库实例
 * @param {string} path - 文件路径
 * @param {string} contentType - 文件MIME类型
 * @param {number} fileSize - 文件大小（可选）
 * @param {string|Object} userIdOrInfo - 用户ID（管理员）或API密钥信息对象（API密钥用户）
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {string} encryptionSecret - 加密密钥
 * @param {string} filename - 文件名（可选）
 * @returns {Promise<Object>} 包含uploadId和其他必要信息的上传会话
 */
export async function initializeMultipartUpload(db, path, contentType, fileSize, userIdOrInfo, userType, encryptionSecret, filename) {
  return handleMultipartError(
      async () => {
        // 获取S3资源
        const { mount, subPath, s3Config, s3Client } = await getS3Resources(db, path, userIdOrInfo, userType, encryptionSecret);

        // 规范化文件路径
        const s3SubPath = normalizeFilePath(subPath, s3Config, path, filename);

        // 检查父目录是否存在
        if (s3SubPath.includes("/")) {
          const parentPath = s3SubPath.substring(0, s3SubPath.lastIndexOf("/") + 1);
          const parentExists = await checkDirectoryExists(s3Client, s3Config.bucket_name, parentPath);

          if (!parentExists) {
            throw new HTTPException(ApiStatus.CONFLICT, { message: "父目录不存在" });
          }
        }

        // 统一从文件名推断MIME类型，不依赖前端传来的contentType
        const { getMimeTypeFromFilename } = await import("../utils/fileUtils.js");
        const finalContentType = getMimeTypeFromFilename(filename || path.split("/").pop());
        console.log(`分片上传初始化：从文件名[${filename || path.split("/").pop()}]推断MIME类型: ${finalContentType}`);

        // 创建分片上传
        const createCommand = new CreateMultipartUploadCommand({
          Bucket: s3Config.bucket_name,
          Key: s3SubPath,
          ContentType: finalContentType,
        });

        const createResponse = await s3Client.send(createCommand);

        // 更新最后使用时间
        await updateMountLastUsed(db, mount.id);

        // 返回必要的信息用于后续上传
        return {
          uploadId: createResponse.UploadId,
          bucket: s3Config.bucket_name,
          key: s3SubPath,
          mount_id: mount.id,
          path: path,
          storage_type: mount.storage_type,
          // 建议的分片大小 (从5MB减小到3MB，以减少Worker CPU使用量)
          recommendedPartSize: 5 * 1024 * 1024,
        };
      },
      "初始化分片上传",
      "初始化分片上传失败"
  );
}

/**
 * 上传单个分片
 * @param {D1Database} db - D1数据库实例
 * @param {string} path - 文件路径
 * @param {string} uploadId - 上传ID
 * @param {number} partNumber - 分片编号（从1开始）
 * @param {ArrayBuffer} partData - 分片数据
 * @param {string|Object} userIdOrInfo - 用户ID（管理员）或API密钥信息对象（API密钥用户）
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {string} encryptionSecret - 加密密钥
 * @param {string} s3Key - S3对象键值，用于确保与初始化阶段一致（可选）
 * @returns {Promise<Object>} 包含ETag的响应对象
 */
export async function uploadPart(db, path, uploadId, partNumber, partData, userIdOrInfo, userType, encryptionSecret, s3Key) {
  return handleMultipartError(
      async () => {
        // 获取S3资源
        const { mount, subPath, s3Config, s3Client } = await getS3Resources(db, path, userIdOrInfo, userType, encryptionSecret);

        // 规范化文件路径 - 如果提供了s3Key，直接使用，否则重新计算
        const s3SubPath = s3Key || normalizeFilePath(subPath, s3Config, path);

        // 上传分片
        const uploadCommand = new UploadPartCommand({
          Bucket: s3Config.bucket_name,
          Key: s3SubPath,
          UploadId: uploadId,
          PartNumber: partNumber,
          Body: partData,
        });

        const uploadResponse = await s3Client.send(uploadCommand);

        // 更新最后使用时间
        await updateMountLastUsed(db, mount.id);

        // 返回必要的信息用于后续完成上传
        return {
          partNumber: partNumber,
          etag: uploadResponse.ETag,
        };
      },
      "上传分片",
      "上传分片失败"
  );
}

/**
 * 完成分片上传
 * @param {D1Database} db - D1数据库实例
 * @param {string} path - 文件路径
 * @param {string} uploadId - 上传ID
 * @param {Array<{partNumber: number, etag: string}>} parts - 已上传分片的信息
 * @param {string|Object} userIdOrInfo - 用户ID（管理员）或API密钥信息对象（API密钥用户）
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {string} encryptionSecret - 加密密钥
 * @param {string} s3Key - S3对象键值，用于确保与初始化阶段一致（可选）
 * @param {string} contentType - 文件MIME类型（可选）
 * @param {number} fileSize - 文件大小（可选）
 * @param {boolean} saveToDatabase - 是否将文件信息保存到数据库（默认为true）
 * @returns {Promise<Object>} 完成上传的响应
 */
export async function completeMultipartUpload(
    db,
    path,
    uploadId,
    parts,
    userIdOrInfo,
    userType,
    encryptionSecret,
    s3Key,
    contentType = "application/octet-stream",
    fileSize = 0,
    saveToDatabase = true
) {
  return handleMultipartError(
      async () => {
        // 获取S3资源
        const { mount, subPath, s3Config, s3Client } = await getS3Resources(db, path, userIdOrInfo, userType, encryptionSecret);

        // 规范化文件路径 - 如果提供了s3Key，直接使用，否则重新计算
        const s3SubPath = s3Key || normalizeFilePath(subPath, s3Config, path);

        // 确保parts按照partNumber排序
        const sortedParts = [...parts].sort((a, b) => a.partNumber - b.partNumber);

        let completeResponse;
        try {
          // 完成分片上传
          const completeCommand = new CompleteMultipartUploadCommand({
            Bucket: s3Config.bucket_name,
            Key: s3SubPath,
            UploadId: uploadId,
            MultipartUpload: {
              Parts: sortedParts.map((part) => ({
                PartNumber: part.partNumber,
                ETag: part.etag,
              })),
            },
          });

          completeResponse = await s3Client.send(completeCommand);
        } catch (error) {
          // 特殊处理"NoSuchUpload"错误 - 可能上传已经完成
          if (error.name === "NoSuchUpload" || (error.message && error.message.includes("The specified multipart upload does not exist"))) {
            console.log(`检测到NoSuchUpload错误，检查文件是否已存在: ${s3SubPath}`);
            try {
              // 尝试检查对象是否已存在（上传可能已成功）
              const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
              const headCommand = new HeadObjectCommand({
                Bucket: s3Config.bucket_name,
                Key: s3SubPath,
              });

              const headResponse = await s3Client.send(headCommand);
              if (headResponse) {
                console.log(`文件已存在，视为上传成功: ${s3SubPath}`);
                // 创建一个类似于成功完成的响应
                completeResponse = {
                  ETag: headResponse.ETag,
                  Location: buildS3Url(s3Config, s3SubPath),
                };
              } else {
                // 如果检查对象也失败，重新抛出原始错误
                throw error;
              }
            } catch (headError) {
              console.error(`检查对象是否存在失败: ${headError.message}`);
              // 重新抛出原始错误
              throw error;
            }
          } else {
            // 其他类型错误，继续抛出
            throw error;
          }
        }

        // 更新父目录的修改时间
        const rootPrefix = s3Config.root_prefix ? (s3Config.root_prefix.endsWith("/") ? s3Config.root_prefix : s3Config.root_prefix + "/") : "";
        const { updateParentDirectoriesModifiedTime } = await import("./fsService.js");
        await updateParentDirectoriesModifiedTime(s3Client, s3Config.bucket_name, s3SubPath, rootPrefix);

        // 更新最后使用时间
        await updateMountLastUsed(db, mount.id);

        // 构建S3直接访问URL
        const s3Url = buildS3Url(s3Config, s3SubPath);

        // 如果需要保存到数据库
        let fileId;
        if (saveToDatabase) {
          // 提取文件名
          let fileName = s3SubPath.split("/").filter(Boolean).pop();
          // 如果s3Key中没有提取到有效文件名，则尝试从路径中提取
          if (!fileName) {
            fileName = path.split("/").filter(Boolean).pop();
          }
          // 如果两者都未提取到有效文件名，使用默认名称
          if (!fileName) {
            fileName = "unnamed_file";
          }

          // 生成文件ID
          fileId = generateFileId();

          // 生成slug（使用文件ID的前5位作为slug）
          const fileSlug = "M-" + fileId.substring(0, 5);

          // 统一从文件名推断MIME类型，不依赖前端传来的contentType
          const { getMimeTypeFromFilename } = await import("../utils/fileUtils.js");
          const finalContentType = getMimeTypeFromFilename(fileName);
          console.log(`分片上传完成：从文件名[${fileName}]推断MIME类型: ${finalContentType}`);

          // 记录文件信息到数据库
          await db
              .prepare(
                  `
          INSERT INTO files (
            id, filename, storage_path, s3_url, mimetype, size, s3_config_id, slug, etag, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `
              )
              .bind(
                  fileId,
                  fileName,
                  s3SubPath,
                  s3Url,
                  finalContentType, // 使用推断后的正确MIME类型
                  fileSize,
                  s3Config.id,
                  fileSlug,
                  completeResponse.ETag,
                  `${userType}:${userType === "apiKey" ? userIdOrInfo.id : userIdOrInfo}`
              )
              .run();
        } else {
          console.log(`分片上传完成但跳过数据库记录 (路径: ${path})`);
        }

        // 提取父目录路径，用于刷新目录缓存
        let parentPath;
        if (path.endsWith("/")) {
          // 如果路径已经是目录路径（以斜杠结尾），直接使用
          parentPath = path;
        } else {
          // 尝试从路径中提取父目录
          const lastSlashIndex = path.lastIndexOf("/");
          if (lastSlashIndex >= 0) {
            parentPath = path.substring(0, lastSlashIndex + 1);
          } else {
            // 如果没有斜杠，设置为根路径
            parentPath = "/";
          }
        }

        // 再次确保parentPath以斜杠结尾
        if (!parentPath.endsWith("/")) {
          parentPath += "/";
        }

        // 处理根路径的特殊情况
        if (parentPath === "//") {
          parentPath = "/";
        }

        // 清除缓存 - 使用统一的clearCache函数
        try {
          await clearCache({ mountId: mount.id });
          console.log(`分片上传完成后缓存已清除 - 挂载点=${mount.id}`);
        } catch (cacheError) {
          // 不让缓存清除错误影响上传流程
          console.warn(`清除缓存时出错: ${cacheError.message}`);
        }

        return {
          success: true,
          path: path,
          etag: completeResponse.ETag,
          location: completeResponse.Location,
          fileId: saveToDatabase ? fileId : undefined, // 只有保存到数据库时才返回fileId
          s3Url: s3Url,
        };
      },
      "完成分片上传",
      "完成分片上传失败"
  );
}

/**
 * 中止分片上传并彻底清理所有已上传分片
 *
 * 该函数会确保所有已上传的分片资源被完全清理，不会在存储桶中留下任何"正在进行的多部分上传"状态的文件
 *
 * @param {D1Database} db - D1数据库实例
 * @param {string} path - 文件路径
 * @param {string} uploadId - 上传ID
 * @param {string|Object} userIdOrInfo - 用户ID（管理员）或API密钥信息对象（API密钥用户）
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {string} encryptionSecret - 加密密钥
 * @param {string} s3Key - S3对象键值，用于确保与初始化阶段一致（可选）
 * @returns {Promise<Object>} 中止上传的响应
 */
export async function abortMultipartUpload(db, path, uploadId, userIdOrInfo, userType, encryptionSecret, s3Key) {
  let s3Client = null;
  let s3Config = null;
  let s3SubPath = null;
  let bucketName = null;
  const MAX_RETRY = 3; // 最大重试次数

  try {
    // 获取S3资源
    const resources = await getS3Resources(db, path, userIdOrInfo, userType, encryptionSecret);
    s3Client = resources.s3Client;
    s3Config = resources.s3Config;
    bucketName = s3Config.bucket_name;

    // 规范化文件路径 - 如果提供了s3Key，直接使用，否则重新计算
    s3SubPath = s3Key || normalizeFilePath(resources.subPath, s3Config, path);

    console.log(`中止分片上传: Bucket=${bucketName}, Key=${s3SubPath}`);

    // 记录当前分片状态，用于验证是否成功清理
    let currentParts = [];
    try {
      const listPartsCommand = new ListPartsCommand({
        Bucket: bucketName,
        Key: s3SubPath,
        UploadId: uploadId,
      });
      const listPartsResponse = await s3Client.send(listPartsCommand);
      currentParts = listPartsResponse.Parts || [];
    } catch (listError) {
      console.warn(`无法获取已上传分片列表: ${listError.message}`);
    }

    // 执行中止操作并重试
    let success = false;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
      try {
        const abortCommand = new AbortMultipartUploadCommand({
          Bucket: bucketName,
          Key: s3SubPath,
          UploadId: uploadId,
        });

        await s3Client.send(abortCommand);
        success = true;
        break;
      } catch (retryError) {
        lastError = retryError;
        console.error(`中止分片上传失败 (尝试 ${attempt}/${MAX_RETRY}): ${retryError.message}`);

        // 如果不是最后一次尝试，等待一段时间再重试
        if (attempt < MAX_RETRY) {
          const delayMs = 500 * Math.pow(2, attempt - 1); // 指数退避策略
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    // 验证是否成功清理
    if (success && currentParts.length > 0) {
      try {
        const verifyCommand = new ListPartsCommand({
          Bucket: bucketName,
          Key: s3SubPath,
          UploadId: uploadId,
        });
        await s3Client.send(verifyCommand);
        // 如果没有抛出错误，说明分片上传仍然存在
        console.warn(`警告: 中止分片上传后资源未完全清理`);
        success = false;
      } catch (verifyError) {
        // 如果抛出 NoSuchUpload 错误，说明已成功清理
        if (verifyError.name === "NoSuchUpload") {
          console.log(`分片上传资源已完全清理`);
          success = true;
        } else {
          console.warn(`验证清理结果时出错: ${verifyError.message}`);
        }
      }
    }

    // 更新最后使用时间
    try {
      await updateMountLastUsed(db, resources.mount.id);
    } catch (updateError) {
      // 即使更新最后使用时间失败，也不影响中止上传的结果
      console.warn(`更新挂载点最后使用时间失败: ${updateError.message}`);
    }

    if (!success && lastError) {
      throw lastError;
    }

    return {
      success: true,
      message: "已彻底清理分片上传资源",
    };
  } catch (error) {
    console.error(`中止分片上传失败: ${error.message}`);

    // 如果我们已经有了S3客户端和必要信息，但前面的尝试都失败，进行最后一次尝试
    if (s3Client && bucketName && s3SubPath && uploadId) {
      try {
        console.log(`进行紧急清理尝试`);
        const finalAbortCommand = new AbortMultipartUploadCommand({
          Bucket: bucketName,
          Key: s3SubPath,
          UploadId: uploadId,
        });

        await s3Client.send(finalAbortCommand);
        return {
          success: true,
          message: "已中止分片上传 (紧急恢复执行成功)",
        };
      } catch (finalError) {
        console.error(`紧急清理尝试失败: ${finalError.message}`);
      }
    }

    // 如果已经是HTTPException，直接抛出
    if (error instanceof HTTPException) {
      throw error;
    }
    // 其他错误转换为内部服务器错误
    throw new HTTPException(ApiStatus.INTERNAL_ERROR, { message: error.message || "中止分片上传失败，无法清理资源" });
  }
}
