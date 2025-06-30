<template>
  <div class="markdown-preview rounded-lg overflow-hidden mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex-grow flex flex-col w-full">
    <div class="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t("fileView.preview.markdown.title") }}</span>
    </div>
    <div class="p-4 overflow-auto flex-grow relative" style="max-height: calc(100vh - 350px); min-height: 200px">
      <!-- VditorJS 预览容器 -->
      <div ref="previewContainer" class="vditor-reset markdown-body min-h-[200px] w-full" :class="{ 'opacity-0': loading }" v-show="!error"></div>

      <!-- Markdown加载状态 -->
      <div v-if="loading" class="absolute inset-0 flex items-center justify-center">
        <div class="text-center">
          <svg class="animate-spin h-8 w-8 text-blue-500 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 0 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p class="text-blue-600 dark:text-blue-400">{{ t("fileView.preview.markdown.loading") }}</p>
        </div>
      </div>

      <!-- Markdown错误状态 -->
      <div v-if="error" class="absolute inset-0 flex items-center justify-center">
        <div class="text-center p-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-red-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p class="text-red-600 dark:text-red-400 mb-2">{{ t("fileView.preview.markdown.error") }}</p>
          <p class="text-gray-500 dark:text-gray-400 text-sm">{{ t("fileView.preview.downloadToView") }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

// VditorJS 懒加载相关
let VditorClass = null;
let vditorCSSLoaded = false;

const props = defineProps({
  previewUrl: {
    type: String,
    required: true,
  },
  darkMode: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["load", "error"]);

// 响应式状态
const loading = ref(true);
const error = ref(false);
const previewContainer = ref(null);
const markdownContent = ref("");

/**
 * 懒加载 VditorJS
 */
const loadVditor = async () => {
  if (!VditorClass) {
    await loadVditorCSS();

    // 从assets目录加载Vditor
    const script = document.createElement("script");
    script.src = "/assets/vditor/dist/index.min.js";

    return new Promise((resolve, reject) => {
      script.onload = () => {
        VditorClass = window.Vditor;
        resolve(VditorClass);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return VditorClass;
};

/**
 * 加载 VditorJS CSS
 */
const loadVditorCSS = async () => {
  if (!vditorCSSLoaded) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/assets/vditor/dist/index.css";
    document.head.appendChild(link);
    vditorCSSLoaded = true;
  }
};

/**
 * 获取Markdown文件内容
 */
const fetchMarkdownContent = async () => {
  try {
    loading.value = true;
    error.value = false;

    // 从预览URL获取文件内容
    const response = await fetch(props.previewUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.text();
    markdownContent.value = content;

    // 渲染Markdown
    await renderMarkdown();

    loading.value = false;
    emit("load");
  } catch (err) {
    console.error("获取Markdown内容失败:", err);
    loading.value = false;
    error.value = true;
    emit("error");
  }
};

/**
 * 使用VditorJS渲染Markdown内容
 */
const renderMarkdown = async () => {
  if (!markdownContent.value || !previewContainer.value) return;

  try {
    // 确保DOM更新后再初始化Vditor
    await nextTick();

    // 清空之前的内容
    previewContainer.value.innerHTML = "";
    previewContainer.value.classList.remove("vditor-reset--dark", "vditor-reset--light");

    // 懒加载Vditor
    const VditorConstructor = await loadVditor();

    // 使用 Vditor 的预览 API 渲染内容
    VditorConstructor.preview(previewContainer.value, markdownContent.value, {
      mode: "dark-light", // 支持明暗主题
      theme: {
        current: props.darkMode ? "dark" : "light", // 根据darkMode设置主题
      },
      cdn: "/assets/vditor",
      hljs: {
        lineNumber: true, // 代码块显示行号
        style: props.darkMode ? "vs2015" : "github", // 代码高亮样式
      },
      markdown: {
        toc: true, // 启用目录
        mark: true, // 启用标记
        footnotes: true, // 启用脚注
        autoSpace: true, // 自动空格
        media: true, // 启用媒体链接解析
        listStyle: true, // 启用列表样式支持
      },
      after: () => {
        // 渲染完成后的回调
        console.log("Markdown 内容渲染完成");

        // 强制添加对应主题的类
        if (props.darkMode) {
          previewContainer.value.classList.add("vditor-reset--dark");
          previewContainer.value.classList.remove("vditor-reset--light");
        } else {
          previewContainer.value.classList.add("vditor-reset--light");
          previewContainer.value.classList.remove("vditor-reset--dark");
        }
      },
    });

    console.log("Markdown 预览渲染成功");
  } catch (err) {
    console.error("Markdown 预览渲染失败:", err);
    // 降级处理：显示原始文本
    if (previewContainer.value) {
      previewContainer.value.innerHTML = `<pre style="white-space: pre-wrap; word-wrap: break-word; color: ${props.darkMode ? "#d4d4d4" : "#374151"};">${
        markdownContent.value
      }</pre>`;
    }
  }
};

// 监听暗色模式变化，重新渲染
watch(
  () => props.darkMode,
  async () => {
    if (markdownContent.value) {
      await renderMarkdown();
    }
  }
);

// 监听预览URL变化，重新获取内容
watch(
  () => props.previewUrl,
  async () => {
    if (props.previewUrl) {
      await fetchMarkdownContent();
    }
  }
);

// 组件挂载时获取内容
onMounted(async () => {
  if (props.previewUrl) {
    await fetchMarkdownContent();
  }
});
</script>

<style scoped>
/* Markdown预览样式 */
.markdown-preview {
  line-height: 1.6;
}

/* VditorJS相关样式 */
:deep(.vditor-reset) {
  font-size: 1rem;
  line-height: 1.7;
  padding: 0.5rem;
  transition: all 0.3s ease;
  color: v-bind('props.darkMode ? "#d4d4d4" : "#374151"');
  background-color: transparent !important;
}

/* 确保暗色模式下的特定样式 */
:deep(.vditor-reset--dark) {
  color: #d4d4d4 !important;
  background-color: transparent !important;
}

/* 确保亮色模式下的特定样式 */
:deep(.vditor-reset--light) {
  color: #374151 !important;
  background-color: transparent !important;
}

/* 标题样式 */
:deep(.vditor-reset h1, .vditor-reset h2) {
  border-bottom: 1px solid v-bind('props.darkMode ? "#30363d" : "#e5e7eb"');
  padding-bottom: 0.3em;
  margin-top: 1.8em;
  margin-bottom: 1em;
}

:deep(.vditor-reset h1) {
  font-size: 2em;
}

:deep(.vditor-reset h2) {
  font-size: 1.5em;
}

:deep(.vditor-reset h3) {
  font-size: 1.25em;
}

:deep(.vditor-reset h4) {
  font-size: 1.1em;
}

:deep(.vditor-reset h5) {
  font-size: 1em;
}

:deep(.vditor-reset h6) {
  font-size: 0.9em;
}

/* 代码块样式 */
:deep(.vditor-reset pre) {
  background-color: v-bind('props.darkMode ? "#1f2937" : "#f8f9fa"') !important;
  border: 1px solid v-bind('props.darkMode ? "#374151" : "#e5e7eb"');
  border-radius: 0.375rem;
  padding: 1rem;
  overflow-x: auto;
}

:deep(.vditor-reset code) {
  background-color: v-bind('props.darkMode ? "#374151" : "#f1f5f9"') !important;
  color: v-bind('props.darkMode ? "#f8fafc" : "#1e293b"') !important;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
}

/* 表格样式 */
:deep(.vditor-reset table) {
  border-collapse: collapse;
  width: 100%;
  margin: 1rem 0;
}

:deep(.vditor-reset th, .vditor-reset td) {
  border: 1px solid v-bind('props.darkMode ? "#374151" : "#e5e7eb"');
  padding: 0.5rem;
  text-align: left;
}

:deep(.vditor-reset th) {
  background-color: v-bind('props.darkMode ? "#374151" : "#f8f9fa"');
  font-weight: 600;
}

/* 引用块样式 */
:deep(.vditor-reset blockquote) {
  border-left: 4px solid v-bind('props.darkMode ? "#6b7280" : "#d1d5db"');
  padding-left: 1rem;
  margin: 1rem 0;
  color: v-bind('props.darkMode ? "#9ca3af" : "#6b7280"');
  font-style: italic;
}

/* 链接样式 */
:deep(.vditor-reset a) {
  color: v-bind('props.darkMode ? "#60a5fa" : "#2563eb"') !important;
  text-decoration: underline;
}

:deep(.vditor-reset a:hover) {
  color: v-bind('props.darkMode ? "#93c5fd" : "#1d4ed8"') !important;
}

/* 列表样式 */
:deep(.vditor-reset ul, .vditor-reset ol) {
  padding-left: 1.5rem;
  margin: 0.5rem 0;
}

:deep(.vditor-reset li) {
  margin: 0.25rem 0;
}

/* 分割线样式 */
:deep(.vditor-reset hr) {
  border: none;
  border-top: 1px solid v-bind('props.darkMode ? "#374151" : "#e5e7eb"');
  margin: 2rem 0;
}
</style>
