<template>
  <div class="video-preview rounded-lg overflow-hidden mb-2 flex justify-center">
    <video controls class="max-w-full max-h-[calc(100vh-350px)]">
      <source :src="previewUrl" :type="mimetype" />
      您的浏览器不支持视频标签
    </video>
  </div>
</template>

<script setup>
defineProps({
  previewUrl: {
    type: String,
    required: true
  },
  mimetype: {
    type: String,
    required: true
  }
});
</script>
