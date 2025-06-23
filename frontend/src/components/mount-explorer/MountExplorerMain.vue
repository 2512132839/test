<template>
  <div class="mount-explorer-main">
    <!-- 操作按钮 -->
    <div class="card mb-4" :class="darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'">
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
              <span>{{ t("mount.backToFileList") }}</span>
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
</template>

<script setup>
import { ref, computed, inject, watch, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

// 从父组件注入的数据
const darkMode = inject("darkMode");

// 使用认证Store替代注入的认证数据
import { useAuthStore } from "../../stores/authStore.js";
const authStore = useAuthStore();

// 从Store获取认证信息的计算属性
const isAdmin = computed(() => authStore.isAdmin);
const apiKeyInfo = computed(() => authStore.apiKeyInfo);
const hasPermissionForCurrentPath = computed(() => {
  if (authStore.isAdmin) return true;
  if (!authStore.isAuthenticated || authStore.authType !== "apikey") return false;

  const basicPath = authStore.userInfo.basicPath || "/";
  const normalizedBasicPath = basicPath === "/" ? "/" : basicPath.replace(/\/+$/, "");
  const normalizedCurrentPath = currentPath.value.replace(/\/+$/, "") || "/";

  // 如果基本路径是根路径，允许访问所有路径
  if (normalizedBasicPath === "/") return true;

  // 检查当前路径是否在基本路径范围内
  return normalizedCurrentPath === normalizedBasicPath || normalizedCurrentPath.startsWith(normalizedBasicPath + "/");
});

// 导入子组件
import BreadcrumbNav from "./BreadcrumbNav.vue";
import DirectoryList from "./DirectoryList.vue";
import FileOperations from "./FileOperations.vue";
import FilePreview from "./FilePreview.vue";
import UploadModal from "./UploadModal.vue";
import CopyModal from "./CopyModal.vue";
import TasksModal from "./TasksModal.vue";

// 导入工具函数
import { api } from "../../api";
import { downloadFileWithAuth } from "../../utils/fileUtils";

// 数据状态
const currentPath = ref("/");
const directoryData = ref(null);
const loading = ref(false);
const message = ref(null);
const viewMode = ref("list");

// 请求去重状态
const currentLoadingPath = ref(null);
const isInitialized = ref(false);

// 文件预览状态
const previewFile = ref(null);
const isPreviewMode = ref(false);
const isPreviewLoading = ref(false);

// 初始化状态控制
const initializationState = ref({
  isInitializing: false,
  lastProcessedRoute: null,
});

// 弹窗状态
const showUploadModal = ref(false);
const showCopyModal = ref(false);
const showTasksModal = ref(false);

// 选择状态
const isCheckboxMode = ref(false);
const selectedItems = ref([]);

// 计算属性
const selectedCount = computed(() => selectedItems.value.length);

// 统一的加载状态计算属性 - 决定何时需要加载目录内容
const shouldLoadDirectory = computed(() => {
  // 必须满足以下条件才能加载：
  // 1. 权限信息已经加载完成
  // 2. 当前路径已设置
  // 3. 没有正在进行的加载请求
  const hasPermissionInfo = typeof isAdmin.value === "boolean";
  const hasPath = currentPath.value !== null;
  const notLoading = currentLoadingPath.value === null;

  return hasPermissionInfo && hasPath && notLoading;
});

// 从路由参数获取路径
const getPathFromRoute = () => {
  if (route.params.pathMatch) {
    const pathArray = Array.isArray(route.params.pathMatch) ? route.params.pathMatch : [route.params.pathMatch];
    const urlPath = "/" + pathArray.join("/");
    return urlPath.endsWith("/") ? urlPath : urlPath + "/";
  }
  return "/";
};

// 初始化路径
const initializePath = () => {
  const urlPath = getPathFromRoute();

  if (!isAdmin.value && apiKeyInfo.value) {
    const basicPath = apiKeyInfo.value.basic_path || "/";
    const normalizedBasicPath = basicPath === "/" ? "/" : basicPath.replace(/\/+$/, "");
    const normalizedUrlPath = urlPath.replace(/\/+$/, "") || "/";

    if (normalizedBasicPath !== "/" && normalizedUrlPath !== normalizedBasicPath && !normalizedUrlPath.startsWith(normalizedBasicPath + "/")) {
      console.log("URL路径超出权限范围，重定向到基本路径:", basicPath);
      // 先设置正确的路径，再进行重定向
      currentPath.value = basicPath;
      navigateTo(basicPath);
      return false; // 返回false表示需要重定向，不应继续执行后续逻辑
    }
  }

  currentPath.value = urlPath;
  return true; // 返回true表示路径正常，可以继续执行
};

// 加载目录内容 - 带去重机制
const loadDirectoryContents = async (forcePath = null) => {
  const targetPath = forcePath || currentPath.value;

  // 请求去重：如果正在加载相同路径，则跳过
  if (currentLoadingPath.value === targetPath) {
    console.log("跳过重复请求:", targetPath);
    return;
  }

  try {
    loading.value = true;
    currentLoadingPath.value = targetPath;

    const getDirectoryList = isAdmin.value ? api.fs.getAdminDirectoryList : api.fs.getUserDirectoryList;
    const response = await getDirectoryList(targetPath);

    if (response.success) {
      directoryData.value = response.data;
    } else {
      showMessage("error", t("mount.messages.getDirectoryContentFailed", { message: response.message }));
    }
  } catch (error) {
    console.error("加载目录内容错误:", error);
    showMessage("error", t("mount.messages.getDirectoryContentFailedUnknown", { message: error.message || t("common.unknown") }));
  } finally {
    loading.value = false;
    currentLoadingPath.value = null;
  }
};

// 导航到指定路径
const navigateTo = (path) => {
  if (isPreviewMode.value) {
    closePreview();
  }

  // 只更新URL，让路由监听器处理实际的目录加载
  updateUrl(path);
  window.scrollTo({ top: 0, behavior: "smooth" });
};

// 更新URL
const updateUrl = (path, previewFileName = null) => {
  const normalizedPath = path.replace(/\/+$/, "") || "/";
  const query = {};

  if (previewFileName) {
    query.preview = previewFileName;
  }

  let routeObject;
  if (normalizedPath === "/") {
    routeObject = { path: "/mount-explorer", query };
  } else {
    const pathSegments = normalizedPath
      .replace(/^\/+/, "")
      .split("/")
      .filter((segment) => segment);
    routeObject = { path: `/mount-explorer/${pathSegments.join("/")}`, query };
  }

  router.replace(routeObject);
};

// 显示消息
const showMessage = (type, content) => {
  message.value = { type, content };
  setTimeout(() => {
    message.value = null;
  }, 4000);
};

// 处理视图模式切换
const handleViewModeChange = (mode) => {
  viewMode.value = mode;
  localStorage.setItem("file_explorer_view_mode", mode);
};

// 文件预览相关方法
const handlePreview = async (item) => {
  if (!item || item.isDirectory) return;

  // 只更新URL，让路由监听器处理实际的文件加载
  updateUrl(currentPath.value, item.name);

  // 滚动到顶部
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const closePreview = () => {
  previewFile.value = null;
  isPreviewMode.value = false;
};

const closePreviewWithUrl = () => {
  closePreview();
  updateUrl(currentPath.value);
};

// 文件上传处理
const handleUpload = async ({ file, path }) => {
  if (!file || !path) return;

  try {
    // 显示上传中状态
    loading.value = true;
    showMessage("info", `正在上传 ${file.name}...`);

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
      response = await api.fs.performMultipartUpload(file, path, isAdmin.value);
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
  }
};

// 创建文件夹处理
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

// 刷新目录
const handleRefresh = async () => {
  // 对于API密钥用户，先重新验证认证状态
  if (!isAdmin.value && authStore.authType === "apikey") {
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
        navigateTo(newBasicPath);
        return;
      }
      showMessage("success", t("mount.messages.apiKeyInfoUpdated"));
    } catch (error) {
      console.error("刷新认证状态失败:", error);
    }
  } else {
    showMessage("success", t("mount.messages.refreshSuccess"));
  }

  loadDirectoryContents();
};

