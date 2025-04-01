<script setup>
// PasteViewPreview组件 - 用于渲染Markdown内容并提供预览功能
// 该组件使用Vditor库渲染复杂的Markdown内容，支持代码高亮、数学公式等高级特性
import { ref, onMounted, watch, nextTick } from "vue";
import Vditor from "vditor";
import "vditor/dist/index.css"; // 引入Vditor样式
import { debugLog } from "./PasteViewUtils";

// 定义组件接收的属性
const props = defineProps({
  // 是否为暗色模式，控制渲染主题
  darkMode: {
    type: Boolean,
    required: true,
  },
  // 要渲染的Markdown内容
  content: {
    type: String,
    default: "",
  },
  // 是否为开发环境
  isDev: {
    type: Boolean,
    default: false,
  },
  // 是否启用调试日志
  enableDebug: {
    type: Boolean,
    default: false,
  },
});

// 定义组件可触发的事件
const emit = defineEmits(["rendered"]);
// 用于保存预览元素的引用
const previewElement = ref(null);
// 跟踪内容是否已经渲染
const contentRendered = ref(false);

// 监听暗色模式变化，当主题改变时重新渲染内容
watch(
  () => props.darkMode,
  () => {
    if (props.content) {
      // 暗色模式变化时重新渲染
      nextTick(() => {
        renderContent(props.content);
      });
    }
  }
);

// 监听内容变化，当内容改变时重新渲染
watch(
  () => props.content,
  (newContent) => {
    if (newContent) {
      contentRendered.value = false;
      nextTick(() => {
        renderContent(newContent);
      });
    }
  }
);

// 渲染内容的方法，处理DOM可用性和兼容性问题
const renderContent = (content) => {
  if (!content) {
    console.warn("没有内容可渲染");
    return;
  }

  // 延迟检查预览元素，确保DOM已挂载
  if (!previewElement.value) {
    debugLog(props.enableDebug, props.isDev, "预览元素尚未准备好，将在下一个渲染周期尝试");
    // 使用nextTick等待DOM更新后再尝试渲染
    nextTick(() => {
      if (previewElement.value) {
        debugLog(props.enableDebug, props.isDev, "预览元素已就绪，现在开始渲染");
        renderContentInternal(content);
      } else {
        console.error("预览元素始终不可用，无法渲染内容");
      }
    });
    return;
  }

  renderContentInternal(content);
};

// 内部渲染实现，使用Vditor的API渲染Markdown
const renderContentInternal = (content) => {
  // 清空之前的内容，避免重复渲染
  if (previewElement.value) {
    previewElement.value.innerHTML = "";

    try {
      // 使用 Vditor 的预览 API 渲染内容
      // 配置了主题、代码高亮、数学公式等渲染选项
      Vditor.preview(previewElement.value, content, {
        mode: "dark-light", // 支持明暗主题
        theme: {
          current: props.darkMode ? "dark" : "light", // 根据darkMode设置主题
        },
        cdn: "https://cdn.jsdelivr.net/npm/vditor@3.10.9", // 添加CDN配置，确保资源正确加载
        hljs: {
          lineNumber: true, // 代码块显示行号
          style: props.darkMode ? "vs2015" : "github", // 代码高亮样式
        },
        markdown: {
          toc: true, // 启用目录
          mark: true, // 启用标记
          footnotes: true, // 启用脚注
          autoSpace: true, // 自动空格
        },
        math: {
          engine: "KaTeX", // 数学公式渲染引擎
          inlineDigit: true, // 启用行内数学公式
        },
        after: () => {
          // 渲染完成后的回调
          debugLog(props.enableDebug, props.isDev, "Markdown 内容渲染完成");
          // 标记渲染完成
          contentRendered.value = true;
          // 发出已渲染事件，允许父组件执行后续操作（如提取大纲）
          emit("rendered");
        },
      });
    } catch (e) {
      console.error("渲染 Markdown 内容时发生错误:", e);
      // 回退到基本的文本显示
      if (previewElement.value) {
        // 内容转义，避免XSS风险
        const safeContent = content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
        previewElement.value.innerHTML = `<pre class="whitespace-pre-wrap">${safeContent}</pre>`;
        // 即使是回退渲染，也标记为已渲染
        contentRendered.value = true;
        emit("rendered");
      }
    }
  } else {
    debugLog(props.enableDebug, props.isDev, "renderContentInternal: 预览元素不存在");
    // 在DOM可用时重试（仅重试一次，避免无限循环）
    setTimeout(() => {
      if (previewElement.value && !contentRendered.value) {
        debugLog(props.enableDebug, props.isDev, "延迟后重试渲染");
        renderContentInternal(content);
      }
    }, 150);
  }
};

// 检查内容是否已渲染，提供多种判断方法确保准确性
const isContentRendered = () => {
  // 优先使用明确的渲染状态标记
  if (contentRendered.value) {
    return true;
  }

  // 以下是备用检查逻辑
  if (!previewElement.value) return false;

  // 检查预览元素是否有内容
  const innerHTML = previewElement.value.innerHTML || "";
  // 更可靠的渲染检测 - 检查是否包含vditor特有的元素或类
  const hasVditorContent = innerHTML.includes('class="vditor') || previewElement.value.querySelectorAll(".vditor-reset").length > 0;

  // 如果有内容，也标记为已渲染
  if (hasVditorContent || innerHTML.trim().length > 50) {
    contentRendered.value = true;
    return true;
  }

  return false;
};

