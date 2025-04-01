<template>
  <div class="p-4 flex-1 flex flex-col">
    <!-- 顶部操作栏 -->
    <div class="flex flex-col sm:flex-row sm:justify-between mb-4">
      <div class="mb-2 sm:mb-0">
        <h2 class="text-lg font-medium" :class="darkMode ? 'text-white' : 'text-gray-900'">文件管理</h2>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
            @click="loadFiles"
            class="px-3 py-1.5 rounded text-sm font-medium transition-colors"
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
        <button
            @click="deleteSelectedFiles"
            :disabled="selectedFiles.length === 0"
            class="px-3 py-1.5 rounded text-sm font-medium transition-colors"
            :class="
            darkMode
              ? selectedFiles.length === 0
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 text-white'
              : selectedFiles.length === 0
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-red-500 hover:bg-red-600 text-white'
          "
        >
          <span class="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            批量删除 {{ selectedFiles.length ? `(${selectedFiles.length})` : "" }}
          </span>
        </button>
      </div>
    </div>

    <!-- 错误和成功消息提示 -->
    <div v-if="error" class="mb-4 p-3 bg-red-100 text-red-600 rounded">
      <p>{{ error }}</p>
    </div>
    <div v-if="successMessage" class="mb-4 p-3 bg-green-100 text-green-600 rounded">
      <p>{{ successMessage }}</p>
    </div>

    <!-- 上次刷新时间显示 -->
    <div class="flex justify-between items-center mb-2 sm:mb-3" v-if="lastRefreshTime">
      <div class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
        <span class="inline-flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 sm:h-4 sm:w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          上次刷新: {{ lastRefreshTime }}
        </span>
      </div>
    </div>

    <!-- 加载中指示器 -->
    <div v-if="loading" class="flex justify-center my-8">
      <svg class="animate-spin h-8 w-8" :class="darkMode ? 'text-blue-400' : 'text-blue-500'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>

    <!-- 文件列表 -->
    <div v-if="!loading" class="flex-1">
      <FileTable
          :files="files"
          :dark-mode="darkMode"
          :selected-files="selectedFiles"
          :user-type="props.userType"
          @toggle-select="toggleSelectItem"
          @toggle-select-all="toggleSelectAll"
          @edit="openEditModal"
          @preview="openPreviewModal"
          @delete="handleFileDelete"
          @generate-qr="generateQRCode"
      />
    </div>

    <!-- 分页组件 -->
    <div class="mt-2 mb-4 sm:mt-4 sm:mb-0">
      <CommonPagination :dark-mode="darkMode" :pagination="pagination" mode="offset" @offset-changed="handleOffsetChange" />
    </div>

    <!-- 编辑文件元数据弹窗 -->
    <FileEditModal v-if="showEdit" :file="editingFile" :dark-mode="darkMode" @close="showEdit = false" @save="updateFileMetadata" />

    <!-- 文件预览弹窗 -->
    <FilePreviewModal v-if="showPreview" :file="previewFile" :dark-mode="darkMode" @close="showPreview = false" />

    <!-- 二维码弹窗 -->
    <QRCodeModal v-if="showQRCodeModal" :qr-code-url="qrCodeDataURL" :file-slug="qrCodeSlug" :dark-mode="darkMode" @close="showQRCodeModal = false" />
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from "vue";
import QRCode from "qrcode";
import { getFiles, getFile, updateFile, deleteFile as adminDeleteFile, getUserFiles, getUserFile, updateUserFile, deleteUserFile as apiKeyDeleteFile } from "../../api/fileService";

// 导入子组件
import FileTable from "./files-management/FileTable.vue";
import CommonPagination from "../common/CommonPagination.vue";
import FileEditModal from "./files-management/FileEditModal.vue";
import FilePreviewModal from "./files-management/FilePreviewModal.vue";
import QRCodeModal from "./files-management/QRCodeModal.vue";

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
const isAdmin = () => props.userType === "admin";
const isApiKeyUser = () => props.userType === "apikey";

