<template>
  <div class="flex justify-between items-center mt-4 px-2">
    <div class="text-sm" :class="darkMode ? 'text-gray-400' : 'text-gray-600'">共 {{ pagination.total }} 个文件</div>

    <div class="flex items-center space-x-2">
      <button
        @click="prevPage"
        :disabled="pagination.offset === 0"
        class="px-3 py-1 rounded text-sm font-medium transition-colors"
        :class="
          darkMode
            ? pagination.offset === 0
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gray-700 hover:bg-gray-600 text-white'
            : pagination.offset === 0
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
        "
      >
        上一页
      </button>

      <span class="text-sm" :class="darkMode ? 'text-gray-400' : 'text-gray-600'">
        {{ currentPage }}
      </span>

      <button
        @click="nextPage"
        :disabled="!pagination.hasMore"
        class="px-3 py-1 rounded text-sm font-medium transition-colors"
        :class="
          darkMode
            ? !pagination.hasMore
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gray-700 hover:bg-gray-600 text-white'
            : !pagination.hasMore
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
        "
      >
        下一页
      </button>
    </div>

    <div class="text-sm" :class="darkMode ? 'text-gray-400' : 'text-gray-600'">每页 {{ pagination.limit }} 条</div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, computed } from "vue";

const props = defineProps({
  pagination: {
    type: Object,
    required: true,
  },
  darkMode: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["page-changed"]);

/**
 * 计算当前页码
 */
const currentPage = computed(() => {
  return Math.floor(props.pagination.offset / props.pagination.limit) + 1;
});

/**
 * 跳转到上一页
 */
const prevPage = () => {
  if (props.pagination.offset === 0) return;

  const newOffset = Math.max(0, props.pagination.offset - props.pagination.limit);
  emit("page-changed", newOffset);
};

/**
 * 跳转到下一页
 */
const nextPage = () => {
  if (!props.pagination.hasMore) return;

  const newOffset = props.pagination.offset + props.pagination.limit;
  emit("page-changed", newOffset);
};
</script>
