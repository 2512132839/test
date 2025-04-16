/**
 * 用户存储挂载路由
 */
import { Hono } from "hono";
import { apiKeyMiddleware, apiKeyMountMiddleware } from "../middlewares/apiKeyMiddleware.js";
import { checkAndDeleteExpiredApiKey } from "../services/apiKeyService.js";
import { getMountsByApiKey, getMountByIdForApiKey, createMount, updateMount, deleteMount } from "../services/storageMountService.js";
import { DbTables, ApiStatus } from "../constants/index.js";
import { createErrorResponse, getLocalTimeString } from "../utils/common.js";
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

// 通过API密钥获取挂载点列表
userStorageMountRoutes.get("/api/user/mounts", apiKeyMountMiddleware, async (c) => {
  const db = c.env.DB;
  const apiKeyId = c.get("apiKeyId");

  try {
    // API密钥用户只能看到自己的挂载点
    const mounts = await getMountsByApiKey(db, apiKeyId);

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

// 通过API密钥获取单个挂载点详情
userStorageMountRoutes.get("/api/user/mounts/:id", apiKeyMountMiddleware, async (c) => {
  const db = c.env.DB;
  const apiKeyId = c.get("apiKeyId");
  const { id } = c.req.param();

  try {
    // API密钥用户查询
    const mount = await getMountByIdForApiKey(db, id, apiKeyId);

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

// 通过API密钥创建挂载点
userStorageMountRoutes.post("/api/user/mounts", apiKeyMountMiddleware, async (c) => {
  const db = c.env.DB;
  const apiKeyId = c.get("apiKeyId");

  try {
    const body = await c.req.json();
    const mount = await createMount(db, body, apiKeyId);

    // 返回创建成功响应
    return c.json({
      code: ApiStatus.CREATED,
      message: "挂载点创建成功",
      data: mount,
      success: true,
    });
  } catch (error) {
    return handleApiError(c, error, "创建挂载点失败");
  }
});

// 通过API密钥更新挂载点
userStorageMountRoutes.put("/api/user/mounts/:id", apiKeyMountMiddleware, async (c) => {
  const db = c.env.DB;
  const apiKeyId = c.get("apiKeyId");
  const { id } = c.req.param();

  try {
    const body = await c.req.json();
    await updateMount(db, id, body, apiKeyId);

    return c.json({
      code: ApiStatus.SUCCESS,
      message: "挂载点已更新",
      success: true,
    });
  } catch (error) {
    return handleApiError(c, error, "更新挂载点失败");
  }
});

// 通过API密钥删除挂载点
userStorageMountRoutes.delete("/api/user/mounts/:id", apiKeyMountMiddleware, async (c) => {
  const db = c.env.DB;
  const apiKeyId = c.get("apiKeyId");
  const { id } = c.req.param();

  try {
    await deleteMount(db, id, apiKeyId);

    return c.json({
      code: ApiStatus.SUCCESS,
      message: "挂载点删除成功",
      success: true,
    });
  } catch (error) {
    return handleApiError(c, error, "删除挂载点失败");
  }
});

export default userStorageMountRoutes;
