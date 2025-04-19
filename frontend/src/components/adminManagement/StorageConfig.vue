<script setup>
import { ref, onMounted, computed, reactive } from "vue";
import { getAllS3Configs, deleteS3Config, testS3Config, setDefaultS3Config } from "../../api/adminService";
import ConfigForm from "./s3config/ConfigForm.vue";
import CommonPagination from "../common/CommonPagination.vue";

// 接收darkMode属性
const props = defineProps({
  darkMode: {
    type: Boolean,
    required: true,
  },
});

// 状态变量
const s3Configs = ref([]);
const loading = ref(false);
const error = ref("");
const showAddForm = ref(false);
const showEditForm = ref(false);
const currentConfig = ref(null);
const testResults = ref({});

// 分页相关数据
const pagination = reactive({
  page: 1,
  limit: 4,
  total: 0,
  totalPages: 0,
});

// 处理页码变化
const handlePageChange = (page) => {
  pagination.page = page;
  loadS3Configs();
};

// 加载S3配置列表
const loadS3Configs = async () => {
  loading.value = true;
  error.value = "";

  try {
    const response = await getAllS3Configs({
      page: pagination.page,
      limit: pagination.limit,
    });

    if (response.data) {
      s3Configs.value = response.data;
      // 更新分页信息
      pagination.total = response.total || response.data.length;
      pagination.totalPages = Math.ceil(pagination.total / pagination.limit);
    }
  } catch (err) {
    console.error("加载S3配置失败:", err);
    error.value = err.message || "无法加载S3配置列表，请检查网络连接或刷新页面重试";
  } finally {
    loading.value = false;
  }
};

// 计算属性：当前页的配置列表
const currentPageConfigs = computed(() => {
  const start = (pagination.page - 1) * pagination.limit;
  const end = start + pagination.limit;
  return s3Configs.value.slice(start, end);
});

// 处理删除配置
const handleDeleteConfig = async (configId) => {
  if (!confirm("确定要删除此存储配置吗？此操作不可恢复！")) {
    return;
  }

  try {
    await deleteS3Config(configId);
    loadS3Configs(); // 重新加载列表
  } catch (err) {
    console.error("删除S3配置失败:", err);
    // 提供更友好的错误消息，针对不同错误场景
    if (err.message && err.message.includes("有文件正在使用")) {
      error.value = `无法删除此配置：${err.message}`;
    } else {
      error.value = err.message || "删除S3配置失败，请稍后再试";
    }
  }
};

// 编辑配置
const editConfig = (config) => {
  currentConfig.value = { ...config };
  showEditForm.value = true;
  showAddForm.value = false;
};

// 添加新配置
const addNewConfig = () => {
  currentConfig.value = null;
  showAddForm.value = true;
  showEditForm.value = false;
};

// 测试S3配置连接
const testConnection = async (configId) => {
  try {
    testResults.value[configId] = { loading: true };
    const response = await testS3Config(configId);

    // 提取测试结果数据
    const result = response.data?.result || {};

    // 重新计算整体成功状态，基于读权限和前端模拟测试结果
    const basicConnectSuccess = result.read?.success === true; // 基础连接成功
    const frontendUploadSuccess = result.frontendSim?.success === true; // 前端上传模拟成功

    // 要标记为完全成功，需要基础连接和前端模拟测试都成功
    const isFullSuccess = basicConnectSuccess && frontendUploadSuccess;
    // 部分成功：基础连接成功但前端模拟失败
    const isPartialSuccess = basicConnectSuccess && !frontendUploadSuccess;
    // 整体成功状态：至少基础连接成功
    const isSuccess = basicConnectSuccess;

    // 生成更精确的测试结果消息
    let statusMessage = "";
    if (isFullSuccess) {
      statusMessage = "连接测试完全成功";
    } else if (isPartialSuccess) {
      statusMessage = "连接测试部分成功";
    } else {
      statusMessage = "连接测试失败";
    }

    let detailsMessage = "";

    // 读取权限状态
    if (result.read && result.read.success) {
      detailsMessage += "✓ 读取权限正常";
      if (typeof result.read.objectCount === "number") {
        detailsMessage += ` (${result.read.objectCount} 个对象)`;
      }
    } else if (result.read) {
      detailsMessage += "✗ 读取权限测试失败";
      if (result.read.error) {
        detailsMessage += `: ${result.read.error.split("\n")[0]}`;
      }
    }

    // 写入权限状态
    if (result.write) {
      detailsMessage += detailsMessage ? "\n" : "";
      if (result.write.success) {
        detailsMessage += "✓ 写入权限正常";
        if (result.write.cleaned) {
          detailsMessage += " (测试文件已清理)";
        }
      } else {
        detailsMessage += "✗ 写入权限测试失败";
        if (result.write.error) {
          detailsMessage += `: ${result.write.error.split("\n")[0]}`;
        }
      }
    }

    // 跨域CORS测试状态
    if (result.cors) {
      detailsMessage += detailsMessage ? "\n" : "";
      if (result.cors.success) {
        detailsMessage += "✓ 跨域CORS配置正确";
        detailsMessage += " (跨域测试通过)";
      } else {
        detailsMessage += "✗ 跨域CORS配置有问题";
        if (result.cors.error) {
          detailsMessage += `: ${result.cors.error.split("\n")[0]}`;
        }
        detailsMessage += " (跨域测试失败)";
      }
    }

    // 前端模拟测试状态
    if (result.frontendSim) {
      detailsMessage += detailsMessage ? "\n" : "";
      if (result.frontendSim.success) {
        detailsMessage += "✓ 前端上传模拟成功";
        detailsMessage += " (配置可用于实际上传)";
      } else {
        detailsMessage += "✗ 前端上传模拟失败";
        if (result.frontendSim.failedAt) {
          detailsMessage += ` (${result.frontendSim.failedAt}阶段)`;
        }
        detailsMessage += " (配置可能不适用于前端直传)";
      }
    }

    testResults.value[configId] = {
      success: isFullSuccess, // 只有当前端模拟测试也成功时才标记为完全成功
      partialSuccess: isPartialSuccess, // 添加部分成功状态
      message: statusMessage,
      details: detailsMessage,
      result: result, // 保存完整结果以便需要时展示
      loading: false,
    };
  } catch (err) {
    testResults.value[configId] = {
      success: false,
      partialSuccess: false,
      message: "测试连接失败",
      details: err.message || "无法连接到服务器",
      loading: false,
    };
  }
};

