/**
 * Express框架WebDAV认证适配器
 * 专门处理Express/Docker环境的WebDAV认证逻辑
 */

import { BaseAdapter } from './BaseAdapter.js';
import { getPlatformConfig } from '../config/WebDAVConfig.js';

/**
 * Express适配器类
 */
export class ExpressAdapter extends BaseAdapter {
  constructor() {
    super('express');
    this.config = getPlatformConfig('express');
  }

  /**
   * 标准化Express请求对象
   * @param {Object} context - Express上下文 {req, res}
   * @returns {Object} 标准化的请求对象
   */
  normalizeRequest(context) {
    try {
      const { req } = context;
      
      return {
        method: req.method,
        url: req.url,
        headers: this.normalizeHeaders(req),
        contentType: req.get('Content-Type') || '',
        clientIp: this.getClientIp(context),
        userAgent: this.getUserAgent(context),
        // Express特定属性
        expressReq: req,
        expressRes: context.res,
        body: req.body,
        query: req.query,
        params: req.params
      };
    } catch (error) {
      console.error("Express请求标准化失败:", error);
      throw new Error("请求标准化失败");
    }
  }

  /**
   * 标准化请求头
   * @param {Object} req - Express请求对象
   * @returns {Object} 标准化的头部对象
   */
  normalizeHeaders(req) {
    const headers = {};
    
    // 获取Authorization头
    const authHeader = req.get('Authorization');
    if (authHeader) {
      headers.authorization = authHeader;
    }

    // 获取其他重要头部
    const importantHeaders = [
      'Content-Type', 'Content-Length', 'User-Agent',
      'DAV', 'Depth', 'Destination', 'If', 'Lock-Token', 'Overwrite'
    ];

    for (const headerName of importantHeaders) {
      const value = req.get(headerName);
      if (value) {
        headers[headerName.toLowerCase()] = value;
      }
    }

    return headers;
  }

