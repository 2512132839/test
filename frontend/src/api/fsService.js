import { get, post, put, del } from "./client";
import { API_BASE_URL } from "./config";

/**
 * 管理员API - 获取目录列表
 * @param {string} path 请求路径
 * @returns {Promise<Object>} 目录列表响应对象
 */
export async function getAdminDirectoryList(path) {
  return get(`/admin/fs/list?path=${encodeURIComponent(path)}`);
}

/**
 * 管理员API - 获取文件信息
 * @param {string} path 文件路径
 * @returns {Promise<Object>} 文件信息响应对象
 */
export async function getAdminFileInfo(path) {
  return get(`/admin/fs/get?path=${encodeURIComponent(path)}`);
}

/**
 * 管理员API - 下载文件
 * @param {string} path 文件路径
 * @returns {string} 文件下载URL
 */
export function getAdminFileDownloadUrl(path) {
  return `${API_BASE_URL}/api/admin/fs/download?path=${encodeURIComponent(path)}`;
}

/**
 * 管理员API - 预览文件
 * @param {string} path 文件路径
 * @returns {string} 文件预览URL
 */
export function getAdminFilePreviewUrl(path) {
  return `${API_BASE_URL}/api/admin/fs/preview?path=${encodeURIComponent(path)}`;
}

/**
 * 管理员API - 创建目录
 * @param {string} path 目录路径
 * @returns {Promise<Object>} 创建结果响应对象
 */
export async function createAdminDirectory(path) {
  return post(`/admin/fs/mkdir`, { path });
}

/**
 * 管理员API - 上传文件
 * @param {string} path 目标路径
 * @param {File} file 文件对象
 * @param {boolean} useMultipart 是否使用服务器分片上传，默认为true
 * @param {Function} onXhrCreated XHR创建后的回调，用于保存引用以便取消请求
 * @returns {Promise<Object>} 上传结果响应对象
 */
export async function uploadAdminFile(path, file, useMultipart = true, onXhrCreated) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("path", path);
  formData.append("use_multipart", useMultipart.toString());

  return post(`/admin/fs/upload`, formData, { onXhrCreated });
}

/**
 * 管理员API - 删除文件或目录
 * @param {string} path 文件或目录路径
 * @returns {Promise<Object>} 删除结果响应对象
 */
export async function deleteAdminItem(path) {
  return del(`/admin/fs/remove?path=${encodeURIComponent(path)}`);
}

/**
 * 管理员API - 批量删除文件或目录
 * @param {Array<string>} paths 文件或目录路径数组
 * @returns {Promise<Object>} 批量删除结果响应对象
 */
export async function batchDeleteAdminItems(paths) {
  return post(`/admin/fs/batch-remove`, { paths });
}

/**
 * 管理员API - 重命名文件或目录
 * @param {string} oldPath 旧路径
 * @param {string} newPath 新路径
 * @returns {Promise<Object>} 重命名结果响应对象
 */
export async function renameAdminItem(oldPath, newPath) {
  return post(`/admin/fs/rename`, { oldPath, newPath });
}

/**
 * API密钥用户API - 获取目录列表
 * @param {string} path 请求路径
 * @returns {Promise<Object>} 目录列表响应对象
 */
export async function getUserDirectoryList(path) {
  return get(`/user/fs/list?path=${encodeURIComponent(path)}`);
}

/**
 * API密钥用户API - 获取文件信息
 * @param {string} path 文件路径
 * @returns {Promise<Object>} 文件信息响应对象
 */
export async function getUserFileInfo(path) {
  return get(`/user/fs/get?path=${encodeURIComponent(path)}`);
}

/**
 * API密钥用户API - 下载文件
 * @param {string} path 文件路径
 * @returns {string} 文件下载URL
 */
export function getUserFileDownloadUrl(path) {
  return `${API_BASE_URL}/api/user/fs/download?path=${encodeURIComponent(path)}`;
}

/**
 * API密钥用户API - 预览文件
 * @param {string} path 文件路径
 * @returns {string} 文件预览URL
 */
export function getUserFilePreviewUrl(path) {
  return `${API_BASE_URL}/api/user/fs/preview?path=${encodeURIComponent(path)}`;
}

/**
 * API密钥用户API - 创建目录
 * @param {string} path 目录路径
 * @returns {Promise<Object>} 创建结果响应对象
 */
export async function createUserDirectory(path) {
  return post(`/user/fs/mkdir`, { path });
}

