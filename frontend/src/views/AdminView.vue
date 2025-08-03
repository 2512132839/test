<script setup>
import { computed, onMounted, onBeforeUnmount } from "vue";
import AdminLogin from "../components/admin/AdminLogin.vue";
import { useAuthStore } from "@/stores/authStore.js";

// 定义props，接收父组件传递的darkMode
const props = defineProps({
  darkMode: {
    type: Boolean,
    required: true,
  },
});

// 使用认证Store
const authStore = useAuthStore();

// 从Store获取状态的计算属性
const isLoggedIn = computed(() => authStore.isAuthenticated);
const userPermissions = computed(() => ({
  isAdmin: authStore.isAdmin,
  text: authStore.hasTextPermission,
  file: authStore.hasFilePermission,
  mount: authStore.hasMountPermission,
}));

// 认证Store已经在初始化时处理了状态恢复，不需要额外的初始化逻辑

// 在组件加载时验证认证状态
onMounted(async () => {
  // 如果需要重新验证，则进行验证
  if (authStore.needsRevalidation) {
    console.log("AdminPage: 需要重新验证认证状态");
    await authStore.validateAuth();
  }

  // 监听认证状态变化事件
  window.addEventListener("auth-state-changed", handleAuthStateChange);
});

// 组件卸载时移除事件监听
onBeforeUnmount(() => {
  window.removeEventListener("auth-state-changed", handleAuthStateChange);
});

// 处理认证状态变化
const handleAuthStateChange = (event) => {
  console.log("AdminPage: 认证状态变化", event.detail);
  // 由于使用了响应式的计算属性，UI会自动更新
};

// 认证逻辑已移至认证Store，不再需要这些函数

// API密钥验证逻辑已移至认证Store

// 处理登录成功
const handleLoginSuccess = (result) => {
  console.log("AdminPage: 登录成功", result);
  // 认证Store已经处理了状态更新，这里只需要记录日志
  // 由于使用了响应式的计算属性，UI会自动更新
};

// 处理登出
const handleLogout = async () => {
  console.log("AdminPage: 执行登出");
  await authStore.logout();
  // 由于使用了响应式的计算属性，UI会自动更新
};
</script>

<template>
  <div class="h-screen flex flex-col">
    <!-- 根据登录状态显示登录页面或管理面板 -->
    <AdminLogin v-if="!isLoggedIn" :darkMode="darkMode" @login-success="handleLoginSuccess" class="flex-1" />
    <router-view v-else :dark-mode="darkMode" :permissions="userPermissions" @logout="handleLogout" class="flex-1" />
  </div>
</template>