// 根据用户类型选择适当的API函数
const apiGetFiles = (limit, offset) => (isAdmin() ? getFiles(limit, offset) : getUserFiles(limit, offset));

const apiGetFile = (id) => (isAdmin() ? getFile(id) : getUserFile(id));

const apiUpdateFile = (id, metadata) => (isAdmin() ? updateFile(id, metadata) : updateUserFile(id, metadata));

const apiDeleteFile = (id) => (isAdmin() ? adminDeleteFile(id) : apiKeyDeleteFile(id));

/**
 * 状态变量定义
 * loading: 数据加载状态
 * error: 错误信息
 * successMessage: 成功消息提示
 * files: 文件数据列表
 * pagination: 分页信息对象
 */
const loading = ref(false);
const error = ref("");
const successMessage = ref("");
const files = ref([]);
const pagination = reactive({
  offset: 0,
  limit: 8,
  total: 0,
  hasMore: false,
});

// 选中项管理
const selectedFiles = ref([]);

/**
 * 选中/取消选中所有项
 * 如果当前已全选，则取消全选；否则全选
 */
const toggleSelectAll = () => {
  if (selectedFiles.value.length === files.value.length) {
    selectedFiles.value = [];
  } else {
    selectedFiles.value = files.value.map((file) => file.id);
  }
};

/**
 * 切换单个项的选中状态
 * @param {string|number} id - 文件的ID
 */
const toggleSelectItem = (id) => {
  const index = selectedFiles.value.indexOf(id);
  if (index === -1) {
    selectedFiles.value.push(id);
  } else {
    selectedFiles.value.splice(index, 1);
  }
};

// 预览弹窗相关状态
const showPreview = ref(false);
const previewFile = ref(null);

// 修改弹窗相关状态
const showEdit = ref(false);
const editingFile = ref(null);

// 最后刷新时间记录
const lastRefreshTime = ref("");

// 添加二维码相关状态变量
const showQRCodeModal = ref(false);
const qrCodeDataURL = ref("");
const qrCodeSlug = ref("");

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

// 更新分页信息
const updatePagination = (data) => {
  if (data?.pagination) {
    pagination.total = data.pagination.total;
    pagination.hasMore = data.pagination.hasMore;
  }
};

/**
 * 处理偏移量变化
 * @param {number} newOffset - 新的偏移量
 */
const handleOffsetChange = (newOffset) => {
  pagination.offset = newOffset;
  loadFiles();
};

/**
 * 加载文件列表数据
 * 从API获取文件列表数据，支持分页
 */
const loadFiles = async () => {
  loading.value = true;
  error.value = "";
  successMessage.value = "";

  try {
    const response = await apiGetFiles(pagination.limit, pagination.offset);

    if (response.success) {
      console.log("🔍 response.data:", response.data);

      // 检查response.data是否有files字段
      if (response.data && Array.isArray(response.data.files)) {
        files.value = response.data.files;
      } else if (Array.isArray(response.data)) {
        // 兼容直接返回数组的情况
        files.value = response.data;
      } else {
        console.error("❌ 无效的文件列表数据格式:", response.data);
        files.value = [];
      }

      // 更新分页信息
      updatePagination(response.data);
      // 更新最后刷新时间
      updateLastRefreshTime();
    } else {
      error.value = response.message || "加载数据失败";
      files.value = [];
    }
  } catch (err) {
    console.error("加载文件列表失败:", err);
    error.value = err.message || "加载失败，请重试";
    files.value = [];
  } finally {
    loading.value = false;
  }
};

/**
 * 删除单个文件
 * @param {string|number} id - 要删除的文件ID
 */
const handleFileDelete = async (id) => {
  if (!confirm("确定要删除此文件吗？此操作不可恢复。")) {
    return;
  }

  try {
    // 清空之前的消息
    error.value = "";
    successMessage.value = "";

    // 调用API删除文件
    const response = await apiDeleteFile(id);

    if (response.success) {
      // 重新加载数据
      loadFiles();
      // 显示成功消息
      successMessage.value = "删除成功";
      setTimeout(() => {
        successMessage.value = "";
      }, 4000);
    } else {
      error.value = response.message || "删除失败";
    }
  } catch (err) {
    console.error("删除失败:", err);
    error.value = err.message || "删除失败，请重试";
  }
};

