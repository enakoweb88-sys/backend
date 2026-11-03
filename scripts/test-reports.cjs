require('tsx/cjs');
require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ReportsService } = require('../src/modules/reports/reports.service.ts');
const { ReportAlertsService } = require('../src/modules/reports/report-alerts.service.ts');
const employee = { sub: 'engineer', role: 'EMPLOYEE' };
const manager = { sub: 'manager', role: 'MANAGER' };
const submitted = { id: 'report', userId: 'engineer', type: 'MONTHLY', status: 'SUBMITTED', content: 'Title: Engineering progress\nDetails:\nRelease deployed', date: new Date(), user: { fullName: 'Engineer', role: { name: 'EMPLOYEE' } } };

function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND') return value.every(filter => matches(row, filter));
    if (key === 'OR') return value.some(filter => matches(row, filter));
    if (value && typeof value === 'object') {
      if ('in' in value) return value.in.includes(row[key]);
      if ('gte' in value || 'lte' in value) return (!('gte' in value) || row[key] >= value.gte) && (!('lte' in value) || row[key] <= value.lte);
      return matches(row[key] || {}, value);
    }
    return value === null ? row[key] == null : row[key] === value;
  });
}
function fixture(seed = []) {
  const rows = structuredClone(seed), notifications = [], emailJobs = [], messages = [], channels = [];
  const prisma = {
    dailyReport: {
      updateMany: async ({ where, data }) => { const row = rows.find(row => matches(row, where)); if (!row) return { count: 0 }; Object.assign(row, data); return { count: 1 }; },
      findMany: async ({ where }) => rows.filter(row => matches(row, where)),
      findFirst: async ({ where }) => rows.find(row => matches(row, where)) || null,
      findUnique: async ({ where }) => rows.find(row => row.id === where.id) || null,
      create: async ({ data }) => { const report = { ...submitted, ...data, id: 'created', user: { role: { name: data.userId === 'manager' ? 'MANAGER' : data.userId === 'ceo' ? 'CEO' : 'EMPLOYEE' } } }; rows.push(report); return report; },
      update: async ({ where, data }) => { const row = rows.find(row => row.id === where.id); Object.assign(row, data); return { ...row }; },
    },
    channel: { upsert: async ({ create, where }) => { let channel = channels.find(item => item.name === where.name); if (!channel) { channel = { id: 'private', ...create }; channels.push(channel); } return channel; } },
    message: { create: async ({ data }) => { messages.push(data); return data; } },
    user: { findMany: async query => query.where.role.name.in.map(role => ({ id: role.toLowerCase() })) },
    notification: { createMany: async ({ data }) => notifications.push(...data) },
    notificationEmailDelivery: { createMany: async ({ data }) => emailJobs.push(...data) },
  };
  prisma.$transaction = async callback => callback(prisma);
  return { service: new ReportsService(prisma, new ReportAlertsService(prisma, {})), rows, notifications, emailJobs, messages, channels, prisma };
}

