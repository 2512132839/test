<template>
  <div class="file-preview-container">
    <!-- 文件预览区域 -->
    <div class="file-preview mb-6 p-4 rounded-lg" :class="darkMode ? 'bg-gray-800/50' : 'bg-white'">
      <!-- 文件标题和操作按钮 -->
      <div class="mb-4">
        <h3 class="text-lg font-medium mb-3" :class="darkMode ? 'text-gray-200' : 'text-gray-700'" :title="file.name">
          {{ file.name }}
        </h3>
        <div class="flex flex-wrap gap-2">
          <!-- 下载按钮 -->
          <button
              @click="handleDownload"
              class="inline-flex items-center px-3 py-1.5 rounded-md transition-colors text-sm font-medium"
              :class="darkMode ? 'bg-primary-600 hover:bg-primary-700 text-white' : 'bg-primary-500 hover:bg-primary-600 text-white'"
          >
            <svg class="w-4 h-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>下载文件</span>
          </button>

          <!-- S3直链预览按钮 -->
          <button
              @click="handleS3DirectPreview"
              class="inline-flex items-center px-3 py-1.5 rounded-md transition-colors text-sm font-medium"
              :class="darkMode ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-green-500 hover:bg-green-600 text-white'"
              :disabled="isGeneratingPreview"
          >
            <svg v-if="!isGeneratingPreview" class="w-4 h-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            <svg v-else class="animate-spin w-4 h-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>{{ isGeneratingPreview ? "生成中..." : "直链预览" }}</span>
          </button>
        </div>
      </div>

      <!-- 文件信息 -->
      <div class="file-info grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-3 rounded-lg bg-opacity-50" :class="darkMode ? 'bg-gray-700/50' : 'bg-gray-100'">
        <div class="file-info-item flex items-center">
          <span class="font-medium mr-2" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">文件大小:</span>
          <span :class="darkMode ? 'text-gray-400' : 'text-gray-600'">{{ formatFileSize(file.size) }}</span>
        </div>
        <div class="file-info-item flex items-center">
          <span class="font-medium mr-2" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">修改时间:</span>
          <span :class="darkMode ? 'text-gray-400' : 'text-gray-600'">{{ formatDate(file.modified) }}</span>
        </div>
        <div class="file-info-item flex items-center">
          <span class="font-medium mr-2" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">文件类型:</span>
          <span :class="darkMode ? 'text-gray-400' : 'text-gray-600'">{{ file.contentType || "未知" }}</span>
        </div>
      </div>

      <!-- 模式切换下拉框 -->
      <div v-if="isText" class="mode-selector mb-4 p-3 rounded-lg" :class="darkMode ? 'bg-gray-700/50' : 'bg-gray-100/50'">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="relative inline-block text-left">
              <div>
                <button
                    @click="toggleModeDropdown"
                    type="button"
                    class="inline-flex justify-between items-center w-32 rounded-md border shadow-sm px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
                    :class="
                    darkMode
                      ? 'bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600 focus:ring-primary-500 focus:ring-offset-gray-800'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 focus:ring-primary-500 focus:ring-offset-white'
                  "
                    id="menu-button"
                    aria-expanded="true"
                    aria-haspopup="true"
                >
                  {{ isEditMode ? "编辑模式" : "预览模式" }}
                  <svg class="-mr-1 ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path
                        fill-rule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clip-rule="evenodd"
                    />
                  </svg>
                </button>
              </div>
              <div
                  v-if="showModeDropdown"
                  class="origin-top-right absolute left-0 mt-2 w-32 rounded-md shadow-lg focus:outline-none z-50"
                  :class="darkMode ? 'bg-gray-700 ring-1 ring-gray-600 shadow-gray-900' : 'bg-white ring-1 ring-black ring-opacity-5'"
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="menu-button"
                  tabindex="-1"
              >
                <div class="py-1" role="none">
                  <button
                      @click="selectMode('preview')"
                      class="block w-full text-left px-4 py-2 text-sm transition-colors"
                      :class="[
                      !isEditMode
                        ? darkMode
                          ? 'bg-gray-600 text-gray-100'
                          : 'bg-gray-100 text-gray-900'
                        : darkMode
                        ? 'text-gray-200 hover:bg-gray-600 hover:text-gray-100'
                        : 'text-gray-700 hover:bg-gray-100',
                    ]"
                      role="menuitem"
                      tabindex="-1"
                  >
                    预览模式
                  </button>
                  <button
                      @click="selectMode('edit')"
                      class="block w-full text-left px-4 py-2 text-sm transition-colors"
                      :class="[
                      isEditMode
                        ? darkMode
                          ? 'bg-gray-600 text-gray-100'
                          : 'bg-gray-100 text-gray-900'
                        : darkMode
                        ? 'text-gray-200 hover:bg-gray-600 hover:text-gray-100'
                        : 'text-gray-700 hover:bg-gray-100',
                    ]"
                      role="menuitem"
                      tabindex="-1"
                  >
                    编辑模式
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 仅在编辑模式下显示保存和取消按钮 -->
          <div v-if="isEditMode" class="flex space-x-2">
            <button
                @click="saveContent"
                class="inline-flex items-center px-3 py-1.5 rounded-md transition-colors text-sm font-medium"
                :class="darkMode ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-green-500 hover:bg-green-600 text-white'"
                :disabled="isSaving"
            >
              <svg v-if="!isSaving" class="w-4 h-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <svg v-else class="animate-spin w-4 h-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>{{ isSaving ? "保存中..." : "保存" }}</span>
            </button>
            <button
                @click="cancelEdit"
                class="inline-flex items-center px-3 py-1.5 rounded-md transition-colors text-sm font-medium"
                :class="darkMode ? 'bg-gray-600 hover:bg-gray-700 text-white' : 'bg-gray-500 hover:bg-gray-600 text-white'"
                :disabled="isSaving"
            >
              <svg class="w-4 h-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>取消</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 预览内容 -->
      <div class="preview-content border rounded-lg overflow-hidden" :class="darkMode ? 'border-gray-700' : 'border-gray-200'">
        <!-- 加载指示器 -->
        <div v-if="isLoading" class="flex flex-col items-center justify-center p-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2" :class="darkMode ? 'border-primary-500' : 'border-primary-600'"></div>
        </div>

        <!-- 图片预览 -->
        <div v-else-if="isImage" class="image-preview flex justify-center items-center p-4">
          <img
              v-if="authenticatedPreviewUrl"
              :src="authenticatedPreviewUrl"
              :alt="file.name"
              class="max-w-full max-h-[500px] object-contain"
              @load="handleContentLoaded"
              @error="handleContentError"
          />
          <div v-else class="loading-indicator text-center py-8">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto" :class="darkMode ? 'border-primary-500' : 'border-primary-600'"></div>
          </div>
        </div>

        <!-- 视频预览 -->
        <div v-else-if="isVideo" class="video-preview p-4">
          <video v-if="authenticatedPreviewUrl" controls class="max-w-full mx-auto max-h-[500px]" @loadeddata="handleContentLoaded" @error="handleContentError">
            <source :src="authenticatedPreviewUrl" :type="file.contentType" />
            您的浏览器不支持视频标签
          </video>
          <div v-else class="loading-indicator text-center py-8">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto" :class="darkMode ? 'border-primary-500' : 'border-primary-600'"></div>
          </div>
        </div>

        <!-- 音频预览 -->
        <div v-else-if="isAudio" class="audio-preview p-4">
          <audio v-if="authenticatedPreviewUrl" controls class="w-full" @loadeddata="handleContentLoaded" @error="handleContentError">
            <source :src="authenticatedPreviewUrl" :type="file.contentType" />
            您的浏览器不支持音频标签
          </audio>
          <div v-else class="loading-indicator text-center py-8">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto" :class="darkMode ? 'border-primary-500' : 'border-primary-600'"></div>
          </div>
        </div>

        <!-- PDF预览 -->
        <div v-else-if="isPdf" class="pdf-preview h-[500px]">
          <iframe
              v-if="authenticatedPreviewUrl"
              :src="authenticatedPreviewUrl"
              frameborder="0"
              class="w-full h-full"
              @load="handleContentLoaded"
              @error="handleContentError"
          ></iframe>
          <div v-else class="loading-indicator text-center py-8">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto" :class="darkMode ? 'border-primary-500' : 'border-primary-600'"></div>
          </div>
        </div>

        <!-- Office文件预览 -->
        <div v-else-if="isOffice" ref="officePreviewRef" class="office-preview h-[750px] w-full">
          <!-- Office预览头部控制栏 -->
          <div class="sticky top-0 z-20 flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ isWordDoc ? "Word文档预览" : isExcel ? "Excel表格预览" : "PowerPoint演示文稿预览" }}
            </span>
            <div class="flex items-center space-x-2">
              <button
                  @click="toggleOfficeFullscreen"
                  class="text-xs px-2 py-1 rounded flex items-center bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                <svg v-if="!isOfficeFullscreen" class="w-3.5 h-3.5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
                  />
                </svg>
                <svg v-else class="w-3.5 h-3.5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>{{ isOfficeFullscreen ? "退出全屏" : "全屏" }}</span>
              </button>
              <button
                  @click="toggleOfficePreviewService"
                  class="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-700 text-blue-700 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-600 transition-colors"
              >
                {{ useGoogleDocsPreview ? "使用Microsoft预览" : "使用Google预览" }}
              </button>
            </div>
          </div>

          <!-- 加载状态 -->
          <div v-if="officePreviewLoading" class="flex flex-col items-center justify-center h-full">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 mb-4" :class="darkMode ? 'border-primary-500' : 'border-primary-600'"></div>
            <p class="text-sm" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">正在加载Office预览...</p>
          </div>

          <!-- 错误状态 -->
          <div v-else-if="officePreviewError" class="flex flex-col items-center justify-center h-full p-4">
            <svg
                class="w-16 h-16 mb-4"
                :class="darkMode ? 'text-red-400' : 'text-red-500'"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
              <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p class="text-center mb-4" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">{{ officePreviewError }}</p>
            <button
                @click="updateOfficePreviewUrls"
                class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
                :class="darkMode ? 'bg-primary-600 hover:bg-primary-700 text-white' : 'bg-primary-500 hover:bg-primary-600 text-white'"
            >
              重试
            </button>
          </div>

          <!-- 预览内容 -->
          <div v-else-if="currentOfficePreviewUrl" class="w-full h-full">
            <iframe
                :src="currentOfficePreviewUrl"
                frameborder="0"
                class="w-full h-full"
                @load="handleOfficePreviewLoaded"
                @error="handleOfficePreviewError"
                sandbox="allow-scripts allow-same-origin allow-forms"
                referrerpolicy="no-referrer"
            ></iframe>
          </div>
        </div>

        <!-- Markdown预览 -->
        <div v-else-if="isMarkdown" class="markdown-preview p-4 overflow-auto max-h-[500px]">
          <div v-if="isEditMode" class="editor-container h-[500px] border" :class="darkMode ? 'border-gray-700' : 'border-gray-300'">
            <textarea
                v-model="editContent"
                class="w-full h-full p-4 font-mono text-sm focus:outline-none resize-none"
                :class="darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800'"
                spellcheck="false"
            ></textarea>
          </div>
          <div v-else>
            <div ref="previewContainer" class="vditor-preview"></div>
          </div>
        </div>

        <!-- HTML预览 -->
        <div v-else-if="isHtml" ref="htmlPreviewRef" class="html-preview overflow-auto max-h-[500px]">
          <div v-if="isEditMode" class="editor-container h-[500px] border" :class="darkMode ? 'border-gray-700' : 'border-gray-300'">
            <textarea
                v-model="editContent"
                class="w-full h-full p-4 font-mono text-sm focus:outline-none resize-none"
                :class="darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800'"
                spellcheck="false"
            ></textarea>
          </div>
          <div v-else>
            <!-- 添加HTML预览的控制栏 -->
            <div class="sticky top-0 z-20 flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">HTML预览</span>
              <div class="flex items-center">
                <button
                    @click="toggleHtmlFullscreen"
                    class="text-xs px-2 py-1 rounded flex items-center bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                >
                  <svg v-if="!isHtmlFullscreen" class="w-3.5 h-3.5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
                    />
                  </svg>
                  <svg v-else class="w-3.5 h-3.5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>{{ isHtmlFullscreen ? "退出全屏" : "全屏" }}</span>
                </button>
              </div>
            </div>
            <div class="p-4">
              <!-- 安全HTML预览使用沙盒iframe -->
              <iframe ref="htmlIframe" sandbox="allow-same-origin" class="w-full min-h-[500px] border" :class="darkMode ? 'border-gray-700' : 'border-gray-300'"></iframe>
            </div>
          </div>
        </div>

        <!-- 代码预览（包括配置文件如 JSON、YAML 等） -->
        <div v-else-if="isCode" class="code-preview p-4 overflow-auto max-h-[500px]">
          <div v-if="isEditMode" class="editor-container h-[500px] border" :class="darkMode ? 'border-gray-700' : 'border-gray-300'">
            <textarea
                v-model="editContent"
                class="w-full h-full p-4 font-mono text-sm focus:outline-none resize-none"
                :class="darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800'"
                spellcheck="false"
            ></textarea>
          </div>
          <div v-else>
            <div class="flex justify-between items-center mb-2">
              <span class="text-sm font-medium" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">
                语言: {{ codeLanguage || "自动检测" }}
                <span
                    v-if="fileTypeInfo.value && fileTypeInfo.value.category === 'config'"
                    class="ml-2 px-2 py-0.5 text-xs rounded-full"
                    :class="darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'"
                >
                  配置文件
                </span>
              </span>
            </div>
            <pre class="rounded overflow-auto"><code v-html="highlightedContent"></code></pre>
          </div>
        </div>

        <!-- 普通文本预览 -->
        <div v-else-if="isText" class="text-preview p-4 overflow-auto max-h-[500px]">
          <div v-if="isEditMode" class="editor-container h-[500px] border" :class="darkMode ? 'border-gray-700' : 'border-gray-300'">
            <textarea
                v-model="editContent"
                class="w-full h-full p-4 font-mono text-sm focus:outline-none resize-none"
                :class="darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800'"
                spellcheck="false"
            ></textarea>
          </div>
          <p v-else class="whitespace-pre-wrap" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">{{ textContent }}</p>
        </div>

        <!-- 其他文件类型或错误状态 -->
        <div v-else-if="loadError" class="generic-preview text-center py-12">
          <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-20 w-20 mx-auto mb-4"
              :class="darkMode ? 'text-red-400' : 'text-red-500'"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
          >
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p class="text-lg font-medium mb-2" :class="darkMode ? 'text-red-300' : 'text-red-700'">加载文件预览失败</p>
          <p class="text-sm" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">请尝试重新加载或下载文件查看</p>
        </div>

        <!-- 不支持预览的文件类型 -->
        <div v-else class="generic-preview text-center py-12">
          <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-20 w-20 mx-auto mb-4"
              :class="darkMode ? 'text-gray-500' : 'text-gray-400'"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
          >
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          <p class="text-lg font-medium mb-2" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">文件无法预览</p>
          <p class="text-sm" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">当前文件类型不支持在线预览，请点击下载按钮下载查看</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onUnmounted, nextTick } from "vue";
