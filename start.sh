#!/bin/sh
echo "Syncing database schema..."
npx prisma db push --accept-data-loss
echo "Starting server..."
node dist/main.js
