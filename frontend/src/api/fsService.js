import { get, post, put, del } from "./client";
import { API_BASE_URL } from "./config";

/******************************************************************************
 * 管理员(Admin)相关API函数
 ******************************************************************************/

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
 * 管理员API - 更新文件内容
 * @param {string} path 文件路径
 * @param {string} content 新的文件内容
 * @returns {Promise<Object>} 更新结果响应对象
 */
export async function updateAdminFile(path, content) {
  return post(`/admin/fs/update`, { path, content });
}

/**
 * 管理员API - 获取文件直链
 * @param {string} path 文件路径
 * @param {number} expiresIn 过期时间（秒），默认7天
 * @param {boolean} forceDownload 是否强制下载而非预览
 * @returns {Promise<Object>} 包含预签名URL的响应对象
 */
export async function getAdminFileLink(path, expiresIn = 604800, forceDownload = false) {
  return get(`/admin/fs/file-link?path=${encodeURIComponent(path)}&expires_in=${expiresIn}&force_download=${forceDownload}`);
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
 * 管理员API - 批量复制文件或目录
 * @param {Array<{sourcePath: string, targetPath: string}>} items 要复制的项目数组，每项包含源路径和目标路径
 * @param {boolean} skipExisting 是否跳过已存在的文件，默认为true
 * @param {Object} options 额外选项
 * @param {Function} [options.onProgress] 进度回调函数
 * @param {Function} [options.onCancel] 取消检查函数
 * @returns {Promise<Object>} 批量复制结果响应对象
 */
export async function batchCopyAdminItems(items, skipExisting = true, options = {}) {
  const { onProgress, onCancel } = options;

  // 首先调用服务器批量复制API
  const result = await post(`/admin/fs/batch-copy`, { items, skipExisting });

  // 检查是否需要客户端处理的跨存储复制
  if (result.success && result.data && result.data.requiresClientSideCopy) {
    console.log("检测到需要客户端处理的批量跨存储复制", result.data);

    // 执行客户端复制流程
    return performClientSideCopy({
      isAdmin: true,
      copyResult: result.data,
      onProgress,
      onCancel,
    });
  }

  // 正常的服务器端复制，直接返回结果
  return result;
}

/**
 * 提交批量复制完成信息 - 管理员版本
 * @param {Object} data - 批量复制完成数据
 * @param {string} data.targetMountId - 目标挂载点ID
 * @param {Array<Object>} data.files - 文件列表，每个对象包含 {targetPath, s3Path, contentType?, fileSize?, etag?}
 * @returns {Promise<Object>} 提交结果响应对象
 */
export async function commitAdminBatchCopy(data) {
  return post(`/admin/fs/batch-copy-commit`, data);
}

/******************************************************************************
 * API密钥用户API函数
 ******************************************************************************/

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
 * API密钥用户API - 更新文件内容
 * @param {string} path 文件路径
 * @param {string} content 新的文件内容
 * @returns {Promise<Object>} 更新结果响应对象
 */
export async function updateUserFile(path, content) {
  return post(`/user/fs/update`, { path, content });
}

/**
 * API密钥用户API - 获取文件直链
 * @param {string} path 文件路径
 * @param {number} expiresIn 过期时间（秒），默认7天
 * @param {boolean} forceDownload 是否强制下载而非预览
 * @returns {Promise<Object>} 包含预签名URL的响应对象
 */
export async function getUserFileLink(path, expiresIn = 604800, forceDownload = false) {
  return get(`/user/fs/file-link?path=${encodeURIComponent(path)}&expires_in=${expiresIn}&force_download=${forceDownload}`);
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
 * API密钥用户API - 批量复制文件或目录
 * @param {Array<{sourcePath: string, targetPath: string}>} items 要复制的项目数组，每项包含源路径和目标路径
 * @param {boolean} skipExisting 是否跳过已存在的文件，默认为true
 * @param {Object} options 额外选项
 * @param {Function} [options.onProgress] 进度回调函数
 * @param {Function} [options.onCancel] 取消检查函数
 * @returns {Promise<Object>} 批量复制结果响应对象
 */
export async function batchCopyUserItems(items, skipExisting = true, options = {}) {
  const { onProgress, onCancel } = options;

  // 首先调用服务器批量复制API
  const result = await post(`/user/fs/batch-copy`, { items, skipExisting });

  // 检查是否需要客户端处理的跨存储复制
  if (result.success && result.data && result.data.requiresClientSideCopy) {
    console.log("检测到需要客户端处理的批量跨存储复制", result.data);

    // 执行客户端复制流程
    return performClientSideCopy({
      isAdmin: false,
      copyResult: result.data,
      onProgress,
      onCancel,
    });
  }

  // 正常的服务器端复制，直接返回结果
  return result;
}

/**
 * 提交批量复制完成信息 - API密钥用户版本
 * @param {Object} data - 批量复制完成数据
 * @param {string} data.targetMountId - 目标挂载点ID
 * @param {Array<Object>} data.files - 文件列表，每个对象包含 {targetPath, s3Path, contentType?, fileSize?, etag?}
 * @returns {Promise<Object>} 提交结果响应对象
 */
export async function commitUserBatchCopy(data) {
  return post(`/user/fs/batch-copy-commit`, data);
}

/******************************************************************************
 * 辅助函数
 ******************************************************************************/

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

    // 取消检查
    if (onCancel) {
      const cancelInterval = setInterval(() => {
        if (onCancel()) {
          xhr.abort();
          clearInterval(cancelInterval);
          reject(new Error("上传已取消"));
        }
      }, 100);

      // 确保在请求完成后清除定时器
      xhr.onloadend = () => clearInterval(cancelInterval);
    }

    // 打开连接并发送请求
    xhr.open("PUT", presignedUrl, true);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
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

/**
 * 管理员API - 复制文件或目录
 * @param {string} sourcePath 源路径
 * @param {string} targetPath 目标路径
 * @param {boolean} skipExisting 是否跳过已存在的文件，默认为true
 * @param {Object} options 额外选项
 * @param {Function} [options.onProgress] 进度回调函数
 * @param {Function} [options.onCancel] 取消检查函数
 * @returns {Promise<Object>} 复制结果响应对象
 */
export async function copyAdminItem(sourcePath, targetPath, skipExisting = true, options = {}) {
  // 将单文件复制转换为批量复制格式
  const items = [{ sourcePath, targetPath }];
  return batchCopyAdminItems(items, skipExisting, options);
}

/**
 * API密钥用户API - 复制文件或目录
 * @param {string} sourcePath 源路径
 * @param {string} targetPath 目标路径
 * @param {boolean} skipExisting 是否跳过已存在的文件，默认为true
 * @param {Object} options 额外选项
 * @param {Function} [options.onProgress] 进度回调函数
 * @param {Function} [options.onCancel] 取消检查函数
 * @returns {Promise<Object>} 复制结果响应对象
 */
export async function copyUserItem(sourcePath, targetPath, skipExisting = true, options = {}) {
  // 将单文件复制转换为批量复制格式
  const items = [{ sourcePath, targetPath }];
  return batchCopyUserItems(items, skipExisting, options);
}

/**
 * 使用预签名URL下载文件内容
 * @param {Object} options - 下载选项
 * @param {string} options.url - 预签名下载URL
 * @param {Function} [options.onProgress] - 进度回调，参数为(progress, loaded, total)
 * @param {Function} [options.onCancel] - 取消检查函数，返回true时中止下载
 * @param {Function} [options.setXhr] - 设置xhr引用的回调函数，用于取消请求
 * @returns {Promise<Blob>} 获取到的文件内容
 */
export async function fetchFileContent(options) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", options.url);
    xhr.responseType = "blob";

    // 设置XHR引用，用于可能的取消操作
    if (options.setXhr) {
      options.setXhr(xhr);
    }

    // 进度事件
    xhr.onprogress = (event) => {
      if (event.lengthComputable && options.onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        options.onProgress(progress, event.loaded, event.total, "downloading");
      }
    };

    // 取消检查
    if (options.onCancel) {
      const cancelInterval = setInterval(() => {
        if (options.onCancel()) {
          xhr.abort();
          clearInterval(cancelInterval);
          reject(new Error("下载已取消"));
        }
      }, 100);

      // 确保在请求完成后清除定时器
      xhr.onloadend = () => clearInterval(cancelInterval);
    }

    xhr.onerror = () => {
      reject(new Error("下载文件内容失败"));
    };

    xhr.onabort = () => {
      reject(new Error("下载已取消"));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response);
      } else {
        reject(new Error(`下载文件内容失败: HTTP ${xhr.status} ${xhr.statusText}`));
      }
    };

    xhr.send();
  });
}

