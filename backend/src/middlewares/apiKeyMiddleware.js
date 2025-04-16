/**
 * API密钥认证相关中间件
 */

import { HTTPException } from "hono/http-exception";
import { ApiStatus, DbTables } from "../constants/index.js";
import { getLocalTimeString } from "../utils/common.js";
import { checkAndDeleteExpiredApiKey } from "../services/apiKeyService.js";

/**
 * API密钥认证中间件（仅文本权限）
 * 验证请求头中的ApiKey是否有效并具有文本权限
 */
export const apiKeyTextMiddleware = async (c, next) => {
  const db = c.env.DB;

  // 获取认证头信息
  const authHeader = c.req.header("Authorization");

  // 检查是否有API密钥认证
  if (!authHeader || !authHeader.startsWith("ApiKey ")) {
    throw new HTTPException(ApiStatus.UNAUTHORIZED, { message: "需要API密钥授权" });
  }

  const apiKey = authHeader.substring(7);

  // 查询API密钥和权限
  const keyRecord = await db
    .prepare(
      `SELECT id, name, text_permission, file_permission, mount_permission, expires_at 
       FROM ${DbTables.API_KEYS} 
       WHERE key = ?`
    )
    .bind(apiKey)
    .first();

  // 检查API密钥是否存在且有文本权限
  if (!keyRecord || keyRecord.text_permission !== 1) {
    throw new HTTPException(ApiStatus.FORBIDDEN, { message: "API密钥没有文本权限" });
  }

  // 检查API密钥是否过期
  if (await checkAndDeleteExpiredApiKey(db, keyRecord)) {
    throw new HTTPException(ApiStatus.UNAUTHORIZED, { message: "API密钥已过期" });
  }

  // 更新最后使用时间
  await db
    .prepare(
      `UPDATE ${DbTables.API_KEYS}
       SET last_used = ?
       WHERE id = ?`
    )
    .bind(getLocalTimeString(), keyRecord.id)
    .run();

  // 将API密钥ID和完整权限信息存入请求上下文
  c.set("apiKeyId", keyRecord.id);

  // 存储密钥名称和权限信息，以便API可以在需要时返回
  c.set("apiKeyInfo", {
    id: keyRecord.id,
    name: keyRecord.name,
    permissions: {
      text: keyRecord.text_permission === 1,
      file: keyRecord.file_permission === 1,
      mount: keyRecord.mount_permission === 1,
    },
  });

  // 继续处理请求
  await next();
};

/**
 * API密钥认证中间件（仅文件权限）
 * 验证请求头中的ApiKey是否有效并具有文件权限
 */
export const apiKeyFileMiddleware = async (c, next) => {
  const db = c.env.DB;

  // 获取认证头信息
  const authHeader = c.req.header("Authorization");

  // 检查是否有API密钥认证
  if (!authHeader || !authHeader.startsWith("ApiKey ")) {
    throw new HTTPException(ApiStatus.UNAUTHORIZED, { message: "需要API密钥授权" });
  }

  const apiKey = authHeader.substring(7);

  // 查询API密钥和权限
  const keyRecord = await db
    .prepare(
      `SELECT id, name, text_permission, file_permission, mount_permission, expires_at 
       FROM ${DbTables.API_KEYS} 
       WHERE key = ?`
    )
    .bind(apiKey)
    .first();

  // 检查API密钥是否存在且有文件权限
  if (!keyRecord || keyRecord.file_permission !== 1) {
    throw new HTTPException(ApiStatus.FORBIDDEN, { message: "API密钥没有文件权限" });
  }

  // 检查API密钥是否过期
  if (await checkAndDeleteExpiredApiKey(db, keyRecord)) {
    throw new HTTPException(ApiStatus.UNAUTHORIZED, { message: "API密钥已过期" });
  }

  // 更新最后使用时间
  await db
    .prepare(
      `UPDATE ${DbTables.API_KEYS}
       SET last_used = ?
       WHERE id = ?`
    )
    .bind(getLocalTimeString(), keyRecord.id)
    .run();

  // 将API密钥ID和完整权限信息存入请求上下文
  c.set("apiKeyId", keyRecord.id);

  // 存储密钥名称和权限信息，以便API可以在需要时返回
  c.set("apiKeyInfo", {
    id: keyRecord.id,
    name: keyRecord.name,
    permissions: {
      text: keyRecord.text_permission === 1,
      file: keyRecord.file_permission === 1,
      mount: keyRecord.mount_permission === 1,
    },
  });

  // 继续处理请求
  await next();
};

