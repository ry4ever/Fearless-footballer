FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN corepack enable && pnpm install --frozen-lockfile

COPY prisma ./prisma
RUN npx prisma generate

COPY server ./server
COPY shared ./shared

RUN pnpm run server:build

FROM node:20-alpine

WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN corepack enable

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/dist/server ./dist/server
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/shared ./shared

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/server/index.js"]
