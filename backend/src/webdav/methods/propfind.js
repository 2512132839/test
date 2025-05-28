import { getMountsByAdmin, getMountsByApiKey, getMountByIdForAdmin, getMountByIdForApiKey } from "../../services/storageMountService.js";
import { createS3Client } from "../../utils/s3Utils.js";
import { S3Client, ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getMimeType } from "../../utils/fileUtils.js";

// 添加配置常量，用于控制分页行为
const ABSOLUTE_MAX_ITEMS = 10000; // 绝对最大项目数，防止过度消耗资源
const DEFAULT_PAGE_SIZE = 500; // 每页项目数

/**
 * 转义XML特殊字符，确保生成有效的XML
 * @param {string} text - 需要转义的文本
 * @returns {string} 转义后的文本
 */
function escapeXmlChars(text) {
  if (typeof text !== "string") return "";
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/**
 * 对URI路径进行编码，确保WebDAV客户端能正确解析
 * 这个函数特别处理了WebDAV客户端可能不兼容的字符
 * @param {string} path - 需要编码的URI路径
 * @returns {string} 编码后的URI路径
 */
function encodeUriPath(path) {
  if (typeof path !== "string") return "";

  // 将路径分割成段，单独编码每一段，然后重新组合
  // 这样可以保留路径分隔符"/"
  return path
      .split("/")
      .map((segment) => {
        // 对每个段进行URL编码，但保留某些合法的URI字符
        return encodeURIComponent(segment)
            .replace(/%20/g, "%20") // 保留空格的编码
            .replace(/'/g, "%27") // 单引号编码
            .replace(/\(/g, "%28") // 左括号编码
            .replace(/\)/g, "%29") // 右括号编码
            .replace(/\*/g, "%2A") // 星号编码
            .replace(/%2F/g, "/"); // 恢复被错误编码的斜杠
      })
      .join("/");
}

/**
 * 从挂载路径列表中获取指定路径下的目录结构
 * @param {Array} mounts - 挂载点列表
 * @param {string} currentPath - 当前路径，以/开头且以/结尾
 * @returns {Object} 包含子目录和挂载点的对象
 */
function getDirectoryStructure(mounts, currentPath) {
  // 确保currentPath以/开头且以/结尾
  currentPath = currentPath.startsWith("/") ? currentPath : "/" + currentPath;
  currentPath = currentPath.endsWith("/") ? currentPath : currentPath + "/";

  // 目录结构结果
  const result = {
    directories: new Set(), // 存储子目录名称
    mounts: [], // 存储当前路径下的挂载点
  };

  // 遍历所有挂载点
  for (const mount of mounts) {
    let mountPath = mount.mount_path;

    // 确保挂载路径以/开头
    mountPath = mountPath.startsWith("/") ? mountPath : "/" + mountPath;

    // 如果挂载路径正好等于当前路径，将其添加到挂载点列表
    if (mountPath + "/" === currentPath || mountPath === currentPath) {
      result.mounts.push(mount);
      continue;
    }

    // 检查挂载路径是否在当前路径下
    if (mountPath.startsWith(currentPath)) {
      // 提取相对路径
      const relativePath = mountPath.substring(currentPath.length);
      // 获取第一级目录
      const firstDir = relativePath.split("/")[0];
      if (firstDir) {
        result.directories.add(firstDir);
      }
      continue;
    }

    // 检查当前路径是否是挂载路径的父级路径
    // 例如: 当前路径是 /private/，挂载点路径是 /private/test2/
    if (currentPath !== "/" && mountPath.startsWith(currentPath)) {
      const relativePath = mountPath.substring(currentPath.length);
      const firstDir = relativePath.split("/")[0];
      if (firstDir) {
        result.directories.add(firstDir);
      }
    }
  }

  return {
    directories: Array.from(result.directories),
    mounts: result.mounts,
  };
}

/**
 * 处理PROPFIND请求
 * @param {Object} c - Hono上下文
 * @param {string} path - 请求路径
 * @param {string} userId - 用户ID
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {D1Database} db - D1数据库实例
 */
export async function handlePropfind(c, path, userId, userType, db) {
  // 获取请求头中的Depth (默认为infinity)
  const depth = c.req.header("Depth") || "infinity";
  if (depth !== "0" && depth !== "1" && depth !== "infinity") {
    return new Response("Bad Request: Invalid Depth Header", { status: 400 });
  }

  // 获取客户端请求的最大项目数（如果有）
  let maxItems = parseInt(c.req.header("X-Max-Items") || "0", 10);
  if (isNaN(maxItems) || maxItems <= 0) {
    // 如果未指定或无效，使用默认值
    maxItems = ABSOLUTE_MAX_ITEMS;
  } else {
    // 确保不超过绝对最大值
    maxItems = Math.min(maxItems, ABSOLUTE_MAX_ITEMS);
  }

  try {
    // 规范化路径
    path = path.startsWith("/") ? path : "/" + path;
    path = path.endsWith("/") ? path : path + "/";

    // 获取挂载点列表
    let mounts;
    if (userType === "admin") {
      mounts = await getMountsByAdmin(db, userId);
    } else if (userType === "apiKey") {
      mounts = await getMountsByApiKey(db, userId);
    } else {
      return new Response("Unauthorized", { status: 401 });
    }

    // 如果是根路径或者是虚拟目录路径，则返回虚拟目录列表
    let isVirtualPath = true;
    let matchingMount = null;
    let subPath = "";

    // 按照路径长度降序排序，以便优先匹配最长的路径
    mounts.sort((a, b) => b.mount_path.length - a.mount_path.length);

    // 检查是否匹配到实际的挂载点
    for (const mount of mounts) {
      const mountPath = mount.mount_path.startsWith("/") ? mount.mount_path : "/" + mount.mount_path;

      // 如果请求路径完全匹配挂载点或者是挂载点的子路径
      if (path === mountPath + "/" || path.startsWith(mountPath + "/")) {
        matchingMount = mount;
        subPath = path.substring(mountPath.length);
        if (!subPath.startsWith("/")) {
          subPath = "/" + subPath;
        }
        isVirtualPath = false;
        break;
      }
    }

    // 处理虚拟目录路径 (根目录或中间目录)
    if (isVirtualPath) {
      return await respondWithMounts(c, userId, userType, db, path);
    }

    // 处理实际挂载点路径
    // 获取挂载点对应的S3配置
    const s3Config = await db.prepare("SELECT * FROM s3_configs WHERE id = ?").bind(matchingMount.storage_config_id).first();

    if (!s3Config) {
      return new Response("Storage Configuration Not Found", { status: 404 });
    }

    // 创建S3客户端
    const s3Client = await createS3Client(s3Config, c.env.ENCRYPTION_SECRET);

    // 规范化S3子路径
    let s3SubPath = subPath.startsWith("/") ? subPath.substring(1) : subPath;

    // 如果有默认文件夹，添加到路径
    if (s3Config.default_folder) {
      let defaultFolder = s3Config.default_folder;
      if (!defaultFolder.endsWith("/")) defaultFolder += "/";
      s3SubPath = defaultFolder + s3SubPath;
    }

    // 规范化S3子路径，移除多余的斜杠
    s3SubPath = s3SubPath.replace(/\/+/g, "/");

    // 更新最后使用时间
    try {
      await db.prepare("UPDATE storage_mounts SET last_used = CURRENT_TIMESTAMP WHERE id = ?").bind(matchingMount.id).run();
    } catch (updateError) {
      // 更新失败不中断主流程
      console.warn("更新存储挂载点最后使用时间失败:", updateError);
    }

    // 构建响应，传递最大项目数限制
    return await buildPropfindResponse(c, s3Client, s3Config.bucket_name, s3SubPath, depth, path, maxItems);
  } catch (error) {
    console.error("PROPFIND处理错误:", error);
    return new Response("Internal Server Error: " + error.message, { status: 500 });
  }
}

/**
 * 响应挂载点列表
 * @param {Object} c - Hono上下文
 * @param {string} userId - 用户ID
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {D1Database} db - D1数据库实例
 * @param {string} path - 当前路径
 */
async function respondWithMounts(c, userId, userType, db, path = "/") {
  let mounts;
  if (userType === "admin") {
    mounts = await getMountsByAdmin(db, userId);
  } else if (userType === "apiKey") {
    mounts = await getMountsByApiKey(db, userId);
  } else {
    return new Response("Unauthorized", { status: 401 });
  }

  // 规范化路径
  path = path.startsWith("/") ? path : "/" + path;
  path = path.endsWith("/") ? path : path + "/";

  // 获取当前路径下的目录结构
  const structure = getDirectoryStructure(mounts, path);

  // 获取当前目录的显示名称
  const pathParts = path.split("/").filter(Boolean);
  const displayName = path === "/" ? "/" : pathParts.length > 0 ? pathParts[pathParts.length - 1] : "/";

  // 转义显示名称中的XML特殊字符
  const escapedDisplayName = escapeXmlChars(displayName);

  // 编码路径
  const encodedPath = encodeUriPath(path);

  // 获取当前时间，用于lastmodified和creationdate
  const currentDate = new Date();
  const currentDateStr = currentDate.toUTCString();
  const isoDateStr = currentDate.toISOString();

  // 构建XML响应
  let xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
  <D:multistatus xmlns:D="DAV:">
    <D:response>
      <D:href>/dav${encodedPath}</D:href>
      <D:propstat>
        <D:prop>
          <D:resourcetype><D:collection/></D:resourcetype>
          <D:displayname>${escapedDisplayName}</D:displayname>
          <D:getlastmodified>${currentDateStr}</D:getlastmodified>
          <D:creationdate>${isoDateStr}</D:creationdate>
          <D:getetag>"${Date.now().toString(16)}-${Math.random().toString(16).substring(2, 10)}"</D:getetag>
          <D:supportedlock>
            <D:lockentry>
              <D:lockscope><D:exclusive/></D:lockscope>
              <D:locktype><D:write/></D:locktype>
            </D:lockentry>
          </D:supportedlock>
        </D:prop>
        <D:status>HTTP/1.1 200 OK</D:status>
      </D:propstat>
    </D:response>`;

  // 添加子目录
  for (const dir of structure.directories) {
    // 转义目录名中的XML特殊字符
    const escapedDirName = escapeXmlChars(dir);

    // 构建并编码目录路径
    const dirPath = path + dir + "/";
    const encodedDirPath = encodeUriPath(dirPath);

    // 为目录生成唯一的ETag
    const dirEtag = `"dir-${Date.now().toString(16)}-${Math.random().toString(16).substring(2, 10)}"`;

    xmlBody += `
    <D:response>
      <D:href>/dav${encodedDirPath}</D:href>
      <D:propstat>
        <D:prop>
          <D:resourcetype><D:collection/></D:resourcetype>
          <D:displayname>${escapedDirName}</D:displayname>
          <D:getlastmodified>${currentDateStr}</D:getlastmodified>
          <D:creationdate>${isoDateStr}</D:creationdate>
          <D:getetag>${dirEtag}</D:getetag>
          <D:supportedlock>
            <D:lockentry>
              <D:lockscope><D:exclusive/></D:lockscope>
              <D:locktype><D:write/></D:locktype>
            </D:lockentry>
          </D:supportedlock>
        </D:prop>
        <D:status>HTTP/1.1 200 OK</D:status>
      </D:propstat>
    </D:response>`;
  }

  // 添加当前路径下的挂载点
  for (const mount of structure.mounts) {
    // 获取挂载点的显示名称，优先使用挂载点名称，如果没有则使用路径的最后一部分
    const mountName = mount.name || mount.mount_path.split("/").filter(Boolean).pop() || mount.id;

    // 转义挂载点名称中的XML特殊字符
    const escapedMountName = escapeXmlChars(mountName);

    const mountPath = mount.mount_path.startsWith("/") ? mount.mount_path : "/" + mount.mount_path;

    // 编码挂载点路径
    const encodedMountPath = encodeUriPath(mountPath + "/");

    // 检查该挂载点是否已经作为子目录显示
    const relativePath = mountPath.substring(path.length);

    // 获取挂载点的修改时间和创建时间
    const mountModified = new Date(mount.updated_at || mount.created_at).toUTCString();
    const mountCreated = new Date(mount.created_at).toISOString();

    // 为挂载点生成唯一的ETag
    const mountEtag = `"mount-${mount.id}-${Date.now().toString(16)}"`;

    // 如果挂载点直接在当前路径下，显示它
    if (!relativePath.includes("/") || relativePath === "") {
      xmlBody += `
      <D:response>
        <D:href>/dav${encodedMountPath}</D:href>
        <D:propstat>
          <D:prop>
            <D:resourcetype><D:collection/></D:resourcetype>
            <D:displayname>${escapedMountName}</D:displayname>
            <D:getlastmodified>${mountModified}</D:getlastmodified>
            <D:creationdate>${mountCreated}</D:creationdate>
            <D:getetag>${mountEtag}</D:getetag>
            <D:supportedlock>
              <D:lockentry>
                <D:lockscope><D:exclusive/></D:lockscope>
                <D:locktype><D:write/></D:locktype>
              </D:lockentry>
            </D:supportedlock>
          </D:prop>
          <D:status>HTTP/1.1 200 OK</D:status>
        </D:propstat>
      </D:response>`;
    }
  }

  xmlBody += `</D:multistatus>`;

  return new Response(xmlBody, {
    status: 207, // Multi-Status
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}

/**
 * 构建PROPFIND响应
 * @param {Object} c - Hono上下文
 * @param {S3Client} s3Client - S3客户端
 * @param {string} bucketName - 存储桶名称
 * @param {string} prefix - S3前缀
 * @param {string} depth - 深度
 * @param {string} requestPath - 请求路径
 * @param {number} maxItems - 最大项目数
 */
async function buildPropfindResponse(c, s3Client, bucketName, prefix, depth, requestPath, maxItems = ABSOLUTE_MAX_ITEMS) {
  // 确保路径以斜杠结尾
  if (!prefix.endsWith("/") && prefix !== "") {
    prefix += "/";
  }

  // 删除开头的斜杠
  if (prefix.startsWith("/")) {
    prefix = prefix.substring(1);
  }

  // 初始化计数器变量
  let itemCount = 0;

  try {
    // 先尝试以当前路径为目录列出内容
    const listParams = {
      Bucket: bucketName,
      Prefix: prefix,
      Delimiter: "/",
      MaxKeys: DEFAULT_PAGE_SIZE, // 使用较小的页面大小，提高响应速度
    };

    const listCommand = new ListObjectsV2Command(listParams);
    const listResponse = await s3Client.send(listCommand);

    // 获取当前目录的显示名称
    const displayName = requestPath.split("/").filter(Boolean).pop() || "/";
    // 转义显示名称中的XML特殊字符
    const escapedDisplayName = escapeXmlChars(displayName);
    // 正确编码请求路径
    const encodedRequestPath = encodeUriPath(requestPath);

    // 获取当前时间，用于lastmodified和creationdate
    const currentDate = new Date();
    const currentDateStr = currentDate.toUTCString();
    const isoDateStr = currentDate.toISOString();

    // 为当前目录生成唯一的ETag
    const dirEtag = `"dir-${Date.now().toString(16)}-${Math.random().toString(16).substring(2, 10)}"`;

    // 构建XML响应
    let xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
    <D:multistatus xmlns:D="DAV:">
      <D:response>
        <D:href>/dav${encodedRequestPath}</D:href>
        <D:propstat>
          <D:prop>
            <D:resourcetype><D:collection/></D:resourcetype>
            <D:displayname>${escapedDisplayName}</D:displayname>
            <D:getlastmodified>${currentDateStr}</D:getlastmodified>
            <D:creationdate>${isoDateStr}</D:creationdate>
            <D:getetag>${dirEtag}</D:getetag>
            <D:supportedlock>
              <D:lockentry>
                <D:lockscope><D:exclusive/></D:lockscope>
                <D:locktype><D:write/></D:locktype>
              </D:lockentry>
            </D:supportedlock>
          </D:prop>
          <D:status>HTTP/1.1 200 OK</D:status>
        </D:propstat>
      </D:response>`;

    // 如果深度不是0，则加入子项
    if (depth !== "0") {
      // 跟踪已处理的项目数
      let truncated = false;

      // 处理目录（CommonPrefixes）
      if (listResponse.CommonPrefixes) {
        for (const item of listResponse.CommonPrefixes) {
          // 检查是否达到最大项目数
          if (itemCount >= maxItems) {
            truncated = true;
            break;
          }

          const folderName = item.Prefix.split("/").filter(Boolean).pop();
          if (!folderName) continue; // 跳过空文件夹名

          // 转义文件夹名中的XML特殊字符
          const escapedFolderName = escapeXmlChars(folderName);
          // 构建并编码文件夹路径
          const folderPath = `${requestPath}${folderName}/`;
          const encodedFolderPath = encodeUriPath(folderPath);

          // 为子目录生成唯一的ETag
          const subDirEtag = `"dir-${folderName}-${Date.now().toString(16)}"`;

          xmlBody += `
    <D:response>
      <D:href>/dav${encodedFolderPath}</D:href>
      <D:propstat>
        <D:prop>
          <D:resourcetype><D:collection/></D:resourcetype>
          <D:displayname>${escapedFolderName}</D:displayname>
          <D:getlastmodified>${currentDateStr}</D:getlastmodified>
          <D:creationdate>${isoDateStr}</D:creationdate>
          <D:getetag>${subDirEtag}</D:getetag>
          <D:supportedlock>
            <D:lockentry>
              <D:lockscope><D:exclusive/></D:lockscope>
              <D:locktype><D:write/></D:locktype>
            </D:lockentry>
          </D:supportedlock>
        </D:prop>
        <D:status>HTTP/1.1 200 OK</D:status>
      </D:propstat>
    </D:response>`;

          itemCount++;
        }
      }

      // 处理文件（Contents）
      if (listResponse.Contents && !truncated) {
        for (const item of listResponse.Contents) {
          // 检查是否达到最大项目数
          if (itemCount >= maxItems) {
            truncated = true;
            break;
          }

          // 跳过当前目录本身
          if (item.Key === prefix) continue;

          // 跳过以斜杠结尾的项（目录）
          if (item.Key.endsWith("/")) continue;

          const fileName = item.Key.split("/").pop();
          if (!fileName) continue; // 跳过空文件名

          // 转义文件名中的XML特殊字符
          const escapedFileName = escapeXmlChars(fileName);
          // 构建并编码文件路径
          const filePath = `${requestPath}${fileName}`;
          const encodedFilePath = encodeUriPath(filePath);

          // 获取文件的MIME类型
          const contentType = getMimeType(fileName);

          // 获取文件的修改时间和创建时间
          const fileModified = new Date(item.LastModified).toUTCString();
          const fileCreated = new Date(item.LastModified).toISOString();

          // 为文件生成ETag，使用S3提供的ETag或生成一个
          const fileEtag = item.ETag || `"file-${fileName}-${Date.now().toString(16)}"`;

          xmlBody += `
    <D:response>
      <D:href>/dav${encodedFilePath}</D:href>
      <D:propstat>
        <D:prop>
          <D:resourcetype></D:resourcetype>
          <D:displayname>${escapedFileName}</D:displayname>
          <D:getlastmodified>${fileModified}</D:getlastmodified>
          <D:creationdate>${fileCreated}</D:creationdate>
          <D:getcontentlength>${item.Size}</D:getcontentlength>
          <D:getcontenttype>${contentType}</D:getcontenttype>
          <D:getetag>${fileEtag}</D:getetag>
          <D:supportedlock>
            <D:lockentry>
              <D:lockscope><D:exclusive/></D:lockscope>
              <D:locktype><D:write/></D:locktype>
            </D:lockentry>
          </D:supportedlock>
        </D:prop>
        <D:status>HTTP/1.1 200 OK</D:status>
      </D:propstat>
    </D:response>`;

          itemCount++;
        }
      }

      // 处理分页 - 如果有更多结果且未达到最大项目数，继续获取
      if (listResponse.IsTruncated && listResponse.NextContinuationToken && !truncated) {
        // 迭代方式获取下一页结果
        let nextToken = listResponse.NextContinuationToken;
        let pageCount = 1; // 跟踪已处理的页数

        while (nextToken && !truncated) {
          // 记录当前页码，用于日志和调试
          console.log(`PROPFIND分页: 处理第${pageCount + 1}页，当前项目数: ${itemCount}`);

          const nextParams = {
            ...listParams,
            ContinuationToken: nextToken,
          };

          const nextCommand = new ListObjectsV2Command(nextParams);
          const nextResponse = await s3Client.send(nextCommand);

          // 处理额外的目录
          if (nextResponse.CommonPrefixes) {
            for (const item of nextResponse.CommonPrefixes) {
              // 检查是否达到最大项目数
              if (itemCount >= maxItems) {
                truncated = true;
                break;
              }

              const folderName = item.Prefix.split("/").filter(Boolean).pop();
              if (!folderName) continue;

              const escapedFolderName = escapeXmlChars(folderName);
              const folderPath = `${requestPath}${folderName}/`;
              const encodedFolderPath = encodeUriPath(folderPath);

              // 为子目录生成唯一的ETag
              const subDirEtag = `"dir-${folderName}-${Date.now().toString(16)}"`;

              xmlBody += `
    <D:response>
      <D:href>/dav${encodedFolderPath}</D:href>
      <D:propstat>
        <D:prop>
          <D:resourcetype><D:collection/></D:resourcetype>
          <D:displayname>${escapedFolderName}</D:displayname>
          <D:getlastmodified>${currentDateStr}</D:getlastmodified>
          <D:creationdate>${isoDateStr}</D:creationdate>
          <D:getetag>${subDirEtag}</D:getetag>
          <D:supportedlock>
            <D:lockentry>
              <D:lockscope><D:exclusive/></D:lockscope>
              <D:locktype><D:write/></D:locktype>
            </D:lockentry>
          </D:supportedlock>
        </D:prop>
        <D:status>HTTP/1.1 200 OK</D:status>
      </D:propstat>
    </D:response>`;

              itemCount++;
            }
          }

          // 如果已达到最大项目数，中断循环
          if (truncated) break;

          // 处理额外的文件
          if (nextResponse.Contents) {
            for (const item of nextResponse.Contents) {
              // 检查是否达到最大项目数
              if (itemCount >= maxItems) {
                truncated = true;
                break;
              }

              if (item.Key === prefix || item.Key.endsWith("/")) continue;

              const fileName = item.Key.split("/").pop();
              if (!fileName) continue;

              const escapedFileName = escapeXmlChars(fileName);
              const filePath = `${requestPath}${fileName}`;
              const encodedFilePath = encodeUriPath(filePath);

              // 获取文件的MIME类型
              const contentType = getMimeType(fileName);

              // 获取文件的修改时间和创建时间
              const fileModified = new Date(item.LastModified).toUTCString();
              const fileCreated = new Date(item.LastModified).toISOString();

              // 为文件生成ETag，使用S3提供的ETag或生成一个
              const fileEtag = item.ETag || `"file-${fileName}-${Date.now().toString(16)}"`;

              xmlBody += `
    <D:response>
      <D:href>/dav${encodedFilePath}</D:href>
      <D:propstat>
        <D:prop>
          <D:resourcetype></D:resourcetype>
          <D:displayname>${escapedFileName}</D:displayname>
          <D:getlastmodified>${fileModified}</D:getlastmodified>
          <D:creationdate>${fileCreated}</D:creationdate>
          <D:getcontentlength>${item.Size}</D:getcontentlength>
          <D:getcontenttype>${contentType}</D:getcontenttype>
          <D:getetag>${fileEtag}</D:getetag>
          <D:supportedlock>
            <D:lockentry>
              <D:lockscope><D:exclusive/></D:lockscope>
              <D:locktype><D:write/></D:locktype>
            </D:lockentry>
          </D:supportedlock>
        </D:prop>
        <D:status>HTTP/1.1 200 OK</D:status>
      </D:propstat>
    </D:response>`;

              itemCount++;
            }
          }

          // 检查是否还有更多结果
          if (nextResponse.IsTruncated && nextResponse.NextContinuationToken) {
            nextToken = nextResponse.NextContinuationToken;
            pageCount++;

            // 安全检查：限制最大页数，防止无限循环
            if (pageCount >= 100) {
              // 100页 * 500项/页 = 最多50,000项
              console.warn(`PROPFIND分页: 达到最大页数限制(${pageCount})，截断结果`);
              truncated = true;
              break;
            }
          } else {
            nextToken = null; // 结束循环
          }
        }
      }

      // 如果结果被截断，添加一个特殊的响应项，表示还有更多结果
      if (truncated) {
        console.log(`PROPFIND结果被截断: 达到最大项目数限制(${maxItems})`);

        xmlBody += `
    <D:response>
      <D:href>/dav${encodedRequestPath}?truncated=true</D:href>
      <D:propstat>
        <D:prop>
          <D:resourcetype><D:collection/></D:resourcetype>
          <D:displayname>...</D:displayname>
          <D:getlastmodified>${currentDateStr}</D:getlastmodified>
          <D:creationdate>${isoDateStr}</D:creationdate>
          <D:getetag>"truncated-${Date.now().toString(16)}"</D:getetag>
          <D:truncated>true</D:truncated>
        </D:prop>
        <D:status>HTTP/1.1 200 OK</D:status>
      </D:propstat>
    </D:response>`;
      }
    }

    xmlBody += `</D:multistatus>`;

    // 添加额外的响应头，指示是否有分页和项目数量
    const responseHeaders = {
      "Content-Type": "application/xml; charset=utf-8",
      "X-WebDAV-Item-Count": String(typeof itemCount !== "undefined" ? itemCount : 0),
    };

    return new Response(xmlBody, {
      status: 207, // Multi-Status
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("构建PROPFIND响应错误:", error);
    return new Response("Internal Server Error: " + error.message, { status: 500 });
  }
}
