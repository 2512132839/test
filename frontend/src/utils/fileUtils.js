/**
 * 文件操作工具函数
 */

import { formatFileSize as formatFileSizeUtil, getFileIconClass as getFileIconClassUtil } from "./mimeTypeUtils.js";
import { getFileIcon } from "./fileTypeIcons.js";

/**
 * 使用fetch API下载文件并保存
 * @param {string} url - 文件URL
 * @param {string} filename - 下载文件名
 * @returns {Promise<void>}
 */
export async function downloadFileWithAuth(url, filename) {
  try {
    console.log("请求下载URL:", url);
    // 使用fetch请求URL，添加认证头
    const response = await fetch(url, {
      headers: await getAuthHeaders(),
      mode: "cors", // 明确设置跨域模式
      credentials: "include", // 包含凭证（cookies等）
    });

    // 检查响应状态
    if (!response.ok) {
      throw new Error(`下载失败: ${response.status} ${response.statusText}`);
    }

    // 获取blob数据
    const blob = await response.blob();

    // 创建临时下载链接
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;

    // 添加到文档并点击触发下载
    document.body.appendChild(link);
    link.click();

    // 清理
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error("文件下载出错:", error);
    throw error;
  }
}

/**
 * 获取认证请求头
 * @returns {Promise<Object>} 包含认证信息的请求头对象
 */
export async function getAuthHeaders() {
  const headers = {};

  try {
    // 使用认证Store获取认证信息
    const { useAuthStore } = await import("../stores/authStore.js");
    const authStore = useAuthStore();

    if (authStore.isAuthenticated) {
      if (authStore.authType === "admin" && authStore.adminToken) {
        headers.Authorization = `Bearer ${authStore.adminToken}`;
      } else if (authStore.authType === "apikey" && authStore.apiKey) {
        headers.Authorization = `ApiKey ${authStore.apiKey}`;
      }
    }
  } catch (error) {
    console.error("无法从认证Store获取认证信息:", error);
  }

  return headers;
}

/**
 * 创建带有认证信息的预览URL Blob
 * @param {string} url - 文件预览URL
 * @returns {Promise<string>} 可访问的Blob URL
 */
export async function createAuthenticatedPreviewUrl(url) {
  try {
    console.log("请求预览URL:", url);
    // 使用fetch请求URL，添加认证头
    const response = await fetch(url, {
      headers: await getAuthHeaders(),
      mode: "cors", // 明确设置跨域模式
      credentials: "include", // 包含凭证（cookies等）
    });

    // 检查响应状态
    if (!response.ok) {
      throw new Error(`预览加载失败: ${response.status} ${response.statusText}`);
    }

    // 获取blob数据
    const blob = await response.blob();

    // 创建blob URL用于预览
    return window.URL.createObjectURL(blob);
  } catch (error) {
    console.error("预览URL创建失败:", error);
    throw error;
  }
}

/**
 * 格式化文件大小 - 统一的文件大小格式化函数
 * @param {number} bytes - 文件大小（字节）
 * @param {boolean} useChineseUnits - 是否使用中文单位，默认false
 * @returns {string} 格式化后的文件大小
 */
export const formatFileSize = (bytes, useChineseUnits = false) => {
  return formatFileSizeUtil(bytes, useChineseUnits);
};

/**
 * 计算剩余可访问次数 - 统一的访问次数计算函数
 * @param {Object} item - 文件或文本分享对象
 * @param {Function} t - i18n翻译函数，如果不提供则返回中文
 * @returns {string|number} 剩余访问次数或状态描述
 */
export const getRemainingViews = (item, t = null) => {
  if (!item.max_views || item.max_views === 0) {
    return t ? t("file.unlimited") : "无限制";
  }

  // 兼容不同的字段名：view_count, views
  const viewCount = item.view_count !== undefined ? item.view_count : item.views || 0;
  const remaining = item.max_views - viewCount;

  if (remaining <= 0) {
    return t ? t("file.usedUp") : "已用完";
  }

  return remaining;
};

/**
 * 获取剩余访问次数的样式类
 * @param {Object} item - 文件或文本分享对象
 * @param {boolean} darkMode - 是否为暗色模式
 * @param {Function} t - i18n翻译函数，如果不提供则使用中文判断
 * @returns {string} CSS类名
 */
export const getRemainingViewsClass = (item, darkMode = false, t = null) => {
  const remaining = getRemainingViews(item, t);
  const usedUpText = t ? t("file.usedUp") : "已用完";
  const unlimitedText = t ? t("file.unlimited") : "无限制";

  if (remaining === usedUpText) {
    return darkMode ? "text-red-400" : "text-red-600";
  } else if (remaining !== unlimitedText && remaining < 3) {
    return darkMode ? "text-yellow-400" : "text-yellow-600";
  }
  return darkMode ? "text-gray-300" : "text-gray-700";
};

/**
 * 获取文件图标CSS类名 - 统一的文件图标样式函数
 * @param {string} mimetype - 文件MIME类型
 * @param {boolean} darkMode - 是否为暗色模式
 * @param {string} filename - 文件名（可选）
 * @returns {string} CSS类名
 */
export const getFileIconClass = (mimetype, darkMode = false, filename = null) => {
  return getFileIconClassUtil(mimetype, darkMode, filename);
};

/**
 * 获取文件图标SVG - 统一的文件图标函数（用于挂载浏览器等）
 * @param {Object} item - 文件项对象
 * @param {boolean} darkMode - 是否为暗色模式
 * @returns {string} SVG图标字符串
 */
export const getFileIconSvg = (item, darkMode = false) => {
  return getFileIcon(item, darkMode);
};
