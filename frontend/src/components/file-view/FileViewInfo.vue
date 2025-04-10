<template>
  <div class="file-info-container">
    <!-- 文件头部信息 -->
    <div class="file-header mb-6">
      <div class="flex items-center gap-3">
        <!-- 文件图标 -->
        <div class="file-icon flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" :class="iconClass" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
        </div>

        <!-- 文件名和类型 -->
        <div class="flex-1 min-w-0">
          <h1 class="text-xl font-bold truncate text-gray-900 dark:text-white">
            {{ fileInfo.filename }}
          </h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ formattedMimeType }} · {{ formattedSize }}</p>
        </div>
      </div>
    </div>

    <!-- 文件备注 -->
    <div v-if="fileInfo.remark" class="file-remark mb-6 px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-700">
      <p class="text-blue-600 dark:text-blue-400">{{ fileInfo.remark }}</p>
    </div>

    <!-- 文件预览区域 -->
    <div v-if="fileUrls.previewUrl" class="file-preview mb-6">
      <!-- 图片预览 -->
      <div v-if="isImage" class="image-preview rounded-lg overflow-hidden mb-2">
        <img :src="processedPreviewUrl" :alt="fileInfo.filename" class="max-w-full h-auto mx-auto" />
      </div>

      <!-- 视频预览 -->
      <div v-else-if="isVideo" class="video-preview rounded-lg overflow-hidden mb-2">
        <video controls class="max-w-full mx-auto">
          <source :src="processedPreviewUrl" :type="fileInfo.mimetype" />
          您的浏览器不支持视频标签
        </video>
      </div>

      <!-- 音频预览 -->
      <div v-else-if="isAudio" class="audio-preview rounded-lg p-4 mb-2 bg-gray-100 dark:bg-gray-700">
        <audio controls class="w-full">
          <source :src="processedPreviewUrl" :type="fileInfo.mimetype" />
          您的浏览器不支持音频标签
        </audio>
      </div>

      <!-- PDF预览 -->
      <div v-else-if="isPdf" class="pdf-preview rounded-lg overflow-hidden mb-2 h-[500px]">
        <iframe :src="processedPreviewUrl" frameborder="0" class="w-full h-full"></iframe>
      </div>

      <!-- 其他文件类型 -->
      <div v-else class="generic-preview text-center py-6">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-3" :class="iconClass" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        <p class="text-gray-600 dark:text-gray-300">此文件类型不支持在线预览</p>
      </div>
    </div>

    <!-- 文件元数据 -->
    <div class="file-metadata grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
      <!-- 创建时间 -->
      <div class="metadata-item p-3 rounded-lg bg-gray-100 dark:bg-gray-700">
        <div class="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span class="text-sm font-medium text-gray-600 dark:text-gray-200">创建时间</span>
        </div>
        <p class="mt-1 text-sm pl-7 text-gray-800 dark:text-white">{{ formattedCreatedAt }}</p>
      </div>

      <!-- 访问次数 -->
      <div class="metadata-item p-3 rounded-lg bg-gray-100 dark:bg-gray-700">
        <div class="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
          <span class="text-sm font-medium text-gray-600 dark:text-gray-200">访问次数</span>
        </div>
        <p class="mt-1 text-sm pl-7 text-gray-800 dark:text-white">
          {{ fileInfo.views || 0 }}
          <span v-if="fileInfo.max_views" class="text-xs text-gray-500 dark:text-gray-400"> / {{ fileInfo.max_views }} (限制) </span>
        </p>
      </div>

      <!-- 过期时间 -->
      <div v-if="fileInfo.expires_at" class="metadata-item p-3 rounded-lg bg-gray-100 dark:bg-gray-700">
        <div class="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-sm font-medium text-gray-600 dark:text-gray-200">过期时间</span>
        </div>
        <p class="mt-1 text-sm pl-7 text-gray-800 dark:text-white">{{ formattedExpiresAt }}</p>
      </div>

      <!-- 访问模式 -->
      <div class="metadata-item p-3 rounded-lg bg-gray-100 dark:bg-gray-700">
        <div class="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <span class="text-sm font-medium text-gray-600 dark:text-gray-200">访问模式</span>
        </div>
        <p class="mt-1 text-sm pl-7 text-gray-800 dark:text-white">
          <span :class="{ 'text-green-600 dark:text-green-400': fileInfo.use_proxy, 'text-blue-600 dark:text-blue-400': !fileInfo.use_proxy }">
            {{ fileInfo.use_proxy ? "Worker代理访问" : "S3直链访问" }}
          </span>
        </p>
      </div>

      <!-- 文件短链接 -->
      <div class="metadata-item p-3 rounded-lg bg-gray-100 dark:bg-gray-700">
        <div class="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          <span class="text-sm font-medium text-gray-600 dark:text-gray-200">文件链接</span>
        </div>
        <div class="mt-1 pl-7 flex items-center relative">
          <p class="text-sm truncate flex-1 text-gray-800 dark:text-white">
            {{ shareUrl || "需要密码访问" }}
          </p>
          <button
            v-if="shareUrl"
            @click="copyToClipboard(shareUrl)"
            class="ml-2 p-1 rounded hover:bg-opacity-80 transition-colors bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500"
            title="复制链接"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
              />
            </svg>
          </button>

          <!-- 复制成功提示 -->
          <div
            v-if="showCopyToast"
            class="absolute right-0 -top-10 px-3 py-2 rounded-md shadow-md text-sm transition-opacity duration-300 bg-white dark:bg-gray-700 text-green-600 dark:text-green-400 border border-gray-200 dark:border-gray-600"
          >
            <div class="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              复制成功
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, defineProps } from "vue";
import { formatFileSize, formatDateTime, getFileIconClass, formatMimeType, isImageType, isVideoType, isAudioType, isPdfType } from "./FileViewUtils";

