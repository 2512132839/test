<template>
  <div class="video-preview rounded-lg overflow-hidden mb-2 flex justify-center">
    <video controls class="max-w-full max-h-[calc(100vh-350px)]" @loadeddata="handleLoad" @error="handleError">
      <source :src="previewUrl" :type="mimetype" />
      您的浏览器不支持视频标签
    </video>
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
