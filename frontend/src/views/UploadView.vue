<template>
  <div class="file-upload-container mx-auto px-3 sm:px-6 flex-1 flex flex-col pt-6 sm:pt-8 w-full max-w-full sm:max-w-6xl">
    <div class="header mb-4 border-b pb-2" :class="darkMode ? 'border-gray-700' : 'border-gray-200'">
      <h2 class="text-xl font-semibold">{{ t("file.uploadPageTitle") }}</h2>
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
          {{ t("file.permissionRequired") }}
          <a href="#" @click.prevent="navigateToAdmin" class="font-medium underline">{{ t("file.loginOrAuth") }}</a
          >。
        </span>
      </div>
    </div>

    <div class="main-content" v-if="hasPermission">
      <!-- 文件上传区域 -->
      <div class="card mb-6" :class="darkMode ? 'bg-gray-800/50' : 'bg-white'">
        <FileUploader
          :dark-mode="darkMode"
          :s3-configs="s3Configs"
          :loading="loadingConfigs"
          :is-admin="isAdmin"
          @upload-success="handleUploadSuccess"
          @upload-error="handleUploadError"
        />
      </div>

      <!-- 错误消息 -->
      <div
        v-if="message"
        class="mb-4 p-3 rounded-md"
        :class="
          message.type === 'success'
            ? darkMode
              ? 'bg-green-900/40 border border-green-800 text-green-200'
              : 'bg-green-50 border border-green-200 text-green-800'
            : message.type === 'warning'
            ? darkMode
              ? 'bg-yellow-900/40 border border-yellow-800 text-yellow-200'
              : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
            : darkMode
            ? 'bg-red-900/40 border border-red-800 text-red-200'
            : 'bg-red-50 border border-red-200 text-red-800'
        "
      >
        <div class="flex items-center">
          <!-- 成功图标 -->
          <svg v-if="message.type === 'success'" class="h-5 w-5 mr-2" :class="darkMode ? 'text-green-300' : 'text-green-500'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>

          <!-- 存储容量不足图标 -->
          <svg
            v-else-if="message.icon === 'storage-full'"
            class="h-5 w-5 mr-2"
            :class="darkMode ? 'text-yellow-300' : 'text-yellow-500'"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12V8a2 2 0 00-2-2H6a2 2 0 00-2 2v4M8 18h8M12 6v5m-2 3h4" />
          </svg>

          <!-- 普通警告图标 -->
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
      </div>

      <!-- 最近上传记录 -->
      <div v-if="recentFiles.length > 0" class="card" :class="darkMode ? 'bg-gray-800/50' : 'bg-white'">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-medium">{{ t("file.recentUploads") }}</h3>
          <span class="text-sm" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ t("file.showingRecent") }}</span>
        </div>
        <FileList :dark-mode="darkMode" :files="recentFiles" :loading="loadingFiles" :user-type="isAdmin ? 'admin' : 'apikey'" @refresh="loadFiles" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, onBeforeUnmount } from "vue";
import { api } from "../api";
import FileUploader from "../components/file-upload/FileUploader.vue";
import FileList from "../components/file-upload/FileList.vue";
import { useI18n } from "vue-i18n"; // 导入i18n
import { useAuthStore } from "../stores/authStore.js";

const { t } = useI18n(); // 初始化i18n

// 使用认证Store
const authStore = useAuthStore();

const props = defineProps({
  darkMode: {
    type: Boolean,
    default: false,
  },
});

// 数据状态
const s3Configs = ref([]);
const files = ref([]);
const loadingConfigs = ref(false);
const loadingFiles = ref(false);
const message = ref(null);

// 从Store获取权限状态的计算属性
const isAdmin = computed(() => authStore.isAdmin);
const hasApiKey = computed(() => authStore.authType === "apikey" && !!authStore.apiKey);
const hasFilePermission = computed(() => authStore.hasFilePermission);
const hasPermission = computed(() => authStore.hasFilePermission);

// 计算最近3条记录
const recentFiles = computed(() => {
  return files.value.slice(0, 3);
});

// API密钥验证逻辑已移至认证Store

// 导航到管理页面
const navigateToAdmin = () => {
  // 使用 Vue Router 进行导航
  import("../router").then(({ routerUtils }) => {
    routerUtils.navigateTo("admin");
  });
};

