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

// getLocalTimeString() 函数已被移除
// 现在所有时间处理都使用 CURRENT_TIMESTAMP 以支持更好的国际化

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
  // 只过滤真正有害的字符：
  // - 控制字符 (\x00-\x1F, \x7F)
  // - 路径分隔符 (/ \)
  // - Windows保留字符 (< > : " | ? *)
  // 保留所有其他Unicode字符，包括中文标点符号
  return fileName.replace(/[<>:"|?*\\/\x00-\x1F\x7F]/g, "_");
}

/**
 * 生成唯一的文件slug
 * @param {D1Database} db - D1数据库实例
 * @param {string} customSlug - 自定义slug
 * @param {boolean} override - 是否覆盖已存在的slug
 * @returns {Promise<string>} 生成的唯一slug
 */
export async function generateUniqueFileSlug(db, customSlug = null, override = false) {
  // 动态导入DbTables以避免循环依赖
  const { DbTables } = await import("../constants/index.js");

  // 如果提供了自定义slug，验证其格式并检查是否已存在
  if (customSlug) {
    // 验证slug格式：只允许字母、数字、横杠和下划线
    const slugFormatRegex = /^[a-zA-Z0-9_-]+$/;
    if (!slugFormatRegex.test(customSlug)) {
      throw new Error("链接后缀格式无效，只能使用字母、数字、下划线和横杠");
    }

    // 检查slug是否已存在
    const existingFile = await db.prepare(`SELECT id FROM ${DbTables.FILES} WHERE slug = ?`).bind(customSlug).first();

    // 如果存在并且不覆盖，抛出错误；否则允许使用
    if (existingFile && !override) {
      throw new Error("链接后缀已被占用，请使用其他链接后缀");
    } else if (existingFile && override) {
      console.log(`允许覆盖已存在的链接后缀: ${customSlug}`);
    }

    return customSlug;
  }

  // 生成随机slug (6个字符)
  let attempts = 0;
  const maxAttempts = 10;
  while (attempts < maxAttempts) {
    const randomSlug = generateShortId();

    // 检查是否已存在
    const existingFile = await db.prepare(`SELECT id FROM ${DbTables.FILES} WHERE slug = ?`).bind(randomSlug).first();
    if (!existingFile) {
      return randomSlug;
    }

    attempts++;
  }

  throw new Error("无法生成唯一链接后缀，请稍后再试");
}
