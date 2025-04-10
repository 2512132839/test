<template>
  <div class="w-full overflow-x-auto">
    <!-- 桌面表格视图 -->
    <table class="min-w-full divide-y hidden sm:table" :class="darkMode ? 'divide-gray-700' : 'divide-gray-200'">
      <thead :class="darkMode ? 'bg-gray-800' : 'bg-gray-50'">
        <tr>
          <th scope="col" class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider w-10" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
            <div class="flex items-center">
              <input
                type="checkbox"
                :checked="files.length > 0 && selectedFiles.length === files.length"
                @change="$emit('toggle-select-all')"
                class="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                :class="darkMode ? 'bg-gray-700 border-gray-600' : ''"
              />
            </div>
          </th>
          <th scope="col" class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">文件名</th>
          <th scope="col" class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider hidden md:table-cell" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
            MIME类型
          </th>
          <th scope="col" class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider hidden sm:table-cell" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
            大小
          </th>
          <th scope="col" class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider hidden xl:table-cell" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
            剩余次数
          </th>
          <th scope="col" class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider hidden lg:table-cell" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
            存储配置
          </th>
          <th scope="col" class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider hidden lg:table-cell" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
            创建者
          </th>
          <th scope="col" class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider hidden sm:table-cell" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
            创建时间
          </th>
          <th scope="col" class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">操作</th>
        </tr>
      </thead>
      <tbody :class="darkMode ? 'bg-gray-900 divide-y divide-gray-700' : 'bg-white divide-y divide-gray-200'">
        <tr v-if="files.length === 0">
          <td :class="darkMode ? 'text-gray-400' : 'text-gray-500'" class="px-3 py-4 text-sm" colspan="8">暂无文件数据</td>
        </tr>
        <tr v-for="file in files" :key="file.id" :class="darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'">
          <td class="px-3 py-4 whitespace-nowrap">
            <div class="flex items-center">
              <input
                type="checkbox"
                :checked="selectedFiles.includes(file.id)"
                @change="$emit('toggle-select', file.id)"
                class="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                :class="darkMode ? 'bg-gray-700 border-gray-600' : ''"
              />
            </div>
          </td>
          <td :class="darkMode ? 'text-gray-300' : 'text-gray-900'" class="px-3 py-4">
            <div class="flex flex-col">
              <div class="flex items-center">
                <span class="font-medium truncate max-w-xs" :title="file.filename">{{ truncateFilename(file.filename) }}</span>
                <span v-if="file.has_password" class="ml-2" :title="'密码保护'">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    :class="darkMode ? 'text-yellow-400' : 'text-yellow-600'"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </span>
              </div>
              <span class="text-xs mt-1 truncate max-w-xs" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
                {{ file.slug ? `/${file.slug}` : "无短链接" }}
              </span>
              <span v-if="file.remark" class="text-xs mt-1 italic truncate max-w-xs" :class="darkMode ? 'text-blue-400' : 'text-blue-600'">
                {{ file.remark }}
              </span>
            </div>
          </td>
          <td :class="darkMode ? 'text-gray-300' : 'text-gray-900'" class="px-3 py-4 whitespace-nowrap text-sm hidden md:table-cell">
            <span class="px-2 py-1 text-xs rounded" :class="getMimeTypeClass(file.mimetype)">
              {{ getSimpleMimeType(file.mimetype) }}
            </span>
          </td>
          <td :class="darkMode ? 'text-gray-300' : 'text-gray-900'" class="px-3 py-4 whitespace-nowrap text-sm hidden sm:table-cell">
            {{ formatFileSize(file.size) }}
          </td>
          <td :class="darkMode ? 'text-gray-300' : 'text-gray-900'" class="px-3 py-4 whitespace-nowrap text-sm hidden xl:table-cell">
            <div class="flex flex-col">
              <span :class="getRemainingViewsClass(file)">{{
                getRemainingViews(file) === "无限制" ? "无限制" : getRemainingViews(file) === "已用完" ? "已用完" : `${getRemainingViews(file)} 次`
              }}</span>
              <span v-if="file.views && file.max_views" class="text-xs mt-1" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
                已用: {{ file.views || 0 }}/{{ file.max_views }}
              </span>
              <span v-if="file.expires_at" class="text-xs mt-1" :class="expiresClass(file.expires_at)">
                {{ formatExpiry(file.expires_at) }}
              </span>
            </div>
          </td>
          <td :class="darkMode ? 'text-gray-300' : 'text-gray-900'" class="px-3 py-4 whitespace-nowrap text-sm hidden lg:table-cell">
            <div class="flex flex-col">
              <span>{{ file.s3_config_name || "默认存储" }}</span>
              <span class="text-xs mt-1" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
                {{ file.s3_provider_type || "未知" }}
              </span>
            </div>
          </td>
          <td :class="darkMode ? 'text-gray-300' : 'text-gray-900'" class="px-3 py-4 whitespace-nowrap text-sm hidden lg:table-cell">
            <div class="flex flex-col items-center">
              <span
                v-if="file.created_by && file.created_by.startsWith('apikey:')"
                class="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 inline-block text-center w-fit"
              >
                {{ file.key_name ? `密钥：${file.key_name}` : `密钥：${file.created_by.substring(7, 12)}...` }}
              </span>
              <span v-else-if="file.created_by" class="px-2 py-1 text-xs rounded bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 inline-block text-center w-fit">
                管理员
              </span>
              <span v-else class="px-2 py-1 text-xs rounded bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 inline-block text-center w-fit"> 未知来源 </span>
            </div>
          </td>
          <td :class="darkMode ? 'text-gray-300' : 'text-gray-900'" class="px-3 py-4 whitespace-nowrap text-sm hidden sm:table-cell">
            {{ formatDate(file.created_at) }}
          </td>
          <td class="px-3 py-4 whitespace-nowrap text-right text-sm font-medium">
            <div class="flex space-x-2">
              <button @click="$emit('preview', file)" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                <span class="sr-only">预览</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </button>
              <button @click="$emit('edit', file)" class="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300">
                <span class="sr-only">编辑</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
              <button @click="$emit('generate-qr', file)" class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">
                <span class="sr-only">二维码</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                  />
                </svg>
              </button>
              <button @click="openFileLink(file)" class="text-amber-600 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300">
                <span class="sr-only">跳转</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
              <button @click="copyFileLink(file)" class="text-cyan-600 hover:text-cyan-900 dark:text-cyan-400 dark:hover:text-cyan-300 relative">
                <span class="sr-only">复制链接</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <!-- 文件复制成功提示 -->
                <span v-if="copiedFiles[file.id]" class="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 text-xs text-white bg-green-500 rounded whitespace-nowrap">
                  已复制
                </span>
              </button>
              <!-- 复制永久直链按钮 -->
              <button @click="copyPermanentLink(file)" class="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 relative">
                <span class="sr-only">复制直链</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.172 13.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102-1.101" />
                </svg>
                <!-- 永久链接复制成功提示 -->
                <span
                  v-if="copiedPermanentFiles[file.id]"
                  class="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 text-xs text-white bg-green-500 rounded whitespace-nowrap"
                >
                  已复制直链
                </span>
              </button>
              <button @click="$emit('delete', file.id)" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                <span class="sr-only">删除</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- 移动端卡片视图 -->
    <div class="sm:hidden space-y-4">
      <div v-if="files.length === 0" class="text-center py-4" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">暂无文件数据</div>
      <div
        v-for="file in files"
        :key="file.id"
        class="border rounded-lg overflow-hidden transition-colors"
        :class="darkMode ? 'border-gray-700 bg-gray-800/30 hover:border-gray-600' : 'border-gray-200 bg-white hover:border-gray-300'"
      >
        <!-- 文件基本信息 -->
        <div class="p-3 border-b" :class="darkMode ? 'border-gray-700' : 'border-gray-200'">
          <div class="flex items-start">
            <div class="flex-shrink-0 mr-2 mt-1">
              <input
                type="checkbox"
                :checked="selectedFiles.includes(file.id)"
                @change="$emit('toggle-select', file.id)"
                class="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                :class="darkMode ? 'bg-gray-700 border-gray-600' : ''"
              />
            </div>
            <div class="flex-1">
              <div class="flex items-center">
                <div class="font-medium" :class="darkMode ? 'text-white' : 'text-gray-900'" :title="file.filename">{{ truncateFilename(file.filename) }}</div>
                <span v-if="file.has_password" class="ml-2" :title="'密码保护'">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    :class="darkMode ? 'text-yellow-400' : 'text-yellow-600'"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </span>
              </div>
              <div class="text-xs mt-1" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
                {{ file.slug ? `/${file.slug}` : "无短链接" }}
              </div>
              <div v-if="file.remark" class="text-xs mt-1 italic" :class="darkMode ? 'text-blue-400' : 'text-blue-600'">
                {{ file.remark }}
              </div>
            </div>
          </div>
        </div>

        <!-- 文件详细信息 -->
        <div class="p-3 grid grid-cols-2 gap-3 text-sm">
          <!-- 文件大小 -->
          <div>
            <div class="text-xs font-medium uppercase" :class="darkMode ? 'text-gray-500' : 'text-gray-500'">大小</div>
            <div :class="darkMode ? 'text-gray-300' : 'text-gray-700'">{{ formatFileSize(file.size) }}</div>
          </div>

          <!-- MIME类型 -->
          <div>
            <div class="text-xs font-medium uppercase" :class="darkMode ? 'text-gray-500' : 'text-gray-500'">类型</div>
            <div>
              <span class="px-2 py-0.5 text-xs rounded" :class="getMimeTypeClass(file.mimetype)">
                {{ getSimpleMimeType(file.mimetype) }}
              </span>
            </div>
          </div>

          <!-- 剩余次数 -->
          <div>
            <div class="text-xs font-medium uppercase" :class="darkMode ? 'text-gray-500' : 'text-gray-500'">剩余次数</div>
            <div :class="getRemainingViewsClass(file)">
              {{ getRemainingViews(file) === "无限制" ? "无限制" : getRemainingViews(file) === "已用完" ? "已用完" : `${getRemainingViews(file)} 次` }}
            </div>
            <div v-if="file.views && file.max_views" class="text-xs" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">已用: {{ file.views || 0 }}/{{ file.max_views }}</div>
            <div v-if="file.expires_at" class="text-xs" :class="expiresClass(file.expires_at)">
              {{ formatExpiry(file.expires_at) }}
            </div>
          </div>

          <!-- 存储配置 -->
          <div>
            <div class="text-xs font-medium uppercase" :class="darkMode ? 'text-gray-500' : 'text-gray-500'">存储配置</div>
            <div :class="darkMode ? 'text-gray-300' : 'text-gray-700'">{{ file.s3_config_name || "默认存储" }}</div>
            <div class="text-xs" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
              {{ file.s3_provider_type || "未知" }}
            </div>
          </div>

          <!-- 创建者 -->
          <div>
            <div class="text-xs font-medium uppercase" :class="darkMode ? 'text-gray-500' : 'text-gray-500'">创建者</div>
            <div :class="darkMode ? 'text-gray-300' : 'text-gray-700'" class="flex flex-col">
              <span
                v-if="file.created_by && file.created_by.startsWith('apikey:')"
                class="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 inline-block mt-1 w-fit"
              >
                {{ file.key_name ? `密钥：${file.key_name}` : `密钥：${file.created_by.substring(7, 12)}...` }}
              </span>
              <span v-else-if="file.created_by" class="px-2 py-1 text-xs rounded bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 inline-block mt-1 w-fit">
                管理员
              </span>
              <span v-else class="px-2 py-1 text-xs rounded bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 inline-block mt-1 w-fit"> 未知来源 </span>
            </div>
          </div>

          <!-- 创建时间 -->
          <div class="col-span-2">
            <div class="text-xs font-medium uppercase" :class="darkMode ? 'text-gray-500' : 'text-gray-500'">创建时间</div>
            <div :class="darkMode ? 'text-gray-300' : 'text-gray-700'">{{ formatDate(file.created_at) }}</div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="p-3 border-t flex justify-end space-x-2" :class="darkMode ? 'border-gray-700' : 'border-gray-200'">
          <button @click="$emit('preview', file)" class="p-2 rounded-md" :class="darkMode ? 'bg-gray-700 text-blue-400' : 'bg-gray-100 text-blue-600'">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          </button>
          <button @click="$emit('edit', file)" class="p-2 rounded-md" :class="darkMode ? 'bg-gray-700 text-green-400' : 'bg-gray-100 text-green-600'">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
          <button @click="$emit('generate-qr', file)" class="p-2 rounded-md" :class="darkMode ? 'bg-gray-700 text-indigo-400' : 'bg-gray-100 text-indigo-600'">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
              />
            </svg>
          </button>
          <button @click="openFileLink(file)" class="p-2 rounded-md" :class="darkMode ? 'bg-gray-700 text-amber-400' : 'bg-gray-100 text-amber-600'">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
          <button @click="copyFileLink(file)" class="p-2 rounded-md relative" :class="darkMode ? 'bg-gray-700 text-cyan-400' : 'bg-gray-100 text-cyan-600'">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <!-- 移动端复制成功提示 -->
            <span v-if="copiedFiles[file.id]" class="absolute -top-8 right-0 px-2 py-1 text-xs text-white bg-green-500 rounded whitespace-nowrap"> 已复制 </span>
          </button>
          <!-- 移动端复制永久直链按钮 -->
          <button @click="copyPermanentLink(file)" class="p-2 rounded-md relative" :class="darkMode ? 'bg-gray-700 text-purple-400' : 'bg-gray-100 text-purple-600'">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.172 13.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102-1.101" />
            </svg>
            <!-- 移动端永久链接复制成功提示 -->
            <span v-if="copiedPermanentFiles[file.id]" class="absolute -top-8 right-0 px-2 py-1 text-xs text-white bg-green-500 rounded whitespace-nowrap"> 已复制直链 </span>
          </button>
          <button @click="$emit('delete', file.id)" class="p-2 rounded-md" :class="darkMode ? 'bg-gray-700 text-red-400' : 'bg-gray-100 text-red-600'">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, ref, reactive, computed } from "vue";

