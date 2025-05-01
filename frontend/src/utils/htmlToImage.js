/**
 * HTML到图片转换工具
 * 使用html-to-image库将HTML元素转换为图片
 */

import { toPng, toJpeg } from "html-to-image";
import { saveAs } from "file-saver";

/**
 * 将HTML元素转换为PNG并下载
 * @param {HTMLElement|string} element - DOM元素或选择器字符串
 * @param {Object} options - 转换选项
 * @param {string} options.filename - 下载的文件名，默认为 'download.png'
 * @param {Object} options.imageOptions - 传递给html-to-image的选项
 * @param {function} options.beforeCapture - 捕获前的回调函数
 * @param {function} options.afterCapture - 捕获后的回调函数
 * @param {function} options.onSuccess - 成功时的回调函数
 * @param {function} options.onError - 错误时的回调函数
 * @returns {Promise} - 返回一个Promise对象
 */
export async function elementToPng(element, options = {}) {
  // 默认选项
  const defaultOptions = {
    filename: "download.png",
    imageOptions: {
      quality: 0.9,
      backgroundColor: "#ffffff",
      // 处理跨域问题的设置
      cacheBust: true,
      // 过滤掉不想转换的元素
      filter: (node) => {
        // 例如跳过带有特定class的元素
        return !node.classList?.contains("no-export");
      },
    },
    beforeCapture: null,
    afterCapture: null,
    onSuccess: null,
    onError: null,
  };

  // 合并默认选项和用户选项
  const mergedOptions = { ...defaultOptions, ...options };
  const { filename, imageOptions, beforeCapture, afterCapture, onSuccess, onError } = mergedOptions;

  try {
    // 如果element是字符串（选择器），则获取实际DOM元素
    const targetElement = typeof element === "string" ? document.querySelector(element) : element;

    if (!targetElement) {
      throw new Error("目标元素不存在");
    }

    // 在捕获前执行回调（如果有）
    if (typeof beforeCapture === "function") {
      await beforeCapture(targetElement);
    }

    // 转换为PNG
    const dataUrl = await toPng(targetElement, imageOptions);

    // 在捕获后执行回调（如果有）
    if (typeof afterCapture === "function") {
      await afterCapture(targetElement);
    }

    // 使用file-saver保存图片
    const blob = dataURLToBlob(dataUrl);
    saveAs(blob, filename);

    // 成功回调
    if (typeof onSuccess === "function") {
      onSuccess(dataUrl, blob);
    }

    return { success: true, dataUrl, blob };
  } catch (error) {
    console.error("转换HTML为PNG时出错:", error);

    // 错误回调
    if (typeof onError === "function") {
      onError(error);
    }

    return { success: false, error };
  }
}

/**
 * 将HTML元素转换为JPEG并下载
 * @param {HTMLElement|string} element - DOM元素或选择器字符串
 * @param {Object} options - 与elementToPng相同的选项，但默认文件名为'download.jpg'
 * @returns {Promise} - 返回一个Promise对象
 */
export async function elementToJpeg(element, options = {}) {
  // 默认选项
  const defaultOptions = {
    filename: "download.jpg",
    imageOptions: {
      quality: 0.9,
      backgroundColor: "#ffffff",
      cacheBust: true,
    },
  };

  // 合并默认选项和用户选项
  const mergedOptions = { ...defaultOptions, ...options };
  const { filename, imageOptions, beforeCapture, afterCapture, onSuccess, onError } = mergedOptions;

  try {
    // 如果element是字符串（选择器），则获取实际DOM元素
    const targetElement = typeof element === "string" ? document.querySelector(element) : element;

    if (!targetElement) {
      throw new Error("目标元素不存在");
    }

    // 在捕获前执行回调（如果有）
    if (typeof beforeCapture === "function") {
      await beforeCapture(targetElement);
    }

    // 转换为JPEG
    const dataUrl = await toJpeg(targetElement, imageOptions);

    // 在捕获后执行回调（如果有）
    if (typeof afterCapture === "function") {
      await afterCapture(targetElement);
    }

    // 使用file-saver保存图片
    const blob = dataURLToBlob(dataUrl);
    saveAs(blob, filename);

    // 成功回调
    if (typeof onSuccess === "function") {
      onSuccess(dataUrl, blob);
    }

    return { success: true, dataUrl, blob };
  } catch (error) {
    console.error("转换HTML为JPEG时出错:", error);

    // 错误回调
    if (typeof onError === "function") {
      onError(error);
    }

    return { success: false, error };
  }
}

/**
 * 从编辑器获取内容并转换为PNG
 * @param {Object} editor - 编辑器实例
 * @param {Object} options - 转换选项
 * @returns {Promise} - 返回一个Promise对象
 */
