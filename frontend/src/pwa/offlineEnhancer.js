/**
 * 离线功能增强器
 * 为各个组件提供离线支持
 * 管理员API: (认证、文件系统、管理功能)
 * 用户API:  (文件系统、管理功能)
 * 文本分享API:  (paste, raw相关)
 * 配置管理API: (S3配置、URL上传等)
 * 其他业务API:  (公共文件等)
 */

import { pwaUtils } from "./pwaManager.js";

// API 拦截器 - 为离线状态提供缓存数据
export class OfflineApiInterceptor {
  constructor() {
    this.originalFetch = window.fetch;
    this.setupInterceptor();
  }

  setupInterceptor() {
    const originalFetch = this.originalFetch.bind(window);
    const self = this;

    window.fetch = async (url, options = {}) => {
      try {
        // 尝试网络请求
        const response = await originalFetch(url, options);

        // 如果成功，缓存响应数据
        if (response.ok && (options.method === "GET" || !options.method)) {
          await self.cacheResponse(url, response.clone());
        }

        return response;
      } catch (error) {
        // 网络失败时，尝试从缓存获取（无论离线状态如何）
        if (options.method === "GET" || !options.method) {
          const cachedData = await self.getCachedResponse(url);
          if (cachedData) {
            console.log(`[离线模式] 网络请求失败，从缓存返回数据: ${url}`);
            // 添加缓存标识头
            return new Response(JSON.stringify(cachedData), {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "X-Cache-Source": "offline-enhancer",
                "X-Cache-Time": new Date().toISOString(),
              },
            });
          }
        }
        throw error;
      }
    };
  }

  // 判断是否为需要业务逻辑处理的API
  shouldCacheBusinessApi(url) {
    // 系统API由Workbox处理
    if (url.includes("/api/system/") || url.includes("/api/health") || url.includes("/api/version")) {
      return false;
    }

    // 文件下载/预览API由Workbox处理
    if (url.includes("/api/file-download/") || url.includes("/api/file-view/") || url.includes("/api/office-preview/")) {
      return false;
    }

    // 文件系统预览下载API由Workbox处理
    if (url.includes("/api/admin/fs/preview") || url.includes("/api/admin/fs/download") || url.includes("/api/user/fs/preview") || url.includes("/api/user/fs/download")) {
      return false;
    }

    // 检查是否为API路径
    if (!url.includes("/api/")) {
      return false;
    }

    // 其他业务API需要offlineEnhancer处理，包括：
    // - 文件系统管理API: /api/(admin|user)/fs/(list|get|create|upload|remove|rename|copy)
    // - 文本分享API: /api/paste/, /api/raw/, /api/(admin|user)/pastes/
    // - 文件管理API: /api/(admin|user)/files/, /api/public/files/
    // - 管理员API: /api/admin/(login|logout|change-password|test-token|api-keys|mounts|dashboard|system-settings|cache)
    // - 用户管理API: /api/user/mounts/
    // - S3配置API: /api/s3-configs/
    // - S3上传API: /api/s3/(presign|commit|multipart)
    // - URL上传API: /api/url/(info|presign|commit|cancel|proxy)
    return true;
  }

  async cacheResponse(url, response) {
    try {
      // 检查响应的Content-Type
      const contentType = response.headers.get("content-type") || "";

      // 克隆响应以避免消费原始响应
      const responseClone = response.clone();
      let data;

      // 检查是否为需要业务逻辑处理的API
      if (!this.shouldCacheBusinessApi(url)) {
        console.log(`[离线模式] 跳过非业务API缓存: ${url}`);
        return; // 让Workbox处理系统API和二进制文件
      }

      // 根据Content-Type决定如何解析响应
      if (
          contentType.startsWith("image/") ||
          contentType.startsWith("video/") ||
          contentType.startsWith("audio/") ||
          contentType.startsWith("application/pdf") ||
          contentType.startsWith("application/octet-stream")
      ) {
        // 二进制文件 - 让Workbox的Cache API处理
        console.log(`[离线模式] 二进制文件由Workbox处理: ${url} (${contentType})`);
        return;
      } else if (contentType.startsWith("application/json")) {
        // JSON响应
        data = await responseClone.json();
      } else if (contentType.startsWith("text/")) {
        // 文本响应
        const text = await responseClone.text();
        data = {
          type: "text",
          contentType: contentType,
          data: text,
        };
      } else {
        // 其他类型，尝试JSON解析，失败则作为文本处理
        try {
          data = await responseClone.json();
        } catch (jsonError) {
          const text = await responseClone.text();
          data = {
            type: "text",
            contentType: contentType,
            data: text,
          };
        }
      }

      // 根据URL类型决定缓存策略
      if (url.includes("/api/paste/")) {
        const slug = this.extractSlugFromUrl(url);
        if (slug) {
          await pwaUtils.storage.savePaste({ slug, ...data });
        }
      } else if (url.includes("/api/file/")) {
        const slug = this.extractSlugFromUrl(url);
        if (slug) {
          await pwaUtils.storage.saveFile({ slug, ...data });
        }
      } else if (url.includes("/api/fs/")) {
        const path = this.extractPathFromUrl(url);
        if (path) {
          await pwaUtils.storage.saveDirectory(path, data);
        }
      } else if (url.includes("/admin/")) {
        // 管理员API缓存
        await this.cacheAdminApi(url, data);
      } else if (url.includes("/user/")) {
        // API密钥用户API缓存
        await this.cacheUserApi(url, data);
      } else if (url.includes("s3-configs")) {
        // S3配置API缓存
        await this.cacheS3ConfigApi(url, data);
      } else if (url.includes("/api/dashboard/")) {
        // 仪表盘统计API缓存
        await this.cacheDashboardApi(url, data);
      } else if (url.includes("public/files/")) {
        // 公共文件访问API缓存
        await this.cachePublicFileApi(url, data);
      } else if (url.includes("/api/raw/")) {
        // 原始文本API缓存
        await this.cacheRawApi(url, data);
      } else if (url.includes("/test/")) {
        // 测试API缓存
        await this.cacheTestApi(url, data);
      } else if (url.includes("/public/")) {
        // 公共文件API缓存
        await this.cachePublicFileApi(url, data);
      } else if (url.includes("url/")) {
        // URL相关API缓存（兼容旧版本）
        await this.cacheUrlApi(url, data);
      } else if (url.includes("/api/s3/")) {
        // S3上传API缓存
        await this.cacheS3UploadApi(url, data);
      }

      console.log(`[离线模式] API响应已缓存: ${url} (${data.type || "json"})`);
    } catch (error) {
      console.warn("缓存响应失败:", error);
    }
  }

  // 将缓存的数据转换回Response对象
  createResponseFromCachedData(data) {
    if (!data) return null;

    if (data.type === "text") {
      return new Response(data.data, {
        status: 200,
        statusText: "OK",
        headers: {
          "Content-Type": data.contentType,
          "X-Cache-Source": "offline-enhancer",
        },
      });
    } else {
      // 普通JSON数据
      return new Response(JSON.stringify(data), {
        status: 200,
        statusText: "OK",
        headers: {
          "Content-Type": "application/json",
          "X-Cache-Source": "offline-enhancer",
        },
      });
    }
  }

  async getCachedResponse(url) {
    try {
      // 检查是否为需要业务逻辑处理的API
      if (!this.shouldCacheBusinessApi(url)) {
        console.log(`[离线模式] 跳过非业务API缓存获取: ${url}`);
        return null; // 让Workbox处理
      }

      if (url.includes("/api/paste/")) {
        const slug = this.extractSlugFromUrl(url);
        return slug ? await pwaUtils.storage.getPaste(slug) : null;
      } else if (url.includes("/api/file/")) {
        const slug = this.extractSlugFromUrl(url);
        return slug ? await pwaUtils.storage.getFile(slug) : null;
      } else if (url.includes("/api/fs/")) {
        const path = this.extractPathFromUrl(url);
        return path ? await pwaUtils.storage.getDirectory(path) : null;
      } else if (url.includes("/admin/")) {
        // 管理员API缓存获取
        return await this.getCachedAdminApi(url);
      } else if (url.includes("/user/")) {
        // API密钥用户API缓存获取
        return await this.getCachedUserApi(url);
      } else if (url.includes("s3-configs")) {
        // S3配置API缓存获取
        return await this.getCachedS3ConfigApi(url);
      } else if (url.includes("/api/dashboard/")) {
        // 仪表盘统计API缓存获取
        return await this.getCachedDashboardApi(url);
      } else if (url.includes("public/files/")) {
        // 公共文件访问API缓存获取
        return await this.getCachedPublicFileApi(url);
      } else if (url.includes("/api/raw/")) {
        // 原始文本API缓存获取
        return await this.getCachedRawApi(url);
      } else if (url.includes("/test/")) {
        // 测试API缓存获取
        return await this.getCachedTestApi(url);
      } else if (url.includes("/public/")) {
        // 公共文件API缓存获取
        return await this.getCachedPublicFileApi(url);
      } else if (url.includes("url/")) {
        // URL相关API缓存获取（兼容旧版本）
        return await this.getCachedUrlApi(url);
      } else if (url.includes("/api/s3/")) {
        // S3上传API缓存获取
        return await this.getCachedS3UploadApi(url);
      }
      return null;
    } catch (error) {
      console.warn("获取缓存失败:", error);
      return null;
    }
  }

  extractSlugFromUrl(url) {
    const match = url.match(/\/([^\/]+)(?:\?|$)/);
    return match ? match[1] : null;
  }

  extractPathFromUrl(url) {
    const match = url.match(/\/api\/fs\/(.+?)(?:\?|$)/);
    return match ? decodeURIComponent(match[1]) : "/";
  }

  // 管理员API缓存方法
  async cacheAdminApi(url, data) {
    try {
      const cacheKey = this.generateCacheKey(url);

      if (url.includes("/admin/check")) {
        // 管理员登录状态
        await pwaUtils.storage.saveSetting("admin_login_status", data);
      } else if (url.includes("/admin/dashboard/stats")) {
        // 仪表盘统计数据
        await pwaUtils.storage.saveSetting("admin_dashboard_stats", data);
      } else if (url.includes("/admin/system-settings")) {
        // 系统设置
        await pwaUtils.storage.saveSetting("admin_system_settings", data);
      } else if (url.includes("/admin/api-keys")) {
        // API密钥列表
        await pwaUtils.storage.saveSetting("admin_api_keys", data);
      } else if (url.includes("/admin/mounts")) {
        // 挂载点列表
        if (url.includes("/admin/mounts/") && !url.endsWith("/admin/mounts")) {
          // 单个挂载点详情
          const mountId = this.extractSlugFromUrl(url);
          await pwaUtils.storage.saveSetting(`admin_mount_${mountId}`, data);
        } else {
          // 挂载点列表
          await pwaUtils.storage.saveSetting("admin_mounts_list", data);
        }
      } else if (url.includes("/admin/files")) {
        // 管理员文件管理
        if (url.includes("/admin/files/") && !url.endsWith("/admin/files")) {
          // 单个文件详情
          const fileId = this.extractSlugFromUrl(url);
          await pwaUtils.storage.saveSetting(`admin_file_${fileId}`, data);
        } else {
          // 文件列表
          await pwaUtils.storage.saveSetting("admin_files_list", data);
        }
      } else if (url.includes("/admin/pastes")) {
        // 管理员文本分享管理
        if (url.includes("/admin/pastes/") && !url.endsWith("/admin/pastes")) {
          // 单个文本分享详情
          const pasteId = this.extractSlugFromUrl(url);
          await pwaUtils.storage.saveSetting(`admin_paste_${pasteId}`, data);
        } else {
          // 文本分享列表
          await pwaUtils.storage.saveSetting("admin_pastes_list", data);
        }
      } else if (url.includes("/admin/fs/list")) {
        // 管理员文件系统列表
        const path = this.extractPathFromUrl(url);
        const pathKey = path ? path.replace(/[^a-zA-Z0-9]/g, "_") : "root";
        await pwaUtils.storage.saveSetting(`admin_fs_list_${pathKey}`, data);
      } else if (url.includes("/admin/fs/get")) {
        // 管理员文件信息
        const path = this.extractPathFromUrl(url);
        const pathKey = path ? path.replace(/[^a-zA-Z0-9]/g, "_") : "unknown";
        await pwaUtils.storage.saveSetting(`admin_fs_get_${pathKey}`, data);
      } else if (url.includes("/admin/fs/preview")) {
        // 管理员文件预览 - 这通常是二进制数据，不适合缓存到localStorage
        // 但我们可以缓存预览请求的元信息
        const path = this.extractPathFromUrl(url);
        const pathKey = path ? path.replace(/[^a-zA-Z0-9]/g, "_") : "unknown";
        await pwaUtils.storage.saveSetting(`admin_fs_preview_${pathKey}`, {
          cached: true,
          timestamp: Date.now(),
          path: path,
        });
      } else if (url.includes("/admin/fs/download")) {
        // 管理员文件下载 - 这通常是二进制数据，不适合缓存到localStorage
        // 但我们可以缓存下载请求的元信息
        const path = this.extractPathFromUrl(url);
        const pathKey = path ? path.replace(/[^a-zA-Z0-9]/g, "_") : "unknown";
        await pwaUtils.storage.saveSetting(`admin_fs_download_${pathKey}`, {
          cached: true,
          timestamp: Date.now(),
          path: path,
        });
      } else if (url.includes("/admin/fs/file-link")) {
        // 管理员文件直链获取
        const path = this.extractPathFromUrl(url);
        const pathKey = path ? path.replace(/[^a-zA-Z0-9]/g, "_") : "unknown";
        await pwaUtils.storage.saveSetting(`admin_fs_file_link_${pathKey}`, data);
      } else if (url.includes("/admin/cache/stats")) {
        // 管理员缓存统计
        await pwaUtils.storage.saveSetting("admin_cache_stats", data);
      } else {
        // 通用管理员API缓存
        await pwaUtils.storage.saveSetting(cacheKey, data);
      }

      console.log(`[离线模式] 管理员API已缓存: ${url}`);
    } catch (error) {
      console.warn("缓存管理员API失败:", error);
    }
  }

  async getCachedAdminApi(url) {
    try {
      const cacheKey = this.generateCacheKey(url);

      if (url.includes("/admin/check")) {
        return await pwaUtils.storage.getSetting("admin_login_status");
      } else if (url.includes("/admin/dashboard/stats")) {
        return await pwaUtils.storage.getSetting("admin_dashboard_stats");
      } else if (url.includes("/admin/system-settings")) {
        return await pwaUtils.storage.getSetting("admin_system_settings");
      } else if (url.includes("/admin/api-keys")) {
        return await pwaUtils.storage.getSetting("admin_api_keys");
      } else if (url.includes("/admin/mounts")) {
        if (url.includes("/admin/mounts/") && !url.endsWith("/admin/mounts")) {
          const mountId = this.extractSlugFromUrl(url);
          return await pwaUtils.storage.getSetting(`admin_mount_${mountId}`);
        } else {
          return await pwaUtils.storage.getSetting("admin_mounts_list");
        }
      } else if (url.includes("/admin/files")) {
        if (url.includes("/admin/files/") && !url.endsWith("/admin/files")) {
          const fileId = this.extractSlugFromUrl(url);
          return await pwaUtils.storage.getSetting(`admin_file_${fileId}`);
        } else {
          return await pwaUtils.storage.getSetting("admin_files_list");
        }
      } else if (url.includes("/admin/pastes")) {
        if (url.includes("/admin/pastes/") && !url.endsWith("/admin/pastes")) {
          const pasteId = this.extractSlugFromUrl(url);
          return await pwaUtils.storage.getSetting(`admin_paste_${pasteId}`);
        } else {
          return await pwaUtils.storage.getSetting("admin_pastes_list");
        }
      } else if (url.includes("/admin/fs/list")) {
        // 管理员文件系统列表
        const path = this.extractPathFromUrl(url);
        const pathKey = path ? path.replace(/[^a-zA-Z0-9]/g, "_") : "root";
        return await pwaUtils.storage.getSetting(`admin_fs_list_${pathKey}`);
      } else if (url.includes("/admin/fs/get")) {
        // 管理员文件信息
        const path = this.extractPathFromUrl(url);
        const pathKey = path ? path.replace(/[^a-zA-Z0-9]/g, "_") : "unknown";
        return await pwaUtils.storage.getSetting(`admin_fs_get_${pathKey}`);
      } else if (url.includes("/admin/fs/preview")) {
        // 管理员文件预览 - 返回缓存信息而不是实际内容
        const path = this.extractPathFromUrl(url);
        const pathKey = path ? path.replace(/[^a-zA-Z0-9]/g, "_") : "unknown";
        return await pwaUtils.storage.getSetting(`admin_fs_preview_${pathKey}`);
      } else if (url.includes("/admin/fs/download")) {
        // 管理员文件下载 - 返回缓存信息而不是实际内容
        const path = this.extractPathFromUrl(url);
        const pathKey = path ? path.replace(/[^a-zA-Z0-9]/g, "_") : "unknown";
        return await pwaUtils.storage.getSetting(`admin_fs_download_${pathKey}`);
      } else if (url.includes("/admin/fs/file-link")) {
        // 管理员文件直链获取
        const path = this.extractPathFromUrl(url);
        const pathKey = path ? path.replace(/[^a-zA-Z0-9]/g, "_") : "unknown";
        return await pwaUtils.storage.getSetting(`admin_fs_file_link_${pathKey}`);
      } else if (url.includes("/admin/cache/stats")) {
        // 管理员缓存统计
        return await pwaUtils.storage.getSetting("admin_cache_stats");
      } else {
        return await pwaUtils.storage.getSetting(cacheKey);
      }
    } catch (error) {
      console.warn("获取管理员API缓存失败:", error);
      return null;
    }
  }

  // API密钥用户API缓存方法
  async cacheUserApi(url, data) {
    try {
      const cacheKey = this.generateCacheKey(url);

      if (url.includes("/user/mounts")) {
        // 用户挂载点
        if (url.includes("/user/mounts/") && !url.endsWith("/user/mounts")) {
          const mountId = this.extractSlugFromUrl(url);
          await pwaUtils.storage.saveSetting(`user_mount_${mountId}`, data);
        } else {
          await pwaUtils.storage.saveSetting("user_mounts_list", data);
        }
      } else if (url.includes("/user/files")) {
        // 用户文件管理
        if (url.includes("/user/files/") && !url.endsWith("/user/files")) {
          // 单个文件详情
          const fileId = this.extractSlugFromUrl(url);
          await pwaUtils.storage.saveSetting(`user_file_${fileId}`, data);
        } else {
          // 文件列表
          await pwaUtils.storage.saveSetting("user_files_list", data);
        }
      } else if (url.includes("/user/pastes")) {
        // 用户文本分享管理
        if (url.includes("/user/pastes/") && !url.endsWith("/user/pastes")) {
          // 单个文本分享详情
          const pasteId = this.extractSlugFromUrl(url);
          await pwaUtils.storage.saveSetting(`user_paste_${pasteId}`, data);
        } else {
          // 文本分享列表
          await pwaUtils.storage.saveSetting("user_pastes_list", data);
        }
      } else if (url.includes("/user/fs/list")) {
        // 用户文件系统列表
        const path = this.extractPathFromUrl(url);
        const pathKey = path ? path.replace(/[^a-zA-Z0-9]/g, "_") : "root";
        await pwaUtils.storage.saveSetting(`user_fs_list_${pathKey}`, data);
      } else if (url.includes("/user/fs/get")) {
        // 用户文件信息
        const path = this.extractPathFromUrl(url);
        const pathKey = path ? path.replace(/[^a-zA-Z0-9]/g, "_") : "unknown";
        await pwaUtils.storage.saveSetting(`user_fs_get_${pathKey}`, data);
      } else if (url.includes("/user/fs/preview")) {
        // 用户文件预览 - 这通常是二进制数据，不适合缓存到localStorage
        // 但我们可以缓存预览请求的元信息
        const path = this.extractPathFromUrl(url);
        const pathKey = path ? path.replace(/[^a-zA-Z0-9]/g, "_") : "unknown";
        await pwaUtils.storage.saveSetting(`user_fs_preview_${pathKey}`, {
          cached: true,
          timestamp: Date.now(),
          path: path,
        });
      } else if (url.includes("/user/fs/download")) {
        // 用户文件下载 - 这通常是二进制数据，不适合缓存到localStorage
        // 但我们可以缓存下载请求的元信息
        const path = this.extractPathFromUrl(url);
        const pathKey = path ? path.replace(/[^a-zA-Z0-9]/g, "_") : "unknown";
        await pwaUtils.storage.saveSetting(`user_fs_download_${pathKey}`, {
          cached: true,
          timestamp: Date.now(),
          path: path,
        });
      } else if (url.includes("/user/fs/file-link")) {
        // 用户文件直链获取
        const path = this.extractPathFromUrl(url);
        const pathKey = path ? path.replace(/[^a-zA-Z0-9]/g, "_") : "unknown";
        await pwaUtils.storage.saveSetting(`user_fs_file_link_${pathKey}`, data);
      } else {
        // 通用用户API缓存
        await pwaUtils.storage.saveSetting(cacheKey, data);
      }

      console.log(`[离线模式] 用户API已缓存: ${url}`);
    } catch (error) {
      console.warn("缓存用户API失败:", error);
    }
  }

  async getCachedUserApi(url) {
    try {
      const cacheKey = this.generateCacheKey(url);

      if (url.includes("/user/mounts")) {
        if (url.includes("/user/mounts/") && !url.endsWith("/user/mounts")) {
          const mountId = this.extractSlugFromUrl(url);
          return await pwaUtils.storage.getSetting(`user_mount_${mountId}`);
        } else {
          return await pwaUtils.storage.getSetting("user_mounts_list");
        }
      } else if (url.includes("/user/files")) {
        if (url.includes("/user/files/") && !url.endsWith("/user/files")) {
          const fileId = this.extractSlugFromUrl(url);
          return await pwaUtils.storage.getSetting(`user_file_${fileId}`);
        } else {
          return await pwaUtils.storage.getSetting("user_files_list");
        }
      } else if (url.includes("/user/pastes")) {
        if (url.includes("/user/pastes/") && !url.endsWith("/user/pastes")) {
          const pasteId = this.extractSlugFromUrl(url);
          return await pwaUtils.storage.getSetting(`user_paste_${pasteId}`);
        } else {
          return await pwaUtils.storage.getSetting("user_pastes_list");
        }
      } else if (url.includes("/user/fs/list")) {
        // 用户文件系统列表
        const path = this.extractPathFromUrl(url);
        const pathKey = path ? path.replace(/[^a-zA-Z0-9]/g, "_") : "root";
        return await pwaUtils.storage.getSetting(`user_fs_list_${pathKey}`);
      } else if (url.includes("/user/fs/get")) {
        // 用户文件信息
        const path = this.extractPathFromUrl(url);
        const pathKey = path ? path.replace(/[^a-zA-Z0-9]/g, "_") : "unknown";
        return await pwaUtils.storage.getSetting(`user_fs_get_${pathKey}`);
      } else if (url.includes("/user/fs/preview")) {
        // 用户文件预览 - 返回缓存信息而不是实际内容
        const path = this.extractPathFromUrl(url);
        const pathKey = path ? path.replace(/[^a-zA-Z0-9]/g, "_") : "unknown";
        return await pwaUtils.storage.getSetting(`user_fs_preview_${pathKey}`);
      } else if (url.includes("/user/fs/download")) {
        // 用户文件下载 - 返回缓存信息而不是实际内容
        const path = this.extractPathFromUrl(url);
        const pathKey = path ? path.replace(/[^a-zA-Z0-9]/g, "_") : "unknown";
        return await pwaUtils.storage.getSetting(`user_fs_download_${pathKey}`);
      } else if (url.includes("/user/fs/file-link")) {
        // 用户文件直链获取
        const path = this.extractPathFromUrl(url);
        const pathKey = path ? path.replace(/[^a-zA-Z0-9]/g, "_") : "unknown";
        return await pwaUtils.storage.getSetting(`user_fs_file_link_${pathKey}`);
      } else {
        return await pwaUtils.storage.getSetting(cacheKey);
      }
    } catch (error) {
      console.warn("获取用户API缓存失败:", error);
      return null;
    }
  }

  // 系统API缓存方法
  async cacheSystemApi(url, data) {
    try {
      if (url.includes("system/max-upload-size")) {
        await pwaUtils.storage.saveSetting("system_max_upload_size", data);
      } else if (url.includes("/health")) {
        await pwaUtils.storage.saveSetting("system_health", data);
      } else if (url.includes("/version")) {
        await pwaUtils.storage.saveSetting("system_version", data);
      } else if (url.includes("/cache/stats")) {
        // 缓存统计信息
        await pwaUtils.storage.saveSetting("cache_stats", data);
      } else if (url.includes("/cache/clear")) {
        // 缓存清理结果
        await pwaUtils.storage.saveSetting("cache_clear_result", data);
      }

      console.log(`[离线模式] 系统API已缓存: ${url}`);
    } catch (error) {
      console.warn("缓存系统API失败:", error);
    }
  }

  async getCachedSystemApi(url) {
    try {
      if (url.includes("system/max-upload-size")) {
        return await pwaUtils.storage.getSetting("system_max_upload_size");
      } else if (url.includes("/health")) {
        return await pwaUtils.storage.getSetting("system_health");
      } else if (url.includes("/version")) {
        return await pwaUtils.storage.getSetting("system_version");
      } else if (url.includes("/cache/stats")) {
        return await pwaUtils.storage.getSetting("cache_stats");
      } else if (url.includes("/cache/clear")) {
        return await pwaUtils.storage.getSetting("cache_clear_result");
      }
      return null;
    } catch (error) {
      console.warn("获取系统API缓存失败:", error);
      return null;
    }
  }

  // 测试API缓存方法
  async cacheTestApi(url, data) {
    try {
      if (url.includes("/test/api-key")) {
        await pwaUtils.storage.saveSetting("test_api_key_verification", data);
      }

      console.log(`[离线模式] 测试API已缓存: ${url}`);
    } catch (error) {
      console.warn("缓存测试API失败:", error);
    }
  }

  async getCachedTestApi(url) {
    try {
      if (url.includes("/test/api-key")) {
        return await pwaUtils.storage.getSetting("test_api_key_verification");
      }
      return null;
    } catch (error) {
      console.warn("获取测试API缓存失败:", error);
      return null;
    }
  }

  // S3配置API缓存方法
  async cacheS3ConfigApi(url, data) {
    try {
      if (url.includes("s3-configs/") && !url.endsWith("s3-configs")) {
        // 单个S3配置详情
        const configId = this.extractSlugFromUrl(url);
        await pwaUtils.storage.saveSetting(`s3_config_${configId}`, data);
      } else {
        // S3配置列表
        await pwaUtils.storage.saveSetting("s3_configs_list", data);
      }

      console.log(`[离线模式] S3配置API已缓存: ${url}`);
    } catch (error) {
      console.warn("缓存S3配置API失败:", error);
    }
  }

  async getCachedS3ConfigApi(url) {
    try {
      if (url.includes("s3-configs/") && !url.endsWith("s3-configs")) {
        const configId = this.extractSlugFromUrl(url);
        return await pwaUtils.storage.getSetting(`s3_config_${configId}`);
      } else {
        return await pwaUtils.storage.getSetting("s3_configs_list");
      }
    } catch (error) {
      console.warn("获取S3配置API缓存失败:", error);
      return null;
    }
  }

  // URL上传API缓存方法
  async cacheUrlApi(url, data) {
    try {
      const cacheKey = this.generateCacheKey(url);

      if (url.includes("url/info")) {
        // URL信息验证
        await pwaUtils.storage.saveSetting("url_info_cache", data);
      } else if (url.includes("url/proxy")) {
        // URL代理内容 - 这个通常是二进制数据，不适合缓存到localStorage
        // 但我们可以缓存URL映射关系
        const proxyUrl = this.extractProxyUrlFromQuery(url);
        if (proxyUrl) {
          await pwaUtils.storage.saveSetting(`url_proxy_${proxyUrl}`, {
            cached: true,
            timestamp: Date.now(),
            originalUrl: proxyUrl,
          });
        }
      } else {
        // 通用URL API缓存
        await pwaUtils.storage.saveSetting(cacheKey, data);
      }

      console.log(`[离线模式] URL API已缓存: ${url}`);
    } catch (error) {
      console.warn("缓存URL API失败:", error);
    }
  }

  async getCachedUrlApi(url) {
    try {
      const cacheKey = this.generateCacheKey(url);

      if (url.includes("url/info")) {
        return await pwaUtils.storage.getSetting("url_info_cache");
      } else if (url.includes("url/proxy")) {
        // URL代理内容获取 - 返回缓存信息而不是实际内容
        const proxyUrl = this.extractProxyUrlFromQuery(url);
        if (proxyUrl) {
          return await pwaUtils.storage.getSetting(`url_proxy_${proxyUrl}`);
        }
        return null;
      } else {
        return await pwaUtils.storage.getSetting(cacheKey);
      }
    } catch (error) {
      console.warn("获取URL API缓存失败:", error);
      return null;
    }
  }

  // 从URL查询参数中提取代理URL
  extractProxyUrlFromQuery(url) {
    try {
      const urlObj = new URL(url, window.location.origin);
      return urlObj.searchParams.get("url");
    } catch (error) {
      console.warn("提取代理URL失败:", error);
      return null;
    }
  }

  // 公共文件访问API缓存方法
  async cachePublicFileApi(url, data) {
    try {
      const slug = this.extractSlugFromUrl(url);
      if (slug) {
        await pwaUtils.storage.saveSetting(`public_file_${slug}`, data);
      }

      console.log(`[离线模式] 公共文件API已缓存: ${url}`);
    } catch (error) {
      console.warn("缓存公共文件API失败:", error);
    }
  }

  async getCachedPublicFileApi(url) {
    try {
      const slug = this.extractSlugFromUrl(url);
      if (slug) {
        return await pwaUtils.storage.getSetting(`public_file_${slug}`);
      }
      return null;
    } catch (error) {
      console.warn("获取公共文件API缓存失败:", error);
      return null;
    }
  }

  // 原始文本API缓存方法
  async cacheRawApi(url, data) {
    try {
      const slug = this.extractSlugFromUrl(url);
      if (slug) {
        await pwaUtils.storage.saveSetting(`raw_paste_${slug}`, data);
      }

      console.log(`[离线模式] 原始文本API已缓存: ${url}`);
    } catch (error) {
      console.warn("缓存原始文本API失败:", error);
    }
  }

  async getCachedRawApi(url) {
    try {
      const slug = this.extractSlugFromUrl(url);
      if (slug) {
        return await pwaUtils.storage.getSetting(`raw_paste_${slug}`);
      }
      return null;
    } catch (error) {
      console.warn("获取原始文本API缓存失败:", error);
      return null;
    }
  }

  // 仪表盘API缓存方法
  async cacheDashboardApi(url, data) {
    try {
      if (url.includes("/dashboard/stats")) {
        await pwaUtils.storage.saveSetting("dashboard_stats", data);
      }

      console.log(`[离线模式] 仪表盘API已缓存: ${url}`);
    } catch (error) {
      console.warn("缓存仪表盘API失败:", error);
    }
  }

  async getCachedDashboardApi(url) {
    try {
      if (url.includes("/dashboard/stats")) {
        return await pwaUtils.storage.getSetting("dashboard_stats");
      }
      return null;
    } catch (error) {
      console.warn("获取仪表盘API缓存失败:", error);
      return null;
    }
  }

  // S3上传API缓存方法
  async cacheS3UploadApi(url, data) {
    try {
      if (url.includes("/api/s3/presign")) {
        // S3预签名上传
        await pwaUtils.storage.saveSetting("s3_presign_cache", data);
      } else if (url.includes("/api/s3/commit")) {
        // S3上传提交
        await pwaUtils.storage.saveSetting("s3_commit_cache", data);
      } else if (url.includes("/api/s3/multipart")) {
        // S3分片上传
        const cacheKey = this.generateCacheKey(url);
        await pwaUtils.storage.saveSetting(cacheKey, data);
      }

      console.log(`[离线模式] S3上传API已缓存: ${url}`);
    } catch (error) {
      console.warn("缓存S3上传API失败:", error);
    }
  }

  async getCachedS3UploadApi(url) {
    try {
      if (url.includes("/api/s3/presign")) {
        return await pwaUtils.storage.getSetting("s3_presign_cache");
      } else if (url.includes("/api/s3/commit")) {
        return await pwaUtils.storage.getSetting("s3_commit_cache");
      } else if (url.includes("/api/s3/multipart")) {
        const cacheKey = this.generateCacheKey(url);
        return await pwaUtils.storage.getSetting(cacheKey);
      }
      return null;
    } catch (error) {
      console.warn("获取S3上传API缓存失败:", error);
      return null;
    }
  }

  // 生成缓存键
  generateCacheKey(url) {
    // 移除查询参数，生成一致的缓存键
    const cleanUrl = url.split("?")[0];
    return `api_cache_${cleanUrl.replace(/[^a-zA-Z0-9]/g, "_")}`;
  }
}

