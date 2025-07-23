/**
 * 文件Repository类
 * 负责文件相关的数据访问操作
 */

import { BaseRepository } from "./BaseRepository.js";
import { DbTables } from "../constants/index.js";

export class FileRepository extends BaseRepository {
  /**
   * 根据ID查找文件
   * @param {string} fileId - 文件ID
   * @returns {Promise<Object|null>} 文件对象或null
   */
  async findById(fileId) {
    return await super.findById(DbTables.FILES, fileId);
  }

  /**
   * 根据slug查找文件
   * @param {string} slug - 文件slug
   * @returns {Promise<Object|null>} 文件对象或null
   */
  async findBySlug(slug) {
    if (!slug) return null;

    return await this.queryFirst(`SELECT * FROM ${DbTables.FILES} WHERE slug = ?`, [slug]);
  }

  /**
   * 根据slug查找文件并关联S3配置
   * @param {string} slug - 文件slug
   * @returns {Promise<Object|null>} 包含S3配置的文件对象或null
   */
  async findBySlugWithS3Config(slug) {
    if (!slug) return null;

    return await this.queryFirst(
      `
      SELECT 
        f.*,
        s.endpoint_url, s.bucket_name, s.region, 
        s.access_key_id, s.secret_access_key, s.path_style,
        s.provider_type, s.name as s3_config_name
      FROM ${DbTables.FILES} f
      LEFT JOIN ${DbTables.S3_CONFIGS} s ON f.s3_config_id = s.id
      WHERE f.slug = ?
      `,
      [slug]
    );
  }

  /**
   * 根据ID查找文件并关联S3配置
   * @param {string} fileId - 文件ID
   * @returns {Promise<Object|null>} 包含S3配置的文件对象或null
   */
  async findByIdWithS3Config(fileId) {
    if (!fileId) return null;

    return await this.queryFirst(
      `
      SELECT 
        f.*,
        s.endpoint_url, s.bucket_name, s.region, 
        s.access_key_id, s.secret_access_key, s.path_style,
        s.provider_type, s.name as s3_config_name
      FROM ${DbTables.FILES} f
      LEFT JOIN ${DbTables.S3_CONFIGS} s ON f.s3_config_id = s.id
      WHERE f.id = ?
      `,
      [fileId]
    );
  }

  /**
   * 创建文件记录
   * @param {Object} fileData - 文件数据
   * @returns {Promise<Object>} 创建结果
   */
  async createFile(fileData) {
    // 确保包含必要的时间戳
    const dataWithTimestamp = {
      ...fileData,
      created_at: fileData.created_at || new Date().toISOString(),
      updated_at: fileData.updated_at || new Date().toISOString(),
    };

    return await this.create(DbTables.FILES, dataWithTimestamp);
  }

  /**
   * 更新文件记录
   * @param {string} fileId - 文件ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>} 更新结果
   */
  async updateFile(fileId, updateData) {
    // 自动更新修改时间
    const dataWithTimestamp = {
      ...updateData,
      updated_at: new Date().toISOString(),
    };

    return await this.update(DbTables.FILES, fileId, dataWithTimestamp);
  }

