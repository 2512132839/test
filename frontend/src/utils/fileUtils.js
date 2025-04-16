/**
 * 文件操作工具函数
 */

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
      headers: getAuthHeaders(),
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
 * @returns {Object} 包含认证信息的请求头对象
 */
export function getAuthHeaders() {
  const headers = {};

  // 添加管理员令牌
  const token = localStorage.getItem("admin_token");
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  // 添加API密钥
  const apiKey = localStorage.getItem("api_key");
  if (apiKey) {
    headers.Authorization = `ApiKey ${apiKey}`;
    return headers;
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
      headers: getAuthHeaders(),
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
