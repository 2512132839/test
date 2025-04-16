<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from "vue";
import { logout } from "../../api/adminService";
import TextManagement from "./TextManagement.vue";
import SystemSettings from "./SystemSettings.vue";
import KeyManagement from "./KeyManagement.vue";
import StorageConfig from "./StorageConfig.vue";
import FileManagement from "./FileManagement.vue";
import Dashboard from "./Dashboard.vue";
import MountManagement from "./MountManagement.vue";
import { useI18n } from "vue-i18n";

// 初始化 i18n
const { t } = useI18n();

// 定义props，接收父组件传递的darkMode和权限信息
const props = defineProps({
  darkMode: {
    type: Boolean,
    required: true,
  },
  loginType: {
    type: String,
    default: "admin", // 'admin' 或 'apikey'
  },
  permissions: {
    type: Object,
    default: () => ({
      isAdmin: false,
      text: false,
      file: false,
    }),
  },
});

// 定义事件，用于通知父组件退出登录
const emit = defineEmits(["logout"]);

// 当前选中的菜单项
const activeMenu = ref("dashboard");

// 添加移动端侧边栏状态控制
const isMobileSidebarOpen = ref(false);
// 是否为移动端设备
const isMobileDevice = ref(window.innerWidth < 768);

// 根据登录类型和权限计算可见的菜单项
const visibleMenuItems = computed(() => {
  // 管理员可见所有菜单
  if (props.permissions.isAdmin) {
    return [
      { id: "dashboard", name: t("admin.sidebar.dashboard"), icon: "chart-bar" },
      { id: "text-management", name: t("admin.sidebar.textManagement"), icon: "document-text" },
      { id: "file-management", name: t("admin.sidebar.fileManagement"), icon: "folder" },
      { id: "storage-config", name: t("admin.sidebar.storageConfig"), icon: "cloud" },
      { id: "mount-management", name: t("admin.mount.management"), icon: "server" },
      { id: "key-management", name: t("admin.sidebar.keyManagement"), icon: "key" },
      { id: "settings", name: t("admin.sidebar.settings"), icon: "cog" },
    ];
  }

  // API密钥用户根据权限显示菜单
  const items = [];

  if (props.permissions.text) {
    items.push({ id: "text-management", name: t("admin.sidebar.textManagement"), icon: "document-text" });
  }

  if (props.permissions.file) {
    items.push({ id: "file-management", name: t("admin.sidebar.fileManagement"), icon: "folder" });
  }

  // 判断挂载管理权限
  if (props.permissions.mount) {
    items.push({ id: "mount-management", name: t("admin.mount.management"), icon: "server" });
  }

  return items;
});

// 切换移动端侧边栏显示状态
const toggleMobileSidebar = () => {
  isMobileSidebarOpen.value = !isMobileSidebarOpen.value;
};

// 在移动端选择菜单项后自动关闭侧边栏
const selectMenuItem = (menuId) => {
  activeMenu.value = menuId;
  // 在移动端选择选项后自动关闭侧边栏
  if (window.innerWidth < 768) {
    isMobileSidebarOpen.value = false;
  }
};

// 退出登录
const handleLogout = async () => {
  try {
    // 仅当是管理员登录时调用登出API
    if (props.loginType === "admin") {
      await logout();
    }
  } catch (error) {
    console.error("登出失败:", error);
  } finally {
    // 无论成功失败，都清除本地状态并通知父组件
    emit("logout");
  }
};

