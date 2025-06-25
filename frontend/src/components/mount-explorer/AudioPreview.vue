<template>
  <div class="audio-preview-container">
    <!-- 音频预览 -->
    <div class="audio-preview p-4">
      <AudioPlayer
        ref="audioPlayerRef"
        v-if="audioUrl && audioData"
        :audio-list="finalAudioList"
        :current-audio="null"
        :dark-mode="darkMode"
        :autoplay="false"
        :show-playlist="true"
        :list-folded="true"
        :list-max-height="'300px'"
        :mode="'normal'"
        :volume="0.7"
        :loop="'all'"
        :order="'list'"
        @play="handlePlay"
        @pause="handlePause"
        @error="handleError"
        @canplay="handleCanPlay"
        @ended="handleAudioEnded"
        @listswitch="handleListSwitch"
      />
      <div v-else class="loading-indicator text-center py-8">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto" :class="darkMode ? 'border-primary-500' : 'border-primary-600'"></div>
        <p class="mt-2 text-sm" :class="darkMode ? 'text-gray-400' : 'text-gray-600'">{{ $t("mount.audioPreview.loadingAudio") }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import AudioPlayer from "../common/AudioPlayer.vue";
import { api } from "../../api";
import { getMimeTypeGroupByFileDetails, MIME_GROUPS } from "../../utils/mimeTypeUtils";

const { t } = useI18n();

// Props 定义
const props = defineProps({
  // 文件信息
  file: {
    type: Object,
    required: true,
  },
  // 音频URL
  audioUrl: {
    type: String,
    default: null,
  },
  // 是否为深色模式
  darkMode: {
    type: Boolean,
    default: false,
  },
  // 是否为管理员
  isAdmin: {
    type: Boolean,
    default: false,
  },
  // 当前目录路径
  currentPath: {
    type: String,
    default: "",
  },
});

// Emits 定义
const emit = defineEmits(["play", "pause", "error", "canplay", "loaded"]);

// 响应式数据
const audioPlayerRef = ref(null);
const isPlaying = ref(false);
const originalTitle = ref("");

// 播放列表相关
const audioPlaylist = ref([]); // 存储完整的音频播放列表数据
const isLoadingPlaylist = ref(false);

// 当前音频数据（响应式）
const currentAudioData = ref(null);

// 全局预签名URL缓存 (30分钟有效期)
const globalUrlCache = window.audioUrlCache || (window.audioUrlCache = new Map());

// 计算最终的播放列表（确保至少有当前音频）
const finalAudioList = computed(() => {
  if (audioPlaylist.value.length > 0) {
    return audioPlaylist.value;
  } else if (currentAudioData.value) {
    // 即使只有一个音频文件，也创建一个数组，这样 APlayer 会显示播放列表按钮
    return [currentAudioData.value];
  }
  return [];
});

// 为了兼容性，保留 audioData 计算属性
const audioData = computed(() => currentAudioData.value);

// 更新页面标题
const updatePageTitle = (playing = false, fileName = null) => {
  // 使用传入的文件名，如果没有则使用默认值
  const title = fileName || t("mount.audioPreview.audioPlayer");

  document.title = playing ? `🎵 ${title} - CloudPaste` : `${title} - CloudPaste`;
};

// 恢复原始页面标题
const restoreOriginalTitle = () => {
  if (originalTitle.value) {
    document.title = originalTitle.value;
  }
};

// 事件处理函数
const handlePlay = (data) => {
  isPlaying.value = true;
  const audioName = data?.audio?.name;
  updatePageTitle(true, audioName);
  emit("play", data);
};

const handlePause = (data) => {
  isPlaying.value = false;
  const audioName = data?.audio?.name;
  updatePageTitle(false, audioName);
  emit("pause", data);
};

const handleError = (error) => {
  // 忽略Service Worker相关的误报错误
  if (error?.target?.src?.includes(window.location.origin) && currentAudioData.value?.url) {
    console.log("🎵 忽略Service Worker相关的误报错误，音频实际可以正常播放");
    return;
  }

  isPlaying.value = false;
  emit("error", error);
};

const handleCanPlay = () => {
  emit("canplay");
  emit("loaded");
};

// 处理音频播放结束
const handleAudioEnded = () => {
  console.log("音频播放结束");
  // APlayer 会根据 loop 和 order 参数自动处理下一首播放
  // 不需要手动调用 playNext()
};

// 处理 APlayer 的列表切换事件
const handleListSwitch = (data) => {
  // 解析索引
  const audioIndex = data?.index?.index ?? data?.index;

  // 获取音频名称
  let audioName = null;
  if (data?.audio?.name) {
    audioName = data.audio.name;
  } else if (typeof audioIndex === "number" && finalAudioList.value[audioIndex]) {
    audioName = finalAudioList.value[audioIndex].name;
  }

  updatePageTitle(isPlaying.value, audioName);
};

// 获取当前目录下的音频文件列表
const loadAudioPlaylist = async () => {
  console.log("🎵 开始加载音频播放列表...");
  console.log("当前路径:", props.currentPath);
  console.log("是否为管理员:", props.isAdmin);

  if (!props.currentPath || isLoadingPlaylist.value) {
    console.log("❌ 跳过加载: 路径为空或正在加载中");
    return;
  }

  try {
    isLoadingPlaylist.value = true;
    const fsApi = props.isAdmin ? api.admin : api.user.fs;
    const response = await fsApi.getDirectoryList(props.currentPath);

    console.log("📁 目录列表响应:", response);

    if (response.success && response.data?.items) {
      console.log("📂 目录中的所有文件:", response.data.items);

      // 过滤出音频文件
      const audioFileList = response.data.items.filter((item) => {
        if (item.isDirectory) return false;
        const mimeGroup = getMimeTypeGroupByFileDetails(item.contentType || "", item.name || "");
        const isAudio = mimeGroup === MIME_GROUPS.AUDIO;
        console.log(`🎵 文件 ${item.name}: contentType=${item.contentType}, mimeGroup=${mimeGroup}, isAudio=${isAudio}`);
        return isAudio;
      });

      console.log("🎵 过滤后的音频文件:", audioFileList);

      // 按文件名排序
      audioFileList.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

      // 生成播放列表（即使只有一个文件也生成，这样可以显示播放列表按钮）
      if (audioFileList.length > 0) {
        console.log(`🎵 找到 ${audioFileList.length} 个音频文件，开始生成播放列表...`);
        await generateAudioPlaylist(audioFileList);
      } else {
        console.log("❌ 当前目录下没有找到音频文件");
      }
    } else {
      console.log("❌ API 响应失败或数据为空:", response);
    }
  } catch (error) {
    console.error("❌ 加载音频播放列表失败:", error);
  } finally {
    isLoadingPlaylist.value = false;
  }
};

// 生成音频播放列表数据（使用 S3 预签名 URL）
const generateAudioPlaylist = async (audioFileList) => {
  console.log("🎵 开始生成播放列表，文件数量:", audioFileList.length);
  const playlist = [];

  for (const audioFile of audioFileList) {
    console.log(`🎵 处理音频文件: ${audioFile.name}`);
    try {
      // 生成 S3 预签名 URL（无需认证，支持流式播放）
      const presignedUrl = await generateS3PresignedUrl(audioFile);

      if (presignedUrl) {
        const audioItem = {
          name: audioFile.name || "unknown",
          artist: "unknown",
          url: presignedUrl, // 使用 S3 预签名 URL，APlayer 可以直接访问
          cover: generateDefaultCover(audioFile.name),
          // 保存原始文件信息
          originalFile: audioFile,
        };
        playlist.push(audioItem);
      }
    } catch (error) {
      console.error(`生成音频播放数据失败: ${audioFile.name}`, error);
    }
  }

  // 确保当前播放的文件排在第一位
  const currentFileIndex = playlist.findIndex((audio) => audio.originalFile?.path === props.file.path);
  if (currentFileIndex > 0) {
    const currentFile = playlist.splice(currentFileIndex, 1)[0];
    playlist.unshift(currentFile);
  }

  audioPlaylist.value = playlist;

  // 延迟更新 APlayer，确保 Blob URL 都已准备好
  if (audioPlayerRef.value && playlist.length > 0) {
    // 使用 setTimeout 确保所有异步操作完成
    setTimeout(() => {
      nextTick(() => {
        const player = audioPlayerRef.value?.getInstance();
        if (player && player.list && playlist.length > 0) {
          try {
            // 使用官方 API 清空并重新添加播放列表
            player.list.clear();

            // 验证并添加音频项目
            const validPlaylist = playlist.filter((audio) => audio?.url && audio?.name);

            validPlaylist.forEach((audio) => {
              try {
                player.list.add(audio);
              } catch (error) {
                console.error(`添加音频失败: ${audio.name}`, error);
              }
            });

            // 切换到第一个音频
            if (validPlaylist.length > 0) {
              player.list.switch(0);
            }
          } catch (error) {
            console.error("更新播放列表失败:", error);
          }
        }
      });
    }, 100); // 延迟 100ms 确保所有 Blob URL 准备完成
  }
};

// 生成 S3 预签名 URL（带缓存，避免重复请求）
const generateS3PresignedUrl = async (audioFile) => {
  const cacheKey = audioFile.path;
  const now = Date.now();

  // 检查缓存（30分钟有效期）
  const cached = globalUrlCache.get(cacheKey);
  if (cached && now - cached.timestamp < 30 * 60 * 1000) {
    return cached.url;
  }

  try {
    const getFileLink = props.isAdmin ? api.admin.getFileLink : api.user.fs.getFileLink;
    //使用S3配置的默认签名时间
    const response = await getFileLink(audioFile.path, null, false);

    if (response?.success && response.data?.presignedUrl) {
      const presignedUrl = response.data.presignedUrl;

      // 缓存URL
      globalUrlCache.set(cacheKey, {
        url: presignedUrl,
        timestamp: now,
      });

      return presignedUrl;
    }
  } catch (error) {
    console.error(`获取音频预签名URL失败: ${audioFile.name}`, error);
  }
  return null;
};

// 生成默认封面
const generateDefaultCover = (name) => {
  const firstChar = (name || "M")[0].toUpperCase();
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 100;
  const ctx = canvas.getContext("2d");

  // 背景色
  ctx.fillStyle = props.darkMode ? "#60a5fa" : "#3b82f6";
  ctx.fillRect(0, 0, 100, 100);

  // 文字
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 40px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(firstChar, 50, 50);

  return canvas.toDataURL();
};

// 初始化当前音频数据（使用 S3 预签名 URL）
const initializeCurrentAudio = async () => {
  if (!props.file) {
    console.log("❌ 无法初始化当前音频：文件信息为空");
    return;
  }

  console.log("🎵 开始初始化当前音频:", props.file.name);

  try {
    // 生成 S3 预签名 URL（无需认证，支持流式播放）
    console.log(`🔗 生成当前音频的 S3 预签名 URL: ${props.file.name}`);
    const presignedUrl = await generateS3PresignedUrl(props.file);

    currentAudioData.value = {
      name: props.file.name || "unknown",
      artist: "unknown",
      url: presignedUrl || props.audioUrl, // 优先使用 S3 预签名 URL，失败时回退到原始 URL
      cover: generateDefaultCover(props.file.name),
      contentType: props.file.contentType,
      // 保存原始文件信息
      originalFile: props.file,
    };
  } catch (error) {
    console.error("初始化当前音频失败:", error);
    // 失败时使用原始数据
    currentAudioData.value = {
      name: props.file.name || "unknown",
      artist: "unknown",
      url: props.audioUrl,
      cover: generateDefaultCover(props.file.name),
      contentType: props.file.contentType,
    };
  }
};

// 监听 audioUrl 变化，当准备好时初始化当前音频
watch(
  () => props.audioUrl,
  async (newAudioUrl) => {
    if (newAudioUrl && props.file) {
      console.log("🎵 检测到 audioUrl 变化，开始初始化当前音频:", newAudioUrl);
      await initializeCurrentAudio();
    }
  },
  { immediate: true }
);

// 快捷键处理
const handleKeydown = (event) => {
  // 如果用户正在输入框中输入，不处理快捷键
  if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA") {
    return;
  }

  const player = audioPlayerRef.value?.getInstance();
  if (!player) return;

  switch (event.code) {
    case "Space":
      event.preventDefault();
      player.toggle(); // 播放/暂停
      break;
    case "ArrowLeft":
      event.preventDefault();
      player.seek(Math.max(0, player.audio.currentTime - 10)); // 后退10秒
      break;
    case "ArrowRight":
      event.preventDefault();
      player.seek(Math.min(player.audio.duration, player.audio.currentTime + 10)); // 前进10秒
      break;
    case "ArrowUp":
      event.preventDefault();
      player.volume(Math.min(1, player.audio.volume + 0.1)); // 音量+10%
      break;
    case "ArrowDown":
      event.preventDefault();
      player.volume(Math.max(0, player.audio.volume - 0.1)); // 音量-10%
      break;
  }
};

// 生命周期钩子
onMounted(() => {
  // 保存原始页面标题
  originalTitle.value = document.title;

  // 添加键盘事件监听
  document.addEventListener("keydown", handleKeydown);

  // 加载播放列表
  loadAudioPlaylist();
});

onBeforeUnmount(() => {
  // 恢复原始页面标题
  restoreOriginalTitle();

  // 移除键盘事件监听
  document.removeEventListener("keydown", handleKeydown);

  console.log("🧹 音频预览组件已卸载");
});
</script>

<style scoped>
.audio-preview-container {
  width: 100%;
}

.audio-preview {
  min-height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
}

.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* 移动端优化 */
@media (max-width: 768px) {
  .audio-preview {
    padding: 0.75rem !important;
    min-height: 100px;
  }
}
</style>