// 弹窗处理
const handleOpenUploadModal = () => {
  showUploadModal.value = true;
};
const handleCloseUploadModal = () => {
  showUploadModal.value = false;
};
const handleUploadSuccess = () => {
  showMessage("success", t("mount.messages.uploadSuccess"));
  loadDirectoryContents();
};
const handleUploadError = (error) => {
  showMessage("error", t("mount.messages.uploadFailed", { message: error.message || t("common.unknown") }));
};

const handleBatchCopy = () => {
  if (selectedItems.value.length === 0) {
    showMessage("warning", t("mount.messages.noItemsSelected"));
    return;
  }
  showCopyModal.value = true;
};
const handleCloseCopyModal = () => {
  showCopyModal.value = false;
};
const handleCopyComplete = () => {
  showMessage("success", t("mount.messages.copySuccess"));
  selectedItems.value = [];
  isCheckboxMode.value = false;
  loadDirectoryContents();
};

const handleOpenTasksModal = () => {
  showTasksModal.value = true;
};
const handleCloseTasksModal = () => {
  showTasksModal.value = false;
};

// 文件操作处理
const handleDownload = async (item) => {
  try {
    await downloadFileWithAuth(item.path, item.name);
    showMessage("success", t("mount.messages.downloadStarted", { name: item.name }));
  } catch (error) {
    console.error("下载文件错误:", error);
    showMessage("error", t("mount.messages.downloadFailed", { message: error.message }));
  }
};

