/**
 * 文件系统服务
 * 提供文件系统操作的核心服务逻辑，复用WebDAV已有实现
 */
import { HTTPException } from "hono/http-exception";
import { ApiStatus } from "../constants/index.js";
import { findMountPointByPath, findMountPointByPathWithApiKey, normalizeS3SubPath, updateMountLastUsed, checkDirectoryExists } from "../webdav/utils/webdavUtils.js";
import { getMountsByAdmin, getMountsByApiKey } from "./storageMountService.js";
import { getAccessibleMountsByBasicPath, checkPathPermissionForNavigation } from "./apiKeyService.js";
import {
  createS3Client,
  buildS3Url,
  generatePresignedUrl,
  generatePresignedPutUrl,
  getDirectoryPresignedUrls,
  checkS3ObjectExists,
  getS3ObjectMetadata,
  listS3Directory,
} from "../utils/s3Utils.js";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { initializeMultipartUpload } from "./multipartUploadService.js";
import { S3ProviderTypes } from "../constants/index.js";
import { directoryCacheManager, clearCache } from "../utils/DirectoryCache.js";
import { deleteFileRecordByStoragePath } from "./fileService.js";
import { generateFileId } from "../utils/common.js";
import { getMimeTypeFromFilename, getMimeTypeAndGroupFromFile, getContentTypeAndDisposition, MIME_GROUPS } from "../utils/fileUtils.js";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * 规范化路径格式
 * @param {string} path - 输入路径
 * @param {boolean} isDirectory - 是否为目录路径
 * @returns {string} 规范化的路径
 */
function normalizePath(path, isDirectory = false) {
  // 确保路径以斜杠开始
  path = path.startsWith("/") ? path : "/" + path;
  // 如果是目录，确保路径以斜杠结束
  if (isDirectory) {
    path = path.endsWith("/") ? path : path + "/";
  }
  return path;
}

/**
 * 通用错误处理包装函数
 * 用于统一处理文件系统操作中的错误，简化代码重复
 * @param {Function} fn - 要执行的异步函数
 * @param {string} operationName - 操作名称，用于错误日志
 * @param {string} defaultErrorMessage - 默认错误消息
 * @returns {Promise<any>} - 函数执行结果
 * @throws {HTTPException} - 统一处理后的HTTP异常
 */
