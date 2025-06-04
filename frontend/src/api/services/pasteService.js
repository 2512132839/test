/**
 * 文本分享服务API
 * 统一管理所有文本分享相关的API调用，包括管理员和API密钥用户的操作
 */

import { get, post, put, del } from "../client";
import { API_BASE_URL } from "../config";

/******************************************************************************
 * 公共文本分享API（无需认证）
 ******************************************************************************/

/**
 * 获取文本分享
 * @param {string} slug - 文本分享链接后缀
 * @param {string} [password] - 访问密码（如果需要）
 * @returns {Promise<Object>} 文本分享数据
 */
export function getPaste(slug, password = null) {
  const endpoint = `/paste/${slug}`;

  // 如果提供了密码，则以POST方式提交
  if (password) {
    return post(endpoint, { password });
  }

  return get(endpoint);
}

/**
 * 获取文本分享的原始内容链接
 * @param {string} slug - 文本分享链接后缀
 * @param {string} [password] - 访问密码（如果需要）
 * @returns {string} 原始文本链接
 */
export function getRawPasteUrl(slug, password = null) {
  // 使用API_BASE_URL常量，不使用API_PREFIX前缀
  const baseUrl = `${API_BASE_URL}/api/raw/${slug}`;

  // 如果提供了密码，添加到URL参数中
  if (password) {
    return `${baseUrl}?password=${encodeURIComponent(password)}`;
  }

  return baseUrl;
}

/******************************************************************************
 * 管理员文本分享API
 ******************************************************************************/

/**
 * 创建新的文本分享（管理员或API密钥用户）
 * @param {Object} pasteData - 文本分享数据
 * @param {string} pasteData.content - 分享内容
 * @param {string} [pasteData.slug] - 自定义链接后缀（可选）
 * @param {string} [pasteData.remark] - 备注信息（可选）
 * @param {string} [pasteData.expiresAt] - 过期时间，ISO格式（可选）
 * @param {string} [pasteData.password] - 访问密码（可选）
 * @param {number} [pasteData.maxViews] - 最大查看次数（可选）
 * @returns {Promise<Object>} 创建结果
 */
export function createPaste(pasteData) {
  // 使用post方法，client.js会自动处理认证头部
  return post("/paste", pasteData);
}

/**
 * 获取所有文本分享列表（仅管理员）
 * @param {number} [page=1] - 页码
 * @param {number} [limit=10] - 每页数量
 * @returns {Promise<Object>} 分页的文本分享列表
 */
export function getAllPastes(page = 1, limit = 10) {
  console.log("发起获取文本分享列表请求，页码:", page, "每页数量:", limit);
  return get(`/admin/pastes?page=${page}&limit=${limit}`);
}

/**
 * 获取文本详情（仅管理员）
 * @param {string} id - 文本分享ID
 * @returns {Promise<Object>} 文本详情
 */
export function getAdminPasteById(id) {
  return get(`/admin/pastes/${id}`);
}

/**
 * 更新指定slug的文本分享（管理员）
 * @param {string} slug - 文本分享的唯一标识
 * @param {Object} data - 更新的数据
 * @param {string} [data.content] - 新的文本内容
 * @param {string} [data.password] - 新的访问密码
 * @param {boolean} [data.clearPassword] - 是否清除密码
 * @param {string} [data.remark] - 新的备注
 * @param {string} [data.expiresAt] - 新的过期时间
 * @param {number} [data.maxViews] - 新的最大查看次数
 * @param {string} [data.newSlug] - 新的链接后缀，为空则自动生成
 * @returns {Promise<ApiResponse>} - API响应
 */
export function updateAdminPaste(slug, data) {
  return put(`/admin/pastes/${slug}`, data);
}

/**
 * 删除文本分享（仅管理员）
 * @param {string} id - 文本分享ID
 * @returns {Promise<Object>} 删除结果
 */
export function deleteAdminPaste(id) {
  return del(`/admin/pastes/${id}`);
}

/**
 * 批量删除文本分享（仅管理员）
 * @param {string[]} ids - 文本分享ID数组
 * @returns {Promise<Object>} 删除结果
 */
export function deleteAdminPastes(ids) {
  return post("/admin/pastes/batch-delete", { ids });
}

/**
 * 清理所有过期的文本分享（仅管理员）
 * @returns {Promise<Object>} 清理结果
 */
export function clearExpiredPastes() {
  return post("/admin/pastes/clear-expired", { clearExpired: true });
}

/******************************************************************************
 * API密钥用户文本分享API
 ******************************************************************************/

/**
 * 获取API密钥用户的文本分享列表
 * @param {number} [limit=10] - 每页数量
 * @param {number} [offset=0] - 偏移量
 * @returns {Promise<Object>} 文本分享列表
 */
export function getUserPastes(limit = 10, offset = 0) {
  return get(`/user/pastes?limit=${limit}&offset=${offset}`);
}

/**
 * 获取API密钥用户的单个文本分享详情
 * @param {string} id - 文本分享ID
 * @returns {Promise<Object>} 文本分享详情
 */
export function getUserPasteById(id) {
  return get(`/user/pastes/${id}`);
}

/**
 * 更新用户文本分享
 * @param {string} slug - 文本分享的唯一标识
 * @param {Object} data - 更新的数据
 * @param {string} [data.content] - 新的文本内容
 * @param {string} [data.password] - 新的访问密码
 * @param {boolean} [data.clearPassword] - 是否清除密码
 * @param {string} [data.remark] - 新的备注
 * @param {string} [data.expiresAt] - 新的过期时间
 * @param {number} [data.maxViews] - 新的最大查看次数
 * @param {string} [data.newSlug] - 新的链接后缀，为空则自动生成
 * @returns {Promise<ApiResponse>} - API响应
 */
export function updateUserPaste(slug, data) {
  return put(`/user/pastes/${slug}`, data);
}

/**
 * 删除API密钥用户的单个文本分享
 * @param {string} id - 文本分享ID
 * @returns {Promise<Object>} 删除结果
 */
export function deleteUserPaste(id) {
  return del(`/user/pastes/${id}`);
}

/**
 * 批量删除API密钥用户的文本分享
 * @param {string[]} ids - 文本分享ID数组
 * @returns {Promise<Object>} 删除结果
 */
export function deleteUserPastes(ids) {
  return post(`/user/pastes/batch-delete`, { ids });
}

// 兼容性导出 - 保持向后兼容
export const deletePaste = deleteAdminPaste;
export const deletePastes = deleteAdminPastes;
export const updatePaste = updateAdminPaste;
export const getPasteById = getAdminPasteById;