const props = defineProps({
  files: {
    type: Array,
    required: true,
  },
  darkMode: {
    type: Boolean,
    default: false,
  },
  selectedFiles: {
    type: Array,
    default: () => [],
  },
  userType: {
    type: String,
    default: "admin", // 默认为管理员
  },
});

// 检查当前用户是否为管理员
const isAdmin = computed(() => props.userType === "admin");

defineEmits(["toggle-select", "toggle-select-all", "preview", "edit", "delete", "generate-qr"]);

// 使用reactive对象记录每个文件的复制状态
const copiedFiles = reactive({});
// 使用reactive对象记录每个文件的永久链接复制状态
const copiedPermanentFiles = reactive({});

/**
 * 计算剩余可访问次数
 * @param {Object} file - 文件对象
 * @returns {string|number} 剩余访问次数或状态描述
 */
const getRemainingViews = (file) => {
  if (!file.max_views || file.max_views === 0) return "无限制";
  const viewCount = file.views || 0;
  const remaining = file.max_views - viewCount;
  return remaining <= 0 ? "已用完" : remaining;
};

/**
 * 获取剩余次数显示的样式类
 * @param {Object} file - 文件对象
 * @returns {string} 样式类名
 */
const getRemainingViewsClass = (file) => {
  const remaining = getRemainingViews(file);
  if (remaining === "已用完") {
    return props.darkMode ? "text-red-400" : "text-red-600";
  } else if (remaining !== "无限制" && remaining < 3) {
    return props.darkMode ? "text-yellow-400" : "text-yellow-600";
  }
  return props.darkMode ? "text-gray-300" : "text-gray-700";
};

