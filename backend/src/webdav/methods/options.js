/**
 * 处理WebDAV OPTIONS请求
 * 返回支持的WebDAV方法和头信息
 */
export async function handleOptions(c) {
  // 支持的方法列表 - 备选LOCK和UNLOCK方法，Windows客户端可能需要
  const allowedMethods = ["OPTIONS", "PROPFIND", "GET", "HEAD", "PUT", "DELETE", "MKCOL", "MOVE", "COPY", "LOCK", "UNLOCK"].join(", ");

  // 获取用户代理判断是否为Windows客户端
  const userAgent = c.req.header("User-Agent") || "";
  const isWindowsClient = userAgent.includes("Microsoft") || userAgent.includes("Windows");

  // 支持的WebDAV功能和公共头
  const davHeaders = {
    Allow: allowedMethods,
    DAV: "1, 2, 3", // 支持WebDAV Class 1, 2和3
    "MS-Author-Via": "DAV", // 为Windows客户端添加支持
    "Content-Length": "0",
    "Content-Type": "text/plain",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache, no-store",
    Pragma: "no-cache",
    // Windows特定头
    "X-Content-Type-Options": "nosniff", // 防止MIME类型嗅探
    Public: allowedMethods, // 一些客户端使用Public代替Allow
    // 安全性头
    "X-Frame-Options": "DENY",
    // 允许跨域请求，提高兼容性
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": allowedMethods,
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, Depth, Destination, If-Match, If-Modified-Since, If-None-Match, If-Range, If-Unmodified-Since, Lock-Token, Overwrite, Timeout, X-Requested-With",
    // 告知客户端服务器支持的认证类型
    "WWW-Authenticate": 'Basic realm="WebDAV", Bearer realm="WebDAV"',
    // Windows WebDAV特定扩展
    "Microsoft-Server-WebDAV-Extensions": "1",
  };

  // 添加Windows特定Sharepoint兼容头，提高某些操作的兼容性
  if (isWindowsClient) {
    davHeaders["X-MSDAVEXT"] = "1";
    davHeaders["Translate"] = "f"; // 特别是对文件操作很重要
  }

  // 获取请求URL，如果是根路径"/dav"请求，返回状态码200
  const url = new URL(c.req.url);
  const path = decodeURIComponent(url.pathname);

  // 对"/dav"（没有尾部斜杠）的OPTIONS请求特殊处理
  if (path === "/dav") {
    return new Response(null, {
      status: 200, // 使用200而不是204，一些Windows客户端对204响应处理不好
      headers: davHeaders,
    });
  }

  // 对其他OPTIONS请求返回200 OK
  return new Response(null, {
    status: 200,
    headers: davHeaders,
  });
}
