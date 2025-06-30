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
            <span>{{ t("mount.filePreview.downloadFile") }}</span>
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
            <span>{{ isGeneratingPreview ? t("mount.filePreview.generating") : t("mount.filePreview.directPreview") }}</span>
          </button>
        </div>
      </div>

      <!-- 文件信息 -->
      <div class="file-info grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-3 rounded-lg bg-opacity-50" :class="darkMode ? 'bg-gray-700/50' : 'bg-gray-100'">
        <div class="file-info-item flex items-center">
          <span class="font-medium mr-2" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">{{ t("mount.filePreview.fileSize") }}</span>
          <span :class="darkMode ? 'text-gray-400' : 'text-gray-600'">{{ formatFileSize(file.size) }}</span>
        </div>
        <div class="file-info-item flex items-center">
          <span class="font-medium mr-2" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">{{ t("mount.filePreview.modifiedTime") }}</span>
          <span :class="darkMode ? 'text-gray-400' : 'text-gray-600'">{{ formatDate(file.modified) }}</span>
        </div>
        <div class="file-info-item flex items-center">
          <span class="font-medium mr-2" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">{{ t("mount.filePreview.fileType") }}</span>
          <span :class="darkMode ? 'text-gray-400' : 'text-gray-600'">{{ file.contentType || t("mount.filePreview.unknown") }}</span>
        </div>
      </div>

      <!-- 模式切换下拉框 -->
      <div v-if="isText || isCode || isMarkdown || isHtml" class="mode-selector mb-4 p-3 rounded-lg" :class="darkMode ? 'bg-gray-700/50' : 'bg-gray-100/50'">
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
                  {{ isEditMode ? t("mount.filePreview.editMode") : t("mount.filePreview.previewMode") }}
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
                    {{ t("mount.filePreview.previewMode") }}
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
                    {{ t("mount.filePreview.editMode") }}
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
              <span>{{ isSaving ? t("mount.filePreview.saving") : t("mount.filePreview.save") }}</span>
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
              <span>{{ t("mount.filePreview.cancel") }}</span>
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
              class="max-w-full max-h-[600px] object-contain"
              @load="handleContentLoaded"
              @error="handleContentError"
          />
          <div v-else class="loading-indicator text-center py-8">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto" :class="darkMode ? 'border-primary-500' : 'border-primary-600'"></div>
          </div>
        </div>

        <!-- 视频预览 -->
        <div v-else-if="isVideo">
          <VideoPreview
              :file="file"
              :video-url="authenticatedPreviewUrl"
              :dark-mode="darkMode"
              :is-admin="isAdmin"
              :current-path="getCurrentDirectoryPath()"
              :directory-items="directoryItems"
              @loaded="handleContentLoaded"
          />
        </div>

        <!-- 音频预览 -->
        <div v-else-if="isAudio">
          <AudioPreview
              :file="file"
              :audio-url="authenticatedPreviewUrl"
              :dark-mode="darkMode"
              :is-admin="isAdmin"
              :current-path="getCurrentDirectoryPath()"
              :directory-items="directoryItems"
              @play="handleAudioPlay"
              @pause="handleAudioPause"
              @error="handleAudioError"
              @loaded="handleContentLoaded"
          />
        </div>

        <!-- PDF预览 -->
        <div v-else-if="isPdf" class="pdf-preview h-[600px]">
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
        <div v-else-if="isOffice" ref="officePreviewRef" class="office-preview h-[900px] w-full">
          <!-- Office预览头部控制栏 -->
          <div class="sticky top-0 z-20 flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ isWordDoc ? t("mount.filePreview.wordPreview") : isExcel ? t("mount.filePreview.excelPreview") : t("mount.filePreview.powerpointPreview") }}
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
                <span>{{ isOfficeFullscreen ? t("mount.filePreview.exitFullscreen") : t("mount.filePreview.fullscreen") }}</span>
              </button>
              <button
                  @click="toggleOfficePreviewService"
                  class="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-700 text-blue-700 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-600 transition-colors"
              >
                {{ useGoogleDocsPreview ? t("mount.filePreview.useMicrosoftPreview") : t("mount.filePreview.useGooglePreview") }}
              </button>
            </div>
          </div>

          <!-- 加载状态 -->
          <div v-if="officePreviewLoading" class="flex flex-col items-center justify-center h-full">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 mb-4" :class="darkMode ? 'border-primary-500' : 'border-primary-600'"></div>
            <p class="text-sm" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">{{ t("mount.filePreview.loadingPreview") }}</p>
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
              {{ t("mount.filePreview.retry") }}
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
        <div v-else-if="isMarkdown" class="markdown-preview" :class="isEditMode ? 'p-0' : 'p-4 overflow-auto max-h-[600px]'">
          <div v-if="isEditMode" class="editor-container h-[600px] border" :class="darkMode ? 'border-gray-700' : 'border-gray-300'">
            <textarea
                v-model="editContent"
                class="w-full h-full p-4 font-mono text-sm focus:outline-none resize-none overflow-auto"
                :class="darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800'"
                spellcheck="false"
            ></textarea>
          </div>
          <div v-else>
            <div ref="previewContainer" class="vditor-preview"></div>
          </div>
        </div>

        <!-- HTML预览 -->
        <div v-else-if="isHtml" ref="htmlPreviewRef" class="html-preview" :class="isEditMode ? '' : 'overflow-auto max-h-[600px]'">
          <div v-if="isEditMode" class="editor-container h-[600px] border" :class="darkMode ? 'border-gray-700' : 'border-gray-300'">
            <textarea
                v-model="editContent"
                class="w-full h-full p-4 font-mono text-sm focus:outline-none resize-none overflow-auto"
                :class="darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800'"
                spellcheck="false"
            ></textarea>
          </div>
          <div v-else>
            <!-- 添加HTML预览的控制栏 -->
            <div class="sticky top-0 z-20 flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t("mount.filePreview.htmlPreview") }}</span>
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
                  <span>{{ isHtmlFullscreen ? t("mount.filePreview.exitFullscreen") : t("mount.filePreview.fullscreen") }}</span>
                </button>
              </div>
            </div>
            <div class="p-4">
              <!-- 安全HTML预览使用沙盒iframe -->
              <iframe
                  ref="htmlIframe"
                  sandbox="allow-same-origin allow-scripts"
                  class="w-full min-h-[600px] border"
                  :class="darkMode ? 'border-gray-700' : 'border-gray-300'"
              ></iframe>
            </div>
          </div>
        </div>

        <!-- 代码预览（包括配置文件如 JSON、YAML 等） -->
        <div v-else-if="isCode" class="code-preview" :class="isEditMode ? 'p-0' : 'p-4 overflow-auto max-h-[600px]'">
          <div v-if="isEditMode" class="editor-container h-[600px] border" :class="darkMode ? 'border-gray-700' : 'border-gray-300'">
            <textarea
                v-model="editContent"
                class="w-full h-full p-4 font-mono text-sm focus:outline-none resize-none overflow-auto"
                :class="darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800'"
                spellcheck="false"
            ></textarea>
          </div>
          <div v-else>
            <div class="flex justify-between items-center mb-2">
              <span class="text-sm font-medium" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">
                {{ t("mount.filePreview.language") }} {{ codeLanguage || t("mount.filePreview.autoDetect") }}
                <span
                    v-if="fileTypeInfo && fileTypeInfo.category === 'config'"
                    class="ml-2 px-2 py-0.5 text-xs rounded-full"
                    :class="darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'"
                >
                  {{ t("mount.filePreview.configFile") }}
                </span>
              </span>
            </div>
            <pre class="rounded overflow-auto"><code v-html="highlightedContent"></code></pre>
          </div>
        </div>

        <!-- 普通文本预览 -->
        <div v-else-if="isText" class="text-preview" :class="isEditMode ? 'p-0' : 'p-4 overflow-auto max-h-[600px]'">
          <div v-if="isTextLoading || (!textContent && !loadError)" class="loading-indicator text-center py-8">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto" :class="darkMode ? 'border-primary-500' : 'border-primary-600'"></div>
          </div>
          <div v-else-if="isEditMode" class="editor-container h-[600px] border" :class="darkMode ? 'border-gray-700' : 'border-gray-300'">
            <textarea
                v-model="editContent"
                class="w-full h-full p-4 font-mono text-sm focus:outline-none resize-none overflow-auto"
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
          <p class="text-lg font-medium mb-2" :class="darkMode ? 'text-red-300' : 'text-red-700'">{{ t("mount.filePreview.previewError") }}</p>
          <p class="text-sm" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ t("mount.filePreview.retryLoad") }}</p>
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
          <p class="text-lg font-medium mb-2" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">{{ t("mount.filePreview.cannotPreview") }}</p>
          <p class="text-sm" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ t("mount.filePreview.downloadToView") }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { usePreviewRenderers, useFilePreviewExtensions } from "../../../composables/index.js";