export async function editorContentToPng(editor, options = {}) {
  // 检查编辑器实例
  if (!editor) {
    return { success: false, error: new Error("编辑器实例不存在") };
  }

  console.log("编辑器实例:", editor);

  // 获取当前模式
  const currentMode = editor.vditor?.currentMode;
  console.log("当前编辑器模式:", currentMode);

  // 根据不同模式选择不同的内容获取方式
  let targetElement = null;
  let tempContainer = null;

  try {
    // 首先尝试直接通过ID获取编辑器容器
    const editorContainer = document.getElementById("vditor");

    if (!editorContainer) {
      console.warn("无法通过ID找到编辑器容器");
      // 如果找不到编辑器容器，尝试直接从DOM中查找Vditor相关元素
      // 优先使用预览区域，因为预览区域中的公式已经被渲染
      targetElement =
          document.querySelector(".vditor-preview") || document.querySelector(".vditor-wysiwyg") || document.querySelector(".vditor-ir") || document.querySelector(".vditor-sv");

      if (!targetElement) {
        throw new Error("无法找到编辑器内容元素");
      }
    } else {
      console.log("找到编辑器容器:", editorContainer);

      // 只有在预览模式或分屏模式下，才直接使用预览区域
      if (currentMode === "preview" || currentMode === "both") {
        // 在预览模式或分屏模式下，使用预览区域
        targetElement = editorContainer.querySelector(".vditor-preview");
        console.log("使用预览区域元素:", targetElement);
      } else {
        // 对于其他所有模式(wysiwyg, ir, sv)，创建临时容器并使用getHTML获取内容
        console.log(`在${currentMode}模式下，创建临时容器以获取渲染后的HTML`);

        // 创建临时容器
        tempContainer = document.createElement("div");
        tempContainer.innerHTML = editor.getHTML();
        tempContainer.className = "vditor-reset";

        // 应用样式以匹配编辑器
        const editorStyles = window.getComputedStyle(editorContainer);
        tempContainer.style.backgroundColor = editorStyles.backgroundColor || "#ffffff";
        tempContainer.style.color = editorStyles.color || "#000000";
        tempContainer.style.padding = "20px";
        tempContainer.style.maxWidth = "100%";
        tempContainer.style.width = editorContainer.offsetWidth + "px";
        // 添加额外样式确保内容渲染正常
        tempContainer.style.fontFamily = editorStyles.fontFamily;
        tempContainer.style.fontSize = editorStyles.fontSize;
        tempContainer.style.lineHeight = editorStyles.lineHeight || "1.6";

        // 添加到文档中
        document.body.appendChild(tempContainer);
        targetElement = tempContainer;
        console.log("创建的临时容器:", tempContainer);
      }
    }

    if (!targetElement) {
      throw new Error("无法找到适合转换的内容元素");
    }

    // 处理Mermaid图表，确保它们被正确渲染
    await preprocessMermaidCharts(targetElement);

    // 处理数学公式，确保它们被正确渲染
    await preprocessMathFormulas(targetElement);

    // 处理代码块和文本，提高清晰度
    await preprocessCodeAndText(targetElement);

    // 在调用elementToPng前预处理图片，解决跨域问题
    await preprocessImages(targetElement);

    // 修改afterCapture回调以确保临时容器被正确移除
    const originalAfterCapture = options.afterCapture;
    options.afterCapture = async (el) => {
      if (originalAfterCapture) {
        await originalAfterCapture(el);
      }
      // 确保临时容器被移除
      if (tempContainer && document.body.contains(tempContainer)) {
        document.body.removeChild(tempContainer);
        console.log("临时容器已移除");
      }
    };

    // 合并自定义选项，优化导出质量
    const enhancedOptions = {
      ...options,
      imageOptions: {
        ...options.imageOptions,
        // 增强跨域处理设置
        cacheBust: true,
        // 提高图像质量
        quality: 1.0, // 最高质量
        // 提高像素比率，使图像更清晰
        pixelRatio: 4, // 使用更高的像素比(从3提高到4)，进一步提高清晰度
        // 设置默认的图片占位符为1x1像素透明图
        imagePlaceholder: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        // 处理跨域图片
        skipFonts: false, // 不跳过字体处理，确保数学公式字体正确
        // 自定义过滤器，处理图片跨域问题
        filter: (node) => {
          // 排除可能会导致跨域问题的外部iframes
          if (node.tagName === "IFRAME") {
            return false;
          }

          // 排除带有特定类的元素
          if (node.classList?.contains("no-export")) {
            return false;
          }

          // 处理图片元素
          if (node.tagName === "IMG") {
            // 如果图片有crossorigin属性设置为anonymous，可能会更好地工作
            if (!node.crossOrigin) {
              node.crossOrigin = "anonymous";
            }

            // 如果图片已经有data-original-src属性，说明已被预处理
            if (node.hasAttribute("data-original-src")) {
              return true;
            }

            // 允许相对URL和数据URL图片
            const src = node.src || "";
            if (src.startsWith("data:") || src.startsWith("/") || isUrlFromSameDomain(src)) {
              return true;
            }

            // 检查图片是否已加载并且没有跨域错误
            return node.complete && !isImageWithCORSError(node);
          }

          return true;
        },
        // 添加更多选项以优化文本和代码块的渲染
        fontEmbedCSS: true, // 尝试嵌入字体CSS
        fontOptions: {
          fontSmoothing: "antialiased", // 使用抗锯齿字体平滑
          fontDisplay: "swap", // 优化字体显示策略
        },
      },
    };

    // 调用elementToPng函数进行转换
    return elementToPng(targetElement, enhancedOptions);
  } catch (error) {
    console.error("获取编辑器内容元素时出错:", error);

    // 确保在发生错误时也能清理临时容器
    if (tempContainer && document.body.contains(tempContainer)) {
      document.body.removeChild(tempContainer);
      console.log("出错时清理了临时容器");
    }

    return { success: false, error };
  }
}

