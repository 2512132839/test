<template>
  <nav class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 gap-2 sm:gap-0" aria-label="面包屑导航">
    <!-- 左侧面包屑 -->
    <ol class="flex flex-wrap items-center space-x-1">
      <li class="flex items-center">
        <a
          href="#"
          @click.prevent="$emit('navigate', '/')"
          :class="['flex items-center font-medium transition-colors duration-200', darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900']"
        >
          <!-- 根目录图标 -->
          <svg class="w-5 h-5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          <span>根目录</span>
        </a>
      </li>

      <!-- 路径分隔符和目录段 -->
      <li v-for="(segment, index) in pathSegments" :key="index" class="flex items-center">
        <span :class="['mx-1', darkMode ? 'text-gray-500' : 'text-gray-400']"> / </span>
        <a
          href="#"
          @click.prevent="navigateToSegment(index)"
          :class="[
            'font-medium transition-colors duration-200',
            index === pathSegments.length - 1 && !previewFile
              ? darkMode
                ? 'text-primary-400'
                : 'text-primary-600'
              : darkMode
              ? 'text-gray-300 hover:text-white'
              : 'text-gray-600 hover:text-gray-900',
          ]"
        >
          {{ segment }}
        </a>
      </li>

      <!-- 文件预览项 -->
      <li v-if="previewFile" class="flex items-center">
        <span :class="['mx-1', darkMode ? 'text-gray-500' : 'text-gray-400']"> / </span>
        <span :class="['font-medium', darkMode ? 'text-primary-400' : 'text-primary-600']">
          {{ previewFile.name }}
        </span>
      </li>
    </ol>

    <!-- 右侧操作按钮 -->
    <div v-if="!previewFile" class="flex items-center">
      <!-- 启用/禁用勾选框按钮 -->
      <button
        @click="$emit('toggle-checkbox-mode')"
        class="inline-flex items-center px-2 sm:px-3 py-1.5 rounded-md transition-colors text-xs sm:text-sm font-medium mr-2 sm:ml-2"
        :class="[
          isCheckboxMode
            ? darkMode
              ? 'bg-primary-600 text-white hover:bg-primary-700'
              : 'bg-primary-500 text-white hover:bg-primary-600'
            : darkMode
            ? 'bg-gray-700 hover:bg-gray-600 text-white'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-700',
        ]"
        title="批量操作"
      >
        <svg class="w-4 h-4 mr-1 sm:mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path v-if="isCheckboxMode" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          <rect v-else x="4" y="4" width="16" height="16" rx="2" stroke-width="2" />
        </svg>
        <span>{{ isCheckboxMode ? "退出勾选" : "启用勾选" }}</span>
      </button>

      <!-- 批量删除按钮 (在勾选模式且有选中项时显示) -->
      <button
        v-if="isCheckboxMode && selectedCount > 0"
        @click="$emit('batch-delete')"
        class="inline-flex items-center px-2 sm:px-3 py-1.5 rounded-md transition-colors text-xs sm:text-sm font-medium bg-red-600 hover:bg-red-700 text-white"
      >
        <svg class="w-4 h-4 mr-1 sm:mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        <span class="whitespace-nowrap">删除选中项 ({{ selectedCount }})</span>
      </button>
    </div>
  </nav>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  currentPath: {
    type: String,
    required: true,
    default: "/",
  },
  darkMode: {
    type: Boolean,
    default: false,
  },
  previewFile: {
    type: Object,
    default: null,
  },
  isCheckboxMode: {
    type: Boolean,
    default: false,
  },
  selectedCount: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits(["navigate", "toggle-checkbox-mode", "batch-delete"]);

// 计算路径段
const pathSegments = computed(() => {
  // 移除开头的斜杠，然后按斜杠分割
  return props.currentPath
    .replace(/^\/+/, "") // 移除开头的斜杠
    .split("/")
    .filter((segment) => segment); // 过滤空字符串
});

// 导航到指定段
const navigateToSegment = (segmentIndex) => {
  // 构建到该段的完整路径
  let targetPath = "/";
  if (segmentIndex >= 0) {
    targetPath += pathSegments.value.slice(0, segmentIndex + 1).join("/") + "/";
  }
  emit("navigate", targetPath);
};
</script>
