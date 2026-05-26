# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache openssl libc6-compat python3 make g++

COPY package*.json ./

# Install all dependencies (including dev) for building
RUN npm ci

COPY . .

# Generate Prisma client and build the app
RUN npm run prisma:generate && npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies - critical for Prisma
RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy Prisma files and built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 5000

ENV NODE_ENV=production

# Run migrations and start the app
CMD ["sh", "-c", "npm run prisma:deploy && npm run start:prod"]
