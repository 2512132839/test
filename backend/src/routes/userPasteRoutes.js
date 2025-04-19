import { Hono } from "hono";
import { apiKeyTextMiddleware } from "../middlewares/apiKeyMiddleware.js";
import { validateAdminToken } from "../services/adminService.js";
import { checkAndDeleteExpiredApiKey } from "../services/apiKeyService.js";
import {
  createPaste,
  getPasteBySlug,
  verifyPastePassword,
  getUserPastes,
  incrementPasteViews,
  batchDeleteUserPastes,
  updatePaste,
  isPasteAccessible,
  checkAndDeleteExpiredPaste,
} from "../services/pasteService.js";
import { ApiStatus, DbTables } from "../constants/index.js";
import { HTTPException } from "hono/http-exception";
import { createErrorResponse, getLocalTimeString } from "../utils/common.js";

const userPasteRoutes = new Hono();

// 创建新的文本分享
userPasteRoutes.post("/api/paste", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();

  // 添加管理员权限验证
  const authHeader = c.req.header("Authorization");
  let isAuthorized = false;
  let authorizedBy = "";
  let authorizedId = null;

  // 检查Bearer令牌 (管理员)
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const adminId = await validateAdminToken(c.env.DB, token);

    if (adminId) {
      isAuthorized = true;
      authorizedBy = "admin";
      authorizedId = adminId;
    }
  }
  // 检查API密钥
  else if (authHeader && authHeader.startsWith("ApiKey ")) {
    const apiKey = authHeader.substring(7);

    // 查询数据库中的API密钥记录
    const keyRecord = await db
        .prepare(
            `
      SELECT id, name, text_permission, expires_at
      FROM ${DbTables.API_KEYS}
      WHERE key = ?
    `
        )
        .bind(apiKey)
        .first();

    // 如果密钥存在且有文本权限
    if (keyRecord && keyRecord.text_permission === 1) {
      // 检查是否过期
      if (!(await checkAndDeleteExpiredApiKey(db, keyRecord))) {
        isAuthorized = true;
        authorizedBy = "apikey";
        authorizedId = keyRecord.id;

        // 更新最后使用时间
        await db
            .prepare(
                `
          UPDATE ${DbTables.API_KEYS}
          SET last_used = ?
          WHERE id = ?
        `
            )
            .bind(getLocalTimeString(), keyRecord.id)
            .run();
      }
    }
  }

  // 如果都没有授权，则返回权限错误
  if (!isAuthorized) {
    throw new HTTPException(ApiStatus.FORBIDDEN, { message: "需要管理员权限或有效的API密钥才能创建分享" });
  }

  try {
    // 创建者信息
    const createdBy = authorizedBy === "admin" ? authorizedId : authorizedBy === "apikey" ? `apikey:${authorizedId}` : null;

    // 创建文本分享
    const paste = await createPaste(db, body, createdBy);

    // 返回创建结果
    return c.json({
      ...paste,
      authorizedBy, // 添加授权方式信息，方便调试
    });
  } catch (error) {
    // 处理特定错误
    if (error.message.includes("链接后缀已被占用")) {
      throw new HTTPException(ApiStatus.CONFLICT, { message: error.message });
    }
    // 处理其他错误
    throw new HTTPException(ApiStatus.INTERNAL_ERROR, { message: error.message || "创建分享失败" });
  }
});

// 获取文本分享
userPasteRoutes.get("/api/paste/:slug", async (c) => {
  const db = c.env.DB;
  const slug = c.req.param("slug");

  try {
    // 获取文本分享
    const paste = await getPasteBySlug(db, slug);

    // 检查是否需要密码
    if (paste.has_password) {
      return c.json({
        slug: paste.slug,
        hasPassword: true,
        remark: paste.remark,
        expiresAt: paste.expires_at,
        maxViews: paste.max_views,
        views: paste.views,
        createdAt: paste.created_at,
        created_by: paste.created_by,
        requiresPassword: true,
      });
    }

    // 检查是否可访问
    if (!isPasteAccessible(paste)) {
      throw new HTTPException(ApiStatus.GONE, { message: "文本分享已过期或超过最大查看次数" });
    }

    // 增加查看次数
    await incrementPasteViews(db, paste.id, paste.max_views);

    // 返回paste内容
    return c.json({
      slug: paste.slug,
      content: paste.content,
      remark: paste.remark,
      hasPassword: false,
      expiresAt: paste.expires_at,
      maxViews: paste.max_views,
      views: paste.views + 1, // 已增加的查看次数
      createdAt: paste.created_at,
      updatedAt: paste.updated_at,
      created_by: paste.created_by,
    });
  } catch (error) {
    console.error("获取文本分享失败:", error);
    throw error;
  }
});

