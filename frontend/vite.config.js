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
          // 更新导航路由配置以支持所有现有路径的嵌套路由
          navigateFallback: "index.html",
          navigateFallbackAllowlist: [
            /^\/$/, // 根路径
            /^\/upload$/, // 上传页面
            /^\/admin/, // 管理页面（包含所有子路径）
            /^\/paste\/.+/, // 文本分享页面
            /^\/file\/.+/, // 文件预览页面
            /^\/mount-explorer/, // 挂载浏览器（包含所有嵌套路径）
          ],
          runtimeCaching: [
            // 系统信息API缓存策略 - 简单系统API，适合Cache API处理
            {
              urlPattern: /^.*\/api\/(system\/max-upload-size|health|version)$/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "cloudpaste-system-cache",
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 6, // 6小时，系统信息变化不频繁
                },
                networkTimeoutSeconds: 3,
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
                  maxEntries: 300,
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
            // 文件下载/预览API缓存策略 - 二进制文件，适合Cache API处理
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
            // 文件系统预览下载API缓存策略 - 二进制文件
            {
              urlPattern: /^.*\/api\/(admin|user)\/fs\/(preview|download).*/i,
              handler: "CacheFirst", // 文件内容缓存优先
              options: {
                cacheName: "cloudpaste-fs-files-cache",
                expiration: {
                  maxEntries: 150,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7天，文件内容相对稳定
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },

            // S3音频文件缓存策略 - 基于文件路径缓存，忽略S3签名参数
            {
              urlPattern: /^https:\/\/.*\.(mp3|wav|flac|aac|ogg|m4a)(\?.*)?$/i,
              handler: "NetworkFirst", // 网络优先，确保音频文件能正常加载
              options: {
                cacheName: "cloudpaste-audio-cache",
                networkTimeoutSeconds: 10, // 10秒网络超时
                expiration: {
                  maxEntries: 100, // 增加缓存数量，因为现在缓存效率更高
                  maxAgeSeconds: 60 * 60 * 24 * 4, // 4天，因为基于文件路径缓存更稳定
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
                plugins: [
                  // 自定义缓存键策略：基于文件路径而不是完整URL
                  {
                    cacheKeyWillBeUsed: async ({ request }) => {
                      const url = new URL(request.url);
                      // 提取文件路径，移除S3签名参数，保留完整路径以避免冲突
                      const pathWithoutQuery = `${url.origin}${url.pathname}`;
                      console.log(`🎵 音频缓存键: ${request.url} → ${pathWithoutQuery}`);
                      return pathWithoutQuery;
                    },
                    // 确保缓存查找时使用相同的键策略
                    cachedResponseWillBeUsed: async ({ cachedResponse, request }) => {
                      if (cachedResponse) {
                        console.log(`🎵 使用缓存的音频文件: ${request.url}`);
                      }
                      return cachedResponse;
                    },
                  },
                ],
              },
            },

            // CDN资源缓存
            {
              urlPattern: /^https:\/\/cdn\./,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "cloudpaste-cdn-cache",
                expiration: {
                  maxEntries: 100,
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
      // 移除vditor排除配置，因为现在从assets加载
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
            // 移除vditor chunk，因为现在从assets加载
            "vendor-charts": ["chart.js", "vue-chartjs"],
            "vendor-utils": ["axios", "qrcode", "file-saver", "docx", "html-to-image"],
          },
        },
      },
    },
  };
});
