require('tsx/cjs');
require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { GoalsService } = require('../src/modules/goals/goals.service.ts');
const { TasksService } = require('../src/modules/tasks/tasks.service.ts');
const { objectivePeriod } = require('../src/modules/goals/objective-period.ts');
const { CreateGoalDto, GoalProgressDto, GoalReportQueryDto } = require('../src/common/dtos.ts');

const engineer = { sub: 'engineer', role: 'EMPLOYEE', departmentId: 'engineering' };
const manager = { sub: 'manager', role: 'MANAGER' };
const own = { id: 'own', title: 'Ship release', scope: 'PERSONAL', ownerId: 'engineer', creatorId: 'engineer', targetValue: 100, currentValue: 0, status: 'ACTIVE', completedAt: null, updatedAt: new Date('2026-11-01T12:00:00Z') };

function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND') return value.every(filter => matches(row, filter));
    if (key === 'OR') return value.some(filter => matches(row, filter));
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('contains' in value) return String(row[key] || '').toLowerCase().includes(value.contains.toLowerCase());
      if ('not' in value) return row[key] !== value.not;
      if (!('gte' in value) && !('lt' in value)) return matches(row[key] || {}, value);
      if (row[key] == null) return false;
      return (!('gte' in value) || row[key] >= value.gte) && (!('lt' in value) || row[key] < value.lt);
    }
    return row[key] === value;
  });
}
function fixture(seed = []) {
  const rows = structuredClone(seed);
  const queries = [];
  const prisma = { user: { findUnique: async () => ({ departmentId: 'engineering', status: 'ACTIVE' }) }, goal: {
    findMany: async query => { queries.push(query); const result = rows.filter(row => matches(row, query.where)); return query.take ? result.slice(query.skip || 0, (query.skip || 0) + query.take) : result; },
    findFirst: async query => rows.find(row => matches(row, query.where)) || null,
    create: async ({ data }) => { const goal = { ...own, ...data, id: 'new' }; rows.push(goal); return goal; },
    update: async ({ where, data }) => { const row = rows.find(row => row.id === where.id); Object.assign(row, Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined))); return { ...row }; },
  } };
  prisma.$transaction = callback => callback(prisma);
  return { service: new GoalsService(prisma, { enqueue: async () => {} }), rows, queries };
}

test('engineer creates an objective only for themselves with daily bounds', async () => {
  const f = fixture();
  const result = await f.service.create({ title: 'Fix deployment', cadence: 'DAILY', periodStart: '2026-11-02' }, engineer);
  assert.equal(result.scope, 'PERSONAL'); assert.equal(result.ownerId, engineer.sub);
  assert.equal(result.dueDate.toISOString(), '2026-11-02T00:00:00.000Z');
});
test('engineer cannot forge another owner, scope or KPI assignment', async () => {
  for (const payload of [{ ownerId: 'other' }, { scope: 'COMPANY' }, { scope: 'DEPARTMENT', departmentId: 'finance' }, { isKpi: true }]) {
    await assert.rejects(() => fixture().service.create({ title: 'Forged', ...payload }, engineer), /only create personal objectives/);
  }
});
for (const role of ['CEO', 'MANAGER']) {
  test(`${role} creates an objective for self or an employee`, async () => {
    const f = fixture();
    for (const ownerId of ['manager', 'engineer']) {
      const result = await f.service.create({ title: 'Release', scope: 'PERSONAL', ownerId, cadence: 'WEEKLY', periodStart: '2026-11-04' }, { ...manager, role });
      assert.equal(result.ownerId, ownerId); assert.equal(result.dueDate.toISOString().slice(0, 10), '2026-11-08');
    }
  });
}
test('employee search cannot overwrite the department/personal access restriction', async () => {
  const f = fixture([own,
    { ...own, id: 'other', ownerId: 'someone-else' },
    { ...own, id: 'department', scope: 'DEPARTMENT', departmentId: 'engineering' },
    { ...own, id: 'finance', scope: 'DEPARTMENT', departmentId: 'finance' },
    { ...own, id: 'company', scope: 'COMPANY' },
  ]);
  const results = await f.service.list({ search: 'release' }, engineer);
  assert.deepEqual(results.map(row => row.id), ['own', 'department']);
  await assert.rejects(() => f.service.findOne('other', engineer), /not found/);
});
test('department objectives are read-only for an engineer', async () => {
  const f = fixture([{ ...own, scope: 'DEPARTMENT', departmentId: 'engineering' }]);
  await assert.rejects(() => f.service.updateProgress('own', 100, engineer), /own personal objectives/);
  await assert.rejects(() => f.service.complete('own', engineer), /own personal objectives/);
});
test('department access works with existing tokens that have no department claim', async () => {
  const f = fixture([{ ...own, scope: 'DEPARTMENT', departmentId: 'engineering' }]);
  const results = await f.service.list({}, { sub: engineer.sub, role: engineer.role });
  assert.equal(results.length, 1);
});
test('progress stores a stable completion date, clears it when reopened, and rejects invalid values', async () => {
  const f = fixture([own]);
  const result = await f.service.updateProgress('own', 100, engineer);
  assert.equal(result.status, 'COMPLETED'); assert.ok(result.completedAt instanceof Date);
  const timestamp = result.completedAt.getTime();
  assert.equal((await f.service.complete('own', engineer)).completedAt.getTime(), timestamp);
  assert.equal((await f.service.updateProgress('own', 50, engineer)).completedAt, null);
  for (const value of [-1, NaN, Infinity, '100']) await assert.rejects(() => f.service.updateProgress('own', value, engineer), /non-negative/);
});
test('weekly and monthly boundaries handle cross-year weeks and leap years', () => {
  const week = objectivePeriod('WEEKLY', '2027-01-01');
  assert.equal(week.start.toISOString().slice(0, 10), '2026-12-28');
  assert.equal(week.dueDate.toISOString().slice(0, 10), '2027-01-03');
  assert.equal(objectivePeriod('MONTHLY', '2028-02-15').dueDate.toISOString().slice(0, 10), '2028-02-29');
  assert.throws(() => objectivePeriod('MONTHLY', '2026-02-30'), /Invalid/);
});
test('daily reports use Douala midnight and completion date, not due date', async () => {
  const complete = { ...own, status: 'COMPLETED', dueDate: new Date('2026-10-15'), updatedAt: new Date('2026-11-02T12:00:00Z') };
  const f = fixture([
    { ...complete, id: 'inside', completedAt: new Date('2026-11-01T23:00:00Z') },
    { ...complete, id: 'before', completedAt: new Date('2026-11-01T22:59:59Z') },
    { ...complete, id: 'after', completedAt: new Date('2026-11-02T23:00:00Z') },
    { ...complete, id: 'other', ownerId: 'other', completedAt: new Date('2026-11-02T10:00:00Z') },
    { ...complete, id: 'legacy', completedAt: null },
  ]);
  const report = await f.service.report({ period: 'DAILY', date: '2026-11-02' }, engineer);
  assert.deepEqual(report.items.map(row => row.id), ['inside', 'legacy']);
  await assert.rejects(() => f.service.report({ period: 'DAILY', date: '2026-11-02', ownerId: 'other' }, engineer), /only export your own/);
});
test('reports include the full completed period without list pagination and managers can select employees', async () => {
  const rows = Array.from({ length: 80 }, (_, index) => ({ ...own, creatorId: 'manager', id: `g${index}`, status: 'COMPLETED', completedAt: new Date('2026-11-04T12:00:00Z') }));
  rows.push({ ...own, id: 'manager-goal', ownerId: 'manager', status: 'COMPLETED', completedAt: new Date('2026-11-04T12:00:00Z') });
  const f = fixture(rows);
  assert.equal((await f.service.report({ period: 'MONTHLY', date: '2026-11-02', ownerId: 'engineer' }, manager)).items.length, 80);
  assert.equal((await f.service.report({ period: 'WEEKLY', date: '2026-11-04' }, manager)).items.length, 81);
});
test('DTO validation accepts form dates and rejects unsupported cadence or invalid progress', async () => {
  assert.equal((await validate(plainToInstance(CreateGoalDto, { title: 'Release', scope: 'PERSONAL', cadence: 'DAILY', periodStart: '2026-11-02' }))).length, 0);
  assert.ok((await validate(plainToInstance(CreateGoalDto, { title: 'Release', cadence: 'YEARLY' }))).length);
  assert.ok((await validate(plainToInstance(GoalProgressDto, { currentValue: -1 }))).length);
  assert.ok((await validate(plainToInstance(GoalReportQueryDto, { period: 'MONTHLY', date: 'invalid' }))).length);
});