/**
 * 判断URL是否来自同一域名
 * @param {string} url - 要检查的URL
 * @returns {boolean} - 如果URL来自同一域名，则返回true
 */
function isUrlFromSameDomain(url) {
  try {
    // 如果URL是相对路径，则认为是同域名
    if (url.startsWith("/") || url.startsWith("./") || url.startsWith("../")) {
      return true;
    }

    // 解析URL获取域名
    const urlObj = new URL(url);
    const originObj = new URL(window.location.origin);

    // 比较域名是否相同
    return urlObj.hostname === originObj.hostname;
  } catch (e) {
    // 如果URL解析失败，保守起见返回false
    console.warn("URL解析失败:", e);
    return false;
  }
}

/**
 * 检查图片是否存在跨域错误
 * @param {HTMLImageElement} img - 要检查的图片元素
 * @returns {boolean} - 如果图片有跨域错误，则返回true
 */
function isImageWithCORSError(img) {
  // 如果图片已完成加载但naturalWidth为0，可能是CORS错误
  return img.complete && (img.naturalWidth === 0 || img.naturalHeight === 0);
}

/**
 * 预处理DOM中的图片，解决跨域问题
 * @param {HTMLElement} rootElement - 包含图片的根元素
 * @returns {Promise} - 图片预处理完成的Promise
 */
async function preprocessImages(rootElement) {
  // 找到所有图片
  const images = rootElement.querySelectorAll("img");
  console.log(`找到${images.length}个图片元素需要预处理`);

  // 创建预处理Promise数组
  const preprocessPromises = Array.from(images).map((img) => {
    // 如果图片已经预处理过，跳过
    if (img.hasAttribute("data-original-src")) {
      return Promise.resolve();
    }

    // 检查图片是否可能存在跨域问题
    const src = img.src || "";
    if (!src || src.startsWith("data:") || src.startsWith("/") || isUrlFromSameDomain(src)) {
      // 相对URL、数据URL或同域图片不需要特殊处理
      return Promise.resolve();
    }

    // 保存原始src以备后用
    img.setAttribute("data-original-src", src);

    return new Promise((resolve) => {
      // 创建一个新的Image对象来检查跨域情况
      const testImg = new Image();
      testImg.crossOrigin = "anonymous";

      // 设置加载处理函数
      testImg.onload = function () {
        try {
          // 尝试将图片转换为Data URL
          const canvas = document.createElement("canvas");
          canvas.width = testImg.naturalWidth;
          canvas.height = testImg.naturalHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(testImg, 0, 0);

          // 转换为DataURL
          const dataUrl = canvas.toDataURL("image/png");

          // 更新原始图片的src为dataURL
          img.src = dataUrl;
          console.log("成功处理跨域图片:", src.substring(0, 50) + (src.length > 50 ? "..." : ""));
        } catch (e) {
          console.warn("无法转换跨域图片:", e);
          // 设置为占位符图片
          img.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
          // 设置alt文字提示
          if (!img.alt) {
            img.alt = "图片加载失败";
          }
        }
        resolve();
      };

      // 错误处理
      testImg.onerror = function () {
        console.warn("跨域图片加载失败:", src);
        // 设置为占位符图片
        img.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        // 设置alt文字提示
        if (!img.alt) {
          img.alt = "图片加载失败";
        }
        resolve();
      };

      // 设置src启动加载
      testImg.src = src;
    });
  });

  // 等待所有图片处理完成
  await Promise.all(preprocessPromises);
  console.log("图片预处理完成");
}

