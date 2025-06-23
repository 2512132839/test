/**
 * 统一认证状态管理Store
 * 使用Pinia管理所有认证相关状态，实现主动权限验证
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { api } from "../api";

export const useAuthStore = defineStore("auth", () => {
  // ===== 状态定义 =====

  // 认证状态
  const isAuthenticated = ref(false);
  const authType = ref("none"); // 'admin', 'apikey', 'none'
  const isLoading = ref(false);
  const lastValidated = ref(null);

  // 管理员相关状态
  const adminToken = ref(null);
  const isAdmin = ref(false);

  // API密钥相关状态
  const apiKey = ref(null);
  const apiKeyInfo = ref(null);
  const apiKeyPermissions = ref({
    text: false,
    file: false,
    mount: false,
  });

  // 用户信息
  const userInfo = ref({
    id: null,
    name: null,
    type: "none", // 'admin', 'apikey'
    basicPath: "/",
  });

  // ===== 计算属性 =====

  // 是否有文本权限
  const hasTextPermission = computed(() => {
    return isAdmin.value || apiKeyPermissions.value.text;
  });

  // 是否有文件权限
  const hasFilePermission = computed(() => {
    return isAdmin.value || apiKeyPermissions.value.file;
  });

  // 是否有挂载权限
  const hasMountPermission = computed(() => {
    return isAdmin.value || apiKeyPermissions.value.mount;
  });

  // 是否需要重新验证（5分钟过期）
  const needsRevalidation = computed(() => {
    if (!lastValidated.value) return true;
    const fiveMinutes = 5 * 60 * 1000;
    return Date.now() - lastValidated.value > fiveMinutes;
  });

  // ===== 私有方法 =====

  /**
   * 从localStorage加载认证状态
   */
  const loadFromStorage = () => {
    try {
      // 加载管理员token
      const storedAdminToken = localStorage.getItem("admin_token");
      if (storedAdminToken) {
        adminToken.value = storedAdminToken;
        authType.value = "admin";
        isAdmin.value = true;
        isAuthenticated.value = true;
        userInfo.value = {
          id: "admin",
          name: "Administrator",
          type: "admin",
          basicPath: "/",
        };
        return;
      }

      // 加载API密钥
      const storedApiKey = localStorage.getItem("api_key");
      if (storedApiKey) {
        apiKey.value = storedApiKey;
        authType.value = "apikey";
        isAuthenticated.value = true;

        // 加载API密钥权限
        const storedPermissions = localStorage.getItem("api_key_permissions");
        if (storedPermissions) {
          const permissions = JSON.parse(storedPermissions);
          apiKeyPermissions.value = {
            text: !!permissions.text,
            file: !!permissions.file,
            mount: !!permissions.mount,
          };
        }

        // 加载API密钥信息
        const storedKeyInfo = localStorage.getItem("api_key_info");
        if (storedKeyInfo) {
          const keyInfo = JSON.parse(storedKeyInfo);
          apiKeyInfo.value = keyInfo;
          userInfo.value = {
            id: keyInfo.id,
            name: keyInfo.name,
            type: "apikey",
            basicPath: keyInfo.basic_path || "/",
          };
        }
      }
    } catch (error) {
      console.error("从localStorage加载认证状态失败:", error);
      clearAuthState();
    }
  };

  /**
   * 清除所有认证状态
   */
  const clearAuthState = () => {
    isAuthenticated.value = false;
    authType.value = "none";
    isAdmin.value = false;
    adminToken.value = null;
    apiKey.value = null;
    apiKeyInfo.value = null;
    apiKeyPermissions.value = {
      text: false,
      file: false,
      mount: false,
    };
    userInfo.value = {
      id: null,
      name: null,
      type: "none",
      basicPath: "/",
    };
    lastValidated.value = null;
  };

  /**
   * 保存认证状态到localStorage
   */
  const saveToStorage = () => {
    try {
      if (authType.value === "admin" && adminToken.value) {
        localStorage.setItem("admin_token", adminToken.value);
      } else if (authType.value === "apikey" && apiKey.value) {
        localStorage.setItem("api_key", apiKey.value);
        if (apiKeyPermissions.value) {
          localStorage.setItem("api_key_permissions", JSON.stringify(apiKeyPermissions.value));
        }
        if (apiKeyInfo.value) {
          localStorage.setItem("api_key_info", JSON.stringify(apiKeyInfo.value));
        }
      }
    } catch (error) {
      console.error("保存认证状态到localStorage失败:", error);
    }
  };

  /**
   * 清除localStorage中的认证数据
   */
  const clearStorage = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("api_key");
    localStorage.removeItem("api_key_permissions");
    localStorage.removeItem("api_key_info");
  };

  // ===== 公共方法 =====

  /**
   * 初始化认证状态
   */
  const initialize = async () => {
    console.log("初始化认证状态...");
    loadFromStorage();

    // 如果有认证信息，验证其有效性
    if (isAuthenticated.value) {
      await validateAuth();
    }
  };

  /**
   * 验证当前认证状态
   */
  const validateAuth = async () => {
    if (!isAuthenticated.value) return false;

    isLoading.value = true;

    try {
      if (authType.value === "admin" && adminToken.value) {
        // 验证管理员token
        await api.admin.checkLogin();
        lastValidated.value = Date.now();
        return true;
      } else if (authType.value === "apikey" && apiKey.value) {
        // 验证API密钥
        const response = await api.test.verifyApiKey();
        if (response.success && response.data) {
          // 更新权限信息
          if (response.data.permissions) {
            apiKeyPermissions.value = {
              text: !!response.data.permissions.text,
              file: !!response.data.permissions.file,
              mount: !!response.data.permissions.mount,
            };
          }

          // 更新API密钥信息（包括基础路径）
          if (response.data.key_info) {
            apiKeyInfo.value = response.data.key_info;
            userInfo.value = {
              id: response.data.key_info.id,
              name: response.data.key_info.name,
              type: "apikey",
              basicPath: response.data.key_info.basic_path || "/",
            };
          }

          saveToStorage();
          lastValidated.value = Date.now();
          return true;
        }
      }

      // 验证失败，清除状态
      await logout();
      return false;
    } catch (error) {
      console.error("认证验证失败:", error);
      await logout();
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 管理员登录
   */
  const adminLogin = async (username, password) => {
    isLoading.value = true;

    try {
      const result = await api.admin.login(username, password);
      const token = result.data?.token;

      if (!token) {
        throw new Error("登录响应中缺少token");
      }

      // 设置认证状态
      adminToken.value = token;
      authType.value = "admin";
      isAdmin.value = true;
      isAuthenticated.value = true;
      userInfo.value = {
        id: "admin",
        name: "Administrator",
        type: "admin",
        basicPath: "/",
      };
      lastValidated.value = Date.now();

      // 保存到localStorage
      saveToStorage();

      // 触发认证状态变化事件
      window.dispatchEvent(
        new CustomEvent("auth-state-changed", {
          detail: { type: "admin-login", isAuthenticated: true },
        })
      );

      return { success: true, data: { token } };
    } catch (error) {
      console.error("管理员登录失败:", error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * API密钥登录
   */
  const apiKeyLogin = async (key) => {
    isLoading.value = true;

    try {
      // 临时设置API密钥和认证类型进行验证
      const originalApiKey = apiKey.value;
      const originalAuthType = authType.value;

      apiKey.value = key;
      authType.value = "apikey";

      const response = await api.test.verifyApiKey();

      if (!response.success || !response.data) {
        apiKey.value = originalApiKey;
        authType.value = originalAuthType;
        throw new Error("API密钥验证失败");
      }

      // 设置认证状态
      authType.value = "apikey";
      isAuthenticated.value = true;

      // 设置权限
      if (response.data.permissions) {
        apiKeyPermissions.value = {
          text: !!response.data.permissions.text,
          file: !!response.data.permissions.file,
          mount: !!response.data.permissions.mount,
        };
      }

      // 设置密钥信息
      if (response.data.key_info) {
        apiKeyInfo.value = response.data.key_info;
        userInfo.value = {
          id: response.data.key_info.id,
          name: response.data.key_info.name,
          type: "apikey",
          basicPath: response.data.key_info.basic_path || "/",
        };
      }

      lastValidated.value = Date.now();

      // 保存到localStorage
      saveToStorage();

      // 触发认证状态变化事件
      window.dispatchEvent(
        new CustomEvent("auth-state-changed", {
          detail: { type: "apikey-login", isAuthenticated: true },
        })
      );

      return { success: true, data: response.data };
    } catch (error) {
      console.error("API密钥登录失败:", error);
      // 恢复原始状态
      await logout();
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 登出
   */
  const logout = async () => {
    try {
      // 如果是管理员，调用登出API
      if (authType.value === "admin") {
        try {
          await api.admin.logout();
        } catch (error) {
          console.warn("管理员登出API调用失败:", error);
        }
      }

      // 清除状态和存储
      clearAuthState();
      clearStorage();

      // 触发认证状态变化事件
      window.dispatchEvent(
        new CustomEvent("auth-state-changed", {
          detail: { type: "logout", isAuthenticated: false },
        })
      );

      // 触发特定的登出事件
      if (authType.value === "admin") {
        window.dispatchEvent(new CustomEvent("admin-token-expired"));
      } else if (authType.value === "apikey") {
        window.dispatchEvent(new CustomEvent("api-key-invalid"));
      }
    } catch (error) {
      console.error("登出过程中出错:", error);
    }
  };

  /**
   * 检查特定权限
   */
  const hasPermission = (permissionType) => {
    if (!isAuthenticated.value) return false;

    switch (permissionType) {
      case "text":
        return hasTextPermission.value;
      case "file":
        return hasFilePermission.value;
      case "mount":
        return hasMountPermission.value;
      case "admin":
        return isAdmin.value;
      default:
        return false;
    }
  };

  /**
   * 检查路径权限（针对API密钥用户）
   */
  const hasPathPermission = (path) => {
    if (isAdmin.value) return true;
    if (!isAuthenticated.value || authType.value !== "apikey") return false;

    const basicPath = userInfo.value.basicPath || "/";
    const normalizedBasicPath = basicPath === "/" ? "/" : basicPath.replace(/\/+$/, "");
    const normalizedPath = path.replace(/\/+$/, "") || "/";

    // 如果基本路径是根路径，允许访问所有路径
    if (normalizedBasicPath === "/") return true;

    // 检查路径是否在基本路径范围内
    return normalizedPath === normalizedBasicPath || normalizedPath.startsWith(normalizedBasicPath + "/");
  };

  /**
   * 检查当前用户是否是指定文件的创建者
   * @param {Object} fileInfo - 文件信息对象
   * @returns {boolean} 是否为创建者
   */
  const isFileCreator = (fileInfo) => {
    // 如果没有文件或创建者信息，无法判断
    if (!fileInfo || !fileInfo.created_by) {
      return false;
    }

    // 如果是管理员，总是返回true
    if (isAdmin.value) {
      return true;
    }

    // 如果不是API密钥用户，返回false
    if (authType.value !== "apikey" || !apiKeyInfo.value || !apiKeyInfo.value.id) {
      return false;
    }

    // 处理created_by字段，后端返回的格式是"apikey:密钥ID"
    const createdBy = fileInfo.created_by;

    // 如果created_by以"apikey:"开头，提取实际的ID部分
    if (typeof createdBy === "string" && createdBy.startsWith("apikey:")) {
      const actualKeyId = createdBy.substring(7); // 移除"apikey:"前缀
      return apiKeyInfo.value.id === actualKeyId;
    }

    // 否则直接比较完整的ID
    return apiKeyInfo.value.id === createdBy;
  };

  // 返回store的状态和方法
  return {
    // 状态
    isAuthenticated,
    authType,
    isLoading,
    isAdmin,
    adminToken,
    apiKey,
    apiKeyInfo,
    apiKeyPermissions,
    userInfo,
    lastValidated,

    // 计算属性
    hasTextPermission,
    hasFilePermission,
    hasMountPermission,
    needsRevalidation,

    // 方法
    initialize,
    validateAuth,
    adminLogin,
    apiKeyLogin,
    logout,
    hasPermission,
    hasPathPermission,
    isFileCreator,
  };
});
