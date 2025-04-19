import { DbTables, ApiStatus } from "../constants/index.js";
import { generateRandomString, getLocalTimeString, createErrorResponse } from "../utils/common.js";
import { hashPassword, verifyPassword } from "../utils/crypto.js";
import { HTTPException } from "hono/http-exception";
import { checkAndDeleteExpiredApiKey } from "./apiKeyService.js";

/**
 * 生成唯一的文本分享短链接slug
 * @param {D1Database} db - D1数据库实例
 * @param {string} customSlug - 自定义短链接
 * @returns {Promise<string>} 生成的唯一slug
 */
export async function generateUniqueSlug(db, customSlug = null) {
  if (customSlug) {
    // 添加格式验证：只允许字母、数字、连字符、下划线
    const slugRegex = /^[a-zA-Z0-9_-]+$/;
    if (!slugRegex.test(customSlug)) {
      throw new Error("链接后缀格式无效，只允许使用字母、数字、连字符(-)和下划线(_)");
    }

    // 检查自定义slug是否已在文本表中存在
    const existingPaste = await db.prepare(`SELECT id FROM ${DbTables.PASTES} WHERE slug = ?`).bind(customSlug).first();

    if (!existingPaste) {
      return customSlug;
    }
    // 如果自定义slug已存在，抛出特定错误
    throw new Error("链接后缀已被占用，请尝试其他后缀");
  }

  // 生成随机slug
  const attempts = 5;
  for (let i = 0; i < attempts; i++) {
    const slug = generateRandomString(6);

    // 检查随机slug是否已在文本表中存在
    const existingPaste = await db.prepare(`SELECT id FROM ${DbTables.PASTES} WHERE slug = ?`).bind(slug).first();

    if (!existingPaste) {
      return slug;
    }
  }

  throw new Error("无法生成唯一链接，请稍后再试");
}

/**
 * 增加文本分享查看次数并检查是否需要删除
 * @param {D1Database} db - D1数据库实例
 * @param {string} pasteId - 文本分享ID
 * @param {number} maxViews - 最大查看次数
 * @returns {Promise<void>}
 */
export async function incrementPasteViews(db, pasteId, maxViews) {
  // 增加查看次数
  await db.prepare(`UPDATE ${DbTables.PASTES} SET views = views + 1, updated_at = ? WHERE id = ?`).bind(getLocalTimeString(), pasteId).run();

  if (maxViews && maxViews > 0) {
    const updatedPaste = await db.prepare(`SELECT views FROM ${DbTables.PASTES} WHERE id = ?`).bind(pasteId).first();
    if (updatedPaste && updatedPaste.views >= maxViews) {
      console.log(`文本分享(${pasteId})已达到最大查看次数(${maxViews})，自动删除`);
      await db.prepare(`DELETE FROM ${DbTables.PASTES} WHERE id = ?`).bind(pasteId).run();
    }
  }
}

/**
 * 检查并删除过期的文本分享
 * @param {D1Database} db - D1数据库实例
 * @param {Object} paste - 文本分享对象
 * @returns {Promise<boolean>} 是否已过期并删除
 */
export async function checkAndDeleteExpiredPaste(db, paste) {
  if (!paste) return false;

  const now = new Date();

  // 检查过期时间
  if (paste.expires_at && new Date(paste.expires_at) < now) {
    console.log(`文本分享(${paste.id})已过期，自动删除`);
    await db.prepare(`DELETE FROM ${DbTables.PASTES} WHERE id = ?`).bind(paste.id).run();
    return true;
  }

  // 检查最大查看次数
  if (paste.max_views && paste.views >= paste.max_views) {
    console.log(`文本分享(${paste.id})已达到最大查看次数，自动删除`);
    await db.prepare(`DELETE FROM ${DbTables.PASTES} WHERE id = ?`).bind(paste.id).run();
    return true;
  }

  return false;
}

/**
 * 检查文本分享是否可访问
 * @param {Object} paste - 文本分享对象
 * @returns {boolean} 是否可访问
 */
export function isPasteAccessible(paste) {
  if (!paste) return false;

  const now = new Date();

  // 检查过期时间
  if (paste.expires_at && new Date(paste.expires_at) < now) {
    return false;
  }

  // 检查最大查看次数
  if (paste.max_views && paste.max_views > 0 && paste.views >= paste.max_views) {
    return false;
  }

  return true;
}

/**
 * 创建新的文本分享
 * @param {D1Database} db - D1数据库实例
 * @param {Object} pasteData - 文本分享数据
 * @param {string} createdBy - 创建者标识
 * @returns {Promise<Object>} 创建的文本分享
 */
