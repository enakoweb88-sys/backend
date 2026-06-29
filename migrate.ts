import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS "user_preferences" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "analytics" BOOLEAN NOT NULL DEFAULT true,
      "mfa" BOOLEAN NOT NULL DEFAULT false,
      "aiWorkspace" BOOLEAN NOT NULL DEFAULT false,
      "emailNotif" BOOLEAN NOT NULL DEFAULT true,
      "pushNotif" BOOLEAN NOT NULL DEFAULT true,
      "smsNotif" BOOLEAN NOT NULL DEFAULT false,
      "slackConnected" BOOLEAN NOT NULL DEFAULT false,
      "awsConnected" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
    );`,
    `DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'user_preferences_userId_key' AND n.nspname = 'public') THEN
        CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");
      END IF;
    END $$;`,
    `DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_preferences_userId_fkey') THEN
        ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;`,
    `DO $$
    BEGIN
      ALTER TABLE "refresh_tokens" ADD COLUMN "device" TEXT;
    EXCEPTION
      WHEN duplicate_column THEN null;
    END $$;`,
    `DO $$
    BEGIN
      ALTER TABLE "refresh_tokens" ADD COLUMN "ipAddress" TEXT;
    EXCEPTION
      WHEN duplicate_column THEN null;
    END $$;`,
    `DO $$
    BEGIN
      ALTER TABLE "refresh_tokens" ADD COLUMN "location" TEXT;
    EXCEPTION
      WHEN duplicate_column THEN null;
    END $$;`
  ];

  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log("Success");
    } catch (e) {
      console.error(e);
    }
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
