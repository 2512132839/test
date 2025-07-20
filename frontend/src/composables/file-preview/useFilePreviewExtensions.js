/**
 * 文件预览扩展功能 Composable
 * 专注交互功能（编辑、保存、下载等）
 */

import { ref, onMounted, onUnmounted, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { api } from "../../api/index.js";

export function useFilePreviewExtensions(
  file,
  authInfo,
  textContent,
  editContent,
  isEditMode,
  isSaving,
  showModeDropdown,
  isGeneratingPreview,
  officePreviewLoading,
  officePreviewError,
  officePreviewTimedOut,
  previewUrl,
  handleFullscreenChange,
  handleKeyDown,
  emit,
  authenticatedPreviewUrl,
  previewTimeoutId,
  microsoftOfficePreviewUrl,
  googleDocsPreviewUrl,
  initializePreview
) {
  const { t } = useI18n();

  // ===== Office预览处理 =====

  /**
   * Office预览加载完成处理
   */
  const handleOfficePreviewLoaded = () => {
    officePreviewLoading.value = false;
    officePreviewError.value = "";
    officePreviewTimedOut.value = false;
    console.log("Office预览加载完成");
  };

  /**
   * Office预览加载错误处理
   */
  const handleOfficePreviewError = (error) => {
    console.error("Office预览加载错误:", error);

    // 清除加载状态
    officePreviewLoading.value = false;
    officePreviewTimedOut.value = false;

    // 设置错误信息
    if (error && error.message) {
      officePreviewError.value = error.message;
    } else {
      officePreviewError.value = t("mount.filePreview.previewError");
    }

    console.log("Office预览错误处理完成");
  };

  // ===== 编辑模式处理 =====

  /**
   * 切换下拉框显示状态
   */
  const toggleModeDropdown = () => {
    showModeDropdown.value = !showModeDropdown.value;
  };

  /**
   * 选择预览/编辑模式
   */
  const selectMode = (mode) => {
    if (mode === "edit" && !isEditMode.value) {
      switchToEditMode();
    } else if (mode === "preview" && isEditMode.value) {
      cancelEdit();
    }
    showModeDropdown.value = false;
  };

  /**
   * 点击外部关闭下拉框
   */
  const handleClickOutside = (event) => {
    const dropdown = document.querySelector(".mode-selector .relative");
    if (dropdown && !dropdown.contains(event.target) && showModeDropdown.value) {
      showModeDropdown.value = false;
    }
  };

  /**
   * 切换到编辑模式
   */
  const switchToEditMode = () => {
    editContent.value = textContent.value;
    isEditMode.value = true;
  };

  /**
   * 取消编辑
   */
  const cancelEdit = async () => {
    isEditMode.value = false;
    editContent.value = "";

    // 重置下拉框状态
    showModeDropdown.value = false;

    // 取消编辑时重新初始化预览
    if (initializePreview) {
      await nextTick();
      await initializePreview();
    }
  };

  /**
   * 保存编辑内容
   */
  const saveContent = async () => {
    if (isSaving.value) return;

    isSaving.value = true;
    try {
      // 检查内容大小限制 (10MB)
      const MAX_CONTENT_SIZE = 10 * 1024 * 1024;
      if (editContent.value.length > MAX_CONTENT_SIZE) {
        throw new Error("文件过大，无法保存");
      }

      // 使用统一的文件更新API
      const response = await api.fs.updateFile(file.value.path, editContent.value);

      if (response.success) {
        // 更新文本内容
        textContent.value = editContent.value;

        // 退出编辑模式并重新初始化预览
        await cancelEdit();

        console.log("文件保存成功");
        emit("saved");
      } else {
        throw new Error(response.message || "保存失败");
      }
    } catch (error) {
      console.error("保存文件失败:", error);
      emit("error", error);
    } finally {
      isSaving.value = false;
    }
  };

  // ===== 音频播放器事件处理 =====

  /**
   * 音频播放事件处理
   */
  const handleAudioPlay = (data) => {
    console.log("音频开始播放:", data);
    // 可以在这里添加播放统计或其他逻辑
  };

  /**
   * 音频暂停事件处理
   */
  const handleAudioPause = (data) => {
    console.log("音频暂停播放:", data);
    // 可以在这里添加暂停统计或其他逻辑
  };

  /**
   * 音频错误事件处理
   */
  const handleAudioError = (error) => {
    // 忽略Service Worker相关的误报错误
    if (error?.target?.src?.includes(window.location.origin) && previewUrl.value?.startsWith("https://")) {
      console.log("🎵 忽略Service Worker相关的误报错误，音频实际可以正常播放");
      return;
    }

    console.error("音频播放错误:", error);
  };

  // ===== 其他功能 =====

  /**
   * 处理下载按钮点击
   */
  const handleDownload = () => {
    emit("download", file.value);
  };

  /**
   * 处理S3直链预览
   */
  const handleS3DirectPreview = async () => {
    if (isGeneratingPreview.value) return;

    try {
      isGeneratingPreview.value = true;
      console.log("开始生成S3直链预览...");

      // 直接使用文件信息中的preview_url字段（S3直链）
      if (file.value.preview_url) {
        console.log("S3直链预览使用文件信息中的preview_url:", file.value.preview_url);
        window.open(file.value.preview_url, "_blank");
        console.log("S3直链预览成功");
        return;
      }

      // 如果没有preview_url，说明后端有问题
      console.error("S3直链预览：文件信息中没有preview_url字段，请检查后端getFileInfo实现");
      throw new Error("文件信息中缺少preview_url字段");
    } catch (error) {
      console.error("S3直链预览失败:", error);
      alert(t("mount.filePreview.s3PreviewError", { message: error.message }));
    } finally {
      isGeneratingPreview.value = false;
    }
  };

  /**
   * 获取当前目录路径
   */
  const getCurrentDirectoryPath = () => {
    if (!file.value?.path) return "";

    // 从文件路径中提取目录路径
    const filePath = file.value.path;
    const lastSlashIndex = filePath.lastIndexOf("/");

    if (lastSlashIndex === -1) {
      return "/"; // 根目录
    }

    return filePath.substring(0, lastSlashIndex + 1);
  };

  // ===== 生命周期管理 =====

  /**
   * 组件挂载时的初始化
   */
  const initializeExtensions = () => {
    // 添加全屏变化监听
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("click", handleClickOutside);

    console.log("文件预览扩展功能初始化完成");
  };

  /**
   * 组件卸载时的清理
   */
  const cleanupExtensions = () => {
    // 清理URL资源
    if (authenticatedPreviewUrl && authenticatedPreviewUrl.value) {
      URL.revokeObjectURL(authenticatedPreviewUrl.value);
      authenticatedPreviewUrl.value = null;
    }

    // 清理编辑模式状态
    if (isEditMode) {
      isEditMode.value = false;
    }
    if (editContent) {
      editContent.value = "";
    }

    // 移除事件监听器
    document.removeEventListener("click", handleClickOutside);
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("fullscreenchange", handleFullscreenChange);

    // 清除计时器
    if (previewTimeoutId && previewTimeoutId.value) {
      clearTimeout(previewTimeoutId.value);
      previewTimeoutId.value = null;
    }

    // 清理其他资源
    if (textContent) {
      textContent.value = "";
    }
    if (microsoftOfficePreviewUrl) {
      microsoftOfficePreviewUrl.value = "";
    }
    if (googleDocsPreviewUrl) {
      googleDocsPreviewUrl.value = "";
    }

    console.log("文件预览扩展功能清理完成");
  };

  // 生命周期钩子
  onMounted(initializeExtensions);
  onUnmounted(cleanupExtensions);

  return {
    // Office预览处理
    handleOfficePreviewLoaded,
    handleOfficePreviewError,

    // 编辑模式处理
    toggleModeDropdown,
    selectMode,
    handleClickOutside,
    switchToEditMode,
    cancelEdit,
    saveContent,

    // 音频处理
    handleAudioPlay,
    handleAudioPause,
    handleAudioError,

    // 其他功能
    handleDownload,
    handleS3DirectPreview,
    getCurrentDirectoryPath,

    // 生命周期
    initializeExtensions,
    cleanupExtensions,
  };
}
