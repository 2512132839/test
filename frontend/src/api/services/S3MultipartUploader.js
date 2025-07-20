/**
 * S3分片上传器（纯粹的通用分片上传实现）
 * 专注于分片上传的核心逻辑，不包含任何业务特定的适配代码
 */
export class S3MultipartUploader {
  constructor(options = {}) {
    // 基础配置
    this.maxConcurrentUploads = options.maxConcurrentUploads || 3;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000; // 重试延迟（毫秒）
    this.enablePersistence = options.enablePersistence !== false; // 默认启用持久化
    this.persistencePrefix = options.persistencePrefix || "s3_multipart"; // 持久化前缀

    // 回调函数
    this.onProgress = options.onProgress || (() => {});
    this.onError = options.onError || (() => {});
    this.onPartComplete = options.onPartComplete || (() => {});
    this.onStateChange = options.onStateChange || (() => {});

    // 上传状态
    this.state = "idle"; // idle, preparing, uploading, paused, completed, failed, aborted
    this.isAborted = false;
    this.isPaused = false;

    // 分片管理
    this.chunks = []; // 分片信息数组
    this.completedChunks = new Set(); // 已完成的分片编号
    this.failedChunks = new Map(); // 失败的分片及重试次数
    this.activeXhrs = new Map(); // 活动的XHR请求

    // 核心上传信息（纯粹的分片上传所需）
    this.file = null;
    this.uploadId = null;
    this.presignedUrls = [];
    this.partSize = 5 * 1024 * 1024; // 5MB

    // 进度跟踪
    this.totalBytes = 0;
    this.uploadedBytes = 0;
    this.startTime = null;
    this.lastProgressTime = null;

    // 持久化键名
    this.persistenceKey = null;

    // 业务标识符（由业务层提供，用于持久化区分）
    this.identifier = null;
  }

  /**
   * 设置文件内容
   * @param {File|Blob} content - 要上传的文件或Blob
   * @param {number} partSize - 分片大小
   */
  setContent(content, partSize = 5 * 1024 * 1024) {
    this.file = content;
    this.partSize = partSize;
    this.totalBytes = content.size;

    // 生成持久化键名
    if (this.enablePersistence) {
      this.persistenceKey = this._generatePersistenceKey(content);
    }

    // 创建分片信息
    this._createChunks();
  }

  /**
   * 创建分片信息数组
   * @private
   */
  _createChunks() {
    this.chunks = [];
    const totalChunks = Math.ceil(this.totalBytes / this.partSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.partSize;
      const end = Math.min(start + this.partSize, this.totalBytes);
      const partNumber = i + 1;

      this.chunks.push({
        partNumber,
        start,
        end,
        size: end - start,
        status: "pending", // pending, uploading, completed, failed
        retryCount: 0,
        etag: null,
        uploadedBytes: 0,
      });
    }
  }

  /**
   * 生成持久化键名
   * @param {File|Blob} content - 文件内容
   * @returns {string} 持久化键名
   * @private
   */
  _generatePersistenceKey(content) {
    // 基于文件名、大小、最后修改时间和业务标识符生成唯一键名
    const name = content.name || "unknown";
    const size = content.size;
    const lastModified = content.lastModified || Date.now();
    const identifier = this.identifier || "default";
    return `${this.persistencePrefix}_${identifier}_${name}_${size}_${lastModified}`;
  }

