/**
 * 存储挂载配置服务
 */
import { DbTables, ApiStatus } from "../constants/index.js";
import { HTTPException } from "hono/http-exception";
import { getLocalTimeString, generateUUID } from "../utils/common.js";

/**
 * 获取管理员的挂载点列表
 * @param {D1Database} db - D1数据库实例
 * @param {string} adminId - 管理员ID
 * @returns {Promise<Array>} 挂载点列表
 * @throws {Error} 数据库操作错误
 */
export async function getMountsByAdmin(db, adminId) {
  const mounts = await db
      .prepare(
          `
      SELECT 
        id, name, storage_type, storage_config_id, mount_path, 
        remark, is_active, created_by, sort_order, cache_ttl,
        created_at, updated_at, last_used
      FROM ${DbTables.STORAGE_MOUNTS}
      WHERE created_by = ?
      ORDER BY sort_order ASC, name ASC
      `
      )
      .bind(adminId)
      .all();

  return mounts.results;
}

/**
 * 获取所有挂载点列表（管理员专用）
 * @param {D1Database} db - D1数据库实例
 * @returns {Promise<Array>} 所有挂载点列表
 * @throws {Error} 数据库操作错误
 */
export async function getAllMounts(db) {
  const mounts = await db
      .prepare(
          `
      SELECT 
        id, name, storage_type, storage_config_id, mount_path, 
        remark, is_active, created_by, sort_order, cache_ttl,
        created_at, updated_at, last_used
      FROM ${DbTables.STORAGE_MOUNTS}
      ORDER BY sort_order ASC, name ASC
      `
      )
      .all();

  return mounts.results;
}

/**
 * 获取API密钥用户的挂载点列表
 * @param {D1Database} db - D1数据库实例
 * @param {string} apiKeyId - API密钥ID
 * @returns {Promise<Array>} 挂载点列表（仅包含激活状态的挂载点）
 * @throws {Error} 数据库操作错误
 */
export async function getMountsByApiKey(db, apiKeyId) {
  const mounts = await db
      .prepare(
          `
      SELECT 
        id, name, storage_type, storage_config_id, mount_path, 
        remark, is_active, created_by, sort_order, cache_ttl,
        created_at, updated_at, last_used
      FROM ${DbTables.STORAGE_MOUNTS}
      WHERE created_by = ? AND is_active = 1
      ORDER BY sort_order ASC, name ASC
      `
      )
      .bind(apiKeyId)
      .all();

  return mounts.results;
}

/**
 * 通过ID获取挂载点（管理员访问）
 * @param {D1Database} db - D1数据库实例
 * @param {string} id - 挂载点ID
 * @param {string} adminId - 管理员ID（仅用于记录访问，不作权限限制）
 * @returns {Promise<Object>} 挂载点对象
 * @throws {HTTPException} 404 - 如果挂载点不存在
 * @throws {Error} 数据库操作错误
 */
export async function getMountByIdForAdmin(db, id, adminId) {
  const mount = await db
      .prepare(
          `
      SELECT 
        id, name, storage_type, storage_config_id, mount_path, 
        remark, is_active, created_by, sort_order, cache_ttl,
        created_at, updated_at, last_used
      FROM ${DbTables.STORAGE_MOUNTS}
      WHERE id = ?
    `
      )
      .bind(id)
      .first();

  if (!mount) {
    throw new HTTPException(ApiStatus.NOT_FOUND, { message: "挂载点不存在" });
  }

  return mount;
}

/**
 * 通过ID获取API密钥用户的挂载点
 * @param {D1Database} db - D1数据库实例
 * @param {string} id - 挂载点ID
 * @param {string} apiKeyId - API密钥ID
 * @returns {Promise<Object>} 挂载点对象
 * @throws {HTTPException} 404 - 如果挂载点不存在或未激活
 * @throws {Error} 数据库操作错误
 */
export async function getMountByIdForApiKey(db, id, apiKeyId) {
  const mount = await db
      .prepare(
          `
      SELECT 
        id, name, storage_type, storage_config_id, mount_path, 
        remark, is_active, created_by, sort_order, cache_ttl,
        created_at, updated_at, last_used
      FROM ${DbTables.STORAGE_MOUNTS}
      WHERE id = ? AND created_by = ? AND is_active = 1
    `
      )
      .bind(id, apiKeyId)
      .first();

  if (!mount) {
    throw new HTTPException(ApiStatus.NOT_FOUND, { message: "挂载点不存在" });
  }

  return mount;
}

