<template>
  <div class="video-player-container" :class="{ 'dark-theme': darkMode }">
    <div ref="artplayerContainer" class="artplayer-container"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from "vue";
import Artplayer from "artplayer";

// Props 定义
const props = defineProps({
  // 视频文件信息
  video: {
    type: Object,
    required: true,
  },
  // 是否为深色模式
  darkMode: {
    type: Boolean,
    default: false,
  },
  // 是否自动播放
  autoplay: {
    type: Boolean,
    default: false,
  },
  // 播放器主题色
  theme: {
    type: String,
    default: "#3b82f6",
  },
  // 播放器模式：'normal', 'mini', 'fullscreen'
  mode: {
    type: String,
    default: "normal",
  },
  // 是否循环播放
  loop: {
    type: Boolean,
    default: false,
  },
  // 音量
  volume: {
    type: Number,
    default: 0.7,
  },
  // 是否静音
  muted: {
    type: Boolean,
    default: false,
  },
  // 播放速度由 Artplayer 内置功能提供，无需额外配置
  // 是否显示字幕
  showSubtitle: {
    type: Boolean,
    default: false,
  },
  // 字幕文件URL
  subtitleUrl: {
    type: String,
    default: "",
  },

  // 自定义控制器数组
  customControls: {
    type: Array,
    default: () => [],
  },
  // 预加载策略
  preload: {
    type: String,
    default: "metadata", // none, metadata, auto
  },
});

// Emits 定义
const emit = defineEmits([
  // 基础播放事件
  "play",
  "pause",
  "ended",
  "timeupdate",
  "loadstart",
  "canplay",
  "error",
  "ready",
  "loaded",

  // 全屏事件
  "fullscreen",
  "fullscreenExit",
  "fullscreenWeb",

  // 音频和进度事件
  "volumechange",
  "seeked",

  // 新增的高级功能事件
  "flip", // 视频翻转事件
  "aspectRatio", // 长宽比变化事件
  "pip", // 画中画事件
  "lock", // 移动端锁定事件
  "screenshot", // 截图事件
  "gesture", // 移动端手势事件
]);

// 响应式数据
const artplayerContainer = ref(null);
const artplayerInstance = ref(null);

// 计算主题色
const getThemeColor = () => {
  if (props.darkMode) {
    return "#8b5cf6"; // 深色模式下使用紫色，与视频文件类型色彩一致
  }
  return props.theme;
};

// 初始化 Artplayer
const initArtplayer = () => {
  if (!artplayerContainer.value || !props.video?.url) return;

  // 销毁现有实例
  if (artplayerInstance.value) {
    artplayerInstance.value.destroy();
    artplayerInstance.value = null;
  }

  // Artplayer 配置 - 使用最简化配置确保兼容性
  const options = {
    container: artplayerContainer.value,
    url: props.video.url,
  };

  // 安全地添加可选配置
  if (props.video.name || props.video.title) {
    options.title = props.video.name || props.video.title || "视频播放";
  }

  if (props.video.poster || props.video.cover) {
    options.poster = props.video.poster || props.video.cover;
  }

  // 基础播放配置
  options.autoplay = props.autoplay;
  options.volume = props.volume;
  options.muted = props.muted;
  options.loop = props.loop;
  options.theme = getThemeColor();
  options.lang = "zh-cn";

  // 功能配置
  options.playbackRate = true;
  options.setting = true;
  options.hotkey = true;
  options.pip = true;
  options.screenshot = true;
  options.miniProgressBar = true;
  options.fullscreen = true;
  options.fullscreenWeb = true;
  options.flip = true;
  options.aspectRatio = true;

  // 移动端优化
  options.autoOrientation = true; // 移动端自动旋转
  options.fastForward = true; // 长按快进功能
  options.lock = true; // 移动端锁定功能

  // 播放体验优化
  options.autoPlayback = true; // 自动记忆播放进度
  options.mutex = true; // 互斥播放（同时只能播放一个）
  options.subtitleOffset = true; // 字幕偏移功能

  // 控制器配置
  options.controls = props.customControls;

  // 只有在需要字幕时才添加 subtitle 选项
  if (props.showSubtitle && props.subtitleUrl) {
    options.subtitle = {
      url: props.subtitleUrl,
      type: "srt",
      encoding: "utf-8",
      escape: true,
    };
  }

  // 添加跨域支持以启用截图功能
  options.moreVideoAttr = {
    crossOrigin: "anonymous",
    preload: "metadata",
  };

  // 根据模式调整配置
  if (props.mode === "mini") {
    options.autoSize = true;
    // mini 模式下隐藏控制栏，通过 CSS 控制
    options.controls = [];
  }

  try {
    // 创建 Artplayer 实例
    artplayerInstance.value = new Artplayer(options);

    // 绑定事件监听器
    bindEvents();

    // 应用主题样式
    applyThemeStyles();

    // 播放速度由 Artplayer 内置功能提供 (options.playbackRate = true)

    emit("ready", artplayerInstance.value);
  } catch (error) {
    console.error("Artplayer 初始化失败:", error);
    emit("error", error);
  }
};

