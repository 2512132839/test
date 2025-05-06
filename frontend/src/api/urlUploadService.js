/**
 * URL上传服务
 * 负责处理URL验证、元信息获取和上传逻辑的前端API接口
 * 支持桌面端和移动端使用，包括分片上传功能
 */

import { get, post, del } from "./client";
import { getFullApiUrl } from "./config";

/**
 * 验证URL并获取文件元信息
 * @param {string} url - 要验证的URL
 * @returns {Promise<Object>} 包含文件元信息的响应
 */
export async function validateUrlInfo(url) {
  try {
    return await post("url/info", { url });
  } catch (error) {
    throw new Error(`验证URL失败: ${error.message}`);
  }
}

/**
 * 获取URL代理地址（用于处理不支持CORS的资源）
 * @param {string} url - 原始URL
 * @returns {string} 代理URL
 */
export function getProxyUrl(url) {
  const encodedUrl = encodeURIComponent(url);
  return getFullApiUrl(`url/proxy?url=${encodedUrl}`);
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
          if (etag) {
            resolve({
              success: true,
              etag: etag.replace(/"/g, ""), // 移除引号
              size: blob.size,
            });
          } else {
            resolve({
              success: true,
              size: blob.size,
            });
          }
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
 * 初始化URL分片上传流程
 * @param {Object} options - 上传选项
 * @param {string} options.url - 要上传的URL
 * @param {string} options.s3_config_id - S3配置ID
 * @param {string} [options.filename] - 可选的自定义文件名
 * @param {string} [options.slug] - 可选的自定义链接
 * @param {string} [options.remark] - 可选的备注
 * @param {string} [options.password] - 可选的密码
 * @param {number} [options.expires_in] - 可选的过期时间（小时）
 * @param {number} [options.max_views] - 可选的最大查看次数
 * @param {string} [options.path] - 可选的存储路径
 * @param {number} [options.part_size] - 可选的分片大小（字节）
 * @param {number} [options.total_size] - 可选的总文件大小（字节）
 * @param {number} [options.part_count] - 可选的分片数量
 * @returns {Promise<Object>} 初始化响应，包含文件ID、uploadId和预签名URL列表
 */
export async function initializeMultipartUpload(options) {
  try {
    const data = {
      url: options.url,
      s3_config_id: options.s3_config_id,
    };

    // 添加可选参数
    if (options.filename) data.filename = options.filename;
    if (options.slug) data.slug = options.slug;
    if (options.remark) data.remark = options.remark;
    if (options.password) data.password = options.password;
    if (options.expires_in) data.expires_in = options.expires_in;
    if (options.max_views) data.max_views = options.max_views;
    if (options.path) data.path = options.path;
    if (options.part_size) data.part_size = options.part_size;
    if (options.total_size) data.total_size = options.total_size;
    if (options.part_count) data.part_count = options.part_count;
    if (options.metadata) data.metadata = options.metadata;

    return await post("url/multipart/init", data);
  } catch (error) {
    throw new Error(`初始化分片上传失败: ${error.message}`);
  }
}

/**
 * 完成URL分片上传流程
 * @param {Object} data - 完成上传数据
 * @param {string} data.file_id - 文件ID
 * @param {string} data.upload_id - 上传ID
 * @param {Array<Object>} data.parts - 已上传的分片信息数组，每个对象包含 {partNumber, etag, size}
 * @returns {Promise<Object>} 完成响应
 */
export async function completeMultipartUpload(data) {
  try {
    return await post("url/multipart/complete", data);
  } catch (error) {
    throw new Error(`完成分片上传失败: ${error.message}`);
  }
}

/**
 * 终止URL分片上传流程
 * @param {string} fileId - 文件ID
 * @param {string} uploadId - 上传ID
 * @returns {Promise<Object>} 终止响应
 */
export async function abortMultipartUpload(fileId, uploadId) {
  try {
    return await post("url/multipart/abort", { file_id: fileId, upload_id: uploadId });
  } catch (error) {
    throw new Error(`终止分片上传失败: ${error.message}`);
  }
}

/**
 * 上传单个分片到S3
 * @param {Object} options - 上传选项
 * @param {Blob|File|ArrayBuffer} options.data - 分片数据
 * @param {string} options.url - 分片的预签名上传URL
 * @param {number} options.partNumber - 分片编号
 * @param {Function} [options.onProgress] - 上传进度回调
 * @param {Function} [options.setXhr] - 设置xhr引用的回调函数，用于取消上传
 * @returns {Promise<Object>} 包含分片ETag和大小的对象
 */
export async function uploadPartToS3(options) {
  return new Promise((resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", options.url);
      xhr.responseType = "text";

      // 如果提供了setXhr回调，则传递xhr引用，用于取消上传
      if (options.setXhr) {
        options.setXhr(xhr);
      }

      // 上传进度事件
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && options.onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          options.onProgress(progress, event.loaded, event.total, options.partNumber);
        }
      };

      xhr.onerror = () => {
        reject(new Error(`上传分片 ${options.partNumber} 失败`));
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // 获取ETag - S3在成功上传分片后会返回ETag
          const etag = xhr.getResponseHeader("ETag");
          if (etag) {
            resolve({
              partNumber: options.partNumber,
              etag: etag.replace(/"/g, ""), // 移除引号
              size: options.data.size || options.data.byteLength || 0,
            });
          } else {
            reject(new Error(`上传分片 ${options.partNumber} 成功但未返回ETag`));
          }
        } else {
          reject(new Error(`上传分片 ${options.partNumber} 失败: HTTP ${xhr.status}`));
        }
      };

      xhr.send(options.data);
    } catch (error) {
      reject(new Error(`上传分片 ${options.partNumber} 过程中发生错误: ${error.message}`));
    }
  });
}

