import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS "subscriptions" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "cost" DECIMAL(14,2) NOT NULL,
      "cycle" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'Active',
      "nextBilling" TIMESTAMP(3) NOT NULL,
      "receiptUrl" TEXT,
      "addedById" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
    );`,
    `DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'subscriptions_addedById_idx' AND n.nspname = 'public') THEN
        CREATE INDEX "subscriptions_addedById_idx" ON "subscriptions"("addedById");
      END IF;
    END $$;`,
    `DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_addedById_fkey') THEN
        ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$;`,
    `CREATE TABLE IF NOT EXISTS "report_files" (
      "id" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "size" TEXT NOT NULL,
      "data" TEXT,
      "generatedBy" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "report_files_pkey" PRIMARY KEY ("id")
    );`,
    `DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'report_files_generatedBy_idx' AND n.nspname = 'public') THEN
        CREATE INDEX "report_files_generatedBy_idx" ON "report_files"("generatedBy");
      END IF;
    END $$;`,
    `DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_files_generatedBy_fkey') THEN
        ALTER TABLE "report_files" ADD CONSTRAINT "report_files_generatedBy_fkey" FOREIGN KEY ("generatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
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
