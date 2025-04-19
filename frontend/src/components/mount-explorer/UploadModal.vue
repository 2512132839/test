<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center">
    <div class="relative w-full max-w-5xl h-auto min-h-[500px] max-h-[80vh] rounded-lg shadow-xl flex flex-col" :class="darkMode ? 'bg-gray-800' : 'bg-white'">
      <!-- 弹窗标题栏 -->
      <div class="p-4 flex justify-between items-center border-b" :class="darkMode ? 'border-gray-700' : 'border-gray-200'">
        <h3 class="text-lg font-semibold" :class="darkMode ? 'text-gray-100' : 'text-gray-900'">上传文件</h3>
        <button
            @click="closeModal"
            class="p-1 rounded-full transition-colors"
            :class="darkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 弹窗内容区 -->
      <div class="flex-1 p-4 overflow-y-auto">
        <!-- 上传方式选择 -->
        <div class="mb-4 flex items-center justify-between p-3 rounded-lg" :class="darkMode ? 'bg-gray-700/50' : 'bg-gray-100'">
          <div class="flex items-center">
            <span class="text-sm font-medium mr-2" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">上传方式:</span>
            <div class="flex space-x-4">
              <label class="flex items-center cursor-pointer">
                <input
                    type="radio"
                    name="uploadMethod"
                    value="presigned"
                    v-model="uploadMethod"
                    class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 dark:bg-gray-700 dark:border-gray-600"
                    :disabled="isUploading"
                />
                <span class="ml-2 text-sm" :class="darkMode ? 'text-gray-300' : 'text-gray-600'">
                  预签名直传
                  <span class="text-xs px-1 py-0.5 rounded" :class="darkMode ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'"> 推荐 </span>
                </span>
              </label>
              <label class="flex items-center cursor-pointer">
                <input
                    type="radio"
                    name="uploadMethod"
                    value="direct"
                    v-model="uploadMethod"
                    class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 dark:bg-gray-700 dark:border-gray-600"
                    :disabled="isUploading"
                />
                <span class="ml-2 text-sm" :class="darkMode ? 'text-gray-300' : 'text-gray-600'">直接上传</span>
              </label>
              <label class="flex items-center cursor-pointer">
                <input
                    type="radio"
                    name="uploadMethod"
                    value="multipart"
                    v-model="uploadMethod"
                    class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 dark:bg-gray-700 dark:border-gray-600"
                    :disabled="isUploading"
                />
                <span class="ml-2 text-sm" :class="darkMode ? 'text-gray-300' : 'text-gray-600'">分片上传</span>
              </label>
            </div>
          </div>
          <div>
            <span
                class="text-xs px-2 py-1 rounded-full cursor-help"
                :class="
                uploadMethod === 'direct'
                  ? darkMode
                    ? 'bg-green-900/30 text-green-300'
                    : 'bg-green-100 text-green-700'
                  : uploadMethod === 'presigned'
                  ? darkMode
                    ? 'bg-blue-900/30 text-blue-300'
                    : 'bg-blue-100 text-blue-700'
                  : darkMode
                  ? 'bg-amber-900/30 text-amber-300'
                  : 'bg-amber-100 text-amber-700'
              "
                :title="
                uploadMethod === 'direct'
                  ? '通过服务器直接上传，不显示进度条，适合小文件'
                  : uploadMethod === 'presigned'
                  ? '直接上传到存储服务器，避免Worker CPU限制，速度更快'
                  : '通过服务器分片上传，适合大文件或不稳定网络环境'
              "
            >
              {{ uploadMethod === "direct" ? "直接模式" : uploadMethod === "presigned" ? "直传模式" : "分片模式" }}
            </span>
          </div>
        </div>

        <!-- 文件拖放区域 -->
        <div
            class="drop-zone mb-4 border-2 border-dashed rounded-lg flex flex-col items-center justify-center py-8 px-4 cursor-pointer transition-all duration-300"
            :class="[
            darkMode ? 'border-gray-600 hover:border-gray-500 bg-gray-800/30' : 'border-gray-300 hover:border-gray-400 bg-gray-50',
            isDragging ? (darkMode ? 'border-blue-500 bg-blue-500/10 pulsing-border' : 'border-blue-500 bg-blue-50 pulsing-border') : '',
          ]"
            @dragenter.prevent="onDragOver"
            @dragover.prevent="onDragOver"
            @dragleave.prevent="onDragLeave"
            @drop.prevent="onDrop"
            @click="triggerFileInput"
        >
          <div class="icon-container mb-3">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-12 w-12 transition-colors duration-300"
                :class="[darkMode ? 'text-gray-400' : 'text-gray-500', isDragging ? (darkMode ? 'text-blue-400' : 'text-blue-500') : '']"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div class="text-center">
            <p
                class="text-base font-medium transition-colors duration-300"
                :class="[darkMode ? 'text-gray-300' : 'text-gray-700', isDragging ? (darkMode ? 'text-blue-300' : 'text-blue-700') : '']"
            >
              {{ isDragging ? "拖放文件到这里" : "点击或拖动文件到这里上传" }}
            </p>
            <p class="text-sm mt-1 transition-colors duration-300" :class="[darkMode ? 'text-gray-400' : 'text-gray-500']">
              <span class="px-1.5 py-0.5 rounded text-xs" :class="darkMode ? 'bg-gray-700 text-blue-300' : 'bg-gray-200 text-blue-600'"> 支持多文件上传 </span>
            </p>
            <p class="text-xs mt-2 transition-colors duration-300" :class="darkMode ? 'text-gray-500' : 'text-gray-500'">
              <span class="inline-flex items-center">
                <svg class="h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                支持 Ctrl+V 粘贴文件
              </span>
            </p>
          </div>
          <input ref="fileInput" type="file" class="hidden" multiple @change="onFileSelected" />
        </div>

        <!-- 已选文件列表 -->
        <div v-if="selectedFiles.length > 0" class="selected-files mb-4">
          <div class="files-header flex justify-between items-center mb-3">
            <h3 class="text-base font-medium" :class="darkMode ? 'text-gray-200' : 'text-gray-700'">已选择 {{ selectedFiles.length }} 个文件</h3>
            <button
                type="button"
                @click="clearAllFiles"
                class="text-sm px-2 py-1 rounded transition-colors flex items-center"
                :class="darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'"
                :disabled="isUploading"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              清除全部
            </button>
          </div>
          <div class="files-list max-h-60 overflow-y-auto">
            <div
                v-for="(file, index) in selectedFiles"
                :key="index"
                class="selected-file mb-3 flex items-center p-3 rounded-md"
                :class="[
                darkMode ? 'bg-gray-700/50' : 'bg-gray-100',
                fileItems[index]?.status === 'error' ? (darkMode ? 'border-l-4 border-red-500' : 'border-l-4 border-red-500') : '',
                fileItems[index]?.status === 'success' ? (darkMode ? 'border-l-4 border-green-500' : 'border-l-4 border-green-500') : '',
                fileItems[index]?.status === 'uploading' ? (darkMode ? 'border-l-4 border-blue-500' : 'border-l-4 border-blue-500') : '',
              ]"
            >
              <div class="file-icon mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" :class="darkMode ? 'text-gray-300' : 'text-gray-600'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div class="file-info flex-grow mr-3">
                <div class="font-medium truncate" :class="darkMode ? 'text-white' : 'text-gray-900'">
                  {{ file.name }}
                </div>
                <div class="flex justify-between">
                  <span class="text-sm" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
                    {{ formatFileSize(file.size) }}
                  </span>

                  <!-- 文件状态显示 -->
                  <span
                      v-if="fileItems[index]"
                      class="text-xs ml-2 px-2 py-0.5 rounded-full"
                      :class="{
                      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300': fileItems[index].status === 'pending',
                      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300': fileItems[index].status === 'uploading',
                      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300': fileItems[index].status === 'success',
                      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300': fileItems[index].status === 'error',
                    }"
                  >
                    {{
                      fileItems[index].status === "pending"
                          ? "待上传"
                          : fileItems[index].status === "uploading"
                              ? `${fileItems[index].progress}%`
                              : fileItems[index].status === "success"
                                  ? "上传成功"
                                  : fileItems[index].status === "error"
                                      ? "上传失败"
                                      : ""
                    }}
                  </span>
                </div>

                <!-- 单个文件进度条 -->
                <div v-if="fileItems[index]?.status === 'uploading'" class="w-full bg-gray-200 rounded-full h-1.5 mt-1 dark:bg-gray-700">
                  <div
                      class="h-1.5 rounded-full transition-all duration-200"
                      :class="fileItems[index].progress >= 95 ? 'bg-green-500' : 'bg-blue-500'"
                      :style="{ width: `${fileItems[index].progress}%` }"
                  ></div>
                </div>
                <!-- 错误信息 -->
                <div v-if="fileItems[index]?.status === 'error' && fileItems[index]?.message" class="text-xs mt-1 text-red-500">
                  {{ fileItems[index].message }}
                </div>
              </div>
              <!-- 取消上传按钮，仅在上传状态显示 -->
              <button
                  v-if="fileItems[index]?.status === 'uploading'"
                  type="button"
                  @click="cancelSingleUpload(index)"
                  class="p-1 rounded-full hover:bg-opacity-20 transition-colors mr-1"
                  :class="darkMode ? 'hover:bg-red-900/60 text-gray-400 hover:text-red-300' : 'hover:bg-red-100 text-gray-500 hover:text-red-500'"
                  title="取消上传"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19V5M5 12l7-7 7 7" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4L20 20" stroke="red" />
                </svg>
              </button>
              <!-- 重试按钮，仅在错误状态显示 -->
              <button
                  v-if="fileItems[index]?.status === 'error'"
                  type="button"
                  @click="retryUpload(index)"
                  class="p-1 rounded-full hover:bg-opacity-20 transition-colors mr-1"
                  :class="darkMode ? 'hover:bg-gray-600 text-gray-400' : 'hover:bg-gray-200 text-gray-500'"
                  title="重试"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
              <!-- 删除按钮 -->
              <button
                  type="button"
                  @click="clearSelectedFile(index)"
                  class="p-1 rounded-full hover:bg-opacity-20 transition-colors"
                  :class="darkMode ? 'hover:bg-gray-600 text-gray-400' : 'hover:bg-gray-200 text-gray-500'"
                  title="移除"
                  :disabled="fileItems[index]?.status === 'uploading'"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- 总上传进度 -->
        <div v-if="isUploading" class="mb-4">
          <div class="flex justify-between items-center mb-1">
            <span class="text-sm font-medium" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">总进度</span>
            <span class="text-sm" :class="darkMode ? 'text-gray-400' : 'text-gray-600'">{{ totalProgress }}%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
            <div
                class="h-2.5 rounded-full transition-all duration-200 progress-stripes animate-progress-stripes"
                :class="totalProgress >= 95 ? 'bg-green-500' : 'bg-blue-500'"
                :style="{ width: `${totalProgress}%` }"
            ></div>
          </div>
          <div class="flex justify-between items-center mt-1">
            <span class="text-xs" :class="darkMode ? 'text-gray-400' : 'text-gray-500'"> 上传速度: {{ uploadSpeed }} </span>
            <span class="text-xs" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
              {{ currentUploadInfo }}
            </span>
          </div>
        </div>

        <!-- 上传消息 -->
        <div
            v-if="message && message.content"
            class="mb-4 p-3 rounded-md text-sm"
            :class="
            message.type === 'error'
              ? darkMode
                ? 'bg-red-900/40 border border-red-800 text-red-200'
                : 'bg-red-50 border border-red-200 text-red-800'
              : message.type === 'info'
              ? darkMode
                ? 'bg-blue-900/40 border border-blue-800 text-blue-200'
                : 'bg-blue-50 border border-blue-200 text-blue-800'
              : darkMode
              ? 'bg-green-900/40 border border-green-800 text-green-200'
              : 'bg-green-50 border border-green-200 text-green-800'
          "
        >
          <div class="flex items-center">
            <!-- 成功图标 -->
            <svg
                v-if="message.type === 'success'"
                class="h-5 w-5 mr-2"
                :class="darkMode ? 'text-green-300' : 'text-green-500'"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>

            <!-- 信息图标 -->
            <svg
                v-else-if="message.type === 'info'"
                class="h-5 w-5 mr-2"
                :class="darkMode ? 'text-blue-300' : 'text-blue-500'"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>

            <!-- 错误图标 -->
            <svg v-else class="h-5 w-5 mr-2" :class="darkMode ? 'text-red-300' : 'text-red-500'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>

            {{ message.content }}
          </div>
        </div>
      </div>

      <!-- 弹窗底部按钮 -->
      <div class="p-4 flex justify-end items-center gap-3 border-t" :class="darkMode ? 'border-gray-700' : 'border-gray-200'">
        <button
            @click="closeModal"
            class="px-4 py-2 rounded-md transition-colors"
            :class="darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'"
            :disabled="isUploading"
        >
          取消
        </button>
        <button v-if="isUploading" @click="cancelUpload" class="px-4 py-2 rounded-md text-white transition-colors bg-red-500 hover:bg-red-600">取消上传</button>
        <button
            v-else
            @click="submitUpload"
            class="px-4 py-2 rounded-md text-white transition-colors"
            :class="darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'"
            :disabled="!hasFilesToUpload"
        >
          开始上传
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onBeforeUnmount } from "vue";
import { api } from "../../api";

