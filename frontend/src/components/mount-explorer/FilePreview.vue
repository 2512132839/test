<template>
  <div class="file-preview-container">
    <!-- 文件预览区域 -->
    <div class="file-preview mb-6 p-4 rounded-lg" :class="darkMode ? 'bg-gray-800/50' : 'bg-white'">
      <!-- 操作按钮 -->
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-medium" :class="darkMode ? 'text-gray-200' : 'text-gray-700'">{{ file.name }}</h3>
        <div class="flex space-x-2">
          <button
            @click="handleDownload"
            class="inline-flex items-center px-3 py-1.5 rounded-md transition-colors text-sm font-medium"
            :class="darkMode ? 'bg-primary-600 hover:bg-primary-700 text-white' : 'bg-primary-500 hover:bg-primary-600 text-white'"
          >
            <svg class="w-4 h-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>下载文件</span>
          </button>
        </div>
      </div>

      <!-- 文件信息 -->
      <div class="file-info grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-3 rounded-lg bg-opacity-50" :class="darkMode ? 'bg-gray-700/50' : 'bg-gray-100'">
        <div class="file-info-item flex items-center">
          <span class="font-medium mr-2" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">文件大小:</span>
          <span :class="darkMode ? 'text-gray-400' : 'text-gray-600'">{{ formatFileSize(file.size) }}</span>
        </div>
        <div class="file-info-item flex items-center">
          <span class="font-medium mr-2" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">修改时间:</span>
          <span :class="darkMode ? 'text-gray-400' : 'text-gray-600'">{{ formatDate(file.modified) }}</span>
        </div>
        <div class="file-info-item flex items-center">
          <span class="font-medium mr-2" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">文件类型:</span>
          <span :class="darkMode ? 'text-gray-400' : 'text-gray-600'">{{ file.contentType || "未知" }}</span>
        </div>
      </div>

      <!-- 预览内容 -->
      <div class="preview-content border rounded-lg overflow-hidden" :class="darkMode ? 'border-gray-700' : 'border-gray-200'">
        <!-- 加载指示器 -->
        <div v-if="isLoading" class="flex flex-col items-center justify-center p-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2" :class="darkMode ? 'border-primary-500' : 'border-primary-600'"></div>
        </div>

        <!-- 图片预览 -->
        <div v-else-if="isImage" class="image-preview flex justify-center items-center p-4">
          <img
            v-if="authenticatedPreviewUrl"
            :src="authenticatedPreviewUrl"
            :alt="file.name"
            class="max-w-full max-h-[500px] object-contain"
            @load="handleContentLoaded"
            @error="handleContentError"
          />
          <div v-else class="loading-indicator text-center py-8">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto" :class="darkMode ? 'border-primary-500' : 'border-primary-600'"></div>
          </div>
        </div>

        <!-- 视频预览 -->
        <div v-else-if="isVideo" class="video-preview p-4">
          <video v-if="authenticatedPreviewUrl" controls class="max-w-full mx-auto max-h-[500px]" @loadeddata="handleContentLoaded" @error="handleContentError">
            <source :src="authenticatedPreviewUrl" :type="file.contentType" />
            您的浏览器不支持视频标签
          </video>
          <div v-else class="loading-indicator text-center py-8">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto" :class="darkMode ? 'border-primary-500' : 'border-primary-600'"></div>
          </div>
        </div>

        <!-- 音频预览 -->
        <div v-else-if="isAudio" class="audio-preview p-4">
          <audio v-if="authenticatedPreviewUrl" controls class="w-full" @loadeddata="handleContentLoaded" @error="handleContentError">
            <source :src="authenticatedPreviewUrl" :type="file.contentType" />
            您的浏览器不支持音频标签
          </audio>
          <div v-else class="loading-indicator text-center py-8">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto" :class="darkMode ? 'border-primary-500' : 'border-primary-600'"></div>
          </div>
        </div>

        <!-- PDF预览 -->
        <div v-else-if="isPdf" class="pdf-preview h-[500px]">
          <iframe
            v-if="authenticatedPreviewUrl"
            :src="authenticatedPreviewUrl"
            frameborder="0"
            class="w-full h-full"
            @load="handleContentLoaded"
            @error="handleContentError"
          ></iframe>
          <div v-else class="loading-indicator text-center py-8">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto" :class="darkMode ? 'border-primary-500' : 'border-primary-600'"></div>
          </div>
        </div>

        <!-- 文本预览 -->
        <div v-else-if="isText" class="text-preview p-4 overflow-auto max-h-[500px]">
          <p v-if="textContent" class="whitespace-pre-wrap" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">{{ textContent }}</p>
        </div>

        <!-- 其他文件类型或错误状态 -->
        <div v-else-if="loadError" class="generic-preview text-center py-12">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-20 w-20 mx-auto mb-4"
            :class="darkMode ? 'text-red-400' : 'text-red-500'"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p class="text-lg font-medium mb-2" :class="darkMode ? 'text-red-300' : 'text-red-700'">加载文件预览失败</p>
          <p class="text-sm" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">请尝试重新加载或下载文件查看</p>
        </div>

        <!-- 不支持预览的文件类型 -->
        <div v-else class="generic-preview text-center py-12">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-20 w-20 mx-auto mb-4"
            :class="darkMode ? 'text-gray-500' : 'text-gray-400'"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          <p class="text-lg font-medium mb-2" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">文件无法预览</p>
          <p class="text-sm" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">当前文件类型不支持在线预览，请点击下载按钮下载查看</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onUnmounted } from "vue";
