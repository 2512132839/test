<template>
  <div class="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
    <div class="relative bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full mx-auto shadow-xl overflow-hidden">
      <!-- 标题栏 -->
      <div class="px-6 py-4 border-b flex justify-between items-center" :class="darkMode ? 'border-gray-700' : 'border-gray-200'">
        <h3 class="text-lg font-medium" :class="darkMode ? 'text-white' : 'text-gray-900'">文件详情</h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-500">
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 文件内容 -->
      <div class="px-6 py-4">
        <div class="space-y-4">
          <!-- 基本信息 -->
          <div>
            <h4 class="text-sm font-medium mb-2" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">基本信息</h4>
            <div class="bg-gray-50 dark:bg-gray-900 rounded p-3">
              <dl class="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
                <dt :class="darkMode ? 'text-gray-400' : 'text-gray-500'">文件名</dt>
                <dd class="col-span-2" :class="darkMode ? 'text-white' : 'text-gray-900'">{{ file.filename }}</dd>

                <dt :class="darkMode ? 'text-gray-400' : 'text-gray-500'">短链接</dt>
                <dd class="col-span-2" :class="darkMode ? 'text-white' : 'text-gray-900'">
                  <span v-if="file.slug">{{ baseUrl }}/file/{{ file.slug }}</span>
                  <span v-else class="text-gray-400">未设置</span>
                </dd>

                <dt :class="darkMode ? 'text-gray-400' : 'text-gray-500'">MIME类型</dt>
                <dd class="col-span-2" :class="darkMode ? 'text-white' : 'text-gray-900'">{{ file.mimetype || "未知" }}</dd>

                <dt :class="darkMode ? 'text-gray-400' : 'text-gray-500'">文件大小</dt>
                <dd class="col-span-2" :class="darkMode ? 'text-white' : 'text-gray-900'">{{ formatFileSize(file.size) }}</dd>

                <dt :class="darkMode ? 'text-gray-400' : 'text-gray-500'">备注</dt>
                <dd class="col-span-2">
                  <span v-if="file.remark" :class="darkMode ? 'text-blue-400' : 'text-blue-600'">{{ file.remark }}</span>
                  <span v-else class="text-gray-400">无备注</span>
                </dd>

                <dt :class="darkMode ? 'text-gray-400' : 'text-gray-500'">密码保护</dt>
                <dd class="col-span-2" :class="darkMode ? 'text-white' : 'text-gray-900'">
                  <span v-if="file.has_password" class="text-yellow-500">已启用</span>
                  <span v-else>未启用</span>
                </dd>
              </dl>
            </div>
          </div>

          <!-- 访问统计 -->
          <div>
            <h4 class="text-sm font-medium mb-2" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">访问统计</h4>
            <div class="bg-gray-50 dark:bg-gray-900 rounded p-3">
              <dl class="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
                <dt :class="darkMode ? 'text-gray-400' : 'text-gray-500'">访问次数</dt>
                <dd class="col-span-2" :class="darkMode ? 'text-white' : 'text-gray-900'">{{ file.views || 0 }} 次</dd>

                <dt :class="darkMode ? 'text-gray-400' : 'text-gray-500'">剩余次数</dt>
                <dd class="col-span-2" :class="remainingViewsClass">
                  {{ getRemainingViews }}
                </dd>

                <dt :class="darkMode ? 'text-gray-400' : 'text-gray-500'">过期时间</dt>
                <dd class="col-span-2" :class="expiresClass">
                  <span v-if="file.expires_at">{{ formatDateTime(file.expires_at) }}</span>
                  <span v-else>永不过期</span>
                </dd>
              </dl>
            </div>
          </div>

          <!-- 存储信息 -->
          <div>
            <h4 class="text-sm font-medium mb-2" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">存储信息</h4>
            <div class="bg-gray-50 dark:bg-gray-900 rounded p-3">
              <dl class="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
                <dt :class="darkMode ? 'text-gray-400' : 'text-gray-500'">存储配置</dt>
                <dd class="col-span-2" :class="darkMode ? 'text-white' : 'text-gray-900'">
                  {{ file.s3_config_name || "默认存储" }}
                </dd>

                <dt :class="darkMode ? 'text-gray-400' : 'text-gray-500'">提供商</dt>
                <dd class="col-span-2" :class="darkMode ? 'text-white' : 'text-gray-900'">
                  {{ file.s3_provider_type || "未知" }}
                </dd>

                <dt :class="darkMode ? 'text-gray-400' : 'text-gray-500'">存储路径</dt>
                <dd class="col-span-2 break-all text-xs" :class="darkMode ? 'text-white' : 'text-gray-900'">
                  {{ file.storage_path || "未知" }}
                </dd>

                <dt :class="darkMode ? 'text-gray-400' : 'text-gray-500'">ETag</dt>
                <dd class="col-span-2 break-all text-xs" :class="darkMode ? 'text-white' : 'text-gray-900'">
                  {{ file.etag || "未知" }}
                </dd>

                <dt :class="darkMode ? 'text-gray-400' : 'text-gray-500'">创建时间</dt>
                <dd class="col-span-2" :class="darkMode ? 'text-white' : 'text-gray-900'">
                  {{ formatDateTime(file.created_at) }}
                </dd>
              </dl>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="flex justify-between mt-4">
            <!-- 左侧按钮组 -->
            <div class="flex space-x-2">
              <!-- 下载文件按钮 - 使用永久链接 -->
              <button @click="downloadFile" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium">下载文件</button>

              <!-- 预览按钮 - 使用永久链接 -->
              <button @click="previewFile" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium">预览</button>
            </div>

            <button
              @click="$emit('close')"
              class="px-4 py-2 rounded-md text-sm font-medium transition-colors"
              :class="darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, computed } from "vue";