/**
 * 验证挂载路径格式
 * @param {string} mountPath - 挂载路径
 * @throws {HTTPException} 400 - 如果路径格式无效、包含非法字符、使用保留路径等
 */
function validateMountPath(mountPath) {
  // 验证挂载路径格式
  if (!mountPath) {
    throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "挂载路径不能为空" });
  }

  // 路径必须以斜杠开头
  if (!mountPath.startsWith("/")) {
    throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "挂载路径必须以斜杠(/)开头" });
  }

  // 路径不应以斜杠结尾（除了根路径"/"）
  if (mountPath.length > 1 && mountPath.endsWith("/")) {
    throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "挂载路径不应以斜杠结尾" });
  }

  // 不允许连续多个斜杠
  if (mountPath.includes("//")) {
    throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "挂载路径不能包含连续的斜杠" });
  }
  // 支持Unicode字符但排除特殊符号
  const validPathRegex = /^\/(?:[A-Za-z0-9_\-\/]|[\u4e00-\u9fa5]|[\u0080-\uFFFF])+$/;
  if (!validPathRegex.test(mountPath)) {
    throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "挂载路径只能包含字母、数字、中文、下划线、连字符和斜杠，不允许其他特殊字符" });
  }

  // 路径长度限制
  if (mountPath.length > 100) {
    throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "挂载路径不能超过100个字符" });
  }

  // 不允许的系统路径
  const forbiddenPaths = ["/bin", "/etc", "/lib", "/root", "/sys", "/proc", "/dev", "/tmp", "/opt", "/var"];
  for (const path of forbiddenPaths) {
    if (mountPath === path || mountPath.startsWith(`${path}/`)) {
      throw new HTTPException(ApiStatus.BAD_REQUEST, { message: `不允许使用系统保留路径: ${path}` });
    }
  }

  // 不允许的应用路径
  const forbiddenAppPaths = ["/api", "/admin", "/user", "/auth", "/public", "/static", "/assets", "/upload"];
  for (const path of forbiddenAppPaths) {
    if (mountPath === path || mountPath.startsWith(`${path}/`)) {
      throw new HTTPException(ApiStatus.BAD_REQUEST, { message: `不允许使用应用保留路径: ${path}` });
    }
  }
}

/**
 * 创建挂载点
 * @param {D1Database} db - D1数据库实例
 * @param {Object} mountData - 挂载点数据
 * @param {string} mountData.name - 挂载点名称
 * @param {string} mountData.storage_type - 存储类型（如'S3'）
 * @param {string} mountData.mount_path - 挂载路径
 * @param {string} [mountData.storage_config_id] - 存储配置ID（对S3类型必需）
 * @param {string} [mountData.remark] - 备注
 * @param {boolean} [mountData.is_active=true] - 是否激活
 * @param {number} [mountData.sort_order=0] - 排序顺序
 * @param {number} [mountData.cache_ttl=300] - 缓存时间（秒）
 * @param {string} creatorId - 创建者ID
 * @returns {Promise<Object>} 创建的挂载点完整信息
 * @throws {HTTPException} 400 - 参数错误，包括缺少必填字段、路径格式错误等
 * @throws {HTTPException} 409 - 挂载路径已存在冲突
 * @throws {Error} 数据库操作错误
 */
