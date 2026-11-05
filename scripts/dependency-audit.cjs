const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const cli = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const executable = process.platform === 'win32' ? process.execPath : 'npm';
const args = [...(process.platform === 'win32' ? [cli] : []), 'audit', '--json', '--ignore-scripts', '--fetch-retries=0', '--fetch-timeout=20000', '--cache', '.cache/npm'];
if (process.argv.includes('--production')) args.push('--omit=dev');
let output;
try { output = cp.execFileSync(executable, args, { encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 8 * 1024 * 1024 }); }
catch (error) { output = error.stdout; }
let result;
try { result = JSON.parse(output); if (!result.metadata?.vulnerabilities) throw Error(); }
catch { console.error('DEPENDENCY AUDIT NOT VERIFIED: advisory service unavailable or invalid response'); process.exit(2); }
fs.mkdirSync('.cache', { recursive: true }); fs.writeFileSync('.cache/' + (process.argv.includes('--production') ? 'audit-production' : 'audit') + '.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ counts: result.metadata.vulnerabilities, findings: Object.entries(result.vulnerabilities || {}).map(([name, value]) => ({ name, severity: value.severity, range: value.range, fix: value.fixAvailable })) }, null, 2));
if (result.metadata.vulnerabilities.critical || result.metadata.vulnerabilities.high) process.exitCode = 1;
