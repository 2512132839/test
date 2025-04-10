<script setup>
import { ref, watchEffect, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import MarkdownEditor from "./components/MarkdownEditor.vue";
import EnvSwitcher from "./components/EnvSwitcher.vue";
import AdminPage from "./components/adminManagement/AdminPage.vue";
import PasteView from "./components/PasteView.vue";
import FileUploadPage from "./components/FileUpload.vue";
import FileView from "./components/FileView.vue";
import LanguageSwitcher from "./components/LanguageSwitcher.vue";

// 使用i18n
const { t } = useI18n();

// 初始化暗色模式状态
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const savedTheme = localStorage.getItem("theme");

// 优先使用存储的主题设置，如果没有则使用系统偏好
const darkMode = ref(savedTheme === "dark" || (savedTheme === null && prefersDark));

// 当前激活的页面
const activePage = ref("home"); // 'home', 'upload', 'admin', 'paste-view'

// 过渡状态，用于页面切换动画
const transitioning = ref(false);

// 分享链接的slug
const pasteSlug = ref(null);

// 文件预览链接的slug
const fileSlug = ref(null);

// 开发环境判断
const isDev = import.meta.env.DEV;

// 环境切换器显示控制
const showEnvSwitcher = ref(false);

// GitHub仓库链接
const githubUrl = "https://github.com/ling-drag0n/CloudPaste";

// 在mounted钩子中检查是否显示环境切换器
onMounted(() => {
  // 在开发环境中始终显示
  if (isDev) {
    showEnvSwitcher.value = true;
  } else {
    // 在生产环境中，只有在明确的条件下才显示：
    // 1. 存在管理员token
    // 2. URL中有特定的参数 (showEnvSwitcher) 也就是"https://域名.com?showEnvSwitcher"
    const hasAdminToken = !!localStorage.getItem("admin_token");
    const urlParams = new URLSearchParams(window.location.search);
    const hasEnvParam = urlParams.has("showEnvSwitcher");

    // 确保在生产环境中默认不显示
    showEnvSwitcher.value = hasAdminToken && hasEnvParam;
  }
});

// 添加移动端菜单展开状态
const isMobileMenuOpen = ref(false);

// 切换移动端菜单状态
const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value;
};

const toggleDarkMode = () => {
  darkMode.value = !darkMode.value;
  updateTheme();
};

// 监听并更新 DOM 的主题类
watchEffect(() => {
  updateTheme();
});

// 更新主题
function updateTheme() {
  if (darkMode.value) {
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "dark");
  } else {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }
}

// 页面导航
const navigateTo = (page) => {
  // 如果当前页面与目标页面相同，则不执行任何操作
  if (activePage.value === page) {
    return;
  }

  // 先对当前页面进行清理操作
  const prevPage = activePage.value;

  // 如果移动菜单是打开的，关闭它
  if (isMobileMenuOpen.value) {
    isMobileMenuOpen.value = false;
  }

  // 延迟切换页面，让当前页面有时间完成清理
  setTimeout(() => {
    activePage.value = page;
    // 如果不是查看分享页，清除slug
    if (page !== "paste-view") {
      pasteSlug.value = null;
    }
    // 如果需要，更新URL
    updateUrl();

    // 添加调试日志
    console.log(`页面从 ${prevPage} 切换到 ${page}`);

    // 输出当前token信息，用于调试
    const adminToken = localStorage.getItem("admin_token");
    console.log(`切换页面后token状态: ${adminToken ? "存在" : "不存在"}`);
  }, 0);
};

// 更新URL地址，保持与当前视图同步
const updateUrl = () => {
  let path = "/";

  if (activePage.value === "paste-view" && pasteSlug.value) {
    path = `/paste/${pasteSlug.value}`;
    window.history.pushState({}, "", path);
  } else if (activePage.value === "file-view" && fileSlug.value) {
    path = `/file/${fileSlug.value}`;
    window.history.pushState({}, "", path);
  } else if (activePage.value !== "home") {
    path = `/${activePage.value}`;
    window.history.pushState({}, "", path);
  } else {
    window.history.pushState({}, "", "/");
  }
};

