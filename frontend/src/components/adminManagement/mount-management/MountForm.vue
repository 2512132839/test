<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { createAdminMount, updateAdminMount, createUserMount, updateUserMount } from "../../../api/mountService";
import { getAllS3Configs as getS3ConfigsList } from "../../../api/adminService";
import { useI18n } from "vue-i18n";

// 初始化 i18n
const { t } = useI18n();

const props = defineProps({
  darkMode: {
    type: Boolean,
    required: true,
  },
  // 当前编辑的挂载点，如果为null则是新建
  mount: {
    type: Object,
    default: null,
  },
  // 用户类型，'admin'或'apikey'
  userType: {
    type: String,
    default: "admin",
    validator: (value) => ["admin", "apikey"].includes(value),
  },
});

const emit = defineEmits(["close", "save-success"]);

// S3配置列表
const s3Configs = ref([]);
// 表单数据
const formData = ref({
  name: "",
  storage_type: "S3", // 默认存储类型为S3
  storage_config_id: "",
  mount_path: "",
  remark: "",
  is_active: true,
  sort_order: 0,
  cache_ttl: 300, // 默认缓存时间5分钟
});
// 表单验证错误
const errors = ref({});
// 加载状态
const loading = ref(false);
// 提交状态
const submitting = ref(false);
// 表单是否已尝试提交（用于控制错误显示）
const formSubmitted = ref(false);
// 全局错误消息
const globalError = ref("");

// 是否为编辑模式
const isEditMode = computed(() => {
  return !!props.mount;
});

// 表单标题
const formTitle = computed(() => {
  return isEditMode.value ? t("admin.mount.editMount") : t("admin.mount.createMount");
});

// 存储类型选项
const storageTypeOptions = [
  { value: "S3", label: "S3存储" },
  // { value: "WebDAV", label: "WebDAV" },
  // { value: "FTP", label: "FTP" },
  // { value: "SMB", label: "SMB/CIFS" },
];

// 判断用户类型
const isAdmin = computed(() => props.userType === "admin");
const isApiKeyUser = computed(() => props.userType === "apikey");

// 监听存储类型变化，根据类型重置相关字段
const handleStorageTypeChange = () => {
  // 如果切换类型，清空存储配置ID
  formData.value.storage_config_id = "";
  // 如果表单已提交过，验证该字段
  if (formSubmitted.value) {
    validateField("storage_type");
  }
};

