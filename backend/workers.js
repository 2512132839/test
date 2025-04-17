import app from "./src/index.js";
import { ApiStatus } from "./src/constants/index.js";
import { handleFileDownload } from "./src/routes/fileViewRoutes.js";
import { checkAndInitDatabase } from "./src/utils/database.js";

// WebDAV 支持的 HTTP 方法常量定义
const WEBDAV_METHODS = ["GET", "HEAD", "PUT", "POST", "DELETE", "OPTIONS", "PROPFIND", "PROPPATCH", "MKCOL", "COPY", "MOVE", "LOCK", "UNLOCK"];

// 记录数据库是否已初始化的内存标识
let isDbInitialized = false;

/**
 * 从请求中获取客户端IP地址
 * 按优先级检查各种可能的请求头
 * @param {Request} request - 请求对象
 * @returns {string} - 客户端IP地址
 */
function getClientIp(request) {
  // 获取请求头中的IP信息，按优先级检查
  const headers = request.headers;
  const ip =
      headers.get("cf-connecting-ip") || // Cloudflare特有
      headers.get("x-real-ip") || // 常用代理头
      headers.get("x-forwarded-for") || // 标准代理头
      headers.get("true-client-ip") || // Akamai等CDN
      "0.0.0.0"; // 未知IP的默认值

  // 如果x-forwarded-for包含多个IP，提取第一个（客户端原始IP）
  if (ip && ip.includes(",")) {
    return ip.split(",")[0].trim();
  }

  return ip;
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

      // 增强的WebDAV请求处理
      if (pathParts.length >= 2 && pathParts[1] === "dav") {
        // 获取客户端IP，用于认证缓存
        const clientIp = getClientIp(request);
        console.log(`WebDAV请求在Workers环境中: ${request.method} ${url.pathname}, 客户端IP: ${clientIp}`);

        // 创建响应头对象
        const responseHeaders = new Headers();

        // 添加WebDAV特定的响应头
        responseHeaders.set("Allow", WEBDAV_METHODS.join(","));
        responseHeaders.set("DAV", "1,2");
        responseHeaders.set("MS-Author-Via", "DAV");

        // CORS相关响应头
        responseHeaders.set("Access-Control-Allow-Methods", WEBDAV_METHODS.join(","));
        responseHeaders.set("Access-Control-Allow-Origin", "*");
        responseHeaders.set(
            "Access-Control-Allow-Headers",
            "Authorization, Content-Type, Depth, If-Match, If-Modified-Since, If-None-Match, Lock-Token, Timeout, X-Requested-With"
        );
        responseHeaders.set("Access-Control-Expose-Headers", "ETag, Content-Type, Content-Length, Last-Modified");
        responseHeaders.set("Access-Control-Max-Age", "86400"); // 24小时

        // 对OPTIONS请求直接响应
        if (request.method === "OPTIONS") {
          return new Response(null, {
            status: 204,
            headers: responseHeaders,
          });
        }

        // 为其他WebDAV请求添加IP信息以支持认证缓存
        // 创建带有客户端IP信息的新请求对象
        const requestWithIP = new Request(request, {
          headers: (() => {
            const headers = new Headers(request.headers);
            headers.set("X-Client-IP", clientIp);
            return headers;
          })(),
        });

        // 将请求转发到app处理，同时传递额外的上下文（包含客户端IP）
        const ctxWithIP = {
          ...ctx,
          clientIp: clientIp,
          userAgent: request.headers.get("user-agent") || "",
        };

        const response = await app.fetch(requestWithIP, bindings, ctxWithIP);

        // 为响应添加WebDAV响应头
        const newResponse = new Response(response.body, response);

        // 只添加还没有的响应头
        for (const [key, value] of responseHeaders.entries()) {
          if (!newResponse.headers.has(key)) {
            newResponse.headers.set(key, value);
          }
        }

        return newResponse;
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
