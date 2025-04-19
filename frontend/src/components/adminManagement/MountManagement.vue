<script setup>
import { ref, reactive, onMounted, computed } from "vue";
import { getAdminMountsList, deleteAdminMount, getUserMountsList, deleteUserMount, updateAdminMount, updateUserMount } from "../../api/mountService";
import MountForm from "./mount-management/MountForm.vue";
import CommonPagination from "../common/CommonPagination.vue";
import { getAllS3Configs } from "../../api/adminService";
import { getAllApiKeys } from "../../api/adminService";
import { getApiKeyInfo } from "../../utils/auth-helper";

/**
 * 组件接收的属性定义
 * darkMode: 主题模式
 * userType: 用户类型，'admin'或'apikey'
 */
const props = defineProps({
  darkMode: {
    type: Boolean,
    required: true,
  },
  userType: {
    type: String,
    default: "admin", // 默认为管理员
    validator: (value) => ["admin", "apikey"].includes(value),
  },
});

// 判断用户类型
const isAdmin = () => {
  return props.userType === "admin";
};

const isApiKeyUser = () => {
  return props.userType === "apikey";
};

// 根据用户类型返回相应的API函数
const getMountsList = () => (isApiKeyUser() ? getUserMountsList : getAdminMountsList);
const deleteMountById = () => (isApiKeyUser() ? deleteUserMount : deleteAdminMount);

/**
 * 状态变量定义
 * loading: 数据加载状态
 * error: 错误信息
 * successMessage: 成功消息提示
 * mounts: 挂载点数据列表
 * pagination: 分页信息对象
 */
const loading = ref(false);
const error = ref("");
const successMessage = ref("");
const mounts = ref([]);
const searchQuery = ref("");

// 分页相关
const pagination = reactive({
  offset: 0,
  limit: 6, // 每页显示6个挂载点，之前是9
  total: 0,
  hasMore: false,
});

// 过滤后的挂载点列表
const filteredMounts = computed(() => {
  if (!searchQuery.value) {
    return mounts.value;
  }

  const query = searchQuery.value.toLowerCase();
  return mounts.value.filter(
      (mount) =>
          mount.name.toLowerCase().includes(query) ||
          mount.mount_path.toLowerCase().includes(query) ||
          mount.storage_type.toLowerCase().includes(query) ||
          (mount.remark && mount.remark.toLowerCase().includes(query))
  );
});

// 是否显示新建/编辑表单
const showForm = ref(false);
// 当前编辑的挂载点
const currentMount = ref(null);

// 用于显示最后刷新时间
const lastRefreshTime = ref("");

// S3配置列表
const s3ConfigsList = ref([]);

// API密钥名称映射 - 用于存储API密钥ID与名称的对应关系
const apiKeyNames = ref({});

/**
 * 格式化当前时间为本地时间字符串
 * @returns {string} 格式化后的时间字符串
 */
const formatCurrentTime = () => {
  const now = new Date();
  return now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

/**
 * 更新最后刷新时间
 * 记录数据的最后刷新时间点
 */
const updateLastRefreshTime = () => {
  lastRefreshTime.value = formatCurrentTime();
};

// 格式化日期显示
const formatDate = (dateString) => {
  if (!dateString) return "-";
  const date = new Date(dateString);

  // 检查日期是否有效
  if (isNaN(date.getTime())) {
    return "日期无效";
  }

  // 使用Intl.DateTimeFormat以确保时区正确
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false, // 使用24小时制
  }).format(date);
};

// 更新分页信息
const updatePagination = () => {
  pagination.total = filteredMounts.value.length;
  pagination.hasMore = pagination.offset + pagination.limit < pagination.total;
};

// 处理偏移量变化
const handleOffsetChange = (newOffset) => {
  pagination.offset = newOffset;
};

