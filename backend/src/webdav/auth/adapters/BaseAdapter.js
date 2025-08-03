/**
 * WebDAV认证基础适配器抽象类
 * 定义统一的平台适配器接口，处理不同平台的差异
 *
 */

import { AuthResultType } from "../core/WebDAVAuth.js";
import { buildResponseHeaders } from "../config/WebDAVConfig.js";

/**
 * 基础适配器抽象类
 * 所有平台适配器都应继承此类
 */
export class BaseAdapter {
  constructor(platform) {
    this.platform = platform;
    this.name = `${platform}Adapter`;
  }

  /**
   * 标准化请求对象
   * 将不同平台的请求对象转换为统一格式
   *
   * @param {Object} platformRequest - 平台特定的请求对象
   * @returns {Object} 标准化的请求对象
   */
  normalizeRequest(platformRequest) {
    throw new Error(`${this.name}: normalizeRequest方法必须被子类实现`);
  }

  /**
   * 标准化响应对象
   * 将统一的响应格式转换为平台特定格式
   *
   * @param {Object} standardResponse - 标准响应对象
   * @param {Object} platformContext - 平台上下文
   * @returns {Object} 平台特定的响应对象
   */
  normalizeResponse(standardResponse, platformContext) {
    throw new Error(`${this.name}: normalizeResponse方法必须被子类实现`);
  }

  /**
   * 处理WebDAV认证
   * 统一的认证处理流程
   *
   * @param {Object} platformContext - 平台上下文
   * @param {Object} webdavAuth - WebDAV认证实例
   * @param {Function} next - 下一个中间件（可选）
   * @returns {Object} 处理结果
   */
  async handleWebDAVAuth(platformContext, webdavAuth, next = null) {
    try {
      // 标准化请求
      const request = this.normalizeRequest(platformContext);

      // 执行认证
      const authResult = await webdavAuth.authenticate(request);

      // 根据认证结果处理响应
      switch (authResult.type) {
        case AuthResultType.SUCCESS:
          return await this.handleAuthSuccess(platformContext, authResult, next);

        case AuthResultType.CHALLENGE:
          return this.handleAuthChallenge(platformContext, authResult);

        case AuthResultType.FORBIDDEN:
          return this.handleAuthForbidden(platformContext, authResult);

        case AuthResultType.NOT_WEBDAV:
          return await this.handleNonWebDAV(platformContext, next);

        case AuthResultType.ERROR:
        case AuthResultType.UNAUTHORIZED:
        default:
          return this.handleAuthError(platformContext, authResult);
      }
    } catch (error) {
      console.error(`${this.name}认证处理错误:`, error);
      return this.handleInternalError(platformContext, error);
    }
  }

  /**
   * 处理认证成功
   * @param {Object} platformContext - 平台上下文
   * @param {Object} authResult - 认证结果
   * @param {Function} next - 下一个中间件
   * @returns {Object} 处理结果
   */
  async handleAuthSuccess(platformContext, authResult, next) {
    // 设置认证上下文
    this.setAuthContext(platformContext, authResult);

    // 如果有下一个中间件，继续执行
    if (next && typeof next === "function") {
      return await next();
    }

    // 否则返回成功响应
    return this.createSuccessResponse();
  }

  /**
   * 处理认证挑战
   * @param {Object} platformContext - 平台上下文
   * @param {Object} authResult - 认证结果
   * @returns {Object} 挑战响应
   */
  handleAuthChallenge(platformContext, authResult) {
    const headers = this.buildChallengeHeaders(authResult.headers);
    return this.createChallengeResponse(authResult.message, headers);
  }

  /**
   * 处理权限禁止
   * @param {Object} platformContext - 平台上下文
   * @param {Object} authResult - 认证结果
   * @returns {Object} 禁止响应
   */
  handleAuthForbidden(platformContext, authResult) {
    return this.createForbiddenResponse(authResult.message);
  }

  /**
   * 处理非WebDAV请求
   * @param {Object} platformContext - 平台上下文
   * @param {Function} next - 下一个中间件
   * @returns {Object} 处理结果
   */
  async handleNonWebDAV(platformContext, next) {
    // 非WebDAV请求，直接传递给下一个中间件
    if (next && typeof next === "function") {
      return await next();
    }

    // 如果没有下一个中间件，返回404
    return this.createNotFoundResponse();
  }

