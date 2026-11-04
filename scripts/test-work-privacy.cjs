require('tsx/cjs'); require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TasksService } = require('../src/modules/tasks/tasks.service.ts');
const { GoalsService } = require('../src/modules/goals/goals.service.ts');
const { taskAccess, personalGoalAccess } = require('../src/modules/tasks/work-access.ts');
const people = { engineer: { sub: 'engineer', role: 'EMPLOYEE' }, ceo: { sub: 'ceo', role: 'CEO' }, manager: { sub: 'manager', role: 'MANAGER' } };
function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND') return value.every(rule => matches(row, rule));
    if (key === 'OR') return value.some(rule => matches(row, rule));
    if (value && typeof value === 'object') {
      if ('not' in value) return row[key] !== value.not;
      if ('gte' in value) return row[key] >= value.gte && row[key] < value.lt;
      return matches(row[key] || {}, value);
    }
    return row[key] === value;
  });
}
function fixture() {
  const tasks = [
    { id: 'private', title: 'Private plan', creatorId: 'engineer', assigneeId: 'engineer', status: 'TODO' },
    { id: 'assigned', title: 'Assigned work', creatorId: 'ceo', assigneeId: 'engineer', status: 'TODO' },
    { id: 'ceo-own', title: 'CEO private plan', creatorId: 'ceo', assigneeId: 'ceo', status: 'TODO' },
  ];
  const goals = tasks.map(row => ({ ...row, ownerId: row.assigneeId, scope: 'PERSONAL', status: 'COMPLETED', completedAt: new Date('2026-11-03T12:00:00Z') }));
  const notices = [];
  const prisma = {
    task: { findMany: async ({ where }) => tasks.filter(row => matches(row, where)), findUnique: async ({ where }) => tasks.find(row => row.id === where.id), update: async ({ where, data }) => { const row = tasks.find(row => row.id === where.id); Object.assign(row, data); return row; }, delete: async () => assert.fail('Unauthorized deletion') },
    goal: { findMany: async ({ where }) => goals.filter(row => matches(row, where)), findFirst: async ({ where }) => goals.find(row => matches(row, where)) },
    user: { findUnique: async () => ({ status: 'ACTIVE' }) },
  };
  prisma.$transaction = callback => callback(prisma);
  const alerts = { enqueue: async (_, records) => notices.push(...records) };
  return { tasks, goals, notices, tasksService: new TasksService(prisma, alerts), goalsService: new GoalsService(prisma, alerts) };
}
test('private and assigned tasks have the same privacy for every role', async () => {
  const f = fixture();
  assert.deepEqual((await f.tasksService.list(people.engineer)).map(row => row.id), ['private', 'assigned']);
  assert.deepEqual((await f.tasksService.list(people.ceo)).map(row => row.id), ['assigned', 'ceo-own']);
  assert.deepEqual(await f.tasksService.list(people.manager), []);
  for (const action of [() => f.tasksService.findOne('private', people.ceo), () => f.tasksService.update('private', { title: 'Changed' }, people.ceo), () => f.tasksService.setStatus('private', 'DONE', people.ceo), () => f.tasksService.addComment('private', { content: 'Comment' }, people.ceo), () => f.tasksService.deleteTask('private', people.ceo)]) await assert.rejects(action, /only view|only update/);
});
test('personal objectives and exports do not leak to unrelated management', async () => {
  const f = fixture();
  assert.deepEqual((await f.goalsService.list({}, people.ceo)).map(row => row.id), ['assigned', 'ceo-own']);
  assert.deepEqual(await f.goalsService.list({}, people.manager), []);
  await assert.rejects(() => f.goalsService.findOne('private', people.ceo), /not found/);
  await assert.rejects(() => f.goalsService.complete('private', people.ceo), /not found/);
  const report = await f.goalsService.report({ period: 'MONTHLY', date: '2026-11-03', ownerId: 'engineer' }, people.ceo);
  assert.deepEqual(report.items.map(row => row.id), ['assigned']);
});
test('reassignment creates a durable alert addressed to the newly selected employee', async () => {
  const f = fixture();
  await f.tasksService.update('ceo-own', { assigneeId: 'engineer' }, people.ceo);
  assert.equal(f.notices.length, 1);
  assert.equal(f.notices[0].userId, 'engineer');
  assert.equal(f.notices[0].link, '/app/tasks?taskId=ceo-own');
});
test('shared predicates expose only work owned by or assigned by the current user', () => {
  assert.equal(matches({ creatorId: 'engineer', assigneeId: 'engineer' }, taskAccess('ceo')), false);
  assert.equal(matches({ creatorId: 'ceo', assigneeId: 'engineer' }, taskAccess('ceo')), true);
  assert.equal(matches({ creatorId: null, ownerId: 'engineer' }, personalGoalAccess('ceo')), false);
});
