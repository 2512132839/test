/**
 * 处理WebDAV GET请求
 * 用于获取文件内容
 */
import { findMountPointByPath, normalizeS3SubPath, updateMountLastUsed } from "../utils/webdavUtils.js";
import { createS3Client } from "../../utils/s3Utils.js";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { handleWebDAVError, createWebDAVErrorResponse } from "../utils/errorUtils.js";
import { getMimeTypeFromFilename } from "../../utils/fileUtils.js";

/**
 * 处理GET请求
 * @param {Object} c - Hono上下文
 * @param {string} path - 请求路径
 * @param {string} userId - 用户ID
 * @param {string} userType - 用户类型 (admin 或 apiKey)
 * @param {D1Database} db - D1数据库实例
 */
export async function handleGet(c, path, userId, userType, db) {
  const isHead = c.req.method === "HEAD";

  try {
    // 使用统一函数查找挂载点 - GET/HEAD使用读取权限
    const mountResult = await findMountPointByPath(db, path, userId, userType, "read");

    // 处理错误情况
    if (mountResult.error) {
      return createWebDAVErrorResponse(mountResult.error.message, mountResult.error.status);
    }

    const { mount, subPath } = mountResult;

    // 获取挂载点对应的S3配置
    const s3Config = await db.prepare("SELECT * FROM s3_configs WHERE id = ?").bind(mount.storage_config_id).first();

    if (!s3Config) {
      return createWebDAVErrorResponse("存储配置不存在", 404);
    }

    // 创建S3客户端
    const s3Client = await createS3Client(s3Config, c.env.ENCRYPTION_SECRET);

    // 规范化S3子路径 (文件不添加斜杠)
    const s3SubPath = normalizeS3SubPath(subPath, s3Config, false);

    // 更新最后使用时间
    await updateMountLastUsed(db, mount.id);

    // 检查对象是否存在
    try {
      const headParams = {
        Bucket: s3Config.bucket_name,
        Key: s3SubPath,
      };

      const headCommand = new HeadObjectCommand(headParams);
      const headResponse = await s3Client.send(headCommand);

      // 获取文件名并统一从文件名推断MIME类型
      const fileName = path.split("/").pop();
      const contentType = getMimeTypeFromFilename(fileName);
      console.log(`WebDAV GET - 从文件名[${fileName}]推断MIME类型: ${contentType}`);

      // 获取ETag和Last-Modified用于条件请求
      const etag = headResponse.ETag || "";
      const lastModified = headResponse.LastModified ? headResponse.LastModified : new Date();
      const lastModifiedStr = lastModified.toUTCString();

      // 处理条件请求头
      const ifNoneMatch = c.req.header("If-None-Match");
      const ifModifiedSince = c.req.header("If-Modified-Since");

      // 检查ETag匹配（如果提供了If-None-Match头）
      if (ifNoneMatch && etag) {
        // 移除引号以进行比较
        const clientEtag = ifNoneMatch.replace(/^"(.*)"$/, "$1");
        const serverEtag = etag.replace(/^"(.*)"$/, "$1");

        if (clientEtag === serverEtag || clientEtag === "*") {
          console.log(`GET请求: ETag匹配 ${etag}，返回304 Not Modified`);
          return new Response(null, {
            status: 304, // Not Modified
            headers: {
              ETag: etag,
              "Last-Modified": lastModifiedStr,
              "Cache-Control": "max-age=3600",
            },
          });
        }
      }

      // 检查修改时间（如果提供了If-Modified-Since头且没有If-None-Match头或ETag不匹配）
      if (ifModifiedSince && !ifNoneMatch) {
        try {
          const modifiedSinceDate = new Date(ifModifiedSince);

          // 将时间戳向下取整到秒，因为HTTP日期不包含毫秒
          const modifiedSinceTime = Math.floor(modifiedSinceDate.getTime() / 1000) * 1000;
          const lastModifiedTime = Math.floor(lastModified.getTime() / 1000) * 1000;

          if (lastModifiedTime <= modifiedSinceTime) {
            console.log(`GET请求: 文件未修改，返回304 Not Modified`);
            return new Response(null, {
              status: 304, // Not Modified
              headers: {
                ETag: etag,
                "Last-Modified": lastModifiedStr,
                "Cache-Control": "max-age=3600",
              },
            });
          }
        } catch (dateError) {
          console.warn(`GET请求: If-Modified-Since头格式无效: ${ifModifiedSince}`);
          // 如果日期格式无效，忽略此头，继续处理请求
        }
      }

      // 处理If-Match头（确保资源匹配）
      const ifMatch = c.req.header("If-Match");
      if (ifMatch && etag) {
        const clientEtag = ifMatch.replace(/^"(.*)"$/, "$1");
        const serverEtag = etag.replace(/^"(.*)"$/, "$1");

        if (clientEtag !== "*" && clientEtag !== serverEtag) {
          console.log(`GET请求: If-Match条件不满足 ${ifMatch} != ${etag}`);
          return createWebDAVErrorResponse("资源已被修改", 412); // Precondition Failed
        }
      }

      // 处理If-Unmodified-Since头
      const ifUnmodifiedSince = c.req.header("If-Unmodified-Since");
      if (ifUnmodifiedSince) {
        try {
          const unmodifiedSinceDate = new Date(ifUnmodifiedSince);

          // 将时间戳向下取整到秒
          const unmodifiedSinceTime = Math.floor(unmodifiedSinceDate.getTime() / 1000) * 1000;
          const lastModifiedTime = Math.floor(lastModified.getTime() / 1000) * 1000;

          if (lastModifiedTime > unmodifiedSinceTime) {
            console.log(`GET请求: If-Unmodified-Since条件不满足`);
            return createWebDAVErrorResponse("资源已被修改", 412); // Precondition Failed
          }
        } catch (dateError) {
          console.warn(`GET请求: If-Unmodified-Since头格式无效: ${ifUnmodifiedSince}`);
          // 如果日期格式无效，忽略此头，继续处理请求
        }
      }

      // 如果是HEAD请求，返回头信息
      if (isHead) {
        return new Response(null, {
          status: 200,
          headers: {
            "Content-Length": String(headResponse.ContentLength || 0),
            "Content-Type": contentType,
            "Last-Modified": lastModifiedStr,
            ETag: etag,
            "Accept-Ranges": "bytes",
            "Cache-Control": "max-age=3600",
          },
        });
      }

      // 获取文件内容
      const getParams = {
        Bucket: s3Config.bucket_name,
        Key: s3SubPath,
      };

      // 处理Range请求
      const rangeHeader = c.req.header("Range");
      let isRangeRequest = false;
      let rangeStart, rangeEnd;

      if (rangeHeader) {
        try {
          // 严格验证Range头格式
          const rangeRegex = /^bytes=(\d+)-(\d*)$/;
          const match = rangeHeader.match(rangeRegex);

          if (match) {
            const start = parseInt(match[1], 10);
            const end = match[2] ? parseInt(match[2], 10) : undefined;

            // 确保start是有效的数字且不为负
            if (!isNaN(start) && start >= 0) {
              // 如果指定了end，确保end也是有效的数字且大于等于start
              if (end !== undefined) {
                if (!isNaN(end) && end >= start) {
                  // 不再设置getParams.Range，而是记录范围信息
                  isRangeRequest = true;
                  rangeStart = start;
                  rangeEnd = end;
                  console.log(`GET请求: 有效的Range请求 bytes=${start}-${end}，将在获取响应后处理`);
                } else {
                  console.warn(`GET请求: 无效的Range结束位置 ${end}, 忽略Range请求`);
                }
              } else {
                // 只有start，没有end
                isRangeRequest = true;
                rangeStart = start;
                rangeEnd = undefined;
                console.log(`GET请求: 有效的开放Range请求 bytes=${start}-，将在获取响应后处理`);
              }
            } else {
              console.warn(`GET请求: 无效的Range起始位置 ${start}, 忽略Range请求`);
            }
          } else {
            console.warn(`GET请求: Range头格式不符合要求: ${rangeHeader}, 忽略Range请求`);
          }
        } catch (rangeError) {
          console.warn(`GET请求: 处理Range头时出错: ${rangeError.message}, 忽略Range请求`);
        }
      }

      // 记录最终的请求参数
      console.log(`GET请求: 最终S3参数:`, JSON.stringify(getParams));

      const getCommand = new GetObjectCommand(getParams);
      const getResponse = await s3Client.send(getCommand);

      // 构建响应头
      const headers = {
        "Content-Type": contentType,
        "Content-Length": String(getResponse.ContentLength || 0),
        "Last-Modified": lastModifiedStr,
        ETag: etag,
        "Accept-Ranges": "bytes",
        "Cache-Control": "max-age=3600",
      };

      // 获取完整响应体
      let responseBody = getResponse.Body;

      // 如果是范围请求，手动处理响应体的切片
      if (isRangeRequest && responseBody) {
        try {
          // 获取完整内容长度
          const totalLength = parseInt(getResponse.ContentLength || "0", 10);

          if (totalLength > 0) {
            // 计算实际范围
            const start = rangeStart;
            const end = rangeEnd !== undefined ? Math.min(rangeEnd, totalLength - 1) : totalLength - 1;

            if (start <= end && start < totalLength) {
              // 将响应体转换为ArrayBuffer以便切片
              const arrayBuffer = await getResponse.Body.arrayBuffer();
              const slicedBuffer = arrayBuffer.slice(start, end + 1);

              // 更新响应头
              const contentLength = slicedBuffer.byteLength;
              headers["Content-Length"] = String(contentLength);
              headers["Content-Range"] = `bytes ${start}-${end}/${totalLength}`;

              console.log(`GET请求: 手动处理Range请求，返回 ${start}-${end}/${totalLength} (${contentLength} 字节)`);

              // 创建新的响应体
              responseBody = new Uint8Array(slicedBuffer);

              // 返回206 Partial Content响应
              return new Response(responseBody, {
                status: 206, // Partial Content
                headers,
              });
            } else {
              console.warn(`GET请求: 请求范围 ${start}-${end} 超出有效范围 0-${totalLength - 1}，返回完整内容`);
            }
          }
        } catch (rangeError) {
          console.error(`GET请求: 处理Range响应时出错:`, rangeError);
          // 出错时回退到返回完整内容
        }
      }

      // 处理完整响应或Range处理失败时的回退
      return new Response(responseBody, {
        status: 200,
        headers,
      });
    } catch (error) {
      if (error.$metadata && error.$metadata.httpStatusCode === 404) {
        return createWebDAVErrorResponse("文件不存在", 404);
      }
      throw error;
    }
  } catch (error) {
    // 使用统一的错误处理
    return handleWebDAVError("GET", error);
  }
}