// 加载S3配置列表
const loadS3Configs = async () => {
  try {
    const response = await getAllS3Configs();
    if (response.code === 200 && response.data) {
      s3ConfigsList.value = response.data;
    } else {
      console.error("加载S3配置列表失败:", response.message);
    }
  } catch (err) {
    console.error("加载S3配置列表错误:", err);
  }
};

// 根据ID获取S3配置
const getS3ConfigById = (configId) => {
  return s3ConfigsList.value.find((config) => config.id === configId) || null;
};

// 格式化存储类型显示
const formatStorageType = (mount) => {
  // 基本验证
  if (!mount) return "-";

  if (mount.storage_type === "S3" && mount.storage_config_id) {
    // 如果S3配置列表尚未加载完成
    if (s3ConfigsList.value.length === 0) {
      return `${mount.storage_type} (加载中...)`;
    }

    const config = getS3ConfigById(mount.storage_config_id);
    if (config) {
      return `${config.name} (${config.provider_type})`;
    } else {
      // 未找到配置时显示配置ID
      return `${mount.storage_type} (ID: ${mount.storage_config_id})`;
    }
  }
  return mount.storage_type || "-";
};

/**
 * 获取创建者类型，用于后续格式化和样式计算
 * @param {Object} mount - 挂载点对象
 * @returns {string} 创建者类型: 'system', 'admin', 'apikey'
 */
const getCreatorType = (mount) => {
  if (!mount.created_by) {
    return "system";
  }

  if (mount.created_by === "admin") {
    return "admin";
  }

  // 处理带"apikey:"前缀的API密钥ID
  if (typeof mount.created_by === "string" && mount.created_by.startsWith("apikey:")) {
    return "apikey";
  }

  // 检查是否在已知的API密钥列表中的UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mount.created_by) && apiKeyNames.value && apiKeyNames.value[mount.created_by]) {
    return "apikey";
  }

  // UUID格式但不在已知API密钥列表中，则视为管理员
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mount.created_by)) {
    return "admin";
  }

  // 默认为其他类型
  return "other";
};

/**
 * 格式化创建者信息显示
 * @param {Object} mount - 挂载点对象
 * @returns {string} 格式化后的创建者信息
 */
const formatCreator = (mount) => {
  const creatorType = getCreatorType(mount);

  if (creatorType === "system") {
    return "系统";
  }

  if (creatorType === "admin") {
    return "管理员";
  }

  if (creatorType === "apikey") {
    // 获取API密钥ID
    let keyId = mount.created_by;
    if (mount.created_by.startsWith("apikey:")) {
      keyId = mount.created_by.substring(7);
    }

    // 显示API密钥名称或缩略ID
    if (apiKeyNames.value && apiKeyNames.value[keyId]) {
      return `密钥：${apiKeyNames.value[keyId]}`;
    } else if (keyId.length > 10) {
      return `密钥：${keyId.substring(0, 5)}...`;
    } else {
      return `密钥：${keyId}`;
    }
  }

  // 默认直接返回创建者值
  return mount.created_by;
};

/**
 * 获取创建者标签的样式类
 * @param {Object} mount - 挂载点对象
 * @returns {string} 样式类字符串
 */
const getCreatorClass = (mount) => {
  const darkModeValue = props.darkMode;
  const creatorType = getCreatorType(mount);

  // 根据创建者类型返回对应样式
  if (creatorType === "system") {
    return darkModeValue ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700";
  }

  if (creatorType === "admin") {
    return darkModeValue ? "bg-green-900/50 text-green-200 border border-green-800/50" : "bg-green-100 text-green-800 border border-green-200";
  }

  if (creatorType === "apikey") {
    return darkModeValue ? "bg-blue-900/50 text-blue-200 border border-blue-800/50" : "bg-blue-100 text-blue-800 border border-blue-200";
  }

  // 默认样式
  return darkModeValue ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700";
};

