<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import AdminLogin from "./AdminLogin.vue";
import AdminPanel from "./AdminPanel.vue";
// 导入请求辅助函数
import { fetchApi } from "../../api/client.js";

// 定义props，接收父组件传递的darkMode
const props = defineProps({
  darkMode: {
    type: Boolean,
    required: true,
  },
});

// 登录状态
const isLoggedIn = ref(false);
// 用户权限
const userPermissions = ref({
  isAdmin: false, // 是否是管理员
  text: false, // 文本操作权限
  file: false, // 文件操作权限
  mount: false, // 挂载点操作权限
});
// 用于区分登录类型
const loginType = ref("none"); // 'none', 'admin', 'apikey'

// 在组件加载时检查是否已登录
onMounted(() => {
  checkLoginStatus();

  // 监听令牌过期事件
  window.addEventListener("admin-token-expired", () => {
    console.log("监听到令牌过期事件，执行登出操作");
    handleLogout();
  });
});

// 组件卸载时移除事件监听
onBeforeUnmount(() => {
  window.removeEventListener("admin-token-expired", handleLogout);
});

// 验证管理员令牌有效性
const validateAdminToken = async (token) => {
  try {
    console.log("验证管理员令牌有效性");
    // 调用后端接口验证令牌，这里使用一个简单的端点
    const result = await fetchApi("test/admin-token", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return result.success === true;
  } catch (error) {
    console.error("令牌验证失败:", error);
    return false;
  }
};

// 检查登录状态函数
const checkLoginStatus = async () => {
  // 先检查管理员token
  const token = localStorage.getItem("admin_token");

  if (token && token.length >= 10) {
    console.log("检测到管理员令牌:", token.substring(0, 5) + "..." + token.substring(token.length - 5));

    // 验证令牌有效性
    try {
      const isValid = await validateAdminToken(token);

      if (!isValid) {
        console.warn("管理员令牌已过期或无效");
        handleLogout();
        return;
      }

      console.log("管理员令牌验证成功");
      isLoggedIn.value = true;
      loginType.value = "admin";
      userPermissions.value = {
        isAdmin: true,
        text: true,
        file: true,
        mount: true, // 管理员拥有所有权限
      };
      return;
    } catch (error) {
      console.error("验证管理员令牌时出错:", error);
      handleLogout();
      return;
    }
  }

  // 如果管理员token不存在，检查API密钥
  const apiKey = localStorage.getItem("api_key");

  if (apiKey && apiKey.length > 0) {
    console.log("API密钥授权成功：", apiKey.substring(0, 3) + "..." + apiKey.substring(apiKey.length - 3));
    isLoggedIn.value = true;
    loginType.value = "apikey";

    // 尝试从本地缓存获取权限信息
    const cachedPermissions = localStorage.getItem("api_key_permissions");
    if (cachedPermissions) {
      try {
        const permissions = JSON.parse(cachedPermissions);
        userPermissions.value = {
          isAdmin: false,
          text: permissions.text || false,
          file: permissions.file || false,
          mount: permissions.mount || false, // 添加mount权限支持
        };
        return;
      } catch (e) {
        console.error("解析权限缓存失败:", e);
      }
    }

    // 如果没有缓存，则需要重新验证API密钥
    validateApiKey(apiKey);
    return;
  }

  // 如果都不存在，则未登录
  console.log("验证失败：无有效凭据");
  isLoggedIn.value = false;
  loginType.value = "none";
  userPermissions.value = {
    isAdmin: false,
    text: false,
    file: false,
    mount: false,
  };
  localStorage.removeItem("admin_token");
  localStorage.removeItem("api_key");
  localStorage.removeItem("api_key_permissions");
  localStorage.removeItem("api_key_info");
};

// 验证API密钥的有效性和权限
const validateApiKey = async (apiKey) => {
  try {
    // 导入API配置函数
    const { getFullApiUrl } = await import("../../api/config.js");
    // 使用正确的API路径构建URL
    const apiUrl = getFullApiUrl("test/api-key");

    console.log("验证API密钥:", apiKey.substring(0, 3) + "..." + apiKey.substring(apiKey.length - 3));
    console.log("发送验证请求到:", apiUrl);

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Authorization: `ApiKey ${apiKey}`,
        "Content-Type": "application/json",
      },
      credentials: "omit", // 由于使用ApiKey Header，不需要cookie认证
    });

    console.log("API响应状态:", response.status, response.statusText);
    const contentType = response.headers.get("content-type");
    console.log("API响应内容类型:", contentType);

    // 检查响应内容类型
    if (!contentType || !contentType.includes("application/json")) {
      // 如果响应不是JSON，先尝试读取文本内容进行错误分析
      const textResponse = await response.text();
      console.error("API响应不是JSON格式:", textResponse.substring(0, 200) + "...");
      throw new Error("服务器返回了无效的响应格式");
    }

    const data = await response.json();
    console.log("API响应数据:", data);

    if (!response.ok) {
      throw new Error(data.message || `服务器错误(${response.status})`);
    }

    if (data.success && data.data && data.data.permissions) {
      const permissions = data.data.permissions;
      userPermissions.value = {
        isAdmin: false,
        text: permissions.text || false,
        file: permissions.file || false,
        mount: permissions.mount || false, // 添加mount权限支持
      };

      // 缓存权限信息
      const permissionsJson = JSON.stringify(permissions);
      localStorage.setItem("api_key_permissions", permissionsJson);

      // 缓存API密钥信息（如果有）
      if (data.data.key_info) {
        localStorage.setItem("api_key_info", JSON.stringify(data.data.key_info));
      }

      // 触发storage事件，通知其他组件权限已更新
      // localStorage事件只在其他窗口触发，这里我们手动触发一个自定义事件
      window.dispatchEvent(
        new CustomEvent("api-key-permissions-updated", {
          detail: { permissions },
        })
      );

      console.log("API密钥验证成功，权限已更新:", permissions);
    } else {
      throw new Error("获取权限信息失败");
    }
  } catch (error) {
    console.error("API密钥验证错误:", error);
    // 验证失败，清除存储并设置为未登录
    isLoggedIn.value = false;
    loginType.value = "none";
    userPermissions.value = {
      isAdmin: false,
      text: false,
      file: false,
      mount: false,
    };
    localStorage.removeItem("api_key");
    localStorage.removeItem("api_key_permissions");

    // 通知其他组件权限已清除
    window.dispatchEvent(
      new CustomEvent("api-key-permissions-updated", {
        detail: { permissions: null },
      })
    );
  }
};

