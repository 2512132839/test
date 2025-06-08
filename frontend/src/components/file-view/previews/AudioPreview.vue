<template>
  <div class="audio-preview rounded-lg p-4 mb-2 bg-gray-100 dark:bg-gray-700 w-full">
    <audio controls class="w-full" @loadeddata="handleLoad" @error="handleError">
      <source :src="previewUrl" :type="mimetype" />
      您的浏览器不支持音频标签
    </audio>
  </div>
</template>

<script setup>
defineProps({
  previewUrl: {
    type: String,
    required: true,
  },
  mimetype: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(["load", "error"]);

const handleLoad = () => {
  emit("load");
};

const handleError = () => {
  emit("error");
};
</script>
