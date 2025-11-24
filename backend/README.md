# CloudPaste `/api/upload-direct/:filename` 直传接口（storage-first）

## 接口概述

`PUT /api/upload-direct/:filename` 负责“上传即分享”：客户端上传二进制内容，服务端按“存储优先（storage-first）”直接驱动上传，随后写入分享记录并生成直链/代理 URL。不经挂载路径权限校验。

- 上传成功立即返回分享元数据（slug、预览/下载 URL、密码状态等）。
- 使用 `path` + `filename` 来定位存储路径；未提供 `path` 时自动选取当前 principal 可访问的首个挂载点根目录。

## 请求方法

- **HTTP 方法**: `PUT`

## URL 格式 

```
https://{域名}/api/upload-direct/example.txt?path=images
```

## 查询参数

| 参数名            | 类型   | 必填 | 默认值   | 描述                                                                                        |
| ----------------- | ------ | ---- | -------- | ------------------------------------------------------------------------------------------- |
| path              | string | 否   | 空       | 目标目录（存储内相对目录，非挂载路径）。                                              |
| slug              | string | 否   | 自动生成 | 自定义短链接，允许字母/数字/下划线/横杠。                                                   |
| expires_in        | number | 否   | 0        | 链接过期时间（小时）。0 表示永不过期。                                                      |
| max_views         | number | 否   | 0        | 最大查看次数。0 表示无限制。                                                                |
| remark            | string | 否   | 空       | 备注信息。                                                                                  |
| password          | string | 否   | 空       | 访问密码，返回的代理 URL 会自动携带 `password` 查询参数。                                   |
| use_proxy         | string | 否   | "0"      | 是否使用代理访问。缺省为直链（"0"），传 "1" 可强制走代理。                                      |
| override          | string | 否   | "false"  | 是否覆盖同名 slug 的历史记录，仅限覆盖自己创建的文件。                                      |
| original_filename | string | 否   | "false"  | 是否使用原始文件名写入；为 `false` 时会附加随机前缀避免冲突。                                |
| storage_config_id | string | 否   | 默认配置 | 指定存储配置ID；不提供时使用默认。                                                          |

## 请求头

| 头名称            | 必填 | 描述                                                                 |
| ----------------- | ---- | -------------------------------------------------------------------- |
| Content-Type      | 否   | 文件 MIME 类型。留空或 `application/octet-stream` 时依据扩展名推断。 |
| Authorization     | 否\* | Bearer 管理员令牌或 `ApiKey`。至少提供一种认证方式。                             |
| X-Custom-Auth-Key | 否\* | API Key 认证的备用请求头。                                                |

\* 必须提供至少一种认证方式。

## 请求体

请求体为文件二进制内容，可通过 `curl --data-binary`, `fetch`, `axios` 流式上传等方式发送。

## 响应示例

```json
{
  "code": 200,
  "message": "文件上传成功",
  "data": {
    "id": "file_xxxxx",
    "slug": "example",
    "filename": "example.jpg",
    "mimetype": "image/jpeg",
    "size": 12345,
    "remark": "示例文件",
    "created_at": "2023-01-01T12:00:00.000Z",
    "requires_password": false,
    "views": 0,
    "max_views": null,
    "expires_at": null,
    "previewUrl": "https://proxy/...",
    "downloadUrl": "https://proxy/...",
    "publicUrl": "https://storage/...",
    "proxy_preview_url": "https://proxy/...",
    "proxy_download_url": "https://proxy/...",
    "use_proxy": 1,
    "created_by": "admin:1",
    "used_original_filename": true
  },
  "success": true
}
```

> 当设置 `password` 时，返回的代理 URL 会追加 `password` 查询参数，方便一次性分享；预签名直链不包含密码以免失效。

## 授权方式

1. **Bearer 令牌**：`Authorization: Bearer {admin_token}`
2. **API Key**：`Authorization: ApiKey {api_key}`
3. **自定义头**：`X-Custom-Auth-Key: {api_key}`

## 调用示例

```bash
# 基础上传
curl -X PUT "https://your-domain.com/api/upload-direct/example.txt?path=images" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: text/plain" \
  --data-binary "这是一个测试文件内容"

# 自定义 slug + 密码 + 有效期
curl -X PUT "https://your-domain.com/api/upload-direct/confidential.pdf?slug=secret&password=123456&expires_in=24" \
  -H "Authorization: ApiKey YOUR_API_KEY" \
  -H "Content-Type: application/pdf" \
  --data-binary @/path/to/confidential.pdf

# 设置最大查看次数与备注
curl -X PUT "https://your-domain.com/api/upload-direct/image.jpg?path=tmp&max_views=5&remark=一次性查看" \
  -H "X-Custom-Auth-Key: YOUR_API_KEY" \
  -H "Content-Type: image/jpeg" \
  --data-binary @/path/to/image.jpg

# 使用原始文件名
curl -X PUT "https://your-domain.com/api/upload-direct/important.docx?original_filename=true" \
  -H "Authorization: ApiKey YOUR_API_KEY" \
  -H "Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document" \
  --data-binary @/path/to/important.docx
```

## 注意事项

1. 返回的预签名直链有效期由存储配置 `signature_expires_in` 决定，默认 1 小时。
2. 所有上传路径均通过 FileSystem → 驱动实现；无需直接调用 S3 SDK。
3. `override=true` 会删除旧对象、旧密码记录并触发缓存失效。
4. `fs.upload` 策略与 API Key 的 basicPath 限制仍然生效，越权路径会被拒绝。
