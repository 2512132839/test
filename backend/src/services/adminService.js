import { DbTables, ApiStatus } from "../constants/index.js";
import { generateRandomString, createErrorResponse } from "../utils/common.js";
import { hashPassword, verifyPassword } from "../utils/crypto.js";
import { HTTPException } from "hono/http-exception";

/**
 * 验证管理员令牌
 * @param {D1Database} db - D1数据库实例
 * @param {string} token - JWT令牌
 * @returns {Promise<string|null>} 管理员ID或null
 */
export async function validateAdminToken(db, token) {
  console.log("验证管理员令牌:", token.substring(0, 5) + "..." + token.substring(token.length - 5));

  try {
    // 查询令牌是否存在并且未过期
    const result = await db
      .prepare(
        `SELECT admin_id, expires_at 
         FROM ${DbTables.ADMIN_TOKENS} 
         WHERE token = ?`
      )
      .bind(token)
      .first();

    if (!result) {
      console.log("令牌不存在");
      return null;
    }

    const expiresAt = new Date(result.expires_at);
    const now = new Date();

    // 检查令牌是否已过期
    if (now > expiresAt) {
      console.log("令牌已过期", { expiresAt: expiresAt.toISOString(), now: now.toISOString() });
      // 删除过期的令牌
      await db.prepare(`DELETE FROM ${DbTables.ADMIN_TOKENS} WHERE token = ?`).bind(token).run();
      return null;
    }

    console.log("令牌验证成功，管理员ID:", result.admin_id);
    return result.admin_id;
  } catch (error) {
    console.error("验证令牌时发生错误:", error);
    return null;
  }
}

/**
 * 管理员登录
 * @param {D1Database} db - D1数据库实例
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @returns {Promise<Object>} 登录结果，包含token和过期时间
 */
export async function login(db, username, password) {
  // 参数验证
  if (!username || !password) {
    throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "用户名和密码不能为空" });
  }

  // 查询管理员
  const admin = await db.prepare(`SELECT id, username, password FROM ${DbTables.ADMINS} WHERE username = ?`).bind(username).first();

  if (!admin) {
    throw new HTTPException(ApiStatus.UNAUTHORIZED, { message: "用户名或密码错误" });
  }

  // 验证密码
  const isValid = await verifyPassword(password, admin.password);
  if (!isValid) {
    throw new HTTPException(ApiStatus.UNAUTHORIZED, { message: "用户名或密码错误" });
  }

  // 生成并存储令牌
  const token = generateRandomString(32);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 1); // 1天过期

  await db
    .prepare(
      `
    INSERT INTO ${DbTables.ADMIN_TOKENS} (token, admin_id, expires_at)
    VALUES (?, ?, ?)
  `
    )
    .bind(token, admin.id, expiresAt.toISOString())
    .run();

  // 返回认证信息
  return {
    username: admin.username,
    token,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * 管理员登出
 * @param {D1Database} db - D1数据库实例
 * @param {string} token - 认证令牌
 * @returns {Promise<void>}
 */
export async function logout(db, token) {
  // 从数据库删除token
  await db.prepare(`DELETE FROM ${DbTables.ADMIN_TOKENS} WHERE token = ?`).bind(token).run();
}

/**
 * 更改管理员密码或用户名
 * @param {D1Database} db - D1数据库实例
 * @param {string} adminId - 管理员ID
 * @param {string} currentPassword - 当前密码
 * @param {string} newPassword - 新密码，可选
 * @param {string} newUsername - 新用户名，可选
 * @returns {Promise<void>}
 */
export async function changePassword(db, adminId, currentPassword, newPassword, newUsername) {
  // 验证当前密码
  const admin = await db.prepare(`SELECT password FROM ${DbTables.ADMINS} WHERE id = ?`).bind(adminId).first();

  if (!(await verifyPassword(currentPassword, admin.password))) {
    throw new HTTPException(ApiStatus.UNAUTHORIZED, { message: "当前密码错误" });
  }

  // 检查新密码是否与当前密码相同
  if (newPassword && (await verifyPassword(newPassword, admin.password))) {
    throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "新密码不能与当前密码相同" });
  }

  // 如果提供了新用户名，先检查用户名是否已存在
  if (newUsername && newUsername.trim() !== "") {
    const existingAdmin = await db.prepare(`SELECT id FROM ${DbTables.ADMINS} WHERE username = ? AND id != ?`).bind(newUsername, adminId).first();

    if (existingAdmin) {
      throw new HTTPException(ApiStatus.CONFLICT, { message: "用户名已存在" });
    }

    // 更新用户名和密码
    const newPasswordHash = newPassword ? await hashPassword(newPassword) : admin.password;

    await db
      .prepare(
        `
      UPDATE ${DbTables.ADMINS} 
      SET username = ?, password = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
      )
      .bind(newUsername, newPasswordHash, adminId)
      .run();
  } else if (newPassword) {
    // 仅更新密码
    const newPasswordHash = await hashPassword(newPassword);
    await db
      .prepare(
        `
      UPDATE ${DbTables.ADMINS} 
      SET password = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
      )
      .bind(newPasswordHash, adminId)
      .run();
  } else {
    throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "未提供新密码或新用户名" });
  }

  // 成功修改后，删除该管理员的所有认证令牌，强制重新登录
  await db.prepare(`DELETE FROM ${DbTables.ADMIN_TOKENS} WHERE admin_id = ?`).bind(adminId).run();
}

/**
 * 测试管理员令牌是否有效
 * @param {D1Database} db - D1数据库实例
 * @param {string} token - JWT令牌
 * @returns {Promise<boolean>} 令牌是否有效
 */
export async function testAdminToken(db, token) {
  const adminId = await validateAdminToken(db, token);
  return adminId !== null;
}