// 使用密码获取文本分享
userPasteRoutes.post("/api/paste/:slug", async (c) => {
  const db = c.env.DB;
  const slug = c.req.param("slug");
  const { password } = await c.req.json();

  if (!password) {
    throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "请提供密码" });
  }

  try {
    // 验证密码并获取内容
    const paste = await verifyPastePassword(db, slug, password);

    return c.json(paste);
  } catch (error) {
    console.error("验证文本密码失败:", error);
    throw error;
  }
});

// 直接访问raw内容的路由
userPasteRoutes.get("/api/raw/:slug", async (c) => {
  const db = c.env.DB;
  const slug = c.req.param("slug");
  const password = c.req.query("password"); // 从查询参数中获取密码

  try {
    // 获取文本分享
    const paste = await getPasteBySlug(db, slug);

    // 如果需要密码且未提供或密码不正确
    if (paste.has_password) {
      if (!password) {
        throw new HTTPException(ApiStatus.UNAUTHORIZED, { message: "需要密码才能访问此内容" });
      }

      // 验证密码
      try {
        await verifyPastePassword(db, slug, password, false); // 不增加查看次数
      } catch (error) {
        throw new HTTPException(ApiStatus.UNAUTHORIZED, { message: "密码错误" });
      }
    }

    // 检查是否可访问
    if (!isPasteAccessible(paste)) {
      throw new HTTPException(ApiStatus.GONE, { message: "文本分享已过期或超过最大查看次数" });
    }

    // 增加查看次数
    await incrementPasteViews(db, paste.id, paste.max_views);

    // 返回原始文本内容
    return new Response(paste.content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `inline; filename="${slug}.txt"`,
      },
    });
  } catch (error) {
    console.error("获取原始文本内容失败:", error);

    // 根据错误类型返回适当的错误状态和信息
    if (error instanceof HTTPException) {
      return new Response(error.message, {
        status: error.status,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return new Response("获取内容失败", {
      status: ApiStatus.INTERNAL_ERROR,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
});

// API密钥用户获取自己的文本列表
userPasteRoutes.get("/api/user/pastes", apiKeyTextMiddleware, async (c) => {
  const db = c.env.DB;
  const apiKeyId = c.get("apiKeyId");
  const apiKeyInfo = c.get("apiKeyInfo");

  try {
    // 查询用户文本（支持分页）
    const limit = parseInt(c.req.query("limit") || "30");
    const offset = parseInt(c.req.query("offset") || "0");

    const result = await getUserPastes(db, apiKeyId, limit, offset);

    return c.json({
      code: ApiStatus.SUCCESS,
      message: "获取成功",
      data: result.results,
      pagination: result.pagination,
      key_info: apiKeyInfo, // 返回API密钥信息
      success: true,
    });
  } catch (error) {
    console.error("获取API密钥用户文本列表错误:", error);
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "获取文本列表失败"), ApiStatus.INTERNAL_ERROR);
  }
});

// API密钥用户获取单个文本详情
userPasteRoutes.get("/api/user/pastes/:id", apiKeyTextMiddleware, async (c) => {
  const db = c.env.DB;
  const apiKeyId = c.get("apiKeyId");
  const { id } = c.req.param();

  try {
    // 获取用户自己创建的文本
    const paste = await db
        .prepare(
            `
        SELECT 
          id, slug, content, remark,
          password IS NOT NULL as has_password,
          expires_at, max_views, views, created_at, updated_at, created_by
        FROM ${DbTables.PASTES}
        WHERE id = ? AND created_by = ?
      `
        )
        .bind(id, `apikey:${apiKeyId}`)
        .first();

    if (!paste) {
      return c.json(createErrorResponse(ApiStatus.NOT_FOUND, "文本不存在或无权访问"), ApiStatus.NOT_FOUND);
    }

    // 确保has_password是布尔类型
    paste.has_password = !!paste.has_password;

    // 如果文本有密码，查询明文密码
    let plainPassword = null;
    if (paste.has_password) {
      const passwordRecord = await db.prepare(`SELECT plain_password FROM ${DbTables.PASTE_PASSWORDS} WHERE paste_id = ?`).bind(paste.id).first();

      if (passwordRecord) {
        plainPassword = passwordRecord.plain_password;
      }
    }

    // 如果文本由API密钥创建，获取密钥名称
    let result = { ...paste, plain_password: plainPassword };
    if (paste.created_by && paste.created_by.startsWith("apikey:")) {
      const keyId = paste.created_by.substring(7);
      const keyInfo = await db.prepare(`SELECT id, name FROM ${DbTables.API_KEYS} WHERE id = ?`).bind(keyId).first();

      if (keyInfo) {
        result.key_name = keyInfo.name;
      }
    }

    return c.json({
      code: ApiStatus.SUCCESS,
      message: "获取文本详情成功",
      data: result,
      success: true,
    });
  } catch (error) {
    console.error("获取API密钥用户文本详情错误:", error);
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "获取文本详情失败"), ApiStatus.INTERNAL_ERROR);
  }
});

