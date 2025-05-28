/**
 * 文件类型图标工具
 * 提供根据文件类型返回相应SVG图标的功能
 *
 * 此模块专注于图标渲染，使用MimeTypeUtils.js来进行文件类型判断
 * 提供了三种方式获取图标：
 * 1. getFileIcon: 基于文件项对象获取图标
 * 2. getFileIconByMimeType: 基于MIME类型获取图标
 * 3. getFileIconByFilename: 基于文件名获取图标
 */

// 导入MimeTypeUtils中的函数和常量
import { getFileExtension, getFileTypeFromExtension, getMimeTypeGroup, MIME_GROUPS } from "./mimeTypeUtils.js";

// 文件类型图标映射
const fileIconsMap = {
  // 图片文件
  image: (darkMode = false) => `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-full h-full" viewBox="0 0 24 24" fill="none">
      <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3Z" 
        stroke="${darkMode ? "#60a5fa" : "#2563eb"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M8.5 10C9.32843 10 10 9.32843 10 8.5C10 7.67157 9.32843 7 8.5 7C7.67157 7 7 7.67157 7 8.5C7 9.32843 7.67157 10 8.5 10Z" 
        stroke="${darkMode ? "#60a5fa" : "#2563eb"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M21 15L16 10L5 21" stroke="${darkMode ? "#60a5fa" : "#2563eb"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="8.5" cy="8.5" r="1.5" fill="${darkMode ? "#60a5fa" : "#2563eb"}" />
    </svg>
  `,

  // 文档文件
  document: (darkMode = false) => `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-full h-full" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" 
        stroke="${darkMode ? "#f87171" : "#dc2626"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M14 2V8H20" stroke="${darkMode ? "#f87171" : "#dc2626"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M16 13H8" stroke="${darkMode ? "#f87171" : "#dc2626"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M16 17H8" stroke="${darkMode ? "#f87171" : "#dc2626"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M10 9H9H8" stroke="${darkMode ? "#f87171" : "#dc2626"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,

  // PDF 文件
  pdf: (darkMode = false) => `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-full h-full" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" 
        stroke="${darkMode ? "#ef4444" : "#b91c1c"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="${darkMode ? "#fee2e2" : "#fee2e2"}" fill-opacity="${
      darkMode ? "0.1" : "0.2"
  }"/>
      <path d="M14 2V8H20" stroke="${darkMode ? "#ef4444" : "#b91c1c"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      
      <!-- PDF 文字 -->
      <text x="12" y="15" font-family="Arial, sans-serif" font-size="6" font-weight="bold" text-anchor="middle" fill="${darkMode ? "#ef4444" : "#b91c1c"}">PDF</text>
    </svg>
  `,

  // 代码文件
  code: (darkMode = false) => `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-full h-full" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="3" width="20" height="18" rx="2" stroke="${darkMode ? "#a78bfa" : "#7c3aed"}" stroke-width="2" fill="${darkMode ? "#a78bfa" : "#7c3aed"}" fill-opacity="${
      darkMode ? "0.1" : "0.1"
  }"/>
      <path d="M9 9L5 12L9 15" stroke="${darkMode ? "#a78bfa" : "#7c3aed"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M15 9L19 12L15 15" stroke="${darkMode ? "#a78bfa" : "#7c3aed"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 7L10 17" stroke="${darkMode ? "#a78bfa" : "#7c3aed"}" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `,

  // 压缩文件
  archive: (darkMode = false) => `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-full h-full" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="2" width="16" height="20" rx="2" stroke="${darkMode ? "#fbbf24" : "#d97706"}" stroke-width="2" fill="${darkMode ? "#fbbf24" : "#d97706"}" fill-opacity="${
      darkMode ? "0.1" : "0.1"
  }"/>
      <path d="M10 2H14V4H10V2Z" fill="${darkMode ? "#fbbf24" : "#d97706"}"/>
      <path d="M10 6H14V8H10V6Z" fill="${darkMode ? "#fbbf24" : "#d97706"}"/>
      <path d="M10 10H14V12H10V10Z" fill="${darkMode ? "#fbbf24" : "#d97706"}"/>
      <path d="M10 14H14V16H10V14Z" fill="${darkMode ? "#fbbf24" : "#d97706"}"/>
      <path d="M10 18H14V20H10V18Z" fill="${darkMode ? "#fbbf24" : "#d97706"}"/>
    </svg>
  `,

  // 音频文件
  audio: (darkMode = false) => `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-full h-full" viewBox="0 0 24 24" fill="none">
      <path d="M9 18V5L21 3V16" stroke="${darkMode ? "#22d3ee" : "#0891b2"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M6 21C7.65685 21 9 19.6569 9 18C9 16.3431 7.65685 15 6 15C4.34315 15 3 16.3431 3 18C3 19.6569 4.34315 21 6 21Z" 
        stroke="${darkMode ? "#22d3ee" : "#0891b2"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="${darkMode ? "#22d3ee" : "#0891b2"}" fill-opacity="${
      darkMode ? "0.1" : "0.1"
  }"/>
      <path d="M18 19C19.6569 19 21 17.6569 21 16C21 14.3431 19.6569 13 18 13C16.3431 13 15 14.3431 15 16C15 17.6569 16.3431 19 18 19Z" 
        stroke="${darkMode ? "#22d3ee" : "#0891b2"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="${darkMode ? "#22d3ee" : "#0891b2"}" fill-opacity="${
      darkMode ? "0.1" : "0.1"
  }"/>
    </svg>
  `,

  // 视频文件
  video: (darkMode = false) => `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-full h-full" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="${darkMode ? "#ec4899" : "#db2777"}" stroke-width="2" fill="${darkMode ? "#ec4899" : "#db2777"}" fill-opacity="${
      darkMode ? "0.1" : "0.1"
  }"/>
      <path d="M10 9L15 12L10 15V9Z" fill="${darkMode ? "#ec4899" : "#db2777"}" stroke="${
      darkMode ? "#ec4899" : "#db2777"
  }" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,

  // 可执行文件
  executable: (darkMode = false) => `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-full h-full" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="3" width="20" height="18" rx="2" stroke="${darkMode ? "#10b981" : "#059669"}" stroke-width="2" fill="${darkMode ? "#10b981" : "#059669"}" fill-opacity="${
      darkMode ? "0.1" : "0.1"
  }"/>
      <path d="M12 7L12 13" stroke="${darkMode ? "#10b981" : "#059669"}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="12" cy="16" r="1" fill="${darkMode ? "#10b981" : "#059669"}"/>
    </svg>
  `,

  // 电子表格文件
  spreadsheet: (darkMode = false) => `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-full h-full" viewBox="0 0 24 24" fill="none">
      <!-- 文档基本形状 -->
      <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" 
        stroke="${darkMode ? "#22c55e" : "#16a34a"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="${darkMode ? "#22c55e" : "#16a34a"}" fill-opacity="${
      darkMode ? "0.25" : "0.35"
  }"/>
      
      <!-- 文档折角 -->
      <path d="M14 2V8H20" stroke="${darkMode ? "#22c55e" : "#16a34a"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      
      <!-- Excel "X" 标识 - 更居中且在任何模式下都是白色 -->
      <path d="M8.5 10.5L15.5 17.5M15.5 10.5L8.5 17.5" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,

  // 演示文稿文件 (PPT)
  presentation: (darkMode = false) => `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-full h-full" viewBox="0 0 24 24" fill="none">
      <!-- 文档基本形状 -->
      <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" 
        stroke="${darkMode ? "#f97316" : "#ea580c"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="${darkMode ? "#f97316" : "#ea580c"}" fill-opacity="${
      darkMode ? "0.25" : "0.35"
  }"/>
      
      <!-- 文档折角 -->
      <path d="M14 2V8H20" stroke="${darkMode ? "#f97316" : "#ea580c"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      
      <!-- PPT "P" 标识 - 白色 -->
      <text x="12" y="15" font-family="Arial, sans-serif" font-size="9" font-weight="bold" text-anchor="middle" fill="white">P</text>
    </svg>
  `,

  // Markdown文件
  markdown: (darkMode = false) => `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-full h-full" viewBox="0 0 24 24" fill="none">
      <!-- 文档基本形状 -->
      <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" 
        stroke="${darkMode ? "#4ade80" : "#22c55e"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="${darkMode ? "#4ade80" : "#22c55e"}" fill-opacity="${
      darkMode ? "0.25" : "0.35"
  }"/>
      
      <!-- 文档折角 -->
      <path d="M14 2V8H20" stroke="${darkMode ? "#4ade80" : "#22c55e"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      
      <!-- Markdown "MD" 标识 - 白色 -->
      <text x="12" y="15" font-family="Arial, sans-serif" font-size="6" font-weight="bold" text-anchor="middle" fill="white">MD</text>
    </svg>
  `,

  // 配置文件
  config: (darkMode = false) => `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-full h-full" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="${darkMode ? "#84cc16" : "#65a30d"}" stroke-width="2" fill="${darkMode ? "#84cc16" : "#65a30d"}" fill-opacity="${
      darkMode ? "0.1" : "0.1"
  }"/>
      <!-- 大型居中齿轮 -->
      <path d="M12 7.5V6.5M12 17.5V16.5M7.5 12H6.5M17.5 12H16.5M8.4 8.4L7.7 7.7M16.3 16.3L15.6 15.6M8.4 15.6L7.7 16.3M16.3 7.7L15.6 8.4" 
        stroke="${darkMode ? "#84cc16" : "#65a30d"}" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="12" cy="12" r="4.5" stroke="${darkMode ? "#84cc16" : "#65a30d"}" stroke-width="1.8"/>
      <circle cx="12" cy="12" r="2" stroke="${darkMode ? "#84cc16" : "#65a30d"}" stroke-width="1.5" fill="${darkMode ? "#84cc16" : "#65a30d"}" fill-opacity="${
      darkMode ? "0.3" : "0.3"
  }"/>
    </svg>
  `,

  // Word文档文件
  word: (darkMode = false) => `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-full h-full" viewBox="0 0 24 24" fill="none">
      <!-- 文档基本形状 -->
      <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" 
        stroke="${darkMode ? "#2563eb" : "#1d4ed8"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="${darkMode ? "#2563eb" : "#1d4ed8"}" fill-opacity="${
      darkMode ? "0.25" : "0.35"
  }"/>
      
      <!-- 文档折角 -->
      <path d="M14 2V8H20" stroke="${darkMode ? "#2563eb" : "#1d4ed8"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      
      <!-- Word "W" 标识 - 白色 -->
      <path d="M8 10.5L10 17.5M10 17.5L12 10.5M12 10.5L14 17.5M14 17.5L16 10.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,

  // 数据库文件
  database: (darkMode = false) => `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-full h-full" viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="6" rx="8" ry="3" stroke="${darkMode ? "#06b6d4" : "#0891b2"}" stroke-width="2" fill="${darkMode ? "#06b6d4" : "#0891b2"}" fill-opacity="${
      darkMode ? "0.1" : "0.1"
  }"/>
      <path d="M20 6V12" stroke="${darkMode ? "#06b6d4" : "#0891b2"}" stroke-width="2" stroke-linecap="round"/>
      <path d="M4 6V12" stroke="${darkMode ? "#06b6d4" : "#0891b2"}" stroke-width="2" stroke-linecap="round"/>
      <ellipse cx="12" cy="12" rx="8" ry="3" stroke="${darkMode ? "#06b6d4" : "#0891b2"}" stroke-width="2" fill="${darkMode ? "#06b6d4" : "#0891b2"}" fill-opacity="${
      darkMode ? "0.1" : "0.1"
  }"/>
      <path d="M20 12V18" stroke="${darkMode ? "#06b6d4" : "#0891b2"}" stroke-width="2" stroke-linecap="round"/>
      <path d="M4 12V18" stroke="${darkMode ? "#06b6d4" : "#0891b2"}" stroke-width="2" stroke-linecap="round"/>
      <ellipse cx="12" cy="18" rx="8" ry="3" stroke="${darkMode ? "#06b6d4" : "#0891b2"}" stroke-width="2" fill="${darkMode ? "#06b6d4" : "#0891b2"}" fill-opacity="${
      darkMode ? "0.1" : "0.1"
  }"/>
    </svg>
  `,

  // 纯文本文件
  text: (darkMode = false) => `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-full h-full" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" 
        stroke="${darkMode ? "#94a3b8" : "#64748b"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="${darkMode ? "#94a3b8" : "#64748b"}" fill-opacity="${
      darkMode ? "0.1" : "0.1"
  }"/>
      <path d="M14 2V8H20" stroke="${darkMode ? "#94a3b8" : "#64748b"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M16 13H8" stroke="${darkMode ? "#94a3b8" : "#64748b"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M16 17H8" stroke="${darkMode ? "#94a3b8" : "#64748b"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M10 9H9H8" stroke="${darkMode ? "#94a3b8" : "#64748b"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,

  // 默认文件图标
  default: (darkMode = false) => `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-full h-full" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" 
        stroke="${darkMode ? "#93c5fd" : "#3b82f6"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="${darkMode ? "#93c5fd" : "#3b82f6"}" fill-opacity="${
      darkMode ? "0.1" : "0.1"
  }"/>
      <path d="M14 2V8H20" stroke="${darkMode ? "#93c5fd" : "#3b82f6"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,

  // 文件夹图标 - 更现代的设计，带有折角和立体感
  folder: (darkMode = false) => `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-full h-full" viewBox="0 0 24 24" fill="none">
      <!-- 文件夹阴影效果 -->
      <path d="M3 6C3 4.89543 3.89543 4 5 4H8.17157C8.70201 4 9.21071 4.21071 9.58579 4.58579L11 6H19C20.1046 6 21 6.89543 21 8V18C21 19.1046 20.1046 20 19 20H5C3.89543 20 3 19.1046 3 18V6Z" 
        fill="${darkMode ? "#fbbf24" : "#fcd34d"}" fill-opacity="${darkMode ? "0.08" : "0.2"}"/>

      <!-- 文件夹打开效果 - 底部 -->
      <path d="M3.5 7.5C3.5 6.67157 4.17157 6 5 6H19C19.8284 6 20.5 6.67157 20.5 7.5V18C20.5 18.8284 19.8284 19.5 19 19.5H5C4.17157 19.5 3.5 18.8284 3.5 18V7.5Z" 
        fill="${darkMode ? "#fbbf24" : "#fcd34d"}" fill-opacity="${darkMode ? "0.25" : "0.4"}" stroke="${
      darkMode ? "#fbbf24" : "#d97706"
  }" stroke-width="1" stroke-linejoin="round"/>

      <!-- 文件夹打开效果 - 顶部翻盖 -->
      <path d="M4 5.5C4 4.94772 4.44772 4.5 5 4.5H8.5C8.89746 4.5 9.27285 4.67755 9.53553 4.98223L11.2678 7H19C19.2761 7 19.5 7.22386 19.5 7.5V8.5H4V5.5Z" 
        fill="${darkMode ? "#f59e0b" : "#f59e0b"}" fill-opacity="${darkMode ? "0.45" : "0.6"}" stroke="${
      darkMode ? "#fbbf24" : "#d97706"
  }" stroke-width="1" stroke-linejoin="round"/>

      <!-- 折角效果 -->
      <path d="M5 4.5L5.75 5.25H8.25L9.5 6.25H8L7.25 5.5H5V4.5Z" 
        fill="${darkMode ? "#fbbf24" : "#f59e0b"}" fill-opacity="${darkMode ? "0.6" : "0.8"}" stroke="${
      darkMode ? "#fbbf24" : "#d97706"
  }" stroke-width="0.5" stroke-linejoin="round"/>
    </svg>
  `,

  // 挂载点文件夹图标 - 更现代的设计，带有折角和立体感
  mountFolder: (darkMode = false) => `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-full h-full" viewBox="0 0 24 24" fill="none">
      <!-- 文件夹阴影效果 -->
      <path d="M3 6C3 4.89543 3.89543 4 5 4H8.17157C8.70201 4 9.21071 4.21071 9.58579 4.58579L11 6H19C20.1046 6 21 6.89543 21 8V18C21 19.1046 20.1046 20 19 20H5C3.89543 20 3 19.1046 3 18V6Z" 
        fill="${darkMode ? "#3b82f6" : "#60a5fa"}" fill-opacity="${darkMode ? "0.08" : "0.2"}"/>

      <!-- 文件夹打开效果 - 底部 -->
      <path d="M3.5 7.5C3.5 6.67157 4.17157 6 5 6H19C19.8284 6 20.5 6.67157 20.5 7.5V18C20.5 18.8284 19.8284 19.5 19 19.5H5C4.17157 19.5 3.5 18.8284 3.5 18V7.5Z" 
        fill="${darkMode ? "#3b82f6" : "#60a5fa"}" fill-opacity="${darkMode ? "0.25" : "0.4"}" stroke="${
      darkMode ? "#3b82f6" : "#2563eb"
  }" stroke-width="1" stroke-linejoin="round"/>

      <!-- 文件夹打开效果 - 顶部翻盖 -->
      <path d="M4 5.5C4 4.94772 4.44772 4.5 5 4.5H8.5C8.89746 4.5 9.27285 4.67755 9.53553 4.98223L11.2678 7H19C19.2761 7 19.5 7.22386 19.5 7.5V8.5H4V5.5Z" 
        fill="${darkMode ? "#2563eb" : "#3b82f6"}" fill-opacity="${darkMode ? "0.45" : "0.6"}" stroke="${
      darkMode ? "#3b82f6" : "#2563eb"
  }" stroke-width="1" stroke-linejoin="round"/>

      <!-- 折角效果 -->
      <path d="M5 4.5L5.75 5.25H8.25L9.5 6.25H8L7.25 5.5H5V4.5Z" 
        fill="${darkMode ? "#3b82f6" : "#2563eb"}" fill-opacity="${darkMode ? "0.6" : "0.8"}" stroke="${
      darkMode ? "#3b82f6" : "#2563eb"
  }" stroke-width="0.5" stroke-linejoin="round"/>

      <!-- 挂载标识 "+" 符号 -->
      <path d="M12 11V15" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M10 13H14" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  `,
};