// 根据图标名称返回SVG路径数据
const getIconPath = (iconName) => {
  switch (iconName) {
    case "chart-bar":
      return "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z";
    case "document-text":
      return "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z";
    case "folder":
      return "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z";
    case "cloud":
      return "M8 16a5 5 0 01-.916-9.916A5.002 5.002 0 0113 6c2.761 0 5 2.239 5 5 0 .324-.024.64-.075.947 1.705.552 2.668 2.176 2.668 3.833 0 1.598-1.425 3.22-3 3.22h-2.053V14.53c0-.282-.112-.55-.308-.753a1 1 0 00-1.412-.002l-2.332 2.332c-.39.39-.39 1.024 0 1.414l2.331 2.331c.392.391 1.025.39 1.414-.001a1.06 1.06 0 00.307-.752V17h2.053a5.235 5.235 0 003.626-8.876A7.002 7.002 0 0013 4a7.002 7.002 0 00-6.929 5.868A6.998 6.998 0 008 16z";
    case "key":
      return "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z";
    case "cog":
      return "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z";
    case "logout":
      return "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1";
    case "server":
      return "M5 12H3v8h18v-8H5zm0 0a2 2 0 100-4h14a2 2 0 100 4M5 8a2 2 0 100-4h14a2 2 0 100 4";
    default:
      return "";
  }
};

// 监听窗口大小变化，更新移动端状态
const updateDeviceWidth = () => {
  isMobileDevice.value = window.innerWidth < 768;
  // 如果从移动端尺寸变为桌面尺寸，自动关闭移动端侧边栏
  if (!isMobileDevice.value && isMobileSidebarOpen.value) {
    isMobileSidebarOpen.value = false;
  }
};

// 监听菜单项变化，确保当前选择的菜单项在可见菜单中
watch(
  visibleMenuItems,
  (newMenuItems) => {
    const menuExists = newMenuItems.some((item) => item.id === activeMenu.value);
    if (!menuExists && newMenuItems.length > 0) {
      activeMenu.value = newMenuItems[0].id;
    }
  },
  { immediate: true }
);

// 组件挂载时添加监听器
onMounted(() => {
  window.addEventListener("resize", updateDeviceWidth);

  // 检查当前选择的菜单项是否在可见菜单中，如果不在则设置为第一个可见菜单
  const menuExists = visibleMenuItems.value.some((item) => item.id === activeMenu.value);
  if (!menuExists && visibleMenuItems.value.length > 0) {
    activeMenu.value = visibleMenuItems.value[0].id;
  }
});

// 组件卸载时移除监听器
onUnmounted(() => {
  window.removeEventListener("resize", updateDeviceWidth);
});
</script>

