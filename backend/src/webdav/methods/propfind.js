/**
 * 处理WebDAV PROPFIND请求
 * 用于获取文件和目录信息（列表）
 */
import { getMountsByAdmin, getMountsByApiKey, getMountByIdForAdmin, getMountByIdForApiKey } from "../../services/storageMountService.js";
import { createS3Client } from "../../utils/s3Utils.js";
import { S3Client, ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";

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

    // 构建响应
    return await buildPropfindResponse(c, s3Client, s3Config.bucket_name, s3SubPath, depth, path);
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

  // 构建XML响应
  let xmlBody = `<?xml version="1.0" encoding="utf-8"?>
  <D:multistatus xmlns:D="DAV:">
    <D:response>
      <D:href>/dav${path}</D:href>
      <D:propstat>
        <D:prop>
          <D:resourcetype><D:collection/></D:resourcetype>
          <D:displayname>${displayName}</D:displayname>
          <D:getlastmodified>${new Date().toUTCString()}</D:getlastmodified>
        </D:prop>
        <D:status>HTTP/1.1 200 OK</D:status>
      </D:propstat>
    </D:response>`;

  // 添加子目录
  for (const dir of structure.directories) {
    const dirPath = path + dir + "/";
    const encodedPath = encodeURI(dirPath);
    xmlBody += `
    <D:response>
      <D:href>/dav${encodedPath}</D:href>
      <D:propstat>
        <D:prop>
          <D:resourcetype><D:collection/></D:resourcetype>
          <D:displayname>${dir}</D:displayname>
          <D:getlastmodified>${new Date().toUTCString()}</D:getlastmodified>
        </D:prop>
        <D:status>HTTP/1.1 200 OK</D:status>
      </D:propstat>
    </D:response>`;
  }

  // 添加当前路径下的挂载点
  for (const mount of structure.mounts) {
    // 获取挂载点的显示名称，优先使用挂载点名称，如果没有则使用路径的最后一部分
    const mountName = mount.name || mount.mount_path.split("/").filter(Boolean).pop() || mount.id;
    const mountPath = mount.mount_path.startsWith("/") ? mount.mount_path : "/" + mount.mount_path;
    const encodedPath = encodeURI(mountPath + "/");

    // 检查该挂载点是否已经作为子目录显示
    const relativePath = mountPath.substring(path.length);

    // 如果挂载点直接在当前路径下，显示它
    if (!relativePath.includes("/") || relativePath === "") {
      xmlBody += `
      <D:response>
        <D:href>/dav${encodedPath}</D:href>
        <D:propstat>
          <D:prop>
            <D:resourcetype><D:collection/></D:resourcetype>
            <D:displayname>${mountName}</D:displayname>
            <D:getlastmodified>${new Date(mount.updated_at || mount.created_at).toUTCString()}</D:getlastmodified>
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
 */
async function buildPropfindResponse(c, s3Client, bucketName, prefix, depth, requestPath) {
  // 确保路径以斜杠结尾
  if (!prefix.endsWith("/") && prefix !== "") {
    prefix += "/";
  }

  // 删除开头的斜杠
  if (prefix.startsWith("/")) {
    prefix = prefix.substring(1);
  }

  try {
    // 先尝试以当前路径为目录列出内容
    const listParams = {
      Bucket: bucketName,
      Prefix: prefix,
      Delimiter: "/",
    };

    const listCommand = new ListObjectsV2Command(listParams);
    const listResponse = await s3Client.send(listCommand);

    // 构建XML响应
    let xmlBody = `<?xml version="1.0" encoding="utf-8"?>
    <D:multistatus xmlns:D="DAV:">
      <D:response>
        <D:href>/dav${requestPath}</D:href>
        <D:propstat>
          <D:prop>
            <D:resourcetype><D:collection/></D:resourcetype>
            <D:displayname>${requestPath.split("/").filter(Boolean).pop() || "/"}</D:displayname>
            <D:getlastmodified>${new Date().toUTCString()}</D:getlastmodified>
          </D:prop>
          <D:status>HTTP/1.1 200 OK</D:status>
        </D:propstat>
      </D:response>`;

    // 如果深度不是0，则加入子项
    if (depth !== "0") {
      // 处理目录（CommonPrefixes）
      if (listResponse.CommonPrefixes) {
        for (const item of listResponse.CommonPrefixes) {
          const folderName = item.Prefix.split("/").filter(Boolean).pop();
          const folderPath = `/dav${requestPath}${folderName}/`;

          xmlBody += `
    <D:response>
      <D:href>${folderPath}</D:href>
      <D:propstat>
        <D:prop>
          <D:resourcetype><D:collection/></D:resourcetype>
          <D:displayname>${folderName}</D:displayname>
          <D:getlastmodified>${new Date().toUTCString()}</D:getlastmodified>
        </D:prop>
        <D:status>HTTP/1.1 200 OK</D:status>
      </D:propstat>
    </D:response>`;
        }
      }

      // 处理文件（Contents）
      if (listResponse.Contents) {
        for (const item of listResponse.Contents) {
          // 跳过当前目录本身
          if (item.Key === prefix) continue;

          // 跳过以斜杠结尾的项（目录）
          if (item.Key.endsWith("/")) continue;

          const fileName = item.Key.split("/").pop();
          const filePath = `/dav${requestPath}${fileName}`;

          xmlBody += `
    <D:response>
      <D:href>${filePath}</D:href>
      <D:propstat>
        <D:prop>
          <D:resourcetype></D:resourcetype>
          <D:displayname>${fileName}</D:displayname>
          <D:getlastmodified>${new Date(item.LastModified).toUTCString()}</D:getlastmodified>
          <D:getcontentlength>${item.Size}</D:getcontentlength>
          <D:getcontenttype>application/octet-stream</D:getcontenttype>
        </D:prop>
        <D:status>HTTP/1.1 200 OK</D:status>
      </D:propstat>
    </D:response>`;
        }
      }
    }

    xmlBody += `</D:multistatus>`;

    return new Response(xmlBody, {
      status: 207, // Multi-Status
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("构建PROPFIND响应错误:", error);
    return new Response("Internal Server Error: " + error.message, { status: 500 });
  }
}
