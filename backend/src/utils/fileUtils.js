/**
 * 文件处理相关工具函数
 */

/**
 * 获取文件的扩展名（小写）
 * @param {string} filename - 文件名
 * @returns {string} 文件扩展名（小写）
 */
export function getFileExtension(filename) {
  if (!filename) return "";
  return filename.split(".").pop().toLowerCase();
}

/**
 * 获取文件的MIME类型
 * @param {string} filename - 文件名
 * @returns {string} MIME类型
 */
export function getMimeType(filename) {
  if (!filename) return "application/octet-stream";

  const ext = getFileExtension(filename);

  const mimeMap = {
    // 图片
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    bmp: "image/bmp",
    tiff: "image/tiff",
    tif: "image/tiff",
    heic: "image/heic",
    avif: "image/avif",

    // 文档
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    odt: "application/vnd.oasis.opendocument.text",
    ods: "application/vnd.oasis.opendocument.spreadsheet",
    odp: "application/vnd.oasis.opendocument.presentation",
    rtf: "application/rtf",

    // 文本
    txt: "text/plain",
    html: "text/html",
    htm: "text/html",
    css: "text/css",
    csv: "text/csv",
    js: "text/javascript",
    jsx: "text/javascript",
    ts: "text/typescript",
    tsx: "text/typescript",
    json: "application/json",
    xml: "application/xml",
    md: "text/markdown",
    markdown: "text/markdown",

    // 配置文件
    yml: "text/yaml",
    yaml: "text/yaml",
    toml: "application/toml",
    ini: "text/plain",
    conf: "text/plain",
    env: "text/plain",

    // 音频
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    flac: "audio/flac",
    m4a: "audio/mp4",
    aac: "audio/aac",

    // 视频
    mp4: "video/mp4",
    webm: "video/webm",
    avi: "video/x-msvideo",
    mov: "video/quicktime",
    wmv: "video/x-ms-wmv",
    flv: "video/x-flv",
    mkv: "video/x-matroska",
    "3gp": "video/3gpp",

    // 压缩
    zip: "application/zip",
    rar: "application/vnd.rar",
    tar: "application/x-tar",
    gz: "application/gzip",
    "7z": "application/x-7z-compressed",
    bz2: "application/x-bzip2",
    xz: "application/x-xz",

    // 可执行文件
    exe: "application/x-msdownload",
    dll: "application/x-msdownload",
    apk: "application/vnd.android.package-archive",
    dmg: "application/x-apple-diskimage",
    deb: "application/vnd.debian.binary-package",
    rpm: "application/x-rpm",
    msi: "application/x-msi",

    // 字体
    ttf: "font/ttf",
    otf: "font/otf",
    woff: "font/woff",
    woff2: "font/woff2",
    eot: "application/vnd.ms-fontobject",

    // 3D模型
    obj: "model/obj",
    stl: "model/stl",
    gltf: "model/gltf+json",
    glb: "model/gltf-binary",

    // 设计文件
    psd: "image/vnd.adobe.photoshop",
    ai: "application/postscript",
    xd: "application/vnd.adobe.xd",
    sketch: "application/octet-stream",
    fig: "application/octet-stream",

    // 电子书
    epub: "application/epub+zip",
    mobi: "application/x-mobipocket-ebook",
    azw3: "application/vnd.amazon.ebook",

    // 数据库
    db: "application/x-sqlite3",
    sqlite: "application/x-sqlite3",
    sql: "application/sql",
    mdb: "application/x-msaccess",
    accdb: "application/x-msaccess",

    // 代码文件
    go: "text/x-go",
    rs: "text/x-rust",
    rb: "text/x-ruby",
    py: "text/x-python",
    java: "text/x-java",
    c: "text/x-c",
    cpp: "text/x-c++",
    cs: "text/x-csharp",
    php: "text/x-php",
    swift: "text/x-swift",
    kt: "text/x-kotlin",
    dart: "text/x-dart",
    scala: "text/x-scala",
    clj: "text/x-clojure",
    lua: "text/x-lua",
    r: "text/x-r",
    pl: "text/x-perl",
    sh: "text/x-sh",
    bash: "text/x-bash",
    zsh: "text/x-zsh",
    fish: "text/x-fish",
    vue: "text/x-vue",

    // 其他
    bin: "application/octet-stream",
    dat: "application/octet-stream",
    log: "text/plain",
    iso: "application/x-iso9660-image",
  };

  return mimeMap[ext] || "application/octet-stream";
}

