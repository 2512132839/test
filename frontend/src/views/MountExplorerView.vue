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

    <!-- 主要内容区域 -->
    <div v-if="hasPermission" class="mount-explorer-main">
      <!-- 操作按钮 -->
      <div class="card mb-4" :class="darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'">
        <div class="p-3">
          <FileOperations
            :current-path="currentPath"
            :is-virtual="isVirtualDirectory"
            :dark-mode="darkMode"
            :view-mode="viewMode"
            :selected-items="selectedItems"
            @create-folder="handleCreateFolder"
            @refresh="handleRefresh"
            @change-view-mode="handleViewModeChange"
            @openUploadModal="handleOpenUploadModal"
            @openCopyModal="handleBatchCopy"
            @openTasksModal="handleOpenTasksModal"
            @task-created="handleTaskCreated"
            @show-message="handleShowMessage"
          />
        </div>
      </div>

      <!-- 上传弹窗 -->
      <UploadModal
        :is-open="isUploadModalOpen"
        :current-path="currentPath"
        :dark-mode="darkMode"
        :is-admin="authStore.isAdmin"
        @close="handleCloseUploadModal"
        @upload-success="handleUploadSuccess"
        @upload-error="handleUploadError"
      />

      <!-- 复制弹窗 -->
      <CopyModal
        :is-open="isCopyModalOpen"
        :dark-mode="darkMode"
        :selected-items="getSelectedItems()"
        :source-path="currentPath"
        :is-admin="authStore.isAdmin"
        :api-key-info="authStore.apiKeyInfo"
        @close="handleCloseCopyModal"
        @copy-started="handleCopyStarted"
        @copy-complete="handleCopyComplete"
      />

      <!-- 任务管理弹窗 -->
      <TasksModal :is-open="isTasksModalOpen" :dark-mode="darkMode" @close="handleCloseTasksModal" />

      <!-- 删除确认对话框 -->
      <div v-if="showDeleteDialog" class="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center">
        <div class="relative w-full max-w-md p-6 rounded-lg shadow-xl" :class="darkMode ? 'bg-gray-800' : 'bg-white'">
          <div class="mb-4">
            <h3 class="text-lg font-semibold" :class="darkMode ? 'text-gray-100' : 'text-gray-900'">
              {{ itemsToDelete.length === 1 ? t("mount.delete.title") : t("mount.batchDelete.title") }}
            </h3>
            <p class="text-sm mt-1" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
              <template v-if="itemsToDelete.length === 1">
                {{
                  t("mount.delete.message", {
                    type: itemsToDelete[0]?.isDirectory ? t("mount.fileTypes.folder") : t("mount.fileTypes.file"),
                    name: itemsToDelete[0]?.name,
                  })
                }}
                {{ itemsToDelete[0]?.isDirectory ? t("mount.delete.folderWarning") : "" }}
              </template>
              <template v-else>
                {{ t("mount.batchDelete.message", { count: itemsToDelete.length }) }}
                <div class="mt-2">
                  <div class="text-xs font-medium mb-1">{{ t("mount.batchDelete.selectedItems") }}</div>
                  <div class="max-h-32 overflow-y-auto bg-gray-50 dark:bg-gray-700 rounded p-2 text-xs">
                    <div v-for="item in itemsToDelete.slice(0, 10)" :key="item.path" class="flex items-center py-0.5">
                      <span class="truncate">{{ item.name }}</span>
                      <span v-if="item.isDirectory" class="ml-1 text-gray-500">{{ t("mount.batchDelete.folder") }}</span>
                    </div>
                    <div v-if="itemsToDelete.length > 10" class="text-gray-500 py-0.5">
                      {{ t("mount.batchDelete.moreItems", { count: itemsToDelete.length - 10 }) }}
                    </div>
                  </div>
                </div>
              </template>
            </p>
          </div>

          <div class="flex justify-end space-x-2">
            <button
              @click="cancelDelete"
              :disabled="isDeleting"
              class="px-4 py-2 rounded-md transition-colors"
              :class="[darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100', isDeleting ? 'opacity-50 cursor-not-allowed' : '']"
            >
              {{ itemsToDelete.length === 1 ? t("mount.delete.cancel") : t("mount.batchDelete.cancelButton") }}
            </button>
            <button
              @click="confirmDelete"
              :disabled="isDeleting"
              class="px-4 py-2 rounded-md text-white transition-colors flex items-center space-x-2"
              :class="[isDeleting ? 'bg-red-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700']"
            >
              <!-- 删除中的loading图标 -->
              <svg v-if="isDeleting" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>
                {{
                  isDeleting
                    ? itemsToDelete.length === 1
                      ? t("mount.delete.deleting")
                      : t("mount.batchDelete.deleting")
                    : itemsToDelete.length === 1
                    ? t("mount.delete.confirm")
                    : t("mount.batchDelete.confirmButton")
                }}
              </span>
            </button>
          </div>
        </div>
      </div>

      <!-- 消息提示 -->
      <div v-if="message" class="mb-4">
        <div
          class="p-3 rounded-md border"
          :class="{
            'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-700/50 dark:text-green-200': message.type === 'success',
            'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-700/50 dark:text-red-200': message.type === 'error',
            'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-700/50 dark:text-yellow-200': message.type === 'warning',
            'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700/50 dark:text-blue-200': message.type === 'info',
          }"
        >
          <div class="flex items-center">
            <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" v-if="message.type === 'success'">
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd"
              />
            </svg>
            <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" v-else-if="message.type === 'error'">
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clip-rule="evenodd"
              />
            </svg>
            <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" v-else-if="message.type === 'warning'">
              <path
                fill-rule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clip-rule="evenodd"
              />
            </svg>
            <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" v-else-if="message.type === 'info'">
              <path
                fill-rule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clip-rule="evenodd"
              />
            </svg>
            <span>{{ message.content }}</span>
          </div>
        </div>
      </div>

      <!-- 面包屑导航 -->
      <div class="mb-4">
        <BreadcrumbNav
          :current-path="currentPath"
          :dark-mode="darkMode"
          :preview-file="isPreviewMode ? previewFile : null"
          @navigate="handleNavigate"
          :is-checkbox-mode="isCheckboxMode"
          :selected-count="selectedCount"
          @toggle-checkbox-mode="toggleCheckboxMode"
          @batch-delete="batchDelete"
          @batch-copy="handleBatchCopy"
          @batch-add-to-basket="handleBatchAddToBasket"
          :basic-path="authStore.apiKeyInfo?.basic_path || '/'"
          :user-type="authStore.isAdmin ? 'admin' : 'user'"
        />
      </div>

      <!-- 内容区域 - 根据模式显示文件列表或文件预览 -->
      <div class="card" :class="darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'">
        <!-- 文件列表模式 -->
        <div v-if="!isPreviewMode">
          <!-- 错误提示 -->
          <div v-if="error" class="mb-4 p-4 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
            <div class="flex items-center">
              <svg class="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clip-rule="evenodd"
                ></path>
              </svg>
              <span class="text-red-700 dark:text-red-200">{{ error }}</span>
            </div>
          </div>

          <!-- 目录列表 -->
          <DirectoryList
            v-else
            :current-path="currentPath"
            :items="directoryItems"
            :loading="loading"
            :is-virtual="isVirtualDirectory"
            :dark-mode="darkMode"
            :view-mode="viewMode"
            :is-checkbox-mode="isCheckboxMode"
            :selected-items="getSelectedItems()"
            @navigate="handleNavigate"
            @download="handleDownload"
            @getLink="handleGetLink"
            @rename="handleRename"
            @delete="handleDelete"
            @preview="handlePreview"
            @item-select="handleItemSelect"
            @toggle-select-all="toggleSelectAll"
            @show-message="handleShowMessage"
          />
        </div>

        <!-- 文件预览模式 -->
        <div v-else>
          <div class="p-4">
            <!-- 返回按钮 -->
            <div class="mb-4">
              <button
                @click="closePreviewWithUrl"
                class="inline-flex items-center px-3 py-1.5 rounded-md transition-colors text-sm font-medium"
                :class="darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'"
              >
                <svg class="w-4 h-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>{{ t("mount.backToFileList") }}</span>
              </button>
            </div>

            <!-- 文件预览内容 -->
            <FilePreview
              :file="previewInfo || previewFile"
              :dark-mode="darkMode"
              :is-loading="isPreviewLoading"
              :is-admin="authStore.isAdmin"
              :api-key-info="authStore.apiKeyInfo"
              :has-file-permission="authStore.hasFilePermission"
              :directory-items="directoryItems"
              @download="handleDownload"
              @loaded="handlePreviewLoaded"
              @error="handlePreviewError"
              @show-message="handleShowMessage"
            />
          </div>
        </div>
      </div>
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
import { ref, computed, provide, onMounted, onBeforeUnmount, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";

// 组合式函数 - 使用统一聚合导出
import { useSelection, useFilePreview, useFileOperations, useUIState, useFileBasket } from "../composables/index.js";

// Store
import { useAuthStore } from "@/stores/authStore.js";
import { useFileSystemStore } from "../stores/fileSystemStore.js";

// 子组件
import BreadcrumbNav from "../components/mount-explorer/shared/BreadcrumbNav.vue";
import DirectoryList from "../components/mount-explorer/directory/DirectoryList.vue";
import FileOperations from "../components/mount-explorer/shared/FileOperations.vue";
import FilePreview from "../components/mount-explorer/preview/FilePreview.vue";
import UploadModal from "../components/mount-explorer/shared/modals/UploadModal.vue";
import CopyModal from "../components/mount-explorer/shared/modals/CopyModal.vue";
import TasksModal from "../components/mount-explorer/shared/modals/TasksModal.vue";
import SearchModal from "../components/mount-explorer/shared/modals/SearchModal.vue";

const { t } = useI18n();

// Vue Router
const router = useRouter();
const route = useRoute();

// 使用Store和组合式函数
const authStore = useAuthStore();
const fileSystemStore = useFileSystemStore();
const selection = useSelection();
const filePreview = useFilePreview();
const fileOperations = useFileOperations();

// 组合式函数
const uiState = useUIState();
const fileBasket = useFileBasket();

// 使用storeToRefs解构响应式状态
const { currentPath, loading, error, hasPermissionForCurrentPath, directoryItems, isVirtualDirectory } = storeToRefs(fileSystemStore);

// 解构方法（方法不需要storeToRefs）
const { refreshDirectory, navigateTo, initializeFromRoute, updateUrl } = fileSystemStore;

const { isCheckboxMode, selectedItems, selectedCount, setAvailableItems, toggleCheckboxMode, toggleSelectAll, getSelectedItems, selectItem } = selection;

const { previewFile, previewInfo, isPreviewMode, isLoading: isPreviewLoading, updatePreviewUrl, stopPreview, initPreviewFromRoute } = filePreview;

// 组合式函数状态和方法
const {
  // 消息管理
  message,
  showMessage,
  // 视图模式管理
  viewMode,
  setViewMode,
  // 弹窗状态管理
  isUploadModalOpen,
  isCopyModalOpen,
  isTasksModalOpen,
  isSearchModalOpen,

  openUploadModal,
  closeUploadModal,
  openCopyModal,
  closeCopyModal,
  openTasksModal,
  closeTasksModal,
  openSearchModal,
  closeSearchModal,
} = uiState;

const showDeleteDialog = ref(false);
const itemsToDelete = ref([]);
const isDeleting = ref(false);

const props = defineProps({
  darkMode: {
    type: Boolean,
    default: false,
  },
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

// ===== MountExplorerMain的所有方法 =====

/**
 * 处理导航
 */
const handleNavigate = async (path, previewFileName = null) => {
  if (previewFileName) {
    // 如果有预览文件，使用updateUrl
    updateUrl(path, previewFileName);
  } else {
    // 否则使用navigateTo
    await navigateTo(path);
  }
};

/**
 * 处理刷新
 */
const handleRefresh = async () => {
  await refreshDirectory();
};

/**
 * 处理视图模式变化
 */
const handleViewModeChange = (newViewMode) => {
  setViewMode(newViewMode);
  // 保存到本地存储
  localStorage.setItem("file_explorer_view_mode", newViewMode);
};

/**
 * 处理文件夹创建
 */
const handleCreateFolder = async ({ name, path }) => {
  if (!name || !path) return;

  // 使用fileOperations创建文件夹，传递正确的参数
  const result = await fileOperations.createFolder(path, name);

  if (result.success) {
    showMessage("success", result.message);
    // 重新加载当前目录内容
    await refreshDirectory();
  } else {
    showMessage("error", result.message);
  }
};

/**
 * 处理文件下载
 */
const handleDownload = async (item) => {
  const result = await fileOperations.downloadFile(item);

  if (result.success) {
    showMessage("success", result.message);
  } else {
    showMessage("error", result.message);
  }
};

/**
 * 处理获取文件链接
 */
const handleGetLink = async (item) => {
  const result = await fileOperations.getFileLink(item);

  if (result.success) {
    showMessage("success", result.message);
  } else {
    showMessage("error", result.message);
  }
};

/**
 * 处理文件预览
 */
const handlePreview = async (item) => {
  if (!item || item.isDirectory) return;

  // 只更新URL，让路由监听器处理实际的文件加载
  updatePreviewUrl(currentPath.value, item.name);

  // 滚动到顶部
  window.scrollTo({ top: 0, behavior: "smooth" });
};

/**
 * 处理文件删除（显示确认对话框）
 */
const handleDelete = (item) => {
  itemsToDelete.value = [item];
  showDeleteDialog.value = true;
};

/**
 * 处理文件重命名
 */
const handleRename = async ({ item, newName }) => {
  if (!item || !newName || !newName.trim()) return;

  // 构建新路径
  const parentPath = item.path.substring(0, item.path.lastIndexOf("/") + 1);
  const isDirectory = item.isDirectory;
  const oldPath = item.path;
  let newPath = parentPath + newName.trim();

  // 如果是目录，确保新路径末尾有斜杠
  if (isDirectory && !newPath.endsWith("/")) {
    newPath += "/";
  }

  // 使用fileOperations重命名
  const result = await fileOperations.renameItem(oldPath, newPath);

  if (result.success) {
    showMessage("success", result.message);
    // 重新加载当前目录内容
    await refreshDirectory();
  } else {
    showMessage("error", result.message);
  }
};

/**
 * 处理项目选择
 */
const handleItemSelect = (item, selected) => {
  selectItem(item, selected);
};

// handleItemDelete方法在原始文件中不存在，已删除（使用handleDelete代替）

/**
 * 处理批量删除
 */
const batchDelete = () => {
  const selectedFiles = getSelectedItems();

  if (selectedFiles.length === 0) {
    showMessage("warning", t("mount.messages.noItemsSelected"));
    return;
  }

  itemsToDelete.value = selectedFiles;
  showDeleteDialog.value = true;
};

/**
 * 取消删除
 */
const cancelDelete = () => {
  // 删除过程中不允许取消
  if (isDeleting.value) return;

  showDeleteDialog.value = false;
  itemsToDelete.value = [];
};

/**
 * 确认删除
 */
const confirmDelete = async () => {
  if (itemsToDelete.value.length === 0 || isDeleting.value) return;

  isDeleting.value = true;

  try {
    // 使用fileOperations删除项目
    const result = await fileOperations.batchDeleteItems(itemsToDelete.value);

    if (result.success) {
      showMessage("success", result.message);

      // 如果是批量删除，清空选择状态
      if (itemsToDelete.value.length > 1) {
        toggleCheckboxMode(false);
      }

      // 关闭对话框
      showDeleteDialog.value = false;
      itemsToDelete.value = [];

      // 重新加载当前目录内容
      await refreshDirectory();
    } else {
      showMessage("error", result.message);
    }
  } catch (error) {
    console.error("删除操作失败:", error);
    showMessage("error", error.message || t("mount.messages.deleteFailed", { message: t("common.unknown") }));
  } finally {
    isDeleting.value = false;
  }
};

// 这些方法在原始MountExplorerMain.vue中不存在，已删除

const handleBatchAddToBasket = () => {
  try {
    const selectedFiles = getSelectedItems();
    const result = fileBasket.addSelectedToBasket(selectedFiles, currentPath.value);

    if (result.success) {
      showMessage("success", result.message);
      // 可选：关闭勾选模式
      // toggleCheckboxMode(false);
    } else {
      showMessage("error", result.message);
    }
  } catch (error) {
    console.error("批量添加到文件篮失败:", error);
    showMessage("error", t("fileBasket.messages.batchAddFailed"));
  }
};

// 弹窗相关方法
const handleOpenUploadModal = () => {
  openUploadModal();
};

const handleCloseUploadModal = () => {
  closeUploadModal();
};

const handleUploadSuccess = async () => {
  showMessage("success", t("mount.messages.uploadSuccess"));
  await refreshDirectory();
};

const handleUploadError = (error) => {
  console.error("上传失败:", error);
  showMessage("error", error.message || t("mount.messages.uploadFailed"));
};

const handleBatchCopy = () => {
  if (selectedItems.value.length === 0) {
    showMessage("warning", t("mount.messages.noItemsSelected"));
    return;
  }
  openCopyModal();
};

const handleCloseCopyModal = () => {
  closeCopyModal();
};

const handleCopyStarted = (event) => {
  // 显示复制开始消息
  const message =
    event?.message ||
    t("mount.taskManager.copyStarted", {
      count: event?.itemCount || 0,
      path: event?.targetPath || "",
    });
  showMessage("success", message);
  toggleCheckboxMode(false);
};

const handleCopyComplete = async (event) => {
  // 复制完成后刷新目录
  // 注意：我们已经在copy-started事件中显示了开始消息，这里不再重复显示

  // 只有在模态框未关闭时才关闭模态框
  if (!event?.modalAlreadyClosed) {
    closeCopyModal();
  }

  await refreshDirectory();
};

const handleOpenTasksModal = () => {
  openTasksModal();
};

const handleCloseTasksModal = () => {
  closeTasksModal();
};

/**
 * 处理任务创建事件
 */
const handleTaskCreated = (taskInfo) => {
  console.log("文件篮任务已创建:", taskInfo);
  // 可以在这里添加额外的任务跟踪逻辑
  // 例如：打开任务管理器面板
  // openTasksModal();
};

const handleShowMessage = (messageInfo) => {
  showMessage(messageInfo.type, messageInfo.message);
};

// 预览相关方法
const handlePreviewLoaded = () => {
  console.log("预览加载完成");
};

const handlePreviewError = (error) => {
  console.error("预览加载失败:", error);
  showMessage("error", t("mount.messages.previewError"));
};

const closePreview = () => {
  stopPreview(false);
};

const closePreviewWithUrl = () => {
  closePreview();
  updateUrl(currentPath.value);
};

// 预览相关事件处理已在上面定义

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

// 监听目录项目变化，更新选择状态
watch(
  () => directoryItems.value,
  (newItems) => {
    setAvailableItems(newItems);
  },
  { immediate: true }
);

// 创建异步处理器防止竞态条件
const createAsyncProcessor = () => {
  let currentPromise = null;

  return async (asyncFn) => {
    // 如果有正在执行的异步操作，等待它完成
    if (currentPromise) {
      try {
        await currentPromise;
      } catch (error) {
        // 忽略之前操作的错误
      }
    }

    // 执行新的异步操作
    currentPromise = asyncFn();

    try {
      await currentPromise;
    } finally {
      currentPromise = null;
    }
  };
};

// 创建状态比较器
const createAuthStateComparator = () => {
  let previousAuthState = null;

  return (currentAuth) => {
    const currentState = {
      isAdmin: currentAuth.isAdmin,
      // 只比较关键的apiKeyInfo属性，避免深度序列化
      apiKeyId: currentAuth.apiKeyInfo?.id || null,
      basicPath: currentAuth.apiKeyInfo?.basic_path || null,
      permissions: currentAuth.apiKeyInfo?.permissions
        ? {
            text: !!currentAuth.apiKeyInfo.permissions.text,
            file: !!currentAuth.apiKeyInfo.permissions.file,
            mount: !!currentAuth.apiKeyInfo.permissions.mount,
          }
        : null,
    };

    // 首次调用
    if (!previousAuthState) {
      previousAuthState = { ...currentState };
      return { changed: true, isFirstCall: true, changes: ["initial"] };
    }

    // 精确比较关键属性
    const changes = [];
    if (currentState.isAdmin !== previousAuthState.isAdmin) {
      changes.push("isAdmin");
    }
    if (currentState.apiKeyId !== previousAuthState.apiKeyId) {
      changes.push("apiKeyId");
    }
    if (currentState.basicPath !== previousAuthState.basicPath) {
      changes.push("basicPath");
    }

    // 比较权限对象
    const oldPerms = previousAuthState.permissions;
    const newPerms = currentState.permissions;
    if (JSON.stringify(oldPerms) !== JSON.stringify(newPerms)) {
      changes.push("permissions");
    }

    const hasChanges = changes.length > 0;
    if (hasChanges) {
      previousAuthState = { ...currentState };
    }

    return { changed: hasChanges, isFirstCall: false, changes };
  };
};

const asyncProcessor = createAsyncProcessor();
const authComparator = createAuthStateComparator();

// 处理目录变化的统一方法
const handleDirectoryChange = async () => {
  try {
    await initializeFromRoute();
  } catch (error) {
    console.error("目录变化处理失败:", error);
  }
};

// 处理预览变化的统一方法
const handlePreviewChange = async () => {
  try {
    await initPreviewFromRoute(currentPath.value, directoryItems.value);
  } catch (error) {
    console.error("预览变化处理失败:", error);
    showMessage("error", t("mount.messages.previewLoadFailed"));
  }
};

// 权限状态监听器
watch(
  () => ({ isAdmin: authStore.isAdmin, apiKeyInfo: authStore.apiKeyInfo }),
  (newAuth) => {
    const comparison = authComparator(newAuth);

    if (comparison.changed) {
      console.log("权限状态变化检测:", {
        isFirstCall: comparison.isFirstCall,
        changes: comparison.changes,
        newAuth: {
          isAdmin: newAuth.isAdmin,
          apiKeyId: newAuth.apiKeyInfo?.id,
          basicPath: newAuth.apiKeyInfo?.basic_path,
        },
      });

      // 确保权限信息已经加载
      if (typeof newAuth.isAdmin !== "boolean") {
        console.log("等待权限信息加载...");
        return;
      }

      // 使用异步处理器防止竞态条件
      asyncProcessor(async () => {
        await handleDirectoryChange();
      });
    }
  },
  { immediate: true }
);

// 路由路径监听器
watch(
  () => route.params.pathMatch,
  (newPath, oldPath) => {
    if (newPath !== oldPath) {
      asyncProcessor(async () => {
        await handleDirectoryChange();
      });
    }
  }
);

// 预览文件监听器
watch(
  () => route.query.preview,
  () => {
    asyncProcessor(async () => {
      await handlePreviewChange();
    });
  },
  { immediate: true }
);

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

  // 恢复视图首选项
  const savedViewMode = localStorage.getItem("file_explorer_view_mode");
  if (savedViewMode) {
    setViewMode(savedViewMode);
  }

  console.log("MountExplorer权限状态:", {
    isAdmin: isAdmin.value,
    hasApiKey: hasApiKey.value,
    hasFilePermission: hasFilePermission.value,
    hasMountPermission: hasMountPermission.value,
    hasPermission: hasPermission.value,
    apiKeyInfo: apiKeyInfo.value,
  });
});

// 组件卸载时清理资源
onBeforeUnmount(() => {
  console.log("MountExplorerView组件卸载，清理资源");

  // 移除事件监听器
  window.removeEventListener("auth-state-changed", handleAuthStateChange);
  document.removeEventListener("keydown", handleGlobalKeydown);

  // 停止预览
  if (isPreviewMode.value) {
    stopPreview(false);
  }

  // 清理选择状态
  toggleCheckboxMode(false);
});

// 组件卸载时清理
onBeforeUnmount(() => {
  console.log("MountExplorerView组件卸载，清理资源");

  // 停止预览
  if (isPreviewMode.value) {
    stopPreview(false);
  }

  // 清理选择状态
  toggleCheckboxMode(false);

  // 移除事件监听器
  window.removeEventListener("auth-state-changed", handleAuthStateChange);
  document.removeEventListener("keydown", handleGlobalKeydown);
});
</script>
