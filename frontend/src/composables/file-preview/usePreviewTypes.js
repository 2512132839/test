/**
 * 文件类型检测和预览能力判断 Composable
 * 从原 useFilePreviewComponent.js 中完整迁移的文件类型检测逻辑
 */

import {
  getFileExtension,
  isImage as checkIsImage,
  isVideo as checkIsVideo,
  isAudio as checkIsAudio,
  isText as checkIsText,
  isCode as checkIsCode,
  isMarkdown as checkIsMarkdown,
  isHtml as checkIsHtml,
  isPdf as checkIsPdf,
  isOffice as checkIsOffice,
  canPreview as checkCanPreview,
  quickDetect,
} from "@/utils/mimeUtils.js";

export function usePreviewTypes() {
  // ===== 文件类型检测方法（完全按照原版本逻辑） =====

  /**
   * 检测文件类型（与原版本完全一致）
   * @param {Object} file - 文件对象
   * @returns {string} 文件类型
   */
  const detectFileType = (file) => {
    if (!file) return "unknown";

    const contentType = file.contentType || file.mimetype || "";
    const fileName = file.name || "";

    // 按照优先级顺序检测（与原版本完全一致）
    if (checkIsImage(contentType, fileName)) return "image";
    if (checkIsVideo(contentType, fileName)) return "video";
    if (checkIsAudio(contentType, fileName)) return "audio";
    if (checkIsPdf(contentType, fileName)) return "pdf";
    if (checkIsOffice(contentType, fileName)) return "office";
    if (checkIsHtml(contentType, fileName)) return "html";
    if (checkIsMarkdown(contentType, fileName)) return "markdown";
    if (checkIsCode(contentType, fileName)) return "code";
    if (checkIsText(contentType, fileName)) return "text";

    return "unknown";
  };

  /**
   * 检查文件是否可以预览（使用 mimeUtils 的智能检测）
   * @param {Object} file - 文件对象
   * @returns {boolean} 是否可以预览
   */
  const isPreviewable = (file) => {
    if (!file) return false;

    const contentType = file.contentType || file.mimetype || "";
    const fileName = file.name || "";

    // 使用 mimeUtils 的智能预览检测
    return checkCanPreview(contentType, fileName);
  };

  /**
   * 获取文件类型信息
   * @param {Object} file - 文件对象
   * @returns {Object} 文件类型信息
   */
  const getFileTypeInfo = (file) => {
    if (!file) return { type: "unknown" };

    const contentType = file.contentType || file.mimetype || "";
    const fileName = file.name || "";
    const ext = getFileExtension(fileName);

    // 使用新的 mimeUtils 快速检测（与原版本完全一致）
    const detection = quickDetect(contentType, fileName);

    // 文件类型信息（与原版本格式完全一致）
    return {
      type: detection.group || "unknown",
      extension: ext,
      mimeType: contentType,
      category: detection.group,
      displayName: detection.displayName,
      canPreview: detection.canPreview,
      previewType: detection.previewType,
      icon: detection.icon,
      detectionMethod: detection.detectionMethod,
    };
  };

  /**
   * 检查是否为配置文件（完全按照原版本逻辑）
   * @param {Object} file - 文件对象
   * @returns {boolean} 是否为配置文件
   */
  const isConfigFile = (file) => {
    // 原版本逻辑：配置文件判断（基于代码文件的子集）
    if (!file) return false;

    const contentType = file.contentType || file.mimetype || "";
    const fileName = file.name || "";

    if (!checkIsCode(contentType, fileName)) return false;

    const ext = getFileExtension(fileName).toLowerCase();
    return ["json", "xml", "yaml", "yml", "toml", "ini", "conf", "config"].includes(ext);
  };

  /**
   * 检查Office文件的具体类型（按照原版本逻辑）
   * @param {Object} file - 文件对象
   * @returns {Object} Office文件类型信息
   */
  const getOfficeFileType = (file) => {
    if (!file) {
      return {
        isOffice: false,
        isWordDoc: false,
        isExcel: false,
        isPowerPoint: false,
      };
    }

    const contentType = file.contentType || file.mimetype || "";
    const fileName = file.name || "";

    if (!checkIsOffice(contentType, fileName)) {
      return {
        isOffice: false,
        isWordDoc: false,
        isExcel: false,
        isPowerPoint: false,
      };
    }

    const extension = getFileExtension(fileName).toLowerCase();

    return {
      isOffice: true,
      isWordDoc: ["doc", "docx", "rtf"].includes(extension),
      isExcel: ["xls", "xlsx", "csv"].includes(extension),
      isPowerPoint: ["ppt", "pptx"].includes(extension),
      extension,
    };
  };

  /**
   * 检查是否为Word文档（按照原版本逻辑）
   * @param {Object} file - 文件对象
   * @returns {boolean} 是否为Word文档
   */
  const isWordDoc = (file) => {
    if (!file) return false;

    const contentType = file.contentType || file.mimetype || "";
    const fileName = file.name || "";

    if (!checkIsOffice(contentType, fileName)) return false;

    const ext = getFileExtension(fileName).toLowerCase();
    return ["doc", "docx", "rtf"].includes(ext);
  };

  /**
   * 检查是否为Excel文档（按照原版本逻辑）
   * @param {Object} file - 文件对象
   * @returns {boolean} 是否为Excel文档
   */
  const isExcel = (file) => {
    if (!file) return false;

    const contentType = file.contentType || file.mimetype || "";
    const fileName = file.name || "";

    if (!checkIsOffice(contentType, fileName)) return false;

    const ext = getFileExtension(fileName).toLowerCase();
    return ["xls", "xlsx", "csv"].includes(ext);
  };

  /**
   * 检查是否为PowerPoint文档（按照原版本逻辑）
   * @param {Object} file - 文件对象
   * @returns {boolean} 是否为PowerPoint文档
   */
  const isPowerPoint = (file) => {
    if (!file) return false;

    const contentType = file.contentType || file.mimetype || "";
    const fileName = file.name || "";

    if (!checkIsOffice(contentType, fileName)) return false;

    const ext = getFileExtension(fileName).toLowerCase();
    return ["ppt", "pptx"].includes(ext);
  };

  // ===== 预览能力检测（按照原版本逻辑） =====

  /**
   * 获取文件的预览能力（完全按照原版本格式）
   * @param {Object} file - 文件对象
   * @returns {Object} 预览能力信息
   */
  const getPreviewCapability = (file) => {
    const type = detectFileType(file);
    const typeInfo = getFileTypeInfo(file);
    const officeInfo = getOfficeFileType(file);

    return {
      canPreview: isPreviewable(file),
      previewType: type,
      // 原版本中的能力标识
      requiresTextLoading: ["text", "code", "markdown", "html"].includes(type),
      requiresOfficeViewer: type === "office",
      supportsEdit: ["text", "code", "markdown"].includes(type),
      supportsFullscreen: ["image", "video", "pdf", "office", "html"].includes(type),
      // 合并类型信息
      ...typeInfo,
      ...officeInfo,
    };
  };

  // ===== 类型检测方法（与原 useFilePreviewComponent 完全兼容） =====
  // 注意：这些是简单的函数，用于在其他模块中调用

  const isImage = (file) => {
    if (!file) return false;
    return checkIsImage(file.contentType || file.mimetype || "", file.name || "");
  };

  const isVideo = (file) => {
    if (!file) return false;
    return checkIsVideo(file.contentType || file.mimetype || "", file.name || "");
  };

  const isAudio = (file) => {
    if (!file) return false;
    return checkIsAudio(file.contentType || file.mimetype || "", file.name || "");
  };

  const isPdf = (file) => {
    if (!file) return false;
    return checkIsPdf(file.contentType || file.mimetype || "", file.name || "");
  };

  const isOffice = (file) => {
    if (!file) return false;
    return checkIsOffice(file.contentType || file.mimetype || "", file.name || "");
  };

  const isHtml = (file) => {
    if (!file) return false;
    return checkIsHtml(file.contentType || file.mimetype || "", file.name || "");
  };

  const isMarkdown = (file) => {
    if (!file) return false;
    return checkIsMarkdown(file.contentType || file.mimetype || "", file.name || "");
  };

  const isCode = (file) => {
    if (!file) return false;
    return checkIsCode(file.contentType || file.mimetype || "", file.name || "");
  };

  const isText = (file) => {
    if (!file) return false;
    return checkIsText(file.contentType || file.mimetype || "", file.name || "");
  };

  const isConfig = (file) => isConfigFile(file);

  return {
    // 核心检测方法
    detectFileType,
    isPreviewable,
    getFileTypeInfo,
    getPreviewCapability,

    // 特殊类型检测
    isConfigFile,
    getOfficeFileType,

    // 兼容性方法（与原 useFilePreviewComponent 完全一致）
    isImage,
    isVideo,
    isAudio,
    isPdf,
    isOffice,
    isHtml,
    isMarkdown,
    isCode,
    isText,
    isConfig,

    // Office子类型检测（与原版本完全一致）
    isWordDoc,
    isExcel,
    isPowerPoint,
  };
}
