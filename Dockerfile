FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npx nest build
RUN npm prune --omit=dev --ignore-scripts

FROM node:22-alpine
ENV NODE_ENV=production
ENV PORT=5000
ENV FILE_SCANNER_HOST=127.0.0.1
ENV FILE_SCANNER_PORT=3310
ENV FILE_SCANNER_EMBEDDED=false
WORKDIR /app
RUN apk add --no-cache openssl ca-certificates clamav-daemon freshclam tini \
    && mkdir -p /var/lib/clamav /run/clamav \
    && chown -R node:node /var/lib/clamav /run/clamav
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json start.sh ./
COPY --chown=node:node config/ ./config/
USER node
EXPOSE 5000
ENTRYPOINT ["/sbin/tini", "-g", "--"]
CMD ["sh", "./start.sh"]