/**
 * 使用预签名URL上传文件内容到S3
 * @param {Object} options - 上传选项
 * @param {Blob|File|ArrayBuffer} options.data - 要上传的文件内容
 * @param {string} options.url - 预签名上传URL
 * @param {Function} [options.onProgress] - 进度回调，参数为(progress, loaded, total)
 * @param {Function} [options.onCancel] - 取消检查函数，返回true时中止上传
 * @param {Function} [options.setXhr] - 设置xhr引用的回调函数，用于取消请求
 * @param {string} [options.contentType] - 内容类型，默认为application/octet-stream
 * @returns {Promise<Object>} 上传结果，包含ETag
 */
export async function uploadToPresignedUrl(options) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", options.url);
    xhr.responseType = "text";

    // 设置Content-Type
    const contentType = options.contentType || "application/octet-stream";
    xhr.setRequestHeader("Content-Type", contentType);

    // 设置XHR引用，用于可能的取消操作
    if (options.setXhr) {
      options.setXhr(xhr);
    }

    // 进度事件
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && options.onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        options.onProgress(progress, event.loaded, event.total, "uploading");
      }
    };

    // 取消检查
    if (options.onCancel) {
      const cancelInterval = setInterval(() => {
        if (options.onCancel()) {
          xhr.abort();
          clearInterval(cancelInterval);
          reject(new Error("上传已取消"));
        }
      }, 100);

      // 确保在请求完成后清除定时器
      xhr.onloadend = () => clearInterval(cancelInterval);
    }

    xhr.onerror = () => {
      reject(new Error("上传文件内容失败"));
    };

    xhr.onabort = () => {
      reject(new Error("上传已取消"));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // 获取ETag
        const etag = xhr.getResponseHeader("ETag");
        resolve({
          success: true,
          etag: etag ? etag.replace(/"/g, "") : null, // 移除引号
          size: options.data.size || (options.data.byteLength ? options.data.byteLength : 0),
        });
      } else {
        reject(new Error(`上传文件内容失败: HTTP ${xhr.status} ${xhr.statusText}`));
      }
    };

    xhr.send(options.data);
  });
}

