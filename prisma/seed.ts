import { PrismaClient } from '@prisma/client';
// Development fixtures only. No default accounts, passwords or business figures.
async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || process.env.NODE_ENV === 'production') throw new Error('Seed is restricted to a disposable local database');
  const prisma = new PrismaClient();
  try {
    for (const name of ['CEO', 'MANAGER', 'EMPLOYEE', 'OUTREACH_MANAGER'] as const) await prisma.role.upsert({ where: { name }, create: { name }, update: {} });
    for (const name of ['general', 'operations', 'announcements']) await prisma.channel.upsert({ where: { name }, create: { name, isGeneral: true }, update: {} });
  } finally { await prisma.$disconnect(); }
}
main().catch(() => { console.error('Local seed failed'); process.exitCode = 1; });
