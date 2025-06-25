// MIME类型工具函数
// 提供统一的MIME类型处理、格式化和分类功能

// 主要MIME类型分组
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
  MODEL: "model",
  CERTIFICATE: "certificate",
  DATA: "data",
  UNKNOWN: "unknown",
};

// MIME类型到分组的映射
export const MIME_TYPE_TO_GROUP = {
  // 特定类型映射
  "text/markdown": MIME_GROUPS.MARKDOWN,
  "application/pdf": MIME_GROUPS.PDF,

  // 文档类型
  "application/msword": MIME_GROUPS.DOCUMENT,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": MIME_GROUPS.DOCUMENT,
  "application/rtf": MIME_GROUPS.DOCUMENT,

  // 电子表格
  "application/vnd.ms-excel": MIME_GROUPS.SPREADSHEET,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": MIME_GROUPS.SPREADSHEET,
  "text/csv": MIME_GROUPS.SPREADSHEET,

  // 演示文稿
  "application/vnd.ms-powerpoint": MIME_GROUPS.PRESENTATION,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": MIME_GROUPS.PRESENTATION,

  // 压缩文件
  "application/zip": MIME_GROUPS.ARCHIVE,
  "application/x-zip-compressed": MIME_GROUPS.ARCHIVE,
  "application/x-rar-compressed": MIME_GROUPS.ARCHIVE,
  "application/x-7z-compressed": MIME_GROUPS.ARCHIVE,
  "application/x-tar": MIME_GROUPS.ARCHIVE,
  "application/gzip": MIME_GROUPS.ARCHIVE,

  // 文本和代码
  "text/plain": MIME_GROUPS.TEXT,
  "text/html": MIME_GROUPS.CODE,
  "text/css": MIME_GROUPS.CODE,
  "application/javascript": MIME_GROUPS.CODE,
  "application/typescript": MIME_GROUPS.CODE,

  // 配置文件
  "application/json": MIME_GROUPS.CONFIG,
  "application/xml": MIME_GROUPS.CONFIG,
  "text/xml": MIME_GROUPS.CONFIG,
  "text/yaml": MIME_GROUPS.CONFIG,
  "application/x-yaml": MIME_GROUPS.CONFIG,
  "application/yaml": MIME_GROUPS.CONFIG,
  "text/x-ini": MIME_GROUPS.CONFIG,
  "application/x-ini": MIME_GROUPS.CONFIG,
  "application/toml": MIME_GROUPS.CONFIG,
  "application/x-toml": MIME_GROUPS.CONFIG,
  "text/x-properties": MIME_GROUPS.CONFIG,
  "application/x-properties": MIME_GROUPS.CONFIG,

  // 数据库
  "application/x-sqlite3": MIME_GROUPS.DATABASE,

  // 电子书
  "application/epub+zip": MIME_GROUPS.EBOOK,

  // 可执行文件
  "application/x-msdownload": MIME_GROUPS.EXECUTABLE,
  "application/vnd.android.package-archive": MIME_GROUPS.EXECUTABLE,

  // 设计文件
  "image/vnd.adobe.photoshop": MIME_GROUPS.DESIGN,
  "application/postscript": MIME_GROUPS.DESIGN,

  // 字体文件
  "application/vnd.ms-fontobject": MIME_GROUPS.FONT,
  "font/ttf": MIME_GROUPS.FONT,
  "font/woff": MIME_GROUPS.FONT,
  "font/woff2": MIME_GROUPS.FONT,

  // 其他特殊类型
  "application/x-iso9660-image": MIME_GROUPS.ARCHIVE,
};

// MIME子类型到展示名称的映射
export const MIME_SUBTYPE_DISPLAY = {
  IMAGE: {
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
  },
  VIDEO: {
    mp4: "MP4视频",
    webm: "WebM视频",
    "x-msvideo": "AVI视频",
    quicktime: "MOV视频",
    "x-ms-wmv": "WMV视频",
    "x-matroska": "MKV视频",
    "3gpp": "3GP视频",
  },
  AUDIO: {
    mpeg: "MP3音频",
    mp4: "M4A音频",
    wav: "WAV音频",
    ogg: "OGG音频",
    flac: "FLAC无损音频",
    aac: "AAC音频",
  },
};

