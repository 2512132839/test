<template>
  <div>
    <!-- 列表视图的表头 -->
    <div
      v-if="viewMode === 'list'"
      class="grid items-center py-2 px-3 border-b border-t"
      :class="[
        darkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-100 border-gray-200',
        isCheckboxMode ? 'grid-cols-[auto_auto_1fr_auto] sm:grid-cols-[auto_auto_1fr_auto_auto_auto]' : 'grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_auto_auto_auto]',
      ]"
    >
      <!-- 全选勾选框 -->
      <div v-if="isCheckboxMode" class="mr-1.5 sm:mr-2 flex justify-center">
        <input
          type="checkbox"
          :checked="isAllSelected"
          @change="toggleSelectAll(!isAllSelected)"
          class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          :class="darkMode ? 'bg-gray-700 border-gray-500' : ''"
        />
      </div>
      <div class="mr-2 sm:mr-3 font-medium text-center" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">{{ t("mount.fileList.type") }}</div>

      <!-- 可排序的名称列 -->
      <div
        class="font-medium cursor-pointer select-none flex items-center hover:opacity-75 transition-opacity"
        :class="darkMode ? 'text-gray-300' : 'text-gray-700'"
        @click="handleSort('name')"
        title="点击排序"
      >
        <span class="truncate">{{ t("mount.fileList.name") }}</span>
        <!-- 排序图标 -->
        <svg v-if="getSortIcon('name')" class="ml-1 w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path
            v-if="sortField === 'name' && sortOrder === 'asc'"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
          />
          <path v-else d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
        </svg>
        <!-- 默认排序提示图标 -->
        <svg v-else class="ml-1 w-3 h-3 flex-shrink-0 opacity-40" fill="currentColor" viewBox="0 0 20 20">
          <path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1zM3 16a1 1 0 011-1h4a1 1 0 110 2H4a1 1 0 01-1-1z" />
        </svg>
      </div>

      <!-- 可排序的大小列 -->
      <div
        class="min-w-24 text-center font-medium hidden sm:flex cursor-pointer select-none items-center justify-center hover:opacity-75 transition-opacity"
        :class="darkMode ? 'text-gray-300' : 'text-gray-700'"
        @click="handleSort('size')"
        title="点击排序"
      >
        <span>{{ t("mount.fileList.size") }}</span>
        <!-- 排序图标 -->
        <svg v-if="getSortIcon('size')" class="ml-1 w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path
            v-if="sortField === 'size' && sortOrder === 'asc'"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
          />
          <path v-else d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
        </svg>
        <!-- 默认排序提示图标 -->
        <svg v-else class="ml-1 w-3 h-3 flex-shrink-0 opacity-40" fill="currentColor" viewBox="0 0 20 20">
          <path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1zM3 16a1 1 0 011-1h4a1 1 0 110 2H4a1 1 0 01-1-1z" />
        </svg>
      </div>

      <!-- 可排序的修改时间列 -->
      <div
        class="min-w-36 text-center font-medium hidden sm:flex cursor-pointer select-none items-center justify-center hover:opacity-75 transition-opacity"
        :class="darkMode ? 'text-gray-300' : 'text-gray-700'"
        @click="handleSort('modified')"
        title="点击排序"
      >
        <span>{{ t("mount.fileList.modifiedTime") }}</span>
        <!-- 排序图标 -->
        <svg v-if="getSortIcon('modified')" class="ml-1 w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path
            v-if="sortField === 'modified' && sortOrder === 'asc'"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
          />
          <path v-else d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
        </svg>
        <!-- 默认排序提示图标 -->
        <svg v-else class="ml-1 w-3 h-3 flex-shrink-0 opacity-40" fill="currentColor" viewBox="0 0 20 20">
          <path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1zM3 16a1 1 0 011-1h4a1 1 0 110 2H4a1 1 0 01-1-1z" />
        </svg>
      </div>

      <div class="min-w-[80px] sm:min-w-32 text-center font-medium" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">{{ t("mount.fileList.actions") }}</div>
    </div>

    <div v-if="loading" class="py-8 flex flex-col items-center justify-center" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
      <!-- 加载指示器 -->
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 mb-2" :class="darkMode ? 'border-primary-500' : 'border-primary-600'"></div>
      <div>{{ t("mount.fileList.loading") }}</div>
    </div>

    <div v-else-if="!items.length" class="py-8 flex flex-col items-center justify-center" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
      <svg class="w-12 h-12 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
        />
      </svg>
      <div>{{ isVirtual ? t("mount.fileList.noMountPoints") : t("mount.fileList.empty") }}</div>
    </div>

    <div v-else>
      <!-- 列表视图 -->
      <div v-if="viewMode === 'list'">
        <FileItem
          v-for="item in sortedItems"
          :key="item.path"
          :item="item"
          :dark-mode="darkMode"
          :is-checkbox-mode="isCheckboxMode"
          :is-selected="isItemSelected(item)"
          @click="handleItemClick(item)"
          @download="handleDownload"
          @rename="handleRename"
          @delete="handleDelete"
          @select="handleItemSelect"
          @getLink="handleGetLink"
        />
      </div>

      <!-- 网格视图 -->
      <div v-else-if="viewMode === 'grid'" class="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        <div
          v-for="item in sortedItems"
          :key="item.path"
          class="relative flex flex-col items-center p-2 sm:p-3 rounded-lg transition-colors hover:cursor-pointer group"
          :class="darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100'"
          @click="handleItemClick(item)"
        >
          <!-- 勾选框 (仅在勾选模式下显示) -->
          <div v-if="isCheckboxMode" class="absolute top-1 left-1 z-10" @click.stop="toggleItemSelect(item)">
            <input
              type="checkbox"
              :checked="isItemSelected(item)"
              class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              :class="darkMode ? 'bg-gray-700 border-gray-500' : ''"
            />
          </div>

          <!-- 文件/文件夹图标 -->
          <div class="mb-2 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12">
            <span v-html="getFileIcon(item, darkMode)"></span>
          </div>

          <!-- 文件/文件夹名称 -->
          <div class="text-center truncate w-full text-xs sm:text-sm md:text-base" :class="darkMode ? 'text-gray-200' : 'text-gray-700'" :title="item.name">
            {{ item.name }}
          </div>

          <!-- 操作按钮 -->
          <div class="mt-2 flex space-x-0.5 sm:space-x-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <!-- 下载按钮 (仅文件) -->
            <button
              v-if="!item.isDirectory"
              @click.stop="handleDownload(item)"
              class="p-1 sm:p-1 rounded-full"
              :class="darkMode ? 'hover:bg-gray-600 text-gray-300' : 'hover:bg-gray-200 text-gray-600'"
            >
              <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>

            <!-- 直链按钮 (仅文件) -->
            <button
              v-if="!item.isDirectory"
              @click.stop="handleGetLink(item)"
              class="p-1 sm:p-1 rounded-full"
              :class="darkMode ? 'hover:bg-gray-600 text-gray-300' : 'hover:bg-gray-200 text-gray-600'"
            >
              <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.172 13.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102-1.101" />
              </svg>
            </button>

            <!-- 重命名按钮 - 只对文件显示，文件夹暂时不显示重命名按钮 -->
            <button
              v-if="!item.isDirectory"
              @click.stop="handleRename(item)"
              class="p-1 sm:p-1 rounded-full"
              :class="darkMode ? 'hover:bg-gray-600 text-gray-300' : 'hover:bg-gray-200 text-gray-600'"
            >
              <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            </button>

            <!-- 删除按钮 -->
            <button @click.stop="handleDelete(item)" class="p-1 sm:p-1 rounded-full" :class="darkMode ? 'hover:bg-gray-600 text-gray-300' : 'hover:bg-gray-200 text-gray-600'">
              <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>

          <!-- 文件大小与修改时间提示 -->
          <div class="mt-1 text-xs text-center" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
            <span v-if="item.isDirectory && item.isVirtual">-</span>
            <span v-else>{{ formatFileSize(item.size || 0) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 重命名对话框 -->
    <div v-if="showRenameDialog" class="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center">
      <div class="relative w-full max-w-md p-6 rounded-lg shadow-xl" :class="darkMode ? 'bg-gray-800' : 'bg-white'">
        <div class="mb-4">
          <h3 class="text-lg font-semibold" :class="darkMode ? 'text-gray-100' : 'text-gray-900'">{{ t("mount.rename.title") }}</h3>
          <p class="text-sm mt-1" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ t("mount.rename.enterNewName") }}</p>
        </div>

        <div class="mb-4">
          <label for="new-name" class="block text-sm font-medium mb-1" :class="darkMode ? 'text-gray-300' : 'text-gray-700'"> {{ t("mount.rename.newName") }} </label>
          <input
            id="new-name"
            v-model="newName"
            type="text"
            class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            :class="darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'"
            @keyup.enter="confirmRename"
            ref="renameInput"
          />
        </div>

        <div class="flex justify-end space-x-2">
          <button
            @click="showRenameDialog = false"
            class="px-4 py-2 rounded-md transition-colors"
            :class="darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'"
          >
            {{ t("mount.rename.cancel") }}
          </button>
          <button
            @click="confirmRename"
            class="px-4 py-2 rounded-md text-white transition-colors"
            :class="darkMode ? 'bg-primary-600 hover:bg-primary-700' : 'bg-primary-500 hover:bg-primary-600'"
          >
            {{ t("mount.rename.confirm") }}
          </button>
        </div>
      </div>
    </div>

    <!-- 删除确认对话框 -->
    <div v-if="showDeleteDialog" class="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center">
      <div class="relative w-full max-w-md p-6 rounded-lg shadow-xl" :class="darkMode ? 'bg-gray-800' : 'bg-white'">
        <div class="mb-4">
          <h3 class="text-lg font-semibold" :class="darkMode ? 'text-gray-100' : 'text-gray-900'">{{ t("mount.delete.title") }}</h3>
          <p class="text-sm mt-1" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
            {{
              t("mount.delete.message", {
                type: itemToDelete?.isDirectory ? t("mount.fileTypes.folder") : t("mount.fileTypes.file"),
                name: itemToDelete?.name,
              })
            }}
            {{ itemToDelete?.isDirectory ? t("mount.delete.folderWarning") : "" }}
          </p>
        </div>

        <div class="flex justify-end space-x-2">
          <button
            @click="showDeleteDialog = false"
            class="px-4 py-2 rounded-md transition-colors"
            :class="darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'"
          >
            {{ t("mount.delete.cancel") }}
          </button>
          <button @click="confirmDelete" class="px-4 py-2 rounded-md text-white transition-colors bg-red-600 hover:bg-red-700">{{ t("mount.delete.confirm") }}</button>
        </div>
      </div>
    </div>

    <!-- 链接复制成功通知 -->
    <div v-if="showLinkCopiedNotification" class="fixed bottom-4 right-4 z-50">
      <div
        class="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-md transition-all duration-300"
        :class="{ 'opacity-100': showLinkCopiedNotification, 'opacity-0': !showLinkCopiedNotification }"
      >
        <div class="flex items-center">
          <svg class="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <p>{{ t("mount.linkCopied") }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, inject, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import FileItem from "./FileItem.vue";
