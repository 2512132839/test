import { Hono } from "hono";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { login, logout, changePassword, testAdminToken } from "../services/adminService.js";
import { ApiStatus } from "../constants/index.js";
import { directoryCacheManager } from "../utils/DirectoryCache.js";

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

// 获取目录缓存统计信息
adminRoutes.get("/api/admin/cache/stats", async (c) => {
  try {
    const stats = directoryCacheManager.getStats();
    return c.json({
      code: ApiStatus.SUCCESS,
      message: "获取缓存统计成功",
      data: stats,
      success: true,
    });
  } catch (error) {
    console.error("获取缓存统计错误:", error);
    return c.json(
      {
        code: ApiStatus.INTERNAL_ERROR,
        message: error.message || "获取缓存统计失败",
        success: false,
      },
      ApiStatus.INTERNAL_ERROR
    );
  }
});

export default adminRoutes;
