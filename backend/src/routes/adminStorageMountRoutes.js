/**
 * 管理员存储挂载路由
 */
import { Hono } from "hono";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { validateAdminToken } from "../services/adminService.js";
import { getMountsByAdmin, getMountByIdForAdmin, createMount, updateMount, deleteMount, getAllMounts } from "../services/storageMountService.js";
import { DbTables, ApiStatus } from "../constants/index.js";
import { createErrorResponse } from "../utils/common.js";
import { HTTPException } from "hono/http-exception";

const adminStorageMountRoutes = new Hono();

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

// 获取挂载点列表（管理员权限）
adminStorageMountRoutes.get("/api/admin/mounts", authMiddleware, async (c) => {
  const db = c.env.DB;
  const adminId = c.get("adminId"); // 从中间件获取adminId

  try {
    // 管理员获取所有挂载点
    const mounts = await getAllMounts(db);

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

// 获取单个挂载点详情（管理员权限）
adminStorageMountRoutes.get("/api/admin/mounts/:id", authMiddleware, async (c) => {
  const db = c.env.DB;
  const adminId = c.get("adminId"); // 从中间件获取adminId
  const { id } = c.req.param();

  try {
    // 管理员查询
    const mount = await getMountByIdForAdmin(db, id, adminId);

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

// 创建挂载点（管理员权限）
adminStorageMountRoutes.post("/api/admin/mounts", authMiddleware, async (c) => {
  const db = c.env.DB;
  const adminId = c.get("adminId");

  try {
    const body = await c.req.json();
    const mount = await createMount(db, body, adminId);

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

// 更新挂载点（管理员权限）
adminStorageMountRoutes.put("/api/admin/mounts/:id", authMiddleware, async (c) => {
  const db = c.env.DB;
  const adminId = c.get("adminId");
  const { id } = c.req.param();

  try {
    const body = await c.req.json();
    await updateMount(db, id, body, adminId, true);

    return c.json({
      code: ApiStatus.SUCCESS,
      message: "挂载点已更新",
      success: true,
    });
  } catch (error) {
    return handleApiError(c, error, "更新挂载点失败");
  }
});

// 删除挂载点（管理员权限）
adminStorageMountRoutes.delete("/api/admin/mounts/:id", authMiddleware, async (c) => {
  const db = c.env.DB;
  const adminId = c.get("adminId");
  const { id } = c.req.param();

  try {
    await deleteMount(db, id, adminId, true);

    return c.json({
      code: ApiStatus.SUCCESS,
      message: "挂载点删除成功",
      success: true,
    });
  } catch (error) {
    return handleApiError(c, error, "删除挂载点失败");
  }
});

export default adminStorageMountRoutes;
