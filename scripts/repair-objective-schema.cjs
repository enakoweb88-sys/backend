if (require('node:fs').existsSync('.env')) process.loadEnvFile('.env');
require('tsx/cjs');
require('reflect-metadata');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { ensureObjectiveSchema } = require('../src/modules/prisma/runtime-schema.ts');
const { GoalsService } = require('../src/modules/goals/goals.service.ts');
const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '10s'");
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(729512431)');
    await ensureObjectiveSchema(tx);
  }, { timeout: 60_000 });
  console.log('Objective schema upgraded additively; existing objectives preserved.');

  const author = await prisma.user.findFirst({ where: { status: 'ACTIVE', role: { name: 'EMPLOYEE' } }, select: { id: true } });
  assert.ok(author, 'An active employee is needed for rollback verification');
  const rollback = new Error('ROLL_BACK_OBJECTIVE_VERIFICATION');
  const createdIds = [];
  try {
    await prisma.$transaction(async tx => {
      const service = new GoalsService({ ...tx, $transaction: callback => callback(tx) });
      for (const cadence of ['DAILY', 'WEEKLY', 'MONTHLY']) {
        const goal = await service.create({ title: 'Temporary objective verification (rolled back)', cadence, periodStart: '2026-11-03' }, { sub: author.id, role: 'EMPLOYEE' });
        createdIds.push(goal.id);
        assert.equal(goal.cadence, cadence);
        assert.equal(goal.ownerId, author.id);
        assert.equal(goal.isKpi, false);
        assert.ok(goal.dueDate instanceof Date);
      }
      throw rollback;
    }, { timeout: 60_000 });
    throw new Error('Verification should have rolled back');
  } catch (error) {
    if (error !== rollback) throw error;
  }
  assert.equal(await prisma.goal.count({ where: { id: { in: createdIds } } }), 0);
  console.log('PASS: daily, weekly and monthly objective creation works; all verification records rolled back.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