/**
 * API密钥用户API - 上传文件
 * @param {string} path 目标路径
 * @param {File} file 文件对象
 * @param {boolean} useMultipart 是否使用分片上传，默认为true
 * @param {Function} onXhrCreated XHR创建后的回调，用于保存引用以便取消请求
 * @returns {Promise<Object>} 上传结果响应对象
 */
export async function uploadUserFile(path, file, useMultipart = true, onXhrCreated) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("path", path);
  formData.append("use_multipart", useMultipart.toString());

  return post(`/user/fs/upload`, formData, { onXhrCreated });
}

/**
 * API密钥用户API - 删除文件或目录
 * @param {string} path 文件或目录路径
 * @returns {Promise<Object>} 删除结果响应对象
 */
export async function deleteUserItem(path) {
  return del(`/user/fs/remove?path=${encodeURIComponent(path)}`);
}

/**
 * API密钥用户API - 批量删除文件或目录
 * @param {Array<string>} paths 文件或目录路径数组
 * @returns {Promise<Object>} 批量删除结果响应对象
 */
export async function batchDeleteUserItems(paths) {
  return post(`/user/fs/batch-remove`, { paths });
}

/**
 * API密钥用户API - 重命名文件或目录
 * @param {string} oldPath 旧路径
 * @param {string} newPath 新路径
 * @returns {Promise<Object>} 重命名结果响应对象
 */
export async function renameUserItem(oldPath, newPath) {
  return post(`/user/fs/rename`, { oldPath, newPath });
}

/**
 * 根据用户类型获取合适的API函数
 * @param {boolean} isAdmin 是否为管理员
 * @returns {Object} API函数对象
 */
export function getFsApiByUserType(isAdmin) {
  return isAdmin
      ? {
        getDirectoryList: getAdminDirectoryList,
        getFileInfo: getAdminFileInfo,
        getFileDownloadUrl: getAdminFileDownloadUrl,
        getFilePreviewUrl: getAdminFilePreviewUrl,
        createDirectory: createAdminDirectory,
        uploadFile: uploadAdminFile,
        deleteItem: deleteAdminItem,
        batchDeleteItems: batchDeleteAdminItems,
        renameItem: renameAdminItem,
        // 分片上传相关
        initMultipartUpload: initAdminMultipartUpload,
        uploadPart: uploadAdminPart,
        completeMultipartUpload: completeAdminMultipartUpload,
        abortMultipartUpload: abortAdminMultipartUpload,
        performMultipartUpload: (file, path, onProgress, onCancel, onXhrCreated) => performMultipartUpload(file, path, true, onProgress, onCancel, onXhrCreated),
        // 预签名URL上传相关
        getPresignedUploadUrl: getAdminPresignedUploadUrl,
        commitPresignedUpload: commitAdminPresignedUpload,
        performPresignedUpload: (file, path, onProgress, onCancel) => performPresignedUpload(file, path, true, onProgress, onCancel),
      }
      : {
        getDirectoryList: getUserDirectoryList,
        getFileInfo: getUserFileInfo,
        getFileDownloadUrl: getUserFileDownloadUrl,
        getFilePreviewUrl: getUserFilePreviewUrl,
        createDirectory: createUserDirectory,
        uploadFile: uploadUserFile,
        deleteItem: deleteUserItem,
        batchDeleteItems: batchDeleteUserItems,
        renameItem: renameUserItem,
        // 分片上传相关
        initMultipartUpload: initUserMultipartUpload,
        uploadPart: uploadUserPart,
        completeMultipartUpload: completeUserMultipartUpload,
        abortMultipartUpload: abortUserMultipartUpload,
        performMultipartUpload: (file, path, onProgress, onCancel, onXhrCreated) => performMultipartUpload(file, path, false, onProgress, onCancel, onXhrCreated),
        // 预签名URL上传相关
        getPresignedUploadUrl: getUserPresignedUploadUrl,
        commitPresignedUpload: commitUserPresignedUpload,
        performPresignedUpload: (file, path, onProgress, onCancel) => performPresignedUpload(file, path, false, onProgress, onCancel),
      };
}

/**
 * 初始化分片上传 - 管理员版本
 * @param {string} path 文件路径
 * @param {string} contentType 文件MIME类型
 * @param {number} fileSize 文件大小
 * @param {string} filename 文件名
 * @returns {Promise<Object>} 初始化结果响应对象
 */
export async function initAdminMultipartUpload(path, contentType, fileSize, filename) {
  return post(`/admin/fs/multipart/init`, { path, contentType, fileSize, filename });
}