// 验证单个字段
const validateField = (fieldName) => {
  const newErrors = { ...errors.value };

  switch (fieldName) {
    case "name":
      if (!formData.value.name.trim()) {
        newErrors.name = t("admin.mount.validation.nameRequired");
      } else if (formData.value.name.trim().length > 50) {
        newErrors.name = t("admin.mount.validation.nameLength");
      } else {
        delete newErrors.name;
      }
      break;

    case "storage_type":
      if (!formData.value.storage_type) {
        newErrors.storage_type = t("admin.mount.validation.storageTypeRequired");
      } else {
        delete newErrors.storage_type;
      }
      break;

    case "storage_config_id":
      if (formData.value.storage_type === "S3" && !formData.value.storage_config_id) {
        newErrors.storage_config_id = t("admin.mount.validation.s3ConfigRequired");
      } else {
        delete newErrors.storage_config_id;
      }
      break;

    case "mount_path":
      if (!formData.value.mount_path.trim()) {
        newErrors.mount_path = t("admin.mount.validation.mountPathRequired");
      } else if (!formData.value.mount_path.startsWith("/")) {
        newErrors.mount_path = t("admin.mount.validation.mountPathFormat");
      } else {
        // 检查挂载路径格式，只允许字母、数字、下划线、连字符，中文和斜杠
        const validPathRegex = /^\/(?:[A-Za-z0-9_\-\/]|[\u4e00-\u9fa5]|[\u0080-\uFFFF])+$/;
        if (!validPathRegex.test(formData.value.mount_path)) {
          newErrors.mount_path = t("admin.mount.validation.mountPathInvalid");
        } else {
          // 检查不允许的系统路径
          const forbiddenPaths = ["/bin", "/etc", "/lib", "/root", "/sys", "/proc", "/dev"];
          let isForbidden = false;
          for (const path of forbiddenPaths) {
            if (formData.value.mount_path === path || formData.value.mount_path.startsWith(`${path}/`)) {
              newErrors.mount_path = t("admin.mount.validation.mountPathSystemReserved");
              isForbidden = true;
              break;
            }
          }
          if (!isForbidden) {
            delete newErrors.mount_path;
          }
        }
      }
      break;

    case "cache_ttl":
      const cacheTtl = Number(formData.value.cache_ttl);
      if (formData.value.cache_ttl !== null) {
        if (!Number.isInteger(cacheTtl)) {
          newErrors.cache_ttl = t("admin.mount.validation.cacheTTLInteger");
        } else if (cacheTtl < 0) {
          newErrors.cache_ttl = t("admin.mount.validation.cacheTTLNonNegative");
        } else if (cacheTtl > 86400) {
          newErrors.cache_ttl = t("admin.mount.validation.cacheTTLTooLarge");
        } else {
          delete newErrors.cache_ttl;
        }
      } else {
        delete newErrors.cache_ttl;
      }
      break;

    case "sort_order":
      const sortOrder = Number(formData.value.sort_order);
      if (formData.value.sort_order !== null) {
        if (!Number.isInteger(sortOrder)) {
          newErrors.sort_order = t("admin.mount.validation.sortOrderInteger");
        } else {
          delete newErrors.sort_order;
        }
      } else {
        delete newErrors.sort_order;
      }
      break;
  }

  errors.value = newErrors;
  return !newErrors[fieldName];
};

// 验证表单
const validateForm = () => {
  // 验证所有字段
  validateField("name");
  validateField("storage_type");
  validateField("storage_config_id");
  validateField("mount_path");
  validateField("cache_ttl");
  validateField("sort_order");

  // 检查是否有错误
  const hasErrors = Object.keys(errors.value).length > 0;

  // 设置全局错误消息
  if (hasErrors) {
    globalError.value = t("common.required");
  } else {
    globalError.value = "";
  }

  return !hasErrors;
};

// 处理字段变化
const handleFieldChange = (fieldName) => {
  // 如果表单已提交过或该字段有错误，验证该字段
  if (formSubmitted.value || errors.value[fieldName]) {
    validateField(fieldName);
  }
};

// 提交表单
const submitForm = async () => {
  formSubmitted.value = true;

  if (!validateForm()) {
    // 不再关闭弹窗，而是显示错误信息
    return;
  }

  submitting.value = true;
  globalError.value = "";

  try {
    const formPayload = { ...formData.value };

    // 转换数字字段
    formPayload.sort_order = Number(formPayload.sort_order);
    formPayload.cache_ttl = Number(formPayload.cache_ttl);

    let response;

    if (isEditMode.value) {
      // 更新挂载点，根据用户类型选择不同的API函数
      if (isApiKeyUser.value) {
        response = await updateUserMount(props.mount.id, formPayload);
      } else {
        response = await updateAdminMount(props.mount.id, formPayload);
      }
    } else {
      // 创建挂载点，根据用户类型选择不同的API函数
      if (isApiKeyUser.value) {
        response = await createUserMount(formPayload);
      } else {
        response = await createAdminMount(formPayload);
      }
    }

    if (response.code === 200 || response.code === 201) {
      emit("save-success");
    } else {
      // 显示API返回的错误
      globalError.value = response.message || "保存失败";
    }
  } catch (err) {
    console.error("保存挂载点错误:", err);
    // 显示捕获的错误
    globalError.value = err.message || "保存失败";
  } finally {
    submitting.value = false;
  }
};