// 组件属性
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  darkMode: {
    type: Boolean,
    default: false,
  },
  currentPath: {
    type: String,
    required: true,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
});

// 事件
const emit = defineEmits(["close", "upload-success", "upload-error"]);

// 文件上传状态
const selectedFiles = ref([]);
const fileItems = ref([]);
const fileInput = ref(null);
const isDragging = ref(false);
const isUploading = ref(false);
const uploadProgress = ref(0);
const totalProgress = ref(0);
const cancelUploadFlag = ref(false);
const currentUploadIndex = ref(-1);
const message = ref(null);
const uploadSpeed = ref("");
const lastLoaded = ref(0);
const lastTime = ref(0);
const uploadMethod = ref("presigned");

// 计算属性
const hasFilesToUpload = computed(() => {
  return selectedFiles.value.length > 0 && fileItems.value.some((item) => item.status !== "success");
});

const currentUploadInfo = computed(() => {
  if (currentUploadIndex.value >= 0 && currentUploadIndex.value < selectedFiles.value.length) {
    const current = currentUploadIndex.value + 1;
    const total = selectedFiles.value.length;
    const fileName = selectedFiles.value[currentUploadIndex.value].name;
    return `正在上传 ${current}/${total}: ${fileName}`;
  }
  return "";
});