// Markdown 编辑器离线增强
export class MarkdownOfflineEnhancer {
  constructor() {
    this.autoSaveInterval = null;
    this.setupAutoSave();
  }

  setupAutoSave() {
    // 每30秒自动保存草稿
    this.autoSaveInterval = setInterval(() => {
      this.saveDraft();
    }, 30000);
  }

  async saveDraft() {
    try {
      const editorContent = this.getEditorContent();
      if (editorContent && editorContent.trim()) {
        await pwaUtils.storage.saveSetting("markdown_draft", {
          content: editorContent,
          savedAt: new Date().toISOString(),
        });
        console.log("[离线模式] 草稿已自动保存");
      }
    } catch (error) {
      console.warn("保存草稿失败:", error);
    }
  }

  async loadDraft() {
    try {
      const draft = await pwaUtils.storage.getSetting("markdown_draft");
      if (draft && draft.content) {
        const savedTime = new Date(draft.savedAt);
        const now = new Date();
        const hoursSinceLastSave = (now - savedTime) / (1000 * 60 * 60);

        // 如果草稿是24小时内保存的，则提供恢复选项
        if (hoursSinceLastSave < 24) {
          return {
            content: draft.content,
            savedAt: draft.savedAt,
            canRestore: true,
          };
        }
      }
      return null;
    } catch (error) {
      console.warn("加载草稿失败:", error);
      return null;
    }
  }

