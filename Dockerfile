FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install

COPY . .

# Generate Prisma client in builder stage
RUN DATABASE_URL="postgresql://user:password@localhost:5432/db" \
    DIRECT_URL="postgresql://user:password@localhost:5432/db" \
    npx prisma generate

# Compile TypeScript
RUN npx tsc -p tsconfig.build.json

RUN ls -la /app/dist/main.js && echo "BUILD SUCCESS"

# ── Final image ──────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install --omit=dev

COPY prisma ./prisma

RUN DATABASE_URL="postgresql://user:password@localhost:5432/db" \
    DIRECT_URL="postgresql://user:password@localhost:5432/db" \
    npx prisma generate

COPY --from=builder /app/dist ./dist

RUN ls -la /app/dist/main.js && echo "COPY SUCCESS"

COPY start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 5000
CMD ["./start.sh"]
