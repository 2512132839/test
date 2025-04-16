<template>
  <div class="hover:cursor-pointer" :class="[darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100']">
    <div
      class="grid items-center py-2 px-3"
      :class="[isCheckboxMode ? 'grid-cols-[auto_auto_1fr_auto] sm:grid-cols-[auto_auto_1fr_auto_auto_auto]' : 'grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_auto_auto_auto]']"
    >
      <!-- 勾选框 (仅在勾选模式下显示) -->
      <div v-if="isCheckboxMode" class="mr-1.5 sm:mr-2 flex justify-center" @click.stop="toggleSelect">
        <input
          type="checkbox"
          :checked="isSelected"
          class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          :class="darkMode ? 'bg-gray-700 border-gray-500' : ''"
        />
      </div>

      <!-- 文件/文件夹图标 -->
      <div class="mr-2 sm:mr-3 flex-shrink-0 w-5 sm:w-6 h-5 sm:h-6">
        <span v-html="getFileIcon(item, darkMode)"></span>
      </div>

      <!-- 文件/文件夹名称 -->
      <div class="flex-grow truncate" @click="handleClick">
        <div class="font-medium truncate" :class="darkMode ? 'text-gray-200' : 'text-gray-700'">{{ item.name }}</div>
        <!-- 移动端文件大小显示 -->
        <div v-if="!item.isDirectory" class="text-xs block sm:hidden mt-0.5" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
          {{ formatFileSize(item.size) }}
        </div>
      </div>

      <!-- 文件大小 -->
      <div class="min-w-24 text-center text-sm hidden sm:block" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
        <span v-if="item.isDirectory">-</span>
        <span v-else>{{ formatFileSize(item.size) }}</span>
      </div>

      <!-- 修改时间 -->
      <div class="min-w-36 text-center text-sm hidden sm:block" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
        {{ formatDate(item.modified) }}
      </div>

      <!-- 操作按钮 - 移动端下减少按钮大小和间距 -->
      <div class="min-w-[80px] sm:min-w-24 text-center">
        <div class="flex justify-end sm:justify-center space-x-0.5 sm:space-x-1">
          <!-- 下载按钮（只对文件显示）-->
          <button
            v-if="!item.isDirectory"
            @click.stop="$emit('download', item)"
            class="p-1 sm:p-1.5 rounded-full"
            :class="darkMode ? 'hover:bg-gray-600 text-blue-400 hover:text-blue-300' : 'hover:bg-gray-200 text-blue-600 hover:text-blue-700'"
            title="下载"
          >
            <svg class="w-4 h-4 sm:w-5 sm:h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>

          <!-- 重命名按钮 - 只对文件显示，文件夹暂时不显示重命名按钮 -->
          <button
            v-if="!item.isDirectory"
            @click.stop="$emit('rename', item)"
            class="p-1 sm:p-1.5 rounded-full"
            :class="darkMode ? 'hover:bg-gray-600 text-yellow-400 hover:text-yellow-300' : 'hover:bg-gray-200 text-yellow-600 hover:text-yellow-700'"
            title="重命名"
          >
            <svg class="w-4 h-4 sm:w-5 sm:h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>

          <!-- 删除按钮 -->
          <button
            @click.stop="$emit('delete', item)"
            class="p-1 sm:p-1.5 rounded-full"
            :class="darkMode ? 'hover:bg-gray-600 text-red-400 hover:text-red-300' : 'hover:bg-gray-200 text-red-600 hover:text-red-700'"
            title="删除"
          >
            <svg class="w-4 h-4 sm:w-5 sm:h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { getFileIcon } from "../../utils/fileTypeIcons";

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
  darkMode: {
    type: Boolean,
    default: false,
  },
  isCheckboxMode: {
    type: Boolean,
    default: false,
  },
  isSelected: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["click", "download", "rename", "delete", "select"]);

// 处理点击事件
const handleClick = () => {
  emit("click", props.item);
};

// 添加选择功能
const toggleSelect = () => {
  emit("select", props.item, !props.isSelected);
};

/**
 * 格式化文件大小
 * @param {number} bytes - 文件大小（字节）
 * @returns {string} 格式化后的文件大小
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 B";

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
</script>
