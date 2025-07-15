/**
 * 文件系统服务API
 * 统一管理所有文件系统相关的API调用，包括管理员和API密钥用户的操作
 * 支持基础文件操作、分片上传、预签名URL上传、复制等功能
 */

import { get, post, del } from "../client";
import { API_BASE_URL } from "../config";

/******************************************************************************
 * 管理员(Admin)相关API函数
 ******************************************************************************/

/**
 * 管理员API - 获取目录列表
 * @param {string} path 请求路径
 * @returns {Promise<Object>} 目录列表响应对象
 */
export async function getAdminDirectoryList(path) {
  return get("/admin/fs/list", { params: { path } });
}

/**
 * 管理员API - 获取文件信息
 * @param {string} path 文件路径
 * @returns {Promise<Object>} 文件信息响应对象
 */
export async function getAdminFileInfo(path) {
  return get("/admin/fs/get", { params: { path } });
}

/**
 * 管理员API - 搜索文件
 * @param {string} query 搜索查询字符串
 * @param {Object} searchParams 搜索参数对象
 * @param {string} searchParams.scope 搜索范围 ('global', 'mount', 'directory')
 * @param {string} searchParams.mountId 挂载点ID（当scope为'mount'时）
 * @param {string} searchParams.path 搜索路径（当scope为'directory'时）
 * @param {number} searchParams.limit 结果限制数量，默认50
 * @param {number} searchParams.offset 结果偏移量，默认0
 * @returns {Promise<Object>} 搜索结果响应对象
 */
