<template>
  <div class="editor-container mx-auto px-3 sm:px-6 flex-1 flex flex-col pt-6 sm:pt-8 w-full max-w-full sm:max-w-6xl">
    <div class="header mb-4 border-b pb-2" :class="darkMode ? 'border-gray-700' : 'border-gray-200'">
      <h2 class="text-xl font-semibold">{{ $t("markdown.title") }}</h2>
    </div>

    <!-- 管理员权限提示 -->
    <div
      v-if="!hasPermission"
      class="mb-4 p-3 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-700/50 dark:text-yellow-200"
    >
      <div class="flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          {{ $t("markdown.permissionRequired") }}
          <a href="#" @click.prevent="navigateToAdmin" class="font-medium underline">{{ $t("markdown.loginOrAuth") }}</a
          >。
        </span>
      </div>
    </div>

    <div class="editor-wrapper">
      <!-- 编辑器区域 -->
      <div class="flex flex-col md:flex-row gap-4">
        <!-- Markdown编辑器 -->
        <div id="vditor" class="w-full border rounded-lg" :class="darkMode ? 'border-gray-700' : 'border-gray-200'"></div>
      </div>
    </div>

    <!-- 底部表单 -->
    <div class="mt-6 border-t pt-4 w-full overflow-hidden" :class="darkMode ? 'border-gray-700' : 'border-gray-200'">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div class="form-group">
          <label class="form-label" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">{{ $t("markdown.form.remark") }}</label>
          <input
            type="text"
            class="form-input"
            :class="getInputClasses()"
            :placeholder="$t('markdown.form.remarkPlaceholder')"
            v-model="formData.remark"
            :disabled="!hasPermission"
          />
        </div>

        <div class="form-group">
          <label class="form-label" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">{{ $t("markdown.form.customLink") }}</label>
          <input
            type="text"
            class="form-input"
            :class="getInputClasses()"
            :placeholder="$t('markdown.form.customLinkPlaceholder')"
            v-model="formData.customLink"
            :disabled="!hasPermission"
          />
        </div>

        <div class="form-group">
          <label class="form-label" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">{{ $t("markdown.form.password") }}</label>
          <input
            type="text"
            class="form-input"
            :class="getInputClasses()"
            :placeholder="$t('markdown.form.passwordPlaceholder')"
            v-model="formData.password"
            :disabled="!hasPermission"
          />
        </div>

        <div class="form-group">
          <label class="form-label" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">{{ $t("markdown.form.expireTime") }}</label>
          <select class="form-input" :class="getInputClasses()" v-model="formData.expiryTime" :disabled="!hasPermission">
            <option value="1">{{ $t("markdown.form.expireOptions.hour1") }}</option>
            <option value="24">{{ $t("markdown.form.expireOptions.day1") }}</option>
            <option value="168">{{ $t("markdown.form.expireOptions.day7") }}</option>
            <option value="720">{{ $t("markdown.form.expireOptions.day30") }}</option>
            <option value="0">{{ $t("markdown.form.expireOptions.never") }}</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">{{ $t("markdown.form.maxViews") }}</label>
          <input
            type="number"
            min="0"
            step="1"
            pattern="\d*"
            class="form-input"
            :class="getInputClasses()"
            :placeholder="$t('markdown.form.maxViewsPlaceholder')"
            v-model.number="formData.maxViews"
            @input="validateMaxViews"
            :disabled="!hasPermission"
          />
        </div>
      </div>

      <div class="submit-section mt-6 flex flex-row items-center gap-4">
        <button class="btn-primary" @click="saveContent" :disabled="isSubmitting || !hasPermission">
          {{ isSubmitting ? $t("markdown.processing") : $t("markdown.createShare") }}
        </button>

        <div class="saving-status ml-auto text-sm" v-if="savingStatus">
          <span :class="[isErrorMessage(savingStatus) ? (darkMode ? 'text-red-400' : 'text-red-600') : darkMode ? 'text-gray-300' : 'text-gray-600']">{{ savingStatus }}</span>
        </div>
      </div>

      <!-- 简化的分享链接区域 - 使用图标而非按钮 -->
      <div v-if="shareLink" class="mt-4 p-3 rounded-md share-link-box" :class="darkMode ? 'bg-gray-800/50' : 'bg-gray-50'">
        <div class="flex items-center">
          <span class="text-sm mr-2" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ $t("markdown.shareLink") }}</span>
          <a :href="shareLink" target="_blank" class="link-text text-sm flex-grow" :class="darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'">
            {{ shareLink }}
          </a>

          <!-- 复制图标 -->
          <button
            @click="copyShareLink"
            class="ml-2 p-1 rounded-md transition-colors"
            :class="darkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'"
            :title="$t('markdown.copyLink')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
              />
            </svg>
          </button>

          <!-- 二维码图标 -->
          <button
            @click="showQRCode"
            class="ml-2 p-1 rounded-md transition-colors"
            :class="darkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'"
            :title="$t('markdown.showQRCode')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
              />
            </svg>
          </button>

          <span class="ml-2 text-xs" :class="darkMode ? 'text-gray-500' : 'text-gray-400'">{{ countdown }} {{ $t("markdown.disappearIn") }}</span>
        </div>
      </div>
    </div>

    <!-- 二维码弹窗 -->
    <div v-if="showQRCodeModal" class="fixed inset-0 flex items-center justify-center z-50">
      <div class="absolute inset-0 bg-black opacity-50" @click="closeQRCodeModal"></div>
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg max-w-md w-full relative z-10">
        <button @click="closeQRCodeModal" class="absolute top-3 right-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h3 class="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">{{ $t("markdown.qrCodeTitle") }}</h3>

        <div class="flex flex-col items-center">
          <div v-if="qrCodeDataURL" class="bg-white p-4 rounded-lg mb-4">
            <img :src="qrCodeDataURL" alt="分享二维码" class="w-48 h-48" />
          </div>
          <div v-else class="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg mb-4 w-48 h-48 flex items-center justify-center">
            <span class="text-gray-500 dark:text-gray-400">{{ $t("markdown.qrCodeGenerating") }}</span>
          </div>

          <div class="text-sm text-gray-600 dark:text-gray-300 mb-4 text-center max-w-xs">{{ $t("markdown.qrCodeScanToAccess") }}</div>

          <button @click="downloadQRCode" class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors" :disabled="!qrCodeDataURL">
            {{ $t("markdown.downloadQRCode") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, defineProps, getCurrentInstance, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import Vditor from "vditor";
import "vditor/dist/index.css";
import { api } from "../api";
import { createPaste } from "../api/pasteService";
import { useRouter, useRoute } from "vue-router";
import QRCode from "qrcode";

// 使用i18n
const { t } = useI18n();

const props = defineProps({
  darkMode: {
    type: Boolean,
    default: false,
  },
});

let editor = null;
const savingStatus = ref("");
const isSubmitting = ref(false);
const shareLink = ref("");
const countdown = ref(15);
let countdownTimer = null;
const slugError = ref("");

// 权限状态变量
const isAdmin = ref(false);
const hasApiKey = ref(false);
const hasTextPermission = ref(false);
const hasPermission = ref(false);

const formData = ref({
  remark: "",
  customLink: "",
  password: "",
  expiryTime: "0", // 默认为1天
  maxViews: 0,
});

// API密钥验证函数的防抖定时器
let apiKeyValidationTimer = null;
let lastValidatedApiKey = null;
let lastValidationTime = 0;
const VALIDATION_DEBOUNCE_TIME = 2000; // 2秒内不重复验证相同的密钥

// 检查用户权限状态
const checkPermissionStatus = async () => {
  console.log("检查用户权限状态...");

  // 检查管理员权限
  const adminToken = localStorage.getItem("admin_token");
  isAdmin.value = !!adminToken;

  if (isAdmin.value) {
    console.log("用户具有管理员权限");
    hasPermission.value = true;
    return;
  }

  // 检查API密钥权限
  const apiKey = localStorage.getItem("api_key");
  hasApiKey.value = !!apiKey;

  if (hasApiKey.value) {
    console.log("用户具有API密钥:", apiKey.substring(0, 3) + "..." + apiKey.substring(apiKey.length - 3));

    // 首先从后端验证API密钥权限（实时验证）
    try {
      const hasTextPerm = await validateApiKey(apiKey);
      hasTextPermission.value = hasTextPerm;
      console.log("API密钥文本权限(后端验证):", hasTextPermission.value ? "有权限" : "无权限");
    } catch (error) {
      console.error("API密钥验证失败:", error);

      // 验证失败时，尝试回退到本地缓存
      console.warn("后端验证失败，尝试使用本地缓存的权限信息");
      const permissionsStr = localStorage.getItem("api_key_permissions");
      if (permissionsStr) {
        try {
          const permissions = JSON.parse(permissionsStr);
          hasTextPermission.value = !!permissions.text;
          console.log("API密钥文本权限(本地缓存):", hasTextPermission.value ? "有权限" : "无权限");
        } catch (e) {
          console.error("解析权限数据失败:", e);
          hasTextPermission.value = false;
        }
      } else {
        console.warn("未找到API密钥权限信息");
        hasTextPermission.value = false;
      }
    }
  } else {
    hasTextPermission.value = false;
  }

  // 综合判断是否有创建权限
  hasPermission.value = isAdmin.value || (hasApiKey.value && hasTextPermission.value);
  console.log("用户创建文本分享权限:", hasPermission.value ? "有权限" : "无权限");
};

const getInputClasses = () => {
  return props.darkMode
    ? "bg-gray-800 border-gray-700 text-gray-100 focus:ring-primary-600 focus:border-primary-600"
    : "bg-white border-gray-300 text-gray-900 focus:ring-primary-500 focus:border-primary-500";
};

const initEditor = () => {
  const theme = props.darkMode ? "dark" : "light";

  // 检测是否为移动设备
  const isMobile = window.innerWidth <= 768;

  // 根据设备类型设置默认编辑模式和大纲显示
  const defaultMode = isMobile ? "ir" : "sv"; // 移动端使用即时渲染模式，桌面端使用分屏预览模式
  const enableOutline = !isMobile; // 移动端默认不启用大纲

  // 初始化Vditor编辑器 - 支持底部拖动调整高度
  editor = new Vditor("vditor", {
    height: 600,
    minHeight: 400,
    width: "100%",
    mode: defaultMode, // 根据设备类型设置默认编辑模式
    theme: theme,
    // JS 文件使用 CDN，CSS 文件使用本地
    // 如后续需要升级Vditor版本，需要同时更新预览页中的CDN版本号
    cdn: "https://cdn.jsdelivr.net/npm/vditor@3.10.9",
    resize: {
      enable: true,
      position: "bottom", // 只允许底部拖动
    },
    counter: {
      enable: true, // 启用字符计数器
      type: "text", // 统计类型：text（字符数）
    },
    preview: {
      theme: theme,
      hljs: {
        lineNumber: true, // 显示行号
        style: props.darkMode ? "vs2015" : "github",
        // ：JS 文件使用 CDN，CSS 文件使用本地
        js: "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.7.0/build/highlight.min.js",
        css: (style) => `/assets/vditor/dist/js/highlight.js/styles/${style}.min.css`,
      },
      actions: ["desktop", "tablet", "mobile", "both"],
      markdown: {
        toc: true,
        mark: true,
        footnotes: true,
        autoSpace: true,
      },
      math: {
        engine: "KaTeX",
        inlineDigit: true,
      },
    },
    typewriterMode: true, // 启用打字机模式
    outline: {
      enable: enableOutline, // 根据设备类型决定是否默认启用大纲
      position: "left",
    },
    hint: {
      emoji: {
        // 表情符号 - 基本表情
        slight_smile: "🙂",
        smile: "😊",
        joy: "😂",
        rofl: "🤣",
        laughing: "😆",
        wink: "😉",
        blush: "😊",
        heart_eyes: "😍",
        kissing_heart: "😘",
        kissing: "😗",
        kissing_smiling_eyes: "😙",
        kissing_closed_eyes: "😚",
        yum: "😋",
        stuck_out_tongue: "😛",
        stuck_out_tongue_winking_eye: "😜",
        stuck_out_tongue_closed_eyes: "😝",
        grin: "😁",
        satisfied: "😌",
        sweat_smile: "😅",

        // 情绪表情
        thinking: "🤔",
        confused: "😕",
        worried: "😟",
        frowning: "😦",
        persevere: "😣",
        confounded: "😖",
        tired_face: "😫",
        weary: "😩",
        cry: "😢",
        sob: "😭",
        angry: "😠",
        rage: "😡",
        triumph: "😤",
        sleepy: "😪",
        yawning: "🥱",
        mask: "😷",
        sunglasses: "😎",
        dizzy_face: "😵",
        exploding_head: "🤯",
        flushed: "😳",

        // 手势表情
        thumbsup: "👍",
        thumbsdown: "👎",
        ok_hand: "👌",
        punch: "👊",
        fist: "✊",
        v: "✌️",
        wave: "👋",
        raised_hand: "✋",
        clap: "👏",
        muscle: "💪",
        pray: "🙏",
        point_up: "☝️",
        point_down: "👇",
        point_left: "👈",
        point_right: "👉",

        // 心形表情
        heart: "❤️",
        orange_heart: "🧡",
        yellow_heart: "💛",
        green_heart: "💚",
        blue_heart: "💙",
        purple_heart: "💜",
        black_heart: "🖤",
        broken_heart: "💔",
        sparkling_heart: "💖",
        heartbeat: "💓",
        heartpulse: "💗",

        // 动物表情
        dog: "🐶",
        cat: "🐱",
        mouse: "🐭",
        hamster: "🐹",
        rabbit: "🐰",
        fox: "🦊",
        bear: "🐻",
        panda: "🐼",
        koala: "🐨",
        tiger: "🐯",
        lion: "🦁",

        // 食物表情
        apple: "🍎",
        pizza: "🍕",
        hamburger: "🍔",
        fries: "🍟",
        sushi: "🍣",
        ramen: "🍜",
        doughnut: "🍩",
        cake: "🍰",
        coffee: "☕",
        beer: "🍺",

        // 活动表情
        soccer: "⚽",
        basketball: "🏀",
        football: "🏈",
        baseball: "⚾",
        tennis: "🎾",

        // 物体表情
        gift: "🎁",
        book: "📚",
        computer: "💻",
        bulb: "💡",
        rocket: "🚀",
        hourglass: "⌛",
        watch: "⌚",
        moneybag: "💰",

        // 符号表情
        check: "✅",
        x: "❌",
        warning: "⚠️",
        question: "❓",
        exclamation: "❗",
        star: "⭐",
        sparkles: "✨",
        fire: "🔥",
        zap: "⚡",
      },
    },
    toolbar: [
      "emoji",
      "headings",
      "bold",
      "italic",
      "strike",
      "link",
      "|",
      "list",
      "ordered-list",
      "check",
      "outdent",
      "indent",
      "|",
      "quote",
      "line",
      "code",
      "inline-code",
      "insert-before",
      "insert-after",
      "|",
      "upload",
      "table",
      "|",
      "undo",
      "redo",
      "|",
      "fullscreen",
      "edit-mode",
      "both",
      "outline",
      "preview",
      "code-theme",
      "export",
      "help",
    ],
    placeholder: t("markdown.placeholder"),
    cache: {
      enable: true,
      id: "cloudpaste-editor",
    },
    upload: {
      accept: "image/*,.zip,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx",
      token: "",
      url: "/api/upload",
      linkToImgUrl: "/api/fetch?url=",
      filename(name) {
        return name.replace(/\W/g, "");
      },
    },
    after: () => {
      // 编辑器加载后，尝试保存在本地
      autoSave();

      // 在暗色模式下进一步调整一些细节样式
      if (props.darkMode) {
        // 这里可以添加一些额外的DOM操作来调整暗色模式下的特定元素
        // 例如调整一些Vditor没有直接暴露样式接口的组件
      }
    },
    input: () => {
      // 输入时触发自动保存计时
      autoSaveDebounce();
    },
  });
};

// 监听暗色模式变化，重新初始化编辑器
watch(
  () => props.darkMode,
  () => {
    if (editor) {
      const currentValue = editor.getValue();
      editor.destroy();
      initEditor();
      // 保留当前编辑的内容
      setTimeout(() => {
        if (editor && currentValue) {
          editor.setValue(currentValue);
        }
      }, 100);
    }
  }
);

// 自动保存
const autoSave = () => {
  if (!editor || !editor.getValue) return;

  try {
    const content = editor.getValue();
    if (content && content.trim()) {
      localStorage.setItem("cloudpaste-content", content);
      savingStatus.value = "已自动保存...";
      setTimeout(() => {
        savingStatus.value = "";
      }, 2000);
    }
  } catch (e) {
    console.warn("自动保存时发生错误:", e);
  }
};

// 验证API密钥权限（向后端发送请求进行实时验证）
const validateApiKey = async (apiKey) => {
  // 如果是相同的密钥且在短时间内验证过，直接返回上次的验证结果
  const now = Date.now();
  if (apiKey === lastValidatedApiKey && now - lastValidationTime < VALIDATION_DEBOUNCE_TIME) {
    console.log("使用缓存的API密钥验证结果，距上次验证时间:", Math.floor((now - lastValidationTime) / 1000), "秒");
    return hasTextPermission.value;
  }

  // 取消可能存在的验证定时器
  if (apiKeyValidationTimer) {
    clearTimeout(apiKeyValidationTimer);
  }

  // 创建防抖执行验证的Promise
  return new Promise((resolve, reject) => {
    apiKeyValidationTimer = setTimeout(async () => {
      try {
        // 导入API配置函数
        const { getFullApiUrl } = await import("../api/config.js");
        // 使用正确的API路径构建URL
        const apiUrl = getFullApiUrl("test/api-key");

        console.log("正在验证API密钥:", apiKey.substring(0, 3) + "..." + apiKey.substring(apiKey.length - 3));

        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            Authorization: `ApiKey ${apiKey}`,
            "Content-Type": "application/json",
          },
          credentials: "omit",
        });

        if (!response.ok) {
          throw new Error(`API密钥验证失败 (${response.status})`);
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("服务器返回了无效的响应格式");
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message || "密钥验证失败");
        }

        // 记录本次验证的密钥和时间
        lastValidatedApiKey = apiKey;
        lastValidationTime = Date.now();

        // 更新本地缓存中的权限信息
        if (data.data && data.data.permissions) {
          const permissions = data.data.permissions;
          localStorage.setItem("api_key_permissions", JSON.stringify(permissions));

          // 更新权限状态
          const textPermission = !!permissions.text;
          hasTextPermission.value = textPermission;

          // 触发自定义事件，通知其他组件权限已更新
          window.dispatchEvent(
            new CustomEvent("api-key-permissions-updated", {
              detail: { permissions },
            })
          );

          console.log("API密钥验证成功，文本权限:", textPermission ? "有权限" : "无权限");

          // 解析Promise并返回权限状态
          resolve(textPermission);
          return;
        }

        // 如果没有权限数据，视为无权限
        resolve(false);
      } catch (error) {
        console.error("API密钥验证出错:", error);
        reject(error);
      } finally {
        apiKeyValidationTimer = null;
      }
    }, 50); // 短暂延迟，合并多个快速调用
  });
};

