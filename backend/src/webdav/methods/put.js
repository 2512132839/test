/**
 * 处理WebDAV PUT请求
 * 用于上传文件内容
 */
import { MountManager } from "../../storage/managers/MountManager.js";
import { FileSystem } from "../../storage/fs/FileSystem.js";
import { getMimeTypeFromFilename } from "../../utils/fileUtils.js";
import { handleWebDAVError } from "../utils/errorUtils.js";
import { clearDirectoryCache } from "../../cache/index.js";
import { getSettingsByGroup } from "../../services/systemService.js";
import { Upload } from "@aws-sdk/lib-storage";

import { getLockManager } from "../utils/LockManager.js";
import { checkLockPermission } from "../utils/lockUtils.js";

// 流式上传配置
const STREAMING_PART_SIZE = 7 * 1024 * 1024; // 5MB分片大小
const STREAMING_QUEUE_SIZE = 1; // 2个并发分片

/**
 * 真正的流式上传 - 使用AWS SDK Upload类
 * @param {ReadableStream} stream - 输入流
 * @param {Object} uploadContext - 上传上下文
 * @param {FileSystem} fileSystem - 文件系统实例
 * @param {Object} options - 选项参数
 * @returns {Promise<Object>} 上传结果
 */
async function trueStreamingUpload(stream, uploadContext, fileSystem, options = {}) {
    const { contentLength = 0, contentType = "application/octet-stream", path, userIdOrInfo, userType } = options;

    try {


        console.log(`WebDAV PUT - 开始流式上传，文件大小: ${(contentLength / (1024 * 1024)).toFixed(2)}MB`);

        // 通过FileSystem获取正确的driver和s3Client
        const { driver } = await fileSystem.mountManager.getDriverByPath(path, userIdOrInfo, userType);

        if (!driver.s3Client) {
            throw new Error("无法获取S3客户端实例");
        }

        console.log(`WebDAV PUT - 获取S3客户端成功，驱动类型: ${driver.getType()}`);

        // 从driver配置中获取bucket信息
        const bucketName = driver.config.bucket_name;
        if (!bucketName) {
            throw new Error("无法获取S3 bucket名称");
        }

        console.log(`WebDAV PUT - 使用S3 bucket: ${bucketName}, key: ${uploadContext.key}`);

        // 创建Upload实例 - CPU优化配置
        const upload = new Upload({
            client: driver.s3Client,
            params: {
                Bucket: bucketName,
                Key: uploadContext.key,
                Body: stream, // 直接传递ReadableStream！
                ContentType: contentType,
            },
            // 平衡CPU优化配置 - 基于内存限制分析
            queueSize: STREAMING_QUEUE_SIZE, // 使用配置的并发数
            partSize: STREAMING_PART_SIZE, // 使用配置的分片大小
            leavePartsOnError: false, // 出错时自动清理分片
        });

        // 监听上传进度 - 减少日志频率以降低CPU消耗
        let lastProgressLog = 0;
        upload.on("httpUploadProgress", (progress) => {
            const { loaded = 0, total = contentLength } = progress;

            // 每100MB记录一次进度，进一步减少CPU消耗
            const REDUCED_LOG_INTERVAL = 100 * 1024 * 1024; // 100MB
            if (loaded - lastProgressLog >= REDUCED_LOG_INTERVAL) {
                const progressMB = (loaded / (1024 * 1024)).toFixed(2);
                const totalMB = total > 0 ? (total / (1024 * 1024)).toFixed(2) : "未知";
                const percentage = total > 0 ? ((loaded / total) * 100).toFixed(1) : "未知";
                console.log(`WebDAV PUT - 流式上传进度: ${progressMB}MB / ${totalMB}MB (${percentage}%)`);
                lastProgressLog = loaded;
            }
        });

        // 执行上传
        const startTime = Date.now();
        const result = await upload.done();
        const duration = Date.now() - startTime;
        const speedMBps = contentLength > 0 ? (contentLength / 1024 / 1024 / (duration / 1000)).toFixed(2) : "未知";

        console.log(`WebDAV PUT - 流式上传完成，用时: ${duration}ms，平均速度: ${speedMBps}MB/s`);

        return {
            result,
            totalProcessed: contentLength,
            partCount: Math.ceil(contentLength / STREAMING_PART_SIZE) || 1,
        };
    } catch (error) {
        console.error("WebDAV PUT - 流式上传失败:", error);
        throw error;
    }
}