/**
 * 格式化文件大小
 * @param {number} bytes - 文件大小（字节）
 * @returns {string} 格式化后的文件大小
 */
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return "0 B";

  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + " " + sizes[i];
};

/**
 * 简化MIME类型显示
 * @param {string} mimeType - 完整MIME类型
 * @returns {string} 简化的MIME类型
 */
const getSimpleMimeType = (mimeType) => {
  if (!mimeType) return "未知";

  if (mimeType === "text/markdown") {
    return "Markdown";
  }
  if (mimeType.startsWith("image/")) {
    return "图像";
  } else if (mimeType.startsWith("video/")) {
    return "视频";
  } else if (mimeType.startsWith("audio/")) {
    return "音频";
  } else if (mimeType.startsWith("text/")) {
    return "文本";
  } else if (mimeType.includes("pdf")) {
    return "PDF";
  } else if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar") || mimeType.includes("gz") || mimeType.includes("7z")) {
    return "压缩";
  } else if (mimeType.includes("word") || mimeType.includes("document")) {
    return "文档";
  } else if (mimeType.includes("excel") || mimeType.includes("sheet")) {
    return "表格";
  } else if (mimeType.includes("powerpoint") || mimeType.includes("presentation")) {
    return "演示";
  }

  return mimeType.split("/")[1] || mimeType;
};

