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
import FileUploader from "./file-upload/FileUploader.vue";
import FileList from "./file-upload/FileList.vue";
import { useI18n } from "vue-i18n"; // 导入i18n

const { t } = useI18n(); // 初始化i18n

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

// 权限状态
const isAdmin = ref(false);
const hasApiKey = ref(false);
const hasFilePermission = ref(false);
const hasPermission = computed(() => isAdmin.value || (hasApiKey.value && hasFilePermission.value));

// 计算最近3条记录
const recentFiles = computed(() => {
  return files.value.slice(0, 3);
});

// API密钥验证函数的防抖定时器
let apiKeyValidationTimer = null;
let lastValidatedApiKey = null;
let lastValidationTime = 0;
const VALIDATION_DEBOUNCE_TIME = 2000; // 2秒内不重复验证相同的密钥

// 验证API密钥权限（向后端发送请求进行实时验证）
const validateApiKey = async (apiKey) => {
  // 如果是相同的密钥且在短时间内验证过，直接返回上次的验证结果
  const now = Date.now();
  if (apiKey === lastValidatedApiKey && now - lastValidationTime < VALIDATION_DEBOUNCE_TIME) {
    console.log("使用缓存的API密钥验证结果，距上次验证时间:", Math.floor((now - lastValidationTime) / 1000), "秒");
    return hasFilePermission.value;
  }

  // 取消可能存在的验证定时器
  if (apiKeyValidationTimer) {
    clearTimeout(apiKeyValidationTimer);
  }

  // 创建防抖执行验证的Promise
  return new Promise((resolve, reject) => {
    apiKeyValidationTimer = setTimeout(async () => {
      try {
        // 导入API配置函数
        const { getFullApiUrl } = await import("../api/config.js");
        // 使用正确的API路径构建URL
        const apiUrl = getFullApiUrl("test/api-key");

        console.log("正在验证API密钥:", apiKey.substring(0, 3) + "..." + apiKey.substring(apiKey.length - 3));

        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            Authorization: `ApiKey ${apiKey}`,
            "Content-Type": "application/json",
          },
          credentials: "omit",
        });

        if (!response.ok) {
          throw new Error(`API密钥验证失败 (${response.status})`);
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("服务器返回了无效的响应格式");
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message || "密钥验证失败");
        }

        // 记录本次验证的密钥和时间
        lastValidatedApiKey = apiKey;
        lastValidationTime = Date.now();

        // 更新本地缓存中的权限信息
        if (data.data && data.data.permissions) {
          const permissions = data.data.permissions;
          localStorage.setItem("api_key_permissions", JSON.stringify(permissions));

          // 更新权限状态
          const filePermission = !!permissions.file;
          hasFilePermission.value = filePermission;

          // 触发自定义事件，通知其他组件权限已更新
          window.dispatchEvent(
              new CustomEvent("api-key-permissions-updated", {
                detail: { permissions },
              })
          );

          console.log("API密钥验证成功，文件权限:", filePermission ? "有权限" : "无权限");

          // 解析Promise并返回权限状态
          resolve(filePermission);
          return;
        }

        // 如果没有权限数据，视为无权限
        resolve(false);
      } catch (error) {
        console.error("API密钥验证出错:", error);
        reject(error);
      } finally {
        apiKeyValidationTimer = null;
      }
    }, 50); // 短暂延迟，合并多个快速调用
  });
};

// 导航到管理页面
const navigateToAdmin = () => {
  // 使用 Vue Router 进行导航
  import("../router").then(({ routerUtils }) => {
    routerUtils.navigateTo("admin");
  });
};

// 检查权限
const checkPermissions = async () => {
  try {
    // 检查管理员登录状态
    const adminToken = localStorage.getItem("admin_token");
    isAdmin.value = !!adminToken;

    if (isAdmin.value) {
      console.log("用户具有管理员权限");
      hasPermission.value = true;
      return;
    }

    // 检查API密钥和权限
    const apiKey = localStorage.getItem("api_key");
    hasApiKey.value = !!apiKey;

    if (hasApiKey.value) {
      console.log("用户具有API密钥:", apiKey.substring(0, 3) + "..." + apiKey.substring(apiKey.length - 3));

      // 首先从后端验证API密钥权限（实时验证）
      try {
        const hasFilePerm = await validateApiKey(apiKey);
        hasFilePermission.value = hasFilePerm;
        console.log("API密钥文件权限(后端验证):", hasFilePermission.value ? "有权限" : "无权限");
      } catch (error) {
        console.error("API密钥验证失败:", error);

        // 验证失败时，尝试回退到本地缓存
        console.warn("后端验证失败，尝试使用本地缓存的权限信息");
        const permissionsStr = localStorage.getItem("api_key_permissions");
        if (permissionsStr) {
          try {
            const permissions = JSON.parse(permissionsStr);
            hasFilePermission.value = !!permissions.file;
            console.log("API密钥文件权限(本地缓存):", hasFilePermission.value ? "有权限" : "无权限");
          } catch (e) {
            console.error("解析权限数据失败:", e);
            hasFilePermission.value = false;
          }
        } else {
          console.warn("未找到API密钥权限信息");
          hasFilePermission.value = false;
        }
      }
    } else {
      hasFilePermission.value = false;
    }

    // 综合判断是否有文件权限
    hasPermission.value = isAdmin.value || (hasApiKey.value && hasFilePermission.value);
    console.log("用户文件上传权限:", hasPermission.value ? "有权限" : "无权限");
  } catch (error) {
    console.error("检查权限失败:", error);
  }
};

// 事件处理函数
const handleApiKeyPermissionsUpdate = async (e) => {
  console.log("接收到API密钥权限更新事件:", e.detail);
  await checkPermissions();
};

const handleStorageChange = async (e) => {
  if (e.key === "admin_token" || e.key === "api_key" || e.key === "api_key_permissions") {
    console.log("检测到存储变化，更新权限状态:", e.key);
    await checkPermissions();
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
    // 根据用户类型调用不同的API
    const response = isAdmin.value ? await api.file.getFiles() : await api.file.getUserFiles();

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

  // 打印当前token状态
  const adminToken = localStorage.getItem("admin_token");
  const apiKey = localStorage.getItem("api_key");
  console.log(`初始权限状态: adminToken=${adminToken ? "存在" : "不存在"}, apiKey=${apiKey ? "存在" : "不存在"}`);

  // 监听storage事件，以便在其他标签页中登录/登出时更新状态
  window.addEventListener("storage", handleStorageChange);

  // 监听API密钥权限更新事件
  window.addEventListener("api-key-permissions-updated", handleApiKeyPermissionsUpdate);

  await checkPermissions();
  console.log(`权限检查结果: isAdmin=${isAdmin.value}, hasApiKey=${hasApiKey.value}, hasFilePermission=${hasFilePermission.value}`);
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
  // 移除storage事件监听
  window.removeEventListener("storage", handleStorageChange);

  // 移除API密钥权限更新事件监听
  window.removeEventListener("api-key-permissions-updated", handleApiKeyPermissionsUpdate);

  // 取消可能存在的验证定时器
  if (apiKeyValidationTimer) {
    clearTimeout(apiKeyValidationTimer);
    apiKeyValidationTimer = null;
  }
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
