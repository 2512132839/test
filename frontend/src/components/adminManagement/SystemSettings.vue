<script setup>
import { ref, onMounted } from "vue";
import { changePassword, getSystemSettings, updateSystemSettings } from "../../api/adminService";
import { useI18n } from "vue-i18n";

// 使用i18n
const { t } = useI18n();

// 定义props，接收父组件传递的darkMode
const props = defineProps({
  darkMode: {
    type: Boolean,
    required: true,
  },
});

// 定义事件，用于通知父组件需要退出登录
const emit = defineEmits(["logout"]);

// 密码更改表单
const passwordForm = ref({
  currentPassword: "",
  newPassword: "",
  newUsername: "",
});

// 密码更改状态
const passwordChangeStatus = ref({
  loading: false,
  success: false,
  error: "",
});

// 倒计时计数器
const countdown = ref(3);
// 倒计时定时器ID
let countdownTimer = null;

// 系统设置
const systemSettings = ref({
  max_upload_size: 100, // 默认100MB
  max_upload_size_unit: "MB", // 默认单位MB
  webdav_upload_mode: "auto", // 默认自动模式 - 可选值: auto, proxy, multipart
});

// 可选的大小单位
const sizeUnits = ref(["KB", "MB", "GB"]);

// WebDAV上传模式选项
const webdavUploadModes = ref([
  { value: "auto", label: "admin.settings.webdavSettings.modes.auto" },
  { value: "proxy", label: "admin.settings.webdavSettings.modes.proxy" },
  { value: "multipart", label: "admin.settings.webdavSettings.modes.multipart" },
  { value: "direct", label: "admin.settings.webdavSettings.modes.direct" },
]);

// 系统设置更新状态
const systemSettingsStatus = ref({
  loading: false,
  success: false,
  error: "",
});

// 获取系统设置
onMounted(async () => {
  try {
    const response = await getSystemSettings();
    if (response && response.data) {
      // 处理响应数据
      response.data.forEach((setting) => {
        if (setting.key === "max_upload_size") {
          // 解析存储的值
          const value = parseInt(setting.value);
          systemSettings.value.max_upload_size = value;
          // 这里数据库中存储的始终是MB，界面上需要根据用户选择转换
          systemSettings.value.max_upload_size_unit = "MB";
        }
        if (setting.key === "webdav_upload_mode") {
          systemSettings.value.webdav_upload_mode = setting.value;
        }
      });
    }
  } catch (error) {
    console.error("获取系统设置失败:", error);
  }
});

// 将值根据单位转换为MB
const convertToMB = (value, unit) => {
  switch (unit) {
    case "KB":
      return value / 1024;
    case "MB":
      return value;
    case "GB":
      return value * 1024;
    default:
      return value;
  }
};

// 更新系统设置
const handleUpdateSystemSettings = async (event) => {
  event.preventDefault();

  // 验证表单
  if (!systemSettings.value.max_upload_size || systemSettings.value.max_upload_size <= 0) {
    systemSettingsStatus.value.error = t("admin.settings.status.errors.maxUploadSizeError");
    return;
  }

  systemSettingsStatus.value = {
    loading: true,
    success: false,
    error: "",
  };

  try {
    // 将值转换为MB后再发送到后端
    const convertedSize = convertToMB(systemSettings.value.max_upload_size, systemSettings.value.max_upload_size_unit);

    await updateSystemSettings({
      max_upload_size: convertedSize,
      webdav_upload_mode: systemSettings.value.webdav_upload_mode,
    });

    // 更新成功
    systemSettingsStatus.value.success = true;

    // 3秒后清除成功消息
    setTimeout(() => {
      systemSettingsStatus.value.success = false;
    }, 3000);
  } catch (error) {
    systemSettingsStatus.value.error = error.message || t("admin.settings.status.errors.updateSettingsError");
  } finally {
    systemSettingsStatus.value.loading = false;
  }
};