// 加载S3配置列表
const loadS3Configs = async () => {
  loading.value = true;

  try {
    const response = await getS3ConfigsList();
    if (response.code === 200 && response.data) {
      s3Configs.value = response.data;
    } else {
      // 修改为向父组件通知错误，或者本地处理这个错误
      console.error("加载S3配置失败:", response.message);
    }
  } catch (err) {
    console.error("加载S3配置错误:", err);
  } finally {
    loading.value = false;
  }
};

// 关闭表单
const closeForm = () => {
  emit("close");
};

// 组件挂载时初始化数据
onMounted(async () => {
  // 加载S3配置
  await loadS3Configs();

  // 如果是编辑模式，复制现有数据到表单
  if (isEditMode.value) {
    initializeFormData();
  }

  // 重置表单提交状态
  formSubmitted.value = false;
  globalError.value = "";
});

// 添加watch钩子监视props.mount的变化
watch(
  () => props.mount,
  (newMount) => {
    if (newMount) {
      initializeFormData();
    } else {
      // 如果mount为null，重置表单数据为默认值
      resetFormData();
    }

    // 重置表单提交状态
    formSubmitted.value = false;
    globalError.value = "";
    errors.value = {};
  },
  { deep: true }
);

// 初始化表单数据的函数
const initializeFormData = () => {
  if (!props.mount) return;

  // 复制所有属性
  Object.keys(formData.value).forEach((key) => {
    if (props.mount[key] !== undefined) {
      // 特殊处理布尔值字段，确保它们正确转换
      if (key === "is_active") {
        formData.value[key] = !!props.mount[key]; // 确保是布尔类型
      } else {
        formData.value[key] = props.mount[key];
      }
    }
  });
};

// 重置表单数据为默认值
const resetFormData = () => {
  formData.value = {
    name: "",
    storage_type: "S3", // 默认存储类型为S3
    storage_config_id: "",
    mount_path: "",
    remark: "",
    is_active: true, // 默认启用
    sort_order: 0,
    cache_ttl: 300, // 默认缓存时间5分钟
  };
};
</script>

