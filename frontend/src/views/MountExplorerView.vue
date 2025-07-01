<template>
  <div class="mount-explorer-container mx-auto px-3 sm:px-6 flex-1 flex flex-col pt-6 sm:pt-8 w-full max-w-full sm:max-w-6xl">
    <div class="header mb-4 border-b pb-2 flex justify-between items-center" :class="darkMode ? 'border-gray-700' : 'border-gray-200'">
      <h2 class="text-xl font-semibold" :class="darkMode ? 'text-gray-100' : 'text-gray-900'">{{ $t("mount.title") }}</h2>

      <!-- 搜索按钮 -->
      <button
        @click="handleOpenSearchModal"
        class="flex items-center gap-2 px-3 py-1.5 rounded-md border transition-all duration-200 hover:shadow-sm"
        :class="
          darkMode
            ? 'border-gray-600 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-gray-200'
            : 'border-gray-300 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-700'
        "
        :title="$t('search.title')"
      >
        <!-- 搜索图标 -->
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>

        <!-- 搜索文字（在小屏幕上隐藏） -->
        <span class="hidden sm:inline text-sm text-gray-500" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
          {{ $t("search.placeholder") }}
        </span>

        <!-- 快捷键提示（在大屏幕上显示） -->
        <kbd
          class="hidden lg:inline-flex items-center px-1.5 py-0.5 text-xs font-mono rounded border"
          :class="darkMode ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-100 border-gray-300 text-gray-600'"
        >
          Ctrl K
        </kbd>
      </button>
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

    <!-- 挂载浏览器主组件 -->
    <div v-if="hasPermission" class="main-content">
      <MountExplorerMain />
    </div>

    <!-- 搜索弹窗 -->
    <SearchModal
      :is-open="isSearchModalOpen"
      :dark-mode="darkMode"
      :current-path="currentPath"
      :current-mount-id="currentMountId"
      @close="handleCloseSearchModal"
      @item-click="handleSearchItemClick"
    />
  </div>
</template>

<script setup>
import { computed, provide, onMounted, onBeforeUnmount, ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "../stores/authStore.js";
import { useUIState } from "../composables/ui-interaction/useUIState.js";
import { useFileSystemStore } from "../stores/fileSystemStore.js";
import MountExplorerMain from "../components/mount-explorer/MountExplorerMain.vue";
import SearchModal from "../components/mount-explorer/shared/modals/SearchModal.vue";

// Vue Router
const router = useRouter();
const route = useRoute();

// 使用Store
const authStore = useAuthStore();
const fileSystemStore = useFileSystemStore();

// 使用UI状态管理
const uiState = useUIState();
const { isSearchModalOpen, openSearchModal, closeSearchModal, showMessage } = uiState;

const props = defineProps({
  darkMode: {
    type: Boolean,
    default: false,
  },
});

// 获取当前路径和挂载ID
const currentPath = computed(() => {
  const pathMatch = route.params.pathMatch;
  if (!pathMatch) {
    return "/";
  }

  // 处理pathMatch可能是数组的情况
  if (Array.isArray(pathMatch)) {
    return `/${pathMatch.join("/")}`;
  }

  return `/${pathMatch}`;
});

const currentMountId = computed(() => {
  // 从fileSystemStore的directoryData中获取挂载点信息
  const directoryData = fileSystemStore.directoryData;

  // 如果是实际挂载点目录，directoryData会包含mount_id
  if (directoryData && directoryData.mount_id) {
    console.log("从directoryData获取挂载点ID:", directoryData.mount_id);
    return directoryData.mount_id;
  }

  // 如果是虚拟目录，检查items中是否有挂载点
  if (directoryData && directoryData.items) {
    const mountItem = directoryData.items.find((item) => item.isMount && item.mount_id);
    if (mountItem) {
      console.log("从虚拟目录items获取挂载点ID:", mountItem.mount_id);
      return mountItem.mount_id;
    }
  }

  // 如果都没有，尝试从路径中提取（作为备用方案）
  const pathSegments = currentPath.value.split("/").filter(Boolean);
  const extractedId = pathSegments.length > 0 ? pathSegments[0] : "";
  console.log("从路径提取挂载点ID:", extractedId);
  return extractedId;
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

// 搜索相关事件处理
const handleOpenSearchModal = () => {
  openSearchModal();
};

const handleCloseSearchModal = () => {
  closeSearchModal();
};

// 处理搜索结果项点击
const handleSearchItemClick = async (item) => {
  try {
    console.log("搜索结果项点击:", item);

    // 如果是文件，导航到文件所在目录并预览文件
    if (!item.isDirectory) {
      const directoryPath = item.path.substring(0, item.path.lastIndexOf("/")) || "/";
      const fileName = item.name;

      console.log("文件导航:", { directoryPath, fileName });

      // 构建正确的路由路径
      let routePath = "/mount-explorer";
      if (directoryPath !== "/") {
        // 移除开头的斜杠，因为路由已经包含了
        const normalizedPath = directoryPath.replace(/^\/+/, "");
        routePath = `/mount-explorer/${normalizedPath}`;
      }

      // 导航到目录，并在URL中添加预览参数
      await router.push({
        path: routePath,
        query: { preview: fileName },
      });
    } else {
      // 如果是目录，直接导航到该目录
      console.log("目录导航:", item.path);

      let routePath = "/mount-explorer";
      if (item.path !== "/") {
        // 移除开头的斜杠，因为路由已经包含了
        const normalizedPath = item.path.replace(/^\/+/, "");
        routePath = `/mount-explorer/${normalizedPath}`;
      }

      await router.push(routePath);
    }

    // 关闭搜索模态框
    closeSearchModal();
  } catch (error) {
    console.error("搜索结果导航失败:", error);
    showMessage("error", "导航失败: " + error.message);
  }
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

// 全局快捷键处理
const handleGlobalKeydown = (event) => {
  // Ctrl+K 打开搜索
  if ((event.ctrlKey || event.metaKey) && event.key === "k") {
    event.preventDefault();
    if (hasPermission.value && !isSearchModalOpen.value) {
      handleOpenSearchModal();
    }
  }

  // ESC 关闭搜索
  if (event.key === "Escape" && isSearchModalOpen.value) {
    handleCloseSearchModal();
  }
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

  // 监听全局快捷键
  document.addEventListener("keydown", handleGlobalKeydown);

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
  document.removeEventListener("keydown", handleGlobalKeydown);
});
</script>