// 处理URL路径变化
const handlePathChange = () => {
  const path = window.location.pathname;
  console.log("路径变化检测:", path);

  // 检查是否是分享链接格式
  const pasteMatch = path.match(/^\/paste\/([a-zA-Z0-9_-]+)$/);
  if (pasteMatch) {
    console.log("检测到分享链接路径:", pasteMatch[1]);
    // 如果当前不是paste-view页面，则进行平滑切换
    if (activePage.value !== "paste-view") {
      setTimeout(() => {
        pasteSlug.value = pasteMatch[1];
        activePage.value = "paste-view";
        console.log("切换到分享查看页面");
      }, 0);
    } else {
      pasteSlug.value = pasteMatch[1];
    }
    return;
  }

  // 检查是否是文件预览链接格式
  const fileMatch = path.match(/^\/file\/([a-zA-Z0-9_-]+)$/);
  if (fileMatch) {
    console.log("检测到文件预览链接路径:", fileMatch[1]);
    // 如果当前不是file-view页面，则进行平滑切换
    if (activePage.value !== "file-view") {
      setTimeout(() => {
        fileSlug.value = fileMatch[1];
        activePage.value = "file-view";
        console.log("切换到文件预览页面");
      }, 0);
    } else {
      fileSlug.value = fileMatch[1];
    }
    return;
  }

  // 处理其他路径，使用延迟切换
  let newPage = "home";
  if (path === "/upload") {
    newPage = "upload";
    console.log("检测到上传页面路径");
  } else if (path === "/admin") {
    newPage = "admin";
    console.log("检测到管理页面路径");

    // 检查管理员令牌是否已过期
    const adminToken = localStorage.getItem("admin_token");
    if (adminToken) {
      // 导入并使用 fetchApi 函数
      import("./api/client.js").then(({ fetchApi }) => {
        fetchApi("test/admin-token", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }).catch((error) => {
          console.error("管理员令牌验证失败:", error);
          // 令牌验证失败，清除令牌并刷新页面
          localStorage.removeItem("admin_token");
          // 保持在管理页面，但会显示登录表单
          window.dispatchEvent(new CustomEvent("admin-token-expired"));
        });
      });
    }
  } else {
    console.log("检测到首页路径");
  }

  // 如果页面发生变化，延迟切换
  if (activePage.value !== newPage) {
    setTimeout(() => {
      activePage.value = newPage;
      console.log(`路径切换: 页面从 ${activePage.value} 变为 ${newPage}`);

      // 检查权限状态
      const adminToken = localStorage.getItem("admin_token");
      const apiKey = localStorage.getItem("api_key");
      console.log(`页面切换后权限状态: adminToken=${adminToken ? "存在" : "不存在"}, apiKey=${apiKey ? "存在" : "不存在"}`);
    }, 0);
  }
};

// 监听浏览器前进后退事件
const handlePopState = () => {
  handlePathChange();
};

// 添加/移除事件监听器
let popStateListener = null;

// 组件挂载时检查URL路径
onMounted(() => {
  // 处理当前URL路径
  handlePathChange();

  // 监听浏览器前进后退按钮事件
  popStateListener = handlePopState;
  window.addEventListener("popstate", popStateListener);
});

// 组件卸载时移除事件监听
onBeforeUnmount(() => {
  // 移除事件监听器
  if (popStateListener) {
    window.removeEventListener("popstate", popStateListener);
    popStateListener = null;
  }
});

// 初始设置
updateTheme();
</script>