// 检查权限（简化版，主要用于日志记录）
const checkPermissions = async () => {
  try {
    // 如果需要重新验证，则进行验证
    if (authStore.needsRevalidation) {
      console.log("FileUpload: 需要重新验证认证状态");
      await authStore.validateAuth();
    }

    console.log("FileUpload: 用户文件上传权限:", hasPermission.value ? "有权限" : "无权限");
  } catch (error) {
    console.error("检查权限失败:", error);
  }
};

// 事件处理函数
const handleAuthStateChange = async (e) => {
  console.log("FileUpload: 接收到认证状态变化事件:", e.detail);
  // 权限状态会自动更新，这里只需要重新加载数据
  if (hasPermission.value) {
    await Promise.all([loadS3Configs(), loadFiles()]);
  }
};

// 加载S3配置
const loadS3Configs = async () => {
  if (!hasPermission.value) return;

  loadingConfigs.value = true;
  try {
    const response = await api.file.getS3Configs();
    if (response.success && response.data) {
      s3Configs.value = response.data;
    }
  } catch (error) {
    console.error("加载S3配置失败:", error);
  } finally {
    loadingConfigs.value = false;
  }
};

// 加载已上传文件列表
const loadFiles = async () => {
  if (!hasPermission.value) return;

  loadingFiles.value = true;
  try {
    // 使用统一的API
    const response = await api.file.getFiles();

    if (response.success && response.data) {
      // 确保按时间倒序排序，最新的在前面
      files.value = (response.data.files || []).sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
      });
    }
  } catch (error) {
    console.error("加载文件列表失败:", error);
    // 显示错误消息，但不清除权限
    message.value = {
      type: "error",
      content: `${t("file.messages.getFileDetailFailed")}: ${error.message || t("file.messages.unknownError")}`,
    };

    // 4秒后清除消息
    setTimeout(() => {
      message.value = null;
    }, 4000);
  } finally {
    loadingFiles.value = false;
  }
};

// 处理上传成功事件
const handleUploadSuccess = (fileData) => {
  // 刷新文件列表
  loadFiles();

  // 显示成功消息
  message.value = {
    type: "success",
    content: t("file.uploadSuccessful"),
  };

  // 4秒后清除消息
  setTimeout(() => {
    message.value = null;
  }, 4000);
};

// 处理上传错误事件
const handleUploadError = (error) => {
  // 检查错误消息是否与存储容量相关
  if (
    error &&
    error.message &&
    (error.message.includes("存储空间不足") || error.message.includes("insufficient storage") || error.message.includes("容量") || error.message.includes("storage limit"))
  ) {
    // 存储容量不足错误，使用特殊样式
    message.value = {
      type: "warning", // 使用警告类型
      content: `${error.message}`,
      icon: "storage-full", // 自定义图标标识
    };
  } else {
    // 其他类型的错误
    message.value = {
      type: "error",
      content: error.message || t("file.messages.unknownError"),
    };
  }

  // 6秒后清除消息（给用户更多时间阅读错误信息）
  setTimeout(() => {
    message.value = null;
  }, 6000);
};

// 组件挂载时初始化
onMounted(async () => {
  console.log("FileUpload组件已挂载");

  // 监听认证状态变化事件
  window.addEventListener("auth-state-changed", handleAuthStateChange);

  await checkPermissions();
  console.log(`FileUpload权限检查结果: isAdmin=${isAdmin.value}, hasApiKey=${hasApiKey.value}, hasFilePermission=${hasFilePermission.value}`);
  console.log(`hasPermission计算结果: ${hasPermission.value}`);

  if (hasPermission.value) {
    console.log("用户有权限，开始加载配置和文件列表");
    await Promise.all([loadS3Configs(), loadFiles()]);
  } else {
    console.log("用户无权限访问文件上传功能");
  }
});

// 组件卸载时清理
onBeforeUnmount(() => {
  // 移除认证状态变化事件监听
  window.removeEventListener("auth-state-changed", handleAuthStateChange);
});
</script>

<style scoped>
.card {
  @apply rounded-lg shadow-sm p-4 sm:p-6 mb-4;
}

/* 响应式设计 */
@media (max-width: 640px) {
  .file-upload-container {
    padding-top: 1rem;
  }

  .card {
    padding: 1rem;
    margin-bottom: 1rem;
  }
}
</style>
