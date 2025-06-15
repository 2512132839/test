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

    <div v-if="hasPermission" class="main-content">
      <!-- 操作按钮 -->
      <div class="card mb-4" :class="darkMode ? 'bg-gray-800/50' : 'bg-white'">
        <div class="p-3">
          <FileOperations
              :current-path="currentPath"
              :is-virtual="directoryData?.isVirtual"
              :dark-mode="darkMode"
              :view-mode="viewMode"
              :selected-items="selectedItems"
              @upload="handleUpload"
              @create-folder="handleCreateFolder"
              @refresh="handleRefresh"
              @change-view-mode="handleViewModeChange"
              @openUploadModal="handleOpenUploadModal"
              @openCopyModal="handleBatchCopy"
              @openTasksModal="handleOpenTasksModal"
          />
        </div>
      </div>

      <!-- 上传弹窗 -->
      <UploadModal
          :is-open="showUploadModal"
          :dark-mode="darkMode"
          :current-path="currentPath"
          :is-admin="isAdmin"
          @close="handleCloseUploadModal"
          @upload-success="handleUploadSuccess"
          @upload-error="handleUploadError"
      />

      <!-- 复制模态窗口 -->
      <CopyModal
          :is-open="showCopyModal"
          :dark-mode="darkMode"
          :selected-items="selectedItems"
          :source-path="currentPath"
          :is-admin="isAdmin"
          :api-key-info="apiKeyInfo"
          @close="handleCloseCopyModal"
          @copy-complete="handleCopyComplete"
      />

      <!-- 任务管理弹窗 -->
      <TasksModal :is-open="showTasksModal" :dark-mode="darkMode" @close="handleCloseTasksModal" />

      <!-- 面包屑导航 -->
      <div class="mb-4">
        <BreadcrumbNav
            :current-path="currentPath"
            :dark-mode="darkMode"
            :preview-file="isPreviewMode ? previewFile : null"
            @navigate="navigateTo"
            :is-checkbox-mode="isCheckboxMode"
            :selected-count="selectedCount"
            @toggle-checkbox-mode="toggleCheckboxMode"
            @batch-delete="batchDelete"
            @batch-copy="handleBatchCopy"
            :basic-path="apiKeyInfo?.basic_path || '/'"
            :user-type="isAdmin ? 'admin' : 'user'"
        />
      </div>

      <!-- 消息提示 -->
      <div
          v-if="message"
          class="mb-4 p-3 rounded-md"
          :class="
          message.type === 'error'
            ? darkMode
              ? 'bg-red-900/40 border border-red-800 text-red-200'
              : 'bg-red-50 border border-red-200 text-red-800'
            : message.type === 'info'
            ? darkMode
              ? 'bg-blue-900/40 border border-blue-800 text-blue-200'
              : 'bg-blue-50 border border-blue-200 text-blue-800'
            : message.type === 'warning'
            ? darkMode
              ? 'bg-yellow-900/40 border border-yellow-800 text-yellow-200'
              : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
            : darkMode
            ? 'bg-green-900/40 border border-green-800 text-green-200'
            : 'bg-green-50 border border-green-200 text-green-800'
        "
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <!-- 成功图标 -->
            <svg
                v-if="message.type === 'success'"
                class="h-5 w-5 mr-2"
                :class="darkMode ? 'text-green-300' : 'text-green-500'"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>

            <!-- 信息图标 -->
            <svg
                v-else-if="message.type === 'info'"
                class="h-5 w-5 mr-2"
                :class="darkMode ? 'text-blue-300' : 'text-blue-500'"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>

            <!-- 警告图标 -->
            <svg
                v-else-if="message.type === 'warning'"
                class="h-5 w-5 mr-2"
                :class="darkMode ? 'text-yellow-300' : 'text-yellow-500'"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
              <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>

            <!-- 错误图标 -->
            <svg v-else class="h-5 w-5 mr-2" :class="darkMode ? 'text-red-300' : 'text-red-500'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>

            {{ message.content }}
          </div>

          <!-- 上传操作时显示取消按钮 -->
          <button
              v-if="isUploading && message.type === 'info'"
              @click="cancelUpload"
              class="ml-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium"
              :class="darkMode ? 'bg-red-800/50 hover:bg-red-700/60 text-red-200' : 'bg-red-100 hover:bg-red-200 text-red-700'"
          >
            <svg class="w-3 h-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            {{ $t("mount.cancel") }}
          </button>
        </div>

        <!-- 上传进度条 -->
        <div v-if="isUploading && uploadProgress > 0 && message.type === 'info'" class="mt-2">
          <div class="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
            <div class="h-2 rounded-full transition-all duration-200" :style="{ width: `${uploadProgress}%` }" :class="uploadProgress > 95 ? 'bg-green-500' : 'bg-blue-500'"></div>
          </div>
        </div>
      </div>

      <!-- 内容区域 - 根据模式显示文件列表或文件预览 -->
      <div class="card" :class="darkMode ? 'bg-gray-800/50' : 'bg-white'">
        <!-- 文件列表模式 -->
        <div v-if="!isPreviewMode">
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
              <span class="text-yellow-800 dark:text-yellow-200"> {{ t("mount.noPermissionForPath", { path: apiKeyInfo?.basic_path || "/" }) }} </span>
            </div>
          </div>

          <DirectoryList
              v-else
              :items="directoryData?.items || []"
              :loading="loading"
              :is-virtual="directoryData?.isVirtual"
              :dark-mode="darkMode"
              :view-mode="viewMode"
              :is-checkbox-mode="isCheckboxMode"
              :selected-items="selectedItems"
              @navigate="navigateTo"
              @download="handleDownload"
              @rename="handleRename"
              @delete="handleDelete"
              @preview="handlePreview"
              @item-select="handleItemSelect"
              @toggle-select-all="toggleSelectAll"
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
                <span>{{ $t("mount.backToFileList") }}</span>
              </button>
            </div>

            <!-- 文件预览内容 -->
            <FilePreview
                :file="previewFile"
                :dark-mode="darkMode"
                :is-admin="isAdmin"
                :is-loading="isPreviewLoading"
                @download="handleDownload"
                @loaded="handlePreviewLoaded"
                @error="handlePreviewError"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 批量删除确认对话框 -->
    <div v-if="showBatchDeleteDialog" class="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center">
      <div class="relative w-full max-w-md p-6 rounded-lg shadow-xl" :class="darkMode ? 'bg-gray-800' : 'bg-white'">
        <div class="mb-4">
          <h3 class="text-lg font-semibold" :class="darkMode ? 'text-gray-100' : 'text-gray-900'">{{ t("mount.batchDelete.title") }}</h3>
          <p class="text-sm mt-1" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ t("mount.batchDelete.message", { count: itemsToDelete.length }) }}</p>
          <!-- 选中项目列表 -->
          <div v-if="itemsToDelete.length > 0" class="mt-3 max-h-40 overflow-y-auto">
            <div class="text-xs font-medium mb-1" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">{{ t("mount.batchDelete.selectedItems") }}</div>
            <ul class="text-xs">
              <li v-for="item in itemsToDelete.slice(0, 10)" :key="item.path" class="mb-1" :class="darkMode ? 'text-gray-400' : 'text-gray-600'">
                {{ item.name }} {{ item.isDirectory ? t("mount.batchDelete.folder") : "" }}
              </li>
              <li v-if="itemsToDelete.length > 10" :class="darkMode ? 'text-gray-400' : 'text-gray-600'">
                {{ t("mount.batchDelete.moreItems", { count: itemsToDelete.length - 10 }) }}
              </li>
            </ul>
          </div>
        </div>

        <div class="flex justify-end space-x-2">
          <button
              @click="cancelBatchDelete"
              class="px-4 py-2 rounded-md transition-colors"
              :class="darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'"
          >
            {{ t("mount.batchDelete.cancelButton") }}
          </button>
          <button @click="confirmBatchDelete" class="px-4 py-2 rounded-md text-white transition-colors bg-red-600 hover:bg-red-700">
            {{ t("mount.batchDelete.confirmButton") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed, provide } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
import { api } from "../api";
import BreadcrumbNav from "./mount-explorer/BreadcrumbNav.vue";
import DirectoryList from "./mount-explorer/DirectoryList.vue";
import FileOperations from "./mount-explorer/FileOperations.vue";
import FilePreview from "./mount-explorer/FilePreview.vue";
import UploadModal from "./mount-explorer/UploadModal.vue";
import CopyModal from "./mount-explorer/CopyModal.vue";
import TasksModal from "./mount-explorer/TasksModal.vue";
import { downloadFileWithAuth } from "../utils/fileUtils";

// Vue Router
const router = useRouter();

const props = defineProps({
  darkMode: {
    type: Boolean,
    default: false,
  },
  pathMatch: {
    type: [String, Array],
    default: "",
  },
  previewFile: {
    type: String,
    default: null,
  },
});

// 数据状态
const currentPath = ref("/");
const directoryData = ref(null);
const loading = ref(false);
const message = ref(null);
const viewMode = ref("list"); // 默认列表视图

// 文件预览状态
const previewFile = ref(null);
const isPreviewMode = ref(false); // 是否处于预览模式，true为预览模式，false为文件列表模式
const isPreviewLoading = ref(false); // 文件预览内容加载状态

// 上传弹窗状态
const showUploadModal = ref(false);

// 权限状态
const isAdmin = ref(false);
const hasApiKey = ref(false);
const hasFilePermission = ref(false);
const hasMountPermission = ref(false); // 挂载权限状态变量
const hasPermission = ref(false);

// API密钥信息
const apiKeyInfo = ref(null);

// 添加上传状态管理
const isUploading = ref(false);
const uploadProgress = ref(0);
const cancelUploadFlag = ref(false);

// 勾选模式状态
const isCheckboxMode = ref(false); // 是否启用勾选框模式
const selectedItems = ref([]); // 已选中的文件/文件夹

// 批量删除对话框相关变量
const showBatchDeleteDialog = ref(false);
const itemsToDelete = ref([]);

// 复制模态窗口相关变量
const showCopyModal = ref(false);

// 任务管理弹窗相关变量
const showTasksModal = ref(false);

// 是否正在内部导航（防止路由监听器重复调用）
const isInternalNavigation = ref(false);

// 计算已选中项数量
const selectedCount = computed(() => selectedItems.value.length);

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
  const normalizedCurrentPath = currentPath.value.replace(/\/+$/, "") || "/";

  // 如果基本路径是根路径，允许访问所有路径
  if (normalizedBasicPath === "/") {
    return true;
  }

  // 只有当前路径是基本路径或其子路径时才有权限
  return normalizedCurrentPath === normalizedBasicPath || normalizedCurrentPath.startsWith(normalizedBasicPath + "/");
});

