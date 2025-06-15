<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { pwaState, pwaUtils } from "./pwaManager.js";

const props = defineProps({
  darkMode: {
    type: Boolean,
    default: false,
  },
  showDetails: {
    type: Boolean,
    default: false,
  },
});

// 组件状态
const showStatus = ref(false);
const statusDetails = ref({
  isOnline: navigator.onLine,
  isInstalled: false,
  hasUpdate: false,
  cacheSize: 0,
  lastSync: null,
});

// 计算属性
const statusColor = computed(() => {
  if (!statusDetails.value.isOnline) return "red";
  if (statusDetails.value.hasUpdate) return "orange";
  if (statusDetails.value.isInstalled) return "green";
  return "blue";
});

const statusText = computed(() => {
  if (!statusDetails.value.isOnline) return "离线";
  if (statusDetails.value.hasUpdate) return "有更新";
  if (statusDetails.value.isInstalled) return "已安装";
  return "在线";
});

const statusIcon = computed(() => {
  if (!statusDetails.value.isOnline) return "offline";
  if (statusDetails.value.hasUpdate) return "update";
  if (statusDetails.value.isInstalled) return "installed";
  return "online";
});

// 更新状态
const updateStatus = () => {
  statusDetails.value = {
    isOnline: navigator.onLine,
    isInstalled: pwaState.isInstalled,
    hasUpdate: pwaState.isUpdateAvailable,
    cacheSize: 0, // 这里可以添加缓存大小计算
    lastSync: new Date().toISOString(),
  };
};

// 切换状态显示
const toggleStatus = () => {
  showStatus.value = !showStatus.value;
};

// 清理缓存
const clearCache = async () => {
  try {
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      console.log("[PWA] 缓存已清理");
    }
    updateStatus();
  } catch (error) {
    console.error("[PWA] 清理缓存失败:", error);
  }
};

// 强制更新
const forceUpdate = async () => {
  try {
    await pwaUtils.update();
  } catch (error) {
    console.error("[PWA] 强制更新失败:", error);
  }
};

// 状态监听器
let statusInterval;

onMounted(() => {
  updateStatus();

  // 定期更新状态
  statusInterval = setInterval(updateStatus, 5000);

  // 监听网络状态变化
  window.addEventListener("online", updateStatus);
  window.addEventListener("offline", updateStatus);
});

onUnmounted(() => {
  if (statusInterval) {
    clearInterval(statusInterval);
  }
  window.removeEventListener("online", updateStatus);
  window.removeEventListener("offline", updateStatus);
});
</script>

<template>
  <div class="pwa-status-indicator">
    <!-- 状态指示器按钮 -->
    <button
      @click="toggleStatus"
      :class="[
        'fixed bottom-4 right-4 z-30 w-12 h-12 rounded-full shadow-lg transition-all duration-300',
        'flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2',
        statusColor === 'red'
          ? darkMode
            ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
            : 'bg-red-500 hover:bg-red-600 focus:ring-red-500'
          : statusColor === 'orange'
          ? darkMode
            ? 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500'
            : 'bg-orange-500 hover:bg-orange-600 focus:ring-orange-500'
          : statusColor === 'green'
          ? darkMode
            ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
            : 'bg-green-500 hover:bg-green-600 focus:ring-green-500'
          : darkMode
          ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
          : 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500',
      ]"
      :title="`PWA状态: ${statusText}`"
    >
      <!-- 离线图标 -->
      <svg v-if="statusIcon === 'offline'" class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636l-12.728 12.728m0 0L12 12m-6.364 6.364L12 12m6.364-6.364L12 12" />
      </svg>

      <!-- 更新图标 -->
      <svg v-else-if="statusIcon === 'update'" class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>

      <!-- 已安装图标 -->
      <svg v-else-if="statusIcon === 'installed'" class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>

      <!-- 在线图标 -->
      <svg v-else class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
        />
      </svg>
    </button>

    <!-- 状态详情面板 -->
    <Transition name="slide-up">
      <div
        v-if="showStatus"
        :class="['fixed bottom-20 right-4 z-20 w-80 rounded-lg shadow-xl p-4', darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200']"
      >
        <div class="flex items-center justify-between mb-4">
          <h3 :class="['text-lg font-semibold', darkMode ? 'text-white' : 'text-gray-900']">PWA 状态</h3>
          <button @click="showStatus = false" :class="['p-1 rounded-md transition-colors', darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600']">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="space-y-3">
          <!-- 网络状态 -->
          <div class="flex items-center justify-between">
            <span :class="['text-sm', darkMode ? 'text-gray-300' : 'text-gray-600']">网络状态</span>
            <div class="flex items-center space-x-2">
              <div :class="['w-2 h-2 rounded-full', statusDetails.isOnline ? 'bg-green-500' : 'bg-red-500']"></div>
              <span :class="['text-sm font-medium', darkMode ? 'text-white' : 'text-gray-900']">
                {{ statusDetails.isOnline ? "在线" : "离线" }}
              </span>
            </div>
          </div>

          <!-- 安装状态 -->
          <div class="flex items-center justify-between">
            <span :class="['text-sm', darkMode ? 'text-gray-300' : 'text-gray-600']">安装状态</span>
            <div class="flex items-center space-x-2">
              <div :class="['w-2 h-2 rounded-full', statusDetails.isInstalled ? 'bg-green-500' : 'bg-gray-400']"></div>
              <span :class="['text-sm font-medium', darkMode ? 'text-white' : 'text-gray-900']">
                {{ statusDetails.isInstalled ? "已安装" : "未安装" }}
              </span>
            </div>
          </div>

          <!-- 更新状态 -->
          <div class="flex items-center justify-between">
            <span :class="['text-sm', darkMode ? 'text-gray-300' : 'text-gray-600']">更新状态</span>
            <div class="flex items-center space-x-2">
              <div :class="['w-2 h-2 rounded-full', statusDetails.hasUpdate ? 'bg-orange-500' : 'bg-green-500']"></div>
              <span :class="['text-sm font-medium', darkMode ? 'text-white' : 'text-gray-900']">
                {{ statusDetails.hasUpdate ? "有更新" : "最新版本" }}
              </span>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="pt-3 border-t border-gray-200 dark:border-gray-600">
            <div class="flex space-x-2">
              <button
                @click="clearCache"
                :class="[
                  'flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700',
                ]"
              >
                清理缓存
              </button>
              <button
                v-if="statusDetails.hasUpdate"
                @click="forceUpdate"
                :class="[
                  'flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  darkMode ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white',
                ]"
              >
                立即更新
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease-out;
}

.slide-up-enter-from {
  transform: translateY(20px);
  opacity: 0;
}

.slide-up-leave-to {
  transform: translateY(20px);
  opacity: 0;
}
</style>
