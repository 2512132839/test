/**
 * WebDAV工具函数
 */
import { getMountsByAdmin, getMountsByApiKey } from "../../services/storageMountService.js";
import { HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

/**
 * 根据请求路径查找对应的挂载点和子路径
 * @param {D1Database} db - D1数据库实例
 * @param {string} path - 请求路径
 * @param {string} userId - 用户ID
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @returns {Promise<Object>} 包含挂载点、子路径和错误信息的对象
 */
export async function findMountPointByPath(db, path, userId, userType) {
  // 规范化路径
  path = path.startsWith("/") ? path : "/" + path;

  // 处理根路径
  if (path === "/" || path === "//") {
    return {
      isRoot: true,
      error: {
        status: 403,
        message: "无法操作根目录",
      },
    };
  }

  // 获取挂载点列表
  let mounts;
  if (userType === "admin") {
    mounts = await getMountsByAdmin(db, userId);
  } else if (userType === "apiKey") {
    mounts = await getMountsByApiKey(db, userId);
  } else {
    return {
      error: {
        status: 401,
        message: "未授权访问",
      },
    };
  }

  // 按照路径长度降序排序，以便优先匹配最长的路径
  mounts.sort((a, b) => b.mount_path.length - a.mount_path.length);

  // 查找匹配的挂载点
  for (const mount of mounts) {
    const mountPath = mount.mount_path.startsWith("/") ? mount.mount_path : "/" + mount.mount_path;

    // 如果请求路径完全匹配挂载点或者是挂载点的子路径
    if (path === mountPath || path === mountPath + "/" || path.startsWith(mountPath + "/")) {
      let subPath = path.substring(mountPath.length);
      if (!subPath.startsWith("/")) {
        subPath = "/" + subPath;
      }

      return {
        mount,
        subPath,
        mountPath,
      };
    }
  }

  // 未找到匹配的挂载点
  return {
    error: {
      status: 404,
      message: "挂载点不存在",
    },
  };
}

/**
 * 规范化S3子路径
 * @param {string} subPath - 子路径
 * @param {Object} s3Config - S3配置
 * @param {boolean} asDirectory - 是否作为目录处理
 * @returns {string} 规范化的S3子路径
 */
export function normalizeS3SubPath(subPath, s3Config, asDirectory = false) {
  // 规范化S3子路径，移除开头的斜杠
  let s3SubPath = subPath.startsWith("/") ? subPath.substring(1) : subPath;

  // 如果路径为空，设置为根路径
  if (!s3SubPath) {
    s3SubPath = "";
  }

  // 规范化S3子路径，移除多余的斜杠
  s3SubPath = s3SubPath.replace(/\/+/g, "/");

  // 如果作为目录处理，确保路径以斜杠结尾
  if (asDirectory && s3SubPath !== "" && !s3SubPath.endsWith("/")) {
    s3SubPath += "/";
  }

  // 注意：root_prefix在调用时单独处理，避免重复添加
  // 在getS3DirectoryListing中会将s3SubPath与root_prefix组合

  return s3SubPath;
}

/**
 * 解析目标路径
 * @param {string} destination - 目标路径头
 * @returns {string|null} 规范化的目标路径或null（如果无效）
 */
export function parseDestinationPath(destination) {
  if (!destination) {
    return null;
  }

  let destPath;
  try {
    // 尝试从完整URL中提取路径
    const url = new URL(destination);
    destPath = url.pathname;
  } catch (error) {
    // 如果不是完整URL，直接使用值作为路径
    destPath = destination;
  }

  // 处理WebDAV路径前缀
  if (destPath.startsWith("/dav/")) {
    destPath = destPath.substring(4); // 移除"/dav"前缀
  } else if (destPath.startsWith("/dav")) {
    destPath = destPath.substring(4); // 移除"/dav"前缀
  }

  // 规范化目标路径
  destPath = destPath.startsWith("/") ? destPath : "/" + destPath;

  // 路径安全检查 - 移除任何路径遍历尝试
  // 将多个斜杠替换为单个斜杠
  destPath = destPath.replace(/\/+/g, "/");

  // 增强安全性: 检查危险字符
  if (/[<>:"|?*\\\x00-\x1F]/.test(destPath)) {
    console.warn(`WebDAV安全警告: 目标路径包含非法字符: ${destPath.replace(/[<>:"|?*\\\x00-\x1F]/g, "?")}`);
    return null;
  }

  // 解析并重建路径，移除 ".." 和 "." 部分
  const parts = [];
  for (const part of destPath.split("/")) {
    if (part === "..") {
      // 防止路径遍历，忽略 ".."
      continue;
    } else if (part === "." || part === "") {
      // 忽略 "." 和空部分，但保留第一个空部分（根路径前的空字符串）
      if (parts.length === 0) {
        parts.push("");
      }
      continue;
    } else {
      parts.push(part);
    }
  }

  // 重建安全路径
  let safePath = parts.join("/");
  if (!safePath.startsWith("/")) {
    safePath = "/" + safePath;
  }

  return safePath;
}

/**
 * 更新挂载点的最后使用时间
 * @param {D1Database} db - D1数据库实例
 * @param {string} mountId - 挂载点ID
 */
export async function updateMountLastUsed(db, mountId) {
  try {
    await db.prepare("UPDATE storage_mounts SET last_used = CURRENT_TIMESTAMP WHERE id = ?").bind(mountId).run();
  } catch (error) {
    // 更新失败不中断主流程，但减少日志详细程度，避免冗余
    console.warn(`挂载点最后使用时间更新失败: ${mountId}`);
  }
}

/**
 * 检查S3目录是否存在
 * @param {S3Client} s3Client - S3客户端
 * @param {string} bucketName - 存储桶名称
 * @param {string} dirPath - 目录路径
 * @returns {Promise<boolean>} 目录是否存在
 */
export async function checkDirectoryExists(s3Client, bucketName, dirPath) {
  // 确保目录路径以斜杠结尾
  const normalizedPath = dirPath.endsWith("/") ? dirPath : dirPath + "/";

  try {
    // 首先尝试作为显式目录对象检查
    try {
      const headParams = {
        Bucket: bucketName,
        Key: normalizedPath,
      };

      const headCommand = new HeadObjectCommand(headParams);
      await s3Client.send(headCommand);
      return true; // 如果存在显式目录对象，直接返回true
    } catch (headError) {
      // 显式目录对象不存在，继续检查隐式目录
      if (headError.$metadata && headError.$metadata.httpStatusCode === 404) {
        // 尝试列出以该路径为前缀的对象
        const listParams = {
          Bucket: bucketName,
          Prefix: normalizedPath,
          MaxKeys: 1, // 只需要一个对象即可确认目录存在
        };

        const listCommand = new ListObjectsV2Command(listParams);
        const listResponse = await s3Client.send(listCommand);

        // 如果有对象以该路径为前缀，则认为目录存在
        return listResponse.Contents && listResponse.Contents.length > 0;
      } else {
        // 其他错误则抛出
        throw headError;
      }
    }
  } catch (error) {
    // 如果是最终的404错误，表示目录不存在
    if (error.$metadata && error.$metadata.httpStatusCode === 404) {
      return false;
    }
    // 其他错误则抛出
    throw error;
  }
}