// 防抖自动保存，输入停止后1秒再保存
let autoSaveDebounceTimer;
const autoSaveDebounce = () => {
  if (autoSaveDebounceTimer) {
    clearTimeout(autoSaveDebounceTimer);
  }
  autoSaveDebounceTimer = setTimeout(() => {
    autoSave();
  }, 1000);
};

// 每5分钟自动保存一次
let autoSaveInterval;

// 事件处理函数
const handleApiKeyPermissionsUpdate = async (e) => {
  console.log("接收到API密钥权限更新事件:", e.detail);
  await checkPermissionStatus();
};

const handleStorageChange = async (e) => {
  if (e.key === "admin_token" || e.key === "api_key" || e.key === "api_key_permissions") {
    console.log("检测到存储变化，更新权限状态:", e.key);
    await checkPermissionStatus();
  }
};

// 组件挂载时初始化
onMounted(async () => {
  // 先执行权限检查，确保UI正确显示
  await checkPermissionStatus();

  // 然后初始化编辑器
  initEditor();

  // 监听storage事件，以便在其他标签页中登录/登出时更新状态
  window.addEventListener("storage", handleStorageChange);

  // 监听API密钥权限更新事件
  window.addEventListener("api-key-permissions-updated", handleApiKeyPermissionsUpdate);

  // 添加窗口大小变化监听
  window.addEventListener("resize", handleResize);

  // 尝试恢复上次编辑的内容
  const savedContent = localStorage.getItem("cloudpaste-content");
  if (savedContent && editor) {
    setTimeout(() => {
      try {
        // 加强验证：确保编辑器已完全初始化并且内部属性可用
        if (editor && editor.setValue && editor.vditor && editor.vditor.currentMode) {
          editor.setValue(savedContent);
        } else {
          // 如果编辑器尚未完全初始化，再等待一段时间
          setTimeout(() => {
            try {
              if (editor && editor.setValue) {
                editor.setValue(savedContent);
              }
            } catch (e) {
              console.warn("第二次尝试恢复内容时发生错误:", e);
            }
          }, 1000);
        }
      } catch (e) {
        console.warn("恢复内容时发生错误:", e);
      }
    }, 800); // 增加等待时间，从500ms增加到800ms
  }

  // 设置自动保存
  autoSaveInterval = setInterval(autoSave, 300000); // 5分钟
});

