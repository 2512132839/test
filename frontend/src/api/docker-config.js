/**
 * API配置文件 - Docker版本
 * 管理API请求的基础URL和其他配置
 * 简化版本，移除了所有window相关引用，专为Docker构建环境设计
 */

// 默认的开发环境API基础URL
const DEFAULT_DEV_API_URL = "http://localhost:8787";

// 简化的getApiBaseUrl函数，仅使用环境变量
function getApiBaseUrl() {
  // 优先使用环境变量
  const envUrl = import.meta.env.VITE_BACKEND_URL;
  if (envUrl) {
    return envUrl;
  }

  // 最后使用默认值
  return DEFAULT_DEV_API_URL;
}

// 获取API基础URL
export const API_BASE_URL = getApiBaseUrl();

// API版本前缀，与后端保持一致
export const API_PREFIX = "/api";

// 完整的API基础URL（包含前缀）
export const getFullApiUrl = (endpoint) => {
  // 如果endpoint已经包含了完整URL，则直接返回
  if (endpoint.startsWith("http")) {
    return endpoint;
  }

  // 确保endpoint以/开头
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  // 添加API前缀
  return `${API_BASE_URL}${API_PREFIX}${normalizedEndpoint}`;
};

// 导出环境信息方法，便于调试
export const getEnvironmentInfo = () => {
  return {
    apiBaseUrl: API_BASE_URL,
    apiPrefix: API_PREFIX,
    mode: import.meta.env.MODE,
    isDevelopment: import.meta.env.DEV,
    isProduction: import.meta.env.PROD,
    backendUrl: import.meta.env.VITE_BACKEND_URL,
    isDockerBuild: true,
  };
};
