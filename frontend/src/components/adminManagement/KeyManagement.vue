<script setup>
import { ref, onMounted, computed, onBeforeUnmount, reactive } from "vue";
import { getAllApiKeys, createApiKey, deleteApiKey, updateApiKey } from "../../api/adminService";
import CommonPagination from "../common/CommonPagination.vue";
import { useI18n } from "vue-i18n";

// 使用i18n
const { t } = useI18n();

// Props定义
const props = defineProps({
  darkMode: {
    type: Boolean,
    required: true,
  },
});

// 状态管理
const apiKeys = ref([]);
const isLoading = ref(false);
const showCreateModal = ref(false);
const showEditModal = ref(false);
const newKeyName = ref("");
const newKeyCustomKey = ref(""); // 自定义密钥
const useCustomKey = ref(false); // 是否使用自定义密钥
const newKeyExpiration = ref("1d"); // 默认1天
const newKeyCustomExpiration = ref("");
const newKeyTextPermission = ref(false); // 文本权限
const newKeyFilePermission = ref(false); // 文件权限
const newKeyMountPermission = ref(false); // 挂载点权限
const error = ref(null);
const successMessage = ref(null);
const newlyCreatedKey = ref(null);
const isMobile = ref(false); // 是否为移动设备
const lastRefreshTime = ref(""); // 添加最后刷新时间
const selectedKeys = ref([]); // 添加选中的密钥列表

// 编辑模态框状态
const editingKey = ref(null); // 当前正在编辑的密钥
const editKeyName = ref("");
const editKeyTextPermission = ref(false);
const editKeyFilePermission = ref(false);
const editKeyMountPermission = ref(false);
const editKeyExpiration = ref("custom");
const editKeyCustomExpiration = ref("");

// 自定义过期时间选项
const expirationOptions = computed(() => [
  { value: "1d", label: t("admin.keyManagement.createModal.expiration1d", "1天") },
  { value: "7d", label: t("admin.keyManagement.createModal.expiration7d", "7天") },
  { value: "30d", label: t("admin.keyManagement.createModal.expiration30d", "30天") },
  { value: "never", label: t("admin.keyManagement.createModal.expirationNever", "永不过期") },
  { value: "custom", label: t("admin.keyManagement.createModal.expirationCustom", "自定义") },
]);

// 计算属性：是否为自定义过期时间
const isCustomExpiration = computed(() => {
  return newKeyExpiration.value === "custom";
});

// 计算属性：是否为自定义过期时间（编辑模式）
const isEditCustomExpiration = computed(() => {
  return editKeyExpiration.value === "custom";
});

// 检查是否为移动设备
const checkMobile = () => {
  isMobile.value = window.innerWidth < 768; // md断点
};

// 分页相关数据
const pagination = reactive({
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
});

// 计算属性：当前页的密钥列表
const currentPageKeys = computed(() => {
  const start = (pagination.page - 1) * pagination.limit;
  const end = start + pagination.limit;
  return apiKeys.value.slice(start, end);
});

// 处理页码变化
const handlePageChange = (page) => {
  pagination.page = page;
  loadApiKeys();
};