// 绑定事件监听器
const bindEvents = () => {
  if (!artplayerInstance.value) return;

  const art = artplayerInstance.value;

  art.on("play", () => {
    emit("play", {
      video: props.video,
      currentTime: art.currentTime,
      duration: art.duration,
    });
  });

  art.on("pause", () => {
    emit("pause", {
      video: props.video,
      currentTime: art.currentTime,
      duration: art.duration,
    });
  });

  art.on("ended", () => {
    emit("ended", {
      video: props.video,
      currentTime: art.currentTime,
      duration: art.duration,
    });
  });

  art.on("timeupdate", () => {
    emit("timeupdate", {
      currentTime: art.currentTime,
      duration: art.duration,
      percentage: art.duration > 0 ? (art.currentTime / art.duration) * 100 : 0,
    });
  });

  art.on("loadstart", () => {
    emit("loadstart");
  });

  art.on("canplay", () => {
    emit("canplay");
  });

  art.on("error", (error) => {
    console.error("Artplayer 播放错误:", error);
    emit("error", error);
  });

  art.on("fullscreen", (state) => {
    if (state) {
      emit("fullscreen");
    } else {
      emit("fullscreenExit");
    }
  });

  art.on("volumechange", () => {
    emit("volumechange", {
      volume: art.volume,
      muted: art.muted,
    });
  });

  art.on("seeked", () => {
    emit("seeked", {
      currentTime: art.currentTime,
      duration: art.duration,
    });
  });

  // 新增的高级功能事件
  art.on("flip", (flip) => {
    emit("flip", flip);
  });

  art.on("aspectRatio", (ratio) => {
    emit("aspectRatio", ratio);
  });

  art.on("pip", (state) => {
    emit("pip", state);
  });

  art.on("lock", (state) => {
    emit("lock", state);
  });

  art.on("screenshot", (dataUri) => {
    emit("screenshot", dataUri);
  });

  // 移动端手势事件
  art.on("gesture", (event) => {
    emit("gesture", event);
  });

  // 网页全屏事件
  art.on("fullscreenWeb", (state) => {
    emit("fullscreenWeb", state);
  });
};

// 应用主题样式
const applyThemeStyles = () => {
  if (!artplayerContainer.value) return;

  nextTick(() => {
    const artplayerElement = artplayerContainer.value.querySelector(".art-video-player");
    if (!artplayerElement) return;

    // 更新主题色
    const themeColor = getThemeColor();
    artplayerElement.style.setProperty("--art-theme", themeColor);

    // 应用暗色主题类
    if (props.darkMode) {
      artplayerContainer.value.classList.add("dark-theme");
    } else {
      artplayerContainer.value.classList.remove("dark-theme");
    }
  });
};

