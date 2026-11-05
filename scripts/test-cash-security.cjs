require('./register-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, createHash } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { APP_GUARD } = require('@nestjs/core');
const { HttpRateLimitGuard } = require('../src/common/http-rate-limit.guard.ts');
const { CashFilesService } = require('../src/modules/cash-collections/cash-files.service.ts');
const { CashMailService } = require('../src/modules/cash-collections/cash-mail.service.ts');
const { PermissionPolicy } = require('../src/common/permissions.ts');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const { JwtModule, JwtService } = require('@nestjs/jwt');
const { ThrottlerModule, getStorageToken } = require('@nestjs/throttler');
const { PrismaService } = require('../src/modules/prisma/prisma.service.ts');
const { MailService } = require('../src/modules/mail/mail.service.ts');
const { CashAccessPolicy } = require('../src/modules/cash-collections/cash-access.ts');
const { CashAccessGuard } = require('../src/modules/cash-collections/cash-access.guard.ts');
const { CashAuthService } = require('../src/modules/cash-collections/cash-auth.service.ts');
const { CashAuthController } = require('../src/modules/cash-collections/cash-auth.controller.ts');
const { CashCollectionsService } = require('../src/modules/cash-collections/cash-collections.service.ts');
const { CashCollectionsController } = require('../src/modules/cash-collections/cash-collections.controller.ts');
const { AuthService } = require('../src/modules/auth/auth.service.ts');
const { JwtStrategy } = require('../src/modules/auth/jwt.strategy.ts');

// Only synthetic data; this module never imports AppModule or opens Prisma.
const fixturePassword = 'Disposable-fixture-only-phrase';
function fixture() {
  const hashed = bcrypt.hashSync(fixturePassword, 12);
  const grants = { admin: 'administrator', operator: 'operator', other: 'operator', legacy: 'operator' };
  const settings = { JWT_ACCESS_SECRET: randomBytes(48).toString('hex'), JWT_REFRESH_SECRET: randomBytes(48).toString('hex'), JWT_ISSUER: 'fixture-os', JWT_AUDIENCE: 'fixture', RATE_LIMIT_HASH_SECRET: randomBytes(48).toString('hex'), CASH_ACCESS_GRANTS: JSON.stringify(grants), CASH_JWT_SECRET: randomBytes(48).toString('hex') };
  const config = { get: name => settings[name] };
  const state = { users: ['admin', 'operator', 'other', 'legacy', 'manager', 'employee'].map(id => ({ id, fullName: 'Fixture ' + id, email: id + '@example.invalid', phone: null, role: { name: ['admin', 'manager'].includes(id) ? 'MANAGER' : 'EMPLOYEE' }, status: 'ACTIVE', passwordHash: id === 'legacy' ? 'plain:nonfunctional-fixture' : hashed, passwordChangedAt: new Date(0), responsibilities: JSON.stringify({ cashManaged: ['operator', 'other', 'legacy'].includes(id), terminalId: 'TRM-' + id, password: 'legacy-fixture-must-never-return' }), branch: 'Fixture branch', terminalId: 'TRM-' + id, jobLabel: 'Cash Collector', address: 'Fixture branch', title: 'Field Cash Collector', createdAt: new Date(0) })), sessions: [], records: [], clients: [], audits: [] };
  const matches = (record, where = {}) => Object.entries(where).every(([k, v]) => {
    if (v === undefined) return true;
    if (k === 'OR') return v.some(rule => matches(record, rule));
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('not' in v) return record[k] !== v.not;
      if ('in' in v) return v.in.includes(record[k]);
      if ('gt' in v) return record[k] > v.gt;
      if ('gte' in v) return record[k] >= v.gte;
      if ('contains' in v) return String(record[k] || '').toLowerCase().includes(v.contains.toLowerCase());
    }
    return record[k] === v;
  });
  const includeCollector = record => record && ({ ...record, collector: state.users.find(u => u.id === record.cashUserId) && { id: record.cashUserId, fullName: state.users.find(u => u.id === record.cashUserId).fullName } });
  let failAudit = false;
  const prisma = {
    cashUser: {
      findMany: async ({ where }) => state.users.filter(u => !['manager','employee'].includes(u.id) && matches(u, where)),
      findUnique: async ({ where }) => state.users.find(u => !['manager','employee'].includes(u.id) && matches(u, where)) || null,
      findUniqueOrThrow: async args => { const u = await prisma.cashUser.findUnique(args); if (!u) throw Error('missing fixture'); return u; },
      findFirst: async args => prisma.cashUser.findUnique(args),
      create: async ({ data }) => { const u = { ...data, id: 'new-collector', status: 'ACTIVE', createdAt: new Date() }; state.users.push(u); return u; },
      update: async ({ where, data }) => Object.assign(state.users.find(u => matches(u, where)), data),
    },
    transaction: { create: async ({ data }) => ({ id: 'fixture-ledger', ...data }), findUnique: async () => null },
    role: { upsert: async () => ({ id: 'employee-role', name: 'EMPLOYEE' }) },
    cashSession: {
      create: async ({ data }) => { const row = { ...data, createdAt: new Date(), revokedAt: null }; state.sessions.push(row); return row; },
      findFirst: async ({ where }) => { const row = state.sessions.find(r => matches(r, where)); return row ? { ...row, user: state.users.find(u => u.id === row.cashUserId) } : null; },
      updateMany: async ({ where, data }) => { const rows = state.sessions.filter(r => matches(r, where)); rows.forEach(r => Object.assign(r, data)); return { count: rows.length }; },
    },
    cashCollection: {
      create: async ({ data }) => { if (state.records.some(r => r.id === data.id)) throw Error('duplicate fixture'); const row = { ...data, id: data.id || 'fixture-record-' + state.records.length }; state.records.push(row); return includeCollector(row); },
      findMany: async ({ where, skip = 0, take = 100 }) => state.records.filter(r => matches(r, where)).slice(skip, skip + take).map(includeCollector),
      findFirst: async ({ where }) => includeCollector(state.records.find(r => matches(r, where))) || null,
      findUniqueOrThrow: async ({ where }) => { const row = state.records.find(r => matches(r, where)); if (!row) throw Error('missing fixture'); return includeCollector(row); },
      count: async ({ where }) => state.records.filter(r => matches(r, where)).length,
      updateMany: async ({ where, data }) => { const rows = state.records.filter(r => matches(r, where)); rows.forEach(r => Object.assign(r, data)); return { count: rows.length }; },
      aggregate: async ({ where }) => { const rows = state.records.filter(r => matches(r, where)); return { _sum: { amountCollected: rows.reduce((n, r) => n + r.amountCollected, 0), outstandingBalance: 0 }, _count: rows.length }; },
    },
    cashClient: { findMany: async ({ where } = {}) => state.clients.filter(r => matches(r, where)), create: async ({ data }) => { state.clients.push(data); return data; } },
    cashAuditLog: { create: async ({ data }) => { if (failAudit) throw Error('fixture audit unavailable'); state.audits.push(data); return data; } },
    $transaction: async callback => { const snapshot = structuredClone(state); try { return await callback(prisma); } catch (error) { Object.assign(state, snapshot); throw error; } },
  };
  prisma.user = { findUnique: async () => null };
  prisma.auditLog = { create: async () => ({}) };
  return { state, prisma, config, settings, grants, failAudit: () => { failAudit = true; } };
}
const assertSanitized = value => assert.doesNotMatch(JSON.stringify(value), /password|tokenHash|responsibilities|salary|emergencyContact|legacy-fixture-must-never-return/i);

