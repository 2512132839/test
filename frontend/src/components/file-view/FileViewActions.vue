<template>
  <div class="file-actions flex flex-wrap gap-3">
    <!-- 预览按钮 -->
    <button
      v-if="fileUrls.previewUrl"
      @click="previewFile"
      class="action-button flex items-center justify-center px-4 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500 focus:ring-offset-white dark:focus:ring-offset-gray-800"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
      </svg>
      <span>预览文件</span>
    </button>

    <!-- 下载按钮 -->
    <button
      v-if="fileUrls.downloadUrl"
      @click="downloadFile"
      class="action-button flex items-center justify-center px-4 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 focus:ring-offset-white dark:focus:ring-offset-gray-800"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      <span>下载文件</span>
    </button>

    <!-- 编辑按钮 (管理员可见所有文件，API密钥用户只能看到自己的文件) -->
    <button
      v-if="(isAdmin || (hasApiKey && hasFilePermission && isCreator)) && fileInfo.id"
      @click="$emit('edit')"
      class="action-button flex items-center justify-center px-4 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white focus:ring-gray-400 dark:focus:ring-gray-500 focus:ring-offset-white dark:focus:ring-offset-gray-800"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        />
      </svg>
      <span>编辑信息</span>
    </button>

    <!-- 分享按钮 -->
    <button
      @click="shareFile"
      class="action-button flex items-center justify-center px-4 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 bg-green-600 hover:bg-green-700 text-white focus:ring-green-500 focus:ring-offset-white dark:focus:ring-offset-gray-800"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
        />
      </svg>
      <span>分享链接</span>
    </button>

    <!-- 删除按钮 (管理员可见所有文件，API密钥用户只能看到自己的文件) -->
    <button
      v-if="(isAdmin || (hasApiKey && hasFilePermission && isCreator)) && fileInfo.id"
      @click="confirmDelete"
      class="action-button flex items-center justify-center px-4 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 focus:ring-offset-white dark:focus:ring-offset-gray-800"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
      <span>删除文件</span>
    </button>

    <!-- 删除确认模态框 -->
    <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div class="rounded-lg p-6 max-w-sm w-full shadow-xl bg-white dark:bg-gray-800">
        <h3 class="text-lg font-medium mb-4 text-gray-900 dark:text-white">确认删除文件</h3>
        <p class="mb-6 text-gray-600 dark:text-gray-300">
          您确定要删除文件 <strong>{{ fileInfo.filename }}</strong> 吗？此操作无法撤销。
        </p>
        <div class="flex justify-end space-x-3">
          <button
            @click="showDeleteConfirm = false"
            class="px-4 py-2 rounded-md text-sm font-medium transition-colors bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-white"
          >
            取消
          </button>
          <button @click="deleteFile" class="px-4 py-2 rounded-md text-sm font-medium transition-colors bg-red-600 hover:bg-red-700 text-white" :disabled="deleting">
            {{ deleting ? "删除中..." : "确认删除" }}
          </button>
        </div>
      </div>
    </div>

    <!-- 复制成功提示 -->
    <div
      v-if="showCopyToast"
      class="fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 flex items-center transition-opacity duration-200 bg-white dark:bg-gray-800 text-green-600 dark:text-green-400 border border-gray-200 dark:border-gray-700"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      <span>链接已复制到剪贴板!</span>
    </div>
  </div>
</template>

<script setup>
import { ref, defineProps, defineEmits, computed, onMounted } from "vue";
import { getAuthStatus } from "./FileViewUtils";
import { api } from "../../api";
import { ApiStatus } from "../../api/ApiStatus";
import { getFullApiUrl } from "../../api/config";

