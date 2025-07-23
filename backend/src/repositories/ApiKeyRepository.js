/**
 * API密钥Repository类
 * 负责API密钥相关的数据访问操作
 */

import { BaseRepository } from "./BaseRepository.js";
import { DbTables } from "../constants/index.js";

export class ApiKeyRepository extends BaseRepository {
  /**
   * 根据密钥查找API密钥
   * @param {string} key - API密钥
   * @returns {Promise<Object|null>} API密钥对象或null
   */
  async findByKey(key) {
    if (!key) return null;
    
    return await this.findOne(DbTables.API_KEYS, { key });
  }

  /**
   * 根据ID查找API密钥
   * @param {string} keyId - API密钥ID
   * @returns {Promise<Object|null>} API密钥对象或null
   */
  async findById(keyId) {
    return await super.findById(DbTables.API_KEYS, keyId);
  }

  /**
   * 获取所有API密钥列表
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} API密钥列表
   */
  async findAll(options = {}) {
    const { orderBy = "created_at DESC", limit, offset } = options;
    
    return await this.findMany(
      DbTables.API_KEYS,
      {},
      { orderBy, limit, offset }
    );
  }

  /**
   * 创建API密钥
   * @param {Object} keyData - API密钥数据
   * @returns {Promise<Object>} 创建结果
   */
  async createApiKey(keyData) {
    // 确保包含必要的时间戳
    const dataWithTimestamp = {
      ...keyData,
      created_at: keyData.created_at || new Date().toISOString(),
    };

    return await this.create(DbTables.API_KEYS, dataWithTimestamp);
  }

  /**
   * 更新API密钥信息
   * @param {string} keyId - API密钥ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>} 更新结果
   */
  async updateApiKey(keyId, updateData) {
    return await this.update(DbTables.API_KEYS, keyId, updateData);
  }

  /**
   * 更新API密钥最后使用时间
   * @param {string} keyId - API密钥ID
   * @returns {Promise<Object>} 更新结果
   */
  async updateLastUsed(keyId) {
    return await this.execute(
      `UPDATE ${DbTables.API_KEYS} SET last_used = CURRENT_TIMESTAMP WHERE id = ?`,
      [keyId]
    );
  }

  /**
   * 删除API密钥
   * @param {string} keyId - API密钥ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteApiKey(keyId) {
    return await this.delete(DbTables.API_KEYS, keyId);
  }

  /**
   * 检查密钥是否已存在
   * @param {string} key - API密钥
   * @param {string} excludeId - 排除的密钥ID（用于更新时检查）
   * @returns {Promise<boolean>} 是否存在
   */
  async existsByKey(key, excludeId = null) {
    if (excludeId) {
      const result = await this.queryFirst(
        `SELECT id FROM ${DbTables.API_KEYS} WHERE key = ? AND id != ?`,
        [key, excludeId]
      );
      return !!result;
    } else {
      return await this.exists(DbTables.API_KEYS, { key });
    }
  }

  /**
   * 检查名称是否已存在
   * @param {string} name - 密钥名称
   * @param {string} excludeId - 排除的密钥ID（用于更新时检查）
   * @returns {Promise<boolean>} 是否存在
   */
  async existsByName(name, excludeId = null) {
    if (excludeId) {
      const result = await this.queryFirst(
        `SELECT id FROM ${DbTables.API_KEYS} WHERE name = ? AND id != ?`,
        [name, excludeId]
      );
      return !!result;
    } else {
      return await this.exists(DbTables.API_KEYS, { name });
    }
  }

  /**
   * 删除过期的API密钥
   * @param {Date} currentTime - 当前时间
   * @returns {Promise<Object>} 删除结果
   */
  async deleteExpired(currentTime = new Date()) {
    const result = await this.execute(
      `DELETE FROM ${DbTables.API_KEYS} 
       WHERE expires_at IS NOT NULL AND expires_at < ?`,
      [currentTime.toISOString()]
    );

    return {
      deletedCount: result.meta?.changes || 0,
      message: `已删除${result.meta?.changes || 0}个过期API密钥`,
    };
  }

  /**
   * 查找过期的API密钥
   * @param {Date} currentTime - 当前时间
   * @returns {Promise<Array>} 过期密钥列表
   */
  async findExpired(currentTime = new Date()) {
    const result = await this.query(
      `SELECT * FROM ${DbTables.API_KEYS} 
       WHERE expires_at IS NOT NULL AND expires_at < ?`,
      [currentTime.toISOString()]
    );

    return result.results || [];
  }

  /**
   * 获取API密钥统计信息
   * @returns {Promise<Object>} 统计信息
   */
  async getStatistics() {
    const total = await this.count(DbTables.API_KEYS);
    
    // 获取有效密钥数量（未过期）
    const now = new Date().toISOString();
    const valid = await this.queryFirst(
      `SELECT COUNT(*) as count FROM ${DbTables.API_KEYS} 
       WHERE expires_at IS NULL OR expires_at > ?`,
      [now]
    );

    // 按权限类型统计
    const permissionStats = await this.query(
      `SELECT 
         SUM(text_permission) as text_count,
         SUM(file_permission) as file_count,
         SUM(mount_permission) as mount_count
       FROM ${DbTables.API_KEYS}`
    );

    return {
      total,
      valid: valid?.count || 0,
      expired: total - (valid?.count || 0),
      permissions: {
        text: permissionStats.results?.[0]?.text_count || 0,
        file: permissionStats.results?.[0]?.file_count || 0,
        mount: permissionStats.results?.[0]?.mount_count || 0,
      },
    };
  }
}
