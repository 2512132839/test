/**
 * 用户存储挂载路由
 */
import { Hono } from "hono";
import { baseAuthMiddleware, requireMountPermissionMiddleware } from "../middlewares/permissionMiddleware.js";
import { PermissionUtils } from "../utils/permissionUtils.js";
import { ApiStatus } from "../constants/index.js";
import { createErrorResponse } from "../utils/common.js";
import { HTTPException } from "hono/http-exception";

const userStorageMountRoutes = new Hono();

/**
 * 处理API错误的辅助函数
 * @param {Context} c - Hono上下文
 * @param {Error} error - 捕获的错误
 * @param {string} defaultMessage - 默认错误消息
 * @returns {Response} JSON错误响应
 */
const handleApiError = (c, error, defaultMessage) => {
  // 记录错误，但避免冗余日志
  console.error(`API错误: ${error.message || defaultMessage}`);

  // 如果是HTTPException，使用其状态码
  if (error instanceof HTTPException) {
    return c.json(createErrorResponse(error.status, error.message), error.status);
  }

  // 其他错误视为内部服务器错误
  return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || defaultMessage), ApiStatus.INTERNAL_ERROR);
};

// 通过API密钥获取可访问的挂载点列表（基于basic_path权限）
userStorageMountRoutes.get("/api/user/mounts", baseAuthMiddleware, requireMountPermissionMiddleware, async (c) => {
  const db = c.env.DB;
  const apiKeyInfo = PermissionUtils.getApiKeyInfo(c);

  try {
    // 根据API密钥的基本路径获取可访问的挂载点
    const mounts = await PermissionUtils.getAccessibleMounts(db, apiKeyInfo, "apiKey");

    return c.json({
      code: ApiStatus.SUCCESS,
      message: "获取挂载点列表成功",
      data: mounts,
      success: true,
    });
  } catch (error) {
    return handleApiError(c, error, "获取挂载点列表失败");
  }
});

// 通过API密钥获取单个挂载点详情（基于basic_path权限）
userStorageMountRoutes.get("/api/user/mounts/:id", baseAuthMiddleware, requireMountPermissionMiddleware, async (c) => {
  const db = c.env.DB;
  const apiKeyInfo = PermissionUtils.getApiKeyInfo(c);
  const { id } = c.req.param();

  try {
    // 首先获取挂载点信息
    const mount = await db
      .prepare(
        `SELECT
          id, name, storage_type, storage_config_id, mount_path,
          remark, is_active, created_by, sort_order, cache_ttl,
          created_at, updated_at, last_used
         FROM storage_mounts
         WHERE id = ? AND is_active = 1`
      )
      .bind(id)
      .first();

    if (!mount) {
      throw new HTTPException(ApiStatus.NOT_FOUND, { message: "挂载点不存在" });
    }

    // 检查API密钥是否有权限访问此挂载点
    if (!PermissionUtils.checkPathPermission(apiKeyInfo.basicPath, mount.mount_path)) {
      throw new HTTPException(ApiStatus.FORBIDDEN, { message: "没有权限访问此挂载点" });
    }

    return c.json({
      code: ApiStatus.SUCCESS,
      message: "获取挂载点成功",
      data: mount,
      success: true,
    });
  } catch (error) {
    return handleApiError(c, error, "获取挂载点失败");
  }
});

// 注意：用户挂载点的创建、更新、删除功能已移除
// 现在用户只能查看管理员分配给其API密钥basic_path权限范围内的挂载点
// 挂载点的管理完全由管理员在后台进行

export default userStorageMountRoutes;
