/**
 * 统一的时间处理工具函数
 * 用于处理从后端接收的 UTC 时间戳，并转换为用户本地时区的时间显示
 *
 * 后端现在统一使用 CURRENT_TIMESTAMP 存储 UTC 时间
 * 前端负责根据用户的时区设置进行本地化显示
 */

/**
 * 时间格式化选项配置
 */
const TIME_FORMAT_OPTIONS = {
  // 完整日期时间格式（年-月-日 时:分）
  FULL_DATETIME: {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false, // 使用24小时制
  },

  // 完整日期时间格式（包含秒）
  FULL_DATETIME_WITH_SECONDS: {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  },

  // 相对时间单位（毫秒）
  RELATIVE_TIME_UNITS: {
    MINUTE: 60,
    HOUR: 3600,
    DAY: 86400,
    WEEK: 604800,
    MONTH: 2592000, // 30天
    YEAR: 31536000, // 365天
  },
};

/**
 * 将 UTC 时间字符串转换为本地 Date 对象
 * @param {string|Date|number} utcDateString - UTC 时间字符串、Date对象或时间戳
 * @returns {Date|null} 本地 Date 对象，如果无效则返回 null
 */
export const parseUTCDate = (utcDateString) => {
  if (!utcDateString) {
    return null;
  }

  try {
    // 如果已经是 Date 对象，直接返回
    if (utcDateString instanceof Date) {
      return isNaN(utcDateString.getTime()) ? null : utcDateString;
    }

    // 如果不是字符串，说明数据类型不正确，返回 null
    if (typeof utcDateString !== "string") {
      return null;
    }

    let dateString = utcDateString.trim();

    // 处理不同的UTC时间格式
    // 1. 如果已经是ISO格式（带Z或时区偏移），直接解析
    if (dateString.includes("T") && (dateString.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(dateString))) {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? null : date;
    }

    // 2. 如果是SQLite CURRENT_TIMESTAMP格式 "YYYY-MM-DD HH:mm:ss"，需要明确指定为UTC
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateString)) {
      // 将空格替换为T，并添加Z表示UTC时间
      dateString = dateString.replace(" ", "T") + "Z";
    }
    // 3. 如果是日期格式 "YYYY-MM-DD"，添加时间和UTC标识
    else if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      dateString = dateString + "T00:00:00Z";
    }
    // 4. 如果是ISO格式但没有Z，添加Z
    else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(dateString)) {
      dateString = dateString + "Z";
    }

    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    console.error("解析 UTC 时间失败:", error, "输入:", utcDateString);
    return null;
  }
};

/**
 * 获取用户的首选语言设置
 * @returns {string} 用户的语言代码
 */
const getUserLocale = () => {
  // 优先使用浏览器语言设置
  if (navigator.language) {
    return navigator.language;
  }
  // 备选方案：使用浏览器语言列表的第一个
  if (navigator.languages && navigator.languages.length > 0) {
    return navigator.languages[0];
  }
  // 最后备选：默认中文
  return "zh-CN";
};

/**
 * 格式化日期时间为本地时间显示
 * @param {string} utcDateString - UTC 时间字符串
 * @param {Object} options - 格式化选项，默认为完整日期时间格式
 * @param {string} locale - 地区设置，默认自动检测用户语言
 * @returns {string} 格式化后的本地时间字符串
 */