// 组件卸载时清理资源
onUnmounted(() => {
  // 移除窗口大小变化监听
  window.removeEventListener("resize", handleResize);

  // 移除API密钥权限更新事件监听
  window.removeEventListener("api-key-permissions-updated", handleApiKeyPermissionsUpdate);

  // 移除storage事件监听
  window.removeEventListener("storage", handleStorageChange);

  // 清除防抖定时器
  if (resizeTimer) {
    clearTimeout(resizeTimer);
    resizeTimer = null;
  }

  // 清除自动保存定时器
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }

  // 清除防抖定时器
  if (autoSaveDebounceTimer) {
    clearTimeout(autoSaveDebounceTimer);
    autoSaveDebounceTimer = null;
  }

  // 清除倒计时定时器
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }

  // 销毁编辑器实例 - 添加安全检查
  try {
    if (editor) {
      // 检查是否有 destroy 方法并且 element 属性存在
      if (editor.destroy && editor.element) {
        editor.destroy();
      } else {
        // 如果没有 destroy 方法或 element 不存在，手动清除引用
        console.warn("编辑器实例状态异常，手动清除引用");
      }
      editor = null;
    }
  } catch (e) {
    console.warn("销毁编辑器时发生错误:", e);
    editor = null;
  }
});

// 保存内容并创建分享
const saveContent = async () => {
  // 在执行保存前重新检查权限状态
  await checkPermissionStatus();

  if (!hasPermission.value) {
    savingStatus.value = t("markdown.errorNoPermission");
    return;
  }

  const content = editor.getValue();
  if (!content || content.trim() === "") {
    savingStatus.value = t("markdown.errorEmptyContent");
    return;
  }

  isSubmitting.value = true;
  savingStatus.value = t("markdown.creatingShare");

  try {
    // 准备要提交的数据
    const pasteData = {
      content,
      slug: formData.value.customLink || undefined,
      remark: formData.value.remark || undefined,
      password: formData.value.password || undefined,
      maxViews: formData.value.maxViews > 0 ? formData.value.maxViews : undefined,
    };

    // 处理过期时间
    const expiryHours = parseInt(formData.value.expiryTime);
    if (expiryHours > 0) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiryHours);
      pasteData.expiresAt = expiresAt.toISOString();
    }

    console.log("创建分享，使用凭据类型:", isAdmin.value ? "管理员令牌" : hasApiKey.value ? "API密钥" : "无凭据");

    // 调用API函数，授权由client.js自动处理
    const result = await createPaste(pasteData);
    console.log("创建分享结果:", result);

    // 处理成功响应
    savingStatus.value = t("markdown.shareCreatedSuccess");

    // 显示分享链接 - 从result中提取slug的方式
    shareLink.value = `${window.location.origin}/paste/${result.slug}`;

    // 启动倒计时，倒计时结束后隐藏分享链接
    startCountdown();

    // 重置表单数据
    resetForm();
  } catch (error) {
    console.error("创建分享失败:", error);

    // 针对403权限错误进行特殊处理
    if ((error.message && error.message.includes("权限")) || error.message.includes("403")) {
      // 清除权限缓存并重新验证
      if (hasApiKey.value) {
        localStorage.removeItem("api_key_permissions");
        await checkPermissionStatus();
      }
      savingStatus.value = t("markdown.errorPermissionDenied");
    } else {
      savingStatus.value = `${t("markdown.errorPrefix")}: ${error.message || t("markdown.errorCreateShareFailed")}`;

      // 如果是链接后缀已被占用的错误，5秒后自动关闭提示
      if (error.message && (error.message.includes("链接后缀已被占用") || error.message.includes("资源冲突"))) {
        setTimeout(() => {
          savingStatus.value = "";
        }, 4000);
      }
    }
  } finally {
    isSubmitting.value = false;
  }
};