// 分组到样式类的映射（不同主题）
export const GROUP_TO_STYLE_CLASS = {
  [MIME_GROUPS.MARKDOWN]: {
    dark: "text-emerald-400",
    light: "text-emerald-500",
  },
  [MIME_GROUPS.IMAGE]: {
    dark: "text-pink-400",
    light: "text-pink-500",
  },
  [MIME_GROUPS.VIDEO]: {
    dark: "text-purple-400",
    light: "text-purple-500",
  },
  [MIME_GROUPS.AUDIO]: {
    dark: "text-indigo-400",
    light: "text-indigo-500",
  },
  [MIME_GROUPS.PDF]: {
    dark: "text-red-400",
    light: "text-red-500",
  },
  [MIME_GROUPS.SPREADSHEET]: {
    dark: "text-green-400",
    light: "text-green-500",
  },
  [MIME_GROUPS.DOCUMENT]: {
    dark: "text-blue-400",
    light: "text-blue-500",
  },
  [MIME_GROUPS.PRESENTATION]: {
    dark: "text-orange-400",
    light: "text-orange-500",
  },
  [MIME_GROUPS.ARCHIVE]: {
    dark: "text-yellow-400",
    light: "text-yellow-500",
  },
  [MIME_GROUPS.CODE]: {
    dark: "text-teal-400",
    light: "text-teal-500",
  },
  [MIME_GROUPS.CONFIG]: {
    dark: "text-lime-400",
    light: "text-lime-500",
  },
  [MIME_GROUPS.DATABASE]: {
    dark: "text-cyan-400",
    light: "text-cyan-500",
  },
  [MIME_GROUPS.FONT]: {
    dark: "text-rose-400",
    light: "text-rose-500",
  },
  [MIME_GROUPS.EXECUTABLE]: {
    dark: "text-slate-400",
    light: "text-slate-500",
  },
  [MIME_GROUPS.DESIGN]: {
    dark: "text-violet-400",
    light: "text-violet-500",
  },
  [MIME_GROUPS.EBOOK]: {
    dark: "text-amber-400",
    light: "text-amber-500",
  },
  [MIME_GROUPS.MODEL]: {
    dark: "text-emerald-400",
    light: "text-emerald-500",
  },
  [MIME_GROUPS.CERTIFICATE]: {
    dark: "text-teal-400",
    light: "text-teal-500",
  },
  [MIME_GROUPS.DATA]: {
    dark: "text-sky-400",
    light: "text-sky-500",
  },
  [MIME_GROUPS.UNKNOWN]: {
    dark: "text-gray-400",
    light: "text-gray-500",
  },
};