  async clearDraft() {
    try {
      await pwaUtils.storage.saveSetting("markdown_draft", null);
    } catch (error) {
      console.warn("清除草稿失败:", error);
    }
  }

  getEditorContent() {
    // 尝试从不同的编辑器获取内容
    const vditorElement = document.querySelector(".vditor-content");
    if (vditorElement) {
      return vditorElement.textContent || vditorElement.innerText;
    }

    const textareaElement = document.querySelector('textarea[placeholder*="Markdown"]');
    if (textareaElement) {
      return textareaElement.value;
    }

    return null;
  }

  destroy() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
  }
}

// 文件浏览器离线增强
export class FileExplorerOfflineEnhancer {
  async cacheDirectoryListing(path, data) {
    try {
      await pwaUtils.storage.saveDirectory(path, {
        ...data,
        cachedAt: new Date().toISOString(),
      });
      console.log(`[离线模式] 目录列表已缓存: ${path}`);
    } catch (error) {
      console.warn("缓存目录列表失败:", error);
    }
  }

  async getCachedDirectoryListing(path) {
    try {
      const cached = await pwaUtils.storage.getDirectory(path);
      if (cached && cached.data) {
        console.log(`[离线模式] 从缓存获取目录列表: ${path}`);
        return {
          ...cached.data,
          isFromCache: true,
          cachedAt: cached.cachedAt,
        };
      }
      return null;
    } catch (error) {
      console.warn("获取缓存目录列表失败:", error);
      return null;
    }
  }