// 重新获取API密钥信息
const refreshApiKeyInfo = async () => {
  const apiKey = localStorage.getItem("api_key");
  if (!apiKey) return false;

  try {
    console.log("正在重新获取API密钥信息...");
    const response = await api.test.verifyApiKey();

    if (response.success && response.data) {
      // 更新权限信息
      if (response.data.permissions) {
        localStorage.setItem("api_key_permissions", JSON.stringify(response.data.permissions));
      }

      // 更新密钥信息
      if (response.data.key_info) {
        localStorage.setItem("api_key_info", JSON.stringify(response.data.key_info));
      }

      console.log("API密钥信息更新成功");
      return true;
    }
  } catch (error) {
    console.error("重新获取API密钥信息失败:", error);
  }

  return false;
};

// 检查权限
const checkPermissions = () => {
  // 获取管理员token或API密钥
  const adminToken = localStorage.getItem("admin_token");
  const apiKey = localStorage.getItem("api_key");

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
  });
};

// 处理刷新操作
const handleRefresh = async () => {
  try {
    // 先清理缓存
    try {
      console.log("正在清理目录缓存...");
      const clearCacheFunction = isAdmin.value ? api.admin.clearCache : api.user.system.clearCache;
      const cacheResponse = await clearCacheFunction();

      if (cacheResponse.success) {
        console.log(`缓存清理成功，共清理 ${cacheResponse.data?.clearedCount || 0} 项`);
      } else {
        console.warn("缓存清理失败:", cacheResponse.message);
      }
    } catch (cacheError) {
      console.warn("清理缓存时出错:", cacheError);
      // 缓存清理失败不影响后续刷新操作
    }

    // 对于API密钥用户，先刷新API密钥信息
    if (!isAdmin.value && hasApiKey.value) {
      const refreshed = await refreshApiKeyInfo();
      if (refreshed) {
        // 重新检查权限
        checkPermissions();

        // 检查基本路径是否发生变化，如果是则导航到新的基本路径
        const newBasicPath = apiKeyInfo.value?.basic_path || "/";
        const currentBasicPath = currentPath.value.replace(/\/+$/, "") || "/";

        // 如果当前路径不在新的基本路径范围内，导航到新的基本路径
        if (newBasicPath !== "/" && !currentBasicPath.startsWith(newBasicPath.replace(/\/+$/, ""))) {
          console.log("检测到基本路径变化，导航到新的基本路径:", newBasicPath);
          currentPath.value = newBasicPath;
        }

        showMessage("success", t("mount.messages.apiKeyInfoUpdated"));
      }
    } else {
      showMessage("success", t("mount.messages.refreshSuccess"));
    }

    // 加载目录内容
    await loadDirectoryContents();
  } catch (error) {
    console.error("刷新操作失败:", error);
    showMessage("error", t("mount.messages.refreshFailed"));
  }
};

