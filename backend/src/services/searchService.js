/**
 * 文件搜索服务
 * 提供文件搜索的核心服务逻辑，复用现有的文件系统架构
 */
import { HTTPException } from "hono/http-exception";
import { ApiStatus } from "../constants/index.js";
import { PermissionUtils } from "../utils/permissionUtils.js";
import { createS3Client, listS3Directory } from "../utils/s3Utils.js";
import { normalizeS3SubPath } from "../storage/drivers/s3/utils/S3PathUtils.js";
import { updateMountLastUsed } from "../storage/fs/utils/MountResolver.js";
import { directoryCacheManager } from "../utils/DirectoryCache.js";
import { searchCacheManager } from "../utils/SearchCache.js";
import { getMimeTypeFromFilename } from "../utils/fileUtils.js";

/**
 * 通用错误处理包装函数 - 复用fsService的模式
 * @param {Function} fn - 要执行的异步函数
 * @param {string} operationName - 操作名称，用于错误日志
 * @param {string} defaultErrorMessage - 默认错误消息
 * @returns {Promise<any>} - 函数执行结果
 * @throws {HTTPException} - 统一处理后的HTTP异常
 */
async function handleSearchError(fn, operationName, defaultErrorMessage) {
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
 * 搜索文件
 * @param {D1Database} db - D1数据库实例
 * @param {Object} searchParams - 搜索参数
 * @param {string} searchParams.query - 搜索查询字符串
 * @param {string} searchParams.scope - 搜索范围 ('global', 'mount', 'directory')
 * @param {string} searchParams.mountId - 挂载点ID（当scope为'mount'时）
 * @param {string} searchParams.path - 搜索路径（当scope为'directory'时）
 * @param {number} searchParams.limit - 结果限制数量，默认50
 * @param {number} searchParams.offset - 结果偏移量，默认0
 * @param {string|Object} userIdOrInfo - 用户ID（管理员）或API密钥信息对象（API密钥用户）
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {string} encryptionSecret - 加密密钥
 * @returns {Promise<Object>} 搜索结果对象
 */
export async function searchFiles(db, searchParams, userIdOrInfo, userType, encryptionSecret) {
  return handleSearchError(
    async () => {
      // 参数验证
      const { query, scope = "global", mountId, path, limit = 50, offset = 0 } = searchParams;

      if (!query || query.trim().length < 2) {
        throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "搜索查询至少需要2个字符" });
      }

      // 验证搜索范围
      if (!["global", "mount", "directory"].includes(scope)) {
        throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "无效的搜索范围" });
      }

      // 验证分页参数
      if (limit < 1 || limit > 200) {
        throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "limit参数必须在1-200之间" });
      }

      if (offset < 0) {
        throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "offset参数不能为负数" });
      }

      // 检查搜索缓存
      const cachedResult = searchCacheManager.get(query, searchParams, userType, userIdOrInfo);
      if (cachedResult) {
        console.log(`搜索缓存命中 - 查询: ${query}, 用户类型: ${userType}`);
        return cachedResult;
      }

      // 对于API密钥用户，检查基本路径权限
      if (userType === "apiKey" && scope === "directory" && path) {
        const apiKeyInfo = userIdOrInfo;
        console.log(`检查目录搜索权限: basicPath=${apiKeyInfo.basicPath}, searchPath=${path}`);
        if (!PermissionUtils.checkPathPermission(apiKeyInfo.basicPath, path)) {
          console.log(`权限检查失败: basicPath=${apiKeyInfo.basicPath}, searchPath=${path}`);
          throw new HTTPException(ApiStatus.FORBIDDEN, { message: "没有权限搜索此路径" });
        }
        console.log(`权限检查通过: basicPath=${apiKeyInfo.basicPath}, searchPath=${path}`);
      }

      // 根据用户类型获取可访问的挂载点 - 使用统一的挂载点获取方法
      let accessibleMounts;
      try {
        accessibleMounts = await PermissionUtils.getAccessibleMounts(db, userIdOrInfo, userType);
      } catch (error) {
        throw new HTTPException(ApiStatus.UNAUTHORIZED, { message: "未授权访问" });
      }

      if (!accessibleMounts || accessibleMounts.length === 0) {
        return {
          results: [],
          total: 0,
          hasMore: false,
          searchParams: searchParams,
        };
      }

      // 根据搜索范围过滤挂载点
      let targetMounts = accessibleMounts;
      if ((scope === "mount" || scope === "directory") && mountId) {
        targetMounts = accessibleMounts.filter((mount) => mount.id === mountId);
        if (targetMounts.length === 0) {
          throw new HTTPException(ApiStatus.FORBIDDEN, { message: "没有权限访问指定的挂载点" });
        }
        console.log(`搜索范围限制: ${scope}, 目标挂载点: ${mountId}, 过滤后挂载点数量: ${targetMounts.length}`);
      }

      // 执行并行搜索，设置最大搜索结果限制
      const maxSearchResults = 1000; // 防止过度查询S3
      const searchPromises = targetMounts.map((mount) => searchInMount(db, mount, query, scope, path, encryptionSecret, userType, userIdOrInfo, maxSearchResults));

      const mountResults = await Promise.allSettled(searchPromises);

      // 聚合搜索结果
      const allResults = [];
      for (let i = 0; i < mountResults.length; i++) {
        const result = mountResults[i];
        if (result.status === "fulfilled" && result.value) {
          allResults.push(...result.value);
        } else if (result.status === "rejected") {
          console.warn(`挂载点 ${targetMounts[i].id} 搜索失败:`, result.reason);
        }
      }

      // 排序和分页
      const sortedResults = sortSearchResults(allResults, query);
      const total = sortedResults.length;
      const paginatedResults = sortedResults.slice(offset, offset + limit);

      const searchResult = {
        results: paginatedResults,
        total: total,
        hasMore: offset + limit < total,
        searchParams: searchParams,
        mountsSearched: targetMounts.length,
      };

      // 缓存搜索结果（仅当结果不为空时缓存）
      if (total > 0) {
        searchCacheManager.set(query, searchParams, userType, userIdOrInfo, searchResult, 300); // 5分钟缓存
        console.log(`搜索结果已缓存 - 查询: ${query}, 结果数: ${total}, 用户类型: ${userType}`);
      }

      return searchResult;
    },
    "搜索文件",
    "搜索文件失败"
  );
}

