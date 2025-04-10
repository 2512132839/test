/**
 * API密钥授权辅助工具
 * 提供获取、存储和验证API密钥信息的方法
 */

import { api } from "../api";

/**
 * 存储API密钥信息到localStorage
 * @param {Object} keyInfo - 包含id和name的API密钥信息对象
 */
export const storeApiKeyInfo = (keyInfo) => {
  if (!keyInfo) return;

  try {
    localStorage.setItem("api_key_info", JSON.stringify(keyInfo));
  } catch (err) {
    console.error("存储API密钥信息失败:", err);
  }
};

/**
 * 获取API密钥信息，如果localStorage中不存在，尝试从服务器获取
 * @returns {Promise<Object|null>} 包含id和name的API密钥信息对象，或null
 */
export const getApiKeyInfo = async () => {
  try {
    // 首先尝试从localStorage获取
    const storedInfo = localStorage.getItem("api_key_info");
    if (storedInfo) {
      return JSON.parse(storedInfo);
    }

    // 如果localStorage中没有，检查是否有API密钥
    const apiKey = localStorage.getItem("api_key");
    if (!apiKey) {
      return null;
    }

    // 有API密钥但没有信息，尝试从服务器获取
    const response = await api.test.verifyApiKey();

    if (response.success && response.data && response.data.key_info) {
      // 获取成功，存储并返回
      const keyInfo = response.data.key_info;
      storeApiKeyInfo(keyInfo);
      return keyInfo;
    }

    return null;
  } catch (err) {
    console.error("获取API密钥信息失败:", err);
    return null;
  }
};

/**
 * 检查当前用户是否是指定文件的创建者
 * @param {Object} fileInfo - 文件信息对象
 * @returns {Promise<boolean>} 是否为创建者
 */
export const checkIsFileCreator = async (fileInfo) => {
  // 如果没有文件或创建者信息，无法判断
  if (!fileInfo || !fileInfo.created_by) {
    return false;
  }

  try {
    // 获取API密钥信息
    const keyInfo = await getApiKeyInfo();
    if (!keyInfo || !keyInfo.id) {
      return false;
    }

    // 处理created_by字段，后端返回的格式是"apikey:密钥ID"
    const createdBy = fileInfo.created_by;

    // 如果created_by以"apikey:"开头，提取实际的ID部分
    if (typeof createdBy === "string" && createdBy.startsWith("apikey:")) {
      const actualKeyId = createdBy.substring(7); // 移除"apikey:"前缀
      return keyInfo.id === actualKeyId;
    }

    // 否则直接比较完整的ID
    return keyInfo.id === createdBy;
  } catch (err) {
    console.error("检查文件创建者权限失败:", err);
    return false;
  }
};

/**
 * 清除所有API密钥相关的本地存储
 */
export const clearApiKeyStorage = () => {
  localStorage.removeItem("api_key");
  localStorage.removeItem("api_key_permissions");
  localStorage.removeItem("api_key_info");
};

export default {
  storeApiKeyInfo,
  getApiKeyInfo,
  checkIsFileCreator,
  clearApiKeyStorage,
};