export async function createPaste(db, pasteData, createdBy) {
  // 必须提供内容
  if (!pasteData.content) {
    throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "内容不能为空" });
  }

  // 验证可打开次数不能为负数
  if (pasteData.maxViews !== null && pasteData.maxViews !== undefined && parseInt(pasteData.maxViews) < 0) {
    throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "可打开次数不能为负数" });
  }

  // 生成唯一slug
  const slug = await generateUniqueSlug(db, pasteData.slug);
  const pasteId = crypto.randomUUID();

  // 处理密码 (如果提供)
  let passwordHash = null;
  if (pasteData.password) {
    passwordHash = await hashPassword(pasteData.password);
  }

  // 创建时间
  const now = new Date();
  const createdAt = now.toISOString();

  // 插入数据库
  await db
      .prepare(
          `
    INSERT INTO ${DbTables.PASTES} (
      id, slug, content, remark, password, 
      expires_at, max_views, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
      )
      .bind(pasteId, slug, pasteData.content, pasteData.remark || null, passwordHash, pasteData.expiresAt || null, pasteData.maxViews || null, createdBy, createdAt, createdAt)
      .run();

  // 如果设置了密码，将明文密码存入paste_passwords表
  if (pasteData.password) {
    await db
        .prepare(
            `
      INSERT INTO ${DbTables.PASTE_PASSWORDS} (
        paste_id, plain_password, created_at, updated_at
      ) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
        )
        .bind(pasteId, pasteData.password)
        .run();
  }

  // 返回创建结果
  return {
    id: pasteId,
    slug,
    remark: pasteData.remark,
    expiresAt: pasteData.expiresAt,
    maxViews: pasteData.maxViews,
    hasPassword: !!passwordHash,
    createdAt: createdAt,
  };
}

/**
 * 获取文本分享
 * @param {D1Database} db - D1数据库实例
 * @param {string} slug - 唯一标识
 * @returns {Promise<Object>} 文本分享
 */
export async function getPasteBySlug(db, slug) {
  // 查询paste
  const paste = await db
      .prepare(
          `
    SELECT id, slug, content, remark, password IS NOT NULL as has_password,
    expires_at, max_views, views, created_at, updated_at, created_by
    FROM ${DbTables.PASTES} WHERE slug = ?
  `
      )
      .bind(slug)
      .first();

  // 如果不存在则返回404
  if (!paste) {
    throw new HTTPException(ApiStatus.NOT_FOUND, { message: "文本分享不存在或已过期" });
  }

  // 检查是否过期并删除
  if (await checkAndDeleteExpiredPaste(db, paste)) {
    throw new HTTPException(ApiStatus.GONE, { message: "文本分享已过期或超过最大查看次数" });
  }

  return paste;
}

/**
 * 验证文本密码
 * @param {D1Database} db - D1数据库实例
 * @param {string} slug - 唯一标识
 * @param {string} password - 密码
 * @param {boolean} incrementViews - 是否增加查看次数，默认为true
 * @returns {Promise<Object>} 文本分享
 */
export async function verifyPastePassword(db, slug, password, incrementViews = true) {
  // 查询paste
  const paste = await db
      .prepare(
          `
    SELECT id, slug, content, remark, password,
    expires_at, max_views, views, created_at, updated_at, created_by
    FROM ${DbTables.PASTES} WHERE slug = ?
  `
      )
      .bind(slug)
      .first();

  // 如果不存在则返回404
  if (!paste) {
    throw new HTTPException(ApiStatus.NOT_FOUND, { message: "文本分享不存在" });
  }

  // 检查是否过期并删除
  if (await checkAndDeleteExpiredPaste(db, paste)) {
    throw new HTTPException(ApiStatus.GONE, { message: "文本分享已过期或超过最大查看次数" });
  }

  // 如果没有密码
  if (!paste.password) {
    throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "此文本分享无需密码" });
  }

  // 验证密码
  const isValid = await verifyPassword(password, paste.password);
  if (!isValid) {
    throw new HTTPException(ApiStatus.UNAUTHORIZED, { message: "密码错误" });
  }

  // 查询明文密码
  let plainPassword = null;
  const passwordRecord = await db.prepare(`SELECT plain_password FROM ${DbTables.PASTE_PASSWORDS} WHERE paste_id = ?`).bind(paste.id).first();

  if (passwordRecord) {
    plainPassword = passwordRecord.plain_password;
  }

  // 增加查看次数（如果需要）
  if (incrementViews) {
    await incrementPasteViews(db, paste.id, paste.max_views);
  }

  return {
    slug: paste.slug,
    content: paste.content,
    remark: paste.remark,
    hasPassword: true,
    plain_password: plainPassword,
    expiresAt: paste.expires_at,
    maxViews: paste.max_views,
    views: incrementViews ? paste.views + 1 : paste.views, // 根据是否增加次数返回对应的值
    createdAt: paste.created_at,
    updatedAt: paste.updated_at,
    created_by: paste.created_by,
  };
}

