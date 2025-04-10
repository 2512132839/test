import { Hono } from "hono";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { login, logout, changePassword, testAdminToken } from "../services/adminService.js";
import { ApiStatus } from "../constants/index.js";

const adminRoutes = new Hono();

// 管理员登录
adminRoutes.post("/api/admin/login", async (c) => {
  const db = c.env.DB;
  const { username, password } = await c.req.json();

  try {
    const loginResult = await login(db, username, password);

    return c.json({
      code: ApiStatus.SUCCESS,
      message: "登录成功",
      data: loginResult,
    });
  } catch (error) {
    throw error;
  }
});

// 管理员登出
adminRoutes.post("/api/admin/logout", authMiddleware, async (c) => {
  const db = c.env.DB;
  const authHeader = c.req.header("Authorization");
  const token = authHeader.substring(7);

  await logout(db, token);

  return c.json({
    code: ApiStatus.SUCCESS,
    message: "登出成功",
  });
});

// 更改管理员密码（需要认证）
adminRoutes.post("/api/admin/change-password", authMiddleware, async (c) => {
  const db = c.env.DB;
  const adminId = c.get("adminId");
  const { currentPassword, newPassword, newUsername } = await c.req.json();

  await changePassword(db, adminId, currentPassword, newPassword, newUsername);

  return c.json({
    code: ApiStatus.SUCCESS,
    message: "信息更新成功，请重新登录",
  });
});

// 测试管理员令牌路由
adminRoutes.get("/api/test/admin-token", async (c) => {
  const db = c.env.DB;
  const authHeader = c.req.header("Authorization") || "";

  if (!authHeader.startsWith("Bearer ")) {
    return c.json({
      code: ApiStatus.UNAUTHORIZED,
      message: "令牌无效",
      success: false,
    });
  }

  const token = authHeader.substring(7);
  const isValid = await testAdminToken(db, token);

  if (!isValid) {
    return c.json({
      code: ApiStatus.UNAUTHORIZED,
      message: "令牌无效",
      success: false,
    });
  }

  return c.json({
    code: ApiStatus.SUCCESS,
    message: "令牌有效",
    success: true,
  });
});

export default adminRoutes;