// 公开的方法
const play = () => {
  if (artplayerInstance.value) {
    artplayerInstance.value.play();
  }
};

const pause = () => {
  if (artplayerInstance.value) {
    artplayerInstance.value.pause();
  }
};

const toggle = () => {
  if (artplayerInstance.value) {
    artplayerInstance.value.toggle();
  }
};

const seek = (time) => {
  if (artplayerInstance.value) {
    artplayerInstance.value.seek = time;
  }
};

const setVolume = (volume) => {
  if (artplayerInstance.value) {
    artplayerInstance.value.volume = volume;
  }
};

const setMuted = (muted) => {
  if (artplayerInstance.value) {
    artplayerInstance.value.muted = muted;
  }
};

const setPlaybackRate = (rate) => {
  if (artplayerInstance.value) {
    artplayerInstance.value.playbackRate = rate;
  }
};

const enterFullscreen = () => {
  if (artplayerInstance.value) {
    artplayerInstance.value.fullscreen = true;
  }
};

const exitFullscreen = () => {
  if (artplayerInstance.value) {
    artplayerInstance.value.fullscreen = false;
  }
};

const screenshot = async (filename) => {
  if (artplayerInstance.value) {
    try {
      // 使用 Artplayer 的内置截图功能，会自动下载
      artplayerInstance.value.screenshot(filename || `video-screenshot-${Date.now()}`);
      return true;
    } catch (error) {
      console.error("截图失败:", error);
      return false;
    }
  }
  return false;
};

const getScreenshotDataURL = async () => {
  if (artplayerInstance.value) {
    try {
      return await artplayerInstance.value.getDataURL();
    } catch (error) {
      console.error("获取截图 DataURL 失败:", error);
      return null;
    }
  }
  return null;
};

const getScreenshotBlobUrl = async () => {
  if (artplayerInstance.value) {
    try {
      return await artplayerInstance.value.getBlobUrl();
    } catch (error) {
      console.error("获取截图 BlobUrl 失败:", error);
      return null;
    }
  }
  return null;
};

// 视频翻转控制
const setFlip = (flipType) => {
  if (artplayerInstance.value) {
    // flipType: 'normal', 'horizontal', 'vertical'
    artplayerInstance.value.flip = flipType;
  }
};

const getFlip = () => {
  if (artplayerInstance.value) {
    return artplayerInstance.value.flip;
  }
  return "normal";
};

// 视频长宽比控制
const setAspectRatio = (ratio) => {
  if (artplayerInstance.value) {
    // ratio: '16:9', '4:3', '1:1', 'default' 等
    artplayerInstance.value.aspectRatio = ratio;
  }
};

const getAspectRatio = () => {
  if (artplayerInstance.value) {
    return artplayerInstance.value.aspectRatio;
  }
  return "default";
};

// 移动端锁定控制
const setLock = (locked) => {
  if (artplayerInstance.value) {
    artplayerInstance.value.lock = locked;
  }
};

const getLock = () => {
  if (artplayerInstance.value) {
    return artplayerInstance.value.lock;
  }
  return false;
};

// 画中画控制
const enterPip = () => {
  if (artplayerInstance.value) {
    artplayerInstance.value.pip = true;
  }
};

const exitPip = () => {
  if (artplayerInstance.value) {
    artplayerInstance.value.pip = false;
  }
};

// 暴露方法给父组件
defineExpose({
  play,
  pause,
  toggle,
  seek,
  setVolume,
  setMuted,
  setPlaybackRate,
  enterFullscreen,
  exitFullscreen,
  screenshot,
  getScreenshotDataURL,
  getScreenshotBlobUrl,
  setFlip,
  getFlip,
  setAspectRatio,
  getAspectRatio,
  setLock,
  getLock,
  enterPip,
  exitPip,
  getInstance: () => artplayerInstance.value,
});

// 监听属性变化
watch(
    () => props.darkMode,
    () => {
      applyThemeStyles();
    },
    { immediate: false }
);