test('cash security: real HTTP guards with disposable in-memory service fixtures', async t => {
  const f = fixture();
  const app = await NestFactory.create({ module: class CashSecurityFixture {}, imports: [JwtModule.register({}), ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }])], controllers: [CashAuthController, CashCollectionsController], providers: [{ provide: APP_GUARD, useClass: HttpRateLimitGuard }, { provide: AuthService, useValue: { validateAccessToken: async () => { throw Error('OS credentials are not cash credentials'); } } }, { provide: CashFilesService, useValue: {} }, CashAuthService, CashCollectionsService, CashAccessPolicy, CashAccessGuard, { provide: ConfigService, useValue: f.config }, { provide: PrismaService, useValue: f.prisma }, { provide: CashMailService, useValue: { sendCollectionReceiptAlert: async () => ({ success: true }) } }] }, { logger: false, abortOnError: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const call = async (path, method = 'GET', body, token) => {
    const res = await fetch(base + '/api/v1' + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body && !['GET', 'HEAD'].includes(method) ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json() };
  };
  const resetRate = () => { const storage = app.get(getStorageToken()); for (const timeout of storage.timeoutIds) clearTimeout(timeout); storage.timeoutIds = []; storage._storage = {}; };
  const login = async id => { resetRate(); const r = await call('/cash-auth/login', 'POST', { identifier: id + '@example.invalid', password: fixturePassword }); assert.equal(r.status, 201); return r.data.accessToken; };
  let admin, operator, other;
  try {
    await t.test('all cash routes reject anonymous callers before touching data', async () => {
      for (const [method, path] of [['GET',''],['GET','/stats'],['GET','/collectors'],['GET','/clients'],['POST','/clients'],['POST','/collectors'],['DELETE','/collectors/operator'],['DELETE','/collectors'],['GET','/fixture'],['POST',''],['PATCH','/fixture/status'],['POST','/send-receipt']]) assert.equal((await call('/cash-collections' + path, method, {})).status, 401);
      assert.equal(f.state.records.length, 0); assert.equal(f.state.audits.length, 0);
    });
    await t.test('OS employee and OS manager receive no automatic cash access', async () => {
      for (const id of ['manager', 'employee']) { resetRate(); assert.equal((await call('/cash-auth/login','POST',{ identifier: id+'@example.invalid', password: fixturePassword })).status,401); }
      const osJwt = await app.get(JwtService).signAsync({ sub: 'manager', role: 'MANAGER' }, { secret: randomBytes(48).toString('hex') });
      assert.equal((await call('/cash-collections','GET',undefined,osJwt)).status,401);
    });
    await t.test('cash operator and administrator can authenticate without credential-bearing responses', async () => {
      admin = await login('admin'); operator = await login('operator'); other = await login('other');
      const me = await call('/cash-auth/me','GET',undefined,operator); assert.equal(me.status,200); assert.equal(me.data.cashLevel,'operator'); assertSanitized(me.data);
    });
    await t.test('legacy plaintext credentials are not silently accepted or migrated', async () => {
      resetRate(); assert.equal((await call('/cash-auth/login','POST',{ identifier:'legacy@example.invalid',password:'nonfunctional-fixture' })).status,401);
      assert.equal(f.state.users.find(u=>u.id==='legacy').passwordHash,'plain:nonfunctional-fixture');
    });
    await t.test('operator cannot manage collectors or create clients', async () => {
      for (const [method,path] of [['GET','/collectors'],['POST','/collectors'],['DELETE','/collectors/other'],['DELETE','/collectors'],['POST','/clients']]) assert.equal((await call('/cash-collections'+path,method,{},operator)).status,403);
    });
    await t.test('administrator collector responses redact credential metadata and private fields', async () => {
      const r = await call('/cash-collections/collectors','GET',undefined,admin); assert.equal(r.status,200); assert.ok(r.data.length); assertSanitized(r.data);
    });
    await t.test('record writes bind actual owner and reject forged assignment', async () => {
      const body = { clientName:'Fixture client',location:'Fixture location',amountCollected:100,status:'PENDING',description:JSON.stringify({assignedCollectorId:'other',password:'fixture-must-not-persist'}) };
      assert.equal((await call('/cash-collections','POST',{...body,collectorId:'other'},operator)).status,403);
      const r = await call('/cash-collections','POST',{...body,id:'own-record'},operator); assert.equal(r.status,201); assert.equal(r.data.collectorId,'operator'); assert.doesNotMatch(r.data.description,/fixture-must-not-persist/);
      assert.equal((await call('/cash-collections','POST',{...body,id:'other-record'},other)).status,201);
      assert.ok(f.state.audits.some(a=>a.action==='CASH_RECORD_CREATED'));
    });
    await t.test('cross-user list, record, status and aggregate access is denied or scoped', async () => {
      assert.equal((await call('/cash-collections?collectorId=other','GET',undefined,operator)).status,403);
      assert.equal((await call('/cash-collections/other-record','GET',undefined,operator)).status,404);
      assert.equal((await call('/cash-collections/other-record/status','PATCH',{status:'COMPLETE'},operator)).status,409);
      const rows = await call('/cash-collections','GET',undefined,operator); assert.equal(rows.data.items.length,1); assert.equal(rows.data.items[0].collectorId,'operator');
      assert.equal((await call('/cash-collections/stats','GET',undefined,operator)).data.totalRecords,1);
    });
    await t.test('invalid amounts and invalid final states fail validation', async () => {
      assert.equal((await call('/cash-collections','POST',{clientName:'Fixture',location:'Fixture',amountCollected:-1,description:'{}'},operator)).status,400);
      assert.equal((await call('/cash-collections/own-record/status','PATCH',{status:'UNKNOWN'},operator)).status,400);
    });
    await t.test('repeated cash status update has a single audited effect in fixture', async () => {
      assert.equal((await call('/cash-collections/own-record/status','PATCH',{status:'COMPLETE'},operator)).status,200);
      assert.equal((await call('/cash-collections/own-record/status','PATCH',{status:'COMPLETE'},operator)).status,409);
      assert.equal(f.state.audits.filter(a=>a.action==='CASH_STATUS_CHANGED'&&a.entityId==='own-record').length,1);
    });
    await t.test('bulk deletion is unavailable even to administrator', async () => {
      const count=f.state.records.length; assert.equal((await call('/cash-collections/collectors','DELETE',{},admin)).status,405); assert.equal(f.state.records.length,count);
    });
    await t.test('deactivation requires target confirmation and protects shared OS accounts', async () => {
      assert.equal((await call('/cash-collections/collectors/other','DELETE',{confirmation:'wrong',reason:'Fixture deactivation request'},admin)).status,400);
      assert.equal((await call('/cash-collections/collectors/manager','DELETE',{confirmation:'manager',reason:'Fixture deactivation request'},admin)).status,403);
    });
    await t.test('deactivation revokes sessions and preserves collection history', async () => {
      const count=f.state.records.length; assert.equal((await call('/cash-collections/collectors/other','DELETE',{confirmation:'other',reason:'Fixture deactivation request'},admin)).status,200);
      assert.equal(f.state.records.length,count); assert.equal((await call('/cash-collections','GET',undefined,other)).status,401);
    });
    await t.test('collector creation hashes password, fixes role and does not grant cash access automatically', async () => {
      const r=await call('/cash-collections/collectors','POST',{fullName:'Fixture new collector',email:'new@example.invalid',password:fixturePassword,role:'CEO'},admin);
      assert.equal(r.status,201); assertSanitized(r.data); assert.equal(r.data.accessPendingApproval,true);
      const u=f.state.users.find(u=>u.id==='new-collector'); assert.equal(await bcrypt.compare(fixturePassword,u.passwordHash),true); assert.equal(u.role,undefined); assert.equal(u.responsibilities,undefined);
      resetRate(); assert.equal((await call('/cash-auth/login','POST',{identifier:'new@example.invalid',password:fixturePassword})).status,401);
    });
    await t.test('existing email never returns the existing raw account', async () => {
      const r=await call('/cash-collections/collectors','POST',{fullName:'Fixture',email:'admin@example.invalid',password:fixturePassword},admin); assert.equal(r.status,409); assertSanitized(r.data);
    });
    await t.test('changed password invalidates the previous cash session', async () => {
      f.state.users.find(u=>u.id==='operator').passwordChangedAt=new Date(Date.now()+1000);
      assert.equal((await call('/cash-collections','GET',undefined,operator)).status,401);
      f.state.users.find(u=>u.id==='operator').passwordChangedAt=new Date(0); operator=await login('operator');
    });
    await t.test('grant removal is checked against server policy on each request', async () => {
      delete f.grants.operator; f.settings.CASH_ACCESS_GRANTS=JSON.stringify(f.grants); assert.equal((await call('/cash-collections','GET',undefined,operator)).status,403);
      f.grants.operator='operator';f.settings.CASH_ACCESS_GRANTS=JSON.stringify(f.grants);
    });
    await t.test('logout invalidates the persisted cash session', async () => {
      assert.equal((await call('/cash-auth/logout','POST',{},operator)).status,201); assert.equal((await call('/cash-collections','GET',undefined,operator)).status,401);
    });
    await t.test('signature, issuer, audience and expiration are verified', async () => {
      for (const options of [{secret:randomBytes(48).toString('hex')},{issuer:'wrong'},{audience:'wrong'},{expiresIn:-1},{algorithm:'HS384'}]) {
        const token=await app.get(JwtService).signAsync({sub:'admin',sid:'fixture',app:'cash'},{secret:f.settings.CASH_JWT_SECRET,algorithm:'HS256',issuer:'enako-cash',audience:'enako-cash-dashboard',expiresIn:30,...options});
        assert.equal((await call('/cash-collections','GET',undefined,token)).status,401);
      }
    });
    await t.test('cash login is actively throttled and forwarded headers do not change tracker', async () => {
      resetRate(); for(let i=0;i<5;i++) assert.equal((await call('/cash-auth/login','POST',{identifier:'missing@example.invalid',password:fixturePassword})).status,401);
      const r=await fetch(base+'/api/v1/cash-auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':'192.0.2.55'},body:JSON.stringify({identifier:'missing@example.invalid',password:fixturePassword})}); assert.equal(r.status,429);
    });
  } finally { await app.close(); }
});

