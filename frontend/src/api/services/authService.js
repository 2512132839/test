/**
 * 认证服务API
 * 统一管理所有认证相关的API调用，包括管理员登录、API密钥验证等
 */

import { get, post, put, del } from "../client";

/******************************************************************************
 * 管理员认证相关API
 ******************************************************************************/

/**
 * 管理员登录
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @returns {Promise<Object>} 登录结果（包含token）
 */
export function adminLogin(username, password) {
  return post("/admin/login", { username, password });
}

/**
 * 管理员登出
 * @returns {Promise<Object>} 登出结果
 */
export function adminLogout() {
  return post("/admin/logout");
}

/**
 * 检查管理员登录状态
 * @returns {Promise<Object>} 登录状态
 */
export function checkAdminLogin() {
  return get("/admin/check");
}

/**
 * 更改管理员密码
 * @param {string} currentPassword - 当前密码
 * @param {string} newPassword - 新密码
 * @param {string} [newUsername] - 新用户名（可选）
 * @returns {Promise<Object>} 更新结果
 */
export function changeAdminPassword(currentPassword, newPassword, newUsername) {
  return post("/admin/change-password", {
    currentPassword,
    newPassword,
    newUsername,
  });
}

/******************************************************************************
 * API密钥认证相关API
 ******************************************************************************/

/**
 * 验证API密钥
 * @returns {Promise<Object>} 验证结果，包含权限和密钥信息
 */
export function verifyApiKey() {
  return get("/test/api-key");
}

/******************************************************************************
 * API密钥管理相关API（管理员功能）
 ******************************************************************************/

/**
 * 获取所有API密钥
 * @returns {Promise<Object>} API密钥列表
 */
export function getAllApiKeys() {
  return get("/admin/api-keys");
}

/**
 * 创建新的API密钥
 * @param {string} name - 密钥名称
 * @param {string} [expiresAt] - 过期时间，ISO格式字符串
 * @param {boolean} [textPermission=false] - 文本操作权限
 * @param {boolean} [filePermission=false] - 文件操作权限
 * @param {boolean} [mountPermission=false] - 挂载点操作权限
 * @param {string} [customKey] - 自定义密钥（可选，仅限字母、数字、横杠和下划线）
 * @param {string} [basicPath="/"] - 基本路径（可选，默认为根路径'/'）
 * @returns {Promise<Object>} 新创建的API密钥信息
 */
export function createApiKey(name, expiresAt, textPermission = false, filePermission = false, mountPermission = false, customKey = null, basicPath = "/") {
  return post("/admin/api-keys", {
    name,
    expires_at: expiresAt,
    text_permission: textPermission,
    file_permission: filePermission,
    mount_permission: mountPermission,
    custom_key: customKey,
    basic_path: basicPath,
  });
}

/**
 * 删除API密钥
 * @param {string} keyId - 要删除的密钥ID
 * @returns {Promise<Object>} 删除结果
 */
export function deleteApiKey(keyId) {
  return del(`/admin/api-keys/${keyId}`);
}

/**
 * 更新API密钥
 * @param {string} keyId - 要更新的密钥ID
 * @param {Object} updateData - 要更新的数据
 * @param {string} [updateData.name] - 新的密钥名称
 * @param {boolean} [updateData.text_permission] - 文本操作权限
 * @param {boolean} [updateData.file_permission] - 文件操作权限
 * @param {boolean} [updateData.mount_permission] - 挂载点操作权限
 * @param {string} [updateData.basic_path] - 基本路径
 * @param {string} [updateData.expires_at] - 新的过期时间，ISO格式字符串
 * @returns {Promise<Object>} 更新结果
 */
export function updateApiKey(keyId, updateData) {
  return put(`/admin/api-keys/${keyId}`, updateData);
}

// 兼容性导出 - 保持向后兼容
export const login = adminLogin;
export const logout = adminLogout;
export const checkLogin = checkAdminLogin;
export const changePassword = changeAdminPassword;
export const getApiKeys = getAllApiKeys;
