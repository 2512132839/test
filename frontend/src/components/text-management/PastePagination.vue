<script setup>
import { computed } from "vue";
// 分页组件

/**
 * 组件接收的属性定义
 * darkMode: 主题模式
 * pagination: 分页相关数据对象，包含当前页码、每页数量、总记录数、总页数等信息
 */
const props = defineProps({
  darkMode: {
    type: Boolean,
    required: true,
  },
  pagination: {
    type: Object,
    required: true,
  },
});

/**
 * 定义组件要触发的事件
 * go-to-page: 跳转到指定页面的事件
 */
const emit = defineEmits(["go-to-page"]);

/**
 * 计算当前显示范围
 * 根据当前页码、每页数量和总记录数计算当前显示的记录范围
 * @returns {Object} 包含起始位置和结束位置的对象
 */
const displayRange = computed(() => {
  const { page, limit, total } = props.pagination;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  return { start, end };
});
</script>

<template>
  <!-- 分页组件 - 仅在有多页数据时显示 -->
  <div class="mt-2 sm:mt-4 flex flex-col sm:flex-row items-center justify-between" v-if="pagination.totalPages > 0">
    <!-- 移动端简化分页控件 -->
    <div class="w-full flex justify-between items-center mb-2 sm:mb-3 sm:hidden">
      <!-- 上一页按钮 -->
      <button
        @click="$emit('go-to-page', pagination.page - 1)"
        :disabled="pagination.page <= 1"
        :class="[
          pagination.page <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-700',
          'flex-grow flex justify-center items-center px-2 py-1.5 xs:px-3 xs:py-2 border border-gray-300 dark:border-gray-600 text-xs xs:text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 mr-1 xs:mr-2',
        ]"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 xs:h-5 xs:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        <span class="ml-1">上一页</span>
      </button>

      <!-- 当前页码/总页数显示 -->
      <span class="text-xs xs:text-sm text-gray-700 dark:text-gray-300 mx-1 xs:mx-2 whitespace-nowrap"> {{ pagination.page }}/{{ pagination.totalPages }} </span>

      <!-- 下一页按钮 -->
      <button
        @click="$emit('go-to-page', pagination.page + 1)"
        :disabled="pagination.page >= pagination.totalPages"
        :class="[
          pagination.page >= pagination.totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-700',
          'flex-grow flex justify-center items-center px-2 py-1.5 xs:px-3 xs:py-2 border border-gray-300 dark:border-gray-600 text-xs xs:text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 ml-1 xs:ml-2',
        ]"
      >
        <span class="mr-1">下一页</span>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 xs:h-5 xs:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <!-- 桌面端完整分页控件 -->
    <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
      <!-- 显示范围信息 -->
      <div>
        <p class="text-xs md:text-sm text-gray-700 dark:text-gray-300">
          显示第
          <span class="font-medium">{{ displayRange.start }}</span>
          至
          <span class="font-medium">{{ displayRange.end }}</span>
          条，共
          <span class="font-medium">{{ pagination.total }}</span>
          条
        </p>
      </div>

      <!-- 分页按钮组 -->
      <div>
        <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
          <!-- 第一页按钮 -->
          <button
            @click="$emit('go-to-page', 1)"
            :disabled="pagination.page <= 1"
            :class="[
              pagination.page <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-700',
              'relative inline-flex items-center px-1 py-1 md:px-2 md:py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs md:text-sm font-medium text-gray-500 dark:text-gray-300',
            ]"
          >
            <span class="sr-only">第一页</span>
            <svg class="h-4 w-4 md:h-5 md:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>

          <!-- 上一页按钮 -->
          <button
            @click="$emit('go-to-page', pagination.page - 1)"
            :disabled="pagination.page <= 1"
            :class="[
              pagination.page <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-700',
              'relative inline-flex items-center px-1 py-1 md:px-2 md:py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs md:text-sm font-medium text-gray-500 dark:text-gray-300',
            ]"
          >
            <span class="sr-only">上一页</span>
            <svg class="h-4 w-4 md:h-5 md:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <!-- 页码按钮 - 动态生成 -->
          <template v-for="pageNum in pagination.totalPages">
            <!-- 页码按钮 - 显示首尾页和当前页附近的页码 -->
            <button
              v-if="pageNum === 1 || pageNum === pagination.totalPages || (pageNum >= pagination.page - 1 && pageNum <= pagination.page + 1)"
              :key="pageNum"
              @click="$emit('go-to-page', pageNum)"
              :class="[
                'relative inline-flex items-center px-2 py-1 md:px-4 md:py-2 border text-xs md:text-sm font-medium',
                pageNum === pagination.page
                  ? 'z-10 bg-primary-50 dark:bg-primary-900 border-primary-500 dark:border-primary-500 text-primary-600 dark:text-primary-200'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700',
              ]"
            >
              {{ pageNum }}
            </button>

            <!-- 省略号 - 当页码较多时显示 -->
            <span
              v-else-if="(pageNum === 2 && pagination.page > 3) || (pageNum === pagination.totalPages - 1 && pagination.page < pagination.totalPages - 2)"
              :key="`ellipsis-${pageNum}`"
              class="relative inline-flex items-center px-2 py-1 md:px-4 md:py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              ...
            </span>
          </template>

          <!-- 下一页按钮 -->
          <button
            @click="$emit('go-to-page', pagination.page + 1)"
            :disabled="pagination.page >= pagination.totalPages"
            :class="[
              pagination.page >= pagination.totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-700',
              'relative inline-flex items-center px-1 py-1 md:px-2 md:py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs md:text-sm font-medium text-gray-500 dark:text-gray-300',
            ]"
          >
            <span class="sr-only">下一页</span>
            <svg class="h-4 w-4 md:h-5 md:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <!-- 最后一页按钮 -->
          <button
            @click="$emit('go-to-page', pagination.totalPages)"
            :disabled="pagination.page >= pagination.totalPages"
            :class="[
              pagination.page >= pagination.totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-700',
              'relative inline-flex items-center px-1 py-1 md:px-2 md:py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs md:text-sm font-medium text-gray-500 dark:text-gray-300',
            ]"
          >
            <span class="sr-only">最后一页</span>
            <svg class="h-4 w-4 md:h-5 md:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </nav>
      </div>
    </div>
  </div>
</template>