// 对外暴露方法，允许父组件调用
defineExpose({
  renderContent,
  isContentRendered,
});

// 组件挂载时尝试渲染内容
onMounted(() => {
  if (props.content) {
    renderContent(props.content);
  }
});
</script>

<template>
  <div class="paste-view-preview">
    <!-- 内容渲染中的加载动画 -->
    <div v-if="props.content && !contentRendered" class="py-10 flex justify-center items-center">
      <svg class="animate-spin h-8 w-8 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span class="ml-3 text-sm text-gray-500 dark:text-gray-400">正在渲染内容...</span>
    </div>

    <!-- Vditor 预览容器 - 这里是实际的Markdown渲染区域 -->
    <div ref="previewElement" class="vditor-reset markdown-body min-h-[300px]" :class="{ 'opacity-0': !contentRendered }"></div>

    <!-- 后备内容显示 - 当预览元素为空或渲染失败时显示原始Markdown -->
    <div
      v-if="props.content && !isContentRendered() && previewElement && contentRendered === false"
      class="mt-4 p-3 border border-yellow-500 rounded bg-yellow-50 dark:bg-yellow-900/20"
    >
      <p class="text-sm text-yellow-700 dark:text-yellow-300 mb-2">Markdown 渲染失败，显示原始内容：</p>
      <pre class="whitespace-pre-wrap overflow-auto max-h-[600px] text-gray-800 dark:text-gray-200 p-3 bg-gray-100 dark:bg-gray-800 rounded">{{ props.content }}</pre>
    </div>

    <!-- 无内容提示 -->
    <p v-if="!props.content" class="text-gray-500">无内容</p>
  </div>
</template>

<style scoped>
/* Vditor预览样式定制 */
/* 这些样式会被应用到Vditor渲染的内容上，使其更美观并适应暗色/亮色模式 */
:deep(.vditor-reset) {
  font-size: 16px;
  line-height: 1.7;
  padding: 0.5rem;
  transition: opacity 0.3s ease;
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
  font-size: 1.6em;
}

:deep(.vditor-reset h3) {
  font-size: 1.4em;
  margin-top: 1.5em;
  margin-bottom: 0.75em;
}

/* 段落样式 */
:deep(.vditor-reset p) {
  margin-top: 0.75em;
  margin-bottom: 0.75em;
}

/* 行内代码样式 */
:deep(.vditor-reset code:not(.hljs)) {
  background-color: v-bind('props.darkMode ? "#252526" : "#f3f4f6"');
  color: v-bind('props.darkMode ? "#ce9178" : "#ef4444"');
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

/* 引用块样式 */
:deep(.vditor-reset blockquote) {
  border-left: 4px solid v-bind('props.darkMode ? "#4b5563" : "#e5e7eb"');
  padding: 0.5em 1em;
  margin-left: 0;
  margin-right: 0;
  margin-top: 1em;
  margin-bottom: 1em;
  color: v-bind('props.darkMode ? "#9ca3af" : "#6b7280"');
  background-color: v-bind('props.darkMode ? "#1a1a1a" : "#f9fafb"');
  border-radius: 0.25rem;
}

/* 链接样式 */
:deep(.vditor-reset a) {
  color: v-bind('props.darkMode ? "#3b82f6" : "#2563eb"');
  text-decoration: none;
}

:deep(.vditor-reset a:hover) {
  text-decoration: underline;
}

/* 表格样式 */
:deep(.vditor-reset table) {
  border-collapse: collapse;
  margin: 1.25em 0;
  overflow-x: auto;
  display: block;
  width: 100%;
}

:deep(.vditor-reset table th, .vditor-reset table td) {
  border: 1px solid v-bind('props.darkMode ? "#30363d" : "#e5e7eb"');
  padding: 0.6em 1em;
}

:deep(.vditor-reset table th) {
  background-color: v-bind('props.darkMode ? "#252526" : "#f3f4f6"');
  font-weight: 600;
}

/* 代码块样式 */
:deep(.vditor-reset pre) {
  margin: 1.25em 0;
  padding: 1.25em;
  border-radius: 0.375rem;
  background-color: v-bind('props.darkMode ? "#1e1e1e" : "#f8fafc"');
  overflow-x: auto;
  line-height: 1.5;
}

/* 列表样式 */
:deep(.vditor-reset ul, .vditor-reset ol) {
  padding-left: 2em;
  margin: 1em 0;
}

/* 图片样式 */
:deep(.vditor-reset img) {
  max-width: 100%;
  margin: 1.25em 0;
  border-radius: 0.25rem;
}

/* 针对手机屏幕的响应式调整 */
@media (max-width: 640px) {
  :deep(.vditor-reset) {
    font-size: 15px;
    padding: 0.25rem;
  }

  :deep(.vditor-reset pre) {
    padding: 0.75em;
  }

  :deep(.vditor-reset table) {
    font-size: 14px;
  }
}

/* 中等屏幕 */
@media (min-width: 641px) and (max-width: 1024px) {
  :deep(.vditor-reset) {
    padding: 0.75rem;
  }
}

/* 大屏幕额外优化 */
@media (min-width: 1280px) {
  :deep(.vditor-reset) {
    font-size: 17px;
    padding: 1rem;
  }

  :deep(.vditor-reset pre) {
    margin: 1.5em 0;
    padding: 1.5em;
  }
}
</style>
