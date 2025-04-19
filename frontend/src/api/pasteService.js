/**
 * 文本分享服务API
 * 封装文本分享相关的API调用
 */

import { get, post, put, del } from "./client";
import { API_BASE_URL } from "./config";

/**
 * 创建新的文本分享
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
export async function updateUserPaste(slug, data) {
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
