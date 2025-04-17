/**
 * 处理WebDAV UNLOCK请求-----------未实现！！
 * 配合LOCK方法，提供基本的资源解锁功能
 */
import { createWebDAVErrorResponse } from "../utils/errorUtils.js";

/**
 * 处理UNLOCK请求
 * @param {Object} c - Hono上下文
 * @param {string} path - 请求路径
 * @param {string} userId - 用户ID
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {D1Database} db - D1数据库实例
 */
export async function handleUnlock(c, path, userId, userType, db) {
  try {
    // 获取用户代理判断是否为Windows客户端
    const userAgent = c.req.header("User-Agent") || "";
    const isWindowsClient = userAgent.includes("Microsoft") || userAgent.includes("Windows");

    // 获取锁定令牌
    const lockTokenHeader = c.req.header("Lock-Token");

    // 记录解锁请求信息
    console.log(`WebDAV UNLOCK请求: 路径 ${path}, 用户类型: ${userType}, 令牌: ${lockTokenHeader || "无"}`);

    // 如果没有提供锁定令牌，返回错误
    if (!lockTokenHeader) {
      return createWebDAVErrorResponse("解锁请求必须包含Lock-Token头", 400);
    }

    // 这里实际上我们不需要验证令牌是否正确，
    // 因为我们没有实际保存锁定状态。
    // 在实际生产环境中，应该检查锁定令牌是否有效。

    // 返回成功响应
    return new Response(null, {
      status: 204, // No Content
      headers: {
        // 添加Windows WebDAV客户端可能需要的额外头部
        ...(isWindowsClient ? { "MS-Author-Via": "DAV" } : {}),
      },
    });
  } catch (error) {
    console.error("WebDAV UNLOCK处理错误:", error);
    return createWebDAVErrorResponse("处理解锁请求时出错", 500);
  }
}