// 生命周期钩子
onMounted(async () => {
  try {
    // 添加全局粘贴事件监听器
    window.addEventListener("paste", handlePaste);
  } catch (error) {
    console.error("获取最大上传大小失败:", error);
  }
});

// 组件卸载时移除事件监听器
onBeforeUnmount(() => {
  window.removeEventListener("paste", handlePaste);
});

// 处理粘贴事件
const handlePaste = (event) => {
  // 如果弹窗未打开，不处理粘贴事件
  if (!props.isOpen) return;

  // 检查剪贴板中是否包含文件
  const items = (event.clipboardData || event.originalEvent.clipboardData).items;
  let hasAddedFiles = false;

  for (const item of items) {
    if (item.kind === "file") {
      const file = item.getAsFile();
      if (file) {
        // 检查文件是否已经在列表中
        const isFileAlreadyAdded = selectedFiles.value.some((existingFile) => existingFile.name === file.name && existingFile.size === file.size);

        if (!isFileAlreadyAdded) {
          selectedFiles.value.push(file);
          fileItems.value.push({
            file,
            progress: 0,
            status: "pending",
            message: "",
            fileId: null,
            xhr: null,
          });
          hasAddedFiles = true;
        }
      }
    }
  }

  // 如果成功添加了文件，显示提示
  if (hasAddedFiles) {
    showMessage("success", "已从剪贴板添加文件");
  }
};