/**
 * 在单个挂载点中搜索文件
 * @param {D1Database} db - D1数据库实例
 * @param {Object} mount - 挂载点对象
 * @param {string} query - 搜索查询
 * @param {string} scope - 搜索范围
 * @param {string} searchPath - 搜索路径
 * @param {string} encryptionSecret - 加密密钥
 * @param {string} userType - 用户类型
 * @param {string|Object} userIdOrInfo - 用户信息
 * @param {number} maxResults - 最大结果数量
 * @returns {Promise<Array>} 搜索结果数组
 */
async function searchInMount(db, mount, query, scope, searchPath, encryptionSecret, userType, userIdOrInfo, maxResults = 1000) {
  try {
    // 获取S3配置
    const s3Config = await db.prepare("SELECT * FROM s3_configs WHERE id = ?").bind(mount.storage_config_id).first();
    if (!s3Config) {
      console.warn(`挂载点 ${mount.id} 的S3配置不存在`);
      return [];
    }

    // 创建S3客户端
    const s3Client = await createS3Client(s3Config, encryptionSecret);

    // 更新挂载点最后使用时间
    await updateMountLastUsed(db, mount.id);

    // 确定搜索前缀
    let searchPrefix = "";
    if (scope === "directory" && searchPath) {
      // 计算相对于挂载点的子路径
      const mountPath = mount.mount_path.replace(/\/+$/, "") || "/";
      const normalizedSearchPath = searchPath.replace(/\/+$/, "") || "/";

      if (normalizedSearchPath.startsWith(mountPath)) {
        const subPath = normalizedSearchPath.substring(mountPath.length) || "/";
        searchPrefix = normalizeS3SubPath(subPath, s3Config, true);
      }
    }

    // 构建完整的S3前缀
    const rootPrefix = s3Config.root_prefix ? (s3Config.root_prefix.endsWith("/") ? s3Config.root_prefix : s3Config.root_prefix + "/") : "";
    let fullPrefix = rootPrefix;
    if (searchPrefix && searchPrefix !== "/") {
      fullPrefix += searchPrefix;
    }

    // 递归搜索S3对象
    const results = await recursiveS3Search(s3Client, s3Config.bucket_name, fullPrefix, query, mount, undefined, maxResults);

    return results;
  } catch (error) {
    console.error(`挂载点 ${mount.id} 搜索失败:`, error);
    return [];
  }
}

