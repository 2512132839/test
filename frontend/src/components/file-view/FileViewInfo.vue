<template>
  <div class="file-info-container flex flex-col min-h-0 flex-grow">
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
    <div v-if="fileInfo.remark" class="file-remark mb-6 px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-auto max-h-[300px]">
      <p class="text-blue-600 dark:text-blue-400 break-words whitespace-pre-wrap">{{ fileInfo.remark }}</p>
    </div>

    <!-- 文件预览区域 -->
    <div v-if="fileUrls.previewUrl" class="file-preview mb-6 flex-grow flex flex-col justify-center items-center">
      <!-- 图片预览 -->
      <div v-if="isImage" class="image-preview rounded-lg overflow-hidden mb-2 flex justify-center">
        <img :src="processedPreviewUrl" :alt="fileInfo.filename" class="max-w-full max-h-[calc(100vh-350px)] h-auto object-contain" />
      </div>

      <!-- 视频预览 -->
      <div v-else-if="isVideo" class="video-preview rounded-lg overflow-hidden mb-2 flex justify-center">
        <video controls class="max-w-full max-h-[calc(100vh-350px)]">
          <source :src="processedPreviewUrl" :type="fileInfo.mimetype" />
          您的浏览器不支持视频标签
        </video>
      </div>

      <!-- 音频预览 -->
      <div v-else-if="isAudio" class="audio-preview rounded-lg p-4 mb-2 bg-gray-100 dark:bg-gray-700 w-full">
        <audio controls class="w-full">
          <source :src="processedPreviewUrl" :type="fileInfo.mimetype" />
          您的浏览器不支持音频标签
        </audio>
      </div>

      <!-- PDF预览 -->
      <div v-else-if="isPdf" class="pdf-preview rounded-lg overflow-hidden mb-2 flex-grow w-full">
        <iframe :src="processedPreviewUrl" frameborder="0" class="w-full h-[calc(100vh-350px)] min-h-[300px]"></iframe>
      </div>

      <!-- 文本文件预览 -->
      <div
        v-else-if="isText"
        class="text-preview rounded-lg overflow-hidden mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex-grow flex flex-col w-full"
      >
        <div class="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">文本文件预览</span>
        </div>
        <div class="p-4 overflow-auto flex-grow" style="max-height: calc(100vh - 350px); min-height: 200px">
          <pre class="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-mono break-words">{{ fileContent }}</pre>
        </div>
      </div>

      <!-- Markdown预览 -->
      <div
        v-else-if="isMarkdown"
        class="markdown-preview rounded-lg overflow-hidden mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex-grow flex flex-col w-full"
      >
        <div class="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Markdown预览</span>
        </div>
        <div class="p-4 overflow-auto flex-grow" style="max-height: calc(100vh - 350px); min-height: 200px">
          <iframe v-if="processedPreviewUrl" :src="processedPreviewUrl" frameborder="0" class="w-full h-[calc(100vh-400px)] min-h-[200px]"></iframe>
          <pre v-else class="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-mono break-words">{{ fileContent }}</pre>
        </div>
      </div>

      <!-- HTML预览 -->
      <div v-else-if="isHtml" class="html-preview rounded-lg overflow-hidden mb-2 flex-grow flex flex-col w-full">
        <div class="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">HTML预览</span>
          <div>
            <button
              @click="toggleHtmlPreview"
              class="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-700 text-blue-700 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-600 transition-colors"
            >
              {{ showHtmlIframe ? "查看源码" : "查看渲染" }}
            </button>
          </div>
        </div>
        <div v-if="showHtmlIframe" class="html-iframe flex-grow" style="height: calc(100vh - 350px); min-height: 300px">
          <iframe :src="processedPreviewUrl" sandbox="allow-same-origin allow-scripts" frameborder="0" class="w-full h-full"></iframe>
        </div>
        <div v-else class="p-4 overflow-auto flex-grow" style="max-height: calc(100vh - 350px); min-height: 200px">
          <pre class="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-mono break-words">{{ fileContent }}</pre>
        </div>
      </div>

      <!-- 代码文件预览 -->
      <div
        v-else-if="isCode"
        class="code-preview rounded-lg overflow-hidden mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex-grow flex flex-col w-full"
      >
        <div class="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">代码预览</span>
          <span class="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-gray-700 dark:text-gray-300">{{ getCodeLanguage }}</span>
        </div>
        <div class="p-4 overflow-auto flex-grow" style="max-height: calc(100vh - 350px); min-height: 200px">
          <pre class="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-mono break-words">{{ fileContent }}</pre>
        </div>
      </div>

      <!-- 配置文件预览 -->
      <div
        v-else-if="isConfig"
        class="config-preview rounded-lg overflow-hidden mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex-grow flex flex-col w-full"
      >
        <div class="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">配置文件预览</span>
          <span class="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-gray-700 dark:text-gray-300">{{ getConfigLanguage }}</span>
        </div>
        <div class="p-4 overflow-auto flex-grow" style="max-height: calc(100vh - 350px); min-height: 200px">
          <pre class="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-mono break-words">{{ fileContent }}</pre>
        </div>
      </div>

      <!-- Office文档预览 -->
      <div v-else-if="isOfficeFile" class="office-preview rounded-lg overflow-hidden mb-2 flex-grow flex flex-col w-full">
        <div class="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ isOfficeDocument ? "Word文档预览" : isSpreadsheet ? "Excel表格预览" : "PowerPoint演示文稿预览" }}
          </span>
          <div>
            <button
              @click="toggleOfficePreviewService"
              class="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-700 text-blue-700 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-600 transition-colors"
            >
              {{ useGoogleDocsPreview ? "使用Microsoft预览" : "使用Google预览" }}
            </button>
          </div>
        </div>
        <div class="office-iframe flex-grow relative" style="height: calc(100vh - 400px); min-height: 300px; background-color: white">
          <iframe
            v-if="currentOfficePreviewUrl"
            :src="currentOfficePreviewUrl"
            frameborder="0"
            class="w-full h-full"
            sandbox="allow-scripts allow-same-origin allow-forms"
            @load="handleOfficePreviewLoad"
            @error="handleOfficePreviewError"
          ></iframe>
          <div v-else class="w-full h-full flex items-center justify-center">
            <div class="text-center p-4">
              <p class="text-gray-500 mb-2">{{ officePreviewError || "加载预览中..." }}</p>
              <div v-if="officePreviewError && officePreviewError.includes('401')">
                <p class="text-amber-500 text-sm mb-2">似乎是密码验证问题，请尝试：</p>
                <ul class="text-left text-sm text-gray-600 dark:text-gray-300 list-disc pl-5 mb-2">
                  <li>刷新页面后重新输入密码</li>
                  <li>确认您输入的密码正确</li>
                  <li>尝试在URL中直接添加密码参数</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- 加载中状态遮罩 -->
          <div v-if="officePreviewLoading && currentOfficePreviewUrl" class="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center">
            <div class="text-center">
              <svg class="animate-spin h-8 w-8 text-blue-500 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <p class="text-blue-600">加载Office预览中，请稍候...</p>
              <p class="text-gray-500 text-sm mt-1">
                {{ useGoogleDocsPreview ? "使用Google Docs服务" : "使用Microsoft Office服务" }}
                {{ props.fileInfo.use_proxy ? " (Worker代理模式)" : " (直接访问模式)" }}
              </p>
            </div>
          </div>
        </div>
        <div class="p-2 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 text-center">
          <p v-if="officePreviewError" class="text-red-500 mb-1">{{ officePreviewError }}</p>
          <p>
            如果预览不正常，请尝试
            <button @click="updateOfficePreviewUrls" class="text-blue-500 hover:underline">刷新预览</button>
            或切换预览服务，或
            <a :href="props.fileUrls.downloadUrl" class="text-blue-500 hover:underline" target="_blank">下载文件</a>
            后查看
          </p>
        </div>
      </div>

      <!-- 其他文件类型 -->
      <div v-else class="generic-preview text-center py-6 w-full self-center flex flex-col items-center justify-center" style="min-height: 200px">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-3" :class="iconClass" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        <p class="text-gray-600 dark:text-gray-300">此文件类型不支持在线预览</p>
        <p class="text-gray-500 dark:text-gray-400 text-sm mt-2">请下载后查看</p>
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
import { computed, ref, defineProps, onMounted } from "vue";
import { getFullApiUrl } from "../../api/config.js";
import {
  formatFileSize,
  formatDateTime,
  getFileIconClass,
  formatMimeType,
  isImageType,
  isVideoType,
  isAudioType,
  isPdfType,
  isMarkdownType,
  isHtmlType,
  isTextType,
  isCodeType,
  isConfigType,
  isWordDocumentType,
  isSpreadsheetType,
  isPresentationType,
  isOfficeFileType,
} from "./FileViewUtils";
import { copyToClipboard as clipboardCopy } from "@/utils/clipboard";

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