/**
 * 获取所有文本分享列表（管理员用）
 * @param {D1Database} db - D1数据库实例
 * @param {number} page - 页码
 * @param {number} limit - 每页条数
 * @param {string} createdBy - 创建者筛选
 * @returns {Promise<Object>} 分页结果
 */
export async function getAllPastes(db, page = 1, limit = 10, createdBy = null) {
  // 计算偏移量
  const offset = (page - 1) * limit;

  // 构建SQL查询和参数
  let countSql = `SELECT COUNT(*) as total FROM ${DbTables.PASTES}`;
  let querySql = `
    SELECT 
      id, 
      slug, 
      remark, 
      password IS NOT NULL as has_password,
      expires_at, 
      max_views, 
      views as view_count,
      created_by,
      CASE 
        WHEN LENGTH(content) > 200 THEN SUBSTR(content, 1, 200) || '...'
        ELSE content
      END as content_preview,
      created_at, 
      updated_at
    FROM ${DbTables.PASTES}
  `;

  const queryParams = [];

  // 如果指定了创建者，添加过滤条件
  if (createdBy) {
    countSql += ` WHERE created_by = ?`;
    querySql += ` WHERE created_by = ?`;
    queryParams.push(createdBy);
  }

  // 添加排序和分页
  querySql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  queryParams.push(limit, offset);

  // 获取总数（包括所有内容，根据筛选条件过滤）
  const countParams = createdBy ? [createdBy] : [];
  const countResult = await db
      .prepare(countSql)
      .bind(...countParams)
      .first();
  const total = countResult.total;

  // 查询分页数据，加入内容字段并做截断处理
  const pastes = await db
      .prepare(querySql)
      .bind(...queryParams)
      .all();

  // 处理查询结果，为API密钥创建者添加密钥名称
  let results = pastes.results;
  let keyNamesMap = new Map();

  // 收集所有需要查询名称的密钥ID
  const apiKeyIds = results.filter((paste) => paste.created_by && paste.created_by.startsWith("apikey:")).map((paste) => paste.created_by.substring(7));

  // 如果有需要查询名称的密钥
  if (apiKeyIds.length > 0) {
    // 使用Set去重
    const uniqueKeyIds = [...new Set(apiKeyIds)];

    // 为每个唯一的密钥ID查询名称
    for (const keyId of uniqueKeyIds) {
      const keyInfo = await db.prepare(`SELECT id, name FROM ${DbTables.API_KEYS} WHERE id = ?`).bind(keyId).first();

      if (keyInfo) {
        keyNamesMap.set(keyId, keyInfo.name);
      }
    }

    // 为每个结果添加key_name字段
    results = results.map((paste) => {
      if (paste.created_by && paste.created_by.startsWith("apikey:")) {
        const keyId = paste.created_by.substring(7);
        const keyName = keyNamesMap.get(keyId);
        if (keyName) {
          return { ...paste, key_name: keyName };
        }
      }
      return paste;
    });
  }

  return {
    results,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * 获取用户文本列表
 * @param {D1Database} db - D1数据库实例
 * @param {string} apiKeyId - API密钥ID
 * @param {number} limit - 每页条数
 * @param {number} offset - 偏移量
 * @returns {Promise<Object>} 分页结果
 */
export async function getUserPastes(db, apiKeyId, limit = 30, offset = 0) {
  // 查询文本分享记录
  const pastes = await db
      .prepare(
          `
    SELECT id, slug, content, remark, password IS NOT NULL as has_password,
    expires_at, max_views, views, created_at, updated_at, created_by
    FROM ${DbTables.PASTES}
    WHERE created_by = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `
      )
      .bind(`apikey:${apiKeyId}`, limit, offset)
      .all();

  // 查询总数
  const countResult = await db.prepare(`SELECT COUNT(*) as total FROM ${DbTables.PASTES} WHERE created_by = ?`).bind(`apikey:${apiKeyId}`).first();

  const total = countResult?.total || 0;

  // 如果有created_by字段并且以apikey:开头，查询密钥名称
  let results = pastes.results;
  let keyNamesMap = new Map();

  // 收集所有需要查询名称的密钥ID
  const apiKeyIds = results.filter((paste) => paste.created_by && paste.created_by.startsWith("apikey:")).map((paste) => paste.created_by.substring(7));

  // 如果有需要查询名称的密钥
  if (apiKeyIds.length > 0) {
    // 使用Set去重
    const uniqueKeyIds = [...new Set(apiKeyIds)];

    // 为每个唯一的密钥ID查询名称
    for (const keyId of uniqueKeyIds) {
      const keyInfo = await db.prepare(`SELECT id, name FROM ${DbTables.API_KEYS} WHERE id = ?`).bind(keyId).first();

      if (keyInfo) {
        keyNamesMap.set(keyId, keyInfo.name);
      }
    }

    // 为每个结果添加key_name字段
    results = results.map((paste) => {
      if (paste.created_by && paste.created_by.startsWith("apikey:")) {
        const keyId = paste.created_by.substring(7);
        const keyName = keyNamesMap.get(keyId);
        if (keyName) {
          return { ...paste, key_name: keyName };
        }
      }
      return paste;
    });
  }

  return {
    results,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
  };
}

/**
 * 获取单个文本详情（管理员用）
 * @param {D1Database} db - D1数据库实例
 * @param {string} id - 文本ID
 * @returns {Promise<Object>} 文本详情
 */
export async function getPasteById(db, id) {
  // 查询文本分享记录
  const paste = await db
      .prepare(
          `
    SELECT 
      id, slug, content, remark, password IS NOT NULL as has_password,
      expires_at, max_views, views, created_at, updated_at, created_by
    FROM ${DbTables.PASTES}
    WHERE id = ?
  `
      )
      .bind(id)
      .first();

  if (!paste) {
    throw new HTTPException(ApiStatus.NOT_FOUND, { message: "文本分享不存在" });
  }

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

  return result;
}

/**
 * 删除文本分享
 * @param {D1Database} db - D1数据库实例
 * @param {string} id - 文本ID
 * @returns {Promise<void>}
 */
export async function deletePaste(db, id) {
  // 检查分享是否存在
  const paste = await db.prepare(`SELECT id FROM ${DbTables.PASTES} WHERE id = ?`).bind(id).first();

  if (!paste) {
    throw new HTTPException(ApiStatus.NOT_FOUND, { message: "文本分享不存在" });
  }

  // 删除分享
  await db.prepare(`DELETE FROM ${DbTables.PASTES} WHERE id = ?`).bind(id).run();
}

/**
 * 批量删除文本分享
 * @param {D1Database} db - D1数据库实例
 * @param {Array<string>} ids - 文本ID数组
 * @param {boolean} clearExpired - 是否清理过期内容
 * @returns {Promise<number>} 删除的数量
 */
export async function batchDeletePastes(db, ids, clearExpired = false) {
  let deletedCount = 0;

  // 如果指定了清理过期内容
  if (clearExpired) {
    const now = new Date().toISOString();
    const result = await db.prepare(`DELETE FROM ${DbTables.PASTES} WHERE expires_at IS NOT NULL AND expires_at < ?`).bind(now).run();

    deletedCount = result.changes || 0;
    return deletedCount;
  }

  // 否则按照指定的ID删除
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "请提供有效的ID数组" });
  }

  // 构建参数占位符
  const placeholders = ids.map(() => "?").join(",");

  // 执行批量删除
  const result = await db
      .prepare(`DELETE FROM ${DbTables.PASTES} WHERE id IN (${placeholders})`)
      .bind(...ids)
      .run();

  deletedCount = result.changes || ids.length;
  return deletedCount;
}

