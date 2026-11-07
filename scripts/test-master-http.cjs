require('./register-typescript.cjs');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { Client } = require('pg');
const { PrismaClient } = require('@prisma/client');
const { ValidationPipe } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');
const { localPostgres } = require('./local-postgres.cjs');
const bcrypt = require('bcryptjs');
let passed = 0;
async function check(name, fn) { await fn(); console.log('PASS ' + name); passed++; }
async function main() {
  const root = path.resolve(__dirname, '..'), fixture = await localPostgres();
  const runtimePassword = randomBytes(32).toString('hex');
  const runtimeUrl = new URL(fixture.url); runtimeUrl.username = 'enako_runtime'; runtimeUrl.password = runtimePassword;
  const admin = new Client({ connectionString: fixture.url }); await admin.connect();
  await admin.query('CREATE ROLE enako_runtime LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD ' + "'" + runtimePassword + "'");
  await admin.query('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; REVOKE CREATE ON SCHEMA public FROM PUBLIC');
  for (const directory of fs.readdirSync(path.join(root, 'prisma/migrations')).sort()) { const file = path.join(root, 'prisma/migrations', directory, 'migration.sql'); if (fs.existsSync(file)) await admin.query(fs.readFileSync(file, 'utf8')); }
  const prisma = new PrismaClient({ datasources: { db: { url: runtimeUrl.href } } });
  const cwd = process.cwd(), isolated = fs.mkdtempSync(path.join(root, '.test-runtime/app-'));
  let app;
  try {
    await check('RLS denies anonymous database access and runtime cannot create tables', async () => {
      await admin.query('SET ROLE anon'); await assert.rejects(admin.query('SELECT * FROM users'), /permission denied/); await admin.query('RESET ROLE');
      for (const role of ['anon', 'authenticated']) {
        await admin.query('SET ROLE ' + role);
        await assert.rejects(admin.query('SELECT * FROM "Donation"'), /permission denied/);
        await admin.query('RESET ROLE');
      }
      const tables = await admin.query("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'");
      assert.ok(tables.rows.length > 0);
      for (const table of tables.rows) assert.equal(table.rowsecurity, true, 'Missing RLS: ' + table.tablename);
      assert.equal(await prisma.donation.count(), 0);
      await assert.rejects(prisma.$executeRawUnsafe('CREATE TABLE public.forbidden_fixture (id int)'), /permission denied/);
      const { PrismaService } = require('../src/modules/prisma/prisma.service.ts'); await PrismaService.prototype.onModuleInit.call(prisma);
    });
    const roles = {}, users = {}, password = randomBytes(24).toString('hex'), passwordHash = await bcrypt.hash(password, 12);
    for (const name of ['CEO', 'MANAGER', 'EMPLOYEE', 'OUTREACH_MANAGER']) roles[name] = await prisma.role.create({ data: { name } });
    for (const [name, role] of Object.entries({ ceo: 'CEO', manager: 'MANAGER', engineer: 'EMPLOYEE', other: 'EMPLOYEE', outreach: 'OUTREACH_MANAGER' })) users[name] = await prisma.user.create({ data: { fullName: name, email: name + '@fixture.invalid', passwordHash, roleId: roles[role].id, responsibilities: name === 'collector' ? JSON.stringify({ cashManaged: true }) : null } });
    const cashPassword = randomBytes(24).toString('hex'), cashHash = await bcrypt.hash(cashPassword, 12);
    const cashUsers = {};
    for (const [name, email] of [['admin', users.manager.email], ['collector', 'collector@fixture.invalid']]) cashUsers[name] = await prisma.cashUser.create({ data: { fullName: 'Personal Cash ' + name, email, terminalId: 'FIXTURE-' + name, passwordHash: cashHash } });
    // No environment files or remote credentials can enter the test application.
    for (const key of Object.keys(process.env)) if (/SMTP|RESEND|SUPABASE|MTN_|PIX|CASH_|JWT_|CF_ACCESS|OS_PERMISSION|ENAKO_API|ENAKO_AI/.test(key)) delete process.env[key];
    Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: runtimeUrl.href, DIRECT_URL: runtimeUrl.href, JWT_ACCESS_SECRET: randomBytes(48).toString('hex'), JWT_REFRESH_SECRET: randomBytes(48).toString('hex'), JWT_ISSUER: 'fixture', JWT_AUDIENCE: 'fixture-os', CASH_JWT_SECRET: randomBytes(48).toString('hex'), CASH_ACCESS_GRANTS: JSON.stringify({ [cashUsers.collector.id]: 'operator', [cashUsers.admin.id]: 'administrator' }), RATE_LIMIT_HASH_SECRET: randomBytes(48).toString('hex'), GATEWAY_ACCESS_MODE: 'local-only', CORS_ORIGIN: 'http://127.0.0.1:3000' });
    process.env.FILE_SCANNER_MODE = 'required';
    delete process.env.FILE_SCANNER_EMBEDDED;
    process.chdir(isolated);
    const { AppModule } = require('../src/app.module.ts'), { PrismaService } = require('../src/modules/prisma/prisma.service.ts'), { MailService } = require('../src/modules/mail/mail.service.ts');
    const mail = new Proxy({}, { get: (_target, name) => name === 'then' ? undefined : async () => ({ success: true, messageId: 'mock-fixture' }) });
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(prisma).overrideProvider(MailService).useValue(mail).compile();
    // Surface fixture-only initialization failures without a production error response.
    await module.get(require('../src/modules/auth/auth.service.ts').AuthService).login({ email: users.ceo.email, password });
    app = module.createNestApplication({ logger: false }); app.setGlobalPrefix('api/v1'); app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true })); await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const call = async (route, method = 'GET', body, token) => { const response = await fetch(base + '/api/v1' + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: response.status, data: await response.json() }; };
    const tokens = {};
    await check('full backend starts with isolated, restricted runtime role and all real guards', async () => {
      for (const name of ['ceo', 'manager', 'engineer', 'other', 'outreach']) { const result = await call('/auth/login', 'POST', { email: users[name].email, password }); assert.equal(result.status, 201, JSON.stringify(result.data)); tokens[name] = result.data.accessToken; }
    });
    await check('public endpoints work while every sensitive module denies anonymous requests', async () => {
      const health = await call('/health'); assert.equal(health.status, 200); assert.deepEqual(health.data, { status: 'ok' });
      assert.equal((await call('/public/impact')).status, 200);
      for (const route of ['/finance/banking', '/analytics/overview', '/digital/posts', '/bd/leads', '/outreach/admin/posts', '/employees', '/kyc/submissions', '/cash-collections']) assert.equal((await call(route)).status, 401, route);
    });
    await check('employee sensitive-route denial, explicit outreach role and manager escalation denial', async () => {
      for (const route of ['/finance/banking', '/analytics/overview', '/digital/posts', '/bd/leads', '/outreach/admin/posts']) assert.equal((await call(route, 'GET', undefined, tokens.engineer)).status, 403, route);
      assert.equal((await call('/outreach/admin/posts', 'GET', undefined, tokens.outreach)).status, 200);
      assert.equal((await call('/employees', 'POST', { email: 'escalation@fixture.invalid', fullName: 'Fixture', role: 'CEO', password }, tokens.manager)).status, 403);
      for (const token of [tokens.engineer, tokens.manager]) assert.equal((await call('/admin/audit-logs', 'GET', undefined, token)).status, 403);
      const event = await prisma.auditLog.create({ data: { actorId: users.ceo.id, action: 'FIXTURE_EVENT', entity: 'transaction', entityId: 'synthetic', metadata: { privatePayload: 'must-not-be-returned' } } });
      const audit = await call('/admin/audit-logs', 'GET', undefined, tokens.ceo); assert.equal(audit.status, 200);
      assert.ok(audit.data.some(row => row.id === event.id)); assert.doesNotMatch(JSON.stringify(audit.data), /privatePayload|passwordHash|must-not-be-returned/);
    });
    await check('tasks and objectives persist with employee/creator privacy and assignment notifications', async () => {
      const personal = await call('/tasks', 'POST', { title: 'Private work' }, tokens.engineer); assert.equal(personal.status, 201);
      assert.equal((await call('/tasks/' + personal.data.id, 'GET', undefined, tokens.ceo)).status, 403);
      const task = await call('/tasks', 'POST', { title: 'Assigned work', assigneeId: users.engineer.id }, tokens.ceo); assert.equal(task.status, 201);
      assert.equal((await call('/tasks/' + task.data.id, 'GET', undefined, tokens.engineer)).status, 200);
      const goal = await call('/goals', 'POST', { title: 'Daily fixture objective', scope: 'PERSONAL', cadence: 'DAILY' }, tokens.engineer); assert.equal(goal.status, 201, JSON.stringify(goal.data));
      assert.equal((await call('/goals/' + goal.data.id, 'GET', undefined, tokens.ceo)).status, 404);
      assert.ok(await prisma.notification.count({ where: { userId: users.engineer.id } })); assert.equal(await prisma.goal.count({ where: { id: goal.data.id, ownerId: users.engineer.id } }), 1);
    });
    await check('Cash identity is independent and a collection never creates company accounting records', async () => {
      assert.equal((await call('/auth/login', 'POST', { email: cashUsers.collector.email, password })).status, 401);
      const login = await call('/cash-auth/login', 'POST', { identifier: cashUsers.collector.email, password: cashPassword }); assert.equal(login.status, 201);
      const record = await call('/cash-collections', 'POST', { clientName: 'Synthetic Client', location: 'Fixture', amountCollected: 20, description: '{}' }, login.data.accessToken); assert.equal(record.status, 201, JSON.stringify(record.data));
      assert.equal(await prisma.transaction.count(), 0);
      assert.equal(await prisma.cashTransaction.count(), 0);
      assert.equal(await prisma.user.count({ where: { email: cashUsers.collector.email } }), 0);
      assert.equal((await call('/cash-collections/' + record.data.id, 'GET', undefined, tokens.ceo)).status, 401);
    });
    await check('OS roles, matching emails, tokens and record IDs confer no cross-application access', async () => {
      const deniedCash = await call('/cash-auth/login', 'POST', { identifier: users.manager.email, password }); assert.equal(deniedCash.status, 401);
      const login = await call('/cash-auth/login', 'POST', { identifier: cashUsers.admin.email, password: cashPassword }); assert.equal(login.status, 201); const cashToken = login.data.accessToken;
      assert.equal(login.data.user.osRole, undefined);
      for (const route of ['/employees', '/transactions', '/kyc/submissions', '/goals', '/reports/daily', '/files']) assert.equal((await call(route, 'GET', undefined, cashToken)).status, 401, route);
      for (const route of ['/cash-collections', '/cash-transactions', '/cash-kyc/submissions']) assert.equal((await call(route, 'GET', undefined, tokens.ceo)).status, 401, route);
      assert.equal((await call('/cash-transactions', 'GET', undefined, cashToken)).status, 200);
      assert.equal((await call('/cash-kyc/submissions', 'GET', undefined, cashToken)).status, 200);
      const created = await call('/cash-collections/collectors', 'POST', { fullName: 'Independent cash identity', email: users.engineer.email, password: cashPassword }, cashToken); assert.equal(created.status, 201);
      assert.equal(await prisma.user.count({ where: { email: users.engineer.email } }), 1); assert.equal(await prisma.cashUser.count({ where: { email: users.engineer.email } }), 1);
    });
    await check('meals reject concurrent duplicate employee entries and expenses preserve details with independent review', async () => {
      const results = await Promise.all(Array.from({ length: 3 }, () => call('/meals', 'POST', { employeeId: users.engineer.id, date: '2026-11-05', status: 'ATE' }, tokens.engineer)));
      assert.equal(results.filter(result => result.status === 201).length, 1); assert.equal(results.filter(result => result.status === 409).length, 2);
      const expense = await call('/expenses', 'POST', { description: 'Fixture claim', amount: 20, department: 'Engineering', expenseDate: '2026-11-04', paymentMethod: 'Cash', notes: 'Fixture note' }, tokens.manager);
      assert.equal(expense.status, 201); assert.equal(expense.data.department, 'Engineering'); assert.equal(expense.data.status, 'PENDING');
      assert.equal((await call('/expenses/' + expense.data.id + '/approve', 'PATCH', {}, tokens.manager)).status, 403);
      assert.equal((await call('/expenses/' + expense.data.id + '/approve', 'PATCH', {}, tokens.ceo)).status, 200);
      assert.equal((await call('/expenses/' + expense.data.id + '/approve', 'PATCH', {}, tokens.ceo)).status, 409);
    });
    await check('KYC file submission persists exact bytes privately; scanner outage and unrelated readers are denied', async () => {
      const net = require('node:net');
      const scanner = net.createServer(socket => { let received = Buffer.alloc(0); socket.on('data', chunk => { received = Buffer.concat([received, chunk]); if (received.length >= 18 && received.subarray(-4).equals(Buffer.alloc(4))) socket.end('stream: OK\0'); }); });
      await new Promise(resolve => scanner.listen(0, '127.0.0.1', resolve));
      Object.assign(process.env, { FILE_SCANNER_HOST: '127.0.0.1', FILE_SCANNER_PORT: String(scanner.address().port) });
      const bytes = Buffer.from('%PDF-1.7\nfixture identity document');
      const form = () => { const data = new FormData(); data.set('applicantType', 'individual'); data.set('applicantName', 'Synthetic Applicant'); data.set('payload', JSON.stringify({ address: 'Fixture' })); data.set('identity', new Blob([bytes], { type: 'text/html' }), 'identity.pdf'); return data; };
      try {
        const result = await fetch(base + '/api/v1/kyc/submissions', { method: 'POST', body: form() }); assert.equal(result.status, 201); const submission = await result.json();
        const file = await prisma.secureFile.findFirst({ where: { parentId: submission.id, scope: 'kyc' } }); assert.ok(file); assert.deepEqual(Buffer.from(file.data), bytes); assert.equal(file.mimeType, 'application/pdf');
        const route = '/files/private/' + file.id;
        assert.equal((await call(route)).status, 401); assert.equal((await call(route, 'GET', undefined, tokens.engineer)).status, 404);
        const document = await fetch(base + '/api/v1' + route, { headers: { Authorization: 'Bearer ' + tokens.manager } }); assert.equal(document.status, 200); assert.equal(document.headers.get('cache-control'), 'private, no-store'); assert.deepEqual(Buffer.from(await document.arrayBuffer()), bytes);
        const cashLogin = await call('/cash-auth/login', 'POST', { identifier: cashUsers.admin.email, password: cashPassword });
        const cashResult = await fetch(base + '/api/v1/cash-kyc/submissions', { method: 'POST', body: form() }); assert.equal(cashResult.status, 201);
        const cashSubmission = await cashResult.json();
        const cashFile = await prisma.cashDocument.findFirst({ where: { parentId: cashSubmission.id } }); assert.ok(cashFile); assert.deepEqual(Buffer.from(cashFile.data), bytes);
        assert.equal(await prisma.secureFile.count(), 1); assert.equal(await prisma.kycSubmission.count(), 1);
        const cashRoute = '/cash-collections/documents/' + cashFile.id;
        assert.equal((await call(cashRoute, 'GET', undefined, tokens.ceo)).status, 401);
        assert.equal((await call('/files/private/' + cashFile.id, 'GET', undefined, tokens.ceo)).status, 404);
        const cashDownload = await fetch(base + '/api/v1' + cashRoute, { headers: { Authorization: 'Bearer ' + cashLogin.data.accessToken } });
        assert.equal(cashDownload.status, 200); assert.deepEqual(Buffer.from(await cashDownload.arrayBuffer()), bytes);
        const approval = await call('/cash-kyc/submissions/' + cashSubmission.id + '/review', 'PATCH', { status: 'APPROVED' }, cashLogin.data.accessToken); assert.equal(approval.status, 200);
        assert.equal((await call('/cash-kyc/submissions/' + cashSubmission.id + '/review', 'PATCH', { status: 'APPROVED' }, cashLogin.data.accessToken)).status, 200);
        assert.equal(await prisma.cashClient.count({ where: { id: 'C-KYC-' + cashSubmission.id } }), 1);
        assert.equal(await prisma.cashAuditLog.count({ where: { entityId: cashSubmission.id, action: 'CASH_KYC_REVIEWED' } }), 1);
        delete process.env.FILE_SCANNER_HOST;
        assert.equal((await fetch(base + '/api/v1/kyc/submissions', { method: 'POST', body: form() })).status, 503);
        assert.equal(await prisma.kycSubmission.count(), 1);
        process.env.FILE_SCANNER_MODE = 'auto'; process.env.FILE_SCANNER_EMBEDDED = 'false';
        const unscannedOs = await fetch(base + '/api/v1/kyc/submissions', { method: 'POST', body: form() });
        assert.equal(unscannedOs.status, 201); const unscannedOsSubmission = await unscannedOs.json();
        const unscannedOsFile = await prisma.secureFile.findFirst({ where: { parentId: unscannedOsSubmission.id } });
        assert.equal(unscannedOsFile.scanStatus, 'UNSCANNED');
        const osDownload = await fetch(base + '/api/v1/files/private/' + unscannedOsFile.id, { headers: { Authorization: 'Bearer ' + tokens.ceo } });
        assert.equal(osDownload.status, 200); assert.deepEqual(Buffer.from(await osDownload.arrayBuffer()), bytes);
        assert.equal((await call('/files/private/' + unscannedOsFile.id, 'GET', undefined, tokens.engineer)).status, 404);
        const unscannedCash = await fetch(base + '/api/v1/cash-kyc/submissions', { method: 'POST', body: form() });
        assert.equal(unscannedCash.status, 201); const unscannedCashSubmission = await unscannedCash.json();
        const unscannedCashFile = await prisma.cashDocument.findFirst({ where: { parentId: unscannedCashSubmission.id } });
        assert.equal(unscannedCashFile.scanStatus, 'UNSCANNED');
        const cashUnscannedDownload = await fetch(base + '/api/v1/cash-collections/documents/' + unscannedCashFile.id, { headers: { Authorization: 'Bearer ' + cashLogin.data.accessToken } });
        assert.equal(cashUnscannedDownload.status, 200); assert.deepEqual(Buffer.from(await cashUnscannedDownload.arrayBuffer()), bytes);
        assert.equal((await call('/cash-collections/documents/' + unscannedCashFile.id, 'GET', undefined, tokens.ceo)).status, 401);
        const reportForm = new FormData(); reportForm.append('title', 'Scanner-disabled fixture report'); reportForm.append('documents', new Blob([bytes], { type: 'application/pdf' }), 'fixture.pdf');
        const reportUpload = await fetch(base + '/api/v1/reports/daily/upload', { method: 'POST', body: reportForm, headers: { Authorization: 'Bearer ' + tokens.engineer } });
        assert.equal(reportUpload.status, 201); const report = await reportUpload.json();
        const reportDownload = await fetch(base + '/api/v1/reports/daily/' + report.id + '/documents/' + report.documents[0].id, { headers: { Authorization: 'Bearer ' + tokens.manager } });
        assert.equal(reportDownload.status, 200); assert.deepEqual(Buffer.from(await reportDownload.arrayBuffer()), bytes);
        assert.equal(await prisma.kycSubmission.count(), 2); assert.equal(await prisma.cashKycSubmission.count(), 2);
      } finally { delete process.env.FILE_SCANNER_HOST; delete process.env.FILE_SCANNER_PORT; delete process.env.FILE_SCANNER_EMBEDDED; process.env.FILE_SCANNER_MODE = 'required'; await new Promise(resolve => scanner.close(resolve)); }
    });
    await check('same-office users have independent login budgets and forwarded headers cannot bypass account limits', async () => {
      for (let i = 0; i < 5; i++) assert.equal((await call('/auth/login', 'POST', { email: 'absent@fixture.invalid', password })).status, 401);
      const blocked = await fetch(base + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '192.0.2.22' }, body: JSON.stringify({ email: 'absent@fixture.invalid', password }) }); assert.equal(blocked.status, 429);
      assert.equal((await call('/auth/login', 'POST', { email: users.other.email, password })).status, 201);
    });
    console.log('Full HTTP integration: ' + passed + ' passed');
  } finally {
    if (app) await app.close(); await prisma.$disconnect(); await admin.end(); process.chdir(cwd);
    if (!path.resolve(isolated).startsWith(path.join(root, '.test-runtime') + path.sep)) throw Error('Unsafe fixture cleanup'); fs.rmSync(isolated, { recursive: true, force: true }); await fixture.close();
  }
}
main().catch(error => { console.error(error.message?.replace(/postgres(?:ql)?:\/\/\S+/g, '[REDACTED]')); process.exitCode = 1; });