// 开始倒计时
const startCountdown = () => {
  // 清除可能存在的旧定时器
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }

  countdown.value = 15; // 使用15秒倒计时

  countdownTimer = setInterval(() => {
    countdown.value--;

    if (countdown.value <= 0) {
      clearInterval(countdownTimer);
      shareLink.value = "";
    }
  }, 1000);
};

// 复制分享链接到剪贴板
const copyShareLink = () => {
  if (!shareLink.value) return;

  navigator.clipboard
    .writeText(shareLink.value)
    .then(() => {
      savingStatus.value = t("markdown.linkCopied");
      setTimeout(() => {
        savingStatus.value = "";
      }, 2000);
    })
    .catch((err) => {
      console.error("复制失败:", err);
      savingStatus.value = t("markdown.copyFailed");
    });
};

// 添加对maxViews的验证函数
const validateMaxViews = (event) => {
  // 获取输入的值
  const value = event.target.value;

  // 如果是负数，则设置为0
  if (value < 0) {
    formData.value.maxViews = 0;
    return;
  }

  // 如果包含小数点，截取整数部分
  if (value.toString().includes(".")) {
    formData.value.maxViews = parseInt(value);
  }

  // 确保值为有效数字
  if (isNaN(value) || value === "") {
    formData.value.maxViews = 0;
  } else {
    // 确保是整数
    formData.value.maxViews = parseInt(value);
  }
};