import { getFileIcon } from "../../utils/fileTypeIcons";
import { api } from "../../api";
import { copyToClipboard } from "@/utils/clipboard";

const { t } = useI18n();

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
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
    default: "list", // 'list' 或 'grid'
  },
  isCheckboxMode: {
    type: Boolean,
    default: false,
  },
  selectedItems: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["navigate", "download", "rename", "delete", "preview", "item-select", "toggle-select-all"]);

// 排序状态
const sortField = ref("name"); // 当前排序字段：'name', 'size', 'modified'
const sortOrder = ref("default"); // 当前排序顺序：'asc', 'desc', 'default'

// 排序字段的状态循环：default -> asc -> desc -> default
const sortStates = ["default", "asc", "desc"];

// 初始化排序状态（从localStorage恢复）
const initializeSortState = () => {
  try {
    const savedSortField = localStorage.getItem("file_explorer_sort_field");
    const savedSortOrder = localStorage.getItem("file_explorer_sort_order");

    if (savedSortField && ["name", "size", "modified"].includes(savedSortField)) {
      sortField.value = savedSortField;
    }

    if (savedSortOrder && sortStates.includes(savedSortOrder)) {
      sortOrder.value = savedSortOrder;
    }
  } catch (error) {
    console.warn("恢复排序状态失败:", error);
  }
};

