/**
 * 管理员服务API
 * 封装管理员相关的API调用
 */

import { get, post, put, del } from "./client";

/**
 * 管理员登录
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @returns {Promise<Object>} 登录结果（包含token）
 */
export function login(username, password) {
  return post("/admin/login", { username, password });
}

/**
 * 管理员登出
 * @returns {Promise<Object>} 登出结果
 */
export function logout() {
  return post("/admin/logout");
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
 * 删除文本分享（仅管理员）
 * @param {string} id - 文本分享ID
 * @returns {Promise<Object>} 删除结果
 */
export function deletePaste(id) {
  return del(`/admin/pastes/${id}`);
}

/**
 * 批量删除文本分享（仅管理员）
 * @param {string[]} ids - 文本分享ID数组
 * @returns {Promise<Object>} 删除结果
 */
export function deletePastes(ids) {
  return post("/admin/pastes/batch-delete", { ids });
}

/**
 * 清理所有过期的文本分享（仅管理员）
 * @returns {Promise<Object>} 清理结果
 */
export function clearExpiredPastes() {
  return post("/admin/pastes/clear-expired", { clearExpired: true });
}

/**
 * 更新指定slug的文本分享
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
export async function updatePaste(slug, data) {
  return put(`/admin/pastes/${slug}`, data);
}

/**
 * 更改管理员密码
 * @param {string} currentPassword - 当前密码
 * @param {string} newPassword - 新密码
 * @param {string} [newUsername] - 新用户名（可选）
 * @returns {Promise<Object>} 更新结果
 */
export function changePassword(currentPassword, newPassword, newUsername) {
  return post("/admin/change-password", {
    currentPassword,
    newPassword,
    newUsername,
  });
}

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
 * @returns {Promise<Object>} 新创建的API密钥信息
 */
export function createApiKey(name, expiresAt, textPermission = false, filePermission = false, mountPermission = false, customKey = null) {
  return post("/admin/api-keys", {
    name,
    expires_at: expiresAt,
    text_permission: textPermission,
    file_permission: filePermission,
    mount_permission: mountPermission,
    custom_key: customKey,
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
 * @param {string} [updateData.expires_at] - 新的过期时间，ISO格式字符串
 * @returns {Promise<Object>} 更新结果
 */
export function updateApiKey(keyId, updateData) {
  return put(`/admin/api-keys/${keyId}`, updateData);
}

/**
 * S3存储配置API
 */

/**
 * 获取所有S3存储配置
 * @returns {Promise<Object>} 所有S3配置列表
 */
export function getAllS3Configs() {
  return get("/s3-configs");
}

/**
 * 获取单个S3存储配置详情
 * @param {string} id - 配置ID
 * @returns {Promise<Object>} S3配置详情
 */
export function getS3Config(id) {
  return get(`/s3-configs/${id}`);
}

/**
 * 创建S3存储配置
 * @param {Object} config - S3配置信息
 * @param {string} config.name - 配置名称
 * @param {string} config.provider_type - 提供商类型，如'Cloudflare R2'
 * @param {string} config.endpoint_url - S3 API端点URL
 * @param {string} config.bucket_name - 存储桶名称
 * @param {string} [config.region] - 存储桶区域
 * @param {string} config.access_key_id - 访问密钥ID
 * @param {string} config.secret_access_key - 秘密访问密钥
 * @param {boolean} [config.path_style] - 是否使用路径样式访问
 * @param {string} [config.default_folder] - 默认上传文件夹路径
 * @param {boolean} [config.is_public] - 是否允许API密钥访问（默认为false）
 * @returns {Promise<Object>} 创建结果
 */
export function createS3Config(config) {
  return post("/s3-configs", config);
}

/**
 * 更新S3存储配置
 * @param {string} id - 配置ID
 * @param {Object} config - 要更新的配置信息
 * @returns {Promise<Object>} 更新结果
 */
export function updateS3Config(id, config) {
  return put(`/s3-configs/${id}`, config);
}

/**
 * 删除S3存储配置
 * @param {string} id - 要删除的配置ID
 * @returns {Promise<Object>} 删除结果
 */
export function deleteS3Config(id) {
  return del(`/s3-configs/${id}`);
}

/**
 * 设置默认S3存储配置
 * @param {string} id - 要设置为默认的配置ID
 * @returns {Promise<Object>} 设置结果
 */
export function setDefaultS3Config(id) {
  return put(`/s3-configs/${id}/set-default`);
}

/**
 * 测试S3存储配置连接
 * @param {string} id - 配置ID
 * @returns {Promise<Object>} 测试结果
 */
export function testS3Config(id) {
  return post(`/s3-configs/${id}/test`);
}

/**
 * 获取文本详情（仅管理员）
 * @param {string} id - 文本分享ID
 * @returns {Promise<Object>} 文本详情
 */
export function getPasteById(id) {
  return get(`/admin/pastes/${id}`);
}

/**
 * 检查登录状态
 * @returns {Promise<Object>} 登录状态
 */
export function checkLogin() {
  return get("admin/check");
}

/**
 * 获取API密钥列表
 * @returns {Promise<Object>} API密钥列表
 */
export function getApiKeys() {
  return get("admin/api-keys");
}

/**
 * 验证API密钥
 * @returns {Promise<Object>} 验证结果
 */
export function verifyApiKey() {
  return get("test/api-key");
}

/**
 * 系统设置API
 */

/**
 * 获取系统设置
 * @returns {Promise<Object>} 系统设置响应
 */
export function getSystemSettings() {
  return get("/admin/system-settings");
}

/**
 * 更新系统设置
 * @param {Object} settings - 要更新的设置
 * @param {number} [settings.max_upload_size] - 最大上传大小(MB)，前端可能会根据不同单位(KB/MB/GB)转换后再传入
 * @returns {Promise<Object>} 更新结果
 */
export function updateSystemSettings(settings) {
  return put("/admin/system-settings", settings);
}

/**
 * 获取仪表盘统计数据
 * @returns {Promise<Object>} 包含文本和文件数量及存储空间使用情况的统计数据
 */
export function getDashboardStats() {
  return get("/admin/dashboard/stats");
}
