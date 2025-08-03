<template>
  <div class="editor-container mx-auto px-3 sm:px-6 flex-1 flex flex-col pt-6 sm:pt-8 w-full max-w-full sm:max-w-6xl">
    <!-- 隐藏的文件输入控件 -->
    <input type="file" ref="markdownImporter" accept=".md,.markdown,.mdown,.mkd" style="display: none" @change="importMarkdownFile" />

    <!-- 页面标题和模式切换 -->
    <div class="header mb-4 border-b pb-2" :class="darkMode ? 'border-gray-700' : 'border-gray-200'">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold">{{ $t("markdown.title") }}</h2>
        <button
          class="px-2 py-1 text-sm rounded transition-colors"
          :class="darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'"
          @click="toggleEditorMode"
        >
          {{ isPlainTextMode ? $t("markdown.switchToMarkdown") : $t("markdown.switchToPlainText") }}
        </button>
      </div>
    </div>

    <!-- 权限管理组件 -->
    <PermissionManager :dark-mode="darkMode" @permission-change="handlePermissionChange" @navigate-to-admin="navigateToAdmin" />

    <!-- 编辑器组件 -->
    <div class="editor-wrapper">
      <div class="flex flex-col md:flex-row gap-4">
        <VditorEditor
          ref="editorRef"
          :dark-mode="darkMode"
          :is-plain-text-mode="isPlainTextMode"
          v-model="editorContent"
          @editor-ready="handleEditorReady"
          @content-change="handleContentChange"
          @import-file="triggerImportFile"
          @clear-content="clearEditorContent"
          @show-copy-formats="showCopyFormatsMenu"
        />
      </div>
    </div>

    <!-- 表单组件 -->
    <EditorForm
      ref="formRef"
      :dark-mode="darkMode"
      :has-permission="hasPermission"
      :is-submitting="isSubmitting"
      :saving-status="savingStatus"
      @submit="saveContent"
      @form-change="handleFormChange"
    />

    <!-- 分享链接组件 -->
    <ShareLinkBox
      ref="shareLinkRef"
      :dark-mode="darkMode"
      :share-link="shareLink"
      :share-password="currentSharePassword"
      @show-qr-code="showQRCode"
      @status-message="handleStatusMessage"
      @countdown-end="handleCountdownEnd"
    />

    <!-- 二维码弹窗组件 -->
    <QRCodeModal :visible="showQRCodeModal" :share-link="shareLink" @close="closeQRCodeModal" @status-message="handleStatusMessage" />

    <!-- 复制格式菜单组件 -->
    <CopyFormatMenu
      :visible="copyFormatMenuVisible"
      :position="copyFormatMenuPosition"
      :editor="currentEditor"
      :dark-mode="darkMode"
      @close="closeCopyFormatMenu"
      @status-message="handleStatusMessage"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { api } from "@/api";
import { ApiStatus } from "../api/ApiStatus";

// 导入子组件
import VditorEditor from "../components/markdown-editor/VditorEditor.vue";
import PermissionManager from "../components/markdown-editor/PermissionManager.vue";
import EditorForm from "../components/markdown-editor/EditorForm.vue";
import ShareLinkBox from "../components/markdown-editor/ShareLinkBox.vue";
import QRCodeModal from "../components/markdown-editor/QRCodeModal.vue";
import CopyFormatMenu from "../components/markdown-editor/CopyFormatMenu.vue";

const { t } = useI18n();

// Props
const props = defineProps({
  darkMode: {
    type: Boolean,
    default: false,
  },
});

// 组件引用
const editorRef = ref(null);
const formRef = ref(null);
const shareLinkRef = ref(null);
const markdownImporter = ref(null);

// 状态变量
const savingStatus = ref("");
const isSubmitting = ref(false);
const shareLink = ref("");
const currentSharePassword = ref("");
const hasPermission = ref(false);
const isPlainTextMode = ref(false);
const editorContent = ref("");
const currentEditor = ref(null);

