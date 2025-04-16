import { Hono } from "hono";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { apiKeyMiddleware } from "../middlewares/apiKeyMiddleware.js";
import { getAllApiKeys, createApiKey, updateApiKey, deleteApiKey } from "../services/apiKeyService.js";
import { ApiStatus } from "../constants/index.js";
import { createErrorResponse } from "../utils/common.js";

const apiKeyRoutes = new Hono();

// 测试API密钥验证路由
apiKeyRoutes.get("/api/test/api-key", apiKeyMiddleware, async (c) => {
  // 获取密钥信息
  const apiKeyInfo = c.get("apiKey");
  const apiKeyId = c.get("apiKeyId");

  return c.json({
    code: ApiStatus.SUCCESS,
    message: "API密钥验证成功",
    data: {
      name: apiKeyInfo.name,
      permissions: {
        text: apiKeyInfo.textPermission,
        file: apiKeyInfo.filePermission,
        mount: apiKeyInfo.mountPermission,
      },
      key_info: {
        id: apiKeyId || apiKeyInfo.id,
        name: apiKeyInfo.name,
      },
    },
    success: true, // 添加兼容字段
  });
});

// 获取所有API密钥列表
apiKeyRoutes.get("/api/admin/api-keys", authMiddleware, async (c) => {
  const db = c.env.DB;

  try {
    const keys = await getAllApiKeys(db);

    // 兼容前端期望的响应格式
    return c.json({
      code: ApiStatus.SUCCESS,
      message: "获取成功",
      data: keys,
      success: true, // 添加兼容字段
    });
  } catch (error) {
    // 使用统一错误响应
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "获取API密钥列表失败"), ApiStatus.INTERNAL_ERROR);
  }
});

// 创建新的API密钥
apiKeyRoutes.post("/api/admin/api-keys", authMiddleware, async (c) => {
  const db = c.env.DB;

  try {
    const body = await c.req.json();
    const apiKey = await createApiKey(db, body);

    // 返回完整密钥（仅在创建时返回一次）
    return c.json({
      code: ApiStatus.CREATED,
      message: "API密钥创建成功",
      data: apiKey,
      success: true, // 添加兼容字段
    });
  } catch (error) {
    // 检查是否是唯一性约束错误
    if (error.message && error.message.includes("UNIQUE constraint failed")) {
      if (error.message.includes("api_keys.name")) {
        return c.json(createErrorResponse(ApiStatus.CONFLICT, "密钥名称已存在"), ApiStatus.CONFLICT);
      } else if (error.message.includes("api_keys.key")) {
        return c.json(createErrorResponse(ApiStatus.CONFLICT, "密钥已存在"), ApiStatus.CONFLICT);
      }
    }

    // 其他错误处理
    let status = ApiStatus.INTERNAL_ERROR;
    let message = error.message || "创建API密钥失败";

    if (message.includes("名称不能为空") || message.includes("密钥只能包含") || message.includes("无效的过期时间")) {
      status = ApiStatus.BAD_REQUEST;
    }

    return c.json(createErrorResponse(status, message), status);
  }
});

// 修改API密钥
apiKeyRoutes.put("/api/admin/api-keys/:id", authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  try {
    const body = await c.req.json();
    await updateApiKey(db, id, body);

    // 返回更新结果
    return c.json({
      code: ApiStatus.SUCCESS,
      message: "API密钥已更新",
      success: true, // 添加兼容字段
    });
  } catch (error) {
    // 错误处理
    let status = ApiStatus.INTERNAL_ERROR;
    let message = error.message || "更新API密钥失败";

    if (message.includes("密钥不存在")) {
      status = ApiStatus.NOT_FOUND;
    } else if (message.includes("密钥名称不能为空") || message.includes("无效的过期时间") || message.includes("没有提供有效的更新字段")) {
      status = ApiStatus.BAD_REQUEST;
    } else if (message.includes("密钥名称已存在")) {
      status = ApiStatus.CONFLICT;
    }

    return c.json(createErrorResponse(status, message), status);
  }
});

// 删除API密钥
apiKeyRoutes.delete("/api/admin/api-keys/:id", authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  try {
    await deleteApiKey(db, id);

    return c.json({
      code: ApiStatus.SUCCESS,
      message: "密钥已删除",
      success: true, // 添加兼容字段
    });
  } catch (error) {
    let status = ApiStatus.INTERNAL_ERROR;
    let message = error.message || "删除API密钥失败";

    if (message.includes("密钥不存在")) {
      status = ApiStatus.NOT_FOUND;
    }

    return c.json(createErrorResponse(status, message), status);
  }
});

export default apiKeyRoutes;
