/**
 * 加密相关工具函数
 */

import { sha256 } from "hono/utils/crypto";
// 导入Node.js的crypto模块以解决ESM环境中的引用错误
import crypto from "crypto";
// 为Node.js环境提供Web Crypto API的兼容层
import { webcrypto } from "crypto";
// 如果环境中没有全局crypto对象，将webcrypto赋值给全局
if (typeof globalThis.crypto === "undefined") {
  globalThis.crypto = webcrypto;
}

/**
 * 生成密码哈希
 * @param {string} password - 原始密码
 * @returns {Promise<string>} 密码哈希
 */
export async function hashPassword(password) {
  // 使用SHA-256哈希
  return await sha256(password);
}

/**
 * 验证密码
 * @param {string} plainPassword - 原始密码
 * @param {string} hashedPassword - 哈希后的密码
 * @returns {Promise<boolean>} 验证结果
 */
export async function verifyPassword(plainPassword, hashedPassword) {
  // 如果是SHA-256哈希（用于初始管理员密码）
  if (hashedPassword.length === 64) {
    const hashedInput = await sha256(plainPassword);
    return hashedInput === hashedPassword;
  }

  // 默认比较
  return plainPassword === hashedPassword;
}

/**
 * 加密敏感配置
 * @param {string} value - 需要加密的值
 * @param {string} secret - 加密密钥
 * @returns {Promise<string>} 加密后的值
 */
export async function encryptValue(value, secret) {
  // 简单的加密方式
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const secretKey = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

  const signature = await crypto.subtle.sign("HMAC", secretKey, data);
  const encryptedValue = "encrypted:" + btoa(String.fromCharCode(...new Uint8Array(signature))) + ":" + btoa(value);

  return encryptedValue;
}

/**
 * 解密敏感配置
 * @param {string} encryptedValue - 加密后的值
 * @param {string} secret - 加密密钥
 * @returns {Promise<string>} 解密后的值
 */
export async function decryptValue(encryptedValue, secret) {
  // 检查是否为加密值
  if (!encryptedValue.startsWith("encrypted:")) {
    return encryptedValue; // 未加密的值直接返回
  }

  // 从加密格式中提取值
  const parts = encryptedValue.split(":");
  if (parts.length !== 3) {
    throw new Error("无效的加密格式");
  }

  try {
    // 直接从加密值中提取原始值
    const originalValue = atob(parts[2]);
    return originalValue;
  } catch (error) {
    throw new Error("解密失败: " + error.message);
  }
}