// 分组到UI背景样式类的映射
export const GROUP_TO_BG_CLASS = {
  [MIME_GROUPS.MARKDOWN]: {
    dark: "bg-emerald-900 text-emerald-200",
    light: "bg-emerald-100 text-emerald-800",
  },
  [MIME_GROUPS.IMAGE]: {
    dark: "bg-blue-900 text-blue-200",
    light: "bg-blue-100 text-blue-800",
  },
  [MIME_GROUPS.VIDEO]: {
    dark: "bg-purple-900 text-purple-200",
    light: "bg-purple-100 text-purple-800",
  },
  [MIME_GROUPS.AUDIO]: {
    dark: "bg-pink-900 text-pink-200",
    light: "bg-pink-100 text-pink-800",
  },
  [MIME_GROUPS.PDF]: {
    dark: "bg-red-900 text-red-200",
    light: "bg-red-100 text-red-800",
  },
  [MIME_GROUPS.SPREADSHEET]: {
    dark: "bg-emerald-900 text-emerald-200",
    light: "bg-emerald-100 text-emerald-800",
  },
  [MIME_GROUPS.DOCUMENT]: {
    dark: "bg-indigo-900 text-indigo-200",
    light: "bg-indigo-100 text-indigo-800",
  },
  [MIME_GROUPS.PRESENTATION]: {
    dark: "bg-amber-900 text-amber-200",
    light: "bg-amber-100 text-amber-800",
  },
  [MIME_GROUPS.ARCHIVE]: {
    dark: "bg-yellow-900 text-yellow-200",
    light: "bg-yellow-100 text-yellow-800",
  },
  [MIME_GROUPS.CODE]: {
    dark: "bg-green-900 text-green-200",
    light: "bg-green-100 text-green-800",
  },
  [MIME_GROUPS.CONFIG]: {
    dark: "bg-lime-900 text-lime-200",
    light: "bg-lime-100 text-lime-800",
  },
  [MIME_GROUPS.DATABASE]: {
    dark: "bg-cyan-900 text-cyan-200",
    light: "bg-cyan-100 text-cyan-800",
  },
  [MIME_GROUPS.FONT]: {
    dark: "bg-rose-900 text-rose-200",
    light: "bg-rose-100 text-rose-800",
  },
  [MIME_GROUPS.EXECUTABLE]: {
    dark: "bg-slate-900 text-slate-200",
    light: "bg-slate-100 text-slate-800",
  },
  [MIME_GROUPS.EBOOK]: {
    dark: "bg-fuchsia-900 text-fuchsia-200",
    light: "bg-fuchsia-100 text-fuchsia-800",
  },
  [MIME_GROUPS.DESIGN]: {
    dark: "bg-sky-900 text-sky-200",
    light: "bg-sky-100 text-sky-800",
  },
  [MIME_GROUPS.MODEL]: {
    dark: "bg-emerald-900 text-emerald-200",
    light: "bg-emerald-100 text-emerald-800",
  },
  [MIME_GROUPS.CERTIFICATE]: {
    dark: "bg-teal-900 text-teal-200",
    light: "bg-teal-100 text-teal-800",
  },
  [MIME_GROUPS.DATA]: {
    dark: "bg-sky-900 text-sky-200",
    light: "bg-sky-100 text-sky-800",
  },
  [MIME_GROUPS.UNKNOWN]: {
    dark: "bg-gray-700 text-gray-300",
    light: "bg-gray-200 text-gray-700",
  },
};

// 分组到展示标签的映射（用于简化显示）
export const GROUP_TO_SIMPLE_LABEL = {
  [MIME_GROUPS.MARKDOWN]: "Markdown",
  [MIME_GROUPS.IMAGE]: "图像",
  [MIME_GROUPS.VIDEO]: "视频",
  [MIME_GROUPS.AUDIO]: "音频",
  [MIME_GROUPS.PDF]: "PDF",
  [MIME_GROUPS.SPREADSHEET]: "表格",
  [MIME_GROUPS.DOCUMENT]: "文档",
  [MIME_GROUPS.PRESENTATION]: "演示",
  [MIME_GROUPS.ARCHIVE]: "压缩",
  [MIME_GROUPS.CODE]: "代码",
  [MIME_GROUPS.CONFIG]: "配置",
  [MIME_GROUPS.TEXT]: "文本",
  [MIME_GROUPS.DATABASE]: "数据库",
  [MIME_GROUPS.FONT]: "字体",
  [MIME_GROUPS.EXECUTABLE]: "可执行文件",
  [MIME_GROUPS.DESIGN]: "设计文件",
  [MIME_GROUPS.EBOOK]: "电子书",
  [MIME_GROUPS.MODEL]: "3D模型",
  [MIME_GROUPS.CERTIFICATE]: "证书",
  [MIME_GROUPS.DATA]: "数据",
  [MIME_GROUPS.UNKNOWN]: "未知",
};

