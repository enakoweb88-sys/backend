// Real, disposable loopback PostgreSQL. Never consumes deployment DATABASE_URL.
require('./register-typescript.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { randomBytes } = require('node:crypto');
const { Client } = require('pg');
const { localPostgres } = require('./local-postgres.cjs');
const { AuthService } = require('../src/modules/auth/auth.service.ts');
const { TransactionsService } = require('../src/modules/transactions/transactions.service.ts');
const { CashTransactionsService } = require('../src/modules/cash-collections/cash-transactions.service.ts');
const { DonationPaymentsService } = require('../src/modules/outreach/donation-payments.service.ts');
const { PermissionPolicy } = require('../src/common/permissions.ts');
const { PostgresThrottlerStorage } = require('../src/common/postgres-throttler.ts');
const { UsersService } = require('../src/modules/users/users.service.ts');
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS ' + name); }
async function main() {
  const instance = await localPostgres();
  const prisma = new PrismaClient({ datasources: { db: { url: instance.url } } });
  try {
    const sql = new Client({ connectionString: instance.url }); await sql.connect();
    for (const folder of fs.readdirSync(path.resolve(__dirname, '../prisma/migrations')).sort()) {
      const file = path.resolve(__dirname, '../prisma/migrations', folder, 'migration.sql');
      if (fs.existsSync(file)) await sql.query(fs.readFileSync(file, 'utf8'));
    }
    await sql.end();
    const roles = {};
    for (const name of ['CEO', 'MANAGER', 'EMPLOYEE']) roles[name] = await prisma.role.create({ data: { name } });
    const password = randomBytes(24).toString('hex'), passwordHash = await bcrypt.hash(password, 12);
    const users = {};
    for (const name of Object.keys(roles)) users[name] = await prisma.user.create({ data: { email: name.toLowerCase() + '@fixture.invalid', fullName: name, roleId: roles[name].id, passwordHash } });
    await test('dated OS leave stores dates and emits durable alerts once across completion workers', async () => {
      const { AdminService } = require('../src/modules/admin/admin.service.ts');
      const { LeaveLifecycleService } = require('../src/modules/admin/leave-lifecycle.service.ts');
      const { ReportAlertsService } = require('../src/modules/reports/report-alerts.service.ts');
      const alerts = new ReportAlertsService(prisma, {});
      const service = new AdminService(prisma, alerts);
      const employee = users.EMPLOYEE;
      const leave = await service.createLeave({ employeeId: employee.id, type: 'Annual', startDate: '2020-01-01', endDate: '2020-01-02' }, { sub: users.CEO.id, role: 'CEO', email: users.CEO.email });
      assert.equal(leave.duration, '2 days');
      assert.equal(await prisma.notification.count({ where: { userId: employee.id, title: 'Leave assigned' } }), 1);
      await Promise.all([new LeaveLifecycleService(prisma, alerts).finishDueLeaves(), new LeaveLifecycleService(prisma, alerts).finishDueLeaves()]);
      assert.equal((await prisma.leaveRequest.findUnique({ where: { id: leave.id } })).status, 'Completed');
      assert.equal(await prisma.notification.count({ where: { userId: employee.id, title: 'Leave finished' } }), 1);
      assert.equal(await prisma.notificationEmailDelivery.count({ where: { notification: { userId: employee.id } } }), 2);
    });
    const actor = { sub: users.CEO.id, role: 'CEO', email: users.CEO.email };
    const config = new ConfigService({ JWT_ACCESS_SECRET: randomBytes(48).toString('hex'), JWT_REFRESH_SECRET: randomBytes(48).toString('hex'), JWT_ISSUER: 'fixture', JWT_AUDIENCE: 'fixture-os' });
    const auth = new AuthService(prisma, new JwtService(), config, {}, new PermissionPolicy(config));
    const login = () => auth.login({ email: users.EMPLOYEE.email, password });
    await test('valid login and database-backed access session', async () => { const s = await login(); assert.equal((await auth.validateAccessToken(s.accessToken)).sub, users.EMPLOYEE.id); });
    await test('invalid credentials and disabled accounts rejected', async () => {
      await assert.rejects(auth.login({ email: users.EMPLOYEE.email, password: 'incorrect' }));
      await prisma.user.update({ where: { id: users.EMPLOYEE.id }, data: { status: 'SUSPENDED' } }); await assert.rejects(login());
      await prisma.user.update({ where: { id: users.EMPLOYEE.id }, data: { status: 'ACTIVE' } });
    });
    await test('refresh rotates once; reuse commits whole-family revocation', async () => {
      const first = await login(), second = await auth.refresh(first.refreshToken);
      assert.notEqual(first.refreshToken, second.refreshToken); await auth.validateAccessToken(second.accessToken);
      await assert.rejects(auth.refresh(first.refreshToken)); await assert.rejects(auth.validateAccessToken(second.accessToken)); await assert.rejects(auth.refresh(second.refreshToken));
    });
    await test('logout immediately revokes access and refresh', async () => { const s = await login(); await auth.logout(users.EMPLOYEE.id, s.sessionId); await assert.rejects(auth.validateAccessToken(s.accessToken)); await assert.rejects(auth.refresh(s.refreshToken)); });
    await test('expired and wrong-audience tokens rejected', async () => {
      const jwt = new JwtService();
      for (const options of [{ expiresIn: -1, audience: 'fixture-os' }, { expiresIn: 60, audience: 'other' }]) await assert.rejects(auth.validateAccessToken(await jwt.signAsync({ sub: users.EMPLOYEE.id }, { secret: config.get('JWT_ACCESS_SECRET'), issuer: 'fixture', ...options })));
    });
    const finance = new TransactionsService(prisma);
    const input = { entity: 'Fixture', amount: 1000, amountInXaf: 1000, type: 'Receive', channel: 'MTN', currency: 'XAF' };
    await test('concurrent identical creation applies exactly one credit', async () => {
      const values = await Promise.all(Array.from({ length: 4 }, () => finance.create(input, actor, 'fixture-credit-key-0001')));
      assert.equal(new Set(values.map(v => v.id)).size, 1); assert.equal((await prisma.floatAccount.findUnique({ where: { channel: 'MTN' } })).balance.toString(), '1000');
      await assert.rejects(finance.create({ ...input, amount: 2 }, actor, 'fixture-credit-key-0001'));
    });
    await test('concurrent settlement, replay and ledger totals remain consistent', async () => {
      const tx = await finance.create({ ...input, type: 'Send', amount: 100, amountInXaf: 100 }, actor, 'fixture-debit-key-0001');
      await Promise.all(Array.from({ length: 4 }, () => finance.setStatus(tx.id, 'SETTLED', 10, actor)));
      assert.equal((await prisma.floatAccount.findUnique({ where: { channel: 'MTN' } })).balance.toString(), '890');
      assert.equal(await prisma.auditLog.count({ where: { entityId: tx.id, action: 'FINANCIAL_STATUS_CHANGED' } }), 1);
      await assert.rejects(finance.setStatus(tx.id, 'FAILED', 0, actor));
    });
    await test('insufficient-float settlement rolls back status and ledger', async () => {
      const tx = await finance.create({ ...input, type: 'Send', amount: 5000, amountInXaf: 5000 }, actor, 'fixture-rollback-key-01');
      await assert.rejects(finance.setStatus(tx.id, 'SETTLED', 0, actor));
      assert.equal((await prisma.transaction.findUnique({ where: { id: tx.id } })).status, 'PENDING');
      assert.equal((await prisma.floatAccount.findUnique({ where: { channel: 'MTN' } })).balance.toString(), '890');
    });
    await test('invalid amounts produce no ledger records', async () => { for (const amount of [-1, 0, 1.001, Infinity]) await assert.rejects(finance.create({ ...input, amount }, actor, 'fixture-invalid-key-01')); });
    await test('Cash settlement is atomic and idempotent in its own ledger without changing company balances or audit', async () => {
      const cash = new CashTransactionsService(prisma), principal = { sub: 'independent-cash-admin', app: 'cash', cashLevel: 'administrator' };
      const companyCount = await prisma.transaction.count(), companyAudit = await prisma.auditLog.count();
      await Promise.all(Array.from({ length: 4 }, () => cash.create(input, principal, 'cash-fixture-credit-01')));
      const debit = await cash.create({ ...input, type: 'Send', amount: 100, amountInXaf: 100 }, principal, 'cash-fixture-debit-001');
      await Promise.all(Array.from({ length: 4 }, () => cash.setStatus(debit.id, 'SETTLED', 10, principal)));
      assert.equal((await prisma.cashFloatAccount.findUnique({ where: { channel: 'MTN' } })).balance.toString(), '890');
      assert.equal(await prisma.cashTransaction.count(), 2); assert.equal(await prisma.cashAuditLog.count({ where: { entityId: debit.id, action: 'FINANCIAL_STATUS_CHANGED' } }), 1);
      assert.equal(await prisma.transaction.count(), companyCount); assert.equal(await prisma.auditLog.count(), companyAudit);
      assert.equal((await prisma.floatAccount.findUnique({ where: { channel: 'MTN' } })).balance.toString(), '890');
      const failed = await cash.create({ ...input, type: 'Send', amount: 5000, amountInXaf: 5000 }, principal, 'cash-fixture-rollback-01'); await assert.rejects(cash.setStatus(failed.id, 'SETTLED', 0, principal)); assert.equal((await prisma.cashTransaction.findUnique({ where: { id: failed.id } })).status, 'PENDING');
    });
    let providerResult;
    const mtn = { requestToPay: async p => ({ uuid: p.referenceId }), checkPaymentStatus: async () => providerResult };
    const payments = new DonationPaymentsService(prisma, mtn);
    const donation = { clientRequestId: 'fixture-donation-key-01', statusToken: randomBytes(32).toString('hex'), amount: 500, currency: 'XAF', sector: 'Education', frequency: 'ONE_TIME', method: 'MTN', fullName: 'Fixture', email: 'donor@fixture.invalid', phone: '237600000000' };
    let created;
    await test('forged callback cannot dictate settlement', async () => {
      created = await payments.create(donation); providerResult = { status: 'PENDING', amount: '500', currency: 'XAF', referenceId: created.donation.id };
      await payments.callback({ externalId: created.donation.id, status: 'SUCCESSFUL', amount: 500 }); assert.equal((await prisma.donation.findUnique({ where: { id: created.donation.id } })).status, 'PENDING');
    });
    await test('provider amount binding and capability checks reject substitution', async () => {
      await assert.rejects(payments.status(created.paymentUuid, randomBytes(32).toString('hex'), created.donation.id));
      await prisma.donation.update({ where: { id: created.donation.id }, data: { providerCheckedAt: null } });
      providerResult = { status: 'SUCCESSFUL', amount: '900', currency: 'XAF', referenceId: created.donation.id, financialTransactionId: 'fixture-provider-1' }; await assert.rejects(payments.callback({ externalId: created.donation.id }));
    });
    await test('authenticated provider confirmation settles once with audited replay protection', async () => {
      await prisma.donation.update({ where: { id: created.donation.id }, data: { providerCheckedAt: null } }); providerResult.amount = '500';
      await payments.callback({ externalId: created.donation.id }); await payments.callback({ externalId: created.donation.id });
      assert.equal((await prisma.donation.findUnique({ where: { id: created.donation.id } })).status, 'SETTLED'); assert.equal(await prisma.auditLog.count({ where: { entityId: created.donation.id, action: 'DONATION_PROVIDER_CONFIRMED' } }), 1);
    });
    await test('independent throttle instances share an atomic database counter', async () => {
      const a = new PostgresThrottlerStorage(prisma), b = new PostgresThrottlerStorage(prisma);
      const results = await Promise.all(Array.from({ length: 20 }, (_, i) => (i % 2 ? a : b).increment('fixture-rate', 60000)));
      assert.equal(Math.max(...results.map(v => v.totalHits)), 20); assert.equal(new Set(results.map(v => v.totalHits)).size, 20);
    });
    await test('password change atomically revokes all sessions', async () => {
      const s = await login(); const service = new UsersService(prisma, { sendPasswordChangedAlert: async () => true });
      await service.changePassword({ sub: users.EMPLOYEE.id }, password, randomBytes(24).toString('hex')); await assert.rejects(auth.validateAccessToken(s.accessToken)); await assert.rejects(auth.refresh(s.refreshToken));
      assert.equal(await prisma.authSession.count({ where: { userId: users.EMPLOYEE.id, revokedAt: null } }), 0);
    });
    await test('concurrent target promotion prevents stale manager profile, password and status writes', async () => {
      const { EmployeesService } = require('../src/modules/employees/employees.service.ts');
      for (const operation of ['profile', 'password', 'status']) {
        const target = await prisma.user.create({ data: { email: operation + '@race.fixture.invalid', fullName: 'Before', roleId: roles.EMPLOYEE.id, passwordHash } });
        const wrapped = { user: prisma.user, role: prisma.role, department: prisma.department, $transaction: async fn => {
          await prisma.user.update({ where: { id: target.id }, data: { roleId: roles.CEO.id } });
          return prisma.$transaction(fn);
        } };
        const service = new EmployeesService(wrapped, {}, config), manager = { sub: users.MANAGER.id, role: 'MANAGER', email: users.MANAGER.email };
        const action = operation === 'profile' ? () => service.update(target.id, { fullName: 'Forbidden stale change' }, manager)
          : operation === 'password' ? () => service.resetPassword(target.id, randomBytes(24).toString('hex'), manager)
          : () => service.suspend(target.id, manager);
        await assert.rejects(action(), error => error.getStatus?.() === 409);
        const saved = await prisma.user.findUnique({ where: { id: target.id } });
        assert.equal(saved.roleId, roles.CEO.id); assert.equal(saved.fullName, 'Before'); assert.equal(saved.passwordHash, passwordHash); assert.equal(saved.status, 'ACTIVE');
        assert.equal(await prisma.auditLog.count({ where: { entityId: target.id } }), 0);
      }
    });
    console.log('Database integration: ' + passed + ' passed');
  } finally { await prisma.$disconnect(); await instance.close(); }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
