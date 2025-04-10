<script setup>
import { ref, reactive, computed } from "vue";
import { login } from "../../api/adminService";
import { useI18n } from "vue-i18n";
import { ApiStatus } from "../../api/ApiStatus";

const props = defineProps({
  darkMode: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(["login-success"]);
const { t } = useI18n();

const loading = ref(false);
const error = ref("");
const isApiKeyMode = ref(false);

const form = reactive({
  username: "",
  password: "",
});

const apiKeyForm = reactive({
  apiKey: "",
});

const toggleLoginMode = () => {
  isApiKeyMode.value = !isApiKeyMode.value;
  error.value = "";
};

const handleLogin = async () => {
  if (isApiKeyMode.value) {
    return handleApiKeyLogin();
  }

  if (!form.username || !form.password) {
    error.value = t("admin.login.inputRequired.usernamePassword");
    return;
  }

  loading.value = true;
  error.value = "";

  try {
    const result = await login(form.username, form.password);
    const token = result.data?.token;
    if (!token) {
      throw new Error(t("admin.login.errors.invalidToken"));
    }
    // 存储token到localStorage
    localStorage.setItem("admin_token", token);
    emit("login-success", { token });
  } catch (err) {
    // 优先使用HTTP状态码判断错误类型，更可靠
    if (err.status === ApiStatus.UNAUTHORIZED || err.response?.status === ApiStatus.UNAUTHORIZED || err.code === ApiStatus.UNAUTHORIZED) {
      // 401 Unauthorized - 用户名或密码错误
      error.value = t("admin.login.errors.invalidCredentials") || "用户名或密码错误";
    } else {
      // 后备判断：基于错误消息内容判断错误类型（保持兼容性）
      error.value = err.message || t("admin.login.errors.loginFailed");
    }
  } finally {
    loading.value = false;
  }
};

const handleApiKeyLogin = async () => {
  if (!apiKeyForm.apiKey) {
    error.value = t("admin.login.inputRequired.apiKey");
    return;
  }

  loading.value = true;
  error.value = "";

  try {
    // 导入API配置函数和auth-helper
    const { getFullApiUrl } = await import("../../api/config.js");
    const { storeApiKeyInfo } = await import("../../utils/auth-helper.js");

    // 构建验证请求头
    const headers = {
      Authorization: `ApiKey ${apiKeyForm.apiKey}`,
      "Content-Type": "application/json",
    };

    // 使用正确的API路径构建URL
    const apiUrl = getFullApiUrl("test/api-key");

    // 使用fetch直接调用API密钥验证接口
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: headers,
      credentials: "omit", // 由于使用ApiKey Header，不需要cookie认证
    });

    const contentType = response.headers.get("content-type");

    // 检查响应内容类型
    if (!contentType || !contentType.includes("application/json")) {
      // 如果响应不是JSON，先尝试读取文本内容进行错误分析
      const textResponse = await response.text();
      console.error("API响应不是JSON格式:", textResponse.substring(0, 200) + "...");
      throw new Error(t("admin.login.errors.invalidResponse"));
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `${t("admin.login.errors.serverError")}(${response.status})`);
    }

    // 检查响应结构
    if (!data.success) {
      throw new Error(data.message || t("admin.login.errors.keyValidationFailed"));
    }

    if (!data.data || !data.data.permissions) {
      throw new Error(t("admin.login.errors.permissionInfo"));
    }

    // 存储API密钥到localStorage以便后续使用
    localStorage.setItem("api_key", apiKeyForm.apiKey);

    // 存储API密钥的额外信息，包括ID等
    if (data.data.key_info) {
      storeApiKeyInfo(data.data.key_info);
    } else {
      console.warn("API响应中缺少key_info字段，权限验证可能无法正常工作");
    }

    // 发送权限信息到父组件
    emit("login-success", {
      apiKey: apiKeyForm.apiKey,
      permissions: data.data.permissions,
      keyInfo: data.data.key_info,
    });
  } catch (err) {
    console.error("API密钥验证失败:", err);
    // 优先使用HTTP状态码判断错误类型，更可靠
    if (err.status === ApiStatus.UNAUTHORIZED || err.response?.status === ApiStatus.UNAUTHORIZED || err.code === ApiStatus.UNAUTHORIZED) {
      // 401 Unauthorized - API密钥无效
      error.value = t("admin.login.errors.invalidApiKey") || "API密钥无效或未授权";
    } else if (err.status === ApiStatus.FORBIDDEN || err.response?.status === ApiStatus.FORBIDDEN || err.code === ApiStatus.FORBIDDEN) {
      // 403 Forbidden - 权限不足
      error.value = t("admin.login.errors.insufficientPermissions") || "API密钥权限不足";
    } else {
      // 后备判断：基于错误消息内容判断错误类型（保持兼容性）
      error.value = err.message || t("admin.login.errors.keyValidationFailed");
    }
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
    <div class="mx-auto w-full max-w-sm rounded-lg p-6 shadow-md" :class="[darkMode ? 'bg-gray-800 shadow-gray-700/20' : 'bg-white shadow-gray-200/70']">
      <div class="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 class="mt-4 text-center text-2xl font-bold leading-9 tracking-tight" :class="darkMode ? 'text-white' : 'text-gray-900'">
          {{ isApiKeyMode ? $t("admin.login.apiKeyAuth") : $t("admin.login.adminLogin") }}
        </h2>
      </div>

      <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-sm">
        <form v-if="isApiKeyMode" class="space-y-6" @submit.prevent="handleLogin">
          <div>
            <label for="apiKey" class="block text-sm font-medium leading-6" :class="darkMode ? 'text-gray-200' : 'text-gray-900'">{{ $t("admin.login.apiKey") }}</label>
            <div class="mt-2">
              <input
                id="apiKey"
                v-model="apiKeyForm.apiKey"
                name="apiKey"
                type="text"
                required
                :class="[
                  'block w-full rounded-md border-0 py-1.5 shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6',
                  darkMode ? 'bg-gray-700 text-white ring-gray-600 focus:ring-primary-500' : 'text-gray-900 ring-gray-300 focus:ring-primary-600',
                ]"
              />
            </div>
          </div>

          <div v-if="error" class="rounded-md p-4" :class="darkMode ? 'bg-red-900/30' : 'bg-red-50'">
            <div class="flex">
              <div class="text-sm" :class="darkMode ? 'text-red-200' : 'text-red-700'">
                {{ error }}
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              :disabled="loading"
              :class="[
                'flex w-full justify-center rounded-md px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-primary-500',
                darkMode ? 'bg-primary-600 focus-visible:outline-primary-500' : 'bg-primary-600 focus-visible:outline-primary-600',
              ]"
            >
              <span v-if="loading">{{ t("common.loading") }}</span>
              <span v-else>{{ t("common.confirm") }}</span>
            </button>
          </div>
        </form>

        <form v-else class="space-y-6" @submit.prevent="handleLogin">
          <div>
            <label for="username" class="block text-sm font-medium leading-6" :class="darkMode ? 'text-gray-200' : 'text-gray-900'">{{ $t("admin.login.username") }}</label>
            <div class="mt-2">
              <input
                id="username"
                v-model="form.username"
                name="username"
                type="text"
                required
                :class="[
                  'block w-full rounded-md border-0 py-1.5 shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6',
                  darkMode ? 'bg-gray-700 text-white ring-gray-600 focus:ring-primary-500' : 'text-gray-900 ring-gray-300 focus:ring-primary-600',
                ]"
              />
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between">
              <label for="password" class="block text-sm font-medium leading-6" :class="darkMode ? 'text-gray-200' : 'text-gray-900'">{{ $t("admin.login.password") }}</label>
            </div>
            <div class="mt-2">
              <input
                id="password"
                v-model="form.password"
                name="password"
                type="password"
                required
                :class="[
                  'block w-full rounded-md border-0 py-1.5 shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6',
                  darkMode ? 'bg-gray-700 text-white ring-gray-600 focus:ring-primary-500' : 'text-gray-900 ring-gray-300 focus:ring-primary-600',
                ]"
              />
            </div>
          </div>

          <div v-if="error" class="rounded-md p-4" :class="darkMode ? 'bg-red-900/30' : 'bg-red-50'">
            <div class="flex">
              <div class="text-sm" :class="darkMode ? 'text-red-200' : 'text-red-700'">
                {{ error }}
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              :disabled="loading"
              :class="[
                'flex w-full justify-center rounded-md px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-primary-500',
                darkMode ? 'bg-primary-600 focus-visible:outline-primary-500' : 'bg-primary-600 focus-visible:outline-primary-600',
              ]"
            >
              <span v-if="loading">{{ $t("admin.login.loggingIn") }}</span>
              <span v-else>{{ $t("admin.login.loginButton") }}</span>
            </button>
          </div>
        </form>

        <div class="mt-6 text-center">
          <button
            @click="toggleLoginMode"
            class="text-sm transition-colors duration-200"
            :class="darkMode ? 'text-primary-400 hover:text-primary-300' : 'text-primary-600 hover:text-primary-500'"
          >
            {{ isApiKeyMode ? $t("admin.login.useAdminAccount") : $t("admin.login.useApiKey") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