// 方法
const closeModal = () => {
  if (isUploading.value) {
    if (confirm("正在上传文件，确定要取消并关闭吗？")) {
      cancelUpload();
      emit("close");
    }
  } else {
    clearAllFiles();
    emit("close");
  }
};

// 拖拽处理
const onDragOver = () => {
  isDragging.value = true;
};

const onDragLeave = (event) => {
  // 只有当鼠标离开拖拽区域而不是其内部元素时才重置
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX;
  const y = event.clientY;

  // 判断鼠标是否真的离开了整个区域
  if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
    isDragging.value = false;
  }
};

const onDrop = (event) => {
  isDragging.value = false;
  if (event.dataTransfer.files.length > 0) {
    // 处理所有拖放的文件
    Array.from(event.dataTransfer.files).forEach((file) => {
      // 检查文件是否已经在列表中（基于名称和大小）
      const isFileAlreadyAdded = selectedFiles.value.some((existingFile) => existingFile.name === file.name && existingFile.size === file.size);

      if (!isFileAlreadyAdded) {
        selectedFiles.value.push(file);

        // 初始化文件项状态
        fileItems.value.push({
          file,
          progress: 0,
          status: "pending", // pending, uploading, success, error
          message: "",
          fileId: null,
          xhr: null,
        });
      }
    });
  }
};

// 点击触发文件选择
const triggerFileInput = () => {
  fileInput.value.click();
};

// 文件选择处理
const onFileSelected = (event) => {
  if (event.target.files.length > 0) {
    // 处理所有选择的文件
    Array.from(event.target.files).forEach((file) => {
      // 检查文件是否已经在列表中（基于名称和大小）
      const isFileAlreadyAdded = selectedFiles.value.some((existingFile) => existingFile.name === file.name && existingFile.size === file.size);

      if (!isFileAlreadyAdded) {
        selectedFiles.value.push(file);

        // 初始化文件项状态
        fileItems.value.push({
          file,
          progress: 0,
          status: "pending", // pending, uploading, success, error
          message: "",
          fileId: null,
          xhr: null,
        });
      }
    });
  }
  // 清空文件输入，允许选择相同文件
  event.target.value = "";
};

// 清除选中的文件
const clearSelectedFile = (index) => {
  // 检查文件是否正在上传
  if (fileItems.value[index]?.status === "uploading") {
    return; // 不允许删除正在上传的文件
  }

  // 从数组中移除文件
  selectedFiles.value.splice(index, 1);
  fileItems.value.splice(index, 1);

  // 重置文件输入框，以便重新选择同一文件
  if (fileInput.value && selectedFiles.value.length === 0) {
    fileInput.value.value = "";
  }
};

// 清除所有文件
const clearAllFiles = () => {
  // 过滤出非上传中的文件索引
  const indicesToRemove = fileItems.value
      .map((item, index) => (item.status !== "uploading" ? index : -1))
      .filter((index) => index !== -1)
      .sort((a, b) => b - a); // 倒序排列以便从后向前删除

  // 从后向前删除文件
  for (const index of indicesToRemove) {
    selectedFiles.value.splice(index, 1);
    fileItems.value.splice(index, 1);
  }

  // 重置文件输入框，以便重新选择同一文件
  if (fileInput.value && selectedFiles.value.length === 0) {
    fileInput.value.value = "";
  }
};

