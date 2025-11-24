# GitHub Actions 工作流开关控制说明

## 🎛️ 可视化控制面板（推荐）

**最简单的方式！** 通过可视化界面一键开启/关闭自动部署。

### 📱 如何使用

1. **进入 GitHub Actions 页面**
   ```
   你的仓库 → Actions → 左侧选择 "🎛️ 部署控制面板"
   ```

2. **点击右上角 "Run workflow"**

3. **选择要配置的工作流**
   - 🔄 SPA一体化自动部署：`🟢 开启` / `🔴 关闭` / `📊 查看当前状态`
   - ⚙️ 后端分离自动部署：`🟢 开启` / `🔴 关闭` / `📊 查看当前状态`
   - 🎨 前端分离自动部署：`🟢 开启` / `🔴 关闭` / `📊 查看当前状态`

4. **点击 "Run workflow" 确认**

5. **查看执行日志**
   - 会显示操作前后的状态对比
   - 自动检测是否开启了多个部署（并给出警告）

### ✨ 特性

- ✅ **直观的界面**：下拉菜单选择，无需记忆命令
- ✅ **实时生效**：配置立即生效，无需重启
- ✅ **状态查看**：可以只查看当前状态，不做修改
- ✅ **智能警告**：自动检测冲突配置并提醒
- ✅ **操作日志**：详细显示每一步操作结果

---

## 📋 可控制的工作流

| 工作流名称 | 开关变量 | 默认状态 | 说明 |
|-----------|---------|---------|------|
| Workers SPA一体化部署 | `ENABLE_SPA_DEPLOY` | ❌ 关闭 | 前后端一体化部署到单个 Worker |
| Worker后端分离部署 | `ENABLE_BACKEND_DEPLOY` | ❌ 关闭 | 仅部署后端 API Worker |
| Pages前端分离部署 | `ENABLE_FRONTEND_DEPLOY` | ❌ 关闭 | 仅部署前端到 Cloudflare Pages |

**Docker 构建工作流**（仅手动触发，无需开关）：
- `Build and Push all Docker Image` - 构建并推送 Docker 镜像
- `Build and Push Backend Docker Image` - 仅构建后端镜像
- `Build and Push Frontend Docker Image` - 仅构建前端镜像

---

## ⚙️ 高级方式：手动设置变量

如果你更喜欢使用命令行或需要批量配置，也可以手动设置 Repository Variables。

### 方法 1：通过 GitHub Web 界面设置

1. **进入仓库设置**
   ```
   你的仓库 → Settings → Secrets and variables → Actions → Variables 标签页
   ```

2. **点击 "New repository variable"**

3. **添加变量**

   根据需要启用的工作流，添加对应的变量：

   **启用 SPA 一体化部署：**
   - Name: `ENABLE_SPA_DEPLOY`
   - Value: `true`

   **启用后端分离部署：**
   - Name: `ENABLE_BACKEND_DEPLOY`
   - Value: `true`

   **启用前端分离部署：**
   - Name: `ENABLE_FRONTEND_DEPLOY`
   - Value: `true`

4. **保存后立即生效**

---

### 方法 2：使用 GitHub CLI 设置

```bash
# 安装 GitHub CLI: https://cli.github.com/

# 启用 SPA 一体化部署
gh variable set ENABLE_SPA_DEPLOY --body "true"

# 启用后端分离部署
gh variable set ENABLE_BACKEND_DEPLOY --body "true"

# 启用前端分离部署
gh variable set ENABLE_FRONTEND_DEPLOY --body "true"
```

---

## 🔄 工作流行为说明

### 开关 = `true`（启用）
- ✅ **自动触发**：推送代码到 `main/master` 分支时自动部署
- ✅ **手动触发**：可在 Actions 页面手动运行
- ✅ **按钮触发**：支持通过 repository_dispatch 触发

### 开关 = `false` 或未设置（禁用）
- ❌ **自动触发**：推送代码时**跳过此工作流**
- ✅ **手动触发**：仍可在 Actions 页面手动运行
- ✅ **按钮触发**：仍支持通过 repository_dispatch 触发

---

## 💡 推荐配置场景

### 场景 1：SPA 一体化部署（⭐ 强烈推荐）

**使用控制面板：**
1. 进入 Actions → 🎛️ 部署控制面板
2. 设置：
   - 🔄 SPA一体化自动部署：`🟢 开启`
   - ⚙️ 后端分离自动部署：`🔴 关闭`
   - 🎨 前端分离自动部署：`🔴 关闭`