// 加载目录内容
const loadDirectoryContents = async () => {
  if (!hasPermission.value) return;

  try {
    loading.value = true;

    // 根据用户类型选择合适的API函数
    const getDirectoryList = isAdmin.value ? api.fs.getAdminDirectoryList : api.fs.getUserDirectoryList;

    const response = await getDirectoryList(currentPath.value);

    // 检查响应状态
    if (response.success) {
      directoryData.value = response.data;
      console.log("目录内容:", directoryData.value);
    } else {
      showMessage("error", t("mount.messages.getDirectoryContentFailed", { message: response.message }));
    }
  } catch (error) {
    console.error("加载目录内容错误:", error);
    showMessage("error", t("mount.messages.getDirectoryContentFailedUnknown", { message: error.message || t("common.unknown") }));
  } finally {
    loading.value = false;
  }
};

// 从 URL 参数中获取路径
const getPathFromUrl = () => {
  if (props.pathMatch) {
    // 如果有 pathMatch 参数，构建完整路径
    const pathArray = Array.isArray(props.pathMatch) ? props.pathMatch : [props.pathMatch];
    const urlPath = "/" + pathArray.join("/");
    return urlPath.endsWith("/") ? urlPath : urlPath + "/";
  }
  return "/";
};

// 初始化路径 - 优先从 URL 参数读取，然后考虑 API 密钥限制
const initializePath = () => {
  // 首先尝试从 URL 获取路径
  const urlPath = getPathFromUrl();

  if (!isAdmin.value && apiKeyInfo.value) {
    const basicPath = apiKeyInfo.value.basic_path || "/";
    const normalizedBasicPath = basicPath === "/" ? "/" : basicPath.replace(/\/+$/, "");
    const normalizedUrlPath = urlPath.replace(/\/+$/, "") || "/";

    // 检查 URL 路径是否在权限范围内
    if (normalizedBasicPath !== "/" && normalizedUrlPath !== normalizedBasicPath && !normalizedUrlPath.startsWith(normalizedBasicPath + "/")) {
      // URL 路径超出权限范围，使用基本路径
      console.log("URL路径超出权限范围，使用基本路径:", basicPath);
      currentPath.value = basicPath;
    } else {
      // URL 路径在权限范围内，使用 URL 路径
      currentPath.value = urlPath;
    }
  } else {
    // 管理员用户或无 API 密钥限制，直接使用 URL 路径
    currentPath.value = urlPath;
  }

  console.log("初始化路径:", currentPath.value);
};

