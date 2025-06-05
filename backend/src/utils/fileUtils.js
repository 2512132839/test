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

  // 直接调用getMimeTypeFromFilename获取MIME类型
  return getMimeTypeFromFilename(filename);
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
 * 统一的扩展名到MIME类型的映射表
 * @type {Object}
 */
export const UNIFIED_MIME_MAP = {
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
  jfif: "image/jpeg",
  jpe: "image/jpeg",
  pjpeg: "image/jpeg",
  pjp: "image/jpeg",
  jxl: "image/jxl",
  raw: "image/x-canon-cr2",
  cr2: "image/x-canon-cr2",
  nef: "image/x-nikon-nef",
  arw: "image/x-sony-arw",
  dng: "image/x-adobe-dng",

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
  properties: "text/plain",
  cfg: "text/plain",
  config: "text/plain",
  rc: "text/plain",
  cnf: "text/plain",
  settings: "text/plain",
  jsonc: "application/json",
  json5: "application/json",
  eslintrc: "text/plain",
  prettierrc: "text/plain",
  babelrc: "text/plain",
  stylelintrc: "text/plain",
  lock: "text/plain",
  manifest: "text/plain",
  plist: "text/plain",

  // 音频
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wma: "audio/x-ms-wma",
  opus: "audio/opus",
  ape: "audio/x-ape",
  alac: "audio/x-alac",
  dsd: "audio/dsd",
  dsf: "audio/dsf",
  dff: "audio/x-dff",
  mid: "audio/midi",
  midi: "audio/midi",
  kar: "audio/midi",
  ra: "audio/x-realaudio",
  ram: "audio/x-pn-realaudio",
  au: "audio/basic",
  snd: "audio/basic",

  // 视频
  mp4: "video/mp4",
  webm: "video/webm",
  avi: "video/x-msvideo",
  mov: "video/quicktime",
  wmv: "video/x-ms-wmv",
  flv: "video/x-flv",
  mkv: "video/x-matroska",
  "3gp": "video/3gpp",
  "3g2": "video/3gpp2",
  m4v: "video/x-m4v",
  mpg: "video/mpeg",
  mpeg: "video/mpeg",
  mpe: "video/mpeg",
  ogv: "video/ogg",
  vob: "video/x-ms-vob",
  asf: "video/x-ms-asf",
  rm: "video/x-pn-realvideo",
  rmvb: "video/x-pn-realvideo",
  f4v: "video/x-f4v",
  m2ts: "video/mp2t",
  mts: "video/mp2t",
  divx: "video/divx",
  xvid: "video/x-msvideo",

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
  cxx: "text/x-c++",
  cc: "text/x-c++",
  h: "text/x-c",
  hpp: "text/x-c++",
  hxx: "text/x-c++",
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
  sass: "text/x-sass",
  scss: "text/x-scss",
  less: "text/x-less",
  styl: "text/x-stylus",
  coffee: "text/x-coffeescript",
  elm: "text/x-elm",
  haskell: "text/x-haskell",
  hs: "text/x-haskell",
  ml: "text/x-ocaml",
  fs: "text/x-fsharp",
  vb: "text/x-vb",
  pas: "text/x-pascal",
  asm: "text/x-asm",
  s: "text/x-asm",
  bat: "text/x-msdos-batch",
  cmd: "text/x-msdos-batch",
  ps1: "text/x-powershell",
  psm1: "text/x-powershell",
  psd1: "text/x-powershell",

  // 其他常见文件类型
  bin: "application/octet-stream",
  dat: "application/octet-stream",
  log: "text/plain",
  iso: "application/x-iso9660-image",
  img: "application/x-img",
  vhd: "application/x-virtualbox-vhd",
  vmdk: "application/x-virtualbox-vmdk",
  ova: "application/x-virtualbox-ova",
  ovf: "application/x-virtualbox-ovf",

  // 证书和密钥文件
  crt: "application/x-x509-ca-cert",
  cer: "application/x-x509-ca-cert",
  pem: "application/x-pem-file",
  key: "application/x-pem-file",
  p12: "application/x-pkcs12",
  pfx: "application/x-pkcs12",
  jks: "application/x-java-keystore",

  // 数据交换格式
  protobuf: "application/x-protobuf",
  proto: "text/x-proto",
  avro: "application/avro",
  parquet: "application/x-parquet",

  // 配置和脚本文件
  dockerfile: "text/x-dockerfile",
  makefile: "text/x-makefile",
  cmake: "text/x-cmake",
  gradle: "text/x-gradle",
  ant: "text/xml",

  // 文档格式
  tex: "text/x-tex",
  bib: "text/x-bibtex",
  rst: "text/x-rst",
  adoc: "text/x-asciidoc",
  org: "text/x-org",

  // 数据文件
  tsv: "text/tab-separated-values",
  psv: "text/psv",
  ndjson: "application/x-ndjson",
  jsonl: "application/x-ndjson",
};