// 保存排序状态到localStorage
const saveSortState = () => {
  try {
    localStorage.setItem("file_explorer_sort_field", sortField.value);
    localStorage.setItem("file_explorer_sort_order", sortOrder.value);
  } catch (error) {
    console.warn("保存排序状态失败:", error);
  }
};

// 点击表头排序
const handleSort = (field) => {
  if (sortField.value === field) {
    // 同一字段，切换排序状态
    const currentIndex = sortStates.indexOf(sortOrder.value);
    const nextIndex = (currentIndex + 1) % sortStates.length;
    sortOrder.value = sortStates[nextIndex];
  } else {
    // 不同字段，重置为升序
    sortField.value = field;
    sortOrder.value = "asc";
  }

  // 保存排序状态
  saveSortState();
};

// 获取排序图标
const getSortIcon = (field) => {
  if (sortField.value !== field || sortOrder.value === "default") {
    return ""; // 默认状态不显示图标
  }
  return sortOrder.value === "asc" ? "↑" : "↓";
};

// 排序后的项目列表
const sortedItems = computed(() => {
  let items = [...props.items];

  // 如果是默认排序，按名称排序
  if (sortOrder.value === "default") {
    return items.sort((a, b) => {
      // 先按类型排序（目录在前，文件在后）
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      // 再按名称字母排序
      return a.name.localeCompare(b.name);
    });
  }

  // 自定义排序
  return items.sort((a, b) => {
    // 文件夹始终优先（除非两个都是文件夹或都是文件）
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;

    let comparison = 0;

    switch (sortField.value) {
      case "name":
        comparison = a.name.localeCompare(b.name);
        break;
      case "size":
        // 虚拟目录的大小视为0
        const aSize = a.isDirectory && a.isVirtual ? 0 : a.size || 0;
        const bSize = b.isDirectory && b.isVirtual ? 0 : b.size || 0;
        comparison = aSize - bSize;
        break;
      case "modified":
        // 虚拟目录没有修改时间，视为最早
        const aTime = a.isDirectory && a.isVirtual ? 0 : new Date(a.modified || 0).getTime();
        const bTime = b.isDirectory && b.isVirtual ? 0 : new Date(b.modified || 0).getTime();
        comparison = aTime - bTime;
        break;
      default:
        comparison = a.name.localeCompare(b.name);
    }

    return sortOrder.value === "asc" ? comparison : -comparison;
  });
});

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// 导入统一的时间处理工具
import { formatDateTime } from "../../utils/timeUtils.js";

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return "";
  return formatDateTime(dateString);
};

