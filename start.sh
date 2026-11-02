#!/bin/sh
set -eu

if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations)" ]; then
  echo "Running Prisma migrations..."
  npx prisma migrate deploy
else
  echo "No Prisma migration history; application startup will verify additive schema upgrades."
fi

exec node dist/main.js
