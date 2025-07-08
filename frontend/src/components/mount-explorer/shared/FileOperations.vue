<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-2 py-2">
      <!-- 左侧操作按钮组 -->
      <div class="flex items-center space-x-2">
        <!-- 上传文件按钮 -->
        <button
          v-if="!isVirtual"
          @click="openUploadFileDialog"
          class="inline-flex items-center px-3 py-1.5 rounded-md transition-colors text-sm font-medium"
          :class="darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'"
        >
          <svg class="w-4 h-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span>{{ t("mount.operations.upload") }}</span>
        </button>

        <!-- 新建文件夹按钮 -->
        <button
          v-if="!isVirtual"
          @click="createFolder"
          class="inline-flex items-center px-3 py-1.5 rounded-md transition-colors text-sm font-medium"
          :class="darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'"
        >
          <svg class="w-4 h-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          <span>{{ t("mount.operations.createFolder") }}</span>
        </button>
      </div>

      <!-- 右侧视图操作按钮组 -->
      <div class="flex items-center space-x-2">
        <!-- 文件篮按钮 -->
        <div class="mr-2">
          <FileBasket :dark-mode="darkMode" @task-created="$emit('task-created', $event)" @show-message="$emit('show-message', $event)" />
        </div>

        <!-- 任务管理按钮 -->
        <button
          @click="$emit('openTasksModal')"
          class="inline-flex items-center px-3 py-1.5 rounded-md transition-colors text-sm font-medium mr-2"
          :class="darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'"
        >
          <svg class="w-4 h-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <span>{{ t("mount.operations.tasks") }}</span>
        </button>

        <!-- 视图切换按钮组 -->
        <div class="flex rounded-md overflow-hidden border" :class="darkMode ? 'border-gray-700' : 'border-gray-300'">
          <!-- 列表视图按钮 -->
          <button
            @click="changeViewMode('list')"
            class="inline-flex items-center px-2 py-1.5 transition-colors text-sm"
            :class="[viewMode === 'list' ? (darkMode ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-800') : darkMode ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500']"
          >
            <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <!-- 网格视图按钮 -->
          <button
            @click="changeViewMode('grid')"
            class="inline-flex items-center px-2 py-1.5 transition-colors text-sm"
            :class="[viewMode === 'grid' ? (darkMode ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-800') : darkMode ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500']"
          >
            <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
          </button>

          <!-- 图廊视图按钮 -->
          <button
            @click="changeViewMode('gallery')"
            class="inline-flex items-center px-2 py-1.5 transition-colors text-sm"
            :class="[
              viewMode === 'gallery' ? (darkMode ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-800') : darkMode ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500',
            ]"
          >
            <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </button>
        </div>

        <!-- 刷新按钮 -->
        <button
          @click="$emit('refresh')"
          class="inline-flex items-center px-3 py-1.5 rounded-md transition-colors text-sm font-medium"
          :class="darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'"
        >
          <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- 新建文件夹对话框 -->
    <div v-if="showCreateFolderDialog" class="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center">
      <div class="relative w-full max-w-md p-6 rounded-lg shadow-xl" :class="darkMode ? 'bg-gray-800' : 'bg-white'">
        <div class="mb-4">
          <h3 class="text-lg font-semibold" :class="darkMode ? 'text-gray-100' : 'text-gray-900'">{{ t("mount.operations.createFolder") }}</h3>
          <p class="text-sm mt-1" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ t("mount.createFolder.enterName") }}</p>
        </div>

        <div class="mb-4">
          <label for="folder-name" class="block text-sm font-medium mb-1" :class="darkMode ? 'text-gray-300' : 'text-gray-700'"> {{ t("mount.createFolder.folderName") }} </label>
          <input
            id="folder-name"
            v-model="newFolderName"
            type="text"
            class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            :class="darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'"
            :placeholder="t('mount.createFolder.placeholder')"
            @keyup.enter="confirmCreateFolder"
            ref="folderNameInput"
          />
        </div>

        <div class="flex justify-end space-x-2">
          <button
            @click="showCreateFolderDialog = false"
            class="px-4 py-2 rounded-md transition-colors"
            :class="darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'"
          >
            {{ t("mount.createFolder.cancel") }}
          </button>
          <button
            @click="confirmCreateFolder"
            class="px-4 py-2 rounded-md text-white transition-colors"
            :class="darkMode ? 'bg-primary-600 hover:bg-primary-700' : 'bg-primary-500 hover:bg-primary-600'"
          >
            {{ t("mount.createFolder.create") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import FileBasket from "./FileBasket.vue";

const { t } = useI18n();

const props = defineProps({
  currentPath: {
    type: String,
    required: true,
    default: "/",
  },
  isVirtual: {
    type: Boolean,
    default: false,
  },
  darkMode: {
    type: Boolean,
    default: false,
  },
  viewMode: {
    type: String,
    default: "list", // 'list' | 'grid' | 'gallery'
  },
  selectedItems: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["upload", "createFolder", "refresh", "changeViewMode", "openUploadModal", "openCopyModal", "openTasksModal", "task-created", "show-message"]);

// 视图模式切换
const changeViewMode = (mode) => {
  emit("changeViewMode", mode);
};

// 打开文件上传对话框
const openUploadFileDialog = () => {
  emit("openUploadModal");
};

// 打开复制对话框
const openCopyModal = () => {
  emit("openCopyModal");
};

// 新建文件夹相关
const showCreateFolderDialog = ref(false);
const newFolderName = ref("");
const folderNameInput = ref(null);

// 显示新建文件夹对话框
const createFolder = () => {
  newFolderName.value = "";
  showCreateFolderDialog.value = true;

  // 在下一个DOM更新周期聚焦输入框
  nextTick(() => {
    folderNameInput.value?.focus();
  });
};

// 确认创建文件夹
const confirmCreateFolder = () => {
  if (newFolderName.value.trim()) {
    emit("createFolder", {
      name: newFolderName.value.trim(),
      path: props.currentPath,
    });
    showCreateFolderDialog.value = false;
  }
};
</script>
