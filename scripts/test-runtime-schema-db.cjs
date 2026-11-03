if (require('node:fs').existsSync('.env')) process.loadEnvFile('.env');
require('tsx/cjs');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { randomUUID, createHash } = require('node:crypto');
const { ensureRuntimeSchema } = require('../src/modules/prisma/runtime-schema.ts');
const prisma = new PrismaClient();
const schema = 'enako_bootstrap_test_' + randomUUID().replaceAll('-', '').slice(0, 12);
let isolated;
async function main() {
  await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  try {
    await prisma.$executeRawUnsafe(`CREATE TABLE "${schema}".goals (id TEXT PRIMARY KEY, status TEXT NOT NULL)`);
    await prisma.$executeRawUnsafe(`CREATE TABLE "${schema}".daily_reports (id TEXT PRIMARY KEY)`);
    await prisma.$executeRawUnsafe(`CREATE TABLE "${schema}".notifications (id TEXT PRIMARY KEY)`);
    await prisma.$executeRawUnsafe(`CREATE TABLE "${schema}".meal_records (id TEXT PRIMARY KEY, "employeeId" TEXT NOT NULL, date TIMESTAMP(3) NOT NULL)`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX "meal_records_employeeId_date_key" ON "${schema}".meal_records ("employeeId", date)`);
    await prisma.$executeRawUnsafe(`INSERT INTO "${schema}".goals VALUES ('existing-goal', 'ACTIVE')`);
    await prisma.$executeRawUnsafe(`INSERT INTO "${schema}".daily_reports VALUES ('existing-report')`);
    await prisma.$executeRawUnsafe(`INSERT INTO "${schema}".notifications VALUES ('existing-notification')`);
    await prisma.$executeRawUnsafe(`INSERT INTO "${schema}".meal_records VALUES ('existing-meal', 'employee', '2026-11-02')`);
    for (const name of ['messages', 'channels', 'channel_members']) await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "${schema}"."${name}" (id TEXT PRIMARY KEY)`);
    await ensureRuntimeSchema(prisma, schema);
    const connection = new URL(process.env.DATABASE_URL);
    connection.searchParams.set('schema', schema);
    isolated = new PrismaClient({ datasources: { db: { url: connection.toString() } } });
    const columns = await prisma.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_schema='${schema}' AND table_name='daily_reports'`);
    assert.ok(columns.some(column => column.column_name === 'ceoCompletedAt'));
    const data = Buffer.from('%PDF-1.7\nExact document bytes\0');
    const file = await isolated.reportDocument.create({ data: { reportId: 'existing-report', originalName: 'test.pdf', mimeType: 'application/pdf', sizeBytes: data.length, sha256: createHash('sha256').update(data).digest('hex'), data } });
    const job = await isolated.notificationEmailDelivery.create({ data: { notificationId: 'existing-notification' } });
    assert.equal(job.status, 'PENDING'); assert.equal(job.attempts, 0);
    await ensureRuntimeSchema(prisma, schema);
    assert.deepEqual((await isolated.reportDocument.findUnique({ where: { id: file.id } })).data, data);
    assert.equal((await isolated.notificationEmailDelivery.findUnique({ where: { id: job.id } })).status, 'PENDING');
    const flags = await prisma.$queryRaw`SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=${schema} AND c.relname IN ('report_documents','notification_email_deliveries')`;
    assert.equal(flags.length, 2); assert.ok(flags.every(row => row.relrowsecurity));
    const goals = await isolated.goal.findMany({ select: { id: true, cadence: true, completedAt: true, periodStart: true, targetLabel: true, isKpi: true, kpiWeight: true } });
    assert.equal(goals.length, 1); assert.equal(goals[0].id, 'existing-goal'); assert.equal(goals[0].cadence, null);
    assert.equal(goals[0].targetLabel, null); assert.equal(goals[0].isKpi, false); assert.equal(goals[0].kpiWeight, null);
    await prisma.$executeRawUnsafe(`INSERT INTO "${schema}".meal_records VALUES ('manager-extra-meal', 'employee', '2026-11-02')`);
    const [meals] = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS count FROM "${schema}".meal_records`);
    assert.equal(meals.count, 2);
    console.log('PASS: missing tables/columns created; existing records preserved; files and email jobs work; RLS enabled; rerun preserves data; manager meal exception supported.');
  } finally {
    if (isolated) await isolated.$disconnect();
    assert.ok(/^enako_bootstrap_test_[a-f0-9]{12}$/.test(schema));
    await prisma.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
