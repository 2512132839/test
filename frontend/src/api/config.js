/**
 * API配置文件
 * 管理API请求的基础URL和其他配置
 */

// 默认的开发环境API基础URL
const DEFAULT_DEV_API_URL = "http://localhost:8787";

// 优先从全局配置读取，然后是localStorage，然后是环境变量，最后是默认值
// 这允许通过运行时配置切换API环境而不需要重新构建
function getApiBaseUrl() {
  // 首先检查运行时配置 (window.appConfig)
  if (typeof window !== "undefined" && window.appConfig && window.appConfig.backendUrl) {
    const runtimeUrl = window.appConfig.backendUrl;
    // 忽略占位符值 - 使用字符串拼接避免Vite替换
    if (runtimeUrl !== "__" + "BACKEND_URL__") {
      return runtimeUrl;
    }
  }

  // 其次检查localStorage（开发环境和生产环境都检查）
  if (typeof window !== "undefined" && window.localStorage) {
    const storedUrl = localStorage.getItem("vite-api-base-url");
    if (storedUrl) {
      return storedUrl;
    }
  }

  // 第三使用环境变量
  const envUrl = import.meta.env.VITE_BACKEND_URL;
  if (envUrl) {
    return envUrl;
  }

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
    isDockerBuild: import.meta.env.VITE_IS_DOCKER === "true" || false,
  };
};
