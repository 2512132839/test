/**
 * 通用工具函数
 */

/**
 * 生成随机字符串
 * @param {number} length - 字符串长度
 * @returns {string} 随机字符串
 */
export function generateRandomString(length = 8) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  randomValues.forEach((val) => (result += chars[val % chars.length]));
  return result;
}

/**
 * 统一错误响应工具函数
 * @param {number} statusCode - HTTP状态码
 * @param {string} message - 错误消息
 * @returns {object} 标准错误响应对象
 */
export function createErrorResponse(statusCode, message) {
  return {
    code: statusCode,
    message: message,
    success: false,
    data: null,
  };
}

/**
 * 获取当前时间的本地格式化字符串，用于数据库时间字段
 * @returns {string} 格式化的本地时间字符串，如：'2023-06-01 14:30:45'
 */
export function getLocalTimeString() {
  // 创建一个基于UTC时间的Date对象
  const now = new Date();

  // 调整为UTC+8时区（中国标准时间）
  // 获取当前UTC时间的毫秒数
  const utcTime = now.getTime();
  // 获取本地时区与UTC的时差（分钟）
  const localTimezoneOffset = now.getTimezoneOffset();
  // UTC+8时区比UTC快8小时，即480分钟
  const cstTimezoneOffset = -480;
  // 计算需要调整的时差（分钟）
  const timeDifference = (localTimezoneOffset - cstTimezoneOffset) * 60 * 1000;
  // 创建调整后的时间对象
  const cstTime = new Date(utcTime + timeDifference);

  // 从CST时间对象中提取各个部分
  const year = cstTime.getFullYear();
  const month = String(cstTime.getMonth() + 1).padStart(2, "0");
  const day = String(cstTime.getDate()).padStart(2, "0");
  const hours = String(cstTime.getHours()).padStart(2, "0");
  const minutes = String(cstTime.getMinutes()).padStart(2, "0");
  const seconds = String(cstTime.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 格式化文件大小
 * @param {number} bytes 文件大小（字节）
 * @returns {string} 格式化后的文件大小
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";

  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return (bytes / Math.pow(1024, i)).toFixed(2) + " " + sizes[i];
}

/**
 * 处理每周数据，确保有7天的数据
 * @param {Array} data - 包含日期和数量的数据
 * @returns {Array} 处理后的数据
 */
export function processWeeklyData(data) {
  const result = new Array(7).fill(0);

  if (!data || data.length === 0) return result;

  // 获取过去7天的日期
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split("T")[0]); // 格式：YYYY-MM-DD
  }

  // 将数据映射到对应日期
  data.forEach((item) => {
    const itemDate = item.date.split("T")[0]; // 处理可能的时间部分
    const index = dates.indexOf(itemDate);
    if (index !== -1) {
      result[index] = item.count;
    }
  });

  return result;
}

/**
 * 生成通用UUID
 * @returns {string} 生成的UUID，符合RFC4122 v4标准
 */
export function generateUUID() {
  return crypto.randomUUID();
}

/**
 * 生成唯一文件ID
 * @returns {string} 生成的文件ID
 */
export function generateFileId() {
  return crypto.randomUUID();
}

/**
 * 生成唯一的S3配置ID
 * @returns {string} 生成的S3配置ID
 */
export function generateS3ConfigId() {
  return crypto.randomUUID();
}

/**
 * 生成短ID作为文件路径前缀
 * @returns {string} 生成的短ID
 */
export function generateShortId() {
  // 生成6位随机ID
  const charset = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";

  // 使用 crypto.getRandomValues 获取加密安全的随机值
  const randomValues = new Uint8Array(6);
  crypto.getRandomValues(randomValues);

  for (let i = 0; i < 6; i++) {
    result += charset[randomValues[i] % charset.length];
  }

  return result;
}

/**
 * 从文件名中获取文件名和扩展名
 * @param {string} filename - 文件名
 * @returns {Object} 包含文件名和扩展名的对象
 */
export function getFileNameAndExt(filename) {
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex > -1) {
    return {
      name: filename.substring(0, lastDotIndex),
      ext: filename.substring(lastDotIndex),
    };
  }
  return {
    name: filename,
    ext: "",
  };
}

/**
 * 生成安全的文件名（移除非法字符）
 * @param {string} fileName - 原始文件名
 * @returns {string} 安全的文件名
 */
export function getSafeFileName(fileName) {
  return fileName.replace(/[^\w\u4e00-\u9fa5\-\. ,!()'"?;:@&+]/g, "_"); // 扩展允许的字符集，包含常用标点符号
}