  /**
   * 标准化响应对象
   * @param {Object} standardResponse - 标准响应对象
   * @param {Object} context - Express上下文
   * @returns {Object} Express响应处理结果
   */
  normalizeResponse(standardResponse, context) {
    const { statusCode, headers, body } = standardResponse;
    const { res } = context;
    
    // 设置响应头
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        res.setHeader(key, value);
      }
    }
    
    // 发送响应
    res.status(statusCode);
    if (body) {
      res.send(body);
    } else {
      res.end();
    }
    
    return { handled: true };
  }

  /**
   * 设置认证上下文
   * @param {Object} context - Express上下文 {req, res}
   * @param {Object} authResult - 认证结果
   */
  setAuthContext(context, authResult) {
    try {
      const { req } = context;
      
      // 设置用户信息到req对象
      req.userId = authResult.userId;
      req.userType = authResult.userType;
      req.authResult = authResult.authResult;

      // 设置认证信息对象
      const authInfo = {
        userId: authResult.userId,
        isAdmin: authResult.userType === 'admin',
        apiKey: authResult.userType === 'apiKey' ? authResult.authResult.keyInfo?.key : null,
        apiKeyInfo: authResult.userType === 'apiKey' ? authResult.authResult.keyInfo : null,
        permissions: authResult.permissions,
        fromCache: authResult.fromCache || false
      };

      req.authInfo = authInfo;

      console.log(`Express WebDAV认证上下文设置完成: 用户类型=${authResult.userType}`);
      
    } catch (error) {
      console.error("Express认证上下文设置失败:", error);
      throw new Error("认证上下文设置失败");
    }
  }

  /**
   * 获取客户端IP地址
   * @param {Object} context - Express上下文
   * @returns {string} 客户端IP
   */
  getClientIp(context) {
    const { req } = context;
    
    // Express/Docker环境的IP获取方式
    return req.get('X-Forwarded-For') ||
           req.get('X-Real-IP') ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           req.ip ||
           'unknown';
  }

  /**
   * 获取用户代理
   * @param {Object} context - Express上下文
   * @returns {string} 用户代理
   */
  getUserAgent(context) {
    return context.req.get('User-Agent') || 'Unknown';
  }

  /**
   * 创建成功响应
   * @returns {null} Express中间件成功时返回null继续执行
   */
  createSuccessResponse() {
    // Express中间件成功时不需要返回响应，继续执行下一个中间件
    return null;
  }

  /**
   * 创建挑战响应
   * @param {string} message - 响应消息
   * @param {Object} headers - 响应头
   * @returns {Object} 挑战响应
   */
  createChallengeResponse(message, headers) {
    return {
      statusCode: 401,
      headers: headers,
      body: message
    };
  }

  /**
   * 创建禁止响应
   * @param {string} message - 响应消息
   * @returns {Object} 禁止响应
   */
  createForbiddenResponse(message) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'text/plain' },
      body: message
    };
  }

  /**
   * 创建未授权响应
   * @param {string} message - 响应消息
   * @returns {Object} 未授权响应
   */
  createUnauthorizedResponse(message) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'text/plain' },
      body: message
    };
  }

  /**
   * 创建未找到响应
   * @returns {Object} 未找到响应
   */
  createNotFoundResponse() {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Not Found'
    };
  }

  /**
   * 创建内部错误响应
   * @param {string} message - 错误消息
   * @returns {Object} 内部错误响应
   */
  createInternalErrorResponse(message) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: message
    };
  }

  /**
   * 创建Express中间件
   * @param {Object} webdavAuth - WebDAV认证实例
   * @returns {Function} Express中间件函数
   */
  createMiddleware(webdavAuth) {
    return async (req, res, next) => {
      try {
        const context = { req, res };
        const result = await this.handleWebDAVAuth(context, webdavAuth, next);
        
        // 如果返回了响应对象，处理响应
        if (result && result.statusCode) {
          this.normalizeResponse(result, context);
          return;
        }
        
        // 如果返回了handled标志，说明响应已处理
        if (result && result.handled) {
          return;
        }
        
        // 否则继续执行下一个中间件
        if (typeof next === 'function') {
          next();
        }
        
      } catch (error) {
        console.error("Express WebDAV中间件错误:", error);
        res.status(500).send("WebDAV认证中间件错误");
      }
    };
  }

  /**
   * 处理Express环境的WebDAV认证
   * @param {Object} context - Express上下文 {req, res}
   * @param {Object} webdavAuth - WebDAV认证实例
   * @param {Function} next - 下一个中间件
   * @returns {Object|null} 处理结果
   */
  async handleExpressWebDAV(context, webdavAuth, next) {
    try {
      const result = await this.handleWebDAVAuth(context, webdavAuth, next);
      
      // 如果返回了响应对象，处理响应
      if (result && result.statusCode) {
        this.normalizeResponse(result, context);
        return { handled: true };
      }
      
      // 否则返回null，表示认证成功，继续处理请求
      return null;
      
    } catch (error) {
      console.error("Express WebDAV认证错误:", error);
      const errorResponse = this.createInternalErrorResponse("WebDAV认证错误");
      this.normalizeResponse(errorResponse, context);
      return { handled: true };
    }
  }

  /**
   * 获取支持的功能
   * @returns {Array} 支持的功能列表
   */
  getSupportedFeatures() {
    return [
      ...super.getSupportedFeatures(),
      'express_middleware_support',
      'docker_environment_support',
      'request_body_parsing',
      'middleware_creation'
    ];
  }

  /**
   * 获取适配器统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      ...this.getAdapterInfo(),
      config: this.config,
      runtime: 'nodejs_express',
      features: this.getSupportedFeatures()
    };
  }

  /**
   * 验证Express特定配置
   * @returns {boolean} 配置是否有效
   */
  validateConfiguration() {
    if (!super.validateConfiguration()) {
      return false;
    }

    try {
      // 检查Express特定配置
      if (this.config.TIMEOUT && typeof this.config.TIMEOUT !== 'number') {
        console.error("ExpressAdapter配置错误: TIMEOUT必须是数字");
        return false;
      }

      if (this.config.TRUST_PROXY !== undefined && typeof this.config.TRUST_PROXY !== 'boolean') {
        console.error("ExpressAdapter配置错误: TRUST_PROXY必须是布尔值");
        return false;
      }

      return true;
    } catch (error) {
      console.error("ExpressAdapter配置验证失败:", error);
      return false;
    }
  }
}

/**
 * 创建Express适配器实例
 * @returns {ExpressAdapter} 适配器实例
 */
export function createExpressAdapter() {
  const adapter = new ExpressAdapter();
  
  if (!adapter.validateConfiguration()) {
    throw new Error("ExpressAdapter配置无效");
  }
  
  return adapter;
}

/**
 * 便捷函数：创建Express WebDAV认证中间件
 * @param {Object} webdavAuth - WebDAV认证实例
 * @returns {Function} Express中间件函数
 */
export function createExpressWebDAVMiddleware(webdavAuth) {
  const adapter = createExpressAdapter();
  return adapter.createMiddleware(webdavAuth);
}
