FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install

COPY . .

# Generate Prisma client with a dummy DB URL (only needed for type generation)
RUN DATABASE_URL="postgresql://user:password@localhost:5432/db" \
    DIRECT_URL="postgresql://user:password@localhost:5432/db" \
    npx prisma generate

# Compile TypeScript
RUN npx nest build

# Verify dist was created
RUN ls -la /app/dist/main.js && echo "BUILD SUCCESS"

# ── Final image ──────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install --omit=dev

COPY prisma ./prisma

# Regenerate Prisma client in production image
RUN DATABASE_URL="postgresql://user:password@localhost:5432/db" \
    DIRECT_URL="postgresql://user:password@localhost:5432/db" \
    npx prisma generate

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Verify dist exists in final image
RUN ls -la /app/dist/main.js && echo "COPY SUCCESS"

COPY start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 3000
CMD ["./start.sh"]
