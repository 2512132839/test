<!--
  重构后的文件浏览器主组件
  使用新的分层架构，只负责UI展示和用户交互
-->
<template>
  <div class="mount-explorer-main">
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
          <button @click="cancelDelete" class="px-4 py-2 rounded-md transition-colors" :class="darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'">
            {{ itemsToDelete.length === 1 ? t("mount.delete.cancel") : t("mount.batchDelete.cancelButton") }}
          </button>
          <button @click="confirmDelete" class="px-4 py-2 rounded-md text-white transition-colors bg-red-600 hover:bg-red-700">
            {{ itemsToDelete.length === 1 ? t("mount.delete.confirm") : t("mount.batchDelete.confirmButton") }}
          </button>
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
          <svg v-if="message.type === 'success'" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <svg v-else-if="message.type === 'error'" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <svg v-else-if="message.type === 'warning'" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{{ message.content }}</span>
        </div>
      </div>
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
            <span class="text-red-800 dark:text-red-200">{{ error }}</span>
          </div>
        </div>

        <!-- 权限提示 -->
        <div v-if="!hasPermissionForCurrentPath" class="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg m-4">
          <div class="flex items-center">
            <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path
                  fill-rule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clip-rule="evenodd"
              ></path>
            </svg>
            <span class="text-yellow-800 dark:text-yellow-200">
              {{ t("mount.noPermissionForPath", { path: authStore.apiKeyInfo?.basic_path || "/" }) }}
            </span>
          </div>
        </div>

        <!-- 目录列表 -->
        <DirectoryList
            v-else
            :items="directoryItems"
            :loading="loading"
            :is-virtual="isVirtualDirectory"
            :dark-mode="darkMode"
            :view-mode="viewMode"
            :is-checkbox-mode="isCheckboxMode"
            :selected-items="getSelectedItems()"
            :current-path="currentPath"
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
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, watch, onMounted, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";

// 组合式函数 - 使用统一聚合导出
import { useSelection, useFilePreview, useFileOperations, useUIState, useFileBasket } from "../../composables/index.js";

// Store
import { useAuthStore } from "../../stores/authStore.js";
import { useFileSystemStore } from "../../stores/fileSystemStore.js";

// 子组件 - 更新为新的组件结构路径
import BreadcrumbNav from "./shared/BreadcrumbNav.vue";
import DirectoryList from "./directory/DirectoryList.vue";
import FileOperations from "./shared/FileOperations.vue";
import FilePreview from "./preview/FilePreview.vue";
import UploadModal from "./shared/modals/UploadModal.vue";
import CopyModal from "./shared/modals/CopyModal.vue";
import TasksModal from "./shared/modals/TasksModal.vue";

const { t } = useI18n();
const route = useRoute();

// 从父组件注入的数据
const darkMode = inject("darkMode");

// 使用Store和组合式函数
const fileSystemStore = useFileSystemStore();
const selection = useSelection();
const filePreview = useFilePreview();
const fileOperations = useFileOperations();
const authStore = useAuthStore();

// 使用新的组合式函数
const uiState = useUIState();
const fileBasket = useFileBasket();

// 使用storeToRefs解构响应式状态
const { currentPath, loading, error, hasPermissionForCurrentPath, directoryItems, isVirtualDirectory } = storeToRefs(fileSystemStore);

// 解构方法（方法不需要storeToRefs）
const { refreshDirectory, navigateTo, initializeFromRoute, updateUrl } = fileSystemStore;

const { isCheckboxMode, selectedItems, selectedCount, setAvailableItems, toggleCheckboxMode, toggleSelectAll, getSelectedItems } = selection;

const { previewFile, previewInfo, isPreviewMode, isLoading: isPreviewLoading, updatePreviewUrl, stopPreview, initPreviewFromRoute } = filePreview;

// 解构新的组合式函数状态和方法
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

  openUploadModal,
  closeUploadModal,
  openCopyModal,
  closeCopyModal,
  openTasksModal,
  closeTasksModal,
} = uiState;