// 文件扩展名到文件类型的映射
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
  jfif: "image",
  jpe: "image",
  pjpeg: "image",
  pjp: "image",
  jxl: "image",
  tiff: "image",
  tif: "image",
  raw: "image",
  cr2: "image",
  nef: "image",
  arw: "image",
  dng: "image",

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
  cxx: "code", // C++
  cc: "code", // C++
  h: "code", // C header
  hpp: "code", // C++ header
  hxx: "code", // C++ header
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
  sass: "code", // Sass
  scss: "code", // SCSS
  less: "code", // Less
  styl: "code", // Stylus
  coffee: "code", // CoffeeScript
  elm: "code", // Elm
  haskell: "code", // Haskell
  hs: "code", // Haskell
  ml: "code", // OCaml
  fs: "code", // F#
  vb: "code", // Visual Basic
  pas: "code", // Pascal
  asm: "code", // Assembly
  s: "code", // Assembly
  bat: "code", // Batch
  cmd: "code", // Command
  ps1: "code", // PowerShell
  psm1: "code", // PowerShell
  psd1: "code", // PowerShell

  // 音频
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  flac: "audio",
  aac: "audio",
  m4a: "audio",
  wma: "audio",
  opus: "audio",
  ape: "audio",
  alac: "audio",
  dsd: "audio",
  dsf: "audio",
  dff: "audio",
  mid: "audio",
  midi: "audio",
  kar: "audio",
  ra: "audio",
  ram: "audio",
  au: "audio",
  snd: "audio",

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
  "3g2": "video",
  mpg: "video",
  mpeg: "video",
  mpe: "video",
  ogv: "video",
  vob: "video",
  asf: "video",
  rm: "video",
  rmvb: "video",
  f4v: "video",
  m2ts: "video",
  mts: "video",
  divx: "video",
  xvid: "video",

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

  // 3D模型
  obj: "model",
  stl: "model",
  gltf: "model",
  glb: "model",

  // 证书文件
  crt: "certificate",
  cer: "certificate",
  pem: "certificate",
  key: "certificate",
  p12: "certificate",
  pfx: "certificate",
  jks: "certificate",

  // 数据格式
  protobuf: "data",
  proto: "data",
  avro: "data",
  parquet: "data",
  tsv: "data",
  psv: "data",
  ndjson: "data",
  jsonl: "data",

  // 文档格式
  tex: "document",
  bib: "document",
  rst: "document",
  adoc: "document",
  org: "document",

  // 虚拟化文件
  iso: "archive",
  img: "archive",
  vhd: "archive",
  vmdk: "archive",
  ova: "archive",
  ovf: "archive",

  // 其他
  log: "text", // 日志文件
  bin: "executable", // 二进制文件
  dat: "data", // 数据文件
};

// 文件类型到MIME类型的映射
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
  model: "model/obj",
  certificate: "application/x-x509-ca-cert",
  data: "application/octet-stream",
};

/**
 * 根据文件名和MIME类型确定文件所属分组
 * 当MIME类型不明确时，会优先使用文件扩展名来判断
 * @param {string} mimeType - 文件的MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {string} 分组名称（从MIME_GROUPS常量）
 */
export const getMimeTypeGroupByFileDetails = (mimeType, filename) => {
  // 对于文件名存在的情况，优先从扩展名判断
  if (filename) {
    const extension = getFileExtension(filename);
    const fileType = getFileTypeFromExtension(extension);

    if (fileType) {
      // 将fileType转换为MIME_GROUPS中的类型
      const groupKey = fileType.toUpperCase();
      if (MIME_GROUPS[groupKey]) {
        return MIME_GROUPS[groupKey];
      }
    }
  }

  // 如果没有MIME类型，且文件名也无法判断，返回未知
  if (!mimeType) return MIME_GROUPS.UNKNOWN;

  // 先尝试通过明确的MIME类型映射获取分组（跳过通用类型如application/octet-stream）
  if (MIME_TYPE_TO_GROUP[mimeType] && mimeType !== "application/octet-stream") {
    return MIME_TYPE_TO_GROUP[mimeType];
  }

  // 特殊处理 application/octet-stream
  if (mimeType === "application/octet-stream") {
    // 如果没有通过文件扩展名判断成功，才默认为可执行文件
    return MIME_GROUPS.EXECUTABLE;
  }

  // 使用通用处理方法
  return getMimeTypeGroup(mimeType);
};

/**
 * 获取MIME类型的分组
 * @param {string} mimeType - 文件的MIME类型
 * @returns {string} 分组名称（从MIME_GROUPS常量）
 */