// MIME分组到图标类型的映射
const mimeGroupToIconType = {
  [MIME_GROUPS.IMAGE]: "image",
  [MIME_GROUPS.VIDEO]: "video",
  [MIME_GROUPS.AUDIO]: "audio",
  [MIME_GROUPS.DOCUMENT]: "document",
  [MIME_GROUPS.SPREADSHEET]: "spreadsheet",
  [MIME_GROUPS.PRESENTATION]: "presentation",
  [MIME_GROUPS.PDF]: "pdf",
  [MIME_GROUPS.MARKDOWN]: "markdown",
  [MIME_GROUPS.ARCHIVE]: "archive",
  [MIME_GROUPS.CODE]: "code",
  [MIME_GROUPS.CONFIG]: "config",
  [MIME_GROUPS.TEXT]: "text",
  [MIME_GROUPS.DATABASE]: "database",
  [MIME_GROUPS.FONT]: "code",
  [MIME_GROUPS.EXECUTABLE]: "executable",
  [MIME_GROUPS.DESIGN]: "image",
  [MIME_GROUPS.EBOOK]: "document",
  [MIME_GROUPS.UNKNOWN]: "default",
};

/**
 * 获取文件类型对应的图标
 * @param {Object} item - 文件项对象
 * @param {boolean} darkMode - 是否为暗色模式
 * @returns {string} SVG图标字符串
 */
