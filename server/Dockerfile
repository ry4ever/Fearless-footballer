FROM node:20-alpine AS builder

WORKDIR /app
# bcrypt downloads a prebuilt native binary during install and compiles from
# source when none matches (musl/Alpine); these tools make that fallback work.
# openssl lets Prisma pick the right query engine.
RUN apk add --no-cache python3 make g++ openssl
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
# pnpm 10 only runs dependency build scripts for packages listed in
# package.json "pnpm.onlyBuiltDependencies" (bcrypt, Prisma, esbuild).
RUN corepack enable && pnpm install --frozen-lockfile
# Fail the build here, not at runtime, if bcrypt's native module is missing.
RUN node -e "require('bcrypt').hashSync('build-check', 4)"

COPY prisma ./prisma
RUN npx prisma generate

COPY server ./server
COPY shared ./shared

RUN pnpm run server:build

FROM node:20-alpine

WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/dist/server ./dist/server
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/shared ./shared

ENV NODE_ENV=production
EXPOSE 3000

# Apply pending database migrations on start (prisma/migrations), add the
# sample session if nothing is published yet, then serve. Railway reaches its
# Postgres over the private network, so no public database URL is needed.
# Already-applied migrations are skipped.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/ensureSampleSession.ts && node dist/server/index.js"]