/**
 * 提交复制完成信息 - 管理员版本
 * @param {Object} data - 复制完成数据
 * @param {string} data.sourcePath - 源文件路径
 * @param {string} data.targetPath - 目标文件路径
 * @param {string} data.targetMountId - 目标挂载点ID
 * @param {string} data.s3Path - S3存储路径
 * @param {string} [data.etag] - 文件ETag（可选）
 * @param {string} [data.contentType] - 文件MIME类型（可选）
 * @param {number} [data.fileSize] - 文件大小（字节）（可选）
 * @returns {Promise<Object>} 提交结果响应对象
 */
export async function commitAdminCopy(data) {
  // 将单文件提交转换为批量提交格式
  return commitAdminBatchCopy({
    targetMountId: data.targetMountId,
    files: [
      {
        targetPath: data.targetPath,
        s3Path: data.s3Path,
        contentType: data.contentType,
        fileSize: data.fileSize,
        etag: data.etag,
      },
    ],
  });
}

/**
 * 提交复制完成信息 - API密钥用户版本
 * @param {Object} data - 复制完成数据
 * @param {string} data.sourcePath - 源文件路径
 * @param {string} data.targetPath - 目标文件路径
 * @param {string} data.targetMountId - 目标挂载点ID
 * @param {string} data.s3Path - S3存储路径
 * @param {string} [data.etag] - 文件ETag（可选）
 * @param {string} [data.contentType] - 文件MIME类型（可选）
 * @param {number} [data.fileSize] - 文件大小（字节）（可选）
 * @returns {Promise<Object>} 提交结果响应对象
 */
export async function commitUserCopy(data) {
  // 将单文件提交转换为批量提交格式
  return commitUserBatchCopy({
    targetMountId: data.targetMountId,
    files: [
      {
        targetPath: data.targetPath,
        s3Path: data.s3Path,
        contentType: data.contentType,
        fileSize: data.fileSize,
        etag: data.etag,
      },
    ],
  });
}

