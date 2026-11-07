require('./register-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
// Fixture configuration must never inherit developer or CI environment values.
class ConfigService {
  constructor(values = {}) { this.values = values; }
  get(key, fallback) { return this.values[key] ?? fallback; }
}
const { JwtService } = require('@nestjs/jwt');
const { generateKeyPairSync, randomBytes } = require('node:crypto');
const net = require('node:net');
const axios = require('axios');
const { GatewayAccess } = require('../src/common/gateway-access.ts');
const { scanDocument, readableDocumentScanStatus } = require('../src/common/document-scanner.ts');
const { corsAllowlist, trustedProxies } = require('../src/common/request-security.ts');
const { SecureFilesService, safeUpload } = require('../src/modules/files/secure-files.service.ts');
const { CommunicationsGateway } = require('../src/modules/communications/communications.gateway.ts');

test('gateway verifies RSA signature, exact team issuer, application audience and expiry', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' }); jwk.kid = 'fixture-key';
  const issuer = 'https://fixture-team.cloudflareaccess.com', os = 'a'.repeat(64), cash = 'b'.repeat(64), jwt = new JwtService();
  const gateway = new GatewayAccess(new ConfigService({ GATEWAY_ACCESS_MODE: 'required', CF_ACCESS_TEAM_DOMAIN: issuer, CF_ACCESS_OS_AUDIENCE: os, CF_ACCESS_CASH_AUDIENCE: cash }), jwt);
  const get = axios.default.get; let fetches = 0;
  axios.default.get = async (url, options) => { fetches++; assert.equal(url, issuer + '/cdn-cgi/access/certs'); assert.equal(options.maxRedirects, 0); return { data: { keys: [jwk] } }; };
  const sign = options => jwt.signAsync({ email: 'engineer@fixture.invalid' }, { privateKey, algorithm: 'RS256', keyid: 'fixture-key', issuer, audience: os, expiresIn: 60, ...options });
  try {
    assert.equal((await gateway.verify(await sign({}), 'os')).email, 'engineer@fixture.invalid');
    for (const options of [{ issuer: 'https://attacker.invalid' }, { audience: cash }, { expiresIn: -1 }, { keyid: 'attacker' }]) await assert.rejects(gateway.verify(await sign(options), 'os'));
    await assert.rejects(gateway.verify(await jwt.signAsync({ email: 'forged@fixture.invalid' }, { secret: randomBytes(32).toString('hex'), algorithm: 'HS256' }), 'os'));
    assert.equal(fetches, 1); await assert.rejects(gateway.verify(undefined, 'os'));
  } finally { axios.default.get = get; }
});

test('gateway configuration cannot silently disable production protection or trust remote local-mode requests', async () => {
  assert.throws(() => new GatewayAccess(new ConfigService({}), new JwtService()).onModuleInit());
  assert.throws(() => new GatewayAccess(new ConfigService({ NODE_ENV: 'production', GATEWAY_ACCESS_MODE: 'local-only' }), new JwtService()).onModuleInit());
  const local = new GatewayAccess(new ConfigService({ NODE_ENV: 'test', GATEWAY_ACCESS_MODE: 'local-only' }), new JwtService());
  assert.equal(await local.verify(undefined, 'os', '127.0.0.1'), undefined); await assert.rejects(local.verify(undefined, 'os', '192.0.2.10'));
});

test('CORS and proxy allowlists reject wildcards, hop counts, broad trust and unapproved HTTP origins', () => {
  for (const value of ['*', 'true', '1', '0.0.0.0/0', '::/0']) assert.throws(() => trustedProxies(new ConfigService({ TRUSTED_PROXY_CIDRS: value })));
  assert.equal(trustedProxies(new ConfigService({})), false);
  assert.deepEqual(trustedProxies(new ConfigService({ TRUSTED_PROXY_CIDRS: '127.0.0.1/32,::1/128' })), ['127.0.0.1/32', '::1/128']);
  for (const value of ['*', 'http://untrusted.invalid', 'https://approved.invalid/path', 'https://approved.invalid@attacker.invalid']) assert.throws(() => corsAllowlist(new ConfigService({ CORS_ORIGIN: value })));
  assert.deepEqual(corsAllowlist(new ConfigService({ CORS_ORIGIN: 'https://approved.invalid,http://127.0.0.1:3000' })), ['https://approved.invalid', 'http://127.0.0.1:3000']);
});

