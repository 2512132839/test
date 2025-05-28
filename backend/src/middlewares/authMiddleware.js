/**
 * 认证相关中间件
 */

import { HTTPException } from "hono/http-exception";
import { ApiStatus } from "../constants/index.js";
import { validateAdminToken } from "../services/adminService.js";

/**
 * JWT管理员认证中间件
 * 验证请求头中的Bearer令牌是否有效
 */
export const authMiddleware = async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(
      {
        code: ApiStatus.UNAUTHORIZED,
        message: "未授权访问",
        data: null,
      },
      ApiStatus.UNAUTHORIZED
    );
  }

  const token = authHeader.substring(7);

  try {
    // 从D1数据库验证token
    const adminId = await validateAdminToken(c.env.DB, token);

    if (!adminId) {
      return c.json(
        {
          code: ApiStatus.UNAUTHORIZED,
          message: "无效的认证令牌",
          data: null,
        },
        ApiStatus.UNAUTHORIZED
      );
    }

    // 将管理员ID添加到上下文中
    c.set("adminId", adminId);

    await next();
  } catch (error) {
    return c.json(
      {
        code: ApiStatus.UNAUTHORIZED,
        message: "认证失败: " + error.message,
        data: null,
      },
      ApiStatus.UNAUTHORIZED
    );
  }
};