// 处理登录成功
const handleLoginSuccess = (result) => {
  isLoggedIn.value = true;

  // 处理管理员登录结果
  if (result && result.token) {
    localStorage.setItem("admin_token", result.token);
    loginType.value = "admin";
    userPermissions.value = {
      isAdmin: true,
      text: true,
      file: true,
      mount: true, // 管理员拥有所有权限
    };
  }
  // 处理API密钥授权结果
  else if (result && result.apiKey) {
    localStorage.setItem("api_key", result.apiKey);
    loginType.value = "apikey";

    if (result.permissions) {
      userPermissions.value = {
        isAdmin: false,
        text: result.permissions.text || false,
        file: result.permissions.file || false,
        mount: result.permissions.mount || false, // 添加mount权限支持
      };
      localStorage.setItem("api_key_permissions", JSON.stringify(result.permissions));
    }

    // 存储API密钥信息
    if (result.keyInfo) {
      localStorage.setItem("api_key_info", JSON.stringify(result.keyInfo));
    }
  }
};

// 处理登出
const handleLogout = () => {
  isLoggedIn.value = false;
  loginType.value = "none";
  userPermissions.value = {
    isAdmin: false,
    text: false,
    file: false,
    mount: false,
  };
  localStorage.removeItem("admin_token");
  localStorage.removeItem("api_key");
  localStorage.removeItem("api_key_permissions");
  localStorage.removeItem("api_key_info");
};
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- 根据登录状态显示登录页面或管理面板 -->
    <AdminLogin v-if="!isLoggedIn" :darkMode="darkMode" @login-success="handleLoginSuccess" class="flex-1" />
    <AdminPanel v-else :darkMode="darkMode" :loginType="loginType" :permissions="userPermissions" @logout="handleLogout" class="flex-1" />
  </div>
</template>