const props = defineProps({
  file: {
    type: Object,
    required: true,
  },
  darkMode: {
    type: Boolean,
    default: false,
  },
});

defineEmits(["close"]);

// 获取当前网站基础URL
const baseUrl = computed(() => {
  return window.location.origin;
});

/**
 * 辅助函数：获取文件密码
 * 从多个可能的来源获取密码
 */
const getFilePassword = () => {
  // 优先使用文件信息中存储的明文密码
  if (props.file.plain_password) {
    return props.file.plain_password;
  }

  // 其次检查当前密码字段
  if (props.file.currentPassword) {
    return props.file.currentPassword;
  }

  // 尝试从URL获取密码参数
  const currentUrl = new URL(window.location.href);
  const passwordParam = currentUrl.searchParams.get("password");
  if (passwordParam) {
    return passwordParam;
  }

  // 最后尝试从会话存储中获取密码
  try {
    if (props.file.slug) {
      const sessionPassword = sessionStorage.getItem(`file_password_${props.file.slug}`);
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
 * 格式化日期时间
 * @param {string} dateString - ISO格式的日期字符串
 * @returns {string} 格式化后的日期时间
 */
const formatDateTime = (dateString) => {
  if (!dateString) return "未知";

  const date = new Date(dateString);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

/**
 * 获取文件的永久下载链接
 */
const getPermanentDownloadUrl = computed(() => {
  if (!props.file.slug) return "";

  // 获取文件密码
  const filePassword = getFilePassword();

  // 检查文件是否有urls对象和代理URL
  if (props.file.urls && props.file.urls.proxyDownloadUrl) {
    // 使用后端返回的代理URL，始终采用worker代理，不受use_proxy影响
    let url = props.file.urls.proxyDownloadUrl;

    // 如果有密码保护且URL中没有密码参数，则添加密码
    if (props.file.has_password && filePassword && !url.includes("password=")) {
      url += url.includes("?") ? `&password=${encodeURIComponent(filePassword)}` : `?password=${encodeURIComponent(filePassword)}`;
    }

    return url;
  }

  // 如果没有urls对象，则回退到前端构建URL
  let url = `${baseUrl.value}/api/file-download/${props.file.slug}`;

  // 如果有密码保护，则添加密码参数
  if (props.file.has_password && filePassword) {
    url += `?password=${encodeURIComponent(filePassword)}`;
  }

  return url;
});

/**
 * 获取文件的永久预览链接
 */
const getPermanentViewUrl = computed(() => {
  if (!props.file.slug) return "";

  // 获取文件密码
  const filePassword = getFilePassword();

  // 检查文件是否有urls对象和代理URL
  if (props.file.urls && props.file.urls.proxyPreviewUrl) {
    // 使用后端返回的代理URL，始终采用worker代理，不受use_proxy影响
    let url = props.file.urls.proxyPreviewUrl;

    // 如果有密码保护且URL中没有密码参数，则添加密码
    if (props.file.has_password && filePassword && !url.includes("password=")) {
      url += url.includes("?") ? `&password=${encodeURIComponent(filePassword)}` : `?password=${encodeURIComponent(filePassword)}`;
    }

    return url;
  }

  // 如果没有urls对象，则回退到前端构建URL
  let url = `${baseUrl.value}/api/file-view/${props.file.slug}`;

  // 如果有密码保护，则添加密码参数
  if (props.file.has_password && filePassword) {
    url += `?password=${encodeURIComponent(filePassword)}`;
  }

  return url;
});

/**
 * 预览文件
 * 在新窗口中打开预览链接
 */
const previewFile = () => {
  // 使用永久预览链接
  if (!props.file.slug) {
    alert("无法预览：文件没有设置短链接");
    return;
  }

  try {
    window.open(getPermanentViewUrl.value, "_blank");
  } catch (err) {
    console.error("预览文件失败:", err);
    alert("预览文件失败，请稍后重试");
  }
};

/**
 * 下载文件
 * 通过创建隐藏的a元素并模拟点击下载文件
 */
const downloadFile = () => {
  try {
    // 检查是否有永久下载链接
    if (!props.file.slug) {
      alert("无法下载：文件没有设置短链接");
      return;
    }

    // 提取文件名，用于下载时的文件命名
    const fileName = props.file.filename || "下载文件";

    // 创建一个隐藏的a标签
    const link = document.createElement("a");
    link.href = getPermanentDownloadUrl.value;
    link.download = fileName; // 设置下载文件名
    link.setAttribute("target", "_blank"); // 在新窗口打开
    document.body.appendChild(link);

    // 模拟点击下载
    link.click();

    // 移除临时创建的元素
    setTimeout(() => {
      document.body.removeChild(link);
    }, 100);
  } catch (err) {
    console.error("下载文件失败:", err);
    // 如果直接下载失败，尝试在新窗口打开下载链接
    if (props.file.slug) {
      window.open(getPermanentDownloadUrl.value, "_blank");
    } else {
      window.open(props.file.s3_url, "_blank");
    }
  }
};

/**
 * 计算过期时间的显示样式
 */
const expiresClass = computed(() => {
  if (!props.file.expires_at) {
    return props.darkMode ? "text-white" : "text-gray-900";
  }

  const expiryDate = new Date(props.file.expires_at);
  const now = new Date();

  if (expiryDate < now) {
    return "text-red-500";
  }

  const diffMs = expiryDate - now;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 1) {
    return "text-orange-500";
  }

  return props.darkMode ? "text-white" : "text-gray-900";
});

/**
 * 计算剩余访问次数
 */
const getRemainingViews = computed(() => {
  if (!props.file.max_views || props.file.max_views === 0) return "无限制";
  const viewCount = props.file.views || 0;
  const remaining = props.file.max_views - viewCount;
  return remaining <= 0 ? "已用完" : `${remaining} 次`;
});

/**
 * 计算剩余次数的显示样式
 */
const remainingViewsClass = computed(() => {
  if (!props.file.max_views) {
    return props.darkMode ? "text-white" : "text-gray-900";
  }

  const viewCount = props.file.views || 0;
  const remaining = props.file.max_views - viewCount;

  if (remaining <= 0) {
    return "text-red-500";
  }

  if (remaining < 3) {
    return "text-orange-500";
  }

  return props.darkMode ? "text-white" : "text-gray-900";
});
</script>