/**
 * 根据MIME类型获取样式类
 * @param {string} mimeType - 完整MIME类型
 * @returns {string} 样式类名
 */
const getMimeTypeClass = (mimeType) => {
  if (!mimeType) return props.darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-700";

  // Markdown 文件 - 特别处理
  if (mimeType === "text/markdown") {
    return props.darkMode ? "bg-emerald-900 text-emerald-200" : "bg-emerald-100 text-emerald-800";
  }
  // 图片文件
  else if (mimeType.startsWith("image/")) {
    return props.darkMode ? "bg-blue-900 text-blue-200" : "bg-blue-100 text-blue-800";
  }
  // 视频文件
  else if (mimeType.startsWith("video/")) {
    return props.darkMode ? "bg-purple-900 text-purple-200" : "bg-purple-100 text-purple-800";
  }
  // 音频文件
  else if (mimeType.startsWith("audio/")) {
    return props.darkMode ? "bg-pink-900 text-pink-200" : "bg-pink-100 text-pink-800";
  }
  // 文本文件
  else if (mimeType.startsWith("text/")) {
    return props.darkMode ? "bg-green-900 text-green-200" : "bg-green-100 text-green-800";
  }
  // PDF文件
  else if (mimeType.includes("pdf")) {
    return props.darkMode ? "bg-red-900 text-red-200" : "bg-red-100 text-red-800";
  }
  // 压缩文件
  else if (
    mimeType.includes("zip") ||
    mimeType.includes("rar") ||
    mimeType.includes("tar") ||
    mimeType.includes("gz") ||
    mimeType.includes("7z") ||
    mimeType.includes("compress")
  ) {
    return props.darkMode ? "bg-yellow-900 text-yellow-200" : "bg-yellow-100 text-yellow-800";
  }
  // 文档文件
  else if (mimeType.includes("word") || mimeType.includes("document") || mimeType.includes("rtf")) {
    return props.darkMode ? "bg-indigo-900 text-indigo-200" : "bg-indigo-100 text-indigo-800";
  }
  // 表格文件
  else if (mimeType.includes("excel") || mimeType.includes("spreadsheet") || mimeType.includes("csv")) {
    return props.darkMode ? "bg-emerald-900 text-emerald-200" : "bg-emerald-100 text-emerald-800";
  }
  // 数据库文件
  else if (mimeType.includes("sqlite") || mimeType.includes("db")) {
    return props.darkMode ? "bg-cyan-900 text-cyan-200" : "bg-cyan-100 text-cyan-800";
  }
  // 可执行文件和应用
  else if (mimeType.includes("msdownload") || mimeType.includes("android") || mimeType.includes("executable")) {
    return props.darkMode ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-800";
  }
  // 字体文件
  else if (mimeType.includes("font") || mimeType.includes("woff") || mimeType.includes("ttf") || mimeType.includes("otf")) {
    return props.darkMode ? "bg-rose-900 text-rose-200" : "bg-rose-100 text-rose-800";
  }
  // 电子书
  else if (mimeType.includes("epub")) {
    return props.darkMode ? "bg-fuchsia-900 text-fuchsia-200" : "bg-fuchsia-100 text-fuchsia-800";
  }
  // 设计文件
  else if (mimeType.includes("photoshop") || mimeType.includes("postscript")) {
    return props.darkMode ? "bg-sky-900 text-sky-200" : "bg-sky-100 text-sky-800";
  }

  // 默认
  return props.darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-700";
};