// 更改密码
const handleChangePassword = async (event) => {
  event.preventDefault();

  // 验证表单
  if (!passwordForm.value.currentPassword) {
    passwordChangeStatus.value.error = t("admin.settings.status.errors.currentPasswordRequired");
    // 设置3秒后自动清除错误信息
    setTimeout(() => {
      passwordChangeStatus.value.error = "";
    }, 3000);
    return;
  }

  // 确保新密码或新用户名至少填写一个
  if (!passwordForm.value.newPassword && !passwordForm.value.newUsername) {
    passwordChangeStatus.value.error = t("admin.settings.status.errors.newFieldRequired");
    // 设置3秒后自动清除错误信息
    setTimeout(() => {
      passwordChangeStatus.value.error = "";
    }, 3000);
    return;
  }

  // 如果新密码与当前密码相同，给出提示（虽然后端也会验证，但前端提前验证可以减少无效请求）
  if (passwordForm.value.newPassword && passwordForm.value.newPassword === passwordForm.value.currentPassword) {
    passwordChangeStatus.value.error = t("admin.settings.status.errors.passwordSame") || "新密码不能与当前密码相同";
    // 设置3秒后自动清除错误信息
    setTimeout(() => {
      passwordChangeStatus.value.error = "";
    }, 3000);
    return;
  }

  passwordChangeStatus.value = {
    loading: true,
    success: false,
    error: "",
  };

  try {
    // 调用API修改密码
    await changePassword(passwordForm.value.currentPassword, passwordForm.value.newPassword, passwordForm.value.newUsername);

    // 更新成功
    passwordChangeStatus.value.success = true;
    passwordForm.value = {
      currentPassword: "",
      newPassword: "",
      newUsername: "",
    };

    // 重置倒计时
    countdown.value = 3;

    // 清除之前的倒计时
    if (countdownTimer) {
      clearInterval(countdownTimer);
    }

    // 启动倒计时
    countdownTimer = setInterval(() => {
      countdown.value -= 1;
      if (countdown.value <= 0) {
        clearInterval(countdownTimer);
        passwordChangeStatus.value.success = false;
        // 由于后端会删除所有token，所以自动触发登出
        emit("logout");
      }
    }, 1000);
  } catch (error) {
    // 发生错误时，仅显示错误消息，不执行登出
    passwordChangeStatus.value.error = error.message || t("admin.settings.status.errors.updateInfoError");

    // 3秒后自动清除错误消息
    setTimeout(() => {
      passwordChangeStatus.value.error = "";
    }, 3000);
  } finally {
    passwordChangeStatus.value.loading = false;
  }
};

// 根据图标名称返回SVG路径数据
const getIconPath = (iconName) => {
  switch (iconName) {
    case "key":
      return "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z";
    case "upload":
      return "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12";
    default:
      return "";
  }
};
</script>