export const getMimeTypeGroup = (mimeType) => {
  if (!mimeType) return MIME_GROUPS.UNKNOWN;

  // 特定类型处理
  if (MIME_TYPE_TO_GROUP[mimeType]) {
    return MIME_TYPE_TO_GROUP[mimeType];
  }

  // 通用类型处理（基于前缀）
  const prefix = mimeType.split("/")[0];
  if (prefix === "image") return MIME_GROUPS.IMAGE;
  if (prefix === "video") return MIME_GROUPS.VIDEO;
  if (prefix === "audio") return MIME_GROUPS.AUDIO;
  if (prefix === "text") return MIME_GROUPS.TEXT;

  // 特殊类型关键字检测
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
    return MIME_GROUPS.SPREADSHEET;
  }
  if (mimeType.includes("document") || mimeType.includes("word")) {
    return MIME_GROUPS.DOCUMENT;
  }
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) {
    return MIME_GROUPS.PRESENTATION;
  }
  // 配置文件类型检测
  if (
      mimeType.includes("yaml") ||
      mimeType.includes("yml") ||
      mimeType.includes("json") ||
      mimeType.includes("xml") ||
      mimeType.includes("toml") ||
      mimeType.includes("ini") ||
      mimeType.includes("config") ||
      mimeType.includes("properties")
  ) {
    return MIME_GROUPS.CONFIG;
  }
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("compressed") || mimeType.includes("tar") || mimeType.includes("gzip") || mimeType.includes("7z")) {
    return MIME_GROUPS.ARCHIVE;
  }
  if (mimeType.includes("sqlite") || mimeType.includes("db")) {
    return MIME_GROUPS.DATABASE;
  }
  if (mimeType.includes("font") || mimeType.includes("ttf") || mimeType.includes("woff")) {
    return MIME_GROUPS.FONT;
  }
  if (mimeType.includes("msdownload") || mimeType.includes("android.package")) {
    return MIME_GROUPS.EXECUTABLE;
  }

  // 特殊处理 application/octet-stream
  if (mimeType === "application/octet-stream") {
    return MIME_GROUPS.EXECUTABLE; // 默认为可执行文件
  }

  return MIME_GROUPS.UNKNOWN;
};

/**
 * 检查MIME类型是否属于指定的分组
 * @param {string} mimeType - 文件的MIME类型
 * @param {string} groupName - 分组名称（从MIME_GROUPS常量）
 * @param {string} filename - 文件名（可选）
 * @returns {boolean} 是否属于该分组
 */
export const isType = (mimeType, groupName, filename) => {
  return filename ? getMimeTypeGroupByFileDetails(mimeType, filename) === groupName : getMimeTypeGroup(mimeType) === groupName;
};

// 创建类型检测函数的工厂
const createTypeChecker = (groupName) => (mimeType, filename) => isType(mimeType, groupName, filename);

// 使用工厂函数创建类型检测函数
export const isImageType = createTypeChecker(MIME_GROUPS.IMAGE);
export const isVideoType = createTypeChecker(MIME_GROUPS.VIDEO);
export const isAudioType = createTypeChecker(MIME_GROUPS.AUDIO);
export const isPdfType = createTypeChecker(MIME_GROUPS.PDF);
export const isMarkdownType = createTypeChecker(MIME_GROUPS.MARKDOWN);
export const isDocumentType = createTypeChecker(MIME_GROUPS.DOCUMENT);
export const isSpreadsheetType = createTypeChecker(MIME_GROUPS.SPREADSHEET);
export const isPresentationType = createTypeChecker(MIME_GROUPS.PRESENTATION);
export const isArchiveType = createTypeChecker(MIME_GROUPS.ARCHIVE);
export const isCodeType = createTypeChecker(MIME_GROUPS.CODE);
export const isDatabaseType = createTypeChecker(MIME_GROUPS.DATABASE);
export const isFontType = createTypeChecker(MIME_GROUPS.FONT);
export const isExecutableType = createTypeChecker(MIME_GROUPS.EXECUTABLE);
export const isTextType = createTypeChecker(MIME_GROUPS.TEXT);
export const isConfigType = createTypeChecker(MIME_GROUPS.CONFIG);

/**
 * 格式化MIME类型为详细可读的文件类型
 * @param {string} mimeType - 文件的MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {string} 格式化后的文件类型
 */
