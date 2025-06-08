<template>
  <div class="text-preview rounded-lg overflow-hidden mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex-grow flex flex-col w-full">
    <div class="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ title }}</span>
      <span v-if="language" class="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-gray-700 dark:text-gray-300">{{ language }}</span>
    </div>
    <div class="p-4 overflow-auto flex-grow relative" style="max-height: calc(100vh - 350px); min-height: 200px">
      <pre v-show="!loading" class="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-mono break-words">{{ content }}</pre>
      <!-- 加载状态 -->
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
          <p class="text-blue-600 dark:text-blue-400">{{ loadingText }}</p>
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
  title: {
    type: String,
    default: "文本文件预览",
  },
  language: {
    type: String,
    default: "",
  },
  loadingText: {
    type: String,
    default: "加载文本内容中...",
  },
});

const emit = defineEmits(["load", "error"]);

const loading = ref(true);
const content = ref("");

const fetchContent = async () => {
  try {
    loading.value = true;
    const response = await fetch(props.previewUrl);
    if (response.ok) {
      // 检查文件大小
      const contentLength = response.headers.get("content-length");
      const fileSize = contentLength ? parseInt(contentLength) : 0;

      // 如果文件大于 3MB，显示警告并限制预览
      if (fileSize > 3 *1024 * 1024) {
        content.value = `文件过大（${Math.round((fileSize / 1024 / 1024) * 100) / 100}MB），为了性能考虑，请下载后查看完整内容。\n\n以下是文件的前 1000 个字符：\n\n`;
        const text = await response.text();
        content.value += text.substring(0, 1000);
        if (text.length > 1000) {
          content.value += "\n\n... (内容已截断，请下载查看完整文件)";
        }
      } else {
        content.value = await response.text();
      }
    } else {
      content.value = `无法加载文件内容：${response.status} ${response.statusText}`;
    }
    emit("load");
  } catch (err) {
    console.error("获取文件内容失败:", err);
    content.value = "获取文件内容时出错，请刷新页面重试。";
    emit("error", err);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  if (props.previewUrl) {
    fetchContent();
  }
});
</script>
