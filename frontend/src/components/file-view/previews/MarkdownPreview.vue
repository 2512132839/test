<template>
  <div class="markdown-preview rounded-lg overflow-hidden mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex-grow flex flex-col w-full">
    <div class="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Markdown预览</span>
    </div>
    <div class="p-4 overflow-auto flex-grow relative" style="max-height: calc(100vh - 350px); min-height: 200px">
      <iframe :src="previewUrl" frameborder="0" class="w-full h-[calc(100vh-400px)] min-h-[200px]" @load="handleLoad" @error="handleError" v-show="!loading && !error"></iframe>
      <!-- Markdown加载状态 -->
      <div v-if="loading" class="absolute inset-0 flex items-center justify-center">
        <div class="text-center">
          <svg class="animate-spin h-8 w-8 text-blue-500 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 0 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p class="text-blue-600 dark:text-blue-400">加载Markdown预览中...</p>
        </div>
      </div>
      <!-- Markdown错误状态 -->
      <div v-if="error" class="absolute inset-0 flex items-center justify-center">
        <div class="text-center p-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-red-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p class="text-red-600 dark:text-red-400 mb-2">Markdown预览加载失败</p>
          <p class="text-gray-500 dark:text-gray-400 text-sm">请尝试刷新页面或下载文件查看</p>
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

const emit = defineEmits(["load", "error"]);

const loading = ref(true);
const error = ref(false);

const handleLoad = () => {
  loading.value = false;
  error.value = false;
  emit("load");
};

const handleError = () => {
  loading.value = false;
  error.value = true;
  emit("error");
};

// Markdown预览通过iframe加载，初始状态为加载中
</script>