/**
 * 预处理数学公式，确保它们被正确渲染
 * @param {HTMLElement} rootElement - 包含数学公式的根元素
 * @returns {Promise} - 数学公式预处理完成的Promise
 */
async function preprocessMathFormulas(rootElement) {
  // 检查是否有数学公式元素
  const mathSpans = rootElement.querySelectorAll("span.language-math");
  const mathDivs = rootElement.querySelectorAll("div.language-math");

  console.log(`找到${mathSpans.length}个行内公式和${mathDivs.length}个块级公式`);

  if (mathSpans.length === 0 && mathDivs.length === 0) {
    console.log("没有找到数学公式，跳过数学公式预处理");
    return;
  }

  // 检查页面中是否有MathJax或KaTeX
  const hasMathJax = typeof window.MathJax !== "undefined";
  const hasKaTeX = typeof window.katex !== "undefined";

  console.log("检测到的数学公式渲染库:", {
    MathJax: hasMathJax,
    KaTeX: hasKaTeX,
  });

  // MathJax处理
  if (hasMathJax && window.MathJax.typeset) {
    try {
      console.log("尝试使用MathJax重新渲染数学公式");

      // 收集所有需要处理的元素
      const mathElements = [...mathSpans, ...mathDivs];

      // MathJax可能已经处理过这些元素，我们标记一下未处理的元素
      mathElements.forEach((el) => {
        if (!el.querySelector(".MathJax") && !el.querySelector(".mjx-math")) {
          el.setAttribute("data-math-needs-rendering", "true");
        }
      });

      // 获取需要渲染的元素
      const needsRendering = rootElement.querySelectorAll("[data-math-needs-rendering]");
      if (needsRendering.length > 0) {
        // 触发MathJax重新处理
        window.MathJax.typeset(Array.from(needsRendering));

        // 等待MathJax渲染完成
        await new Promise((resolve) => setTimeout(resolve, 500));

        // 移除标记
        needsRendering.forEach((el) => el.removeAttribute("data-math-needs-rendering"));
      }

      console.log("MathJax重新渲染完成");
    } catch (e) {
      console.warn("MathJax处理过程中出错:", e);
    }
  }

  // KaTeX处理
  if (hasKaTeX && window.katex.renderToString) {
    try {
      console.log("尝试使用KaTeX重新渲染数学公式");

      // 检查每个公式元素
      const processKaTeX = (elements) => {
        elements.forEach((el) => {
          // 如果元素已经被KaTeX处理过，跳过
          if (el.querySelector(".katex")) return;

          try {
            // 获取原始的TeX代码
            const texCode = el.textContent;
            // 使用KaTeX渲染
            const displayMode = el.tagName.toLowerCase() === "div";
            const renderedHtml = window.katex.renderToString(texCode, {
              displayMode: displayMode,
              throwOnError: false,
            });
            // 替换内容
            el.innerHTML = renderedHtml;
          } catch (err) {
            console.warn(`KaTeX渲染公式失败: ${el.textContent}`, err);
          }
        });
      };

      processKaTeX(mathSpans);
      processKaTeX(mathDivs);

      console.log("KaTeX重新渲染完成");
    } catch (e) {
      console.warn("KaTeX处理过程中出错:", e);
    }
  }

  // 如果网页用的是其他数学公式渲染库，我们可能需要额外处理
  // 这里添加一个通用的延迟，以确保任何动态渲染都有时间完成
  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log("数学公式预处理完成");
}

/**
 * 预处理Mermaid图表，确保它们被正确渲染
 * @param {HTMLElement} rootElement - 包含Mermaid图表的根元素
 * @returns {Promise} - Mermaid图表预处理完成的Promise
 */
async function preprocessMermaidCharts(rootElement) {
  // 检查是否有Mermaid图表元素
  const mermaidElements = rootElement.querySelectorAll("div.language-mermaid");
  console.log(`找到${mermaidElements.length}个Mermaid图表`);

  // 检查是否有ECharts图表元素
  const echartsElements = rootElement.querySelectorAll("div.language-echarts");
  console.log(`找到${echartsElements.length}个ECharts图表`);

  // 检查是否有Flowchart图表元素
  const flowchartElements = rootElement.querySelectorAll("div.language-flowchart");
  console.log(`找到${flowchartElements.length}个Flowchart图表`);

  // 检查是否有ABC五线谱元素
  const abcElements = rootElement.querySelectorAll("div.language-abc");
  console.log(`找到${abcElements.length}个ABC五线谱`);

  // 如果没有任何图表，直接返回
  if (mermaidElements.length === 0 && echartsElements.length === 0 && flowchartElements.length === 0 && abcElements.length === 0) {
    console.log("没有找到需要处理的图表，跳过预处理");
    return;
  }

  // 处理Mermaid图表
  if (mermaidElements.length > 0) {
    await handleMermaidCharts(mermaidElements);
  }

  // 处理ECharts图表
  if (echartsElements.length > 0) {
    await handleEchartsCharts(echartsElements);
  }

  // 处理Flowchart图表
  if (flowchartElements.length > 0) {
    await handleFlowchartCharts(flowchartElements);
  }

  // 处理ABC五线谱
  if (abcElements.length > 0) {
    await handleAbcNotation(abcElements);
  }

  // 等待所有图表处理完成
  await new Promise((resolve) => setTimeout(resolve, 2000)); // 增加等待时间到2秒，确保复杂图表有足够渲染时间

  // 最后检查是否有未能渲染的图表元素，应用降级策略
  const allChartElements = [...mermaidElements, ...echartsElements, ...flowchartElements, ...abcElements];
  applyFallbackForUnrenderedCharts(allChartElements);

  console.log("所有图表处理完成");
}