<template>
  <div class="flex flex-col h-full" :class="darkMode ? 'bg-gray-900' : 'bg-gray-100'">
    <div class="flex flex-1 overflow-hidden">
      <!-- 桌面端侧边栏 - 只在桌面设备显示 -->
      <div class="hidden md:flex md:flex-col md:w-64 border-r shadow-md z-30" :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'">
        <div class="flex flex-col h-full">
          <!-- 桌面端标题 -->
          <div class="flex items-center h-16 flex-shrink-0 px-4 border-b" :class="darkMode ? 'border-gray-700' : 'border-gray-200'">
            <h1 class="text-lg font-medium" :class="darkMode ? 'text-white' : 'text-gray-900'">
              CloudPaste {{ loginType === "admin" ? $t("admin.title.admin") : $t("admin.title.user") }}
            </h1>
          </div>

          <div class="flex-1 flex flex-col overflow-y-auto pt-4">
            <nav class="flex-1 px-4 space-y-2">
              <a
                v-for="item in visibleMenuItems"
                :key="item.id"
                @click="selectMenuItem(item.id)"
                :class="[
                  activeMenu === item.id
                    ? darkMode
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-900'
                    : darkMode
                    ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  'group flex items-center px-3 py-2.5 text-sm font-medium rounded-md cursor-pointer',
                ]"
              >
                <svg
                  class="mr-3 flex-shrink-0 h-6 w-6"
                  :class="activeMenu === item.id ? 'text-primary-500' : darkMode ? 'text-gray-400 group-hover:text-gray-300' : 'text-gray-400 group-hover:text-gray-500'"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="getIconPath(item.icon)" />
                </svg>
                {{ item.name }}
              </a>

              <!-- 退出登录按钮 -->
              <div class="pt-4 mt-4 border-t" :class="darkMode ? 'border-gray-700' : 'border-gray-200'">
                <a
                  @click="handleLogout"
                  :class="[
                    darkMode ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                    'group flex items-center px-3 py-2.5 text-sm font-medium rounded-md cursor-pointer',
                  ]"
                >
                  <svg
                    class="mr-3 flex-shrink-0 h-6 w-6"
                    :class="darkMode ? 'text-gray-400' : 'text-gray-400'"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="getIconPath('logout')" />
                  </svg>
                  {{ loginType === "admin" ? $t("admin.sidebar.logout") : $t("admin.sidebar.logoutAuth") }}
                </a>
              </div>
            </nav>
            <div class="h-6"></div>
          </div>
        </div>
      </div>

      <!-- 主体内容区域 -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- 移动端顶部导航栏 -->
        <div class="md:hidden sticky top-0 z-40 border-b h-14 shadow-sm" :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'">
          <div class="flex items-center h-full px-3">
            <button
              type="button"
              @click="toggleMobileSidebar"
              class="h-10 w-10 inline-flex items-center justify-center rounded-md focus:outline-none"
              :class="darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-900'"
            >
              <span class="sr-only">{{ isMobileSidebarOpen ? $t("admin.sidebar.closeMenu") : $t("admin.sidebar.openMenu") }}</span>
              <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 class="ml-3 text-lg font-medium" :class="darkMode ? 'text-white' : 'text-gray-900'">
              {{ visibleMenuItems.find((item) => item.id === activeMenu)?.name || $t("admin.sidebar.dashboard") }}
            </h1>
          </div>
        </div>

        <!-- 移动端侧边栏覆盖层 -->
        <transition name="slide">
          <div v-if="isMobileSidebarOpen" class="md:hidden fixed inset-0 z-50 flex">
            <!-- 侧边栏背景遮罩 -->
            <div class="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity" @click="toggleMobileSidebar"></div>

            <!-- 侧边栏内容 -->
            <div
              class="relative flex-1 flex flex-col w-full max-w-xs shadow-xl transform transition-transform ease-in-out duration-300"
              :class="darkMode ? 'bg-gray-800' : 'bg-white'"
            >
              <!-- 移动端侧边栏标题和关闭按钮 -->
              <div class="flex items-center justify-between p-3 h-14 border-b" :class="darkMode ? 'border-gray-700' : 'border-gray-200'">
                <h1 class="text-lg font-medium" :class="darkMode ? 'text-white' : 'text-gray-900'">
                  {{ loginType === "admin" ? $t("admin.sidebar.menuTitle.admin") : $t("admin.sidebar.menuTitle.user") }}
                </h1>
                <button
                  type="button"
                  @click="toggleMobileSidebar"
                  class="h-10 w-10 inline-flex items-center justify-center rounded-md focus:outline-none"
                  :class="darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-900'"
                >
                  <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <!-- 移动端菜单项 -->
              <div class="flex-1 overflow-y-auto">
                <nav class="px-4 pt-4 space-y-2">
                  <a
                    v-for="item in visibleMenuItems"
                    :key="item.id"
                    @click="
                      selectMenuItem(item.id);
                      toggleMobileSidebar();
                    "
                    :class="[
                      activeMenu === item.id
                        ? darkMode
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-900'
                        : darkMode
                        ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                      'group flex items-center px-3 py-3 text-base font-medium rounded-md cursor-pointer',
                    ]"
                  >
                    <svg
                      class="mr-3 flex-shrink-0 h-6 w-6"
                      :class="activeMenu === item.id ? 'text-primary-500' : darkMode ? 'text-gray-400 group-hover:text-gray-300' : 'text-gray-400 group-hover:text-gray-500'"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="getIconPath(item.icon)" />
                    </svg>
                    {{ item.name }}
                  </a>

                  <!-- 退出登录按钮 -->
                  <div class="pt-4 mt-4 border-t" :class="darkMode ? 'border-gray-700' : 'border-gray-200'">
                    <a
                      @click="handleLogout"
                      :class="[
                        darkMode ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                        'group flex items-center px-3 py-3 text-base font-medium rounded-md cursor-pointer',
                      ]"
                    >
                      <svg
                        class="mr-3 flex-shrink-0 h-6 w-6"
                        :class="darkMode ? 'text-gray-400' : 'text-gray-400'"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="getIconPath('logout')" />
                      </svg>
                      {{ loginType === "admin" ? $t("admin.sidebar.logout") : $t("admin.sidebar.logoutAuth") }}
                    </a>
                  </div>
                </nav>
              </div>
            </div>
          </div>
        </transition>

        <main class="relative z-30 overflow-y-auto focus:outline-none flex flex-col h-full">
          <!-- 内容区域 -->
          <div class="mx-auto w-full px-2 sm:px-4 md:px-6 lg:px-8 mt-2 md:mt-4 flex-1 flex flex-col pb-4" style="max-width: 1280px">
            <div class="rounded-lg flex-1 flex flex-col" :class="darkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'">
              <!-- 根据选中的菜单显示不同的内容 -->
              <div v-if="activeMenu === 'dashboard' && props.permissions.isAdmin" class="p-2 md:p-4 flex-1 flex flex-col">
                <Dashboard :dark-mode="darkMode" />
              </div>

              <!-- 当API密钥用户尝试访问Dashboard时显示权限不足提示 -->
              <div v-else-if="activeMenu === 'dashboard'" class="p-6 flex-1 flex flex-col items-center justify-center text-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-16 w-16 mb-4"
                  :class="darkMode ? 'text-gray-600' : 'text-gray-400'"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <h3 class="text-xl font-semibold mb-2" :class="darkMode ? 'text-white' : 'text-gray-800'">{{ $t("admin.permissionDenied.title") }}</h3>
                <p class="text-base mb-4" :class="darkMode ? 'text-gray-300' : 'text-gray-600'">{{ $t("admin.permissionDenied.message") }}</p>
                <p class="text-sm" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ $t("admin.permissionDenied.suggestion") }}</p>
              </div>

              <div v-else-if="activeMenu === 'text-management'" class="flex-1 flex flex-col">
                <TextManagement :dark-mode="darkMode" class="flex-1" />
              </div>

              <div v-else-if="activeMenu === 'file-management'" class="flex-1 flex flex-col">
                <FileManagement :dark-mode="darkMode" :user-type="loginType" class="flex-1" />
              </div>

              <div v-else-if="activeMenu === 'storage-config'" class="flex-1 flex flex-col">
                <StorageConfig :dark-mode="darkMode" class="flex-1" />
              </div>

              <div v-else-if="activeMenu === 'mount-management'" class="flex-1 flex flex-col">
                <MountManagement :dark-mode="darkMode" :user-type="loginType" class="flex-1" />
              </div>

              <div v-else-if="activeMenu === 'key-management'" class="flex-1 flex flex-col">
                <KeyManagement :dark-mode="darkMode" class="flex-1" />
              </div>

              <div v-else-if="activeMenu === 'settings'" class="flex-1 flex flex-col">
                <SystemSettings :dark-mode="darkMode" @logout="handleLogout" class="flex-1" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 淡入淡出动画效果 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 侧边栏滑入滑出动画 */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease-out;
}

.slide-enter-from .fixed.inset-0.bg-gray-900 {
  opacity: 0;
}

.slide-leave-to .fixed.inset-0.bg-gray-900 {
  opacity: 0;
}

.slide-enter-from .relative.flex-1 {
  transform: translateX(-100%);
}

.slide-leave-to .relative.flex-1 {
  transform: translateX(-100%);
}

/* 输入框获取焦点时的动效 */
input:focus {
  box-shadow: 0 0 0 2px rgba(var(--color-primary-500), 0.2);
  transform: translateY(-1px);
  transition: all 0.2s ease;
}

/* 按钮hover效果 */
button:not(:disabled):hover {
  transform: translateY(-1px);
  transition: all 0.2s ease;
}

/* 内容区域适配 */
main {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

main > div {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
}

.rounded-lg {
  min-height: 500px;
}

/* 移动端优化 */
@media (max-width: 768px) {
  .rounded-lg {
    border-radius: 0.375rem;
    min-height: 400px;
  }
}
</style>
