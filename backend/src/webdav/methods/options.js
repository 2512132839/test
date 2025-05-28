/**
 * 处理WebDAV OPTIONS请求
 * 返回支持的WebDAV方法和头信息
 */
export async function handleOptions(c) {
  // 检查是否支持锁定功能
  const hasLockSupport = true; // 如果实现了完整的锁定功能，设置为true

  // 检查是否支持属性修改功能
  const hasPropPatchSupport = false; // 如果完全实现了PROPPATCH功能，设置为true

  // 根据实际支持的功能动态生成支持的方法列表
  const supportedMethods = ["OPTIONS", "PROPFIND", "GET", "HEAD", "PUT", "DELETE", "MKCOL", "MOVE", "COPY"];

  // 如果支持锁定功能，添加LOCK和UNLOCK方法
  if (hasLockSupport) {
    supportedMethods.push("LOCK", "UNLOCK");
  }

  // 如果支持属性修改功能，添加PROPPATCH方法
  if (hasPropPatchSupport) {
    supportedMethods.push("PROPPATCH");
  }

  // 将方法列表转换为逗号分隔的字符串
  const allowedMethods = supportedMethods.join(", ");

  // 获取用户代理判断是否为Windows客户端
  const userAgent = c.req.header("User-Agent") || "";
  const isWindowsClient = userAgent.includes("Microsoft") || userAgent.includes("Windows");
  const isMacClient = userAgent.includes("Darwin") || userAgent.includes("Mac");

  // 确定实际支持的WebDAV级别
  // Class 1: 基本WebDAV (RFC 2518)
  // Class 2: 锁定支持 (RFC 2518)
  // Class 3: 高级属性支持 (RFC 4918)
  let davLevel = "1";
  if (hasLockSupport) {
    davLevel += ", 2";
  }
  if (hasPropPatchSupport) {
    davLevel += ", 3";
  }

  // 支持的WebDAV功能和公共头
  const davHeaders = {
    Allow: allowedMethods,
    DAV: davLevel,
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
  };

  // 添加条件请求支持头
  davHeaders["Allow-Ranges"] = "bytes";
  davHeaders["Allow-Conditional"] = "true";

  // 添加Windows特定Sharepoint兼容头，提高某些操作的兼容性
  if (isWindowsClient) {
    davHeaders["X-MSDAVEXT"] = "1";
    davHeaders["Translate"] = "f"; // 特别是对文件操作很重要
    davHeaders["Microsoft-Server-WebDAV-Extensions"] = "1";

    // 为Windows资源管理器添加特定头
    if (userAgent.includes("Microsoft-WebDAV-MiniRedir") || userAgent.includes("Explorer")) {
      davHeaders["MS-Author-Via"] = "DAV";
      davHeaders["X-MSEdge-Ref"] = "Ref A";
    }
  }

  // 为Mac客户端添加特定头
  if (isMacClient) {
    davHeaders["X-Apple-WebDAV-Interoperability"] = "true";
  }

  // 获取请求URL，如果是根路径"/dav"请求，返回状态码200
  const url = new URL(c.req.url);
  const path = decodeURIComponent(url.pathname);

  // 记录OPTIONS请求
  console.log(`WebDAV OPTIONS请求: ${path}, 用户代理: ${userAgent.substring(0, 50)}${userAgent.length > 50 ? "..." : ""}`);
  console.log(`WebDAV OPTIONS响应: DAV级别=${davLevel}, 支持的方法=${allowedMethods}`);

  // 对"/dav"（没有尾部斜杠）的OPTIONS请求特殊处理
  if (path === "/dav") {
    return new Response(null, {
      status: 200,
      headers: davHeaders,
    });
  }

  // 对其他OPTIONS请求返回200 OK
  return new Response(null, {
    status: 200,
    headers: davHeaders,
  });
}