async function handleFsError(fn, operationName, defaultErrorMessage) {
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
 * 列出目录内容
 * @param {D1Database} db - D1数据库实例
 * @param {string} path - 请求路径
 * @param {string|Object} userIdOrInfo - 用户ID（管理员）或API密钥信息对象（API密钥用户）
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {string} encryptionSecret - 加密密钥
 * @returns {Promise<Object>} 目录内容对象
 */
export async function listDirectory(db, path, userIdOrInfo, userType, encryptionSecret) {
  return handleFsError(
      async () => {
        // 规范化路径
        path = normalizePath(path, true); // 使用统一的路径规范化函数

        // 根据用户类型获取挂载点列表
        let mounts;
        if (userType === "admin") {
          mounts = await getMountsByAdmin(db, userIdOrInfo);
        } else if (userType === "apiKey") {
          // 对于API密钥用户，使用基于基本路径的权限检查
          const apiKeyInfo = userIdOrInfo;

          // 检查请求路径是否在API密钥的基本路径权限范围内
          // 特殊处理：允许访问从根路径到基本路径的所有父级路径，以便用户能够导航
          if (!checkPathPermissionForNavigation(apiKeyInfo.basicPath, path)) {
            throw new HTTPException(ApiStatus.FORBIDDEN, { message: "没有权限访问此路径" });
          }

          // 获取API密钥可访问的挂载点
          mounts = await getAccessibleMountsByBasicPath(db, apiKeyInfo.basicPath);
        } else {
          throw new HTTPException(ApiStatus.UNAUTHORIZED, { message: "未授权访问" });
        }

        // 按照路径长度降序排序，以便优先匹配最长的路径
        mounts.sort((a, b) => b.mount_path.length - a.mount_path.length);

        // 检查是否匹配到实际的挂载点
        let isVirtualPath = true;
        let matchingMount = null;
        let subPath = "";

        for (const mount of mounts) {
          const mountPath = mount.mount_path.startsWith("/") ? mount.mount_path : "/" + mount.mount_path;

          console.log("检查挂载点匹配:", {
            requestPath: path,
            mountPath: mountPath,
            mountName: mount.name,
          });

          // 如果请求路径完全匹配挂载点或者是挂载点的子路径
          if (path === mountPath || path === mountPath + "/" || path.startsWith(mountPath + "/")) {
            matchingMount = mount;
            subPath = path.substring(mountPath.length);
            if (!subPath.startsWith("/")) {
              subPath = "/" + subPath;
            }

            isVirtualPath = false;
            break;
          }
        }

        // 处理虚拟目录路径（根目录或中间目录）
        if (isVirtualPath) {
          // 对于API密钥用户，需要传递基本路径信息以过滤显示内容
          const basicPath = userType === "apiKey" ? userIdOrInfo.basicPath : null;

          return await getVirtualDirectoryListing(mounts, path, basicPath);
        }

        // 处理实际挂载点目录，查询S3
        return await getS3DirectoryListing(db, matchingMount, subPath, encryptionSecret);
      },
      "列出目录",
      "列出目录失败"
  );
}

/**
 * 获取虚拟目录列表
 * @param {Array} mounts - 挂载点列表
 * @param {string} path - 当前路径
 * @param {string|null} basicPath - API密钥的基本路径（用于过滤显示内容）
 * @returns {Promise<Object>} 虚拟目录内容
 */
async function getVirtualDirectoryListing(mounts, path, basicPath = null) {
  // 确保路径格式正确
  path = normalizePath(path, true); // 使用统一的路径规范化函数

  // 检查当前路径是否在基本路径权限范围内
  let hasPermissionForCurrentPath = true;
  if (basicPath && basicPath !== "/") {
    const normalizedBasicPath = basicPath.replace(/\/+$/, "");
    const normalizedCurrentPath = path.replace(/\/+$/, "") || "/";

    // 只有当前路径是基本路径或其子路径时才有权限
    hasPermissionForCurrentPath = normalizedCurrentPath === normalizedBasicPath || normalizedCurrentPath.startsWith(normalizedBasicPath + "/");
  }

  // 构造返回结果结构
  const result = {
    path: path,
    type: "directory",
    isRoot: path === "/",
    isVirtual: true,
    items: [],
    hasPermission: hasPermissionForCurrentPath, // 添加权限标识
  };

  // 如果没有权限访问当前路径，返回空列表但保留路径信息
  if (!hasPermissionForCurrentPath) {
    return result;
  }

  // 目录结构记录
  const directories = new Set();
  const mountEntries = [];

  // 遍历所有挂载点
  for (const mount of mounts) {
    let mountPath = mount.mount_path;
    mountPath = mountPath.startsWith("/") ? mountPath : "/" + mountPath;

    // 如果挂载路径正好等于当前路径
    if (mountPath + "/" === path || mountPath === path) {
      mountEntries.push({
        name: mount.name || mountPath.split("/").filter(Boolean).pop() || mount.id,
        path: mountPath,
        isDirectory: true,
        isMount: true,
        mount_id: mount.id,
        modified: mount.updated_at || mount.created_at || new Date().toISOString(),
        storage_type: mount.storage_type,
      });
      continue;
    }

    // 检查挂载路径是否在当前路径下
    if (mountPath.startsWith(path)) {
      // 提取相对路径
      const relativePath = mountPath.substring(path.length);
      // 获取第一级目录
      const firstDir = relativePath.split("/")[0];
      if (firstDir) {
        // 如果有基本路径限制，检查这个目录是否在权限范围内
        if (basicPath) {
          const dirPath = path + firstDir;
          const normalizedBasicPath = basicPath === "/" ? "/" : basicPath.replace(/\/+$/, "");
          const normalizedDirPath = dirPath.replace(/\/+$/, "") || "/";

          // 如果基本路径是根路径，显示所有目录
          if (normalizedBasicPath === "/") {
            directories.add(firstDir);
          }
          // 检查目录路径是否在基本路径的导航路径上
          else if (normalizedBasicPath.startsWith(normalizedDirPath + "/") || normalizedBasicPath === normalizedDirPath) {
            directories.add(firstDir);
          }
          // 检查基本路径是否在目录路径范围内
          else if (normalizedDirPath.startsWith(normalizedBasicPath + "/")) {
            directories.add(firstDir);
          }
        } else {
          // 没有基本路径限制，显示所有目录
          directories.add(firstDir);
        }
      }
    }
  }

  // 将目录添加到结果中
  for (const dir of directories) {
    result.items.push({
      name: dir,
      path: path + dir + "/",
      isDirectory: true,
      isVirtual: true,
      // 虚拟目录不设置modified字段，前端会显示"-"
    });
  }

  // 将挂载点添加到结果中
  for (const mountEntry of mountEntries) {
    result.items.push(mountEntry);
  }

  return result;
}

/**
 * 递归计算S3目录大小
 * @param {S3Client} s3Client - S3客户端实例
 * @param {string} bucketName - 存储桶名称
 * @param {string} prefix - 目录前缀
 * @returns {Promise<number>} 目录总大小（字节）
 */
async function calculateS3DirectorySize(s3Client, bucketName, prefix) {
  let totalSize = 0;
  let continuationToken = undefined;
  let fileCount = 0;

  do {
    const listParams = {
      Bucket: bucketName,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    };

    const command = new ListObjectsV2Command(listParams);
    const response = await s3Client.send(command);

    // 累加所有文件的大小
    if (response.Contents) {
      for (const content of response.Contents) {
        // 跳过目录标记对象
        if (!content.Key.endsWith("/") || content.Size > 0) {
          totalSize += content.Size || 0;
          fileCount++;
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return totalSize;
}

/**
 * 获取S3目录的修改时间（仅从目录标记对象获取）
 * @param {S3Client} s3Client - S3客户端实例
 * @param {string} bucketName - 存储桶名称
 * @param {string} prefix - 目录前缀
 * @returns {Promise<string>} 目录修改时间的ISO字符串
 */
async function getS3DirectoryModifiedTime(s3Client, bucketName, prefix) {
  try {
    // 检查是否存在目录标记对象
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
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
    console.warn(`检查目录标记对象失败:`, error);
  }

  // 兜底返回当前时间
  return new Date().toISOString();
}

/**
 * 统一的父目录时间更新工具函数
 * 根据S3配置和文件路径自动创建S3客户端并更新父目录时间
 * @param {Object} s3Config - S3配置对象
 * @param {string} filePath - 文件或目录路径
 * @param {string} encryptionSecret - 加密密钥
 * @returns {Promise<void>}
 */
export async function updateParentDirectoriesModifiedTimeHelper(s3Config, filePath, encryptionSecret) {
  try {
    const { createS3Client } = await import("../utils/s3Utils.js");
    const s3Client = await createS3Client(s3Config, encryptionSecret);
    const rootPrefix = s3Config.root_prefix ? (s3Config.root_prefix.endsWith("/") ? s3Config.root_prefix : s3Config.root_prefix + "/") : "";
    await updateParentDirectoriesModifiedTime(s3Client, s3Config.bucket_name, filePath, rootPrefix);
  } catch (error) {
    console.warn(`更新父目录修改时间失败:`, error);
  }
}

/**
 * 更新目录及其所有父目录的修改时间
 * @param {S3Client} s3Client - S3客户端实例
 * @param {string} bucketName - 存储桶名称
 * @param {string} filePath - 文件或目录路径
 * @param {string} rootPrefix - 根前缀
 * @param {boolean} skipMissingDirectories - 是否跳过不存在的目录（用于删除操作）
 */
export async function updateParentDirectoriesModifiedTime(s3Client, bucketName, filePath, rootPrefix = "", skipMissingDirectories = false) {
  try {
    // 获取文件所在的目录路径
    let currentPath = filePath;

    // 如果是文件，获取其父目录
    if (!filePath.endsWith("/")) {
      const lastSlashIndex = filePath.lastIndexOf("/");
      if (lastSlashIndex > 0) {
        currentPath = filePath.substring(0, lastSlashIndex + 1);
      } else {
        // 文件在根目录，无需更新父目录
        return;
      }
    }

    const updatedPaths = new Set();

    // 从当前目录开始，逐级向上更新父目录
    while (currentPath && currentPath !== rootPrefix && currentPath.length > rootPrefix.length) {
      // 避免重复更新同一个目录
      if (updatedPaths.has(currentPath)) {
        break;
      }

      try {
        // 检查目录标记对象是否存在
        const { HeadObjectCommand, PutObjectCommand } = await import("@aws-sdk/client-s3");

        // 尝试获取现有目录标记对象
        let directoryExists = false;
        try {
          const headParams = {
            Bucket: bucketName,
            Key: currentPath,
          };
          const headCommand = new HeadObjectCommand(headParams);
          await s3Client.send(headCommand);
          directoryExists = true;
        } catch (error) {
          if (error.$metadata?.httpStatusCode !== 404) {
            console.warn(`检查目录标记对象失败: ${currentPath}`, error);
          }
        }

        // 如果skipMissingDirectories为true且目录不存在，则跳过
        if (skipMissingDirectories && !directoryExists) {
          console.log(`跳过不存在的目录: ${currentPath}`);
          updatedPaths.add(currentPath); // 标记为已处理，避免重复检查
        } else {
          // 更新或创建目录标记对象
          const putParams = {
            Bucket: bucketName,
            Key: currentPath,
            Body: "",
            ContentType: "application/x-directory",
          };

          const putCommand = new PutObjectCommand(putParams);
          await s3Client.send(putCommand);
          updatedPaths.add(currentPath);
        }
      } catch (error) {
        console.warn(`更新目录修改时间失败: ${currentPath}`, error);
      }

      // 移动到父目录
      // 找到倒数第二个斜杠的位置（因为当前路径以斜杠结尾）
      const parentEndIndex = currentPath.lastIndexOf("/", currentPath.length - 2);
      if (parentEndIndex < 0 || parentEndIndex < rootPrefix.length) {
        break;
      }
      currentPath = currentPath.substring(0, parentEndIndex + 1);
    }
  } catch (error) {
    console.warn(`更新父目录修改时间失败:`, error);
  }
}

/**
 * 获取S3目录内容
 * @param {D1Database} db - D1数据库实例
 * @param {Object} mount - 挂载点对象
 * @param {string} subPath - 相对于挂载点的子路径
 * @param {string} encryptionSecret - 加密密钥
 * @returns {Promise<Object>} S3目录内容
 */
async function getS3DirectoryListing(db, mount, subPath, encryptionSecret) {
  // 检查缓存，但跳过没有文件夹大小信息的旧缓存
  if (mount.cache_ttl > 0) {
    const cachedResult = directoryCacheManager.get(mount.id, subPath);
    if (cachedResult && cachedResult.items) {
      // 检查缓存是否包含文件夹大小信息（新版本缓存）
      // 对于真实目录（非虚拟目录），应该有size字段
      const hasDirectorySizes = cachedResult.items.some((item) => item.isDirectory && !item.isVirtual && typeof item.size === "number");
      const hasOnlyFiles = cachedResult.items.every((item) => !item.isDirectory);
      const hasOnlyVirtualDirs = cachedResult.items.every((item) => !item.isDirectory || item.isVirtual);

      if (hasDirectorySizes || hasOnlyFiles || hasOnlyVirtualDirs) {
        return cachedResult;
      }
      // 如果缓存是旧版本（文件夹没有size字段），则重新计算
      console.log("发现旧版本缓存，重新计算文件夹大小");
    }
  }

  // 获取S3配置
  const s3Config = await db.prepare("SELECT * FROM s3_configs WHERE id = ?").bind(mount.storage_config_id).first();

  if (!s3Config) {
    throw new HTTPException(ApiStatus.NOT_FOUND, { message: "存储配置不存在" });
  }

  // 创建S3客户端
  const s3Client = await createS3Client(s3Config, encryptionSecret);

  // 规范化S3子路径
  const s3SubPath = normalizeS3SubPath(subPath, s3Config, true);

  // 更新挂载点的最后使用时间
  await updateMountLastUsed(db, mount.id);

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
  const rootPrefix = s3Config.root_prefix ? (s3Config.root_prefix.endsWith("/") ? s3Config.root_prefix : s3Config.root_prefix + "/") : "";

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
  const command = new ListObjectsV2Command({
    Bucket: s3Config.bucket_name,
    Prefix: fullPrefix,
    Delimiter: "/",
  });

  try {
    const response = await s3Client.send(command);

    // 处理前缀（文件夹）
    if (response.CommonPrefixes) {
      for (const prefix of response.CommonPrefixes) {
        if (prefix.Prefix) {
          // 从S3 key中提取相对路径和名称
          const dirPrefix = prefix.Prefix;
          const relativePath = dirPrefix.substring(rootPrefix.length);
          let dirName = relativePath;

          // 移除末尾的斜杠
          if (dirName.endsWith("/")) {
            dirName = dirName.slice(0, -1);
          }

          // 跳过空目录名
          if (!dirName) {
            continue;
          }

          // 只显示当前层级的目录名，而不是完整路径
          // 例如：如果relativePath是"1/2"，只显示"2"
          const displayName = dirName.includes("/") ? dirName.split("/").pop() : dirName;

          // 计算目录大小
          let directorySize = 0;
          try {
            directorySize = await calculateS3DirectorySize(s3Client, s3Config.bucket_name, dirPrefix);
            console.log(`目录 ${displayName} 大小: ${directorySize} 字节`);
          } catch (error) {
            console.warn(`计算目录 ${displayName} 大小失败:`, error);
            // 如果计算失败，使用默认值0
          }

          // 获取目录的真实修改时间
          let directoryModified = new Date().toISOString();
          try {
            directoryModified = await getS3DirectoryModifiedTime(s3Client, s3Config.bucket_name, dirPrefix);
          } catch (error) {
            console.warn(`获取目录 ${displayName} 修改时间失败:`, error);
            // 如果获取失败，使用当前时间
          }

          // 构建正确的路径，避免双斜杠
          const itemPath = mount.mount_path.endsWith("/") ? mount.mount_path + dirName + "/" : mount.mount_path + "/" + dirName + "/";

          result.items.push({
            name: displayName,
            path: itemPath,
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
      // 计算用于截取相对路径的前缀长度
      const prefixLength = fullPrefix.length;

      for (const content of response.Contents) {
        const key = content.Key;

        // 跳过作为目录标记的对象（与前缀完全相同或只是添加了斜杠的对象）
        if (key === fullPrefix || key === fullPrefix + "/") {
          continue;
        }

        // 从S3 key中提取相对路径和名称（从正确的前缀位置开始）
        const relativePath = key.substring(prefixLength);

        // 跳过嵌套在子目录中的文件（这些应在子目录中列出）
        if (relativePath.includes("/")) {
          continue;
        }

        // 跳过空文件名
        if (!relativePath) {
          continue;
        }

        result.items.push({
          name: relativePath,
          path: mount.mount_path + subPath + relativePath,
          isDirectory: false,
          size: content.Size,
          modified: content.LastModified ? content.LastModified.toISOString() : new Date().toISOString(),
          etag: content.ETag ? content.ETag.replace(/"/g, "") : undefined,
        });
      }
    }

    // 如果启用了缓存，将结果添加到缓存
    if (mount.cache_ttl > 0) {
      directoryCacheManager.set(mount.id, subPath, result, mount.cache_ttl);
    }

    return result;
  } catch (error) {
    console.error("S3列目录错误:", error);
    throw error;
  }
}

/**
 * 获取文件信息
 * @param {D1Database} db - D1数据库实例
 * @param {string} path - 文件路径
 * @param {string|Object} userIdOrInfo - 用户ID（管理员）或API密钥信息对象（API密钥用户）
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {string} encryptionSecret - 加密密钥
 * @returns {Promise<Object>} 文件信息
 */
export async function getFileInfo(db, path, userIdOrInfo, userType, encryptionSecret) {
  return handleFsError(
      async () => {
        // 查找挂载点
        let mountResult;
        if (userType === "admin") {
          mountResult = await findMountPointByPath(db, path, userIdOrInfo, userType);
        } else if (userType === "apiKey") {
          mountResult = await findMountPointByPathWithApiKey(db, path, userIdOrInfo);
        } else {
          throw new HTTPException(ApiStatus.UNAUTHORIZED, { message: "未授权访问" });
        }

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

        // 规范化S3子路径 (不添加斜杠，因为可能是文件)
        const s3SubPath = normalizeS3SubPath(subPath, s3Config, false);

        // 更新最后使用时间
        await updateMountLastUsed(db, mount.id);

        // 获取对象信息
        try {
          // 首先尝试使用HeadObjectCommand获取元数据
          try {
            const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
            const headParams = {
              Bucket: s3Config.bucket_name,
              Key: s3SubPath,
            };

            const headCommand = new HeadObjectCommand(headParams);
            const headResponse = await s3Client.send(headCommand);

            // 判断是文件还是目录
            const isDirectory = s3SubPath.endsWith("/") || headResponse.ContentType === "application/x-directory";

            // 构建文件/目录信息
            const result = {
              path: path,
              name: path.split("/").filter(Boolean).pop() || "/",
              isDirectory: isDirectory,
              size: headResponse.ContentLength,
              modified: headResponse.LastModified ? headResponse.LastModified.toISOString() : new Date().toISOString(),
              contentType: headResponse.ContentType || "application/octet-stream",
              etag: headResponse.ETag ? headResponse.ETag.replace(/"/g, "") : undefined,
              mount_id: mount.id,
              storage_type: mount.storage_type,
            };

            // 如果是文件，添加preview_url和download_url字段
            if (!isDirectory) {
              try {
                const { generatePresignedUrl } = await import("../utils/s3Utils.js");

                // 构建缓存选项 - 安全提取用户ID
                const cacheOptions = {
                  userType,
                  userId: userType === "admin" ? userIdOrInfo : userIdOrInfo?.id || userIdOrInfo,
                  enableCache: true,
                };

                // 生成预览URL（不强制下载）
                const previewUrl = await generatePresignedUrl(s3Config, s3SubPath, encryptionSecret, null, false, null, cacheOptions);
                result.preview_url = previewUrl;

                // 生成下载URL（强制下载）
                const downloadUrl = await generatePresignedUrl(s3Config, s3SubPath, encryptionSecret, null, true, null, cacheOptions);
                result.download_url = downloadUrl;

                console.log(`为文件[${result.name}]生成预签名URL: preview=${!!previewUrl}, download=${!!downloadUrl}`);
              } catch (urlError) {
                console.warn(`生成预签名URL失败: ${urlError.message}`);
                // 不阻断主流程，只是没有预签名URL
              }
            }

            // 保留关键调试日志：确认S3返回的ContentType
            console.log(`getFileInfo - 文件[${result.name}], S3 ContentType[${headResponse.ContentType}]`);

            return result;
          } catch (headError) {
            // 如果HEAD请求失败（可能是403 Forbidden或UnknownError），继续尝试GET请求
            if (headError.$metadata?.httpStatusCode === 403 || headError.name === "UnknownError" || (headError.message && headError.message.includes("UnknownError"))) {
              // 使用GetObjectCommand但不使用Range参数
              const { GetObjectCommand } = await import("@aws-sdk/client-s3");
              const getParams = {
                Bucket: s3Config.bucket_name,
                Key: s3SubPath,
                // 不使用Range头部，避免签名问题
              };

              const getCommand = new GetObjectCommand(getParams);
              const getResponse = await s3Client.send(getCommand);

              // 安全地关闭响应流，不同环境下Body的实现可能不同
              try {
                if (getResponse.Body) {
                  // 根据响应体类型使用适当的方法关闭
                  if (typeof getResponse.Body.destroy === "function") {
                    // Node.js环境
                    getResponse.Body.destroy();
                  } else if (typeof getResponse.Body.cancel === "function") {
                    // 某些浏览器环境
                    getResponse.Body.cancel();
                  } else if (typeof getResponse.Body.close === "function") {
                    // 某些流实现
                    getResponse.Body.close();
                  } else if (typeof getResponse.Body.abort === "function") {
                    // 某些请求实现
                    getResponse.Body.abort();
                  }
                  // 如果以上方法都不存在，让GC处理
                }
              } catch (closeError) {
                // 忽略关闭流时的错误，不影响主流程
                console.log("关闭响应流时出现错误，已忽略:", closeError);
              }

              // 判断是文件还是目录
              const isDirectory = s3SubPath.endsWith("/") || getResponse.ContentType === "application/x-directory";

              // 构建文件/目录信息
              const result = {
                path: path,
                name: path.split("/").filter(Boolean).pop() || "/",
                isDirectory: isDirectory,
                size: getResponse.ContentLength,
                modified: getResponse.LastModified ? getResponse.LastModified.toISOString() : new Date().toISOString(),
                contentType: getResponse.ContentType || "application/octet-stream",
                etag: getResponse.ETag ? getResponse.ETag.replace(/"/g, "") : undefined,
                mount_id: mount.id,
                storage_type: mount.storage_type,
              };

              // 如果是文件，添加preview_url和download_url字段
              if (!isDirectory) {
                try {
                  const { generatePresignedUrl } = await import("../utils/s3Utils.js");

                  // 构建缓存选项 - 安全提取用户ID
                  const cacheOptions = {
                    userType,
                    userId: userType === "admin" ? userIdOrInfo : userIdOrInfo?.id || userIdOrInfo,
                    enableCache: true,
                  };

                  // 生成预览URL（不强制下载）
                  const previewUrl = await generatePresignedUrl(s3Config, s3SubPath, encryptionSecret, null, false, null, cacheOptions);
                  result.preview_url = previewUrl;

                  // 生成下载URL（强制下载）
                  const downloadUrl = await generatePresignedUrl(s3Config, s3SubPath, encryptionSecret, null, true, null, cacheOptions);
                  result.download_url = downloadUrl;

                  console.log(`为文件[${result.name}]生成预签名URL: preview=${!!previewUrl}, download=${!!downloadUrl}`);
                } catch (urlError) {
                  console.warn(`生成预签名URL失败: ${urlError.message}`);
                  // 不阻断主流程，只是没有预签名URL
                }
              }

              // 保留关键调试日志：确认S3返回的ContentType
              console.log(`getFileInfo(GET) - 文件[${result.name}], S3 ContentType[${getResponse.ContentType}]`);

              return result;
            } else if (headError.$metadata?.httpStatusCode === 404) {
              // 如果是404错误，可能是目录，继续下面的目录处理逻辑
              throw headError;
            } else {
              // 其他类型的错误直接抛出
              throw headError;
            }
          }
        } catch (error) {
          // 如果是404错误，可能是目录，尝试列出前缀内容来确认
          if (error.$metadata && error.$metadata.httpStatusCode === 404) {
            // 尝试作为目录处理
            const dirPath = s3SubPath.endsWith("/") ? s3SubPath : s3SubPath + "/";

            const listParams = {
              Bucket: s3Config.bucket_name,
              Prefix: dirPath,
              MaxKeys: 1,
            };

            const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
            const listCommand = new ListObjectsV2Command(listParams);
            const listResponse = await s3Client.send(listCommand);

            // 如果有内容，说明是目录
            if (listResponse.Contents && listResponse.Contents.length > 0) {
              // 获取目录的真实修改时间
              let directoryModified = new Date().toISOString();
              try {
                directoryModified = await getS3DirectoryModifiedTime(s3Client, s3Config.bucket_name, dirPath);
              } catch (error) {
                console.warn(`获取目录修改时间失败:`, error);
                // 如果获取失败，使用当前时间
              }

              const result = {
                path: path,
                name: path.split("/").filter(Boolean).pop() || "/",
                isDirectory: true,
                size: 0,
                modified: directoryModified,
                contentType: "application/x-directory",
                mount_id: mount.id,
                storage_type: mount.storage_type,
              };
              return result;
            }

            // 如果没有内容，可能是文件不存在
            throw new HTTPException(ApiStatus.NOT_FOUND, { message: "文件或目录不存在" });
          } else if (error.$metadata && error.$metadata.httpStatusCode === 403) {
            throw new HTTPException(ApiStatus.FORBIDDEN, { message: "没有权限访问该文件或目录" });
          } else if (error instanceof HTTPException) {
            throw error;
          }

          throw new HTTPException(ApiStatus.INTERNAL_ERROR, { message: `获取文件信息失败: ${error.name || "未知错误"} - ${error.message || ""}` });
        }
      },
      "获取文件信息",
      "获取文件信息失败"
  );
}

/**
 * 下载文件
 * @param {D1Database} db - D1数据库实例
 * @param {string} path - 文件路径
 * @param {string|Object} userIdOrInfo - 用户ID（管理员）或API密钥信息对象（API密钥用户）
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {string} encryptionSecret - 加密密钥
 * @param {Request} [request] - 请求对象，用于获取Range头
 * @returns {Promise<Response>} 文件内容响应
 */
export async function downloadFile(db, path, userIdOrInfo, userType, encryptionSecret, request = null) {
  return handleFsError(
      async () => {
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

        // 规范化S3子路径 (不添加斜杠，因为是文件)
        const s3SubPath = normalizeS3SubPath(subPath, s3Config, false);

        // 更新最后使用时间
        await updateMountLastUsed(db, mount.id);

        // 提取文件名
        const fileName = path.split("/").filter(Boolean).pop() || "file";

        // 使用getFileFromS3函数直接获取内容并返回
        // 设置isPreview为false表示下载模式，传递请求对象以支持Range请求
        return await getFileFromS3(s3Config, s3SubPath, fileName, false, encryptionSecret, request);
      },
      "下载文件",
      "下载文件失败"
  );
}

/**
 * 创建目录
 * @param {D1Database} db - D1数据库实例
 * @param {string} path - 目录路径
 * @param {string|Object} userIdOrInfo - 用户ID（管理员）或API密钥信息对象（API密钥用户）
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {string} encryptionSecret - 加密密钥
 * @returns {Promise<void>}
 */
export async function createDirectory(db, path, userIdOrInfo, userType, encryptionSecret) {
  return handleFsError(
      async () => {
        // 确保路径以斜杠结尾
        path = normalizePath(path, true); // 使用统一的路径规范化函数

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

        // 规范化S3子路径 (添加斜杠，因为是目录)
        const s3SubPath = normalizeS3SubPath(subPath, s3Config, true);

        // 检查父目录是否存在
        if (s3SubPath.split("/").filter(Boolean).length > 1) {
          const parentPath = s3SubPath.substring(0, s3SubPath.lastIndexOf("/", s3SubPath.length - 2) + 1);
          const parentExists = await checkDirectoryExists(s3Client, s3Config.bucket_name, parentPath);

          if (!parentExists) {
            throw new HTTPException(ApiStatus.CONFLICT, { message: "父目录不存在" });
          }
        }

        // 检查目录是否已存在
        try {
          const headParams = {
            Bucket: s3Config.bucket_name,
            Key: s3SubPath,
          };

          const headCommand = new HeadObjectCommand(headParams);
          await s3Client.send(headCommand);

          // 如果到这里，说明目录已存在
          throw new HTTPException(ApiStatus.CONFLICT, { message: "目录已存在" });
        } catch (error) {
          // 如果是404错误，说明目录不存在，可以创建
          if (error.$metadata && error.$metadata.httpStatusCode === 404) {
            // 创建空目录对象
            const putParams = {
              Bucket: s3Config.bucket_name,
              Key: s3SubPath,
              Body: "",
              ContentType: "application/x-directory",
            };

            const putCommand = new PutObjectCommand(putParams);
            await s3Client.send(putCommand);

            // 更新父目录的修改时间
            const rootPrefix = s3Config.root_prefix ? (s3Config.root_prefix.endsWith("/") ? s3Config.root_prefix : s3Config.root_prefix + "/") : "";
            await updateParentDirectoriesModifiedTime(s3Client, s3Config.bucket_name, s3SubPath, rootPrefix);

            // 更新最后使用时间
            await updateMountLastUsed(db, mount.id);

            // 清除父目录的缓存，因为目录内容已变更
            if (subPath !== "/") {
              // 使用统一的clearCache函数清除挂载点缓存
              await clearCache({ mountId: mount.id });
            }

            return;
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
 * 上传文件
 * @param {D1Database} db - D1数据库实例
 * @param {string} path - 目标路径
 * @param {FormData File} file - 文件对象
 * @param {string|Object} userIdOrInfo - 用户ID（管理员）或API密钥信息对象（API密钥用户）
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {string} encryptionSecret - 加密密钥
 * @param {boolean} useMultipart - 是否使用分片上传，默认为true
 * @returns {Promise<Object>} 上传结果信息
 */
export async function uploadFile(db, path, file, userIdOrInfo, userType, encryptionSecret, useMultipart = true) {
  return handleFsError(
      async () => {
        // 根据useMultipart参数决定使用哪种上传方式
        if (useMultipart) {
          // 使用分片上传（后端会统一从文件名推断MIME类型，不依赖file.type）
          const multipartInfo = await initializeMultipartUpload(db, path, null, file.size, userIdOrInfo, userType, encryptionSecret, file.name);

          // 返回包含必要信息的对象，前端将使用这些信息进行分片上传
          return {
            useMultipart: true,
            uploadId: multipartInfo.uploadId,
            path: multipartInfo.path,
            recommendedPartSize: multipartInfo.recommendedPartSize,
            bucket: multipartInfo.bucket,
            key: multipartInfo.key,
            mount_id: multipartInfo.mount_id,
            storage_type: multipartInfo.storage_type,
            message: "请使用分片上传API上传此文件",
          };
        } else {
          // 使用直接上传
          console.log(`使用直接上传模式，文件: ${file.name}, 大小: ${file.size} 字节`);

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

          // 规范化S3子路径
          let s3SubPath = normalizeS3SubPath(subPath, s3Config, true); // 设置为true确保以斜杠结尾
          // 获取文件名
          const fileName = file.name || "unnamed_file";

          // 构建最终的S3路径：与目录列表逻辑保持一致，只使用root_prefix
          let finalS3Path;

          // 处理root_prefix（与目录列表逻辑保持一致）
          const rootPrefix = s3Config.root_prefix ? (s3Config.root_prefix.endsWith("/") ? s3Config.root_prefix : s3Config.root_prefix + "/") : "";

          let fullPrefix = rootPrefix;

          // 添加s3SubPath (如果不是'/')
          if (s3SubPath && s3SubPath !== "/") {
            fullPrefix += s3SubPath;
          }

          // 确保前缀总是以斜杠结尾 (如果不为空)
          if (fullPrefix && !fullPrefix.endsWith("/")) {
            fullPrefix += "/";
          }

          // 构建最终路径
          finalS3Path = fullPrefix + fileName;

          console.log(`上传文件 - rootPrefix=${rootPrefix}, subPath=${s3SubPath}, fullPrefix=${fullPrefix}, finalPath=${finalS3Path}`);

          // 检查父目录是否存在
          if (finalS3Path.includes("/")) {
            const parentPath = finalS3Path.substring(0, finalS3Path.lastIndexOf("/") + 1);
            const parentExists = await checkDirectoryExists(s3Client, s3Config.bucket_name, parentPath);

            if (!parentExists) {
              throw new HTTPException(ApiStatus.CONFLICT, { message: "父目录不存在" });
            }
          }

          try {
            // 读取文件内容
            const fileContent = await file.arrayBuffer();

            // 统一从文件名推断MIME类型，不依赖浏览器的file.type
            const { getMimeTypeFromFilename } = await import("../utils/fileUtils.js");
            const contentType = getMimeTypeFromFilename(fileName);
            console.log(`直接上传：从文件名[${fileName}]推断MIME类型: ${contentType}`);

            // 直接上传到S3
            const putParams = {
              Bucket: s3Config.bucket_name,
              Key: finalS3Path,
              Body: fileContent,
              ContentType: contentType,
            };

            console.log(`开始直接上传 ${file.size} 字节到 S3，路径: ${finalS3Path}`);

            // 直接上传文件
            const putCommand = new PutObjectCommand(putParams);
            const result = await s3Client.send(putCommand);

            // 更新父目录的修改时间
            const rootPrefix = s3Config.root_prefix ? (s3Config.root_prefix.endsWith("/") ? s3Config.root_prefix : s3Config.root_prefix + "/") : "";
            await updateParentDirectoriesModifiedTime(s3Client, s3Config.bucket_name, finalS3Path, rootPrefix);

            // 更新最后使用时间
            await updateMountLastUsed(db, mount.id);

            // 构建S3直接访问URL
            const s3Url = buildS3Url(s3Config, finalS3Path);

            // 生成文件ID
            const fileId = generateFileId();

            // 生成slug（使用文件ID的前5位作为slug）
            const fileSlug = "M-" + fileId.substring(0, 5);

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
                    finalS3Path,
                    s3Url,
                    contentType, // 使用推断后的正确MIME类型
                    file.size,
                    s3Config.id,
                    fileSlug,
                    result.ETag ? result.ETag.replace(/"/g, "") : null,
                    `${userType}:${userType === "apiKey" ? userIdOrInfo.id : userIdOrInfo}`
                )
                .run();

            console.log(`文件信息已保存到数据库，fileId: ${fileId}, slug: ${fileSlug}`);

            // 清除缓存 - 使用统一的clearCache函数
            await clearCache({ mountId: mount.id });

            // 构建返回结果
            return {
              useMultipart: false,
              success: true,
              path: path,
              name: path.split("/").filter(Boolean).pop() || file.name,
              size: file.size,
              mimetype: contentType, // 使用推断后的正确MIME类型
              etag: result.ETag ? result.ETag.replace(/"/g, "") : undefined,
              fileId: fileId, // 添加fileId到返回值
              slug: fileSlug, // 添加slug到返回值
              message: "文件上传成功",
            };
          } catch (error) {
            console.error("直接上传失败:", error);
            throw error;
          }
        }
      },
      "上传文件",
      "上传文件失败"
  );
}

/**
 * 删除文件或目录
 * @param {D1Database} db - D1数据库实例
 * @param {string} path - 文件或目录路径
 * @param {string|Object} userIdOrInfo - 用户ID（管理员）或API密钥信息对象（API密钥用户）
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {string} encryptionSecret - 加密密钥
 * @returns {Promise<void>}
 */
export async function removeItem(db, path, userIdOrInfo, userType, encryptionSecret) {
  return handleFsError(
      async () => {
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

        // 判断是目录还是文件
        const isDirectory = path.endsWith("/");

        // 规范化S3子路径
        const s3SubPath = normalizeS3SubPath(subPath, s3Config, isDirectory);

        if (isDirectory) {
          // 对于目录，需要递归删除所有内容
          await deleteDirectory(s3Client, s3Config.bucket_name, s3SubPath, db, mount.storage_config_id);
        } else {
          // 对于文件，直接删除
          const deleteParams = {
            Bucket: s3Config.bucket_name,
            Key: s3SubPath,
          };

          try {
            const deleteCommand = new DeleteObjectCommand(deleteParams);
            await s3Client.send(deleteCommand);
          } catch (error) {
            if (error.$metadata && error.$metadata.httpStatusCode === 404) {
              throw new HTTPException(ApiStatus.NOT_FOUND, { message: "文件不存在" });
            }
            throw error;
          }
        }

        // 更新父目录的修改时间（只更新存在的目录，不创建新目录）
        const rootPrefix = s3Config.root_prefix ? (s3Config.root_prefix.endsWith("/") ? s3Config.root_prefix : s3Config.root_prefix + "/") : "";
        await updateParentDirectoriesModifiedTime(s3Client, s3Config.bucket_name, s3SubPath, rootPrefix, true);

        // 尝试删除文件记录表中的对应记录
        try {
          const fileDeleteResult = await deleteFileRecordByStoragePath(db, mount.storage_config_id, s3SubPath);
          if (fileDeleteResult.deletedCount > 0) {
            console.log(`从文件记录中删除了${fileDeleteResult.deletedCount}条数据：挂载点=${mount.id}, 路径=${s3SubPath}`);
          }
        } catch (fileDeleteError) {
          // 文件记录删除失败不影响主流程
          console.error(`删除文件记录失败: ${fileDeleteError.message}`);
        }

        // 更新最后使用时间
        await updateMountLastUsed(db, mount.id);

        // 清除缓存 - 使用统一的clearCache函数
        await clearCache({ mountId: mount.id });
        console.log(`删除操作完成后缓存已清理 - 挂载点=${mount.id}, 路径=${path}`);

        // 额外等待一小段时间，确保缓存清理完全生效
        await new Promise((resolve) => setTimeout(resolve, 100));
      },
      "删除文件或目录",
      "删除失败"
  );
}

/**
 * 递归删除目录
 * @param {S3Client} s3Client - S3客户端
 * @param {string} bucketName - 存储桶名称
 * @param {string} dirPath - 目录路径
 * @param {D1Database} db - 数据库实例，用于删除文件记录
 * @param {string} s3ConfigId - S3配置ID，用于删除文件记录
 */
async function deleteDirectory(s3Client, bucketName, dirPath, db = null, s3ConfigId = null) {
  // 确保目录路径以斜杠结尾
  const prefix = dirPath.endsWith("/") ? dirPath : dirPath + "/";

  try {
    let continuationToken = undefined;
    let isEmpty = true;
    let deletedFiles = [];

    // 使用循环而非递归处理可能的多页结果
    do {
      // 列出目录内容
      const listParams = {
        Bucket: bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      };

      const listCommand = new ListObjectsV2Command(listParams);
      const listResponse = await s3Client.send(listCommand);

      // 检查是否有内容
      if (listResponse.Contents && listResponse.Contents.length > 0) {
        isEmpty = false;

        // 删除所有对象
        for (const object of listResponse.Contents) {
          const deleteParams = {
            Bucket: bucketName,
            Key: object.Key,
          };

          const deleteCommand = new DeleteObjectCommand(deleteParams);
          await s3Client.send(deleteCommand);

          // 记录已删除的文件路径，用于后续批量删除文件记录
          deletedFiles.push(object.Key);
        }
      }

      // 更新令牌用于下一次循环
      continuationToken = listResponse.IsTruncated ? listResponse.NextContinuationToken : undefined;
    } while (continuationToken);

    // 最后，尝试删除目录本身的标记对象（如果存在）
    // 这是为了处理通过createDirectory创建的空目录对象
    try {
      const directoryKey = prefix; // 目录标记对象的Key就是以斜杠结尾的路径
      const deleteDirectoryParams = {
        Bucket: bucketName,
        Key: directoryKey,
      };

      const deleteDirectoryCommand = new DeleteObjectCommand(deleteDirectoryParams);
      await s3Client.send(deleteDirectoryCommand);

      console.log(`已删除目录标记对象: ${directoryKey}`);
      deletedFiles.push(directoryKey);
      isEmpty = false; // 标记为非空，因为删除了目录对象
    } catch (dirDeleteError) {
      // 如果目录标记对象不存在（404错误），这是正常的，不需要处理
      if (dirDeleteError.$metadata && dirDeleteError.$metadata.httpStatusCode !== 404) {
        console.warn(`删除目录标记对象失败: ${dirDeleteError.message}`);
      }
    }

    // 如果整个过程中没有找到任何对象，则认为目录不存在
    if (isEmpty) {
      throw new HTTPException(ApiStatus.NOT_FOUND, { message: "目录不存在或为空" });
    }

    // 如果提供了数据库和配置ID，尝试批量删除文件记录
    if (db && s3ConfigId && deletedFiles.length > 0) {
      try {
        // 对于每个删除的文件，尝试删除对应的文件记录
        for (const filePath of deletedFiles) {
          await deleteFileRecordByStoragePath(db, s3ConfigId, filePath);
        }
        console.log(`已尝试删除${deletedFiles.length}个文件的记录`);
      } catch (fileDeleteError) {
        // 文件记录删除失败不影响主流程
        console.error(`批量删除文件记录失败: ${fileDeleteError.message}`);
      }
    }
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(ApiStatus.INTERNAL_ERROR, { message: "删除目录失败: " + error.message });
  }
}

/**
 * 重命名文件或目录
 * @param {D1Database} db - D1数据库实例
 * @param {string} oldPath - 旧路径
 * @param {string} newPath - 新路径
 * @param {string|Object} userIdOrInfo - 用户ID（管理员）或API密钥信息对象（API密钥用户）
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {string} encryptionSecret - 加密密钥
 * @returns {Promise<void>}
 */
export async function renameItem(db, oldPath, newPath, userIdOrInfo, userType, encryptionSecret) {
  return handleFsError(
      async () => {
        // 检查路径类型必须匹配 (都是文件或都是目录)
        const oldIsDirectory = oldPath.endsWith("/");
        const newIsDirectory = newPath.endsWith("/");

        if (oldIsDirectory !== newIsDirectory) {
          throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "源路径和目标路径类型必须一致（文件或目录）" });
        }

        // 查找源路径的挂载点
        const oldMountResult = await findMountPointByPath(db, oldPath, userIdOrInfo, userType);

        // 处理错误情况
        if (oldMountResult.error) {
          throw new HTTPException(oldMountResult.error.status, { message: oldMountResult.error.message });
        }

        // 查找目标路径的挂载点
        const newMountResult = await findMountPointByPath(db, newPath, userIdOrInfo, userType);

        // 处理错误情况
        if (newMountResult.error) {
          throw new HTTPException(newMountResult.error.status, { message: newMountResult.error.message });
        }

        // 只支持同一个挂载点内的重命名
        if (oldMountResult.mount.id !== newMountResult.mount.id) {
          throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "不支持跨挂载点重命名，请使用复制和删除操作" });
        }

        const mount = oldMountResult.mount;
        const oldSubPath = oldMountResult.subPath;
        const newSubPath = newMountResult.subPath;

        // 获取S3配置
        const s3Config = await db.prepare("SELECT * FROM s3_configs WHERE id = ?").bind(mount.storage_config_id).first();
        if (!s3Config) {
          throw new HTTPException(ApiStatus.NOT_FOUND, { message: "存储配置不存在" });
        }

        // 创建S3客户端
        const s3Client = await createS3Client(s3Config, encryptionSecret);

        // 规范化S3子路径
        const s3OldPath = normalizeS3SubPath(oldSubPath, s3Config, oldIsDirectory);
        const s3NewPath = normalizeS3SubPath(newSubPath, s3Config, newIsDirectory);

        // 检查新路径父目录是否存在
        if (s3NewPath.includes("/")) {
          const parentPath = s3NewPath.substring(0, s3NewPath.lastIndexOf("/") + 1);
          const parentExists = await checkDirectoryExists(s3Client, s3Config.bucket_name, parentPath);

          if (!parentExists) {
            throw new HTTPException(ApiStatus.CONFLICT, { message: "目标父目录不存在" });
          }
        }

        // 检查目标路径是否已存在
        try {
          const headParams = {
            Bucket: s3Config.bucket_name,
            Key: s3NewPath,
          };

          const headCommand = new HeadObjectCommand(headParams);
          await s3Client.send(headCommand);

          // 如果到这里，说明目标已存在
          throw new HTTPException(ApiStatus.CONFLICT, { message: "目标路径已存在" });
        } catch (error) {
          // 如果是404错误，说明目标不存在，可以继续
          if (error.$metadata && error.$metadata.httpStatusCode !== 404) {
            throw error;
          }
        }

        if (oldIsDirectory) {
          // 对于目录，需要复制所有内容
          await renameDirectory(s3Client, s3Config.bucket_name, s3OldPath, s3NewPath);

          // 清除缓存 - 使用统一的clearCache函数
          await clearCache({ mountId: mount.id });
        } else {
          // 对于文件，使用复制然后删除
          // 复制对象
          const copyParams = {
            Bucket: s3Config.bucket_name,
            CopySource: encodeURIComponent(s3Config.bucket_name + "/" + s3OldPath),
            Key: s3NewPath,
          };

          const copyCommand = new CopyObjectCommand(copyParams);
          await s3Client.send(copyCommand);

          // 删除原对象
          const deleteParams = {
            Bucket: s3Config.bucket_name,
            Key: s3OldPath,
          };

          const deleteCommand = new DeleteObjectCommand(deleteParams);
          await s3Client.send(deleteCommand);
        }

        // 更新父目录的修改时间
        const rootPrefix = s3Config.root_prefix ? (s3Config.root_prefix.endsWith("/") ? s3Config.root_prefix : s3Config.root_prefix + "/") : "";
        await updateParentDirectoriesModifiedTime(s3Client, s3Config.bucket_name, s3OldPath, rootPrefix);
        await updateParentDirectoriesModifiedTime(s3Client, s3Config.bucket_name, s3NewPath, rootPrefix);

        // 更新最后使用时间
        await updateMountLastUsed(db, mount.id);

        // 清除缓存 - 使用统一的clearCache函数
        await clearCache({ mountId: mount.id });
      },
      "重命名文件或目录",
      "重命名失败"
  );
}

/**
 * 重命名目录
 * @param {S3Client} s3Client - S3客户端
 * @param {string} bucketName - 存储桶名称
 * @param {string} oldPath - 旧目录路径
 * @param {string} newPath - 新目录路径
 */
async function renameDirectory(s3Client, bucketName, oldPath, newPath) {
  // 确保路径以斜杠结尾
  const oldPrefix = oldPath.endsWith("/") ? oldPath : oldPath + "/";
  const newPrefix = newPath.endsWith("/") ? newPath : newPath + "/";

  try {
    let continuationToken = undefined;
    let isEmpty = true;

    // 使用循环而非递归处理可能的多页结果
    do {
      // 列出源目录内容
      const listParams = {
        Bucket: bucketName,
        Prefix: oldPrefix,
        ContinuationToken: continuationToken,
      };

      const listCommand = new ListObjectsV2Command(listParams);
      const listResponse = await s3Client.send(listCommand);

      // 检查是否有内容
      if (listResponse.Contents && listResponse.Contents.length > 0) {
        isEmpty = false;

        // 复制所有对象到新位置
        for (const object of listResponse.Contents) {
          const sourceKey = object.Key;
          const targetKey = sourceKey.replace(oldPrefix, newPrefix);

          const copyParams = {
            Bucket: bucketName,
            CopySource: encodeURIComponent(bucketName + "/" + sourceKey),
            Key: targetKey,
          };

          const copyCommand = new CopyObjectCommand(copyParams);
          await s3Client.send(copyCommand);

          // 删除原对象
          const deleteParams = {
            Bucket: bucketName,
            Key: sourceKey,
          };

          const deleteCommand = new DeleteObjectCommand(deleteParams);
          await s3Client.send(deleteCommand);
        }
      }

      // 更新令牌用于下一次循环
      continuationToken = listResponse.IsTruncated ? listResponse.NextContinuationToken : undefined;
    } while (continuationToken);

    // 如果整个过程中没有找到任何对象，则认为目录不存在
    if (isEmpty) {
      throw new HTTPException(ApiStatus.NOT_FOUND, { message: "源目录不存在或为空" });
    }
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(ApiStatus.INTERNAL_ERROR, { message: "重命名目录失败: " + error.message });
  }
}

/**
 * 批量删除文件或目录
 * @param {D1Database} db - D1数据库实例
 * @param {Array<string>} paths - 需要删除的路径数组
 * @param {string|Object} userIdOrInfo - 用户ID（管理员）或API密钥信息对象（API密钥用户）
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {string} encryptionSecret - 加密密钥
 * @returns {Promise<{success: number, failed: Array<{path: string, error: string}>}>} 删除结果
 */
export async function batchRemoveItems(db, paths, userIdOrInfo, userType, encryptionSecret) {
  // 结果统计
  const result = {
    success: 0,
    failed: [],
  };

  // 逐个处理每个路径
  for (const path of paths) {
    try {
      await removeItem(db, path, userIdOrInfo, userType, encryptionSecret);
      result.success++;
    } catch (error) {
      // 记录失败信息
      result.failed.push({
        path,
        error: error instanceof HTTPException ? error.message : error.message || "未知错误",
      });
    }
  }

  return result;
}

/**
 * 从S3获取文件并创建响应
 * 改进版函数，用于从S3获取文件内容并设置适当的头部
 * @param {Object} s3Config - S3配置
 * @param {string} s3SubPath - S3子路径
 * @param {string} fileName - 文件名
 * @param {boolean} isPreview - 是否为预览模式
 * @param {string} encryptionSecret - 加密密钥
 * @param {Request} [request] - 请求对象，用于获取Range头
 * @returns {Promise<Response>} 文件内容响应
 */
async function getFileFromS3(s3Config, s3SubPath, fileName, isPreview, encryptionSecret, request = null) {
  // 设置内联或附件模式
  const contentDisposition = `${isPreview ? "inline" : "attachment"}; filename="${encodeURIComponent(fileName)}"`;

  try {
    // 创建S3客户端
    const { createS3Client } = await import("../utils/s3Utils.js");
    const s3Client = await createS3Client(s3Config, encryptionSecret);

    //处理Range请求
    const rangeHeader = request?.headers?.get?.("Range");

    // 获取对象内容
    const getParams = {
      Bucket: s3Config.bucket_name,
      Key: s3SubPath,
    };

    // 如果有Range请求，添加Range参数
    if (rangeHeader) {
      getParams.Range = rangeHeader;
      console.log(`🎬Range请求: ${rangeHeader}`);
    }

    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const command = new GetObjectCommand(getParams);
    const response = await s3Client.send(command);

    // 构建响应头
    const headers = {
      "Content-Type": response.ContentType || "application/octet-stream",
      "Content-Disposition": contentDisposition,
      "Cache-Control": "private, max-age=0",
      "Access-Control-Allow-Origin": "*", // 在路由层会被替换为实际的Origin
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type, Content-Length, Authorization",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Expose-Headers": "Content-Length, Content-Type, Content-Disposition, Content-Range, Accept-Ranges, ETag",
      "Accept-Ranges": "bytes",
    };

    // 如果有Content-Length，添加到头部
    if (response.ContentLength !== undefined) {
      headers["Content-Length"] = String(response.ContentLength);
    }

    // 如果有Last-Modified，添加到头部
    if (response.LastModified) {
      headers["Last-Modified"] = response.LastModified.toUTCString();
    }

    // 如果有ETag，添加到头部
    if (response.ETag) {
      headers["ETag"] = response.ETag;
    }

    // 🎯 处理Range响应 - 如果有Content-Range头，说明是部分内容响应
    let responseStatus = 200;
    if (response.ContentRange) {
      headers["Content-Range"] = response.ContentRange;
      responseStatus = 206; // Partial Content
      console.log(`🎬 mount-explorer Range响应: ${response.ContentRange}`);
    }

    // 返回包含文件内容的响应
    return new Response(response.Body, {
      status: responseStatus,
      headers: headers,
    });
  } catch (error) {
    console.error(`${isPreview ? "预览" : "下载"}文件出错:`, error);

    // 处理不同类型的错误
    if (error.$metadata && error.$metadata.httpStatusCode === 404) {
      throw new HTTPException(ApiStatus.NOT_FOUND, { message: "文件不存在" });
    } else if (error.$metadata && error.$metadata.httpStatusCode === 403) {
      throw new HTTPException(ApiStatus.FORBIDDEN, { message: "没有权限访问该文件" });
    }

    throw new HTTPException(ApiStatus.INTERNAL_ERROR, { message: `${isPreview ? "预览" : "下载"}文件失败: ${error.message || "未知错误"}` });
  }
}

/**
 * 获取文件预签名下载URL
 * @param {D1Database} db - D1数据库实例
 * @param {string} path - 文件路径
 * @param {string|Object} userIdOrInfo - 用户ID（管理员）或API密钥信息对象（API密钥用户）
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {string} encryptionSecret - 加密密钥
 * @param {number} expiresIn - URL过期时间（秒），默认为7天
 * @param {boolean} forceDownload - 是否强制下载（而非预览）
 * @returns {Promise<Object>} 包含预签名URL的对象
 */
export async function getFilePresignedUrl(db, path, userIdOrInfo, userType, encryptionSecret, expiresIn = 604800, forceDownload = false) {
  return handleFsError(
      async () => {
        // 查找挂载点
        const mountResult = await findMountPointByPath(db, path, userIdOrInfo, userType);

        // 处理错误情况
        if (mountResult.error) {
          throw new HTTPException(mountResult.error.status, { message: mountResult.error.message });
        }

        const { mount, subPath } = mountResult;

        // 仅允许S3类型的挂载点
        if (mount.storage_type !== "S3") {
          throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "当前路径不支持生成预签名URL" });
        }

        // 获取S3配置
        const s3Config = await db.prepare("SELECT * FROM s3_configs WHERE id = ?").bind(mount.storage_config_id).first();
        if (!s3Config) {
          throw new HTTPException(ApiStatus.NOT_FOUND, { message: "存储配置不存在" });
        }

        // 确保路径指向文件而非目录
        if (path.endsWith("/")) {
          throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "无法为目录生成预签名URL" });
        }

        // 规范化S3子路径 (不添加斜杠，因为是文件)
        const s3SubPath = normalizeS3SubPath(subPath, s3Config, false);

        // 更新最后使用时间
        await updateMountLastUsed(db, mount.id);

        // 获取文件名
        const fileName = path.split("/").filter(Boolean).pop() || "file";

        // 生成预签名URL，使用传入的expiresIn参数（保持现有API兼容性）
        const { generatePresignedUrl } = await import("../utils/s3Utils.js");

        // 构建缓存选项 - 安全提取用户ID
        const cacheOptions = {
          userType,
          userId: userType === "admin" ? userIdOrInfo : userIdOrInfo?.id || userIdOrInfo,
          enableCache: true,
        };

        const presignedUrl = await generatePresignedUrl(s3Config, s3SubPath, encryptionSecret, expiresIn, forceDownload, null, cacheOptions);

        // 构建响应对象
        return {
          path: path,
          name: fileName,
          presignedUrl: presignedUrl,
          expiresIn: expiresIn,
          expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
          forceDownload: forceDownload,
          mount_id: mount.id,
          storage_type: mount.storage_type,
        };
      },
      "获取文件预签名URL",
      "获取文件预签名URL失败"
  );
}

/**
 * 更新文件内容
 * @param {D1Database} db - D1数据库实例
 * @param {string} path - 文件路径
 * @param {string|ArrayBuffer} content - 新的文件内容
 * @param {string|Object} userIdOrInfo - 用户ID（管理员）或API密钥信息对象（API密钥用户）
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {string} encryptionSecret - 加密密钥
 * @returns {Promise<Object>} 更新结果
 */
export async function updateFile(db, path, content, userIdOrInfo, userType, encryptionSecret) {
  // 设置文件大小限制 (10MB)
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  return handleFsError(
      async () => {
        // 检查内容大小
        if (typeof content === "string" && content.length > MAX_FILE_SIZE) {
          throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "文件内容过大，超过最大限制(10MB)" });
        } else if (content instanceof ArrayBuffer && content.byteLength > MAX_FILE_SIZE) {
          throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "文件内容过大，超过最大限制(10MB)" });
        }

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

        // 规范化S3子路径 (不添加斜杠，因为是文件)
        const s3SubPath = normalizeS3SubPath(subPath, s3Config, false);

        // 更新最后使用时间
        await updateMountLastUsed(db, mount.id);

        try {
          // 获取文件名
          const fileName = path.split("/").pop();

          // 尝试获取原始文件信息
          let originalMetadata = null;
          try {
            const headParams = {
              Bucket: s3Config.bucket_name,
              Key: s3SubPath,
            };

            const headCommand = new HeadObjectCommand(headParams);
            originalMetadata = await s3Client.send(headCommand);
            console.log("获取到原始文件元数据:", {
              contentType: originalMetadata.ContentType,
              contentLength: originalMetadata.ContentLength,
              lastModified: originalMetadata.LastModified,
            });
          } catch (error) {
            // 如果文件不存在，则记录日志但继续执行
            if (error.$metadata?.httpStatusCode === 404) {
              console.log(`文件 ${s3SubPath} 不存在，将创建新文件`);
            } else {
              console.warn("获取原始文件元数据失败:", error);
            }
          }

          // 准备文件内容
          let fileContent;
          let contentType;

          // 检查content类型并使用fileUtils中的函数确定MIME类型
          if (typeof content === "string") {
            fileContent = content;

            // 使用现有函数获取MIME类型和分组
            const { mimeType, mimeGroup } = getMimeTypeAndGroupFromFile({
              filename: fileName,
              mimetype: originalMetadata?.ContentType || "text/plain",
            });

            contentType = mimeType;
            console.log(`文件 ${fileName} 的MIME类型确定为: ${contentType}, 分组: ${mimeGroup}`);
          } else if (content instanceof ArrayBuffer || content instanceof Uint8Array) {
            fileContent = content;

            // 对于二进制内容，尝试从文件名和原始元数据确定类型
            const { mimeType, mimeGroup } = getMimeTypeAndGroupFromFile({
              filename: fileName,
              mimetype: originalMetadata?.ContentType || "application/octet-stream",
            });

            contentType = mimeType;
            console.log(`二进制文件 ${fileName} 的MIME类型确定为: ${contentType}, 分组: ${mimeGroup}`);
          } else {
            throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "不支持的内容格式" });
          }

          // 更新S3对象
          const putParams = {
            Bucket: s3Config.bucket_name,
            Key: s3SubPath,
            Body: fileContent,
            ContentType: contentType,
          };

          // 如果有原始元数据，尝试保留某些元数据
          if (originalMetadata) {
            // 可以选择性地保留某些元数据
            if (originalMetadata.Metadata) {
              putParams.Metadata = originalMetadata.Metadata;
            }
          }

          console.log(`准备更新S3对象: ${s3SubPath}, 内容类型: ${contentType}`);
          const putCommand = new PutObjectCommand(putParams);
          const result = await s3Client.send(putCommand);

          // 更新父目录的修改时间
          const rootPrefix = s3Config.root_prefix ? (s3Config.root_prefix.endsWith("/") ? s3Config.root_prefix : s3Config.root_prefix + "/") : "";
          await updateParentDirectoriesModifiedTime(s3Client, s3Config.bucket_name, s3SubPath, rootPrefix);

          // 清除文件缓存
          if (mount.cache_ttl > 0) {
            // 清除缓存 - 使用统一的clearCache函数
            await clearCache({ mountId: mount.id });
          }

          // 返回更新结果
          return {
            success: true,
            path: path,
            etag: result.ETag ? result.ETag.replace(/"/g, "") : undefined,
            contentType: contentType,
            message: "文件更新成功",
            isNewFile: !originalMetadata,
          };
        } catch (error) {
          console.error("更新文件错误:", error);

          // 增强错误处理
          if (error.$metadata) {
            if (error.$metadata.httpStatusCode === 404) {
              throw new HTTPException(ApiStatus.NOT_FOUND, { message: "文件不存在" });
            } else if (error.$metadata.httpStatusCode === 403) {
              throw new HTTPException(ApiStatus.FORBIDDEN, { message: "没有权限更新该文件" });
            } else if (error.$metadata.httpStatusCode === 413) {
              throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "文件内容过大" });
            }

            // 记录详细错误信息
            console.error("S3错误详情:", {
              errorName: error.name,
              errorMessage: error.message,
              errorCode: error.$metadata?.httpStatusCode,
              s3Path: s3SubPath,
            });
          }

          throw error;
        }
      },
      "更新文件",
      "更新文件失败"
  );
}

/**
 * 复制文件或目录
 * @param {D1Database} db - D1数据库实例
 * @param {string} sourcePath - 源路径
 * @param {string} targetPath - 目标路径
 * @param {string|Object} userIdOrInfo - 用户ID（管理员）或API密钥信息对象（API密钥用户）
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {string} encryptionSecret - 加密密钥
 * @param {boolean} skipExisting - 是否跳过已存在的文件，默认为true
 * @returns {Promise<Object>} 复制结果
 */
export async function copyItem(db, sourcePath, targetPath, userIdOrInfo, userType, encryptionSecret, skipExisting = true) {
  return handleFsError(
      async () => {
        // 检查源路径和目标路径不能相同
        if (sourcePath === targetPath) {
          throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "源路径和目标路径不能相同" });
        }

        // 检查路径类型 (都是文件或都是目录)
        const sourceIsDirectory = sourcePath.endsWith("/");
        let targetIsDirectory = targetPath.endsWith("/");

        // 如果源是目录但目标不是目录格式，自动添加斜杠
        if (sourceIsDirectory && !targetIsDirectory) {
          targetPath = targetPath + "/";
          targetIsDirectory = true;
        }

        // 对于文件复制，确保目标路径也是文件路径格式
        if (!sourceIsDirectory && targetIsDirectory) {
          throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "复制文件时，目标路径不能是目录格式" });
        }

        // 查找源路径的挂载点
        const sourceMountResult = await findMountPointByPath(db, sourcePath, userIdOrInfo, userType);

        // 处理错误情况
        if (sourceMountResult.error) {
          throw new HTTPException(sourceMountResult.error.status, { message: sourceMountResult.error.message });
        }

        // 查找目标路径的挂载点
        const targetMountResult = await findMountPointByPath(db, targetPath, userIdOrInfo, userType);

        // 处理错误情况
        if (targetMountResult.error) {
          throw new HTTPException(targetMountResult.error.status, { message: targetMountResult.error.message });
        }

        // 检查是否为跨存储复制
        if (sourceMountResult.mount.id !== targetMountResult.mount.id) {
          // 判断两个挂载点是否都是S3类型
          if (sourceMountResult.mount.storage_type === "S3" && targetMountResult.mount.storage_type === "S3") {
            // 调用跨存储复制处理函数
            return await handleCrossStorageCopy(db, sourcePath, targetPath, userIdOrInfo, userType, encryptionSecret);
          } else {
            throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "跨存储复制仅支持S3类型存储" });
          }
        }

        // 检查源挂载点和目标挂载点的存储类型是否为S3
        if (sourceMountResult.mount.storage_type !== "S3") {
          throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "只支持S3类型存储的复制操作" });
        }

        const mount = sourceMountResult.mount;
        const sourceSubPath = sourceMountResult.subPath;
        const targetSubPath = targetMountResult.subPath;

        // 获取S3配置
        const s3Config = await db.prepare("SELECT * FROM s3_configs WHERE id = ?").bind(mount.storage_config_id).first();
        if (!s3Config) {
          throw new HTTPException(ApiStatus.NOT_FOUND, { message: "存储配置不存在" });
        }

        // 创建S3客户端
        const s3Client = await createS3Client(s3Config, encryptionSecret);

        // 规范化S3子路径
        const s3SourcePath = normalizeS3SubPath(sourceSubPath, s3Config, sourceIsDirectory);
        const s3TargetPath = normalizeS3SubPath(targetSubPath, s3Config, targetIsDirectory);

        // 检查源路径是否存在
        try {
          const sourceExists = await checkS3ObjectExists(s3Client, s3Config.bucket_name, s3SourcePath);
          if (!sourceExists) {
            // 如果是目录，尝试列出目录内容确认存在性
            if (sourceIsDirectory) {
              const listResponse = await listS3Directory(s3Client, s3Config.bucket_name, s3SourcePath);

              // 如果没有内容，说明目录不存在或为空
              if (!listResponse.Contents || listResponse.Contents.length === 0) {
                throw new HTTPException(ApiStatus.NOT_FOUND, { message: "源路径不存在或为空目录" });
              }
            } else {
              throw new HTTPException(ApiStatus.NOT_FOUND, { message: "源文件不存在" });
            }
          }
        } catch (error) {
          if (error instanceof HTTPException) {
            throw error;
          }
          throw new HTTPException(ApiStatus.INTERNAL_ERROR, { message: "检查源路径存在性失败: " + error.message });
        }

        // 检查目标父目录是否存在（对于文件复制或目录创建）
        if (s3TargetPath.includes("/")) {
          let parentPath;
          if (targetIsDirectory) {
            // 对于目录，获取其父目录
            parentPath = s3TargetPath.substring(0, s3TargetPath.lastIndexOf("/", s3TargetPath.length - 2) + 1);
          } else {
            // 对于文件，获取其所在目录
            parentPath = s3TargetPath.substring(0, s3TargetPath.lastIndexOf("/") + 1);
          }

          // 添加验证：确保parentPath不为空
          if (!parentPath || parentPath.trim() === "") {
            // 目标父目录路径为空，假定为根目录，跳过创建步骤
          } else {
            const parentExists = await checkDirectoryExists(s3Client, s3Config.bucket_name, parentPath);

            if (!parentExists) {
              // 自动创建父目录而不是抛出错误
              console.log(`复制操作: 正在创建目标父目录 "${parentPath}"`);

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
              } catch (dirError) {
                console.error(`复制操作: 创建目标父目录 "${parentPath}" 失败:`, dirError);
                // 如果创建目录失败，才抛出错误
                throw new HTTPException(ApiStatus.CONFLICT, { message: `无法创建目标父目录: ${dirError.message}` });
              }
            }
          }
        }

        let result = {};

        // 根据类型处理复制
        if (sourceIsDirectory) {
          // 复制目录
          result = await copyDirectory(s3Client, s3Config.bucket_name, s3SourcePath, s3TargetPath, skipExisting);
        } else {
          // 复制文件
          // 首先检查目标文件是否已存在
          let targetExists = false;
          try {
            targetExists = await checkS3ObjectExists(s3Client, s3Config.bucket_name, s3TargetPath);
          } catch (error) {
            // 如果不是存在性检查的错误，则抛出
            if (!(error instanceof HTTPException)) {
              throw error;
            }
          }

          // 如果目标已存在且设置为跳过已存在文件，则返回跳过信息
          if (targetExists && skipExisting) {
            result = {
              success: true,
              skipped: true,
              sourcePath: sourcePath,
              targetPath: targetPath,
              message: "目标文件已存在，已跳过",
            };
          } else {
            // 复制文件
            const copyParams = {
              Bucket: s3Config.bucket_name,
              CopySource: encodeURIComponent(s3Config.bucket_name + "/" + s3SourcePath),
              Key: s3TargetPath,
            };

            const copyCommand = new CopyObjectCommand(copyParams);
            await s3Client.send(copyCommand);

            result = {
              success: true,
              skipped: false,
              sourcePath: sourcePath,
              targetPath: targetPath,
              message: "文件复制成功",
            };
          }
        }

        // 更新目标父目录的修改时间
        const rootPrefix = s3Config.root_prefix ? (s3Config.root_prefix.endsWith("/") ? s3Config.root_prefix : s3Config.root_prefix + "/") : "";
        await updateParentDirectoriesModifiedTime(s3Client, s3Config.bucket_name, s3TargetPath, rootPrefix);

        // 更新最后使用时间
        await updateMountLastUsed(db, mount.id);

        // 清除目标路径所在目录的缓存
        if (targetSubPath !== "/" && targetSubPath.includes("/")) {
          // 清除缓存 - 使用统一的clearCache函数
          await clearCache({ mountId: mount.id });
        }

        return result;
      },
      "复制文件或目录",
      "复制失败"
  );
}

