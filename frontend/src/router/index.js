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
      pathMatch: "",
      previewFile: route.query.preview || null,
    }),
    meta: {
      title: "挂载浏览 - CloudPaste",
      originalPage: "mount-explorer",
    },
  },
  {
    path: "/mount-explorer/:pathMatch(.*)*",
    name: "MountExplorerPath",
    component: MountExplorer,
    props: (route) => ({
      pathMatch: route.params.pathMatch,
      previewFile: route.query.preview || null,
    }),
    meta: {
      title: "挂载浏览 - CloudPaste",
      originalPage: "mount-explorer",
    },
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

// 路由守卫 - 保持原有的权限检查逻辑
router.beforeEach(async (to, from, next) => {
  // 管理页面权限检查 - 检查所有管理相关路由
  if (to.meta.requiresAuth && (to.name === "Admin" || to.name === "AdminModule")) {
    const adminToken = localStorage.getItem("admin_token");
    if (adminToken) {
      // 验证 token 有效性 - 保持原有验证逻辑
      try {
        const { fetchApi } = await import("../api/client.js");
        await fetchApi("test/admin-token", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        });
        console.log("管理员令牌验证成功");
      } catch (error) {
        console.error("管理员令牌验证失败:", error);
        localStorage.removeItem("admin_token");
        // 保持在管理页面，但会显示登录表单 - 与原有逻辑一致
        window.dispatchEvent(new CustomEvent("admin-token-expired"));
      }
    }
  }

  next();
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

  const adminToken = localStorage.getItem("admin_token");
  const apiKey = localStorage.getItem("api_key");
  console.log(`页面切换后权限状态: adminToken=${adminToken ? "存在" : "不存在"}, apiKey=${apiKey ? "存在" : "不存在"}`);

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