// 判断一个项目是否被选中
const isItemSelected = (item) => {
  return props.selectedItems.some((selectedItem) => selectedItem.path === item.path);
};

// 判断是否全部选中
const isAllSelected = computed(() => {
  return props.items.length > 0 && props.items.every((item) => isItemSelected(item));
});

// 切换单个项目的选中状态
const toggleItemSelect = (item) => {
  emit("item-select", item, !isItemSelected(item));
};

// 全选/取消全选
const toggleSelectAll = (select) => {
  emit("toggle-select-all", select);
};

// 处理文件/文件夹点击
const handleItemClick = (item) => {
  if (props.isCheckboxMode) {
    // 在勾选模式下，点击项目切换选中状态
    toggleItemSelect(item);
  } else {
    // 正常模式下的处理
    if (item.isDirectory) {
      // 对于目录，导航进入
      emit("navigate", item.path);
    } else {
      // 对于文件，触发预览
      emit("preview", item);
    }
  }
};

// 处理下载
const handleDownload = (item) => {
  emit("download", item);
};

// 重命名相关
const showRenameDialog = ref(false);
const itemToRename = ref(null);
const newName = ref("");
const renameInput = ref(null);

// 处理重命名
const handleRename = (item) => {
  itemToRename.value = item;
  newName.value = item.name;
  showRenameDialog.value = true;

  // 在下一个DOM更新周期聚焦输入框
  nextTick(() => {
    renameInput.value?.focus();
  });
};

// 确认重命名
const confirmRename = () => {
  if (newName.value.trim() && itemToRename.value) {
    emit("rename", {
      item: itemToRename.value,
      newName: newName.value.trim(),
    });
    showRenameDialog.value = false;
  }
};

// 删除相关
const showDeleteDialog = ref(false);
const itemToDelete = ref(null);

// 处理删除
const handleDelete = (item) => {
  itemToDelete.value = item;
  showDeleteDialog.value = true;
};

// 确认删除
const confirmDelete = () => {
  if (itemToDelete.value) {
    emit("delete", itemToDelete.value);
    showDeleteDialog.value = false;
  }
};

// 处理项目选择
const handleItemSelect = (item, selected) => {
  emit("item-select", item, selected);
};

// 处理文件直链获取
const showLinkCopiedNotification = ref(false);

// 判断当前用户类型（是管理员还是普通用户）
const isAdmin = inject("isAdmin", ref(true)); // 默认为管理员

const handleGetLink = async (item) => {
  if (item.isDirectory) return; // 文件夹不提供直链

  try {
    const getFileLink = isAdmin.value ? api.admin.getFileLink : api.user.fs.getFileLink;
    const response = await getFileLink(item.path, 86400, true);

    if (response.success && response.data?.presignedUrl) {
      // 复制链接到剪贴板
      const success = await copyToClipboard(response.data.presignedUrl);

      if (success) {
        // 显示通知
        showLinkCopiedNotification.value = true;

        // 3秒后隐藏通知
        setTimeout(() => {
          showLinkCopiedNotification.value = false;
        }, 3000);
      } else {
        throw new Error("复制失败");
      }
    } else {
      console.error("获取文件直链失败:", response);
      alert("获取文件直链失败: " + (response.message || "未知错误"));
    }
  } catch (error) {
    console.error("获取文件直链错误:", error);
    alert("获取文件直链错误: " + (error.message || "未知错误"));
  }
};

// 组件挂载时初始化排序状态
onMounted(() => {
  initializeSortState();
});
</script>