export async function createMount(db, mountData, creatorId) {
  // 验证必填字段
  const requiredFields = ["name", "storage_type", "mount_path"];
  for (const field of requiredFields) {
    if (!mountData[field]) {
      throw new HTTPException(ApiStatus.BAD_REQUEST, { message: `缺少必填字段: ${field}` });
    }
  }

  // 验证挂载路径
  validateMountPath(mountData.mount_path);

  // 检查挂载路径是否已存在
  const existingMount = await db.prepare(`SELECT id FROM ${DbTables.STORAGE_MOUNTS} WHERE mount_path = ?`).bind(mountData.mount_path).first();

  if (existingMount) {
    throw new HTTPException(ApiStatus.CONFLICT, { message: "挂载路径已被使用" });
  }

  // 生成唯一ID
  const id = generateUUID();

  // 如果是S3类型，验证storage_config_id是否存在
  if (mountData.storage_type === "S3" && mountData.storage_config_id) {
    const s3Config = await db.prepare(`SELECT id FROM ${DbTables.S3_CONFIGS} WHERE id = ?`).bind(mountData.storage_config_id).first();

    if (!s3Config) {
      throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "指定的S3配置不存在" });
    }

    console.log(`创建挂载点: ${mountData.name}, 类型: S3, 使用S3配置ID: ${mountData.storage_config_id}`);
  } else if (mountData.storage_type === "S3" && !mountData.storage_config_id) {
    console.log(`创建S3类型挂载点: ${mountData.name}，但未指定S3配置ID`);
  } else {
    console.log(`创建挂载点: ${mountData.name}, 类型: ${mountData.storage_type}, 路径: ${mountData.mount_path}`);
  }

  // 处理可选字段
  const isActive = mountData.is_active === true || mountData.is_active === undefined ? 1 : 0;

  // 设置排序顺序和缓存时间
  const sortOrder = mountData.sort_order || 0;
  const cacheTtl = mountData.cache_ttl || 300; // 默认5分钟

  // 添加到数据库
  await db
      .prepare(
          `
      INSERT INTO ${DbTables.STORAGE_MOUNTS} (
        id, name, storage_type, storage_config_id, mount_path, 
        remark, is_active, created_by, sort_order, cache_ttl,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, 
        ?, ?, ?, ?, ?,
        ?, ?
      )
    `
      )
      .bind(
          id,
          mountData.name,
          mountData.storage_type,
          mountData.storage_config_id || null,
          mountData.mount_path,
          mountData.remark || null,
          isActive,
          creatorId,
          sortOrder,
          cacheTtl,
          getLocalTimeString(),
          getLocalTimeString()
      )
      .run();

  // 返回创建的挂载点
  return {
    id,
    name: mountData.name,
    storage_type: mountData.storage_type,
    storage_config_id: mountData.storage_config_id || null,
    mount_path: mountData.mount_path,
    remark: mountData.remark || null,
    is_active: isActive === 1,
    created_by: creatorId,
    sort_order: sortOrder,
    cache_ttl: cacheTtl,
    created_at: getLocalTimeString(),
    updated_at: getLocalTimeString(),
  };
}

/**
 * 更新挂载点
 * @param {D1Database} db - D1数据库实例
 * @param {string} id - 挂载点ID
 * @param {Object} updateData - 更新数据
 * @param {string} [updateData.name] - 挂载点名称
 * @param {string} [updateData.storage_type] - 存储类型
 * @param {string} [updateData.mount_path] - 挂载路径
 * @param {string|null} [updateData.storage_config_id] - 存储配置ID
 * @param {string} [updateData.remark] - 备注
 * @param {boolean} [updateData.is_active] - 是否激活
 * @param {number} [updateData.sort_order] - 排序顺序
 * @param {number} [updateData.cache_ttl] - 缓存时间（秒）
 * @param {string} creatorId - 创建者ID或管理员ID
 * @param {boolean} isAdmin - 是否为管理员操作，为true时不检查创建者
 * @returns {Promise<void>}
 * @throws {HTTPException} 400 - 参数错误，包括路径格式错误、S3配置不存在等
 * @throws {HTTPException} 404 - 挂载点不存在或无权限修改
 * @throws {HTTPException} 409 - 挂载路径已存在冲突
 * @throws {Error} 数据库操作错误
 */
