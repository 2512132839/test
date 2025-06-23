/**
 * Vue Router 配置
 */

import { createRouter, createWebHistory } from "vue-router";
import { pwaState } from "../pwa/pwaManager.js";
import OfflineFallback from "../components/OfflineFallback.vue";
import { showPageUnavailableToast } from "../utils/offlineToast.js";

// 懒加载组件 - 添加离线错误处理
const createOfflineAwareImport = (importFn, componentName = "页面") => {
  return () =>
    importFn().catch((error) => {
      console.error("组件加载失败:", error);

      // 如果是离线状态且加载失败，显示离线回退页面和Toast提示
      if (pwaState.isOffline || !navigator.onLine) {
        console.log("[离线模式] 组件未缓存，显示离线回退页面");

        // 显示Toast提示
        setTimeout(() => {
          showPageUnavailableToast(componentName);
        }, 100);

        return OfflineFallback;
      }

      // 在线状态下的加载失败，重新抛出错误
      throw error;
    });
};

const MarkdownEditor = createOfflineAwareImport(() => import("../components/MarkdownEditor.vue"), "首页");
const FileUploadPage = createOfflineAwareImport(() => import("../components/FileUpload.vue"), "文件上传页面");
const AdminPage = createOfflineAwareImport(() => import("../components/adminManagement/AdminPage.vue"), "管理面板");
const PasteView = createOfflineAwareImport(() => import("../components/PasteView.vue"), "文本分享页面");
const FileView = createOfflineAwareImport(() => import("../components/FileView.vue"), "文件预览页面");
const MountExplorer = createOfflineAwareImport(() => import("../components/MountExplorer.vue"), "挂载浏览器");

// 路由配置 - 完全对应原有的页面逻辑
const routes = [
  {
    path: "/",
    name: "Home",
    component: MarkdownEditor,
    meta: {
      title: "CloudPaste - 在线剪贴板",
      originalPage: "home",
    },
  },
  {
    path: "/upload",
    name: "Upload",
    component: FileUploadPage,
    meta: {
      title: "文件上传 - CloudPaste",
      originalPage: "upload",
    },
  },
  {
    path: "/admin",
    name: "Admin",
    component: AdminPage,
    props: (route) => ({
      activeModule: route.params.module || "dashboard",
    }),
    meta: {
      title: "管理面板 - CloudPaste",
      originalPage: "admin",
      requiresAuth: true,
    },
  },
  {
    path: "/admin/:module",
    name: "AdminModule",
    component: AdminPage,
    props: (route) => ({
      activeModule: route.params.module,
    }),
    meta: {
      title: "管理面板 - CloudPaste",
      originalPage: "admin",
      requiresAuth: true,
    },
  },
  {
    path: "/paste/:slug",
    name: "PasteView",
    component: PasteView,
    props: true,
    meta: {
      title: "查看分享 - CloudPaste",
      originalPage: "paste-view",
    },
  },
  {
    path: "/file/:slug",
    name: "FileView",
    component: FileView,
    props: true,
    meta: {
      title: "文件预览 - CloudPaste",
      originalPage: "file-view",
    },
  },
  {
    path: "/mount-explorer",
    name: "MountExplorer",
    component: MountExplorer,
    props: (route) => ({
      darkMode: route.meta.darkMode || false,
    }),
    meta: {
      title: "挂载浏览 - CloudPaste",
      originalPage: "mount-explorer",
    },
    children: [
      {
        path: "",
        name: "MountExplorerMain",
        component: () => import("../components/mount-explorer/MountExplorerMain.vue"),
      },
      {
        path: ":pathMatch(.*)*",
        name: "MountExplorerPath",
        component: () => import("../components/mount-explorer/MountExplorerMain.vue"),
      },
    ],
  },
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    redirect: "/",
    meta: {
      title: "页面未找到 - CloudPaste",
    },
  },
];

// 创建路由实例
const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    // 保持原有的滚动行为
    if (savedPosition) {
      return savedPosition;
    } else {
      return { top: 0 };
    }
  },
});