// 格式化当前时间为本地时间字符串
const formatCurrentTime = () => {
  const now = new Date();
  return now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

// 更新最后刷新时间
const updateLastRefreshTime = () => {
  lastRefreshTime.value = formatCurrentTime();
};

// 切换选中状态
const toggleSelectKey = (keyId) => {
  const index = selectedKeys.value.indexOf(keyId);
  if (index === -1) {
    selectedKeys.value.push(keyId);
  } else {
    selectedKeys.value.splice(index, 1);
  }
};

// 批量删除选中的密钥
const deleteSelectedKeys = async () => {
  if (selectedKeys.value.length === 0) {
    alert(t("admin.keyManagement.selectKeysFirst"));
    return;
  }

  const selectedCount = selectedKeys.value.length;

  if (!confirm(t("admin.keyManagement.bulkDeleteConfirm", { count: selectedCount }))) {
    return;
  }

  isLoading.value = true;
  error.value = null;

  try {
    // 逐个删除选中的密钥
    const promises = selectedKeys.value.map((id) => deleteApiKey(id));
    await Promise.all(promises);

    // 清空选中列表
    selectedKeys.value = [];
    // 重新加载数据
    await loadApiKeys();

    // 显示成功消息
    successMessage.value = t("admin.keyManagement.success.bulkDeleted", { count: selectedCount });
    setTimeout(() => {
      successMessage.value = null;
    }, 3000);
  } catch (e) {
    console.error("批量删除密钥失败:", e);
    error.value = t("admin.keyManagement.error.bulkDeleteFailed");
  } finally {
    isLoading.value = false;
  }
};

// 加载所有API密钥
const loadApiKeys = async () => {
  isLoading.value = true;
  error.value = null;

  try {
    const result = await getAllApiKeys({
      page: pagination.page,
      limit: pagination.limit,
    });

    if (result.success && result.data) {
      apiKeys.value = result.data;
      // 更新分页信息
      pagination.total = result.total || result.data.length;
      pagination.totalPages = Math.ceil(pagination.total / pagination.limit);
      // 更新最后刷新时间
      updateLastRefreshTime();
    } else {
      error.value = result.message || t("admin.keyManagement.error.cannotLoadList");
    }
  } catch (e) {
    console.error("加载API密钥失败:", e);
    error.value = t("admin.keyManagement.error.loadFailed");
  } finally {
    isLoading.value = false;
  }
};

// 验证自定义密钥格式
const validateCustomKey = (key) => {
  if (!key) return false;
  const keyFormatRegex = /^[a-zA-Z0-9_-]+$/;
  return keyFormatRegex.test(key);
};

// 创建新密钥
const handleCreateKey = async () => {
  if (!newKeyName.value.trim()) {
    error.value = t("admin.keyManagement.createModal.errors.nameRequired");
    return;
  }

  // 验证自定义密钥（如果启用）
  if (useCustomKey.value) {
    if (!newKeyCustomKey.value.trim()) {
      error.value = t("admin.keyManagement.createModal.errors.customKeyRequired");
      return;
    }

    if (!validateCustomKey(newKeyCustomKey.value)) {
      error.value = t("admin.keyManagement.createModal.errors.customKeyFormat");
      return;
    }
  }

  let expiresAt = null;

  // 处理过期时间
  if (newKeyExpiration.value !== "never") {
    if (newKeyExpiration.value === "custom") {
      if (!newKeyCustomExpiration.value) {
        error.value = t("admin.keyManagement.createModal.errors.expirationRequired");
        return;
      }
      expiresAt = new Date(newKeyCustomExpiration.value).toISOString();
    } else {
      // 处理1d, 7d, 30d,
      const days = parseInt(newKeyExpiration.value);
      const date = new Date();
      date.setDate(date.getDate() + days);
      expiresAt = date.toISOString();
    }
  }

  isLoading.value = true;
  error.value = null;

  try {
    // 根据用户选择决定是否使用自定义密钥
    const customKey = useCustomKey.value ? newKeyCustomKey.value : null;

    const result = await createApiKey(newKeyName.value, expiresAt, newKeyTextPermission.value, newKeyFilePermission.value, newKeyMountPermission.value, customKey);

    if (result.success && result.data) {
      // 保存新创建的密钥（仅显示一次）
      newlyCreatedKey.value = result.data.key;

      // 添加到列表，但只显示前6位
      const displayKey = result.data.key.substring(0, 6) + "...";
      apiKeys.value.unshift({
        id: result.data.id,
        name: result.data.name,
        key: result.data.key, // 存储完整密钥，用于复制
        key_masked: displayKey, // 只显示前6位
        text_permission: result.data.text_permission,
        file_permission: result.data.file_permission,
        mount_permission: result.data.mount_permission,
        created_at: result.data.created_at,
        expires_at: result.data.expires_at,
        last_used: null,
      });

      // 重置表单
      newKeyName.value = "";
      newKeyCustomKey.value = "";
      useCustomKey.value = false;
      newKeyExpiration.value = "1d";
      newKeyCustomExpiration.value = "";
      newKeyTextPermission.value = false;
      newKeyFilePermission.value = false;
      newKeyMountPermission.value = false;

      // 关闭模态框
      showCreateModal.value = false;

      // 显示成功消息
      successMessage.value = t("admin.keyManagement.success.created");

      // 5秒后清除成功消息
      setTimeout(() => {
        successMessage.value = null;
      }, 5000);
    } else {
      error.value = result.message || t("admin.keyManagement.createModal.errors.createFailed");
    }
  } catch (e) {
    console.error("创建API密钥失败:", e);
    error.value = t("admin.keyManagement.createModal.errors.createFailed");
  } finally {
    isLoading.value = false;
  }
};

// 删除密钥
const handleDeleteKey = async (keyId) => {
  if (!confirm(t("admin.keyManagement.deleteConfirm"))) {
    return;
  }

  isLoading.value = true;

  try {
    const result = await deleteApiKey(keyId);

    if (result.success) {
      apiKeys.value = apiKeys.value.filter((key) => key.id !== keyId);
      successMessage.value = t("admin.keyManagement.success.deleted");

      // 3秒后清除成功消息
      setTimeout(() => {
        successMessage.value = null;
      }, 3000);
    } else {
      error.value = result.message || t("admin.keyManagement.error.deleteFailed");
    }
  } catch (e) {
    console.error("删除API密钥失败:", e);
    error.value = t("admin.keyManagement.error.deleteFailed");
  } finally {
    isLoading.value = false;
  }
};

// 复制密钥到剪贴板
const copyKeyToClipboard = async (key) => {
  try {
    await navigator.clipboard.writeText(key);
    successMessage.value = t("admin.keyManagement.success.copied");

    // 3秒后清除成功消息
    setTimeout(() => {
      successMessage.value = null;
    }, 3000);
  } catch (e) {
    console.error("复制到剪贴板失败:", e);
    error.value = t("admin.keyManagement.error.copyFailed");
  }
};

// 格式化日期显示
const formatDate = (dateString) => {
  if (!dateString) return t("admin.keyManagement.neverExpires");

  // 检查是否是远未来日期（表示永不过期）
  if (dateString.startsWith("9999-")) {
    return t("admin.keyManagement.neverExpires");
  }

  const date = new Date(dateString);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// 打开编辑模态框
const openEditModal = (key) => {
  editingKey.value = key;
  editKeyName.value = key.name;
  editKeyTextPermission.value = key.text_permission === 1 || key.text_permission === true;
  editKeyFilePermission.value = key.file_permission === 1 || key.file_permission === true;
  editKeyMountPermission.value = key.mount_permission === 1 || key.mount_permission === true;

  // 设置过期时间
  const expiresAt = key.expires_at ? new Date(key.expires_at) : null;
  if (expiresAt) {
    editKeyExpiration.value = "custom";
    // 转换为本地日期时间格式 yyyy-MM-ddThh:mm
    const year = expiresAt.getFullYear();
    const month = String(expiresAt.getMonth() + 1).padStart(2, "0");
    const day = String(expiresAt.getDate()).padStart(2, "0");
    const hours = String(expiresAt.getHours()).padStart(2, "0");
    const minutes = String(expiresAt.getMinutes()).padStart(2, "0");
    editKeyCustomExpiration.value = `${year}-${month}-${day}T${hours}:${minutes}`;
  } else {
    editKeyExpiration.value = "never";
    editKeyCustomExpiration.value = "";
  }

  showEditModal.value = true;
};

// 更新密钥
const handleUpdateKey = async () => {
  if (!editKeyName.value.trim()) {
    error.value = t("admin.keyManagement.editModal.errors.nameRequired");
    return;
  }

  isLoading.value = true;
  error.value = null;

  let expiresAt = null;
  // 处理过期时间
  if (editKeyExpiration.value !== "never") {
    if (editKeyExpiration.value === "custom") {
      if (!editKeyCustomExpiration.value) {
        error.value = t("admin.keyManagement.editModal.errors.expirationRequired");
        isLoading.value = false;
        return;
      }
      expiresAt = new Date(editKeyCustomExpiration.value).toISOString();
    } else {
      // 处理1d, 7d, 30d
      const days = parseInt(editKeyExpiration.value);
      const date = new Date();
      date.setDate(date.getDate() + days);
      expiresAt = date.toISOString();
    }
  }

  try {
    // 构建更新数据
    const updateData = {
      name: editKeyName.value,
      text_permission: editKeyTextPermission.value,
      file_permission: editKeyFilePermission.value,
      mount_permission: editKeyMountPermission.value,
    };

    if (expiresAt) {
      updateData.expires_at = expiresAt;
    }

    const result = await updateApiKey(editingKey.value.id, updateData);

    if (result.success) {
      // 更新本地状态
      const index = apiKeys.value.findIndex((key) => key.id === editingKey.value.id);
      if (index !== -1) {
        apiKeys.value[index] = {
          ...apiKeys.value[index],
          name: editKeyName.value,
          text_permission: editKeyTextPermission.value,
          file_permission: editKeyFilePermission.value,
          mount_permission: editKeyMountPermission.value,
          expires_at: expiresAt,
        };
      }

      // 关闭模态框
      showEditModal.value = false;

      // 显示成功消息
      successMessage.value = t("admin.keyManagement.success.updated");

      // 3秒后清除成功消息
      setTimeout(() => {
        successMessage.value = null;
      }, 3000);
    } else {
      error.value = result.message || t("admin.keyManagement.editModal.errors.updateFailed");
    }
  } catch (e) {
    console.error("更新API密钥失败:", e);
    error.value = t("admin.keyManagement.editModal.errors.updateFailed");
  } finally {
    isLoading.value = false;
  }
};

// 组件挂载时加载密钥
onMounted(() => {
  loadApiKeys();
  checkMobile();
  window.addEventListener("resize", checkMobile);
});

// 组件卸载前清理
onBeforeUnmount(() => {
  window.removeEventListener("resize", checkMobile);
});
</script>

<template>
  <div class="p-3 sm:p-4 md:p-5 lg:p-6 flex-1 flex flex-col overflow-y-auto">
    <!-- 顶部操作栏 -->
    <div class="flex flex-col space-y-3 mb-4">
      <!-- 标题和操作按钮行 -->
      <div class="flex flex-col sm:flex-row sm:justify-between gap-3">
        <h2 class="text-lg sm:text-xl font-medium" :class="darkMode ? 'text-white' : 'text-gray-900'">{{ $t("admin.keyManagement.title") }}</h2>

        <div class="flex flex-wrap gap-2">
          <!-- 刷新按钮 -->
          <button
            @click="loadApiKeys"
            class="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 border border-transparent text-sm font-medium rounded-md shadow-sm transition-all duration-200 ease-in-out"
            :class="darkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span class="hidden xs:inline">{{ $t("admin.keyManagement.refresh") }}</span>
          </button>

          <!-- 批量删除按钮 -->
          <button
            @click="deleteSelectedKeys"
            :disabled="selectedKeys.length === 0"
            class="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 border border-transparent text-sm font-medium rounded-md shadow-sm transition-all duration-200 ease-in-out"
            :class="[
              selectedKeys.length === 0
                ? 'opacity-50 cursor-not-allowed bg-gray-400 dark:bg-gray-600'
                : darkMode
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-red-500 hover:bg-red-600 text-white',
            ]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            <span class="hidden xs:inline">{{ $t("admin.keyManagement.bulkDelete") }}{{ selectedKeys.length ? `(${selectedKeys.length})` : "" }}</span>
            <span class="xs:hidden">{{ $t("admin.keyManagement.delete") }}{{ selectedKeys.length ? `(${selectedKeys.length})` : "" }}</span>
          </button>

          <!-- 创建新密钥按钮 -->
          <button
            @click="showCreateModal = true"
            class="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 border border-transparent text-sm font-medium rounded-md shadow-sm transition-all duration-200 ease-in-out"
            :class="darkMode ? 'bg-primary-600 hover:bg-primary-700 text-white' : 'bg-primary-500 hover:bg-primary-600 text-white'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            <span class="hidden xs:inline">{{ $t("admin.keyManagement.create") }}</span>
            <span class="xs:hidden">{{ $t("admin.keyManagement.createShort") }}</span>
          </button>
        </div>
      </div>

      <!-- 最后刷新时间显示 -->
      <div v-if="lastRefreshTime" class="text-xs sm:text-sm" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
        <span class="inline-flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 sm:h-4 sm:w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {{ $t("admin.keyManagement.lastRefreshed") }}: {{ lastRefreshTime }}
        </span>
      </div>
    </div>

    <!-- 成功/错误消息 -->
    <div
      v-if="successMessage"
      class="bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-300 px-3 sm:px-4 py-2 sm:py-3 rounded mb-3 sm:mb-4 text-sm sm:text-base"
    >
      {{ successMessage }}
    </div>

    <div
      v-if="error"
      class="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 px-3 sm:px-4 py-2 sm:py-3 rounded mb-3 sm:mb-4 text-sm sm:text-base"
    >
      {{ error }}
    </div>

    <!-- 密钥列表 -->
    <div class="overflow-hidden bg-white dark:bg-gray-800 shadow-md rounded-lg">
      <div class="flex flex-col">
        <div v-if="isLoading && apiKeys.length === 0" class="flex flex-col items-center justify-center h-40">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2" :class="darkMode ? 'border-white' : 'border-primary-500'"></div>
          <p class="mt-3 text-sm" :class="darkMode ? 'text-gray-300' : 'text-gray-600'">{{ $t("admin.keyManagement.loadingKeys") }}</p>
        </div>

        <div v-else-if="apiKeys.length === 0" class="text-center p-8 border rounded-md" :class="darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            />
          </svg>
          <p class="text-lg font-medium mb-1">{{ $t("admin.keyManagement.noKeysTitle") }}</p>
          <p class="mb-4">{{ $t("admin.keyManagement.noKeysDescription") }}</p>
          <button
            @click="showCreateModal = true"
            class="px-4 py-2 rounded-md shadow-sm transition-all duration-200 ease-in-out"
            :class="darkMode ? 'bg-primary-600 hover:bg-primary-700 text-white' : 'bg-primary-500 hover:bg-primary-600 text-white'"
          >
            {{ $t("admin.keyManagement.create") }}
          </button>
        </div>

        <div v-else>
          <!-- 桌面端表格视图 -->
          <div class="hidden md:block flex-1 overflow-auto">
            <table class="w-full border-collapse" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">
              <thead>
                <tr :class="darkMode ? 'bg-gray-700/50' : 'bg-gray-50'">
                  <!-- 添加选择列 -->
                  <th class="py-3 px-4 text-left text-xs font-medium" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
                    <input
                      type="checkbox"
                      :checked="selectedKeys.length === apiKeys.length"
                      :indeterminate="selectedKeys.length > 0 && selectedKeys.length < apiKeys.length"
                      @change="selectedKeys = selectedKeys.length === apiKeys.length ? [] : apiKeys.map((key) => key.id)"
                      class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      :class="darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'"
                    />
                  </th>
                  <th class="py-3 px-4 text-left text-xs font-medium" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ $t("admin.keyManagement.keyName") }}</th>
                  <th class="text-left py-3 px-4 font-medium text-sm" :class="darkMode ? 'text-gray-200' : 'text-gray-600'">{{ $t("admin.keyManagement.key") }}</th>
                  <th class="text-left py-3 px-4 font-medium text-sm" :class="darkMode ? 'text-gray-200' : 'text-gray-600'">{{ $t("admin.keyManagement.permissions") }}</th>
                  <th class="text-left py-3 px-4 font-medium text-sm" :class="darkMode ? 'text-gray-200' : 'text-gray-600'">{{ $t("admin.keyManagement.createdAt") }}</th>
                  <th class="text-left py-3 px-4 font-medium text-sm" :class="darkMode ? 'text-gray-200' : 'text-gray-600'">{{ $t("admin.keyManagement.expiresAt") }}</th>
                  <th class="text-left py-3 px-4 font-medium text-sm" :class="darkMode ? 'text-gray-200' : 'text-gray-600'">{{ $t("admin.keyManagement.lastUsed") }}</th>
                  <th class="text-center py-3 px-4 font-medium text-sm" :class="darkMode ? 'text-gray-200' : 'text-gray-600'">{{ $t("admin.keyManagement.actions") }}</th>
                </tr>
              </thead>
              <tbody class="divide-y" :class="darkMode ? 'divide-gray-700' : 'divide-gray-200'">
                <tr v-for="key in currentPageKeys" :key="key.id" :class="darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'">
                  <!-- 添加选择框 -->
                  <td class="py-3 px-4">
                    <input
                      type="checkbox"
                      :checked="selectedKeys.includes(key.id)"
                      @change="toggleSelectKey(key.id)"
                      class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      :class="darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'"
                    />
                  </td>
                  <td class="py-3 px-4">{{ key.name }}</td>
                  <td class="py-3 px-4">
                    <div class="flex items-center">
                      <span class="font-mono text-sm mr-2">{{ key.key_masked }}</span>
                      <button
                        @click="copyKeyToClipboard(key.key)"
                        class="text-xs px-2 py-0.5 rounded"
                        :class="darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'"
                        :title="$t('admin.keyManagement.copyKeyFull')"
                      >
                        {{ $t("admin.keyManagement.copyKey") }}
                      </button>
                    </div>
                  </td>
                  <td class="py-3 px-4">
                    <div class="flex space-x-2">
                      <span v-if="key.text_permission" class="px-2 py-0.5 text-xs rounded" :class="darkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-800'">
                        {{ $t("admin.keyManagement.textPermissionFull") }}
                      </span>
                      <span v-if="key.file_permission" class="px-2 py-0.5 text-xs rounded" :class="darkMode ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-800'">
                        {{ $t("admin.keyManagement.filePermissionFull") }}
                      </span>
                      <span
                        v-if="key.mount_permission"
                        class="px-2 py-0.5 text-xs rounded"
                        :class="darkMode ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-800'"
                      >
                        {{ $t("admin.keyManagement.mountPermissionFull") }}
                      </span>
                      <span
                        v-if="!key.text_permission && !key.file_permission && !key.mount_permission"
                        class="px-2 py-0.5 text-xs rounded"
                        :class="darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'"
                      >
                        {{ $t("admin.keyManagement.noPermission") }}
                      </span>
                    </div>
                  </td>
                  <td class="py-3 px-4 text-sm" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ formatDate(key.created_at) }}</td>
                  <td class="py-3 px-4 text-sm" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ formatDate(key.expires_at) }}</td>
                  <td class="py-3 px-4 text-sm" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
                    {{ key.last_used ? formatDate(key.last_used) : $t("admin.keyManagement.neverUsed") }}
                  </td>
                  <td class="py-3 px-4 text-center">
                    <div class="flex justify-center space-x-2">
                      <button
                        @click="openEditModal(key)"
                        class="text-sm px-2 py-1 rounded transition-colors duration-150"
                        :class="darkMode ? 'hover:bg-blue-900/40 text-blue-400' : 'hover:bg-blue-100 text-blue-600'"
                        :disabled="isLoading"
                      >
                        {{ $t("admin.keyManagement.edit") }}
                      </button>
                      <button
                        @click="handleDeleteKey(key.id)"
                        class="text-sm px-2 py-1 rounded transition-colors duration-150"
                        :class="darkMode ? 'hover:bg-red-900/40 text-red-400' : 'hover:bg-red-100 text-red-600'"
                        :disabled="isLoading"
                      >
                        {{ $t("admin.keyManagement.delete") }}
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 移动端卡片视图 -->
          <div class="md:hidden flex-1 overflow-auto">
            <div v-if="isLoading" class="p-4 text-center" :class="darkMode ? 'text-gray-300' : 'text-gray-500'">
              <div class="flex justify-center">
                <svg class="animate-spin h-5 w-5" :class="darkMode ? 'text-white' : 'text-primary-500'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span class="ml-2">{{ $t("admin.keyManagement.loading") }}</span>
              </div>
            </div>

            <!-- 移动端：每个密钥显示为一个卡片 -->
            <div class="p-2 space-y-3">
              <div
                v-for="key in currentPageKeys"
                :key="key.id"
                class="border rounded-lg p-3 relative"
                :class="darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white'"
              >
                <!-- 密钥名称和操作按钮 -->
                <div class="flex items-start justify-between mb-2">
                  <div class="flex items-center space-x-2">
                    <!-- 选择框 -->
                    <input
                      type="checkbox"
                      :checked="selectedKeys.includes(key.id)"
                      @change="toggleSelectKey(key.id)"
                      class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      :class="darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'"
                    />
                    <h3 class="font-medium" :class="darkMode ? 'text-white' : 'text-gray-900'">{{ key.name }}</h3>
                  </div>
                  <div class="flex items-center space-x-2">
                    <!-- 复制按钮 -->
                    <button
                      @click="copyKeyToClipboard(key.key)"
                      class="text-xs px-2 py-1 rounded"
                      :class="darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'"
                    >
                      {{ $t("admin.keyManagement.copyKeyFull") }}
                    </button>
                  </div>
                </div>

                <!-- 密钥信息 -->
                <div class="text-sm mb-3" :class="darkMode ? 'text-gray-400' : 'text-gray-600'">
                  <div class="font-mono mb-1">{{ key.key_masked }}</div>

                  <!-- 权限标签 -->
                  <div class="flex flex-wrap gap-2 mt-1 mb-2">
                    <span v-if="key.text_permission" class="px-2 py-0.5 text-xs rounded" :class="darkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-800'">
                      {{ $t("admin.keyManagement.textPermissionFull") }}
                    </span>
                    <span v-if="key.file_permission" class="px-2 py-0.5 text-xs rounded" :class="darkMode ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-800'">
                      {{ $t("admin.keyManagement.filePermissionFull") }}
                    </span>
                    <span v-if="key.mount_permission" class="px-2 py-0.5 text-xs rounded" :class="darkMode ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-800'">
                      {{ $t("admin.keyManagement.mountPermissionFull") }}
                    </span>
                    <span
                      v-if="!key.text_permission && !key.file_permission && !key.mount_permission"
                      class="px-2 py-0.5 text-xs rounded"
                      :class="darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'"
                    >
                      {{ $t("admin.keyManagement.noPermission") }}
                    </span>
                  </div>

                  <!-- 时间信息 -->
                  <div class="grid grid-cols-2 gap-1">
                    <div>{{ $t("admin.keyManagement.createdAt") }}: {{ formatDate(key.created_at) }}</div>
                    <div>{{ $t("admin.keyManagement.expiresAt") }}: {{ formatDate(key.expires_at) }}</div>
                    <div>{{ $t("admin.keyManagement.lastUsed") }}: {{ key.last_used ? formatDate(key.last_used) : $t("admin.keyManagement.neverUsed") }}</div>
                  </div>
                </div>

                <!-- 操作按钮 -->
                <div class="flex justify-end space-x-2">
                  <button
                    @click="openEditModal(key)"
                    class="text-sm px-2 py-1 rounded transition-colors duration-150"
                    :class="darkMode ? 'hover:bg-blue-900/40 text-blue-400' : 'hover:bg-blue-100 text-blue-600'"
                  >
                    {{ $t("admin.keyManagement.edit") }}
                  </button>
                  <button
                    @click="handleDeleteKey(key.id)"
                    class="text-sm px-2 py-1 rounded transition-colors duration-150"
                    :class="darkMode ? 'hover:bg-red-900/40 text-red-400' : 'hover:bg-red-100 text-red-600'"
                  >
                    {{ $t("admin.keyManagement.delete") }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 分页组件 - 统一放在外部 -->
    <div v-if="!isLoading && apiKeys.length > 0" class="mt-4">
      <CommonPagination :dark-mode="darkMode" :pagination="pagination" mode="page" @page-changed="handlePageChange" />
    </div>

    <!-- 创建密钥模态框 -->
    <div
      v-if="showCreateModal"
      class="fixed inset-0 z-50 overflow-y-auto pt-20 sm:pt-36 pb-6 px-4 sm:px-0 flex items-center sm:items-start justify-center"
      :class="darkMode ? 'bg-gray-900/75' : 'bg-black/50'"
      @click="showCreateModal = false"
    >
      <!-- 模态框内容 -->
      <div
        class="relative rounded-lg shadow-xl w-full max-h-[75vh] overflow-hidden"
        :class="darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'"
        style="max-width: 420px"
        @click.stop
      >
        <!-- 弹窗头部带关闭按钮 -->
        <div
          class="px-4 py-3 sm:py-4 border-b flex justify-between items-center sticky top-0 z-10"
          :class="[darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white']"
        >
          <h3 class="text-lg leading-6 font-medium" :class="darkMode ? 'text-white' : 'text-gray-900'">{{ $t("admin.keyManagement.createModal.title") }}</h3>
          <button
            @click="showCreateModal = false"
            class="rounded-md p-1 inline-flex items-center justify-center"
            :class="darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'"
          >
            <span class="sr-only">{{ $t("admin.keyManagement.createModal.close") }}</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </div>

        <!-- 弹窗内容区 - 增加滚动条 -->
        <div class="px-4 py-4 overflow-y-auto" style="max-height: calc(75vh - 56px)">
          <div class="space-y-4">
            <!-- 密钥名称 -->
            <div>
              <label for="key-name" class="block text-sm font-medium mb-1" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">
                {{ $t("admin.keyManagement.createModal.keyName") }}
              </label>
              <input
                id="key-name"
                v-model="newKeyName"
                type="text"
                :placeholder="$t('admin.keyManagement.createModal.keyNamePlaceholder')"
                class="w-full p-2 rounded-md border"
                :class="darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'"
              />
              <p class="mt-1 text-sm" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ $t("admin.keyManagement.createModal.keyNameHelp") }}</p>
            </div>

            <!-- 自定义密钥 -->
            <div class="space-y-2">
              <div class="flex items-center space-x-2">
                <input
                  id="use-custom-key"
                  v-model="useCustomKey"
                  type="checkbox"
                  class="h-4 w-4 rounded"
                  :class="darkMode ? 'bg-gray-700 border-gray-600 text-primary-600' : 'bg-white border-gray-300 text-primary-500'"
                />
                <label for="use-custom-key" class="text-sm font-medium" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">
                  {{ $t("admin.keyManagement.createModal.useCustomKey") }}
                </label>
              </div>

              <div v-if="useCustomKey">
                <label for="custom-key" class="block text-sm font-medium mb-1" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">
                  {{ $t("admin.keyManagement.createModal.customKey") }}
                </label>
                <input
                  id="custom-key"
                  v-model="newKeyCustomKey"
                  type="text"
                  :placeholder="$t('admin.keyManagement.createModal.customKeyPlaceholder')"
                  class="w-full p-2 rounded-md border"
                  :class="darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'"
                />
                <p class="mt-1 text-sm" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ $t("admin.keyManagement.createModal.customKeyHelp") }}</p>
              </div>
            </div>

            <!-- 过期时间 -->
            <div>
              <label for="key-expiration" class="block text-sm font-medium mb-1" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">
                {{ $t("admin.keyManagement.createModal.expiration") }}
              </label>
              <select
                id="key-expiration"
                v-model="newKeyExpiration"
                class="w-full p-2 rounded-md border"
                :class="darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'"
              >
                <option v-for="option in expirationOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>

            <!-- 自定义过期时间 -->
            <div v-if="isCustomExpiration">
              <label for="custom-expiration" class="block text-sm font-medium mb-1" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">
                {{ $t("admin.keyManagement.createModal.customExpiration") }}
              </label>
              <input
                id="custom-expiration"
                v-model="newKeyCustomExpiration"
                type="datetime-local"
                class="w-full p-2 rounded-md border"
                :class="darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'"
              />
            </div>

            <!-- 权限设置 -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <!-- 文本权限 -->
              <div class="flex items-center space-x-2">
                <input
                  id="text-permission"
                  v-model="newKeyTextPermission"
                  type="checkbox"
                  class="h-5 w-5 rounded"
                  :class="darkMode ? 'bg-gray-700 border-gray-600 text-primary-600' : 'bg-white border-gray-300 text-primary-500'"
                />
                <label for="text-permission" class="text-sm font-medium" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">
                  {{ $t("admin.keyManagement.createModal.permissions.text") }}
                </label>
              </div>

              <!-- 文件权限 -->
              <div class="flex items-center space-x-2">
                <input
                  id="file-permission"
                  v-model="newKeyFilePermission"
                  type="checkbox"
                  class="h-5 w-5 rounded"
                  :class="darkMode ? 'bg-gray-700 border-gray-600 text-primary-600' : 'bg-white border-gray-300 text-primary-500'"
                />
                <label for="file-permission" class="text-sm font-medium" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">
                  {{ $t("admin.keyManagement.createModal.permissions.file") }}
                </label>
              </div>

              <!-- 挂载点权限 -->
              <div class="flex items-center space-x-2">
                <input
                  id="mount-permission"
                  v-model="newKeyMountPermission"
                  type="checkbox"
                  class="h-5 w-5 rounded"
                  :class="darkMode ? 'bg-gray-700 border-gray-600 text-primary-600' : 'bg-white border-gray-300 text-primary-500'"
                />
                <label for="mount-permission" class="text-sm font-medium" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">
                  {{ $t("admin.keyManagement.createModal.permissions.mount") }}
                </label>
              </div>
            </div>

            <!-- 提示信息 -->
            <div class="p-3 rounded-md text-sm" :class="darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'">
              <p class="font-medium mb-1">{{ $t("admin.keyManagement.createModal.securityTip") }}</p>
              <p>{{ $t("admin.keyManagement.createModal.securityMessage") }}</p>
            </div>

            <!-- 错误信息 -->
            <div v-if="error" class="p-3 rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-sm">
              {{ error }}
            </div>

            <!-- 按钮区域 -->
            <div class="flex justify-end space-x-3 pt-2">
              <button
                @click="showCreateModal = false"
                class="px-3 py-1.5 text-sm rounded-md"
                :class="darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'"
                :disabled="isLoading"
              >
                {{ $t("admin.keyManagement.createModal.cancel") }}
              </button>
              <button
                @click="handleCreateKey"
                class="px-3 py-1.5 text-sm rounded-md text-white"
                :class="[isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-primary-600', darkMode ? 'bg-primary-600' : 'bg-primary-500']"
                :disabled="isLoading"
              >
                <span v-if="isLoading">{{ $t("admin.keyManagement.createModal.processing") }}</span>
                <span v-else>{{ $t("admin.keyManagement.createModal.create") }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑密钥模态框 -->
    <div
      v-if="showEditModal"
      class="fixed inset-0 z-50 overflow-y-auto pt-20 sm:pt-36 pb-6 px-4 sm:px-0 flex items-center sm:items-start justify-center"
      :class="darkMode ? 'bg-gray-900/75' : 'bg-black/50'"
      @click="showEditModal = false"
    >
      <!-- 模态框内容 -->
      <div
        class="relative rounded-lg shadow-xl w-full max-h-[75vh] overflow-hidden"
        :class="darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'"
        style="max-width: 420px"
        @click.stop
      >
        <!-- 弹窗头部带关闭按钮 -->
        <div
          class="px-4 py-3 sm:py-4 border-b flex justify-between items-center sticky top-0 z-10"
          :class="[darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white']"
        >
          <h3 class="text-lg leading-6 font-medium" :class="darkMode ? 'text-white' : 'text-gray-900'">{{ $t("admin.keyManagement.editModal.title") }}</h3>
          <button
            @click="showEditModal = false"
            class="rounded-md p-1 inline-flex items-center justify-center"
            :class="darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'"
          >
            <span class="sr-only">{{ $t("admin.keyManagement.createModal.close") }}</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </div>

        <!-- 弹窗内容区 - 增加滚动条 -->
        <div class="px-4 py-4 overflow-y-auto" style="max-height: calc(75vh - 56px)">
          <div class="space-y-4">
            <!-- 密钥名称 -->
            <div>
              <label for="edit-key-name" class="block text-sm font-medium mb-1" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">
                {{ $t("admin.keyManagement.createModal.keyName") }}
              </label>
              <input
                id="edit-key-name"
                v-model="editKeyName"
                type="text"
                :placeholder="$t('admin.keyManagement.createModal.keyNamePlaceholder')"
                class="w-full p-2 rounded-md border"
                :class="darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'"
              />
              <p class="mt-1 text-sm" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ $t("admin.keyManagement.createModal.keyNameHelp") }}</p>
            </div>

            <!-- 过期时间 -->
            <div>
              <label for="edit-key-expiration" class="block text-sm font-medium mb-1" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">
                {{ $t("admin.keyManagement.createModal.expiration") }}
              </label>
              <select
                id="edit-key-expiration"
                v-model="editKeyExpiration"
                class="w-full p-2 rounded-md border"
                :class="darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'"
              >
                <option v-for="option in expirationOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>

            <!-- 自定义过期时间 -->
            <div v-if="isEditCustomExpiration">
              <label for="edit-custom-expiration" class="block text-sm font-medium mb-1" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">
                {{ $t("admin.keyManagement.createModal.customExpiration") }}
              </label>
              <input
                id="edit-custom-expiration"
                v-model="editKeyCustomExpiration"
                type="datetime-local"
                class="w-full p-2 rounded-md border"
                :class="darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'"
              />
            </div>

            <!-- 权限设置 -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <!-- 文本权限 -->
              <div class="flex items-center space-x-2">
                <input
                  id="edit-text-permission"
                  v-model="editKeyTextPermission"
                  type="checkbox"
                  class="h-5 w-5 rounded"
                  :class="darkMode ? 'bg-gray-700 border-gray-600 text-primary-600' : 'bg-white border-gray-300 text-primary-500'"
                />
                <label for="edit-text-permission" class="text-sm font-medium" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">
                  {{ $t("admin.keyManagement.createModal.permissions.text") }}
                </label>
              </div>

              <!-- 文件权限 -->
              <div class="flex items-center space-x-2">
                <input
                  id="edit-file-permission"
                  v-model="editKeyFilePermission"
                  type="checkbox"
                  class="h-5 w-5 rounded"
                  :class="darkMode ? 'bg-gray-700 border-gray-600 text-primary-600' : 'bg-white border-gray-300 text-primary-500'"
                />
                <label for="edit-file-permission" class="text-sm font-medium" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">
                  {{ $t("admin.keyManagement.createModal.permissions.file") }}
                </label>
              </div>

              <!-- 挂载点权限 -->
              <div class="flex items-center space-x-2">
                <input
                  id="edit-mount-permission"
                  v-model="editKeyMountPermission"
                  type="checkbox"
                  class="h-5 w-5 rounded"
                  :class="darkMode ? 'bg-gray-700 border-gray-600 text-primary-600' : 'bg-white border-gray-300 text-primary-500'"
                />
                <label for="edit-mount-permission" class="text-sm font-medium" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">
                  {{ $t("admin.keyManagement.createModal.permissions.mount") }}
                </label>
              </div>
            </div>

            <!-- 提示信息 -->
            <div class="p-3 rounded-md text-sm" :class="darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'">
              <p class="font-medium mb-1">{{ $t("admin.keyManagement.createModal.securityTip") }}</p>
              <p>{{ $t("admin.keyManagement.createModal.securityMessage") }}</p>
            </div>

            <!-- 错误信息 -->
            <div v-if="error" class="p-3 rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-sm">
              {{ error }}
            </div>

            <!-- 按钮区域 -->
            <div class="flex justify-end space-x-3 pt-2">
              <button
                @click="showEditModal = false"
                class="px-3 py-1.5 text-sm rounded-md"
                :class="darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'"
                :disabled="isLoading"
              >
                {{ $t("admin.keyManagement.editModal.cancel") }}
              </button>
              <button
                @click="handleUpdateKey"
                class="px-3 py-1.5 text-sm rounded-md text-white"
                :class="[isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-primary-600', darkMode ? 'bg-primary-600' : 'bg-primary-500']"
                :disabled="isLoading"
              >
                <span v-if="isLoading">{{ $t("admin.keyManagement.editModal.processing") }}</span>
                <span v-else>{{ $t("admin.keyManagement.editModal.update") }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