// API密钥用户删除自己的文本
userPasteRoutes.delete("/api/user/pastes/:id", apiKeyTextMiddleware, async (c) => {
  const db = c.env.DB;
  const apiKeyId = c.get("apiKeyId");
  const { id } = c.req.param();

  try {
    // 查询是否存在且属于该API密钥用户
    const paste = await db.prepare(`SELECT id FROM ${DbTables.PASTES} WHERE id = ? AND created_by = ?`).bind(id, `apikey:${apiKeyId}`).first();

    if (!paste) {
      return c.json(createErrorResponse(ApiStatus.NOT_FOUND, "文本不存在或无权删除"), ApiStatus.NOT_FOUND);
    }

    // 删除文本
    await db.prepare(`DELETE FROM ${DbTables.PASTES} WHERE id = ?`).bind(id).run();

    return c.json({
      code: ApiStatus.SUCCESS,
      message: "删除文本成功",
      success: true,
    });
  } catch (error) {
    console.error("删除API密钥用户文本错误:", error);
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "删除文本失败"), ApiStatus.INTERNAL_ERROR);
  }
});

// API密钥用户批量删除自己的文本
userPasteRoutes.post("/api/user/pastes/batch-delete", apiKeyTextMiddleware, async (c) => {
  const db = c.env.DB;
  const apiKeyId = c.get("apiKeyId");

  try {
    // 从请求体中获取要删除的ID数组
    const { ids } = await c.req.json();

    // 批量删除用户的文本
    const deletedCount = await batchDeleteUserPastes(db, ids, apiKeyId);

    return c.json({
      code: ApiStatus.SUCCESS,
      message: `已删除 ${deletedCount} 个分享`,
      success: true,
    });
  } catch (error) {
    console.error("批量删除API密钥用户文本错误:", error);
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "批量删除文本失败"), ApiStatus.INTERNAL_ERROR);
  }
});

// API密钥用户修改自己的文本
userPasteRoutes.put("/api/user/pastes/:slug", apiKeyTextMiddleware, async (c) => {
  const db = c.env.DB;
  const slug = c.req.param("slug");
  const apiKeyId = c.get("apiKeyId");
  const body = await c.req.json();

  try {
    // 更新文本，并指定创建者以进行权限检查
    const result = await updatePaste(db, slug, body, `apikey:${apiKeyId}`);

    return c.json({
      code: ApiStatus.SUCCESS,
      message: "文本更新成功",
      data: {
        id: result.id,
        slug: result.slug, // 返回更新后的slug（可能已更改）
      },
      success: true,
    });
  } catch (error) {
    console.error("修改API密钥用户文本错误:", error);
    return c.json(createErrorResponse(ApiStatus.INTERNAL_ERROR, error.message || "修改文本失败"), ApiStatus.INTERNAL_ERROR);
  }
});

export default userPasteRoutes;