// 路由守卫 - 使用认证Store进行主动权限验证
router.beforeEach(async (to, from, next) => {
  try {
    // 动态导入认证Store
    const { useAuthStore } = await import("../stores/authStore.js");
    const authStore = useAuthStore();

    // 如果需要认证且认证状态需要重新验证，则进行验证
    if (to.meta.requiresAuth && authStore.needsRevalidation) {
      console.log("路由守卫：需要重新验证认证状态");
      await authStore.validateAuth();
    }

    // 管理页面权限检查
    if (to.meta.requiresAuth && (to.name === "Admin" || to.name === "AdminModule")) {
      if (!authStore.isAuthenticated) {
        console.log("路由守卫：用户未认证，允许访问管理页面但会显示登录表单");
        // 允许访问但会显示登录表单，保持原有逻辑
        next();
        return;
      }

      // 检查是否有管理权限（管理员或有权限的API密钥用户）
      const hasManagementAccess =
        authStore.isAdmin || (authStore.authType === "apikey" && (authStore.hasTextPermission || authStore.hasFilePermission || authStore.hasMountPermission));

      if (!hasManagementAccess) {
        console.log("路由守卫：用户无管理权限，重定向到首页");
        next({ name: "Home" });
        return;
      }

      console.log("路由守卫：管理权限验证通过", {
        isAdmin: authStore.isAdmin,
        authType: authStore.authType,
        hasTextPermission: authStore.hasTextPermission,
        hasFilePermission: authStore.hasFilePermission,
        hasMountPermission: authStore.hasMountPermission,
      });
    }

    // 挂载浏览器页面权限检查
    if (to.name === "MountExplorer" || to.name === "MountExplorerMain" || to.name === "MountExplorerPath") {
      // 移除自动重定向逻辑，让组件自己处理权限显示
      // 这样用户可以看到友好的"无权限"提示而不是突然被重定向

      console.log("路由守卫：挂载页面访问", {
        isAuthenticated: authStore.isAuthenticated,
        hasMountPermission: authStore.hasMountPermission,
        authType: authStore.authType,
      });

      // 只对有挂载权限的API密钥用户进行路径权限检查
      if (authStore.authType === "apikey" && authStore.hasMountPermission && to.params.pathMatch) {
        const requestedPath = "/" + (Array.isArray(to.params.pathMatch) ? to.params.pathMatch.join("/") : to.params.pathMatch);
        if (!authStore.hasPathPermission(requestedPath)) {
          console.log("路由守卫：用户无此路径权限，重定向到基本路径");
          const basePath = authStore.userInfo.basicPath || "/";
          const redirectPath = basePath === "/" ? "/mount-explorer" : `/mount-explorer${basePath}`;
          next({ path: redirectPath });
          return;
        }
      }
    }

    next();
  } catch (error) {
    console.error("路由守卫错误:", error);
    // 发生错误时允许继续，避免阻塞路由
    next();
  }
});

// 路由错误处理
router.onError((error) => {
  console.error("路由错误:", error);

  // 如果是离线状态下的组件加载失败，不需要额外处理
  // 因为 createOfflineAwareImport 已经处理了
  if (pwaState.isOffline || !navigator.onLine) {
    console.log("[离线模式] 路由错误已由离线回退机制处理");
    return;
  }

  // 在线状态下的其他错误，可以添加额外的错误处理逻辑
  console.error("在线状态下的路由错误:", error);
});

