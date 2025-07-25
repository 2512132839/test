import { Hono } from "hono";
import { authGateway } from "../middlewares/authGatewayMiddleware.js";
import { getAllSystemSettings, updateSystemSettings, getMaxUploadSize, getDashboardStats } from "../services/systemService.js";
import { ApiStatus } from "../constants/index.js";
import { createErrorResponse } from "../utils/common.js";
import { ProxySignatureService } from "../services/ProxySignatureService.js";

const systemRoutes = new Hono();

// 获取系统设置
systemRoutes.get("/api/admin/system-settings", authGateway.requireAdmin(), async (c) => {
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
systemRoutes.put("/api/admin/system-settings", authGateway.requireAdmin(), async (c) => {
  const db = c.env.DB;

  try {
    const body = await c.req.json();

    // 检查请求体是否有效
    if (!body || typeof body !== "object") {
      return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "请求参数无效"), ApiStatus.BAD_REQUEST);
    }

    // 验证webdav_upload_mode参数（如果存在）
    if (body.webdav_upload_mode !== undefined) {
      const validModes = ["multipart", "direct"];
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
systemRoutes.get("/api/admin/dashboard/stats", authGateway.requireAdmin(), async (c) => {
  try {
    const db = c.env.DB;
    const adminId = authGateway.utils.getUserId(c);

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

// 获取系统版本信息（公共API）
systemRoutes.get("/api/version", async (c) => {
  // 判断运行环境和数据存储
  const runtimeEnv = process.env.RUNTIME_ENV || "unknown";
  const isDocker = runtimeEnv === "docker";

  // 统一的默认版本配置
  const DEFAULT_VERSION = "0.7.3";
  const DEFAULT_NAME = "cloudpaste-api";

  let version = DEFAULT_VERSION;
  let name = DEFAULT_NAME;

  // 根据环境获取版本信息
  if (isDocker) {
    // Docker环境：尝试读取package.json
    try {
      const fs = await import("fs");
      const path = await import("path");
      const packagePath = path.resolve("./package.json");
      const packageContent = fs.readFileSync(packagePath, "utf8");
      const packageJson = JSON.parse(packageContent);

      version = packageJson.version || DEFAULT_VERSION;
      name = packageJson.name || DEFAULT_NAME;
    } catch (error) {
      console.warn("Docker环境读取package.json失败，使用默认值:", error.message);
      // 保持默认值
    }
  } else {
    // Workers环境：使用环境变量或默认值
    version = process.env.APP_VERSION || DEFAULT_VERSION;
    name = process.env.APP_NAME || DEFAULT_NAME;
  }

  const versionInfo = {
    version,
    name,
    environment: isDocker ? "Docker" : "Cloudflare Workers",
    storage: isDocker ? "SQLite" : "Cloudflare D1",
    nodeVersion: process.version || "unknown",
    uptime: Math.round(process.uptime()),
  };

  return c.json({
    code: ApiStatus.SUCCESS,
    message: "获取版本信息成功",
    data: versionInfo,
    success: true,
  });
});

// 获取代理签名设置
systemRoutes.get("/api/admin/proxy-sign-settings", authGateway.requireAdmin(), async (c) => {
  try {
    const db = c.env.DB;
    const encryptionSecret = c.env.ENCRYPTION_SECRET;

    const signatureService = new ProxySignatureService(db, encryptionSecret);
    const globalConfig = await signatureService.getGlobalSignConfig();

    return c.json({
      code: ApiStatus.SUCCESS,
      message: "获取代理签名设置成功",
      data: globalConfig,
      success: true,
    });
  } catch (error) {
    console.error("获取代理签名设置错误:", error);
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, "获取设置失败"), ApiStatus.INTERNAL_ERROR);
  }
});

// 更新代理签名设置
systemRoutes.post("/api/admin/proxy-sign-settings", authGateway.requireAdmin(), async (c) => {
  try {
    const db = c.env.DB;
    const encryptionSecret = c.env.ENCRYPTION_SECRET;
    const { signAll, expires } = await c.req.json();

    // 验证参数
    if (typeof signAll !== "boolean") {
      return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "signAll 必须是布尔值"), ApiStatus.BAD_REQUEST);
    }

    if (typeof expires !== "number" || expires < 0) {
      return c.json(createErrorResponse(ApiStatus.BAD_REQUEST, "expires 必须是非负数"), ApiStatus.BAD_REQUEST);
    }

    const signatureService = new ProxySignatureService(db, encryptionSecret);
    await signatureService.updateGlobalSignConfig({ signAll, expires });

    return c.json({
      code: ApiStatus.SUCCESS,
      message: "代理签名设置更新成功",
      success: true,
    });
  } catch (error) {
    console.error("更新代理签名设置错误:", error);
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, "更新设置失败"), ApiStatus.INTERNAL_ERROR);
  }
});

export default systemRoutes;