/**
 * 主要MIME类型分组
 * @type {Object}
 */
export const MIME_GROUPS = {
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
  DOCUMENT: "document",
  SPREADSHEET: "spreadsheet",
  PRESENTATION: "presentation",
  PDF: "pdf",
  MARKDOWN: "markdown",
  ARCHIVE: "archive",
  CODE: "code",
  CONFIG: "config",
  TEXT: "text",
  DATABASE: "database",
  FONT: "font",
  EXECUTABLE: "executable",
  DESIGN: "design",
  EBOOK: "ebook",
  UNKNOWN: "unknown",
};

/**
 * 文件扩展名到文件类型的映射
 * @type {Object}
 */
export const EXTENSION_TO_TYPE_MAP = {
  // 图片
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  bmp: "image",
  ico: "image",
  heic: "image",
  avif: "image",

  // 文档
  doc: "document",
  docx: "document",
  rtf: "document",
  txt: "text",
  odt: "document", // OpenDocument文本

  // 表格
  xls: "spreadsheet",
  xlsx: "spreadsheet",
  csv: "spreadsheet",
  ods: "spreadsheet", // OpenDocument表格

  // 演示文稿
  ppt: "presentation",
  pptx: "presentation",
  odp: "presentation", // OpenDocument演示

  // PDF
  pdf: "pdf",

  // Markdown
  md: "markdown",
  markdown: "markdown",

  // 压缩文件
  zip: "archive",
  rar: "archive",
  "7z": "archive",
  tar: "archive",
  gz: "archive",
  bz2: "archive",
  xz: "archive",

  // 配置文件
  yml: "config",
  yaml: "config",
  toml: "config",
  ini: "config",
  conf: "config",
  env: "config",
  json: "config",
  xml: "config",

  // 代码文件
  html: "code",
  css: "code",
  js: "code",
  jsx: "code",
  ts: "code",
  tsx: "code",
  go: "code",
  rs: "code", // Rust
  rb: "code", // Ruby
  py: "code", // Python
  java: "code",
  c: "code",
  cpp: "code", // C++
  cs: "code", // C#
  php: "code",
  swift: "code",
  kt: "code", // Kotlin
  dart: "code",
  scala: "code",
  clj: "code", // Clojure
  lua: "code",
  r: "code", // R语言
  pl: "code", // Perl
  sh: "code", // Shell
  bash: "code",
  zsh: "code",
  fish: "code",
  vue: "code", // Vue

  // 音频
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  flac: "audio",
  aac: "audio",
  m4a: "audio",

  // 视频
  mp4: "video",
  webm: "video",
  avi: "video",
  mov: "video",
  wmv: "video",
  mkv: "video",
  flv: "video",
  m4v: "video",
  "3gp": "video",

  // 数据库
  db: "database",
  sqlite: "database",
  sql: "database",
  mdb: "database", // Microsoft Access
  accdb: "database", // Microsoft Access

  // 字体
  ttf: "font",
  woff: "font",
  woff2: "font",
  eot: "font",
  otf: "font",

  // 可执行文件
  exe: "executable",
  msi: "executable",
  apk: "executable",
  dmg: "executable", // macOS安装镜像
  deb: "executable", // Debian软件包
  rpm: "executable", // RedHat软件包

  // 设计文件
  psd: "design",
  ai: "design",
  xd: "design", // Adobe XD
  sketch: "design", // Sketch
  fig: "design", // Figma

  // 电子书
  epub: "ebook",
  mobi: "ebook",
  azw3: "ebook", // Kindle

  // 其他
  log: "text", // 日志文件
};

/**
 * 文件类型到MIME类型的映射
 * @type {Object}
 */
export const FILE_TYPE_TO_MIME_TYPE_MAP = {
  image: "image/jpeg",
  document: "application/msword",
  pdf: "application/pdf",
  text: "text/plain",
  code: "text/plain",
  archive: "application/zip",
  audio: "audio/mpeg",
  video: "video/mp4",
  spreadsheet: "application/vnd.ms-excel",
  presentation: "application/vnd.ms-powerpoint",
  markdown: "text/markdown",
  config: "application/json",
  executable: "application/octet-stream",
  database: "application/x-sqlite3",
  font: "font/ttf",
  design: "image/vnd.adobe.photoshop",
  ebook: "application/epub+zip",
};