// 二维码弹窗状态
const showQRCodeModal = ref(false);

// 复制格式菜单状态
const copyFormatMenuVisible = ref(false);
const copyFormatMenuPosition = ref({ x: 0, y: 0 });

// 组件事件处理函数
const handlePermissionChange = (permission) => {
  hasPermission.value = permission;
};

const handleEditorReady = (editor) => {
  currentEditor.value = editor;

  // 验证编辑器实例
  if (!editor || typeof editor.getValue !== "function" || typeof editor.getHTML !== "function") {
    console.error("Editor instance validation failed, missing required methods");
  }
};

const handleContentChange = (content) => {
  editorContent.value = content;
  autoSaveDebounce();
};

const handleFormChange = (formData) => {
  // 表单数据变化处理
  console.log("Form data changed:", formData);
};

const handleStatusMessage = (message) => {
  savingStatus.value = message;
  setTimeout(() => {
    savingStatus.value = "";
  }, 3000);
};

const handleCountdownEnd = () => {
  shareLink.value = "";
  currentSharePassword.value = "";
};

// 导航到管理页面
const navigateToAdmin = () => {
  // 使用 Vue Router 进行导航
  import("../router").then(({ routerUtils }) => {
    routerUtils.navigateTo("admin");
  });
};

// 编辑器模式切换
const toggleEditorMode = () => {
  isPlainTextMode.value = !isPlainTextMode.value;
  console.log("切换编辑器模式:", isPlainTextMode.value ? t("markdown.switchToPlainText") : t("markdown.switchToMarkdown"));
};

// 触发文件导入
const triggerImportFile = () => {
  if (markdownImporter.value) {
    markdownImporter.value.click();
  }
};

// 导入Markdown文件
const importMarkdownFile = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result;
    if (editorRef.value) {
      editorRef.value.setValue(content);
    }
    editorContent.value = content;
  };
  reader.readAsText(file);

  // 清空文件输入
  event.target.value = "";
};

// 清空编辑器内容
const clearEditorContent = () => {
  if (editorRef.value) {
    editorRef.value.clearContent();
  }
  editorContent.value = "";
};

// 显示复制格式菜单
const showCopyFormatsMenu = (position) => {
  if (!currentEditor.value) return;

  // 如果传入了位置参数，直接使用
  if (position && position.x !== undefined && position.y !== undefined) {
    copyFormatMenuPosition.value = position;
  } else {
    // 否则尝试获取工具栏中复制格式按钮的位置
    const copyFormatBtn = document.querySelector('.vditor-toolbar .vditor-tooltipped[data-type="copy-formats"]');
    if (copyFormatBtn) {
      const rect = copyFormatBtn.getBoundingClientRect();
      copyFormatMenuPosition.value = {
        x: rect.left,
        y: rect.bottom + 5,
      };
    } else {
      // 使用默认位置
      copyFormatMenuPosition.value = { x: 100, y: 100 };
    }
  }

  copyFormatMenuVisible.value = true;
};

// 关闭复制格式菜单
const closeCopyFormatMenu = () => {
  copyFormatMenuVisible.value = false;
};

// 显示二维码
const showQRCode = () => {
  showQRCodeModal.value = true;
};

// 关闭二维码弹窗
const closeQRCodeModal = () => {
  showQRCodeModal.value = false;
};

