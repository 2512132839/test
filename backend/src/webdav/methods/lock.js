/**
 * 处理WebDAV LOCK请求--------------------未实现！！
 * 提供基本的资源锁定功能，主要用于提高Windows客户端兼容性
 */
import { createWebDAVErrorResponse } from "../utils/errorUtils.js";
import { findMountPointByPath, normalizeS3SubPath, updateMountLastUsed } from "../utils/webdavUtils.js";
import { clearCacheAfterWebDAVOperation } from "../utils/cacheUtils.js";
import { v4 as uuidv4 } from "uuid";

/**
 * 处理LOCK请求
 * @param {Object} c - Hono上下文
 * @param {string} path - 请求路径
 * @param {string} userId - 用户ID
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {D1Database} db - D1数据库实例
 */
export async function handleLock(c, path, userId, userType, db) {
  try {
    // 获取用户代理判断是否为Windows客户端
    const userAgent = c.req.header("User-Agent") || "";
    const isWindowsClient = userAgent.includes("Microsoft") || userAgent.includes("Windows");

    // 记录锁定请求信息
    console.log(`WebDAV LOCK请求: 路径 ${path}, 用户类型: ${userType}, 客户端: ${isWindowsClient ? "Windows" : "其他"}`);

    // 使用统一函数查找挂载点
    const mountResult = await findMountPointByPath(db, path, userId, userType);

    // 处理错误情况
    if (mountResult.error) {
      return new Response(mountResult.error.message, {
        status: mountResult.error.status,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const { mount, subPath } = mountResult;

    // 获取挂载点对应的S3配置
    const s3Config = await db.prepare("SELECT * FROM s3_configs WHERE id = ?").bind(mount.storage_config_id).first();

    if (!s3Config) {
      return new Response("存储配置不存在", { status: 404 });
    }

    // 判断是文件还是目录
    const isDirectory = path.endsWith("/");

    // 规范化S3子路径
    const s3SubPath = normalizeS3SubPath(subPath, s3Config, isDirectory);

    // 生成一个唯一的锁定令牌
    const lockToken = `opaquelocktoken:${uuidv4()}`;

    // 获取请求中的超时设置
    const timeoutHeader = c.req.header("Timeout") || "Second-3600";
    const timeoutValue = timeoutHeader.includes("Second-") ? parseInt(timeoutHeader.split("Second-")[1]) || 3600 : 3600; // 默认锁定1小时

    // 如果将来要实际存储锁定信息，这里需要添加代码
    // 目前只是生成锁定响应

    // 清理缓存 - 即使当前并未实际修改文件，还是清理缓存以保持一致性
    // 注意：实际锁定不会修改文件内容，所以这里清理缓存主要是为了代码一致性
    await clearCacheAfterWebDAVOperation(db, s3SubPath, s3Config, isDirectory);

    // 更新挂载点的最后使用时间
    await updateMountLastUsed(db, mount.id);

    // 构建锁定响应XML
    const lockResponse = `<?xml version="1.0" encoding="utf-8"?>
<D:prop xmlns:D="DAV:">
  <D:lockdiscovery>
    <D:activelock>
      <D:locktype><D:write/></D:locktype>
      <D:lockscope><D:exclusive/></D:lockscope>
      <D:depth>0</D:depth>
      <D:owner>
        <D:href>${userType === "admin" ? "admin-user" : "api-key-user"}</D:href>
      </D:owner>
      <D:timeout>Second-${timeoutValue}</D:timeout>
      <D:locktoken>
        <D:href>${lockToken}</D:href>
      </D:locktoken>
      <D:lockroot>
        <D:href>/dav${path}</D:href>
      </D:lockroot>
    </D:activelock>
  </D:lockdiscovery>
</D:prop>`;

    // 返回锁定响应
    return new Response(lockResponse, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Lock-Token": `<${lockToken}>`,
        // 添加Windows WebDAV客户端可能需要的额外头部
        ...(isWindowsClient ? { "MS-Author-Via": "DAV" } : {}),
      },
    });
  } catch (error) {
    console.error("WebDAV LOCK处理错误:", error);
    return createWebDAVErrorResponse("处理锁定请求时出错", 500);
  }
}