import { api } from "../../api";
import { getAuthHeaders, createAuthenticatedPreviewUrl } from "../../utils/fileUtils";
import { getMimeTypeGroupByFileDetails, getFileExtension, MIME_GROUPS, formatFileSize as formatFileSizeUtil } from "../../utils/mimeTypeUtils";
import hljs from "highlight.js";
import "highlight.js/styles/github.css"; // 亮色模式默认样式
import "highlight.js/styles/github-dark.css"; // 暗色模式样式
import Vditor from "vditor";
import "vditor/dist/index.css";

const props = defineProps({
  file: {
    type: Object,
    required: true,
  },
  darkMode: {
    type: Boolean,
    default: false,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["download", "loaded", "error", "updated"]);

// 文本内容（用于文本文件预览）
const textContent = ref("");
// 加载错误状态
const loadError = ref(false);
// 认证预览URL
const authenticatedPreviewUrl = ref(null);

// 预览按钮相关状态
const isGeneratingPreview = ref(false);

// 编辑模式状态
const isEditMode = ref(false);
// 编辑器中的内容
const editContent = ref("");
// 保存状态
const isSaving = ref(false);
// 下拉框显示状态
const showModeDropdown = ref(false);
// Markdown是否已渲染标志
const isMarkdownRendered = ref(false);
// 高亮后的HTML内容
const highlightedContent = ref("");
// 代码语言
const codeLanguage = ref("");
// 预览容器引用
const previewContainer = ref(null);
// HTML预览iframe引用
const htmlIframe = ref(null);

// Office预览相关状态
const officePreviewLoading = ref(false);
const officePreviewError = ref("");
const officePreviewTimedOut = ref(false);
const previewTimeoutId = ref(null);

// Office预览配置
const officePreviewConfig = ref({
  // 默认使用Microsoft Office Online Viewer
  defaultService: "microsoft", // 'microsoft' 或 'google'
  // 自动故障转移到另一个服务
  enableAutoFailover: true,
  // 加载超时(毫秒)
  loadTimeout: 15000,
});

// Office预览URLs
const microsoftOfficePreviewUrl = ref("");
const googleDocsPreviewUrl = ref("");

// 是否使用Google Docs预览
const useGoogleDocsPreview = ref(false);

// 当前使用的Office预览URL
const currentOfficePreviewUrl = computed(() => {
  return useGoogleDocsPreview.value ? googleDocsPreviewUrl.value : microsoftOfficePreviewUrl.value;
});

// 全屏状态管理
const isOfficeFullscreen = ref(false);
const isHtmlFullscreen = ref(false);

// Office预览容器引用
const officePreviewRef = ref(null);
// HTML预览容器引用
const htmlPreviewRef = ref(null);

// 通用全屏处理函数
const toggleFullscreen = (elementRef, isFullscreenState, onEnter, onExit) => {
  if (!isFullscreenState.value) {
    // 进入全屏
    if (elementRef.value && document.fullscreenEnabled) {
      elementRef.value
          .requestFullscreen()
          .then(() => {
            isFullscreenState.value = true;
            if (onEnter) onEnter();
          })
          .catch((err) => {
            console.error("全屏请求失败:", err);
          });
    }
  } else {
    // 退出全屏
    if (document.fullscreenElement) {
      document
          .exitFullscreen()
          .then(() => {
            isFullscreenState.value = false;
            if (onExit) onExit();
          })
          .catch((err) => {
            console.error("退出全屏失败:", err);
          });
    }
  }
};

// 切换Office预览全屏状态
const toggleOfficeFullscreen = () => {
  toggleFullscreen(
      officePreviewRef,
      isOfficeFullscreen,
      () => {
        // 在全屏模式下调整iframe高度
        nextTick(() => {
          const iframe = officePreviewRef.value.querySelector("iframe");
          const controlBar = officePreviewRef.value.querySelector(".sticky");
          if (iframe && controlBar) {
            const controlBarHeight = controlBar.offsetHeight;
            iframe.style.height = `calc(100vh - ${controlBarHeight}px)`;
          }
        });
      },
      () => {
        // 恢复原始高度
        nextTick(() => {
          const iframe = officePreviewRef.value.querySelector("iframe");
          if (iframe) {
            iframe.style.height = "100%";
          }
        });
      }
  );
};

// 切换HTML预览全屏状态
const toggleHtmlFullscreen = () => {
  toggleFullscreen(
      htmlPreviewRef,
      isHtmlFullscreen,
      () => {
        // 在全屏模式下调整iframe高度
        nextTick(() => {
          const iframe = htmlIframe.value;
          const controlBar = htmlPreviewRef.value.querySelector(".sticky");
          if (iframe && controlBar) {
            const controlBarHeight = controlBar.offsetHeight;
            iframe.style.height = `calc(100vh - ${controlBarHeight}px - 2rem)`;
          }
        });
      },
      () => {
        // 恢复原始高度
        nextTick(() => {
          if (htmlIframe.value) {
            htmlIframe.value.style.height = "";
          }
        });
      }
  );
};

// 监听全屏变化事件
const handleFullscreenChange = () => {
  // 如果不在全屏状态，重置全屏标志
  if (!document.fullscreenElement) {
    isOfficeFullscreen.value = false;
    isHtmlFullscreen.value = false;

    // 恢复Office iframe高度
    nextTick(() => {
      if (officePreviewRef.value) {
        const iframe = officePreviewRef.value.querySelector("iframe");
        if (iframe) {
          iframe.style.height = "100%";
        }
      }

      // 恢复HTML iframe高度
      if (htmlIframe.value) {
        htmlIframe.value.style.height = "";
      }
    });
  }
};

// 监听Esc键退出全屏
const handleKeyDown = (e) => {
  // 浏览器原生全屏API会自动处理Esc键退出全屏
  // 这里可以添加其他键盘快捷键处理逻辑
};

// 文件类型判断 - 使用 mimeTypeUtils 中的函数并做映射
const getFileTypeInfo = (file) => {
  // 添加对file的空值检查
  if (!file) return { type: "unknown" };

  const contentType = file.contentType || "";
  const fileName = file.name || "";
  const ext = getFileExtension(fileName);

  // 使用 mimeTypeUtils 获取基本类型组
  const mimeGroup = getMimeTypeGroupByFileDetails(contentType, fileName);

  // 映射MIME组到文件类型信息
  switch (mimeGroup) {
    case MIME_GROUPS.IMAGE:
      return { type: "image" };
    case MIME_GROUPS.VIDEO:
      return { type: "video" };
    case MIME_GROUPS.AUDIO:
      return { type: "audio" };
    case MIME_GROUPS.PDF:
      return { type: "pdf" };
    case MIME_GROUPS.MARKDOWN:
      return { type: "markdown" };
    case MIME_GROUPS.DOCUMENT:
      return { type: "office", officeType: "word" };
    case MIME_GROUPS.SPREADSHEET:
      return { type: "office", officeType: "excel" };
    case MIME_GROUPS.PRESENTATION:
      return { type: "office", officeType: "powerpoint" };
  }

  // 特殊处理HTML
  if (contentType === "text/html" || contentType === "application/xhtml+xml" || ext === "html" || ext === "htm") {
    return { type: "html" };
  }

  // 处理代码和配置文件
  if (mimeGroup === MIME_GROUPS.CODE || mimeGroup === MIME_GROUPS.CONFIG) {
    const isConfig = mimeGroup === MIME_GROUPS.CONFIG;
    const language = isConfig ? getConfigType(ext, contentType) : getCodeLanguage(ext);

    return {
      type: "code",
      category: isConfig ? "config" : "programming",
      language: language,
      configType: isConfig ? language : undefined,
    };
  }

  // 文本文件
  if (mimeGroup === MIME_GROUPS.TEXT || contentType.startsWith("text/")) {
    return { type: "text" };
  }

  return { type: "unknown" };
};

// 获取配置文件类型
const getConfigType = (ext, contentType) => {
  if (contentType === "application/json" || ext === "json") return "json";
  if (contentType.match(/^text\/ya?ml/) || contentType.includes("yaml") || ext === "yml" || ext === "yaml") return "yaml";
  if (contentType.includes("toml") || ext === "toml") return "toml";
  if (contentType.includes("xml") || ext === "xml") return "xml";
  if (ext === "ini" || contentType.includes("ini")) return "ini";
  return "plaintext";
};

// 获取代码语言
const getCodeLanguage = (ext) => {
  const extToLang = {
    js: "javascript",
    ts: "typescript",
    jsx: "javascript",
    tsx: "typescript",
    html: "html",
    css: "css",
    scss: "scss",
    less: "less",
    py: "python",
    java: "java",
    c: "c",
    cpp: "cpp",
    cs: "csharp",
    go: "go",
    rs: "rust",
    php: "php",
    rb: "ruby",
    swift: "swift",
    kt: "kotlin",
    dart: "dart",
    sql: "sql",
    sh: "bash",
    bat: "batch",
    ps1: "powershell",
    vue: "vue",
  };

  return extToLang[ext] || "";
};

// 当前文件的类型信息
const fileTypeInfo = computed(() => getFileTypeInfo(props.file));

// 生成原始预览URL (仅用于构建最终URL, 不直接使用)
const previewUrl = computed(() => {
  return props.isAdmin ? api.fs.getAdminFilePreviewUrl(props.file.path) : api.fs.getUserFilePreviewUrl(props.file.path);
});

// 文件类型判断 - 使用fileTypeInfo计算属性
const isImage = computed(() => fileTypeInfo.value && fileTypeInfo.value.type === "image");
const isVideo = computed(() => fileTypeInfo.value && fileTypeInfo.value.type === "video");
const isAudio = computed(() => fileTypeInfo.value && fileTypeInfo.value.type === "audio");
const isPdf = computed(() => fileTypeInfo.value && fileTypeInfo.value.type === "pdf");
const isMarkdown = computed(() => fileTypeInfo.value && fileTypeInfo.value.type === "markdown");
const isHtml = computed(() => fileTypeInfo.value && fileTypeInfo.value.type === "html");
const isCode = computed(() => fileTypeInfo.value && fileTypeInfo.value.type === "code");
const isOffice = computed(() => fileTypeInfo.value && fileTypeInfo.value.type === "office");
const isWordDoc = computed(() => isOffice.value && fileTypeInfo.value.officeType === "word");
const isExcel = computed(() => isOffice.value && fileTypeInfo.value.officeType === "excel");
const isPowerPoint = computed(() => isOffice.value && fileTypeInfo.value.officeType === "powerpoint");
const isText = computed(
    () =>
        fileTypeInfo.value && (fileTypeInfo.value.type === "text" || fileTypeInfo.value.type === "markdown" || fileTypeInfo.value.type === "html" || fileTypeInfo.value.type === "code")
);

// 统一初始化预览内容的函数
const initializePreview = async () => {
  if (!textContent.value) return;

  if (isMarkdown.value) {
    await initMarkdownPreview();
  } else if (isHtml.value) {
    await initHtmlPreview();
  } else if (isCode.value) {
    // 统一处理所有代码类型文件
    highlightAndFormatCode();
  }
};

// 主题切换时重新初始化预览的函数
const reinitializePreviewOnThemeChange = async () => {
  if (isEditMode.value) return; // 编辑模式下不需要重新初始化预览

  let scrollPosition = 0;

  // 保存当前滚动位置（如果有滚动容器）
  if (isMarkdown.value && previewContainer.value) {
    scrollPosition = previewContainer.value.scrollTop || 0;
  }

  // 如果是Markdown，重置渲染状态
  if (isMarkdown.value) {
    isMarkdownRendered.value = false;
  }

  // 对不同类型的文件进行特定处理
  await initializePreview();

  // 恢复滚动位置（如果之前有记录）
  if (isMarkdown.value && previewContainer.value && scrollPosition > 0) {
    await nextTick();
    previewContainer.value.scrollTop = scrollPosition;
  }
};

// 加载文本内容（仅对文本文件）
const loadTextContent = async () => {
  if (isText.value) {
    try {
      console.log("加载文本内容，URL:", previewUrl.value);
      // 使用预览URL并添加认证头信息
      const response = await fetch(previewUrl.value, {
        headers: getAuthHeaders(),
        mode: "cors", // 明确设置跨域模式
        credentials: "include", // 包含凭证（cookies等）
      });

      if (response.ok) {
        textContent.value = await response.text();
        await initializePreview();
        handleContentLoaded();
      } else {
        textContent.value = "无法加载文本内容";
        handleContentError();
      }
    } catch (error) {
      console.error("加载文本内容错误:", error);
      textContent.value = "加载文本内容时出错";
      handleContentError();
    }
  }
};

// 获取认证预览URL
const fetchAuthenticatedUrl = async () => {
  try {
    authenticatedPreviewUrl.value = await createAuthenticatedPreviewUrl(previewUrl.value);
  } catch (error) {
    console.error("获取认证预览URL失败:", error);
    loadError.value = true;
    emit("error");
  }
};

// 获取Office文件预览URL
const updateOfficePreviewUrls = async () => {
  // 设置加载状态
  officePreviewLoading.value = true;
  officePreviewError.value = "";

  // 清除可能存在的上一个超时计时器
  clearPreviewLoadTimeout();

  console.log("正在获取Office预览URL", {
    filePath: props.file.path,
    fileName: props.file.name,
    fileType: props.file.contentType || getFileTypeFromName(props.file.name),
  });

  try {
    // 获取直接预签名URL
    const directUrl = await getOfficeDirectUrlForPreview();

    if (directUrl) {
      // 确保URL是完整的绝对URL，并且对URL进行编码
      const encodedUrl = encodeURIComponent(directUrl);

      // 设置Microsoft Office Online Viewer URL
      microsoftOfficePreviewUrl.value = `https://view.officeapps.live.com/op/view.aspx?src=${encodedUrl}`;

      // 设置Google Docs Viewer URL
      googleDocsPreviewUrl.value = `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;

      console.log("Office预览URL生成成功", {
        microsoft: microsoftOfficePreviewUrl.value.substring(0, 100) + "...",
        google: googleDocsPreviewUrl.value.substring(0, 100) + "...",
      });

      officePreviewLoading.value = false;

      // 启动预览加载超时计时器
      startPreviewLoadTimeout();
    } else {
      throw new Error("获取到的预签名URL无效");
    }
  } catch (error) {
    console.error("获取Office预览URL失败:", error);
    officePreviewError.value = error.message || "预览加载失败，无法获取直接访问链接";
    officePreviewLoading.value = false;

    // 清除超时计时器
    clearPreviewLoadTimeout();
  }
};

// 辅助函数：从文件名获取文件类型
const getFileTypeFromName = (fileName) => {
  if (!fileName) return "unknown";
  const ext = fileName.split(".").pop().toLowerCase();

  // Office文档类型
  if (["doc", "docx", "odt", "rtf"].includes(ext)) return "word";
  if (["xls", "xlsx", "ods", "csv"].includes(ext)) return "excel";
  if (["ppt", "pptx", "odp"].includes(ext)) return "powerpoint";

  return ext;
};

// 获取Office文件的直接URL
const getOfficeDirectUrlForPreview = async () => {
  try {
    // 使用文件直链API获取预签名URL
    const fileLinkApi = props.isAdmin ? api.fs.getAdminFileLink : api.fs.getUserFileLink;
    const response = await fileLinkApi(props.file.path, 3600, false); // 设置1小时过期时间，不强制下载

    // 检查API响应的完整结构
    if (response && response.success && response.data && response.data.presignedUrl) {
      console.log("获取Office文件预签名URL成功:", response.data.presignedUrl);
      return response.data.presignedUrl;
    }

    // 记录详细日志以便调试
    console.error("API响应格式不符合预期:", response);
    throw new Error("无法获取Office文件的预签名URL");
  } catch (error) {
    console.error("获取Office文件预签名URL失败:", error);
    throw error;
  }
};

// 切换Office预览服务
const toggleOfficePreviewService = () => {
  useGoogleDocsPreview.value = !useGoogleDocsPreview.value;

  // 重置错误和超时状态
  officePreviewError.value = "";
  officePreviewTimedOut.value = false;

  // 启动新的预览加载超时计时器
  startPreviewLoadTimeout();
};

// 启动预览加载超时计时器
const startPreviewLoadTimeout = () => {
  // 清除可能存在的上一个计时器
  if (previewTimeoutId.value) {
    clearTimeout(previewTimeoutId.value);
    previewTimeoutId.value = null;
  }

  // 重置超时状态
  officePreviewTimedOut.value = false;

  // 设置新的超时计时器
  previewTimeoutId.value = setTimeout(() => {
    console.warn("Office预览加载超时，超时设置：", officePreviewConfig.value.loadTimeout, "毫秒");

    // 获取当前服务名称
    const currentService = useGoogleDocsPreview.value ? "Google Docs" : "Microsoft Office";
    const alternateService = useGoogleDocsPreview.value ? "Microsoft Office" : "Google Docs";

    // 设置超时错误信息
    officePreviewError.value = `${currentService}预览加载超时，${
        officePreviewConfig.value.enableAutoFailover ? `将尝试使用${alternateService}预览` : "请尝试切换预览服务或下载文件后查看"
    }。`;

    officePreviewTimedOut.value = true;
    officePreviewLoading.value = false;

    // 如果启用了自动故障转移，尝试切换预览服务
    if (officePreviewConfig.value.enableAutoFailover) {
      // 短暂延迟后切换预览服务
      setTimeout(() => {
        // 切换预览服务
        useGoogleDocsPreview.value = !useGoogleDocsPreview.value;
        console.log(`加载超时，自动切换到${useGoogleDocsPreview.value ? "Google Docs" : "Microsoft Office"} Viewer`);

        // 重置错误和超时状态
        officePreviewError.value = "";
        officePreviewTimedOut.value = false;

        // 重新设置加载状态
        officePreviewLoading.value = true;

        // 启动新的超时计时器
        startPreviewLoadTimeout();
      }, 1500);
    }
  }, officePreviewConfig.value.loadTimeout);
};

// 清除预览加载超时计时器
const clearPreviewLoadTimeout = () => {
  if (previewTimeoutId.value) {
    clearTimeout(previewTimeoutId.value);
    previewTimeoutId.value = null;
  }
};

// Office预览加载完成处理
const handleOfficePreviewLoaded = () => {
  officePreviewLoading.value = false;
  officePreviewError.value = "";
  officePreviewTimedOut.value = false;
  clearPreviewLoadTimeout();
  handleContentLoaded();
};

// Office预览加载错误处理
const handleOfficePreviewError = (error) => {
  console.error("Office预览加载错误:", error);

  // 清除加载状态
  officePreviewLoading.value = false;

  // 清除超时计时器
  clearPreviewLoadTimeout();

  // 获取当前服务名称
  const currentService = useGoogleDocsPreview.value ? "Google Docs" : "Microsoft Office";
  const alternateService = useGoogleDocsPreview.value ? "Microsoft Office" : "Google Docs";

  // 设置错误信息
  officePreviewError.value = `使用${currentService}预览失败，${
      officePreviewConfig.value.enableAutoFailover ? `将尝试使用${alternateService}预览` : "请尝试切换预览服务或下载文件后查看"
  }。`;

  // 如果启用了自动故障转移，并且当前不是超时状态，则切换预览服务
  if (officePreviewConfig.value.enableAutoFailover && !officePreviewTimedOut.value) {
    // 切换预览服务
    useGoogleDocsPreview.value = !useGoogleDocsPreview.value;
    console.log(`自动切换到${useGoogleDocsPreview.value ? "Google Docs" : "Microsoft Office"} Viewer`);

    // 短暂延迟后启动新的预览加载
    setTimeout(() => {
      // 重置错误信息
      officePreviewError.value = "";

      // 重新设置加载状态
      officePreviewLoading.value = true;

      // 启动预览加载超时计时器
      startPreviewLoadTimeout();
    }, 1000);
  } else {
    handleContentError();
  }
};

// 初始化Markdown预览
const initMarkdownPreview = async () => {
  if (!textContent.value) return;

  // 确保DOM更新后再初始化Vditor
  await nextTick();

  if (previewContainer.value) {
    try {
      // 清空之前的内容，避免重复渲染
      previewContainer.value.innerHTML = "";
      // 移除可能残留的主题相关类
      previewContainer.value.classList.remove("vditor-reset--dark", "vditor-reset--light");

      // 使用 Vditor 的预览 API 渲染内容
      Vditor.preview(previewContainer.value, textContent.value, {
        mode: "dark-light", // 支持明暗主题
        theme: {
          current: props.darkMode ? "dark" : "light", // 根据darkMode设置主题
        },
        cdn: "/assets/vditor",
        hljs: {
          lineNumber: true, // 代码块显示行号
          style: props.darkMode ? "vs2015" : "github", // 代码高亮样式
        },
        markdown: {
          toc: true, // 启用目录
          mark: true, // 启用标记
          footnotes: true, // 启用脚注
          autoSpace: true, // 自动空格
          media: true, // 启用媒体链接解析
          listStyle: true, // 启用列表样式支持
        },
        after: () => {
          // 渲染完成后的回调
          console.log("Markdown 内容渲染完成");

          // 强制添加对应主题的类
          if (props.darkMode) {
            previewContainer.value.classList.add("vditor-reset--dark");
            previewContainer.value.classList.remove("vditor-reset--light");
          } else {
            previewContainer.value.classList.add("vditor-reset--light");
            previewContainer.value.classList.remove("vditor-reset--dark");
          }

          isMarkdownRendered.value = true;
          handleContentLoaded();
        },
      });
    } catch (e) {
      console.error("渲染 Markdown 内容时发生错误:", e);
      // 回退到基本的文本显示
      if (previewContainer.value) {
        // 内容转义，避免XSS风险
        const safeContent = textContent.value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
        previewContainer.value.innerHTML = `<pre class="whitespace-pre-wrap">${safeContent}</pre>`;
        isMarkdownRendered.value = false;
        handleContentLoaded();
      }
    }
  }
};

// 初始化HTML预览
const initHtmlPreview = async () => {
  await nextTick();

  if (htmlIframe.value && textContent.value) {
    // 获取iframe的文档对象
    const iframeDoc = htmlIframe.value.contentDocument || htmlIframe.value.contentWindow.document;

    // 创建基本的HTML结构
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>HTML预览</title>
        <style>
          body {
            padding: 15px;
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.5;
            ${props.darkMode ? "background-color: #1f2937; color: #e5e7eb;" : "background-color: #ffffff; color: #374151;"}
          }
          /* 基本样式重置 */
          * { box-sizing: border-box; }
          img { max-width: 100%; height: auto; }
        </style>
      </head>
      <body>
        ${textContent.value}
      </body>
      </html>
    `;

    // 写入内容
    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();
  }
};

// 统一的代码高亮和格式化函数
const highlightAndFormatCode = () => {
  if (!textContent.value) return;

  try {
    const fileType = fileTypeInfo.value;
    const language = (fileType && fileType.language) || "";
    const isConfigFile = fileType && fileType.category === "config";

    // 1. 特殊处理 JSON (需要格式化)
    if (language === "json") {
      try {
        // 尝试解析和格式化 JSON
        const parsedJson = JSON.parse(textContent.value);
        const formattedJson = JSON.stringify(parsedJson, null, 2);
        highlightedContent.value = hljs.highlight(formattedJson, {
          language: "json",
          ignoreIllegals: true,
        }).value;
        codeLanguage.value = "json";
        return;
      } catch (jsonError) {
        console.error("JSON格式化错误:", jsonError);
        // 如果 JSON 解析失败，继续使用常规高亮
      }
    }

    // 2. 常规代码高亮
    if (language) {
      codeLanguage.value = language;
      highlightedContent.value = hljs.highlight(textContent.value, {
        language: language,
        ignoreIllegals: true,
      }).value;
    } else {
      // 3. 自动检测语言
      const result = hljs.highlightAuto(textContent.value);
      codeLanguage.value = result.language || "";
      highlightedContent.value = result.value;
    }
  } catch (error) {
    console.error("代码高亮错误:", error);
    highlightedContent.value = textContent.value;
  }
};

// 监听文件变更，重置状态
watch(
    () => props.file,
    () => {
      textContent.value = "";
      loadError.value = false;
      authenticatedPreviewUrl.value = null;
      highlightedContent.value = "";
      codeLanguage.value = "";
      isMarkdownRendered.value = false;

      // 重置Office预览状态
      microsoftOfficePreviewUrl.value = "";
      googleDocsPreviewUrl.value = "";
      officePreviewLoading.value = false;
      officePreviewError.value = "";
      officePreviewTimedOut.value = false;
      clearPreviewLoadTimeout();

      // 如果文件是图片、视频、音频或PDF类型，则获取认证预览URL
      if (isImage.value || isVideo.value || isAudio.value || isPdf.value) {
        fetchAuthenticatedUrl();
      }

      // 如果是Office文件，更新Office预览URL
      if (isOffice.value) {
        updateOfficePreviewUrls();
      }

      // 对于文本文件，需要手动加载内容
      if (isText.value) {
        loadTextContent();
      }
    },
    { immediate: true }
);

// 监听暗色模式变化
watch(
    () => props.darkMode,
    (newValue) => {
      reinitializePreviewOnThemeChange();
    }
);

// 内容加载成功处理
const handleContentLoaded = () => {
  loadError.value = false;
  emit("loaded");
};

// 内容加载错误处理
const handleContentError = () => {
  loadError.value = true;
  emit("error");
};

// 处理下载按钮点击
const handleDownload = () => {
  emit("download", props.file);
};

// 处理S3直链预览
const handleS3DirectPreview = async () => {
  if (isGeneratingPreview.value) return;

  try {
    isGeneratingPreview.value = true;

    // 获取文件的S3直链
    const fileLinkApi = props.isAdmin ? api.fs.getAdminFileLink : api.fs.getUserFileLink;
    const response = await fileLinkApi(props.file.path, 3600, false); // 1小时过期，不强制下载

    if (response && response.success && response.data && response.data.presignedUrl) {
      // 在新窗口中打开S3直链
      window.open(response.data.presignedUrl, "_blank");
    } else {
      console.error("获取S3直链失败:", response);
      alert("获取S3直链失败: " + (response.message || "未知错误"));
    }
  } catch (error) {
    console.error("S3直链预览错误:", error);
    alert("S3直链预览失败: " + (error.message || "未知错误"));
  } finally {
    isGeneratingPreview.value = false;
  }
};

/**
 * 格式化文件大小
 * @param {number} bytes - 文件大小（字节）
 * @returns {string} 格式化后的文件大小
 */
const formatFileSize = (bytes) => {
  return formatFileSizeUtil(bytes, true); // 使用中文单位
};

// 导入统一的时间处理工具
import { formatDateTime } from "../../utils/timeUtils.js";

/**
 * 格式化日期
 * @param {string} dateString - UTC 时间字符串
 * @returns {string} 格式化后的本地时间字符串
 */
const formatDate = (dateString) => {
  if (!dateString) return "";
  return formatDateTime(dateString);
};

// 切换下拉框显示状态
const toggleModeDropdown = () => {
  showModeDropdown.value = !showModeDropdown.value;
};

// 选择预览/编辑模式
const selectMode = (mode) => {
  if (mode === "edit" && !isEditMode.value) {
    switchToEditMode();
  } else if (mode === "preview" && isEditMode.value) {
    cancelEdit();
  }
  showModeDropdown.value = false;
};

// 点击外部关闭下拉框
const handleClickOutside = (event) => {
  const dropdown = document.querySelector(".mode-selector .relative");
  if (dropdown && !dropdown.contains(event.target) && showModeDropdown.value) {
    showModeDropdown.value = false;
  }
};

// 监听全局点击事件来关闭下拉框
onMounted(() => {
  // 添加事件监听器
  document.addEventListener("click", handleClickOutside);
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("fullscreenchange", handleFullscreenChange);
});

onUnmounted(() => {
  // 清理URL资源
  if (authenticatedPreviewUrl.value) {
    URL.revokeObjectURL(authenticatedPreviewUrl.value);
    authenticatedPreviewUrl.value = null;
  }

  // 清理编辑模式状态
  isEditMode.value = false;
  editContent.value = "";

  // 移除事件监听器
  document.removeEventListener("click", handleClickOutside);
  document.removeEventListener("keydown", handleKeyDown);
  document.removeEventListener("fullscreenchange", handleFullscreenChange);

  // 清除计时器
  clearPreviewLoadTimeout();

  // 清理其他资源
  textContent.value = "";
  microsoftOfficePreviewUrl.value = "";
  googleDocsPreviewUrl.value = "";
});

// 切换到编辑模式
const switchToEditMode = () => {
  editContent.value = textContent.value;
  isEditMode.value = true;
};

// 取消编辑
const cancelEdit = () => {
  isEditMode.value = false;
  editContent.value = "";

  // 如果取消编辑后，需要重新初始化预览
  nextTick(() => {
    initializePreview();
  });
};

// 保存编辑的内容
const saveContent = async () => {
  if (isSaving.value) return;

  // 检查内容大小限制 (10MB)
  const MAX_CONTENT_SIZE = 10 * 1024 * 1024;
  if (editContent.value.length > MAX_CONTENT_SIZE) {
    alert(`文件内容过大，超过最大限制(10MB)。请减少文件大小后重试。`);
    return;
  }

  isSaving.value = true;
  try {
    const apiFunction = props.isAdmin ? api.fs.updateAdminFile : api.fs.updateUserFile;
    const response = await apiFunction(props.file.path, editContent.value);

    if (response.success) {
      // 更新显示的内容
      textContent.value = editContent.value;
      // 切换回预览模式
      isEditMode.value = false;

      // 根据文件类型重新渲染预览
      nextTick(() => {
        initializePreview();
      });

      // 通知父组件内容已更新
      emit("updated", {
        content: editContent.value,
        contentType: response.data?.contentType,
        isNewFile: response.data?.isNewFile,
        path: props.file.path,
      });

      // 显示成功消息
      const actionText = response.data?.isNewFile ? "创建" : "更新";
      console.log(`文件${actionText}成功: ${props.file.path}`);
    } else {
      console.error("保存文件失败:", response);
      alert("保存文件失败: " + (response.message || "未知错误"));
    }
  } catch (error) {
    console.error("保存文件错误:", error);

    // 增强错误处理
    let errorMessage = "未知错误";
    if (error.response) {
      // 服务器返回了错误状态码
      const status = error.response.status;
      const responseData = error.response.data;

      if (status === 413 || responseData?.code === 413) {
        errorMessage = "文件内容过大，超过服务器限制";
      } else if (status === 403 || responseData?.code === 403) {
        errorMessage = "没有权限更新该文件";
      } else if (responseData?.message) {
        errorMessage = responseData.message;
      } else {
        errorMessage = `服务器错误 (${status})`;
      }
    } else if (error.request) {
      // 请求已发送但没有收到响应
      errorMessage = "服务器无响应，请检查网络连接";
    } else if (error.message) {
      // 请求设置时出现问题
      errorMessage = error.message;
    }

    alert("保存文件时发生错误: " + errorMessage);
  } finally {
    isSaving.value = false;
  }
};
</script>

<style scoped>
/* 代码高亮和Markdown预览样式 */
.preview-content pre {
  margin: 0;
  padding: 1rem;
  border-radius: 0.5rem;
  overflow: auto;
}

.preview-content code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.875rem;
  line-height: 1.5;
}

/* 全屏模式样式 */
:deep(:fullscreen) {
  background-color: white;
  padding: 0;
  overflow: auto;
}

:deep(.dark :fullscreen) {
  background-color: #1f2937;
}

:deep(:fullscreen iframe) {
  height: calc(100vh - 45px);
  width: 100%;
  border: none;
}

/* 确保全屏模式下的控制栏固定在顶部 */
:deep(:fullscreen .sticky) {
  position: sticky;
  top: 0;
  z-index: 20;
  width: 100%;
}

/* 全屏按钮悬停效果增强 */
button:hover svg {
  transform: scale(1.05);
  transition: transform 0.2s ease;
}

/* Markdown预览样式 */
.markdown-preview {
  line-height: 1.6;
}

/* Vditor相关样式 */
:deep(.vditor-reset) {
  font-size: 1rem;
  line-height: 1.7;
  padding: 0.5rem;
  transition: all 0.3s ease;
  color: v-bind('props.darkMode ? "#d4d4d4" : "#374151"');
  background-color: transparent !important;
}

/* 确保暗色模式下的特定样式 */
:deep(.vditor-reset--dark) {
  color: #d4d4d4 !important;
  background-color: transparent !important;
}

/* 确保亮色模式下的特定样式 */
:deep(.vditor-reset--light) {
  color: #374151 !important;
  background-color: transparent !important;
}

/* 标题样式 */
:deep(.vditor-reset h1, .vditor-reset h2) {
  border-bottom: 1px solid v-bind('props.darkMode ? "#30363d" : "#e5e7eb"');
  padding-bottom: 0.3em;
  margin-top: 1.8em;
  margin-bottom: 1em;
}

:deep(.vditor-reset h1) {
  font-size: 2em;
}

:deep(.vditor-reset h2) {
  font-size: 1.6em;
}

:deep(.vditor-reset h3) {
  font-size: 1.4em;
  margin-top: 1.5em;
  margin-bottom: 0.75em;
}

/* 段落样式 */
:deep(.vditor-reset p) {
  margin-top: 0.75em;
  margin-bottom: 0.75em;
}

/* 行内代码样式 */
:deep(.vditor-reset code:not(.hljs)) {
  background-color: v-bind('props.darkMode ? "#252526" : "#f3f4f6"');
  color: v-bind('props.darkMode ? "#ce9178" : "#ef4444"');
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

/* 引用块样式 */
:deep(.vditor-reset blockquote) {
  border-left: 4px solid v-bind('props.darkMode ? "#4b5563" : "#e5e7eb"');
  padding: 0.5em 1em;
  margin-left: 0;
  margin-right: 0;
  margin-top: 1em;
  margin-bottom: 1em;
  color: v-bind('props.darkMode ? "#9ca3af" : "#6b7280"');
  background-color: v-bind('props.darkMode ? "#1a1a1a" : "#f9fafb"');
  border-radius: 0.25rem;
}

/* 链接样式 */
:deep(.vditor-reset a) {
  color: v-bind('props.darkMode ? "#3b82f6" : "#2563eb"');
  text-decoration: none;
}

:deep(.vditor-reset a:hover) {
  text-decoration: underline;
}

/* 表格样式 */
:deep(.vditor-reset table) {
  border-collapse: collapse;
  margin: 1.25em 0;
  width: 100%;
}

:deep(.vditor-reset table th, .vditor-reset table td) {
  border: 1px solid v-bind('props.darkMode ? "#30363d" : "#e5e7eb"');
  padding: 0.6em 1em;
}

:deep(.vditor-reset table th) {
  background-color: v-bind('props.darkMode ? "#252526" : "#f3f4f6"');
  font-weight: 600;
  color: v-bind('props.darkMode ? "#e2e8f0" : "#374151"');
}

:deep(.vditor-reset table td) {
  background-color: v-bind('props.darkMode ? "#1e1e1e" : "#ffffff"');
}

:deep(.vditor-reset table tr:nth-child(even) td) {
  background-color: v-bind('props.darkMode ? "#252526" : "#f9fafb"');
}

/* 列表样式 */
:deep(.vditor-reset ul, .vditor-reset ol) {
  padding-left: 2em;
  margin: 1em 0;
}

/* 图片样式 */
:deep(.vditor-reset img) {
  max-width: 100%;
  margin: 1.25em 0;
  border-radius: 0.25rem;
}

/* 针对暗色模式的自定义样式 */
:deep(.hljs) {
  background: transparent !important;
}

/* 代码块在暗色模式下的样式 */
:deep(.vditor-reset--dark pre) {
  background-color: #1e1e1e !important;
  border: 1px solid #333 !important;
}

:deep(.vditor-reset--dark code.hljs) {
  background-color: #1e1e1e !important;
  color: #d4d4d4 !important;
}

/* 代码高亮在暗色模式下可见 */
:deep(.vditor-reset--dark .hljs-comment) {
  color: #6a9955 !important;
}
:deep(.vditor-reset--dark .hljs-keyword) {
  color: #569cd6 !important;
}
:deep(.vditor-reset--dark .hljs-attribute) {
  color: #9cdcfe !important;
}
:deep(.vditor-reset--dark .hljs-literal) {
  color: #569cd6 !important;
}
:deep(.vditor-reset--dark .hljs-symbol) {
  color: #b5cea8 !important;
}
:deep(.vditor-reset--dark .hljs-name) {
  color: #569cd6 !important;
}
:deep(.vditor-reset--dark .hljs-tag) {
  color: #569cd6 !important;
}
:deep(.vditor-reset--dark .hljs-string) {
  color: #ce9178 !important;
}
:deep(.vditor-reset--dark .hljs-number) {
  color: #b5cea8 !important;
}
:deep(.vditor-reset--dark .hljs-title) {
  color: #dcdcaa !important;
}
:deep(.vditor-reset--dark .hljs-built_in) {
  color: #4ec9b0 !important;
}
:deep(.vditor-reset--dark .hljs-class) {
  color: #4ec9b0 !important;
}
:deep(.vditor-reset--dark .hljs-variable) {
  color: #9cdcfe !important;
}
:deep(.vditor-reset--dark .hljs-params) {
  color: #9cdcfe !important;
}
:deep(.vditor-reset--dark .hljs-meta) {
  color: #db8942 !important;
}

/* 代码块在亮色模式下的样式 */
:deep(.vditor-reset--light pre) {
  background-color: #f6f8fa !important;
  border: 1px solid #e5e7eb !important;
}

:deep(.vditor-reset--light code.hljs) {
  background-color: #f6f8fa !important;
  color: #24292e !important;
}

/* 响应式调整 */
@media (max-width: 640px) {
  :deep(.vditor-reset) {
    font-size: 15px;
    padding: 0.25rem;
  }
}

/* 全局确保代码高亮在暗色模式下可见  */
:deep(.hljs-comment) {
  color: #6a9955 !important;
}
:deep(.hljs-keyword) {
  color: #569cd6 !important;
}
:deep(.hljs-attribute) {
  color: #9cdcfe !important;
}
:deep(.hljs-literal) {
  color: #569cd6 !important;
}
:deep(.hljs-symbol) {
  color: #b5cea8 !important;
}
:deep(.hljs-name) {
  color: #569cd6 !important;
}
:deep(.hljs-tag) {
  color: #569cd6 !important;
}
:deep(.hljs-string) {
  color: #ce9178 !important;
}
:deep(.hljs-number) {
  color: #b5cea8 !important;
}
:deep(.hljs-title) {
  color: #dcdcaa !important;
}
:deep(.hljs-built_in) {
  color: #4ec9b0 !important;
}
:deep(.hljs-class) {
  color: #4ec9b0 !important;
}
:deep(.hljs-variable) {
  color: #9cdcfe !important;
}
:deep(.hljs-params) {
  color: #9cdcfe !important;
}
:deep(.hljs-meta) {
  color: #db8942 !important;
}
</style>
