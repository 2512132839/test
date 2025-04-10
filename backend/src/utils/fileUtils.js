/**
 * 文件处理相关工具函数
 */

/**
 * 获取文件的MIME类型
 * @param {string} filename - 文件名
 * @returns {string} 文件的MIME类型
 */
export function getMimeType(filename) {
  const extension = filename.split(".").pop().toLowerCase();
  const mimeTypes = {
    // 图片格式
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    tiff: "image/tiff",
    tif: "image/tiff",
    ico: "image/x-icon",
    bmp: "image/bmp",
    heic: "image/heic",

    // 文档格式
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",

    // Markdown文件
    md: "text/markdown",
    markdown: "text/markdown",
    mdown: "text/markdown",
    mkd: "text/markdown",
    mdwn: "text/markdown",
    mdtxt: "text/markdown",
    mdtext: "text/markdown",
    rmd: "text/markdown",

    // 音频格式
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    flac: "audio/flac",
    aac: "audio/aac",

    // 视频格式
    mp4: "video/mp4",
    avi: "video/x-msvideo",
    mov: "video/quicktime",
    wmv: "video/x-ms-wmv",
    mkv: "video/x-matroska",
    webm: "video/webm",
    "3gp": "video/3gpp",

    // 压缩文件
    zip: "application/zip",
    rar: "application/x-rar-compressed",
    "7z": "application/x-7z-compressed",
    tar: "application/x-tar",
    gz: "application/gzip",

    // 代码和文本文件
    html: "text/html",
    htm: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    xml: "application/xml",
    txt: "text/plain",
    rtf: "application/rtf",
    csv: "text/csv",

    // 其他常见格式
    iso: "application/x-iso9660-image",
    db: "application/x-sqlite3",
    sqlite: "application/x-sqlite3",
    sqlite3: "application/x-sqlite3",
    epub: "application/epub+zip",
    apk: "application/vnd.android.package-archive",
    exe: "application/x-msdownload",
    dll: "application/x-msdownload",
    psd: "image/vnd.adobe.photoshop",
    ai: "application/postscript",
    eot: "application/vnd.ms-fontobject",
    ttf: "font/ttf",
    woff: "font/woff",
    woff2: "font/woff2",
  };

  return mimeTypes[extension] || "application/octet-stream";
}
