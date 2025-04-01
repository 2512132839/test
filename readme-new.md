# CloudPaste 部署指南

本文档详细介绍了 CloudPaste 项目的各种部署方法，包括手动部署、GitHub Actions 自动部署和一键部署。

![CloudPaste Logo](https://github.com/ling-drag0n/CloudPaste/raw/main/frontend/public/logo.png)

## 项目介绍

CloudPaste 是一个基于 Cloudflare 服务构建的轻量级内容分享平台，支持 Markdown 编辑、文件上传和安全分享。

- **前端**：Vue.js + TailwindCSS
- **后端**：Cloudflare Workers + Hono.js
- **数据库**：Cloudflare D1 (SQL 数据库)
- **文件存储**：Cloudflare R2 / Backblaze B2 (S3 兼容存储)

## 部署准备工作

在开始部署前，请确保您已准备好以下内容：

1. [Cloudflare 账户](https://dash.cloudflare.com/sign-up)
2. [GitHub 账户](https://github.com/join)（如需使用 GitHub Actions 或一键部署）
3. Node.js 环境（v16+）
4. Wrangler CLI（`npm install -g wrangler`）
5. Git（版本控制）

## 目录

- [手动部署](#手动部署)
    - [后端部署](#后端手动部署)
    - [前端部署到 Cloudflare Pages](#前端手动部署到-cloudflare-pages)
    - [前端部署到 Vercel](#前端手动部署到-vercel)
- [GitHub Actions 自动部署](#github-actions-自动部署)
    - [后端自动部署](#后端自动部署)
    - [前端自动部署到 Cloudflare Pages](#前端自动部署到-cloudflare-pages)
    - [前端自动部署到 Vercel](#前端自动部署到-vercel)
- [一键部署](#一键部署)
    - [使用 Deploy Button 部署后端](#使用-deploy-button-部署后端)
    - [部署后的配置](#部署后的配置)
- [常见问题与故障排除](#常见问题与故障排除)

## 手动部署

### 后端手动部署

#### 1. 克隆仓库

```bash
git clone https://github.com/ling-drag0n/CloudPaste.git
cd CloudPaste/backend
```

#### 2. 安装依赖

```bash
npm install
```

#### 3. 登录 Cloudflare

```bash
npx wrangler login
```

按照提示在浏览器中完成授权。

#### 4. 创建 D1 数据库

```bash
npx wrangler d1 create cloudpaste-db
```

执行后，命令会输出类似以下内容：

```
✅ Successfully created DB 'cloudpaste-db' in location 'apac'
Created D1 database '675e94a5-9da9-4c7c-b7c9-38a6818ea368'
```

记下生成的数据库 ID。

#### 5. 修改 wrangler.toml 配置

打开 `wrangler.toml` 文件，更新数据库 ID：

```toml
[[d1_databases]]
binding = "DB"
database_name = "cloudpaste-db"
database_id = "675e94a5-9da9-4c7c-b7c9-38a6818ea368"  # 替换为您的数据库 ID
```

#### 6. 部署 Worker

```bash
npx wrangler deploy
```

部署完成后，您会看到类似以下输出：

```
Deployed cloudpaste-backend (1.25 sec)
  https://cloudpaste-backend.your-username.workers.dev
```

记下这个 URL，这是您的后端 API 地址。

#### 7. 初始化数据库（自动）

Worker 首次运行时会自动检查并初始化数据库表结构和默认管理员账户（用户名: admin, 密码: admin）。

为了触发初始化，访问您的 Worker URL：

```
https://cloudpaste-backend.your-username.workers.dev
```

**重要提示**：出于安全考虑，请在系统初始化后立即更改默认管理员密码！

### 前端手动部署到 Cloudflare Pages

#### 1. 克隆仓库（如果尚未克隆）

```bash
git clone https://github.com/ling-drag0n/CloudPaste.git
cd CloudPaste/frontend
```

#### 2. 安装依赖

```bash
npm install
```

#### 3. 配置环境变量

创建或修改 `.env.production` 文件：

```
# 生产环境 API 基础 URL
VITE_BACKEND_URL=https://cloudpaste-backend.your-username.workers.dev
# 生产环境标识
VITE_APP_ENV=production
# 禁用开发调试工具
VITE_ENABLE_DEVTOOLS=false
```

将 `VITE_BACKEND_URL` 替换为您的后端 Worker URL。

#### 4. 构建前端项目

```bash
npm run build
```

这将在 `dist` 目录下生成静态文件。

#### 5. 部署到 Cloudflare Pages

方法一：通过 Wrangler 部署：

```bash
npx wrangler pages deploy dist --project-name=cloudpaste-frontend
```

方法二：通过 Cloudflare Dashboard 部署：

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 选择 "Pages"
3. 点击 "Create a project" > "Direct Upload"
4. 上传 `dist` 目录内的文件
5. 设置项目名称（如 "cloudpaste-frontend"）
6. 点击 "Save and Deploy"

部署完成后，您会收到一个 URL（如 `https://cloudpaste-frontend.pages.dev`）。

### 前端手动部署到 Vercel

#### 1. 克隆仓库（如果尚未克隆）

```bash
git clone https://github.com/ling-drag0n/CloudPaste.git
cd CloudPaste/frontend
```

#### 2. 安装依赖

```bash
npm install
```

#### 3. 安装 Vercel CLI

```bash
npm install -g vercel
```

#### 4. 登录 Vercel

```bash
vercel login
```

#### 5. 配置环境变量

创建或修改 `.env.production` 文件：

```
# 生产环境 API 基础 URL
VITE_BACKEND_URL=https://cloudpaste-backend.your-username.workers.dev
# 生产环境标识
VITE_APP_ENV=production
# 禁用开发调试工具
VITE_ENABLE_DEVTOOLS=false
```

#### 6. 构建并部署

```bash
vercel --prod
```

按照提示回答问题：

- Project setup: Select "No" for using project settings
- Link to existing project: Select "No" to create a new project
- Project name: 输入项目名称（如 "cloudpaste"）
- Other settings: 可使用默认值

部署完成后，您会收到一个 URL（如 `https://cloudpaste.vercel.app`）。

## GitHub Actions 自动部署

使用 GitHub Actions 可以实现代码推送后自动部署应用。

### 配置 GitHub 仓库

1. Fork 或克隆仓库 [https://github.com/ling-drag0n/CloudPaste](https://github.com/ling-drag0n/CloudPaste)
2. 进入您的 GitHub 仓库设置
3. 选择 "Secrets and variables" > "Actions"
4. 添加以下 Secrets：

对于 Cloudflare：

- `CLOUDFLARE_API_TOKEN`：Cloudflare API 令牌（需要有 Workers、D1、R2 和 Pages 权限）
- `CLOUDFLARE_ACCOUNT_ID`：Cloudflare 账户 ID
- `CLOUDFLARE_BACKEND_URL`：后端 API URL（用于前端部署）
- `ENCRYPTION_SECRET`：（可选）用于加密敏感数据的密钥。如果不提供，将自动生成随机密钥
- `R2_BUCKET_NAME`：（可选）R2 存储桶名称。默认为"cloudpaste-storage"

对于 Vercel：

- `VERCEL_TOKEN`：Vercel API 令牌
- `VERCEL_ORG_ID`：Vercel 组织 ID
- `VERCEL_PROJECT_ID`：Vercel 项目 ID
- `VERCEL_BACKEND_URL`：后端 API URL（用于前端部署）

### 完整的 GitHub Secrets 列表

以下是自动部署所需的所有 GitHub Secrets：

| Secret 名称              | 必需 | 用途                                                               |
| ------------------------ | ---- | ------------------------------------------------------------------ |
| `CLOUDFLARE_API_TOKEN`   | 是   | Cloudflare API 令牌，用于部署 Workers、Pages、管理 D1 和           |
| `CLOUDFLARE_ACCOUNT_ID`  | 是   | Cloudflare 账户 ID                                                 |
| `CLOUDFLARE_BACKEND_URL` | 否   | 后端 API URL，用于前端部署。如果未提供，可在部署后通过控制面板设置 |
| `ENCRYPTION_SECRET`      | 否   | 用于加密敏感数据的密钥。如未提供，将生成随机密钥                   |
| `VERCEL_TOKEN`           | 否\* | Vercel API 令牌（仅用于 Vercel 部署）                              |
| `VERCEL_ORG_ID`          | 否\* | Vercel 组织 ID（仅用于 Vercel 部署）                               |
| `VERCEL_PROJECT_ID`      | 否\* | Vercel 项目 ID（仅用于 Vercel 部署）                               |
| `VERCEL_BACKEND_URL`     | 否\* | 后端 API URL（仅用于 Vercel 部署）                                 |

\*这些 Secret 仅在使用 Vercel 部署前端时需要

### 后端自动部署

GitHub Actions 配置文件 `.github/workflows/deploy-backend-cloudflare.yml` 已经设置好。每当 `backend` 目录中的文件有更改并推送到 `main` 或 `master` 分支时，会自动触发部署。

后端部署工作流包含以下自动化步骤：

1. 检出代码仓库
2. 设置 Node.js 环境
3. 安装依赖
4. 禁用 Wrangler 遥测数据收集
5. **自动创建 D1 数据库**（如果不存在）
6. **自动创建 R2 存储桶**（如果不存在）
7. **用 schema.sql 初始化数据库**（创建表和初始数据）
8. **设置 ENCRYPTION_SECRET 环境变量**（从 GitHub Secrets 获取或自动生成）
9. 部署 Worker 到 Cloudflare

```yaml
name: Deploy Backend to Cloudflare Workers

on:
  push:
    branches: [main, master]
    paths:
      - "backend/**"
  workflow_dispatch:
  repository_dispatch:
    types: [deploy-button]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./backend

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "18"
          cache: "npm"
          cache-dependency-path: "./backend/package-lock.json"

      - name: Install dependencies
        run: npm ci

      - name: Create D1 Database
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: |
          echo "Creating D1 Database for CloudPaste..."
          # 尝试创建数据库，如果已存在则获取现有数据库信息
          DATABASE_INFO=$(npx wrangler d1 create cloudpaste-db 2>&1 || npx wrangler d1 list --json | jq '.[] | select(.name=="cloudpaste-db")')

          # 提取数据库ID并更新wrangler.toml
          # ...省略部分代码...

      - name: Initialize D1 Database with schema
        # ...省略部分代码...

      - name: Set ENCRYPTION_SECRET environment variable
        # ...省略部分代码...

      - name: Deploy to Cloudflare Workers
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: npx wrangler deploy
```

### 前端自动部署到 Cloudflare Pages

GitHub Actions 配置文件 `.github/workflows/deploy-frontend-cloudflare.yml` 已经设置好。每当 `frontend` 目录中的文件有更改并推送到 `main` 或 `master` 分支时，会自动触发部署。

前端工作流包含以下自动化步骤：

1. 检出代码仓库
2. 设置 Node.js 环境
3. 安装依赖
4. **自动检测是否提供了 CLOUDFLARE_BACKEND_URL**
    - 如果提供了，使用该 URL 构建前端
    - 如果未提供，构建不包含后端 URL 的前端版本
5. 部署到 Cloudflare Pages

工作流会智能处理后端 URL 的配置：

- 当设置了 `CLOUDFLARE_BACKEND_URL` Secret 时，前端会自动连接到指定的后端 API
- 当未设置 Secret 时，工作流会成功部署并在部署成功信息中提示您需要在 Cloudflare Pages 控制面板中手动设置环境变量

```yaml
name: Deploy Frontend to Cloudflare Pages

on:
  push:
    branches: [main, master]
    paths:
      - "frontend/**"
      - "!frontend/vercel.json"
  workflow_dispatch:
  repository_dispatch:
    types: [deploy-button]

jobs:
  deploy-frontend-cloudflare:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./frontend

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "18"
          cache: "npm"
          cache-dependency-path: "./frontend/package-lock.json"

      - name: Install dependencies
        run: npm ci

      - name: Set environment variables
        id: set-env
        run: |
          # 检查是否提供了CLOUDFLARE_BACKEND_URL
          if [ -n "${{ secrets.CLOUDFLARE_BACKEND_URL }}" ]; then
            echo "Using provided CLOUDFLARE_BACKEND_URL for frontend build"
            echo "backend_url=${{ secrets.CLOUDFLARE_BACKEND_URL }}" >> $GITHUB_OUTPUT
            echo "has_backend_url=true" >> $GITHUB_OUTPUT
          else
            echo "No CLOUDFLARE_BACKEND_URL provided, the frontend will use relative paths or need manual configuration"
            echo "has_backend_url=false" >> $GITHUB_OUTPUT
          fi

      - name: Build frontend with backend URL
        if: steps.set-env.outputs.has_backend_url == 'true'
        run: npm run build
        env:
          VITE_BACKEND_URL: ${{ steps.set-env.outputs.backend_url }}
          VITE_APP_ENV: production
          VITE_ENABLE_DEVTOOLS: false

      - name: Build frontend without backend URL
        if: steps.set-env.outputs.has_backend_url == 'false'
        run: npm run build
        env:
          VITE_APP_ENV: production
          VITE_ENABLE_DEVTOOLS: false

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: "./frontend"
          command: pages deploy ./dist --project-name=cloudpaste-frontend --production
```

如果您使用一键部署按钮或在没有设置 `CLOUDFLARE_BACKEND_URL` 的情况下部署了前端，可以在部署后通过 Cloudflare Pages 控制面板手动设置环境变量：

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 导航到 Pages > 您的项目（如 "cloudpaste-frontend"）
3. 点击 "Settings" > "Environment variables"
4. 添加一个新的变量：
    - 名称：`VITE_BACKEND_URL`
    - 值：您的后端 Worker URL（如 `https://cloudpaste-backend.your-username.workers.dev`）
5. 选择环境（通常是 "Production"）
6. 保存并触发重新部署

### 前端自动部署到 Vercel

GitHub Actions 配置文件 `.github/workflows/deploy-frontend-vercel.yml` 已经设置好。每当 `frontend` 目录中的文件有更改并推送到 `main` 或 `master` 分支时，会自动触发部署。

```yaml
name: Deploy Frontend to Vercel

on:
  push:
    branches: [main, master]
    paths:
      - "frontend/**"
  workflow_dispatch:

jobs:
  deploy-frontend-vercel:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./frontend

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "18"
          cache: "npm"
          cache-dependency-path: "./frontend/package-lock.json"

      - name: Install dependencies
        run: npm ci

      - name: Install Vercel CLI
        run: npm install --global vercel@latest

      - name: Build frontend
        run: npm run build
        env:
          VITE_BACKEND_URL: ${{ secrets.VERCEL_BACKEND_URL }}
          VITE_APP_ENV: production
          VITE_ENABLE_DEVTOOLS: false

      - name: Deploy to Vercel
        run: |
          vercel deploy ./dist --token=${{ secrets.VERCEL_TOKEN }} --prod --yes \
            --scope=${{ secrets.VERCEL_ORG_ID }} \
            --name=cloudpaste
        env:
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
```

## 一键部署

### 使用 Deploy Button 部署后端

点击下面的按钮，可以一键将 CloudPaste 后端部署到您的 Cloudflare Workers 环境：

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ling-drag0n/CloudPaste)

#### 一键部署步骤说明

1. 点击 "Deploy to Cloudflare Workers" 按钮
2. 如果尚未登录 Cloudflare，系统会提示您登录
3. 授权 Cloudflare 访问您的 GitHub 账户
4. 系统会将项目 Fork 到您的 GitHub 账户
5. 系统会自动运行部署工作流，包括：
    - 创建 D1 数据库并初始化表结构
    - 创建 R2 存储桶（如果不存在）
    - 设置必要的环境变量
    - 部署 Worker
    - **部署前端应用到 Cloudflare Pages**
6. 部署完成后，您会收到部署成功的通知和相关 URL

**注意**：一键部署时，如果未设置 `CLOUDFLARE_BACKEND_URL`，前端将部署成功但不包含后端 URL 配置。您可以在部署完成后通过 Cloudflare Pages 控制面板手动设置 `VITE_BACKEND_URL` 环境变量。

### 部署后的配置

使用一键部署按钮或 GitHub Actions 部署后，大多数配置工作已自动完成，包括：

- D1 数据库的创建和初始化
- R2 存储桶的创建（如果不存在）
- 自动设置 ENCRYPTION_SECRET 环境变量
- wrangler.toml 文件自动更新

您只需要完成以下步骤：

#### 1. 访问 Worker 进行初始化

访问您的 Worker URL 触发数据库的最终初始化：

```
https://cloudpaste-backend.your-username.workers.dev
```

#### 2. 配置 S3 存储

CloudPaste 支持使用 Cloudflare R2 或其他 S3 兼容存储（如 Backblaze B2）。您需要在管理员面板中配置这些设置：

1. 访问您部署的 CloudPaste 前端应用
2. 使用默认管理员账户登录（用户名: `admin`，密码: `admin123`）
3. 进入管理员面板 > 存储配置
4. 添加 S3 存储配置
    - 提供端点 URL
    - 输入 Access Key 和 Secret Key
    - 设置存储桶名称和区域
    - 测试连接并保存

**重要安全提示：** 请在首次登录后立即更改默认管理员密码！

## 常见问题与故障排除

### 1. Cloudflare Workers 部署问题

**问题**: 部署到 Workers 时出现 "Error: Cannot find API Token"

**解决方案**:

- 确保您已运行 `wrangler login`
- 检查 GitHub Actions Secrets 中的 `CLOUDFLARE_API_TOKEN` 是否正确设置

### 2. D1 数据库问题

**问题**: Worker 报错 "Failed to connect to D1 database"

**解决方案**:

- 确保您的 Cloudflare API 令牌有足够的权限（需要有 D1 数据库权限）
- 如果使用自动部署，检查 GitHub Actions 日志中的数据库创建步骤
- 手动运行 `npx wrangler d1 list` 查看是否成功创建了数据库
- 如果需要手动创建数据库：`npx wrangler d1 create cloudpaste-db`

**问题**: R2 存储桶问题

**解决方案**:

- 确保您的 Cloudflare API 令牌有足够的权限（需要有 R2 存储桶权限）
- 如果使用自动部署，检查 GitHub Actions 日志中的存储桶创建步骤
- 手动运行 `npx wrangler r2 bucket list` 查看是否成功创建了存储桶
- 如果需要手动创建存储桶：`npx wrangler r2 bucket create cloudpaste-storage`

### 3. 前端部署问题

**问题**: 前端成功部署但无法连接到后端 API

**解决方案**:

- 检查 `.env.production` 中 `VITE_BACKEND_URL` 是否设置正确
- 确保后端 Worker 已成功部署
- 检查浏览器控制台是否有 CORS 错误，可能需要在后端配置允许的源

### 4. 一键部署按钮问题

**问题**: 点击 Deploy Button 后无响应或出现错误

**解决方案**:

- 确保您已登录 Cloudflare 账户
- 检查项目仓库是否公开可访问
- 尝试清除浏览器缓存后重试

### 5. S3 存储配置问题

**问题**: 文件上传失败或无法访问

**解决方案**:

- 检查 S3 兼容存储的配置是否正确
- 确保 Access Key 和 Secret Key 有足够的权限
- 检查存储桶是否已创建并正确配置跨域访问

## 参考资料

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Vercel 部署文档](https://vercel.com/docs/deployments/overview)
- [Cloudflare D1 数据库文档](https://developers.cloudflare.com/d1/)
- [Cloudflare Deploy Button 文档](https://developers.cloudflare.com/workers/platform/deploy-button)

## 联系与支持

如有问题或需要帮助，可以通过以下方式获取支持：

- 在 [GitHub 仓库](https://github.com/ling-drag0n/CloudPaste/issues) 提交 Issue
- 联系项目维护者: [ling-drag0n](https://github.com/ling-drag0n)

---

感谢您选择 CloudPaste！希望这份部署指南能帮助您顺利部署和使用我们的应用。