export const getFileIcon = (item, darkMode = false) => {
  // 如果是文件夹
  if (item.isDirectory) {
    return item.isMount ? fileIconsMap.mountFolder(darkMode) : fileIconsMap.folder(darkMode);
  }

  // 如果是文件，根据扩展名确定图标类型
  const extension = getFileExtension(item.name);
  const fileType = getFileTypeFromExtension(extension);

  // Word文档特殊处理（doc, docx, rtf）
  if (extension && ["doc", "docx", "rtf"].includes(extension.toLowerCase())) {
    return fileIconsMap.word(darkMode);
  }

  // 有些文件类型可以直接映射到图标类型，否则尝试使用MIME分组映射
  let iconType = "default";

  // 如果fileType存在并且与图标类型直接对应
  if (fileType && fileIconsMap[fileType]) {
    iconType = fileType;
  }
  // 否则尝试通过MIME分组获取图标类型
  else if (fileType) {
    // 使用伪MIME类型（"fileType/"）来获取MIME分组
    // 这样getMimeTypeGroup可以至少通过前缀进行匹配
    const pseudoMimeType = `${fileType}/`;
    const mimeGroup = getMimeTypeGroup(pseudoMimeType);
    iconType = mimeGroupToIconType[mimeGroup] || "default";
  }

  return fileIconsMap[iconType] ? fileIconsMap[iconType](darkMode) : fileIconsMap.default(darkMode);
};

