/**
 * URL上传服务API
 * 负责处理URL验证、元信息获取和上传逻辑的前端API接口
 * 支持桌面端和移动端使用，包括分片上传功能
 */

import { get, post, del } from "../client";
import { getFullApiUrl } from "../config";

/**
 * 验证URL并获取文件元信息
 * @param {string} url - 要验证的URL
 * @returns {Promise<Object>} 包含文件元信息的响应
 */
export async function validateUrlInfo(url) {
  return await post("url/info", { url });
}

/**
 * 获取URL代理地址（用于处理不支持CORS的资源）
 * @param {string} url - 原始URL
 * @returns {string} 代理URL
 */
export function getProxyUrl(url) {
  const params = new URLSearchParams({ url });
  return getFullApiUrl(`url/proxy?${params.toString()}`);
}

/**
 * 检查错误是否是跨域(CORS)错误
 * @param {Error} error - 捕获到的错误对象
 * @returns {boolean} - 是否是跨域错误
 */
function isCorsError(error) {
  // 典型的CORS错误特征
  if (error.name === "NetworkError") return true;
  if (error.message.includes("CORS")) return true;
  if (error.message.includes("cross-origin")) return true;
  if (error.message.includes("access-control-allow-origin")) return true;
  if (error.message.includes("NetworkError")) return true;
  // XMLHttpRequest的错误检测
  // 通常CORS错误会导致状态为0和空statusText
  if (error.xhr && error.xhr.status === 0 && error.xhr.statusText === "") return true;

  return false;
}

/**
 * 通用的URL内容获取函数
 * 先尝试直接获取URL内容，如果出现CORS错误或其他网络错误，则切换到使用代理URL
 * @param {Object} options - 获取选项
 * @param {string} options.url - 要获取的URL
 * @param {Function} [options.onProgress] - 进度回调，参数为(progress, loaded, total, phase)
 * @param {Function} [options.setXhr] - 设置xhr引用的回调函数，用于取消请求
 * @param {string} [options.statusText] - 可选的自定义状态文本
 * @returns {Promise<Blob>} 获取到的内容Blob
 */
export async function fetchUrlContent(options) {
  // 首先尝试直接获取URL内容
  try {
    console.log(`尝试直接获取URL: ${options.url}`);
    return await fetchFromUrl(options.url, options.onProgress, options.setXhr, "directDownload");
  } catch (error) {
    console.warn(`直接获取URL内容失败: ${error.message}`);

    // 检查是否是CORS错误或其他网络错误，如果是则尝试使用代理
    if (isCorsError(error) || error.message.includes("获取URL内容失败")) {
      console.log(`检测到跨域问题，切换到代理模式获取URL: ${options.url}`);
      // 使用代理URL重试
      const proxyUrl = getProxyUrl(options.url);
      return await fetchFromUrl(proxyUrl, options.onProgress, options.setXhr, "proxyDownload");
    }

    // 其他错误则直接抛出
    throw error;
  }
}

/**
 * 内部辅助函数：从指定URL获取内容
 * @param {string} url - 要获取的URL
 * @param {Function} [onProgress] - 进度回调函数
 * @param {Function} [setXhr] - 设置xhr引用的回调函数
 * @param {string} [phaseType] - 下载阶段类型
 * @returns {Promise<Blob>} 获取到的内容Blob
 * @private
 */
function fetchFromUrl(url, onProgress, setXhr, phaseType) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.responseType = "blob";

    // 如果提供了setXhr回调，则传递xhr引用
    if (setXhr) {
      setXhr(xhr);
    }

    // 进度事件
    xhr.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        // 下载过程占总进度的49%，保留1%给最终确认步骤
        const progress = Math.round((event.loaded / event.total) * 49);
        onProgress(progress, event.loaded, event.total, "downloading", phaseType);
      }
    };

    xhr.onerror = () => {
      // 将xhr添加到错误对象，方便检测CORS错误
      const error = new Error("获取URL内容失败");
      error.xhr = xhr;
      reject(error);
    };

    xhr.onabort = () => {
      reject(new Error("下载已取消"));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response);
      } else {
        reject(new Error(`获取URL内容失败: HTTP ${xhr.status} ${xhr.statusText}`));
      }
    };

    xhr.send();
  });
}

/**
 * 获取URL上传的预签名URL
 * @param {Object} options - 上传选项
 * @param {string} options.url - 要上传的URL
 * @param {string} options.s3_config_id - S3配置ID
 * @param {Object} [options.metadata] - 可选的文件元数据
 * @param {string} [options.filename] - 可选的自定义文件名
 * @param {string} [options.slug] - 可选的自定义链接
 * @param {string} [options.remark] - 可选的备注
 * @param {string} [options.path] - 可选的存储路径
 * @returns {Promise<Object>} 包含预签名URL和文件ID的响应
 */