/**
 * 复制目录
 * @param {S3Client} s3Client - S3客户端
 * @param {string} bucketName - 存储桶名称
 * @param {string} sourcePath - 源目录路径
 * @param {string} targetPath - 目标目录路径
 * @param {boolean} skipExisting - 是否跳过已存在的文件
 * @returns {Promise<Object>} 复制结果，包含成功、跳过和失败的计数
 */
async function copyDirectory(s3Client, bucketName, sourcePath, targetPath, skipExisting = true) {
  // 确保源路径和目标路径都以斜杠结尾
  const sourcePrefix = sourcePath.endsWith("/") ? sourcePath : sourcePath + "/";
  const targetPrefix = targetPath.endsWith("/") ? targetPath : targetPath + "/";

  // 统计信息
  const stats = {
    success: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  try {
    // 首先检查目标目录是否存在，不存在则创建
    let targetDirExists = false;
    try {
      targetDirExists = await checkS3ObjectExists(s3Client, bucketName, targetPrefix);
    } catch (error) {
      // 如果是404错误，说明目录不存在，需要创建
      if (error instanceof HTTPException) {
        // 创建目标目录
        const putParams = {
          Bucket: bucketName,
          Key: targetPrefix,
          Body: "",
          ContentType: "application/x-directory",
        };

        try {
          const putCommand = new PutObjectCommand(putParams);
          await s3Client.send(putCommand);
          targetDirExists = true;
          console.log(`已创建目标目录: ${targetPrefix}`);
        } catch (createError) {
          console.error(`创建目标目录失败: ${createError.message}`);
          stats.failed++;
          stats.details.push({
            path: targetPrefix,
            error: `创建目标目录失败: ${createError.message}`,
          });
          return stats;
        }
      } else {
        // 其他错误
        throw error;
      }
    }

    // 列出源目录中的所有内容
    let continuationToken = undefined;

    do {
      // 列出源目录内容
      const listParams = {
        Bucket: bucketName,
        Prefix: sourcePrefix,
        ContinuationToken: continuationToken,
      };

      const listCommand = new ListObjectsV2Command(listParams);
      const listResponse = await s3Client.send(listCommand);

      // 检查是否有内容
      if (listResponse.Contents && listResponse.Contents.length > 0) {
        // 处理每个对象
        for (const item of listResponse.Contents) {
          const sourceKey = item.Key;

          // 跳过目录标记（与前缀完全匹配的对象）
          if (sourceKey === sourcePrefix) {
            continue;
          }

          // 计算目标对象的键
          const relativePath = sourceKey.substring(sourcePrefix.length);
          const targetKey = targetPrefix + relativePath;

          // 检查是否为子目录中的文件
          if (relativePath.includes("/")) {
            // 确保子目录在目标位置存在
            const subDirPart = relativePath.substring(0, relativePath.lastIndexOf("/") + 1);
            const targetSubDirPath = targetPrefix + subDirPart;

            // 检查子目录是否存在，不存在则创建
            try {
              const headSubDirParams = {
                Bucket: bucketName,
                Key: targetSubDirPath,
              };

              const headSubDirCommand = new HeadObjectCommand(headSubDirParams);

              try {
                await s3Client.send(headSubDirCommand);
                // 目录已存在，继续处理
              } catch (subDirError) {
                // 如果是404错误，说明子目录不存在，需要创建
                if (subDirError.$metadata && subDirError.$metadata.httpStatusCode === 404) {
                  // 确保路径有效
                  if (!targetSubDirPath || targetSubDirPath.trim() === "") {
                    console.error(`无效的子目录路径: 空路径`);
                    stats.failed++;
                    stats.details.push({
                      path: sourceKey,
                      error: `无效的子目录路径: 空路径`,
                    });
                    continue; // 跳过这个文件，继续处理其他文件
                  }

                  const putSubDirParams = {
                    Bucket: bucketName,
                    Key: targetSubDirPath,
                    Body: "",
                    ContentType: "application/x-directory",
                  };

                  const putSubDirCommand = new PutObjectCommand(putSubDirParams);
                  await s3Client.send(putSubDirCommand);
                } else {
                  // 其他错误
                  throw subDirError;
                }
              }
            } catch (error) {
              console.error(`处理子目录时出错: ${error.message}`);
              stats.failed++;
              stats.details.push({
                path: targetSubDirPath,
                error: `处理子目录失败: ${error.message}`,
              });
              continue; // 跳过这个文件，继续处理其他文件
            }
          }

          // 检查目标文件是否已存在
          let targetExists = false;
          try {
            const headTargetParams = {
              Bucket: bucketName,
              Key: targetKey,
            };

            const headTargetCommand = new HeadObjectCommand(headTargetParams);
            await s3Client.send(headTargetCommand);
            targetExists = true;
          } catch (error) {
            if (error.$metadata && error.$metadata.httpStatusCode !== 404) {
              throw error;
            }
            // 404错误表示目标不存在，可以继续复制
          }

          // 如果目标已存在且设置为跳过已存在文件，则跳过
          if (targetExists && skipExisting) {
            stats.skipped++;
            stats.details.push({
              source: sourceKey,
              target: targetKey,
              status: "skipped",
              message: "目标文件已存在，已跳过",
            });
            continue;
          }

          // 复制文件
          try {
            const copyParams = {
              Bucket: bucketName,
              CopySource: encodeURIComponent(bucketName + "/" + sourceKey),
              Key: targetKey,
            };

            const copyCommand = new CopyObjectCommand(copyParams);
            await s3Client.send(copyCommand);

            stats.success++;
            stats.details.push({
              source: sourceKey,
              target: targetKey,
              status: "success",
              message: "文件复制成功",
            });
          } catch (copyError) {
            console.error(`复制文件失败: ${copyError.message}`, { source: sourceKey, target: targetKey });
            stats.failed++;
            stats.details.push({
              source: sourceKey,
              target: targetKey,
              status: "failed",
              error: `复制失败: ${copyError.message}`,
            });
          }
        }
      }

      // 更新令牌用于下一次循环
      continuationToken = listResponse.IsTruncated ? listResponse.NextContinuationToken : undefined;
    } while (continuationToken);

    return {
      success: true,
      sourcePath: sourcePath,
      targetPath: targetPath,
      stats: {
        total: stats.success + stats.skipped + stats.failed,
        success: stats.success,
        skipped: stats.skipped,
        failed: stats.failed,
      },
      details: stats.details,
      message: `目录复制完成，成功: ${stats.success}，跳过: ${stats.skipped}，失败: ${stats.failed}`,
    };
  } catch (error) {
    console.error(`复制目录过程中发生错误: ${error.message}`);
    return {
      success: false,
      sourcePath: sourcePath,
      targetPath: targetPath,
      error: error.message,
      stats: {
        total: stats.success + stats.skipped + stats.failed,
        success: stats.success,
        skipped: stats.skipped,
        failed: stats.failed,
      },
      details: stats.details,
      message: `目录复制过程中发生错误: ${error.message}`,
    };
  }
}

/**
 * 批量复制文件或目录
 * @param {D1Database} db - D1数据库实例
 * @param {Array<{sourcePath: string, targetPath: string}>} items - 要复制的项目数组，每项包含源路径和目标路径
 * @param {string|Object} userIdOrInfo - 用户ID（管理员）或API密钥信息对象（API密钥用户）
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {string} encryptionSecret - 加密密钥
 * @param {boolean} skipExisting - 是否跳过已存在的文件，默认为true
 * @returns {Promise<{success: number, skipped: number, failed: Array<{sourcePath: string, targetPath: string, error: string}>}>} 批量复制结果
 */
export async function batchCopyItems(db, items, userIdOrInfo, userType, encryptionSecret, skipExisting = true) {
  // 结果统计
  const result = {
    success: 0,
    skipped: 0,
    failed: [],
    details: [],
    crossStorageResults: [], // 用于存储跨存储复制的预签名URL和元数据
  };

  // 逐个处理每个复制项
  for (const item of items) {
    try {
      // 检查路径是否为空或无效
      if (!item.sourcePath || !item.targetPath) {
        const errorMessage = "源路径或目标路径不能为空";
        console.error(errorMessage, item);
        result.failed.push({
          sourcePath: item.sourcePath || "未指定",
          targetPath: item.targetPath || "未指定",
          error: errorMessage,
        });
        continue;
      }

      // 检查并修正路径格式：如果源路径是目录（以"/"结尾），确保目标路径也是目录格式
      let { sourcePath, targetPath } = item;
      const sourceIsDirectory = sourcePath.endsWith("/");

      // 如果源是目录但目标不是目录格式，自动添加斜杠
      if (sourceIsDirectory && !targetPath.endsWith("/")) {
        targetPath = targetPath + "/";
        console.log(`自动修正目录路径格式: ${item.sourcePath} -> ${targetPath}`);
      }

      const copyResult = await copyItem(db, sourcePath, targetPath, userIdOrInfo, userType, encryptionSecret, skipExisting);

      // 检查是否为跨存储复制结果
      if (copyResult.crossStorage) {
        // 将跨存储复制结果添加到专门的数组中
        result.crossStorageResults.push(copyResult);
        continue; // 跳过后续处理，继续下一个项目
      }

      // 根据复制结果更新统计
      if (copyResult.success) {
        if (copyResult.skipped) {
          result.skipped++;
        } else {
          result.success++;
        }

        // 如果是目录复制，并且有详细统计，则合并统计数据
        if (copyResult.stats) {
          result.success += copyResult.stats.success;
          result.skipped += copyResult.stats.skipped;

          // 合并失败记录
          if (copyResult.stats.failed > 0 && copyResult.details) {
            copyResult.details.forEach((detail) => {
              if (detail.status === "failed") {
                result.failed.push({
                  sourcePath: detail.source,
                  targetPath: detail.target,
                  error: detail.error,
                });
                console.error(`复制子项失败: ${detail.source} -> ${detail.target}, 错误: ${detail.error}`);
              }
            });
          }

          // 添加详细记录
          if (copyResult.details) {
            result.details = result.details.concat(copyResult.details);
          }
        }
      }
    } catch (error) {
      // 记录失败信息
      const errorMessage = error instanceof HTTPException ? error.message : error.message || "未知错误";
      console.error(`复制失败: ${item.sourcePath} -> ${item.targetPath}, 错误: ${errorMessage}`, error);

      result.failed.push({
        sourcePath: item.sourcePath,
        targetPath: item.targetPath,
        error: errorMessage,
      });
    }
  }

  // 如果有跨存储复制结果，添加标志到结果中
  if (result.crossStorageResults.length > 0) {
    result.hasCrossStorageOperations = true;
  }

  return result;
}

/**
 * 处理跨存储复制请求
 * @param {D1Database} db - D1数据库实例
 * @param {string} sourcePath - 源路径
 * @param {string} targetPath - 目标路径
 * @param {string|Object} userIdOrInfo - 用户ID（管理员）或API密钥信息对象（API密钥用户）
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {string} encryptionSecret - 加密密钥
 * @returns {Promise<Object>} 包含预签名URL和元数据的结果
 */
export async function handleCrossStorageCopy(db, sourcePath, targetPath, userIdOrInfo, userType, encryptionSecret) {
  return handleFsError(
      async () => {
        // 检查源路径和目标路径是否相同
        if (sourcePath === targetPath) {
          throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "源路径和目标路径不能相同" });
        }

        // 检查路径类型 (都是文件或都是目录)
        const sourceIsDirectory = sourcePath.endsWith("/");
        let targetIsDirectory = targetPath.endsWith("/");

        // 如果源是目录但目标不是目录格式，自动添加斜杠
        if (sourceIsDirectory && !targetIsDirectory) {
          targetPath = targetPath + "/";
          targetIsDirectory = true;
        }

        // 对于文件复制，确保目标路径也是文件路径格式
        if (!sourceIsDirectory && targetIsDirectory) {
          throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "复制文件时，目标路径不能是目录格式" });
        }

        // 查找源路径的挂载点
        const sourceMountResult = await findMountPointByPath(db, sourcePath, userIdOrInfo, userType);

        // 处理错误情况
        if (sourceMountResult.error) {
          throw new HTTPException(sourceMountResult.error.status, { message: sourceMountResult.error.message });
        }

        // 查找目标路径的挂载点
        const targetMountResult = await findMountPointByPath(db, targetPath, userIdOrInfo, userType);

        // 处理错误情况
        if (targetMountResult.error) {
          throw new HTTPException(targetMountResult.error.status, { message: targetMountResult.error.message });
        }

        // 确认是跨存储操作
        if (sourceMountResult.mount.id === targetMountResult.mount.id) {
          throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "源路径和目标路径在同一存储中，应使用常规复制功能" });
        }

        // 检查源挂载点和目标挂载点的存储类型是否为S3
        if (sourceMountResult.mount.storage_type !== "S3" || targetMountResult.mount.storage_type !== "S3") {
          throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "跨存储复制仅支持S3类型存储" });
        }

        const sourceMount = sourceMountResult.mount;
        const targetMount = targetMountResult.mount;
        const sourceSubPath = sourceMountResult.subPath;
        const targetSubPath = targetMountResult.subPath;

        // 获取源S3配置
        const sourceS3Config = await db.prepare("SELECT * FROM s3_configs WHERE id = ?").bind(sourceMount.storage_config_id).first();
        if (!sourceS3Config) {
          throw new HTTPException(ApiStatus.NOT_FOUND, { message: "源存储配置不存在" });
        }

        // 获取目标S3配置
        const targetS3Config = await db.prepare("SELECT * FROM s3_configs WHERE id = ?").bind(targetMount.storage_config_id).first();
        if (!targetS3Config) {
          throw new HTTPException(ApiStatus.NOT_FOUND, { message: "目标存储配置不存在" });
        }

        // 创建源S3客户端
        const sourceS3Client = await createS3Client(sourceS3Config, encryptionSecret);

        // 规范化S3子路径
        const s3SourcePath = normalizeS3SubPath(sourceSubPath, sourceS3Config, sourceIsDirectory);
        const s3TargetPath = normalizeS3SubPath(targetSubPath, targetS3Config, targetIsDirectory);

        // 检查源路径是否存在
        try {
          const sourceExists = await checkS3ObjectExists(sourceS3Client, sourceS3Config.bucket_name, s3SourcePath);
          if (!sourceExists) {
            // 如果是目录，尝试列出目录内容确认存在性
            if (sourceIsDirectory) {
              const listResponse = await listS3Directory(sourceS3Client, sourceS3Config.bucket_name, s3SourcePath);

              // 如果没有内容，说明目录不存在或为空
              if (!listResponse.Contents || listResponse.Contents.length === 0) {
                throw new HTTPException(ApiStatus.NOT_FOUND, { message: "源路径不存在或为空目录" });
              }
            } else {
              throw new HTTPException(ApiStatus.NOT_FOUND, { message: "源文件不存在" });
            }
          }
        } catch (error) {
          if (error instanceof HTTPException) {
            throw error;
          }
          throw new HTTPException(ApiStatus.INTERNAL_ERROR, { message: "检查源路径存在性失败: " + error.message });
        }

        // 如果是目录复制，需要获取目录中所有文件的预签名URL
        if (sourceIsDirectory) {
          const items = await getDirectoryPresignedUrls(sourceS3Client, sourceS3Config, targetS3Config, s3SourcePath, s3TargetPath, encryptionSecret);

          return {
            crossStorage: true,
            isDirectory: true,
            sourcePath,
            targetPath,
            sourceMount: sourceMount.id,
            targetMount: targetMount.id,
            items,
            message: `跨存储目录复制请求已生成，共 ${items.length} 个文件`,
          };
        } else {
          // 单文件复制
          // 生成源文件的下载预签名URL
          const expiresIn = 3600; // 1小时有效期
          const downloadUrl = await generatePresignedUrl(sourceS3Config, s3SourcePath, encryptionSecret, expiresIn);

          // 提取文件名
          const fileName = sourcePath.split("/").filter(Boolean).pop();

          // 确定目标文件路径
          let targetFilePath;
          if (targetPath.endsWith("/")) {
            targetFilePath = targetPath + fileName;
          } else {
            targetFilePath = targetPath;
          }

          // 提取目标文件名
          const targetFileName = targetFilePath.split("/").filter(Boolean).pop();

          // 构建上传预签名URL的目标S3路径
          let uploadKey = s3TargetPath;
          if (targetIsDirectory) {
            uploadKey = s3TargetPath + fileName;
          }

          // 获取源文件的元数据以确定contentType
          let contentType = "application/octet-stream";
          try {
            const headResponse = await getS3ObjectMetadata(sourceS3Client, sourceS3Config.bucket_name, s3SourcePath);
            if (headResponse) {
              contentType = headResponse.ContentType || contentType;
            }
          } catch (error) {
            console.warn(`获取源文件元数据失败，使用默认content-type: ${error.message}`);
          }

          // 统一从文件名推断MIME类型，不依赖源文件的MIME类型
          contentType = getMimeTypeFromFilename(fileName);
          console.log(`跨存储桶复制：从文件名[${fileName}]推断MIME类型: ${contentType}`);

          // 生成目标文件的上传预签名URL
          const uploadUrl = await generatePresignedPutUrl(targetS3Config, uploadKey, contentType, encryptionSecret, expiresIn);

          return {
            crossStorage: true,
            isDirectory: false,
            sourcePath,
            targetPath: targetFilePath,
            sourceMount: sourceMount.id,
            targetMount: targetMount.id,
            sourceS3Path: s3SourcePath,
            targetS3Path: uploadKey,
            fileName,
            targetFileName,
            contentType,
            downloadUrl,
            uploadUrl,
            message: "已生成跨存储文件复制的预签名URL",
          };
        }
      },
      "跨存储复制",
      "跨存储复制请求处理失败"
  );
}