/**
 * 根据MIME类型获取文件图标
 * @param {string} mimeType - 文件的MIME类型
 * @param {boolean} isDirectory - 是否为目录
 * @param {boolean} isMount - 是否为挂载点
 * @param {boolean} darkMode - 是否为暗色模式
 * @returns {string} SVG图标字符串
 */
export const getFileIconByMimeType = (mimeType, isDirectory = false, isMount = false, darkMode = false) => {
  // 如果是文件夹
  if (isDirectory) {
    return isMount ? fileIconsMap.mountFolder(darkMode) : fileIconsMap.folder(darkMode);
  }

  // Word文档特殊处理
  if (mimeType === "application/msword" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || mimeType === "application/rtf") {
    return fileIconsMap.word(darkMode);
  }

  // 从MIME类型获取文件类型分组
  const mimeGroup = getMimeTypeGroup(mimeType);

  // 使用MIME分组映射到图标类型
  const iconType = mimeGroupToIconType[mimeGroup] || "default";

  return fileIconsMap[iconType] ? fileIconsMap[iconType](darkMode) : fileIconsMap.default(darkMode);
};

/**
 * 根据文件名获取文件图标
 * @param {string} filename - 文件名
 * @param {boolean} isDirectory - 是否为目录
 * @param {boolean} isMount - 是否为挂载点
 * @param {boolean} darkMode - 是否为暗色模式
 * @returns {string} SVG图标字符串
 */
export const getFileIconByFilename = (filename, isDirectory = false, isMount = false, darkMode = false) => {
  // 如果是文件夹
  if (isDirectory) {
    return isMount ? fileIconsMap.mountFolder(darkMode) : fileIconsMap.folder(darkMode);
  }

  // 获取扩展名并根据扩展名确定文件类型
  const extension = getFileExtension(filename);

  // Word文档特殊处理（doc, docx, rtf）
  if (extension && ["doc", "docx", "rtf"].includes(extension.toLowerCase())) {
    return fileIconsMap.word(darkMode);
  }

  const fileType = getFileTypeFromExtension(extension);

  // 有些文件类型可以直接映射到图标类型，否则尝试使用MIME分组映射
  let iconType = "default";

  if (fileType && fileIconsMap[fileType]) {
    iconType = fileType;
  } else if (fileType) {
    const pseudoMimeType = `${fileType}/`;
    const mimeGroup = getMimeTypeGroup(pseudoMimeType);
    iconType = mimeGroupToIconType[mimeGroup] || "default";
  }

  return fileIconsMap[iconType] ? fileIconsMap[iconType](darkMode) : fileIconsMap.default(darkMode);
};
