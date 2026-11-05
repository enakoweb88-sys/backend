const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { randomBytes } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

// Never reads DATABASE_URL/.env and never creates a system user or contacts a remote DB.
async function localPostgres() {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const root = path.resolve(__dirname, '../.test-runtime');
  fs.mkdirSync(root, { recursive: true });
  const directory = fs.mkdtempSync(path.join(root, 'postgres-'));
  if (!path.resolve(directory).startsWith(root + path.sep)) throw Error('Unsafe fixture directory');
  const socket = net.createServer();
  await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const password = randomBytes(32).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'enako_fixture', password, port, authMethod: 'scram-sha-256', persistent: true, createPostgresUser: false, autoRehydrateSymlinks: true, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
  try { await pg.initialise(); await pg.start(); }
  catch (error) { try { await pg.stop(); } catch {} throw new Error('Disposable PostgreSQL could not start: ' + String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g, '[REDACTED_URL]')); }
  return {
    url: 'postgresql://enako_fixture:' + password + '@127.0.0.1:' + port + '/postgres',
    async close() {
      if (process.platform === 'win32' && pg.process) {
        // The wrapper uses taskkill on Windows; pg_ctl performs a bounded, graceful
        // shutdown of this exact disposable cluster, without touching other servers.
        const ctl = path.resolve(__dirname, '../node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe');
        await promisify(execFile)(ctl, ['stop', '-D', directory, '-m', 'fast', '-w', '-t', '15'], { windowsHide: true, timeout: 20000 });
        pg.process = undefined;
      } else await pg.stop();
      const resolved = path.resolve(directory);
      if (!resolved.startsWith(root + path.sep)) throw Error('Unsafe fixture cleanup');
      fs.rmSync(resolved, { recursive: true, force: true });
    },
  };
}
module.exports = { localPostgres };
if (require.main === module) {
  (async () => { const instance = await localPostgres(); try { const { Client } = require('pg'); const client = new Client({ connectionString: instance.url }); await client.connect(); const result = await client.query('SELECT current_setting(\'server_version\') AS version'); console.log('Disposable loopback PostgreSQL started: ' + result.rows[0].version); await client.end(); } finally { await instance.close(); } })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
