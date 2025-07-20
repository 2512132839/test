/**
 * 路径处理工具
 * 提供统一的路径规范化和安全检查功能
 * 保持与原始fsService-backup.js中normalizePath函数完全一致
 */

/**
 * 规范化路径格式
 * @param {string} path - 输入路径
 * @param {boolean} isDirectory - 是否为目录路径
 * @returns {string} 规范化的路径
 */
export function normalizePath(path, isDirectory = false) {
  // 确保路径以斜杠开始
  path = path.startsWith("/") ? path : "/" + path;
  // 如果是目录，确保路径以斜杠结束
  if (isDirectory) {
    path = path.endsWith("/") ? path : path + "/";
  }
  return path;
}

/**
 * 增强的路径安全检查
 * 从webdavUtils.js迁移而来，提供通用的路径安全验证
 * @param {string} path - 需要检查的路径
 * @param {Object} options - 选项
 * @param {boolean} [options.allowDotDot=false] - 是否允许..路径元素
 * @param {boolean} [options.allowEncodedSlash=false] - 是否允许编码的斜杠字符
 * @param {boolean} [options.strictCharCheck=true] - 是否进行严格的字符检查
 * @returns {Object} 包含安全路径和错误信息的对象
 */
export function enhancedPathSecurity(path, options = {}) {
  const { allowDotDot = false, allowEncodedSlash = false, strictCharCheck = true } = options;

  if (!path) {
    return {
      path: null,
      error: "路径不能为空",
    };
  }

  let cleanPath = path;

  // 1. 检查并处理URL编码
  try {
    // 检查是否包含编码的斜杠(%2F)
    if (!allowEncodedSlash && cleanPath.includes("%2F")) {
      return {
        path: null,
        error: "路径包含编码的斜杠字符(%2F)",
      };
    }

    // 解码URL编码的字符
    cleanPath = decodeURIComponent(cleanPath);
  } catch (error) {
    return {
      path: null,
      error: "路径包含无效的URL编码",
    };
  }

  // 2. 规范化路径，将多个斜杠替换为单个斜杠
  cleanPath = cleanPath.replace(/\/+/g, "/");

  // 3. 严格的字符检查
  if (strictCharCheck) {
    // 检查危险字符（控制字符、Windows保留字符等）
    const dangerousCharsRegex = /[<>:"|?*\\\x00-\x1F\x7F]/;
    if (dangerousCharsRegex.test(cleanPath)) {
      return {
        path: null,
        error: `路径包含非法字符: ${cleanPath.replace(dangerousCharsRegex, "?")}`,
      };
    }
  }

  // 4. 更严格的路径遍历防护
  const parts = [];
  const segments = cleanPath.split("/");

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];

    if (segment === "..") {
      if (!allowDotDot) {
        // 不允许..路径元素时，完全拒绝包含..的路径
        return {
          path: null,
          error: "路径包含非法的父目录引用(..)",
        };
      }

      // 允许..时，正确处理路径
      if (parts.length === 0 || parts[parts.length - 1] === "") {
        // 尝试超出根目录，这是不允许的
        return {
          path: null,
          error: "路径尝试访问根目录之上的目录",
        };
      }

      // 移除上一级目录
      parts.pop();
    } else if (segment === ".") {
      // 忽略当前目录引用
      continue;
    } else if (segment === "") {
      // 保留第一个空段（根路径前的空字符串）或路径末尾的空段（表示目录）
      if (i === 0 || i === segments.length - 1) {
        parts.push(segment);
      }
      // 忽略中间的空段
    } else {
      // 添加有效的路径段
      parts.push(segment);
    }
  }

  // 5. 重建安全路径
  let safePath = parts.join("/");

  // 确保路径以/开头
  if (!safePath.startsWith("/")) {
    safePath = "/" + safePath;
  }

  return {
    path: safePath,
    error: null,
  };
}
