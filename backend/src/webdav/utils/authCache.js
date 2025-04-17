/**
 * WebDAV认证缓存工具
 * 为Windows WebDAV客户端提供认证信息缓存，解决映射网络驱动器的认证问题
 */

// 内存缓存，存储认证信息
// 键格式: IP地址 + '|' + 用户代理的哈希
// 值格式: {authInfo: {...}, timestamp: 时间戳}
const authCache = new Map();

// 缓存过期时间（毫秒）
const CACHE_EXPIRATION = 30 * 60 * 1000; // 30分钟

/**
 * 判断是否为Windows WebDAV客户端
 * @param {string} userAgent - 用户代理字符串
 * @returns {boolean} 是否为Windows客户端
 */
function isWindowsClient(userAgent) {
  return userAgent.includes("Microsoft-WebDAV-MiniRedir") || (userAgent.includes("Windows") && userAgent.includes("WebDAV"));
}

/**
 * 生成缓存键
 * @param {string} clientIp - 客户端IP
 * @param {string} userAgent - 用户代理
 * @returns {string} 缓存键
 */
function generateCacheKey(clientIp, userAgent) {
  // 简单哈希，不需要加密级别的安全性
  const uaHash = userAgent.split("").reduce((a, c) => (a + c.charCodeAt(0)) % 9973, 0);
  return `${clientIp}|${uaHash}`;
}

/**
 * 存储认证信息到缓存
 * @param {string} clientIp - 客户端IP
 * @param {string} userAgent - 用户代理
 * @param {Object} authInfo - 认证信息
 */
export function storeAuthInfo(clientIp, userAgent, authInfo) {
  // 只为Windows客户端缓存认证信息
  if (!isWindowsClient(userAgent)) {
    return;
  }

  const key = generateCacheKey(clientIp, userAgent);
  authCache.set(key, {
    authInfo: authInfo,
    timestamp: Date.now(),
  });

  console.log(`WebDAV认证缓存: 已存储 (${clientIp.substring(0, 10)}, Windows客户端)`);

  // 定期清理过期缓存
  cleanExpiredCache();
}

/**
 * 从缓存中获取认证信息
 * @param {string} clientIp - 客户端IP
 * @param {string} userAgent - 用户代理
 * @returns {Object|null} 认证信息或null
 */
export function getAuthInfo(clientIp, userAgent) {
  // 只为Windows客户端使用认证缓存
  if (!isWindowsClient(userAgent)) {
    return null;
  }

  const key = generateCacheKey(clientIp, userAgent);
  const cached = authCache.get(key);

  // 检查缓存是否存在且未过期
  if (cached && Date.now() - cached.timestamp < CACHE_EXPIRATION) {
    console.log(`WebDAV认证缓存: 命中 (${clientIp.substring(0, 10)}, Windows客户端)`);
    return cached.authInfo;
  }

  // 如果过期，删除缓存
  if (cached) {
    console.log(`WebDAV认证缓存: 已过期 (${clientIp.substring(0, 10)}, Windows客户端)`);
    authCache.delete(key);
  }

  return null;
}

/**
 * 清理过期的缓存项
 */
function cleanExpiredCache() {
  const now = Date.now();
  let expiredCount = 0;

  for (const [key, value] of authCache.entries()) {
    if (now - value.timestamp > CACHE_EXPIRATION) {
      authCache.delete(key);
      expiredCount++;
    }
  }

  if (expiredCount > 0) {
    console.log(`WebDAV认证缓存: 已清理 ${expiredCount} 个过期项`);
  }
}

/**
 * 获取缓存统计信息
 * @returns {Object} 缓存统计
 */
export function getCacheStats() {
  return {
    size: authCache.size,
    expirationMinutes: CACHE_EXPIRATION / (60 * 1000),
  };
}