export async function updateMount(db, id, updateData, creatorId, isAdmin = false) {
  // 查询挂载点是否存在
  const query = isAdmin ? `SELECT id FROM ${DbTables.STORAGE_MOUNTS} WHERE id = ?` : `SELECT id FROM ${DbTables.STORAGE_MOUNTS} WHERE id = ? AND created_by = ?`;

  const params = isAdmin ? [id] : [id, creatorId];
  const mount = await db
      .prepare(query)
      .bind(...params)
      .first();

  if (!mount) {
    throw new HTTPException(ApiStatus.NOT_FOUND, { message: "挂载点不存在或无权限修改" });
  }

  console.log(`开始更新挂载点 - ID: ${id}, 操作者: ${creatorId}, 管理员权限: ${isAdmin}`);

  // 准备更新字段
  const updateFields = [];
  const updateParams = [];

  // 如果更新挂载路径，需要验证
  if (updateData.mount_path !== undefined) {
    validateMountPath(updateData.mount_path);

    // 检查新路径是否与其他挂载点冲突
    const existingMount = await db.prepare(`SELECT id FROM ${DbTables.STORAGE_MOUNTS} WHERE mount_path = ? AND id != ?`).bind(updateData.mount_path, id).first();

    if (existingMount) {
      throw new HTTPException(ApiStatus.CONFLICT, { message: "挂载路径已被使用" });
    }

    updateFields.push("mount_path = ?");
    updateParams.push(updateData.mount_path);
  }

  // 处理其他字段
  if (updateData.name !== undefined) {
    updateFields.push("name = ?");
    updateParams.push(updateData.name);
  }

  if (updateData.storage_type !== undefined) {
    updateFields.push("storage_type = ?");
    updateParams.push(updateData.storage_type);
  }

  if (updateData.storage_config_id !== undefined) {
    // 确定当前或即将更新的存储类型是否为S3
    let isS3StorageType = false;

    // 如果正在更新存储类型
    if (updateData.storage_type !== undefined) {
      isS3StorageType = updateData.storage_type === "S3";
    } else {
      // 否则查询当前存储类型
      const currentMount = await db.prepare(`SELECT storage_type FROM ${DbTables.STORAGE_MOUNTS} WHERE id = ?`).bind(id).first();
      if (currentMount) {
        isS3StorageType = currentMount.storage_type === "S3";
      }
    }

    // 只有S3类型才需要验证配置ID
    if (isS3StorageType) {
      // 如果提供了配置ID（不为null），验证其存在性
      if (updateData.storage_config_id !== null) {
        const s3Config = await db.prepare(`SELECT id FROM ${DbTables.S3_CONFIGS} WHERE id = ?`).bind(updateData.storage_config_id).first();

        if (!s3Config) {
          throw new HTTPException(ApiStatus.BAD_REQUEST, { message: "指定的S3配置不存在" });
        }
        console.log(`更新S3挂载点配置 - ID: ${id}, 新S3配置ID: ${updateData.storage_config_id}`);
      } else {
        console.log(`清除S3挂载点配置 - ID: ${id}, 移除S3配置关联`);
      }
    } else if (updateData.storage_config_id !== null) {
      // 非S3类型不应该有storage_config_id，强制设置为null
      console.log(`非S3类型挂载点设置了storage_config_id，已自动设为null`);
      updateData.storage_config_id = null;
    }

    updateFields.push("storage_config_id = ?");
    updateParams.push(updateData.storage_config_id);
  }

  if (updateData.remark !== undefined) {
    updateFields.push("remark = ?");
    updateParams.push(updateData.remark);
  }

  if (updateData.is_active !== undefined) {
    updateFields.push("is_active = ?");
    updateParams.push(updateData.is_active === true ? 1 : 0);
  }

  if (updateData.sort_order !== undefined) {
    updateFields.push("sort_order = ?");
    updateParams.push(updateData.sort_order);
  }

  if (updateData.cache_ttl !== undefined) {
    updateFields.push("cache_ttl = ?");
    updateParams.push(updateData.cache_ttl);
  }

  // 如果没有更新字段，直接返回
  if (updateFields.length === 0) {
    return;
  }

  // 添加更新时间
  updateFields.push("updated_at = ?");
  updateParams.push(getLocalTimeString());

  // 构建更新SQL
  const sql = `
    UPDATE ${DbTables.STORAGE_MOUNTS}
    SET ${updateFields.join(", ")}
    WHERE id = ?
  `;

  // 执行更新
  await db
      .prepare(sql)
      .bind(...updateParams, id)
      .run();
}

/**
 * 删除挂载点
 * @param {D1Database} db - D1数据库实例
 * @param {string} id - 挂载点ID
 * @param {string} creatorId - 创建者ID或管理员ID
 * @param {boolean} isAdmin - 是否为管理员操作，为true时不检查创建者
 * @returns {Promise<void>}
 * @throws {HTTPException} 404 - 挂载点不存在或无权限删除
 * @throws {Error} 数据库操作错误
 */
export async function deleteMount(db, id, creatorId, isAdmin = false) {
  // 查询挂载点是否存在
  const query = isAdmin ? `SELECT id FROM ${DbTables.STORAGE_MOUNTS} WHERE id = ?` : `SELECT id FROM ${DbTables.STORAGE_MOUNTS} WHERE id = ? AND created_by = ?`;

  const params = isAdmin ? [id] : [id, creatorId];
  const mount = await db
      .prepare(query)
      .bind(...params)
      .first();

  if (!mount) {
    throw new HTTPException(ApiStatus.NOT_FOUND, { message: "挂载点不存在或无权限删除" });
  }

  // 删除挂载点
  await db.prepare(`DELETE FROM ${DbTables.STORAGE_MOUNTS} WHERE id = ?`).bind(id).run();
}

/**
 * 更新挂载点最后使用时间
 * @param {D1Database} db - D1数据库实例
 * @param {string} id - 挂载点ID
 * @returns {Promise<void>}
 * @throws {Error} 数据库操作错误
 */
export async function updateMountLastUsed(db, id) {
  await db.prepare(`UPDATE ${DbTables.STORAGE_MOUNTS} SET last_used = ? WHERE id = ?`).bind(getLocalTimeString(), id).run();
}