// 从 URL 初始化预览状态
const initializePreviewFromUrl = async () => {
  if (!props.previewFile || !hasPermission.value) {
    return;
  }

  try {
    // 构建完整的文件路径
    let filePath;
    if (currentPath.value === "/") {
      filePath = "/" + props.previewFile;
    } else {
      const normalizedPath = currentPath.value.replace(/\/+$/, "");
      filePath = normalizedPath + "/" + props.previewFile;
    }

    console.log("从 URL 初始化文件预览:", filePath);

    // 检查权限：对于 API 密钥用户，验证文件路径是否在权限范围内
    if (!isAdmin.value && apiKeyInfo.value) {
      const basicPath = apiKeyInfo.value.basic_path || "/";
      const normalizedBasicPath = basicPath === "/" ? "/" : basicPath.replace(/\/+$/, "");

      // 获取文件所在目录
      const fileDir = filePath.substring(0, filePath.lastIndexOf("/")) || "/";
      const normalizedFileDir = fileDir.replace(/\/+$/, "") || "/";

      if (normalizedBasicPath !== "/" && normalizedFileDir !== normalizedBasicPath && !normalizedFileDir.startsWith(normalizedBasicPath + "/")) {
        console.warn("文件超出权限范围:", filePath);
        updateUrlSilently(currentPath.value);
        return;
      }
    }

    // 获取文件信息
    const getFileInfo = isAdmin.value ? api.fs.getAdminFileInfo : api.fs.getUserFileInfo;
    const response = await getFileInfo(filePath);

    if (response.success) {
      previewFile.value = response.data;
      isPreviewMode.value = true;
      console.log("文件预览初始化成功:", response.data.name);
    } else {
      console.warn("无法加载预览文件:", response.message);
      // 如果文件不存在，清除 URL 中的预览参数
      updateUrlSilently(currentPath.value);
    }
  } catch (error) {
    console.error("初始化文件预览失败:", error);
    // 如果出错，清除 URL 中的预览参数
    updateUrlSilently(currentPath.value);
  }
};