<template>
  <!-- 系统设置页面主容器 -->
  <div class="system-settings flex-1 flex flex-col px-6 py-5 max-w-7xl mx-auto w-full">
    <!-- 页面标题和说明 -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold mb-2" :class="darkMode ? 'text-white' : 'text-gray-800'">{{ $t("admin.settings.title") }}</h1>
      <p class="text-base" :class="darkMode ? 'text-gray-300' : 'text-gray-600'">{{ $t("admin.settings.description") }}</p>
    </div>

    <!-- 设置卡片容器 - 更紧凑的网格布局 -->
    <div class="settings-grid grid md:grid-cols-2 gap-5 mb-8">
      <!-- 上传限制设置面板 - 更小更紧凑的卡片 -->
      <div
        class="setting-card flex flex-col rounded-md overflow-hidden transition-all duration-200 shadow-sm border"
        :class="darkMode ? 'bg-gray-800 border-gray-700 hover:shadow-sm' : 'bg-white border-gray-200 hover:shadow-sm'"
      >
        <!-- 卡片标题栏 - 更紧凑 -->
        <div class="card-header px-4 py-3 border-b transition-colors duration-200" :class="darkMode ? 'border-gray-700 bg-gray-800/70' : 'border-gray-100 bg-gray-50/50'">
          <div class="flex items-center">
            <div class="icon-wrapper p-1.5 rounded-md mr-3" :class="darkMode ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-500/10 text-blue-600'">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="getIconPath('upload')" />
              </svg>
            </div>
            <div>
              <h3 class="text-base font-medium" :class="darkMode ? 'text-gray-100' : 'text-gray-800'">{{ $t("admin.settings.uploadSettings.title") }}</h3>
              <p class="text-xs mt-0.5" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ $t("admin.settings.uploadSettings.description") }}</p>
            </div>
          </div>
        </div>

        <!-- 卡片内容区 - 更紧凑 -->
        <div class="card-body p-4 flex-grow">
          <!-- 成功消息 - 更扁平 -->
          <transition name="fade">
            <div
              v-if="systemSettingsStatus.success"
              class="mb-3 rounded-md p-2 border transition-colors duration-200"
              :class="darkMode ? 'bg-green-900/20 border-green-800/40 text-green-200' : 'bg-green-50 border-green-200 text-green-800'"
            >
              <div class="flex items-center">
                <svg class="h-4 w-4 mr-2 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clip-rule="evenodd"
                  />
                </svg>
                <p class="text-sm font-medium">{{ $t("admin.settings.status.success") }}</p>
              </div>
            </div>
          </transition>

          <!-- 错误消息 - 更扁平 -->
          <transition name="fade">
            <div
              v-if="systemSettingsStatus.error"
              class="mb-3 rounded-md p-2 border transition-colors duration-200"
              :class="darkMode ? 'bg-red-900/20 border-red-800/40 text-red-200' : 'bg-red-50 border-red-200 text-red-800'"
            >
              <div class="flex items-center">
                <svg class="h-4 w-4 mr-2 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clip-rule="evenodd"
                  />
                </svg>
                <p class="text-sm font-medium">{{ systemSettingsStatus.error }}</p>
              </div>
            </div>
          </transition>

          <!-- 上传限制表单 - 更扁平的输入框 -->
          <form @submit="handleUpdateSystemSettings">
            <div class="mb-4">
              <label for="maxUploadSize" class="block text-sm font-medium mb-1" :class="darkMode ? 'text-gray-200' : 'text-gray-700'">
                {{ $t("admin.settings.uploadSettings.maxUploadSizeLabel") }}
                <span class="text-red-500 ml-0.5">*</span>
              </label>
              <div class="mt-1 relative">
                <div class="flex">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    name="maxUploadSize"
                    id="maxUploadSize"
                    v-model.number="systemSettings.max_upload_size"
                    required
                    class="block w-full rounded-l border shadow-sm transition-colors duration-200 focus:ring-1 focus:ring-offset-0 focus:border-transparent px-3 py-2"
                    :class="
                      darkMode
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-primary-500/70'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-primary-500/60'
                    "
                    :placeholder="$t('admin.settings.uploadSettings.maxUploadSizePlaceholder')"
                  />
                  <select
                    v-model="systemSettings.max_upload_size_unit"
                    class="inline-flex items-center border border-l-0 px-3 text-sm rounded-r"
                    :class="darkMode ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-50 border-gray-300 text-gray-500'"
                  >
                    <option v-for="unit in sizeUnits" :key="unit" :value="unit">
                      {{ $t(`admin.settings.uploadSettings.unit${unit}`) }}
                    </option>
                  </select>
                </div>
              </div>
              <p class="mt-1.5 text-xs" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ $t("admin.settings.uploadSettings.maxUploadSizeHint") }}</p>
            </div>

            <!-- WebDAV上传模式设置 -->
            <div class="mb-4">
              <label for="webdavUploadMode" class="block text-sm font-medium mb-1" :class="darkMode ? 'text-gray-200' : 'text-gray-700'">
                {{ $t("admin.settings.webdavSettings.uploadModeLabel") }}
              </label>
              <div class="mt-1 relative">
                <select
                  id="webdavUploadMode"
                  v-model="systemSettings.webdav_upload_mode"
                  class="block w-full rounded border shadow-sm transition-colors duration-200 focus:ring-1 focus:ring-offset-0 focus:border-transparent px-3 py-2"
                  :class="darkMode ? 'bg-gray-700 border-gray-600 text-white focus:ring-primary-500/70' : 'bg-white border-gray-300 text-gray-900 focus:ring-primary-500/60'"
                >
                  <option v-for="mode in webdavUploadModes" :key="mode.value" :value="mode.value">
                    {{ $t(mode.label) }}
                  </option>
                </select>
              </div>
              <p class="mt-1.5 text-xs" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ $t("admin.settings.webdavSettings.uploadModeHint") }}</p>
            </div>

            <div class="form-footer mt-4 flex justify-end">
              <button
                type="submit"
                :disabled="systemSettingsStatus.loading"
                class="inline-flex items-center justify-center rounded border border-transparent shadow-sm transition duration-150 ease-in-out px-4 py-1.5 text-sm font-medium"
                :class="[
                  systemSettingsStatus.loading
                    ? 'bg-primary-400 cursor-not-allowed text-white'
                    : 'bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:ring-offset-1 text-white',
                ]"
              >
                <span v-if="systemSettingsStatus.loading" class="flex items-center">
                  <svg class="animate-spin -ml-0.5 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {{ $t("admin.settings.status.processing") }}
                </span>
                <span v-else class="flex items-center">
                  <svg class="mr-1.5 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  {{ $t("admin.settings.status.updateSettings") }}
                </span>
              </button>
            </div>
          </form>
        </div>

        <!-- 卡片底部提示信息 - 更简洁 -->
        <div
          class="card-footer px-4 py-2 bg-opacity-50 border-t text-xs transition-colors duration-200"
          :class="darkMode ? 'bg-gray-700/50 border-gray-700 text-gray-400' : 'bg-gray-50/50 border-gray-100 text-gray-500'"
        >
          <div class="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>{{ $t("admin.settings.uploadSettings.footerHint") }}</p>
          </div>
        </div>
      </div>

      <!-- 管理员信息修改面板 - 更小更紧凑的卡片 -->
      <div
        class="setting-card flex flex-col rounded-md overflow-hidden transition-all duration-200 shadow-sm border"
        :class="darkMode ? 'bg-gray-800 border-gray-700 hover:shadow-sm' : 'bg-white border-gray-200 hover:shadow-sm'"
      >
        <!-- 卡片标题栏 - 更紧凑 -->
        <div class="card-header px-4 py-3 border-b transition-colors duration-200" :class="darkMode ? 'border-gray-700 bg-gray-800/70' : 'border-gray-100 bg-gray-50/50'">
          <div class="flex items-center">
            <div class="icon-wrapper p-1.5 rounded-md mr-3" :class="darkMode ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-500/10 text-purple-600'">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="getIconPath('key')" />
              </svg>
            </div>
            <div>
              <h3 class="text-base font-medium" :class="darkMode ? 'text-gray-100' : 'text-gray-800'">{{ $t("admin.settings.adminSettings.title") }}</h3>
              <p class="text-xs mt-0.5" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ $t("admin.settings.adminSettings.description") }}</p>
            </div>
          </div>
        </div>

        <!-- 卡片内容区 - 更紧凑 -->
        <div class="card-body p-4 flex-grow">
          <!-- 成功消息 - 更扁平 -->
          <transition name="fade">
            <div
              v-if="passwordChangeStatus.success"
              class="mb-3 rounded-md p-2 border transition-colors duration-200"
              :class="darkMode ? 'bg-green-900/20 border-green-800/40 text-green-200' : 'bg-green-50 border-green-200 text-green-800'"
            >
              <div class="flex items-center">
                <svg class="h-4 w-4 mr-2 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clip-rule="evenodd"
                  />
                </svg>
                <p class="text-sm font-medium">
                  {{ $t("admin.settings.status.adminUpdateSuccess") }}
                  <span
                    class="ml-1 inline-flex items-center justify-center bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 rounded-full h-5 w-5 text-xs font-bold"
                    >{{ countdown }}</span
                  >
                </p>
              </div>
            </div>
          </transition>

          <!-- 错误消息 - 更扁平 -->
          <transition name="fade">
            <div
              v-if="passwordChangeStatus.error"
              class="mb-3 rounded-md p-2 border transition-colors duration-200"
              :class="darkMode ? 'bg-red-900/20 border-red-800/40 text-red-200' : 'bg-red-50 border-red-200 text-red-800'"
            >
              <div class="flex items-center">
                <svg class="h-4 w-4 mr-2 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clip-rule="evenodd"
                  />
                </svg>
                <p class="text-sm font-medium">{{ passwordChangeStatus.error }}</p>
              </div>
            </div>
          </transition>

          <!-- 管理员信息表单 - 更扁平的输入框 -->
          <form @submit="handleChangePassword">
            <!-- 新用户名 -->
            <div class="mb-3">
              <label for="newUsername" class="block text-sm font-medium mb-1" :class="darkMode ? 'text-gray-200' : 'text-gray-700'">
                {{ $t("admin.settings.adminSettings.newUsernameLabel") }}
              </label>
              <div class="relative">
                <input
                  type="text"
                  name="newUsername"
                  id="newUsername"
                  v-model="passwordForm.newUsername"
                  class="block w-full rounded border shadow-sm transition-colors duration-200 focus:ring-1 focus:ring-offset-0 focus:border-transparent pl-3 pr-10 py-2"
                  :class="
                    darkMode
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-primary-500/70'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-primary-500/60'
                  "
                  :placeholder="$t('admin.settings.adminSettings.newUsernamePlaceholder')"
                />
                <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg
                    class="h-5 w-5 transition-colors duration-200"
                    :class="darkMode ? 'text-gray-500' : 'text-gray-400'"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
              <p class="mt-1 text-xs" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ $t("admin.settings.adminSettings.newUsernameHint") }}</p>
            </div>

            <!-- 当前密码 -->
            <div class="mb-3">
              <label for="currentPassword" class="block text-sm font-medium mb-1" :class="darkMode ? 'text-gray-200' : 'text-gray-700'">
                {{ $t("admin.settings.adminSettings.currentPasswordLabel") }}
                <span class="text-red-500 ml-0.5">*</span>
              </label>
              <div class="relative">
                <input
                  type="password"
                  name="currentPassword"
                  id="currentPassword"
                  v-model="passwordForm.currentPassword"
                  required
                  class="block w-full rounded border shadow-sm transition-colors duration-200 focus:ring-1 focus:ring-offset-0 focus:border-transparent pl-3 pr-10 py-2"
                  :class="
                    darkMode
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-primary-500/70'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-primary-500/60'
                  "
                  :placeholder="$t('admin.settings.adminSettings.currentPasswordPlaceholder')"
                />
                <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg
                    class="h-5 w-5 transition-colors duration-200"
                    :class="darkMode ? 'text-gray-500' : 'text-gray-400'"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                </div>
              </div>
              <p class="mt-1 text-xs" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ $t("admin.settings.adminSettings.currentPasswordHint") }}</p>
            </div>

            <!-- 新密码 -->
            <div class="mb-3">
              <label for="newPassword" class="block text-sm font-medium mb-1" :class="darkMode ? 'text-gray-200' : 'text-gray-700'">
                {{ $t("admin.settings.adminSettings.newPasswordLabel") }}
              </label>
              <div class="relative">
                <input
                  type="password"
                  name="newPassword"
                  id="newPassword"
                  v-model="passwordForm.newPassword"
                  class="block w-full rounded border shadow-sm transition-colors duration-200 focus:ring-1 focus:ring-offset-0 focus:border-transparent pl-3 pr-10 py-2"
                  :class="
                    darkMode
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-primary-500/70'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-primary-500/60'
                  "
                  :placeholder="$t('admin.settings.adminSettings.newPasswordPlaceholder')"
                />
                <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg
                    class="h-5 w-5 transition-colors duration-200"
                    :class="darkMode ? 'text-gray-500' : 'text-gray-400'"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
              </div>
              <p class="mt-1 text-xs" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ $t("admin.settings.adminSettings.newPasswordHint") }}</p>
            </div>

            <!-- 表单按钮 -->
            <div class="form-footer mt-4 flex justify-end">
              <button
                type="submit"
                :disabled="passwordChangeStatus.loading"
                class="inline-flex items-center justify-center rounded border border-transparent shadow-sm transition duration-150 ease-in-out px-4 py-1.5 text-sm font-medium"
                :class="[
                  passwordChangeStatus.loading
                    ? 'bg-primary-400 cursor-not-allowed text-white'
                    : 'bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:ring-offset-1 text-white',
                ]"
              >
                <span v-if="passwordChangeStatus.loading" class="flex items-center">
                  <svg class="animate-spin -ml-0.5 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {{ $t("admin.settings.status.processing") }}
                </span>
                <span v-else class="flex items-center">
                  <svg class="mr-1.5 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  {{ $t("admin.settings.status.updateAccount") }}
                </span>
              </button>
            </div>
          </form>
        </div>

        <!-- 卡片底部提示信息 - 更简洁 -->
        <div
          class="card-footer px-4 py-2 bg-opacity-50 border-t text-xs transition-colors duration-200"
          :class="darkMode ? 'bg-gray-700/50 border-gray-700 text-gray-400' : 'bg-gray-50/50 border-gray-100 text-gray-500'"
        >
          <div class="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 mr-1 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p>{{ $t("admin.settings.adminSettings.footerHint") }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 淡入淡出动画效果 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* 设置卡片悬停效果 */
.setting-card {
  transition: all 0.15s ease-in-out;
}

/* 输入框获取焦点时的动效 - 更轻微的效果 */
input:focus,
select:focus {
  box-shadow: 0 0 0 1px rgba(var(--color-primary-500), 0.2);
  transform: translateY(-1px);
  transition: all 0.15s ease;
}

/* 按钮hover效果 - 更轻微的效果 */
button:not(:disabled):hover {
  transform: translateY(-1px);
  transition: all 0.15s ease;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
</style>
