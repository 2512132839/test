/**
 * API测试服务
 * 提供各种API测试功能
 */

import { get, post } from "./client";

/**
 * 验证API密钥
 * @returns {Promise<Object>} 验证结果，包含权限和密钥信息
 */
export function verifyApiKey() {
  return get("test/api-key");
}

/**
 * 测试S3存储配置连接
 * @param {string} configId - S3配置ID
 * @returns {Promise<Object>} 测试结果
 */
export function testS3Connection(configId) {
  return post(`s3-configs/${configId}/test`);
}
