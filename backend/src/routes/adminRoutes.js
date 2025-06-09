import { Hono } from "hono";
import { baseAuthMiddleware, requireAdminMiddleware, requireMountPermissionMiddleware } from "../middlewares/permissionMiddleware.js";
import { PermissionUtils } from "../utils/permissionUtils.js";
import { login, logout, changePassword, testAdminToken } from "../services/adminService.js";
import { ApiStatus } from "../constants/index.js";
import { directoryCacheManager, clearCache } from "../utils/DirectoryCache.js";

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
adminRoutes.post("/api/admin/logout", baseAuthMiddleware, requireAdminMiddleware, async (c) => {
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
adminRoutes.post("/api/admin/change-password", baseAuthMiddleware, requireAdminMiddleware, async (c) => {
  const db = c.env.DB;
  const adminId = PermissionUtils.getUserId(c);
  const { currentPassword, newPassword, newUsername } = await c.req.json();

  await changePassword(db, adminId, currentPassword, newPassword, newUsername);

  return c.json({
    code: ApiStatus.SUCCESS,
    message: "信息更新成功，请重新登录",
  });
});

// 测试管理员令牌路由
adminRoutes.get("/api/test/admin-token", baseAuthMiddleware, async (c) => {
  // 使用新的权限工具检查管理员权限
  const permissionResult = PermissionUtils.checkAdminPermission(c);

  if (!permissionResult.success) {
    return c.json(permissionResult.response, permissionResult.status);
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

// 清理目录缓存（管理员）
adminRoutes.post("/api/admin/cache/clear", baseAuthMiddleware, requireAdminMiddleware, async (c) => {
  const db = c.env.DB;

  try {
    // 获取请求参数
    const { mountId, s3ConfigId } = await c.req.json().catch(() => ({}));

    let clearedCount = 0;

    // 如果指定了挂载点ID，清理特定挂载点的缓存
    if (mountId) {
      clearedCount = await clearCache({ mountId });
      console.log(`管理员手动清理挂载点缓存 - 挂载点ID: ${mountId}, 清理项: ${clearedCount}`);
    }
    // 如果指定了S3配置ID，清理相关挂载点的缓存
    else if (s3ConfigId) {
      clearedCount = await clearCache({ db, s3ConfigId });
      console.log(`管理员手动清理S3配置缓存 - S3配置ID: ${s3ConfigId}, 清理项: ${clearedCount}`);
    }
    // 如果没有指定参数，清理所有缓存
    else {
      clearedCount = directoryCacheManager.invalidateAll();
      console.log(`管理员手动清理所有缓存 - 清理项: ${clearedCount}`);
    }

    return c.json({
      code: ApiStatus.SUCCESS,
      message: `缓存清理成功，共清理 ${clearedCount} 项`,
      data: {
        clearedCount,
        timestamp: new Date().toISOString(),
      },
      success: true,
    });
  } catch (error) {
    console.error("管理员清理缓存错误:", error);
    return c.json(
        {
          code: ApiStatus.INTERNAL_ERROR,
          message: error.message || "清理缓存失败",
          success: false,
        },
        ApiStatus.INTERNAL_ERROR
    );
  }
});

// 清理目录缓存（API密钥用户）
adminRoutes.post("/api/user/cache/clear", baseAuthMiddleware, requireMountPermissionMiddleware, async (c) => {
  const db = c.env.DB;
  const apiKeyInfo = PermissionUtils.getApiKeyInfo(c);

  try {
    // 获取请求参数
    const { mountId, s3ConfigId } = await c.req.json().catch(() => ({}));

    let clearedCount = 0;

    // 如果指定了挂载点ID，清理特定挂载点的缓存
    if (mountId) {
      clearedCount = await clearCache({ mountId });
      console.log(`API密钥用户手动清理挂载点缓存 - 用户: ${apiKeyInfo.name}, 挂载点ID: ${mountId}, 清理项: ${clearedCount}`);
    }
    // 如果指定了S3配置ID，清理相关挂载点的缓存
    else if (s3ConfigId) {
      clearedCount = await clearCache({ db, s3ConfigId });
      console.log(`API密钥用户手动清理S3配置缓存 - 用户: ${apiKeyInfo.name}, S3配置ID: ${s3ConfigId}, 清理项: ${clearedCount}`);
    }
    // 如果没有指定参数，清理所有缓存（API密钥用户只能清理所有缓存，不能指定特定缓存）
    else {
      clearedCount = directoryCacheManager.invalidateAll();
      console.log(`API密钥用户手动清理所有缓存 - 用户: ${apiKeyInfo.name}, 清理项: ${clearedCount}`);
    }

    return c.json({
      code: ApiStatus.SUCCESS,
      message: `缓存清理成功，共清理 ${clearedCount} 项`,
      data: {
        clearedCount,
        timestamp: new Date().toISOString(),
      },
      success: true,
    });
  } catch (error) {
    console.error("API密钥用户清理缓存错误:", error);
    return c.json(
        {
          code: ApiStatus.INTERNAL_ERROR,
          message: error.message || "清理缓存失败",
          success: false,
        },
        ApiStatus.INTERNAL_ERROR
    );
  }
});

export default adminRoutes;
