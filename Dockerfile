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
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json start.sh ./
USER node
EXPOSE 5000
CMD ["sh", "./start.sh"]