/**
 * 格式化日期
 * @param {string} dateString - ISO格式的日期字符串
 * @returns {string} 格式化后的日期
 */
const formatDate = (dateString) => {
  if (!dateString) return "未知";

  const date = new Date(dateString);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * 根据过期状态返回相应的样式类
 * @param {string} expiresAt - 过期时间字符串
 * @returns {string} 样式类名
 */
const expiresClass = (expiresAt) => {
  if (!expiresAt) return props.darkMode ? "text-gray-400" : "text-gray-500";

  const expiryDate = new Date(expiresAt);
  const now = new Date();

  // 已过期
  if (expiryDate < now) {
    return props.darkMode ? "text-red-400" : "text-red-600";
  }

  // 即将过期（24小时内）
  const nearExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (expiryDate < nearExpiry) {
    return props.darkMode ? "text-yellow-400" : "text-yellow-600";
  }

  return props.darkMode ? "text-green-400" : "text-green-600";
};

/**
 * 格式化过期时间显示
 * @param {string} expiresAt - 过期时间字符串
 * @returns {string} 格式化后的过期提示
 */
const formatExpiry = (expiresAt) => {
  if (!expiresAt) return "";

  const expiryDate = new Date(expiresAt);
  const now = new Date();

  // 已过期
  if (expiryDate < now) {
    return "已过期";
  }

  // 计算剩余时间
  const diffTime = expiryDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 1) {
    // 剩余不到1天
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    if (diffHours <= 1) {
      // 剩余不到1小时
      const diffMinutes = Math.ceil(diffTime / (1000 * 60));
      return `${diffMinutes} 分钟后过期`;
    }
    return `${diffHours} 小时后过期`;
  }

  return `${diffDays} 天后过期`;
};

