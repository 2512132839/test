/**
 * 文件预览服务API
 * 统一的Office文件预览服务，支持多种预览方式
 */

import { get } from "../client";

// 预览服务提供商配置
const PREVIEW_PROVIDERS = {
    microsoft: {
        name: "Microsoft Office Online",
        urlTemplate: "https://view.officeapps.live.com/op/view.aspx?src={url}",
    },
    google: {
        name: "Google Docs Viewer",
        urlTemplate: "https://docs.google.com/viewer?url={url}&embedded=true",
    },
};

/**
 * 统一的Office预览服务
 * @param {string|Object} input - 文件slug字符串 或 包含directUrl的对象
 * @param {Object} options - 选项
 * @param {string} [options.password] - 文件密码（当input为slug时）
 * @param {string} [options.provider='microsoft'] - 预览服务提供商 ('microsoft' | 'google')
 * @param {boolean} [options.returnAll=false] - 是否返回所有提供商的URL
 * @returns {Promise<string|Object>} 预览URL或包含所有URL的对象
 */
export async function getOfficePreviewUrl(input, options = {}) {
    const { password, provider = "microsoft", returnAll = false } = options;

    try {
        // 获取直接访问URL
        let directUrl;
        if (typeof input === "string") {
            // input是slug，需要调用API获取directUrl
            const params = {};
            if (password) {
                params.password = password;
            }

            const response = await get(`office-preview/${input}`, { params });
            if (!response.url) {
                throw new Error("响应中缺少URL字段");
            }
            directUrl = response.url;
        } else if (input && typeof input === "object" && input.directUrl) {
            // input是包含directUrl的对象
            directUrl = input.directUrl;
        } else {
            throw new Error("无效的输入参数，需要slug字符串或包含directUrl的对象");
        }

        // 生成预览URL
        const encodedUrl = encodeURIComponent(directUrl);

        if (returnAll) {
            // 返回所有提供商的URL
            const result = { directUrl };
            Object.entries(PREVIEW_PROVIDERS).forEach(([key, config]) => {
                result[key] = config.urlTemplate.replace("{url}", encodedUrl);
            });
            return result;
        } else {
            // 返回指定提供商的URL
            const providerConfig = PREVIEW_PROVIDERS[provider];
            if (!providerConfig) {
                throw new Error(`不支持的预览服务提供商: ${provider}`);
            }
            return providerConfig.urlTemplate.replace("{url}", encodedUrl);
        }
    } catch (error) {
        console.error("获取Office预览URL失败:", error);
        throw new Error(`获取Office预览URL失败: ${error.message}`);
    }
}