// 清除已成功上传的文件
const clearSuccessfulFiles = () => {
  // 过滤出上传成功的文件索引
  const indicesToRemove = fileItems.value
      .map((item, index) => (item.status === "success" ? index : -1))
      .filter((index) => index !== -1)
      .sort((a, b) => b - a); // 倒序排列以便从后向前删除

  // 从后向前删除文件
  for (const index of indicesToRemove) {
    selectedFiles.value.splice(index, 1);
    fileItems.value.splice(index, 1);
  }

  // 如果已清空所有文件，重置文件输入框
  if (fileInput.value && selectedFiles.value.length === 0) {
    fileInput.value.value = "";
  }
};

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + " " + units[i];
};

// 显示消息
const showMessage = (type, content) => {
  message.value = { type, content };

  if (type === "error") {
    emit("upload-error", new Error(content));

    // 错误消息在4秒后自动清除
    setTimeout(() => {
      if (message.value && message.value.content === content) {
        message.value = null;
      }
    }, 4000);
  }

  // 成功和警告消息4秒后自动清除
  if (type === "success" || type === "warning") {
    setTimeout(() => {
      if (message.value && message.value.content === content) {
        message.value = null;
      }
    }, 4000);
  }
};

// 上传文件
const submitUpload = async () => {
  if (selectedFiles.value.length === 0 || isUploading.value) return;

  // 检查是否有文件可以上传（排除已上传成功的文件）
  const filesToUpload = fileItems.value.filter((item) => item.status !== "success");

  if (filesToUpload.length === 0) {
    showMessage("warning", "没有可上传的文件");
    return;
  }

  // 重置所有非成功状态的文件为待上传状态
  fileItems.value.forEach((item) => {
    if (item.status !== "success") {
      item.status = "pending";
      item.progress = 0;
      item.message = "";
      item.xhr = null;
      item.fileId = null;
      item.xhr = null;
    }
  });

  isUploading.value = true;
  uploadProgress.value = 0;
  totalProgress.value = 0;
  uploadSpeed.value = "";
  message.value = null;
  currentUploadIndex.value = -1;
  cancelUploadFlag.value = false;

  // 重置上传速度计算相关变量
  lastLoaded.value = 0;
  lastTime.value = Date.now();

  const uploadResults = [];
  const errors = [];

  try {
    // 选择适当的API函数
    const fsApi = api.fs.getFsApiByUserType(props.isAdmin);

    // 逐个上传文件
    for (let i = 0; i < fileItems.value.length; i++) {
      // 跳过已经上传成功的文件
      if (fileItems.value[i].status === "success") {
        continue;
      }

      // 检查是否取消上传
      if (cancelUploadFlag.value) {
        console.log("检测到取消标志，终止后续文件上传");
        break;
      }

      // 更新当前上传文件索引
      currentUploadIndex.value = i;
      const file = selectedFiles.value[i];
      const fileItem = fileItems.value[i];

      fileItem.status = "uploading";
      fileItem.progress = 0;

      console.log(`开始上传文件 ${i + 1}/${selectedFiles.value.length}: ${file.name} (${file.size} 字节)`);

      try {
        // 定义上传进度回调函数
        const updateProgress = (progress) => {
          // 如果文件已被取消，不再更新进度
          if (fileItem.status === "error") {
            return;
          }

          fileItem.progress = progress;

          // 计算总进度 - 包括所有活跃文件
          const activeFiles = fileItems.value.filter((item) => item.status === "uploading" || item.status === "success" || item.status === "pending");

          if (activeFiles.length > 0) {
            const totalSize = activeFiles.reduce((sum, _, idx) => sum + selectedFiles.value[idx].size, 0);
            const completedSize = selectedFiles.value.filter((_, idx) => fileItems.value[idx].status === "success").reduce((sum, f) => sum + f.size, 0);

            const currentProgress = (progress / 100) * file.size;
            totalProgress.value = Math.floor(((completedSize + currentProgress) / totalSize) * 100);
          } else {
            totalProgress.value = 0;
          }

          // 计算上传速度
          const currentTime = Date.now();
          const elapsedTime = (currentTime - lastTime.value) / 1000; // 转换为秒

          if (elapsedTime > 0.5) {
            // 每0.5秒更新一次速度
            const loadedBytes = (progress / 100) * file.size;
            const loadedSinceLastUpdate = loadedBytes - lastLoaded.value;
            const bytesPerSecond = loadedSinceLastUpdate / elapsedTime;

            uploadSpeed.value = formatUploadSpeed(bytesPerSecond);

            lastLoaded.value = loadedBytes;
            lastTime.value = currentTime;
          }
        };

        // 定义取消检查函数
        const checkCancel = () => {
          // 检查全局取消标志或当前文件是否被标记为取消
          return cancelUploadFlag.value || (fileItems.value[i] && fileItems.value[i].status === "error");
        };

        let response;

        // 根据上传方式选择对应的上传方法
        if (uploadMethod.value === "direct") {
          // 直接上传方式
          console.log(`使用直接上传模式上传文件: ${file.name}`);

          // 设置XHR引用以支持取消操作
          const onXhrCreated = (xhr) => {
            console.log(`设置直接上传的 XHR 引用，用于支持取消操作`);
            fileItems.value[i].xhr = xhr;
          };

          // 执行直接上传 - 明确指定useMultipart=false
          response = await fsApi.uploadFile(props.currentPath, file, false, (xhr) => {
            console.log(`设置直接上传的 XHR 引用，用于支持取消操作`);
            fileItem.xhr = xhr;
          });

          // 处理直接上传的响应
          if (response) {
            // 模拟上传进度（直接上传没有进度回调）
            updateProgress(100);
          }
        } else if (uploadMethod.value === "presigned") {
          // 预签名URL直传方式
          console.log(`使用预签名URL直传上传文件: ${file.name}`);

          // 执行预签名URL上传
          response = await fsApi.performPresignedUpload(file, props.currentPath, updateProgress, checkCancel);
        } else {
          // 分片上传方式
          console.log(`使用分片上传方式上传文件: ${file.name}`);

          // 设置XHR引用以支持取消操作
          const onXhrCreated = (xhr) => {
            console.log(`设置分片 XHR 引用，用于支持取消操作`);
            fileItems.value[i].xhr = xhr;
          };

          // 执行分片上传
          response = await fsApi.performMultipartUpload(file, props.currentPath, updateProgress, checkCancel, onXhrCreated);
        }

        // 检查上传结果
        if (response && response.success) {
          console.log(`文件 ${file.name} 上传成功`);
          fileItem.status = "success";
          fileItem.progress = 100;
          fileItem.message = "";
          uploadResults.push({
            name: file.name,
            size: file.size,
            path: props.currentPath,
            response: response,
          });
        } else {
          console.error(`文件 ${file.name} 上传失败:`, response);
          fileItem.status = "error";
          fileItem.message = response && response.message ? response.message : "上传失败";
          errors.push({
            file: file.name,
            error: response && response.message ? response.message : "未知错误",
          });
        }
      } catch (error) {
        console.error(`上传文件 ${file.name} 时出错:`, error);
        fileItem.status = "error";
        fileItem.message = error.message || "上传过程中发生错误";
        errors.push({
          file: file.name,
          error: error.message || "未知错误",
        });
      }
    }
  } finally {
    // 上传完成后更新状态
    isUploading.value = fileItems.value.some((item) => item.status === "uploading");
    currentUploadIndex.value = -1;

    // 如果没有正在上传的文件，重新计算最终进度
    if (!isUploading.value) {
      const activeFiles = fileItems.value.filter((item) => item.status === "success");

      if (activeFiles.length > 0) {
        const totalSize = activeFiles.reduce((sum, _, idx) => sum + selectedFiles.value[idx].size, 0);
        const completedSize = selectedFiles.value.filter((_, idx) => fileItems.value[idx].status === "success").reduce((sum, f) => sum + f.size, 0);

        totalProgress.value = Math.floor((completedSize / totalSize) * 100);
      } else {
        totalProgress.value = 0;
      }
    }
  }

  // 根据上传结果显示适当的消息
  if (uploadResults.length === 0 && errors.length > 0) {
    // 所有文件上传失败
    const errorMessages = errors.map((e) => `${e.file}: ${e.error}`).join("; ");
    showMessage("error", `所有文件上传失败${errors.length > 1 ? "，请检查文件是否有效" : `: ${errorMessages}`}`);
  } else if (errors.length > 0) {
    // 部分文件上传失败
    showMessage("warning", `已上传 ${uploadResults.length} 个文件，${errors.length} 个文件失败`);
  } else {
    // 所有文件上传成功
    showMessage("success", `已成功上传 ${uploadResults.length} 个文件`);

    // 通知父组件上传成功，可能需要刷新文件列表
    emit("upload-success", {
      count: uploadResults.length,
      results: uploadResults,
    });

    // 延迟1.5秒后清除已成功上传的文件，让用户有时间看到成功消息
    setTimeout(() => {
      clearSuccessfulFiles();
    }, 1500);
  }
};