export const formatDateTime = (utcDateString, options = TIME_FORMAT_OPTIONS.FULL_DATETIME, locale = getUserLocale()) => {
  if (!utcDateString) return "未知";

  const date = parseUTCDate(utcDateString);
  if (!date) {
    console.warn("时间解析失败:", utcDateString);
    return "日期无效";
  }

  try {
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch (error) {
    console.error("日期格式化错误:", error, "输入:", utcDateString);
    return "日期格式错误";
  }
};

/**
 * 格式化日期时间（包含秒）
 * @param {string} utcDateString - UTC 时间字符串
 * @param {string} locale - 地区设置，默认自动检测用户语言
 * @returns {string} 格式化后的时间字符串
 */
export const formatDateTimeWithSeconds = (utcDateString, locale = getUserLocale()) => {
  return formatDateTime(utcDateString, TIME_FORMAT_OPTIONS.FULL_DATETIME_WITH_SECONDS, locale);
};

/**
 * 计算相对时间（如：3天前、2小时后）
 * @param {string} utcDateString - UTC 时间字符串
 * @param {Date} baseDate - 基准时间，默认为当前时间
 * @returns {string} 相对时间描述
 */
export const formatRelativeTime = (utcDateString, baseDate = new Date()) => {
  if (!utcDateString) return "";

  const targetDate = parseUTCDate(utcDateString);
  if (!targetDate) {
    return "";
  }

  try {
    // 计算时间差（秒）
    const diffInSeconds = Math.floor((targetDate - baseDate) / 1000);
    const absDiff = Math.abs(diffInSeconds);
    const isInFuture = diffInSeconds > 0;

    const { MINUTE, HOUR, DAY, WEEK, MONTH, YEAR } = TIME_FORMAT_OPTIONS.RELATIVE_TIME_UNITS;

    // 根据时间差返回不同的描述
    if (absDiff < MINUTE) {
      return isInFuture ? "即将" : "刚刚";
    } else if (absDiff < HOUR) {
      const minutes = Math.floor(absDiff / MINUTE);
      return isInFuture ? `${minutes}分钟后` : `${minutes}分钟前`;
    } else if (absDiff < DAY) {
      const hours = Math.floor(absDiff / HOUR);
      return isInFuture ? `${hours}小时后` : `${hours}小时前`;
    } else if (absDiff < WEEK) {
      const days = Math.floor(absDiff / DAY);
      return isInFuture ? `${days}天后` : `${days}天前`;
    } else if (absDiff < MONTH) {
      const weeks = Math.floor(absDiff / WEEK);
      return isInFuture ? `${weeks}周后` : `${weeks}周前`;
    } else if (absDiff < YEAR) {
      const months = Math.floor(absDiff / MONTH);
      return isInFuture ? `${months}个月后` : `${months}个月前`;
    } else {
      const years = Math.floor(absDiff / YEAR);
      return isInFuture ? `${years}年后` : `${years}年前`;
    }
  } catch (error) {
    console.error("相对时间计算错误:", error);
    return "";
  }
};

/**
 * 格式化过期时间显示
 * @param {string} expiryDateString - 过期时间的 UTC 字符串
 * @returns {string} 格式化后的过期时间描述
 */
export const formatExpiry = (expiryDateString) => {
  if (!expiryDateString) return "永不过期";

  const expiryDate = parseUTCDate(expiryDateString);
  if (!expiryDate) {
    return "日期无效";
  }

  const now = new Date();

  try {
    // 判断是否已过期
    if (expiryDate < now) {
      return "已过期";
    }

    // 显示具体日期和相对时间
    const formattedDate = formatDateTime(expiryDateString);
    const relativeTime = formatRelativeTime(expiryDateString, now);

    return `${formattedDate} (${relativeTime})`;
  } catch (error) {
    console.error("过期时间格式化错误:", error);
    return "日期格式错误";
  }
};

/**
 * 检查时间是否已过期
 * @param {string} expiryDateString - 过期时间的 UTC 字符串
 * @returns {boolean} 是否已过期
 */
export const isExpired = (expiryDateString) => {
  if (!expiryDateString) return false;

  const expiryDate = parseUTCDate(expiryDateString);
  if (!expiryDate) return false;

  return expiryDate < new Date();
};

/**
 * 格式化时间用于显示"最后刷新时间"等场景
 * @returns {string} 当前本地时间的简短格式
 */
export const formatCurrentTime = () => {
  const now = new Date();
  return now.toLocaleTimeString(getUserLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

// 导出时间格式选项，供其他组件使用
export { TIME_FORMAT_OPTIONS };
