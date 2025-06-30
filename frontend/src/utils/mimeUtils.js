/**
 * MIME类型工具类 - 完整重构版本
 * 基于 mime-db 数据库实现完整的文件类型检测、预览判断和图标映射系统
 *
 * 架构设计：
 * 1. MIME类型优先：首先使用后端返回的MIME类型
 * 2. 扩展名兜底：如果MIME类型通用或不存在，使用文件扩展名查找
 * 3. 统一配置：所有配置基于mime-db数据，确保准确性和完整性
 * 4. 模块化设计：预览类型、图标类型、格式化显示分离
 */

import mimeDb from "mime-db";

// ===== 预览类型常量 =====
// 预览类型分类
export const PREVIEW_TYPES = {
  IMAGE: "image", // 图片预览
  VIDEO: "video", // 视频预览
  AUDIO: "audio", // 音频预览
  TEXT: "text", // 文本预览
  CODE: "code", // 代码预览
  MARKDOWN: "markdown", // Markdown预览
  HTML: "html", // HTML预览
  PDF: "pdf", // PDF预览
  OFFICE: "office", // Office文档预览
  ARCHIVE: "archive", // 压缩包预览（显示内容列表）
  GENERIC: "generic", // 通用文件（不支持预览）
};

// ===== 文件分组常量 =====
export const FILE_GROUPS = {
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
  TEXT: "text",
  CODE: "code",
  MARKDOWN: "markdown",
  HTML: "html",
  PDF: "pdf",
  OFFICE: "office",
  ARCHIVE: "archive",
  FONT: "font",
  DATABASE: "database",
  EXECUTABLE: "executable",
  CONFIG: "config",
  UNKNOWN: "unknown",
};

// ===== 图标类型常量 =====
// 与现有图标系统集成的图标类型
export const ICON_TYPES = {
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
  TEXT: "text",
  CODE: "code",
  MARKDOWN: "markdown",
  HTML: "html",
  PDF: "pdf",
  WORD: "word",
  SPREADSHEET: "spreadsheet",
  PRESENTATION: "presentation",
  ARCHIVE: "archive",
  FONT: "font",
  DATABASE: "database",
  EXECUTABLE: "executable",
  CONFIG: "config",
  DEFAULT: "default",
};