/**
 * 复制文件链接到剪贴板
 * @param {Object} file - 文件对象
 */
const copyFileLink = async (file) => {
  if (!file || !file.slug) {
    alert("该文件没有有效的分享链接");
    return;
  }

  try {
    const baseUrl = window.location.origin;
    const fileUrl = `${baseUrl}/file/${file.slug}`;

    await navigator.clipboard.writeText(fileUrl);

    // 为特定文件设置复制成功状态
    copiedFiles[file.id] = true;

    // 3秒后清除状态
    setTimeout(() => {
      copiedFiles[file.id] = false;
    }, 2000);
  } catch (err) {
    console.error("复制链接失败:", err);
    alert("复制链接失败，请手动复制");
  }
};

/**
 * 在新标签页中打开文件链接
 * @param {Object} file - 文件对象
 */
const openFileLink = (file) => {
  if (!file || !file.slug) {
    alert("该文件没有有效的分享链接");
    return;
  }

  const baseUrl = window.location.origin;
  const fileUrl = `${baseUrl}/file/${file.slug}`;

  // 在新标签页中打开链接
  window.open(fileUrl, "_blank");
};

/**
 * 截断文件名，只显示前20个字符
 * @param {string} filename - 完整文件名
 * @returns {string} 截断后的文件名
 */