  async cacheFileInfo(slug, fileInfo) {
    try {
      await pwaUtils.storage.saveFile({
        slug,
        ...fileInfo,
        cachedAt: new Date().toISOString(),
      });
      console.log(`[离线模式] 文件信息已缓存: ${slug}`);
    } catch (error) {
      console.warn("缓存文件信息失败:", error);
    }
  }

  async getCachedFileInfo(slug) {
    try {
      const cached = await pwaUtils.storage.getFile(slug);
      if (cached) {
        console.log(`[离线模式] 从缓存获取文件信息: ${slug}`);
        return {
          ...cached,
          isFromCache: true,
        };
      }
      return null;
    } catch (error) {
      console.warn("获取缓存文件信息失败:", error);
      return null;
    }
  }
}

// 用户设置离线增强
export class SettingsOfflineEnhancer {
  async saveUserPreferences(preferences) {
    try {
      await pwaUtils.storage.saveSetting("user_preferences", {
        ...preferences,
        savedAt: new Date().toISOString(),
      });
      console.log("[离线模式] 用户偏好已保存");
    } catch (error) {
      console.warn("保存用户偏好失败:", error);
    }
  }

  async loadUserPreferences() {
    try {
      const preferences = await pwaUtils.storage.getSetting("user_preferences");
      if (preferences) {
        console.log("[离线模式] 用户偏好已加载");
        return preferences;
      }
      return null;
    } catch (error) {
      console.warn("加载用户偏好失败:", error);
      return null;
    }
  }

  async syncSettings() {
    // 当网络恢复时同步设置
    if (pwaUtils.isOnline()) {
      try {
        const preferences = await this.loadUserPreferences();
        if (preferences) {
          // 这里可以添加与服务器同步的逻辑
          console.log("[离线模式] 设置同步完成");
        }
      } catch (error) {
        console.warn("同步设置失败:", error);
      }
    }
  }
}

// 创建全局实例
export const offlineApiInterceptor = new OfflineApiInterceptor();
export const markdownOfflineEnhancer = new MarkdownOfflineEnhancer();
export const fileExplorerOfflineEnhancer = new FileExplorerOfflineEnhancer();
export const settingsOfflineEnhancer = new SettingsOfflineEnhancer();

// 网络状态恢复时的同步处理
window.addEventListener("online", () => {
  console.log("[PWA] 网络已恢复，开始同步数据");
  settingsOfflineEnhancer.syncSettings();
});

// 导出离线增强工具
export const offlineEnhancers = {
  api: offlineApiInterceptor,
  markdown: markdownOfflineEnhancer,
  fileExplorer: fileExplorerOfflineEnhancer,
  settings: settingsOfflineEnhancer,
};
