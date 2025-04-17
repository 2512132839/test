import app from "./src/index.js";
import { ApiStatus } from "./src/constants/index.js";
import { handleFileDownload } from "./src/routes/fileViewRoutes.js";
import { checkAndInitDatabase } from "./src/utils/database.js";

// WebDAV支持的HTTP方法定义
const WEBDAV_METHODS = ["GET", "HEAD", "PUT", "POST", "DELETE", "OPTIONS", "PROPFIND", "PROPPATCH", "MKCOL", "COPY", "MOVE", "LOCK", "UNLOCK"];

// 记录数据库是否已初始化的内存标识
let isDbInitialized = false;

/**
 * 从请求中提取客户端IP地址
 * 支持多种代理头，确保与WebDAV认证缓存兼容
 * @param {Request} request - 请求对象
 * @returns {string} 客户端IP地址
 */
function getClientIp(request) {
  // 优先使用Cloudflare特有的头
  const cfConnectingIp = request.headers.get("CF-Connecting-IP");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // 其次尝试X-Forwarded-For
  const forwardedFor = request.headers.get("X-Forwarded-For");
  if (forwardedFor) {
    // 取第一个IP（最接近客户端）
    return forwardedFor.split(",")[0].trim();
  }

  // 最后尝试从Request对象中获取（可能受限于Workers环境）
  return request.headers.get("True-Client-IP") || "unknown";
}

// 导出Cloudflare Workers请求处理函数
export default {
  async fetch(request, env, ctx) {
    try {
      // 创建一个新的环境对象，将D1数据库连接添加到环境中
      const bindings = {
        ...env,
        DB: env.DB, // D1数据库
      };

      // 只在第一次请求时检查并初始化数据库
      if (!isDbInitialized) {
        console.log("首次请求，检查数据库状态...");
        isDbInitialized = true; // 先设置标记，避免并发请求重复初始化
        try {
          await checkAndInitDatabase(env.DB);
        } catch (error) {
          console.error("数据库初始化出错:", error);
          // 即使初始化出错，我们也继续处理请求
        }
      }

      // 检查是否是直接文件下载请求
      const url = new URL(request.url);
      const pathParts = url.pathname.split("/");

      // 提取客户端IP和用户代理，用于WebDAV认证缓存
      const clientIp = getClientIp(request);
      const userAgent = request.headers.get("User-Agent") || "";

      // 对于所有OPTIONS请求的通用处理
      if (request.method === "OPTIONS") {
        // WebDAV路径的OPTIONS请求有特殊处理
        if (pathParts.length >= 2 && pathParts[1] === "dav") {
          return new Response(null, {
            status: 204,
            headers: {
              "Access-Control-Allow-Methods": WEBDAV_METHODS.join(","),
              "Access-Control-Allow-Headers": "Authorization, Content-Type, Depth, If-Match, If-Modified-Since, If-None-Match, Lock-Token, Timeout, X-Requested-With",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Max-Age": "86400",
              Allow: WEBDAV_METHODS.join(","),
              DAV: "1,2",
              "MS-Author-Via": "DAV",
            },
          });
        }

        // 一般API路径的OPTIONS请求
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Methods": "GET, HEAD, PUT, POST, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Requested-With",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Max-Age": "86400",
          },
        });
      }

      // 添加WebDAV请求处理的调试日志
      if (pathParts.length >= 2 && pathParts[1] === "dav") {
        console.log(`WebDAV请求在Workers环境中: ${request.method} ${url.pathname}`);

        // 记录WebDAV认证相关信息，用于问题排查
        const hasAuthHeader = request.headers.has("Authorization");
        console.log(`WebDAV请求认证状态: ${hasAuthHeader ? "有认证头" : "无认证头"}, 客户端IP: ${clientIp}, UA: ${userAgent.substring(0, 30)}...`);

        // 为WebDAV请求创建增强版Request对象，添加客户端信息
        const enhancedRequest = new Request(request);
        // 使用自定义属性保存客户端信息，让downstream handlers可以访问
        enhancedRequest.clientIp = clientIp;
        enhancedRequest.userAgent = userAgent;

        // 使用增强的请求对象继续处理
        return app.fetch(enhancedRequest, bindings, ctx);
      }

      // 处理API路径下的文件下载请求 /api/file-download/:slug
      if (pathParts.length >= 4 && pathParts[1] === "api" && pathParts[2] === "file-download") {
        const slug = pathParts[3];
        return await handleFileDownload(slug, env, request, true); // 强制下载
      }

      // 处理API路径下的文件预览请求 /api/file-view/:slug
      if (pathParts.length >= 4 && pathParts[1] === "api" && pathParts[2] === "file-view") {
        const slug = pathParts[3];
        return await handleFileDownload(slug, env, request, false); // 预览
      }

      // 处理原始文本内容请求 /api/raw/:slug
      if (pathParts.length >= 4 && pathParts[1] === "api" && pathParts[2] === "raw") {
        // 将请求转发到API应用，它会路由到userPasteRoutes中的/api/raw/:slug处理器
        return app.fetch(request, bindings, ctx);
      }

      // 处理其他API请求
      return app.fetch(request, bindings, ctx);
    } catch (error) {
      console.error("处理请求时发生错误:", error);

      // 兼容前端期望的错误格式
      return new Response(
          JSON.stringify({
            code: ApiStatus.INTERNAL_ERROR,
            message: "服务器内部错误",
            error: error.message,
            success: false,
            data: null,
          }),
          {
            status: ApiStatus.INTERNAL_ERROR,
            headers: { "Content-Type": "application/json" },
          }
      );
    }
  },
};