// 路由后置守卫 - 处理页面标题和调试信息
router.afterEach(async (to, from) => {
  // 动态设置页面标题，支持国际化
  let title = "CloudPaste";

  try {
    // 动态导入 i18n 实例
    const { default: i18n } = await import("../i18n/index.js");
    const { t } = i18n.global;

    // 根据路由名称设置对应的国际化标题
    switch (to.name) {
      case "Home":
        title = t("pageTitle.home");
        break;
      case "Upload":
        title = t("pageTitle.upload");
        break;
      case "Admin":
        title = t("pageTitle.admin");
        break;
      case "AdminModule":
        if (to.params.module) {
          const moduleKeyMap = {
            dashboard: "dashboard",
            "text-management": "textManagement",
            "file-management": "fileManagement",
            "storage-config": "storageConfig",
            "mount-management": "mountManagement",
            "key-management": "keyManagement",
            settings: "settings",
          };
          const moduleKey = moduleKeyMap[to.params.module];
          if (moduleKey) {
            const moduleName = t(`pageTitle.adminModules.${moduleKey}`);
            title = `${moduleName} - CloudPaste`;
          } else {
            title = t("pageTitle.admin");
          }
        } else {
          title = t("pageTitle.admin");
        }
        break;
      case "PasteView":
        title = t("pageTitle.pasteView");
        break;
      case "FileView":
        title = t("pageTitle.fileView");
        break;
      case "MountExplorer":
      case "MountExplorerMain":
      case "MountExplorerPath":
        title = t("pageTitle.mountExplorer");
        break;
      case "NotFound":
        title = t("pageTitle.notFound");
        break;
      default:
        title = to.meta?.title || "CloudPaste";
    }
  } catch (error) {
    console.warn("无法加载国际化标题，使用默认标题:", error);
    title = to.meta?.title || "CloudPaste";
  }

  document.title = title;

  const fromPage = from.meta?.originalPage || "unknown";
  const toPage = to.meta?.originalPage || "unknown";
  console.log(`页面从 ${fromPage} 切换到 ${toPage}`);

  // 使用认证Store获取权限状态
  try {
    const { useAuthStore } = await import("../stores/authStore.js");
    const authStore = useAuthStore();
    console.log(`页面切换后权限状态: 认证类型=${authStore.authType}, 已认证=${authStore.isAuthenticated}, 管理员=${authStore.isAdmin}`);
  } catch (error) {
    console.warn("无法获取认证状态:", error);
  }

  // 保持原有的路径日志
  console.log("路径变化检测:", to.path);
});

// 导出路由实例
export default router;

// 导出工具函数
export const routerUtils = {
  /**
   * 导航到指定页面
   * @param {string} page - 页面名称 ('home', 'upload', 'admin', 'paste-view', 'file-view', 'mount-explorer')
   * @param {object} options - 可选参数 (如 slug, path, module)
   */
  navigateTo(page, options = {}) {
    const routeMap = {
      home: { name: "Home" },
      upload: { name: "Upload" },
      admin: { name: "Admin" },
      "paste-view": {
        name: "PasteView",
        params: { slug: options.slug || options.pasteSlug },
      },
      "file-view": {
        name: "FileView",
        params: { slug: options.slug || options.fileSlug },
      },
      "mount-explorer": { name: "MountExplorer" },
    };

    const route = routeMap[page];
    if (route) {
      // 特殊处理 admin 的模块参数
      if (page === "admin") {
        if (options.module && options.module !== "dashboard") {
          router.push(`/admin/${options.module}`);
        } else {
          router.push("/admin");
        }
        return;
      }

      // 特殊处理 mount-explorer 的路径参数
      if (page === "mount-explorer") {
        const query = {};
        let routePath = "/mount-explorer";

        // 处理路径参数
        if (options.path && options.path !== "/") {
          const normalizedPath = options.path.replace(/^\/+|\/+$/g, "");
          if (normalizedPath) {
            routePath = `/mount-explorer/${normalizedPath}`;
          }
        }

        // 处理预览文件参数
        if (options.previewFile) {
          query.preview = options.previewFile;
        }

        router.push({ path: routePath, query });
        return;
      }

      router.push(route);
    } else {
      console.warn(`未知页面: ${page}`);
      router.push({ name: "Home" });
    }
  },

  /**
   * 获取当前页面名称
   */
  getCurrentPage() {
    return router.currentRoute.value.meta?.originalPage || "home";
  },

  /**
   * 检查是否为指定页面
   */
  isCurrentPage(page) {
    return this.getCurrentPage() === page;
  },

  /**
   * 获取当前路由的 slug 参数
   */
  getCurrentSlug() {
    return router.currentRoute.value.params.slug || null;
  },
};