export const formatMimeType = (mimeType, filename) => {
  if (!mimeType) return "未知类型";

  const group = filename ? getMimeTypeGroupByFileDetails(mimeType, filename) : getMimeTypeGroup(mimeType);

  // 特定类型处理
  if (group === MIME_GROUPS.PDF) return "PDF文档";
  if (group === MIME_GROUPS.MARKDOWN) return "Markdown文档";

  // 子类型处理（针对图片/视频/音频等）
  if ([MIME_GROUPS.IMAGE, MIME_GROUPS.VIDEO, MIME_GROUPS.AUDIO].includes(group)) {
    const mainType = mimeType.split("/")[0];
    const subType = mimeType.replace(`${mainType}/`, "");

    const subtypeMap = MIME_SUBTYPE_DISPLAY[group.toUpperCase()];
    if (subtypeMap && subtypeMap[subType]) {
      return subtypeMap[subType];
    }

    // 通用显示格式
    const groupDisplay = GROUP_TO_SIMPLE_LABEL[group];
    return `${groupDisplay}/${subType}`;
  }

  // 文档类型
  if (group === MIME_GROUPS.DOCUMENT) {
    if (mimeType.includes("msword") || mimeType.includes("wordprocessingml")) {
      return "Word文档";
    }
    if (mimeType === "text/plain") {
      return "文本文件";
    }
    if (mimeType === "application/rtf") {
      return "RTF富文本";
    }
    return "文档";
  }

  // 电子表格
  if (group === MIME_GROUPS.SPREADSHEET) {
    if (mimeType.includes("excel") || mimeType.includes("spreadsheetml")) {
      return "Excel电子表格";
    }
    if (mimeType === "text/csv") {
      return "CSV表格数据";
    }
    return "电子表格";
  }

  // 演示文稿
  if (group === MIME_GROUPS.PRESENTATION) {
    if (mimeType.includes("powerpoint") || mimeType.includes("presentationml")) {
      return "PowerPoint演示文稿";
    }
    return "演示文稿";
  }

  // 配置文件
  if (group === MIME_GROUPS.CONFIG) {
    if (mimeType.includes("json")) return "JSON配置";
    if (mimeType.includes("yaml") || mimeType.includes("yml")) return "YAML配置";
    if (filename && (filename.endsWith(".yml") || filename.endsWith(".yaml"))) return "YAML配置";
    if (mimeType.includes("xml")) return "XML配置";
    if (mimeType.includes("toml")) return "TOML配置";
    if (mimeType.includes("ini")) return "INI配置";
    if (mimeType.includes("properties")) return "属性配置";
    return "配置文件";
  }

  // 压缩文件
  if (group === MIME_GROUPS.ARCHIVE) {
    if (mimeType.includes("zip")) return "ZIP压缩包";
    if (mimeType.includes("rar")) return "RAR压缩包";
    if (mimeType.includes("7z")) return "7Z压缩包";
    if (mimeType.includes("tar")) return "TAR打包文件";
    if (mimeType.includes("gzip")) return "GZIP压缩文件";
    return "压缩文件";
  }

  // 代码/脚本文件
  if (group === MIME_GROUPS.CODE) {
    if (mimeType === "text/html") return "HTML网页";
    if (mimeType === "text/css") return "CSS样式表";
    if (mimeType === "application/javascript") return "JavaScript脚本";
    if (mimeType === "application/typescript") return "TypeScript脚本";
    return "代码文件";
  }

  // 数据库文件
  if (group === MIME_GROUPS.DATABASE) {
    if (mimeType.includes("sqlite")) return "SQLite数据库";
    return "数据库文件";
  }

  // 其他特殊类型
  if (group === MIME_GROUPS.EBOOK) {
    if (mimeType.includes("epub")) return "EPUB电子书";
    if (mimeType.includes("mobi")) return "Mobi电子书";
    if (filename && filename.toLowerCase().includes("azw")) return "Kindle电子书";
    return "电子书";
  }
  if (group === MIME_GROUPS.DESIGN) {
    if (mimeType.includes("photoshop")) return "PSD设计文件";
    if (mimeType.includes("postscript")) return "AI矢量设计";
    if (filename) {
      const ext = getFileExtension(filename);
      if (ext === "xd") return "Adobe XD设计";
      if (ext === "sketch") return "Sketch设计";
      if (ext === "fig") return "Figma设计";
    }
    return "设计文件";
  }
  if (group === MIME_GROUPS.MODEL) {
    if (filename) {
      const ext = getFileExtension(filename);
      if (ext === "obj") return "OBJ 3D模型";
      if (ext === "stl") return "STL 3D模型";
      if (ext === "gltf") return "glTF 3D模型";
      if (ext === "glb") return "GLB 3D模型";
    }
    return "3D模型文件";
  }
  if (group === MIME_GROUPS.CERTIFICATE) {
    if (filename) {
      const ext = getFileExtension(filename);
      if (ext === "crt" || ext === "cer") return "数字证书";
      if (ext === "pem") return "PEM证书";
      if (ext === "key") return "私钥文件";
      if (ext === "p12" || ext === "pfx") return "PKCS#12证书";
      if (ext === "jks") return "Java密钥库";
    }
    return "证书文件";
  }
  if (group === MIME_GROUPS.DATA) {
    if (filename) {
      const ext = getFileExtension(filename);
      if (ext === "protobuf" || ext === "proto") return "Protocol Buffers";
      if (ext === "avro") return "Apache Avro";
      if (ext === "parquet") return "Apache Parquet";
      if (ext === "tsv") return "制表符分隔值";
      if (ext === "psv") return "管道分隔值";
      if (ext === "ndjson" || ext === "jsonl") return "换行分隔JSON";
    }
    return "数据文件";
  }
  if (group === MIME_GROUPS.EXECUTABLE) {
    if (mimeType.includes("android")) return "APK安卓应用";
    if (mimeType.includes("msdownload")) return "可执行程序";
    if (mimeType === "application/octet-stream") {
      // 如果有文件名，尝试根据扩展名提供更明确的类型
      if (filename) {
        const extension = getFileExtension(filename);
        if (EXTENSION_TO_TYPE_MAP[extension]) {
          return formatMimeType(fileTypeToMimeType(EXTENSION_TO_TYPE_MAP[extension]));
        }
      }
      return "二进制数据";
    }
    return "可执行文件";
  }
  if (group === MIME_GROUPS.FONT) return "字体文件";

  // 文本文件
  if (group === MIME_GROUPS.TEXT) return "文本文件";

  // 如果没有匹配的预定义类型，尝试提取子类型
  const parts = mimeType.split("/");
  if (parts.length === 2) {
    return `${parts[0]}/${parts[1]}`;
  }

  return mimeType;
};