// 表单提交成功回调
const handleFormSuccess = () => {
  showAddForm.value = false;
  showEditForm.value = false;
  loadS3Configs();
};

// 获取提供商图标
const getProviderIcon = (providerType) => {
  switch (providerType) {
    case "Cloudflare R2":
      return "M11 16.5l11 7v-14.5m-11 7.5v-13l-11 6.5 11 6.5z";
    case "Backblaze B2":
      return "M4 4v16a2 2 0 002 2h12a2 2 0 002-2V8.342a2 2 0 00-.602-1.43l-4.44-4.342A2 2 0 0013.56 2H6a2 2 0 00-2 2zm5 9v-3a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1z";
    case "AWS S3":
      return "M5 16.577l2.194-2.195 2.194 2.195L5 20.772l-4.388-4.195 2.194-2.195 2.194 2.195zM5 4.822l2.194 2.195L5 9.211 2.806 7.017 5 4.822zM12 0l2.194 2.195L12 4.389 9.806 2.195 12 0zM5 11.211l2.194 2.195-2.194 2.194-2.194-2.194L5 11.211zM12 7.017l4.389-4.195 4.388 4.195-4.388 4.194-4.389-4.194z";
    default:
      return "M3 19h18a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z";
  }
};

// 格式化日期时间
const formatDateTime = (dateString) => {
  if (!dateString) return "未知";
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

// 组件加载时获取列表
onMounted(() => {
  loadS3Configs();
});

// 测试结果详情模态框
const showTestDetails = ref(false);
const selectedTestResult = ref(null);
const showDetailedResults = ref(true); // 控制是否显示详细测试结果

// 显示测试结果详情
const showTestDetailsModal = (configId) => {
  selectedTestResult.value = testResults.value[configId];
  showTestDetails.value = true;
  showDetailedResults.value = true; // 默认展开详细结果
};

// 格式化标签
const formatLabel = (key) => {
  const labels = {
    bucket: "存储桶",
    endpoint: "终端节点",
    region: "区域",
    pathStyle: "路径样式",
    provider: "提供商",
    directory: "目录前缀",
  };
  return labels[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1");
};

// 格式化日期
const formatDate = (isoDate) => {
  try {
    const date = new Date(isoDate);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch (e) {
    return isoDate;
  }
};

// 处理设置默认配置
const handleSetDefaultConfig = async (configId) => {
  try {
    await setDefaultS3Config(configId);
    loadS3Configs(); // 重新加载列表
  } catch (err) {
    console.error("设置默认S3配置失败:", err);
    error.value = err.message || "无法设置为默认配置，请稍后再试";
  }
};
</script>

<template>
  <div class="p-4 flex-1 flex flex-col overflow-y-auto">
    <h2 class="text-lg sm:text-xl font-medium mb-4" :class="darkMode ? 'text-gray-100' : 'text-gray-900'">S3存储配置</h2>

    <div class="flex flex-wrap gap-3 mb-5">
      <button @click="addNewConfig" class="px-3 py-2 rounded-md flex items-center space-x-1 bg-primary-500 hover:bg-primary-600 text-white font-medium transition text-sm">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        <span>添加新配置</span>
      </button>

      <button
          @click="loadS3Configs"
          class="px-3 py-2 rounded-md flex items-center space-x-1 font-medium transition text-sm"
          :class="darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <span>刷新列表</span>
      </button>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="mb-4 p-3 rounded-md text-sm" :class="darkMode ? 'bg-red-900/40 border border-red-800 text-red-200' : 'bg-red-50 text-red-800 border border-red-200'">
      <div class="flex justify-between items-start">
        <div class="flex items-start">
          <svg class="h-5 w-5 text-red-400 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <div class="font-medium">操作失败</div>
            <div class="mt-1">{{ error }}</div>
          </div>
        </div>
        <button @click="error = ''" class="text-red-400 hover:text-red-500" :class="darkMode ? 'hover:text-red-300' : 'hover:text-red-600'">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="flex-1 flex flex-col">
      <!-- 加载状态 -->
      <div v-if="loading" class="flex justify-center items-center h-40">
        <svg class="animate-spin h-8 w-8 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>

      <!-- S3配置列表 -->
      <template v-else-if="s3Configs.length > 0">
        <!-- 卡片网格布局 -->
        <div class="bg-white dark:bg-gray-800 shadow-md rounded-lg p-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
            <div
                v-for="config in currentPageConfigs"
                :key="config.id"
                class="rounded-lg shadow-md overflow-hidden transition-colors duration-200 border relative"
                :class="[
                darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
                config.is_default ? (darkMode ? 'ring-3 ring-primary-500 border-primary-500 shadow-lg' : 'ring-3 ring-primary-500 border-primary-500 shadow-lg') : '',
              ]"
            >
              <div class="px-4 py-3 flex justify-between items-center border-b" :class="darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'">
                <div class="flex items-center">
                  <svg class="h-5 w-5 mr-2 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="getProviderIcon(config.provider_type)" />
                  </svg>
                  <h3 class="font-medium text-sm" :class="[darkMode ? 'text-gray-100' : 'text-gray-900', config.is_default ? 'font-semibold' : '']">
                    {{ config.name }}
                  </h3>
                  <span
                      v-if="config.is_default"
                      class="ml-2 text-xs px-2 py-0.5 rounded-full font-medium"
                      :class="darkMode ? 'bg-primary-600 text-white' : 'bg-primary-500 text-white'"
                  >
                    默认
                  </span>
                </div>
                <span class="text-xs px-2 py-1 rounded-full font-medium" :class="darkMode ? 'bg-primary-900/40 text-primary-200' : 'bg-primary-100 text-primary-800'">
                  {{ config.provider_type }}
                </span>
              </div>

              <div class="p-4">
                <div :class="darkMode ? 'text-gray-300' : 'text-gray-600'">
                  <div class="grid grid-cols-1 gap-2 text-sm">
                    <div class="flex justify-between">
                      <span class="font-medium">存储桶:</span>
                      <span>{{ config.bucket_name }}</span>
                    </div>

                    <div class="flex justify-between">
                      <span class="font-medium">区域:</span>
                      <span>{{ config.region || "自动" }}</span>
                    </div>

                    <div class="flex justify-between">
                      <span class="font-medium">默认文件夹:</span>
                      <span>{{ config.default_folder || "根目录" }}</span>
                    </div>

                    <div class="flex justify-between">
                      <span class="font-medium">路径样式:</span>
                      <span>{{ config.path_style ? "路径样式" : "虚拟主机样式" }}</span>
                    </div>

                    <div class="flex justify-between">
                      <span class="font-medium">API密钥可见:</span>
                      <span class="flex items-center">
                        <svg class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" :class="config.is_public ? 'text-green-500' : 'text-gray-400'">
                          <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              :d="
                              config.is_public
                                ? 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z'
                                : 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636'
                            "
                          />
                        </svg>
                        {{ config.is_public ? "允许" : "禁止" }}
                      </span>
                    </div>

                    <div class="flex justify-between">
                      <span class="font-medium">上次使用:</span>
                      <span>{{ config.last_used ? formatDateTime(config.last_used) : "从未使用" }}</span>
                    </div>

                    <div class="flex justify-between">
                      <span class="font-medium">创建时间:</span>
                      <span>{{ formatDateTime(config.created_at) }}</span>
                    </div>
                  </div>

                  <!-- 测试结果 -->
                  <div class="mt-2">
                    <div v-if="testResults[config.id] && !testResults[config.id].loading" class="mt-2">
                      <div
                          :class="[testResults[config.id].success ? 'text-green-500' : testResults[config.id].partialSuccess ? 'text-amber-500' : 'text-red-500']"
                          class="font-semibold"
                      >
                        {{ testResults[config.id].message }}
                      </div>

                      <!-- 测试简要说明 -->
                      <div v-if="testResults[config.id].result?.globalNote" class="mt-1 p-1 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded">
                        <div class="flex">
                          <svg class="h-3.5 w-3.5 mr-1 mt-0.5 flex-shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>注意：完全成功要求前端上传模拟也通过，这才能保证实际使用正常</div>
                        </div>
                      </div>

                      <div v-if="testResults[config.id].details" class="mt-1 text-sm whitespace-pre-line text-gray-700 dark:text-gray-300">
                        {{ testResults[config.id].details }}
                      </div>

                      <!-- 查看详情按钮 -->
                      <div v-if="testResults[config.id].result" class="mt-2">
                        <button @click="showTestDetailsModal(config.id)" class="text-xs text-blue-600 dark:text-blue-400 hover:underline">查看详细信息</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="mt-4 flex flex-wrap gap-2">
                  <button
                      v-if="!config.is_default"
                      @click="handleSetDefaultConfig(config.id)"
                      class="flex items-center px-3 py-1.5 rounded text-sm font-medium transition"
                      :class="darkMode ? 'bg-primary-600 hover:bg-primary-700 text-white' : 'bg-primary-100 hover:bg-primary-200 text-primary-800'"
                  >
                    <svg class="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    设为默认
                  </button>

                  <button
                      @click="testConnection(config.id)"
                      class="flex items-center px-3 py-1.5 rounded text-sm font-medium transition"
                      :class="
                      testResults[config.id]?.loading
                        ? 'opacity-50 cursor-wait'
                        : darkMode
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-blue-100 hover:bg-blue-200 text-blue-800'
                    "
                      :disabled="testResults[config.id]?.loading"
                  >
                    <template v-if="testResults[config.id]?.loading">
                      <svg class="animate-spin h-4 w-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      测试中...
                    </template>
                    <template v-else>
                      <svg class="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                      测试连接
                    </template>
                  </button>

                  <button
                      @click="editConfig(config)"
                      class="flex items-center px-3 py-1.5 rounded text-sm font-medium transition"
                      :class="darkMode ? 'bg-gray-600 hover:bg-gray-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'"
                  >
                    <svg class="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    编辑
                  </button>

                  <button
                      @click="handleDeleteConfig(config.id)"
                      class="flex items-center px-3 py-1.5 rounded text-sm font-medium transition"
                      :class="darkMode ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-100 hover:bg-red-200 text-red-800'"
                  >
                    <svg class="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

        <!-- 分页组件 - 移到卡片列表外面 -->
        <div class="mt-4">
          <CommonPagination :dark-mode="darkMode" :pagination="pagination" mode="page" @page-changed="handlePageChange" />
        </div>
      </template>

      <!-- 空状态 -->
      <div
          v-else-if="!loading"
          class="rounded-lg p-6 text-center transition-colors duration-200 flex-1 flex flex-col justify-center items-center bg-white dark:bg-gray-800 shadow-md"
          :class="darkMode ? 'text-gray-300' : 'text-gray-600'"
      >
        <svg class="mx-auto h-16 w-16 mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
        <h3 class="text-lg font-medium mb-2" :class="darkMode ? 'text-gray-200' : 'text-gray-700'">还没有S3存储配置</h3>
        <p class="mb-5 text-sm max-w-md">添加您的第一个S3兼容存储服务配置，用于文件上传和分享。</p>
        <button @click="addNewConfig" class="px-4 py-2 rounded-md bg-primary-500 hover:bg-primary-600 text-white font-medium transition inline-flex items-center">
          <svg class="h-5 w-5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          添加配置
        </button>
      </div>
    </div>

    <!-- 添加/编辑表单弹窗 -->
    <ConfigForm
        v-if="showAddForm || showEditForm"
        :dark-mode="darkMode"
        :config="currentConfig"
        :is-edit="showEditForm"
        @close="
        showAddForm = false;
        showEditForm = false;
      "
        @success="handleFormSuccess"
    />

    <!-- 测试结果详情模态框 -->
    <div
        v-if="showTestDetails && selectedTestResult"
        class="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black bg-opacity-50 overflow-y-auto"
        @click="showTestDetails = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden" @click.stop>
        <div class="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 class="text-base sm:text-lg font-medium text-gray-900 dark:text-white">S3存储测试结果</h3>
          <button @click="showTestDetails = false" class="text-gray-400 hover:text-gray-500">
            <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                  fill-rule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clip-rule="evenodd"
              ></path>
            </svg>
          </button>
        </div>

        <div class="p-3 sm:p-4 max-h-[70vh] overflow-y-auto">
          <!-- 连接总结 -->
          <div
              class="mb-3 p-2 sm:p-3 rounded"
              :class="[
              selectedTestResult.success
                ? 'bg-green-50 dark:bg-green-900/30'
                : selectedTestResult.partialSuccess
                ? 'bg-amber-50 dark:bg-amber-900/30'
                : 'bg-red-50 dark:bg-red-900/30',
            ]"
          >
            <div
                class="font-semibold"
                :class="[
                selectedTestResult.success
                  ? 'text-green-700 dark:text-green-400'
                  : selectedTestResult.partialSuccess
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-red-700 dark:text-red-400',
              ]"
            >
              {{ selectedTestResult.message }}
            </div>
            <div v-if="selectedTestResult.details" class="mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
              {{ selectedTestResult.details }}
            </div>

            <!-- 添加前端上传重要性提示 -->
            <div v-if="selectedTestResult.partialSuccess" class="mt-2 text-xs border-t border-amber-200 dark:border-amber-800 pt-2 text-amber-800 dark:text-amber-300">
              <svg class="h-3.5 w-3.5 mr-1 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span>虽然基本连接成功，但前端上传模拟测试失败，实际使用可能会有问题</span>
            </div>
          </div>

          <!-- 折叠/展开控制 -->
          <div class="mb-3">
            <button
                @click="showDetailedResults = !showDetailedResults"
                class="text-sm flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              <svg class="h-4 w-4 mr-1 transition-transform duration-200" :class="showDetailedResults ? 'rotate-90' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
              {{ showDetailedResults ? "隐藏详细结果" : "显示详细结果" }}
            </button>
          </div>

          <div v-if="showDetailedResults" class="space-y-4">
            <!-- 全局提示说明 -->
            <div v-if="selectedTestResult.result?.globalNote" class="mb-3 p-2 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs">
              <div class="flex items-start">
                <svg class="h-4 w-4 mr-1 mt-0.5 flex-shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>{{ selectedTestResult.result.globalNote }}</div>
              </div>
            </div>

            <!-- 连接信息 -->
            <div class="mb-3">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">连接信息</h4>
              <div class="bg-gray-50 dark:bg-gray-900/50 rounded p-2 sm:p-3 text-xs sm:text-sm">
                <div v-if="selectedTestResult.result?.connectionInfo" class="space-y-2">
                  <div v-for="(value, key) in selectedTestResult.result.connectionInfo" :key="key" class="connection-info-item">
                    <div class="text-gray-500 dark:text-gray-400 font-medium mb-0.5">{{ formatLabel(key) }}:</div>
                    <div
                        class="pl-2 text-gray-900 dark:text-gray-200 break-all overflow-wrap-anywhere"
                        :class="{ 'endpoint-url': key === 'endpoint' || key.includes('url') || key.includes('URI') }"
                    >
                      {{ value || "未设置" }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 读取权限测试 -->
            <div class="mb-3">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">读取权限测试</h4>
              <div class="bg-gray-50 dark:bg-gray-900/50 rounded p-2 sm:p-3 text-xs sm:text-sm">
                <div class="flex items-center mb-1">
                  <span class="mr-1" :class="selectedTestResult.result?.read?.success ? 'text-green-500' : 'text-red-500'">
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          :d="selectedTestResult.result?.read?.success ? 'M5 13l4 4L19 7' : 'M6 18L18 6M6 6l12 12'"
                      ></path>
                    </svg>
                  </span>
                  <span :class="selectedTestResult.result?.read?.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'">
                    {{ selectedTestResult.result?.read?.success ? "读取权限测试成功" : "读取权限测试失败" }}
                  </span>
                </div>

                <!-- 添加测试说明 -->
                <div v-if="selectedTestResult.result?.read?.note" class="mb-2 pl-5 text-amber-600 dark:text-amber-400 text-xs italic">
                  <svg class="h-3 w-3 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {{ selectedTestResult.result.read.note }}
                </div>

                <div v-if="selectedTestResult.result?.read?.success" class="pl-5">
                  <div class="grid grid-cols-2 gap-1">
                    <div class="text-gray-500 dark:text-gray-400">路径前缀:</div>
                    <div class="text-gray-900 dark:text-gray-200">{{ selectedTestResult.result.read.prefix }}</div>

                    <div class="text-gray-500 dark:text-gray-400">对象数量:</div>
                    <div class="text-gray-900 dark:text-gray-200">{{ selectedTestResult.result.read.objectCount }}</div>
                  </div>

                  <!-- 显示首几个对象 -->
                  <div v-if="selectedTestResult.result.read.firstObjects && selectedTestResult.result.read.firstObjects.length > 0" class="mt-2">
                    <div class="text-gray-500 dark:text-gray-400 mb-1">存储桶中的对象:</div>
                    <div class="bg-gray-100 dark:bg-gray-800 rounded p-1 max-h-16 overflow-y-auto">
                      <div v-for="(obj, index) in selectedTestResult.result.read.firstObjects" :key="index" class="text-xs py-0.5">
                        <div class="flex items-start">
                          <span class="text-gray-400 dark:text-gray-500 mr-1 shrink-0">{{ index + 1 }}.</span>
                          <div class="min-w-0 truncate">
                            <div class="text-gray-900 dark:text-gray-200 truncate">{{ obj.key }}</div>
                            <div class="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{{ obj.size }} · {{ formatDate(obj.lastModified) }}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-if="selectedTestResult.result?.read?.error" class="mt-1 text-red-600 dark:text-red-400">
                  <div class="font-medium text-xs">错误信息:</div>
                  <div class="bg-red-50 dark:bg-red-900/20 p-1 rounded mt-0.5 text-xs max-h-20 overflow-auto">
                    {{ selectedTestResult.result.read.error }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 写入权限测试 -->
            <div class="mb-3">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">写入权限测试</h4>
              <div class="bg-gray-50 dark:bg-gray-900/50 rounded p-2 sm:p-3 text-xs sm:text-sm">
                <div class="flex items-center mb-1">
                  <span class="mr-1" :class="selectedTestResult.result?.write?.success ? 'text-green-500' : 'text-red-500'">
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          :d="selectedTestResult.result?.write?.success ? 'M5 13l4 4L19 7' : 'M6 18L18 6M6 6l12 12'"
                      ></path>
                    </svg>
                  </span>
                  <span :class="selectedTestResult.result?.write?.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'">
                    {{ selectedTestResult.result?.write?.success ? "写入权限测试成功" : "写入权限测试失败" }}
                  </span>
                </div>

                <!-- 添加测试说明 -->
                <div v-if="selectedTestResult.result?.write?.note" class="mb-2 pl-5 text-amber-600 dark:text-amber-400 text-xs italic">
                  <svg class="h-3 w-3 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {{ selectedTestResult.result.write.note }}
                </div>

                <div v-if="selectedTestResult.result?.write?.success" class="pl-5">
                  <div class="grid grid-cols-2 gap-1">
                    <div class="text-gray-500 dark:text-gray-400">测试文件:</div>
                    <div class="text-gray-900 dark:text-gray-200 truncate">{{ selectedTestResult.result.write.testFile }}</div>

                    <div v-if="selectedTestResult.result.write.uploadTime" class="text-gray-500 dark:text-gray-400">上传时间:</div>
                    <div v-if="selectedTestResult.result.write.uploadTime" class="text-gray-900 dark:text-gray-200">{{ selectedTestResult.result.write.uploadTime }}ms</div>

                    <div class="text-gray-500 dark:text-gray-400">已清理:</div>
                    <div :class="selectedTestResult.result.write.cleaned ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'">
                      {{ selectedTestResult.result.write.cleaned ? "是" : "否" }}
                    </div>
                  </div>

                  <div
                      v-if="selectedTestResult.result.write.note && !selectedTestResult.result.write.note.includes('后端')"
                      class="mt-1 text-gray-500 dark:text-gray-400 text-xs italic"
                  >
                    {{ selectedTestResult.result.write.note }}
                  </div>

                  <div v-if="!selectedTestResult.result.write.cleaned && selectedTestResult.result.write.cleanupError" class="mt-1 text-yellow-600 dark:text-yellow-400 text-xs">
                    <div>清理警告: {{ selectedTestResult.result.write.cleanupError }}</div>
                  </div>
                </div>

                <div v-if="selectedTestResult.result?.write?.error" class="mt-1 text-red-600 dark:text-red-400">
                  <div class="font-medium text-xs">错误信息:</div>
                  <div class="bg-red-50 dark:bg-red-900/20 p-1 rounded mt-0.5 text-xs max-h-20 overflow-auto">
                    {{ selectedTestResult.result.write.error }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 跨域CORS测试 -->
            <div class="mb-3">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
                跨域CORS配置测试
                <span
                    class="ml-1.5 text-xs px-1.5 py-0.5 rounded"
                    :class="
                    selectedTestResult.result?.cors?.success
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400'
                  "
                >
                  基础测试
                </span>
              </h4>
              <div class="bg-gray-50 dark:bg-gray-900/50 rounded p-2 sm:p-3 text-xs sm:text-sm">
                <div class="flex items-center mb-1">
                  <span class="mr-1" :class="selectedTestResult.result?.cors?.success ? 'text-green-500' : 'text-red-500'">
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          :d="selectedTestResult.result?.cors?.success ? 'M5 13l4 4L19 7' : 'M6 18L18 6M6 6l12 12'"
                      ></path>
                    </svg>
                  </span>
                  <span :class="selectedTestResult.result?.cors?.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'">
                    {{ selectedTestResult.result?.cors?.success ? "CORS预检请求测试通过" : "CORS预检请求测试失败" }}
                  </span>
                </div>

                <div v-if="selectedTestResult.result?.cors?.detail" class="pl-5 text-gray-500 dark:text-gray-400 mb-1">
                  {{ selectedTestResult.result.cors.detail }}
                </div>

                <!-- CORS响应头信息 -->
                <div v-if="selectedTestResult.result?.cors?.success" class="grid grid-cols-2 gap-1 pl-5 mt-1">
                  <div class="text-gray-500 dark:text-gray-400">允许来源:</div>
                  <div class="text-gray-900 dark:text-gray-200 truncate">{{ selectedTestResult.result.cors.allowOrigin || "未指定" }}</div>

                  <div class="text-gray-500 dark:text-gray-400">允许方法:</div>
                  <div class="text-gray-900 dark:text-gray-200 truncate">{{ selectedTestResult.result.cors.allowMethods || "未指定" }}</div>

                  <div class="text-gray-500 dark:text-gray-400">允许的头部:</div>
                  <div class="text-gray-900 dark:text-gray-200 truncate">
                    {{ selectedTestResult.result.cors.allowHeaders || "未指定" }}
                    <span
                        v-if="selectedTestResult.result.cors.allowHeaders && selectedTestResult.result.cors.allowHeaders.length > 20"
                        class="text-xs text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
                        @click="$event.currentTarget.previousElementSibling.classList.toggle('truncate')"
                    >
                      (展开/收起)
                    </span>
                  </div>
                </div>

                <div v-if="selectedTestResult.result?.cors?.error" class="mt-1 text-red-600 dark:text-red-400">
                  <div class="font-medium text-xs">错误信息:</div>
                  <div class="bg-red-50 dark:bg-red-900/20 p-1 rounded mt-0.5 text-xs max-h-20 overflow-auto">
                    {{ selectedTestResult.result.cors.error }}
                  </div>
                </div>

                <div v-if="!selectedTestResult.result?.cors?.success && !selectedTestResult.result?.cors?.error" class="pl-5 text-amber-600 dark:text-amber-400">
                  跨域配置未正确设置，预检请求未通过，前端无法直接上传文件到此存储服务。
                </div>
              </div>
            </div>

            <!-- 前端模拟测试 (新增部分) -->
            <div class="mb-3">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
                前端上传模拟测试
                <span
                    class="ml-1.5 text-xs px-1.5 py-0.5 rounded"
                    :class="
                    selectedTestResult.result?.frontendSim?.success
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400'
                  "
                >
                  关键测试
                </span>
              </h4>
              <div class="bg-gray-50 dark:bg-gray-900/50 rounded p-2 sm:p-3 text-xs sm:text-sm">
                <div class="flex items-center mb-1">
                  <span class="mr-1" :class="selectedTestResult.result?.frontendSim?.success ? 'text-green-500' : 'text-red-500'">
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          :d="selectedTestResult.result?.frontendSim?.success ? 'M5 13l4 4L19 7' : 'M6 18L18 6M6 6l12 12'"
                      ></path>
                    </svg>
                  </span>
                  <span :class="selectedTestResult.result?.frontendSim?.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'">
                    {{ selectedTestResult.result?.frontendSim?.success ? "前端上传模拟测试成功" : "前端上传模拟测试失败" }}
                  </span>
                  <span class="ml-1.5 text-xs px-1.5 py-0.5 rounded font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"> 最关键测试 </span>
                </div>

                <!-- 添加测试说明 -->
                <div v-if="selectedTestResult.result?.frontendSim?.note" class="mb-2 pl-5 text-amber-600 dark:text-amber-400 text-xs italic">
                  <svg class="h-3 w-3 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {{ selectedTestResult.result.frontendSim.note }}
                </div>

                <!-- 显示步骤状态 -->
                <div v-if="selectedTestResult.result?.frontendSim" class="pl-5 space-y-2 mt-2">
                  <!-- 步骤1: 获取预签名URL -->
                  <div class="bg-gray-100 dark:bg-gray-800 rounded p-1.5">
                    <div class="flex items-center">
                      <span
                          class="w-4 h-4 flex-shrink-0 mr-1.5 rounded-full flex items-center justify-center text-white text-xs"
                          :class="selectedTestResult.result.frontendSim.step1?.success ? 'bg-green-500' : 'bg-red-500'"
                      >
                        1
                      </span>
                      <span class="font-medium">{{ selectedTestResult.result.frontendSim.step1?.name || "获取预签名URL" }}</span>
                      <span class="ml-auto" :class="selectedTestResult.result.frontendSim.step1?.success ? 'text-green-500' : 'text-red-500'">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              :d="selectedTestResult.result.frontendSim.step1?.success ? 'M5 13l4 4L19 7' : 'M6 18L18 6M6 6l12 12'"
                          ></path>
                        </svg>
                      </span>
                    </div>
                    <!-- 步骤1详情 -->
                    <div v-if="selectedTestResult.result.frontendSim.step1?.success" class="mt-1 text-xs pl-6">
                      <div v-if="selectedTestResult.result.frontendSim.step1?.url" class="text-gray-500 dark:text-gray-400">
                        <span class="font-medium">URL:</span>
                        <span class="url-display inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                          {{ selectedTestResult.result.frontendSim.step1.url }}
                        </span>
                        <button
                            @click="$event.currentTarget.previousElementSibling.classList.toggle('whitespace-nowrap')"
                            class="text-blue-500 hover:text-blue-600 text-xs ml-1 inline-flex items-center"
                        >
                          <svg class="h-3 w-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span>展开/收起</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- 步骤2: XHR文件上传 -->
                  <div class="bg-gray-100 dark:bg-gray-800 rounded p-1.5">
                    <div class="flex items-center">
                      <span
                          class="w-4 h-4 flex-shrink-0 mr-1.5 rounded-full flex items-center justify-center text-white text-xs"
                          :class="
                          selectedTestResult.result.frontendSim.step2?.success
                            ? 'bg-green-500'
                            : selectedTestResult.result.frontendSim.step1?.success
                            ? 'bg-red-500'
                            : 'bg-gray-400'
                        "
                      >
                        2
                      </span>
                      <span class="font-medium">{{ selectedTestResult.result.frontendSim.step2?.name || "XHR文件上传" }}</span>
                      <span
                          v-if="selectedTestResult.result.frontendSim.step1?.success"
                          class="ml-auto"
                          :class="selectedTestResult.result.frontendSim.step2?.success ? 'text-green-500' : 'text-red-500'"
                      >
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              :d="selectedTestResult.result.frontendSim.step2?.success ? 'M5 13l4 4L19 7' : 'M6 18L18 6M6 6l12 12'"
                          ></path>
                        </svg>
                      </span>
                    </div>
                    <!-- 步骤2详情 -->
                    <div v-if="selectedTestResult.result.frontendSim.step2?.success" class="mt-1 text-xs pl-6 grid grid-cols-2 gap-1">
                      <div class="text-gray-500 dark:text-gray-400">上传耗时:</div>
                      <div class="text-gray-900 dark:text-gray-200">{{ selectedTestResult.result.frontendSim.step2.duration }}ms</div>

                      <div class="text-gray-500 dark:text-gray-400">上传速度:</div>
                      <div class="text-gray-900 dark:text-gray-200">{{ selectedTestResult.result.frontendSim.step2.speed }}</div>

                      <div class="text-gray-500 dark:text-gray-400">ETag:</div>
                      <div class="text-gray-900 dark:text-gray-200 truncate" :title="selectedTestResult.result.frontendSim.step2.etag">
                        {{ selectedTestResult.result.frontendSim.step2.etag }}
                      </div>
                    </div>
                    <!-- 上传错误 -->
                    <div v-else-if="selectedTestResult.result.frontendSim.step1?.success" class="mt-1 text-xs pl-6 text-red-600 dark:text-red-400">
                      <div v-if="selectedTestResult.result.frontendSim.step2?.status" class="font-medium">
                        错误状态码: {{ selectedTestResult.result.frontendSim.step2.status }} {{ selectedTestResult.result.frontendSim.step2.statusText }}
                      </div>
                      <div v-if="selectedTestResult.result.frontendSim.step2?.errorText" class="mt-0.5 bg-red-50 dark:bg-red-900/20 p-1 rounded max-h-16 overflow-auto">
                        {{ selectedTestResult.result.frontendSim.step2.errorText }}
                      </div>
                    </div>
                  </div>

                  <!-- 步骤3: 元数据提交 -->
                  <div class="bg-gray-100 dark:bg-gray-800 rounded p-1.5">
                    <div class="flex items-center">
                      <span
                          class="w-4 h-4 flex-shrink-0 mr-1.5 rounded-full flex items-center justify-center text-white text-xs"
                          :class="
                          selectedTestResult.result.frontendSim.step3?.success
                            ? 'bg-green-500'
                            : selectedTestResult.result.frontendSim.step2?.success
                            ? 'bg-red-500'
                            : 'bg-gray-400'
                        "
                      >
                        3
                      </span>
                      <span class="font-medium">{{ selectedTestResult.result.frontendSim.step3?.name || "元数据提交" }}</span>
                      <span
                          v-if="selectedTestResult.result.frontendSim.step2?.success"
                          class="ml-auto"
                          :class="selectedTestResult.result.frontendSim.step3?.success ? 'text-green-500' : 'text-red-500'"
                      >
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              :d="selectedTestResult.result.frontendSim.step3?.success ? 'M5 13l4 4L19 7' : 'M6 18L18 6M6 6l12 12'"
                          ></path>
                        </svg>
                      </span>
                    </div>
                    <!-- 步骤3详情 -->
                    <div
                        v-if="selectedTestResult.result.frontendSim.step3?.success && selectedTestResult.result.frontendSim.step3?.note"
                        class="mt-1 text-xs pl-6 text-gray-500 dark:text-gray-400"
                    >
                      {{ selectedTestResult.result.frontendSim.step3.note }}
                    </div>
                  </div>
                </div>

                <!-- 整体错误信息 -->
                <div v-if="selectedTestResult.result?.frontendSim?.error" class="mt-2 text-red-600 dark:text-red-400">
                  <div class="font-medium text-xs">错误信息:</div>
                  <div class="bg-red-50 dark:bg-red-900/20 p-1 rounded mt-0.5 text-xs max-h-20 overflow-auto">
                    {{ selectedTestResult.result.frontendSim.error }}
                    <div v-if="selectedTestResult.result.frontendSim.failedAt" class="mt-1 font-medium">失败阶段: {{ selectedTestResult.result.frontendSim.failedAt }}</div>
                  </div>
                </div>

                <!-- 清理信息 -->
                <div v-if="selectedTestResult.result?.frontendSim?.success" class="mt-2 text-xs pl-5">
                  <div class="flex items-center">
                    <span class="text-gray-500 dark:text-gray-400 mr-1">测试文件清理:</span>
                    <span :class="selectedTestResult.result.frontendSim.fileCleaned ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'">
                      {{ selectedTestResult.result.frontendSim.fileCleaned ? "已清理" : "清理失败" }}
                    </span>
                  </div>
                  <div
                      v-if="!selectedTestResult.result.frontendSim.fileCleaned && selectedTestResult.result.frontendSim.cleanError"
                      class="mt-0.5 text-yellow-600 dark:text-yellow-400"
                  >
                    清理错误: {{ selectedTestResult.result.frontendSim.cleanError }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
              @click="showTestDetails = false"
              class="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid-cols-1 {
  grid-template-columns: repeat(1, minmax(0, 1fr));
}

@media (min-width: 640px) {
  .sm\:grid-cols-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .lg\:grid-cols-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* 添加对长URL的支持 */
.break-all {
  word-break: break-all;
}

.overflow-wrap-anywhere {
  overflow-wrap: anywhere;
  word-wrap: break-word; /* 兼容旧浏览器 */
  -ms-word-break: break-all; /* 兼容IE */
  word-break: break-word; /* 更现代的属性，尽量在合适的位置换行 */
  hyphens: auto; /* 在必要时添加连字符 */
}

/* URL显示增强 */
.url-display {
  max-width: calc(100% - 80px); /* 为展开/收起按钮留出空间 */
  vertical-align: middle;
  transition: all 0.2s ease;
  padding: 0.125rem 0.25rem;
  background-color: rgba(0, 0, 0, 0.03);
  border-radius: 0.25rem;
  border-left: 2px solid rgba(59, 130, 246, 0.5);
  margin-left: 0.25rem;
}

.url-display:not(.whitespace-nowrap) {
  white-space: normal;
  word-break: break-all;
  max-height: 5rem;
  overflow-y: auto;
}

/* 暗黑模式下的URL样式 */
:deep(.dark .url-display) {
  background-color: rgba(255, 255, 255, 0.05);
  border-left-color: rgba(59, 130, 246, 0.7);
}

/* 连接信息项目样式 */
.connection-info-item {
  padding: 0.25rem 0;
  border-bottom: 1px dashed rgba(128, 128, 128, 0.2);
}

.connection-info-item:last-child {
  border-bottom: none;
}

/* 终端节点URL特殊样式 */
.endpoint-url {
  font-family: monospace;
  padding: 0.25rem 0.5rem;
  background-color: rgba(0, 0, 0, 0.03);
  border-radius: 0.25rem;
  margin-top: 0.125rem;
  border-left: 2px solid rgba(59, 130, 246, 0.5);
}

/* 暗黑模式下的终端节点样式 */
:deep(.dark .endpoint-url),
.dark .endpoint-url {
  background-color: rgba(255, 255, 255, 0.05);
  border-left-color: rgba(59, 130, 246, 0.7);
}

/* 确保连接信息模态框的宽度适合内容 */
.max-h-20 {
  max-height: 5rem;
}

.max-h-16 {
  max-height: 4rem;
}
</style>
