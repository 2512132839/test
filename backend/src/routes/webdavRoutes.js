/**
 * WebDAV路由定义
 */
import { Hono } from "hono";
import { webdavAuthMiddleware, handleWebDAV } from "../webdav/index.js";
import { ApiStatus } from "../constants/index.js";
import { createErrorResponse } from "../utils/common.js";

// 创建WebDAV路由处理程序
const webdavRoutes = new Hono();

// WebDAV认证中间件应用到所有WebDAV路径
webdavRoutes.use("/dav", webdavAuthMiddleware);
webdavRoutes.use("/dav/*", webdavAuthMiddleware);

// 明确定义各种WebDAV方法的处理函数，避免使用all通配符
const webdavMethods = ["GET", "PUT", "DELETE", "OPTIONS", "PROPFIND", "PROPPATCH", "MKCOL", "COPY", "MOVE", "LOCK", "UNLOCK", "HEAD"];

// 处理根路径 "/dav"（没有尾部斜杠）
webdavMethods.forEach((method) => {
  webdavRoutes.on(method, "/dav", async (c) => {
    try {
      return await handleWebDAV(c);
    } catch (error) {
      console.error(`WebDAV ${method} 请求处理错误:`, error);
      return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, "WebDAV服务处理错误", error.message), ApiStatus.INTERNAL_ERROR);
    }
  });
});

// 处理子路径 "/dav/*"（有尾部斜杠或子路径）
webdavMethods.forEach((method) => {
  webdavRoutes.on(method, "/dav/*", async (c) => {
    try {
      return await handleWebDAV(c);
    } catch (error) {
      console.error(`WebDAV ${method} 请求处理错误:`, error);
      return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, "WebDAV服务处理错误", error.message), ApiStatus.INTERNAL_ERROR);
    }
  });
});

export default webdavRoutes;