// 文件内容状态
const fileContent = ref("");

// HTML预览状态
const showHtmlIframe = ref(true);

// 切换HTML预览模式（源码/渲染）
const toggleHtmlPreview = () => {
  showHtmlIframe.value = !showHtmlIframe.value;
};

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
  return formatMimeType(props.fileInfo.mimetype, props.fileInfo.filename);
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
  return getFileIconClass(props.fileInfo.mimetype, props.darkMode, props.fileInfo.filename);
});

// 文件类型检查
const isImage = computed(() => isImageType(props.fileInfo.mimetype, props.fileInfo.filename));
const isVideo = computed(() => isVideoType(props.fileInfo.mimetype, props.fileInfo.filename));
const isAudio = computed(() => isAudioType(props.fileInfo.mimetype, props.fileInfo.filename));
const isPdf = computed(() => isPdfType(props.fileInfo.mimetype, props.fileInfo.filename));
const isMarkdown = computed(() => isMarkdownType(props.fileInfo.mimetype, props.fileInfo.filename));
const isHtml = computed(() => isHtmlType(props.fileInfo.mimetype, props.fileInfo.filename));
const isText = computed(() => isTextType(props.fileInfo.mimetype, props.fileInfo.filename));
const isCode = computed(() => isCodeType(props.fileInfo.mimetype, props.fileInfo.filename));
const isConfig = computed(() => isConfigType(props.fileInfo.mimetype, props.fileInfo.filename));