// 添加错误消息样式
const isErrorMessage = (message) => {
  return message.includes("失败") || message.includes("错误") || message.includes("链接后缀已被占用") || message.includes("不能");
};

// 添加处理窗口大小变化的函数
let resizeTimer;
const handleResize = () => {
  // 使用防抖，避免频繁触发
  if (resizeTimer) {
    clearTimeout(resizeTimer);
  }

  resizeTimer = setTimeout(() => {
    // 检查是否需要根据窗口大小重新初始化编辑器
    // 由于编辑器的模式切换可能导致内容丢失，这里只在必要时（如设备类型变化）才重新初始化
    const wasMobile = window.innerWidth <= 768;

    // 如果编辑器已创建但设备类型发生变化（如平板旋转），考虑让用户手动切换模式
    // 这里我们不重新初始化编辑器，因为这可能导致用户丢失当前编辑的内容
    // 只是记录日志供参考
    if (editor) {
      console.log(`窗口大小已变化，当前窗口宽度: ${window.innerWidth}px，设备类型: ${wasMobile ? "移动设备" : "桌面设备"}`);
    }
  }, 300);
};

// 重置表单
const resetForm = () => {
  formData.value = {
    remark: "",
    customLink: "",
    password: "",
    expiryTime: "0", // 默认永不过期
    maxViews: 0,
  };
};

