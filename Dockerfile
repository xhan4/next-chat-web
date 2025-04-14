# 构建阶段
FROM node:20-alpine3.19 AS builder

# 设置 npm 镜像源
RUN npm config set registry https://registry.npmmirror.com/

# 安装 pnpm 并设置 pnpm 镜像源
RUN npm install -g pnpm@latest && pnpm config set registry https://registry.npmmirror.com/
# 将前端源码复制到 /next-chat 目录中
WORKDIR /next-chat

# 复制整个项目，除了 node_modules 和 dist 等目录
COPY  package.json pnpm-lock.yaml /next-chat/

# 使用 pnpm 安装依赖
RUN pnpm install --frozen-lockfile

COPY . .

# 编译项目
RUN pnpm run build

# 部署阶段
FROM node:20-alpine3.19 as runner

WORKDIR /next-chat

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

CMD ["node_modules/.bin/next", "start"]