function taskFixture() {
  const tasks = [], notices = [], emails = [];
  const prisma = {
    user: { findUnique: async ({ where }) => ({ id: where.id, status: 'ACTIVE' }) },
    task: {
      create: async ({ data }) => { const result = { id: 'task', ...data, assignee: { email: 'test@example.test' }, creator: {} }; tasks.push(result); return result; },
      findUnique: async () => ({ id: 'other', assigneeId: 'other' }),
    },
    notification: { create: async data => notices.push(data) },
  };
  prisma.$transaction = callback => callback(prisma);
  const service = new TasksService(prisma, { enqueue: async (_, data) => { notices.push(...data); emails.push(...data); } });
  return { service, tasks, notices, emails };
}
test('engineers cannot assign tasks to another employee, including a multi-assignee payload', async () => {
  for (const dto of [{ assigneeId: 'other' }, { assigneeIds: ['engineer', 'other'] }]) {
    const f = taskFixture();
    await assert.rejects(() => f.service.create({ title: 'Unauthorized', ...dto }, engineer), /Only managers and the CEO/);
    assert.equal(f.tasks.length, 0);
  }
});
for (const role of ['CEO', 'MANAGER', 'EMPLOYEE']) {
  test(`${role} can create their own task without assignment notifications`, async () => {
    const f = taskFixture();
    const task = await f.service.create({ title: 'My work', status: 'IN_PROGRESS' }, { sub: 'self', role });
    assert.equal(task.assigneeId, 'self'); assert.equal(task.status, 'IN_PROGRESS');
    assert.equal(f.notices.length, 0); assert.equal(f.emails.length, 0);
  });
}
for (const role of ['CEO', 'MANAGER']) {
  test(`${role} can assign a task to an employee`, async () => {
    const f = taskFixture();
    await f.service.create({ title: 'Assigned work', assigneeId: 'engineer' }, { sub: 'boss', role });
    assert.equal(f.tasks[0].assigneeId, 'engineer'); assert.equal(f.notices.length, 1);
    assert.equal(f.emails.length, 1); // A stub: no actual email is sent by these tests.
  });
}
test('engineers cannot read, comment on or reassign another employee task by ID', async () => {
  const f = taskFixture();
  await assert.rejects(() => f.service.findOne('other', engineer), /only view/);
  await assert.rejects(() => f.service.getComments('other', engineer), /only view/);
  await assert.rejects(() => f.service.addComment('other', { content: 'forged' }, engineer), /only view/);
  await assert.rejects(() => f.service.update('other', { assigneeId: 'engineer' }, engineer), /only update/);
});
