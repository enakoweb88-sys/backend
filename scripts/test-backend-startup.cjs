const { spawn } = require('node:child_process');
const child = spawn(process.execPath, ['dist/main.js'], { cwd: process.cwd(), env: { ...process.env, PORT: '0' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '', ready = false, timedOut = false;
const timeout = setTimeout(() => { timedOut = true; child.kill(); }, 60_000);
function capture(chunk) {
  output = (output + chunk.toString()).slice(-12_000);
  if (!ready && output.includes('ENAKO OS Backend running on port')) {
    ready = true;
    // Stop immediately after listen succeeds, before the 10-second email worker runs.
    child.kill();
  }
}
child.stdout.on('data', capture);
child.stderr.on('data', capture);
child.on('error', error => { clearTimeout(timeout); console.error(error.message); process.exitCode = 1; });
child.on('exit', () => {
  clearTimeout(timeout);
  if (ready) console.log('PASS: compiled backend verified schema, initialized all modules and listened successfully; test process stopped.');
  else { console.error(timedOut ? 'Backend startup timed out' : 'Backend exited before becoming ready'); console.error(output); process.exitCode = 1; }
});