/**
 * 将文件或Blob分割成多个分片
 * @param {Blob|File} file - 要分割的文件或Blob
 * @param {number} partSize - 每个分片的大小(字节)
 * @returns {Array<Blob>} 分片数组
 */
export function createParts(file, partSize) {
  const parts = [];
  const fileSize = file.size;
  let start = 0;

  while (start < fileSize) {
    const end = Math.min(start + partSize, fileSize);
    const chunk = file.slice(start, end);
    parts.push(chunk);
    start = end;
  }

  return parts;
}

/**
 * S3分片上传器类
 * 用于封装整个S3分片上传流程，包括分片创建、上传和状态跟踪
 */
export class S3MultipartUploader {
  /**
   * 构造函数
   * @param {Object} options - 上传选项
   * @param {number} [options.maxConcurrentUploads=3] - 最大并发上传数，默认为3
   * @param {Function} [options.onProgress] - 进度回调，参数为(overall, loaded, total)
   * @param {Function} [options.onPartComplete] - 单个分片完成回调，参数为(partNumber, etag)
   * @param {Function} [options.onError] - 错误回调，参数为(error, partNumber)
   */
  constructor(options = {}) {
    this.maxConcurrentUploads = options.maxConcurrentUploads || 3;
    this.onProgress = options.onProgress || (() => {});
    this.onPartComplete = options.onPartComplete || (() => {});
    this.onError = options.onError || (() => {});

    this.fileId = null;
    this.uploadId = null;
    this.presignedUrls = [];
    this.content = null;
    this.parts = [];
    this.uploadedParts = [];
    this.activeUploads = new Map();
    this.aborted = false;
    this.partSize = 0;
    this.totalSize = 0;
    this.totalLoaded = 0;
    this.partCount = 0;
  }

  /**
   * 设置要上传的内容
   * @param {Blob|File} content - 要上传的内容
   * @param {number} partSize - 分片大小(字节)
   */
  setContent(content, partSize) {
    this.content = content;
    this.partSize = partSize;
    this.totalSize = content.size;
    this.parts = createParts(content, partSize);
    this.partCount = this.parts.length;
    console.log(`文件已分割为 ${this.partCount} 个分片，每个分片大小约 ${Math.round((partSize / 1024 / 1024) * 100) / 100} MB`);
  }

