<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center">
    <div class="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl">
      <!-- 标题栏 -->
      <div class="px-4 py-3 border-b flex justify-between items-center" :class="darkMode ? 'border-gray-700' : 'border-gray-200'">
        <h3 class="text-lg font-medium" :class="darkMode ? 'text-gray-100' : 'text-gray-900'">任务管理</h3>
        <button @click="close" class="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400">
          <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 内容区 -->
      <div class="p-4">
        <div v-if="activeTasks.length === 0 && completedTasks.length === 0" class="text-center py-6" :class="darkMode ? 'text-gray-400' : 'text-gray-600'">
          <svg class="h-12 w-12 mx-auto mb-3 opacity-30" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p>当前没有任务</p>
        </div>

        <div v-else class="space-y-4 max-h-80 overflow-y-auto">
          <!-- 活动任务标题 -->
          <div v-if="activeTasks.length > 0" class="text-sm font-medium mb-2" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">正在进行的任务 ({{ activeTasks.length }})</div>

          <!-- 活动任务列表 -->
          <div v-for="task in activeTasks" :key="task.id" class="border rounded-lg p-3" :class="getTaskCardClass(task)">
            <!-- 任务标题和类型 -->
            <div class="flex justify-between items-start mb-2">
              <div class="flex items-start">
                <!-- 任务类型图标 -->
                <div class="mr-2 mt-0.5 flex-shrink-0" :class="darkMode ? 'text-gray-400' : 'text-gray-600'" v-html="getTaskTypeIcon(task.type)"></div>

                <div>
                  <div class="font-medium" :class="darkMode ? 'text-gray-200' : 'text-gray-800'">{{ task.name }}</div>
                  <div class="text-xs mt-0.5" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ getTaskTypeText(task.type) }} · {{ getTimeAgo(task.createdAt) }}</div>
                </div>
              </div>
              <div class="flex items-center">
                <!-- 任务状态标签 -->
                <span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="getStatusClass(task.status)">
                  {{ getStatusText(task.status) }}
                </span>

                <!-- 任务操作按钮 -->
                <button
                  v-if="task.status === TaskStatus.RUNNING || task.status === TaskStatus.PENDING"
                  @click="cancelTask(task.id)"
                  class="ml-2 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
                >
                  <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- 进度条 -->
            <div v-if="task.status === TaskStatus.RUNNING || task.status === TaskStatus.PENDING" class="mt-2">
              <div class="flex justify-between items-center mb-1">
                <div class="text-xs" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
                  <span v-if="task.details && task.details.phase === 'downloading'" class="text-blue-500 dark:text-blue-400">下载中</span>
                  <span v-else-if="task.details && task.details.phase === 'uploading'" class="text-green-500 dark:text-green-400">上传中</span>
                  <span v-else>处理中</span>
                </div>
                <div class="text-xs font-medium" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">{{ Math.round(task.progress) }}%</div>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                <div class="h-2 rounded-full transition-all duration-200" :class="getProgressBarClass(task)" :style="{ width: `${task.progress}%` }"></div>
              </div>
            </div>

            <!-- 任务详情 -->
            <div v-if="task.details && Object.keys(task.details).length > 0" class="mt-2 text-xs" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
              <div v-if="task.details.processed && task.details.total">已处理: {{ formatProgress(task.details.processed, task.details.total) }}</div>

              <!-- 显示当前处理的文件 -->
              <div v-if="task.details.currentFile" class="mt-1 truncate">当前文件: {{ task.details.currentFile }}</div>

              <!-- 跨存储复制完成后的统计 -->
              <div v-if="task.details.crossStorage && task.status === TaskStatus.COMPLETED" class="mt-1">
                <span class="text-green-500 dark:text-green-400">成功: {{ task.details.successCount || 0 }}</span>
                <span v-if="task.details.failedCount > 0" class="ml-2 text-red-500 dark:text-red-400">失败: {{ task.details.failedCount }}</span>
              </div>
            </div>

            <!-- 错误信息 -->
            <div v-if="task.status === TaskStatus.FAILED && task.error" class="mt-2 text-xs text-red-500 dark:text-red-400">
              {{ task.error }}
            </div>
          </div>

          <!-- 已完成任务标题 -->
          <div v-if="completedTasks.length > 0" class="text-sm font-medium mt-4 mb-2" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">
            已完成的任务 ({{ completedTasks.length }})
          </div>

          <!-- 已完成任务列表 -->
          <div v-for="task in completedTasks" :key="task.id" class="border rounded-lg p-3" :class="getTaskCardClass(task)">
            <!-- 任务标题和类型 -->
            <div class="flex justify-between items-start">
              <div class="flex items-start">
                <!-- 任务类型图标 -->
                <div class="mr-2 mt-0.5 flex-shrink-0" :class="darkMode ? 'text-gray-400' : 'text-gray-600'" v-html="getTaskTypeIcon(task.type)"></div>

                <div>
                  <div class="font-medium" :class="darkMode ? 'text-gray-200' : 'text-gray-800'">{{ task.name }}</div>
                  <div class="text-xs mt-0.5" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ getTaskTypeText(task.type) }} · {{ getTimeAgo(task.updatedAt) }}</div>
                </div>
              </div>
              <div class="flex items-center">
                <!-- 任务状态标签 -->
                <span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="getStatusClass(task.status)">
                  {{ getStatusText(task.status) }}
                </span>

                <!-- 展开/折叠按钮 -->
                <button @click="toggleTaskDetails(task.id)" class="ml-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                  <svg
                    class="h-4 w-4 transition-transform"
                    :class="{ 'transform rotate-180': isTaskExpanded(task.id) }"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- 任务详情 - 仅在展开时显示 -->
            <div v-if="isTaskExpanded(task.id)" class="mt-2 pt-2 border-t" :class="darkMode ? 'border-gray-700' : 'border-gray-200'">
              <!-- 完成时间 -->
              <div class="text-xs" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">完成时间: {{ new Date(task.updatedAt).toLocaleString() }}</div>

              <!-- 任务详情 -->
              <div v-if="task.details && Object.keys(task.details).length > 0" class="mt-1 text-xs" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
                <div v-if="task.details.processed && task.details.total">处理项目: {{ formatProgress(task.details.processed, task.details.total) }}</div>

                <!-- 跨存储复制完成后的统计 -->
                <div v-if="task.details.crossStorage && task.status === TaskStatus.COMPLETED" class="mt-1">
                  <span class="text-green-500 dark:text-green-400">成功: {{ task.details.successCount || 0 }}</span>
                  <span v-if="task.details.failedCount > 0" class="ml-2 text-red-500 dark:text-red-400">失败: {{ task.details.failedCount }}</span>
                </div>
              </div>

              <!-- 错误信息 -->
              <div v-if="task.status === TaskStatus.FAILED && task.error" class="mt-1 text-xs text-red-500 dark:text-red-400">错误: {{ task.error }}</div>
            </div>

            <!-- 错误信息 - 简短版本，仅在未展开且有错误时显示 -->
            <div v-else-if="task.status === TaskStatus.FAILED && task.error" class="mt-2 text-xs text-red-500 dark:text-red-400 truncate">
              {{ task.error }}
            </div>
          </div>
        </div>

        <!-- 清除已完成按钮 -->
        <div v-if="completedTasks.length > 0" class="mt-4 flex justify-end space-x-2">
          <button
            @click="clearCompleted"
            class="text-xs px-3 py-1 rounded transition-colors"
            :class="darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'"
          >
            清除已完成任务
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, shallowRef } from "vue";
import { useTaskManager, TaskStatus, TaskType } from "../../utils/taskManager";

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  darkMode: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["close"]);