/**
 * 为未能成功渲染的图表应用降级策略
 * @param {Array} chartElements - 所有图表元素数组
 */
function applyFallbackForUnrenderedCharts(chartElements) {
  chartElements.forEach((el, index) => {
    // 检测元素是否已被渲染（通常渲染后会有SVG或Canvas子元素）
    const isRendered = el.querySelector("svg") || el.querySelector("canvas") || el.querySelector(".echarts-container");
    const chartType = getChartTypeFromElement(el);

    if (!isRendered) {
      console.warn(`图表 #${index + 1} (${chartType}) 未能渲染，应用降级策略`);

      // 保存原始代码
      const originalCode = el.textContent.trim();

      // 创建一个格式化的代码显示区域
      const codeContainer = document.createElement("pre");
      codeContainer.className = "chart-fallback-code";
      codeContainer.style.textAlign = "left";
      codeContainer.style.margin = "1em auto";
      codeContainer.style.padding = "10px";
      codeContainer.style.backgroundColor = "#f6f8fa";
      codeContainer.style.borderRadius = "4px";
      codeContainer.style.overflow = "auto";
      codeContainer.style.maxWidth = "100%";
      codeContainer.style.border = "1px solid #ddd";

      // 创建代码元素
      const codeElement = document.createElement("code");
      codeElement.textContent = originalCode;
      codeElement.style.whiteSpace = "pre-wrap";
      codeElement.style.fontFamily = "monospace, Consolas, 'Courier New', monospace";
      codeElement.style.fontSize = "13px";

      // 添加一个注释，说明图表未能渲染
      const noteElement = document.createElement("div");
      noteElement.className = "chart-fallback-note";
      noteElement.textContent = `注意：${chartType}图表未能渲染，显示原始代码。`;
      noteElement.style.color = "#856404";
      noteElement.style.backgroundColor = "#fff3cd";
      noteElement.style.padding = "8px";
      noteElement.style.borderRadius = "4px";
      noteElement.style.marginBottom = "10px";
      noteElement.style.fontSize = "14px";
      noteElement.style.textAlign = "center";

      // 将注释和代码添加到容器中
      codeContainer.appendChild(noteElement);
      codeContainer.appendChild(codeElement);

      // 清空原始元素内容并添加降级显示
      el.innerHTML = "";
      el.appendChild(codeContainer);
    }
  });
}

/**
 * 根据元素类名获取图表类型
 * @param {HTMLElement} element - 图表元素
 * @returns {string} - 图表类型名称
 */
function getChartTypeFromElement(element) {
  if (element.classList.contains("language-mermaid")) return "Mermaid";
  if (element.classList.contains("language-echarts")) return "ECharts";
  if (element.classList.contains("language-flowchart")) return "Flowchart";
  if (element.classList.contains("language-abc")) return "ABC五线谱";
  return "未知类型";
}

/**
 * 处理Mermaid图表
 * @param {NodeList} mermaidElements - Mermaid图表元素列表
 * @returns {Promise} - 处理完成的Promise
 */