/**
 * 从文件扩展名推断文件类型
 * @param {string} extension - 文件扩展名
 * @returns {string|null} 文件类型或null（未知类型）
 */
export function getFileTypeFromExtension(extension) {
  if (!extension) return null;
  const ext = extension.toLowerCase();
  return EXTENSION_TO_TYPE_MAP[ext] || null;
}

/**
 * 将文件类型转换为MIME类型
 * @param {string} fileType - 文件类型（如"image", "document", "pdf"等）
 * @returns {string|null} MIME类型或null
 */
export function fileTypeToMimeType(fileType) {
  return FILE_TYPE_TO_MIME_TYPE_MAP[fileType] || null;
}

/**
 * 从文件名推断MIME类型
 * @param {string} filename - 文件名
 * @returns {string} 推断的MIME类型
 */
export function getMimeTypeFromFilename(filename) {
  const ext = getFileExtension(filename);

  // 直接处理特殊扩展名情况，确保返回正确的MIME类型
  const specialExtensions = {
    toml: "application/toml",
    yml: "text/yaml",
    yaml: "text/yaml",
    html: "text/html",
    htm: "text/html",
  };

  // 如果是特殊扩展名，直接返回对应的MIME类型
  if (specialExtensions[ext]) {
    return specialExtensions[ext];
  }

  // 其他情况按原流程处理
  const fileType = getFileTypeFromExtension(ext);
  const mimeType = fileType ? fileTypeToMimeType(fileType) || getMimeType(filename) : getMimeType(filename);
  return mimeType;
}

/**
 * 根据MIME类型获取文件类型分组
 * @param {string} mimeType - MIME类型
 * @returns {string} 分组名称
 */
export function getMimeTypeGroup(mimeType) {
  if (!mimeType) return MIME_GROUPS.UNKNOWN;

  // 通用类型处理（基于前缀）
  const prefix = mimeType.split("/")[0];
  if (prefix === "image") return MIME_GROUPS.IMAGE;
  if (prefix === "video") return MIME_GROUPS.VIDEO;
  if (prefix === "audio") return MIME_GROUPS.AUDIO;
  if (prefix === "text") return MIME_GROUPS.TEXT;

  // 特定类型处理
  if (mimeType === "application/pdf") return MIME_GROUPS.PDF;
  if (mimeType === "text/markdown") return MIME_GROUPS.MARKDOWN;
  if (mimeType.includes("word") || mimeType.includes("opendocument.text")) return MIME_GROUPS.DOCUMENT;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType === "text/csv") return MIME_GROUPS.SPREADSHEET;
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return MIME_GROUPS.PRESENTATION;
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar") || mimeType.includes("compressed")) return MIME_GROUPS.ARCHIVE;
  if (mimeType.includes("json") || mimeType.includes("xml") || mimeType.includes("yaml") || mimeType.includes("toml")) return MIME_GROUPS.CONFIG;
  if (mimeType.includes("font") || mimeType.includes("woff")) return MIME_GROUPS.FONT;
  if (mimeType.includes("msdownload") || mimeType.includes("android.package")) return MIME_GROUPS.EXECUTABLE;
  if (mimeType.includes("sqlite") || mimeType.includes("sql")) return MIME_GROUPS.DATABASE;

  // 特殊处理 application/octet-stream
  if (mimeType === "application/octet-stream") {
    return MIME_GROUPS.EXECUTABLE; // 默认为可执行文件
  }

  return MIME_GROUPS.UNKNOWN;
}

/**
 * 检查MIME类型是否为图片
 * @param {string} mimeType - MIME类型
 * @returns {boolean} 是否为图片
 */
export function isImageType(mimeType) {
  return getMimeTypeGroup(mimeType) === MIME_GROUPS.IMAGE;
}

/**
 * 检查MIME类型是否为视频
 * @param {string} mimeType - MIME类型
 * @returns {boolean} 是否为视频
 */
