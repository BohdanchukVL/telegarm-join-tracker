FROM oven/bun:1.1.30-alpine AS base
WORKDIR /app

COPY package.json bun.lockb ./
COPY packages ./packages
COPY apps/server ./apps/server

RUN bun install --ci

ENV NODE_ENV=production
ENV CONFIG=/apps/server/config.yaml

EXPOSE 3000
WORKDIR /apps/server/

CMD ["bun", "src/server.ts"]
