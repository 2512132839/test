/**
 * 处理WebDAV PROPPATCH请求---------------未实现！！
 * 用于修改资源属性
 */
import { createWebDAVErrorResponse } from "../utils/errorUtils.js";
import { findMountPointByPath, normalizeS3SubPath, updateMountLastUsed } from "../utils/webdavUtils.js";
import { clearCacheAfterWebDAVOperation } from "../utils/cacheUtils.js";

/**
 * 处理PROPPATCH请求
 * @param {Object} c - Hono上下文
 * @param {string} path - 请求路径
 * @param {string} userId - 用户ID
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {D1Database} db - D1数据库实例
 */
export async function handleProppatch(c, path, userId, userType, db) {
  try {
    // 记录PROPPATCH请求信息
    console.log(`WebDAV PROPPATCH请求: 路径 ${path}, 用户类型: ${userType}`);

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

    // 获取请求体
    let requestBody;
    try {
      requestBody = await c.req.text();
      console.log("PROPPATCH请求体:", requestBody.substring(0, 200) + (requestBody.length > 200 ? "..." : ""));
    } catch (error) {
      console.error("解析PROPPATCH请求体时出错:", error);
      return createWebDAVErrorResponse("无法解析请求体", 400);
    }

    // 这里我们不实际修改任何属性，只返回成功响应
    // 在完整实现中，应解析XML请求体，识别要修改的属性，并实际进行修改

    // 清理缓存 - 即使当前并未实际修改属性，也添加缓存清理以保持一致性
    await clearCacheAfterWebDAVOperation(db, s3SubPath, s3Config, isDirectory);

    // 更新挂载点的最后使用时间
    await updateMountLastUsed(db, mount.id);

    // 构建响应XML - 表示所有属性设置成功
    const proppatchResponse = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/dav${path}</D:href>
    <D:propstat>
      <D:prop/>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;

    // 返回多状态响应
    return new Response(proppatchResponse, {
      status: 207, // Multi-Status
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("WebDAV PROPPATCH处理错误:", error);
    return createWebDAVErrorResponse("处理属性修改请求时出错", 500);
  }
}