export function isVideoType(mimeType) {
  return getMimeTypeGroup(mimeType) === MIME_GROUPS.VIDEO;
}

/**
 * 检查MIME类型是否为音频
 * @param {string} mimeType - MIME类型
 * @returns {boolean} 是否为音频
 */
export function isAudioType(mimeType) {
  return getMimeTypeGroup(mimeType) === MIME_GROUPS.AUDIO;
}

/**
 * 检查MIME类型是否为文档（包括文本、PDF等）
 * @param {string} mimeType - MIME类型
 * @returns {boolean} 是否为文档
 */
export function isDocumentType(mimeType) {
  const group = getMimeTypeGroup(mimeType);
  return group === MIME_GROUPS.DOCUMENT || group === MIME_GROUPS.PDF || group === MIME_GROUPS.MARKDOWN || group === MIME_GROUPS.TEXT;
}

/**
 * 检查是否为配置文件类型
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {boolean} 是否为配置文件类型
 */
export function isConfigType(mimeType, filename) {
  // 先通过MIME类型检查
  const mimeGroup = getMimeTypeGroup(mimeType);
  if (mimeGroup === MIME_GROUPS.CONFIG) {
    return true;
  }

  // 如果通过MIME类型未识别，再通过文件扩展名检查
  if (filename) {
    const ext = getFileExtension(filename);
    // 扩展常见配置文件扩展名列表
    const configExtensions = [
      // 标准配置格式
      "json",
      "xml",
      "yml",
      "yaml",
      "toml",
      "ini",
      "conf",
      "env",
      // 特定应用配置
      "properties",
      "cfg",
      "config",
      "rc",
      "cnf",
      "settings",
      // 特定技术栈
      "jsonc",
      "json5",
      "eslintrc",
      "prettierrc",
      "babelrc",
      "stylelintrc",
      // 其他
      "lock",
      "manifest",
      "plist",
    ];
    return configExtensions.includes(ext);
  }

  return false;
}

/**
 * 检查文件在预览时是否应该使用text/plain作为Content-Type
 * @param {string} contentType - 内容MIME类型
 * @param {string} filename - 文件名
 * @returns {boolean} 是否应该使用text/plain预览
 */
export function shouldUseTextPlainForPreview(contentType, filename) {
  if (!filename) return false;

  // 如果是已知的配置文件类型
  if (isConfigType(contentType, filename)) {
    return true;
  }

  // 检查文件扩展名
  const ext = getFileExtension(filename);
  if (!ext) return false;

  // 应该使用text/plain预览的文件扩展名集合
  // 1. 各种配置文件格式
  // 2. 不常见但仍是配置类的文件
  // 3. 浏览器可能无法正确解析但应该以文本形式查看的文件类型
  const textPlainPreviewExtensions = [
    // 配置文件格式
    "toml",
    "yaml",
    "yml",
    "json",
    "xml",
    "ini",
    "conf",
    "properties",
    "env",
    "cfg",
    "config",
    "rc",
    "cnf",
    "settings",
    // 特定技术栈配置
    "jsonc",
    "json5",
    "eslintrc",
    "prettierrc",
    "babelrc",
    "stylelintrc",
    // 其他可能需要text/plain预览的格式
    "lock",
    "manifest",
    "plist",
    // 特殊类型
    "csv",
    "tsv",
    "log",
  ];

  return textPlainPreviewExtensions.includes(ext.toLowerCase());
}

/**
 * 获取文件的正确MIME类型和分组信息
 * @param {Object} fileInfo - 文件信息对象
 * @param {string} fileInfo.filename - 文件名
 * @param {string} fileInfo.mimetype - MIME类型（可选，如果未提供或为通用类型，会尝试从文件名推断）
 * @returns {Object} 包含正确MIME类型和分组的对象
 */