watch(
    () => props.theme,
    () => {
      if (artplayerInstance.value) {
        artplayerInstance.value.theme = getThemeColor();
      }
      applyThemeStyles();
    }
);

watch(
    () => [props.video, props.loop, props.volume, props.muted],
    () => {
      initArtplayer();
    },
    { deep: true }
);

watch(
    () => props.volume,
    (newVolume) => {
      setVolume(newVolume);
    }
);

watch(
    () => props.muted,
    (newMuted) => {
      setMuted(newMuted);
    }
);

// 生命周期
onMounted(() => {
  nextTick(() => {
    initArtplayer();
  });
});

onBeforeUnmount(() => {
  if (artplayerInstance.value) {
    artplayerInstance.value.destroy();
    artplayerInstance.value = null;
  }
});
</script>

<style scoped>
.video-player-container {
  width: 100%;
  position: relative;
}

.artplayer-container {
  width: 100%;
  height: 480px; /* 明确设置高度，确保播放器有足够空间 */
  min-height: 200px;
}
</style>

<style>
/* Artplayer 深色模式样式 */
.dark-theme .art-video-player {
  background: #1f2937 !important;
}

.dark-theme .art-bottom {
  background: linear-gradient(transparent, rgba(31, 41, 55, 0.8)) !important;
}

.dark-theme .art-controls {
  background: rgba(31, 41, 55, 0.9) !important;
}

.dark-theme .art-control-progress {
  background: rgba(156, 163, 175, 0.3) !important; /* 进度条容器背景 - 浅灰色 */
}

.dark-theme .art-control-progress-inner {
  background: transparent !important; /* 内容容器背景透明 */
}

.dark-theme .art-progress-loaded {
  background: rgba(139, 92, 246, 0.4) !important; /* 已加载进度 - 紫色40%透明度 */
}

.dark-theme .art-progress-played {
  background: var(--art-theme, #8b5cf6) !important; /* 已播放进度 - 紫色100% */
}

.dark-theme .art-progress-indicator {
  background: var(--art-theme, #8b5cf6) !important; /* 进度指示器 - 紫色100% */
}

.dark-theme .art-control .art-icon {
  color: #f9fafb !important;
}

.dark-theme .art-control .art-icon:hover {
  color: var(--art-theme, #8b5cf6) !important;
}

.dark-theme .art-control-time {
  color: #d1d5db !important;
}

.dark-theme .art-setting {
  background: rgba(31, 41, 55, 0.95) !important;
  border: 1px solid #374151 !important;
}

.dark-theme .art-setting-item {
  color: #f9fafb !important;
  border-bottom: 1px solid #374151 !important;
}

.dark-theme .art-setting-item:hover {
  background: rgba(55, 65, 81, 0.5) !important;
}

.dark-theme .art-contextmenu {
  background: rgba(31, 41, 55, 0.95) !important;
  border: 1px solid #374151 !important;
}

.dark-theme .art-contextmenu-item {
  color: #f9fafb !important;
  border-bottom: 1px solid #374151 !important;
}

.dark-theme .art-contextmenu-item:hover {
  background: rgba(55, 65, 81, 0.5) !important;
}

.dark-theme .art-info {
  background: rgba(31, 41, 55, 0.95) !important;
  color: #f9fafb !important;
  border: 1px solid #374151 !important;
}

.dark-theme .art-subtitle {
  color: #f9fafb !important;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8) !important;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .artplayer-container {
    min-height: 180px;
  }

  .dark-theme .art-controls {
    padding: 5px 10px !important;
  }

  .dark-theme .art-control {
    margin: 0 3px !important;
  }
}

/* 确保播放器在容器中正确显示 */
.artplayer-container .art-video-player {
  border-radius: 8px;
  overflow: hidden;
}

.dark-theme .artplayer-container .art-video-player {
  border: 1px solid #374151;
}
</style>
