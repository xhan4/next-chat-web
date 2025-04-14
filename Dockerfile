# 构建阶段
FROM node:20-alpine3.19 AS builder

# 设置镜像源
RUN npm config set registry https://registry.npmmirror.com/
RUN npm install -g pnpm@latest && pnpm config set registry https://registry.npmmirror.com/

WORKDIR /next-chat

# 复制依赖文件并安装
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 复制源码并构建
COPY . .
RUN pnpm run build

# 部署阶段
FROM node:20-alpine3.19 AS runner

WORKDIR /next-chat

# 创建非root用户（可选）
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# 从构建阶段复制必要文件
COPY --from=builder /next-chat/public ./public
COPY --from=builder /next-chat/.next ./.next
COPY --from=builder /next-chat/node_modules ./node_modules
COPY --from=builder /next-chat/package.json ./package.json

# 设置用户权限（若创建了用户）
USER nextjs

EXPOSE 3000

CMD ["node_modules/.bin/next", "start"]