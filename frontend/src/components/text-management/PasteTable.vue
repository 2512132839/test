<script setup>
import { computed } from "vue";
// 桌面端的表格视图

/**
 * 组件接收的属性定义
 * darkMode: 主题模式
 * pastes: 要展示的文本分享列表
 * loading: 加载状态
 * selectedPastes: 已选中的文本分享ID列表
 * copiedTexts: 已复制的文本ID列表
 * copiedRawTexts: 已复制的原始文本直链ID列表
 */
const props = defineProps({
  darkMode: {
    type: Boolean,
    required: true,
  },
  pastes: {
    type: Array,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  selectedPastes: {
    type: Array,
    required: true,
  },
  copiedTexts: {
    type: Object,
    default: () => ({}),
  },
  copiedRawTexts: {
    type: Object,
    default: () => ({}),
  },
});

/**
 * 定义组件要触发的事件
 * toggle-select-all: 切换全选/取消全选
 * toggle-select-item: 切换单个项目的选择状态
 * view: 查看分享链接
 * copy-link: 复制分享链接
 * copy-raw-link: 复制原始文本直链
 * preview: 预览分享内容
 * edit: 编辑分享属性
 * delete: 删除分享
 * show-qrcode: 显示分享链接的二维码
 */
const emit = defineEmits(["toggle-select-all", "toggle-select-item", "view", "copy-link", "copy-raw-link", "preview", "edit", "delete", "show-qrcode"]);

/**
 * 计算属性：判断是否所有项目都被选中
 * 用于控制表头复选框的状态
 * @returns {boolean} 是否全选
 */
const isAllSelected = computed(() => {
  return props.pastes.length > 0 && props.selectedPastes.length === props.pastes.length;
});

/**
 * 截取文本并添加省略号
 * @param {string} text - 需要截取的文本
 * @param {number} length - 截取长度
 * @returns {string} 截取后的文本
 */
const truncateText = (text, length = 10) => {
  if (!text) return "无";
  return text.length <= length ? text : `${text.substring(0, length)}...`;
};

/**
 * 格式化日期为本地日期时间字符串
 * @param {string} dateString - ISO格式的日期字符串
 * @returns {string} 格式化后的日期字符串
 */
const formatDate = (dateString) => {
  if (!dateString) return "未知";

  try {
    const date = new Date(dateString);

    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      return "日期无效";
    }

    // 使用Intl.DateTimeFormat以确保时区正确
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false, // 使用24小时制
    }).format(date);
  } catch (e) {
    console.error("日期格式化错误:", e);
    return "日期格式错误";
  }
};

/**
 * 格式化相对时间（如：3天后过期）
 * @param {string} dateString - ISO格式的日期字符串
 * @returns {string} 相对时间描述
 */
const formatRelativeTime = (dateString) => {
  if (!dateString) return "";

  try {
    const targetDate = new Date(dateString);
    const now = new Date();

    // 检查日期是否有效
    if (isNaN(targetDate.getTime())) {
      return "";
    }

    // 计算时间差（毫秒）
    const diff = targetDate - now;

    // 转换为秒、分钟、小时、天
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    // 根据时间差返回不同的文本
    if (diff < 0) {
      return "已过期";
    } else if (days > 30) {
      return `${Math.floor(days / 30)}个月后过期`;
    } else if (days > 0) {
      return `${days}天后过期`;
    } else if (hours > 0) {
      return `${hours}小时后过期`;
    } else if (minutes > 0) {
      return `${minutes}分钟后过期`;
    } else {
      return "即将过期";
    }
  } catch (e) {
    console.error("相对时间格式化错误:", e);
    return "";
  }
};

/**
 * 格式化过期日期，同时显示具体日期和相对时间
 * @param {string} expiryDate - ISO格式的过期日期
 * @returns {string} 格式化后的过期信息
 */
const formatExpiry = (expiryDate) => {
  if (!expiryDate) return "永不过期";

  try {
    const expiry = new Date(expiryDate);
    const now = new Date();

    // 检查日期是否有效
    if (isNaN(expiry.getTime())) {
      return "日期无效";
    }

    if (expiry < now) {
      return "已过期";
    }

    // 显示具体日期和相对时间
    const formattedDate = formatDate(expiryDate);
    const relativeTime = formatRelativeTime(expiryDate);

    return `${formattedDate} (${relativeTime})`;
  } catch (e) {
    console.error("过期时间格式化错误:", e);
    return "日期格式错误";
  }
};

/**
 * 检查文本分享是否设置了密码
 * @param {Object} paste - 文本分享对象
 * @returns {boolean} 是否有密码
 */