import { api } from "../../api";
import { getAuthHeaders, createAuthenticatedPreviewUrl } from "../../utils/fileUtils";

const props = defineProps({
  file: {
    type: Object,
    required: true,
  },
  darkMode: {
    type: Boolean,
    default: false,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["download", "loaded", "error"]);

// 文本内容（用于文本文件预览）
const textContent = ref("");
// 加载错误状态
const loadError = ref(false);
// 认证预览URL
const authenticatedPreviewUrl = ref(null);

// 生成原始预览URL (仅用于构建最终URL, 不直接使用)
const previewUrl = computed(() => {
  return props.isAdmin ? api.fs.getAdminFilePreviewUrl(props.file.path) : api.fs.getUserFilePreviewUrl(props.file.path);
});

// 文件类型判断
const isImage = computed(() => {
  const contentType = props.file.contentType || "";
  return contentType.startsWith("image/");
});

const isVideo = computed(() => {
  const contentType = props.file.contentType || "";
  return contentType.startsWith("video/");
});

const isAudio = computed(() => {
  const contentType = props.file.contentType || "";
  return contentType.startsWith("audio/");
});

const isPdf = computed(() => {
  const contentType = props.file.contentType || "";
  return contentType === "application/pdf";
});

const isText = computed(() => {
  const contentType = props.file.contentType || "";
  return (
    contentType.startsWith("text/") ||
    contentType === "application/json" ||
    contentType === "application/xml" ||
    contentType === "application/javascript" ||
    contentType === "application/typescript"
  );
});

// 获取认证预览URL
const fetchAuthenticatedUrl = async () => {
  try {
    authenticatedPreviewUrl.value = await createAuthenticatedPreviewUrl(previewUrl.value);
  } catch (error) {
    console.error("获取认证预览URL失败:", error);
    loadError.value = true;
    emit("error");
  }
};

// 加载文本内容（仅对文本文件）
const loadTextContent = async () => {
  if (isText.value) {
    try {
      console.log("加载文本内容，URL:", previewUrl.value);
      // 使用预览URL并添加认证头信息
      const response = await fetch(previewUrl.value, {
        headers: getAuthHeaders(),
        mode: "cors", // 明确设置跨域模式
        credentials: "include", // 包含凭证（cookies等）
      });

      if (response.ok) {
        textContent.value = await response.text();
        handleContentLoaded();
      } else {
        textContent.value = "无法加载文本内容";
        handleContentError();
      }
    } catch (error) {
      console.error("加载文本内容错误:", error);
      textContent.value = "加载文本内容时出错";
      handleContentError();
    }
  }
};

// 监听文件变更，重置状态
watch(
  () => props.file,
  () => {
    textContent.value = "";
    loadError.value = false;
    authenticatedPreviewUrl.value = null;

    // 如果文件是图片、视频、音频或PDF类型，则获取认证预览URL
    if (isImage.value || isVideo.value || isAudio.value || isPdf.value) {
      fetchAuthenticatedUrl();
    }

    // 对于文本文件，需要手动加载内容
    if (isText.value) {
      loadTextContent();
    }
  },
  { immediate: true }
);

// 内容加载成功处理
const handleContentLoaded = () => {
  loadError.value = false;
  emit("loaded");
};

// 内容加载错误处理
const handleContentError = () => {
  loadError.value = true;
  emit("error");
};

// 处理下载按钮点击
const handleDownload = () => {
  emit("download", props.file);
};

/**
 * 格式化文件大小
 * @param {number} bytes - 文件大小（字节）
 * @returns {string} 格式化后的文件大小
 */
const formatFileSize = (bytes) => {
  if (bytes === 0 || bytes === undefined) return "0 B";

  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + " " + sizes[i];
};

/**
 * 格式化日期
 * @param {string} dateString - ISO格式的日期字符串
 * @returns {string} 格式化后的日期字符串
 */
const formatDate = (dateString) => {
  if (!dateString) return "";

  const date = new Date(dateString);

  // 判断是否为有效日期
  if (isNaN(date.getTime())) return "";

  // 格式化为 YYYY-MM-DD HH:MM
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

// 组件挂载时加载文本内容
onMounted(() => {
  if (isText.value) {
    loadTextContent();
  }
});

// 组件卸载时清理blobURL
onUnmounted(() => {
  if (authenticatedPreviewUrl.value) {
    URL.revokeObjectURL(authenticatedPreviewUrl.value);
  }
});
</script>