/**
 * API密钥认证中间件（仅挂载权限）
 * 验证请求头中的ApiKey是否有效并具有挂载权限
 */
export const apiKeyMountMiddleware = async (c, next) => {
  const db = c.env.DB;

  // 获取认证头信息
  const authHeader = c.req.header("Authorization");

  // 检查是否有API密钥认证
  if (!authHeader || !authHeader.startsWith("ApiKey ")) {
    throw new HTTPException(ApiStatus.UNAUTHORIZED, { message: "需要API密钥授权" });
  }

  const apiKey = authHeader.substring(7);

  // 查询API密钥和权限
  const keyRecord = await db
    .prepare(
      `SELECT id, name, text_permission, file_permission, mount_permission, expires_at 
       FROM ${DbTables.API_KEYS} 
       WHERE key = ?`
    )
    .bind(apiKey)
    .first();

  // 检查API密钥是否存在且有挂载权限
  if (!keyRecord || keyRecord.mount_permission !== 1) {
    throw new HTTPException(ApiStatus.FORBIDDEN, { message: "API密钥没有挂载点权限" });
  }

  // 检查API密钥是否过期
  if (await checkAndDeleteExpiredApiKey(db, keyRecord)) {
    throw new HTTPException(ApiStatus.UNAUTHORIZED, { message: "API密钥已过期" });
  }

  // 更新最后使用时间
  await db
    .prepare(
      `UPDATE ${DbTables.API_KEYS}
       SET last_used = ?
       WHERE id = ?`
    )
    .bind(getLocalTimeString(), keyRecord.id)
    .run();

  // 将API密钥ID和完整权限信息存入请求上下文
  c.set("apiKeyId", keyRecord.id);

  // 存储密钥名称和权限信息，以便API可以在需要时返回
  c.set("apiKeyInfo", {
    id: keyRecord.id,
    name: keyRecord.name,
    permissions: {
      text: keyRecord.text_permission === 1,
      file: keyRecord.file_permission === 1,
      mount: keyRecord.mount_permission === 1,
    },
  });

  // 继续处理请求
  await next();
};

/**
 * 通用API密钥认证中间件
 * 验证请求头中的ApiKey是否有效
 */
export const apiKeyMiddleware = async (c, next) => {
  // 检查请求头中是否包含API密钥
  const authHeader = c.req.header("Authorization") || "";
  const db = c.env.DB;

  if (!authHeader.startsWith("ApiKey ")) {
    return c.json(
      {
        code: ApiStatus.UNAUTHORIZED,
        message: "需要API密钥认证",
        data: null,
        success: false,
      },
      ApiStatus.UNAUTHORIZED
    );
  }

  const apiKey = authHeader.substring(7);

  try {
    // 查询数据库中的API密钥记录
    const keyRecord = await db
      .prepare(
        `
      SELECT id, name, text_permission, file_permission, mount_permission, expires_at
      FROM ${DbTables.API_KEYS}
      WHERE key = ?
    `
      )
      .bind(apiKey)
      .first();

    // 如果密钥不存在
    if (!keyRecord) {
      return c.json(
        {
          code: ApiStatus.UNAUTHORIZED,
          message: "无效的API密钥",
          data: null,
          success: false,
        },
        ApiStatus.UNAUTHORIZED
      );
    }

    // 检查是否过期
    if (await checkAndDeleteExpiredApiKey(db, keyRecord)) {
      return c.json(
        {
          code: ApiStatus.UNAUTHORIZED,
          message: "API密钥已过期",
          data: null,
          success: false,
        },
        ApiStatus.UNAUTHORIZED
      );
    }

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

    // 将密钥信息添加到上下文中
    c.set("apiKey", {
      id: keyRecord.id,
      name: keyRecord.name,
      textPermission: keyRecord.text_permission === 1,
      filePermission: keyRecord.file_permission === 1,
      mountPermission: keyRecord.mount_permission === 1,
    });

    // 将apiKeyId也单独添加到上下文中，确保test/api-key接口可以访问
    c.set("apiKeyId", keyRecord.id);

    return next();
  } catch (error) {
    console.error("API密钥验证错误:", error);
    return c.json(
      {
        code: ApiStatus.INTERNAL_ERROR,
        message: "API密钥验证失败: " + error.message,
        data: null,
        success: false,
      },
      ApiStatus.INTERNAL_ERROR
    );
  }
};
