<template>
  <div class="video-preview rounded-lg overflow-hidden mb-2 flex justify-center">
    <video controls class="max-w-full max-h-[calc(100vh-350px)]" @loadeddata="handleLoad" @error="handleError">
      <source :src="previewUrl" :type="mimetype" />
      {{ t("fileView.preview.video.notSupported") }}
    </video>
  </div>
</template>

<script setup>
import { useI18n } from "vue-i18n";

const { t } = useI18n();

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