/**
 * 批量删除选中的文件
 * 删除所有已选中的文件
 */
const deleteSelectedFiles = async () => {
  if (selectedFiles.value.length === 0) {
    alert("请先选择需要删除的文件");
    return;
  }

  const selectedCount = selectedFiles.value.length;

  if (!confirm(`确定要删除选中的 ${selectedCount} 个文件吗？此操作不可恢复。`)) {
    return;
  }

  try {
    // 清空之前的消息
    error.value = "";
    successMessage.value = "";

    // 逐个删除选中的文件
    const promises = selectedFiles.value.map((id) => apiDeleteFile(id));
    await Promise.all(promises);

    // 清空选中列表
    selectedFiles.value = [];
    // 重新加载数据
    loadFiles();

    // 显示成功消息
    successMessage.value = `成功删除${selectedCount}个文件`;
    setTimeout(() => {
      successMessage.value = "";
    }, 4000);
  } catch (err) {
    console.error("批量删除失败:", err);
    error.value = err.message || "批量删除失败，请重试";
  }
};

/**
 * 打开编辑文件元数据的弹窗
 * @param {object} file - 要编辑的文件对象
 */
const openEditModal = async (file) => {
  try {
    // 加载完整的文件详情
    const response = await apiGetFile(file.id);

    if (response.success) {
      editingFile.value = response.data;
      showEdit.value = true;
    } else {
      error.value = response.message || "获取文件详情失败";
    }
  } catch (err) {
    console.error("获取文件详情失败:", err);
    error.value = err.message || "获取文件详情失败，请重试";
  }
};

/**
 * 更新文件元数据
 * @param {object} fileData - 文件更新数据
 */
const updateFileMetadata = async (fileData) => {
  try {
    // 清空之前的消息
    error.value = "";
    successMessage.value = "";

    // 调用API更新文件元数据
    const response = await apiUpdateFile(fileData.id, {
      remark: fileData.remark,
      slug: fileData.slug,
      expires_at: fileData.expires_at,
      max_views: fileData.max_views,
      password: fileData.password,
      use_proxy: fileData.use_proxy,
    });

    if (response.success) {
      // 关闭编辑弹窗
      showEdit.value = false;
      // 重新加载数据
      loadFiles();
      // 显示成功消息
      successMessage.value = "文件元数据更新成功";
      setTimeout(() => {
        successMessage.value = "";
      }, 4000);
    } else {
      error.value = response.message || "更新失败";
    }
  } catch (err) {
    console.error("更新文件元数据失败:", err);
    error.value = err.message || "更新失败，请重试";
  }
};

/**
 * 打开文件预览弹窗
 * @param {object} file - 要预览的文件对象
 */
const openPreviewModal = async (file) => {
  try {
    // 加载完整的文件详情
    const response = await apiGetFile(file.id);

    if (response.success) {
      previewFile.value = response.data;
      showPreview.value = true;
    } else {
      error.value = response.message || "获取文件详情失败";
    }
  } catch (err) {
    console.error("获取文件详情失败:", err);
    error.value = err.message || "获取文件详情失败，请重试";
  }
};

/**
 * 生成文件分享二维码
 * @param {object} file - 文件对象
 */
const generateQRCode = async (file) => {
  try {
    // 构建完整的文件URL
    const baseUrl = window.location.origin;
    const fileUrl = `${baseUrl}/file/${file.slug}`;

    // 生成二维码
    qrCodeDataURL.value = await QRCode.toDataURL(fileUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: props.darkMode ? "#ffffff" : "#000000",
        light: props.darkMode ? "#000000" : "#ffffff",
      },
    });

    qrCodeSlug.value = file.slug;
    showQRCodeModal.value = true;
  } catch (err) {
    console.error("生成二维码失败:", err);
    error.value = "生成二维码失败";
  }
};

// 组件挂载时加载文件列表
onMounted(loadFiles);
</script>