// 导航到指定路径
const navigateTo = (path) => {
  // 如果在预览模式下，退出预览模式
  if (isPreviewMode.value) {
    closePreview();
  }

  // 设置内部导航标志，防止路由监听器重复调用
  isInternalNavigation.value = true;

  currentPath.value = path;

  // 静默更新 URL（清除预览参数），避免触发路由监听器导致重复请求
  updateUrlSilently(path);

  // 加载新路径的内容
  loadDirectoryContents();

  // 重置内部导航标志
  setTimeout(() => {
    isInternalNavigation.value = false;
  }, 100);

  // 平滑滚动到顶部
  window.scrollTo({ top: 0, behavior: "smooth" });
};

// 更新 URL 以反映当前路径和预览状态
const updateUrl = (path, previewFileName = null, silent = false) => {
  const normalizedPath = path.replace(/\/+$/, "") || "/";

  // 构建查询参数
  const query = {};
  if (previewFileName) {
    query.preview = previewFileName;
  }

  // 构建路由对象
  let routeObject;
  if (normalizedPath === "/") {
    // 根路径，导航到基础 mount-explorer 路由
    routeObject = { path: "/mount-explorer", query };
  } else {
    // 子路径，导航到带参数的路由
    const pathSegments = normalizedPath
        .replace(/^\/+/, "")
        .split("/")
        .filter((segment) => segment);
    routeObject = { path: `/mount-explorer/${pathSegments.join("/")}`, query };
  }

  // 根据 silent 参数选择使用 push 还是 replace
  if (silent) {
    router.replace(routeObject);
  } else {
    router.push(routeObject);
  }
};

// 静默更新 URL（使用 replace 而不是 push，避免触发路由监听）
const updateUrlSilently = (path, previewFileName = null) => {
  updateUrl(path, previewFileName, true);
};

// 导航到管理页面
const navigateToAdmin = () => {
  import("../router").then(({ routerUtils }) => {
    routerUtils.navigateTo("admin");
  });
};

// 处理打开上传弹窗
const handleOpenUploadModal = () => {
  showUploadModal.value = true;
};

// 处理关闭上传弹窗
const handleCloseUploadModal = () => {
  showUploadModal.value = false;
};

// 处理上传成功
const handleUploadSuccess = () => {
  // 上传成功后刷新目录内容
  loadDirectoryContents();
  showMessage("success", t("mount.messages.fileUploadSuccess"));
};

// 处理文件上传
const handleUpload = async ({ file, path }) => {
  if (!file || !path) return;

  try {
    // 显示上传中状态
    loading.value = true;
    isUploading.value = true;
    uploadProgress.value = 0;
    cancelUploadFlag.value = false;

    message.value = {
      type: "info",
      content: `正在上传 ${file.name}...`,
    };

    // 定义上传进度回调函数
    const updateProgress = (progress) => {
      uploadProgress.value = progress;
      message.value = {
        type: "info",
        content: `正在上传 ${file.name}... ${progress}%`,
      };
    };

    // 定义取消检查函数
    const checkCancel = () => cancelUploadFlag.value;

    // 根据用户类型选择合适的API函数
    const uploadFile = isAdmin.value ? api.fs.uploadAdminFile : api.fs.uploadUserFile;

    // 判断上传文件大小，5MB以下使用普通上传，否则使用分片上传
    const MULTIPART_THRESHOLD = 5 * 1024 * 1024; // 5MB
    let response;

    if (file.size <= MULTIPART_THRESHOLD) {
      // 小文件：使用普通上传
      response = await uploadFile(path, file);
    } else {
      // 大文件：使用分片上传
      console.log(`文件大小(${file.size}字节)超过阈值(${MULTIPART_THRESHOLD}字节)，使用分片上传`);

      // 首先尝试普通上传，看后端是否需要分片上传
      response = await uploadFile(path, file);

      // 如果后端返回需要使用分片上传的指示
      if (response.success && response.data && response.data.useMultipart) {
        console.log("后端请求使用分片上传", response.data);

        // 执行分片上传
        response = await api.fs.performMultipartUpload(file, path, isAdmin.value, updateProgress, checkCancel);
      }
    }

    // 检查响应状态
    if (response.success) {
      showMessage("success", t("mount.messages.fileUploadSuccess"));
      // 重新加载当前目录内容
      loadDirectoryContents();
    } else {
      showMessage("error", t("mount.messages.fileUploadFailed", { message: response.message }));
    }
  } catch (error) {
    console.error("文件上传错误:", error);
    showMessage("error", t("mount.messages.fileUploadFailedUnknown", { message: error.message || t("common.unknown") }));
  } finally {
    loading.value = false;
    isUploading.value = false;
    uploadProgress.value = 0;
  }
};

