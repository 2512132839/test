/**
 * S3上传操作模块
 * 负责文件上传相关操作：直接上传、分片上传（前端分片）、预签名上传等
 */

import { HTTPException } from "hono/http-exception";
import { ApiStatus } from "../../../../constants/index.js";
import { generatePresignedPutUrl, buildS3Url } from "../../../../utils/s3Utils.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { updateMountLastUsed } from "../../../fs/utils/MountResolver.js";
import { getMimeTypeFromFilename } from "../../../../utils/fileUtils.js";

import { clearCache } from "../../../../utils/DirectoryCache.js";
import { handleFsError } from "../../../fs/utils/ErrorHandler.js";
import { updateParentDirectoriesModifiedTime } from "../utils/S3DirectoryUtils.js";

export class S3UploadOperations {
    /**
     * 构造函数
     * @param {S3Client} s3Client - S3客户端
     * @param {Object} config - S3配置
     * @param {string} encryptionSecret - 加密密钥
     */
    constructor(s3Client, config, encryptionSecret) {
        this.s3Client = s3Client;
        this.config = config;
        this.encryptionSecret = encryptionSecret;
    }

    /**
     * 直接上传文件
     * @param {string} s3SubPath - S3子路径
     * @param {File} file - 文件对象
     * @param {Object} options - 选项参数
     * @returns {Promise<Object>} 上传结果
     */
    async uploadFile(s3SubPath, file, options = {}) {
        const { mount, db } = options;

        return handleFsError(
            async () => {
                // 统一从文件名推断MIME类型，不依赖file.type
                const contentType = getMimeTypeFromFilename(file.name);
                console.log(`直接上传：从文件名[${file.name}]推断MIME类型: ${contentType}`);

                // 构建最终的S3路径
                const fileName = file.name;
                let finalS3Path;

                // 检查s3SubPath是否已经包含完整的文件路径
                // 如果s3SubPath以文件名结尾，说明它已经是完整的文件路径，直接使用
                if (s3SubPath && s3SubPath.endsWith(fileName)) {
                    // s3SubPath已经包含完整的文件路径，直接使用
                    finalS3Path = s3SubPath;
                } else {
                    // s3SubPath是目录路径，需要拼接文件名
                    if (s3SubPath && !s3SubPath.endsWith("/")) {
                        finalS3Path = s3SubPath + "/" + fileName;
                    } else {
                        finalS3Path = s3SubPath + fileName;
                    }
                }

                console.log(`构建S3路径: subPath=[${s3SubPath}], fileName=[${fileName}], finalPath=[${finalS3Path}]`);

                // 读取文件内容
                const fileContent = await file.arrayBuffer();

                // 准备上传参数
                const putParams = {
                    Bucket: this.config.bucket_name,
                    Key: finalS3Path,
                    Body: fileContent,
                    ContentType: contentType,
                };

                // 执行上传
                const putCommand = new PutObjectCommand(putParams);
                const result = await this.s3Client.send(putCommand);

                // 构建S3 URL
                const { buildS3Url } = await import("../../../../utils/s3Utils.js");
                const s3Url = buildS3Url(this.config, finalS3Path);

                // 更新父目录的修改时间
                const { updateParentDirectoriesModifiedTime } = await import("../utils/S3DirectoryUtils.js");
                await updateParentDirectoriesModifiedTime(this.s3Client, this.config.bucket_name, finalS3Path);

                // 更新最后使用时间
                if (db && mount.id) {
                    await updateMountLastUsed(db, mount.id);
                }

                // 清除缓存
                if (mount) {
                    await clearCache({ mountId: mount.id });
                }

                return {
                    success: true,
                    fileName: fileName,
                    size: file.size,
                    contentType: contentType,
                    s3Path: finalS3Path,
                    s3Url: s3Url,
                    etag: result.ETag ? result.ETag.replace(/"/g, "") : null,
                    message: "文件上传成功",
                };
            },
            "上传文件",
            "上传文件失败"
        );
    }

    /**
     * 生成预签名上传URL
     * @param {string} s3SubPath - S3子路径
     * @param {Object} options - 选项参数
     * @returns {Promise<Object>} 预签名上传URL信息
     */
    async generatePresignedUploadUrl(s3SubPath, options = {}) {
        const { fileName, fileSize, expiresIn = 3600 } = options;

        return handleFsError(
            async () => {
                // 推断MIME类型
                const contentType = getMimeTypeFromFilename(fileName);

                const presignedUrl = await generatePresignedPutUrl(this.config, s3SubPath, contentType, this.encryptionSecret, expiresIn);

                // 生成S3直接访问URL
                const s3Url = buildS3Url(this.config, s3SubPath);

                return {
                    success: true,
                    uploadUrl: presignedUrl,
                    s3Url: s3Url,
                    contentType: contentType,
                    expiresIn: expiresIn,
                    s3Path: s3SubPath,
                    fileName: fileName,
                    fileSize: fileSize,
                };
            },
            "生成预签名上传URL",
            "生成预签名上传URL失败"
        );
    }

    /**
     * 处理上传完成后的操作
     * @param {string} s3SubPath - S3子路径
     * @param {Object} options - 选项参数
     * @returns {Promise<Object>} 处理结果
     */
    async handleUploadComplete(s3SubPath, options = {}) {
        const { mount, db, fileName, fileSize, contentType, etag } = options;

        try {
            // 更新父目录的修改时间
            const rootPrefix = this.config.root_prefix ? (this.config.root_prefix.endsWith("/") ? this.config.root_prefix : this.config.root_prefix + "/") : "";
            await updateParentDirectoriesModifiedTime(this.s3Client, this.config.bucket_name, s3SubPath, rootPrefix);

            // 更新最后使用时间
            if (db && mount.id) {
                await updateMountLastUsed(db, mount.id);
            }

            // 清除缓存
            if (mount) {
                await clearCache({ mountId: mount.id });
            }

            // 构建S3 URL
            const s3Url = buildS3Url(this.config, s3SubPath);

            return {
                success: true,
                message: "上传完成处理成功",
                fileName: fileName,
                size: fileSize,
                contentType: contentType,
                s3Path: s3SubPath,
                s3Url: s3Url,
                etag: etag ? etag.replace(/"/g, "") : null,
            };
        } catch (error) {
            console.error("处理上传完成失败:", error);
            throw new HTTPException(ApiStatus.INTERNAL_ERROR, {
                message: `处理上传完成失败: ${error.message}`,
            });
        }
    }

    /**
     * 取消上传操作
     * @param {string} s3SubPath - S3子路径
     * @param {Object} options - 选项参数
     * @returns {Promise<Object>} 取消结果
     */
    async cancelUpload(s3SubPath, options = {}) {
        const { uploadId } = options;

        try {
            if (uploadId) {
                // 取消分片上传
                const { AbortMultipartUploadCommand } = await import("@aws-sdk/client-s3");
                const abortParams = {
                    Bucket: this.config.bucket_name,
                    Key: s3SubPath,
                    UploadId: uploadId,
                };

                const abortCommand = new AbortMultipartUploadCommand(abortParams);
                await this.s3Client.send(abortCommand);
            }

            return {
                success: true,
                message: "上传已取消",
            };
        } catch (error) {
            console.error("取消上传失败:", error);
            throw new HTTPException(ApiStatus.INTERNAL_ERROR, {
                message: `取消上传失败: ${error.message}`,
            });
        }
    }

    /**
     * 初始化前端分片上传（生成预签名URL列表）
     * @param {string} s3SubPath - S3子路径
     * @param {Object} options - 选项参数
     * @returns {Promise<Object>} 初始化结果
     */
    async initializeFrontendMultipartUpload(s3SubPath, options = {}) {
        const { fileName, fileSize, partSize = 5 * 1024 * 1024, partCount, mount, db } = options;

        return handleFsError(
            async () => {
                // 推断MIME类型
                const contentType = getMimeTypeFromFilename(fileName);
                console.log(`初始化前端分片上传：从文件名[${fileName}]推断MIME类型: ${contentType}`);

                // 构建最终的S3路径
                let finalS3Path;

                // 检查s3SubPath是否已经包含完整的文件路径
                if (s3SubPath && s3SubPath.endsWith(fileName)) {
                    // s3SubPath已经是完整的文件路径，直接使用
                    finalS3Path = s3SubPath;
                } else if (s3SubPath && !s3SubPath.endsWith("/")) {
                    // s3SubPath是目录路径，需要拼接文件名
                    finalS3Path = s3SubPath + "/" + fileName;
                } else {
                    // s3SubPath为空或以斜杠结尾，直接拼接文件名
                    finalS3Path = s3SubPath + fileName;
                }

                // 创建分片上传
                const { CreateMultipartUploadCommand } = await import("@aws-sdk/client-s3");
                const createCommand = new CreateMultipartUploadCommand({
                    Bucket: this.config.bucket_name,
                    Key: finalS3Path,
                    ContentType: contentType,
                });

                const createResponse = await this.s3Client.send(createCommand);
                const uploadId = createResponse.UploadId;

                // 计算分片数量
                const calculatedPartCount = partCount || Math.ceil(fileSize / partSize);

                // 生成预签名URL列表
                const presignedUrls = [];
                const { UploadPartCommand } = await import("@aws-sdk/client-s3");

                for (let partNumber = 1; partNumber <= calculatedPartCount; partNumber++) {
                    const uploadPartCommand = new UploadPartCommand({
                        Bucket: this.config.bucket_name,
                        Key: finalS3Path,
                        UploadId: uploadId,
                        PartNumber: partNumber,
                    });

                    // 生成预签名URL
                    const presignedUrl = await getSignedUrl(this.s3Client, uploadPartCommand, {
                        expiresIn: this.config.signature_expires_in || 3600,
                    });

                    presignedUrls.push({
                        partNumber: partNumber,
                        url: presignedUrl,
                    });
                }

                // 更新最后使用时间
                if (db && mount.id) {
                    await updateMountLastUsed(db, mount.id);
                }

                return {
                    uploadId: uploadId,
                    bucket: this.config.bucket_name,
                    key: finalS3Path,
                    partSize: partSize,
                    partCount: calculatedPartCount,
                    presignedUrls: presignedUrls,
                    mount_id: mount ? mount.id : null,
                    path: mount ? mount.mount_path + s3SubPath : s3SubPath,
                    storage_type: mount ? mount.storage_type : "S3",
                };
            },
            "初始化前端分片上传",
            "初始化前端分片上传失败"
        );
    }

    /**
     * 完成前端分片上传
     * @param {string} s3SubPath - S3子路径
     * @param {Object} options - 选项参数
     * @returns {Promise<Object>} 完成结果
     */
    async completeFrontendMultipartUpload(s3SubPath, options = {}) {
        const { uploadId, parts, fileName, fileSize, mount, db } = options;

        return handleFsError(
            async () => {
                // 构建最终的S3路径
                let finalS3Path;

                // 检查s3SubPath是否已经包含完整的文件路径
                if (s3SubPath && s3SubPath.endsWith(fileName)) {
                    // s3SubPath已经是完整的文件路径，直接使用
                    finalS3Path = s3SubPath;
                } else if (s3SubPath && !s3SubPath.endsWith("/")) {
                    // s3SubPath是目录路径，需要拼接文件名
                    finalS3Path = s3SubPath + "/" + fileName;
                } else {
                    // s3SubPath为空或以斜杠结尾，直接拼接文件名
                    finalS3Path = s3SubPath + fileName;
                }

                // 确保parts按照partNumber排序
                const sortedParts = [...parts].sort((a, b) => a.partNumber - b.partNumber);

                // 完成分片上传
                const { CompleteMultipartUploadCommand } = await import("@aws-sdk/client-s3");
                const completeCommand = new CompleteMultipartUploadCommand({
                    Bucket: this.config.bucket_name,
                    Key: finalS3Path,
                    UploadId: uploadId,
                    MultipartUpload: {
                        Parts: sortedParts.map((part) => ({
                            PartNumber: part.partNumber,
                            ETag: part.etag,
                        })),
                    },
                });

                const completeResponse = await this.s3Client.send(completeCommand);

                // 更新最后使用时间
                if (db && mount.id) {
                    await updateMountLastUsed(db, mount.id);
                }

                // 清除缓存
                if (mount) {
                    await clearCache({ mountId: mount.id });
                }

                // 推断MIME类型
                const contentType = getMimeTypeFromFilename(fileName);

                // 构建S3 URL
                const s3Url = buildS3Url(this.config, finalS3Path);

                // 文件上传完成，无需数据库操作

                return {
                    success: true,
                    fileName: fileName,
                    size: fileSize,
                    contentType: contentType,
                    s3Path: finalS3Path,
                    s3Url: s3Url,
                    etag: completeResponse.ETag ? completeResponse.ETag.replace(/"/g, "") : null,
                    location: completeResponse.Location,
                    message: "前端分片上传完成",
                };
            },
            "完成前端分片上传",
            "完成前端分片上传失败"
        );
    }

    /**
     * 中止前端分片上传
     * @param {string} s3SubPath - S3子路径
     * @param {Object} options - 选项参数
     * @returns {Promise<Object>} 中止结果
     */
    async abortFrontendMultipartUpload(s3SubPath, options = {}) {
        const { uploadId, fileName, mount, db } = options;

        return handleFsError(
            async () => {
                // 构建最终的S3路径（包含文件名）
                let finalS3Path;
                if (s3SubPath && !s3SubPath.endsWith("/")) {
                    finalS3Path = s3SubPath + "/" + fileName;
                } else {
                    finalS3Path = s3SubPath + fileName;
                }

                console.log(`中止前端分片上传: Bucket=${this.config.bucket_name}, Key=${finalS3Path}, UploadId=${uploadId}`);

                // 中止分片上传
                const { AbortMultipartUploadCommand } = await import("@aws-sdk/client-s3");
                const abortCommand = new AbortMultipartUploadCommand({
                    Bucket: this.config.bucket_name,
                    Key: finalS3Path,
                    UploadId: uploadId,
                });

                await this.s3Client.send(abortCommand);

                // 更新最后使用时间
                if (db && mount.id) {
                    await updateMountLastUsed(db, mount.id);
                }

                return {
                    success: true,
                    message: "前端分片上传已中止",
                };
            },
            "中止前端分片上传",
            "中止前端分片上传失败"
        );
    }
}
