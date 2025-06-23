/**
 * CloudPaste PWA 管理器
 * 处理 PWA 相关功能：安装、更新、离线存储等
 */

import { reactive } from "vue";

// PWA 状态管理
export const pwaState = reactive({
  isInstallable: false,
  isInstalled: false,
  isUpdateAvailable: false,
  isOffline: false,
  registration: null,
  deferredPrompt: null,
  version: "1.0.0",
});

// 离线存储管理
class OfflineStorage {
  constructor() {
    this.dbName = "CloudPasteOfflineDB";
    this.version = 2; // 增加版本号以触发数据库升级
    this.db = null;
  }

  async init() {
    // 请求持久化存储权限
    if ("storage" in navigator && "persist" in navigator.storage) {
      try {
        const persistent = await navigator.storage.persist();
        console.log(`[PWA] 持久化存储: ${persistent ? "已启用" : "未启用"}`);
      } catch (error) {
        console.warn("[PWA] 无法请求持久化存储:", error);
      }
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 创建文本分享存储
        if (!db.objectStoreNames.contains("pastes")) {
          const pasteStore = db.createObjectStore("pastes", { keyPath: "slug" });
          pasteStore.createIndex("createdAt", "createdAt", { unique: false });
          pasteStore.createIndex("cachedAt", "cachedAt", { unique: false });
        }

        // 创建文件信息存储
        if (!db.objectStoreNames.contains("files")) {
          const fileStore = db.createObjectStore("files", { keyPath: "slug" });
          fileStore.createIndex("createdAt", "createdAt", { unique: false });
          fileStore.createIndex("cachedAt", "cachedAt", { unique: false });
        }

        // 创建目录结构存储
        if (!db.objectStoreNames.contains("directories")) {
          const dirStore = db.createObjectStore("directories", { keyPath: "path" });
          dirStore.createIndex("lastModified", "lastModified", { unique: false });
          dirStore.createIndex("cachedAt", "cachedAt", { unique: false });
        }

        // 创建用户设置存储
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }
      };
    });
  }

  async savePaste(paste) {
    if (!this.db) await this.init();

    const transaction = this.db.transaction(["pastes"], "readwrite");
    const store = transaction.objectStore("pastes");

    const pasteData = {
      ...paste,
      cachedAt: new Date().toISOString(),
      isOfflineCache: true,
    };

    return store.put(pasteData);
  }

  async getPaste(slug) {
    if (!this.db) await this.init();

    const transaction = this.db.transaction(["pastes"], "readonly");
    const store = transaction.objectStore("pastes");

    return new Promise((resolve, reject) => {
      const request = store.get(slug);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveFile(file) {
    if (!this.db) await this.init();

    const transaction = this.db.transaction(["files"], "readwrite");
    const store = transaction.objectStore("files");

    const fileData = {
      ...file,
      cachedAt: new Date().toISOString(),
      isOfflineCache: true,
    };

    return store.put(fileData);
  }

  async getFile(slug) {
    if (!this.db) await this.init();

    const transaction = this.db.transaction(["files"], "readonly");
    const store = transaction.objectStore("files");

    return new Promise((resolve, reject) => {
      const request = store.get(slug);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveDirectory(path, data) {
    if (!this.db) await this.init();

    const transaction = this.db.transaction(["directories"], "readwrite");
    const store = transaction.objectStore("directories");

    const dirData = {
      path,
      data,
      cachedAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };

    return store.put(dirData);
  }

  async getDirectory(path) {
    if (!this.db) await this.init();

    const transaction = this.db.transaction(["directories"], "readonly");
    const store = transaction.objectStore("directories");

    return new Promise((resolve, reject) => {
      const request = store.get(path);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveSetting(key, value) {
    if (!this.db) await this.init();

    const transaction = this.db.transaction(["settings"], "readwrite");
    const store = transaction.objectStore("settings");

    return store.put({ key, value, updatedAt: new Date().toISOString() });
  }

  async getSetting(key) {
    if (!this.db) await this.init();

    const transaction = this.db.transaction(["settings"], "readonly");
    const store = transaction.objectStore("settings");

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  async clearExpiredCache(maxAge = 7 * 24 * 60 * 60 * 1000) {
    // 7天
    if (!this.db) await this.init();

    const cutoffTime = new Date(Date.now() - maxAge).toISOString();
    const stores = ["pastes", "files", "directories"];

    for (const storeName of stores) {
      const transaction = this.db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      const index = store.index("cachedAt");

      const range = IDBKeyRange.upperBound(cutoffTime);
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    }

    // 清理过期的设置缓存
    await this.clearExpiredSettings(maxAge);
  }

  async clearExpiredSettings(maxAge = 7 * 24 * 60 * 60 * 1000) {
    if (!this.db) await this.init();

    try {
      const transaction = this.db.transaction(["settings"], "readwrite");
      const store = transaction.objectStore("settings");
      const request = store.getAll();

      request.onsuccess = () => {
        const settings = request.result;
        const cutoffTime = Date.now() - maxAge;

        settings.forEach((setting) => {
          if (setting.updatedAt) {
            const settingTime = new Date(setting.updatedAt).getTime();
            if (settingTime < cutoffTime && setting.key.startsWith("api_cache_")) {
              store.delete(setting.key);
            }
          }
        });
      };
    } catch (error) {
      console.warn("清理过期设置缓存失败:", error);
    }
  }

  async clearAllApiCache() {
    if (!this.db) await this.init();

    try {
      const transaction = this.db.transaction(["settings"], "readwrite");
      const store = transaction.objectStore("settings");
      const request = store.getAll();

      request.onsuccess = () => {
        const settings = request.result;

        settings.forEach((setting) => {
          if (
            setting.key.startsWith("api_cache_") ||
            setting.key.startsWith("admin_") ||
            setting.key.startsWith("user_") ||
            setting.key.startsWith("system_") ||
            setting.key.startsWith("test_") ||
            setting.key.startsWith("s3_config_") ||
            setting.key.startsWith("url_") ||
            setting.key.startsWith("public_file_") ||
            setting.key.startsWith("raw_paste_") ||
            setting.key === "s3_configs_list" ||
            setting.key === "url_info_cache"
          ) {
            store.delete(setting.key);
          }
        });
      };

      console.log("[PWA] 所有API缓存已清理");
    } catch (error) {
      console.warn("清理API缓存失败:", error);
    }
  }
}

// 创建离线存储实例
export const offlineStorage = new OfflineStorage();

// PWA 管理器类
class PWAManager {
  constructor() {
    this.init();
  }

  async init() {
    // 初始化离线存储
    try {
      await offlineStorage.init();
      console.log("[PWA] 离线存储初始化成功");
    } catch (error) {
      console.error("[PWA] 离线存储初始化失败:", error);
    }

    // 监听网络状态
    this.setupNetworkListeners();

    // 监听安装提示
    this.setupInstallPrompt();

    // 检查是否已安装
    this.checkInstallStatus();

    // 注册 Service Worker 更新监听
    this.setupServiceWorkerListeners();
  }

  setupNetworkListeners() {
    const updateOnlineStatus = () => {
      pwaState.isOffline = !navigator.onLine;
      console.log(`[PWA] 网络状态: ${navigator.onLine ? "在线" : "离线"}`);
    };

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    updateOnlineStatus();
  }

  setupInstallPrompt() {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      pwaState.deferredPrompt = e;
      pwaState.isInstallable = true;
      console.log("[PWA] 应用可安装");
    });

    window.addEventListener("appinstalled", () => {
      pwaState.isInstalled = true;
      pwaState.isInstallable = false;
      pwaState.deferredPrompt = null;
      console.log("[PWA] 应用已安装");
    });
  }

  checkInstallStatus() {
    // 检查是否在独立模式下运行（已安装）
    if (window.matchMedia("(display-mode: standalone)").matches) {
      pwaState.isInstalled = true;
    }
  }

  setupServiceWorkerListeners() {
    if ("serviceWorker" in navigator) {
      // 获取当前注册的Service Worker
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          pwaState.registration = registration;
          console.log("[PWA] Service Worker已注册");
        }
      });

      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "SW_UPDATED") {
          pwaState.isUpdateAvailable = true;
          console.log("[PWA] 检测到应用更新");
        }
      });
    }
  }

  async installApp() {
    if (!pwaState.deferredPrompt) {
      console.warn("[PWA] 无法安装应用：没有安装提示");
      return false;
    }

    try {
      pwaState.deferredPrompt.prompt();
      const { outcome } = await pwaState.deferredPrompt.userChoice;

      if (outcome === "accepted") {
        console.log("[PWA] 用户接受安装");
        pwaState.isInstallable = false;
        return true;
      } else {
        console.log("[PWA] 用户拒绝安装");
        return false;
      }
    } catch (error) {
      console.error("[PWA] 安装失败:", error);
      return false;
    } finally {
      pwaState.deferredPrompt = null;
    }
  }

  async updateApp() {
    if (!pwaState.registration) {
      console.warn("[PWA] 无法更新应用：没有 Service Worker 注册");
      return false;
    }

    try {
      if (pwaState.registration.waiting) {
        pwaState.registration.waiting.postMessage({ type: "SKIP_WAITING" });
        window.location.reload();
        return true;
      }
      return false;
    } catch (error) {
      console.error("[PWA] 更新失败:", error);
      return false;
    }
  }
}

// 创建 PWA 管理器实例
export const pwaManager = new PWAManager();

// 导出工具函数
export const pwaUtils = {
  isOnline: () => navigator.onLine,
  isInstalled: () => pwaState.isInstalled,
  isInstallable: () => pwaState.isInstallable,
  isUpdateAvailable: () => pwaState.isUpdateAvailable,
  install: () => pwaManager.installApp(),
  update: () => pwaManager.updateApp(),

  // 离线存储工具
  storage: {
    savePaste: (paste) => offlineStorage.savePaste(paste),
    getPaste: (slug) => offlineStorage.getPaste(slug),
    saveFile: (file) => offlineStorage.saveFile(file),
    getFile: (slug) => offlineStorage.getFile(slug),
    saveDirectory: (path, data) => offlineStorage.saveDirectory(path, data),
    getDirectory: (path) => offlineStorage.getDirectory(path),
    saveSetting: (key, value) => offlineStorage.saveSetting(key, value),
    getSetting: (key) => offlineStorage.getSetting(key),
    clearExpiredCache: () => offlineStorage.clearExpiredCache(),
    clearAllApiCache: () => offlineStorage.clearAllApiCache(),
    clearExpiredSettings: (maxAge) => offlineStorage.clearExpiredSettings(maxAge),
  },
};
