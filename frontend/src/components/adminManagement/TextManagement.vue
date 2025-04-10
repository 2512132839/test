<script setup>
import { ref, onMounted, reactive, computed } from "vue";
import { getAllPastes } from "../../api/adminService";
import api from "../../api";
import QRCode from "qrcode";
import { getRawPasteUrl } from "../../api/pasteService";

// 导入子组件
import PasteTable from "../text-management/PasteTable.vue";
import PasteCardList from "../text-management/PasteCardList.vue";
import PastePreviewModal from "../text-management/PastePreviewModal.vue";
import PasteEditModal from "../text-management/PasteEditModal.vue";
import CommonPagination from "../common/CommonPagination.vue";

/**
 * 组件接收的属性定义
 * darkMode: 主题模式
 */
const props = defineProps({
  darkMode: {
    type: Boolean,
    required: true,
  },
});

/**
 * 状态变量定义
 * loading: 数据加载状态
 * error: 错误信息
 * successMessage: 成功消息提示
 * pastes: 文本分享数据列表
 * pagination: 分页信息对象
 */
const loading = ref(false);
const error = ref("");
const successMessage = ref(""); // 用于显示操作成功的消息
const pastes = ref([]);
const pagination = reactive({
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
});

// 用户权限状态
const isAdmin = ref(false);
const isApiKeyUser = ref(false);

// 计算得到综合的权限状态
const isAuthorized = computed(() => {
  return isAdmin.value || isApiKeyUser.value;
});

// 选中项管理
const selectedPastes = ref([]);

/**
 * 选中/取消选中所有项
 * 如果当前已全选，则取消全选；否则全选
 */
const toggleSelectAll = () => {
  if (selectedPastes.value.length === pastes.value.length) {
    selectedPastes.value = [];
  } else {
    selectedPastes.value = pastes.value.map((paste) => paste.id);
  }
};

/**
 * 切换单个项的选中状态
 * @param {string|number} id - 文本分享的ID
 */
const toggleSelectItem = (id) => {
  const index = selectedPastes.value.indexOf(id);
  if (index === -1) {
    selectedPastes.value.push(id);
  } else {
    selectedPastes.value.splice(index, 1);
  }
};

// 预览弹窗相关状态
const showPreview = ref(false);
const previewPaste = ref(null);

// 修改弹窗相关状态
const showEdit = ref(false);
const editingPaste = ref(null);

// 最后刷新时间记录
const lastRefreshTime = ref("");

// 添加二维码相关状态变量
const showQRCodeModal = ref(false);
const qrCodeDataURL = ref("");
const qrCodeSlug = ref("");

// 添加响应式对象跟踪文本复制状态
const copiedTexts = reactive({});

// 添加响应式对象跟踪原始文本直链复制状态
const copiedRawTexts = reactive({});

/**
 * 格式化当前时间为本地时间字符串
 * @returns {string} 格式化后的时间字符串
 */
