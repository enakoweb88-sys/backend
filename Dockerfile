FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate

RUN npm run build

RUN ls -la /app/dist && echo "BUILD SUCCESS" || (echo "BUILD FAILED - dist is empty" && exit 1)

FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

RUN ls -la /app/dist && echo "COPY SUCCESS" || (echo "COPY FAILED - dist missing in final stage" && exit 1)

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:prod"]