/**
 * 递归搜索S3对象
 * @param {S3Client} s3Client - S3客户端
 * @param {string} bucketName - 存储桶名称
 * @param {string} prefix - 搜索前缀
 * @param {string} query - 搜索查询
 * @param {Object} mount - 挂载点对象
 * @param {string} continuationToken - 分页令牌
 * @param {number} maxResults - 最大结果数量
 * @returns {Promise<Array>} 搜索结果数组
 */
async function recursiveS3Search(s3Client, bucketName, prefix, query, mount, continuationToken = undefined, maxResults = 1000) {
  const results = [];
  const maxKeys = 1000; // 每次查询的最大对象数

  try {
    // 使用空字符串作为delimiter来获取所有对象（包括子目录中的文件）
    const listResponse = await listS3Directory(s3Client, bucketName, prefix, "", continuationToken);

    if (listResponse.Contents) {
      for (const item of listResponse.Contents) {
        // 检查是否已达到最大结果数量
        if (results.length >= maxResults) {
          break;
        }

        // 检查文件名是否匹配搜索查询
        if (matchesSearchQuery(item.Key, query)) {
          // 构建结果对象
          const result = buildSearchResult(item, mount, prefix);
          results.push(result);
        }
      }
    }

    // 如果有更多结果且未达到最大数量限制，继续递归搜索
    if (listResponse.IsTruncated && listResponse.NextContinuationToken && results.length < maxResults) {
      const remainingResults = maxResults - results.length;
      const moreResults = await recursiveS3Search(s3Client, bucketName, prefix, query, mount, listResponse.NextContinuationToken, remainingResults);
      results.push(...moreResults);
    }

    return results;
  } catch (error) {
    console.error(`S3搜索失败 - Bucket: ${bucketName}, Prefix: ${prefix}:`, error);
    return results; // 返回已找到的结果，不抛出错误
  }
}

/**
 * 检查文件名是否匹配搜索查询
 * @param {string} key - S3对象键
 * @param {string} query - 搜索查询
 * @returns {boolean} 是否匹配
 */
function matchesSearchQuery(key, query) {
  const fileName = key.split("/").pop() || "";
  const normalizedQuery = query.toLowerCase();
  const normalizedFileName = fileName.toLowerCase();

  // 支持模糊匹配
  return normalizedFileName.includes(normalizedQuery);
}

/**
 * 构建搜索结果对象
 * @param {Object} item - S3对象
 * @param {Object} mount - 挂载点对象
 * @param {string} prefix - 搜索前缀
 * @returns {Object} 搜索结果对象
 */
function buildSearchResult(item, mount, prefix) {
  const fileName = item.Key.split("/").pop() || "";

  // 计算相对于S3根前缀的路径
  let relativePath = item.Key;
  if (prefix && prefix !== "" && item.Key.startsWith(prefix)) {
    relativePath = item.Key.substring(prefix.length);
  }

  // 确保相对路径以/开头
  if (relativePath && !relativePath.startsWith("/")) {
    relativePath = "/" + relativePath;
  }

  // 构建完整的挂载路径
  const mountPath = mount.mount_path.replace(/\/+$/, "") || "/";
  const fullPath = mountPath + (relativePath || "/" + fileName);

  return {
    name: fileName,
    path: fullPath.replace(/\/+/g, "/"), // 规范化路径
    size: item.Size,
    modified: item.LastModified,
    isDirectory: false,
    contentType: getMimeTypeFromFilename(fileName),
    mount_id: mount.id,
    mount_name: mount.name,
    storage_type: mount.storage_type,
    s3_key: item.Key,
  };
}

/**
 * 排序搜索结果
 * @param {Array} results - 搜索结果数组
 * @param {string} query - 搜索查询
 * @returns {Array} 排序后的结果数组
 */
function sortSearchResults(results, query) {
  return results.sort((a, b) => {
    // 优先级1: 文件名完全匹配
    const aExactMatch = a.name.toLowerCase() === query.toLowerCase();
    const bExactMatch = b.name.toLowerCase() === query.toLowerCase();
    if (aExactMatch && !bExactMatch) return -1;
    if (!aExactMatch && bExactMatch) return 1;

    // 优先级2: 文件名开头匹配
    const aStartsMatch = a.name.toLowerCase().startsWith(query.toLowerCase());
    const bStartsMatch = b.name.toLowerCase().startsWith(query.toLowerCase());
    if (aStartsMatch && !bStartsMatch) return -1;
    if (!aStartsMatch && bStartsMatch) return 1;

    // 优先级3: 修改时间（最新的在前）
    return new Date(b.modified) - new Date(a.modified);
  });
}
