import { DbTables } from "../constants/index.js";
import { generateRandomString, createErrorResponse } from "../utils/common.js";
import { ApiStatus } from "../constants/index.js";

/**
 * 检查并删除过期的API密钥
 * @param {D1Database} db - D1数据库实例
 * @param {Object} key - API密钥对象
 * @returns {Promise<boolean>} 是否已过期并删除
 */
export async function checkAndDeleteExpiredApiKey(db, key) {
  if (!key) return true;

  const now = new Date();

  // 检查过期时间
  if (key.expires_at && new Date(key.expires_at) < now) {
    console.log(`API密钥(${key.id})已过期，自动删除`);
    await db.prepare(`DELETE FROM ${DbTables.API_KEYS} WHERE id = ?`).bind(key.id).run();
    return true;
  }

  return false;
}

/**
 * 获取所有API密钥
 * @param {D1Database} db - D1数据库实例
 * @returns {Promise<Array>} API密钥列表
 */
export async function getAllApiKeys(db) {
  // 先清理过期的API密钥
  const now = new Date().toISOString();
  await db.prepare(`DELETE FROM ${DbTables.API_KEYS} WHERE expires_at IS NOT NULL AND expires_at < ?`).bind(now).run();

  // 查询所有密钥，并隐藏完整密钥
  const keys = await db
      .prepare(
          `
    SELECT 
      id, 
      name, 
      key,
      SUBSTR(key, 1, 6) || '...' AS key_masked,
      text_permission, 
      file_permission, 
      mount_permission,
      created_at, 
      expires_at,
      last_used
    FROM ${DbTables.API_KEYS}
    ORDER BY created_at DESC
  `
      )
      .all();

  return keys.results;
}

/**
 * 创建新的API密钥
 * @param {D1Database} db - D1数据库实例
 * @param {Object} keyData - API密钥数据
 * @returns {Promise<Object>} 创建的API密钥
 */