// 取消上传
const cancelUpload = () => {
  if (isUploading.value) {
    cancelUploadFlag.value = true;
    showMessage("warning", t("mount.messages.uploadCancelling"));
  }
};

// 处理创建文件夹
const handleCreateFolder = async ({ name, path }) => {
  if (!name || !path) return;

  try {
    loading.value = true;

    // 构建完整路径
    const folderPath = path.endsWith("/") ? `${path}${name}/` : `${path}/${name}/`;

    // 根据用户类型选择合适的API函数
    const createDirectory = isAdmin.value ? api.fs.createAdminDirectory : api.fs.createUserDirectory;

    const response = await createDirectory(folderPath);

    // 检查响应状态
    if (response.success) {
      showMessage("success", t("mount.messages.folderCreateSuccess"));
      // 重新加载当前目录内容
      loadDirectoryContents();
    } else {
      showMessage("error", t("mount.messages.folderCreateFailed", { message: response.message }));
    }
  } catch (error) {
    console.error("创建文件夹错误:", error);
    showMessage("error", t("mount.messages.folderCreateFailedUnknown", { message: error.message || t("common.unknown") }));
  } finally {
    loading.value = false;
  }
};

// 处理重命名
const handleRename = async ({ item, newName }) => {
  if (!item || !newName) return;

  try {
    loading.value = true;

    // 构建新路径
    const parentPath = item.path.substring(0, item.path.lastIndexOf("/") + 1);
    const isDirectory = item.isDirectory;
    const oldPath = item.path;
    let newPath = parentPath + newName;

    // 如果是目录，确保新路径末尾有斜杠
    if (isDirectory && !newPath.endsWith("/")) {
      newPath += "/";
    }

    // 根据用户类型选择合适的API函数
    const renameItem = isAdmin.value ? api.fs.renameAdminItem : api.fs.renameUserItem;

    const response = await renameItem(oldPath, newPath);

    // 检查响应状态
    if (response.success) {
      showMessage("success", t("mount.messages.renameSuccess", { type: isDirectory ? t("mount.fileTypes.folder") : t("mount.fileTypes.file") }));
      // 重新加载当前目录内容
      loadDirectoryContents();
    } else {
      showMessage("error", t("mount.messages.renameFailed", { message: response.message }));
    }
  } catch (error) {
    console.error("重命名错误:", error);
    showMessage("error", t("mount.messages.renameFailedUnknown", { message: error.message || t("common.unknown") }));
  } finally {
    loading.value = false;
  }
};

// 处理删除
const handleDelete = async (item) => {
  if (!item) return;

  try {
    loading.value = true;

    // 调用删除函数
    await deleteFileOrFolder(item.path);

    // 检查响应状态
    showMessage("success", t("mount.messages.deleteSuccess", { type: item.isDirectory ? t("mount.fileTypes.folder") : t("mount.fileTypes.file") }));
    // 重新加载当前目录内容
    loadDirectoryContents();
  } catch (error) {
    console.error("删除错误:", error);
    showMessage("error", t("mount.messages.deleteFailedUnknown", { message: error.message || t("common.unknown") }));
  } finally {
    loading.value = false;
  }
};

/**
 * 删除文件或文件夹
 * @param {string} path 路径
 * @returns {Promise<Object>} 删除结果
 */
const deleteFileOrFolder = async (path) => {
  // 根据用户类型选择合适的API函数
  const deleteItem = isAdmin.value ? api.fs.deleteAdminItem : api.fs.deleteUserItem;

  // 执行删除
  const response = await deleteItem(path);

  // 检查响应状态
  if (!response.success) {
    throw new Error(response.message || "删除失败");
  }

  return response;
};

// 处理下载
const handleDownload = async (item) => {
  if (!item || item.isDirectory) return;

  try {
    showMessage("success", t("mount.messages.downloadPreparing"));

    // 根据用户类型获取下载URL
    const downloadUrl = isAdmin.value ? api.fs.getAdminFileDownloadUrl(item.path) : api.fs.getUserFileDownloadUrl(item.path);

    // 获取文件名
    const fileName = item.name || item.path.split("/").pop() || "下载文件";

    // 使用新的认证下载方法
    await downloadFileWithAuth(downloadUrl, fileName);

    showMessage("success", t("mount.messages.downloadSuccess"));
  } catch (error) {
    console.error("下载文件错误:", error);
    showMessage("error", t("mount.messages.downloadFailedUnknown", { message: error.message || t("common.unknown") }));
  }
};

