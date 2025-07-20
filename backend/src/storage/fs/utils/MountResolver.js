/**
 * 挂载点解析工具
 * 提供通用的挂载点查找和路径解析功能
 * 从webdavUtils.js迁移而来
 */

import { PermissionUtils } from "../../../utils/permissionUtils.js";

/**
 * 根据请求路径查找对应的挂载点和子路径
 * @param {D1Database} db - D1数据库实例
 * @param {string} path - 请求路径
 * @param {string|Object} userIdOrInfo - 用户ID（管理员）或API密钥信息对象（API密钥用户）
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {string} permissionType - 权限检查类型 (navigation, read, operation)
 * @returns {Promise<Object>} 包含挂载点、子路径和错误信息的对象
 */
export async function findMountPointByPath(db, path, userIdOrInfo, userType, permissionType = "read") {
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

  // 对于API密钥用户，检查路径权限
  if (userType === "apiKey" && typeof userIdOrInfo === "object" && userIdOrInfo.basicPath) {
    // 根据权限类型选择合适的权限检查函数
    let hasPermission = false;
    if (permissionType === "navigation") {
      hasPermission = PermissionUtils.checkPathPermissionForNavigation(userIdOrInfo.basicPath, path);
    } else if (permissionType === "operation") {
      hasPermission = PermissionUtils.checkPathPermissionForOperation(userIdOrInfo.basicPath, path);
    } else {
      // 默认使用严格的读取权限检查
      hasPermission = PermissionUtils.checkPathPermission(userIdOrInfo.basicPath, path);
    }

    if (!hasPermission) {
      return {
        error: {
          status: 403,
          message: "没有权限访问此路径",
        },
      };
    }
  }

  // 获取挂载点列表 - 使用统一的挂载点获取方法
  let mounts;
  try {
    mounts = await PermissionUtils.getAccessibleMounts(db, userIdOrInfo, userType);
  } catch (error) {
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
 * 根据API密钥信息查找对应的挂载点和子路径（基于基本路径权限）
 * @param {D1Database} db - D1数据库实例
 * @param {string} path - 请求路径
 * @param {Object} apiKeyInfo - API密钥信息对象
 * @returns {Promise<Object>} 包含挂载点、子路径和错误信息的对象
 */
export async function findMountPointByPathWithApiKey(db, path, apiKeyInfo) {
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

  // 检查API密钥是否有权限访问此路径
  if (!PermissionUtils.checkPathPermission(apiKeyInfo.basicPath, path)) {
    return {
      error: {
        status: 403,
        message: "没有权限访问此路径",
      },
    };
  }

  // 获取API密钥可访问的挂载点
  const mounts = await PermissionUtils.getAccessibleMounts(db, apiKeyInfo, "apiKey");

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
