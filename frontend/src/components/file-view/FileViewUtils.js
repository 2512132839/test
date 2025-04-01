// 文件预览页面的公共工具函数

/**
 * 格式化文件大小
 * @param {number} bytes - 文件大小（字节）
 * @returns {string} 格式化后的文件大小
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 字节";

  const k = 1024;
  const sizes = ["字节", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

/**
 * 格式化日期时间
 * @param {string} dateString - ISO格式的日期字符串
 * @returns {string} 格式化后的日期时间
 */
export const formatDateTime = (dateString) => {
  if (!dateString) return "未知";

  try {
    const date = new Date(dateString);

    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      return "日期无效";
    }

    // 使用Intl.DateTimeFormat以确保时区正确
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false, // 使用24小时制
    }).format(date);
  } catch (e) {
    console.error("日期格式化错误:", e);
    return "日期格式错误";
  }
};

/**
 * 获取文件类型的图标类名
 * @param {string} mimetype - 文件的MIME类型
 * @param {boolean} darkMode - 是否为暗色模式
 * @returns {string} 对应的图标类名
 */
export const getFileIconClass = (mimetype, darkMode = false) => {
  if (!mimetype) return darkMode ? "text-gray-400" : "text-gray-500";

  // Markdown 文件 - 特别处理，提升到顶层条件
  if (mimetype === "text/markdown") {
    return darkMode ? "text-emerald-400" : "text-emerald-500";
  }
  // 图片类型
  else if (mimetype.startsWith("image/")) {
    return darkMode ? "text-pink-400" : "text-pink-500";
  }
  // 视频类型
  else if (mimetype.startsWith("video/")) {
    return darkMode ? "text-purple-400" : "text-purple-500";
  }
  // 音频类型
  else if (mimetype.startsWith("audio/")) {
    return darkMode ? "text-indigo-400" : "text-indigo-500";
  }
  // PDF文档
  else if (mimetype === "application/pdf") {
    return darkMode ? "text-red-400" : "text-red-500";
  }
  // 电子表格
  else if (mimetype.includes("spreadsheet") || mimetype.includes("excel") || mimetype === "text/csv") {
    return darkMode ? "text-green-400" : "text-green-500";
  }
  // 文档类型
  else if (mimetype.includes("document") || mimetype.includes("word") || mimetype === "text/plain" || mimetype === "application/rtf") {
    return darkMode ? "text-blue-400" : "text-blue-500";
  }
  // 演示文稿
  else if (mimetype.includes("presentation") || mimetype.includes("powerpoint")) {
    return darkMode ? "text-orange-400" : "text-orange-500";
  }
  // 压缩文件
  else if (
    mimetype.includes("zip") ||
    mimetype.includes("rar") ||
    mimetype.includes("compressed") ||
    mimetype.includes("tar") ||
    mimetype.includes("gzip") ||
    mimetype === "application/x-7z-compressed"
  ) {
    return darkMode ? "text-yellow-400" : "text-yellow-500";
  }
  // 代码和脚本文件
  else if (mimetype === "application/javascript" || mimetype === "application/json" || mimetype === "text/html" || mimetype === "text/css" || mimetype === "application/xml") {
    return darkMode ? "text-teal-400" : "text-teal-500";
  }
  // 数据库文件
  else if (mimetype.includes("sqlite") || mimetype.includes("db")) {
    return darkMode ? "text-cyan-400" : "text-cyan-500";
  }
  // 字体文件
  else if (mimetype.includes("font") || mimetype.includes("ttf") || mimetype.includes("woff")) {
    return darkMode ? "text-rose-400" : "text-rose-500";
  }
  // 可执行文件
  else if (mimetype.includes("msdownload") || mimetype === "application/vnd.android.package-archive") {
    return darkMode ? "text-slate-400" : "text-slate-500";
  }
  // 默认灰色
  return darkMode ? "text-gray-400" : "text-gray-500";
};

/**
 * 格式化MIME类型为可读的文件类型
 * @param {string} mimetype - 文件的MIME类型
 * @returns {string} 格式化后的文件类型
 */