// 加载API密钥名称列表
const loadApiKeyNames = async () => {
  try {
    // 根据用户类型选择不同的加载方式
    if (isAdmin()) {
      // 管理员用户 - 加载所有API密钥
      const response = await getAllApiKeys();
      if (response.code === 200 && response.data) {
        // 构建API密钥ID到名称的映射
        const keyMap = {};
        response.data.forEach((key) => {
          keyMap[key.id] = key.name;
        });
        apiKeyNames.value = keyMap;
      }
    } else {
      // API密钥用户 - 只加载当前API密钥信息
      const keyInfo = await getApiKeyInfo();
      if (keyInfo && keyInfo.id) {
        const keyMap = {};
        keyMap[keyInfo.id] = keyInfo.name || "当前密钥";
        apiKeyNames.value = keyMap;
      }
    }
  } catch (err) {
    console.error("加载API密钥列表错误:", err);
  }
};

// 加载挂载点列表
const loadMounts = async () => {
  loading.value = true;
  error.value = "";
  successMessage.value = "";

  try {
    // 加载挂载点列表
    const response = await getMountsList()();
    if (response.code === 200 && response.data) {
      mounts.value = response.data;
      if (mounts.value.length > 0) {
        // 更新最后刷新时间
        updateLastRefreshTime();
      }
      // 更新分页信息
      updatePagination();

      // 如果S3配置列表为空，尝试重新加载
      if (s3ConfigsList.value.length === 0) {
        loadS3Configs();
      }

      // 检查是否需要加载API密钥信息
      const needsApiKeys = mounts.value.some(
          (mount) => mount.created_by && (mount.created_by.startsWith("apikey:") || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mount.created_by))
      );

      if (needsApiKeys) {
        await loadApiKeyNames();
      }
    } else {
      error.value = response.message || "加载挂载点列表失败";
    }
  } catch (err) {
    console.error("加载挂载点列表错误:", err);
    error.value = err.message || "加载挂载点列表失败";
  } finally {
    loading.value = false;
  }
};

// 打开新建表单
const openCreateForm = () => {
  currentMount.value = null;
  showForm.value = true;
};

// 打开编辑表单
const openEditForm = (mount) => {
  currentMount.value = { ...mount };
  showForm.value = true;
};

// 关闭表单
const closeForm = () => {
  showForm.value = false;
  currentMount.value = null;
};

// 表单保存成功的处理函数
const handleFormSaveSuccess = (success = true, message = null) => {
  closeForm();

  // 如果操作失败，显示错误消息
  if (success === false) {
    error.value = message || "操作失败";
    setTimeout(() => {
      error.value = "";
    }, 4000);
    return;
  }

  // 显示成功消息
  successMessage.value = message || (currentMount.value ? "挂载点更新成功" : "挂载点创建成功");
  setTimeout(() => {
    successMessage.value = "";
  }, 4000);

  // 重新加载挂载点列表
  loadMounts();
};

// 删除挂载点
const confirmDelete = async (id) => {
  if (!confirm("确定要删除这个挂载点吗？此操作不可撤销。")) {
    return;
  }

  try {
    // 清空之前的消息
    error.value = "";
    successMessage.value = "";

    // 根据用户类型调用相应的API函数
    const response = await deleteMountById()(id);
    if (response.code === 200) {
      successMessage.value = "挂载点删除成功";
      setTimeout(() => {
        successMessage.value = "";
      }, 4000);
      // 重新加载挂载点列表
      loadMounts();
    } else {
      error.value = response.message || "删除挂载点失败";
    }
  } catch (err) {
    console.error("删除挂载点错误:", err);
    error.value = err.message || "删除挂载点失败";
  }
};

