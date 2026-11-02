require('tsx/cjs');
require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ReportsService } = require('../src/modules/reports/reports.service.ts');
const employee = { sub: 'engineer', role: 'EMPLOYEE' };
const manager = { sub: 'manager', role: 'MANAGER' };
const submitted = { id: 'report', userId: 'engineer', type: 'MONTHLY', status: 'SUBMITTED', content: 'Title: Engineering progress\nDetails:\nRelease deployed', date: new Date(), user: { fullName: 'Engineer' } };

function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND') return value.every(filter => matches(row, filter));
    if (key === 'OR') return value.some(filter => matches(row, filter));
    if (value && typeof value === 'object') {
      if ('in' in value) return value.in.includes(row[key]);
      return (!('gte' in value) || row[key] >= value.gte) && (!('lte' in value) || row[key] <= value.lte);
    }
    return row[key] === value;
  });
}
function fixture(seed = []) {
  const rows = structuredClone(seed), notifications = [];
  const prisma = {
    dailyReport: {
      findMany: async ({ where }) => rows.filter(row => matches(row, where)),
      findFirst: async ({ where }) => rows.find(row => matches(row, where)) || null,
      findUnique: async ({ where }) => rows.find(row => row.id === where.id) || null,
      create: async ({ data }) => { const report = { ...submitted, ...data, id: 'created' }; rows.push(report); return report; },
      update: async ({ where, data }) => { const row = rows.find(row => row.id === where.id); Object.assign(row, data); return { ...row }; },
    },
    user: { findMany: async query => { assert.deepEqual(query.where.role.name.in, ['CEO', 'MANAGER']); return [{ id: 'manager' }, { id: 'ceo' }]; } },
    notification: { createMany: async ({ data }) => notifications.push(...data) },
  };
  prisma.$transaction = async callback => callback(prisma);
  return { service: new ReportsService(prisma), rows, notifications };
}

for (const type of ['DAILY', 'WEEKLY', 'MONTHLY']) {
  test(`engineers submit ${type} work reports and notify management in-system`, async () => {
    const f = fixture();
    const report = await f.service.createDaily({ content: 'Completed engineering work', type, status: 'SUBMITTED', userId: 'forged-author' }, employee);
    assert.equal(report.userId, employee.sub); assert.equal(report.type, type);
    assert.deepEqual(f.notifications.map(item => item.userId), ['manager', 'ceo']);
    assert.ok(f.notifications.every(item => item.link === '/app/reports?reportId=created'));
  });
}
test('saving a draft sends no notifications; submitting the same draft sends it to management', async () => {
  const f = fixture();
  const report = await f.service.createDaily({ content: 'Draft work', type: 'DAILY', status: 'DRAFT' }, employee);
  assert.equal(f.notifications.length, 0);
  const result = await f.service.updateDaily(report.id, { content: 'Final work', type: 'DAILY', status: 'SUBMITTED' }, employee);
  assert.equal(result.id, report.id); assert.equal(result.status, 'SUBMITTED'); assert.equal(f.rows.length, 1);
  assert.equal(f.notifications.length, 2);
});
for (const role of ['MANAGER', 'CEO']) {
  test(`${role} can list and view monthly reports but cannot read someone else's draft`, async () => {
    const f = fixture([submitted, { ...submitted, id: 'private', status: 'DRAFT' }]);
    const viewer = { sub: 'boss', role };
    assert.equal((await f.service.listDaily(viewer)).length, 1);
    assert.equal((await f.service.findDaily('report', viewer)).content, submitted.content);
    await assert.rejects(() => f.service.findDaily('private', viewer), /not found/);
    assert.equal((await f.service.listDaily(viewer, 'MONTHLY')).length, 1);
  });
}
test('employees cannot list or open another employee report', async () => {
  const f = fixture([submitted, { ...submitted, id: 'other', userId: 'other-employee' }]);
  assert.deepEqual((await f.service.listDaily(employee)).map(item => item.id), ['report']);
  await assert.rejects(() => f.service.findDaily('other', employee), /not found/);
  await assert.rejects(() => f.service.updateDaily('other', { content: 'forged' }, employee), /not found/);
});
test('authors cannot forge approved statuses or make submitted reports private', async () => {
  const f = fixture([submitted]);
  await assert.rejects(() => f.service.createDaily({ content: 'work', status: 'VERIFIED' }, employee), /drafts or submitted/);
  await assert.rejects(() => f.service.updateDaily('report', { status: 'DRAFT' }, employee), /private again/);
  await assert.rejects(() => f.service.createDaily({ content: 12 }, employee), /content cannot/);
});
test('review permissions prevent self-review, draft review and unsupported review statuses', async () => {
  const f = fixture([submitted, { ...submitted, id: 'draft', status: 'DRAFT' }]);
  await assert.rejects(() => f.service.reviewDaily('report', { status: 'VERIFIED' }, employee), /Only managers/);
  await assert.rejects(() => f.service.reviewDaily('report', { status: 'DRAFT' }, manager), /Choose verify/);
  await assert.rejects(() => f.service.reviewDaily('draft', { status: 'VERIFIED' }, manager), /draft/);
  await assert.rejects(() => f.service.reviewDaily('report', { status: 'VERIFIED' }, { ...manager, sub: employee.sub }), /own report/);
});
test('returned reports can be corrected and resubmitted with prior review cleared', async () => {
  const f = fixture([{ ...submitted, status: 'RETURNED', reviewerComments: 'More details', reviewerId: 'manager' }]);
  const report = await f.service.updateDaily('report', { content: 'Corrected work', status: 'SUBMITTED' }, employee);
  assert.equal(report.reviewerComments, null); assert.equal(report.reviewerId, null);
  assert.equal(report.content, 'Corrected work'); assert.equal(report.status, 'SUBMITTED');
});
test('managers can verify a submitted employee report and authors cannot silently edit approval', async () => {
  const f = fixture([submitted]);
  const report = await f.service.reviewDaily('report', { status: 'VERIFIED', reviewerComments: 'Reviewed' }, manager);
  assert.equal(report.status, 'VERIFIED'); assert.equal(report.reviewerId, manager.sub); assert.equal(report.reviewerComments, 'Reviewed');
  await assert.rejects(() => f.service.updateDaily('report', { content: 'Changed' }, employee), /Verified reports cannot/);
});