const showDeleteDialog = ref(false);
const itemsToDelete = ref([]);

// 计算属性

// 事件处理函数

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
  // 对于API密钥用户，先重新验证认证状态
  if (!authStore.isAdmin && authStore.authType === "apikey") {
    try {
      // 重新验证认证状态，这会更新API密钥信息
      await authStore.validateAuth();

      // 检查当前路径是否在新的基础路径权限范围内
      const newBasicPath = authStore.userInfo.basicPath || "/";
      const normalizedNewBasicPath = newBasicPath === "/" ? "/" : newBasicPath.replace(/\/+$/, "");
      const normalizedCurrentPath = currentPath.value.replace(/\/+$/, "") || "/";

      // 如果新的基础路径不是根路径，且当前路径不在新基础路径范围内，则需要重定向
      if (normalizedNewBasicPath !== "/" && normalizedCurrentPath !== normalizedNewBasicPath && !normalizedCurrentPath.startsWith(normalizedNewBasicPath + "/")) {
        console.log("检测到当前路径超出新的基础路径权限范围，导航到新的基本路径:", newBasicPath);
        console.log("当前路径:", normalizedCurrentPath, "新基础路径:", normalizedNewBasicPath);
        await navigateTo(newBasicPath);
        return;
      }
      showMessage("success", t("mount.messages.apiKeyInfoUpdated"));
    } catch (error) {
      console.error("刷新认证状态失败:", error);
    }
  } else {
    showMessage("success", t("mount.messages.refreshSuccess"));
  }

  await refreshDirectory();
};

/**
 * 处理视图模式切换
 */
const handleViewModeChange = (mode) => {
  setViewMode(mode);
  localStorage.setItem("file_explorer_view_mode", mode);
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
  selection.selectItem(item, selected);
};

/**
 * 批量删除（显示确认对话框）
 */
const batchDelete = () => {
  const selectedItems = selection.getSelectedItems();

  if (selectedItems.length === 0) {
    showMessage("warning", t("mount.messages.noItemsSelected"));
    return;
  }

  itemsToDelete.value = selectedItems;
  showDeleteDialog.value = true;
};

/**
 * 取消删除
 */
const cancelDelete = () => {
  showDeleteDialog.value = false;
  itemsToDelete.value = [];
};

/**
 * 确认删除
 */
const confirmDelete = async () => {
  if (itemsToDelete.value.length === 0) return;

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
};

/**
 * 处理批量复制
 */
const handleBatchCopy = () => {
  const selectedItems = selection.getSelectedItems();

  if (selectedItems.length === 0) {
    showMessage("warning", t("mount.messages.noItemsSelected"));
    return;
  }

  openCopyModal();
};

// 弹窗事件处理函数
const handleOpenUploadModal = () => {
  openUploadModal();
};
const handleCloseUploadModal = () => {
  closeUploadModal();
};
const handleCloseCopyModal = () => {
  closeCopyModal();
};
const handleOpenTasksModal = () => {
  openTasksModal();
};
const handleCloseTasksModal = () => {
  closeTasksModal();
};

// 上传成功处理
const handleUploadSuccess = async () => {
  await refreshDirectory();
  showMessage("success", t("mount.messages.uploadSuccess"));
};

// 上传错误处理
const handleUploadError = (error) => {
  console.error("上传失败:", error);
  showMessage("error", t("mount.messages.uploadFailed", { message: error.message || t("common.unknown") }));
};

// 复制完成处理
const handleCopyComplete = (event) => {
  // 使用事件中的消息，如果没有则使用默认消息
  const message = event?.message || t("mount.messages.copySuccess", { message: t("mount.taskManager.copyStarted", { count: 0, path: "" }) });
  showMessage("success", message);
  toggleCheckboxMode(false);
  closeCopyModal(); // 关闭复制模态框
  refreshDirectory();
};