export async function createApiKey(db, keyData) {
  // 必需参数：名称验证
  if (!keyData.name || keyData.name.trim() === "") {
    throw new Error("密钥名称不能为空");
  }

  // 如果用户提供了自定义密钥，验证其格式
  if (keyData.custom_key) {
    // 验证密钥格式：只允许字母、数字、横杠和下划线
    const keyFormatRegex = /^[a-zA-Z0-9_-]+$/;
    if (!keyFormatRegex.test(keyData.custom_key)) {
      throw new Error("密钥只能包含字母、数字、横杠和下划线");
    }
  }

  // 生成唯一ID
  const id = crypto.randomUUID();

  // 生成API密钥，如果有自定义密钥则使用自定义密钥
  const key = keyData.custom_key ? keyData.custom_key : generateRandomString(12);

  // 处理过期时间，默认为1天后
  const now = new Date();
  let expiresAt;

  if (keyData.expires_at === null || keyData.expires_at === "never") {
    // 永不过期 - 使用远未来日期（9999-12-31）
    expiresAt = new Date("9999-12-31T23:59:59Z");
  } else if (keyData.expires_at) {
    expiresAt = new Date(keyData.expires_at);
  } else {
    expiresAt = new Date();
    expiresAt.setDate(now.getDate() + 1); // 默认一天后过期
  }

  // 确保日期是有效的
  if (isNaN(expiresAt.getTime())) {
    throw new Error("无效的过期时间");
  }

  // 对text_permission和file_permission提供默认值
  const textPermission = keyData.text_permission === true ? 1 : 0;
  const filePermission = keyData.file_permission === true ? 1 : 0;
  const mountPermission = keyData.mount_permission === true ? 1 : 0;

  // 创建时间
  const createdAt = now.toISOString();

  // 插入到数据库
  await db
      .prepare(
          `
    INSERT INTO ${DbTables.API_KEYS} (id, name, key, text_permission, file_permission, mount_permission, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
      )
      .bind(id, keyData.name.trim(), key, textPermission, filePermission, mountPermission, expiresAt.toISOString(), createdAt)
      .run();

  // 准备响应数据
  return {
    id,
    name: keyData.name.trim(),
    key,
    key_masked: key.substring(0, 6) + "...", // 前端期望的密钥掩码
    text_permission: textPermission === 1,
    file_permission: filePermission === 1,
    mount_permission: mountPermission === 1,
    created_at: createdAt,
    expires_at: expiresAt.toISOString(),
  };
}

/**
 * 更新API密钥
 * @param {D1Database} db - D1数据库实例
 * @param {string} id - API密钥ID
 * @param {Object} updateData - 更新数据
 * @returns {Promise<void>}
 */
export async function updateApiKey(db, id, updateData) {
  // 检查密钥是否存在
  const keyExists = await db.prepare(`SELECT id, name, key FROM ${DbTables.API_KEYS} WHERE id = ?`).bind(id).first();

  if (!keyExists) {
    throw new Error("密钥不存在");
  }

  // 验证名称
  if (updateData.name && !updateData.name.trim()) {
    throw new Error("密钥名称不能为空");
  }

  // 检查名称是否已存在（排除当前密钥）
  if (updateData.name && updateData.name !== keyExists.name) {
    const nameExists = await db.prepare(`SELECT id FROM ${DbTables.API_KEYS} WHERE name = ? AND id != ?`).bind(updateData.name.trim(), id).first();

    if (nameExists) {
      throw new Error("密钥名称已存在");
    }
  }

  // 处理过期时间
  let expiresAt = null;
  if (updateData.expires_at === null || updateData.expires_at === "never") {
    // 永不过期 - 使用远未来日期（9999-12-31）
    expiresAt = new Date("9999-12-31T23:59:59Z");
  } else if (updateData.expires_at) {
    expiresAt = new Date(updateData.expires_at);

    // 确保日期是有效的
    if (isNaN(expiresAt.getTime())) {
      throw new Error("无效的过期时间");
    }
  }

  // 构建更新 SQL
  const updates = [];
  const params = [];

  // 只更新提供的字段
  if (updateData.name !== undefined) {
    updates.push("name = ?");
    params.push(updateData.name.trim());
  }

  if (updateData.text_permission !== undefined) {
    updates.push("text_permission = ?");
    params.push(updateData.text_permission ? 1 : 0);
  }

  if (updateData.file_permission !== undefined) {
    updates.push("file_permission = ?");
    params.push(updateData.file_permission ? 1 : 0);
  }

  if (updateData.mount_permission !== undefined) {
    updates.push("mount_permission = ?");
    params.push(updateData.mount_permission ? 1 : 0);
  }

  if (expiresAt !== null) {
    updates.push("expires_at = ?");
    params.push(expiresAt.toISOString());
  }

  // 如果没有要更新的字段，直接返回
  if (updates.length === 0) {
    throw new Error("没有提供有效的更新字段");
  }

  // 添加 ID 参数
  params.push(id);

  // 执行更新
  await db
      .prepare(`UPDATE ${DbTables.API_KEYS} SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();
}

/**
 * 删除API密钥
 * @param {D1Database} db - D1数据库实例
 * @param {string} id - API密钥ID
 * @returns {Promise<void>}
 */
export async function deleteApiKey(db, id) {
  // 检查密钥是否存在
  const keyExists = await db.prepare(`SELECT id FROM ${DbTables.API_KEYS} WHERE id = ?`).bind(id).first();

  if (!keyExists) {
    throw new Error("密钥不存在");
  }

  // 删除密钥
  await db.prepare(`DELETE FROM ${DbTables.API_KEYS} WHERE id = ?`).bind(id).run();
}

/**
 * 获取API密钥信息
 * @param {D1Database} db - D1数据库实例
 * @param {string} key - API密钥
 * @returns {Promise<Object|null>} API密钥信息
 */
export async function getApiKeyByKey(db, key) {
  if (!key) return null;

  const result = await db
      .prepare(
          `SELECT id, name, key, text_permission, file_permission, mount_permission, expires_at, last_used
       FROM ${DbTables.API_KEYS}
       WHERE key = ?`
      )
      .bind(key)
      .first();

  return result;
}

/**
 * 更新API密钥最后使用时间
 * @param {D1Database} db - D1数据库实例
 * @param {string} id - API密钥ID
 * @returns {Promise<void>}
 */
export async function updateApiKeyLastUsed(db, id) {
  const now = new Date().toISOString();
  await db.prepare(`UPDATE ${DbTables.API_KEYS} SET last_used = ? WHERE id = ?`).bind(now, id).run();
}