/**
 * 简化MIME类型显示（返回"图像"，"视频"等简洁形式）
 * @param {string} mimeType - 文件的MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {string} 简化的分类名称
 */
export const getSimpleMimeType = (mimeType, filename) => {
  if (!mimeType) return "未知";

  const group = filename ? getMimeTypeGroupByFileDetails(mimeType, filename) : getMimeTypeGroup(mimeType);
  return GROUP_TO_SIMPLE_LABEL[group] || mimeType.split("/")[0];
};

/**
 * 获取适合UI显示的格式（如"图片 (JPG)"）
 * @param {string} mimeType - MIME类型
 * @param {string} filename - 文件名（可选）
 * @returns {string} 友好的UI显示格式
 */
export const getMimeTypeDisplay = (mimeType, filename) => {
  if (!mimeType) return null;

  // UI友好的MIME类型映射
  const mimeMap = {
    "image/jpeg": "图片 (JPG)",
    "image/png": "图片 (PNG)",
    "image/gif": "图片 (GIF)",
    "image/webp": "图片 (WebP)",
    "image/svg+xml": "图片 (SVG)",
    "application/pdf": "PDF 文档",
    "application/msword": "Word 文档",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word 文档",
    "application/vnd.ms-excel": "Excel 文档",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel 文档",
    "application/vnd.ms-powerpoint": "PowerPoint 文档",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint 文档",
    "application/zip": "压缩文件 (ZIP)",
    "application/x-rar-compressed": "压缩文件 (RAR)",
    "audio/mpeg": "音频文件 (MP3)",
    "audio/wav": "音频文件 (WAV)",
    "video/mp4": "视频文件 (MP4)",
    "video/x-msvideo": "视频文件 (AVI)",
    "text/html": "HTML 文件",
    "text/plain": "文本文件",
    "text/css": "CSS 文件",
    "text/javascript": "JS 文件",
    "application/javascript": "JS 文件",
    "application/typescript": "TS 文件",
    "application/json": "JSON 配置",
    "text/yaml": "YAML 配置",
    "application/x-yaml": "YAML 配置",
    "application/yaml": "YAML 配置",
    "text/xml": "XML 配置",
    "application/xml": "XML 配置",
    "text/x-ini": "INI 配置",
    "application/x-ini": "INI 配置",
    "application/toml": "TOML 配置",
    "application/x-toml": "TOML 配置",
    "text/markdown": "Markdown 文档",
    "application/octet-stream": "二进制文件",
  };

  // 如果有映射就使用映射，否则尝试生成通用格式
  if (mimeMap[mimeType]) {
    return mimeMap[mimeType];
  }

  // 对于没有映射的类型，尝试生成通用格式
  const parts = mimeType.split("/");
  if (parts.length === 2) {
    const mainType = parts[0];
    const subType = parts[1];

    const mainTypeMap = {
      image: "图片",
      audio: "音频",
      video: "视频",
      text: "文本",
      application: "应用",
    };

    if (mainTypeMap[mainType]) {
      return `${mainTypeMap[mainType]} (${subType.toUpperCase()})`;
    }
  }

  // 如果都无法识别，使用详细的格式化
  return formatMimeType(mimeType, filename);
};

