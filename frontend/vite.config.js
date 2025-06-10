import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), "");

  // 打印环境变量，帮助调试
  console.log("Vite环境变量:", {
    VITE_BACKEND_URL: env.VITE_BACKEND_URL || "未设置",
    VITE_APP_ENV: env.VITE_APP_ENV || "未设置",
    MODE: mode,
    COMMAND: command,
  });

  return {
    plugins: [
      vue(),
      VitePWA({
        registerType: "autoUpdate",
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2,ttf}"],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 增加到 5MB
          skipWaiting: true,
          clientsClaim: true,
          runtimeCaching: [
            // API 缓存策略 - 网络优先，失败时使用缓存
            {
              urlPattern: /^.*\/api\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "cloudpaste-api-cache",
                expiration: {
                  maxEntries: 200, // 增加缓存条目
                  maxAgeSeconds: 60 * 60 * 24 * 3, // 延长到3天
                },
                networkTimeoutSeconds: 5, // 减少超时时间，更快回退到缓存
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // 静态资源缓存策略 - 缓存优先
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
              handler: "CacheFirst",
              options: {
                cacheName: "cloudpaste-images-cache",
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30天
                },
              },
            },
            // 字体文件缓存 - 缓存优先，字体很少变化
            {
              urlPattern: /\.(?:woff|woff2|ttf|eot)$/,
              handler: "CacheFirst",
              options: {
                cacheName: "cloudpaste-fonts-cache",
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1年
                },
              },
            },
            // 管理员API缓存策略 - 专门处理管理员接口
            {
              urlPattern: /^.*\/api\/admin\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "cloudpaste-admin-cache",
                expiration: {
                  maxEntries: 200, // 增加缓存条目
                  maxAgeSeconds: 60 * 60 * 2, // 2小时，管理员数据更新频繁
                },
                networkTimeoutSeconds: 3, // 更短超时，快速回退
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // 文件系统API缓存策略 - 处理fs相关接口
            {
              urlPattern: /^.*\/api\/(admin|user)\/fs\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "cloudpaste-fs-cache",
                expiration: {
                  maxEntries: 300,
                  maxAgeSeconds: 60 * 60 * 1, // 1小时，文件系统数据变化较频繁
                },
                networkTimeoutSeconds: 5,
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // S3配置API缓存策略
            {
              urlPattern: /^.*\/api\/s3-configs.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "cloudpaste-s3-cache",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 4, // 4小时，配置变化不频繁
                },
                networkTimeoutSeconds: 3,
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // 系统API缓存策略 - 处理系统设置和测试接口
            {
              urlPattern: /^.*\/api\/(system|test)\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "cloudpaste-system-cache",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 6, // 6小时，系统设置变化不频繁
                },
                networkTimeoutSeconds: 3,
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // 健康检查API缓存策略 - 处理独立的健康检查接口
            {
              urlPattern: /^.*\/api\/(health|version)$/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "cloudpaste-health-cache",
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 5, // 5分钟，健康检查数据需要较新
                },
                networkTimeoutSeconds: 2,
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // 缓存管理API缓存策略 - 处理缓存统计和清理接口
            {
              urlPattern: /^.*\/api\/(admin|user)\/cache\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "cloudpaste-cache-mgmt-cache",
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 10, // 10分钟，缓存管理数据短期有效
                },
                networkTimeoutSeconds: 5,
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // 文件查看API缓存策略 - 处理文件下载和预览
            {
              urlPattern: /^.*\/api\/(file-download|file-view|office-preview)\/.*/i,
              handler: "CacheFirst", // 文件内容缓存优先
              options: {
                cacheName: "cloudpaste-fileview-cache",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7天，文件内容相对稳定
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // Paste内容API缓存策略 - 处理paste和raw内容
            {
              urlPattern: /^.*\/api\/(paste|raw)\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "cloudpaste-paste-cache",
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 3, // 3天，内容可能更新
                },
                networkTimeoutSeconds: 5,
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // 用户管理API缓存策略 - 处理用户文件和挂载点
            {
              urlPattern: /^.*\/api\/user\/(files|mounts|pastes).*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "cloudpaste-user-mgmt-cache",
                expiration: {
                  maxEntries: 150,
                  maxAgeSeconds: 60 * 60 * 2, // 2小时，用户数据更新频繁
                },
                networkTimeoutSeconds: 4,
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // 公共文件API缓存策略
            {
              urlPattern: /^.*\/api\/public\/.*/i,
              handler: "CacheFirst", // 公共文件缓存优先
              options: {
                cacheName: "cloudpaste-public-cache",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7天，公共内容相对稳定
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // URL代理API缓存策略
            {
              urlPattern: /^.*\/api\/url\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "cloudpaste-url-cache",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 1, // 1小时，URL内容可能变化
                },
                networkTimeoutSeconds: 10, // URL代理可能较慢
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // CDN资源缓存
            {
              urlPattern: /^https:\/\/cdn\./,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "cloudpaste-cdn-cache",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7天
                },
              },
            },
          ],
        },
        includeAssets: ["favicon.ico", "apple-touch-icon.png", "robots.txt"],
        manifest: {
          name: "CloudPaste",
          short_name: "CloudPaste",
          description: "安全分享您的内容，支持 Markdown 编辑和文件上传",
          theme_color: "#0ea5e9",
          background_color: "#ffffff",
          display: "standalone",
          orientation: "portrait",
          scope: "/",
          start_url: "/",
          icons: [
            {
              src: "icons/icons-32.png",
              sizes: "32x32",
              type: "image/png",
            },
            {
              src: "icons/icon-96.png",
              sizes: "96x96",
              type: "image/png",
            },
            {
              src: "icons/icon-192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "icons/icon-512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "icons/icon-512-maskable.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
          shortcuts: [
            {
              name: "文件上传",
              short_name: "上传",
              description: "快速上传文件",
              url: "/upload",
              icons: [
                {
                  src: "icons/shortcut-upload-96.png",
                  sizes: "96x96",
                },
              ],
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: "module",
        },
      }),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    // 将环境变量作为定义注入到应用中
    define: {
      __APP_ENV__: JSON.stringify(env.VITE_APP_ENV || "production"),
      __BACKEND_URL__: JSON.stringify(env.VITE_BACKEND_URL || ""),
    },
    server: {
      port: 3000,
      open: true,
      // 设置代理 - 仅在本地开发模式下使用
      proxy: {
        // 当 VITE_BACKEND_URL 为本地地址时，将请求代理到本地worker
        "/api": {
          target: env.VITE_BACKEND_URL || "http://localhost:8787",
          changeOrigin: true,
          secure: false,
          // 打印代理日志
          configure: (proxy, _options) => {
            proxy.on("error", (err, _req, _res) => {
              console.log("代理错误", err);
            });
            proxy.on("proxyReq", (_proxyReq, req, _res) => {
              console.log("代理请求:", req.method, req.url);
            });
            proxy.on("proxyRes", (proxyRes, req, _res) => {
              console.log("代理响应:", req.method, req.url, proxyRes.statusCode);
            });
          },
        },
      },
      // 添加历史模式回退配置，确保所有路径都能正确路由到 index.html
      historyApiFallback: {
        rewrites: [
          { from: /^\/$/, to: "/index.html" },
          { from: /^\/paste\/.*$/, to: "/index.html" },
          { from: /^\/file\/.*$/, to: "/index.html" },
          { from: /^\/admin$/, to: "/index.html" },
          { from: /^\/admin\/.*$/, to: "/index.html" },
          { from: /^\/upload$/, to: "/index.html" },
          { from: /^\/mount-explorer$/, to: "/index.html" },
          { from: /^\/mount-explorer\/.*$/, to: "/index.html" },
          { from: /./, to: "/index.html" },
        ],
      },
    },
    optimizeDeps: {
      include: ["vue-i18n", "chart.js", "qrcode"],
      exclude: ["vditor"], // Vditor 较大，避免预构建
    },
    build: {
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: true,
        },
      },
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            // 将大型库分离到单独的 chunk
            "vendor-vue": ["vue", "vue-router", "vue-i18n"],
            "vendor-editor": ["vditor"],
            "vendor-charts": ["chart.js", "vue-chartjs"],
            "vendor-utils": ["axios", "qrcode", "file-saver", "docx", "html-to-image"],
          },
        },
      },
    },
  };
});
