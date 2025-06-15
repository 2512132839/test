<template>
  <div v-if="!hasPermission" class="permission-warning">
    <div class="mb-4 p-3 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-700/50 dark:text-yellow-200">
      <div class="flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          {{ $t("markdown.permissionRequired") }}
          <a href="#" @click.prevent="navigateToAdmin" class="font-medium underline">{{ $t("markdown.loginOrAuth") }}</a
          >。
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { getFullApiUrl } from "../../api/config.js";

// Props
const props = defineProps({
  darkMode: {
    type: Boolean,
    default: false,
  },
});

// Emits
const emit = defineEmits(["permission-change", "navigate-to-admin"]);

// 权限状态变量
const isAdmin = ref(false);
const hasApiKey = ref(false);
const hasTextPermission = ref(false);
const hasPermission = ref(false);

// API密钥验证函数的防抖定时器
let apiKeyValidationTimer = null;
let lastValidatedApiKey = null;
let lastValidationTime = 0;
const VALIDATION_DEBOUNCE_TIME = 2000;

// 检查用户权限状态
const checkPermissionStatus = async () => {
  console.log("检查用户权限状态...");

  // 检查管理员权限
  const adminToken = localStorage.getItem("admin_token");
  isAdmin.value = !!adminToken;

  if (isAdmin.value) {
    console.log("用户具有管理员权限");
    hasPermission.value = true;
    emit("permission-change", hasPermission.value);
    return;
  }

  // 检查API密钥权限
  const apiKey = localStorage.getItem("api_key");
  hasApiKey.value = !!apiKey;

  if (hasApiKey.value) {
    console.log("用户具有API密钥:", apiKey.substring(0, 3) + "..." + apiKey.substring(apiKey.length - 3));

    try {
      const hasTextPerm = await validateApiKey(apiKey);
      hasTextPermission.value = hasTextPerm;
      console.log("API密钥文本权限(后端验证):", hasTextPermission.value ? "有权限" : "无权限");
    } catch (error) {
      console.error("API密钥验证失败:", error);

      // 验证失败时，尝试回退到本地缓存
      console.warn("后端验证失败，尝试使用本地缓存的权限信息");
      const permissionsStr = localStorage.getItem("api_key_permissions");
      if (permissionsStr) {
        try {
          const permissions = JSON.parse(permissionsStr);
          hasTextPermission.value = !!permissions.text;
          console.log("API密钥文本权限(本地缓存):", hasTextPermission.value ? "有权限" : "无权限");
        } catch (e) {
          console.error("解析权限数据失败:", e);
          hasTextPermission.value = false;
        }
      } else {
        console.warn("未找到API密钥权限信息");
        hasTextPermission.value = false;
      }
    }
  } else {
    hasTextPermission.value = false;
  }

  // 综合判断是否有创建权限
  hasPermission.value = isAdmin.value || (hasApiKey.value && hasTextPermission.value);
  console.log("用户创建文本分享权限:", hasPermission.value ? "有权限" : "无权限");

  emit("permission-change", hasPermission.value);
};

// 验证API密钥权限
const validateApiKey = async (apiKey) => {
  const now = Date.now();
  if (apiKey === lastValidatedApiKey && now - lastValidationTime < VALIDATION_DEBOUNCE_TIME) {
    console.log("使用缓存的API密钥验证结果，距上次验证时间:", Math.floor((now - lastValidationTime) / 1000), "秒");
    return hasTextPermission.value;
  }

  if (apiKeyValidationTimer) {
    clearTimeout(apiKeyValidationTimer);
  }

  return new Promise((resolve, reject) => {
    apiKeyValidationTimer = setTimeout(async () => {
      try {
        const apiUrl = getFullApiUrl("test/api-key");
        console.log("正在验证API密钥:", apiKey.substring(0, 3) + "..." + apiKey.substring(apiKey.length - 3));

        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            Authorization: `ApiKey ${apiKey}`,
            "Content-Type": "application/json",
          },
          credentials: "omit",
        });

        if (!response.ok) {
          throw new Error(`API密钥验证失败 (${response.status})`);
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("服务器返回了无效的响应格式");
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message || "密钥验证失败");
        }

        // 记录本次验证的密钥和时间
        lastValidatedApiKey = apiKey;
        lastValidationTime = Date.now();

        // 更新本地缓存中的权限信息
        if (data.data && data.data.permissions) {
          const permissions = data.data.permissions;
          localStorage.setItem("api_key_permissions", JSON.stringify(permissions));

          // 更新权限状态
          const textPermission = !!permissions.text;
          hasTextPermission.value = textPermission;

          // 触发自定义事件，通知其他组件权限已更新
          window.dispatchEvent(
              new CustomEvent("api-key-permissions-updated", {
                detail: { permissions },
              })
          );

          console.log("API密钥验证成功，文本权限:", textPermission ? "有权限" : "无权限");
          resolve(textPermission);
          return;
        }

        resolve(false);
      } catch (error) {
        console.error("API密钥验证出错:", error);
        reject(error);
      } finally {
        apiKeyValidationTimer = null;
      }
    }, 50);
  });
};

// 导航到管理员登录页面
const navigateToAdmin = () => {
  emit("navigate-to-admin");
};

// 事件处理函数
const handleApiKeyPermissionsUpdate = async (e) => {
  console.log("接收到API密钥权限更新事件:", e.detail);
  await checkPermissionStatus();
};

const handleStorageChange = async (e) => {
  if (e.key === "admin_token" || e.key === "api_key" || e.key === "api_key_permissions") {
    console.log("检测到存储变化，更新权限状态:", e.key);
    await checkPermissionStatus();
  }
};

// 组件挂载
onMounted(async () => {
  await checkPermissionStatus();

  // 监听storage事件
  window.addEventListener("storage", handleStorageChange);
  // 监听API密钥权限更新事件
  window.addEventListener("api-key-permissions-updated", handleApiKeyPermissionsUpdate);
});

// 组件卸载
onUnmounted(() => {
  window.removeEventListener("storage", handleStorageChange);
  window.removeEventListener("api-key-permissions-updated", handleApiKeyPermissionsUpdate);

  if (apiKeyValidationTimer) {
    clearTimeout(apiKeyValidationTimer);
    apiKeyValidationTimer = null;
  }
});

// 暴露方法和状态
defineExpose({
  hasPermission,
  isAdmin,
  hasApiKey,
  hasTextPermission,
  checkPermissionStatus,
});
</script>

<style scoped>
.permission-warning {
  margin-bottom: 1rem;
}
</style>