const props = defineProps({
  fileInfo: {
    type: Object,
    required: true,
  },
  fileUrls: {
    type: Object,
    default: () => ({
      previewUrl: "",
      downloadUrl: "",
    }),
  },
  darkMode: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["edit", "delete", "refresh-file-info"]);

// 获取用户权限
const { isAdmin, hasApiKey, hasFilePermission } = getAuthStatus();

// 删除确认状态
const showDeleteConfirm = ref(false);
const deleting = ref(false);

// 复制提示状态
const showCopyToast = ref(false);

// 计算属性：判断当前API密钥用户是否为文件创建者
const isCreator = computed(() => {
  // 如果是管理员，可以编辑任何文件
  if (isAdmin) {
    return true;
  }

  // 如果文件没有创建者信息，则无法判断
  if (!props.fileInfo || !props.fileInfo.created_by) {
    return false;
  }

  try {
    // 方法1: 从localStorage获取API密钥信息
    const apiKeyInfo = localStorage.getItem("api_key_info");
    if (apiKeyInfo) {
      // 解析API密钥信息
      const keyInfo = JSON.parse(apiKeyInfo);

      // 处理created_by字段，后端返回的格式是"apikey:密钥ID"
      const createdBy = props.fileInfo.created_by;

      // 如果created_by以"apikey:"开头，提取实际的ID部分
      if (typeof createdBy === "string" && createdBy.startsWith("apikey:")) {
        const actualKeyId = createdBy.substring(7); // 移除"apikey:"前缀
        return keyInfo.id === actualKeyId;
      }

      // 否则直接比较完整的ID
      return keyInfo.id === createdBy;
    }

    // 方法2: 从URL参数获取API密钥
    const urlParams = new URLSearchParams(window.location.search);
    const urlApiKey = urlParams.get("apiKey");
    if (urlApiKey) {
      // 提取created_by字段中的API密钥部分
      const createdBy = props.fileInfo.created_by;
      if (typeof createdBy === "string" && createdBy.startsWith("apikey:")) {
        // 这里我们只能做简单比较，因为URL中的是完整密钥而不是ID
        const actualApiKeyId = createdBy.substring(7);
        return urlApiKey === actualApiKeyId;
      }
    }

    // 方法3: 从localStorage获取原始API密钥
    const storedApiKey = localStorage.getItem("api_key");
    if (storedApiKey) {
      // 检查用户是否有文件权限
      if (!hasFilePermission) {
        return false;
      }

      // 如果是API密钥用户且有文件权限，检查文件是否由API密钥用户创建
      const createdBy = props.fileInfo.created_by || "";
      if (createdBy.startsWith("apikey:")) {
        // 由于无法确定确切ID，暂时允许任何有文件权限的API密钥用户编辑
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error("解析API密钥信息失败:", err);
    return false;
  }
});

// 在组件挂载时验证API密钥，确保拥有正确的密钥信息
onMounted(async () => {
  // 如果是API密钥用户但localStorage中没有api_key_info
  if (hasApiKey && !localStorage.getItem("api_key_info")) {
    try {
      // 导入辅助工具
      const { getApiKeyInfo } = await import("../../utils/auth-helper.js");

      // 尝试获取API密钥信息
      await getApiKeyInfo();
    } catch (err) {
      console.error("验证API密钥出错:", err);
    }
  }
});

// 辅助函数：获取文件密码
const getFilePassword = () => {
  // 优先使用文件信息中存储的已验证密码
  if (props.fileInfo.currentPassword) {
    return props.fileInfo.currentPassword;
  }

  // 其次尝试从URL获取密码参数
  const currentUrl = new URL(window.location.href);
  const passwordParam = currentUrl.searchParams.get("password");
  if (passwordParam) {
    return passwordParam;
  }

  // 最后尝试从会话存储中获取密码
  try {
    const sessionPassword = sessionStorage.getItem(`file_password_${props.fileInfo.slug}`);
    if (sessionPassword) {
      return sessionPassword;
    }
  } catch (err) {
    console.error("从会话存储获取密码出错:", err);
  }

  return null;
};

/**
 * 预览文件
 * 在新窗口中打开预览链接
 */
const previewFile = () => {
  if (!props.fileUrls.previewUrl) return;

  try {
    // 检查是否是代理URL并添加密码参数
    let previewUrl = props.fileUrls.previewUrl;

    // 判断是否是代理URL（以/api/file-view/开头）
    if (previewUrl.includes("/api/file-view/")) {
      // 获取文件密码
      const filePassword = getFilePassword();

      // 如果有密码，并且预览URL中还没有包含密码参数
      if (filePassword && !previewUrl.includes("password=")) {
        // 添加密码参数到预览URL
        previewUrl = previewUrl.includes("?") ? `${previewUrl}&password=${encodeURIComponent(filePassword)}` : `${previewUrl}?password=${encodeURIComponent(filePassword)}`;

        console.log("已添加密码参数到预览URL");
      }
    }

    // 在新窗口打开带有密码的预览链接
    window.open(previewUrl, "_blank");
  } catch (err) {
    console.error("预览文件失败:", err);
    // 如果出错，尝试直接刷新获取新链接
    emit("refresh-file-info");
  }
};

/**
 * 下载文件
 * 通过创建隐藏的a元素并模拟点击下载文件
 */
const downloadFile = () => {
  if (!props.fileUrls.downloadUrl) return;

  try {
    console.log("开始下载文件:", props.fileInfo.filename);

    // 提取文件名，用于下载时的文件命名
    const fileName = props.fileInfo.filename || "下载文件";

    // 检查是否是代理URL并添加密码参数
    let downloadUrl = props.fileUrls.downloadUrl;

    // 判断是否是代理URL（以/api/file-download/开头）
    if (downloadUrl.includes("/api/file-download/")) {
      // 获取文件密码
      const filePassword = getFilePassword();

      // 如果有密码，并且下载URL中还没有包含密码参数
      if (filePassword && !downloadUrl.includes("password=")) {
        // 添加密码参数到下载URL
        downloadUrl = downloadUrl.includes("?") ? `${downloadUrl}&password=${encodeURIComponent(filePassword)}` : `${downloadUrl}?password=${encodeURIComponent(filePassword)}`;

        console.log("已添加密码参数到下载URL");
      }
    }

    // 创建一个隐藏的a标签
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = fileName; // 设置下载文件名
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
    // 注意：这里也需要使用添加了密码的URL
    let downloadUrl = props.fileUrls.downloadUrl;

    // 判断是否是代理URL
    if (downloadUrl.includes("/api/file-download/")) {
      // 获取文件密码
      const filePassword = getFilePassword();

      // 如果有密码，并且下载URL中还没有包含密码参数
      if (filePassword && !downloadUrl.includes("password=")) {
        // 添加密码参数到下载URL
        downloadUrl = downloadUrl.includes("?") ? `${downloadUrl}&password=${encodeURIComponent(filePassword)}` : `${downloadUrl}?password=${encodeURIComponent(filePassword)}`;
      }

      // 不再需要添加counted=true参数，下载端点默认不增加计数
    }

    window.open(downloadUrl, "_blank");

    // 如果是授权问题，提示刷新页面
    if (
      err.status === ApiStatus.FORBIDDEN ||
      err.response?.status === ApiStatus.FORBIDDEN ||
      err.status === ApiStatus.UNAUTHORIZED ||
      err.response?.status === ApiStatus.UNAUTHORIZED ||
      err.code === ApiStatus.FORBIDDEN ||
      err.code === ApiStatus.UNAUTHORIZED ||
      (err.message && (err.message.includes(ApiStatus.FORBIDDEN.toString()) || err.message.includes(ApiStatus.UNAUTHORIZED.toString())))
    ) {
      alert("下载链接可能已过期，正在自动刷新获取新的下载链接。");
      emit("refresh-file-info");
    }
  }
};

/**
 * 分享文件链接
 */
const shareFile = async () => {
  // 构建当前页面的完整URL
  const shareUrl = window.location.href;

  // 尝试使用Web Share API
  if (navigator.share) {
    try {
      await navigator.share({
        title: props.fileInfo.filename,
        text: props.fileInfo.remark || `分享文件：${props.fileInfo.filename}`,
        url: shareUrl,
      });
      console.log("文件分享成功");
    } catch (err) {
      console.error("分享失败:", err);
      fallbackShare(shareUrl);
    }
  } else {
    // 如果Web Share API不可用，则回退到复制链接
    fallbackShare(shareUrl);
  }
};

/**
 * 回退的分享方法（复制到剪贴板）
 * @param {string} url - 要分享的URL
 */
const fallbackShare = async (url) => {
  try {
    await navigator.clipboard.writeText(url);
    // 显示复制成功提示
    showCopyToast.value = true;
    // 3秒后自动隐藏提示
    setTimeout(() => {
      showCopyToast.value = false;
    }, 3000);
  } catch (err) {
    console.error("复制失败:", err);
    // 如果复制失败，提示用户手动复制
    alert(`无法自动复制，请手动复制链接：${url}`);
  }
};

/**
 * 显示删除确认对话框
 */
const confirmDelete = () => {
  showDeleteConfirm.value = true;
};

/**
 * 删除文件
 */
const deleteFile = async () => {
  if (!props.fileInfo.id) return;

  deleting.value = true;

  try {
    let response;

    // 根据用户类型选择合适的 API 函数
    if (isAdmin) {
      response = await api.file.deleteFile(props.fileInfo.id);
    } else if (hasApiKey && hasFilePermission && isCreator.value) {
      response = await api.file.deleteUserFile(props.fileInfo.id);
    } else {
      throw new Error("没有足够的权限删除此文件");
    }

    if (response.success) {
      // 关闭确认对话框
      showDeleteConfirm.value = false;
      // 通知父组件文件已删除
      emit("delete", props.fileInfo.id);
    } else {
      // 处理删除失败的情况
      console.error("删除文件失败:", response.message);
      alert(`删除文件失败: ${response.message}`);
    }
  } catch (err) {
    console.error("删除文件错误:", err);
    alert(err.message || "删除文件时发生错误，请稍后重试");
  } finally {
    deleting.value = false;
  }
};
</script>