const formatCurrentTime = () => {
  const now = new Date();
  return now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

/**
 * 更新最后刷新时间
 * 记录数据的最后刷新时间点
 */
const updateLastRefreshTime = () => {
  lastRefreshTime.value = formatCurrentTime();
};

/**
 * 检查用户权限并设置状态
 * 判断当前用户是管理员还是API密钥用户
 */
const checkUserPermission = () => {
  console.log("开始检查用户权限");

  // 检查是否有管理员令牌
  const adminToken = localStorage.getItem("admin_token");
  if (adminToken) {
    console.log("检测到管理员令牌");
    isAdmin.value = true;
    return;
  }

  // 检查是否有API密钥
  const apiKey = localStorage.getItem("api_key");
  const permissions = localStorage.getItem("api_key_permissions");

  console.log("API密钥检查:", { apiKey: !!apiKey, permissions });

  if (apiKey && permissions) {
    try {
      let permObj;
      try {
        permObj = JSON.parse(permissions);
      } catch (parseError) {
        console.error("API密钥权限JSON解析失败:", parseError);
        // 如果解析失败，尝试使用字符串检查
        if (typeof permissions === "string") {
          // 简单字符串检查，查找"text"或"text_permission"
          if (permissions.includes("text") || permissions.includes("text_permission")) {
            console.log("通过字符串匹配判断有文本权限");
            isApiKeyUser.value = true;
            return;
          }
        }
        return;
      }

      // 检查是否有文本操作权限
      console.log("解析后的权限对象:", permObj);
      if (permObj.text || permObj.text_permission) {
        console.log("API密钥具有文本权限");
        isApiKeyUser.value = true;
      } else {
        console.log("API密钥不具有文本权限");
      }
    } catch (e) {
      console.error("检查API密钥权限失败:", e);
    }
  } else {
    console.log("未检测到有效的API密钥或权限");
  }
};

/**
 * 加载文本分享数据
 * 从API获取文本分享列表数据，支持分页
 */
const loadPastes = async () => {
  // 先检查用户权限
  checkUserPermission();

  // 检查权限状态
  if (!isAuthorized.value) {
    error.value = "无权限访问管理功能";
    return;
  }

  loading.value = true;
  error.value = "";
  successMessage.value = ""; // 清空成功消息

  try {
    let result;

    if (isAdmin.value) {
      // 管理员使用管理员API
      result = await api.admin.getAllPastes(pagination.page, pagination.limit);

      // 根据API文档，管理员接口返回的是一个数据数组和分页信息
      if (Array.isArray(result.data)) {
        // 如果返回的是一个数组，直接使用
        pastes.value = result.data;
      } else if (result.data && Array.isArray(result.data.pastes)) {
        // 如果返回包含pastes属性的对象，使用该属性
        pastes.value = result.data.pastes;
      } else {
        // 兜底，防止数据格式不一致
        pastes.value = result.data || [];
      }

      // 更新分页信息
      if (result.pagination) {
        pagination.total = result.pagination.total;
        pagination.totalPages = result.pagination.totalPages || Math.ceil(result.pagination.total / pagination.limit);
      } else if (result.data && result.data.pagination) {
        pagination.total = result.data.pagination.total;
        pagination.totalPages = result.data.pagination.totalPages || Math.ceil(result.data.pagination.total / pagination.limit);
      }
    } else if (isApiKeyUser.value) {
      // API密钥用户使用用户API
      const offset = (pagination.page - 1) * pagination.limit;
      result = await api.user.paste.getPastes(pagination.limit, offset);

      console.log("API密钥用户获取文本列表响应:", result);

      // 更新数据
      if (Array.isArray(result.data)) {
        // 如果数据直接是数组，直接使用
        pastes.value = result.data;
      } else {
        // 兜底处理
        pastes.value = result.data?.pastes || [];
      }

      // 添加created_by字段，
      // 从localStorage获取API密钥信息
      const apiKey = localStorage.getItem("api_key");
      if (apiKey && pastes.value.length > 0) {
        // 为每条数据添加created_by字段，值为apikey:xxx格式
        pastes.value = pastes.value.map((paste) => {
          // 如果后端已经返回了created_by字段，则不覆盖，显示的是UUID
          if (!paste.created_by) {
            return {
              ...paste,
              created_by: `apikey:${apiKey.substring(0, 5)}`, // 使用本地存储的API密钥前5位
            };
          }
          return paste;
        });
      }

      // 计算总数和总页数
      // 如果结果中有总数信息
      const total = result.pagination?.total || pastes.value.length;
      pagination.total = total;
      // 计算总页数
      pagination.totalPages = Math.ceil(total / pagination.limit);
    }

    // 打印数据，用于调试
    console.log("加载的文本数据:", pastes.value);
    console.log("分页信息:", pagination);

    // 更新最后刷新时间
    updateLastRefreshTime();
  } catch (err) {
    console.error("加载分享失败:", err);
    error.value = err.message || "加载失败，请重试";
    pastes.value = [];
  } finally {
    loading.value = false;
  }
};

/**
 * 跳转到指定页
 * @param {number} page - 目标页码
 */
const goToPage = (page) => {
  if (page >= 1 && page <= pagination.totalPages) {
    pagination.page = page;
    loadPastes();
  }
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

/**
 * 删除单个分享项
 * @param {string|number} id - 要删除的分享ID
 */
const deletePaste = async (id) => {
  if (!confirm("确定要删除此分享吗？此操作不可恢复。")) {
    return;
  }

  try {
    // 清空之前的消息
    error.value = "";
    successMessage.value = "";

    if (isAdmin.value) {
      // 管理员使用管理员API
      await api.admin.deletePaste(id);
    } else if (isApiKeyUser.value) {
      // API密钥用户使用用户API
      await api.user.paste.deletePaste(id);
    } else {
      throw new Error("无权限执行此操作");
    }

    // 重新加载数据
    loadPastes();

    // 显示成功消息
    successMessage.value = "删除成功";
    setTimeout(() => {
      successMessage.value = "";
    }, 3000);
  } catch (err) {
    console.error("删除失败:", err);
    error.value = err.message || "删除失败，请重试";
  }
};

/**
 * 批量删除选中的分享项
 * 删除所有已选中的分享项
 */
const deleteSelectedPastes = async () => {
  if (selectedPastes.value.length === 0) {
    alert("请先选择需要删除的项");
    return;
  }

  const selectedCount = selectedPastes.value.length;

  if (!confirm(`确定要删除选中的 ${selectedCount} 项分享吗？此操作不可恢复。`)) {
    return;
  }

  try {
    // 清空之前的消息
    error.value = "";
    successMessage.value = "";

    if (isAdmin.value) {
      // 管理员使用管理员API
      await api.admin.deletePastes(selectedPastes.value);
    } else if (isApiKeyUser.value) {
      // API密钥用户使用用户API
      await api.user.paste.deletePastes(selectedPastes.value);
    } else {
      throw new Error("无权限执行此操作");
    }

    // 清空选中列表
    selectedPastes.value = [];
    // 重新加载数据
    loadPastes();

    // 显示成功消息
    successMessage.value = `成功删除${selectedCount}个分享`;
    setTimeout(() => {
      successMessage.value = "";
    }, 3000);
  } catch (err) {
    console.error("批量删除失败:", err);
    error.value = err.message || "批量删除失败，请重试";
  }
};

/**
 * 清理所有过期的文本分享（仅管理员可用）
 * 删除系统中所有已过期的分享项
 */
const clearExpiredPastes = async () => {
  if (!isAdmin.value) {
    error.value = "只有管理员才能清理过期文本";
    return;
  }

  if (!confirm("确定要立即清理所有过期的文本分享吗？此操作不可恢复。")) {
    return;
  }

  try {
    // 清空之前的消息
    error.value = "";
    successMessage.value = "";

    // 使用管理员API清理过期文本
    const result = await api.admin.clearExpiredPastes();

    // 显示成功消息
    successMessage.value = result.message || "清理完成";
    setTimeout(() => {
      successMessage.value = "";
    }, 3000);

    // 重新加载数据
    loadPastes();
  } catch (err) {
    console.error("清理过期内容失败:", err);
    error.value = err.message || "清理过期内容失败，请重试";
  }
};

/**
 * 前往查看页面
 * 在新窗口打开分享链接
 * @param {string} slug - 文本分享的唯一标识
 */
const goToViewPage = (slug) => {
  if (slug) {
    // 在新窗口打开查看页面
    window.open(`/paste/${slug}`, "_blank");
  }
};

/**
 * 复制链接到剪贴板
 * @param {string} slug - 文本分享的唯一标识
 */
const copyLink = (slug) => {
  const link = `${window.location.origin}/paste/${slug}`;
  navigator.clipboard
    .writeText(link)
    .then(() => {
      // 找到对应的paste对象
      const paste = pastes.value.find((p) => p.slug === slug);
      // 确保paste和paste.id都存在
      if (paste && paste.id) {
        // 为特定文本设置复制成功状态
        copiedTexts[paste.id] = true;

        // 3秒后清除状态
        setTimeout(() => {
          // 再次检查以确保对象和ID仍然存在
          if (copiedTexts && paste && paste.id) {
            copiedTexts[paste.id] = false;
          }
        }, 2000);
      } else {
        console.log("复制成功，但无法找到对应的paste对象或ID");
      }
    })
    .catch((err) => {
      console.error("复制失败:", err);
      alert("复制失败，请手动复制");
    });
};

/**
 * 复制原始文本直链到剪贴板
 * @param {Object} paste - 文本分享对象
 */
const copyRawLink = async (paste) => {
  if (!paste || !paste.slug) {
    alert("该文本没有有效的原始直链");
    return;
  }

  try {
    let pasteWithPassword = paste;

    // 如果paste对象有加密但没有明文密码，先获取完整信息
    if (paste.has_password && !paste.plain_password) {
      let result;
      if (isAdmin.value) {
        // 管理员获取分享内容
        result = await api.admin.getPasteById(paste.id);
      } else if (isApiKeyUser.value) {
        // API密钥用户获取分享内容
        result = await api.user.paste.getPasteById(paste.id);
      } else {
        throw new Error("无权限执行此操作");
      }
      pasteWithPassword = result.data;
    }

    // 构建原始文本链接URL，使用paste.plain_password（如果存在）
    const finalLink = getRawPasteUrl(pasteWithPassword.slug, pasteWithPassword.plain_password);

    navigator.clipboard
      .writeText(finalLink)
      .then(() => {
        // 确保paste和paste.id都存在
        if (paste && paste.id) {
          // 为特定文本设置复制成功状态
          copiedRawTexts[paste.id] = true;

          // 3秒后清除状态
          setTimeout(() => {
            // 再次检查以确保对象和ID仍然存在
            if (copiedRawTexts && paste && paste.id) {
              copiedRawTexts[paste.id] = false;
            }
          }, 2000);
        } else {
          console.log("复制原始链接成功，但无法找到对应的paste对象或ID");
        }
      })
      .catch((err) => {
        console.error("复制原始链接失败:", err);
        alert("复制原始链接失败，请手动复制");
      });
  } catch (err) {
    console.error("获取文本详情失败:", err);
    alert("获取文本详情失败，无法复制直链");
  }
};

/**
 * 打开预览弹窗
 * @param {Object} paste - 要预览的文本分享对象
 */
const openPreview = async (paste) => {
  try {
    // 根据用户权限获取完整的分享内容
    let fullPaste;

    if (isAdmin.value) {
      // 管理员获取分享内容
      const result = await api.admin.getPasteById(paste.id);
      fullPaste = result.data;
    } else if (isApiKeyUser.value) {
      // API密钥用户获取分享内容
      const result = await api.user.paste.getPasteById(paste.id);
      fullPaste = result.data;
    } else {
      throw new Error("无权限执行此操作");
    }

    // 设置预览状态
    previewPaste.value = fullPaste;
    showPreview.value = true;
  } catch (err) {
    console.error("获取分享详情失败:", err);
    error.value = err.message || "获取分享详情失败，请重试";
  }
};

/**
 * 关闭预览弹窗
 * 隐藏预览弹窗并清空预览数据
 */
const closePreview = () => {
  showPreview.value = false;
  setTimeout(() => {
    previewPaste.value = null;
  }, 300);
};

/**
 * 打开编辑弹窗
 * @param {Object} paste - 要编辑的文本分享对象
 */
const openEditModal = async (paste) => {
  // 清空之前的消息
  error.value = "";
  successMessage.value = "";

  try {
    // 根据用户权限获取完整的分享内容
    let fullPaste;

    if (isAdmin.value) {
      // 管理员获取分享内容
      const result = await api.admin.getPasteById(paste.id);
      fullPaste = result.data;
    } else if (isApiKeyUser.value) {
      // API密钥用户获取分享内容
      const result = await api.user.paste.getPasteById(paste.id);
      fullPaste = result.data;
    } else {
      throw new Error("无权限执行此操作");
    }

    // 设置编辑状态
    editingPaste.value = fullPaste;
    showEdit.value = true;
  } catch (err) {
    console.error("获取分享详情失败:", err);
    error.value = err.message || "获取分享详情失败，请重试";
  }
};

/**
 * 提交分享编辑
 * @param {Object} editedPaste - 编辑后的文本分享对象
 */
const submitEdit = async (editedPaste) => {
  // 清空之前的消息
  error.value = "";
  successMessage.value = "";

  try {
    // 确保我们有slug
    if (!editedPaste.data || !editedPaste.data.slug) {
      throw new Error("更新失败：缺少必要的文本标识信息");
    }

    let result;
    // 根据用户权限提交编辑
    if (isAdmin.value) {
      // 管理员更新分享
      result = await api.admin.updatePaste(editedPaste.data.slug, editedPaste.data);
    } else if (isApiKeyUser.value) {
      // API密钥用户更新分享
      result = await api.user.paste.updatePaste(editedPaste.data.slug, editedPaste.data);
    } else {
      throw new Error("无权限执行此操作");
    }

    // 关闭编辑弹窗
    showEdit.value = false;
    // 重新加载数据
    loadPastes();

    // 显示成功消息
    successMessage.value = "分享更新成功";
    setTimeout(() => {
      successMessage.value = "";
    }, 5000); // 由于包含链接信息，延长显示时间
  } catch (err) {
    console.error("更新分享失败:", err);
    error.value = err.message || "更新分享失败，请重试";
  }
};

/**
 * 显示二维码弹窗
 * @param {string} slug - 文本分享的唯一标识
 */
const showQRCode = async (slug) => {
  if (!slug) return;

  qrCodeSlug.value = slug;
  showQRCodeModal.value = true;
  qrCodeDataURL.value = ""; // 重置二维码图片

  try {
    // 生成分享链接
    const link = `${window.location.origin}/paste/${slug}`;

    // 使用 qrcode 库生成二维码
    const dataURL = await QRCode.toDataURL(link, {
      width: 240,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });
    qrCodeDataURL.value = dataURL;
  } catch (error) {
    console.error("生成二维码时出错:", error);
    error.value = "生成二维码失败";
  }
};

/**
 * 关闭二维码弹窗
 */
const closeQRCodeModal = () => {
  showQRCodeModal.value = false;
  setTimeout(() => {
    qrCodeDataURL.value = "";
    qrCodeSlug.value = "";
  }, 300);
};

/**
 * 下载二维码图片
 */
const downloadQRCode = () => {
  if (!qrCodeDataURL.value) return;

  // 创建一个临时链接元素来下载图片
  const link = document.createElement("a");
  link.href = qrCodeDataURL.value;
  link.download = `cloudpaste-qrcode-${qrCodeSlug.value}-${new Date().getTime()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * 关闭编辑弹窗
 * 隐藏编辑弹窗并清空编辑数据
 */
const closeEditModal = () => {
  showEdit.value = false;
  setTimeout(() => {
    editingPaste.value = null;
  }, 300);
};

/**
 * 组件挂载时的初始化
 * 检查权限并加载数据
 */
onMounted(() => {
  console.log("TextManagement组件挂载");
  // 检查权限状态
  checkUserPermission();
  console.log("API密钥权限状态检查", {
    isAdmin: isAdmin.value,
    isApiKeyUser: isApiKeyUser.value,
    adminToken: !!localStorage.getItem("admin_token"),
    apiKey: !!localStorage.getItem("api_key"),
    apiKeyPermissions: localStorage.getItem("api_key_permissions"),
  });

  // 加载分享列表
  loadPastes();
});
</script>

<template>
  <div class="p-3 sm:p-4 md:p-5 lg:p-6 flex-1 flex flex-col overflow-y-auto">
    <!-- 顶部操作栏 -->
    <div class="flex flex-col space-y-3 mb-4">
      <!-- 标题和刷新按钮 -->
      <div class="flex justify-between items-center">
        <h2 class="text-lg sm:text-xl font-medium" :class="darkMode ? 'text-white' : 'text-gray-900'">文本管理</h2>

        <!-- 刷新按钮 - 在所有屏幕尺寸显示 -->
        <button
          class="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          @click="loadPastes"
          :disabled="loading"
        >
          <svg xmlns="http://www.w3.org/2000/svg" :class="['h-3 w-3 sm:h-4 sm:w-4 mr-1', loading ? 'animate-spin' : '']" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              v-if="!loading"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
            <circle v-if="loading" class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path
              v-if="loading"
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span class="hidden xs:inline">{{ loading ? "刷新中..." : "刷新" }}</span>
          <span class="xs:hidden">{{ loading ? "..." : "刷" }}</span>
        </button>
      </div>

      <!-- 其他操作按钮行 -->
      <div class="flex flex-wrap gap-1 sm:gap-2">
        <!-- 清理过期按钮 -->
        <button
          class="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 border border-transparent text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 flex-grow sm:flex-grow-0"
          @click="clearExpiredPastes"
          title="系统会自动删除过期内容，但您也可以通过此功能手动立即清理"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 sm:h-4 sm:w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          <span class="hidden xs:inline">清理过期</span>
          <span class="xs:hidden">清理</span>
        </button>

        <!-- 批量删除按钮 -->
        <button
          :disabled="selectedPastes.length === 0"
          :class="[
            'inline-flex items-center px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 border border-transparent text-xs sm:text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 flex-grow sm:flex-grow-0',
            selectedPastes.length === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'text-white bg-red-600 hover:bg-red-700 focus:ring-red-500',
          ]"
          @click="deleteSelectedPastes"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 sm:h-4 sm:w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          <span class="hidden xs:inline">批量删除{{ selectedPastes.length ? `(${selectedPastes.length})` : "" }}</span>
          <span class="xs:hidden">删除{{ selectedPastes.length ? `(${selectedPastes.length})` : "" }}</span>
        </button>
      </div>
    </div>

    <!-- 错误信息提示 -->
    <div
      v-if="error"
      class="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 px-3 sm:px-4 py-2 sm:py-3 rounded mb-3 sm:mb-4 text-sm sm:text-base"
    >
      <p>{{ error }}</p>
    </div>

    <!-- 成功信息提示 -->
    <div
      v-if="successMessage"
      class="bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-300 px-3 sm:px-4 py-2 sm:py-3 rounded mb-3 sm:mb-4 text-sm sm:text-base"
    >
      <p>{{ successMessage }}</p>
    </div>

    <!-- 上次刷新时间显示 -->
    <div class="flex justify-between items-center mb-2 sm:mb-3" v-if="lastRefreshTime">
      <div class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
        <span class="inline-flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 sm:h-4 sm:w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          上次刷新: {{ lastRefreshTime }}
        </span>
      </div>
    </div>

    <!-- 数据展示区域 -->
    <div class="overflow-hidden bg-white dark:bg-gray-800 shadow-md rounded-lg flex-1">
      <div class="flex flex-col h-full">
        <!-- 桌面端表格组件 - 中等及以上设备显示 -->
        <div class="hidden md:block flex-1 overflow-auto">
          <PasteTable
            :dark-mode="darkMode"
            :pastes="pastes"
            :selectedPastes="selectedPastes"
            :loading="loading"
            :copiedTexts="copiedTexts"
            :copiedRawTexts="copiedRawTexts"
            @toggle-select-all="toggleSelectAll"
            @toggle-select-item="toggleSelectItem"
            @view="goToViewPage"
            @copy-link="copyLink"
            @copy-raw-link="copyRawLink"
            @preview="openPreview"
            @edit="openEditModal"
            @delete="deletePaste"
            @show-qrcode="showQRCode"
          />
        </div>

        <!-- 移动端卡片组件 - 小于中等设备显示 -->
        <div class="md:hidden flex-1 overflow-auto">
          <PasteCardList
            :dark-mode="darkMode"
            :pastes="pastes"
            :selectedPastes="selectedPastes"
            :loading="loading"
            :copiedTexts="copiedTexts"
            :copiedRawTexts="copiedRawTexts"
            @toggle-select-item="toggleSelectItem"
            @view="goToViewPage"
            @copy-link="copyLink"
            @copy-raw-link="copyRawLink"
            @preview="openPreview"
            @edit="openEditModal"
            @delete="deletePaste"
            @show-qrcode="showQRCode"
          />
        </div>
      </div>
    </div>

    <!-- 分页组件 -->
    <div class="mt-2 mb-4 sm:mt-4 sm:mb-0">
      <CommonPagination :dark-mode="darkMode" :pagination="pagination" mode="page" @page-changed="goToPage" />
    </div>

    <!-- 预览弹窗组件 -->
    <PastePreviewModal :dark-mode="darkMode" :show-preview="showPreview" :paste="previewPaste" @close="closePreview" @view-paste="goToViewPage" />

    <!-- 修改弹窗组件 -->
    <PasteEditModal :dark-mode="darkMode" :show-edit="showEdit" :paste="editingPaste" @close="closeEditModal" @save="submitEdit" />

    <!-- 二维码弹窗组件 -->
    <div v-if="showQRCodeModal" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black opacity-50" @click="closeQRCodeModal"></div>
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg max-w-md w-full relative z-10">
        <button @click="closeQRCodeModal" class="absolute top-3 right-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h3 class="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">分享二维码</h3>

        <div class="flex flex-col items-center">
          <div v-if="qrCodeDataURL" class="bg-white p-4 rounded-lg mb-4">
            <img :src="qrCodeDataURL" alt="分享二维码" class="w-48 h-48" />
          </div>
          <div v-else class="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg mb-4 w-48 h-48 flex items-center justify-center">
            <span class="text-gray-500 dark:text-gray-400">生成中...</span>
          </div>

          <div class="text-sm text-gray-600 dark:text-gray-300 mb-4 text-center max-w-xs">扫描上方二维码可以访问分享内容</div>

          <button @click="downloadQRCode" class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors" :disabled="!qrCodeDataURL">
            下载二维码
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