export async function getUrlUploadPresignedUrl(options) {
  try {
    const data = {
      url: options.url,
      s3_config_id: options.s3_config_id,
    };

    // 添加可选参数
    if (options.metadata) data.metadata = options.metadata;
    if (options.filename) data.filename = options.filename;
    if (options.slug) data.slug = options.slug;
    if (options.remark) data.remark = options.remark;
    if (options.path) data.path = options.path;

    return await post("url/presign", data);
  } catch (error) {
    throw new Error(`获取URL上传预签名失败: ${error.message}`);
  }
}

/**
 * 使用预签名URL从原始URL上传文件到S3
 * @param {Object} options - 上传选项
 * @param {string} options.url - 源URL
 * @param {string} options.uploadUrl - 预签名上传URL
 * @param {Function} [options.onProgress] - 上传进度回调
 * @param {Function} [options.setXhr] - 设置xhr引用的回调函数，用于取消上传
 * @returns {Promise<Object>} 上传结果
 */
export async function uploadFromUrlToS3(options) {
  return new Promise(async (resolve, reject) => {
    try {
      // 首先从源URL获取内容，使用通用的URL内容获取函数
      const blob = await fetchUrlContent({
        url: options.url,
        onProgress: options.onProgress,
        setXhr: options.setXhr,
      });

      // 现在将获取的内容上传到S3
      const uploadXhr = new XMLHttpRequest();
      uploadXhr.open("PUT", options.uploadUrl);

      // 如果提供了setXhr回调，则更新xhr引用
      if (options.setXhr) {
        options.setXhr(uploadXhr);
      }

      // 上传进度事件
      uploadXhr.upload.onprogress = (event) => {
        if (event.lengthComputable && options.onProgress) {
          // 上传占总进度的49%，从50%开始计算到99%，保留最后1%给完成阶段
          const progress = 50 + Math.round((event.loaded / event.total) * 49);
          options.onProgress(progress, event.loaded, event.total, "uploading");
        }
      };

      uploadXhr.onerror = () => {
        reject(new Error("上传到S3失败"));
      };

      uploadXhr.onload = () => {
        if (uploadXhr.status >= 200 && uploadXhr.status < 300) {
          // 获取ETag
          const etag = uploadXhr.getResponseHeader("ETag");
          const cleanEtag = etag ? etag.replace(/"/g, "") : null;

          if (!etag) {
            console.warn("URL上传成功但未返回ETag，可能是CORS限制导致");
          }

          resolve({
            success: true,
            etag: cleanEtag,
            size: blob.size,
          });
        } else {
          reject(new Error(`上传到S3失败: HTTP ${uploadXhr.status}`));
        }
      };

      uploadXhr.send(blob);
    } catch (error) {
      reject(new Error(`URL上传失败: ${error.message}`));
    }
  });
}

/**
 * 提交URL上传完成信息
 * @param {Object} data - 上传完成数据
 * @param {string} data.file_id - 文件ID
 * @param {string} data.etag - 文件ETag
 * @param {number} [data.size] - 文件大小（字节）
 * @param {string} [data.remark] - 备注
 * @param {string} [data.password] - 密码
 * @param {number} [data.expires_in] - 过期时间（小时）
 * @param {number} [data.max_views] - 最大查看次数
 * @returns {Promise<Object>} 提交响应
 */
export async function commitUrlUpload(data) {
  try {
    return await post("url/commit", data);
  } catch (error) {
    throw new Error(`提交URL上传完成信息失败: ${error.message}`);
  }
}

/**
 * 取消URL上传并删除文件记录
 * @param {string} fileId - 文件ID
 * @returns {Promise<Object>} 操作结果
 */
export async function cancelUrlUpload(fileId) {
  try {
    return await post("url/cancel", { file_id: fileId });
  } catch (error) {
    console.error(`取消URL上传失败: ${error.message}`);
    // 即使取消失败也不抛出异常，避免影响主要错误处理流程
    return { success: false, message: `取消URL上传失败: ${error.message}` };
  }
}

/**
 * 初始化分片上传
 * @param {Object} options - 初始化选项
 * @returns {Promise<Object>} 初始化结果
 */
export async function initializeMultipartUpload(options) {
  try {
    return await post("url/multipart/init", options);
  } catch (error) {
    throw new Error(`初始化分片上传失败: ${error.message}`);
  }
}

/**
 * 完成分片上传
 * @param {Object} options - 完成选项
 * @returns {Promise<Object>} 完成结果
 */
export async function completeMultipartUpload(options) {
  try {
    return await post("url/multipart/complete", options);
  } catch (error) {
    throw new Error(`完成分片上传失败: ${error.message}`);
  }
}

/**
 * 中止分片上传
 * @param {string} fileId - 文件ID
 * @param {string} uploadId - 上传ID
 * @returns {Promise<Object>} 中止结果
 */
export async function abortMultipartUpload(fileId, uploadId) {
  try {
    return await post("url/multipart/abort", { file_id: fileId, upload_id: uploadId });
  } catch (error) {
    console.error(`中止分片上传失败: ${error.message}`);
    return { success: false, message: `中止分片上传失败: ${error.message}` };
  }
}

/**
 * 将Blob分割为分片
 * @param {Blob} blob - 要分割的Blob
 * @param {number} partSize - 分片大小
 * @returns {Array} 分片数组
 */
export function createParts(blob, partSize) {
  const parts = [];
  const totalSize = blob.size;
  let offset = 0;
  let partNumber = 1;

  while (offset < totalSize) {
    const end = Math.min(offset + partSize, totalSize);
    const part = blob.slice(offset, end);

    parts.push({
      partNumber: partNumber,
      data: part,
      size: part.size,
      offset: offset,
    });

    offset = end;
    partNumber++;
  }

  return parts;
}

/**
 * S3分片上传器类
 */
export class S3MultipartUploader {
  constructor(options = {}) {
    this.maxConcurrentUploads = options.maxConcurrentUploads || 3;
    this.onProgress = options.onProgress || (() => {});
    this.onPartComplete = options.onPartComplete || (() => {});
    this.onError = options.onError || (() => {});

    this.content = null;
    this.parts = [];
    this.fileId = null;
    this.uploadId = null;
    this.presignedUrls = [];
    this.uploadedParts = [];
    this.totalUploaded = 0;
    this.isCancelled = false;
  }

  setContent(blob, partSize) {
    this.content = blob;
    this.parts = createParts(blob, partSize);
  }

  setUploadInfo(fileId, uploadId, presignedUrls) {
    this.fileId = fileId;
    this.uploadId = uploadId;
    this.presignedUrls = presignedUrls;
  }

  async uploadAllParts() {
    if (!this.content || !this.parts.length || !this.presignedUrls.length) {
      throw new Error("上传器未正确初始化");
    }

    this.uploadedParts = [];
    this.totalUploaded = 0;
    this.isCancelled = false;

    // 创建上传队列
    const uploadQueue = [...this.parts];
    const activeUploads = new Set();

    return new Promise((resolve, reject) => {
      const processNext = async () => {
        if (this.isCancelled) {
          reject(new Error("上传已取消"));
          return;
        }

        if (uploadQueue.length === 0 && activeUploads.size === 0) {
          // 所有分片上传完成
          resolve(this.uploadedParts);
          return;
        }

        if (uploadQueue.length > 0 && activeUploads.size < this.maxConcurrentUploads) {
          const part = uploadQueue.shift();
          const uploadPromise = this.uploadPart(part);

          activeUploads.add(uploadPromise);

          uploadPromise
              .then(() => {
                activeUploads.delete(uploadPromise);
                processNext();
              })
              .catch((error) => {
                activeUploads.delete(uploadPromise);
                this.onError(error, part.partNumber);
                reject(error);
              });

          // 继续处理下一个
          processNext();
        }
      };

      processNext();
    });
  }

  async uploadPart(part) {
    if (this.isCancelled) {
      throw new Error("上传已取消");
    }

    const presignedUrl = this.presignedUrls.find((url) => url.partNumber === part.partNumber);
    if (!presignedUrl) {
      throw new Error(`找不到分片 ${part.partNumber} 的预签名URL`);
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const partProgress = (event.loaded / event.total) * 100;
          const totalProgress = ((this.totalUploaded + event.loaded) / this.content.size) * 100;
          this.onProgress(totalProgress, this.totalUploaded + event.loaded, this.content.size);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const etag = xhr.getResponseHeader("ETag");
          // 某些S3兼容服务（如又拍云）可能由于CORS限制无法返回ETag
          // 在这种情况下，我们仍然认为上传成功，但使用null作为ETag
          const cleanEtag = etag ? etag.replace(/"/g, "") : null;

          this.uploadedParts.push({
            partNumber: part.partNumber,
            etag: cleanEtag,
          });
          this.totalUploaded += part.size;
          this.onPartComplete(part.partNumber, cleanEtag);

          if (!etag) {
            console.warn(`分片 ${part.partNumber} 上传成功但未返回ETag，可能是CORS限制导致`);
          }

          resolve();
        } else {
          reject(new Error(`分片 ${part.partNumber} 上传失败：HTTP ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error(`分片 ${part.partNumber} 上传失败：网络错误`));
      });

      xhr.addEventListener("abort", () => {
        reject(new Error(`分片 ${part.partNumber} 上传被取消`));
      });

      xhr.open("PUT", presignedUrl.url);
      xhr.send(part.data);
    });
  }

  cancel() {
    this.isCancelled = true;
  }
}