/**
 * 获取文件类型的图标类名（用于显示文件图标颜色）
 * @param {string} mimeType - 文件的MIME类型
 * @param {boolean} darkMode - 是否为暗色模式
 * @param {string} filename - 文件名（可选）
 * @returns {string} 对应的图标CSS类名
 */
export const getFileIconClass = (mimeType, darkMode = false, filename) => {
  if (!mimeType) return darkMode ? "text-gray-400" : "text-gray-500";

  const group = filename ? getMimeTypeGroupByFileDetails(mimeType, filename) : getMimeTypeGroup(mimeType);
  const style = GROUP_TO_STYLE_CLASS[group];

  if (style) {
    return darkMode ? style.dark : style.light;
  }

  // 默认灰色
  return darkMode ? "text-gray-400" : "text-gray-500";
};

/**
 * 获取MIME类型的标签CSS类（用于UI中显示标签背景色等）
 * @param {string} mimeType - 文件的MIME类型
 * @param {boolean} darkMode - 是否为暗色模式
 * @param {string} filename - 文件名（可选）
 * @returns {string} 对应的背景和文字颜色CSS类
 */
export const getMimeTypeClass = (mimeType, darkMode = false, filename) => {
  if (!mimeType) return darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-700";

  const group = filename ? getMimeTypeGroupByFileDetails(mimeType, filename) : getMimeTypeGroup(mimeType);
  const styleClass = GROUP_TO_BG_CLASS[group];

  if (styleClass) {
    return darkMode ? styleClass.dark : styleClass.light;
  }

  // 默认样式
  return darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-700";
};

/**
 * 从文件名获取扩展名
 * @param {string} filename - 文件名
 * @returns {string} 文件扩展名（小写）
 */
export const getFileExtension = (filename) => {
  if (!filename) return "";
  return filename.split(".").pop().toLowerCase();
};

/**
 * 从扩展名推断文件类型
 * @param {string} extension - 文件扩展名
 * @returns {string|null} 文件类型或null（未知类型）
 */
export const getFileTypeFromExtension = (extension) => {
  if (!extension) return null;
  const ext = extension.toLowerCase();
  return EXTENSION_TO_TYPE_MAP[ext] || null;
};

/**
 * 将文件类型转换为MIME类型
 * @param {string} fileType - 文件类型（如"image", "document", "pdf"等）
 * @returns {string|null} MIME类型或null
 */
export const fileTypeToMimeType = (fileType) => {
  return FILE_TYPE_TO_MIME_TYPE_MAP[fileType] || null;
};

/**
 * 从文件名推断MIME类型
 * @param {string} filename - 文件名
 * @returns {string|null} 推断的MIME类型或null
 */
export const getMimeTypeFromFilename = (filename) => {
  const ext = getFileExtension(filename);
  const fileType = getFileTypeFromExtension(ext);
  return fileType ? fileTypeToMimeType(fileType) : null;
};

/**
 * 格式化文件大小
 * @param {number} bytes - 文件字节数
 * @param {boolean} useChineseUnits - 是否使用中文单位
 * @returns {string} 格式化后的文件大小
 */
export const formatFileSize = (bytes, useChineseUnits = false) => {
  if (bytes === 0 || bytes === undefined || bytes === null) {
    return useChineseUnits ? "0 字节" : "0 B";
  }

  const k = 1024;
  const sizes = useChineseUnits ? ["字节", "KB", "MB", "GB", "TB"] : ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};
