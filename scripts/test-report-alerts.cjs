require('tsx/cjs');
require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ReportAlertsService } = require('../src/modules/reports/report-alerts.service.ts');
const { MailService } = require('../src/modules/mail/mail.service.ts');
const { notificationAddress, notificationLink, escapeEmailText } = require('../src/modules/mail/notification-email.ts');

function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some(filter => matches(row, filter));
    if (value && typeof value === 'object' && 'lte' in value) return row[key] != null && row[key] <= value.lte;
    return row[key] === value;
  });
}
function fixture(outcome = { success: true, messageId: 'provider-id' }) {
  const notifications = [], jobs = [], sends = [];
  const recipient = { email: 'ceo@enako.com', personalEmail: 'enakocompanyltd@gmail.com', status: 'ACTIVE' };
  const prisma = {
    notification: { createMany: async ({ data }) => notifications.push(...data) },
    notificationEmailDelivery: {
      createMany: async ({ data }) => data.forEach(item => jobs.push({ id: `job${jobs.length}`, ...item, status: 'PENDING', attempts: 0, nextAttemptAt: new Date(), leaseUntil: null })),
      findMany: async ({ where }) => jobs.filter(row => matches(row, where)),
      findUnique: async ({ where }) => { const job = jobs.find(row => row.id === where.id); return job ? { ...job, notification: { ...notifications.find(row => row.id === job.notificationId), user: recipient } } : null; },
      updateMany: async ({ where, data }) => { let count = 0; jobs.filter(row => matches(row, where)).forEach(row => { count++; Object.entries(data).forEach(([key, value]) => { row[key] = value && typeof value === 'object' && 'increment' in value ? row[key] + value.increment : value; }); }); return { count }; },
    },
  };
  const mail = { sendNotificationAlert: async (...args) => { sends.push(args); await new Promise(resolve => setTimeout(resolve, 2)); return outcome; } };
  const service = new ReportAlertsService(prisma, mail);
  return { service, prisma, mail, notifications, jobs, sends, recipient };
}
const alert = { userId: 'ceo', title: 'Report accepted', body: 'Accepted by management', link: '/app/reports?reportId=report' };
test('an event saves both an in-app notification and durable email job before sending', async () => {
  const f = fixture();
  await f.service.enqueue(f.prisma, [alert]);
  assert.equal(f.notifications.length, 1); assert.equal(f.jobs.length, 1); assert.equal(f.sends.length, 0);
  assert.equal(f.jobs[0].notificationId, f.notifications[0].id);
  await f.service.dispatchPending();
  assert.equal(f.sends.length, 1); assert.equal(f.jobs[0].status, 'SENT');
  assert.equal(f.sends[0][0], 'enakocompanyltd@gmail.com');
  assert.equal(f.recipient.email, 'ceo@enako.com');
  assert.equal(f.jobs[0].providerMessageId, 'provider-id');
  assert.equal(f.jobs[0].recipientEmail, 'enakocompanyltd@gmail.com');
});
test('provider rejection persists a retry rather than marking the email sent', async () => {
  const f = fixture({ success: false, error: 'Temporary provider outage' });
  await f.service.enqueue(f.prisma, [alert]);
  await f.service.dispatchPending();
  assert.equal(f.jobs[0].status, 'PENDING'); assert.equal(f.jobs[0].attempts, 1);
  assert.ok(f.jobs[0].nextAttemptAt > new Date());
  assert.equal(f.jobs[0].lastError, 'Temporary provider outage');
  await f.service.dispatchPending();
  assert.equal(f.sends.length, 1); // Backoff prevents a tight retry loop.
  assert.equal(f.notifications.length, 1);
});
test('sent emails are not sent again and concurrent server workers claim a job once', async () => {
  const f = fixture();
  await f.service.enqueue(f.prisma, [alert]);
  const second = new ReportAlertsService(f.prisma, f.mail);
  await Promise.all([f.service.dispatchPending(), second.dispatchPending()]);
  await second.dispatchPending();
  assert.equal(f.sends.length, 1); assert.equal(f.jobs[0].attempts, 1);
});
test('a server restart can reclaim an expired delivery lease', async () => {
  const f = fixture();
  await f.service.enqueue(f.prisma, [alert]);
  Object.assign(f.jobs[0], { status: 'SENDING', leaseUntil: new Date(Date.now() - 1000), leaseToken: 'old-worker' });
  await f.service.dispatchPending();
  assert.equal(f.jobs[0].status, 'SENT'); assert.equal(f.sends.length, 1);
});
test('inactive recipients do not receive mail; fallback uses login email if no contact is configured', async () => {
  const f = fixture();
  f.recipient.status = 'SUSPENDED';
  await f.service.enqueue(f.prisma, [alert]); await f.service.dispatchPending();
  assert.equal(f.jobs[0].status, 'SKIPPED'); assert.equal(f.sends.length, 0);
  assert.equal(notificationAddress({ email: 'Manager@Example.com', personalEmail: null }), 'manager@example.com');
});
test('notification links open BrowserRouter pages and feedback is escaped as plain text', () => {
  assert.equal(notificationLink('/app/reports?reportId=abc'), 'https://enakoos.com/app/reports?reportId=abc');
  assert.equal(notificationLink('/app/reports?reportId=abc', 'https://os.example.com'), 'https://os.example.com/app/reports?reportId=abc');
  assert.equal(escapeEmailText('<script>bad</script>\nFeedback'), '&lt;script&gt;bad&lt;/script&gt;<br>Feedback');
});
test('legacy notification calls using CEO login address are redirected to the configured real inbox', async () => {
  let payload;
  const prisma = { user: { findMany: async () => [{ email: 'ceo@enako.com', personalEmail: 'enakocompanyltd@gmail.com' }] }, auditLog: { create: async () => ({}) } };
  const mail = new MailService({ get: key => key === 'RESEND_API_KEY' ? 're_unit_test_only' : undefined }, prisma);
  mail.resend = { emails: { send: async request => { payload = request; return { data: { id: 'mock-provider' }, error: null }; } } };
  const result = await mail.sendNotificationAlert('ceo@enako.com', 'Report action', 'Feedback <tag>', '/app/reports?reportId=abc', { plainText: true });
  assert.equal(result.success, true);
  assert.deepEqual(payload.to, ['enakocompanyltd@gmail.com']);
  assert.ok(payload.html.includes('https://enakoos.com/app/reports?reportId=abc'));
  assert.ok(payload.html.includes('Feedback &lt;tag&gt;'));
});