const hasPassword = (paste) => {
  return paste.has_password;
};

/**
 * 计算剩余可访问次数
 * @param {Object} paste - 文本分享对象
 * @returns {string|number} 剩余访问次数或状态描述
 */
const getRemainingViews = (paste) => {
  if (!paste.max_views) return "无限制";
  // 使用view_count字段（后端返回的字段名），如果不存在则尝试使用views字段（兼容性处理）
  const viewCount = paste.view_count !== undefined ? paste.view_count : paste.views || 0;
  const remaining = paste.max_views - viewCount;
  return remaining <= 0 ? "已用完" : remaining;
};

/**
 * 检查文本分享是否已过期
 * @param {Object} paste - 文本分享对象
 * @returns {boolean} 是否已过期
 */
const isExpired = (paste) => {
  if (!paste.expires_at) return false;
  const expiryDate = new Date(paste.expires_at);
  const now = new Date();
  return expiryDate < now;
};

/**
 * 格式化创建者信息
 * @param {Object} paste - 文本分享对象
 * @returns {string} 格式化后的创建者信息
 */
const formatCreator = (paste) => {
  if (!paste.created_by) {
    return "系统";
  }

  // 处理API密钥创建者
  if (paste.created_by.startsWith("apikey:")) {
    // 如果有key_name，显示密钥名称
    if (paste.key_name) {
      return `密钥：${paste.key_name}`;
    }
    // 否则显示密钥ID的缩略形式
    const keyPart = paste.created_by.substring(7); // 移除"apikey:"前缀
    return `密钥：${keyPart.substring(0, 5)}...`;
  }

  // 处理管理员创建者
  if (paste.created_by === "admin") {
    return "管理员";
  }

  // 如果是UUID格式，视为管理员创建的内容
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paste.created_by)) {
    return "管理员";
  }

  return paste.created_by;
};
</script>