// 处理文件预览
const handlePreview = async (item) => {
  if (!item || item.isDirectory) return;

  try {
    isPreviewLoading.value = true; // 开始加载预览内容

    // 获取详细的文件信息
    const getFileInfo = isAdmin.value ? api.fs.getAdminFileInfo : api.fs.getUserFileInfo;
    const response = await getFileInfo(item.path);

    if (!response.success) {
      throw new Error(response.message || "获取文件信息失败");
    }

    // 使用获取到的详细文件信息
    const fileInfo = response.data;
    previewFile.value = fileInfo;
    isPreviewMode.value = true; // 切换到预览模式

    // 更新 URL 以包含预览文件信息
    updateUrl(currentPath.value, fileInfo.name);

    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    console.error("预览文件错误:", error);
    showMessage("error", t("mount.messages.previewLoadFailedUnknown", { message: error.message || t("common.unknown") }));
    isPreviewMode.value = false; // 出错时不进入预览模式
    previewFile.value = null;
  } finally {
    isPreviewLoading.value = false; // 预览内容加载完成
  }
};

// 关闭预览
const closePreview = () => {
  isPreviewMode.value = false; // 退出预览模式
  previewFile.value = null;
};

// 关闭预览并更新 URL
const closePreviewWithUrl = () => {
  closePreview();
  // 静默更新 URL，移除预览参数，避免触发路由监听器
  updateUrlSilently(currentPath.value);
};

// 显示消息
const showMessage = (type, content) => {
  message.value = { type, content };

  // 设置消息自动清除时间
  let timeout = 4000; // 默认4秒

  // 根据消息类型设置不同的显示时间
  if (type === "success" || type === "warning") {
    timeout = 4000; // 成功和警告消息显示4秒
  } else if (type === "error") {
    timeout = 5000; // 错误消息显示5秒
  }

  // 自动清除消息
  setTimeout(() => {
    message.value = null;
  }, timeout);
};

// 处理视图模式切换
const handleViewModeChange = (mode) => {
  viewMode.value = mode;
  // 可以考虑将用户视图首选项保存到localStorage
  localStorage.setItem("file_explorer_view_mode", mode);
};

// 监听权限状态变化
watch([isAdmin, hasApiKey, hasMountPermission], () => {
  hasPermission.value = isAdmin.value || (hasApiKey.value && hasMountPermission.value);
});

// 监听路由参数变化
watch(
    () => [props.pathMatch, props.previewFile],
    ([newPathMatch, newPreviewFile], [oldPathMatch, oldPreviewFile]) => {
      if (hasPermission.value) {
        console.log("路由参数变化:", { pathMatch: newPathMatch, previewFile: newPreviewFile, isInternalNavigation: isInternalNavigation.value });

        // 如果路径发生变化
        if (newPathMatch !== oldPathMatch) {
          // 如果是内部导航触发的路由变化，跳过重复加载
          if (isInternalNavigation.value) {
            console.log("跳过内部导航触发的重复加载");
            return;
          }

          initializePath();
          loadDirectoryContents().then(() => {
            // 路径变化后，检查是否需要初始化预览
            if (newPreviewFile) {
              initializePreviewFromUrl();
            }
          });
        }
        // 如果只是预览文件发生变化
        else if (newPreviewFile !== oldPreviewFile) {
          if (newPreviewFile) {
            initializePreviewFromUrl();
          } else {
            // 清除预览状态
            closePreview();
          }
        }
      }
    },
    { immediate: false }
);

// 添加全局事件监听
const setupEventListeners = () => {
  // 监听管理员令牌过期
  window.addEventListener("admin-token-expired", () => {
    checkPermissions();
  });

  // 导航事件现在由 Vue Router 处理，移除手动事件监听
};

// 提供 isAdmin 值给子组件
provide("isAdmin", isAdmin);

// 组件挂载时执行
onMounted(() => {
  // 检查权限
  checkPermissions();

  // 设置事件监听
  setupEventListeners();

  // 恢复用户视图首选项
  const savedViewMode = localStorage.getItem("file_explorer_view_mode");
  if (savedViewMode) {
    viewMode.value = savedViewMode;
  }

  // 如果有权限，初始化路径并加载目录内容
  if (hasPermission.value) {
    // 对于API密钥用户，如果有基本路径限制，则导航到基本路径
    initializePath();
    // 加载目录内容，然后初始化文件预览
    loadDirectoryContents().then(() => {
      // 初始化文件预览（如果 URL 中有预览参数）
      initializePreviewFromUrl();
    });
  }
});