// 获取任务管理器
const { state, cancelTask, clearCompletedTasks } = useTaskManager();

// 活动中的任务 - 使用shallowRef优化性能
const activeTasks = computed(() => {
  return [...state.tasks].filter((task) => task.status === TaskStatus.RUNNING || task.status === TaskStatus.PENDING).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
});

// 已完成的任务 - 使用shallowRef优化性能
const completedTasks = computed(() => {
  return [...state.tasks]
    .filter((task) => task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED || task.status === TaskStatus.CANCELLED)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
});

// 展开的任务ID集合
const expandedTaskIds = ref(new Set());

// 切换任务详情展开状态
const toggleTaskDetails = (taskId) => {
  if (expandedTaskIds.value.has(taskId)) {
    expandedTaskIds.value.delete(taskId);
  } else {
    expandedTaskIds.value.add(taskId);
  }
};

// 检查任务是否已展开
const isTaskExpanded = (taskId) => {
  return expandedTaskIds.value.has(taskId);
};

// 清除已完成任务
const clearCompleted = () => {
  clearCompletedTasks();
};

// 关闭弹窗
const close = () => {
  emit("close");
};

// 获取任务类型文本
const getTaskTypeText = (type) => {
  switch (type) {
    case TaskType.COPY:
      return "复制任务";
    case TaskType.UPLOAD:
      return "上传任务";
    case TaskType.DELETE:
      return "删除任务";
    case TaskType.DOWNLOAD:
      return "下载任务";
    default:
      return "未知任务";
  }
};

// 获取任务类型图标
const getTaskTypeIcon = (type) => {
  switch (type) {
    case TaskType.COPY:
      return `<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>`;
    case TaskType.UPLOAD:
      return `<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>`;
    case TaskType.DELETE:
      return `<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>`;
    case TaskType.DOWNLOAD:
      return `<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>`;
    default:
      return `<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>`;
  }
};

// 获取状态文本
const getStatusText = (status) => {
  switch (status) {
    case TaskStatus.PENDING:
      return "等待中";
    case TaskStatus.RUNNING:
      return "运行中";
    case TaskStatus.COMPLETED:
      return "已完成";
    case TaskStatus.FAILED:
      return "失败";
    case TaskStatus.CANCELLED:
      return "已取消";
    default:
      return "未知";
  }
};

