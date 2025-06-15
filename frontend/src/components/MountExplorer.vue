<template>
  <div class="mount-explorer-container mx-auto px-3 sm:px-6 flex-1 flex flex-col pt-6 sm:pt-8 w-full max-w-full sm:max-w-6xl">
    <div class="header mb-4 border-b pb-2" :class="darkMode ? 'border-gray-700' : 'border-gray-200'">
      <h2 class="text-xl font-semibold">{{ $t("mount.title") }}</h2>
    </div>

    <!-- 权限提示 -->
    <div
        v-if="!hasPermission"
        class="mb-4 p-3 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-700/50 dark:text-yellow-200"
    >
      <div class="flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          {{ $t("mount.permissionRequired") }}
          <a href="#" @click.prevent="navigateToAdmin" class="font-medium underline">{{ $t("mount.loginAuth") }}</a
          >。
        </span>
      </div>
    </div>

    <!-- 嵌套路由内容区域 -->
    <div v-if="hasPermission" class="main-content">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, provide, watch } from "vue";
import { useRouter } from "vue-router";

// Vue Router
const router = useRouter();

const props = defineProps({
  darkMode: {
    type: Boolean,
    default: false,
  },
});

// 权限状态
const isAdmin = ref(false);
const hasApiKey = ref(false);
const hasFilePermission = ref(false);
const hasMountPermission = ref(false);
const hasPermission = ref(false);

// API密钥信息
const apiKeyInfo = ref(null);

// 计算当前路径是否有权限
const hasPermissionForCurrentPath = computed(() => {
  if (isAdmin.value) {
    return true; // 管理员总是有权限
  }

  if (!apiKeyInfo.value) {
    return true; // 如果没有API密钥信息，默认有权限
  }

  const basicPath = apiKeyInfo.value.basic_path || "/";
  const normalizedBasicPath = basicPath === "/" ? "/" : basicPath.replace(/\/+$/, "");

  // 从当前路由获取路径
  const currentRoute = router.currentRoute.value;
  let currentPath = "/";
  if (currentRoute.params.pathMatch) {
    const pathArray = Array.isArray(currentRoute.params.pathMatch) ? currentRoute.params.pathMatch : [currentRoute.params.pathMatch];
    currentPath = "/" + pathArray.join("/");
  }
  const normalizedCurrentPath = currentPath.replace(/\/+$/, "") || "/";

  // 如果基本路径是根路径，允许访问所有路径
  if (normalizedBasicPath === "/") {
    return true;
  }

  // 只有当前路径是基本路径或其子路径时才有权限
  return normalizedCurrentPath === normalizedBasicPath || normalizedCurrentPath.startsWith(normalizedBasicPath + "/");
});

// 检查权限
const checkPermissions = () => {
  // 获取管理员token或API密钥
  const adminToken = localStorage.getItem("admin_token");
  const apiKey = localStorage.getItem("api_key");

  // 重置apiKeyInfo
  apiKeyInfo.value = null;

  // 检查API密钥权限
  let filePermission = false;
  let mountPermission = false; // 挂载权限变量
  if (apiKey) {
    try {
      const permissionsStr = localStorage.getItem("api_key_permissions");
      const keyInfoStr = localStorage.getItem("api_key_info");

      if (permissionsStr) {
        const permissions = JSON.parse(permissionsStr);
        filePermission = !!permissions.file;
        mountPermission = !!permissions.mount; // 获取挂载权限
      }

      if (keyInfoStr) {
        apiKeyInfo.value = JSON.parse(keyInfoStr);
      }
    } catch (e) {
      console.error("解析API密钥权限失败:", e);
    }
  }

  // 更新权限状态
  isAdmin.value = !!adminToken;
  hasApiKey.value = !!apiKey;
  hasFilePermission.value = filePermission;
  hasMountPermission.value = mountPermission; // 设置挂载权限状态

  // 管理员或有挂载权限的API密钥用户可以访问挂载浏览页
  hasPermission.value = isAdmin.value || (hasApiKey.value && hasMountPermission.value);

  console.log("权限状态:", {
    isAdmin: isAdmin.value,
    hasApiKey: hasApiKey.value,
    hasFilePermission: hasFilePermission.value,
    hasMountPermission: hasMountPermission.value, // 挂载权限日志
    hasPermission: hasPermission.value,
    apiKeyInfo: apiKeyInfo.value,
  });
};

// 导航到管理页面
const navigateToAdmin = () => {
  import("../router").then(({ routerUtils }) => {
    routerUtils.navigateTo("admin");
  });
};

// 提供数据给子组件
provide(
    "darkMode",
    computed(() => props.darkMode)
);
provide("isAdmin", isAdmin);
provide("apiKeyInfo", apiKeyInfo);
provide("hasPermissionForCurrentPath", hasPermissionForCurrentPath);

// 添加全局事件监听
const setupEventListeners = () => {
  // 监听管理员令牌过期
  window.addEventListener("admin-token-expired", () => {
    checkPermissions();
  });
};

// 监听权限状态变化
watch([isAdmin, hasApiKey, hasMountPermission], () => {
  hasPermission.value = isAdmin.value || (hasApiKey.value && hasMountPermission.value);
});

// 组件挂载时执行
onMounted(() => {
  // 检查权限
  checkPermissions();

  // 设置事件监听
  setupEventListeners();
});
</script>