3. 点击 "Run workflow"

**效果：**
- ✅ 推送代码后自动部署 SPA Worker
- ❌ 不会触发前后端分离部署
- 💰 成本最低（导航请求不计费）
- 🚀 性能最佳（同源请求）

---

### 场景 2：前后端分离部署

**使用控制面板：**
1. 进入 Actions → 🎛️ 部署控制面板
2. 设置：
   - 🔄 SPA一体化自动部署：`🔴 关闭`
   - ⚙️ 后端分离自动部署：`🟢 开启`
   - 🎨 前端分离自动部署：`🟢 开启`
3. 点击 "Run workflow"

**效果：**
- ✅ 推送后端代码自动部署 Worker
- ✅ 推送前端代码自动部署 Pages
- 🔧 前后端独立扩展

---

### 场景 3：仅手动部署（开发/测试）

**使用控制面板：**
1. 进入 Actions → 🎛️ 部署控制面板
2. 设置：
   - 🔄 SPA一体化自动部署：`🔴 关闭`
   - ⚙️ 后端分离自动部署：`🔴 关闭`
   - 🎨 前端分离自动部署：`🔴 关闭`
3. 点击 "Run workflow"

**效果：**
- ❌ 推送代码不会触发任何自动部署
- ✅ 需要时在 Actions 页面手动触发
- 🧪 适合开发和测试环境

---

### 场景 4：查看当前状态（不修改配置）

**使用控制面板：**
1. 进入 Actions → 🎛️ 部署控制面板
2. 所有选项保持：`📊 查看当前状态`
3. 点击 "Run workflow"
4. 查看执行日志查看当前所有开关状态

**效果：**
- 📊 只查看，不修改任何配置
- 💡 了解哪些工作流已启用

---

## 💡 推荐配置

### 场景 1：使用 SPA 一体化部署（推荐）

```bash
gh variable set ENABLE_SPA_DEPLOY --body "true"
# 其他两个保持关闭（不设置或设为 false）
```

**优点**：
- 前后端部署在同一个 Worker
- 无跨域问题
- 成本更低（导航请求不计费）

---

### 场景 2：使用前后端分离部署

```bash
gh variable set ENABLE_BACKEND_DEPLOY --body "true"
gh variable set ENABLE_FRONTEND_DEPLOY --body "true"
# SPA 部署保持关闭
```

**优点**：
- 前后端独立扩展
- 更灵活的 CDN 配置

---

### 场景 3：仅测试，不自动部署

```bash
# 不设置任何变量，或全部设为 false
```

**效果**：
- 推送代码不会触发任何自动部署
- 需要时在 Actions 页面手动运行

---

## 🔍 查看当前开关状态

### Web 界面查看
```
Settings → Secrets and variables → Actions → Variables 标签页
```

### CLI 查看
```bash
gh variable list
```

---

## 🚨 注意事项

1. **变量名必须完全匹配**（区分大小写）
   - ✅ 正确：`ENABLE_SPA_DEPLOY`
   - ❌ 错误：`enable_spa_deploy` 或 `ENABLE_SPA`

2. **变量值必须是字符串 `"true"`**
   - ✅ 正确：`true`
   - ❌ 错误：`True`、`TRUE`、`1`

3. **修改后立即生效**，无需重启或重新推送代码

4. **删除变量 = 禁用自动部署**
   ```bash
   gh variable delete ENABLE_SPA_DEPLOY
   ```

---

## 📖 常见问题

### Q: 我推送了代码，但工作流没有运行？
A: 检查对应的开关变量是否设置为 `true`。如果未设置或为 `false`，工作流会跳过自动触发。

### Q: 我想临时部署一次，但不想启用自动部署？
A: 在 Actions 页面找到对应工作流，点击 "Run workflow" 手动触发即可。手动触发不受开关限制。

### Q: 可以同时启用多个工作流吗？
A: 技术上可以，但**不推荐**。建议只启用一种部署方式：
- ✅ 推荐：仅启用 SPA 一体化部署
- ⚠️ 不推荐：同时启用 SPA 和前后端分离部署（会重复部署）

### Q: Docker 构建工作流为什么没有开关？
A: Docker 构建工作流仅支持手动触发（`workflow_dispatch`），不会自动运行，因此无需开关控制。

---

## 📚 相关文档

- [GitHub Actions Variables 官方文档](https://docs.github.com/en/actions/learn-github-actions/variables)
- [GitHub CLI 官方文档](https://cli.github.com/manual/)
- [CloudPaste 部署指南](../../README.md)