/**
 * 上传分片 - 管理员版本
 * @param {string} path 文件路径
 * @param {string} uploadId 上传ID
 * @param {number} partNumber 分片编号
 * @param {Blob|ArrayBuffer} partData 分片数据
 * @param {boolean} isLastPart 是否为最后一个分片
 * @param {string} key S3对象键值，确保与初始化阶段一致
 * @param {Function} onXhrCreated 创建XHR对象后的回调，用于保存引用以便取消请求
 * @returns {Promise<Object>} 上传分片结果响应对象
 */
export async function uploadAdminPart(path, uploadId, partNumber, partData, isLastPart = false, key, { onXhrCreated, timeout }) {
  const url = `/admin/fs/multipart/part?path=${encodeURIComponent(path)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}&isLastPart=${isLastPart}${
      key ? `&key=${encodeURIComponent(key)}` : ""
  }`;
  return post(url, partData, {
    headers: { "Content-Type": "application/octet-stream" },
    rawBody: true,
    onXhrCreated,
    timeout,
  });
}

/**
 * 完成分片上传 - 管理员版本
 * @param {string} path 文件路径
 * @param {string} uploadId 上传ID
 * @param {Array<{partNumber: number, etag: string}>} parts 所有已上传分片的信息
 * @param {string} key S3对象键值，确保与初始化阶段一致
 * @param {string} contentType 文件MIME类型
 * @param {number} fileSize 文件大小（字节）
 * @returns {Promise<Object>} 完成上传结果响应对象
 */
export async function completeAdminMultipartUpload(path, uploadId, parts, key, contentType, fileSize) {
  return post(`/admin/fs/multipart/complete`, {
    path,
    uploadId,
    parts,
    key,
    contentType,
    fileSize,
  });
}

/**
 * 中止分片上传 - 管理员版本
 * @param {string} path 文件路径
 * @param {string} uploadId 上传ID
 * @param {string} key S3对象键值，确保与初始化阶段一致
 * @returns {Promise<Object>} 中止上传结果响应对象
 */
export async function abortAdminMultipartUpload(path, uploadId, key) {
  return post(`/admin/fs/multipart/abort`, { path, uploadId, key });
}

/**
 * 初始化分片上传 - API密钥用户版本
 * @param {string} path 文件路径
 * @param {string} contentType 文件MIME类型
 * @param {number} fileSize 文件大小
 * @param {string} filename 文件名
 * @returns {Promise<Object>} 初始化结果响应对象
 */
export async function initUserMultipartUpload(path, contentType, fileSize, filename) {
  return post(`/user/fs/multipart/init`, { path, contentType, fileSize, filename });
}

/**
 * 上传分片 - API密钥用户版本
 * @param {string} path 文件路径
 * @param {string} uploadId 上传ID
 * @param {number} partNumber 分片编号
 * @param {Blob|ArrayBuffer} partData 分片数据
 * @param {boolean} isLastPart 是否为最后一个分片
 * @param {string} key S3对象键值，确保与初始化阶段一致
 * @param {Function} onXhrCreated 创建XHR对象后的回调，用于保存引用以便取消请求
 * @returns {Promise<Object>} 上传分片结果响应对象
 */
export async function uploadUserPart(path, uploadId, partNumber, partData, isLastPart = false, key, { onXhrCreated, timeout }) {
  const url = `/user/fs/multipart/part?path=${encodeURIComponent(path)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}&isLastPart=${isLastPart}${
      key ? `&key=${encodeURIComponent(key)}` : ""
  }`;
  return post(url, partData, {
    headers: { "Content-Type": "application/octet-stream" },
    rawBody: true,
    onXhrCreated,
    timeout,
  });
}

/**
 * 完成分片上传 - API密钥用户版本
 * @param {string} path 文件路径
 * @param {string} uploadId 上传ID
 * @param {Array<{partNumber: number, etag: string}>} parts 所有已上传分片的信息
 * @param {string} key S3对象键值，确保与初始化阶段一致
 * @param {string} contentType 文件MIME类型
 * @param {number} fileSize 文件大小（字节）
 * @returns {Promise<Object>} 完成上传结果响应对象
 */
export async function completeUserMultipartUpload(path, uploadId, parts, key, contentType, fileSize) {
  return post(`/user/fs/multipart/complete`, {
    path,
    uploadId,
    parts,
    key,
    contentType,
    fileSize,
  });
}