// 处理预览内容加载完成
const handlePreviewLoaded = () => {
  isPreviewLoading.value = false;
};

// 处理预览内容加载错误
const handlePreviewError = () => {
  isPreviewLoading.value = false;
  showMessage("error", t("mount.messages.previewError"));
};

// 处理上传错误
const handleUploadError = (error) => {
  showMessage("error", t("mount.messages.uploadErrorUnknown", { message: error.message || t("common.unknown") }));
};

// 切换勾选框模式
const toggleCheckboxMode = () => {
  isCheckboxMode.value = !isCheckboxMode.value;
  if (!isCheckboxMode.value) {
    // 关闭勾选模式时清空已选中项
    selectedItems.value = [];
  }
};

// 处理文件/文件夹选中状态
const handleItemSelect = (item, selected) => {
  if (selected) {
    selectedItems.value.push(item);
  } else {
    selectedItems.value = selectedItems.value.filter((i) => i.path !== item.path);
  }
};

// 批量删除选中项
const batchDelete = () => {
  if (selectedItems.value.length === 0) return;

  // 设置确认对话框信息
  itemsToDelete.value = [...selectedItems.value];
  showBatchDeleteDialog.value = true;
};

// 确认批量删除
const confirmBatchDelete = async () => {
  if (itemsToDelete.value.length === 0) return;

  try {
    showMessage("info", t("mount.messages.batchDeleteInProgress"));

    // 获取要删除的路径数组
    const paths = itemsToDelete.value.map((item) => item.path);

    // 使用批量删除API (如果可用)
    const batchDeleteFn = isAdmin.value ? api.fs.batchDeleteAdminItems : api.fs.batchDeleteUserItems;
    const response = await batchDeleteFn(paths);

    // 检查响应
    if (!response.success) {
      throw new Error(response.message || "批量删除失败");
    }

    // 刷新目录内容
    await loadDirectoryContents();

    // Fallback: 如果批量删除API报告错误
    if (response.data && response.data.failed && response.data.failed.length > 0) {
      console.warn("部分项目删除失败:", response.data.failed);
      showMessage("warning", t("mount.messages.batchDeletePartialSuccess", { success: response.data.success, failed: response.data.failed.length }));
    } else {
      // 设置成功消息
      showMessage("success", t("mount.messages.batchDeleteSuccess", { count: itemsToDelete.value.length }));
    }

    // 清空选中项
    selectedItems.value = [];
  } catch (error) {
    console.error("批量删除错误:", error);
    showMessage("error", t("mount.messages.batchDeleteFailedUnknown", { message: error.message || t("common.unknown") }));
  } finally {
    // 关闭对话框
    showBatchDeleteDialog.value = false;
    itemsToDelete.value = [];
  }
};

// 取消批量删除
const cancelBatchDelete = () => {
  showBatchDeleteDialog.value = false;
  itemsToDelete.value = [];
};

// 全选/取消全选
const toggleSelectAll = (select) => {
  if (select) {
    // 全选（不重复添加）
    const currentPaths = selectedItems.value.map((item) => item.path);
    directoryData.value.items.forEach((item) => {
      if (!currentPaths.includes(item.path)) {
        selectedItems.value.push(item);
      }
    });
  } else {
    // 取消全选
    selectedItems.value = [];
  }
};

// 处理批量复制
const handleBatchCopy = () => {
  if (selectedItems.value.length === 0) return;

  // 打开复制模态窗口
  showCopyModal.value = true;
};

// 处理复制完成
const handleCopyComplete = (result) => {
  // 关闭复制模态窗口
  showCopyModal.value = false;

  if (result.success) {
    // 显示成功消息
    showMessage("success", t("mount.messages.copySuccess", { message: result.message }));

    // 如果复制到当前目录，刷新目录列表
    if (result.targetPath === currentPath.value) {
      loadDirectoryContents();
    }
  } else {
    // 显示错误消息
    showMessage("error", t("mount.messages.copyFailed", { message: result.message }));
  }
};

// 处理关闭复制模态窗口
const handleCloseCopyModal = () => {
  showCopyModal.value = false;
};

// 处理打开任务管理弹窗
const handleOpenTasksModal = () => {
  showTasksModal.value = true;
};

// 处理关闭任务管理弹窗
const handleCloseTasksModal = () => {
  showTasksModal.value = false;
};
</script>