import { useAuthStore } from "../../../stores/authStore.js";
import AudioPreview from "./AudioPreview.vue";
import VideoPreview from "./VideoPreview.vue";

const { t } = useI18n();

// Props 定义
const props = defineProps({
  file: {
    type: Object,
    required: true,
  },
  darkMode: {
    type: Boolean,
    default: false,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  // 认证相关props
  isAdmin: {
    type: Boolean,
    default: false,
  },
  apiKeyInfo: {
    type: Object,
    default: null,
  },
  hasFilePermission: {
    type: Boolean,
    default: false,
  },
  // 目录项目列表（用于音频播放列表等功能）
  directoryItems: {
    type: Array,
    default: () => [],
  },
});

// Emit 事件定义
const emit = defineEmits(["download", "loaded", "error", "updated", "switch-audio"]);

// 使用认证Store
const authStore = useAuthStore();

// 创建认证信息对象
const authInfo = computed(() => ({
  isAdmin: props.isAdmin ?? authStore.isAdmin,
  apiKeyInfo: props.apiKeyInfo ?? authStore.apiKeyInfo,
  hasFilePermission: props.hasFilePermission ?? authStore.hasPathPermission(props.file?.path || ""),
  get isAuthenticated() {
    return this.isAdmin || !!this.apiKeyInfo;
  },
  get authType() {
    return this.isAdmin ? "admin" : this.apiKeyInfo ? "apikey" : "none";
  },
}));

// 使用文件预览渲染器
const renderers = usePreviewRenderers(
    computed(() => props.file),
    authInfo,
    emit,
    computed(() => props.darkMode)
);

// 使用文件预览扩展功能
const extensions = useFilePreviewExtensions(
    computed(() => props.file),
    authInfo,
    renderers.textContent,
    renderers.editContent,
    renderers.isEditMode,
    renderers.isSaving,
    renderers.showModeDropdown,
    renderers.isGeneratingPreview,
    renderers.officePreviewLoading,
    renderers.officePreviewError,
    renderers.officePreviewTimedOut,
    renderers.previewUrl,
    renderers.handleFullscreenChange,
    renderers.handleKeyDown,
    emit,
    renderers.authenticatedPreviewUrl,
    renderers.previewTimeoutId,
    renderers.microsoftOfficePreviewUrl,
    renderers.googleDocsPreviewUrl,
    renderers.initializePreview
);

// 解构所有需要的功能
const {
  // 模板中使用的状态
  textContent,
  isTextLoading,
  loadError,
  authenticatedPreviewUrl,
  isGeneratingPreview,
  isEditMode,
  editContent,
  isSaving,
  showModeDropdown,
  highlightedContent,
  codeLanguage,
  officePreviewLoading,
  officePreviewError,
  useGoogleDocsPreview,
  isOfficeFullscreen,
  isHtmlFullscreen,

  // 模板中使用的计算属性
  fileTypeInfo,
  isImage,
  isVideo,
  isAudio,
  isPdf,
  isMarkdown,
  isHtml,
  isCode,
  isOffice,
  isWordDoc,
  isExcel,
  isPowerPoint,
  isText,
  currentOfficePreviewUrl,

  // 模板中使用的DOM引用
  previewContainer,
  htmlIframe,
  officePreviewRef,
  htmlPreviewRef,

  // 模板中使用的方法
  formatFileSize,
  formatDate,
  toggleOfficePreviewService,
  toggleOfficeFullscreen,
  toggleHtmlFullscreen,
  updateOfficePreviewUrls,
  handleContentLoaded,
  handleContentError,

  // 渲染器中的方法
  handleOfficePreviewLoaded,
  handleOfficePreviewError,
  handleAudioPlay,
  handleAudioPause,
  handleAudioError,
} = renderers;

// 从扩展功能中解构编辑模式和其他交互功能
const { toggleModeDropdown, selectMode, switchToEditMode, cancelEdit, saveContent, handleDownload, handleS3DirectPreview, getCurrentDirectoryPath } = extensions;
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

/* 移动端文件预览容器优化 */
@media (max-width: 768px) {
  .file-preview-container {
    margin: 0 -1rem;
    padding: 0 0.5rem;
  }

  .file-preview {
    margin-bottom: 1rem !important;
    padding: 0.75rem !important;
    border-radius: 0.5rem !important;
  }

  /* 文件信息网格在移动端单列显示 */
  .file-info {
    grid-template-columns: 1fr !important;
    gap: 0.5rem !important;
    padding: 0.75rem !important;
  }

  /* 按钮组在移动端更紧凑 */
  .file-preview .flex.flex-wrap {
    gap: 0.5rem !important;
  }

  /* 预览内容区域优化 */
  .preview-content {
    border-radius: 0.5rem !important;
  }

  /* 图片预览在移动端更充分利用空间 */
  .image-preview {
    padding: 0.5rem !important;
  }

  .image-preview img {
    max-height: 60vh !important;
  }

  /* 视频预览优化 */
  .video-preview {
    padding: 0.5rem !important;
  }

  .video-preview video {
    max-height: 50vh !important;
  }

  /* 音频预览优化 */
  .audio-preview {
    padding: 0.75rem !important;
  }

  /* PDF预览高度调整 */
  .pdf-preview {
    height: 60vh !important;
  }

  /* Office预览高度调整 */
  .office-preview {
    height: 65vh !important;
  }

  /* HTML预览优化 */
  .html-preview iframe {
    min-height: 50vh !important;
  }

  /* 代码预览和文本预览高度调整 */
  .code-preview,
  .text-preview,
  .markdown-preview {
    max-height: 60vh !important;
    padding: 0.75rem !important;
  }

  /* 编辑器容器高度调整 */
  .editor-container {
    height: 50vh !important;
  }

  /* 模式选择器优化 */
  .mode-selector {
    padding: 0.75rem !important;
    margin-bottom: 0.75rem !important;
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