  /**
   * 处理认证错误
   * @param {Object} platformContext - 平台上下文
   * @param {Object} authResult - 认证结果
   * @returns {Object} 错误响应
   */
  handleAuthError(platformContext, authResult) {
    return this.createUnauthorizedResponse(authResult.message || "认证失败");
  }

  /**
   * 处理内部错误
   * @param {Object} platformContext - 平台上下文
   * @param {Error} error - 错误对象
   * @returns {Object} 错误响应
   */
  handleInternalError(platformContext, error) {
    return this.createInternalErrorResponse("内部服务器错误");
  }

  /**
   * 设置认证上下文
   * 将认证信息设置到平台上下文中
   *
   * @param {Object} platformContext - 平台上下文
   * @param {Object} authResult - 认证结果
   */
  setAuthContext(platformContext, authResult) {
    throw new Error(`${this.name}: setAuthContext方法必须被子类实现`);
  }

  /**
   * 构建挑战响应头
   * @param {Object} authHeaders - 认证头
   * @returns {Object} 完整的响应头
   */
  buildChallengeHeaders(authHeaders = {}) {
    const baseHeaders = buildResponseHeaders({ includeCors: true });
    return { ...baseHeaders, ...authHeaders };
  }

  /**
   * 创建成功响应
   * @returns {Object} 成功响应
   */
  createSuccessResponse() {
    throw new Error(`${this.name}: createSuccessResponse方法必须被子类实现`);
  }

  /**
   * 创建挑战响应
   * @param {string} message - 响应消息
   * @param {Object} headers - 响应头
   * @returns {Object} 挑战响应
   */
  createChallengeResponse(message, headers) {
    throw new Error(`${this.name}: createChallengeResponse方法必须被子类实现`);
  }

  /**
   * 创建禁止响应
   * @param {string} message - 响应消息
   * @returns {Object} 禁止响应
   */
  createForbiddenResponse(message) {
    throw new Error(`${this.name}: createForbiddenResponse方法必须被子类实现`);
  }

  /**
   * 创建未授权响应
   * @param {string} message - 响应消息
   * @returns {Object} 未授权响应
   */
  createUnauthorizedResponse(message) {
    throw new Error(`${this.name}: createUnauthorizedResponse方法必须被子类实现`);
  }

  /**
   * 创建未找到响应
   * @returns {Object} 未找到响应
   */
  createNotFoundResponse() {
    throw new Error(`${this.name}: createNotFoundResponse方法必须被子类实现`);
  }

  /**
   * 创建内部错误响应
   * @param {string} message - 错误消息
   * @returns {Object} 内部错误响应
   */
  createInternalErrorResponse(message) {
    throw new Error(`${this.name}: createInternalErrorResponse方法必须被子类实现`);
  }

  /**
   * 获取客户端IP地址
   * @param {Object} platformRequest - 平台请求对象
   * @returns {string} 客户端IP
   */
  getClientIp(platformRequest) {
    throw new Error(`${this.name}: getClientIp方法必须被子类实现`);
  }

  /**
   * 获取用户代理
   * @param {Object} platformRequest - 平台请求对象
   * @returns {string} 用户代理
   */
  getUserAgent(platformRequest) {
    throw new Error(`${this.name}: getUserAgent方法必须被子类实现`);
  }

  /**
   * 获取适配器信息
   * @returns {Object} 适配器信息
   */
  getAdapterInfo() {
    return {
      name: this.name,
      platform: this.platform,
      version: "1.0.0",
      features: this.getSupportedFeatures(),
    };
  }

  /**
   * 获取支持的功能
   * @returns {Array} 支持的功能列表
   */
  getSupportedFeatures() {
    return ["request_normalization", "response_normalization", "auth_context_setting", "error_handling"];
  }

  /**
   * 验证适配器配置
   * @returns {boolean} 配置是否有效
   */
  validateConfiguration() {
    try {
      // 检查必需的方法是否已实现
      const requiredMethods = [
        "normalizeRequest",
        "normalizeResponse",
        "setAuthContext",
        "createSuccessResponse",
        "createChallengeResponse",
        "createForbiddenResponse",
        "createUnauthorizedResponse",
        "createNotFoundResponse",
        "createInternalErrorResponse",
        "getClientIp",
        "getUserAgent",
      ];

      for (const method of requiredMethods) {
        if (typeof this[method] !== "function") {
          console.error(`${this.name}配置错误: 缺少必需方法${method}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error(`${this.name}配置验证失败:`, error);
      return false;
    }
  }
}