// ===== 核心MIME类型配置 =====
// 基于mime-db数据扩展的业务逻辑配置
const MIME_TYPE_CONFIG = {
  // 图片文件
  "image/jpeg": { group: FILE_GROUPS.IMAGE, displayName: "JPEG图片", icon: ICON_TYPES.IMAGE, previewType: PREVIEW_TYPES.IMAGE },
  "image/png": { group: FILE_GROUPS.IMAGE, displayName: "PNG图片", icon: ICON_TYPES.IMAGE, previewType: PREVIEW_TYPES.IMAGE },
  "image/gif": { group: FILE_GROUPS.IMAGE, displayName: "GIF图片", icon: ICON_TYPES.IMAGE, previewType: PREVIEW_TYPES.IMAGE },
  "image/webp": { group: FILE_GROUPS.IMAGE, displayName: "WebP图片", icon: ICON_TYPES.IMAGE, previewType: PREVIEW_TYPES.IMAGE },
  "image/svg+xml": { group: FILE_GROUPS.IMAGE, displayName: "SVG矢量图", icon: ICON_TYPES.IMAGE, previewType: PREVIEW_TYPES.IMAGE },
  "image/bmp": { group: FILE_GROUPS.IMAGE, displayName: "BMP图片", icon: ICON_TYPES.IMAGE, previewType: PREVIEW_TYPES.IMAGE },
  "image/tiff": { group: FILE_GROUPS.IMAGE, displayName: "TIFF图片", icon: ICON_TYPES.IMAGE, previewType: PREVIEW_TYPES.IMAGE },
  "image/x-icon": { group: FILE_GROUPS.IMAGE, displayName: "ICO图标", icon: ICON_TYPES.IMAGE, previewType: PREVIEW_TYPES.IMAGE },
  "image/avif": { group: FILE_GROUPS.IMAGE, displayName: "AVIF图片", icon: ICON_TYPES.IMAGE, previewType: PREVIEW_TYPES.IMAGE },
  "image/heic": { group: FILE_GROUPS.IMAGE, displayName: "HEIC图片", icon: ICON_TYPES.IMAGE, previewType: PREVIEW_TYPES.IMAGE },

  // 视频文件
  "video/mp4": { group: FILE_GROUPS.VIDEO, displayName: "MP4视频", icon: ICON_TYPES.VIDEO, previewType: PREVIEW_TYPES.VIDEO },
  "application/mp4": { group: FILE_GROUPS.VIDEO, displayName: "MP4视频", icon: ICON_TYPES.VIDEO, previewType: PREVIEW_TYPES.VIDEO },
  "video/webm": { group: FILE_GROUPS.VIDEO, displayName: "WebM视频", icon: ICON_TYPES.VIDEO, previewType: PREVIEW_TYPES.VIDEO },
  "video/ogg": { group: FILE_GROUPS.VIDEO, displayName: "OGG视频", icon: ICON_TYPES.VIDEO, previewType: PREVIEW_TYPES.VIDEO },
  "video/avi": { group: FILE_GROUPS.VIDEO, displayName: "AVI视频", icon: ICON_TYPES.VIDEO, previewType: PREVIEW_TYPES.VIDEO },
  "video/x-msvideo": { group: FILE_GROUPS.VIDEO, displayName: "AVI视频", icon: ICON_TYPES.VIDEO, previewType: PREVIEW_TYPES.VIDEO },
  "video/quicktime": { group: FILE_GROUPS.VIDEO, displayName: "QuickTime视频", icon: ICON_TYPES.VIDEO, previewType: PREVIEW_TYPES.VIDEO },
  "video/x-matroska": { group: FILE_GROUPS.VIDEO, displayName: "MKV视频", icon: ICON_TYPES.VIDEO, previewType: PREVIEW_TYPES.VIDEO },
  "video/x-flv": { group: FILE_GROUPS.VIDEO, displayName: "FLV视频", icon: ICON_TYPES.VIDEO, previewType: PREVIEW_TYPES.VIDEO },
  "video/3gpp": { group: FILE_GROUPS.VIDEO, displayName: "3GP视频", icon: ICON_TYPES.VIDEO, previewType: PREVIEW_TYPES.VIDEO },

  // 音频文件
  "audio/mpeg": { group: FILE_GROUPS.AUDIO, displayName: "MP3音频", icon: ICON_TYPES.AUDIO, previewType: PREVIEW_TYPES.AUDIO },
  "audio/mp3": { group: FILE_GROUPS.AUDIO, displayName: "MP3音频", icon: ICON_TYPES.AUDIO, previewType: PREVIEW_TYPES.AUDIO },
  "audio/wav": { group: FILE_GROUPS.AUDIO, displayName: "WAV音频", icon: ICON_TYPES.AUDIO, previewType: PREVIEW_TYPES.AUDIO },
  "audio/ogg": { group: FILE_GROUPS.AUDIO, displayName: "OGG音频", icon: ICON_TYPES.AUDIO, previewType: PREVIEW_TYPES.AUDIO },
  "audio/aac": { group: FILE_GROUPS.AUDIO, displayName: "AAC音频", icon: ICON_TYPES.AUDIO, previewType: PREVIEW_TYPES.AUDIO },
  "audio/flac": { group: FILE_GROUPS.AUDIO, displayName: "FLAC音频", icon: ICON_TYPES.AUDIO, previewType: PREVIEW_TYPES.AUDIO },
  "audio/webm": { group: FILE_GROUPS.AUDIO, displayName: "WebM音频", icon: ICON_TYPES.AUDIO, previewType: PREVIEW_TYPES.AUDIO },
  "audio/mp4": { group: FILE_GROUPS.AUDIO, displayName: "M4A音频", icon: ICON_TYPES.AUDIO, previewType: PREVIEW_TYPES.AUDIO },
  "audio/x-ms-wma": { group: FILE_GROUPS.AUDIO, displayName: "WMA音频", icon: ICON_TYPES.AUDIO, previewType: PREVIEW_TYPES.AUDIO },

  // PDF文件
  "application/pdf": { group: FILE_GROUPS.PDF, displayName: "PDF文档", icon: ICON_TYPES.PDF, previewType: PREVIEW_TYPES.PDF },

  // Office文件 - Word
  "application/msword": { group: FILE_GROUPS.OFFICE, displayName: "Word文档", icon: ICON_TYPES.WORD, previewType: PREVIEW_TYPES.OFFICE },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    group: FILE_GROUPS.OFFICE,
    displayName: "Word文档",
    icon: ICON_TYPES.WORD,
    previewType: PREVIEW_TYPES.OFFICE,
  },
  "application/rtf": { group: FILE_GROUPS.OFFICE, displayName: "RTF文档", icon: ICON_TYPES.WORD, previewType: PREVIEW_TYPES.OFFICE },

  // Office文件 - Excel
  "application/vnd.ms-excel": { group: FILE_GROUPS.OFFICE, displayName: "Excel表格", icon: ICON_TYPES.SPREADSHEET, previewType: PREVIEW_TYPES.OFFICE },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    group: FILE_GROUPS.OFFICE,
    displayName: "Excel表格",
    icon: ICON_TYPES.SPREADSHEET,
    previewType: PREVIEW_TYPES.OFFICE,
  },
  "text/csv": { group: FILE_GROUPS.OFFICE, displayName: "CSV表格", icon: ICON_TYPES.SPREADSHEET, previewType: PREVIEW_TYPES.TEXT },

  // Office文件 - PowerPoint
  "application/vnd.ms-powerpoint": { group: FILE_GROUPS.OFFICE, displayName: "PowerPoint演示", icon: ICON_TYPES.PRESENTATION, previewType: PREVIEW_TYPES.OFFICE },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    group: FILE_GROUPS.OFFICE,
    displayName: "PowerPoint演示",
    icon: ICON_TYPES.PRESENTATION,
    previewType: PREVIEW_TYPES.OFFICE,
  },

  // HTML文件
  "text/html": { group: FILE_GROUPS.HTML, displayName: "HTML文档", icon: ICON_TYPES.HTML, previewType: PREVIEW_TYPES.HTML },

  // Markdown文件
  "text/markdown": { group: FILE_GROUPS.MARKDOWN, displayName: "Markdown文档", icon: ICON_TYPES.MARKDOWN, previewType: PREVIEW_TYPES.MARKDOWN },
  "text/x-markdown": { group: FILE_GROUPS.MARKDOWN, displayName: "Markdown文档", icon: ICON_TYPES.MARKDOWN, previewType: PREVIEW_TYPES.MARKDOWN },

  // 文本文件
  "text/plain": { group: FILE_GROUPS.TEXT, displayName: "文本文件", icon: ICON_TYPES.TEXT, previewType: PREVIEW_TYPES.TEXT },

  // 代码文件 - JavaScript系列
  "application/javascript": { group: FILE_GROUPS.CODE, displayName: "JavaScript代码文件", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "text/javascript": { group: FILE_GROUPS.CODE, displayName: "JavaScript脚本文件", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "application/x-javascript": { group: FILE_GROUPS.CODE, displayName: "JavaScript应用程序", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "text/ecmascript": { group: FILE_GROUPS.CODE, displayName: "ECMAScript代码", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "application/typescript": { group: FILE_GROUPS.CODE, displayName: "TypeScript代码文件", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "text/typescript": { group: FILE_GROUPS.CODE, displayName: "TypeScript脚本文件", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "text/jsx": { group: FILE_GROUPS.CODE, displayName: "React JSX文件", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },

  // 代码文件 - 样式表系列
  "text/css": { group: FILE_GROUPS.CODE, displayName: "CSS层叠样式表", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "text/scss": { group: FILE_GROUPS.CODE, displayName: "SCSS样式表", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "text/sass": { group: FILE_GROUPS.CODE, displayName: "Sass样式表", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "text/less": { group: FILE_GROUPS.CODE, displayName: "Less样式表", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "text/stylus": { group: FILE_GROUPS.CODE, displayName: "Stylus样式表", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },

  // 现代框架文件
  "text/x-vue": { group: FILE_GROUPS.CODE, displayName: "Vue.js组件文件", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "text/x-svelte": { group: FILE_GROUPS.CODE, displayName: "Svelte组件文件", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },

  // 模板文件
  "text/x-handlebars-template": { group: FILE_GROUPS.CODE, displayName: "Handlebars模板", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "text/x-mustache-template": { group: FILE_GROUPS.CODE, displayName: "Mustache模板", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },

  // 扩展数据格式
  "application/json5": { group: FILE_GROUPS.CONFIG, displayName: "JSON5数据文件", icon: ICON_TYPES.CONFIG, previewType: PREVIEW_TYPES.CODE },
  "text/mdx": { group: FILE_GROUPS.MARKDOWN, displayName: "MDX文档", icon: ICON_TYPES.MARKDOWN, previewType: PREVIEW_TYPES.MARKDOWN },

  // 代码文件 - Python系列
  "text/x-python": { group: FILE_GROUPS.CODE, displayName: "Python源代码文件", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "application/x-python-code": { group: FILE_GROUPS.CODE, displayName: "Python编译代码", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "text/x-python3": { group: FILE_GROUPS.CODE, displayName: "Python3源代码", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },

  // 代码文件 - Java系列
  "text/x-java-source": { group: FILE_GROUPS.CODE, displayName: "Java源代码文件", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "application/java": { group: FILE_GROUPS.CODE, displayName: "Java应用程序", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "text/x-java": { group: FILE_GROUPS.CODE, displayName: "Java代码文件", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },

  // 代码文件 - C/C++系列
  "text/x-c": { group: FILE_GROUPS.CODE, displayName: "C语言源代码", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "text/x-c++": { group: FILE_GROUPS.CODE, displayName: "C++语言源代码", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "text/x-c++src": { group: FILE_GROUPS.CODE, displayName: "C++源文件", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "text/x-chdr": { group: FILE_GROUPS.CODE, displayName: "C语言头文件", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "text/x-c++hdr": { group: FILE_GROUPS.CODE, displayName: "C++头文件", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },

  // 代码文件 - C#/.NET系列
  "text/x-csharp": { group: FILE_GROUPS.CODE, displayName: "C#源代码文件", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "application/x-csharp": { group: FILE_GROUPS.CODE, displayName: "C#应用程序", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },

  // 代码文件 - Go语言
  "text/x-go": { group: FILE_GROUPS.CODE, displayName: "Go语言源代码", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "application/x-go": { group: FILE_GROUPS.CODE, displayName: "Go语言程序", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },

  // 代码文件 - Rust语言
  "text/x-rust": { group: FILE_GROUPS.CODE, displayName: "Rust语言源代码", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "application/x-rust": { group: FILE_GROUPS.CODE, displayName: "Rust语言程序", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },

  // 代码文件 - PHP系列
  "text/x-php": { group: FILE_GROUPS.CODE, displayName: "PHP脚本文件", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "application/x-php": { group: FILE_GROUPS.CODE, displayName: "PHP应用程序", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "application/php": { group: FILE_GROUPS.CODE, displayName: "PHP程序文件", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },

  // 代码文件 - Ruby系列
  "text/x-ruby": { group: FILE_GROUPS.CODE, displayName: "Ruby脚本文件", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "application/x-ruby": { group: FILE_GROUPS.CODE, displayName: "Ruby应用程序", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },

  // 代码文件 - Shell脚本系列
  "text/x-shellscript": { group: FILE_GROUPS.CODE, displayName: "Shell脚本文件", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "application/x-sh": { group: FILE_GROUPS.CODE, displayName: "Shell可执行脚本", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },
  "text/x-sh": { group: FILE_GROUPS.CODE, displayName: "Shell命令脚本", icon: ICON_TYPES.CODE, previewType: PREVIEW_TYPES.CODE },

  // 配置文件 - JSON系列
  "application/json": { group: FILE_GROUPS.CONFIG, displayName: "JSON数据交换格式", icon: ICON_TYPES.CONFIG, previewType: PREVIEW_TYPES.CODE },
  "text/json": { group: FILE_GROUPS.CONFIG, displayName: "JSON文本格式", icon: ICON_TYPES.CONFIG, previewType: PREVIEW_TYPES.CODE },
  "application/ld+json": { group: FILE_GROUPS.CONFIG, displayName: "JSON-LD链接数据", icon: ICON_TYPES.CONFIG, previewType: PREVIEW_TYPES.CODE },

  // 配置文件 - XML系列
  "application/xml": { group: FILE_GROUPS.CONFIG, displayName: "XML可扩展标记语言", icon: ICON_TYPES.CONFIG, previewType: PREVIEW_TYPES.CODE },
  "text/xml": { group: FILE_GROUPS.CONFIG, displayName: "XML文本格式", icon: ICON_TYPES.CONFIG, previewType: PREVIEW_TYPES.CODE },
  "application/xhtml+xml": { group: FILE_GROUPS.CONFIG, displayName: "XHTML扩展超文本", icon: ICON_TYPES.CONFIG, previewType: PREVIEW_TYPES.CODE },

  // 配置文件 - YAML系列
  "application/yaml": { group: FILE_GROUPS.CONFIG, displayName: "YAML数据序列化标准", icon: ICON_TYPES.CONFIG, previewType: PREVIEW_TYPES.CODE },
  "text/yaml": { group: FILE_GROUPS.CONFIG, displayName: "YAML文本格式", icon: ICON_TYPES.CONFIG, previewType: PREVIEW_TYPES.CODE },
  "application/x-yaml": { group: FILE_GROUPS.CONFIG, displayName: "YAML配置文件", icon: ICON_TYPES.CONFIG, previewType: PREVIEW_TYPES.CODE },

  // 配置文件 - 其他格式
  "text/x-ini": { group: FILE_GROUPS.CONFIG, displayName: "INI配置文件", icon: ICON_TYPES.CONFIG, previewType: PREVIEW_TYPES.TEXT },
  "application/x-wine-extension-ini": { group: FILE_GROUPS.CONFIG, displayName: "Windows INI配置", icon: ICON_TYPES.CONFIG, previewType: PREVIEW_TYPES.TEXT },
  "text/x-properties": { group: FILE_GROUPS.CONFIG, displayName: "Properties属性文件", icon: ICON_TYPES.CONFIG, previewType: PREVIEW_TYPES.TEXT },
  "application/x-desktop": { group: FILE_GROUPS.CONFIG, displayName: "Desktop桌面配置", icon: ICON_TYPES.CONFIG, previewType: PREVIEW_TYPES.TEXT },
  "text/x-toml": { group: FILE_GROUPS.CONFIG, displayName: "TOML配置语言", icon: ICON_TYPES.CONFIG, previewType: PREVIEW_TYPES.CODE },
  "application/toml": { group: FILE_GROUPS.CONFIG, displayName: "TOML格式文件", icon: ICON_TYPES.CONFIG, previewType: PREVIEW_TYPES.CODE },

  // 压缩文件 - 常见格式
  "application/zip": { group: FILE_GROUPS.ARCHIVE, displayName: "ZIP压缩归档文件", icon: ICON_TYPES.ARCHIVE, previewType: PREVIEW_TYPES.ARCHIVE },
  "application/x-zip-compressed": { group: FILE_GROUPS.ARCHIVE, displayName: "ZIP压缩文件", icon: ICON_TYPES.ARCHIVE, previewType: PREVIEW_TYPES.ARCHIVE },
  "application/x-rar-compressed": { group: FILE_GROUPS.ARCHIVE, displayName: "RAR压缩归档文件", icon: ICON_TYPES.ARCHIVE, previewType: PREVIEW_TYPES.ARCHIVE },
  "application/vnd.rar": { group: FILE_GROUPS.ARCHIVE, displayName: "RAR归档格式", icon: ICON_TYPES.ARCHIVE, previewType: PREVIEW_TYPES.ARCHIVE },
  "application/x-7z-compressed": { group: FILE_GROUPS.ARCHIVE, displayName: "7-Zip压缩归档", icon: ICON_TYPES.ARCHIVE, previewType: PREVIEW_TYPES.ARCHIVE },
  "application/x-7zip": { group: FILE_GROUPS.ARCHIVE, displayName: "7-Zip格式文件", icon: ICON_TYPES.ARCHIVE, previewType: PREVIEW_TYPES.ARCHIVE },

  // 压缩文件 - TAR系列
  "application/x-tar": { group: FILE_GROUPS.ARCHIVE, displayName: "TAR归档文件", icon: ICON_TYPES.ARCHIVE, previewType: PREVIEW_TYPES.ARCHIVE },
  "application/gzip": { group: FILE_GROUPS.ARCHIVE, displayName: "GZIP压缩文件", icon: ICON_TYPES.ARCHIVE, previewType: PREVIEW_TYPES.ARCHIVE },
  "application/x-gzip": { group: FILE_GROUPS.ARCHIVE, displayName: "GNU ZIP压缩", icon: ICON_TYPES.ARCHIVE, previewType: PREVIEW_TYPES.ARCHIVE },
  "application/x-compressed-tar": { group: FILE_GROUPS.ARCHIVE, displayName: "压缩TAR归档", icon: ICON_TYPES.ARCHIVE, previewType: PREVIEW_TYPES.ARCHIVE },
  "application/x-bzip2": { group: FILE_GROUPS.ARCHIVE, displayName: "BZIP2压缩文件", icon: ICON_TYPES.ARCHIVE, previewType: PREVIEW_TYPES.ARCHIVE },
  "application/x-xz": { group: FILE_GROUPS.ARCHIVE, displayName: "XZ压缩文件", icon: ICON_TYPES.ARCHIVE, previewType: PREVIEW_TYPES.ARCHIVE },

  // 压缩文件 - 其他格式
  "application/x-lzh-compressed": { group: FILE_GROUPS.ARCHIVE, displayName: "LZH压缩归档", icon: ICON_TYPES.ARCHIVE, previewType: PREVIEW_TYPES.ARCHIVE },
  "application/x-ace-compressed": { group: FILE_GROUPS.ARCHIVE, displayName: "ACE压缩文件", icon: ICON_TYPES.ARCHIVE, previewType: PREVIEW_TYPES.ARCHIVE },
  "application/x-arj": { group: FILE_GROUPS.ARCHIVE, displayName: "ARJ压缩归档", icon: ICON_TYPES.ARCHIVE, previewType: PREVIEW_TYPES.ARCHIVE },
  "application/x-cab": { group: FILE_GROUPS.ARCHIVE, displayName: "CAB压缩文件", icon: ICON_TYPES.ARCHIVE, previewType: PREVIEW_TYPES.ARCHIVE },

  // 字体文件
  "font/ttf": { group: FILE_GROUPS.FONT, displayName: "TrueType字体", icon: ICON_TYPES.FONT, previewType: PREVIEW_TYPES.GENERIC },
  "font/woff": { group: FILE_GROUPS.FONT, displayName: "WOFF字体", icon: ICON_TYPES.FONT, previewType: PREVIEW_TYPES.GENERIC },
  "font/woff2": { group: FILE_GROUPS.FONT, displayName: "WOFF2字体", icon: ICON_TYPES.FONT, previewType: PREVIEW_TYPES.GENERIC },
  "font/otf": { group: FILE_GROUPS.FONT, displayName: "OpenType字体", icon: ICON_TYPES.FONT, previewType: PREVIEW_TYPES.GENERIC },

  // 数据库文件
  "application/x-sqlite3": { group: FILE_GROUPS.DATABASE, displayName: "SQLite数据库", icon: ICON_TYPES.DATABASE, previewType: PREVIEW_TYPES.GENERIC },

  // 可执行文件
  "application/octet-stream": { group: FILE_GROUPS.EXECUTABLE, displayName: "二进制文件", icon: ICON_TYPES.EXECUTABLE, previewType: PREVIEW_TYPES.GENERIC },
  "application/x-msdownload": { group: FILE_GROUPS.EXECUTABLE, displayName: "Windows可执行文件", icon: ICON_TYPES.EXECUTABLE, previewType: PREVIEW_TYPES.GENERIC },
  "application/x-executable": { group: FILE_GROUPS.EXECUTABLE, displayName: "可执行文件", icon: ICON_TYPES.EXECUTABLE, previewType: PREVIEW_TYPES.GENERIC },
};

// ===== 默认配置 =====
const DEFAULT_CONFIG = {
  group: FILE_GROUPS.UNKNOWN,
  displayName: "未知文件",
  icon: ICON_TYPES.DEFAULT,
  previewType: PREVIEW_TYPES.TEXT, // 默认作为文本预览
};

// ===== 自动生成扩展名到MIME类型的映射 =====
// 基于mime-db数据库自动构建扩展名映射表
const EXTENSION_TO_MIME_MAP = {};

// 从mime-db构建扩展名映射
Object.entries(mimeDb).forEach(([mimeType, data]) => {
  if (data.extensions) {
    data.extensions.forEach((ext) => {
      // 如果扩展名已存在，保留第一个（通常是最常用的）
      if (!EXTENSION_TO_MIME_MAP[ext]) {
        EXTENSION_TO_MIME_MAP[ext] = mimeType;
      }
    });
  }
});

// 补充mime-db缺少的文件类型
const MODERN_FILE_EXTENSIONS = {
  // TypeScript 系列
  ts: "application/typescript",
  tsx: "text/typescript",

  // JavaScript 现代扩展
  jsx: "text/jsx", // React JavaScript
  mjs: "application/javascript", // ES模块

  // Vue.js
  vue: "text/x-vue",

  // 其他现代框架
  svelte: "text/x-svelte",

  // 配置文件
  toml: "text/x-toml",
  yaml: "text/yaml",
  yml: "text/yaml",

  // 样式文件
  scss: "text/scss",
  sass: "text/sass",
  less: "text/less",
  stylus: "text/stylus",

  // 模板文件
  hbs: "text/x-handlebars-template",
  mustache: "text/x-mustache-template",

  // 数据文件
  jsonc: "application/json", // JSON with comments
  json5: "application/json5",

  // 文档文件
  mdx: "text/mdx", // Markdown + JSX
};

// 额外文件扩展映射，覆盖mime-db中可能不准确的映射
Object.entries(MODERN_FILE_EXTENSIONS).forEach(([ext, mimeType]) => {
  EXTENSION_TO_MIME_MAP[ext] = mimeType;
});

// ===== 通用MIME类型检测 =====
// 用于判断MIME类型是否为通用类型，需要使用扩展名兜底
const GENERIC_MIME_TYPES = new Set(["application/octet-stream", "application/unknown", "unknown/unknown", "", null, undefined]);

// ===== 核心工具函数 =====

/**
 * 获取文件扩展名
 * @param {string} filename - 文件名
 * @returns {string} 扩展名（小写）
 */
export function getFileExtension(filename) {
  if (!filename || typeof filename !== "string") return "";
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

/**
 * 检查MIME类型是否为通用类型
 * @param {string} mimeType - MIME类型
 * @returns {boolean} 是否为通用类型
 */
function isGenericMimeType(mimeType) {
  return GENERIC_MIME_TYPES.has(mimeType) || !mimeType;
}

/**
 * 从扩展名获取MIME类型
 * @param {string} extension - 文件扩展名
 * @returns {string|null} MIME类型或null
 */
function getMimeTypeFromExtension(extension) {
  if (!extension) return null;
  return EXTENSION_TO_MIME_MAP[extension.toLowerCase()] || null;
}

// ===== 核心API函数 =====

/**
 * 根据MIME类型和文件名获取完整的文件配置
 * 这是核心函数，实现双重检测机制：MIME类型优先，扩展名兜底
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {Object} 完整的文件配置对象
 */
export function getFileConfig(mimeType, filename = "") {
  let finalMimeType = mimeType;
  let config = null;
  let detectionMethod = "unknown";

  // 1. 优先使用MIME类型查找配置
  if (mimeType && !isGenericMimeType(mimeType)) {
    config = MIME_TYPE_CONFIG[mimeType];
    if (config) {
      finalMimeType = mimeType;
      detectionMethod = "mime-type";
    }
  }

  // 2. 兜底：使用扩展名查找
  if (!config && filename) {
    const extension = getFileExtension(filename);
    const foundMimeType = getMimeTypeFromExtension(extension);
    if (foundMimeType) {
      config = MIME_TYPE_CONFIG[foundMimeType];
      if (config) {
        finalMimeType = foundMimeType;
        detectionMethod = "file-extension";
      }
    }
  }

  // 3. 从mime-db获取标准数据
  const mimeDbData = mimeDb[finalMimeType] || {};

  // 4. 合并配置：业务配置 + mime-db数据 + 默认配置
  return {
    ...DEFAULT_CONFIG,
    ...config,
    // 从mime-db获取的标准数据
    extensions: mimeDbData.extensions || [],
    compressible: mimeDbData.compressible,
    charset: mimeDbData.charset,
    source: mimeDbData.source,
    mimeType: finalMimeType,
    // 添加检测方法信息
    detectionMethod,
  };
}

/**
 * 获取文件的预览类型
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {string} 预览类型
 */
export function getPreviewType(mimeType, filename = "") {
  const config = getFileConfig(mimeType, filename);
  return config.previewType;
}

/**
 * 获取文件的图标类型
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {string} 图标类型
 */
export function getFileIcon(mimeType, filename = "") {
  const config = getFileConfig(mimeType, filename);
  return config.icon;
}

/**
 * 获取文件的分组
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {string} 文件分组
 */
export function getFileGroup(mimeType, filename = "") {
  const config = getFileConfig(mimeType, filename);
  return config.group;
}

/**
 * 获取文件的显示名称
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {string} 显示名称
 */
export function getDisplayName(mimeType, filename = "") {
  const config = getFileConfig(mimeType, filename);
  return config.displayName;
}

// ===== 预览判断函数 =====

/**
 * 判断文件是否可以预览
 * 采用智能检测策略：优先检测已知类型，未知类型默认可预览
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {boolean} 是否可以预览
 */
export function canPreview(mimeType, filename = "") {
  // 1. 检查是否为已知的可预览类型
  const previewType = getPreviewType(mimeType, filename);

  // 如果是明确支持的预览类型，直接返回true
  if (previewType !== PREVIEW_TYPES.GENERIC) {
    return true;
  }

  // 2. 对于GENERIC类型，进行进一步判断

  // 2.1 检查MIME类型是否明确表示为二进制
  if (mimeType) {
    // 明确的二进制MIME类型
    if (
      mimeType.startsWith("application/octet-stream") ||
      mimeType.startsWith("application/x-binary") ||
      mimeType.startsWith("application/x-executable") ||
      mimeType.includes("zip") ||
      mimeType.includes("compressed") ||
      mimeType.startsWith("font/")
    ) {
      return false;
    }

    // 如果MIME类型以text/开头，肯定可以预览
    if (mimeType.startsWith("text/")) {
      return true;
    }
  }

  // 2.2 基于文件扩展名进行智能判断
  const extension = getFileExtension(filename).toLowerCase();

  if (extension) {
    // 明确的二进制文件扩展名（只包含最常见的）
    const definitelyBinaryExtensions = new Set([
      // 压缩包
      "zip",
      "rar",
      "7z",
      "tar",
      "gz",
      // 可执行文件
      "exe",
      "msi",
      "dmg",
      "app",
      // 数据库
      "db",
      "sqlite",
      "sqlite3",
      // 字体
      "ttf",
      "otf",
      "woff",
      "woff2",
    ]);

    if (definitelyBinaryExtensions.has(extension)) {
      return false;
    }

    // 明确的文本文件扩展名（包含配置文件等）
    const definitelyTextExtensions = new Set([
      // 常见文本文件
      "txt",
      "log",
      "md",
      "readme",
      // 配置文件
      "conf",
      "config",
      "ini",
      "env",
      "properties",
      // 无扩展名的常见配置文件
      "dockerfile",
      "makefile",
      "license",
      "changelog",
      // 数据文件
      "json",
      "xml",
      "yaml",
      "yml",
      "toml",
      "csv",
    ]);

    if (definitelyTextExtensions.has(extension)) {
      return true;
    }
  }

  // 2.3 特殊处理：无扩展名的文件
  if (!extension && filename) {
    const lowerName = filename.toLowerCase();
    // 常见的无扩展名配置文件
    const configFileNames = new Set([
      "dockerfile",
      "makefile",
      "license",
      "readme",
      "changelog",
      "authors",
      "contributors",
      "copying",
      "install",
      "news",
      ".gitignore",
      ".gitattributes",
      ".editorconfig",
      ".eslintrc",
      ".prettierrc",
      ".babelrc",
      ".npmrc",
      ".yarnrc",
    ]);

    if (configFileNames.has(lowerName) || lowerName.startsWith(".")) {
      return true;
    }
  }

  // 3. 默认策略：未知类型默认可以尝试预览
  // 这样用户可以查看任何可能是文本的文件
  return true;
}

/**
 * 判断是否为图片文件
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {boolean} 是否为图片
 */
export function isImage(mimeType, filename = "") {
  const previewType = getPreviewType(mimeType, filename);
  return previewType === PREVIEW_TYPES.IMAGE;
}

/**
 * 判断是否为视频文件
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {boolean} 是否为视频
 */
export function isVideo(mimeType, filename = "") {
  const previewType = getPreviewType(mimeType, filename);
  return previewType === PREVIEW_TYPES.VIDEO;
}

/**
 * 判断是否为音频文件
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {boolean} 是否为音频
 */
export function isAudio(mimeType, filename = "") {
  const previewType = getPreviewType(mimeType, filename);
  return previewType === PREVIEW_TYPES.AUDIO;
}

/**
 * 判断是否为文本文件
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {boolean} 是否为文本
 */
export function isText(mimeType, filename = "") {
  const previewType = getPreviewType(mimeType, filename);
  return previewType === PREVIEW_TYPES.TEXT;
}

/**
 * 判断是否为代码文件
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {boolean} 是否为代码
 */
export function isCode(mimeType, filename = "") {
  const previewType = getPreviewType(mimeType, filename);
  return previewType === PREVIEW_TYPES.CODE;
}

/**
 * 判断是否为Markdown文件
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {boolean} 是否为Markdown
 */
export function isMarkdown(mimeType, filename = "") {
  const previewType = getPreviewType(mimeType, filename);
  return previewType === PREVIEW_TYPES.MARKDOWN;
}

/**
 * 判断是否为HTML文件
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {boolean} 是否为HTML
 */
export function isHtml(mimeType, filename = "") {
  const previewType = getPreviewType(mimeType, filename);
  return previewType === PREVIEW_TYPES.HTML;
}

/**
 * 判断是否为PDF文件
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {boolean} 是否为PDF
 */
export function isPdf(mimeType, filename = "") {
  const previewType = getPreviewType(mimeType, filename);
  return previewType === PREVIEW_TYPES.PDF;
}

/**
 * 判断是否为Office文件
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {boolean} 是否为Office文件
 */
export function isOffice(mimeType, filename = "") {
  const previewType = getPreviewType(mimeType, filename);
  return previewType === PREVIEW_TYPES.OFFICE;
}

/**
 * 判断是否为配置文件
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {boolean} 是否为配置文件
 */
export function isConfig(mimeType, filename = "") {
  const group = getFileGroup(mimeType, filename);
  return group === FILE_GROUPS.CONFIG;
}

/**
 * 判断是否为压缩包文件
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {boolean} 是否为压缩包
 */
export function isArchive(mimeType, filename = "") {
  const previewType = getPreviewType(mimeType, filename);
  return previewType === PREVIEW_TYPES.ARCHIVE;
}

// ===== 格式化和显示函数 =====

/**
 * 格式化MIME类型为用户友好的显示文本
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {string} 格式化后的显示文本
 */
export function formatMimeType(mimeType, filename = "") {
  const displayName = getDisplayName(mimeType, filename);
  return displayName;
}

/**
 * 获取详细的文件类型描述
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {string} 详细的类型描述
 */
export function getDetailedFileType(mimeType, filename = "") {
  const config = getFileConfig(mimeType, filename);
  return config.displayName;
}

/**
 * 获取文件大小格式化函数
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的文件大小
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// ===== 调试和开发辅助函数 =====

/**
 * 获取所有支持的MIME类型列表
 * @returns {string[]} MIME类型数组
 */
export function getSupportedMimeTypes() {
  return Object.keys(MIME_TYPE_CONFIG);
}

/**
 * 获取所有支持的文件扩展名列表
 * @returns {string[]} 扩展名数组
 */
export function getSupportedExtensions() {
  return Object.keys(EXTENSION_TO_MIME_MAP);
}

/**
 * 调试函数：获取文件的完整检测信息
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名
 * @returns {Object} 完整的检测信息
 */
export function getDebugInfo(mimeType, filename = "") {
  const extension = getFileExtension(filename);
  const extensionMimeType = getMimeTypeFromExtension(extension);
  const config = getFileConfig(mimeType, filename);

  return {
    input: { mimeType, filename, extension },
    detection: {
      isGenericMimeType: isGenericMimeType(mimeType),
      extensionMimeType,
      finalMimeType: config.mimeType,
      usedExtensionFallback: config.mimeType === extensionMimeType,
    },
    result: config,
  };
}

// ===== 图标系统集成函数 =====

/**
 * 获取文件图标SVG字符串（与现有图标系统集成）
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @param {boolean} darkMode - 是否为暗色模式
 * @param {boolean} isDirectory - 是否为目录
 * @param {boolean} isMount - 是否为挂载点
 * @returns {string} SVG图标字符串
 */
export function getFileIconSvg(mimeType, filename = "", darkMode = false, isDirectory = false, isMount = false) {
  // 动态导入图标系统以避免循环依赖
  try {
    const { getFileIconByMimeType } = require("./fileTypeIcons.js");
    return getFileIconByMimeType(mimeType, isDirectory, isMount, darkMode);
  } catch (error) {
    console.warn("无法加载图标系统，返回默认图标", error);
    return getDefaultIconSvg(darkMode);
  }
}

/**
 * 获取默认图标SVG
 * @param {boolean} darkMode - 是否为暗色模式
 * @returns {string} 默认SVG图标
 */
function getDefaultIconSvg(darkMode = false) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-full h-full" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
        stroke="${darkMode ? "#93c5fd" : "#3b82f6"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="${darkMode ? "#93c5fd" : "#3b82f6"}" fill-opacity="${
    darkMode ? "0.1" : "0.1"
  }"/>
      <path d="M14 2V8H20" stroke="${darkMode ? "#93c5fd" : "#3b82f6"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

/**
 * 获取文件图标CSS类名（用于样式控制）
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @param {boolean} darkMode - 是否为暗色模式
 * @returns {string} CSS类名
 */
export function getFileIconClass(mimeType, filename = "", darkMode = false) {
  const group = getFileGroup(mimeType, filename);

  // 根据文件分组返回对应的CSS类名
  const iconClasses = {
    [FILE_GROUPS.IMAGE]: darkMode ? "text-blue-400" : "text-blue-600",
    [FILE_GROUPS.VIDEO]: darkMode ? "text-purple-400" : "text-purple-600",
    [FILE_GROUPS.AUDIO]: darkMode ? "text-green-400" : "text-green-600",
    [FILE_GROUPS.TEXT]: darkMode ? "text-gray-400" : "text-gray-600",
    [FILE_GROUPS.CODE]: darkMode ? "text-yellow-400" : "text-yellow-600",
    [FILE_GROUPS.MARKDOWN]: darkMode ? "text-indigo-400" : "text-indigo-600",
    [FILE_GROUPS.HTML]: darkMode ? "text-orange-400" : "text-orange-600",
    [FILE_GROUPS.PDF]: darkMode ? "text-red-400" : "text-red-600",
    [FILE_GROUPS.OFFICE]: darkMode ? "text-blue-400" : "text-blue-600",
    [FILE_GROUPS.ARCHIVE]: darkMode ? "text-amber-400" : "text-amber-600",
    [FILE_GROUPS.FONT]: darkMode ? "text-pink-400" : "text-pink-600",
    [FILE_GROUPS.DATABASE]: darkMode ? "text-cyan-400" : "text-cyan-600",
    [FILE_GROUPS.EXECUTABLE]: darkMode ? "text-emerald-400" : "text-emerald-600",
    [FILE_GROUPS.CONFIG]: darkMode ? "text-lime-400" : "text-lime-600",
    [FILE_GROUPS.UNKNOWN]: darkMode ? "text-gray-400" : "text-gray-500",
  };

  return iconClasses[group] || (darkMode ? "text-gray-400" : "text-gray-500");
}

/**
 * 获取MIME类型的背景样式类（用于标签显示）
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @param {boolean} darkMode - 是否为暗色模式
 * @returns {string} CSS类名
 */
export function getMimeTypeBackgroundClass(mimeType, filename = "", darkMode = false) {
  const group = getFileGroup(mimeType, filename);

  // 根据文件分组返回对应的背景色CSS类名
  const backgroundClasses = {
    [FILE_GROUPS.IMAGE]: darkMode ? "bg-blue-900 text-blue-200" : "bg-blue-100 text-blue-800",
    [FILE_GROUPS.VIDEO]: darkMode ? "bg-purple-900 text-purple-200" : "bg-purple-100 text-purple-800",
    [FILE_GROUPS.AUDIO]: darkMode ? "bg-green-900 text-green-200" : "bg-green-100 text-green-800",
    [FILE_GROUPS.TEXT]: darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700",
    [FILE_GROUPS.CODE]: darkMode ? "bg-yellow-900 text-yellow-200" : "bg-yellow-100 text-yellow-800",
    [FILE_GROUPS.MARKDOWN]: darkMode ? "bg-indigo-900 text-indigo-200" : "bg-indigo-100 text-indigo-800",
    [FILE_GROUPS.HTML]: darkMode ? "bg-orange-900 text-orange-200" : "bg-orange-100 text-orange-800",
    [FILE_GROUPS.PDF]: darkMode ? "bg-red-900 text-red-200" : "bg-red-100 text-red-800",
    [FILE_GROUPS.OFFICE]: darkMode ? "bg-blue-900 text-blue-200" : "bg-blue-100 text-blue-800",
    [FILE_GROUPS.ARCHIVE]: darkMode ? "bg-amber-900 text-amber-200" : "bg-amber-100 text-amber-800",
    [FILE_GROUPS.FONT]: darkMode ? "bg-pink-900 text-pink-200" : "bg-pink-100 text-pink-800",
    [FILE_GROUPS.DATABASE]: darkMode ? "bg-cyan-900 text-cyan-200" : "bg-cyan-100 text-cyan-800",
    [FILE_GROUPS.EXECUTABLE]: darkMode ? "bg-emerald-900 text-emerald-200" : "bg-emerald-100 text-emerald-800",
    [FILE_GROUPS.CONFIG]: darkMode ? "bg-lime-900 text-lime-200" : "bg-lime-100 text-lime-800",
    [FILE_GROUPS.UNKNOWN]: darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700",
  };

  return backgroundClasses[group] || (darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700");
}

/**
 * 获取文件类型的颜色主题
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {Object} 包含主色调和辅助色的对象
 */
export function getFileColorTheme(mimeType, filename = "") {
  const group = getFileGroup(mimeType, filename);

  const colorThemes = {
    [FILE_GROUPS.IMAGE]: { primary: "#3b82f6", secondary: "#93c5fd", name: "蓝色" },
    [FILE_GROUPS.VIDEO]: { primary: "#8b5cf6", secondary: "#c4b5fd", name: "紫色" },
    [FILE_GROUPS.AUDIO]: { primary: "#10b981", secondary: "#6ee7b7", name: "绿色" },
    [FILE_GROUPS.TEXT]: { primary: "#6b7280", secondary: "#d1d5db", name: "灰色" },
    [FILE_GROUPS.CODE]: { primary: "#f59e0b", secondary: "#fcd34d", name: "黄色" },
    [FILE_GROUPS.MARKDOWN]: { primary: "#6366f1", secondary: "#a5b4fc", name: "靛蓝色" },
    [FILE_GROUPS.HTML]: { primary: "#f97316", secondary: "#fdba74", name: "橙色" },
    [FILE_GROUPS.PDF]: { primary: "#ef4444", secondary: "#fca5a5", name: "红色" },
    [FILE_GROUPS.OFFICE]: { primary: "#3b82f6", secondary: "#93c5fd", name: "蓝色" },
    [FILE_GROUPS.ARCHIVE]: { primary: "#f59e0b", secondary: "#fcd34d", name: "琥珀色" },
    [FILE_GROUPS.FONT]: { primary: "#ec4899", secondary: "#f9a8d4", name: "粉色" },
    [FILE_GROUPS.DATABASE]: { primary: "#06b6d4", secondary: "#67e8f9", name: "青色" },
    [FILE_GROUPS.EXECUTABLE]: { primary: "#059669", secondary: "#6ee7b7", name: "翠绿色" },
    [FILE_GROUPS.CONFIG]: { primary: "#84cc16", secondary: "#bef264", name: "柠檬绿" },
    [FILE_GROUPS.UNKNOWN]: { primary: "#6b7280", secondary: "#d1d5db", name: "灰色" },
  };

  return colorThemes[group] || colorThemes[FILE_GROUPS.UNKNOWN];
}

// ===== 高级格式化和显示函数 =====

/**
 * 获取文件的完整显示信息
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @param {number} fileSize - 文件大小（字节）
 * @returns {Object} 完整的显示信息对象
 */
export function getFileDisplayInfo(mimeType, filename = "", fileSize = 0) {
  const config = getFileConfig(mimeType, filename);
  const colorTheme = getFileColorTheme(mimeType, filename);

  return {
    // 基础信息
    mimeType: config.mimeType,
    filename,
    fileSize,
    formattedSize: formatFileSize(fileSize),

    // 类型信息
    group: config.group,
    displayName: config.displayName,
    icon: config.icon,
    previewType: config.previewType,

    // 显示信息
    colorTheme,

    // 功能标识
    canPreview: canPreview(mimeType, filename),
    isImage: isImage(mimeType, filename),
    isVideo: isVideo(mimeType, filename),
    isAudio: isAudio(mimeType, filename),
    isText: isText(mimeType, filename),
    isCode: isCode(mimeType, filename),
    isArchive: isArchive(mimeType, filename),

    // 扩展信息
    extensions: config.extensions || [],
    compressible: config.compressible,
    charset: config.charset,
    source: config.source,
  };
}

// ===== 统一API接口 =====

/**
 * 主要API函数：根据文件信息获取完整配置
 * 这是最主要的API函数，其他函数都基于此函数构建
 * @param {Object} fileInfo - 文件信息对象
 * @param {string} fileInfo.mimeType - MIME类型
 * @param {string} fileInfo.filename - 文件名
 * @param {number} fileInfo.size - 文件大小（可选）
 * @returns {Object} 完整的文件配置和显示信息
 */
export function analyzeFile(fileInfo) {
  const { mimeType, filename, size = 0 } = fileInfo;

  return {
    // 基础配置
    ...getFileConfig(mimeType, filename),

    // 显示信息
    displayInfo: getFileDisplayInfo(mimeType, filename, size),

    // 调试信息
    debug: getDebugInfo(mimeType, filename),
  };
}

/**
 * 批量分析文件列表
 * @param {Array} fileList - 文件信息数组
 * @returns {Array} 分析结果数组
 */
export function analyzeFileList(fileList) {
  return fileList.map((fileInfo) => analyzeFile(fileInfo));
}

/**
 * 根据文件列表获取类型统计
 * @param {Array} fileList - 文件信息数组
 * @returns {Object} 类型统计对象
 */
export function getFileListStats(fileList) {
  const stats = {
    total: fileList.length,
    byGroup: {},
    byPreviewType: {},
    totalSize: 0,
    previewableCount: 0,
    mediaFileCount: 0,
    documentFileCount: 0,
    codeFileCount: 0,
    archiveFileCount: 0,
  };

  fileList.forEach((fileInfo) => {
    const { mimeType, filename, size = 0 } = fileInfo;
    const config = getFileConfig(mimeType, filename);

    // 按分组统计
    stats.byGroup[config.group] = (stats.byGroup[config.group] || 0) + 1;

    // 按预览类型统计
    stats.byPreviewType[config.previewType] = (stats.byPreviewType[config.previewType] || 0) + 1;

    // 总大小
    stats.totalSize += size;

    // 功能统计
    if (canPreview(mimeType, filename)) stats.previewableCount++;
    if (isImage(mimeType, filename) || isVideo(mimeType, filename) || isAudio(mimeType, filename)) stats.mediaFileCount++;
    if (config.group === FILE_GROUPS.PDF || config.group === FILE_GROUPS.OFFICE || config.group === FILE_GROUPS.TEXT) stats.documentFileCount++;
    if (isCode(mimeType, filename) || config.group === FILE_GROUPS.CONFIG) stats.codeFileCount++;
    if (isArchive(mimeType, filename)) stats.archiveFileCount++;
  });

  // 格式化总大小
  stats.formattedTotalSize = formatFileSize(stats.totalSize);

  return stats;
}

/**
 * 快速检测文件类型（简化版API）
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {Object} 简化的类型信息
 */
export function quickDetect(mimeType, filename = "") {
  const config = getFileConfig(mimeType, filename);

  return {
    group: config.group,
    displayName: config.displayName,
    icon: config.icon,
    previewType: config.previewType,
    canPreview: canPreview(mimeType, filename),
    colorTheme: getFileColorTheme(mimeType, filename),
    detectionMethod: config.detectionMethod,
  };
}

/**
 * 检查文件是否属于指定类型
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名
 * @param {string|Array} types - 要检查的类型（可以是单个类型或类型数组）
 * @returns {boolean} 是否属于指定类型
 */
export function isFileType(mimeType, filename, types) {
  const group = getFileGroup(mimeType, filename);
  const previewType = getPreviewType(mimeType, filename);

  const typesToCheck = Array.isArray(types) ? types : [types];

  return typesToCheck.some(
    (type) =>
      group === type ||
      previewType === type ||
      // 支持一些常用的别名
      (type === "media" && (isImage(mimeType, filename) || isVideo(mimeType, filename) || isAudio(mimeType, filename))) ||
      (type === "document" && (group === FILE_GROUPS.PDF || group === FILE_GROUPS.OFFICE || group === FILE_GROUPS.TEXT)) ||
      (type === "editable" && (isText(mimeType, filename) || isCode(mimeType, filename)))
  );
}

/**
 * 过滤文件列表
 * @param {Array} fileList - 文件信息数组
 * @param {Object} filters - 过滤条件
 * @returns {Array} 过滤后的文件列表
 */
export function filterFileList(fileList, filters = {}) {
  return fileList.filter((fileInfo) => {
    const { mimeType, filename } = fileInfo;

    // 按分组过滤
    if (filters.groups && filters.groups.length > 0) {
      const group = getFileGroup(mimeType, filename);
      if (!filters.groups.includes(group)) return false;
    }

    // 按预览类型过滤
    if (filters.previewTypes && filters.previewTypes.length > 0) {
      const previewType = getPreviewType(mimeType, filename);
      if (!filters.previewTypes.includes(previewType)) return false;
    }

    // 按是否可预览过滤
    if (filters.previewable !== undefined) {
      if (canPreview(mimeType, filename) !== filters.previewable) return false;
    }

    // 按文件大小过滤
    if (filters.minSize !== undefined && fileInfo.size < filters.minSize) return false;
    if (filters.maxSize !== undefined && fileInfo.size > filters.maxSize) return false;

    // 按扩展名过滤
    if (filters.extensions && filters.extensions.length > 0) {
      const extension = getFileExtension(filename);
      if (!filters.extensions.includes(extension)) return false;
    }

    return true;
  });
}
