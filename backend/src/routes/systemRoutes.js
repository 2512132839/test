import { Hono } from "hono";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { getAllSystemSettings, updateSystemSettings, getMaxUploadSize, getDashboardStats } from "../services/systemService.js";
import { ApiStatus } from "../constants/index.js";
import { createErrorResponse } from "../utils/common.js";

const systemRoutes = new Hono();

// 获取系统设置
systemRoutes.get("/api/admin/system-settings", authMiddleware, async (c) => {
  const db = c.env.DB;

  try {
    // 获取所有系统设置
    const settings = await getAllSystemSettings(db);

    return c.json({
      code: ApiStatus.SUCCESS,
      message: "获取系统设置成功",
      data: settings,
      success: true,
    });
  } catch (error) {
    console.error("获取系统设置错误:", error);
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, "获取系统设置失败: " + error.message), ApiStatus.INTERNAL_ERROR);
  }
});

// 更新系统设置
systemRoutes.put("/api/admin/system-settings", authMiddleware, async (c) => {
  const db = c.env.DB;

  try {
    const body = await c.req.json();

    // 检查请求体是否有效
    if (!body || typeof body !== "object") {
      return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请求参数无效"), ApiStatus.BAD_REQUEST);
    }

    // 验证webdav_upload_mode参数（如果存在）
    if (body.webdav_upload_mode !== undefined) {
      const validModes = ["auto", "proxy", "multipart", "direct"];
      if (!validModes.includes(body.webdav_upload_mode)) {
        return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, `WebDAV上传模式无效，有效值为: ${validModes.join(", ")}`), ApiStatus.BAD_REQUEST);
      }

      // 对于direct模式，添加警告提示
      if (body.webdav_upload_mode === "direct") {
        console.warn("系统设置：WebDAV上传模式设置为直接上传模式，这可能在上传大文件时导致性能问题");
      }
    }

    // 更新系统设置
    await updateSystemSettings(db, body);

    return c.json({
      code: ApiStatus.SUCCESS,
      message: "系统设置更新成功",
      success: true,
    });
  } catch (error) {
    console.error("更新系统设置错误:", error);
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, "更新系统设置失败: " + error.message), ApiStatus.INTERNAL_ERROR);
  }
});

// 获取最大上传文件大小限制（公共API）
systemRoutes.get("/api/system/max-upload-size", async (c) => {
  const db = c.env.DB;

  try {
    // 获取最大上传大小设置
    const size = await getMaxUploadSize(db);

    return c.json({
      code: ApiStatus.SUCCESS,
      message: "获取最大上传大小成功",
      data: { max_upload_size: size },
      success: true,
    });
  } catch (error) {
    console.error("获取最大上传大小错误:", error);
    // 获取默认值
    const defaultSize = await getMaxUploadSize(db);
    return c.json({
      code: ApiStatus.SUCCESS,
      message: "获取最大上传大小成功（使用默认值）",
      data: { max_upload_size: defaultSize },
      success: true,
    });
  }
});

// 仪表盘统计数据API
systemRoutes.get("/api/admin/dashboard/stats", authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const adminId = c.get("adminId");

    const stats = await getDashboardStats(db, adminId);

    return c.json({
      code: ApiStatus.SUCCESS,
      message: "获取仪表盘统计数据成功",
      data: stats,
      success: true,
    });
  } catch (error) {
    console.error("获取仪表盘统计数据失败:", error);
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, "获取仪表盘统计数据失败: " + error.message), ApiStatus.INTERNAL_ERROR);
  }
});

export default systemRoutes;