// Office文件类型检查
const isOfficeDocument = computed(() => isWordDocumentType(props.fileInfo.mimetype, props.fileInfo.filename));
const isSpreadsheet = computed(() => isSpreadsheetType(props.fileInfo.mimetype, props.fileInfo.filename));
const isPresentation = computed(() => isPresentationType(props.fileInfo.mimetype, props.fileInfo.filename));
const isOfficeFile = computed(() => isOfficeFileType(props.fileInfo.mimetype, props.fileInfo.filename));

// Office预览URL状态
const microsoftOfficePreviewUrl = ref("");
const googleDocsPreviewUrl = ref("");

// 当前使用的Office预览URL
const currentOfficePreviewUrl = computed(() => {
  return useGoogleDocsPreview.value ? googleDocsPreviewUrl.value : microsoftOfficePreviewUrl.value;
});

// 更新Office预览URL
const updateOfficePreviewUrls = async () => {
  // 重置加载状态
  officePreviewLoading.value = true;
  officePreviewError.value = "";

  // 调试信息：记录密码状态
  const filePassword = getFilePassword();
  console.log("调试: 更新Office预览URL", {
    isUseProxy: props.fileInfo.use_proxy,
    hasPassword: !!props.fileInfo.password,
    hasCurrentPassword: !!props.fileInfo.currentPassword,
    hasFilePassword: !!filePassword,
    passwordLength: filePassword ? filePassword.length : 0,
  });

  try {
    // 如果是Worker代理模式，需要特殊处理
    if (props.fileInfo.use_proxy) {
      // 使用专门的API获取临时直接URL
      const directUrl = await getOfficeDirectUrlForPreview();

      if (directUrl) {
        // 确保URL是完整的绝对URL
        const encodedUrl = encodeURIComponent(directUrl);
        microsoftOfficePreviewUrl.value = `https://view.officeapps.live.com/op/view.aspx?src=${encodedUrl}`;
        googleDocsPreviewUrl.value = `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;
      } else {
        microsoftOfficePreviewUrl.value = "";
        googleDocsPreviewUrl.value = "";
        officePreviewError.value = "获取Office预览URL失败";
      }
    } else {
      // S3直链模式，正常处理
      if (!processedPreviewUrl.value) {
        microsoftOfficePreviewUrl.value = "";
        googleDocsPreviewUrl.value = "";
        return;
      }

      // 确保URL是完整的绝对URL
      let url = processedPreviewUrl.value;
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        // 如果是相对URL，转换为绝对URL
        const baseUrl = window.location.origin;
        url = url.startsWith("/") ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
      }

      // 使用encodeURIComponent对URL进行编码，确保安全
      const encodedUrl = encodeURIComponent(url);
      microsoftOfficePreviewUrl.value = `https://view.officeapps.live.com/op/view.aspx?src=${encodedUrl}`;
      googleDocsPreviewUrl.value = `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;
    }

    // 开始预览加载超时计时
    startPreviewLoadTimeout();
  } catch (error) {
    console.error("更新Office预览URL出错:", error);
    officePreviewError.value = `更新预览URL失败: ${error.message || "未知错误"}`;
    officePreviewLoading.value = false;
  }
};

// 切换Office预览服务（Microsoft/Google）
const toggleOfficePreviewService = () => {
  useGoogleDocsPreview.value = !useGoogleDocsPreview.value;

  // 重置加载状态
  officePreviewLoading.value = true;
  officePreviewError.value = "";

  // 重新开始超时计时
  startPreviewLoadTimeout();
};

// 计算属性：检查是否可预览
const isPreviewable = computed(() => {
  return isImage.value || isVideo.value || isAudio.value || isPdf.value || isMarkdown.value || isHtml.value || isText.value || isCode.value || isConfig.value || isOfficeFile.value;
});

// 复制到剪贴板函数
const copyToClipboard = async (text) => {
  try {
    const success = await clipboardCopy(text);

    if (success) {
      // 显示复制成功提示
      showCopyToast.value = true;
      // 3秒后自动隐藏提示
      setTimeout(() => {
        showCopyToast.value = false;
      }, 3000);
      console.log("复制成功");
    } else {
      throw new Error("复制失败");
    }
  } catch (err) {
    console.error("复制失败:", err);
    // 复制失败时也显示提示，但内容不同
    alert("复制失败，请手动复制链接");
  }
};

// 在组件挂载时，如果是文本类型，获取文件内容
const fetchTextContent = async () => {
  try {
    // 如果是文本/代码/配置文件且有预览URL
    if ((isText.value || isCode.value || isMarkdown.value || isConfig.value) && props.fileUrls.previewUrl) {
      // 获取文件内容
      const response = await fetch(processedPreviewUrl.value);
      if (response.ok) {
        fileContent.value = await response.text();
      } else {
        fileContent.value = `无法加载文件内容：${response.status} ${response.statusText}`;
      }
    }
  } catch (err) {
    console.error("获取文件内容失败:", err);
    fileContent.value = "获取文件内容时出错，请刷新页面重试。";
  }
};

// 使用onMounted钩子在组件挂载时获取文本内容
onMounted(fetchTextContent);

// 获取代码文件的语言类型
const getCodeLanguage = computed(() => {
  if (!props.fileInfo.filename) return "代码";

  const extension = props.fileInfo.filename.split(".").pop().toLowerCase();
  const languageMap = {
    // 编程语言
    js: "JavaScript",
    ts: "TypeScript",
    py: "Python",
    java: "Java",
    c: "C",
    cpp: "C++",
    cs: "C#",
    go: "Go",
    php: "PHP",
    rb: "Ruby",
    swift: "Swift",
    kt: "Kotlin",
    rs: "Rust",
    sh: "Shell",
    sql: "SQL",
    // UI/前端
    css: "CSS",
    scss: "SCSS",
    less: "LESS",
    vue: "Vue",
    jsx: "JSX",
    tsx: "TSX",
  };

  return languageMap[extension] || "代码";
});

// 获取配置文件的语言类型
const getConfigLanguage = computed(() => {
  if (!props.fileInfo.filename) return "配置";

  const extension = props.fileInfo.filename.split(".").pop().toLowerCase();
  const configLanguageMap = {
    json: "JSON",
    xml: "XML",
    yaml: "YAML",
    yml: "YAML",
    toml: "TOML",
    ini: "INI",
    env: "ENV",
    conf: "CONF",
  };

  return configLanguageMap[extension] || "配置";
});

// Office预览加载成功处理
const handleOfficePreviewLoad = () => {
  console.log("Office预览加载成功");
  officePreviewError.value = ""; // 清除错误信息
  officePreviewLoading.value = false; // 标记加载完成
  clearTimeout(previewTimeoutId.value); // 清除超时计时器
};

// Office预览加载失败处理
const handleOfficePreviewError = (event) => {
  console.error("Office预览加载失败:", event);
  officePreviewError.value = "Office预览加载失败，请尝试切换预览服务或下载文件后查看。";

  // 如果启用了自动故障转移，且当前未处于加载超时状态，则尝试切换服务
  if (officePreviewConfig.value.enableAutoFailover && !officePreviewTimedOut.value) {
    console.log("自动故障转移到", useGoogleDocsPreview.value ? "Microsoft预览" : "Google预览");
    useGoogleDocsPreview.value = !useGoogleDocsPreview.value;
    officePreviewLoading.value = true; // 重新标记为加载中
    startPreviewLoadTimeout(); // 重新开始超时计时
  }
};

// Office预览错误状态
const officePreviewError = ref("");
// Office预览加载状态
const officePreviewLoading = ref(true);
// Office预览超时状态
const officePreviewTimedOut = ref(false);
// 预览超时计时器ID
const previewTimeoutId = ref(null);

// 开始预览加载超时计时
const startPreviewLoadTimeout = () => {
  // 清除可能存在的上一个计时器
  if (previewTimeoutId.value) {
    clearTimeout(previewTimeoutId.value);
  }

  // 重置超时状态
  officePreviewTimedOut.value = false;

  // 设置新的超时计时器
  previewTimeoutId.value = setTimeout(() => {
    console.warn("Office预览加载超时");
    officePreviewError.value = "预览加载超时，请尝试切换预览服务或下载文件后查看。";
    officePreviewTimedOut.value = true;
    officePreviewLoading.value = false;
  }, officePreviewConfig.value.loadTimeout);
};

// 是否使用Google Docs预览 (可以通过配置或自动检测确定)
const useGoogleDocsPreview = ref(false);

// Office在线预览服务配置
const officePreviewConfig = ref({
  // 默认使用Microsoft Office Online Viewer
  defaultService: "microsoft", // 'microsoft' 或 'google'
  // 自动故障转移到另一个服务
  enableAutoFailover: true,
  // 加载超时(毫秒)
  loadTimeout: 10000,
});

// 初始化时，根据配置设置预览服务
onMounted(() => {
  // 根据默认配置设置预览服务
  useGoogleDocsPreview.value = officePreviewConfig.value.defaultService === "google";

  // 确保密码被保存到会话存储
  savePasswordToSessionStorage();

  // 获取文本内容
  fetchTextContent();

  // 如果是Office文件，更新预览URL
  if (isOfficeFile.value) {
    updateOfficePreviewUrls();
  }

  // 后续可以添加从localStorage或后端获取配置的逻辑
});

// 确保密码被保存到会话存储
const savePasswordToSessionStorage = () => {
  if (!props.fileInfo.slug) return;

  try {
    // 获取潜在的密码源
    let password = null;

    // 1. 首先检查props.fileInfo.currentPassword
    if (props.fileInfo.currentPassword) {
      password = props.fileInfo.currentPassword;
    }
    // 2. 其次检查URL中的密码参数
    else {
      const currentUrl = new URL(window.location.href);
      const passwordParam = currentUrl.searchParams.get("password");
      if (passwordParam) {
        password = passwordParam;
      }
    }

    // 如果找到了密码，保存到会话存储
    if (password) {
      console.log("保存密码到会话存储", { slug: props.fileInfo.slug });
      sessionStorage.setItem(`file_password_${props.fileInfo.slug}`, password);
    }
  } catch (err) {
    console.error("保存密码到会话存储出错:", err);
  }
};

// 获取Office文件直接访问URL (用于Worker代理模式)
const getOfficeDirectUrlForPreview = async () => {
  if (!props.fileInfo.slug) return null;

  try {
    // 使用 getFullApiUrl 构建API请求URL后端域名
    let apiUrl = getFullApiUrl(`office-preview/${props.fileInfo.slug}`);

    // 获取可能的密码
    const filePassword = getFilePassword();

    // 只要有密码，就添加到请求中，不再依赖requires_password标志
    if (filePassword) {
      apiUrl += `?password=${encodeURIComponent(filePassword)}`;
      console.log("正在将密码添加到Office预览请求", { passwordLength: filePassword.length });
    } else if (props.fileInfo.password) {
      // 如果文件确实需要密码但我们没有获取到，记录日志
      console.warn("文件需要密码，但无法获取到密码", {
        hasCurrentPassword: !!props.fileInfo.currentPassword,
        hasUrlPassword: !!new URL(window.location.href).searchParams.get("password"),
        hasSessionStorage: !!sessionStorage.getItem(`file_password_${props.fileInfo.slug}`),
      });
    }

    // 发送请求获取直接URL
    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorData = await response.json();
      console.error("获取Office直接URL失败:", errorData.error || response.statusText, {
        status: response.status,
        fileRequiresPassword: !!props.fileInfo.password,
        passwordProvided: !!filePassword,
      });
      officePreviewError.value = `获取预览失败: ${errorData.error || "服务器错误"}`;
      return null;
    }

    // 解析响应
    const data = await response.json();

    // 缓存获取的直接URL
    officeDirectUrl.value = data.url;

    // 确保密码被保存到会话存储中以便后续使用
    if (filePassword && props.fileInfo.slug) {
      try {
        sessionStorage.setItem(`file_password_${props.fileInfo.slug}`, filePassword);
      } catch (err) {
        console.error("保存密码到会话存储失败:", err);
      }
    }

    return data.url;
  } catch (error) {
    console.error("获取Office直接URL出错:", error);
    officePreviewError.value = `获取预览失败: ${error.message || "未知错误"}`;
    return null;
  }
};

// 当前Office直接访问URL (用于Worker代理模式)
const officeDirectUrl = ref("");
</script>