export const formatMimeType = (mimetype) => {
  if (!mimetype) return "未知类型";

  // 图片类型
  if (mimetype.startsWith("image/")) {
    const subtype = mimetype.replace("image/", "");
    const imageTypes = {
      jpeg: "JPEG图像",
      jpg: "JPEG图像",
      png: "PNG图像",
      gif: "GIF动图",
      webp: "WebP图像",
      "svg+xml": "SVG矢量图",
      tiff: "TIFF图像",
      bmp: "BMP位图",
      "x-icon": "ICO图标",
      heic: "HEIC高效图像",
    };
    return imageTypes[subtype] || `图像/${subtype}`;
  }
  // 视频类型
  else if (mimetype.startsWith("video/")) {
    const subtype = mimetype.replace("video/", "");
    const videoTypes = {
      mp4: "MP4视频",
      webm: "WebM视频",
      "x-msvideo": "AVI视频",
      quicktime: "MOV视频",
      "x-ms-wmv": "WMV视频",
      "x-matroska": "MKV视频",
      "3gpp": "3GP视频",
    };
    return videoTypes[subtype] || `视频/${subtype}`;
  }
  // 音频类型
  else if (mimetype.startsWith("audio/")) {
    const subtype = mimetype.replace("audio/", "");
    const audioTypes = {
      mpeg: "MP3音频",
      mp4: "M4A音频",
      wav: "WAV音频",
      ogg: "OGG音频",
      flac: "FLAC无损音频",
      aac: "AAC音频",
    };
    return audioTypes[subtype] || `音频/${subtype}`;
  }
  // Markdown 文件 - 特别处理，提升到顶层条件
  else if (mimetype === "text/markdown") {
    return "Markdown文档";
  }
  // 文档类型
  else if (mimetype === "application/pdf") {
    return "PDF文档";
  } else if (mimetype.includes("spreadsheet") || mimetype.includes("excel")) {
    return "电子表格";
  } else if (mimetype.includes("document") || mimetype.includes("word")) {
    return "文档";
  } else if (mimetype.includes("presentation") || mimetype.includes("powerpoint")) {
    return "演示文稿";
  }
  // 压缩文件
  else if (mimetype === "application/zip" || mimetype === "application/x-zip-compressed") {
    return "ZIP压缩包";
  } else if (mimetype === "application/x-rar-compressed") {
    return "RAR压缩包";
  } else if (mimetype === "application/x-7z-compressed") {
    return "7Z压缩包";
  } else if (mimetype === "application/x-tar") {
    return "TAR打包文件";
  } else if (mimetype === "application/gzip") {
    return "GZIP压缩文件";
  }
  // 文本文件
  else if (mimetype === "text/plain") {
    return "文本文件";
  } else if (mimetype === "text/html") {
    return "HTML网页";
  } else if (mimetype === "text/css") {
    return "CSS样式表";
  } else if (mimetype === "application/javascript") {
    return "JavaScript脚本";
  } else if (mimetype === "application/json") {
    return "JSON数据";
  } else if (mimetype === "application/xml") {
    return "XML数据";
  } else if (mimetype === "text/csv") {
    return "CSV表格数据";
  } else if (mimetype === "application/rtf") {
    return "RTF富文本";
  }
  // 其他特殊类型
  else if (mimetype === "application/x-iso9660-image") {
    return "ISO光盘镜像";
  } else if (mimetype === "application/x-sqlite3") {
    return "SQLite数据库";
  } else if (mimetype === "application/epub+zip") {
    return "EPUB电子书";
  } else if (mimetype === "application/vnd.android.package-archive") {
    return "APK安卓应用";
  } else if (mimetype === "application/x-msdownload") {
    return "可执行程序";
  } else if (mimetype === "image/vnd.adobe.photoshop") {
    return "PSD设计文件";
  } else if (mimetype === "application/postscript") {
    return "AI矢量设计";
  } else if (mimetype === "application/vnd.ms-fontobject" || mimetype === "font/ttf" || mimetype === "font/woff" || mimetype === "font/woff2") {
    return "字体文件";
  }

  // 如果没有匹配的预定义类型，尝试提取子类型
  const parts = mimetype.split("/");
  if (parts.length === 2) {
    return `${parts[0]}/${parts[1]}`;
  }

  return mimetype;
};

/**
 * 检查是否为图片类型
 * @param {string} mimetype - 文件的MIME类型
 * @returns {boolean} 是否为图片类型
 */
export const isImageType = (mimetype) => {
  return mimetype && mimetype.startsWith("image/");
};

/**
 * 检查是否为视频类型
 * @param {string} mimetype - 文件的MIME类型
 * @returns {boolean} 是否为视频类型
 */
export const isVideoType = (mimetype) => {
  return mimetype && mimetype.startsWith("video/");
};

/**
 * 检查是否为音频类型
 * @param {string} mimetype - 文件的MIME类型
 * @returns {boolean} 是否为音频类型
 */
export const isAudioType = (mimetype) => {
  return mimetype && mimetype.startsWith("audio/");
};

/**
 * 检查是否为PDF类型
 * @param {string} mimetype - 文件的MIME类型
 * @returns {boolean} 是否为PDF类型
 */
export const isPdfType = (mimetype) => {
  return mimetype === "application/pdf";
};

/**
 * 获取用户的认证状态
 * @returns {Object} 包含isAdmin, hasApiKey和hasFilePermission的认证状态对象
 */
export const getAuthStatus = () => {
  const adminToken = localStorage.getItem("admin_token");
  const apiKey = localStorage.getItem("api_key");

  // 尝试从本地存储获取API密钥权限信息
  let hasFilePermission = false;
  if (apiKey) {
    try {
      const permissionsStr = localStorage.getItem("api_key_permissions");
      if (permissionsStr) {
        const permissions = JSON.parse(permissionsStr);
        hasFilePermission = !!permissions.file;
      }
    } catch (e) {
      console.error("解析API密钥权限失败:", e);
    }
  }

  return {
    isAdmin: !!adminToken,
    hasApiKey: !!apiKey,
    hasFilePermission: hasFilePermission,
  };
};

/**
 * 检查是否为Markdown类型
 * @param {string} mimetype - 文件的MIME类型
 * @returns {boolean} 是否为Markdown类型
 */
export const isMarkdownType = (mimetype) => {
  return mimetype === "text/markdown";
};
