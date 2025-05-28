import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
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
    plugins: [vue()],
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
            proxy.on("proxyReq", (proxyReq, req, _res) => {
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
          { from: /^\/upload$/, to: "/index.html" },
          { from: /^\/mount-explorer$/, to: "/index.html" },
          { from: /./, to: "/index.html" },
        ],
      },
    },
    optimizeDeps: {
      include: ["vue-i18n"],
    },
    build: {
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: true,
        },
      },
    },
  };
});