const handleRename = async ({ item, newName }) => {
  try {
    const renameItem = isAdmin.value ? api.fs.renameAdminItem : api.fs.renameUserItem;

    // 构建新路径
    const parentPath = item.path.substring(0, item.path.lastIndexOf("/") + 1);
    const isDirectory = item.isDirectory;
    const oldPath = item.path;
    let newPath = parentPath + newName;

    // 如果是目录，确保新路径末尾有斜杠
    if (isDirectory && !newPath.endsWith("/")) {
      newPath += "/";
    }

    const response = await renameItem(oldPath, newPath);

    if (response.success) {
      showMessage("success", t("mount.messages.renameSuccess", { oldName: item.name, newName }));
      loadDirectoryContents();
    } else {
      showMessage("error", t("mount.messages.renameFailed", { message: response.message }));
    }
  } catch (error) {
    console.error("重命名错误:", error);
    showMessage("error", t("mount.messages.renameFailedUnknown", { message: error.message }));
  }
};

const handleDelete = async (item) => {
  // DirectoryList组件已经处理了确认对话框，这里直接执行删除
  try {
    const deleteItem = isAdmin.value ? api.fs.deleteAdminItem : api.fs.deleteUserItem;
    const response = await deleteItem(item.path);

    if (response.success) {
      showMessage("success", t("mount.messages.deleteSuccess", { name: item.name }));
      loadDirectoryContents();
    } else {
      showMessage("error", t("mount.messages.deleteFailed", { message: response.message }));
    }
  } catch (error) {
    console.error("删除错误:", error);
    showMessage("error", t("mount.messages.deleteFailedUnknown", { message: error.message }));
  }
};

// 选择处理
const handleItemSelect = (item, selected) => {
  if (selected) {
    if (!selectedItems.value.find((i) => i.path === item.path)) {
      selectedItems.value.push(item);
    }
  } else {
    selectedItems.value = selectedItems.value.filter((i) => i.path !== item.path);
  }
};

const toggleSelectAll = (selectAll) => {
  if (selectAll) {
    selectedItems.value = [...(directoryData.value?.items || [])];
  } else {
    selectedItems.value = [];
  }
};

const toggleCheckboxMode = () => {
  isCheckboxMode.value = !isCheckboxMode.value;
  if (!isCheckboxMode.value) {
    selectedItems.value = [];
  }
};

const batchDelete = async () => {
  if (selectedItems.value.length === 0) {
    showMessage("warning", t("mount.messages.noItemsSelected"));
    return;
  }

  if (!confirm(t("mount.messages.confirmBatchDelete", { count: selectedItems.value.length }))) {
    return;
  }

  try {
    const deleteItem = isAdmin.value ? api.fs.deleteAdminItem : api.fs.deleteUserItem;
    const promises = selectedItems.value.map((item) => deleteItem(item.path));
    await Promise.all(promises);

    showMessage("success", t("mount.messages.batchDeleteSuccess", { count: selectedItems.value.length }));
    selectedItems.value = [];
    isCheckboxMode.value = false;
    loadDirectoryContents();
  } catch (error) {
    console.error("批量删除错误:", error);
    showMessage("error", t("mount.messages.batchDeleteFailed", { message: error.message }));
  }
};

const handlePreviewLoaded = () => {
  isPreviewLoading.value = false;
};

// 处理预览内容加载错误
const handlePreviewError = () => {
  isPreviewLoading.value = false;
  showMessage("error", t("mount.messages.previewError"));
};

