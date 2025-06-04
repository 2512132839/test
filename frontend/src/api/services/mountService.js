/**
 * 挂载点管理服务API
 * 统一管理所有挂载点相关的API调用，包括管理员和API密钥用户的操作
 */

import { get, post, put, del } from "../client";

/******************************************************************************
 * 管理员挂载点管理API
 ******************************************************************************/

/**
 * 管理员API - 获取所有挂载点列表
 * @returns {Promise<Object>} 挂载点列表响应对象
 */
export async function getAdminMountsList() {
  return get("/admin/mounts");
}

/**
 * 管理员API - 获取单个挂载点详情
 * @param {string} id 挂载点ID
 * @returns {Promise<Object>} 挂载点详情响应对象
 */
export async function getAdminMountById(id) {
  return get(`/admin/mounts/${id}`);
}

/**
 * 管理员API - 创建新挂载点
 * @param {Object} mountData 挂载点数据
 * @returns {Promise<Object>} 创建结果响应对象
 */
export async function createAdminMount(mountData) {
  return post("/admin/mounts", mountData);
}

/**
 * 管理员API - 更新挂载点信息
 * @param {string} id 挂载点ID
 * @param {Object} mountData 挂载点更新数据
 * @returns {Promise<Object>} 更新结果响应对象
 */
export async function updateAdminMount(id, mountData) {
  return put(`/admin/mounts/${id}`, mountData);
}

/**
 * 管理员API - 删除挂载点
 * @param {string} id 挂载点ID
 * @returns {Promise<Object>} 删除结果响应对象
 */
export async function deleteAdminMount(id) {
  return del(`/admin/mounts/${id}`);
}

/******************************************************************************
 * API密钥用户挂载点访问API（只读）
 ******************************************************************************/

/**
 * 用户API - 获取API密钥可访问的挂载点列表（只读）
 * 注意：API密钥用户只能查看基于basic_path权限范围内的挂载点，不能管理挂载点
 * @returns {Promise<Object>} 挂载点列表响应对象
 */
export async function getUserMountsList() {
  return get("/user/mounts");
}

/**
 * 用户API - 获取单个API密钥可访问的挂载点详情（只读）
 * @param {string} id 挂载点ID
 * @returns {Promise<Object>} 挂载点详情响应对象
 */
export async function getUserMountById(id) {
  return get(`/user/mounts/${id}`);
}

// 兼容性导出 - 保持向后兼容
export const getMountsList = getAdminMountsList;
export const getMountById = getAdminMountById;
export const createMount = createAdminMount;
export const updateMount = updateAdminMount;
export const deleteMount = deleteAdminMount;
