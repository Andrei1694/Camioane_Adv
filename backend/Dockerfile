FROM node:24-trixie-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg openssl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production PORT=3000 FILE_STORAGE_ROOT=/data/uploads
WORKDIR /app

COPY package.json package-lock.json prisma.config.ts ./
COPY prisma/ ./prisma/
RUN npm ci --omit=dev && npm cache clean --force

COPY src/ ./src/
RUN mkdir -p /data/uploads && chown node:node /data/uploads

USER node
EXPOSE 3000
CMD ["node", "src/server.ts"]
