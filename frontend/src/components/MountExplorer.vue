<template>
  <div class="mount-explorer-container mx-auto px-3 sm:px-6 flex-1 flex flex-col pt-6 sm:pt-8 w-full max-w-full sm:max-w-6xl">
    <div class="header mb-4 border-b pb-2" :class="darkMode ? 'border-gray-700' : 'border-gray-200'">
      <h2 class="text-xl font-semibold">{{ $t("mount.title") }}</h2>
    </div>

    <!-- 权限提示 -->
    <div
      v-if="!hasPermission"
      class="mb-4 p-3 rounded-md border"
      :class="
        isApiKeyUserWithoutPermission
          ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-700/50 dark:text-red-200'
          : 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-700/50 dark:text-yellow-200'
      "
    >
      <div class="flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            :d="
              isApiKeyUserWithoutPermission
                ? 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z'
                : 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
            "
          />
        </svg>
        <span v-if="isApiKeyUserWithoutPermission">
          {{ $t("common.noPermission") }}
        </span>
        <span v-else>
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
import { ref, onMounted, onBeforeUnmount, computed, provide, watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore.js";

// Vue Router
const router = useRouter();

// 使用认证Store
const authStore = useAuthStore();

const props = defineProps({
  darkMode: {
    type: Boolean,
    default: false,
  },
});

// 从Store获取权限状态的计算属性
const isAdmin = computed(() => authStore.isAdmin);
const hasApiKey = computed(() => authStore.authType === "apikey" && !!authStore.apiKey);
const hasFilePermission = computed(() => authStore.hasFilePermission);
const hasMountPermission = computed(() => authStore.hasMountPermission);
const hasPermission = computed(() => authStore.hasMountPermission);

// 判断是否为已登录但无挂载权限的API密钥用户
const isApiKeyUserWithoutPermission = computed(() => {
  return authStore.isAuthenticated && authStore.authType === "apikey" && !authStore.hasMountPermission;
});

// API密钥信息
const apiKeyInfo = computed(() => authStore.apiKeyInfo);

// 计算当前路径是否有权限
const hasPermissionForCurrentPath = computed(() => {
  if (isAdmin.value) {
    return true; // 管理员总是有权限
  }

  // 从当前路由获取路径
  const currentRoute = router.currentRoute.value;
  let currentPath = "/";
  if (currentRoute.params.pathMatch) {
    const pathArray = Array.isArray(currentRoute.params.pathMatch) ? currentRoute.params.pathMatch : [currentRoute.params.pathMatch];
    currentPath = "/" + pathArray.join("/");
  }
  const normalizedCurrentPath = currentPath.replace(/\/+$/, "") || "/";

  // 使用认证Store的路径权限检查方法
  return authStore.hasPathPermission(normalizedCurrentPath);
});

// 权限检查逻辑已移至认证Store

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

// 处理认证状态变化
const handleAuthStateChange = (event) => {
  console.log("MountExplorer: 认证状态变化", event.detail);
  // 权限状态会自动更新，这里只需要记录日志
};

// 组件挂载时执行
onMounted(async () => {
  // 如果需要重新验证，则进行验证
  if (authStore.needsRevalidation) {
    console.log("MountExplorer: 需要重新验证认证状态");
    await authStore.validateAuth();
  }

  // 监听认证状态变化事件
  window.addEventListener("auth-state-changed", handleAuthStateChange);

  console.log("MountExplorer权限状态:", {
    isAdmin: isAdmin.value,
    hasApiKey: hasApiKey.value,
    hasFilePermission: hasFilePermission.value,
    hasMountPermission: hasMountPermission.value,
    hasPermission: hasPermission.value,
    apiKeyInfo: apiKeyInfo.value,
  });
});

// 组件卸载时清理
onBeforeUnmount(() => {
  window.removeEventListener("auth-state-changed", handleAuthStateChange);
});
</script>