<template>
  <div :class="['app-container min-h-screen transition-colors duration-200', darkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900']">
    <header :class="['sticky top-0 z-50 shadow-sm transition-colors', darkMode ? 'bg-gray-800' : 'bg-white']">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex">
            <div class="flex-shrink-0 flex items-center">
              <h1 class="text-xl font-bold">{{ $t("app.title") }}</h1>
            </div>
            <nav class="hidden sm:ml-6 sm:flex sm:space-x-8">
              <a
                  href="#"
                  @click.prevent="navigateTo('home')"
                  :class="[
                  activePage === 'home' ? 'border-primary-500 text-current' : 'border-transparent hover:border-gray-300',
                  'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200',
                  activePage !== 'home' && darkMode ? 'text-gray-300 hover:text-gray-100' : activePage !== 'home' ? 'text-gray-500 hover:text-gray-700' : '',
                ]"
              >
                {{ $t("nav.home") }}
              </a>
              <a
                  href="#"
                  @click.prevent="navigateTo('upload')"
                  :class="[
                  activePage === 'upload' ? 'border-primary-500 text-current' : 'border-transparent hover:border-gray-300',
                  'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200',
                  activePage !== 'upload' && darkMode ? 'text-gray-300 hover:text-gray-100' : activePage !== 'upload' ? 'text-gray-500 hover:text-gray-700' : '',
                ]"
              >
                {{ $t("nav.upload") }}
              </a>
              <a
                  href="#"
                  @click.prevent="navigateTo('admin')"
                  :class="[
                  activePage === 'admin' ? 'border-primary-500 text-current' : 'border-transparent hover:border-gray-300',
                  'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200',
                  activePage !== 'admin' && darkMode ? 'text-gray-300 hover:text-gray-100' : activePage !== 'admin' ? 'text-gray-500 hover:text-gray-700' : '',
                ]"
              >
                {{ $t("nav.admin") }}
              </a>
            </nav>
          </div>
          <div class="hidden sm:ml-6 sm:flex sm:items-center space-x-2">
            <a
                :href="githubUrl"
                target="_blank"
                rel="noopener noreferrer"
                :class="[
                'p-2 rounded-full focus:outline-none transition-colors',
                darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
              ]"
                aria-label="GitHub"
                title="GitHub"
            >
              <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path
                    d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
                />
              </svg>
            </a>

            <LanguageSwitcher :darkMode="darkMode" />

            <button
                type="button"
                @click="toggleDarkMode"
                :class="[
                'p-2 rounded-full focus:outline-none transition-colors',
                darkMode ? 'text-yellow-300 hover:text-yellow-200 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-500 hover:bg-gray-100',
              ]"
            >
              <span class="sr-only">{{ $t("theme.toggle") }}</span>
              <svg v-if="darkMode" class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <svg v-else class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            </button>
          </div>

          <!-- 移动端菜单按钮 -->
          <div class="flex items-center sm:hidden">
            <a
                :href="githubUrl"
                target="_blank"
                rel="noopener noreferrer"
                :class="[
                'p-2 rounded-full focus:outline-none transition-colors mr-2',
                darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
              ]"
                aria-label="GitHub"
                title="GitHub"
            >
              <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path
                    d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
                />
              </svg>
            </a>

            <LanguageSwitcher :darkMode="darkMode" class="mr-2" />

            <button
                type="button"
                @click="toggleDarkMode"
                :class="[
                'p-2 rounded-full focus:outline-none transition-colors mr-2',
                darkMode ? 'text-yellow-300 hover:text-yellow-200 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-500 hover:bg-gray-100',
              ]"
                aria-label="切换主题"
            >
              <svg v-if="darkMode" class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <svg v-else class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            </button>
            <button
                type="button"
                @click="toggleMobileMenu"
                :class="[
                'inline-flex items-center justify-center p-2 rounded-full focus:outline-none transition-all duration-200',
                isMobileMenuOpen
                  ? darkMode
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-200 text-gray-900'
                  : darkMode
                  ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
              ]"
                :aria-expanded="isMobileMenuOpen"
                aria-label="主菜单"
            >
              <!-- 菜单图标 -->
              <svg v-if="!isMobileMenuOpen" class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <!-- 关闭图标 -->
              <svg v-else class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 移动端菜单面板 -->
      <div class="sm:hidden overflow-hidden transition-all duration-300 ease-in-out" :class="[isMobileMenuOpen ? 'max-h-80' : 'max-h-0']">
        <div :class="['py-3 border-t transition-colors', darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200']">
          <a
              href="#"
              @click.prevent="navigateTo('home')"
              :class="[
              'flex items-center px-4 py-3 transition-colors duration-200',
              activePage === 'home'
                ? darkMode
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-100 text-gray-900'
                : darkMode
                ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
            ]"
          >
            <span class="ml-2">{{ $t("nav.home") }}</span>
          </a>
          <a
              href="#"
              @click.prevent="navigateTo('upload')"
              :class="[
              'flex items-center px-4 py-3 transition-colors duration-200',
              activePage === 'upload'
                ? darkMode
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-100 text-gray-900'
                : darkMode
                ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
            ]"
          >
            <span class="ml-2">{{ $t("nav.upload") }}</span>
          </a>
          <a
              href="#"
              @click.prevent="navigateTo('admin')"
              :class="[
              'flex items-center px-4 py-3 transition-colors duration-200',
              activePage === 'admin'
                ? darkMode
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-100 text-gray-900'
                : darkMode
                ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
            ]"
          >
            <span class="ml-2">{{ $t("nav.admin") }}</span>
          </a>
        </div>
      </div>
    </header>

    <main class="flex-1 flex flex-col">
      <!-- 根据当前活动页面显示不同内容 -->
      <div v-if="activePage === 'home'" class="transition-opacity duration-300 flex-1 flex flex-col" :class="{ 'opacity-0': transitioning }">
        <MarkdownEditor :darkMode="darkMode" />
      </div>
      <div v-else-if="activePage === 'upload'" class="transition-opacity duration-300 flex-1 flex flex-col" :class="{ 'opacity-0': transitioning }">
        <FileUploadPage :darkMode="darkMode" />
      </div>
      <div v-else-if="activePage === 'admin'" class="transition-opacity duration-300 flex-1 flex flex-col" :class="{ 'opacity-0': transitioning }">
        <AdminPage :dark-mode="darkMode" class="flex-1 flex flex-col" />
      </div>
      <div
          v-else-if="activePage === 'paste-view' && pasteSlug"
          class="transition-opacity duration-300 flex-1 flex flex-col"
          :class="{ 'opacity-0': transitioning, dark: darkMode }"
      >
        <PasteView :slug="pasteSlug" :dark-mode="darkMode" />
      </div>
      <div v-else-if="activePage === 'file-view' && fileSlug" class="transition-opacity duration-300 flex-1 flex flex-col" :class="{ 'opacity-0': transitioning, dark: darkMode }">
        <FileView :slug="fileSlug" :dark-mode="darkMode" />
      </div>
    </main>

    <footer :class="['border-t transition-colors mt-auto', darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200']">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-6">
        <p :class="['text-sm', darkMode ? 'text-gray-400' : 'text-gray-500']">
          {{ $t("footer.copyright", { year: new Date().getFullYear() }) }}
        </p>
      </div>
    </footer>

    <!-- 添加环境切换器组件 (在开发环境或管理员登录状态下显示) -->
    <!-- <EnvSwitcher v-if="showEnvSwitcher" /> -->
  </div>
</template>

<style>
/* 全局样式 */
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* 移动端菜单过渡动画 */
.sm\:hidden {
  transition: all 0.3s ease-in-out;
}

/* 按钮触摸反馈 */
@media (max-width: 640px) {
  button,
  a {
    -webkit-tap-highlight-color: transparent;
  }
}

/* 主题色适配 - 需要添加到 tailwind.config.js 中的 primary 色 */
:root {
  --color-primary-500: #3b82f6; /* 蓝色作为默认主题色 */
}

.dark {
  --color-primary-500: #60a5fa; /* 深色模式下使用较亮的蓝色 */
}

.border-primary-500 {
  border-color: var(--color-primary-500);
}

/* 禁用移动端点击时的蓝色高亮 */
* {
  -webkit-tap-highlight-color: transparent;
}

/* 管理页面填充样式 */
[v-if="activePage === 'admin'"] {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  height: 100%;
}
</style>