const props = defineProps({
  fileInfo: {
    type: Object,
    required: true,
  },
  fileUrls: {
    type: Object,
    default: () => ({
      previewUrl: "",
      downloadUrl: "",
    }),
  },
  darkMode: {
    type: Boolean,
    default: false,
  },
});

// 分享链接 - 使用当前页面的URL
const shareUrl = computed(() => {
  return window.location.href;
});

// 复制成功提示状态
const showCopyToast = ref(false);

// 辅助函数：获取文件密码
const getFilePassword = () => {
  // 优先使用文件信息中存储的已验证密码
  if (props.fileInfo.currentPassword) {
    return props.fileInfo.currentPassword;
  }

  // 其次尝试从URL获取密码参数
  const currentUrl = new URL(window.location.href);
  const passwordParam = currentUrl.searchParams.get("password");
  if (passwordParam) {
    return passwordParam;
  }

  // 最后尝试从会话存储中获取密码
  try {
    const sessionPassword = sessionStorage.getItem(`file_password_${props.fileInfo.slug}`);
    if (sessionPassword) {
      return sessionPassword;
    }
  } catch (err) {
    console.error("从会话存储获取密码出错:", err);
  }

  return null;
};

// 处理预览URL，确保在使用Worker代理时携带密码参数
const processedPreviewUrl = computed(() => {
  let previewUrl = props.fileUrls.previewUrl;

  // 如果没有预览URL，则返回空字符串
  if (!previewUrl) {
    return "";
  }

  // 1. 添加密码参数(如果需要)
  const filePassword = getFilePassword();
  if (props.fileInfo.requires_password && filePassword && !previewUrl.includes("password=")) {
    previewUrl += (previewUrl.includes("?") ? "&" : "?") + `password=${encodeURIComponent(filePassword)}`;
  }

  return previewUrl;
});

// 格式化的文件大小
const formattedSize = computed(() => {
  return formatFileSize(props.fileInfo.size || 0);
});

// 格式化的MIME类型
const formattedMimeType = computed(() => {
  return formatMimeType(props.fileInfo.mimetype);
});

// 格式化的创建时间
const formattedCreatedAt = computed(() => {
  return formatDateTime(props.fileInfo.created_at);
});

// 格式化的过期时间
const formattedExpiresAt = computed(() => {
  return formatDateTime(props.fileInfo.expires_at);
});

// 文件图标类名
const iconClass = computed(() => {
  return getFileIconClass(props.fileInfo.mimetype, props.darkMode);
});

// 文件类型检查
const isImage = computed(() => isImageType(props.fileInfo.mimetype));
const isVideo = computed(() => isVideoType(props.fileInfo.mimetype));
const isAudio = computed(() => isAudioType(props.fileInfo.mimetype));
const isPdf = computed(() => isPdfType(props.fileInfo.mimetype));

// 复制到剪贴板函数
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    // 显示复制成功提示
    showCopyToast.value = true;
    // 3秒后自动隐藏提示
    setTimeout(() => {
      showCopyToast.value = false;
    }, 3000);
    console.log("复制成功");
  } catch (err) {
    console.error("复制失败:", err);
    // 复制失败时也显示提示，但内容不同
    alert("复制失败，请手动复制链接");
  }
};
</script>