  /**
   * 增加文件查看次数
   * @param {string} fileId - 文件ID
   * @returns {Promise<Object>} 更新结果
   */
  async incrementViews(fileId) {
    return await this.execute(`UPDATE ${DbTables.FILES} SET views = views + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [fileId]);
  }

  /**
   * 删除文件记录
   * @param {string} fileId - 文件ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteFile(fileId) {
    return await this.delete(DbTables.FILES, fileId);
  }

  /**
   * 根据存储路径删除文件记录
   * @param {string} s3ConfigId - S3配置ID
   * @param {string} storagePath - 存储路径
   * @returns {Promise<Object>} 删除结果
   */
  async deleteByStoragePath(s3ConfigId, storagePath) {
    if (!s3ConfigId || !storagePath) {
      return { deletedCount: 0, message: "缺少必要参数" };
    }

    const result = await this.execute(`DELETE FROM ${DbTables.FILES} WHERE s3_config_id = ? AND storage_path = ?`, [s3ConfigId, storagePath]);

    return {
      deletedCount: result.meta?.changes || 0,
      message: `已删除${result.meta?.changes || 0}条文件记录`,
    };
  }

  /**
   * 根据S3配置ID查找文件
   * @param {string} s3ConfigId - S3配置ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} 文件列表
   */
  async findByS3ConfigId(s3ConfigId, options = {}) {
    return await this.findMany(DbTables.FILES, { s3_config_id: s3ConfigId }, options);
  }

  /**
   * 根据创建者查找文件
   * @param {string} createdBy - 创建者标识
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} 文件列表
   */
  async findByCreator(createdBy, options = {}) {
    return await this.findMany(DbTables.FILES, { created_by: createdBy }, options);
  }

  /**
   * 根据ID和创建者查找文件（包含S3配置）
   * @param {string} fileId - 文件ID
   * @param {string} createdBy - 创建者标识
   * @returns {Promise<Object|null>} 包含S3配置的文件对象或null
   */
  async findByIdAndCreator(fileId, createdBy) {
    if (!fileId || !createdBy) return null;

    return await this.queryFirst(
      `
      SELECT
        f.*,
        s.endpoint_url, s.bucket_name, s.region,
        s.access_key_id, s.secret_access_key, s.path_style,
        s.provider_type, s.name as s3_config_name
      FROM ${DbTables.FILES} f
      LEFT JOIN ${DbTables.S3_CONFIGS} s ON f.s3_config_id = s.id
      WHERE f.id = ? AND f.created_by = ?
      `,
      [fileId, createdBy]
    );
  }

  /**
   * 统计文件总大小
   * @param {Object} conditions - 统计条件
   * @returns {Promise<number>} 总大小（字节）
   */
  async getTotalSize(conditions = {}) {
    const fields = Object.keys(conditions);
    const values = Object.values(conditions);

    let sql = `SELECT COALESCE(SUM(size), 0) as total_size FROM ${DbTables.FILES}`;

    if (fields.length > 0) {
      const whereClause = fields.map((field) => `${field} = ?`).join(" AND ");
      sql += ` WHERE ${whereClause}`;
    }

    const result = await this.queryFirst(sql, values);
    return result?.total_size || 0;
  }

  /**
   * 获取指定S3配置的总使用量（排除指定文件）
   * @param {string} s3ConfigId - S3配置ID
   * @param {string} excludeFileId - 要排除的文件ID
   * @returns {Promise<Object>} 包含total_used字段的对象
   */
  async getTotalSizeByS3ConfigExcludingFile(s3ConfigId, excludeFileId) {
    const result = await this.queryFirst(`SELECT COALESCE(SUM(size), 0) as total_used FROM ${DbTables.FILES} WHERE s3_config_id = ? AND id != ?`, [s3ConfigId, excludeFileId]);
    return result;
  }

  /**
   * 批量删除文件记录
   * @param {Array<string>} fileIds - 文件ID数组
   * @returns {Promise<Object>} 删除结果
   */
  async batchDelete(fileIds) {
    if (!fileIds || fileIds.length === 0) {
      return { deletedCount: 0, message: "没有要删除的文件" };
    }

    const placeholders = fileIds.map(() => "?").join(",");
    const result = await this.execute(`DELETE FROM ${DbTables.FILES} WHERE id IN (${placeholders})`, fileIds);

    return {
      deletedCount: result.meta?.changes || 0,
      message: `已删除${result.meta?.changes || 0}条文件记录`,
    };
  }

  /**
   * 检查文件是否存在
   * @param {string} slug - 文件slug
   * @returns {Promise<boolean>} 是否存在
   */
  async existsBySlug(slug) {
    return await this.exists(DbTables.FILES, { slug });
  }

  /**
   * 根据slug查找文件（排除指定ID）
   * @param {string} slug - 文件slug
   * @param {string} excludeId - 要排除的文件ID
   * @returns {Promise<Object|null>} 文件对象或null
   */
  async findBySlugExcludingId(slug, excludeId) {
    return await this.queryFirst(`SELECT id FROM ${DbTables.FILES} WHERE slug = ? AND id != ?`, [slug, excludeId]);
  }

  /**
   * 检查存储路径是否存在
   * @param {string} s3ConfigId - S3配置ID
   * @param {string} storagePath - 存储路径
   * @returns {Promise<boolean>} 是否存在
   */
  async existsByStoragePath(s3ConfigId, storagePath) {
    return await this.exists(DbTables.FILES, {
      s3_config_id: s3ConfigId,
      storage_path: storagePath,
    });
  }

  /**
   * 根据存储路径查找文件
   * @param {string} s3ConfigId - S3配置ID
   * @param {string} storagePath - 存储路径
   * @returns {Promise<Object|null>} 文件对象或null
   */
  async findByStoragePath(s3ConfigId, storagePath) {
    return await this.findOne(DbTables.FILES, {
      s3_config_id: s3ConfigId,
      storage_path: storagePath,
    });
  }

  /**
   * 统计使用指定S3配置的文件数量
   * @param {string} s3ConfigId - S3配置ID
   * @returns {Promise<number>} 文件数量
   */
  async countByS3ConfigId(s3ConfigId) {
    return await super.count(DbTables.FILES, { s3_config_id: s3ConfigId });
  }

  /**
   * 查找多个文件并关联S3配置
   * @param {Object} conditions - 查询条件
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} 包含S3配置的文件列表
   */
  async findManyWithS3Config(conditions = {}, options = {}) {
    const { orderBy = "created_at DESC", limit, offset } = options;

    // 构建WHERE条件
    const fields = Object.keys(conditions);
    const values = Object.values(conditions);

    let sql = `
      SELECT
        f.id, f.filename, f.slug, f.storage_path, f.s3_url,
        f.mimetype, f.size, f.remark, f.created_at, f.views,
        f.max_views, f.expires_at, f.etag, f.password,
        f.created_by, f.use_proxy,
        s.name as s3_config_name,
        s.provider_type as s3_provider_type,
        s.id as s3_config_id
      FROM ${DbTables.FILES} f
      LEFT JOIN ${DbTables.S3_CONFIGS} s ON f.s3_config_id = s.id
    `;

    if (fields.length > 0) {
      const whereClause = fields.map((field) => `f.${field} = ?`).join(" AND ");
      sql += ` WHERE ${whereClause}`;
    }

    sql += ` ORDER BY f.${orderBy}`;

    if (limit) {
      sql += ` LIMIT ${limit}`;
      if (offset) {
        sql += ` OFFSET ${offset}`;
      }
    }

    const queryResult = await this.query(sql, values);
    return queryResult.results || [];
  }

  /**
   * 统计文件数量（支持条件）
   * @param {Object} conditions - 查询条件
   * @returns {Promise<number>} 文件数量
   */
  async count(conditions = {}) {
    return await super.count(DbTables.FILES, conditions);
  }

  // ==================== 密码管理方法 ====================

  /**
   * 创建文件明文密码记录
   * @param {string} fileId - 文件ID
   * @param {string} plainPassword - 明文密码
   * @returns {Promise<Object>} 创建结果
   */
  async createFilePasswordRecord(fileId, plainPassword) {
    return await this.execute(
      `INSERT INTO ${DbTables.FILE_PASSWORDS} (file_id, plain_password, created_at, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [fileId, plainPassword]
    );
  }

  /**
   * 更新文件的明文密码
   * @param {string} fileId - 文件ID
   * @param {string} plainPassword - 新的明文密码
   * @returns {Promise<Object>} 更新结果
   */
  async updateFilePasswordRecord(fileId, plainPassword) {
    return await this.execute(
      `UPDATE ${DbTables.FILE_PASSWORDS}
       SET plain_password = ?, updated_at = CURRENT_TIMESTAMP
       WHERE file_id = ?`,
      [plainPassword, fileId]
    );
  }

  /**
   * 删除文件的密码记录
   * @param {string} fileId - 文件ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteFilePasswordRecord(fileId) {
    return await this.execute(`DELETE FROM ${DbTables.FILE_PASSWORDS} WHERE file_id = ?`, [fileId]);
  }

  /**
   * 检查文件是否有密码记录
   * @param {string} fileId - 文件ID
   * @returns {Promise<boolean>} 是否存在密码记录
   */
  async hasFilePasswordRecord(fileId) {
    const result = await this.queryFirst(`SELECT file_id FROM ${DbTables.FILE_PASSWORDS} WHERE file_id = ?`, [fileId]);

    return !!result;
  }

  /**
   * 创建或更新文件密码记录
   * @param {string} fileId - 文件ID
   * @param {string} plainPassword - 明文密码
   * @returns {Promise<Object>} 操作结果
   */
  async upsertFilePasswordRecord(fileId, plainPassword) {
    const exists = await this.hasFilePasswordRecord(fileId);

    if (exists) {
      return await this.updateFilePasswordRecord(fileId, plainPassword);
    } else {
      return await this.createFilePasswordRecord(fileId, plainPassword);
    }
  }

  /**
   * 获取文件密码信息
   * @param {string} fileId - 文件ID
   * @returns {Promise<Object|null>} 密码信息对象，包含plain_password字段
   */
  async getFilePassword(fileId) {
    return await this.queryFirst(`SELECT plain_password FROM ${DbTables.FILE_PASSWORDS} WHERE file_id = ?`, [fileId]);
  }
}
