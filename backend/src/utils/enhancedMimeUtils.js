/**
 * 增强的MIME类型检测工具
 * 集成file-type库进行精确的文件类型检测
 * 支持100+种文件格式的专业检测
 */

import { fileTypeFromBuffer, fileTypeFromStream, fileTypeFromBlob, supportedExtensions, supportedMimeTypes } from "file-type";
import { getMimeTypeFromFilename, getMimeTypeGroup, isOfficeFile } from "./fileUtils.js";

/**
 * 自定义Office文档检测器
 * 增强对Office文档的检测能力
 */
const officeDetector = {
  id: "office-enhanced",
  async detect(tokenizer) {
    // 检测ZIP文件头（Office文档基于ZIP格式）
    const zipHeader = new Uint8Array(4);
    await tokenizer.peekBuffer(zipHeader, { length: 4, mayBeLess: true });

    // ZIP文件魔数: 50 4B 03 04 或 50 4B 05 06 或 50 4B 07 08
    if (zipHeader[0] === 0x50 && zipHeader[1] === 0x4b && (zipHeader[2] === 0x03 || zipHeader[2] === 0x05 || zipHeader[2] === 0x07)) {
      // 尝试读取更多内容来确定具体的Office类型
      try {
        const moreData = new Uint8Array(512);
        await tokenizer.peekBuffer(moreData, { length: 512, mayBeLess: true });
        const content = new TextDecoder("utf-8", { fatal: false }).decode(moreData);

        // 检查Office文档特征字符串
        if (content.includes("word/")) {
          return { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
        } else if (content.includes("xl/")) {
          return { ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
        } else if (content.includes("ppt/")) {
          return { ext: "pptx", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
        }
      } catch (error) {
        // 如果读取失败，返回undefined让其他检测器处理
      }
    }

    return undefined;
  },
};

/**
 * 从URL获取文件内容并检测MIME类型
 * @param {string} url - 文件URL
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 检测结果
 */
export async function detectMimeTypeFromUrl(url, options = {}) {
  const {
    maxBytes = 4100, // file-type推荐的字节数
    timeout = 10000,
    useFileType = true,
    fallbackToFilename = true,
    abortSignal = null, // 支持AbortSignal
    customDetectors = [officeDetector], // 自定义检测器
  } = options;

  const result = {
    url,
    detectedMimeType: null,
    filenameMimeType: null,
    finalMimeType: null,
    detectionMethod: null,
    confidence: 0,
    fileTypeResult: null,
    error: null,
  };

  try {
    // 从URL提取文件名
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split("/").pop() || "";

    // 方法1: 使用文件名推断MIME类型（作为备用）
    if (filename) {
      result.filenameMimeType = getMimeTypeFromFilename(filename);
    }

    // 方法2: 使用file-type库检测（主要方法）
    if (useFileType) {
      try {
        console.log(`🔍 开始file-type检测: ${url}`);

        // 获取文件内容的前几KB用于检测
        const fetchOptions = {
          method: "GET",
          headers: {
            Range: `bytes=0-${maxBytes - 1}`,
            "User-Agent": "CloudPaste-Backend/1.0 (file-type Enhanced)",
          },
          signal: abortSignal || AbortSignal.timeout(timeout),
        };

        const response = await fetch(url, fetchOptions);

        if (response.ok || response.status === 206) {
          // 尝试Buffer检测（支持自定义检测器）
          try {
            const arrayBuffer = await response.arrayBuffer();
            const fileTypeResult = await fileTypeFromBuffer(arrayBuffer, { customDetectors });

            if (fileTypeResult) {
              result.fileTypeResult = fileTypeResult;
              result.detectedMimeType = fileTypeResult.mime;
              result.detectionMethod = "file-type-buffer";
              result.confidence = 0.95;

              console.log(`✅ file-type检测成功: ${fileTypeResult.mime} (${fileTypeResult.ext})`);
            }
          } catch (bufferError) {
            // 回退到Blob检测（需要Node.js ≥ 20）
            try {
              // 检查Node.js版本是否支持fileTypeFromBlob
              const nodeVersion = process.version;
              const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0]);

              if (majorVersion >= 20) {
                const blobResponse = await fetch(url, {
                  method: "GET",
                  headers: {
                    Range: `bytes=0-${maxBytes - 1}`,
                    "User-Agent": "CloudPaste-Backend/1.0 (file-type Blob)",
                  },
                  signal: abortSignal || AbortSignal.timeout(timeout),
                });

                if (blobResponse.ok || blobResponse.status === 206) {
                  const blob = await blobResponse.blob();
                  const blobResult = await fileTypeFromBlob(blob, { customDetectors });
                  if (blobResult) {
                    result.fileTypeResult = blobResult;
                    result.detectedMimeType = blobResult.mime;
                    result.detectionMethod = "file-type-blob";
                    result.confidence = 0.9;

                    console.log(`✅ file-type Blob检测成功: ${blobResult.mime} (${blobResult.ext})`);
                  }
                }
              } else {
                // Node.js版本不支持，跳过Blob检测
                throw new Error(`Node.js ${nodeVersion} 不支持fileTypeFromBlob，需要 ≥ 20`);
              }
            } catch (blobError) {
              // 最后回退到Stream检测
              try {
                const streamResponse = await fetch(url, {
                  method: "GET",
                  headers: {
                    Range: `bytes=0-${maxBytes - 1}`,
                    "User-Agent": "CloudPaste-Backend/1.0 (file-type Stream)",
                  },
                  signal: abortSignal || AbortSignal.timeout(timeout),
                });

                if (streamResponse.ok || streamResponse.status === 206) {
                  const streamResult = await fileTypeFromStream(streamResponse.body, { customDetectors });
                  if (streamResult) {
                    result.fileTypeResult = streamResult;
                    result.detectedMimeType = streamResult.mime;
                    result.detectionMethod = "file-type-stream";
                    result.confidence = 0.85;

                    console.log(`✅ file-type Stream检测成功: ${streamResult.mime} (${streamResult.ext})`);
                  }
                }
              } catch (streamError) {
                // 所有file-type方法都失败了
              }
            }
          }
        }
      } catch (fetchError) {
        console.warn("file-type检测失败:", fetchError.message);
        result.error = fetchError.message;
      }
    }

    // 确定最终的MIME类型
    if (result.detectedMimeType) {
      // 优先使用file-type检测结果
      result.finalMimeType = result.detectedMimeType;
    } else if (fallbackToFilename && result.filenameMimeType) {
      // 回退到文件名推断
      result.finalMimeType = result.filenameMimeType;
      result.detectionMethod = "filename-extension";
      result.confidence = 0.7;
    } else {
      // 默认类型
      result.finalMimeType = "application/octet-stream";
      result.detectionMethod = "default";
      result.confidence = 0.1;
    }

    console.log(`🎯 最终MIME类型: ${result.finalMimeType} (方法: ${result.detectionMethod}, 置信度: ${result.confidence})`);
  } catch (error) {
    result.error = error.message;
    result.finalMimeType = result.filenameMimeType || "application/octet-stream";
    result.detectionMethod = "error-fallback";
    result.confidence = 0.1;
  }

  return result;
}

/**
 * 增强的URL元数据获取函数
 * @param {string} url - 文件URL
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 元数据对象
 */
export async function getEnhancedUrlMetadata(url, options = {}) {
  const { timeout = 10000, enableMimeDetection = true, abortSignal = null } = options;

  const metadata = {
    url,
    filename: "",
    contentType: "application/octet-stream",
    enhancedContentType: null,
    size: null,
    lastModified: null,
    corsSupported: false,
    detectionMethod: [],
    detectionConfidence: 0,
    fileTypeLibraryUsed: false,
    error: null,
  };

  try {
    // 从URL提取文件名
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    metadata.filename = pathname.split("/").pop() || `file_${Date.now()}`;

    // 获取基本元数据（HEAD请求）
    try {
      const headResponse = await fetch(url, {
        method: "HEAD",
        signal: abortSignal || AbortSignal.timeout(timeout),
      });

      if (headResponse.ok) {
        metadata.contentType = headResponse.headers.get("content-type") || "application/octet-stream";
        metadata.size = parseInt(headResponse.headers.get("content-length")) || null;
        metadata.lastModified = headResponse.headers.get("last-modified") || null;
        metadata.corsSupported = true;
      }
    } catch (headError) {}

    // 增强的MIME类型检测
    if (enableMimeDetection) {
      const mimeResult = await detectMimeTypeFromUrl(url, options);

      if (mimeResult.finalMimeType && mimeResult.finalMimeType !== "application/octet-stream") {
        metadata.enhancedContentType = mimeResult.finalMimeType;
        metadata.detectionMethod = [mimeResult.detectionMethod];
        metadata.detectionConfidence = mimeResult.confidence;
        metadata.fileTypeLibraryUsed = mimeResult.detectionMethod?.includes("file-type");
      }
    }

    // 如果没有增强检测结果，使用文件名推断
    if (!metadata.enhancedContentType) {
      metadata.enhancedContentType = getMimeTypeFromFilename(metadata.filename);
      metadata.detectionMethod = ["filename-fallback"];
      metadata.detectionConfidence = 0.6;
    }
  } catch (error) {
    metadata.error = error.message;
  }

  return metadata;
}

/**
 * 批量检测多个URL的MIME类型
 * @param {Array<string>} urls - URL数组
 * @param {Object} options - 选项
 * @returns {Promise<Array>} 检测结果数组
 */
export async function batchDetectMimeTypes(urls, options = {}) {
  const { maxConcurrent = 3 } = options;
  const results = [];

  for (let i = 0; i < urls.length; i += maxConcurrent) {
    const batch = urls.slice(i, i + maxConcurrent);
    const batchPromises = batch.map(async (url, index) => {
      try {
        const result = await getEnhancedUrlMetadata(url, options);
        return { url, index: i + index, success: true, result };
      } catch (error) {
        return { url, index: i + index, success: false, error: error.message };
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);
    results.push(...batchResults.map((r) => r.value || r.reason));
  }

  return results;
}

/**
 * 检查MIME类型是否需要特殊处理
 * @param {string} mimeType - MIME类型
 * @returns {Object} 处理建议
 */
export function getMimeTypeHandling(mimeType) {
  const group = getMimeTypeGroup(mimeType);

  return {
    group,
    isOffice: isOfficeFile(mimeType),
    needsPreview: ["image", "video", "audio", "pdf", "text"].includes(group),
    isDownloadable: true,
    suggestedAction: group === "executable" ? "download" : "preview",
  };
}

/**
 * 获取file-type库支持的文件扩展名
 * @returns {Set<string>} 支持的扩展名集合
 */
export function getSupportedExtensions() {
  return supportedExtensions;
}

/**
 * 获取file-type库支持的MIME类型
 * @returns {Set<string>} 支持的MIME类型集合
 */
export function getSupportedMimeTypes() {
  return supportedMimeTypes;
}

/**
 * 检查文件扩展名是否被file-type库支持
 * @param {string} extension - 文件扩展名（不含点）
 * @returns {boolean} 是否支持
 */
export function isExtensionSupported(extension) {
  return supportedExtensions.has(extension.toLowerCase());
}

/**
 * 检查MIME类型是否被file-type库支持
 * @param {string} mimeType - MIME类型
 * @returns {boolean} 是否支持
 */
export function isMimeTypeSupported(mimeType) {
  return supportedMimeTypes.has(mimeType.toLowerCase());
}

/**
 * 获取增强检测的统计信息
 * @returns {Object} 统计信息
 */
export function getDetectionStats() {
  return {
    supportedExtensions: supportedExtensions.size,
    supportedMimeTypes: supportedMimeTypes.size,
    customDetectors: 1, // 目前只有officeDetector
    nodeVersion: process.version,
    blobSupported: parseInt(process.version.slice(1).split(".")[0]) >= 20,
  };
}