/**
 * 执行客户端复制流程
 * @param {Object} options - 复制选项
 * @param {boolean} options.isAdmin - 是否为管理员
 * @param {Object} options.copyResult - 初始复制请求的结果，包含下载URL和上传URL等信息
 * @param {Function} [options.onProgress] - 进度回调，参数为(phase, progress)，phase可能是"downloading"或"uploading"
 * @param {Function} [options.onCancel] - 取消检查函数，返回true时中止操作
 * @returns {Promise<Object>} 复制结果
 */
export async function performClientSideCopy(options) {
  const { isAdmin, copyResult, onProgress, onCancel } = options;

  console.log(`开始客户端复制流程`, copyResult);

  // 选择合适的API函数
  const commitBatchCopy = isAdmin ? commitAdminBatchCopy : commitUserBatchCopy;

  // 设置下载和上传的XHR引用，用于可能的取消操作
  let downloadXhr = null;
  let uploadXhr = null;

  try {
    // 检查是否是批量跨存储复制结果（包含crossStorageResults字段）
    if (copyResult.crossStorageResults && Array.isArray(copyResult.crossStorageResults)) {
      console.log("处理批量跨存储复制结果", copyResult.crossStorageResults);

      // 处理多个文件和目录的复制
      // 1. 收集所有需要处理的文件项
      let allItems = [];
      let targetMount = null;

      // 遍历所有的crossStorageResults项
      for (const result of copyResult.crossStorageResults) {
        if (result.items && result.items.length > 0) {
          // 如果是目录，添加其中的所有文件
          allItems = allItems.concat(result.items);
          if (!targetMount) {
            targetMount = result.targetMount;
          }
        } else {
          // 如果是单文件，直接添加
          allItems.push(result);
          if (!targetMount) {
            targetMount = result.targetMount;
          }
        }
      }

      console.log(`收集到总共 ${allItems.length} 个文件需要处理`);

      if (allItems.length === 0) {
        return {
          success: false,
          message: "没有找到需要复制的文件",
        };
      }

      // 如果只有一个文件，使用单文件复制逻辑
      if (allItems.length === 1 && !allItems[0].items) {
        const singleFileCopy = allItems[0];
        console.log(`下载源文件: ${singleFileCopy.fileName || "未知文件"}`);
        const fileContent = await fetchFileContent({
          url: singleFileCopy.downloadUrl,
          onProgress: (progress, loaded, total, phase) => {
            if (onProgress) {
              // 下载阶段提供更详细的进度信息
              onProgress("downloading", progress, {
                loaded,
                total,
                percentage: progress,
              });
            }
          },
          onCancel,
          setXhr: (xhr) => {
            downloadXhr = xhr;
          },
        });

        // 上传文件内容到目标位置
        console.log(`上传到目标位置: ${singleFileCopy.targetS3Path || singleFileCopy.targetKey}`);
        const uploadResult = await uploadToPresignedUrl({
          url: singleFileCopy.uploadUrl,
          data: fileContent,
          contentType: singleFileCopy.contentType || "application/octet-stream",
          onProgress: (progress, loaded, total, phase) => {
            if (onProgress) {
              // 上传阶段提供更详细的进度信息
              onProgress("uploading", progress, {
                loaded,
                total,
                percentage: progress,
              });
            }
          },
          onCancel,
          setXhr: (xhr) => {
            uploadXhr = xhr;
          },
        });

        // 提交复制完成信息（使用批量提交接口）
        console.log(`提交复制完成信息`);
        const commitResult = await commitBatchCopy({
          targetMountId: singleFileCopy.targetMount,
          files: [
            {
              targetPath: singleFileCopy.targetPath,
              s3Path: singleFileCopy.targetS3Path || singleFileCopy.targetKey,
              contentType: singleFileCopy.contentType,
              fileSize: uploadResult.size,
              etag: uploadResult.etag,
            },
          ],
        });

        if (!commitResult.success) {
          throw new Error(commitResult.message || "提交复制完成信息失败");
        }

        console.log(`复制完成: ${singleFileCopy.targetPath}`);
        return {
          success: true,
          message: "文件复制成功",
          data: commitResult.data,
        };
      } else {
        // 处理多个文件的复制，使用handleDirectoryCopy函数
        return await handleDirectoryCopy(
          {
            items: allItems,
            targetMount: targetMount,
          },
          commitBatchCopy,
          onProgress,
          onCancel
        );
      }
    }
    // 检查是否是目录复制（有items数组）
    else if (copyResult.isDirectory && copyResult.items && copyResult.items.length > 0) {
      // 处理目录复制
      return await handleDirectoryCopy(copyResult, commitBatchCopy, onProgress, onCancel);
    } else {
      // 处理单文件复制
      // 下载文件内容
      console.log(`下载源文件: ${copyResult.fileName || "未知文件"}`);
      const fileContent = await fetchFileContent({
        url: copyResult.downloadUrl,
        onProgress: (progress, loaded, total, phase) => {
          if (onProgress) {
            // 下载阶段提供更详细的进度信息
            onProgress("downloading", progress, {
              loaded,
              total,
              percentage: progress,
            });
          }
        },
        onCancel,
        setXhr: (xhr) => {
          downloadXhr = xhr;
        },
      });

      // 上传文件内容到目标位置
      console.log(`上传到目标位置: ${copyResult.targetS3Path || copyResult.targetKey}`);
      const uploadResult = await uploadToPresignedUrl({
        url: copyResult.uploadUrl,
        data: fileContent,
        contentType: copyResult.contentType || "application/octet-stream",
        onProgress: (progress, loaded, total, phase) => {
          if (onProgress) {
            // 上传阶段提供更详细的进度信息
            onProgress("uploading", progress, {
              loaded,
              total,
              percentage: progress,
            });
          }
        },
        onCancel,
        setXhr: (xhr) => {
          uploadXhr = xhr;
        },
      });

      // 提交复制完成信息（使用批量提交接口）
      console.log(`提交复制完成信息`);
      const commitResult = await commitBatchCopy({
        targetMountId: copyResult.targetMount,
        files: [
          {
            targetPath: copyResult.targetPath,
            s3Path: copyResult.targetS3Path || copyResult.targetKey,
            contentType: copyResult.contentType,
            fileSize: uploadResult.size,
            etag: uploadResult.etag,
          },
        ],
      });

      if (!commitResult.success) {
        throw new Error(commitResult.message || "提交复制完成信息失败");
      }

      console.log(`复制完成: ${copyResult.targetPath}`);
      return {
        success: true,
        message: "文件复制成功",
        data: commitResult.data,
      };
    }
  } catch (error) {
    console.error(`客户端复制过程中发生错误:`, error);

    // 如果是取消操作，不需要额外处理
    if (error.message === "下载已取消" || error.message === "上传已取消") {
      return {
        success: false,
        message: "复制已取消",
        cancelled: true,
      };
    }

    return {
      success: false,
      message: error.message || "复制过程中发生错误",
    };
  }
}