// 统一的路由状态初始化逻辑
const initializeFromRoute = async () => {
  // 防止重复初始化
  const currentRouteKey = `${route.path}?${new URLSearchParams(route.query).toString()}`;
  if (initializationState.value.isInitializing || initializationState.value.lastProcessedRoute === currentRouteKey) {
    return;
  }

  initializationState.value.isInitializing = true;
  initializationState.value.lastProcessedRoute = currentRouteKey;

  try {
    // 1. 首先初始化路径
    const shouldContinue = initializePath();

    // 如果路径初始化返回false（表示需要重定向），则不继续执行后续逻辑
    if (!shouldContinue) {
      return;
    }

    // 2. 判断是否为文件预览模式
    if (route.query.preview) {
      // 文件预览模式：直接加载文件信息，不需要加载目录
      await initializeFilePreview();
    } else {
      // 目录浏览模式：加载目录内容
      await loadDirectoryContents();
    }
  } catch (error) {
    console.error("路由初始化失败:", error);
    showMessage("error", t("mount.messages.initializationFailed", { message: error.message || t("common.unknown") }));
  } finally {
    initializationState.value.isInitializing = false;
  }
};

// 初始化文件预览
const initializeFilePreview = async () => {
  if (!route.query.preview) {
    return;
  }

  try {
    // 开始加载预览内容
    isPreviewLoading.value = true;

    // 构建完整的文件路径
    let filePath;
    if (currentPath.value === "/") {
      filePath = "/" + route.query.preview;
    } else {
      const normalizedPath = currentPath.value.replace(/\/+$/, "");
      filePath = normalizedPath + "/" + route.query.preview;
    }

    // 检查权限：对于 API 密钥用户，验证文件路径是否在权限范围内
    if (!isAdmin.value && apiKeyInfo.value) {
      const basicPath = apiKeyInfo.value.basic_path || "/";
      const normalizedBasicPath = basicPath === "/" ? "/" : basicPath.replace(/\/+$/, "");

      // 获取文件所在目录
      const fileDir = filePath.substring(0, filePath.lastIndexOf("/")) || "/";
      const normalizedFileDir = fileDir.replace(/\/+$/, "") || "/";

      if (normalizedBasicPath !== "/" && normalizedFileDir !== normalizedBasicPath && !normalizedFileDir.startsWith(normalizedBasicPath + "/")) {
        console.warn("文件超出权限范围:", filePath);
        navigateTo(basicPath);
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
      // 文件信息加载完成，但具体内容由 FilePreview 组件异步加载
      isPreviewLoading.value = false;
    } else {
      console.warn("无法加载预览文件:", response.message);
      // 如果文件不存在，重定向到目录
      navigateTo(currentPath.value);
    }
  } catch (error) {
    console.error("初始化文件预览失败:", error);
    // 如果出错，重定向到目录
    navigateTo(currentPath.value);
    isPreviewLoading.value = false;
  }
};

// 统一的初始化和更新逻辑
const performInitialization = async () => {
  if (!shouldLoadDirectory.value) {
    return;
  }

  // 使用新的统一初始化逻辑
  await initializeFromRoute();
  isInitialized.value = true;
};

// 监听权限状态变化
watch(
  [isAdmin, apiKeyInfo],
  ([newIsAdmin, newApiKeyInfo], [oldIsAdmin, oldApiKeyInfo]) => {
    // 第一次调用或权限信息真正变化时才初始化
    const isFirstCall = oldIsAdmin === undefined && oldApiKeyInfo === undefined;
    const hasChanged = newIsAdmin !== oldIsAdmin || JSON.stringify(newApiKeyInfo) !== JSON.stringify(oldApiKeyInfo);

    if (isFirstCall || hasChanged) {
      isInitialized.value = false;
      performInitialization();
    }
  },
  { immediate: true }
);

// 监听路由变化 - 统一处理路径和预览参数变化
watch(
  () => [route.params.pathMatch, route.query.preview],
  ([newPathMatch, newPreviewFile], oldValues) => {
    // 处理第一次调用时oldValues为undefined的情况
    const [oldPathMatch, oldPreviewFile] = oldValues || [undefined, undefined];

    // 确保权限信息已经加载且组件已初始化
    if (!shouldLoadDirectory.value || !isInitialized.value) {
      return;
    }

    // 检查是否有实际变化
    const pathChanged = newPathMatch !== oldPathMatch;
    const previewChanged = newPreviewFile !== oldPreviewFile;

    if (pathChanged || previewChanged) {
      // 使用统一的初始化逻辑处理所有变化
      initializeFromRoute();
    }
  },
  { immediate: false }
);

// 组件挂载时恢复视图首选项
onMounted(() => {
  const savedViewMode = localStorage.getItem("file_explorer_view_mode");
  if (savedViewMode) {
    viewMode.value = savedViewMode;
  }
});
</script>

<style scoped>
.card {
  border-radius: 0.5rem;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  border-width: 1px;
  border-style: solid;
}

.file-preview-container {
  padding: 1rem;
}
</style>