export async function searchAdminFiles(query, searchParams = {}) {
  const params = {
    q: query,
    scope: searchParams.scope || "global",
    limit: (searchParams.limit || 50).toString(),
    offset: (searchParams.offset || 0).toString(),
  };

  // 添加可选参数
  if (searchParams.mountId) {
    params.mount_id = searchParams.mountId;
  }
  if (searchParams.path) {
    params.path = searchParams.path;
  }

  return get("/admin/fs/search", { params });
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
  const params = new URLSearchParams({ path });
  return del(`/admin/fs/remove?${params.toString()}`);
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
 * @param {number|null} expiresIn 过期时间（秒），null表示使用S3配置的默认签名时间
 * @param {boolean} forceDownload 是否强制下载而非预览
 * @returns {Promise<Object>} 包含预签名URL的响应对象
 */
export async function getAdminFileLink(path, expiresIn = null, forceDownload = false) {
  const params = {
    path: path,
    force_download: forceDownload.toString(),
  };

  // 只有当expiresIn不为null时才添加expires_in参数
  if (expiresIn !== null) {
    params.expires_in = expiresIn.toString();
  }

  return get("/admin/fs/file-link", { params });
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
 * API密钥用户(User)相关API函数
 ******************************************************************************/

/**
 * API密钥用户API - 获取目录列表
 * @param {string} path 请求路径
 * @returns {Promise<Object>} 目录列表响应对象
 */
export async function getUserDirectoryList(path) {
  return get("/user/fs/list", { params: { path } });
}

/**
 * API密钥用户API - 获取文件信息
 * @param {string} path 文件路径
 * @returns {Promise<Object>} 文件信息响应对象
 */
export async function getUserFileInfo(path) {
  return get("/user/fs/get", { params: { path } });
}

/**
 * API密钥用户API - 搜索文件
 * @param {string} query 搜索查询字符串
 * @param {Object} searchParams 搜索参数对象
 * @param {string} searchParams.scope 搜索范围 ('global', 'mount', 'directory')
 * @param {string} searchParams.mountId 挂载点ID（当scope为'mount'时）
 * @param {string} searchParams.path 搜索路径（当scope为'directory'时）
 * @param {number} searchParams.limit 结果限制数量，默认50
 * @param {number} searchParams.offset 结果偏移量，默认0
 * @returns {Promise<Object>} 搜索结果响应对象
 */
export async function searchUserFiles(query, searchParams = {}) {
  const params = {
    q: query,
    scope: searchParams.scope || "global",
    limit: (searchParams.limit || 50).toString(),
    offset: (searchParams.offset || 0).toString(),
  };

  // 添加可选参数
  if (searchParams.mountId) {
    params.mount_id = searchParams.mountId;
  }
  if (searchParams.path) {
    params.path = searchParams.path;
  }

  return get("/user/fs/search", { params });
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
 * @param {boolean} useMultipart 是否使用服务器分片上传，默认为true
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
  const params = new URLSearchParams({ path });
  return del(`/user/fs/remove?${params.toString()}`);
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
 * @param {number|null} expiresIn 过期时间（秒），null表示使用S3配置的默认签名时间
 * @param {boolean} forceDownload 是否强制下载而非预览
 * @returns {Promise<Object>} 包含预签名URL的响应对象
 */
export async function getUserFileLink(path, expiresIn = null, forceDownload = false) {
  const params = {
    path: path,
    force_download: forceDownload.toString(),
  };

  // 只有当expiresIn不为null时才添加expires_in参数
  if (expiresIn !== null) {
    params.expires_in = expiresIn.toString();
  }

  return get("/user/fs/file-link", { params });
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

/******************************************************************************
 * 高级文件操作功能
 ******************************************************************************/

/**
 * 执行分片上传的完整流程
 * @param {File} file 要上传的文件
 * @param {string} path 目标路径
 * @param {boolean} isAdmin 是否为管理员
 * @param {Function} onProgress 进度回调函数，参数为(progress, loaded, total)
 * @param {Function} onCancel 取消检查函数，返回true时中止上传
 * @param {Function} onXhrCreated XHR创建后的回调，用于保存引用以便取消请求
 * @returns {Promise<Object>} 上传结果
 */
export async function performMultipartUpload(file, path, isAdmin, onProgress, onCancel, onXhrCreated) {
  const chunkSize = 5 * 1024 * 1024; // 5MB per chunk
  const totalChunks = Math.ceil(file.size / chunkSize);

  // 选择合适的API函数
  const initMultipartUpload = isAdmin ? initAdminMultipartUpload : initUserMultipartUpload;
  const uploadPart = isAdmin ? uploadAdminPart : uploadUserPart;
  const completeMultipartUpload = isAdmin ? completeAdminMultipartUpload : completeUserMultipartUpload;
  const abortMultipartUpload = isAdmin ? abortAdminMultipartUpload : abortUserMultipartUpload;

  let uploadId = null;
  let key = null;
  const uploadedParts = [];

  try {
    // 1. 初始化分片上传（后端会从文件名推断MIME类型，不依赖file.type）
    const initResult = await initMultipartUpload(path, null, file.size, file.name);
    if (!initResult.success) {
      throw new Error(initResult.message || "初始化分片上传失败");
    }

    uploadId = initResult.data.uploadId;
    key = initResult.data.key;

    // 2. 上传各个分片
    for (let i = 0; i < totalChunks; i++) {
      // 检查是否需要取消
      if (onCancel && onCancel()) {
        await abortMultipartUpload(path, uploadId, key);
        throw new Error("上传已取消");
      }

      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      const partNumber = i + 1;
      const isLastPart = i === totalChunks - 1;

      const partResult = await uploadPart(path, uploadId, partNumber, chunk, isLastPart, key, {
        onXhrCreated,
        timeout: 300000, // 5分钟超时
      });

      if (!partResult.success) {
        throw new Error(`上传分片 ${partNumber} 失败: ${partResult.message}`);
      }

      uploadedParts.push({
        partNumber,
        etag: partResult.data.etag,
      });

      // 更新进度
      if (onProgress) {
        const progress = Math.round(((i + 1) / totalChunks) * 100);
        onProgress(progress, end, file.size);
      }
    }

    // 3. 完成分片上传（后端会从文件名推断MIME类型，不依赖file.type）
    const completeResult = await completeMultipartUpload(path, uploadId, uploadedParts, key, null, file.size);

    if (!completeResult.success) {
      throw new Error(completeResult.message || "完成分片上传失败");
    }

    return completeResult;
  } catch (error) {
    // 如果有uploadId，尝试中止上传
    if (uploadId && key) {
      try {
        await abortMultipartUpload(path, uploadId, key);
      } catch (abortError) {
        console.error("中止分片上传失败:", abortError);
      }
    }
    throw error;
  }
}

/**
 * 使用预签名URL上传文件
 * @param {string} url 预签名URL
 * @param {File|Blob|ArrayBuffer} data 要上传的数据
 * @param {string} contentType 文件MIME类型
 * @param {Function} onProgress 进度回调函数
 * @param {Function} onCancel 取消检查函数
 * @param {Function} setXhr 设置XHR引用的函数
 * @returns {Promise<Object>} 上传结果，包含etag和size
 */
export async function uploadWithPresignedUrl(url, data, contentType, onProgress, onCancel, setXhr) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (setXhr) {
      setXhr(xhr);
    }

    // 设置进度监听
    if (onProgress) {
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress, event.loaded, event.total);
        }
      });
    }

    // 设置取消检查
    let cancelChecker;
    if (onCancel) {
      cancelChecker = setInterval(() => {
        if (onCancel()) {
          xhr.abort();
          clearInterval(cancelChecker);
          reject(new Error("上传已取消"));
        }
      }, 100);
    }

    xhr.onload = function () {
      if (cancelChecker) {
        clearInterval(cancelChecker);
      }

      if (xhr.status === 200) {
        const etag = xhr.getResponseHeader("ETag");
        resolve({
          etag: etag ? etag.replace(/"/g, "") : null,
          size: data.size || data.byteLength || 0,
        });
      } else {
        reject(new Error(`上传失败: HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = function () {
      if (cancelChecker) {
        clearInterval(cancelChecker);
      }
      reject(new Error("上传过程中发生网络错误"));
    };

    xhr.onabort = function () {
      if (cancelChecker) {
        clearInterval(cancelChecker);
      }
      reject(new Error("上传已取消"));
    };

    xhr.open("PUT", url);
    // 设置Content-Type头部，使用后端推断的正确MIME类型
    if (contentType && contentType !== null) {
      xhr.setRequestHeader("Content-Type", contentType);
    }
    xhr.send(data);
  });
}

/**
 * 执行预签名URL上传的完整流程
 * @param {File} file 要上传的文件
 * @param {string} path 目标路径
 * @param {boolean} isAdmin 是否为管理员
 * @param {Function} onProgress 进度回调函数
 * @param {Function} onCancel 取消检查函数
 * @param {Function} onXhrCreated xhr创建回调函数
 * @returns {Promise<Object>} 上传结果
 */
export async function performPresignedUpload(file, path, isAdmin, onProgress, onCancel, onXhrCreated) {
  // 选择合适的API函数
  const getPresignedUploadUrl = isAdmin ? getAdminPresignedUploadUrl : getUserPresignedUploadUrl;
  const commitPresignedUpload = isAdmin ? commitAdminPresignedUpload : commitUserPresignedUpload;

  let uploadXhr = null;

  try {
    // 1. 获取预签名URL（后端会从文件名推断正确的MIME类型）
    const urlResult = await getPresignedUploadUrl(path, file.name, file.type || "application/octet-stream", file.size);
    if (!urlResult.success) {
      throw new Error(urlResult.message || "获取预签名URL失败");
    }

    const { presignedUrl: uploadUrl, ...uploadInfo } = urlResult.data;

    // 2. 上传文件到预签名URL（使用后端推断的MIME类型）
    const uploadResult = await uploadWithPresignedUrl(uploadUrl, file, uploadInfo.contentType, onProgress, onCancel, (xhr) => {
      uploadXhr = xhr;
      // 如果提供了xhr创建回调，也调用它
      if (onXhrCreated) {
        onXhrCreated(xhr);
      }
    });

    // 3. 提交上传完成信息（后端会从文件名推断正确的MIME类型）
    const commitResult = await commitPresignedUpload(uploadInfo, uploadResult.etag, file.type || "application/octet-stream", file.size);

    if (!commitResult.success) {
      throw new Error(commitResult.message || "提交上传完成信息失败");
    }

    return commitResult;
  } catch (error) {
    // 如果是取消操作，中止XHR请求
    if (uploadXhr && error.message === "上传已取消") {
      uploadXhr.abort();
    }
    throw error;
  }
}

/**
 * 下载文件内容
 * @param {Object} options 下载选项
 * @param {string} options.url 下载URL
 * @param {Function} [options.onProgress] 进度回调函数
 * @param {Function} [options.onCancel] 取消检查函数
 * @param {Function} [options.setXhr] 设置XHR引用的函数
 * @returns {Promise<ArrayBuffer>} 文件内容
 */
export async function fetchFileContent(options) {
  const { url, onProgress, onCancel, setXhr } = options;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (setXhr) {
      setXhr(xhr);
    }

    // 设置响应类型为ArrayBuffer
    xhr.responseType = "arraybuffer";

    // 设置进度监听
    if (onProgress) {
      xhr.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress, event.loaded, event.total, "downloading");
        }
      });
    }

    // 设置取消检查
    let cancelChecker;
    if (onCancel) {
      cancelChecker = setInterval(() => {
        if (onCancel()) {
          xhr.abort();
          clearInterval(cancelChecker);
          reject(new Error("下载已取消"));
        }
      }, 100);
    }

    xhr.onload = function () {
      if (cancelChecker) {
        clearInterval(cancelChecker);
      }

      if (xhr.status === 200) {
        resolve(xhr.response);
      } else {
        reject(new Error(`下载失败: HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = function () {
      if (cancelChecker) {
        clearInterval(cancelChecker);
      }
      reject(new Error("下载过程中发生网络错误"));
    };

    xhr.onabort = function () {
      if (cancelChecker) {
        clearInterval(cancelChecker);
      }
      reject(new Error("下载已取消"));
    };

    xhr.open("GET", url);
    xhr.send();
  });
}

/**
 * 上传到预签名URL
 * @param {Object} options 上传选项
 * @param {string} options.url 预签名URL
 * @param {ArrayBuffer|Blob} options.data 要上传的数据
 * @param {string} options.contentType 文件MIME类型
 * @param {Function} [options.onProgress] 进度回调函数
 * @param {Function} [options.onCancel] 取消检查函数
 * @param {Function} [options.setXhr] 设置XHR引用的函数
 * @returns {Promise<Object>} 上传结果，包含etag和size
 */
export async function uploadToPresignedUrl(options) {
  const { url, data, contentType, onProgress, onCancel, setXhr } = options;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (setXhr) {
      setXhr(xhr);
    }

    // 设置进度监听
    if (onProgress) {
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress, event.loaded, event.total, "uploading");
        }
      });
    }

    // 设置取消检查
    let cancelChecker;
    if (onCancel) {
      cancelChecker = setInterval(() => {
        if (onCancel()) {
          xhr.abort();
          clearInterval(cancelChecker);
          reject(new Error("上传已取消"));
        }
      }, 100);
    }

    xhr.onload = function () {
      if (cancelChecker) {
        clearInterval(cancelChecker);
      }

      if (xhr.status === 200) {
        const etag = xhr.getResponseHeader("ETag");
        resolve({
          etag: etag ? etag.replace(/"/g, "") : null,
          size: data.size || data.byteLength || 0,
        });
      } else {
        reject(new Error(`上传失败: HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = function () {
      if (cancelChecker) {
        clearInterval(cancelChecker);
      }
      reject(new Error("上传过程中发生网络错误"));
    };

    xhr.onabort = function () {
      if (cancelChecker) {
        clearInterval(cancelChecker);
      }
      reject(new Error("上传已取消"));
    };

    xhr.open("PUT", url);
    // 设置Content-Type头部，使用后端推断的正确MIME类型
    if (contentType && contentType !== null) {
      xhr.setRequestHeader("Content-Type", contentType);
    }
    xhr.send(data);
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
          onProgress: (progress, loaded, total) => {
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
          onProgress: (progress, loaded, total) => {
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
        onProgress: (progress, loaded, total) => {
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
        onProgress: (progress, loaded, total) => {
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
        searchFiles: searchAdminFiles,
        getFileDownloadUrl: getAdminFileDownloadUrl,
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
        performPresignedUpload: (file, path, onProgress, onCancel, onXhrCreated) => performPresignedUpload(file, path, true, onProgress, onCancel, onXhrCreated),
        // 复制完成信息
        commitCopy: commitAdminCopy,
        commitBatchCopy: commitAdminBatchCopy,
      }
      : {
        getDirectoryList: getUserDirectoryList,
        getFileInfo: getUserFileInfo,
        searchFiles: searchUserFiles,
        getFileDownloadUrl: getUserFileDownloadUrl,
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
        performPresignedUpload: (file, path, onProgress, onCancel, onXhrCreated) => performPresignedUpload(file, path, false, onProgress, onCancel, onXhrCreated),
        // 复制完成信息
        commitCopy: commitUserCopy,
        commitBatchCopy: commitUserBatchCopy,
      };
}

/******************************************************************************
 * 兼容性导出 - 保持向后兼容
 ******************************************************************************/

// 兼容性导出 - 保持向后兼容
export const getDirectoryList = getAdminDirectoryList;
export const getFileInfo = getAdminFileInfo;
export const getFileDownloadUrl = getAdminFileDownloadUrl;
export const createDirectory = createAdminDirectory;
export const uploadFile = uploadAdminFile;
export const deleteItem = deleteAdminItem;
export const batchDeleteItems = batchDeleteAdminItems;
export const renameItem = renameAdminItem;
export const updateFile = updateAdminFile;
export const getFileLink = getAdminFileLink;