/**
 * 检查大小差异是否可接受
 * @param {number} actual - 实际大小
 * @param {number} declared - 声明大小
 * @returns {boolean} 是否可接受
 */
function checkSizeDifference(actual, declared) {
    if (declared === 0) return true;
    const difference = Math.abs(actual - declared);
    const percentage = (difference / declared) * 100;
    return percentage <= 5; // 允许5%的差异
}

/**
 * 获取WebDAV上传模式设置
 * @param {D1Database} db - 数据库实例
 * @returns {Promise<string>} 上传模式 ('direct' 或 'multipart')
 */
async function getWebDAVUploadMode(db) {
    try {
        // WebDAV设置组ID为3
        const settings = await getSettingsByGroup(db, 3, false);
        const uploadModeSetting = settings.find((setting) => setting.key === "webdav_upload_mode");
        return uploadModeSetting ? uploadModeSetting.value : "multipart"; // 默认分片上传
    } catch (error) {
        console.warn("获取WebDAV上传模式设置失败，使用默认值:", error);
        return "multipart"; // 默认分片上传
    }
}

/**
 * 处理PUT请求
 * @param {Object} c - Hono上下文
 * @param {string} path - 请求路径
 * @param {string} userId - 用户ID
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {D1Database} db - D1数据库实例
 */
