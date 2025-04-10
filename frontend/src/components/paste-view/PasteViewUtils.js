// PasteView 组件的公共工具函数
// 这个文件提供了所有PasteView相关组件可复用的工具函数
// 将这些功能提取到单独的文件中有助于避免代码重复，并使主组件保持简洁

/**
 * 格式化日期 - 考虑时区问题
 * @param {string} dateString - ISO日期字符串
 * @returns {string} 格式化后的日期字符串
 */
export const formatDate = (dateString) => {
  if (!dateString) return "未知";

  try {
    // 使用Date对象将UTC时间转换为本地时间
    const date = new Date(dateString);

    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      return "日期无效";
    }

    // 使用Intl.DateTimeFormat以确保时区正确
    // 这种方式会自动处理不同地区的日期格式和时区差异
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false, // 使用24小时制
    }).format(date);
  } catch (e) {
    console.error("日期格式化错误:", e);
    return "日期格式错误";
  }
};

/**
 * 格式化相对时间（如：3天后过期）
 * @param {string} dateString - ISO日期字符串
 * @returns {string} 相对时间描述
 */
export const formatRelativeTime = (dateString) => {
  if (!dateString) return "";

  try {
    const targetDate = new Date(dateString);
    const now = new Date();

    // 检查日期是否有效
    if (isNaN(targetDate.getTime())) {
      return "";
    }

    // 计算时间差（毫秒）
    const diff = targetDate - now;

    // 转换为秒、分钟、小时、天
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    // 根据时间差返回不同的文本
    // 提供更加友好和直观的时间表示
    if (diff < 0) {
      return "已过期";
    } else if (days > 30) {
      return `${Math.floor(days / 30)}个月后过期`;
    } else if (days > 0) {
      return `${days}天后过期`;
    } else if (hours > 0) {
      return `${hours}小时后过期`;
    } else if (minutes > 0) {
      return `${minutes}分钟后过期`;
    } else {
      return "即将过期";
    }
  } catch (e) {
    console.error("相对时间格式化错误:", e);
    return "";
  }
};

/**
 * 格式化过期日期
 * @param {string} expiryDate - ISO日期字符串
 * @returns {string} 格式化后的过期时间描述
 */
export const formatExpiry = (expiryDate) => {
  if (!expiryDate) return "永不过期";

  try {
    const expiry = new Date(expiryDate);
    const now = new Date();

    // 检查日期是否有效
    if (isNaN(expiry.getTime())) {
      return "日期无效";
    }

    // 判断是否已过期
    if (expiry < now) {
      return "已过期";
    }

    // 显示具体日期和相对时间
    // 组合了精确日期和相对时间，提供更完整的时间信息
    const formattedDate = formatDate(expiryDate);
    const relativeTime = formatRelativeTime(expiryDate);

    return `${formattedDate} (${relativeTime})`;
  } catch (e) {
    console.error("过期时间格式化错误:", e);
    return "日期格式错误";
  }
};

/**
 * 获取输入框样式
 * 根据当前主题模式返回合适的CSS类名
 * @param {boolean} darkMode - 是否为暗黑模式
 * @returns {string} CSS类名
 */
export const getInputClasses = (darkMode) => {
  return darkMode
    ? "bg-gray-800 border-gray-700 text-gray-100 focus:ring-primary-600 focus:border-primary-600"
    : "bg-white border-gray-300 text-gray-900 focus:ring-primary-500 focus:border-primary-500";
};

/**
 * 调试日志函数，只在调试模式开启时输出
 * 避免在生产环境中输出过多日志
 * @param {boolean} enableDebug - 是否启用调试
 * @param {boolean} isDev - 是否为开发环境
 * @param  {...any} args - 日志参数
 */
export const debugLog = (enableDebug, isDev, ...args) => {
  if (enableDebug || isDev) {
    console.log(...args);
  }
};
