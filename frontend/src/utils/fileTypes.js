/**
 * 文件类型处理
 *
 */
import { getPreviewModeFromFilename, PREVIEW_MODES } from "./textUtils.js";

// 文件类型常量（与后端完全一致）
export const FileType = {
  UNKNOWN: 0, // 未知文件
  FOLDER: 1, // 文件夹
  VIDEO: 2, // 视频文件
  AUDIO: 3, // 音频文件
  TEXT: 4, // 文本文件
  IMAGE: 5, // 图片文件
  OFFICE: 6, // Office文档
  DOCUMENT: 7, // 文档文件
};

/**
 * 获取文件扩展名
 * @param {string} filename - 文件名
 * @returns {string} 扩展名（小写）
 */
export function getExtension(filename) {
  if (!filename) return "";
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

/**
 * 获取文件图标类型（用于fileTypeIcons.js）
 * @param {Object} fileObject - 文件对象，包含type字段
 * @returns {string} 图标类型
 */
export function getIconType(fileObject) {
  const iconMap = {
    [FileType.UNKNOWN]: "file",
    [FileType.FOLDER]: "folder",
    [FileType.VIDEO]: "video",
    [FileType.AUDIO]: "audio",
    [FileType.TEXT]: "text",
    [FileType.IMAGE]: "image",
    [FileType.OFFICE]: "document",
    [FileType.DOCUMENT]: "document",
  };
  return iconMap[fileObject?.type] || iconMap[FileType.UNKNOWN];
}

/**
 * 获取预览组件名称
 * @param {Object} fileObject - 文件对象，包含type和filename字段
 * @returns {string} 预览组件名称
 */
export function getPreviewComponent(fileObject) {
  const type = fileObject?.type;
  const filename = fileObject?.filename || fileObject?.name || "";

  // 直接基于type字段的映射
  if (type === FileType.IMAGE) return "ImagePreview";
  if (type === FileType.VIDEO) return "VideoPreview";
  if (type === FileType.AUDIO) return "AudioPreview";

  // Document类型（可直接预览的文档，如PDF）
  if (type === FileType.DOCUMENT) return "PdfPreview";

  // Office类型
  if (type === FileType.OFFICE) return "OfficePreview";

  // Text类型的细分
  if (type === FileType.TEXT) {
    const mode = getPreviewModeFromFilename(filename);

    if (mode === PREVIEW_MODES.CODE) return "CodePreview";
    if (mode === PREVIEW_MODES.MARKDOWN) return "MarkdownPreview";
    if (mode === PREVIEW_MODES.HTML) return "HtmlPreview";
    return "TextPreview";
  }

  // 默认预览
  return "GenericPreview";
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * 获取文件显示名称（去除扩展名）
 * @param {string} filename - 文件名
 * @returns {string} 显示名称
 */
export function getDisplayName(filename) {
  if (!filename) return "";
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex === -1) return filename;
  return filename.slice(0, lastDotIndex);
}