export async function handlePut(c, path, userId, userType, db) {
    const requestStartTime = Date.now();

    try {
        // 获取加密密钥
        const encryptionSecret = c.env.ENCRYPTION_SECRET;
        if (!encryptionSecret) {
            throw new Error("缺少加密密钥配置");
        }

        // 创建挂载管理器和文件系统
        const mountManager = new MountManager(db, encryptionSecret);
        const fileSystem = new FileSystem(mountManager);

        // 获取WebDAV上传模式设置
        const uploadMode = await getWebDAVUploadMode(db);
        console.log(`WebDAV PUT - 使用配置的上传模式: ${uploadMode}`);

        // 检查锁定状态
        const lockManager = getLockManager();
        const lockInfo = await lockManager.getLock(path);
        if (lockInfo && !checkLockPermission(lockInfo, userId, userType)) {
            return new Response(null, {
                status: 423, // Locked
                headers: { "Content-Type": "text/plain" },
            });
        }

        // 获取请求头信息
        const contentLengthHeader = c.req.header("content-length");
        const contentType = c.req.header("content-type") || getMimeTypeFromFilename(path);
        const declaredContentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

        console.log(`WebDAV PUT - 开始处理: ${path}, 声明大小: ${declaredContentLength} 字节, 类型: ${contentType}`);

        // 获取请求体流
        const bodyStream = c.req.body;
        if (!bodyStream) {
            throw new Error("请求体为空");
        }

        const filename = path.split("/").pop();

        // 优化：使用 Content-Length 头部判断空文件，避免流重构的 CPU 开销
        if (declaredContentLength === 0) {
            console.log(`WebDAV PUT - 检测到0字节文件（基于Content-Length），使用FileSystem直接上传`);

            // 创建一个空的File对象
            const emptyFile = new File([""], filename, { type: contentType });

            // 使用FileSystem上传空文件
            const result = await fileSystem.uploadFile(path, emptyFile, userId, userType, {
                useMultipart: false,
            });

            // 清理缓存
            const { mount } = await mountManager.getDriverByPath(path, userId, userType);
            if (mount) {
                await clearDirectoryCache({ mountId: mount.id });
            }

            console.log(`WebDAV PUT - 空文件上传成功`);

            return new Response(null, {
                status: 201, // Created
                headers: {
                    "Content-Type": "text/plain",
                    "Content-Length": "0",
                },
            });
        }

        // 直接使用原始流，不进行重构
        const processedStream = bodyStream;

        // 根据配置决定上传模式
        if (uploadMode === "direct") {
            console.log(`WebDAV PUT - 使用直接上传模式`);

            // 读取完整数据到内存
            const reader = processedStream.getReader();
            const chunks = [];
            let bytesRead = 0;

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                    bytesRead += value.length;
                }
            } finally {
                reader.releaseLock();
            }

            // 合并数据
            const fileData = new Uint8Array(bytesRead);
            let offset = 0;
            for (const chunk of chunks) {
                fileData.set(chunk, offset);
                offset += chunk.length;
            }

            console.log(`WebDAV PUT - 开始直接上传 ${bytesRead} 字节到FileSystem`);

            // 创建File对象
            const file = new File([fileData], filename, { type: contentType });

            // 使用FileSystem直接上传
            const result = await fileSystem.uploadFile(path, file, userId, userType, {
                useMultipart: false,
            });

            // 清理缓存
            const { mount } = await mountManager.getDriverByPath(path, userId, userType);
            if (mount) {
                await clearDirectoryCache({ mountId: mount.id });
            }

            console.log(`WebDAV PUT - 直接上传成功`);

            return new Response(null, {
                status: 201, // Created
                headers: {
                    "Content-Type": "text/plain",
                    "Content-Length": "0",
                },
            });
        } else {
            // 使用分片上传模式（流式上传）
            console.log(`WebDAV PUT - 文件名: ${filename}, 开始流式分片上传模式`);

            try {
                // 获取driver来构建S3 key
                const { driver, mount, subPath } = await fileSystem.mountManager.getDriverByPath(path, userId, userType);

                // 使用S3StorageDriver的_normalizeFilePath方法构建正确的S3 key
                const s3Key = driver._normalizeFilePath(subPath, path, filename);

                console.log(`WebDAV PUT - 使用S3 key: ${s3Key}`);

                // 直接调用真正的流式上传
                const streamingContext = {
                    key: s3Key,
                };

                const streamingOptions = {
                    contentLength: declaredContentLength,
                    contentType,
                    path: path,
                    userIdOrInfo: userId,
                    userType: userType,
                };

                const uploadResult = await trueStreamingUpload(processedStream, streamingContext, fileSystem, streamingOptions);

                const { result: completeResult, totalProcessed, partCount } = uploadResult;

                // 检查上传数据是否完整
                if (declaredContentLength > 0 && totalProcessed < declaredContentLength) {
                    const acceptable = checkSizeDifference(totalProcessed, declaredContentLength);
                    if (!acceptable) {
                        console.warn(`WebDAV PUT - 警告：文件数据不完整，声明大小：${declaredContentLength}字节，实际上传：${totalProcessed}字节`);
                    }
                }

                // 清理缓存
                if (mount) {
                    await clearDirectoryCache({ mountId: mount.id });
                }

                const totalDuration = Date.now() - requestStartTime;
                const avgSpeedMBps = totalProcessed > 0 ? (totalProcessed / 1024 / 1024 / (totalDuration / 1000)).toFixed(2) : "未知";

                console.log(`WebDAV PUT - 分片上传完成，${partCount}个分片，总用时: ${Math.round(totalDuration / 1000)}秒，平均速度: ${avgSpeedMBps}MB/s`);

                return new Response(null, {
                    status: 201, // Created
                    headers: {
                        "Content-Type": "text/plain",
                        "Content-Length": "0",
                    },
                });
            } catch (error) {
                console.error(`WebDAV PUT - 流式上传失败: ${error.message}`);
                throw error;
            }
        }
    } catch (error) {
        console.error(`WebDAV PUT - 处理失败: ${error.message}`);
        return handleWebDAVError(error, `PUT ${path}`);
    }
}
