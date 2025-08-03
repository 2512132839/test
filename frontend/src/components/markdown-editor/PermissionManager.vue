<template>
  <div v-if="!hasPermission" class="permission-warning">
    <div class="mb-4 p-3 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-700/50 dark:text-yellow-200">
      <div class="flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          {{ $t("markdown.permissionRequired") }}
          <a href="#" @click.prevent="navigateToAdmin" class="font-medium underline">{{ $t("markdown.loginOrAuth") }}</a
          >。
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from "vue";
import { useAuthStore } from "@/stores/authStore.js";

// Props
const props = defineProps({
  darkMode: {
    type: Boolean,
    default: false,
  },
});

// Emits
const emit = defineEmits(["permission-change", "navigate-to-admin"]);

// 使用认证Store
const authStore = useAuthStore();

// 从Store获取权限状态的计算属性
const isAdmin = computed(() => authStore.isAdmin);
const hasApiKey = computed(() => authStore.authType === "apikey" && !!authStore.apiKey);
const hasTextPermission = computed(() => authStore.hasTextPermission);
const hasPermission = computed(() => authStore.hasTextPermission);

// 检查用户权限状态（简化版，主要用于触发事件）
const checkPermissionStatus = async () => {
  console.log("PermissionManager: 检查用户权限状态...");

  // 如果需要重新验证，则进行验证
  if (authStore.needsRevalidation) {
    console.log("PermissionManager: 需要重新验证认证状态");
    await authStore.validateAuth();
  }

  console.log("PermissionManager: 用户文本权限:", hasPermission.value ? "有权限" : "无权限");
  emit("permission-change", hasPermission.value);
};


// 导航到管理员登录页面
const navigateToAdmin = () => {
  emit("navigate-to-admin");
};

// 事件处理函数
const handleAuthStateChange = async (e) => {
  console.log("PermissionManager: 接收到认证状态变化事件:", e.detail);
  emit("permission-change", hasPermission.value);
};

// 组件挂载
onMounted(async () => {
  await checkPermissionStatus();

  // 监听认证状态变化事件
  window.addEventListener("auth-state-changed", handleAuthStateChange);
});

// 组件卸载
onUnmounted(() => {
  window.removeEventListener("auth-state-changed", handleAuthStateChange);
});

// 暴露方法和状态
defineExpose({
  hasPermission,
  isAdmin,
  hasApiKey,
  hasTextPermission,
  checkPermissionStatus,
});
</script>

<style scoped>
.permission-warning {
  margin-bottom: 1rem;
}
</style>
