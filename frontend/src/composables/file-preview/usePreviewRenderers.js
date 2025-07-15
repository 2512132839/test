/**
 * 文件预览渲染器 Composable
 * 专注预览渲染
 */

import { ref, computed, nextTick, watch, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { createAuthenticatedPreviewUrl } from "../../utils/fileUtils.js";
import { formatDateTime } from "../../utils/timeUtils.js";
import { formatFileSize as formatFileSizeUtil } from "../../utils/mimeUtils.js";
import hljs from "highlight.js";
// 移除循环依赖：useFilePreviewExtensions 将在上层调用
import { usePreviewTypes } from "./usePreviewTypes.js";

// Vditor 相关全局变量
let VditorClass = null;
let vditorCSSLoaded = false;

export function usePreviewRenderers(file, authInfo, emit, darkMode) {
  const { t } = useI18n();

  // 使用独立的类型检测器模块
  const typeDetector = usePreviewTypes();

  // ===== 状态管理 =====

  // 文本内容相关
  const textContent = ref("");
  const isTextLoading = ref(false);
  const loadError = ref(false);
  const authenticatedPreviewUrl = ref(null);

  // 编辑模式相关
  const isEditMode = ref(false);
  const editContent = ref("");
  const isSaving = ref(false);
  const showModeDropdown = ref(false);

  // 渲染状态相关
  const isGeneratingPreview = ref(false);
  const isMarkdownRendered = ref(false);
  const highlightedContent = ref("");
  const codeLanguage = ref("");

  // Office预览相关
  const officePreviewLoading = ref(false);
  const officePreviewError = ref("");
  const officePreviewTimedOut = ref(false);
  const previewTimeoutId = ref(null);
  const microsoftOfficePreviewUrl = ref("");
  const googleDocsPreviewUrl = ref("");
  const useGoogleDocsPreview = ref(false);

  // 全屏状态
  const isOfficeFullscreen = ref(false);
  const isHtmlFullscreen = ref(false);

  // DOM 引用
  const previewContainer = ref(null);
  const htmlIframe = ref(null);
  const officePreviewRef = ref(null);
  const htmlPreviewRef = ref(null);

  // Office预览配置
  const officePreviewConfig = ref({
    defaultService: "microsoft",
    enableAutoFailover: true,
    loadTimeout: 60000,
  });

  // ===== 计算属性 =====

  /**
   * 文件类型信息
   */
  const fileTypeInfo = computed(() => {
    return typeDetector.getFileTypeInfo(file.value);
  });

  /**
   * 文件类型判断计算属性
   */
  const isImage = computed(() => typeDetector.isImage(file.value));
  const isVideo = computed(() => typeDetector.isVideo(file.value));
  const isAudio = computed(() => typeDetector.isAudio(file.value));
  const isPdf = computed(() => typeDetector.isPdf(file.value));
  const isMarkdown = computed(() => typeDetector.isMarkdown(file.value));
  const isHtml = computed(() => typeDetector.isHtml(file.value));
  const isCode = computed(() => typeDetector.isCode(file.value));
  const isText = computed(() => typeDetector.isText(file.value));
  const isOffice = computed(() => typeDetector.isOffice(file.value));
  // Office 子类型判断
  const isWordDoc = computed(() => typeDetector.isWordDoc(file.value));
  const isExcel = computed(() => typeDetector.isExcel(file.value));
  const isPowerPoint = computed(() => typeDetector.isPowerPoint(file.value));
  // 配置文件判断
  const isConfig = computed(() => typeDetector.isConfig(file.value));

  /**
   * 预览URL - 直接使用文件信息中的preview_url字段
   */
  const previewUrl = computed(() => {
    if (!file.value) return "";

    // 直接使用文件信息中的preview_url字段（S3直链）
    if (file.value.preview_url) {
      console.log("使用文件信息中的preview_url:", file.value.preview_url);
      return file.value.preview_url;
    }

    // 如果没有preview_url，说明后端有问题
    console.error("文件信息中没有preview_url字段，请检查后端getFileInfo实现");
    return "";
  });

  /**
   * 当前Office预览URL
   */
  const currentOfficePreviewUrl = computed(() => {
    return useGoogleDocsPreview.value ? googleDocsPreviewUrl.value : microsoftOfficePreviewUrl.value;
  });

  // ===== 文本内容加载 =====

  /**
   * 加载文本内容
   */
  const loadTextContent = async () => {
    // 文本文件、代码文件、Markdown文件、HTML文件都需要加载文本内容
    if (!isText.value && !isCode.value && !isMarkdown.value && !isHtml.value) return;

    try {
      isTextLoading.value = true;
      console.log("加载文本内容，URL:", previewUrl.value);

      // S3预签名URL不需要额外的认证头和credentials
      const response = await fetch(previewUrl.value, {
        mode: "cors",
      });

      if (response.ok) {
        const content = await response.text();
        textContent.value = content;
        await initializePreview();
        handleContentLoaded();
      } else {
        textContent.value = t("fileView.preview.text.error");
        handleContentError();
      }
    } catch (error) {
      console.error("加载文本内容错误:", error);
      textContent.value = t("fileView.preview.text.error");
      handleContentError();
    } finally {
      isTextLoading.value = false;
    }
  };

  /**
   * 获取认证预览URL（暂时弃用）
   */
  const fetchAuthenticatedUrl = async () => {
    try {
      // 转换为Blob URL以解决认证问题
      const authenticatedUrl = await createAuthenticatedPreviewUrl(previewUrl.value);
      authenticatedPreviewUrl.value = authenticatedUrl;
    } catch (error) {
      console.error("获取认证预览URL失败:", error);
      loadError.value = true;
      emit("error");
    }
  };

  // ===== Office预览处理 =====

  /**
   * 获取Office文件的直接URL
   */
  const getOfficeDirectUrlForPreview = async () => {
    try {
      // 直接使用文件信息中的preview_url字段（S3直链）
      if (file.value.preview_url) {
        console.log("Office预览使用文件信息中的preview_url:", file.value.preview_url);
        return file.value.preview_url;
      }

      // 如果没有preview_url，说明后端有问题
      console.error("Office预览：文件信息中没有preview_url字段，请检查后端getFileInfo实现");
      throw new Error("文件信息中缺少preview_url字段");
    } catch (error) {
      console.error("获取Office预览URL失败:", error);
      throw error;
    }
  };

  /**
   * 更新Office预览URLs
   */
  const updateOfficePreviewUrls = async () => {
    if (!file.value) return;

    officePreviewLoading.value = true;
    officePreviewError.value = "";
    officePreviewTimedOut.value = false;

    try {
      // 获取直接预签名URL
      const directUrl = await getOfficeDirectUrlForPreview();

      if (directUrl) {
        // 使用统一的预览服务
        const { getOfficePreviewUrl } = await import("../../api/services/previewService");
        const previewUrls = await getOfficePreviewUrl({ directUrl }, { returnAll: true });

        // 设置预览URL
        microsoftOfficePreviewUrl.value = previewUrls.microsoft;
        googleDocsPreviewUrl.value = previewUrls.google;

        console.log("Office预览URL生成成功", {
          microsoft: microsoftOfficePreviewUrl.value.substring(0, 100) + "...",
          google: googleDocsPreviewUrl.value.substring(0, 100) + "...",
        });

        officePreviewLoading.value = false;

        // 启动预览加载超时计时器
        startPreviewLoadTimeout();
      } else {
        throw new Error("获取到的预签名URL无效");
      }
    } catch (error) {
      console.error("更新Office预览URLs失败:", error);
      officePreviewError.value = error.message || "生成预览URL失败";
      officePreviewLoading.value = false;
    }
  };

  /**
   * 启动预览加载超时计时器
   */
  const startPreviewLoadTimeout = () => {
    clearPreviewLoadTimeout();

    previewTimeoutId.value = setTimeout(() => {
      if (officePreviewLoading.value) {
        officePreviewTimedOut.value = true;
        officePreviewLoading.value = false;
        console.log("Office预览加载超时");
      }
    }, officePreviewConfig.value.loadTimeout);
  };

  /**
   * 清除预览加载超时计时器
   */
  const clearPreviewLoadTimeout = () => {
    if (previewTimeoutId.value) {
      clearTimeout(previewTimeoutId.value);
      previewTimeoutId.value = null;
    }
  };

  // ===== Markdown渲染 =====

  /**
   * 懒加载 Vditor
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
   * 加载 Vditor CSS
   */
  const loadVditorCSS = async () => {
    if (!vditorCSSLoaded) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/assets/vditor/dist/index.css";
      document.head.appendChild(link);
      vditorCSSLoaded = true;
      console.log("Vditor CSS 加载成功");
    }
  };

  /**
   * 初始化Markdown预览
   */
  const initMarkdownPreview = async (container) => {
    if (!textContent.value) return;

    // 确保DOM更新后再初始化Vditor
    await nextTick();

    if (container) {
      try {
        // 清空之前的内容，避免重复渲染
        container.innerHTML = "";
        // 移除可能残留的主题相关类
        container.classList.remove("vditor-reset--dark", "vditor-reset--light");

        // 懒加载Vditor
        const VditorConstructor = await loadVditor();

        // 使用 Vditor 的预览 API 渲染内容
        VditorConstructor.preview(container, textContent.value, {
          mode: "dark-light", // 支持明暗主题
          theme: {
            current: darkMode?.value ? "dark" : "light", // 根据darkMode设置主题
          },
          cdn: "/assets/vditor",
          hljs: {
            lineNumber: true, // 代码块显示行号
            style: darkMode?.value ? "vs2015" : "github", // 代码高亮样式
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
            if (darkMode?.value) {
              container.classList.add("vditor-reset--dark");
              container.classList.remove("vditor-reset--light");
            } else {
              container.classList.add("vditor-reset--light");
              container.classList.remove("vditor-reset--dark");
            }
          },
        });

        // 标记为已渲染
        isMarkdownRendered.value = true;
        console.log("Markdown 预览初始化成功");
      } catch (error) {
        console.error("Markdown 预览初始化失败:", error);
        // 降级处理：显示原始文本
        if (container) {
          container.innerHTML = `<pre style="white-space: pre-wrap; word-wrap: break-word;">${textContent.value}</pre>`;
        }
      }
    }
  };

  /**
   * 渲染Markdown
   */
  const renderMarkdown = async () => {
    if (!textContent.value) {
      await loadTextContent();
    }

    if (textContent.value && previewContainer.value) {
      await initMarkdownPreview(previewContainer.value);
    }
  };

  // ===== 代码高亮 =====

  /**
   * 高亮并格式化代码
   */
  const highlightAndFormatCode = () => {
    if (!textContent.value) return;

    try {
      // 获取文件类型信息
      const typeInfo = fileTypeInfo.value;
      let language = "";

      if (typeInfo && typeInfo.type === "code") {
        language = typeInfo.language || "";
      }

      // 如果没有指定语言，尝试自动检测
      if (!language) {
        const detected = hljs.highlightAuto(textContent.value);
        language = detected.language || "plaintext";
      }

      // 进行语法高亮
      let highlighted;
      if (language && language !== "plaintext") {
        try {
          highlighted = hljs.highlight(textContent.value, { language });
        } catch (langError) {
          console.warn(`语言 ${language} 高亮失败，使用自动检测:`, langError);
          highlighted = hljs.highlightAuto(textContent.value);
        }
      } else {
        highlighted = hljs.highlightAuto(textContent.value);
      }

      highlightedContent.value = highlighted.value;
      codeLanguage.value = highlighted.language || language || "plaintext";

      console.log(`代码高亮完成，语言: ${codeLanguage.value}`);
    } catch (error) {
      console.error("代码高亮失败:", error);
      // 降级处理：显示原始文本
      highlightedContent.value = textContent.value;
      codeLanguage.value = "plaintext";
    }
  };

  /**
   * 高亮代码
   */
  const highlightCode = async () => {
    if (!textContent.value) {
      await loadTextContent();
    }

    if (textContent.value) {
      highlightAndFormatCode();
    }
  };

  // ===== HTML预览 =====

  /**
   * 初始化 HTML 预览
   */
  const initHtmlPreview = async () => {
    await nextTick();

    if (htmlIframe.value && textContent.value) {
      try {
        // 创建安全的HTML文档
        const htmlDoc = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HTML Preview</title>
    <style>
        body {
            margin: 0;
            padding: 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #fff;
        }

        /* 响应式设计 */
        @media (max-width: 768px) {
            body {
                padding: 8px;
                font-size: 14px;
            }
        }

        /* 基础样式重置 */
        * {
            box-sizing: border-box;
        }
    </style>
</head>
<body>
${textContent.value}
</body>
</html>`;

        const iframeDoc = htmlIframe.value.contentDocument || htmlIframe.value.contentWindow.document;

        // 写入HTML内容
        iframeDoc.open();
        iframeDoc.write(htmlDoc);
        iframeDoc.close();

        console.log("HTML 预览初始化成功");
      } catch (error) {
        console.error("HTML 预览初始化失败:", error);
      }
    }
  };

  // ===== 全屏功能 =====

  /**
   * 通用全屏处理函数
   */
  const toggleFullscreen = (elementRef, isFullscreenState, onEnter, onExit) => {
    if (!isFullscreenState.value) {
      // 进入全屏
      if (elementRef.value && document.fullscreenEnabled) {
        elementRef.value
            .requestFullscreen()
            .then(() => {
              isFullscreenState.value = true;
              if (onEnter) onEnter();
              console.log("进入全屏模式");
            })
            .catch((error) => {
              console.error("进入全屏失败:", error);
              // 降级处理：使用CSS全屏效果
              isFullscreenState.value = true;
              if (onEnter) onEnter();
            });
      } else {
        // 降级处理：使用CSS全屏效果
        isFullscreenState.value = true;
        if (onEnter) onEnter();
      }
    } else {
      // 退出全屏
      if (document.fullscreenElement) {
        document
            .exitFullscreen()
            .then(() => {
              isFullscreenState.value = false;
              if (onExit) onExit();
              console.log("退出全屏模式");
            })
            .catch((error) => {
              console.error("退出全屏失败:", error);
              isFullscreenState.value = false;
              if (onExit) onExit();
            });
      } else {
        isFullscreenState.value = false;
        if (onExit) onExit();
      }
    }
  };

  /**
   * 切换Office全屏
   */
  const toggleOfficeFullscreen = () => {
    toggleFullscreen(
        officePreviewRef,
        isOfficeFullscreen,
        () => {
          // 进入全屏时的回调
          console.log("Office预览进入全屏");
        },
        () => {
          // 退出全屏时的回调
          console.log("Office预览退出全屏");
        }
    );
  };

  /**
   * 切换HTML全屏
   */
  const toggleHtmlFullscreen = () => {
    toggleFullscreen(
        htmlPreviewRef,
        isHtmlFullscreen,
        () => {
          // 进入全屏时的回调
          console.log("HTML预览进入全屏");
        },
        () => {
          // 退出全屏时的回调
          console.log("HTML预览退出全屏");
        }
    );
  };

  /**
   * 监听全屏变化事件
   */
  const handleFullscreenChange = () => {
    // 如果不在全屏状态，重置全屏标志
    if (!document.fullscreenElement) {
      isOfficeFullscreen.value = false;
      isHtmlFullscreen.value = false;
      console.log("全屏状态已重置");
    }
  };

  /**
   * 监听Esc键退出全屏
   */
  const handleKeyDown = (e) => {
    // 浏览器原生全屏API会自动处理Esc键退出全屏
    // 这里可以添加其他键盘快捷键处理逻辑
    if (e.key === "Escape") {
      console.log("检测到Esc键，全屏状态将由浏览器处理");
    }
  };

  // ===== 编辑功能 =====

  /**
   * 进入编辑模式
   */
  const enterEditMode = () => {
    editContent.value = textContent.value;
    isEditMode.value = true;
  };

  /**
   * 退出编辑模式
   */
  const exitEditMode = async () => {
    isEditMode.value = false;
    editContent.value = "";
    showModeDropdown.value = false;

    // 重新初始化预览
    await nextTick();
    await initializePreview();
  };

  // ===== Office预览服务切换 =====

  /**
   * 切换Office预览服务
   */
  const toggleOfficePreviewService = () => {
    useGoogleDocsPreview.value = !useGoogleDocsPreview.value;

    // 重置错误和超时状态
    officePreviewError.value = "";
    officePreviewTimedOut.value = false;

    // 启动新的预览加载超时计时器
    startPreviewLoadTimeout();
  };

  // ===== 事件处理 =====

  /**
   * 处理内容加载完成
   */
  const handleContentLoaded = () => {
    console.log("内容加载完成");
    emit("loaded");
  };

  /**
   * 处理内容加载错误
   */
  const handleContentError = (error) => {
    console.error("内容加载错误:", error);
    loadError.value = true;
    emit("error", error);
  };

  // ===== 工具方法 =====

  /**
   * 格式化文件大小
   */
  const formatFileSize = (size) => {
    return formatFileSizeUtil(size);
  };

  /**
   * 格式化日期
   */
  const formatDate = (dateString) => {
    if (!dateString) return "";
    return formatDateTime(dateString);
  };

  // ===== 初始化和清理 =====

  /**
   * 初始化预览
   */
  const initializePreview = async () => {
    if (isMarkdown.value) {
      await renderMarkdown();
    } else if (isCode.value) {
      await highlightCode();
    } else if (isHtml.value) {
      await initHtmlPreview();
    }
    // 其他文件类型的预览由模板中的条件渲染处理
  };

  /**
   * 为文件初始化
   */
  const initializeForFile = async (newFile) => {
    // 重置所有状态
    textContent.value = "";
    loadError.value = false;
    authenticatedPreviewUrl.value = null;
    isMarkdownRendered.value = false;
    highlightedContent.value = "";
    codeLanguage.value = "";
    officePreviewLoading.value = false;
    officePreviewError.value = "";
    officePreviewTimedOut.value = false;
    microsoftOfficePreviewUrl.value = "";
    googleDocsPreviewUrl.value = "";
    isOfficeFullscreen.value = false;
    isHtmlFullscreen.value = false;
    clearPreviewLoadTimeout();

    // 重置编辑模式状态
    isEditMode.value = false;
    editContent.value = "";
    isSaving.value = false;
    showModeDropdown.value = false;

    // 重置扩展功能状态
    isGeneratingPreview.value = false;

    console.log("文件预览渲染器已重置，准备预览新文件:", newFile?.name || "无文件");
  };

  /**
   * 重新初始化预览（主题变化时）
   */
  const reinitializePreviewOnThemeChange = async () => {
    if (isEditMode.value) return; // 编辑模式下不需要重新初始化预览

    let scrollPosition = 0;

    // 保存当前滚动位置（如果有滚动容器）
    if (isMarkdown.value && previewContainer.value) {
      scrollPosition = previewContainer.value.scrollTop || 0;
    }

    // 如果是Markdown，重置渲染状态并重新渲染
    if (isMarkdown.value) {
      isMarkdownRendered.value = false;
      await renderMarkdown();

      // 恢复滚动位置（如果之前有记录）
      if (previewContainer.value && scrollPosition > 0) {
        await nextTick();
        previewContainer.value.scrollTop = scrollPosition;
      }
    }

    // 如果是HTML，重新初始化HTML预览
    if (isHtml.value) {
      await initHtmlPreview();
    }

    // 如果是代码，重新应用代码高亮
    if (isCode.value && highlightedContent.value) {
      await highlightCode();
    }
  };

  // ===== 监听器 =====

  /**
   * 监听暗色模式变化
   */
  watch(
      () => darkMode?.value,
      () => {
        reinitializePreviewOnThemeChange();
      }
  );

  /**
   * 监听文件变化
   */
  watch(
      () => file.value,
      (newFile) => {
        // 重置所有状态（与 initializeForFile 相同）
        textContent.value = "";
        loadError.value = false;
        authenticatedPreviewUrl.value = null;
        highlightedContent.value = "";
        codeLanguage.value = "";
        isMarkdownRendered.value = false;

        // 重置Office预览状态
        microsoftOfficePreviewUrl.value = "";
        googleDocsPreviewUrl.value = "";
        officePreviewLoading.value = false;
        officePreviewError.value = "";
        officePreviewTimedOut.value = false;
        clearPreviewLoadTimeout();

        // 重置编辑模式状态
        isEditMode.value = false;
        editContent.value = "";
        isSaving.value = false;
        showModeDropdown.value = false;

        // 重置扩展功能状态
        isGeneratingPreview.value = false;
        isOfficeFullscreen.value = false;
        isHtmlFullscreen.value = false;

        // 只有当文件存在时才初始化预览
        if (newFile) {
          // 添加详细的文件类型判断日志
          console.group(`📁 文件预览类型分析: ${newFile.name}`);
          console.log("🔍 文件信息:", {
            name: newFile.name,
            contentType: newFile.contentType || newFile.mimetype,
            size: newFile.size,
            path: newFile.path,
          });

          // 获取文件类型信息
          const typeInfo = fileTypeInfo.value;
          console.log("🎯 文件类型检测结果:", typeInfo);

          // 显示各种类型判断结果
          const typeChecks = {
            isImage: isImage.value,
            isVideo: isVideo.value,
            isAudio: isAudio.value,
            isPdf: isPdf.value,
            isOffice: isOffice.value,
            isMarkdown: isMarkdown.value,
            isHtml: isHtml.value,
            isCode: isCode.value,
            isText: isText.value,
          };
          console.log("📋 类型判断结果:", typeChecks);

          // 显示最终选择的预览类型
          const selectedType = Object.entries(typeChecks).find(([, value]) => value)?.[0] || "unknown";
          console.log(`✅ 最终预览类型: ${selectedType}`);
          console.groupEnd();

          // 对于需要加载文本内容的文件类型（文本、代码、Markdown、HTML），先设置加载状态，然后加载内容
          if (typeChecks.isText || typeChecks.isCode || typeChecks.isMarkdown || typeChecks.isHtml) {
            isTextLoading.value = true;
            loadTextContent();
          } else {
            isTextLoading.value = false;
          }

          //使用S3预签名URL
          if (typeChecks.isImage || typeChecks.isVideo || typeChecks.isAudio || typeChecks.isPdf) {
            authenticatedPreviewUrl.value = previewUrl.value;
          }

          // 如果是Office文件，更新Office预览URL
          if (typeChecks.isOffice) {
            updateOfficePreviewUrls();
          }
        } else {
          isTextLoading.value = false;
        }
      },
      { immediate: true }
  );

  // ===== 生命周期钩子 =====

  /**
   * 组件挂载时的初始化
   */
  onMounted(() => {
    // 添加事件监听器
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("keydown", handleKeyDown);

    console.log("文件预览组件已挂载");
  });

  /**
   * 组件卸载时的清理
   */
  onUnmounted(() => {
    // 清理URL资源
    if (authenticatedPreviewUrl.value) {
      URL.revokeObjectURL(authenticatedPreviewUrl.value);
      authenticatedPreviewUrl.value = null;
    }

    // 清理编辑模式状态
    if (isEditMode.value) {
      isEditMode.value = false;
    }
    if (editContent.value) {
      editContent.value = "";
    }

    // 移除事件监听器
    document.removeEventListener("fullscreenchange", handleFullscreenChange);
    document.removeEventListener("keydown", handleKeyDown);

    // 清除计时器
    if (previewTimeoutId.value) {
      clearTimeout(previewTimeoutId.value);
      previewTimeoutId.value = null;
    }

    // 清理其他资源
    textContent.value = "";
    microsoftOfficePreviewUrl.value = "";
    googleDocsPreviewUrl.value = "";

    console.log("文件预览组件已卸载");
  });

  // ===== 扩展功能将在上层集成 =====
  // 移除了对 useFilePreviewExtensions 的直接调用以避免循环依赖

  return {
    // 状态
    textContent,
    isTextLoading,
    loadError,
    authenticatedPreviewUrl,
    isGeneratingPreview,
    isEditMode,
    editContent,
    isSaving,
    showModeDropdown,
    isMarkdownRendered,
    highlightedContent,
    codeLanguage,
    officePreviewLoading,
    officePreviewError,
    officePreviewTimedOut,
    previewTimeoutId,
    microsoftOfficePreviewUrl,
    googleDocsPreviewUrl,
    useGoogleDocsPreview,
    isOfficeFullscreen,
    isHtmlFullscreen,
    officePreviewConfig,

    // 计算属性
    fileTypeInfo,
    isImage,
    isVideo,
    isAudio,
    isPdf,
    isMarkdown,
    isHtml,
    isCode,
    isConfig,
    isOffice,
    isWordDoc,
    isExcel,
    isPowerPoint,
    isText,
    previewUrl,
    currentOfficePreviewUrl,

    // DOM 引用
    previewContainer,
    htmlIframe,
    officePreviewRef,
    htmlPreviewRef,

    // 方法
    loadTextContent,
    fetchAuthenticatedUrl,
    getOfficeDirectUrlForPreview,
    updateOfficePreviewUrls,
    startPreviewLoadTimeout,
    clearPreviewLoadTimeout,
    initializePreview,
    loadVditor,
    loadVditorCSS,
    initMarkdownPreview,
    renderMarkdown,
    initHtmlPreview,
    highlightAndFormatCode,
    highlightCode,
    toggleFullscreen,
    handleFullscreenChange,
    handleKeyDown,
    handleContentLoaded,
    handleContentError,
    formatFileSize,
    formatDate,
    enterEditMode,
    exitEditMode,
    toggleOfficePreviewService,
    toggleOfficeFullscreen,
    toggleHtmlFullscreen,
    reinitializePreviewOnThemeChange,
    initializeForFile,

    // 扩展功能将在上层集成
  };
}
