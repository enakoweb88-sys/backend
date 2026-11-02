require('tsx/cjs');
require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { MealsService } = require('../src/modules/meals/meals.service.ts');
const { MealsController } = require('../src/modules/meals/meals.controller.ts');
const { ROLES_KEY } = require('../src/common/roles.decorator.ts');

const dto = { employeeId: 'employee', date: '2026-11-02', status: 'ATE' };
function fixture(existing = null, conflictOnce = false) {
  let checks = 0, writes = 0, attempts = 0;
  const tx = { mealRecord: {
    findFirst: async () => { checks++; return existing; },
    create: async ({ data }) => { writes++; return { id: 'meal', ...data }; },
  } };
  const prisma = { $transaction: async (run, options) => {
    assert.equal(options.isolationLevel, 'Serializable');
    attempts++;
    if (conflictOnce && attempts === 1) throw { code: 'P2034' };
    return run(tx);
  } };
  return { service: new MealsService(prisma), counts: () => ({ checks, writes, attempts }) };
}

for (const role of ['EMPLOYEE', 'OUTREACH_MANAGER', 'ADMIN']) {
  test(`${role} cannot create a second daily entry`, async () => {
    const f = fixture({ employee: { fullName: 'Joseph' } });
    await assert.rejects(() => f.service.record(dto, { sub: 'employee', role }), /already been recorded/);
    assert.equal(f.counts().writes, 0);
  });
  test(`${role} cannot submit meals for another employee`, async () => {
    const controller = new MealsController({ record: async payload => payload });
    const result = await controller.record({ ...dto, employeeId: 'someone-else' }, { sub: 'self', role });
    assert.equal(result.employeeId, 'self');
  });
}
for (const role of ['CEO', 'MANAGER']) {
  test(`${role} may intentionally create repeat daily entries`, async () => {
    const f = fixture({ id: 'previous' });
    await f.service.record(dto, { sub: 'manager', role });
    assert.equal(f.counts().checks, 0);
    assert.equal(f.counts().writes, 1);
  });
}
test('serialization conflicts retry the daily check', async () => {
  const f = fixture(null, true);
  await f.service.record(dto, { sub: 'employee', role: 'EMPLOYEE' });
  assert.equal(f.counts().attempts, 2);
  assert.equal(f.counts().writes, 1);
});
test('uneaten meals have no subsidy or payroll charge', async () => {
  const f = fixture();
  const meal = await f.service.record({ ...dto, status: 'DID_NOT_EAT' }, { sub: 'employee', role: 'EMPLOYEE' });
  assert.equal(meal.companyAmount, 0);
  assert.equal(meal.employeeAmount, 0);
  assert.equal(meal.totalAmount, 0);
});
test('delete endpoint only authorizes CEO and MANAGER', () => {
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, MealsController.prototype.remove), ['CEO', 'MANAGER']);
});