// 保存内容
const saveContent = async (formData) => {
  if (!hasPermission.value) {
    handleStatusMessage(t("common.noPermission"));
    return;
  }

  if (!editorContent.value.trim()) {
    handleStatusMessage(t("markdown.messages.contentEmpty"));
    return;
  }

  isSubmitting.value = true;
  handleStatusMessage(t("markdown.messages.creating"));

  try {
    // 准备要提交的数据 - 只传递有值的字段
    const pasteData = {
      content: editorContent.value,
    };

    // 只有当字段有值时才添加到请求中
    if (formData.customLink && formData.customLink.trim()) {
      pasteData.slug = formData.customLink.trim();
    }

    if (formData.remark && formData.remark.trim()) {
      pasteData.remark = formData.remark.trim();
    }

    if (formData.password && formData.password.trim()) {
      pasteData.password = formData.password.trim();
    }

    if (formData.maxViews && parseInt(formData.maxViews) > 0) {
      pasteData.maxViews = parseInt(formData.maxViews);
    }

    // 处理过期时间
    const expiryHours = parseInt(formData.expiryTime);
    if (expiryHours > 0) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiryHours);
      pasteData.expiresAt = expiresAt.toISOString();
    }

    console.log("创建分享，数据:", pasteData);

    // 调用API函数
    const result = await api.paste.createPaste(pasteData);
    console.log("创建分享结果:", result);

    // 处理API响应格式
    let slug = null;

    //  {code: 200/201, message: "", data: {slug: "..."}}
    if (result && typeof result === "object" && "code" in result) {
      if ((result.code === 200 || result.code === 201) && result.data && result.data.slug) {
        slug = result.data.slug;
      } else {
        throw new Error(result.message || "创建失败");
      }
    } else if (result && typeof result === "object" && result.slug) {
      slug = result.slug;
    } else if (result && typeof result === "object") {
      const possibleFields = ["id", "key", "identifier"];
      for (const field of possibleFields) {
        if (result[field]) {
          slug = result[field];
          break;
        }
      }
    }

    if (!slug) {
      console.error("API响应格式异常:", result);
      throw new Error(t("markdown.messages.createFailed") + "：无法获取分享标识");
    }

    // 构建分享链接
    shareLink.value = `${window.location.origin}/paste/${slug}`;
    currentSharePassword.value = formData.password || "";

    // 启动倒计时
    if (shareLinkRef.value) {
      shareLinkRef.value.startCountdown();
    }

    // 重置表单
    if (formRef.value) {
      formRef.value.resetForm();
    }

    handleStatusMessage(t("markdown.messages.createSuccess"));
  } catch (error) {
    console.error("保存失败:", error);

    // 根据错误消息内容进行分类处理
    if (error.message && error.message.includes("已被占用")) {
      handleStatusMessage(t("markdown.messages.linkOccupied"));
    } else if (error.message && error.message.includes("权限")) {
      handleStatusMessage(t("common.noPermission"));
    } else if (error.message && error.message.includes("内容过大")) {
      handleStatusMessage(t("markdown.messages.contentTooLarge"));
    } else {
      handleStatusMessage(`${t("markdown.messages.createFailed")}: ${error.message || t("markdown.messages.unknownError")}`);
    }
  } finally {
    isSubmitting.value = false;
  }
};

// 自动保存
let autoSaveTimer = null;
const autoSaveDebounce = () => {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }

  autoSaveTimer = setTimeout(() => {
    try {
      localStorage.setItem("cloudpaste-content", editorContent.value);
      // 自动保存成功，无需日志
    } catch (e) {
      console.warn(t("markdown.messages.autoSaveFailed"), e);
    }
  }, 1000);
};

// 组件挂载
onMounted(() => {
  // 恢复保存的内容
  try {
    const savedContent = localStorage.getItem("cloudpaste-content");
    if (savedContent) {
      editorContent.value = savedContent;
    }
  } catch (e) {
    console.warn(t("markdown.messages.restoreContentFailed"), e);
  }
});

// 组件卸载
onUnmounted(() => {
  // 清理定时器
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
});
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
  z-index: 10;
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
  tab-size: 4;
  -moz-tab-size: 4;
}

:deep(.vditor-sv) {
  font-size: 16px;
  line-height: 1.6;
  background-color: v-bind('props.darkMode ? "#1e1e1e" : "#ffffff"');
  color: v-bind('props.darkMode ? "#d4d4d4" : "#374151"');
  tab-size: 4;
  -moz-tab-size: 4;
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
  tab-size: 4;
  -moz-tab-size: 4;
}

:deep(.vditor-ir__node--expand) {
  background-color: v-bind('props.darkMode ? "#2c2c2d" : "#f3f4f6"');
}