/**
 * 处理目录复制
 * @param {Object} copyResult - 初始复制请求的结果
 * @param {Function} commitBatchCopy - 提交批量复制的函数
 * @param {Function} [onProgress] - 进度回调函数
 * @param {Function} [onCancel] - 取消检查函数
 * @returns {Promise<Object>} 复制结果
 * @private
 */
async function handleDirectoryCopy(copyResult, commitBatchCopy, onProgress, onCancel) {
  const { items, targetMount } = copyResult;
  const totalItems = items.length;
  let completedItems = 0;
  let failedItems = [];
  let successfulFiles = [];

  // 设置下载和上传的XHR引用
  let currentXhr = null;

  // 取消标志
  let isCancelled = false;
  if (onCancel) {
    const cancelChecker = setInterval(() => {
      if (onCancel()) {
        isCancelled = true;
        if (currentXhr) {
          currentXhr.abort();
        }
        clearInterval(cancelChecker);
      }
    }, 100);
  }

  console.log(`开始处理目录复制，共 ${totalItems} 个文件`);

  // 处理每个文件
  for (const item of items) {
    if (isCancelled) {
      console.log(`复制已取消，停止处理剩余文件`);
      break;
    }

    try {
      // 下载文件内容
      console.log(`下载源文件: ${item.fileName || item.sourceKey}`);
      const fileContent = await fetchFileContent({
        url: item.downloadUrl,
        onProgress: (progress) => {
          if (onProgress) {
            // 计算总体进度
            const itemProgress = (completedItems / totalItems) * 100;
            // 提供更详细的进度信息
            onProgress("downloading", progress, {
              currentFile: item.fileName || item.sourceKey,
              currentFileProgress: progress,
              totalProgress: itemProgress + progress / totalItems,
              processedFiles: completedItems,
              totalFiles: totalItems,
              percentage: Math.round(itemProgress + progress / totalItems),
            });
          }
        },
        setXhr: (xhr) => {
          currentXhr = xhr;
        },
      });

      if (isCancelled) break;

      // 上传文件内容
      const targetLocation = item.targetS3Path || item.targetKey;
      console.log(`上传到目标位置: ${targetLocation}`);
      const uploadResult = await uploadToPresignedUrl({
        url: item.uploadUrl,
        data: fileContent,
        contentType: item.contentType || "application/octet-stream",
        onProgress: (progress) => {
          if (onProgress) {
            // 计算总体进度
            const itemProgress = (completedItems / totalItems) * 100;
            // 提供更详细的进度信息
            onProgress("uploading", progress, {
              currentFile: item.fileName || item.sourceKey,
              currentFileProgress: progress,
              totalProgress: itemProgress + progress / totalItems,
              processedFiles: completedItems,
              totalFiles: totalItems,
              percentage: Math.round(itemProgress + progress / totalItems),
            });
          }
        },
        setXhr: (xhr) => {
          currentXhr = xhr;
        },
      });

      // 记录成功的文件信息，稍后批量提交
      successfulFiles.push({
        targetPath: item.targetPath || item.targetKey,
        s3Path: item.targetS3Path || item.targetKey,
        contentType: item.contentType || "application/octet-stream",
        fileSize: uploadResult.size,
        etag: uploadResult.etag,
      });

      completedItems++;
    } catch (error) {
      console.error(`处理文件时出错:`, error);
      failedItems.push({
        sourceKey: item.sourceKey,
        targetKey: item.targetKey,
        error: error.message || "未知错误",
      });
    }
  }

  // 如果已取消，返回相应结果
  if (isCancelled) {
    return {
      success: false,
      message: "目录复制已取消",
      cancelled: true,
      completed: completedItems,
      total: totalItems,
      failed: failedItems,
    };
  }

  // 如果有成功复制的文件，提交批量复制信息
  if (successfulFiles.length > 0) {
    try {
      console.log(`提交批量复制完成信息，共 ${successfulFiles.length} 个文件`);
      const commitResult = await commitBatchCopy({
        targetMountId: targetMount,
        files: successfulFiles,
      });

      if (!commitResult.success) {
        throw new Error(commitResult.message || "提交批量复制完成信息失败");
      }

      return {
        success: true,
        message: `目录复制完成，成功: ${successfulFiles.length}，失败: ${failedItems.length}`,
        data: {
          success: successfulFiles.length,
          failed: failedItems,
          total: totalItems,
        },
      };
    } catch (error) {
      console.error(`提交批量复制完成信息失败:`, error);
      return {
        success: false,
        message: error.message || "提交批量复制完成信息失败",
        data: {
          success: successfulFiles.length,
          failed: [...failedItems, { error: error.message || "提交批量复制完成信息失败" }],
          total: totalItems,
        },
      };
    }
  } else {
    return {
      success: false,
      message: "没有文件成功复制",
      data: {
        success: 0,
        failed: failedItems,
        total: totalItems,
      },
    };
  }
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
        getFileLink: getAdminFileLink,
        createDirectory: createAdminDirectory,
        uploadFile: uploadAdminFile,
        deleteItem: deleteAdminItem,
        batchDeleteItems: batchDeleteAdminItems,
        renameItem: renameAdminItem,
        updateFile: updateAdminFile,
        // 复制相关
        copyItem: copyAdminItem,
        batchCopyItems: batchCopyAdminItems,
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
        // 复制完成信息
        commitCopy: commitAdminCopy,
        commitBatchCopy: commitAdminBatchCopy,
      }
    : {
        getDirectoryList: getUserDirectoryList,
        getFileInfo: getUserFileInfo,
        getFileDownloadUrl: getUserFileDownloadUrl,
        getFilePreviewUrl: getUserFilePreviewUrl,
        getFileLink: getUserFileLink,
        createDirectory: createUserDirectory,
        uploadFile: uploadUserFile,
        deleteItem: deleteUserItem,
        batchDeleteItems: batchDeleteUserItems,
        renameItem: renameUserItem,
        updateFile: updateUserFile,
        // 复制相关
        copyItem: copyUserItem,
        batchCopyItems: batchCopyUserItems,
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
        // 复制完成信息
        commitCopy: commitUserCopy,
        commitBatchCopy: commitUserBatchCopy,
      };
}