test('file validation uses byte content, bounded sizes and safe names instead of browser MIME', () => {
  const bytes = Buffer.from('%PDF-1.7\nfixture');
  assert.equal(safeUpload({ buffer: bytes, size: bytes.length, originalname: 'fixture.pdf', mimetype: 'text/html' }, true).mimeType, 'application/pdf');
  for (const originalname of ['../fixture.pdf', 'bad\r\n.pdf', 'run.exe', 'vector.svg']) assert.throws(() => safeUpload({ buffer: bytes, size: bytes.length, originalname }, true));
  assert.throws(() => safeUpload({ buffer: Buffer.from('<html>not a PDF</html>'), size: 22, originalname: 'fake.pdf' }, true));
  assert.throws(() => safeUpload({ buffer: bytes, size: 1, originalname: 'fixture.pdf' }, true));
});

test('ClamAV INSTREAM verifies clean, rejects infected and fails closed without a scanner', async () => {
  let infected = false;
  const server = net.createServer(socket => {
    let received = Buffer.alloc(0), announced = false;
    socket.on('data', chunk => {
      received = Buffer.concat([received, chunk]);
      if (!announced && received.length >= 10) { assert.equal(received.subarray(0, 10).toString(), 'zINSTREAM\0'); announced = true; }
      if (received.length >= 18 && received.subarray(-4).equals(Buffer.alloc(4))) socket.end(infected ? 'stream: fixture-test FOUND\0' : 'stream: OK\0');
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const service = new SecureFilesService({}, new ConfigService({ FILE_SCANNER_MODE: 'required', FILE_SCANNER_EMBEDDED: 'false', FILE_SCANNER_HOST: '127.0.0.1', FILE_SCANNER_PORT: String(server.address().port) }));
  try { assert.equal(await service.scan(Buffer.from('fixture-document')), 'CLEAN'); infected = true; await assert.rejects(service.scan(Buffer.from('fixture-document')), /failed security scanning/); }
  finally { await new Promise(resolve => server.close(resolve)); }
  await assert.rejects(new SecureFilesService({}, new ConfigService({})).scan(Buffer.from('fixture')), /not configured/);
});

test('explicit no-scanner policy permits validated documents without falsely marking them clean', async () => {
  const config = new ConfigService({ FILE_SCANNER_EMBEDDED: 'false' });
  const buffer = Buffer.from('%PDF-1.7\nfixture-document');
  const file = { buffer, size: buffer.length, originalname: 'fixture.pdf' };
  const service = new SecureFilesService({}, config);
  const prepared = await service.prepare(file, 'kyc', undefined, true);
  assert.equal(prepared.scanStatus, 'UNSCANNED');
  assert.equal(readableDocumentScanStatus('UNSCANNED', config), true);
  assert.equal(readableDocumentScanStatus('CLEAN', config), true);
  for (const status of ['INFECTED', 'PENDING', 'FAILED']) assert.equal(readableDocumentScanStatus(status, config), false);
  for (const originalname of ['fixture.exe', 'vector.svg', '../fixture.pdf']) await assert.rejects(service.prepare({ ...file, originalname }, 'kyc', undefined, true));
  const fake = Buffer.from('<html>not a PDF</html>');
  await assert.rejects(service.prepare({ ...file, buffer: fake, size: fake.length }, 'kyc', undefined, true));
  assert.equal(readableDocumentScanStatus('UNSCANNED', new ConfigService({ FILE_SCANNER_MODE: 'required' })), false);
});

test('required, missing or invalid scanner configuration never silently permits an upload', async () => {
  for (const config of [new ConfigService({}), new ConfigService({ FILE_SCANNER_MODE: 'required', FILE_SCANNER_EMBEDDED: 'false' }), new ConfigService({ FILE_SCANNER_MODE: 'typo' })]) {
    await assert.rejects(scanDocument(Buffer.from('fixture'), config), error => error.getStatus() === 503);
  }
  assert.equal(await scanDocument(Buffer.from('fixture'), new ConfigService({ FILE_SCANNER_MODE: 'disabled' })), 'UNSCANNED');
});

test('WebSocket identity, room membership, revocation and event limits are enforced', async () => {
  const writes = [], emitted = []; let revoked = false, hits = 0;
  const prisma = { $queryRaw: async () => [{ hits: ++hits, remaining: 60 }], message: { create: async ({ data }) => { writes.push(data); return data; } } };
  const auth = { validateAccessToken: async token => { if (revoked || token !== 'fixture') throw Error(); return { sub: 'engineer', email: 'engineer@fixture.invalid' }; } };
  const communications = { verifyChannelAccess: async (channel, user) => channel === 'allowed' && user === 'engineer' };
  const gateway = new CommunicationsGateway(prisma, auth, communications, { verify: async () => undefined }, new ConfigService({ RATE_LIMIT_HASH_SECRET: randomBytes(32).toString('hex') }));
  const socket = { id: 'fixture', data: { token: 'fixture' }, rooms: new Set(), emit: (name, data) => emitted.push({ name, data }), join: async name => socket.rooms.add(name), leave: async name => socket.rooms.delete(name), disconnect: () => { socket.disconnected = true; }, handshake: { auth: { token: 'fixture' }, headers: {} }, conn: { remoteAddress: '127.0.0.1' } };
  gateway.server = { sockets: { sockets: new Map([['fixture', socket]]) } };
  await gateway.handleConnection(socket);
  try {
    assert.ok(socket.rooms.has('user:engineer')); assert.ok((await gateway.handleUserJoin('ceo', socket)).error);
    assert.ok((await gateway.handleJoin('restricted', socket)).error); assert.ok((await gateway.handleJoin('dm:pair', socket)).error);
    assert.equal((await gateway.handleJoin('allowed', socket)).joined, 'allowed');
    await gateway.handleMessage({ channel: 'allowed', content: 'Fixture message', senderId: 'ceo' }, socket); assert.equal(writes[0].senderId, 'engineer');
    hits = 60; assert.ok((await gateway.handleMessage({ channel: 'allowed', content: 'Limited' }, socket)).error); assert.equal(writes.length, 1);
    revoked = true; const previous = emitted.length; await gateway.broadcastNotification('engineer', { private: true }); assert.equal(emitted.length, previous); assert.equal(socket.disconnected, true);
  } finally { gateway.handleDisconnect(socket); }
});

test('avatar uploads reject active content, false image types and scanner outages before persistence', async () => {
  const { UsersService } = require('../src/modules/users/users.service.ts');
  let writes = 0;
  const service = new UsersService({ user: { update: async () => { writes++; } } }, {}, new ConfigService({ FILE_SCANNER_HOST: '' }));
  const user = { sub: 'fixture', email: 'fixture@invalid.test' };
  for (const avatarUrl of ['data:image/svg+xml;base64,' + Buffer.from('<svg/>').toString('base64'), 'data:image/png;base64,' + Buffer.from('%PDF-1.7').toString('base64'), 'javascript:alert(1)', 'https://user:pass@example.invalid/avatar.png']) {
    await assert.rejects(service.updateMe(user, { avatarUrl }), error => error.getStatus() === 400);
  }
  const image = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
  await assert.rejects(service.updateMe(user, { avatarUrl: 'data:image/png;base64,' + image.toString('base64') }), error => error.getStatus() === 503);
  assert.equal(writes, 0);
});