async function handleMermaidCharts(mermaidElements) {
  // 检查页面中是否有Mermaid库
  const hasMermaid = typeof window.mermaid !== "undefined";
  console.log("检测到的Mermaid图表渲染库:", { mermaid: hasMermaid });

  if (hasMermaid && window.mermaid.init) {
    try {
      console.log("尝试使用Mermaid重新渲染图表");

      // 确保Mermaid配置正确
      if (typeof window.mermaid.initialize === "function") {
        window.mermaid.initialize({
          startOnLoad: true,
          theme: "default",
          securityLevel: "loose", // 允许在沙箱中渲染
          fontFamily: "sans-serif", // 使用默认字体以避免加载问题
        });
      }

      // 收集需要渲染的Mermaid元素
      const unrenderedMermaidElements = Array.from(mermaidElements).filter((el) => {
        // 如果元素已被渲染，会有svg子元素
        return !el.querySelector("svg");
      });

      if (unrenderedMermaidElements.length > 0) {
        console.log(`找到${unrenderedMermaidElements.length}个未渲染的Mermaid图表`);

        // 为每个未渲染的元素添加必要的属性
        unrenderedMermaidElements.forEach((el, index) => {
          if (!el.getAttribute("id")) {
            el.setAttribute("id", `mermaid-diagram-${Date.now()}-${index}`);
          }
          // 确保内容是纯文本，而不是HTML
          const content = el.textContent.trim();
          if (content && !el.getAttribute("data-processed")) {
            // 标记为需要处理
            el.setAttribute("data-mermaid-needs-rendering", "true");
            // 确保内容格式正确
            if (!el.classList.contains("mermaid")) {
              el.classList.add("mermaid");
            }
          }
        });

        // 使用多级渲染尝试策略，最大化成功率
        let renderSuccess = false;

        // 尝试方法1: 使用mermaid.run API (较新版本)
        if (!renderSuccess && typeof window.mermaid.run === "function") {
          try {
            await window.mermaid.run({
              querySelector: '.language-mermaid[data-mermaid-needs-rendering="true"]',
            });
            console.log("使用mermaid.run成功渲染图表");
            renderSuccess = true;
          } catch (err) {
            console.warn("使用mermaid.run渲染时出错，将尝试其他方法:", err);
          }
        }

        // 尝试方法2: 逐个使用init方法 (兼容较旧版本)
        if (!renderSuccess) {
          try {
            let individualSuccess = 0;
            for (const el of unrenderedMermaidElements) {
              try {
                await window.mermaid.init(undefined, el);
                console.log(`成功渲染图表 ${el.getAttribute("id") || "unknown"}`);
                individualSuccess++;
              } catch (initErr) {
                console.warn(`渲染单个图表失败:`, initErr);
              }
            }

            if (individualSuccess > 0) {
              console.log(`使用init方法成功渲染了${individualSuccess}/${unrenderedMermaidElements.length}个图表`);
              renderSuccess = true;
            }
          } catch (e) {
            console.warn("使用init方法渲染时出错:", e);
          }
        }

        // 尝试方法3: 最基本的DOM替换方法 (终极降级)
        if (!renderSuccess) {
          try {
            for (const el of unrenderedMermaidElements) {
              try {
                // 获取图表代码
                const code = el.textContent.trim();
                // 重新构建Mermaid图表元素
                const newElement = document.createElement("div");
                newElement.className = "mermaid";
                newElement.textContent = code;

                // 替换原始元素的内容
                el.innerHTML = "";
                el.appendChild(newElement);

                // 尝试再次调用渲染
                window.mermaid.contentLoaded();
              } catch (err) {
                console.warn("尝试基本DOM替换方法失败:", err);
              }
            }
          } catch (e) {
            console.warn("使用基本DOM替换方法时出错:", e);
          }
        }

        // 移除临时属性
        unrenderedMermaidElements.forEach((el) => {
          el.removeAttribute("data-mermaid-needs-rendering");
        });
      }

      // 为所有图表添加优化样式
      mermaidElements.forEach((el) => {
        const svg = el.querySelector("svg");
        if (svg) {
          // 优化SVG样式，确保完整显示
          svg.style.maxWidth = "100%";
          svg.style.height = "auto";
          svg.style.display = "block";
          svg.style.margin = "0 auto";

          // 确保SVG中的文本清晰可见
          const texts = svg.querySelectorAll("text");
          texts.forEach((text) => {
            text.style.fontFamily = "Arial, sans-serif";
            text.style.fontSize = "12px";
            text.style.fontWeight = "normal";
          });
        }
      });

      console.log("Mermaid图表预处理和样式优化完成");
    } catch (e) {
      console.warn("Mermaid处理过程中出错:", e);
    }
  } else {
    console.warn("没有找到Mermaid库，无法渲染图表。图表在输出中可能显示为原始代码。");
  }
}

/**
 * 处理ECharts图表
 * @param {NodeList} echartsElements - ECharts图表元素列表
 * @returns {Promise} - 处理完成的Promise
 */