for (const type of ['DAILY', 'WEEKLY', 'MONTHLY']) {
  test(`engineers submit ${type} work reports and notify management in-system`, async () => {
    const f = fixture();
    const report = await f.service.createDaily({ content: 'Completed engineering work', type, status: 'SUBMITTED', userId: 'forged-author' }, employee);
    assert.equal(report.userId, employee.sub); assert.equal(report.type, type);
    assert.deepEqual(f.notifications.map(item => item.userId), ['manager', employee.sub]);
    assert.equal(f.emailJobs.length, f.notifications.length);
    assert.ok(f.emailJobs.every(job => f.notifications.some(item => item.id === job.notificationId)));
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
    const f = fixture([{ ...submitted, status: role === 'CEO' ? 'VERIFIED' : 'SUBMITTED' }, { ...submitted, id: 'private', status: 'DRAFT' }]);
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
  await assert.rejects(() => f.service.reviewDaily('draft', { status: 'VERIFIED' }, manager), /draft|not found/);
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
  await assert.rejects(() => f.service.updateDaily('report', { content: 'Changed' }, employee), /reports cannot be changed/);
});

const ceo = { sub: 'ceo', role: 'CEO' };
test('employee submissions go only to the manager; acceptance forwards to CEO once', async () => {
  const f = fixture([submitted]);
  assert.equal((await f.service.listDaily(manager)).length, 1);
  assert.equal((await f.service.listDaily(ceo)).length, 0);
  await assert.rejects(() => f.service.findDaily('report', ceo), /not found/);
  await assert.rejects(() => f.service.ceoReview('report', { complete: true }, ceo), /not found/);
  await f.service.reviewDaily('report', { status: 'VERIFIED', reviewerComments: 'Accepted' }, manager);
  assert.equal((await f.service.listDaily(ceo)).length, 1);
  assert.equal((await f.service.findDaily('report', ceo)).reviewerId, manager.sub);
  assert.equal(f.notifications.filter(item => item.userId === 'ceo').length, 1);
  assert.equal(f.emailJobs.length, f.notifications.length);
  assert.ok(f.notifications.some(item => item.userId === employee.sub && item.body.includes('forwarded')));
  await assert.rejects(() => f.service.reviewDaily('report', { status: 'VERIFIED' }, manager), /read-only/);
  assert.equal(f.notifications.filter(item => item.userId === 'ceo').length, 1);
});
test('returning for correction and resubmitting do not forward to the CEO', async () => {
  const f = fixture([submitted]);
  await f.service.reviewDaily('report', { status: 'RETURNED', reviewerComments: 'Add evidence' }, manager);
  assert.equal((await f.service.listDaily(ceo)).length, 0);
  assert.equal(f.notifications.filter(item => item.userId === 'ceo').length, 0);
  assert.ok(f.notifications.some(item => item.userId === employee.sub && item.body === 'Add evidence'));
  await f.service.updateDaily('report', { content: 'Corrected evidence', status: 'SUBMITTED' }, employee);
  assert.equal((await f.service.listDaily(ceo)).length, 0);
  assert.equal(f.notifications.filter(item => item.userId === 'ceo').length, 0);
  await f.service.reviewDaily('report', { status: 'VERIFIED' }, manager);
  assert.equal((await f.service.listDaily(ceo)).length, 1);
  await assert.rejects(() => f.service.reviewDaily('report', { status: 'RETURNED' }, manager), /read-only/);
  assert.equal((await f.service.findDaily('report', ceo)).status, 'VERIFIED');
});
test('CEO can view accepted staff reports but cannot bypass the manager review stage', async () => {
  const f = fixture([{ ...submitted, status: 'VERIFIED' }]);
  assert.equal((await f.service.findDaily('report', ceo)).status, 'VERIFIED');
  await assert.rejects(() => f.service.reviewDaily('report', { status: 'RETURNED' }, ceo), /mark complete/);
});
test('manager-authored reports go directly to CEO and cannot be self-approved', async () => {
  const f = fixture();
  const report = await f.service.createDaily({ content: 'Management report', type: 'WEEKLY' }, manager);
  assert.deepEqual(f.notifications.map(item => item.userId), ['ceo', manager.sub]);
  assert.equal((await f.service.listDaily(ceo)).length, 1);
  await assert.rejects(() => f.service.reviewDaily(report.id, { status: 'VERIFIED' }, manager), /own report/);
  await f.service.ceoReview(report.id, { complete: true }, ceo);
  assert.equal(f.notifications.filter(item => item.userId === 'ceo').length, 1);
});
test('CEO cannot download a pending employee attachment using a direct file ID', async () => {
  const { ReportDocumentsService } = require('../src/modules/reports/report-documents.service.ts');
  const { createHash } = require('node:crypto');
  const f = fixture([submitted]);
  const bytes = Buffer.from('%PDF-1.7\nprivate employee report');
  let fileReads = 0;
  f.prisma.reportDocument = { findFirst: async () => { fileReads++; return { id: 'doc', reportId: 'report', data: bytes, sha256: createHash('sha256').update(bytes).digest('hex') }; } };
  const documents = new ReportDocumentsService(f.prisma, f.service);
  await assert.rejects(() => documents.read('report', 'doc', ceo), /not found/);
  assert.equal(fileReads, 0);
  await f.service.reviewDaily('report', { status: 'VERIFIED' }, manager);
  assert.deepEqual((await documents.read('report', 'doc', ceo)).data, bytes);
});
test('field report leaderboards cannot expose pending reports to the CEO', async () => {
  const { MarketerService } = require('../src/modules/marketer/marketer.service.ts');
  const f = fixture([{ ...submitted, type: 'FIELD', content: '{}' }, { ...submitted, id: 'accepted', type: 'FIELD', status: 'VERIFIED', content: '{}' }]);
  const marketers = new MarketerService(f.prisma);
  assert.deepEqual((await marketers.getDailyLeaderboard(ceo)).map(row => row.reportId), ['accepted']);
  assert.equal((await marketers.getDailyLeaderboard(manager)).length, 2);
});


test('CEO reviews forwarded reports privately and completion is final', async () => {
  const f = fixture([{ ...submitted, status: 'VERIFIED' }]);
  await f.service.ceoReview('report', { comment: 'Please add the delivery date' }, ceo);
  assert.equal(f.rows[0].ceoCompletedAt, undefined);
  assert.equal(f.messages.length, 1);
  assert.equal(f.messages[0].reportReferenceId, 'report');
  assert.equal(f.messages[0].reportReferenceTitle, 'Engineering progress');
  assert.ok(f.messages[0].channel.startsWith('dm:'));
  assert.deepEqual(f.channels[0].members.create.map(item => item.userId).sort(), ['ceo', 'engineer']);
  assert.equal(f.channels[0].isGeneral, false);
  assert.equal(f.notifications[0].userId, 'engineer');
  assert.ok(f.notifications[0].link.startsWith('/app/chat?channel='));
  assert.equal((await f.service.findDaily('report', manager)).ceoComment, null);
  assert.equal((await f.service.listDaily(manager))[0].ceoComment, null);
  assert.equal((await f.service.findDaily('report', employee)).ceoComment, 'Please add the delivery date');
  await f.service.ceoReview('report', { comment: 'Reviewed, thank you', complete: true }, ceo);
  assert.ok(f.rows[0].ceoCompletedAt);
  const count = f.notifications.length;
  await assert.rejects(() => f.service.ceoReview('report', { complete: true }, ceo), /read-only/);
  assert.equal(f.notifications.length, count);
  assert.equal(f.rows[0].status, 'VERIFIED');
});

test('manager reports need CEO comments and completion, with no second approval', async () => {
  const f = fixture([{ ...submitted, userId: 'manager', user: { role: { name: 'MANAGER' } } }]);
  await assert.rejects(() => f.service.reviewDaily('report', { status: 'VERIFIED' }, ceo), /mark complete/);
  await f.service.ceoReview('report', { comment: 'Thank you for your report', complete: true }, ceo);
  assert.equal(f.messages[0].reportReferenceId, 'report');
  assert.equal(f.notifications[0].userId, 'manager');
  assert.deepEqual(f.channels[0].members.create.map(item => item.userId).sort(), ['ceo', 'manager']);
  assert.equal(f.rows[0].status, 'SUBMITTED');
  assert.ok(f.rows[0].ceoCompletedAt);
  await assert.rejects(() => f.service.reviewDaily('report', { status: 'VERIFIED' }, { sub: 'other-manager', role: 'MANAGER' }), /read-only/);
  await assert.rejects(() => f.service.updateDaily('report', { content: 'Changed report' }, manager), /cannot be changed/);
});

test('CEO review rejects other roles, pending staff reports, own reports and invalid comments', async () => {
  const f = fixture([submitted]);
  await assert.rejects(() => f.service.ceoReview('report', { comment: 'Review' }, manager), /Only the CEO/);
  await assert.rejects(() => f.service.ceoReview('report', { comment: 'Review' }, ceo), /not found/);
  await assert.rejects(() => f.service.ceoReview('report', { comment: ' ' }, ceo), /Write a review/);
  await assert.rejects(() => f.service.ceoReview('report', { comment: 'x'.repeat(10001) }, ceo), /10000/);
  assert.equal(f.messages.length, 0);
});

test('stale concurrent completion cannot duplicate a private review or notification', async () => {
  const f = fixture([{ ...submitted, status: 'VERIFIED' }]);
  f.prisma.dailyReport.updateMany = async () => ({ count: 0 });
  await assert.rejects(() => f.service.ceoReview('report', { comment: 'Review', complete: true }, ceo), /Refresh/);
  assert.equal(f.messages.length, 0);
  assert.equal(f.notifications.length, 0);
});