// 切换挂载点启用/禁用状态
const toggleActive = async (mount) => {
  // 确定操作类型（用于提示消息）
  const action = mount.is_active ? "禁用" : "启用";

  try {
    // 清空之前的消息
    error.value = "";
    successMessage.value = "";

    // 准备更新数据，只包含is_active字段
    const updateData = {
      is_active: !mount.is_active,
    };

    // 根据用户类型调用相应的API函数
    let response;
    if (isApiKeyUser()) {
      response = await updateUserMount(mount.id, updateData);
    } else {
      response = await updateAdminMount(mount.id, updateData);
    }

    // 处理响应
    if (response.code === 200) {
      successMessage.value = `挂载点${action}成功`;
      setTimeout(() => {
        successMessage.value = "";
      }, 4000);
      // 重新加载挂载点列表
      loadMounts();
    } else {
      error.value = response.message || `${action}挂载点失败`;
    }
  } catch (err) {
    console.error(`${action}挂载点错误:`, err);
    error.value = err.message || `${action}挂载点失败`;
  }
};

// 组件挂载时加载数据
onMounted(() => {
  loadS3Configs(); // 先加载S3配置列表
  loadMounts(); // 然后加载挂载点列表
});
</script>

<template>
  <div class="p-4 flex-1 flex flex-col">
    <!-- 顶部操作栏 -->
    <div class="flex flex-col sm:flex-row sm:justify-between mb-4">
      <div class="mb-2 sm:mb-0">
        <h2 class="text-lg font-semibold" :class="darkMode ? 'text-white' : 'text-gray-900'">挂载管理</h2>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
            @click="openCreateForm"
            class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 shadow-sm hover:shadow"
            :class="darkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'"
            :disabled="loading"
        >
          <span class="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            添加挂载点
          </span>
        </button>
        <button
            @click="loadMounts"
            class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 shadow-sm hover:shadow"
            :class="darkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'"
        >
          <span class="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            刷新
          </span>
        </button>
      </div>
    </div>

    <!-- 错误和成功消息提示 -->
    <div v-if="error" class="mb-4 p-3 bg-red-100 text-red-600 rounded-md dark:bg-red-900/50 dark:text-red-200 dark:border dark:border-red-800">
      <p>{{ error }}</p>
    </div>
    <div v-if="successMessage" class="mb-4 p-3 bg-green-100 text-green-600 rounded-md dark:bg-green-900/50 dark:text-green-200 dark:border dark:border-green-800">
      <p>{{ successMessage }}</p>
    </div>

    <!-- 上次刷新时间显示 -->
    <div class="flex justify-between items-center mb-3 sm:mb-4" v-if="lastRefreshTime">
      <div class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
        <span class="inline-flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 sm:h-4 sm:w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          上次刷新: {{ lastRefreshTime }}
        </span>
      </div>

      <!-- 搜索框 -->
      <div class="max-w-md">
        <div class="relative rounded-md shadow-sm">
          <input
              type="text"
              v-model="searchQuery"
              placeholder="搜索挂载点..."
              class="w-full px-3 py-1.5 rounded-md focus:outline-none focus:ring-2"
              :class="
              darkMode
                ? 'bg-gray-700 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 border border-gray-600'
                : 'bg-white text-gray-700 placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 border border-gray-300'
            "
          />
          <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <svg class="h-4 w-4" :class="darkMode ? 'text-gray-400' : 'text-gray-400'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- 加载中指示器 -->
    <div v-if="loading" class="flex justify-center my-8">
      <svg class="animate-spin h-8 w-8" :class="darkMode ? 'text-blue-400' : 'text-blue-500'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>

    <!-- 挂载点列表为空 -->
    <div v-else-if="filteredMounts.length === 0" class="flex-grow flex items-center justify-center p-6">
      <div class="text-center">
        <svg
            class="mx-auto h-12 w-12 mb-4"
            :class="darkMode ? 'text-gray-500' : 'text-gray-400'"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12H3v8h18v-8H5zm0 0a2 2 0 100-4h14a2 2 0 100 4M5 8a2 2 0 100-4h14a2 2 0 100 4" />
        </svg>
        <h3 class="text-lg font-medium mb-2" :class="darkMode ? 'text-white' : 'text-gray-900'">
          {{ searchQuery ? "没有匹配的挂载点" : "没有挂载点" }}
        </h3>
        <p class="text-sm mb-4" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
          {{ searchQuery ? "尝试使用不同的搜索条件" : '点击"添加挂载点"按钮创建第一个挂载点' }}
        </p>
        <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="inline-flex items-center px-3 py-2 border rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200"
            :class="
            darkMode
              ? 'border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600 focus:ring-blue-500 focus:ring-offset-gray-800'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-blue-500'
          "
        >
          清除搜索
        </button>
      </div>
    </div>

    <!-- 挂载点列表 -->
    <div v-else class="flex-grow overflow-auto">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- 分页显示的挂载点 -->
        <div
            v-for="mount in filteredMounts.slice(pagination.offset, pagination.offset + pagination.limit)"
            :key="mount.id"
            class="rounded-lg shadow-md overflow-hidden transition-all duration-200 hover:shadow-lg flex flex-col"
            :class="darkMode ? 'bg-gray-700 border border-gray-600 hover:border-blue-500/50' : 'bg-white border border-gray-200 hover:border-blue-400/50'"
        >
          <!-- 卡片内容区域 - 使用flex-col布局 -->
          <div class="px-4 py-4 flex-1 flex flex-col justify-between">
            <!-- 卡片顶部信息区 -->
            <div>
              <!-- 挂载点标题和状态 -->
              <div class="flex justify-between items-start mb-3">
                <h3 class="text-base font-medium truncate" :class="darkMode ? 'text-white' : 'text-gray-900'" :title="mount.name">
                  {{ mount.name }}
                </h3>
                <span
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors duration-200"
                    :class="
                    mount.is_active
                      ? darkMode
                        ? 'bg-green-900/50 text-green-200 border border-green-800/50'
                        : 'bg-green-100 text-green-800 border border-green-200'
                      : darkMode
                      ? 'bg-gray-800 text-gray-300 border border-gray-700'
                      : 'bg-gray-100 text-gray-800 border border-gray-200'
                  "
                >
                  <span class="flex items-center">
                    <span class="w-1.5 h-1.5 rounded-full mr-1" :class="mount.is_active ? 'bg-green-400' : 'bg-gray-400'"></span>
                    {{ mount.is_active ? "已启用" : "已禁用" }}
                  </span>
                </span>
              </div>

              <!-- 挂载路径 - 改进显示 -->
              <div class="mb-3">
                <div class="flex items-center">
                  <svg
                      class="flex-shrink-0 mr-1.5 h-4 w-4"
                      :class="darkMode ? 'text-gray-400' : 'text-gray-500'"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <p class="text-sm font-mono truncate" :class="darkMode ? 'text-gray-300' : 'text-gray-600'" :title="mount.mount_path">
                    {{ mount.mount_path }}
                  </p>
                </div>
              </div>

              <!-- 存储类型和配置 - 改进显示 -->
              <div class="mb-3">
                <div class="flex items-center text-sm" :class="darkMode ? 'text-gray-300' : 'text-gray-600'">
                  <svg
                      class="flex-shrink-0 mr-1.5 h-4 w-4"
                      :class="darkMode ? 'text-gray-400' : 'text-gray-500'"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12H3v8h18v-8H5zm0 0a2 2 0 100-4h14a2 2 0 100 4M5 8a2 2 0 100-4h14a2 2 0 100 4" />
                  </svg>
                  <span class="truncate" :title="formatStorageType(mount)">{{ formatStorageType(mount) }}</span>
                </div>
              </div>

              <!-- 备注说明 - 固定高度确保对齐 -->
              <div class="mb-3 min-h-[24px]">
                <div v-if="mount.remark" class="flex items-start">
                  <svg
                      class="flex-shrink-0 mr-1.5 h-4 w-4 mt-0.5"
                      :class="darkMode ? 'text-gray-400' : 'text-gray-500'"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                  >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                    />
                  </svg>
                  <p class="text-sm truncate" :class="darkMode ? 'text-gray-400' : 'text-gray-500'" :title="mount.remark">
                    {{ mount.remark }}
                  </p>
                </div>
              </div>
            </div>

            <!-- 卡片底部信息区 -->
            <div>
              <!-- 创建时间 -->
              <div class="text-xs mb-3" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
                <div class="flex items-center">
                  <svg
                      class="flex-shrink-0 mr-1.5 h-3.5 w-3.5"
                      :class="darkMode ? 'text-gray-500' : 'text-gray-400'"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                  >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span>创建: {{ formatDate(mount.created_at) }}</span>
                </div>
              </div>

              <!-- 创建者信息 -->
              <div class="text-xs mb-3" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
                <div class="flex items-center">
                  <svg
                      class="flex-shrink-0 mr-1.5 h-3.5 w-3.5"
                      :class="darkMode ? 'text-gray-500' : 'text-gray-400'"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>创建者: </span>
                  <span class="ml-1 px-1.5 py-0.5 text-xs rounded" :class="getCreatorClass(mount)">
                    {{ formatCreator(mount) }}
                  </span>
                </div>
              </div>

              <!-- 操作按钮组 - 完全重新设计 -->
              <div class="flex justify-end space-x-2">
                <button
                    @click="openEditForm(mount)"
                    class="inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1"
                    :class="
                    darkMode
                      ? 'bg-gray-600 hover:bg-gray-500 text-gray-200 focus:ring-blue-500 focus:ring-offset-gray-800'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700 focus:ring-blue-500 focus:ring-offset-white'
                  "
                >
                  <svg class="h-3.5 w-3.5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  编辑
                </button>
                <!-- 启用/禁用切换按钮 -->
                <button
                    @click="toggleActive(mount)"
                    class="inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1"
                    :class="
                    darkMode
                      ? mount.is_active
                        ? 'bg-yellow-700 hover:bg-yellow-600 text-yellow-100 focus:ring-yellow-500 focus:ring-offset-gray-800'
                        : 'bg-green-700 hover:bg-green-600 text-green-100 focus:ring-green-500 focus:ring-offset-gray-800'
                      : mount.is_active
                      ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 focus:ring-yellow-500 focus:ring-offset-white'
                      : 'bg-green-100 hover:bg-green-200 text-green-800 focus:ring-green-500 focus:ring-offset-white'
                  "
                >
                  <svg v-if="mount.is_active" class="h-3.5 w-3.5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                    />
                  </svg>
                  <svg v-else class="h-3.5 w-3.5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {{ mount.is_active ? "禁用" : "启用" }}
                </button>
                <button
                    @click="confirmDelete(mount.id)"
                    class="inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1"
                    :class="
                    darkMode
                      ? 'bg-red-700 hover:bg-red-600 text-red-100 focus:ring-red-500 focus:ring-offset-gray-800'
                      : 'bg-red-100 hover:bg-red-200 text-red-800 focus:ring-red-500 focus:ring-offset-white'
                  "
                >
                  <svg class="h-3.5 w-3.5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 分页组件 -->
    <div class="mt-2 mb-4 sm:mt-4 sm:mb-0">
      <CommonPagination :dark-mode="darkMode" :pagination="pagination" mode="offset" @offset-changed="handleOffsetChange" />
    </div>

    <!-- 新建/编辑挂载点表单 -->
    <MountForm v-if="showForm" :dark-mode="darkMode" :mount="currentMount" :user-type="userType" @close="closeForm" @save-success="handleFormSaveSuccess" />
  </div>
</template>

<style scoped>
/* 自定义滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
  border-radius: 4px;
}
.dark ::-webkit-scrollbar-thumb {
  background-color: rgba(75, 85, 99, 0.5);
}
::-webkit-scrollbar-thumb:hover {
  background-color: rgba(107, 114, 128, 0.5);
}
.dark ::-webkit-scrollbar-thumb:hover {
  background-color: rgba(107, 114, 128, 0.5);
}

/* 卡片过渡效果 */
.mount-card-enter-active,
.mount-card-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}
.mount-card-enter-from,
.mount-card-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