/**
 * 从文件名推断MIME类型
 * @param {string} filename - 文件名
 * @returns {string} 推断的MIME类型
 */
export function getMimeTypeFromFilename(filename) {
  // 获取文件扩展名（小写）
  const ext = getFileExtension(filename);

  // 使用统一的MIME类型映射表
  const mimeType = UNIFIED_MIME_MAP[ext] || "application/octet-stream";

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
 * 检查文件是否为Office文件类型
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {boolean} 是否为Office文件
 */
export function isOfficeFile(mimeType, filename) {
  const mime = (mimeType || "").toLowerCase();
  const name = (filename || "").toLowerCase();

  // 通过MIME类型检查
  if (
      mime.includes("wordprocessing") ||
      mime.includes("spreadsheet") ||
      mime.includes("presentation") ||
      mime === "application/msword" ||
      mime === "application/vnd.ms-excel" ||
      mime === "application/vnd.ms-powerpoint"
  ) {
    return true;
  }

  // 通过文件扩展名检查
  if (
      name.endsWith(".doc") ||
      name.endsWith(".docx") ||
      name.endsWith(".xls") ||
      name.endsWith(".xlsx") ||
      name.endsWith(".ppt") ||
      name.endsWith(".pptx") ||
      name.endsWith(".odt") ||
      name.endsWith(".ods") ||
      name.endsWith(".odp")
  ) {
    return true;
  }

  return false;
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
    } else if (shouldUseTextPlain) {
      // 对于应该使用text/plain预览的文件
      contentType = "text/plain; charset=UTF-8";
    } else if (isTextBased) {
      // 文本类型添加charset=UTF-8
      contentType = `${mimetype}; charset=UTF-8`;
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

/**
 * 获取文件的正确MIME类型和分组信息
 * @param {Object} fileInfo - 文件信息对象
 * @param {string} fileInfo.filename - 文件名
 * @param {string} fileInfo.mimetype - MIME类型（可选，如果未提供或为通用类型，会尝试从文件名推断）
 * @returns {Object} 包含正确MIME类型和分组的对象
 */
export function getMimeTypeAndGroupFromFile(fileInfo) {
  const { filename, mimetype: originalMimeType = "application/octet-stream" } = fileInfo;

  // 统一从文件名推断MIME类型，不依赖传入的mimetype参数
  let resultMimeType = "application/octet-stream";

  if (filename) {
    resultMimeType = getMimeTypeFromFilename(filename);
    console.log(`getMimeTypeAndGroupFromFile：从文件名[${filename}]推断MIME类型: ${resultMimeType}`);
  }

  // 获取MIME分组
  const mimeGroup = getMimeTypeGroup(resultMimeType);

  return {
    mimeType: resultMimeType,
    mimeGroup,
    wasRefined: resultMimeType !== originalMimeType,
  };
}
