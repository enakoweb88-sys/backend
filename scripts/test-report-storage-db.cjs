const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { createHash } = require('node:crypto');
const prisma = new PrismaClient();
async function main() {
  await prisma.$transaction(async tx => {
    // Session-local table: no application tables or reports are changed.
    await tx.$executeRawUnsafe('CREATE TEMP TABLE report_binary_roundtrip_check (id text PRIMARY KEY, data bytea NOT NULL, sha256 text NOT NULL) ON COMMIT DROP');
    require('tsx/cjs');
    const { ReportDocumentsService } = require('../src/modules/reports/report-documents.service.ts');
    const security = new ReportDocumentsService({ $executeRawUnsafe: sql => tx.$executeRawUnsafe(sql.replaceAll('public.report_documents', 'pg_temp.report_binary_roundtrip_check')) }, null);
    await security.onModuleInit();
    const { ReportAlertsService } = require('../src/modules/reports/report-alerts.service.ts');
    const queueSecurity = new ReportAlertsService({ $executeRawUnsafe: sql => tx.$executeRawUnsafe(sql.replaceAll('public.notification_email_deliveries', 'pg_temp.report_binary_roundtrip_check')) }, null);
    await queueSecurity.onModuleInit();
    const [securityState] = await tx.$queryRaw`SELECT relrowsecurity FROM pg_class WHERE oid = 'pg_temp.report_binary_roundtrip_check'::regclass`;
    assert.equal(securityState.relrowsecurity, true);
    const bytes = Buffer.from('%PDF-1.7\nOriginal report bytes\0\xff', 'latin1');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    await tx.$executeRaw`INSERT INTO report_binary_roundtrip_check (id, data, sha256) VALUES ('check', ${bytes}, ${sha256})`;
    const [row] = await tx.$queryRaw`SELECT data, sha256 FROM report_binary_roundtrip_check WHERE id = 'check'`;
    assert.deepEqual(Buffer.from(row.data), bytes);
    assert.equal(createHash('sha256').update(row.data).digest('hex'), row.sha256);
    console.log('Database binary integrity and document/email-queue security SQL verified; temporary table removed at commit.');
  });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
