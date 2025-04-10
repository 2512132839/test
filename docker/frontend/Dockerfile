# 构建阶段
FROM node:18.18-alpine AS build

WORKDIR /app

# 复制前端package.json和锁文件
COPY frontend/package*.json ./

# 安装依赖
RUN npm ci --cache /tmp/npm-cache

# 复制前端源代码
COPY frontend/ ./

# 设置API地址环境变量
ARG VITE_BACKEND_URL=http://backend:8787
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}

# 添加Docker构建环境标识
ENV VITE_IS_DOCKER=true

# 使用Docker专用的config.js替换原有文件
RUN cp -f ./src/api/docker-config.js ./src/api/config.js

# 构建应用
RUN npm run build

# 部署阶段
FROM nginx:1.25-alpine

# 复制构建产物
COPY --from=build /app/dist /usr/share/nginx/html

# 复制Nginx配置
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# 健康检查配置
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --no-cache --spider http://localhost/health || exit 1

# 暴露端口
EXPOSE 80

# 启动Nginx
CMD ["nginx", "-g", "daemon off;"] 