<template>
  <!-- 桌面端完整表格视图 - 只在非移动设备上显示 -->
  <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700 table-fixed">
    <!-- 表头区域 -->
    <thead class="bg-gray-50 dark:bg-gray-700">
      <tr>
        <!-- 全选复选框列 -->
        <th scope="col" class="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-10">
          <div class="flex items-center">
            <input
              type="checkbox"
              :checked="isAllSelected"
              @change="$emit('toggle-select-all')"
              class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded cursor-pointer"
            />
          </div>
        </th>
        <!-- 各列标题 -->
        <th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">链接</th>
        <th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">备注</th>
        <th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">创建时间</th>
        <th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">过期时间</th>
        <th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">密码</th>
        <th scope="col" class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">剩余次数</th>
        <th scope="col" class="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">创建者</th>
        <th scope="col" class="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">操作</th>
      </tr>
    </thead>

    <!-- 表格内容区域 -->
    <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
      <!-- 加载状态 -->
      <tr v-if="loading">
        <td colspan="9" class="px-3 py-3 text-center" :class="darkMode ? 'text-gray-300' : 'text-gray-500'">
          <div class="flex justify-center">
            <svg class="animate-spin h-5 w-5 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span class="ml-2">加载中...</span>
          </div>
        </td>
      </tr>

      <!-- 空数据状态 -->
      <tr v-else-if="pastes.length === 0">
        <td colspan="9" class="px-3 py-3 text-center" :class="darkMode ? 'text-gray-300' : 'text-gray-500'">未找到分享记录</td>
      </tr>

      <!-- 数据行 - 遍历pastes数组生成表格行 -->
      <tr v-for="paste in pastes" :key="paste.id" class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
        <!-- 单项选择复选框 -->
        <td class="px-2 py-3 whitespace-nowrap">
          <div class="flex items-center">
            <input
              type="checkbox"
              :checked="selectedPastes.includes(paste.id)"
              @change="$emit('toggle-select-item', paste.id)"
              class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded cursor-pointer"
            />
          </div>
        </td>

        <!-- 链接显示及复制按钮 -->
        <td class="px-3 py-3 whitespace-nowrap text-sm font-medium">
          <div class="flex items-center space-x-2">
            <span
              class="cursor-pointer hover:underline truncate max-w-[120px]"
              @click="$emit('view', paste.slug)"
              :class="isExpired(paste) ? 'text-red-600 dark:text-red-400' : 'text-primary-600 dark:text-primary-400'"
              :title="paste.slug"
            >
              {{ paste.slug }}
            </span>
            <!-- 复制链接按钮 -->
            <button
              @click="$emit('copy-link', paste.slug)"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full relative"
              title="复制链接"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <!-- 添加复制成功提示 -->
              <span v-if="copiedTexts[paste.id]" class="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 text-xs text-white bg-green-500 rounded whitespace-nowrap">
                已复制
              </span>
            </button>

            <!-- 添加二维码按钮 -->
            <button
              @click="$emit('show-qrcode', paste.slug)"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
              title="显示二维码"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                />
              </svg>
            </button>
          </div>
        </td>

        <!-- 备注显示 - 有备注时使用蓝色背景 -->
        <td class="px-3 py-3 whitespace-nowrap text-sm hidden sm:table-cell">
          <span
            class="truncate max-w-[120px] inline-block px-2 py-0.5 rounded"
            :class="[
              paste.remark ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : darkMode ? 'text-gray-300' : 'text-gray-500',
              isExpired(paste) ? 'text-red-600 dark:text-red-400' : '',
            ]"
            :title="paste.remark || '无'"
          >
            {{ truncateText(paste.remark) }}
          </span>
        </td>

        <!-- 创建时间 -->
        <td
          class="px-3 py-3 whitespace-nowrap text-sm hidden md:table-cell"
          :class="[darkMode ? 'text-gray-300' : 'text-gray-500', isExpired(paste) ? 'text-red-600 dark:text-red-400' : '']"
        >
          {{ formatDate(paste.created_at) }}
        </td>

        <!-- 过期时间 -->
        <td
          class="px-3 py-3 whitespace-nowrap text-sm hidden lg:table-cell"
          :class="[darkMode ? 'text-gray-300' : 'text-gray-500', isExpired(paste) ? 'text-red-600 dark:text-red-400' : '']"
        >
          {{ formatExpiry(paste.expires_at) }}
        </td>

        <!-- 密码保护状态 - 使用标签形式展示 -->
        <td class="px-3 py-3 whitespace-nowrap text-sm hidden sm:table-cell" :class="darkMode ? 'text-gray-300' : 'text-gray-500'">
          <div class="flex items-center">
            <!-- 已加密标签 -->
            <span
              v-if="hasPassword(paste)"
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              :class="[isExpired(paste) ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100']"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              已加密
            </span>
            <!-- 公开标签 -->
            <span
              v-else
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              :class="[isExpired(paste) ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100']"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                />
              </svg>
              公开
            </span>
          </div>
        </td>

        <!-- 剩余访问次数 - 根据剩余状态使用不同颜色 -->
        <td
          class="px-3 py-3 whitespace-nowrap text-sm"
          :class="[
            darkMode ? 'text-gray-300' : 'text-gray-500',
            isExpired(paste)
              ? 'text-red-600 dark:text-red-400'
              : getRemainingViews(paste) === '已用完'
              ? 'text-red-500'
              : paste.max_views && getRemainingViews(paste) < 3 && getRemainingViews(paste) !== '无限制'
              ? 'text-yellow-500'
              : '',
          ]"
        >
          {{ getRemainingViews(paste) }}
        </td>

        <!-- 创建者 -->
        <td class="px-3 py-3 whitespace-nowrap text-sm hidden lg:table-cell">
          <div class="flex items-center justify-center">
            <span
              v-if="paste.created_by && paste.created_by.startsWith('apikey:')"
              class="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 inline-block text-center"
            >
              {{ paste.key_name ? `密钥：${paste.key_name}` : `密钥：${paste.created_by.substring(7, 12)}...` }}
            </span>
            <span
              v-else-if="paste.created_by === 'admin' || (paste.created_by && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paste.created_by))"
              class="px-2 py-0.5 text-xs rounded bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 inline-block text-center"
            >
              管理员
            </span>
            <span v-else class="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 inline-block text-center">
              {{ paste.created_by || "未知来源" }}
            </span>
          </div>
        </td>

        <!-- 操作按钮区域 -->
        <td class="px-3 py-3 whitespace-nowrap text-sm text-right">
          <div class="flex justify-end space-x-2">
            <button
              class="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              @click="$emit('preview', paste)"
              title="预览"
            >
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
            <button
              class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              @click="$emit('edit', paste)"
              title="修改"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
            <!-- 复制原始文本直链按钮 -->
            <button
              @click="$emit('copy-raw-link', paste)"
              class="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 relative"
              title="复制raw文本直链"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.172 13.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102-1.101" />
              </svg>
              <!-- 原始raw文本直链复制成功提示 -->
              <span v-if="copiedRawTexts[paste.id]" class="absolute -top-8 right-0 px-2 py-1 text-xs text-white bg-green-500 rounded whitespace-nowrap"> 已复制直链 </span>
            </button>
            <button
              class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              @click="$emit('delete', paste.id)"
              title="删除"
            >
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
</template>