async function handleEchartsCharts(echartsElements) {
  // 检查页面中是否有ECharts库
  const hasECharts = typeof window.echarts !== "undefined";
  console.log("检测到的ECharts图表渲染库:", { echarts: hasECharts });

  if (hasECharts) {
    try {
      console.log("尝试渲染ECharts图表");

      // 处理每个ECharts元素
      for (let i = 0; i < echartsElements.length; i++) {
        const el = echartsElements[i];

        // 检查是否已经渲染（已渲染的元素通常有canvas子元素）
        const isRendered = el.querySelector("canvas") || el.querySelector(".echarts-container");

        if (!isRendered) {
          try {
            // 为图表创建一个容器
            const chartContainer = document.createElement("div");
            chartContainer.className = "echarts-container";
            chartContainer.style.width = "100%";
            chartContainer.style.height = "400px"; // 默认高度
            chartContainer.style.margin = "0 auto";

            // 提取ECharts配置
            let chartConfig = {};
            try {
              // 尝试解析JSON配置
              const jsonContent = el.textContent.trim();
              chartConfig = JSON.parse(jsonContent);
            } catch (parseErr) {
              console.warn("解析ECharts配置失败:", parseErr);
              continue; // 跳过此图表
            }

            // 清空原始元素内容并添加图表容器
            el.innerHTML = "";
            el.appendChild(chartContainer);

            // 初始化ECharts实例
            const chart = window.echarts.init(chartContainer);

            // 设置图表配置
            chart.setOption(chartConfig);

            // 为导出优化
            chart.resize();

            console.log(`成功渲染ECharts图表 #${i + 1}`);
          } catch (chartErr) {
            console.warn(`渲染ECharts图表 #${i + 1} 失败:`, chartErr);
          }
        } else {
          console.log(`ECharts图表 #${i + 1} 已经渲染，跳过`);
        }
      }

      console.log("ECharts图表处理完成");
    } catch (e) {
      console.warn("ECharts处理过程中出错:", e);
    }
  } else {
    console.warn("没有找到ECharts库，无法渲染图表。图表在输出中可能显示为原始代码。");
  }

  // 等待渲染完成
  await new Promise((resolve) => setTimeout(resolve, 500));
}

/**
 * 处理Flowchart图表
 * @param {NodeList} flowchartElements - Flowchart图表元素列表
 * @returns {Promise} - 处理完成的Promise
 */
async function handleFlowchartCharts(flowchartElements) {
  // 检查页面中是否有flowchart.js库
  const hasFlowchart = typeof window.flowchart !== "undefined";
  console.log("检测到的Flowchart图表渲染库:", { flowchart: hasFlowchart });

  if (hasFlowchart) {
    try {
      console.log("尝试渲染Flowchart图表");

      // 处理每个Flowchart元素
      for (let i = 0; i < flowchartElements.length; i++) {
        const el = flowchartElements[i];

        // 检查是否已经渲染（已渲染的元素通常有svg子元素）
        const isRendered = el.querySelector("svg");

        if (!isRendered) {
          try {
            // 为图表创建一个容器
            const chartId = `flowchart-${Date.now()}-${i}`;
            const chartContainer = document.createElement("div");
            chartContainer.id = chartId;
            chartContainer.style.width = "100%";
            chartContainer.style.margin = "0 auto";

            // 提取Flowchart代码
            const code = el.textContent.trim();

            // 清空原始元素内容并添加图表容器
            el.innerHTML = "";
            el.appendChild(chartContainer);

            // 创建并渲染Flowchart
            const chart = window.flowchart.parse(code);
            chart.drawSVG(chartId, {
              "line-width": 2,
              "line-length": 50,
              "text-margin": 10,
              "font-size": 14,
              "font-color": "black",
              "line-color": "black",
              "element-color": "black",
              fill: "white",
              "yes-text": "yes",
              "no-text": "no",
              "arrow-end": "block",
              scale: 1,
              symbols: {
                start: {
                  "font-color": "white",
                  "element-color": "green",
                  fill: "green",
                },
                end: {
                  "font-color": "white",
                  "element-color": "red",
                  fill: "red",
                },
              },
            });

            console.log(`成功渲染Flowchart图表 #${i + 1}`);
          } catch (chartErr) {
            console.warn(`渲染Flowchart图表 #${i + 1} 失败:`, chartErr);
          }
        } else {
          console.log(`Flowchart图表 #${i + 1} 已经渲染，跳过`);
        }
      }

      console.log("Flowchart图表处理完成");
    } catch (e) {
      console.warn("Flowchart处理过程中出错:", e);
    }
  } else {
    console.warn("没有找到Flowchart.js库，无法渲染图表。图表在输出中可能显示为原始代码。");
  }

  // 等待渲染完成
  await new Promise((resolve) => setTimeout(resolve, 500));
}

/**
 * 处理ABC五线谱
 * @param {NodeList} abcElements - ABC五线谱元素列表
 * @returns {Promise} - 处理完成的Promise
 */
