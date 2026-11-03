import { Prisma, PrismaClient } from '@prisma/client';

// This repository predates Prisma migration history. Apply only the explicitly
// listed, non-destructive upgrades needed by the shipped report features.
// Never run a general db push with --accept-data-loss during application boot.
export async function ensureRuntimeSchema(prisma: PrismaClient, schema = 'public') {
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error('Invalid schema name');
  const table = (name: string) => `"${schema}"."${name}"`;
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '10s'");
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(729512431)');
    await ensureObjectiveSchema(tx, schema);

    await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS ${table('report_documents')} (
      "id" TEXT NOT NULL PRIMARY KEY,
      "reportId" TEXT NOT NULL,
      "originalName" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "sizeBytes" INTEGER NOT NULL,
      "sha256" TEXT NOT NULL,
      "data" BYTEA NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "report_documents_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES ${table('daily_reports')}("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "report_documents_reportId_idx" ON ${table('report_documents')} ("reportId")`);

    await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS ${table('notification_email_deliveries')} (
      "id" TEXT NOT NULL PRIMARY KEY,
      "notificationId" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "leaseUntil" TIMESTAMP(3),
      "leaseToken" TEXT,
      "recipientEmail" TEXT,
      "sentAt" TIMESTAMP(3),
      "providerMessageId" TEXT,
      "lastError" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "notification_email_deliveries_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES ${table('notifications')}("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "notification_email_deliveries_notificationId_key" ON ${table('notification_email_deliveries')} ("notificationId")`);
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "notification_email_deliveries_status_nextAttemptAt_idx" ON ${table('notification_email_deliveries')} ("status", "nextAttemptAt")`);
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "notification_email_deliveries_status_leaseUntil_idx" ON ${table('notification_email_deliveries')} ("status", "leaseUntil")`);

    await tx.$executeRawUnsafe(`ALTER TABLE ${table('daily_reports')}
      ADD COLUMN IF NOT EXISTS "ceoCompletedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "ceoComment" TEXT,
      ADD COLUMN IF NOT EXISTS "ceoReviewerId" TEXT`);
    await tx.$executeRawUnsafe(`ALTER TABLE ${table('messages')}
      ADD COLUMN IF NOT EXISTS "reportReferenceId" TEXT,
      ADD COLUMN IF NOT EXISTS "reportReferenceTitle" TEXT`);

    // Keep table creation and access protection in the same transaction, so
    // new report files and delivery jobs are never briefly exposed publicly.
    for (const name of ['report_documents', 'notification_email_deliveries', 'messages', 'channels', 'channel_members']) {
      await tx.$executeRawUnsafe(`ALTER TABLE ${table(name)} ENABLE ROW LEVEL SECURITY`);
      await tx.$executeRawUnsafe(`REVOKE ALL ON ${table(name)} FROM PUBLIC`);
      await tx.$executeRawUnsafe(`DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          REVOKE ALL ON ${table(name)} FROM anon;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          REVOKE ALL ON ${table(name)} FROM authenticated;
        END IF;
      END $$`);
    }

    // The API now enforces one daily meal for employees while allowing an
    // explicit manager/CEO exception. Preserve the lookup index and all rows.
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "meal_records_employeeId_date_idx" ON ${table('meal_records')} ("employeeId", "date")`);
    await tx.$executeRawUnsafe(`ALTER TABLE ${table('meal_records')} DROP CONSTRAINT IF EXISTS "meal_records_employeeId_date_key"`);
    await tx.$executeRawUnsafe(`DROP INDEX IF EXISTS ${table('meal_records_employeeId_date_key')}`);
  }, { maxWait: 10_000, timeout: 60_000 });
}

// Also usable for a targeted objectives repair without applying other feature upgrades.
export async function ensureObjectiveSchema(tx: Prisma.TransactionClient, schema = 'public') {
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error('Invalid schema name');
  const table = (name: string) => `"${schema}"."${name}"`;
  await tx.$executeRawUnsafe(`ALTER TABLE ${table('goals')}
      ADD COLUMN IF NOT EXISTS "targetLabel" TEXT,
      ADD COLUMN IF NOT EXISTS "isKpi" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "kpiWeight" DECIMAL(5,2),
      ADD COLUMN IF NOT EXISTS "cadence" TEXT,
      ADD COLUMN IF NOT EXISTS "periodStart" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3)`);
  await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "goals_status_completedAt_idx" ON ${table('goals')} ("status", "completedAt")`);
}