// 取消单个文件上传
const cancelSingleUpload = async (index) => {
  if (index < 0 || index >= fileItems.value.length) return;

  const fileItem = fileItems.value[index];
  const fileName = selectedFiles.value[index].name;

  // 只处理"正在上传"的文件
  if (fileItem.status !== "uploading") return;

  console.log(`取消文件 ${fileName} 的上传`);

  try {
    // 如果有活动的XHR请求，取消它
    if (fileItem.xhr) {
      console.log(`终止文件 ${fileName} 的XHR请求`);
      fileItem.xhr.abort();
      fileItem.xhr = null;
    }

    // 更新文件状态为取消
    fileItem.status = "error";
    fileItem.message = "上传已取消";
    fileItem.progress = 0;

    // 确保清理所有相关状态
    fileItem.fileId = null;
    fileItem.uploadId = null; // 清理可能存在的分片上传ID
    fileItem.xhr = null;

    // 重新计算总进度（排除已取消的文件）
    const activeFiles = fileItems.value.filter((item) => item.status === "uploading" || item.status === "success" || item.status === "pending");

    if (activeFiles.length > 0) {
      const totalSize = activeFiles.reduce((sum, _, idx) => sum + selectedFiles.value[idx].size, 0);
      const completedSize = selectedFiles.value.filter((_, idx) => fileItems.value[idx].status === "success").reduce((sum, f) => sum + f.size, 0);

      totalProgress.value = Math.floor((completedSize / totalSize) * 100);
    } else {
      totalProgress.value = 0;
    }

    // 检查是否还有待上传或正在上传的文件
    const hasActiveUploads = fileItems.value.some((item) => item.status === "uploading");
    const hasPendingUploads = fileItems.value.some((item) => item.status === "pending");

    if (!hasActiveUploads) {
      if (hasPendingUploads) {
        // 有待上传的文件，保持isUploading为true，以便维持总进度条显示
        // 自动开始上传下一个文件
        const nextFileIndex = fileItems.value.findIndex((item) => item.status === "pending");
        if (nextFileIndex !== -1) {
          console.log(`开始上传下一个文件: ${selectedFiles.value[nextFileIndex].name}`);
          // 仅重置当前上传相关状态但保持isUploading为true
          uploadSpeed.value = "";
          currentUploadIndex.value = nextFileIndex;
          lastLoaded.value = 0;
          lastTime.value = Date.now();

          // 开始上传下一个文件
          // 注意：不要直接调用submitUpload()，而是继续让原来的submitUpload循环处理
        }
      } else {
        // 没有待上传或正在上传的文件，完全重置上传状态
        isUploading.value = false;
        uploadSpeed.value = "";
        currentUploadIndex.value = -1;
        lastLoaded.value = 0;
        lastTime.value = 0;
      }
    }
  } catch (error) {
    console.error(`取消文件 ${fileName} 上传时发生错误:`, error);
    showMessage("error", `取消上传失败: ${error.message || "未知错误"}`);
  }
};