const truncateFilename = (filename) => {
  if (!filename) return "";
  if (filename.length <= 20) return filename;
  return filename.substring(0, 20) + "...";
};

/**
 * 辅助函数：获取文件密码
 * 从多个可能的来源获取密码
 * @param {Object} file - 文件对象
 * @returns {string|null} 文件密码或null
 */
const getFilePassword = (file) => {
  // 优先使用文件信息中存储的明文密码
  if (file.plain_password) {
    return file.plain_password;
  }

  // 其次检查当前密码字段
  if (file.currentPassword) {
    return file.currentPassword;
  }

  // 尝试从URL获取密码参数
  const currentUrl = new URL(window.location.href);
  const passwordParam = currentUrl.searchParams.get("password");
  if (passwordParam) {
    return passwordParam;
  }

  // 最后尝试从会话存储中获取密码
  try {
    if (file.slug) {
      const sessionPassword = sessionStorage.getItem(`file_password_${file.slug}`);
      if (sessionPassword) {
        return sessionPassword;
      }
    }
  } catch (err) {
    console.error("从会话存储获取密码出错:", err);
  }

  return null;
};

/**
 * 复制文件的永久下载链接到剪贴板
 * @param {Object} file - 文件对象
 */
const copyPermanentLink = async (file) => {
  if (!file || !file.slug) {
    alert("该文件没有有效的永久链接");
    return;
  }

  try {
    let permanentDownloadUrl;
    let fileWithUrls = file;

    // 如果文件对象中没有urls属性或者proxyDownloadUrl，先获取完整的文件详情
    if (!file.urls || !file.urls.proxyDownloadUrl) {
      try {
        // 导入API函数
        const { getFile, getUserFile } = await import("../../../api/fileService");

        // 使用组件级别的isAdmin计算属性判断用户角色
        console.log(`当前用户类型: ${props.userType}, 是否管理员: ${isAdmin.value}`);

        // 调用相应的API
        const response = isAdmin.value ? await getFile(file.id) : await getUserFile(file.id);

        if (response.success && response.data) {
          fileWithUrls = response.data;
        } else {
          throw new Error(response.message || "获取文件详情失败");
        }
      } catch (error) {
        console.error("获取文件详情失败:", error);
        alert("无法获取文件直链，请确认您已登录并刷新页面后重试");
        return;
      }
    }

    // 使用后端返回的代理URL
    if (fileWithUrls.urls && fileWithUrls.urls.proxyDownloadUrl) {
      // 使用后端返回的完整代理URL
      permanentDownloadUrl = fileWithUrls.urls.proxyDownloadUrl;

      // 获取文件密码
      const filePassword = getFilePassword(fileWithUrls);

      // 如果文件有密码保护且URL中没有密码参数，添加密码参数
      if (fileWithUrls.has_password && filePassword && !permanentDownloadUrl.includes("password=")) {
        permanentDownloadUrl += permanentDownloadUrl.includes("?") ? `&password=${encodeURIComponent(filePassword)}` : `?password=${encodeURIComponent(filePassword)}`;
      }

      await navigator.clipboard.writeText(permanentDownloadUrl);

      // 为特定文件设置复制成功状态
      copiedPermanentFiles[file.id] = true;

      // 3秒后清除状态
      setTimeout(() => {
        copiedPermanentFiles[file.id] = false;
      }, 2000);
    } else {
      throw new Error("无法获取文件代理链接");
    }
  } catch (err) {
    console.error("复制永久下载链接失败:", err);
    alert(`复制永久下载链接失败: ${err.message || "未知错误"}`);
  }
};
</script>
