/**
 * S3目录操作模块
 * 负责目录相关操作：列出内容、创建目录、删除目录等
 */

import { HTTPException } from "hono/http-exception";
import { ApiStatus } from "../../../../constants/index.js";
import { S3Client, ListObjectsV2Command, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { checkDirectoryExists, updateParentDirectoriesModifiedTime } from "../utils/S3DirectoryUtils.js";
import { directoryCacheManager, clearCache } from "../../../../utils/DirectoryCache.js";
import { deleteFileRecordByStoragePath } from "../../../../services/fileService.js";
import { handleFsError } from "../../../fs/utils/ErrorHandler.js";

export class S3DirectoryOperations {
  /**
   * 构造函数
   * @param {S3Client} s3Client - S3客户端
   * @param {Object} config - S3配置
   * @param {string} encryptionSecret - 加密密钥
   */
  constructor(s3Client, config, encryptionSecret) {
    this.s3Client = s3Client;
    this.config = config;
    this.encryptionSecret = encryptionSecret;
  }

  /**
   * 获取S3目录的修改时间（仅从目录标记对象获取）
   * @param {S3Client} s3Client - S3客户端实例
   * @param {string} bucketName - 存储桶名称
   * @param {string} prefix - 目录前缀
   * @returns {Promise<string>} 目录修改时间的ISO字符串
   */
  async getS3DirectoryModifiedTime(s3Client, bucketName, prefix) {
    try {
      // 检查是否存在目录标记对象
      const headParams = {
        Bucket: bucketName,
        Key: prefix, // prefix 应该已经以 '/' 结尾
      };

      const headCommand = new HeadObjectCommand(headParams);
      const headResponse = await s3Client.send(headCommand);

      // 如果目录标记对象存在，使用其修改时间
      if (headResponse.LastModified) {
        return headResponse.LastModified.toISOString();
      }
    } catch (error) {
      // 如果目录标记对象不存在，返回当前时间
      if (error.$metadata?.httpStatusCode === 404) {
        return new Date().toISOString();
      }
      throw error;
    }

    return new Date().toISOString();
  }

  /**
   * 计算S3目录的总大小
   * @param {S3Client} s3Client - S3客户端实例
   * @param {string} bucketName - 存储桶名称
   * @param {string} prefix - 目录前缀
   * @returns {Promise<number>} 目录总大小（字节）
   */
  async getS3DirectorySize(s3Client, bucketName, prefix) {
    let totalSize = 0;
    let continuationToken = undefined;

    try {
      do {
        const listParams = {
          Bucket: bucketName,
          Prefix: prefix,
          MaxKeys: 1000,
          ContinuationToken: continuationToken,
        };

        const listCommand = new ListObjectsV2Command(listParams);
        const response = await s3Client.send(listCommand);

        if (response.Contents) {
          for (const item of response.Contents) {
            totalSize += item.Size || 0;
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      return totalSize;
    } catch (error) {
      console.warn(`计算目录大小失败: ${error.message}`);
      return 0;
    }
  }

  /**
   * 列出目录内容
   * @param {string} s3SubPath - S3子路径
   * @param {Object} options - 选项参数
   * @returns {Promise<Object>} 目录内容
   */
  async listDirectory(s3SubPath, options = {}) {
    const { mount, subPath } = options;

    return handleFsError(
      async () => {
        // 检查缓存
        if (mount.cache_ttl > 0) {
          const cachedResult = directoryCacheManager.get(mount.id, subPath);
          if (cachedResult && cachedResult.items) {
            // 检查缓存是否包含文件夹大小信息（新版本缓存）
            const hasDirectorySizes = cachedResult.items.some((item) => item.isDirectory && !item.isVirtual && typeof item.size === "number");
            const hasOnlyFiles = cachedResult.items.every((item) => !item.isDirectory);

            if (hasDirectorySizes || hasOnlyFiles) {
              console.log(`目录缓存命中: ${mount.id}/${subPath}`);
              return cachedResult;
            } else {
              console.log(`跳过旧版本缓存（缺少文件夹大小信息）: ${mount.id}/${subPath}`);
            }
          }
        }

        // 构造返回结果结构
        const result = {
          path: mount.mount_path + subPath,
          type: "directory",
          isRoot: false,
          isVirtual: false,
          mount_id: mount.id,
          storage_type: mount.storage_type,
          items: [],
        };

        // 处理root_prefix
        const rootPrefix = this.config.root_prefix ? (this.config.root_prefix.endsWith("/") ? this.config.root_prefix : this.config.root_prefix + "/") : "";

        let fullPrefix = rootPrefix;

        // 添加s3SubPath (如果不是'/')
        if (s3SubPath && s3SubPath !== "/") {
          fullPrefix += s3SubPath;
        }

        // 确保前缀总是以斜杠结尾 (如果不为空)
        if (fullPrefix && !fullPrefix.endsWith("/")) {
          fullPrefix += "/";
        }

        // 列出S3对象
        const listParams = {
          Bucket: this.config.bucket_name,
          Prefix: fullPrefix,
          Delimiter: "/",
          MaxKeys: 1000,
        };

        const listCommand = new ListObjectsV2Command(listParams);
        const response = await this.s3Client.send(listCommand);

        // 处理公共前缀（目录）
        if (response.CommonPrefixes) {
          const prefixLength = fullPrefix.length;

          for (const prefix of response.CommonPrefixes) {
            const prefixKey = prefix.Prefix;
            const relativePath = prefixKey.substring(prefixLength);
            const dirName = relativePath.replace(/\/$/, "");

            if (dirName) {
              // 获取目录的真实修改时间和大小
              let directoryModified = new Date().toISOString();
              let directorySize = 0;

              try {
                directoryModified = await this.getS3DirectoryModifiedTime(this.s3Client, this.config.bucket_name, prefixKey);
                directorySize = await this.getS3DirectorySize(this.s3Client, this.config.bucket_name, prefixKey);
              } catch (error) {
                console.warn(`获取目录信息失败:`, error);
              }

              // 构建目录路径 - 确保路径正确拼接，避免双斜杠
              const separator = subPath.endsWith("/") ? "" : "/";
              const dirPath = mount.mount_path + subPath + separator + dirName + "/";

              result.items.push({
                name: dirName,
                path: dirPath,
                isDirectory: true,
                isVirtual: false,
                size: directorySize,
                modified: directoryModified,
              });
            }
          }
        }

        // 处理内容（文件）
        if (response.Contents) {
          const prefixLength = fullPrefix.length;

          for (const content of response.Contents) {
            const key = content.Key;

            // 跳过作为目录标记的对象
            if (key === fullPrefix || key === fullPrefix + "/") {
              continue;
            }

            // 从S3 key中提取相对路径和名称
            const relativePath = key.substring(prefixLength);

            // 跳过嵌套在子目录中的文件
            if (relativePath.includes("/")) {
              continue;
            }

            // 跳过空文件名
            if (!relativePath) {
              continue;
            }

            // 构建子项路径 - 确保路径正确拼接，避免双斜杠
            const separator = subPath.endsWith("/") ? "" : "/";
            const itemPath = mount.mount_path + subPath + separator + relativePath;

            result.items.push({
              name: relativePath,
              path: itemPath,
              isDirectory: false,
              size: content.Size,
              modified: content.LastModified ? content.LastModified.toISOString() : new Date().toISOString(),
              etag: content.ETag ? content.ETag.replace(/"/g, "") : undefined,
            });
          }
        }

        // 按名称排序
        result.items.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });

        // 缓存结果
        if (mount.cache_ttl > 0) {
          directoryCacheManager.set(mount.id, subPath, result, mount.cache_ttl);
          console.log(`目录内容已缓存: ${mount.id}/${subPath}, TTL: ${mount.cache_ttl}秒`);
        }

        return result;
      },
      "列出目录",
      "列出目录失败"
    );
  }

  /**
   * 创建目录
   * @param {string} s3SubPath - S3子路径
   * @param {Object} options - 选项参数
   * @returns {Promise<Object>} 创建结果
   */
  async createDirectory(s3SubPath, options = {}) {
    const { mount, subPath, path } = options;

    return handleFsError(
      async () => {
        // 检查父目录是否存在
        if (s3SubPath.split("/").filter(Boolean).length > 1) {
          const parentPath = s3SubPath.substring(0, s3SubPath.lastIndexOf("/", s3SubPath.length - 2) + 1);
          const parentExists = await checkDirectoryExists(this.s3Client, this.config.bucket_name, parentPath);

          if (!parentExists) {
            throw new HTTPException(ApiStatus.CONFLICT, { message: "父目录不存在" });
          }
        }

        // 检查目录是否已存在
        try {
          const headParams = {
            Bucket: this.config.bucket_name,
            Key: s3SubPath,
          };

          const headCommand = new HeadObjectCommand(headParams);
          await this.s3Client.send(headCommand);

          // 如果没有抛出异常，说明目录已存在
          throw new HTTPException(ApiStatus.CONFLICT, { message: "目录已存在" });
        } catch (error) {
          if (error.$metadata && error.$metadata.httpStatusCode === 404) {
            // 目录不存在，可以创建
            const putParams = {
              Bucket: this.config.bucket_name,
              Key: s3SubPath,
              Body: "",
              ContentType: "application/x-directory",
            };

            const putCommand = new PutObjectCommand(putParams);
            await this.s3Client.send(putCommand);

            // 更新父目录的修改时间
            const rootPrefix = this.config.root_prefix ? (this.config.root_prefix.endsWith("/") ? this.config.root_prefix : this.config.root_prefix + "/") : "";
            await updateParentDirectoriesModifiedTime(this.s3Client, this.config.bucket_name, s3SubPath, rootPrefix);

            // 清除父目录的缓存，因为目录内容已变更
            if (subPath !== "/") {
              await clearCache({ mountId: mount.id });
            }

            return {
              success: true,
              path: path,
              message: "目录创建成功",
            };
          }

          // 其他错误则抛出
          throw error;
        }
      },
      "创建目录",
      "创建目录失败"
    );
  }

  /**
   * 递归删除S3目录
   * @param {S3Client} s3Client - S3客户端实例
   * @param {string} bucketName - 存储桶名称
   * @param {string} prefix - 目录前缀
   * @param {D1Database} db - 数据库实例
   * @param {string} storageConfigId - 存储配置ID
   * @returns {Promise<void>}
   */
  async deleteDirectoryRecursive(s3Client, bucketName, prefix, db, storageConfigId) {
    let continuationToken = undefined;

    try {
      do {
        const listParams = {
          Bucket: bucketName,
          Prefix: prefix,
          MaxKeys: 1000,
          ContinuationToken: continuationToken,
        };

        const listCommand = new ListObjectsV2Command(listParams);
        const response = await s3Client.send(listCommand);

        if (response.Contents && response.Contents.length > 0) {
          // 批量删除对象
          const deletePromises = response.Contents.map(async (item) => {
            const deleteParams = {
              Bucket: bucketName,
              Key: item.Key,
            };

            const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
            const deleteCommand = new DeleteObjectCommand(deleteParams);
            await s3Client.send(deleteCommand);

            // 删除文件记录
            if (db && storageConfigId) {
              try {
                await deleteFileRecordByStoragePath(db, storageConfigId, item.Key);
              } catch (error) {
                console.warn(`删除文件记录失败: ${error.message}`);
              }
            }
          });

          await Promise.all(deletePromises);
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      console.log(`成功删除目录: ${prefix}`);
    } catch (error) {
      console.error(`删除目录失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 检查目录是否存在
   * @param {string} s3SubPath - S3子路径
   * @returns {Promise<boolean>} 是否存在
   */
  async directoryExists(s3SubPath) {
    return await checkDirectoryExists(this.s3Client, this.config.bucket_name, s3SubPath);
  }

  /**
   * 获取目录信息（作为目录处理）
   * @param {string} s3SubPath - S3子路径
   * @param {Object} options - 选项参数
   * @returns {Promise<Object>} 目录信息
   */
  async getDirectoryInfo(s3SubPath, options = {}) {
    const { mount, path } = options;

    // 尝试作为目录处理
    const dirPath = s3SubPath.endsWith("/") ? s3SubPath : s3SubPath + "/";

    const listParams = {
      Bucket: this.config.bucket_name,
      Prefix: dirPath,
      MaxKeys: 1,
    };

    const listCommand = new ListObjectsV2Command(listParams);
    const listResponse = await this.s3Client.send(listCommand);

    // 如果有内容，说明是目录
    if (listResponse.Contents && listResponse.Contents.length > 0) {
      // 获取目录的真实修改时间
      let directoryModified = new Date().toISOString();
      try {
        directoryModified = await this.getS3DirectoryModifiedTime(this.s3Client, this.config.bucket_name, dirPath);
      } catch (error) {
        console.warn(`获取目录修改时间失败:`, error);
      }

      return {
        path: path,
        name: path.split("/").filter(Boolean).pop() || "/",
        isDirectory: true,
        size: 0,
        modified: directoryModified,
        contentType: "application/x-directory",
        mount_id: mount.id,
        storage_type: mount.storage_type,
      };
    }

    throw new HTTPException(ApiStatus.NOT_FOUND, { message: "目录不存在" });
  }
}
