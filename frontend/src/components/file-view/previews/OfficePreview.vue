<template>
  <div class="office-preview rounded-lg overflow-hidden mb-2 flex-grow flex flex-col w-full">
    <div class="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ isOfficeDocument ? "Word文档预览" : isSpreadsheet ? "Excel表格预览" : isPresentation ? "PowerPoint演示文稿预览" : "Office文档预览" }}
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
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation"
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
              d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 0 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p class="text-blue-600">加载Office预览中，请稍候...</p>
          <p class="text-gray-500 text-sm mt-1">
            {{ useGoogleDocsPreview ? "使用Google Docs服务" : "使用Microsoft Office服务" }}
            {{ useProxy ? " (Worker代理模式)" : " (直接访问模式)" }}
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
        <a :href="downloadUrl" class="text-blue-500 hover:underline" target="_blank">下载文件</a>
        后查看
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";

const props = defineProps({
  microsoftOfficePreviewUrl: {
    type: String,
    default: "",
  },
  googleDocsPreviewUrl: {
    type: String,
    default: "",
  },
  isOfficeDocument: {
    type: Boolean,
    default: false,
  },
  isSpreadsheet: {
    type: Boolean,
    default: false,
  },
  isPresentation: {
    type: Boolean,
    default: false,
  },
  useProxy: {
    type: Boolean,
    default: false,
  },
  downloadUrl: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["load", "error", "toggle-service", "update-urls"]);

const useGoogleDocsPreview = ref(false);
const officePreviewLoading = ref(true);
const officePreviewError = ref("");

const currentOfficePreviewUrl = computed(() => {
  return useGoogleDocsPreview.value ? props.googleDocsPreviewUrl : props.microsoftOfficePreviewUrl;
});

const toggleOfficePreviewService = () => {
  useGoogleDocsPreview.value = !useGoogleDocsPreview.value;
  officePreviewLoading.value = true;
  officePreviewError.value = "";
  emit("toggle-service", useGoogleDocsPreview.value);
};

const updateOfficePreviewUrls = () => {
  emit("update-urls");
};

const handleOfficePreviewLoad = () => {
  console.log("Office预览加载成功");
  officePreviewError.value = "";
  officePreviewLoading.value = false;
  emit("load");
};

const handleOfficePreviewError = (event) => {
  console.error("Office预览加载失败:", event);
  officePreviewError.value = "Office预览加载失败，请尝试切换预览服务或下载文件后查看。";
  officePreviewLoading.value = false;
  emit("error", event);
};

onMounted(() => {
  if (currentOfficePreviewUrl.value) {
    officePreviewLoading.value = true;
  }
});

// 清理资源
onUnmounted(() => {
  // 清理可能的定时器或其他资源
  officePreviewLoading.value = false;
  officePreviewError.value = "";
});
</script>