/**
 * 批量删除用户的文本分享
 * @param {D1Database} db - D1数据库实例
 * @param {Array<string>} ids - 文本ID数组
 * @param {string} apiKeyId - API密钥ID
 * @returns {Promise<number>} 删除的数量
 */
export async function batchDeleteUserPastes(db, ids, apiKeyId) {
  // 验证请求数据
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "请提供有效的ID数组" });
  }

  // 构建参数占位符
  const placeholders = ids.map(() => "?").join(",");

  // 构建完整的参数数组（包含所有ID和创建者标识）
  const bindParams = [...ids, `apikey:${apiKeyId}`];

  // 执行批量删除（只删除属于该API密钥用户的文本）
  const result = await db
      .prepare(`DELETE FROM ${DbTables.PASTES} WHERE id IN (${placeholders}) AND created_by = ?`)
      .bind(...bindParams)
      .run();

  return result.changes || 0;
}

/**
 * 更新文本分享
 * @param {D1Database} db - D1数据库实例
 * @param {string} slug - 唯一标识
 * @param {Object} updateData - 更新数据
 * @param {string} createdBy - 创建者标识（可选，用于权限检查）
 * @returns {Promise<Object>} 更新后的信息
 */
export async function updatePaste(db, slug, updateData, createdBy = null) {
  // 查询条件
  let queryCondition = `slug = ?`;
  let queryParams = [slug];

  // 如果提供了创建者标识，增加条件
  if (createdBy) {
    queryCondition += ` AND created_by = ?`;
    queryParams.push(createdBy);
  }

  // 检查分享是否存在
  const paste = await db
      .prepare(`SELECT id, slug, expires_at, max_views, views FROM ${DbTables.PASTES} WHERE ${queryCondition}`)
      .bind(...queryParams)
      .first();

  if (!paste) {
    throw new HTTPException(ApiStatus.NOT_FOUND, { message: "文本分享不存在或无权修改" });
  }

  // 检查是否过期
  if (await checkAndDeleteExpiredPaste(db, paste)) {
    throw new HTTPException(ApiStatus.GONE, { message: "文本分享已过期或超过最大查看次数，无法修改" });
  }

  // 验证内容
  if (!updateData.content) {
    throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "内容不能为空" });
  }

  // 验证可打开次数
  if (updateData.maxViews !== null && updateData.maxViews !== undefined && parseInt(updateData.maxViews) < 0) {
    throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "可打开次数不能为负数" });
  }

  // 处理密码更新
  let passwordSql = "";
  const sqlParams = [];

  if (updateData.password) {
    // 如果提供了新密码，则更新
    const passwordHash = await hashPassword(updateData.password);
    passwordSql = "password = ?, ";
    sqlParams.push(passwordHash);

    // 更新或插入paste_passwords表中的明文密码
    // 先检查是否已存在记录
    const existingPassword = await db.prepare(`SELECT paste_id FROM ${DbTables.PASTE_PASSWORDS} WHERE paste_id = ?`).bind(paste.id).first();

    if (existingPassword) {
      // 更新现有记录
      await db.prepare(`UPDATE ${DbTables.PASTE_PASSWORDS} SET plain_password = ?, updated_at = CURRENT_TIMESTAMP WHERE paste_id = ?`).bind(updateData.password, paste.id).run();
    } else {
      // 插入新记录
      await db
          .prepare(
              `INSERT INTO ${DbTables.PASTE_PASSWORDS} (paste_id, plain_password, created_at, updated_at) 
           VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
          )
          .bind(paste.id, updateData.password)
          .run();
    }
  } else if (updateData.clearPassword) {
    // 如果指定了清除密码
    passwordSql = "password = NULL, ";

    // 同时删除paste_passwords表中的记录
    await db.prepare(`DELETE FROM ${DbTables.PASTE_PASSWORDS} WHERE paste_id = ?`).bind(paste.id).run();
  }

  // 处理slug更新
  let newSlug = paste.slug; // 默认保持原slug不变
  let slugSql = "";

  // 如果提供了新的slug，则生成唯一slug
  if (updateData.newSlug !== undefined) {
    try {
      // 如果newSlug为空或null，则自动生成随机slug
      newSlug = await generateUniqueSlug(db, updateData.newSlug || null);
      // 设置更新SQL
      slugSql = "slug = ?, ";
      // 将新slug添加到参数列表
      sqlParams.push(newSlug);
    } catch (error) {
      // 如果slug已被占用，返回409冲突错误
      if (error.message.includes("链接后缀已被占用")) {
        throw new HTTPException(ApiStatus.CONFLICT, { message: error.message });
      }
      throw error;
    }
  }

  // 检查是否修改了最大查看次数
  const isMaxViewsChanged = updateData.maxViews !== null && updateData.maxViews !== undefined && updateData.maxViews !== paste.max_views;

  // 构建更新SQL
  const sql = `
    UPDATE ${DbTables.PASTES} 
    SET 
      ${passwordSql}
      ${slugSql}
      content = ?, 
      remark = ?, 
      expires_at = ?, 
      max_views = ?,
      views = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  // 构建参数列表
  sqlParams.push(
      updateData.content,
      updateData.remark || null,
      updateData.expiresAt || null,
      updateData.maxViews || null,
      // 如果更新了max_views且新值小于当前views，则重置views为0
      isMaxViewsChanged && updateData.maxViews < paste.views ? 0 : paste.views,
      paste.id
  );

  // 执行更新
  await db
      .prepare(sql)
      .bind(...sqlParams)
      .run();

  // 返回更新结果
  return {
    id: paste.id,
    slug: newSlug, // 返回更新后的slug（可能已更改）
  };
}