// 取消所有上传
const cancelUpload = () => {
  if (isUploading.value) {
    // 设置全局取消标志
    cancelUploadFlag.value = true;

    // 取消所有待上传和正在上传的文件
    for (let i = 0; i < fileItems.value.length; i++) {
      const fileItem = fileItems.value[i];

      // 只处理"正在上传"或"等待上传"的文件
      if (fileItem.status === "uploading" || fileItem.status === "pending") {
        // 如果有活动的XHR请求，取消它
        if (fileItem.xhr) {
          fileItem.xhr.abort();
          fileItem.xhr = null;
        }

        // 更新文件状态为取消
        fileItem.status = "error";
        fileItem.message = "上传已取消";
        fileItem.progress = 0; // 重置进度

        // 确保清理所有相关状态
        fileItem.fileId = null;
        fileItem.uploadId = null;
      }
    }

    // 更新状态
    isUploading.value = false;
    uploadProgress.value = 0;
    totalProgress.value = 0;
    uploadSpeed.value = "";
    currentUploadIndex.value = -1;

    showMessage("warning", "已取消所有文件的上传");
  }
};

// 格式化上传速度
const formatUploadSpeed = (bytesPerSecond) => {
  if (bytesPerSecond < 1024) {
    return `${bytesPerSecond.toFixed(2)} B/s`;
  } else if (bytesPerSecond < 1024 * 1024) {
    return `${(bytesPerSecond / 1024).toFixed(2)} KB/s`;
  } else if (bytesPerSecond < 1024 * 1024 * 1024) {
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`;
  } else {
    return `${(bytesPerSecond / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
  }
};

// 重试单个文件上传
const retryUpload = async (index) => {
  if (index < 0 || index >= fileItems.value.length || isUploading.value) return;

  const fileItem = fileItems.value[index];
  const file = selectedFiles.value[index];

  // 只能重试错误状态的文件
  if (fileItem.status !== "error") return;

  try {
    // 重置文件状态
    fileItem.status = "uploading";
    fileItem.progress = 0;
    fileItem.message = "";
    isUploading.value = true;
    currentUploadIndex.value = index;

    // 完全清除之前的上传状态
    fileItem.xhr = null;
    fileItem.fileId = null;
    fileItem.uploadId = null;
    cancelUploadFlag.value = false;

    // 重置速度计算变量
    lastLoaded.value = 0;
    lastTime.value = Date.now();

    // 定义上传进度回调函数
    const updateProgress = (progress) => {
      // 如果文件已被取消，不再更新进度
      if (fileItem.status === "error") {
        return;
      }

      fileItem.progress = progress;

      // 计算总进度 - 包括所有活跃文件
      const activeFiles = fileItems.value.filter((item) => item.status === "uploading" || item.status === "success" || item.status === "pending");

      if (activeFiles.length > 0) {
        const totalSize = activeFiles.reduce((sum, _, idx) => sum + selectedFiles.value[idx].size, 0);
        const completedSize = selectedFiles.value.filter((_, idx) => fileItems.value[idx].status === "success").reduce((sum, f) => sum + f.size, 0);

        const currentFileProgress = (progress / 100) * file.size;
        totalProgress.value = Math.floor(((completedSize + currentFileProgress) / totalSize) * 100);
      } else {
        totalProgress.value = 0;
      }

      // 计算上传速度
      const currentTime = Date.now();
      const elapsedTime = (currentTime - lastTime.value) / 1000;

      if (elapsedTime > 0.5) {
        const loadedBytes = (progress / 100) * file.size;
        const loadedSinceLastUpdate = loadedBytes - lastLoaded.value;
        const bytesPerSecond = loadedSinceLastUpdate / elapsedTime;

        uploadSpeed.value = formatUploadSpeed(bytesPerSecond);
        lastLoaded.value = loadedBytes;
        lastTime.value = currentTime;
      }
    };

    // 定义取消检查函数
    const checkCancel = () => {
      return cancelUploadFlag.value || fileItem.status === "error";
    };

    // 选择适当的API函数
    const fsApi = api.fs.getFsApiByUserType(props.isAdmin);

    let response;

    // 根据上传方式选择对应的上传方法
    if (uploadMethod.value === "direct") {
      // 直接上传方式
      console.log(`使用直接上传模式重试上传文件: ${file.name}`);

      // 执行直接上传 - 明确指定useMultipart=false
      response = await fsApi.uploadFile(props.currentPath, file, false, (xhr) => {
        console.log(`设置直接上传的 XHR 引用，用于支持取消操作`);
        fileItem.xhr = xhr;
      });

      // 处理直接上传的响应
      if (response) {
        // 模拟上传进度（直接上传没有进度回调）
        updateProgress(100);
      }
    } else if (uploadMethod.value === "presigned") {
      // 预签名URL直传方式
      console.log(`使用预签名URL直传重试上传文件: ${file.name}`);
      response = await fsApi.performPresignedUpload(file, props.currentPath, updateProgress, checkCancel);
    } else {
      // 分片上传方式
      console.log(`使用分片上传方式重试上传文件: ${file.name}`);

      // 执行分片上传
      response = await fsApi.performMultipartUpload(file, props.currentPath, updateProgress, checkCancel, (xhr) => {
        console.log(`设置分片 XHR 引用，用于支持取消操作`);
        fileItem.xhr = xhr;
      });
    }

    // 检查上传结果
    if (response && response.success) {
      fileItem.status = "success";
      fileItem.progress = 100;
      fileItem.message = "";

      // 通知父组件上传成功
      emit("upload-success", {
        count: 1,
        results: [
          {
            name: file.name,
            size: file.size,
            path: props.currentPath,
            response: response,
          },
        ],
      });

      showMessage("success", `文件 ${file.name} 重新上传成功`);

      // 延迟1.5秒后清除此成功文件
      setTimeout(() => {
        clearSelectedFile(index);
      }, 1500);
    } else {
      fileItem.status = "error";
      fileItem.message = response && response.message ? response.message : "上传失败";
      showMessage("error", `文件 ${file.name} 重新上传失败: ${fileItem.message}`);
    }
  } catch (error) {
    fileItem.status = "error";
    fileItem.message = error.message || "上传过程中发生错误";
    showMessage("error", `文件 ${file.name} 重新上传错误: ${fileItem.message}`);
  } finally {
    // 更新上传状态
    isUploading.value = fileItems.value.some((item) => item.status === "uploading");
    if (!isUploading.value) {
      currentUploadIndex.value = -1;
    }
  }
};
</script>

<style scoped>
/* 脉动边框动画 */
@keyframes pulseBorder {
  0% {
    border-color: rgba(59, 130, 246, 0.5); /* 淡蓝色 */
  }
  50% {
    border-color: rgba(59, 130, 246, 1); /* 全蓝色 */
  }
  100% {
    border-color: rgba(59, 130, 246, 0.5); /* 淡蓝色 */
  }
}

/* 进度条条纹动画 */
@keyframes progressStripes {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 30px 0;
  }
}

.pulsing-border {
  animation: pulseBorder 1.5s ease-in-out infinite;
}

/* 提升动画性能 */
.drop-zone {
  will-change: border-color, background-color, transform;
  transform: translateZ(0);
}

/* 拖动元素进入时的缩放效果 */
.drop-zone.pulsing-border {
  transform: scale(1.01);
  transition: transform 0.3s ease;
}

/* 进度条条纹样式 */
.progress-stripes {
  background-image: linear-gradient(
      45deg,
      rgba(255, 255, 255, 0.15) 25%,
      transparent 25%,
      transparent 50%,
      rgba(255, 255, 255, 0.15) 50%,
      rgba(255, 255, 255, 0.15) 75%,
      transparent 75%,
      transparent
  );
  background-size: 30px 30px;
}

/* 进度条条纹动画 */
.animate-progress-stripes {
  animation: progressStripes 1s linear infinite;
}
</style>