async function handleAbcNotation(abcElements) {
  // 检查页面中是否有abcjs库
  const hasAbcJs = typeof window.ABCJS !== "undefined";
  console.log("检测到的ABC五线谱渲染库:", { abcjs: hasAbcJs });

  if (hasAbcJs) {
    try {
      console.log("尝试渲染ABC五线谱");

      // 处理每个ABC元素
      for (let i = 0; i < abcElements.length; i++) {
        const el = abcElements[i];

        // 检查是否已经渲染（已渲染的元素通常有svg子元素）
        const isRendered = el.querySelector("svg");

        if (!isRendered) {
          try {
            // 提取ABC代码
            const code = el.textContent.trim();

            // 为五线谱创建一个容器
            const notationContainer = document.createElement("div");
            notationContainer.className = "abc-notation";
            notationContainer.style.width = "100%";
            notationContainer.style.margin = "0 auto";

            // 清空原始元素内容并添加容器
            el.innerHTML = "";
            el.appendChild(notationContainer);

            // 渲染ABC五线谱
            window.ABCJS.renderAbc(notationContainer, code, {
              responsive: "resize",
              add_classes: true,
              paddingtop: 15,
              paddingbottom: 15,
              paddingright: 15,
              paddingleft: 15,
              staffwidth: 800,
            });

            console.log(`成功渲染ABC五线谱 #${i + 1}`);
          } catch (abcErr) {
            console.warn(`渲染ABC五线谱 #${i + 1} 失败:`, abcErr);
          }
        } else {
          console.log(`ABC五线谱 #${i + 1} 已经渲染，跳过`);
        }
      }

      console.log("ABC五线谱处理完成");
    } catch (e) {
      console.warn("ABC五线谱处理过程中出错:", e);
    }
  } else {
    console.warn("没有找到ABCJS库，无法渲染五线谱。五线谱在输出中可能显示为原始代码。");
  }

  // 等待渲染完成
  await new Promise((resolve) => setTimeout(resolve, 500));
}

/**
 * 预处理代码块和文本，提高导出图像的清晰度
 * @param {HTMLElement} rootElement - 包含代码块和文本的根元素
 * @returns {Promise} - 预处理完成的Promise
 */
async function preprocessCodeAndText(rootElement) {
  console.log("开始处理代码块和文本，提高清晰度...");

  // 处理代码块 - 提高代码块的可读性
  const codeBlocks = rootElement.querySelectorAll("pre code, pre.hljs");
  console.log(`找到${codeBlocks.length}个代码块`);

  codeBlocks.forEach((codeBlock) => {
    // 应用CSS样式以提高代码块可读性
    codeBlock.style.fontFamily = 'monospace, Consolas, "Courier New", monospace';
    codeBlock.style.fontSize = "13px";
    codeBlock.style.lineHeight = "1.5";
    codeBlock.style.tabSize = "4";
    codeBlock.style.whiteSpace = "pre-wrap";
    codeBlock.style.wordBreak = "keep-all";
    codeBlock.style.overflow = "visible";

    // 增强代码块父元素的样式
    const preElement = codeBlock.closest("pre");
    if (preElement) {
      preElement.style.margin = "1em 0";
      preElement.style.padding = "12px 16px";
      preElement.style.overflow = "visible";
      preElement.style.borderRadius = "4px";
      // 确保背景色与前景色对比明显
      if (!preElement.style.backgroundColor) {
        preElement.style.backgroundColor = "#f6f8fa";
      }
    }
  });

  // 增强标题和段落的文本清晰度
  const textElements = rootElement.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li, td, th");
  console.log(`找到${textElements.length}个文本元素`);

  textElements.forEach((textElement) => {
    // 应用字体平滑和渲染优化
    textElement.style.textRendering = "optimizeLegibility";
    textElement.style.webkitFontSmoothing = "antialiased";
    textElement.style.mozOsxFontSmoothing = "grayscale";

    // 优化字体设置
    if (!textElement.style.fontFamily) {
      textElement.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    }

    // 确保适当的行高，提高可读性
    if (!textElement.style.lineHeight) {
      textElement.style.lineHeight = "1.6";
    }
  });

  // 优化表格显示
  const tables = rootElement.querySelectorAll("table");
  tables.forEach((table) => {
    table.style.borderCollapse = "collapse";
    table.style.width = "auto";
    table.style.maxWidth = "100%";
    table.style.margin = "1em 0";
    table.style.overflow = "visible";

    // 处理表格单元格
    const cells = table.querySelectorAll("th, td");
    cells.forEach((cell) => {
      cell.style.padding = "8px 12px";
      cell.style.border = "1px solid #ddd";
    });
  });

  console.log("代码块和文本处理完成");
  return Promise.resolve();
}

/**
 * 将Base64数据URL转换为Blob对象
 * @param {string} dataUrl - Base64数据URL
 * @returns {Blob} - Blob对象
 */
function dataURLToBlob(dataUrl) {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new Blob([u8arr], { type: mime });
}

export default {
  elementToPng,
  elementToJpeg,
  editorContentToPng,
};