export function getMimeTypeAndGroupFromFile(fileInfo) {
  const { filename, mimetype: originalMimeType = "application/octet-stream" } = fileInfo;

  // 记录原始MIME类型
  let resultMimeType = originalMimeType;

  // 检查是否为通用MIME类型或未指定 (application/octet-stream 或 text/plain)
  const isGenericMimeType = originalMimeType === "application/octet-stream" || originalMimeType === "text/plain";

  // 如果是通用MIME类型，尝试从文件名推断
  if (isGenericMimeType && filename) {
    const inferredMimeType = getMimeType(filename);

    // 仅当推断的MIME类型不是通用类型时才使用推断的类型
    if (inferredMimeType !== "application/octet-stream") {
      resultMimeType = inferredMimeType;
    }
  }

  // 获取MIME分组
  const mimeGroup = getMimeTypeGroup(resultMimeType);

  // 如果分组仍是UNKNOWN或EXECUTABLE，且是通用MIME类型，再次检查文件扩展名
  if ((mimeGroup === MIME_GROUPS.UNKNOWN || mimeGroup === MIME_GROUPS.EXECUTABLE) && filename) {
    const ext = getFileExtension(filename);

    // 处理特殊类型的配置文件
    const configMimeTypes = {
      yml: "text/yaml",
      yaml: "text/yaml",
      xml: "application/xml",
      json: "application/json",
      toml: "application/toml",
      ini: "text/plain",
      conf: "text/plain",
      env: "text/plain",
    };

    if (configMimeTypes[ext]) {
      resultMimeType = configMimeTypes[ext];
      // 重新获取MIME分组
      const updatedMimeGroup = getMimeTypeGroup(resultMimeType);

      return {
        mimeType: resultMimeType,
        mimeGroup: updatedMimeGroup,
        wasRefined: resultMimeType !== originalMimeType,
      };
    }
  }

  return {
    mimeType: resultMimeType,
    mimeGroup,
    wasRefined: resultMimeType !== originalMimeType,
  };
}

/**
 * 获取文件的内容类型和内容处置信息
 * @param {Object} options - 配置选项
 * @param {string} options.filename - 文件名
 * @param {string} options.mimetype - MIME类型
 * @param {boolean} options.forceDownload - 是否强制下载
 * @returns {Object} 包含contentType和contentDisposition的对象
 */
export function getContentTypeAndDisposition(options) {
  const { filename, mimetype = "application/octet-stream", forceDownload = false } = options;

  // 获取文件扩展名
  const ext = getFileExtension(filename);

  // 判断是否为HTML文件
  const isHtmlFile = ext === "html" || ext === "htm" || mimetype === "text/html";

  // 检查是否应该使用text/plain预览
  const shouldUseTextPlain = shouldUseTextPlainForPreview(mimetype, filename) && !isHtmlFile;

  // 获取MIME分组
  const mimeGroup = getMimeTypeGroup(mimetype);

  // 判断其他特殊文件类型
  const isPdf = mimetype === "application/pdf";
  const isTextBased = mimeGroup === MIME_GROUPS.TEXT || mimeGroup === MIME_GROUPS.CODE || mimeGroup === MIME_GROUPS.MARKDOWN;
  const isMedia = mimeGroup === MIME_GROUPS.IMAGE || mimeGroup === MIME_GROUPS.VIDEO || mimeGroup === MIME_GROUPS.AUDIO;

  let contentType;
  let contentDisposition;

  // 如果强制下载，设置为attachment
  if (forceDownload) {
    contentDisposition = `attachment; filename="${encodeURIComponent(filename)}"`;
    contentType = mimetype;
  } else {
    // 非强制下载模式（预览模式）
    contentDisposition = `inline; filename="${encodeURIComponent(filename)}"`;

    // 根据文件类型设置不同的Content-Type
    if (isHtmlFile) {
      // HTML文件特殊处理，确保使用text/html
      contentType = "text/html; charset=UTF-8";
      console.log(`getContentTypeAndDisposition: HTML文件[${filename}]使用内容类型[${contentType}]`);
    } else if (shouldUseTextPlain) {
      // 对于应该使用text/plain预览的文件
      contentType = "text/plain; charset=UTF-8";
      console.log(`getContentTypeAndDisposition: 文件[${filename}]使用text/plain预览`);
    } else if (isTextBased) {
      // 文本类型添加charset=UTF-8
      contentType = `${mimetype}; charset=UTF-8`;
      console.log(`getContentTypeAndDisposition: 文本文件[${filename}]添加charset`);
    } else {
      // 其他类型保持原始Content-Type
      contentType = mimetype;
    }
  }

  return {
    contentType,
    contentDisposition,
  };
}
