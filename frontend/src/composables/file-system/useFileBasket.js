/**
 * 文件篮 Composable
 * 处理文件篮相关的业务逻辑，连接Store和组件
 */

import { computed, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useFileBasketStore } from "../../stores/fileBasketStore.js";
import { useAuthStore } from "../../stores/authStore.js";
import { useTaskManager } from "../../utils/taskManager.js";
import { api } from "../../api/index.js";

export function useFileBasket() {
  const { t } = useI18n();
  const fileBasketStore = useFileBasketStore();
  const authStore = useAuthStore();
  const taskManager = useTaskManager();

  // ===== 全局清理状态跟踪 =====

  // 跟踪所有活动的XMLHttpRequest（全局级别）
  const globalActiveXHRs = new Set();

  // 跟踪所有事件监听器
  const globalEventListeners = new Set();

  // 全局清理函数
  const globalCleanup = () => {
    // 取消所有活动的XMLHttpRequest
    globalActiveXHRs.forEach((xhr) => {
      if (xhr.readyState !== XMLHttpRequest.DONE) {
        xhr.abort();
      }
    });
    globalActiveXHRs.clear();

    // 移除所有事件监听器
    globalEventListeners.forEach(({ target, event, handler }) => {
      target.removeEventListener(event, handler);
    });
    globalEventListeners.clear();

    console.log("文件篮composable已清理所有资源");
  };

  // ===== Store状态解构 =====
  const { collectedFiles, isBasketOpen, collectionCount, hasCollection, collectionTotalSize, collectionTotalSizeMB, filesByDirectory, directoryCount, isInitialized } =
    storeToRefs(fileBasketStore);

  // ===== 计算属性 =====

  /**
   * 文件篮按钮显示文本
   */
  const basketButtonText = computed(() => {
    try {
      if (collectionCount.value === 0) {
        return t("fileBasket.button.empty");
      }
      return t("fileBasket.button.withCount", { count: collectionCount.value });
    } catch (error) {
      console.warn("国际化函数调用失败，使用默认文本:", error);
      // 使用默认文本作为后备
      if (collectionCount.value === 0) {
        return "文件篮";
      }
      return `文件篮 (${collectionCount.value})`;
    }
  });

  /**
   * 文件篮摘要信息
   */
  const basketSummary = computed(() => {
    return {
      fileCount: collectionCount.value,
      directoryCount: directoryCount.value,
      totalSizeMB: collectionTotalSizeMB.value,
      isEmpty: !hasCollection.value,
    };
  });

  // ===== 文件篮操作方法 =====

  /**
   * 添加文件到篮子
   * @param {Object|Array} files - 文件或文件数组
   * @param {string} currentPath - 当前目录路径
   * @returns {Object} 操作结果
   */
  const addToBasket = (files, currentPath) => {
    try {
      const fileArray = Array.isArray(files) ? files : [files];
      const fileItems = fileArray.filter((item) => !item.isDirectory);

      if (fileItems.length === 0) {
        return {
          success: false,
          message: t("fileBasket.messages.noFilesToAdd"),
        };
      }

      fileBasketStore.addToBasket(fileItems, currentPath);

      return {
        success: true,
        message: t("fileBasket.messages.addSuccess", {
          count: fileItems.length,
          total: collectionCount.value,
        }),
      };
    } catch (error) {
      console.error("添加文件到篮子失败:", error);
      return {
        success: false,
        message: t("fileBasket.messages.addFailed"),
      };
    }
  };

  /**
   * 从篮子移除文件
   * @param {string|Array} filePaths - 文件路径
   * @returns {Object} 操作结果
   */
  const removeFromBasket = (filePaths) => {
    try {
      fileBasketStore.removeFromBasket(filePaths);
      return {
        success: true,
        message: t("fileBasket.messages.removeSuccess"),
      };
    } catch (error) {
      console.error("从篮子移除文件失败:", error);
      return {
        success: false,
        message: t("fileBasket.messages.removeFailed"),
      };
    }
  };

  /**
   * 切换文件在篮子中的状态
   * @param {Object} file - 文件对象
   * @param {string} currentPath - 当前目录路径
   * @returns {Object} 操作结果
   */
  const toggleFileInBasket = (file, currentPath) => {
    try {
      const isInBasket = fileBasketStore.isFileInBasket(file.path);
      fileBasketStore.toggleFileInBasket(file, currentPath);

      return {
        success: true,
        isInBasket: !isInBasket,
        message: isInBasket ? t("fileBasket.messages.removeSuccess") : t("fileBasket.messages.addSuccess", { count: 1, total: collectionCount.value }),
      };
    } catch (error) {
      console.error("切换文件篮状态失败:", error);
      return {
        success: false,
        message: t("fileBasket.messages.toggleFailed"),
      };
    }
  };

  /**
   * 批量添加选中文件到篮子
   * @param {Array} selectedFiles - 选中的文件列表
   * @param {string} currentPath - 当前目录路径
   * @returns {Object} 操作结果
   */
  const addSelectedToBasket = (selectedFiles, currentPath) => {
    try {
      const addedCount = fileBasketStore.addSelectedToBasket(selectedFiles, currentPath);

      if (addedCount === 0) {
        return {
          success: false,
          message: t("fileBasket.messages.noFilesToAdd"),
        };
      }

      return {
        success: true,
        addedCount,
        message: t("fileBasket.messages.batchAddSuccess", {
          count: addedCount,
          total: collectionCount.value,
        }),
      };
    } catch (error) {
      console.error("批量添加文件到篮子失败:", error);
      return {
        success: false,
        message: t("fileBasket.messages.batchAddFailed"),
      };
    }
  };

  // ===== 面板管理方法 =====

  /**
   * 打开文件篮面板
   */
  const openBasket = () => {
    fileBasketStore.openBasket();
  };

  /**
   * 关闭文件篮面板
   */
  const closeBasket = () => {
    fileBasketStore.closeBasket();
  };

  /**
   * 切换文件篮面板显示状态
   */
  const toggleBasket = () => {
    fileBasketStore.toggleBasket();
  };

  // ===== 清理方法 =====

  /**
   * 清空文件篮
   * @returns {Object} 操作结果
   */
  const clearBasket = () => {
    try {
      fileBasketStore.clearBasket();
      return {
        success: true,
        message: t("fileBasket.messages.clearSuccess"),
      };
    } catch (error) {
      console.error("清空文件篮失败:", error);
      return {
        success: false,
        message: t("fileBasket.messages.clearFailed"),
      };
    }
  };

  /**
   * 重置文件篮（清空并关闭面板）
   */
  const resetBasket = () => {
    fileBasketStore.resetBasket();
  };

  // ===== 打包下载方法 =====

  /**
   * 创建打包下载任务
   * @returns {Promise<Object>} 操作结果
   */
  const createPackTask = async () => {
    try {
      if (!hasCollection.value) {
        return {
          success: false,
          message: t("fileBasket.messages.emptyBasket"),
        };
      }

      // 创建任务
      const taskName = t("fileBasket.task.name", {
        count: collectionCount.value,
        directories: directoryCount.value,
      });

      const taskId = taskManager.addTask("download", taskName, collectionCount.value);

      // 启动异步打包处理
      processPackTask(taskId);

      return {
        success: true,
        taskId,
        message: t("fileBasket.messages.taskCreated", { taskName }),
      };
    } catch (error) {
      console.error("创建打包任务失败:", error);
      return {
        success: false,
        message: t("fileBasket.messages.taskCreateFailed"),
      };
    }
  };

  /**
   * 处理打包任务（异步）
   * @param {number} taskId - 任务ID
   */
  const processPackTask = async (taskId) => {
    // 用于清理资源的变量
    let fileStates = null;
    let activeXHRs = new Set(); // 跟踪活动的XMLHttpRequest

    try {
      // 更新任务状态
      taskManager.updateTaskProgress(taskId, 0, {
        status: t("fileBasket.task.preparing"),
        total: collectionCount.value,
        processed: 0,
        currentFile: "",
        startTime: new Date().toISOString(),
      });

      // 获取收集的文件
      const files = fileBasketStore.getCollectedFiles();

      // 动态导入JSZip和file-saver
      const JSZip = (await import("jszip")).default;
      const { saveAs } = await import("file-saver");

      const zip = new JSZip();
      const failedFiles = [];

      // 并行文件状态跟踪
      fileStates = new Map(); // 跟踪每个文件的状态

      // 初始化文件状态
      files.forEach((file) => {
        fileStates.set(file.path, {
          name: file.name,
          path: file.path,
          size: file.size,
          status: "pending", // pending, downloading, completed, failed
          progress: 0,
          receivedBytes: 0,
          totalBytes: file.size || 0,
        });
      });

      // 计算总文件大小（参考上传逻辑）
      const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
      let completedSize = 0;

      // 移除速度计算，简化逻辑

      // 进度更新节流控制（避免过度更新导致跳动）
      // 使用Map为每个文件单独跟踪节流状态，避免竞态条件
      const fileProgressThrottles = new Map(); // 每个文件的节流状态
      const PROGRESS_UPDATE_INTERVAL = 200; // 200ms更新一次，避免过于频繁

      // 全局进度更新锁，防止并发更新冲突
      let isUpdatingProgress = false;

      // 清理资源的函数
      const cleanup = () => {
        // 取消所有活动的XMLHttpRequest
        activeXHRs.forEach((xhr) => {
          if (xhr.readyState !== XMLHttpRequest.DONE) {
            xhr.abort();
          }
        });
        activeXHRs.clear();

        // 清理fileStates Map
        if (fileStates) {
          fileStates.clear();
          fileStates = null;
        }

        // 清理节流状态
        fileProgressThrottles.clear();
        isUpdatingProgress = false;
      };

      // 更新任务进度的辅助函数
      const updateTaskWithFileStates = (overallProgress, currentFile = "") => {
        if (!fileStates) return; // 防止在清理后调用

        const fileStatesArray = Array.from(fileStates.values());

        taskManager.updateTaskProgress(taskId, overallProgress, {
          status: t("fileBasket.task.downloading"),
          currentFile: currentFile,
          processed: fileStatesArray.filter((f) => f.status === "completed").length,
          total: files.length,
          totalProgress: overallProgress,
          // 添加并行文件状态信息
          parallelFiles: fileStatesArray,
          showParallelDetails: true, // 标记这是并行下载任务
        });
      };

      // 处理单个文件的函数
      const processFile = async (file) => {
        try {
          // 更新文件状态为下载中
          const fileState = fileStates.get(file.path);
          fileState.status = "downloading";

          // 获取文件下载URL
          const downloadUrl = await getFileDownloadUrl(file);

          // 使用XMLHttpRequest下载文件并监控实时进度（参考上传逻辑）
          const blob = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            activeXHRs.add(xhr); // 跟踪活动的XMLHttpRequest（局部）
            globalActiveXHRs.add(xhr); // 跟踪活动的XMLHttpRequest（全局）

            // 设置超时时间（60分钟）
            xhr.timeout = 60 * 60 * 1000;

            xhr.open("GET", downloadUrl);
            xhr.responseType = "blob";

            // 进度事件监听（完全参考文件上传的进度监控算法）
            xhr.onprogress = (event) => {
              if (event.lengthComputable) {
                const fileProgress = Math.round((event.loaded / event.total) * 100);

                // 更新当前文件状态
                fileState.progress = fileProgress;
                fileState.receivedBytes = event.loaded;
                fileState.totalBytes = event.total;

                // 计算总体进度（基于所有文件的完成情况）
                const completedFilesSize = Array.from(fileStates.values())
                  .filter((f) => f.status === "completed")
                  .reduce((sum, f) => sum + f.totalBytes, 0);

                const currentDownloadingSize = Array.from(fileStates.values())
                  .filter((f) => f.status === "downloading")
                  .reduce((sum, f) => sum + f.receivedBytes, 0);

                const overallProgress = totalSize > 0 ? Math.round(((completedFilesSize + currentDownloadingSize) / totalSize) * 90) : 0;

                // 节流更新任务进度（避免过度更新导致UI跳动）
                // 使用文件级别的节流，避免竞态条件
                const now = Date.now();
                const fileThrottle = fileProgressThrottles.get(file.path) || { lastUpdate: 0 };

                if (now - fileThrottle.lastUpdate >= PROGRESS_UPDATE_INTERVAL || fileProgress === 100) {
                  fileThrottle.lastUpdate = now;
                  fileProgressThrottles.set(file.path, fileThrottle);

                  // 使用锁机制防止并发更新冲突
                  if (!isUpdatingProgress) {
                    isUpdatingProgress = true;

                    // 使用微任务确保更新的原子性
                    Promise.resolve().then(() => {
                      try {
                        updateTaskWithFileStates(overallProgress, `${file.name} (${fileProgress}%)`);
                      } finally {
                        isUpdatingProgress = false;
                      }
                    });
                  }
                }
              }
            };

            // 完整的错误处理事件
            xhr.onload = () => {
              activeXHRs.delete(xhr); // 从跟踪中移除
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.response);
              } else {
                reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText || "未知错误"}`));
              }
            };

            xhr.onerror = () => {
              activeXHRs.delete(xhr); // 从跟踪中移除
              reject(new Error("网络连接错误"));
            };

            xhr.onabort = () => {
              activeXHRs.delete(xhr); // 从跟踪中移除
              reject(new Error("下载被取消"));
            };

            xhr.ontimeout = () => {
              activeXHRs.delete(xhr); // 从跟踪中移除
              reject(new Error("下载超时"));
            };

            // 监听网络状态变化
            const handleOffline = () => {
              if (!navigator.onLine) {
                xhr.abort();
                reject(new Error("网络连接已断开"));
              }
            };

            // 添加网络状态监听
            window.addEventListener("offline", handleOffline);

            // 清理网络状态监听的函数
            const cleanupXHR = () => {
              window.removeEventListener("offline", handleOffline);
              activeXHRs.delete(xhr);
              globalActiveXHRs.delete(xhr); // 同时从全局跟踪中移除
            };

            // 重写所有事件处理器以包含清理
            const originalOnload = xhr.onload;
            const originalOnerror = xhr.onerror;
            const originalOnabort = xhr.onabort;
            const originalOntimeout = xhr.ontimeout;

            xhr.onload = (...args) => {
              cleanupXHR();
              originalOnload.apply(xhr, args);
            };

            xhr.onerror = (...args) => {
              cleanupXHR();
              originalOnerror.apply(xhr, args);
            };

            xhr.onabort = (...args) => {
              cleanupXHR();
              originalOnabort.apply(xhr, args);
            };

            xhr.ontimeout = (...args) => {
              cleanupXHR();
              originalOntimeout.apply(xhr, args);
            };

            xhr.send();
          });

          // 构建ZIP内的路径结构
          const directoryName = file.sourceDirectory.replace(/^\//, "").replace(/\//g, "_") || "root";
          const zipPath = `${directoryName}/${file.name}`;

          // 处理文件名冲突
          let finalZipPath = zipPath;
          let counter = 1;
          while (zip.file(finalZipPath)) {
            const lastDotIndex = zipPath.lastIndexOf(".");
            if (lastDotIndex > 0) {
              const name = zipPath.substring(0, lastDotIndex);
              const ext = zipPath.substring(lastDotIndex);
              finalZipPath = `${name}_${counter}${ext}`;
            } else {
              finalZipPath = `${zipPath}_${counter}`;
            }
            counter++;
          }

          // 添加到ZIP
          zip.file(finalZipPath, blob);

          // 文件处理完成，更新文件状态
          fileState.status = "completed";
          fileState.progress = 100;
          completedSize += file.size || 0;

          // 确保文件完成时的最终进度更新（绕过节流机制）
          const finalOverallProgress = totalSize > 0 ? Math.round((completedSize / totalSize) * 90) : 0;

          // 强制更新最终状态，不受节流和锁机制限制
          try {
            updateTaskWithFileStates(finalOverallProgress, `${file.name} (完成)`);
          } catch (updateError) {
            console.warn(`更新文件完成状态失败: ${updateError.message}`);
          }

          return { success: true, fileName: file.name };
        } catch (error) {
          console.error(`下载文件 ${file.name} 失败:`, error);
          failedFiles.push({ fileName: file.name, path: file.path, error: error.message });

          // 失败也要更新文件状态
          const fileState = fileStates.get(file.path);
          if (fileState) {
            fileState.status = "failed";
            fileState.progress = 0; // 失败时重置进度
          }
          completedSize += file.size || 0;

          // 强制更新失败状态，不受节流和锁机制限制
          const overallProgress = totalSize > 0 ? Math.round((completedSize / totalSize) * 90) : 0;
          try {
            updateTaskWithFileStates(overallProgress, `${file.name} (失败)`);
          } catch (updateError) {
            console.warn(`更新文件失败状态失败: ${updateError.message}`);
          }

          return { success: false, fileName: file.name, error: error.message };
        }
      };

      // 简化的并发控制，确保实时进度更新
      const concurrencyLimit = 3;

      for (let i = 0; i < files.length; i += concurrencyLimit) {
        const batch = files.slice(i, i + concurrencyLimit);

        // 并发处理批次中的文件，但每个文件完成时立即更新进度
        await Promise.all(batch.map(processFile));
      }

      // 如果有失败的文件，添加错误报告
      if (failedFiles.length > 0) {
        const errorReport = [t("fileBasket.task.failedFilesHeader"), "", ...failedFiles.map(({ fileName, path, error }) => `${path} (${fileName}): ${error}`)].join("\n");

        zip.file("下载失败文件列表.txt", errorReport);
      }

      // 生成ZIP文件
      taskManager.updateTaskProgress(taskId, 95, {
        status: t("fileBasket.task.generating"),
        currentFile: "",
        processed: files.length,
        total: files.length,
      });

      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      // 下载ZIP文件
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
      const zipFileName = `CloudPaste_${timestamp}.zip`;

      saveAs(zipBlob, zipFileName);

      // 完成任务
      const successCount = files.length - failedFiles.length;
      taskManager.completeTask(taskId, {
        status: t("fileBasket.task.completed"),
        successCount,
        failedCount: failedFiles.length,
        zipFileName,
        endTime: new Date().toISOString(),
        summary:
          failedFiles.length > 0
            ? t("fileBasket.task.summaryWithFailures", { success: successCount, failed: failedFiles.length })
            : t("fileBasket.task.summarySuccess", { count: successCount }),
      });

      // 打包完成后自动清空文件篮
      fileBasketStore.clearBasket();
    } catch (error) {
      console.error("打包任务失败:", error);
      taskManager.failTask(taskId, error.message, {
        status: t("fileBasket.task.failed"),
        endTime: new Date().toISOString(),
      });
    } finally {
      // 确保清理资源
      cleanup();
    }
  };

  /**
   * 获取文件下载URL
   * @param {Object} file - 文件对象
   * @returns {Promise<string>} 下载URL
   */
  const getFileDownloadUrl = async (file) => {
    try {
      // 如果文件对象中已经有download_url，直接使用
      if (file.download_url) {
        return file.download_url;
      }

      // 使用统一API获取文件直链
      const getFileLinkApi = api.fs.getFileLink;
      const response = await getFileLinkApi(file.path, null, true); // 强制下载

      if (response.success && response.data) {
        // file-link API返回的是presignedUrl字段
        if (response.data.presignedUrl) {
          return response.data.presignedUrl;
        }
        // 兼容其他可能的字段名
        if (response.data.download_url) {
          return response.data.download_url;
        }
        if (response.data.proxy_download_url) {
          return response.data.proxy_download_url;
        }
      }

      throw new Error(t("fileBasket.errors.noDownloadUrl"));
    } catch (error) {
      console.error(`获取文件 ${file.name} 下载链接失败:`, error);
      throw error;
    }
  };

  // ===== 工具方法 =====

  /**
   * 检查文件是否在篮子中
   * @param {string} filePath - 文件路径
   * @returns {boolean}
   */
  const isFileInBasket = (filePath) => {
    return fileBasketStore.isFileInBasket(filePath);
  };

  /**
   * 获取篮子摘要信息
   * @returns {Object}
   */
  const getBasketSummary = () => {
    return fileBasketStore.getCollectionSummary();
  };

  // ===== 组件卸载清理 =====

  onUnmounted(() => {
    globalCleanup();
  });

  return {
    // Store状态
    collectedFiles,
    isBasketOpen,
    collectionCount,
    hasCollection,
    collectionTotalSize,
    collectionTotalSizeMB,
    filesByDirectory,
    directoryCount,
    isInitialized,

    // 计算属性
    basketButtonText,
    basketSummary,

    // 文件篮操作方法
    addToBasket,
    removeFromBasket,
    toggleFileInBasket,
    addSelectedToBasket,

    // 面板管理方法
    openBasket,
    closeBasket,
    toggleBasket,

    // 清理方法
    clearBasket,
    resetBasket,

    // 打包下载方法
    createPackTask,

    // 工具方法
    isFileInBasket,
    getBasketSummary,

    // 手动清理方法（用于紧急情况）
    globalCleanup,
  };
}