/* 即时渲染模式表格样式 */
:deep(.vditor-ir table) {
  border-color: v-bind('props.darkMode ? "#30363d" : "#e5e7eb"') !important;
  border-collapse: collapse;
  margin: 1rem 0;
}

:deep(.vditor-ir th) {
  background-color: v-bind('props.darkMode ? "#252526" : "#f3f4f6"') !important;
  border-color: v-bind('props.darkMode ? "#30363d" : "#e5e7eb"') !important;
  padding: 8px 12px;
  font-weight: 600;
  color: v-bind('props.darkMode ? "#e2e8f0" : "#374151"') !important;
}

:deep(.vditor-ir td) {
  border-color: v-bind('props.darkMode ? "#30363d" : "#e5e7eb"') !important;
  padding: 8px 12px;
  background-color: v-bind('props.darkMode ? "#1e1e1e" : "#ffffff"') !important;
  color: v-bind('props.darkMode ? "#d4d4d4" : "#374151"') !important;
}

:deep(.vditor-ir tr:nth-child(even) td) {
  background-color: v-bind('props.darkMode ? "#252526" : "#f9fafb"') !important;
}

:deep(.vditor-ir tr:hover td) {
  background-color: v-bind('props.darkMode ? "#2c2c2d" : "#f3f4f6"') !important;
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
  border-collapse: collapse;
  margin: 1rem 0;
}

:deep(.vditor-preview th) {
  background-color: v-bind('props.darkMode ? "#252526" : "#f3f4f6"');
  border-color: v-bind('props.darkMode ? "#30363d" : "#e5e7eb"');
  padding: 8px 12px;
  font-weight: 600;
  color: v-bind('props.darkMode ? "#e2e8f0" : "#374151"');
}

:deep(.vditor-preview td) {
  border-color: v-bind('props.darkMode ? "#30363d" : "#e5e7eb"');
  padding: 8px 12px;
  background-color: v-bind('props.darkMode ? "#1e1e1e" : "#ffffff"');
}

:deep(.vditor-preview tr:nth-child(even) td) {
  background-color: v-bind('props.darkMode ? "#252526" : "#f9fafb"');
}

