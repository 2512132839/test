<template>
  <div class="html-preview rounded-lg overflow-hidden mb-2 flex-grow flex flex-col w-full">
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
    <div v-if="showHtmlIframe" class="html-iframe flex-grow relative" style="height: calc(100vh - 350px); min-height: 300px">
      <iframe
        :src="previewUrl"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
        frameborder="0"
        class="w-full h-full"
        @load="handleHtmlLoad"
        v-show="!htmlLoading"
      ></iframe>
      <!-- HTML加载状态 -->
      <div v-if="htmlLoading" class="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700">
        <div class="text-center">
          <svg class="animate-spin h-8 w-8 text-blue-500 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 0 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p class="text-blue-600 dark:text-blue-400">加载HTML预览中...</p>
        </div>
      </div>
    </div>
    <div v-else class="p-4 overflow-auto flex-grow relative" style="max-height: calc(100vh - 350px); min-height: 200px">
      <pre v-show="!textLoading" class="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-mono break-words">{{ htmlContent }}</pre>
      <!-- HTML源码加载状态 -->
      <div v-if="textLoading" class="absolute inset-0 flex items-center justify-center">
        <div class="text-center">
          <svg class="animate-spin h-8 w-8 text-blue-500 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 814 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p class="text-blue-600 dark:text-blue-400">加载HTML源码中...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";

const props = defineProps({
  previewUrl: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(["load", "error", "toggle-mode"]);

const showHtmlIframe = ref(true);
const htmlLoading = ref(false);
const textLoading = ref(false);
const htmlContent = ref("");

// 获取HTML源码内容
const fetchHtmlContent = async () => {
  try {
    textLoading.value = true;
    const response = await fetch(props.previewUrl);
    if (response.ok) {
      htmlContent.value = await response.text();
    } else {
      htmlContent.value = `无法加载HTML内容：${response.status} ${response.statusText}`;
    }
  } catch (err) {
    console.error("获取HTML内容失败:", err);
    htmlContent.value = "获取HTML内容时出错，请刷新页面重试。";
    emit("error", err);
  } finally {
    textLoading.value = false;
  }
};

// 切换HTML预览模式（源码/渲染）
const toggleHtmlPreview = () => {
  showHtmlIframe.value = !showHtmlIframe.value;
  // 切换到iframe模式时重置加载状态
  if (showHtmlIframe.value) {
    htmlLoading.value = true;
  } else {
    // 切换到源码模式时获取内容
    if (!htmlContent.value) {
      fetchHtmlContent();
    }
  }
  emit("toggle-mode", showHtmlIframe.value);
};

const handleHtmlLoad = () => {
  htmlLoading.value = false;
  emit("load");
};

onMounted(() => {
  if (props.previewUrl && showHtmlIframe.value) {
    htmlLoading.value = true;
  }
});
</script>