// ===== 文件篮相关事件处理 =====

/**
 * 处理批量添加到文件篮
 */
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

/**
 * 处理任务创建事件
 */
const handleTaskCreated = (taskInfo) => {
  console.log("文件篮任务已创建:", taskInfo);
  // 可以在这里添加额外的任务跟踪逻辑
  // 例如：打开任务管理器面板
  // openTasksModal();
};

/**
 * 处理消息显示事件
 */
const handleShowMessage = (messageInfo) => {
  showMessage(messageInfo.type, messageInfo.message);
};

// 预览相关事件处理
const handlePreviewLoaded = () => {
  console.log("预览加载完成");
};

const handlePreviewError = (error) => {
  console.error("预览加载失败:", error);
  showMessage("error", t("mount.messages.previewError"));
};

// 关闭预览
const closePreview = () => {
  stopPreview(false); // 不自动更新URL
};

const closePreviewWithUrl = () => {
  closePreview();
  updateUrl(currentPath.value);
};

// 监听目录项目变化，更新选择状态
watch(
    () => directoryItems.value,
    (newItems) => {
      setAvailableItems(newItems);
    },
    { immediate: true }
);

/**
 * 处理目录变化 - 需要重新加载目录
 */
const handleDirectoryChange = async () => {
  try {
    await initializeFromRoute();
  } catch (error) {
    console.error("目录变化处理失败:", error);
    showMessage("error", "页面加载失败");
  }
};

/**
 * 处理预览变化 - 只需要初始化预览
 */
const handlePreviewChange = async () => {
  try {
    await initPreviewFromRoute(currentPath.value, directoryItems.value);
  } catch (error) {
    console.error("预览变化处理失败:", error);
    showMessage("error", "预览加载失败");
  }
};

// ===== 状态监听器系统 =====

/**
 * 创建认证状态比较器
 */
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
    const currentPerms = currentState.permissions;
    const prevPerms = previousAuthState.permissions;
    if (JSON.stringify(currentPerms) !== JSON.stringify(prevPerms)) {
      changes.push("permissions");
    }

    const hasChanges = changes.length > 0;
    if (hasChanges) {
      previousAuthState = { ...currentState };
    }

    return {
      changed: hasChanges,
      isFirstCall: false,
      changes,
    };
  };
};

/**
 * 创建异步处理队列，防止竞态条件
 */
const createAsyncProcessor = () => {
  let isProcessing = false;
  let pendingOperation = null;

  return async (operation) => {
    // 如果正在处理，记录待处理操作
    if (isProcessing) {
      pendingOperation = operation;
      return;
    }

    isProcessing = true;

    try {
      await operation();

      // 处理待处理的操作
      if (pendingOperation) {
        const nextOperation = pendingOperation;
        pendingOperation = null;
        await nextOperation();
      }
    } catch (error) {
      console.error("异步处理失败:", error);
      showMessage("error", "页面加载失败，请刷新重试");
    } finally {
      isProcessing = false;
    }
  };
};

// 创建状态比较器和异步处理器实例
const authComparator = createAuthStateComparator();
const asyncProcessor = createAsyncProcessor();

// 权限状态监听器 - 高性能版本
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

// 路由路径监听器 - 独立处理
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

// 预览文件监听器 - 独立处理
watch(
    () => route.query.preview,
    () => {
      asyncProcessor(async () => {
        await handlePreviewChange();
      });
    },
    { immediate: true }
);

// 组件挂载时恢复视图首选项
onMounted(() => {
  const savedViewMode = localStorage.getItem("file_explorer_view_mode");
  if (savedViewMode) {
    setViewMode(savedViewMode);
  }
});

// 组件卸载时清理资源
onBeforeUnmount(() => {
  console.log("MountExplorerMain组件卸载，清理资源");
  // 停止预览
  if (isPreviewMode.value) {
    stopPreview(false);
  }
  // 清理选择状态
  toggleCheckboxMode(false);
});
</script>
