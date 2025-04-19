import { Hono } from "hono";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { getAllPastes, getPasteById, deletePaste, batchDeletePastes, updatePaste } from "../services/pasteService.js";
import { ApiStatus } from "../constants/index.js";

const adminPasteRoutes = new Hono();

// 获取所有文本分享列表（需要认证）
adminPasteRoutes.get("/api/admin/pastes", authMiddleware, async (c) => {
  const db = c.env.DB;
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");
  const createdBy = c.req.query("created_by"); // 可选的创建者筛选

  try {
    const data = await getAllPastes(db, page, limit, createdBy);

    // 返回分页结果
    return c.json({
      code: ApiStatus.SUCCESS,
      message: "获取成功",
      data: data.results,
      pagination: data.pagination,
    });
  } catch (error) {
    console.error("获取文本列表失败:", error);
    throw error;
  }
});

// 删除文本分享（需要认证）
adminPasteRoutes.delete("/api/admin/pastes/:id", authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  try {
    await deletePaste(db, id);

    return c.json({
      code: ApiStatus.SUCCESS,
      message: "分享已删除",
    });
  } catch (error) {
    console.error("删除文本失败:", error);
    throw error;
  }
});

// 批量删除文本分享（需要认证）
adminPasteRoutes.post("/api/admin/pastes/batch-delete", authMiddleware, async (c) => {
  const db = c.env.DB;

  try {
    // 从请求体中获取要删除的ID数组
    const { ids } = await c.req.json();

    const deletedCount = await batchDeletePastes(db, ids, false);

    // 返回删除结果
    return c.json({
      code: ApiStatus.SUCCESS,
      message: `已删除 ${deletedCount} 个分享`,
    });
  } catch (error) {
    console.error("批量删除文本失败:", error);
    throw error;
  }
});

// 清理过期文本分享（需要认证）
adminPasteRoutes.post("/api/admin/pastes/clear-expired", authMiddleware, async (c) => {
  const db = c.env.DB;

  try {
    const deletedCount = await batchDeletePastes(db, null, true);

    // 返回删除结果
    return c.json({
      code: ApiStatus.SUCCESS,
      message: `已清理 ${deletedCount} 个过期分享`,
    });
  } catch (error) {
    console.error("清理过期文本失败:", error);
    throw error;
  }
});

// 修改文本分享（需要认证）
adminPasteRoutes.put("/api/admin/pastes/:slug", authMiddleware, async (c) => {
  const db = c.env.DB;
  const slug = c.req.param("slug");
  const body = await c.req.json();

  try {
    const result = await updatePaste(db, slug, body);

    return c.json({
      code: ApiStatus.SUCCESS,
      message: "文本分享已更新",
      data: {
        id: result.id,
        slug: result.slug, // 返回更新后的slug（可能已更改）
      },
    });
  } catch (error) {
    console.error("修改文本失败:", error);
    throw error;
  }
});

// 获取单个文本分享详情（需要认证）
adminPasteRoutes.get("/api/admin/pastes/:id", authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  try {
    const paste = await getPasteById(db, id);

    return c.json({
      code: ApiStatus.SUCCESS,
      message: "获取成功",
      data: paste,
    });
  } catch (error) {
    console.error("获取文本详情失败:", error);
    throw error;
  }
});

export default adminPasteRoutes;