test('cash config fails closed, disallows inherited grants and never grants access from OS role', () => {
  for(const raw of ['[]','null','{"operator":"CEO"}','{"__proto__":"administrator"}','invalid']) assert.throws(()=>new CashAccessPolicy({get:()=>raw}).grants());
  const p=new CashAccessPolicy({get:()=>undefined}); assert.throws(()=>p.require({sub:'admin',role:'CEO'},'records.read'));
  const f=fixture(), auth=new CashAuthService(f.prisma,{get:()=>undefined},new JwtService(),new CashAccessPolicy(f.config)); assert.throws(()=>auth.onModuleInit(),/not configured/);
});

test('failed audit insert rolls back a cash write in isolated transactional fixture', async () => {
  const f=fixture();const policy=new CashAccessPolicy(f.config);const service=new CashCollectionsService(f.prisma,{},policy);f.failAudit();
  await assert.rejects(()=>service.create({clientName:'Fixture',location:'Fixture',amountCollected:100,description:'{}'},{sub:'operator',cashLevel:'operator'}),/audit unavailable/);
  assert.equal(f.state.records.length,0);
});

test('dedicated cash accounts cannot authenticate or refresh into ENAKO OS', async () => {
  const f=fixture(); const user=f.state.users.find(u=>u.id==='operator');
  const security={ reportSecurityBreach: async()=>{} };
  const auth=new AuthService(f.prisma,{},f.config,security);
  await assert.rejects(()=>auth.login({email:user.email,password:fixturePassword}),/Invalid credentials/);
  const refresh='fixture-refresh-not-a-real-token';
  const refreshAuth=new AuthService(f.prisma,{verifyAsync:async()=>({sub:user.id})},f.config,security,new PermissionPolicy(f.config));
  await assert.rejects(()=>refreshAuth.refresh(refresh),/Legacy session requires reauthentication/);
  await assert.rejects(()=>refreshAuth.validateClaims({sub:user.id,app:'cash'}),/Invalid or legacy/);
});
