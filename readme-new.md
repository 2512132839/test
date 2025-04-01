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

- `CLOUDFLARE_API_TOKEN`：Cloudflare API 令牌（需要有 Workers 和 Pages 权限）
- `CLOUDFLARE_ACCOUNT_ID`：Cloudflare 账户 ID
- `CLOUDFLARE_BACKEND_URL`：后端 API URL（用于前端部署）

对于 Vercel：

- `VERCEL_TOKEN`：Vercel API 令牌
- `VERCEL_ORG_ID`：Vercel 组织 ID
- `VERCEL_PROJECT_ID`：Vercel 项目 ID
- `VERCEL_BACKEND_URL`：后端 API URL（用于前端部署）

### 后端自动部署

GitHub Actions 配置文件 `.github/workflows/deploy-backend-cloudflare.yml` 已经设置好。每当 `backend` 目录中的文件有更改并推送到 `main` 或 `master` 分支时，会自动触发部署。

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

      - name: Deploy to Cloudflare Workers
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: npx wrangler deploy
```

### 前端自动部署到 Cloudflare Pages

GitHub Actions 配置文件 `.github/workflows/deploy-frontend-cloudflare.yml` 已经设置好。每当 `frontend` 目录中的文件有更改并推送到 `main` 或 `master` 分支时，会自动触发部署。

```yaml
name: Deploy Frontend to Cloudflare Pages

on:
  push:
    branches: [main, master]
    paths:
      - "frontend/**"
      - "!frontend/vercel.json"
  workflow_dispatch:

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

      - name: Build frontend
        run: npm run build
        env:
          VITE_BACKEND_URL: ${{ secrets.CLOUDFLARE_BACKEND_URL }}
          VITE_APP_ENV: production
          VITE_ENABLE_DEVTOOLS: false

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy ./frontend/dist --project-name=cloudpaste-frontend --production
```

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
5. 系统会自动运行部署工作流
6. 部署完成后，您会收到部署成功的通知和 Worker URL

### 部署后的配置

#### 1. 配置 D1 数据库

在使用一键部署后，您需要为 D1 数据库配置正确的绑定：

```bash
# 查找您的 D1 数据库 ID
npx wrangler d1 list

# 更新 wrangler.toml 中的数据库 ID
```

将获得的数据库 ID 更新到您 Fork 仓库中的 `backend/wrangler.toml` 文件：

```toml
[[d1_databases]]
binding = "DB"
database_name = "cloudpaste-db"
database_id = "您的数据库ID"  # 在此处更新您的数据库 ID
```

#### 2. 配置 S3 存储

CloudPaste 支持使用 Cloudflare R2 或其他 S3 兼容存储（如 Backblaze B2）。您需要在管理员面板中配置这些设置：

1. 访问您部署的 CloudPaste 前端应用
2. 使用默认管理员账户登录（用户名: `admin`，密码: `admin`）
3. 进入管理员面板 > 存储配置
4. 添加 S3 存储配置
   - 提供端点 URL
   - 输入 Access Key 和 Secret Key
   - 设置存储桶名称和区域
   - 测试连接并保存

#### 3. 部署前端

一键部署按钮主要针对后端，前端仍需手动部署：

**部署到 Cloudflare Pages**:

```bash
cd frontend
npm install
npm run build
npx wrangler pages deploy dist --project-name=cloudpaste-frontend
```

**或部署到 Vercel**:

```bash
cd frontend
npm install
vercel --prod
```

## 常见问题与故障排除

### 1. Cloudflare Workers 部署问题

**问题**: 部署到 Workers 时出现 "Error: Cannot find API Token"

**解决方案**:

- 确保您已运行 `wrangler login`
- 检查 GitHub Actions Secrets 中的 `CLOUDFLARE_API_TOKEN` 是否正确设置

### 2. D1 数据库问题

**问题**: Worker 报错 "Failed to connect to D1 database"

**解决方案**:

- 检查 `wrangler.toml` 中的数据库 ID 是否正确
- 确保您已创建 D1 数据库
- 尝试重新运行 `npx wrangler d1 create cloudpaste-db`

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
