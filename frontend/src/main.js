import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import api, { getEnvironmentInfo } from "./api";
import i18n from "./i18n"; // 导入i18n配置
import router from "./router"; // 导入路由配置

// 创建应用实例
const app = createApp(App);

// 添加全局错误处理
app.config.errorHandler = (err, vm, info) => {
  console.error(`错误: ${err}`);
  console.error(`信息: ${info}`);

  // 生产环境下可以考虑将错误发送到后端记录
  if (import.meta.env.PROD) {
    try {
      // 发送错误到控制台或后端API（如果有）
      console.warn("[生产环境错误]", {
        message: err.message,
        stack: err.stack,
        info,
        url: window.location.href,
        time: new Date().toISOString(),
      });

      // 如果有专门的错误上报API，可以在这里调用
      // api.reportError({ error: err.message, path: window.location.pathname });
    } catch (e) {
      // 避免上报过程中出错
      console.error("错误上报失败:", e);
    }
  }

  // i18n特定错误处理
  if (err && err.message && (err.message.includes("i18n") || err.message.includes("vue-i18n") || err.message.includes("useI18n") || err.message.includes("translation"))) {
    console.warn("检测到i18n相关错误:", err.message);
  }

  // 处理特定错误类型
  if (err && err.message) {
    // Vditor 编辑器相关错误
    if (err.message.includes("Cannot read properties of undefined")) {
      if (err.stack && err.stack.includes("Vditor")) {
        console.warn("检测到Vditor编辑器属性访问错误，可能由于组件切换导致");
      } else {
        console.warn("检测到属性访问错误，可能是组件生命周期问题");
      }
    }

    // 处理其他特定错误类型
    if (err.message.includes("currentMode") && err.stack && err.stack.includes("setValue")) {
      console.warn("编辑器值设置错误，可能是编辑器尚未完全初始化");
    }

    if (err.message.includes("element") && err.stack && err.stack.includes("destroy")) {
      console.warn("编辑器销毁错误，可能是DOM已被清理");
    }
  }
};

// 挂载i18n - 必须在挂载应用前使用
app.use(i18n);

// 挂载路由 - 在i18n之后挂载
app.use(router);

// 导入路由工具函数
import { routerUtils } from "./router";

// 提供全局 navigateTo 函数，保持向后兼容
app.config.globalProperties.$navigateTo = routerUtils.navigateTo;
app.config.globalProperties.$routerUtils = routerUtils;

// 将API服务挂载到全局对象，方便在组件中使用
app.config.globalProperties.$api = api;

// 在开发环境中输出API配置信息
if (import.meta.env.DEV) {
  console.log("环境信息:", getEnvironmentInfo());
}

// 确保加载正确的语言
const savedLang = localStorage.getItem("language");
if (savedLang && i18n.global.locale.value !== savedLang) {
  i18n.global.locale.value = savedLang;
}

// 挂载应用
app.mount("#app");