/**
 * 中止分片上传 - API密钥用户版本
 * @param {string} path 文件路径
 * @param {string} uploadId 上传ID
 * @param {string} key S3对象键值，确保与初始化阶段一致
 * @returns {Promise<Object>} 中止上传结果响应对象
 */
export async function abortUserMultipartUpload(path, uploadId, key) {
  return post(`/user/fs/multipart/abort`, { path, uploadId, key });
}

/**
 * 执行分片上传流程
 * @param {File} file 要上传的文件
 * @param {string} path 目标路径
 * @param {boolean} isAdmin 是否为管理员
 * @param {Function} onProgress 进度回调函数，参数为上传百分比
 * @param {Function} onCancel 取消检查函数，返回true时中止上传
 * @param {Function} onXhrCreated 创建XHR对象后的回调，用于保存引用以便取消请求
 * @returns {Promise<Object>} 上传结果
 */
export async function performMultipartUpload(file, path, isAdmin, onProgress = null, onCancel = null, onXhrCreated = null) {
  console.log(`开始分片上传流程，文件: ${file.name}, 大小: ${file.size} 字节, 路径: ${path}`);

  // 选择合适的API函数
  const initUpload = isAdmin ? initAdminMultipartUpload : initUserMultipartUpload;
  const uploadPart = isAdmin ? uploadAdminPart : uploadUserPart;
  const completeUpload = isAdmin ? completeAdminMultipartUpload : completeUserMultipartUpload;
  const abortUpload = isAdmin ? abortAdminMultipartUpload : abortUserMultipartUpload;

  let uploadId = null;
  let s3Key = null;

  try {
    // 步骤1: 初始化分片上传
    console.log(`初始化分片上传，文件: ${file.name}, 类型: ${file.type || "application/octet-stream"}`);
    const initResponse = await initUpload(path, file.type || "application/octet-stream", file.size, file.name);

    if (!initResponse.success) {
      console.error(`初始化分片上传失败:`, initResponse);
      throw new Error(initResponse.message || "初始化分片上传失败");
    }

    console.log(`分片上传初始化成功，uploadId: ${initResponse.data.uploadId}`);
    uploadId = initResponse.data.uploadId;
    s3Key = initResponse.data.key; // 保存S3对象键值，用于后续请求

    // 使用服务器推荐的分片大小，如果太大则使用较小值以避免Worker超时
    let recommendedPartSize = initResponse.data.recommendedPartSize || 5 * 1024 * 1024; // 默认5MB

    // 步骤2: 计算分片数
    const parts = [];
    const totalParts = Math.ceil(file.size / recommendedPartSize);
    let uploadedBytes = 0;

    console.log(`文件将被分成 ${totalParts} 个分片，每个分片大小约 ${recommendedPartSize / (1024 * 1024)} MB`);

    // 步骤3: 上传每个分片
    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      // 检查是否应该取消上传
      if (onCancel && onCancel()) {
        console.log(`上传被用户取消，中止上传过程`);
        await abortUpload(path, uploadId, s3Key);
        throw new Error("上传已取消");
      }

      // 计算当前分片的起始和结束位置
      const start = (partNumber - 1) * recommendedPartSize;
      const end = Math.min(partNumber * recommendedPartSize, file.size);
      const isLastPart = partNumber === totalParts;
      const partSize = end - start;

      // 创建分片数据
      const partData = file.slice(start, end);
      console.log(`上传分片 ${partNumber}/${totalParts}, 范围: ${start}-${end}, 大小: ${partSize} 字节${isLastPart ? " (最后一个分片)" : ""}`);

      try {
        // 上传分片
        const maxRetries = 3; // 最大重试次数
        let retryCount = 0;
        let partResponse;

        while (retryCount <= maxRetries) {
          try {
            partResponse = await uploadPart(path, uploadId, partNumber, partData, isLastPart, s3Key, {
              onXhrCreated: onXhrCreated,
              timeout: 300000, // 5分钟超时
            });

            // 如果成功就跳出循环
            break;
          } catch (err) {
            retryCount++;
            // 如果已经尝试了最大次数，抛出错误
            if (retryCount > maxRetries) {
              console.error(`上传分片 ${partNumber} 失败，已重试 ${maxRetries} 次:`, err);
              throw err;
            }
          }
        }

        if (!partResponse.success) {
          console.error(`上传分片 ${partNumber} 失败:`, partResponse);
          throw new Error(`上传第${partNumber}个分片失败: ${partResponse.message}`);
        }

        console.log(`分片 ${partNumber} 上传成功，ETag: ${partResponse.data.etag}`);

        // 记录分片信息
        parts.push({
          partNumber: partNumber,
          etag: partResponse.data.etag,
        });

        // 更新上传进度
        uploadedBytes += partSize;
        if (onProgress) {
          const percentage = Math.round((uploadedBytes / file.size) * 100);
          console.log(`上传进度: ${percentage}%`);
          onProgress(percentage);
        }
      } catch (partError) {
        console.error(`上传分片 ${partNumber} 时发生错误:`, partError);
        // 尝试中止上传，避免残留未完成的上传
        try {
          await abortUpload(path, uploadId, s3Key);
          console.log(`已中止上传: ${uploadId}`);
        } catch (abortError) {
          console.error(`中止上传失败: ${abortError.message}`);
        }
        throw partError; // 重新抛出错误供上层处理
      }
    }

    // 步骤4: 完成分片上传
    console.log(`所有分片上传完成，准备完成分片上传过程`);

    // 添加完成上传的重试机制
    let completeResponse;
    const maxCompletionRetries = 3;
    let completionRetryCount = 0;

    while (completionRetryCount <= maxCompletionRetries) {
      try {
        completeResponse = await completeUpload(
            path,
            uploadId,
            parts,
            s3Key,
            file.type || "application/octet-stream", // 添加文件类型
            file.size // 添加文件大小
        );
        break; // 成功则跳出循环
      } catch (err) {
        completionRetryCount++;
        // 如果已经尝试了最大次数，抛出错误
        if (completionRetryCount > maxCompletionRetries) {
          console.error(`完成分片上传失败，已重试 ${maxCompletionRetries} 次:`, err);
          throw err;
        }
      }
    }

    if (!completeResponse.success) {
      console.error(`完成分片上传失败:`, completeResponse);
      throw new Error(completeResponse.message || "完成分片上传失败");
    }

    console.log(`分片上传过程完成，文件: ${file.name}`);

    // 返回上传结果
    return completeResponse;
  } catch (error) {
    console.error(`分片上传过程中发生错误:`, error);

    // 如果有uploadId且失败，尝试中止上传
    if (uploadId) {
      try {
        await abortUpload(path, uploadId, s3Key);
        console.log(`已中止上传: ${uploadId}`);
      } catch (abortError) {
        console.error(`中止上传失败: ${abortError.message}`);
      }
    }

    throw error;
  }
}