  /**
   * 设置分片上传信息
   * @param {string} fileId - 文件ID
   * @param {string} uploadId - 上传ID
   * @param {Array<Object>} presignedUrls - 预签名URLs数组，每个对象包含{partNumber, url}
   */
  setUploadInfo(fileId, uploadId, presignedUrls) {
    this.fileId = fileId;
    this.uploadId = uploadId;
    this.presignedUrls = presignedUrls;
  }

  /**
   * 取消上传
   */
  abort() {
    this.aborted = true;

    // 取消所有活跃上传
    for (const [partNumber, xhr] of this.activeUploads.entries()) {
      if (xhr && xhr.readyState !== 4) {
        // 4 = DONE
        xhr.abort();
        console.log(`已取消分片 ${partNumber} 的上传`);
      }
    }

    this.activeUploads.clear();
  }

  /**
   * 开始上传所有分片
   * @returns {Promise<Array<Object>>} 已上传分片的信息数组
   */
  async uploadAllParts() {
    if (!this.content || !this.fileId || !this.uploadId || !this.presignedUrls.length) {
      throw new Error("上传前必须设置内容和上传信息");
    }

    if (this.aborted) {
      throw new Error("上传已被中止");
    }

    this.uploadedParts = [];
    this.totalLoaded = 0;
    this.aborted = false;

    const queue = Array.from({ length: this.partCount }, (_, i) => i + 1); // 分片编号从1开始

    return new Promise((resolve, reject) => {
      const processQueue = async () => {
        if (this.aborted) {
          return reject(new Error("上传已被中止"));
        }

        // 如果队列为空，说明所有分片已经开始上传
        if (queue.length === 0) {
          return;
        }

        // 如果活跃上传数达到最大值，等待
        if (this.activeUploads.size >= this.maxConcurrentUploads) {
          return;
        }

        const partNumber = queue.shift();
        const presignedUrl = this.presignedUrls.find((p) => p.partNumber === partNumber)?.url;

        if (!presignedUrl) {
          return reject(new Error(`未找到分片 ${partNumber} 的预签名URL`));
        }

        const partData = this.parts[partNumber - 1]; // 数组索引从0开始

        let xhr;
        const setXhr = (x) => {
          xhr = x;
          this.activeUploads.set(partNumber, xhr);
        };

        try {
          const result = await uploadPartToS3({
            data: partData,
            url: presignedUrl,
            partNumber: partNumber,
            onProgress: (progress, loaded, total, partNum) => {
              // 更新总体进度
              this.updateProgress(partNum, loaded);
            },
            setXhr: setXhr,
          });

          // 分片上传成功
          this.uploadedParts.push(result);
          this.onPartComplete(partNumber, result.etag);
          this.activeUploads.delete(partNumber);

          // 继续处理队列
          processQueue();

          // 检查是否所有分片都已上传完成
          if (this.uploadedParts.length === this.partCount) {
            resolve(this.uploadedParts);
          }
        } catch (error) {
          if (this.aborted) {
            return reject(new Error("上传已被中止"));
          }

          this.onError(error, partNumber);
          this.activeUploads.delete(partNumber);

          // 上传失败，将分片重新加入队列尝试重新上传
          // 实际应用中可能需要限制重试次数
          queue.push(partNumber);

          // 继续处理队列
          processQueue();
        }
      };

      // 启动多个并发上传
      for (let i = 0; i < this.maxConcurrentUploads; i++) {
        processQueue();
      }
    });
  }

  /**
   * 更新上传进度
   * @param {number} partNumber - 分片编号
   * @param {number} loaded - 已上传的字节数
   * @private
   */
  updateProgress(partNumber, loaded) {
    // 这里简化了进度计算，实际应用中可能需要更复杂的逻辑
    this.totalLoaded += loaded;
    const progress = Math.min(Math.round((this.totalLoaded / this.totalSize) * 100), 100);
    this.onProgress(progress, this.totalLoaded, this.totalSize);
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
