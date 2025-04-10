/**
 * HTML转图片工具类
 * 基于html-to-image库实现HTML转PNG图片功能
 */
import { toPng } from "html-to-image";
import { saveAs } from "file-saver";

const htmlToImage = {
  /**
   * 将HTML元素转换为PNG图片并下载
   * @param {HTMLElement} element - 要转换的HTML元素
   * @param {Object} options - 配置选项
   * @param {string} options.fileName - 文件名(默认为markdown.png)
   * @param {string} options.backgroundColor - 背景颜色(默认为白色)
   * @param {number} options.pixelRatio - 像素比率(默认为2，提高清晰度)
   * @param {Function} options.filter - 过滤函数，决定哪些元素应被包含
   * @returns {Promise<void>}
   */
  exportToPngAndDownload: async (element, options = {}) => {
    try {
      const { fileName = "markdown.png", backgroundColor = "#ffffff", pixelRatio = 2, filter = () => true } = options;

      // 配置选项
      const config = {
        backgroundColor,
        pixelRatio,
        filter,
        // 确保图片质量
        quality: 1.0,
        // 捕获元素中的嵌入字体
        fontEmbedCss: true,
        // 是否应有滚动条
        skipAutoScale: true,
        // 确保捕获完整大小的元素
        width: element.scrollWidth,
        height: element.scrollHeight,
      };

      // 转换为PNG
      const dataUrl = await toPng(element, config);

      // 将DataURL转换为Blob
      const blob = await (await fetch(dataUrl)).blob();

      // 使用FileSaver下载
      saveAs(blob, fileName);

      return dataUrl;
    } catch (error) {
      console.error("HTML转PNG失败:", error);
      throw error;
    }
  },

  /**
   * 将HTML元素转换为PNG数据URL
   * @param {HTMLElement} element - 要转换的HTML元素
   * @param {Object} options - 配置选项
   * @returns {Promise<string>} 返回PNG图片的DataURL
   */
  convertToPngDataUrl: async (element, options = {}) => {
    try {
      const { backgroundColor = "#ffffff", pixelRatio = 2, filter = () => true } = options;

      // 配置选项
      const config = {
        backgroundColor,
        pixelRatio,
        filter,
        quality: 1.0,
        fontEmbedCss: true,
        skipAutoScale: true,
        width: element.scrollWidth,
        height: element.scrollHeight,
      };

      // 转换为PNG
      return await toPng(element, config);
    } catch (error) {
      console.error("HTML转PNG DataURL失败:", error);
      throw error;
    }
  },
};

export default htmlToImage;