// 状态样式类映射 - 缓存样式类以提高性能
const statusClassMap = {
  [TaskStatus.PENDING]: {
    light: "bg-yellow-100 text-yellow-800",
    dark: "text-white bg-yellow-700/50",
  },
  [TaskStatus.RUNNING]: {
    light: "bg-blue-100 text-blue-800",
    dark: "text-white bg-blue-700/50",
  },
  [TaskStatus.COMPLETED]: {
    light: "bg-green-100 text-green-800",
    dark: "text-white bg-green-700/50",
  },
  [TaskStatus.FAILED]: {
    light: "bg-red-100 text-red-800",
    dark: "text-white bg-red-700/50",
  },
  [TaskStatus.CANCELLED]: {
    light: "bg-gray-100 text-gray-800",
    dark: "text-white bg-gray-700/50",
  },
};

// 获取状态样式类
const getStatusClass = (status) => {
  const statusClasses = statusClassMap[status] || statusClassMap[TaskStatus.CANCELLED];
  return props.darkMode ? statusClasses.dark : statusClasses.light;
};

// 任务卡片样式类映射 - 缓存样式类以提高性能
const taskCardClassMap = {
  [TaskStatus.RUNNING]: {
    light: "border-gray-200 bg-blue-50/50",
    dark: "border-gray-700 bg-blue-900/10",
  },
  [TaskStatus.COMPLETED]: {
    light: "border-gray-200 bg-green-50/50",
    dark: "border-gray-700 bg-green-900/10",
  },
  [TaskStatus.FAILED]: {
    light: "border-gray-200 bg-red-50/50",
    dark: "border-gray-700 bg-red-900/10",
  },
  default: {
    light: "border-gray-200",
    dark: "border-gray-700",
  },
};

// 获取任务卡片样式类
const getTaskCardClass = (task) => {
  const cardClasses = taskCardClassMap[task.status] || taskCardClassMap.default;
  return props.darkMode ? cardClasses.dark : cardClasses.light;
};

// 获取进度条样式类
const getProgressBarClass = (task) => {
  // 根据任务阶段设置不同的颜色
  if (task.details && task.details.phase) {
    if (task.details.phase === "downloading") {
      return "bg-blue-500";
    } else if (task.details.phase === "uploading") {
      return "bg-green-500";
    }
  }

  // 默认进度条颜色
  return task.progress > 95 ? "bg-green-500" : "bg-blue-500";
};

// 缓存时间单位常量，优化getTimeAgo函数
const TIME_UNITS = {
  MINUTE: 60,
  HOUR: 3600,
  DAY: 86400,
  WEEK: 604800,
};

// 获取相对时间文本 - 优化版本
const getTimeAgo = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  // 如果时间差小于一分钟，显示"刚刚"
  if (diffInSeconds < TIME_UNITS.MINUTE) return "刚刚";

  // 如果时间差小于一小时，显示分钟数
  if (diffInSeconds < TIME_UNITS.HOUR) {
    const minutes = Math.floor(diffInSeconds / TIME_UNITS.MINUTE);
    return `${minutes}分钟前`;
  }

  // 如果时间差小于24小时，显示小时数
  if (diffInSeconds < TIME_UNITS.DAY) {
    const hours = Math.floor(diffInSeconds / TIME_UNITS.HOUR);
    return `${hours}小时前`;
  }

  // 如果时间差小于7天，显示天数
  if (diffInSeconds < TIME_UNITS.WEEK) {
    const days = Math.floor(diffInSeconds / TIME_UNITS.DAY);
    return `${days}天前`;
  }

  // 如果时间差大于7天，显示具体日期
  const options = { month: "short", day: "numeric" };

  // 如果不是今年，还要显示年份
  if (date.getFullYear() !== now.getFullYear()) {
    options.year = "numeric";
  }

  return date.toLocaleDateString(undefined, options);
};

// 格式化进度数值
const formatProgress = (processed, total) => {
  // 检查值是否为数字
  const processedNum = Number(processed);
  const totalNum = Number(total);

  if (isNaN(processedNum) || isNaN(totalNum)) {
    return `${processed}/${total}`;
  }

  // 显示文件计数
  // 合理性检查 - 如果total超过10,000，可能是错误或者特殊情况
  if (totalNum > 10000) {
    // 显示简化的数字
    return `${formatNumber(processedNum)}/${formatNumber(totalNum)}`;
  }

  // 如果processed大于total，显示为total
  if (processedNum > totalNum) {
    return `${totalNum}/${totalNum}`;
  }

  return `${processedNum}/${totalNum}`;
};

// 格式化数字 (1000 -> 1K, 1000000 -> 1M)
const formatNumber = (num) => {
  if (num < 1000) {
    return num.toString();
  } else if (num < 1000000) {
    return (num / 1000).toFixed(1) + "K";
  } else {
    return (num / 1000000).toFixed(1) + "M";
  }
};
</script>