/**
 * 获取预签名上传URL - 管理员版本
 * @param {string} path 目标路径
 * @param {string} fileName 文件名
 * @param {string} contentType 文件类型 MIME
 * @param {number} fileSize 文件大小（字节）
 * @returns {Promise<Object>} 预签名URL响应对象
 */
export async function getAdminPresignedUploadUrl(path, fileName, contentType, fileSize) {
  return post(`/admin/fs/presign`, {
    path,
    fileName,
    contentType,
    fileSize,
  });
}

/**
 * 获取预签名上传URL - API密钥用户版本
 * @param {string} path 目标路径
 * @param {string} fileName 文件名
 * @param {string} contentType 文件类型 MIME
 * @param {number} fileSize 文件大小（字节）
 * @returns {Promise<Object>} 预签名URL响应对象
 */
export async function getUserPresignedUploadUrl(path, fileName, contentType, fileSize) {
  return post(`/user/fs/presign`, {
    path,
    fileName,
    contentType,
    fileSize,
  });
}

/**
 * 使用预签名URL上传文件
 * @param {string} presignedUrl 预签名URL
 * @param {File} file 文件对象
 * @param {Function} onProgress 进度回调，参数为上传百分比(0-100)
 * @param {Function} onCancel 取消函数，返回true则中止上传
 * @returns {Promise<Object>} 上传结果，包含ETag
 */
export async function uploadWithPresignedUrl(presignedUrl, file, onProgress = null, onCancel = null) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // 监听上传进度
    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded * 100) / event.total);
          onProgress(percentage);
        }
      };
    }

    // 设置完成处理程序
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // 获取ETag响应头
        const etag = xhr.getResponseHeader("ETag");
        resolve({
          success: true,
          etag: etag ? etag.replace(/"/g, "") : null, // 移除引号
          status: xhr.status,
          response: xhr.responseText,
        });
      } else {
        reject(new Error(`上传失败: ${xhr.status} ${xhr.statusText}`));
      }
    };

    // 设置错误处理程序
    xhr.onerror = () => {
      reject(new Error("网络错误，上传失败"));
    };

    // 支持取消上传
    xhr.onabort = () => {
      reject(new Error("上传已取消"));
    };

    // 定期检查是否需要取消上传
    let cancelCheckInterval;
    if (onCancel) {
      cancelCheckInterval = setInterval(() => {
        if (onCancel()) {
          xhr.abort();
          clearInterval(cancelCheckInterval);
        }
      }, 500);
    }

    // 打开连接并发送请求
    xhr.open("PUT", presignedUrl, true);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}