<template>
  <!-- 模态框背景 -->
  <div class="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black bg-opacity-50 overflow-y-auto" @click.self="closeForm">
    <div class="w-full max-w-lg rounded-lg shadow-xl overflow-hidden transition-colors" :class="darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'" @click.stop>
      <!-- 表单标题 -->
      <div class="px-3 sm:px-6 py-2 sm:py-4 border-b sticky top-0 z-10" :class="darkMode ? 'border-gray-700' : 'border-gray-200'">
        <div class="flex justify-between items-center">
          <h3 class="text-base sm:text-lg font-semibold" id="modal-title">{{ formTitle }}</h3>
          <!-- 添加关闭按钮，方便移动端操作 -->
          <button @click="closeForm" class="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500">
            <span class="sr-only">关闭</span>
            <svg class="h-5 w-5 sm:h-6 sm:w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- 表单内容区域 -->
      <div class="p-3 sm:p-6 space-y-2 sm:space-y-4 max-h-[calc(90vh-120px)] overflow-y-auto">
        <!-- 全局错误提示 -->
        <div v-if="globalError" class="p-2 sm:p-3 rounded-md bg-red-100 border border-red-300 text-red-700 text-sm">
          {{ globalError }}
        </div>

        <!-- 表单内容 -->
        <form @submit.prevent="submitForm" class="space-y-2 sm:space-y-5">
          <!-- 挂载点名称 -->
          <div>
            <label for="name" class="block text-sm font-medium mb-1" :class="darkMode ? 'text-gray-200' : 'text-gray-700'">
              {{ t("admin.mount.form.name") }} <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              v-model="formData.name"
              @input="handleFieldChange('name')"
              @blur="validateField('name')"
              class="block w-full px-3 py-1.5 sm:py-2 rounded-md text-sm transition-colors duration-200"
              :class="[
                darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300 text-gray-900 placeholder-gray-500',
                errors.name ? 'border-red-500' : '',
              ]"
              :placeholder="t('admin.mount.form.namePlaceholder')"
            />
            <p v-if="errors.name" class="mt-1 text-sm text-red-500">{{ errors.name }}</p>
          </div>

          <!-- 存储类型 -->
          <div>
            <label for="storage_type" class="block text-sm font-medium mb-1" :class="darkMode ? 'text-gray-200' : 'text-gray-700'">
              {{ t("admin.mount.form.storageType") }} <span class="text-red-500">*</span>
            </label>
            <select
              id="storage_type"
              v-model="formData.storage_type"
              @change="handleStorageTypeChange"
              @blur="validateField('storage_type')"
              class="block w-full px-3 py-1.5 sm:py-2 rounded-md text-sm transition-colors duration-200"
              :class="[darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300 text-gray-900', errors.storage_type ? 'border-red-500' : '']"
            >
              <option v-for="option in storageTypeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <p v-if="errors.storage_type" class="mt-1 text-sm text-red-500">{{ errors.storage_type }}</p>
          </div>

          <!-- S3配置选择（仅当存储类型为S3时显示） -->
          <div v-if="formData.storage_type === 'S3'">
            <label for="storage_config_id" class="block text-sm font-medium mb-1" :class="darkMode ? 'text-gray-200' : 'text-gray-700'">
              {{ t("admin.mount.form.s3Config") }} <span class="text-red-500">*</span>
            </label>
            <select
              id="storage_config_id"
              v-model="formData.storage_config_id"
              @change="handleFieldChange('storage_config_id')"
              @blur="validateField('storage_config_id')"
              class="block w-full px-3 py-1.5 sm:py-2 rounded-md text-sm transition-colors duration-200"
              :class="[darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300 text-gray-900', errors.storage_config_id ? 'border-red-500' : '']"
              :disabled="loading"
            >
              <option value="">{{ t("admin.mount.form.selectS3Config") }}</option>
              <option v-for="config in s3Configs" :key="config.id" :value="config.id">{{ config.name }} ({{ config.provider_type }})</option>
            </select>
            <p v-if="errors.storage_config_id" class="mt-1 text-sm text-red-500">{{ errors.storage_config_id }}</p>
            <p v-if="s3Configs.length === 0 && !loading" class="mt-1 text-xs" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ t("admin.mount.form.noS3Config") }}</p>
          </div>

          <!-- 挂载路径 -->
          <div>
            <label for="mount_path" class="block text-sm font-medium mb-1" :class="darkMode ? 'text-gray-200' : 'text-gray-700'">
              {{ t("admin.mount.form.mountPath") }} <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="mount_path"
              v-model="formData.mount_path"
              @input="handleFieldChange('mount_path')"
              @blur="validateField('mount_path')"
              class="block w-full px-3 py-1.5 sm:py-2 rounded-md text-sm transition-colors duration-200"
              :class="[
                darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300 text-gray-900 placeholder-gray-500',
                errors.mount_path ? 'border-red-500' : '',
              ]"
              :placeholder="t('admin.mount.form.mountPathPlaceholder')"
            />
            <p v-if="errors.mount_path" class="mt-1 text-sm text-red-500">{{ errors.mount_path }}</p>
            <p class="mt-0.5 text-xs" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ t("admin.mount.form.mountPathHint") }}</p>
          </div>

          <!-- 备注说明 -->
          <div>
            <label for="remark" class="block text-sm font-medium mb-1" :class="darkMode ? 'text-gray-200' : 'text-gray-700'">{{ t("admin.mount.form.remark") }}</label>
            <textarea
              id="remark"
              v-model="formData.remark"
              rows="2"
              class="block w-full px-3 py-1.5 sm:py-2 rounded-md text-sm transition-colors duration-200"
              :class="[darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300 text-gray-900 placeholder-gray-500']"
              :placeholder="t('admin.mount.form.remarkPlaceholder')"
            ></textarea>
          </div>

          <!-- 缓存时间和排序顺序 -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
            <!-- 缓存时间 -->
            <div>
              <label for="cache_ttl" class="block text-sm font-medium mb-1" :class="darkMode ? 'text-gray-200' : 'text-gray-700'">{{ t("admin.mount.form.cacheTTL") }}</label>
              <input
                type="number"
                id="cache_ttl"
                v-model="formData.cache_ttl"
                @input="handleFieldChange('cache_ttl')"
                @blur="validateField('cache_ttl')"
                class="block w-full px-3 py-1.5 sm:py-2 rounded-md text-sm transition-colors duration-200"
                :class="[
                  darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300 text-gray-900 placeholder-gray-500',
                  errors.cache_ttl ? 'border-red-500' : '',
                ]"
                placeholder="默认300秒"
                min="0"
                step="1"
              />
              <p v-if="errors.cache_ttl" class="mt-1 text-sm text-red-500">{{ errors.cache_ttl }}</p>
              <p class="mt-0.5 text-xs" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ t("admin.mount.form.cacheTTLHint") }}</p>
            </div>

            <!-- 排序顺序 -->
            <div>
              <label for="sort_order" class="block text-sm font-medium mb-1" :class="darkMode ? 'text-gray-200' : 'text-gray-700'">{{ t("admin.mount.form.sortOrder") }}</label>
              <input
                type="number"
                id="sort_order"
                v-model="formData.sort_order"
                @input="handleFieldChange('sort_order')"
                @blur="validateField('sort_order')"
                class="block w-full px-3 py-1.5 sm:py-2 rounded-md text-sm transition-colors duration-200"
                :class="[
                  darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300 text-gray-900 placeholder-gray-500',
                  errors.sort_order ? 'border-red-500' : '',
                ]"
                placeholder="0"
                step="1"
              />
              <p v-if="errors.sort_order" class="mt-1 text-sm text-red-500">{{ errors.sort_order }}</p>
              <p class="mt-0.5 text-xs" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ t("admin.mount.form.sortOrderHint") }}</p>
            </div>
          </div>

          <!-- 是否启用 - 优化移动端显示 -->
          <div class="mt-1 sm:mt-2">
            <div class="flex items-center">
              <div class="flex items-center h-5">
                <input
                  id="is_active"
                  type="checkbox"
                  v-model="formData.is_active"
                  class="h-4 w-4 sm:h-5 sm:w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  :class="darkMode ? 'bg-gray-700 border-gray-600' : ''"
                />
              </div>
              <div class="ml-2 sm:ml-3">
                <label for="is_active" class="text-sm font-medium" :class="darkMode ? 'text-gray-200' : 'text-gray-700'">{{ t("admin.mount.form.isActive") }}</label>
                <p class="text-xs" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ t("admin.mount.form.isActiveHint") }}</p>
              </div>
            </div>
          </div>
        </form>
      </div>

      <!-- 操作按钮 - 优化移动端布局 -->
      <div
        class="px-3 sm:px-4 py-2 sm:py-3 border-t transition-colors duration-200 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 space-y-2 space-y-reverse sm:space-y-0"
        :class="darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'"
      >
        <button
          @click="closeForm"
          class="w-full sm:w-auto px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-sm font-medium transition-colors duration-200"
          :class="darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'"
        >
          {{ t("admin.mount.button.cancel") }}
        </button>

        <button
          type="button"
          @click="submitForm"
          :disabled="submitting"
          class="w-full sm:w-auto flex justify-center items-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-sm font-medium transition-colors duration-200 bg-primary-500 hover:bg-primary-600 text-white"
          :class="{ 'opacity-75 cursor-not-allowed': submitting }"
        >
          <svg v-if="submitting" class="animate-spin -ml-1 mr-2 h-3 w-3 sm:h-4 sm:w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ submitting ? t("admin.mount.button.saving") : isEditMode.value ? t("admin.mount.button.save") : t("admin.mount.button.create") }}
        </button>
      </div>
    </div>
  </div>
</template>