:deep(.vditor-preview tr:hover td) {
  background-color: v-bind('props.darkMode ? "#2c2c2d" : "#f3f4f6"');
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

/* 所见即所得模式表格样式 */
:deep(.vditor-wysiwyg table) {
  border-color: v-bind('props.darkMode ? "#30363d" : "#e5e7eb"') !important;
  border-collapse: collapse;
  margin: 1rem 0;
}

:deep(.vditor-wysiwyg th) {
  background-color: v-bind('props.darkMode ? "#252526" : "#f3f4f6"') !important;
  border-color: v-bind('props.darkMode ? "#30363d" : "#e5e7eb"') !important;
  padding: 8px 12px;
  font-weight: 600;
  color: v-bind('props.darkMode ? "#e2e8f0" : "#374151"') !important;
}

:deep(.vditor-wysiwyg td) {
  border-color: v-bind('props.darkMode ? "#30363d" : "#e5e7eb"') !important;
  padding: 8px 12px;
  background-color: v-bind('props.darkMode ? "#1e1e1e" : "#ffffff"') !important;
  color: v-bind('props.darkMode ? "#d4d4d4" : "#374151"') !important;
}

:deep(.vditor-wysiwyg tr:nth-child(even) td) {
  background-color: v-bind('props.darkMode ? "#252526" : "#f9fafb"') !important;
}

:deep(.vditor-wysiwyg tr:hover td) {
  background-color: v-bind('props.darkMode ? "#2c2c2d" : "#f3f4f6"') !important;
}

:deep(.vditor-preview) {
  background-color: v-bind('props.darkMode ? "#1e1e1e" : "#ffffff"');
  color: v-bind('props.darkMode ? "#d4d4d4" : "#374151"');
}

/* 添加多级列表样式支持 */
/* 有序列表样式 */
:deep(.vditor-reset ol) {
  list-style-type: decimal;
  padding-left: 2em;
}

:deep(.vditor-reset ol ol) {
  list-style-type: decimal;
}

:deep(.vditor-reset ol ol ol) {
  list-style-type: decimal;
}

/* 无序列表样式 */
:deep(.vditor-reset ul) {
  list-style-type: disc;
  padding-left: 2em;
}

:deep(.vditor-reset ul ul) {
  list-style-type: circle;
}

:deep(.vditor-reset ul ul ul) {
  list-style-type: square;
}

/* 预览模式列表样式 */
:deep(.vditor-preview ol) {
  list-style-type: decimal;
  padding-left: 2em;
}

:deep(.vditor-preview ol ol) {
  list-style-type: decimal;
}

:deep(.vditor-preview ol ol ol) {
  list-style-type: decimal;
}

:deep(.vditor-preview ul) {
  list-style-type: disc;
  padding-left: 2em;
}

:deep(.vditor-preview ul ul) {
  list-style-type: circle;
}

:deep(.vditor-preview ul ul ul) {
  list-style-type: square;
}

/* 确保即时渲染模式的列表也正确显示 */
:deep(.vditor-ir ol) {
  list-style-type: decimal;
  padding-left: 2em;
}

:deep(.vditor-ir ol ol) {
  list-style-type: decimal;
}

:deep(.vditor-ir ol ol ol) {
  list-style-type: decimal;
}

:deep(.vditor-ir ul) {
  list-style-type: disc;
  padding-left: 2em;
}

:deep(.vditor-ir ul ul) {
  list-style-type: circle;
}

:deep(.vditor-ir ul ul ul) {
  list-style-type: square;
}

/* 禁用编辑器点击时的背景色自动变化 */
:deep(.vditor-input:focus),
:deep(.vditor-textarea:focus),
:deep(.vditor-sv:focus),
:deep(.vditor-ir:focus),
:deep(.vditor-wysiwyg:focus) {
  background-color: v-bind('props.darkMode ? "#1e1e1e" : "#ffffff"') !important;
  outline: none !important;
}

/* 确保编辑区域在所有模式下都保持一致的背景色 */
:deep(.vditor-sv),
:deep(.vditor-ir),
:deep(.vditor-wysiwyg) {
  background-color: v-bind('props.darkMode ? "#1e1e1e" : "#ffffff"') !important;
}

/* 禁用Vditor内置的focus背景色变化 */
:deep(.vditor--dark .vditor-input:focus),
:deep(.vditor--dark .vditor-textarea:focus) {
  background-color: v-bind('props.darkMode ? "#1e1e1e" : "#ffffff"') !important;
}

:deep(.vditor .vditor-input:focus),
:deep(.vditor .vditor-textarea:focus) {
  background-color: v-bind('props.darkMode ? "#1e1e1e" : "#ffffff"') !important;
}

/* 制表符样式支持 */
:deep(.vditor-reset) {
  tab-size: 4;
  -moz-tab-size: 4;
}

:deep(.vditor-ir) {
  tab-size: 4;
  -moz-tab-size: 4;
}

:deep(.vditor-sv) {
  tab-size: 4;
  -moz-tab-size: 4;
}

:deep(.vditor-wysiwyg) {
  tab-size: 4;
  -moz-tab-size: 4;
}

/* 复制格式菜单样式 */
#copyFormatMenu {
  min-width: 180px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;
  transform-origin: top left;
}

#copyFormatMenu div {
  transition: background-color 0.15s ease-in-out;
}

/* 纯文本编辑器样式 */
.editor-wrapper textarea {
  resize: vertical;
  min-height: 400px;
  font-family: Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace;
  line-height: 1.6;
  tab-size: 4;
  -moz-tab-size: 4;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.editor-wrapper textarea:focus {
  outline: none;
}

/* 纯文本编辑器暗色模式 */
.editor-wrapper textarea.bg-gray-800 {
  color: #d4d4d4;
}
</style>