/**
 * 提交预签名上传完成 - 管理员版本
 * @param {Object} uploadInfo 包含上传信息的对象(fileId, s3Path, s3Url, targetPath, s3ConfigId, mountId)
 * @param {string} etag 上传成功后的ETag
 * @param {string} contentType 文件MIME类型
 * @param {number} fileSize 文件大小（字节）
 * @returns {Promise<Object>} 提交结果响应对象
 */
export async function commitAdminPresignedUpload(uploadInfo, etag, contentType, fileSize) {
  return post(`/admin/fs/presign/commit`, {
    ...uploadInfo,
    etag,
    contentType,
    fileSize,
  });
}

/**
 * 提交预签名上传完成 - API密钥用户版本
 * @param {Object} uploadInfo 包含上传信息的对象(fileId, s3Path, s3Url, targetPath, s3ConfigId, mountId)
 * @param {string} etag 上传成功后的ETag
 * @param {string} contentType 文件MIME类型
 * @param {number} fileSize 文件大小（字节）
 * @returns {Promise<Object>} 提交结果响应对象
 */
export async function commitUserPresignedUpload(uploadInfo, etag, contentType, fileSize) {
  return post(`/user/fs/presign/commit`, {
    ...uploadInfo,
    etag,
    contentType,
    fileSize,
  });
}

/**
 * 执行完整的预签名URL上传流程
 * @param {File} file 要上传的文件
 * @param {string} path 目标路径
 * @param {boolean} isAdmin 是否为管理员
 * @param {Function} onProgress 进度回调函数，参数为上传百分比
 * @param {Function} onCancel 取消检查函数，返回true时中止上传
 * @returns {Promise<Object>} 上传结果
 */
export async function performPresignedUpload(file, path, isAdmin, onProgress = null, onCancel = null) {
  console.log(`开始预签名URL上传流程，文件: ${file.name}, 大小: ${file.size} 字节, 路径: ${path}`);

  // 选择合适的API函数
  const getPresignedUrl = isAdmin ? getAdminPresignedUploadUrl : getUserPresignedUploadUrl;
  const commitUpload = isAdmin ? commitAdminPresignedUpload : commitUserPresignedUpload;

  try {
    // 步骤1: 获取预签名URL
    console.log(`获取预签名URL，文件: ${file.name}, 类型: ${file.type || "application/octet-stream"}`);
    const urlResponse = await getPresignedUrl(path, file.name, file.type || "application/octet-stream", file.size);

    if (!urlResponse.success) {
      console.error(`获取预签名URL失败:`, urlResponse);
      throw new Error(urlResponse.message || "获取预签名URL失败");
    }

    const { presignedUrl, fileId, s3Path, s3Url, mountId, s3ConfigId, targetPath } = urlResponse.data;
    console.log(`获取预签名URL成功: ${presignedUrl.substring(0, 100)}...`);

    // 步骤2: 使用预签名URL上传文件
    console.log(`开始上传文件: ${file.name}`);
    const uploadResult = await uploadWithPresignedUrl(presignedUrl, file, onProgress, onCancel);

    if (!uploadResult.success) {
      console.error(`预签名URL上传失败:`, uploadResult);
      throw new Error("文件上传失败");
    }

    console.log(`文件上传成功，ETag: ${uploadResult.etag}`);

    // 步骤3: 提交上传完成信息
    const uploadInfo = { fileId, s3Path, s3Url, targetPath, s3ConfigId, mountId };
    const commitResult = await commitUpload(uploadInfo, uploadResult.etag, file.type || "application/octet-stream", file.size);

    if (!commitResult.success) {
      console.error(`提交上传完成信息失败:`, commitResult);
      throw new Error(commitResult.message || "提交上传完成信息失败");
    }

    console.log(`预签名URL上传全部完成: ${file.name}`);
    return {
      success: true,
      data: commitResult.data,
      message: "文件上传成功",
    };
  } catch (error) {
    console.error(`预签名URL上传错误:`, error);
    return {
      success: false,
      message: error.message || "上传过程中发生错误",
    };
  }
}
