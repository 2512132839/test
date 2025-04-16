import { get, post, put, del } from "./client";

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

/**
 * 用户API - 获取API密钥所属的挂载点列表
 * @returns {Promise<Object>} 挂载点列表响应对象
 */
export async function getUserMountsList() {
  return get("/user/mounts");
}

/**
 * 用户API - 获取单个API密钥所属的挂载点详情
 * @param {string} id 挂载点ID
 * @returns {Promise<Object>} 挂载点详情响应对象
 */
export async function getUserMountById(id) {
  return get(`/user/mounts/${id}`);
}

/**
 * 用户API - 通过API密钥创建挂载点
 * @param {Object} mountData 挂载点数据
 * @returns {Promise<Object>} 创建结果响应对象
 */
export async function createUserMount(mountData) {
  return post("/user/mounts", mountData);
}

/**
 * 用户API - 通过API密钥更新挂载点
 * @param {string} id 挂载点ID
 * @param {Object} mountData 挂载点更新数据
 * @returns {Promise<Object>} 更新结果响应对象
 */
export async function updateUserMount(id, mountData) {
  return put(`/user/mounts/${id}`, mountData);
}

/**
 * 用户API - 通过API密钥删除挂载点
 * @param {string} id 挂载点ID
 * @returns {Promise<Object>} 删除结果响应对象
 */
export async function deleteUserMount(id) {
  return del(`/user/mounts/${id}`);
}