  /**
   * 更改状态并触发回调
   * @param {string} newState - 新状态
   * @private
   */
  _setState(newState) {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      this.onStateChange(newState, oldState);

      // 持久化状态
      if (this.enablePersistence) {
        this._saveState();
      }
    }
  }

  /**
   * 保存状态到本地存储
   * @private
   */
  _saveState() {
    if (!this.persistenceKey) return;

    try {
      const state = {
        uploadId: this.uploadId,
        identifier: this.identifier,
        partSize: this.partSize,
        totalBytes: this.totalBytes,
        uploadedBytes: this.uploadedBytes,
        completedChunks: Array.from(this.completedChunks),
        failedChunks: Array.from(this.failedChunks.entries()),
        chunks: this.chunks.map((chunk) => ({
          partNumber: chunk.partNumber,
          status: chunk.status,
          etag: chunk.etag,
          uploadedBytes: chunk.uploadedBytes,
          retryCount: chunk.retryCount,
        })),
        state: this.state,
        timestamp: Date.now(),
      };

      localStorage.setItem(this.persistenceKey, JSON.stringify(state));
    } catch (error) {
      console.warn("保存上传状态失败:", error);
    }
  }

  /**
   * 从本地存储恢复状态
   * @returns {boolean} 是否成功恢复状态
   */
  restoreState() {
    if (!this.persistenceKey || !this.enablePersistence) return false;

    try {
      const savedState = localStorage.getItem(this.persistenceKey);
      if (!savedState) return false;

      const state = JSON.parse(savedState);

      // 检查状态是否过期（24小时）
      if (Date.now() - state.timestamp > 24 * 60 * 60 * 1000) {
        this.clearPersistedState();
        return false;
      }

      // 恢复状态
      this.uploadId = state.uploadId;
      this.identifier = state.identifier;
      this.partSize = state.partSize;
      this.totalBytes = state.totalBytes;
      this.uploadedBytes = state.uploadedBytes;
      this.completedChunks = new Set(state.completedChunks);
      this.failedChunks = new Map(state.failedChunks);
      this.state = state.state;

      // 恢复分片状态
      if (state.chunks && this.chunks.length === state.chunks.length) {
        state.chunks.forEach((savedChunk, index) => {
          if (this.chunks[index]) {
            Object.assign(this.chunks[index], savedChunk);
          }
        });
      }

      return true;
    } catch (error) {
      console.warn("恢复上传状态失败:", error);
      this.clearPersistedState();
      return false;
    }
  }

  /**
   * 清除持久化状态
   */
  clearPersistedState() {
    if (this.persistenceKey) {
      try {
        localStorage.removeItem(this.persistenceKey);
      } catch (error) {
        console.warn("清除持久化状态失败:", error);
      }
    }
  }

  /**
   * 设置上传信息
   * @param {string} uploadId - 上传ID
   * @param {Array} presignedUrls - 预签名URL列表
   * @param {string} identifier - 业务标识符（可选，用于持久化区分）
   */
  setUploadInfo(uploadId, presignedUrls, identifier = null) {
    this.uploadId = uploadId;
    this.presignedUrls = presignedUrls;
    this.identifier = identifier;

    // 映射预签名URL到分片
    this._mapPresignedUrls();

    // 尝试恢复之前的状态
    if (this.enablePersistence) {
      this.restoreState();
    }
  }

  /**
   * 映射预签名URL到分片
   * @private
   */
  _mapPresignedUrls() {
    this.chunks.forEach((chunk) => {
      const urlInfo = this.presignedUrls.find((url) => url.partNumber === chunk.partNumber);
      if (urlInfo) {
        chunk.presignedUrl = urlInfo.url;
      }
    });
  }

  /**
   * 开始上传所有分片
   * @returns {Promise<Array>} 上传完成的分片信息
   */
  async uploadAllParts() {
    if (!this.file || !this.uploadId || !this.chunks.length) {
      throw new Error("上传信息不完整");
    }

    this._setState("uploading");
    this.startTime = Date.now();
    this.lastProgressTime = Date.now();

    try {
      // 过滤出需要上传的分片（跳过已完成的）
      const pendingChunks = this.chunks.filter((chunk) => chunk.status !== "completed" && chunk.presignedUrl);

      if (pendingChunks.length === 0) {
        // 所有分片都已完成
        this._setState("completed");
        return this._getCompletedParts();
      }

      // 并发上传分片
      await this._uploadPartsWithConcurrency(pendingChunks);

      // 检查是否所有分片都已完成
      const allCompleted = this.chunks.every((chunk) => chunk.status === "completed");
      if (allCompleted) {
        this._setState("completed");
        this.clearPersistedState(); // 清除持久化状态
        return this._getCompletedParts();
      } else {
        throw new Error("部分分片上传失败");
      }
    } catch (error) {
      if (this.isAborted) {
        this._setState("aborted");
      } else if (this.isPaused) {
        this._setState("paused");
      } else {
        this._setState("failed");
      }
      throw error;
    }
  }

  /**
   * 暂停上传
   */
  pause() {
    this.isPaused = true;
    this._setState("paused");

    // 中止当前正在上传的分片
    for (const [partNumber, xhr] of this.activeXhrs) {
      try {
        xhr.abort();
      } catch (error) {
        console.warn(`中止分片 ${partNumber} 请求失败:`, error);
      }
    }
    this.activeXhrs.clear();
  }

  /**
   * 恢复上传
   */
  async resume() {
    if (this.state !== "paused") {
      throw new Error("只能恢复已暂停的上传");
    }

    this.isPaused = false;
    return await this.uploadAllParts();
  }

  /**
   * 获取已完成的分片信息
   * @returns {Array} 分片信息数组
   * @private
   */
  _getCompletedParts() {
    return this.chunks
      .filter((chunk) => chunk.status === "completed" && chunk.etag)
      .map((chunk) => ({
        partNumber: chunk.partNumber,
        etag: chunk.etag,
      }))
      .sort((a, b) => a.partNumber - b.partNumber);
  }

  /**
   * 并发上传分片
   * @param {Array} chunks - 分片列表
   * @returns {Promise<void>}
   */
  async _uploadPartsWithConcurrency(chunks) {
    const executing = [];
    let completedCount = 0;

    for (const chunk of chunks) {
      if (this.isAborted || this.isPaused) {
        break;
      }

      const uploadPromise = this._uploadSingleChunk(chunk)
        .then(() => {
          completedCount++;
          this._updateProgress();
        })
        .catch((error) => {
          console.error(`分片 ${chunk.partNumber} 上传失败:`, error);
          // 错误会在 _uploadSingleChunk 中处理
        });

      executing.push(uploadPromise);

      // 控制并发数量
      if (executing.length >= this.maxConcurrentUploads) {
        await Promise.race(executing);
        // 移除已完成的Promise
        const settled = await Promise.allSettled(executing);
        for (let i = settled.length - 1; i >= 0; i--) {
          if (settled[i].status === "fulfilled" || settled[i].status === "rejected") {
            executing.splice(i, 1);
          }
        }
      }
    }

    // 等待所有任务完成
    await Promise.allSettled(executing);
  }

  /**
   * 更新上传进度
   * @private
   */
  _updateProgress() {
    const completedChunks = this.chunks.filter((chunk) => chunk.status === "completed");
    const totalChunks = this.chunks.length;

    // 计算已上传字节数
    this.uploadedBytes = completedChunks.reduce((total, chunk) => total + chunk.size, 0);

    // 计算进度百分比
    const progress = totalChunks > 0 ? (completedChunks.length / totalChunks) * 100 : 0;

    // 计算上传速度
    const now = Date.now();
    const timeElapsed = (now - this.startTime) / 1000; // 秒
    const speed = timeElapsed > 0 ? this.uploadedBytes / timeElapsed : 0; // 字节/秒

    // 触发进度回调
    this.onProgress(progress, this.uploadedBytes, this.totalBytes, speed);

    this.lastProgressTime = now;

    // 保存状态
    if (this.enablePersistence) {
      this._saveState();
    }
  }

  /**
   * 上传单个分片（带重试机制）
   * @param {Object} chunk - 分片对象
   * @returns {Promise<void>}
   */
  async _uploadSingleChunk(chunk) {
    if (chunk.status === "completed") {
      return; // 已完成，跳过
    }

    chunk.status = "uploading";

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (this.isAborted || this.isPaused) {
        chunk.status = "pending";
        throw new Error("上传已取消或暂停");
      }

      try {
        const result = await this._uploadChunkAttempt(chunk);

        // 上传成功
        chunk.status = "completed";
        chunk.etag = result.etag;
        chunk.uploadedBytes = chunk.size;
        chunk.retryCount = attempt;

        this.completedChunks.add(chunk.partNumber);
        this.onPartComplete(chunk.partNumber, result.etag);

        return;
      } catch (error) {
        chunk.retryCount = attempt;

        if (attempt === this.maxRetries) {
          // 最后一次重试失败
          chunk.status = "failed";
          this.failedChunks.set(chunk.partNumber, attempt);
          this.onError(error, chunk.partNumber);
          throw error;
        } else {
          // 等待后重试
          console.warn(`分片 ${chunk.partNumber} 第 ${attempt + 1} 次上传失败，将重试:`, error.message);
          if (this.retryDelay > 0) {
            await this._delay(this.retryDelay * (attempt + 1)); // 指数退避
          }
        }
      }
    }
  }

  /**
   * 单次分片上传尝试
   * @param {Object} chunk - 分片对象
   * @returns {Promise<Object>} 上传结果
   * @private
   */
  async _uploadChunkAttempt(chunk) {
    return new Promise((resolve, reject) => {
      if (this.isAborted || this.isPaused) {
        reject(new Error("上传已取消或暂停"));
        return;
      }

      // 创建分片数据
      const chunkData = this.file.slice(chunk.start, chunk.end);
      const xhr = new XMLHttpRequest();

      // 保存XHR引用以便取消
      this.activeXhrs.set(chunk.partNumber, xhr);

      xhr.open("PUT", chunk.presignedUrl);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.timeout = 300000; // 5分钟超时

      xhr.onload = () => {
        this.activeXhrs.delete(chunk.partNumber);

        if (xhr.status >= 200 && xhr.status < 300) {
          const etag = xhr.getResponseHeader("ETag");
          resolve({
            partNumber: chunk.partNumber,
            etag: etag ? etag.replace(/"/g, "") : null,
          });
        } else {
          reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => {
        this.activeXhrs.delete(chunk.partNumber);
        reject(new Error("网络错误"));
      };

      xhr.ontimeout = () => {
        this.activeXhrs.delete(chunk.partNumber);
        reject(new Error("上传超时"));
      };

      xhr.onabort = () => {
        this.activeXhrs.delete(chunk.partNumber);
        reject(new Error("上传已取消"));
      };

      xhr.send(chunkData);
    });
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise<void>}
   * @private
   */
  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 中止上传
   */
  abort() {
    this.isAborted = true;
    this._setState("aborted");

    // 中止所有活动的XHR请求
    for (const [partNumber, xhr] of this.activeXhrs) {
      try {
        xhr.abort();
      } catch (error) {
        console.warn(`中止分片 ${partNumber} 请求失败:`, error);
      }
    }

    this.activeXhrs.clear();

    // 更新分片状态
    this.chunks.forEach((chunk) => {
      if (chunk.status === "uploading") {
        chunk.status = "pending";
      }
    });
  }

  /**
   * 重置状态
   */
  reset() {
    this.abort();

    // 重置所有状态
    this.chunks = [];
    this.completedChunks.clear();
    this.failedChunks.clear();
    this.uploadedBytes = 0;
    this.startTime = null;
    this.lastProgressTime = null;

    this.file = null;
    this.uploadId = null;
    this.presignedUrls = [];
    this.identifier = null;

    this.isAborted = false;
    this.isPaused = false;
    this._setState("idle");

    // 清除持久化状态
    this.clearPersistedState();
  }

  /**
   * 获取上传统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const completedChunks = this.chunks.filter((chunk) => chunk.status === "completed");
    const failedChunks = this.chunks.filter((chunk) => chunk.status === "failed");
    const uploadingChunks = this.chunks.filter((chunk) => chunk.status === "uploading");
    const pendingChunks = this.chunks.filter((chunk) => chunk.status === "pending");

    const timeElapsed = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
    const speed = timeElapsed > 0 ? this.uploadedBytes / timeElapsed : 0;
    const progress = this.totalBytes > 0 ? (this.uploadedBytes / this.totalBytes) * 100 : 0;

    return {
      state: this.state,
      progress: Math.round(progress * 100) / 100,
      totalBytes: this.totalBytes,
      uploadedBytes: this.uploadedBytes,
      speed: Math.round(speed),
      timeElapsed: Math.round(timeElapsed),
      totalChunks: this.chunks.length,
      completedChunks: completedChunks.length,
      failedChunks: failedChunks.length,
      uploadingChunks: uploadingChunks.length,
      pendingChunks: pendingChunks.length,
      retryCount: Array.from(this.failedChunks.values()).reduce((sum, count) => sum + count, 0),
    };
  }

  /**
   * 检查是否可以恢复上传
   * @returns {boolean} 是否可以恢复
   */
  canResume() {
    return this.state === "paused" || this.state === "failed";
  }

  /**
   * 检查是否正在上传
   * @returns {boolean} 是否正在上传
   */
  isUploading() {
    return this.state === "uploading";
  }

  /**
   * 检查是否已完成
   * @returns {boolean} 是否已完成
   */
  isCompleted() {
    return this.state === "completed";
  }

  /**
   * 获取失败的分片列表
   * @returns {Array} 失败的分片编号列表
   */
  getFailedChunks() {
    return Array.from(this.failedChunks.keys());
  }
}
