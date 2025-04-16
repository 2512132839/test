/**
 * WebDAV错误处理工具函数
 * 提供统一的错误日志记录和响应创建功能
 */

/**
 * 生成唯一错误ID
 * @returns {string} 错误ID
 */
export function generateErrorId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * 记录WebDAV操作错误并创建统一的错误响应
 * @param {string} operation - 操作名称，如 "GET", "PUT" 等
 * @param {Error} error - 错误对象
 * @param {boolean} [includeDetails=false] - 是否在响应中包含错误详细信息（仅用于开发环境）
 * @returns {Response} 格式化的错误响应
 */
export function handleWebDAVError(operation, error, includeDetails = false) {
  // 生成唯一错误ID
  const errorId = generateErrorId();

  // 记录错误信息
  console.error(`WebDAV ${operation} 操作错误 [${errorId}]:`, error);

  // 特殊处理S3的404错误
  if (error.$metadata && error.$metadata.httpStatusCode === 404) {
    return new Response("文件或目录不存在", {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // 创建安全的错误响应
  const errorMessage = includeDetails ? `内部服务器错误: ${error.message} (错误ID: ${errorId})` : `内部服务器错误 (错误ID: ${errorId})`;

  return new Response(errorMessage, {
    status: 500,
    headers: { "Content-Type": "text/plain" },
  });
}

/**
 * 创建WebDAV错误响应
 * @param {string} message - 错误消息
 * @param {number} status - HTTP状态码
 * @returns {Response} 错误响应
 */
export function createWebDAVErrorResponse(message, status) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain" },
  });
}