// 二维码相关状态和方法
const showQRCodeModal = ref(false);
const qrCodeDataURL = ref("");

const showQRCode = async () => {
  showQRCodeModal.value = true;
  qrCodeDataURL.value = ""; // 重置二维码图片

  try {
    // 使用 qrcode 库生成二维码
    const dataURL = await QRCode.toDataURL(shareLink.value, {
      width: 240,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });
    qrCodeDataURL.value = dataURL;
  } catch (error) {
    console.error("生成二维码时出错:", error);
    savingStatus.value = "生成二维码失败";
    setTimeout(() => {
      savingStatus.value = "";
    }, 2000);
  }
};

const closeQRCodeModal = () => {
  showQRCodeModal.value = false;
};

const downloadQRCode = () => {
  if (!qrCodeDataURL.value) return;

  // 创建一个临时链接元素来下载图片
  const link = document.createElement("a");
  link.href = qrCodeDataURL.value;
  link.download = `cloudpaste-qrcode-${new Date().getTime()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // 显示下载成功消息
  savingStatus.value = t("markdown.qrCodeDownloaded");
  setTimeout(() => {
    savingStatus.value = "";
  }, 2000);
};

// 添加导航到管理员登录页面的方法
const navigateToAdmin = () => {
  // 使用历史API更新URL并触发popstate事件
  window.history.pushState({}, "", "/admin");
  window.dispatchEvent(new Event("popstate"));
  console.log("导航到管理员登录页面");
};
</script>

<style scoped>
.editor-container {
  min-height: 700px;
  box-sizing: border-box; /* 确保内边距不增加元素实际宽度 */
}

/* VS Code 风格暗色主题 */
:deep(.vditor) {
  border: 1px solid;
  border-color: v-bind('props.darkMode ? "#30363d" : "#e2e8f0"');
  border-radius: 0.375rem;
  transition: border-color 0.2s, background-color 0.2s;
}

:deep(.vditor-toolbar) {
  border-bottom-width: 1px;
  border-color: v-bind('props.darkMode ? "#30363d" : "#e2e8f0"');
  transition: background-color 0.2s;
  background-color: v-bind('props.darkMode ? "#1e1e1e" : "#ffffff"');
}

:deep(.vditor-toolbar__item) {
  color: v-bind('props.darkMode ? "#cccccc" : "#374151"');
}

:deep(.vditor-toolbar__item:hover) {
  background-color: v-bind('props.darkMode ? "#2c2c2d" : "#f3f4f6"');
}

:deep(.vditor-toolbar__divider) {
  border-color: v-bind('props.darkMode ? "#30363d" : "#e5e7eb"');
}

:deep(.vditor-reset) {
  font-size: 16px;
  line-height: 1.6;
  color: v-bind('props.darkMode ? "#d4d4d4" : "#374151"');
}

:deep(.vditor-sv) {
  font-size: 16px;
  line-height: 1.6;
  background-color: v-bind('props.darkMode ? "#1e1e1e" : "#ffffff"');
  color: v-bind('props.darkMode ? "#d4d4d4" : "#374151"');
}

:deep(.vditor-sv__marker) {
  color: v-bind('props.darkMode ? "#6a9955" : "#6b7280"');
}

:deep(.vditor-sv__marker--heading) {
  color: v-bind('props.darkMode ? "#569cd6" : "#3b82f6"');
}

:deep(.vditor-sv__marker--link) {
  color: v-bind('props.darkMode ? "#4ec9b0" : "#3b82f6"');
}

:deep(.vditor-sv__marker--strong) {
  color: v-bind('props.darkMode ? "#ce9178" : "#ef4444"');
}

:deep(.vditor-sv__marker--em) {
  color: v-bind('props.darkMode ? "#dcdcaa" : "#f59e0b"');
}

:deep(.vditor-ir) {
  font-size: 16px;
  line-height: 1.6;
  background-color: v-bind('props.darkMode ? "#1e1e1e" : "#ffffff"');
  color: v-bind('props.darkMode ? "#d4d4d4" : "#374151"');
}

:deep(.vditor-ir__node--expand) {
  background-color: v-bind('props.darkMode ? "#2c2c2d" : "#f3f4f6"');
}

:deep(.vditor-preview) {
  background-color: v-bind('props.darkMode ? "#1e1e1e" : "#ffffff"');
  color: v-bind('props.darkMode ? "#d4d4d4" : "#374151"');
}

:deep(.vditor-preview h1, .vditor-preview h2) {
  border-bottom-color: v-bind('props.darkMode ? "#30363d" : "#e5e7eb"');
}

:deep(.vditor-preview blockquote) {
  border-left-color: v-bind('props.darkMode ? "#4b5563" : "#e5e7eb"');
  background-color: v-bind('props.darkMode ? "#252526" : "#f9fafb"');
}

:deep(.vditor-preview code:not(.hljs)) {
  background-color: v-bind('props.darkMode ? "#252526" : "#f3f4f6"');
  color: v-bind('props.darkMode ? "#ce9178" : "#ef4444"');
}

:deep(.vditor-preview table) {
  border-color: v-bind('props.darkMode ? "#30363d" : "#e5e7eb"');
}

:deep(.vditor-preview th) {
  background-color: v-bind('props.darkMode ? "#252526" : "#f3f4f6"');
  border-color: v-bind('props.darkMode ? "#30363d" : "#e5e7eb"');
}

:deep(.vditor-preview td) {
  border-color: v-bind('props.darkMode ? "#30363d" : "#e5e7eb"');
}

:deep(.vditor-outline) {
  background-color: v-bind('props.darkMode ? "#252526" : "#ffffff"');
  border-right-color: v-bind('props.darkMode ? "#30363d" : "#e5e7eb"');
}

:deep(.vditor-outline__item) {
  color: v-bind('props.darkMode ? "#d4d4d4" : "#374151"');
}

:deep(.vditor-outline__item:hover) {
  background-color: v-bind('props.darkMode ? "#2c2c2d" : "#f3f4f6"');
}

:deep(.vditor-counter) {
  color: v-bind('props.darkMode ? "#808080" : "#6b7280"');
}

/* 代码高亮增强 - VS Code风格 */
/* JavaScript */
:deep(.language-javascript) {
  color: v-bind('props.darkMode ? "#d4d4d4" : "#374151"');
}

:deep(.language-javascript .hljs-keyword) {
  color: v-bind('props.darkMode ? "#569cd6" : "#3b82f6"');
}

:deep(.language-javascript .hljs-string) {
  color: v-bind('props.darkMode ? "#ce9178" : "#ef4444"');
}

:deep(.language-javascript .hljs-comment) {
  color: v-bind('props.darkMode ? "#6a9955" : "#6b7280"');
}

:deep(.language-javascript .hljs-variable) {
  color: v-bind('props.darkMode ? "#9cdcfe" : "#374151"');
}

:deep(.language-javascript .hljs-function) {
  color: v-bind('props.darkMode ? "#dcdcaa" : "#4b5563"');
}

/* TypeScript */
:deep(.language-typescript .hljs-keyword) {
  color: v-bind('props.darkMode ? "#569cd6" : "#3b82f6"');
}

:deep(.language-typescript .hljs-built_in) {
  color: v-bind('props.darkMode ? "#4ec9b0" : "#0284c7"');
}

/* Python */
:deep(.language-python .hljs-keyword) {
  color: v-bind('props.darkMode ? "#569cd6" : "#3b82f6"');
}

:deep(.language-python .hljs-built_in) {
  color: v-bind('props.darkMode ? "#4ec9b0" : "#0284c7"');
}

:deep(.language-python .hljs-decorator) {
  color: v-bind('props.darkMode ? "#dcdcaa" : "#f59e0b"');
}

/* HTML */
:deep(.language-html .hljs-tag) {
  color: v-bind('props.darkMode ? "#569cd6" : "#3b82f6"');
}

:deep(.language-html .hljs-attr) {
  color: v-bind('props.darkMode ? "#9cdcfe" : "#0369a1"');
}

:deep(.language-html .hljs-string) {
  color: v-bind('props.darkMode ? "#ce9178" : "#ef4444"');
}

/* CSS */
:deep(.language-css .hljs-selector-class) {
  color: v-bind('props.darkMode ? "#d7ba7d" : "#0369a1"');
}

:deep(.language-css .hljs-selector-id) {
  color: v-bind('props.darkMode ? "#d7ba7d" : "#0369a1"');
}

:deep(.language-css .hljs-property) {
  color: v-bind('props.darkMode ? "#9cdcfe" : "#0369a1"');
}

:deep(.language-css .hljs-attribute) {
  color: v-bind('props.darkMode ? "#9cdcfe" : "#0369a1"');
}

/* JSON */
:deep(.language-json .hljs-attr) {
  color: v-bind('props.darkMode ? "#9cdcfe" : "#0369a1"');
}

:deep(.language-json .hljs-string) {
  color: v-bind('props.darkMode ? "#ce9178" : "#ef4444"');
}

/* Shell */
:deep(.language-bash .hljs-built_in) {
  color: v-bind('props.darkMode ? "#4ec9b0" : "#0284c7"');
}

:deep(.language-bash .hljs-variable) {
  color: v-bind('props.darkMode ? "#9cdcfe" : "#0369a1"');
}

/* 拖动区域样式 */
:deep(.vditor-resize) {
  padding: 3px 0;
  cursor: row-resize;
  user-select: none;
  position: absolute;
  width: 100%;
}

:deep(.vditor-resize > div) {
  height: 3px;
  background-color: v-bind('props.darkMode ? "#3f3f3f" : "#e5e7eb"');
  border-radius: 3px;
}

:deep(.vditor-resize:hover > div) {
  background-color: v-bind('props.darkMode ? "#007acc" : "#d1d5db"');
}

/* 移动端优化 */
@media (max-width: 640px) {
  .editor-container {
    padding-left: 0.5rem;
    padding-right: 0.5rem;
    width: 100%;
    overflow-x: hidden;
  }

  :deep(.vditor) {
    width: 100% !important;
    min-width: 0 !important;
  }

  :deep(.vditor-toolbar) {
    overflow-x: auto;
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  :deep(.vditor-toolbar__item) {
    margin-bottom: 4px;
  }

  .form-input,
  .form-label {
    width: 100%;
    max-width: 100%;
  }

  .form-group {
    margin-bottom: 0.75rem;
  }

  /* 确保分享链接区域不溢出 */
  .share-link-box {
    max-width: 100%;
    overflow-x: hidden;
  }
}

/* 添加表单响应式样式 */
.form-input {
  width: 100%;
  max-width: 100%;
  padding: 0.5rem;
  border-width: 1px;
  border-radius: 0.375rem;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

/* 添加新的过渡动画 */
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 应用动画到分享链接区域 */
.mt-4 {
  animation: slideDown 0.25s ease-out;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  font-weight: 500;
  border-radius: 0.375rem;
  background-color: v-bind('props.darkMode ? "#3b82f6" : "#2563eb"');
  color: white;
  transition: background-color 0.2s;
}

.btn-primary:hover {
  background-color: v-bind('props.darkMode ? "#2563eb" : "#1d4ed8"');
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* 分享链接样式 */
.share-link-box {
  animation: fadeIn 0.3s ease-out;
  border: 1px solid v-bind('props.darkMode ? "rgba(75, 85, 99, 0.3)" : "rgba(229, 231, 235, 0.8)"');
}

.link-text {
  text-decoration: none;
  word-break: break-all;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.link-text:hover {
  text-decoration: underline;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
