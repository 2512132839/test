<template>
  <div class="pdf-preview rounded-lg overflow-hidden mb-2 flex-grow w-full relative">
    <iframe :src="previewUrl" frameborder="0" class="w-full h-[calc(100vh-350px)] min-h-[300px]" @load="handleLoad" v-show="!loading"></iframe>
    <!-- PDF加载状态 -->
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg">
      <div class="text-center">
        <svg class="animate-spin h-8 w-8 text-blue-500 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 0 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <p class="text-blue-600 dark:text-blue-400">加载PDF中...</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

defineProps({
  previewUrl: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(["load"]);

const loading = ref(true);

const handleLoad = () => {
  loading.value = false;
  emit("load");
};
</script>
