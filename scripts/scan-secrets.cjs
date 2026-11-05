// Values are never printed. Scans tracked and nonignored candidate files, not .env contents.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const root = process.cwd();
const files = cp.execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8', windowsHide: true }).split('\0').filter(Boolean);
const patterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['provider-token', /\b(?:gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{25,}|AIza[A-Za-z0-9_-]{30,}|re_[A-Za-z0-9]{25,}|sk_live_[A-Za-z0-9]{20,})\b/g],
  ['database-credential', /postgres(?:ql)?:\/\/[^\s"'`/]+:[^\s"'`@]+@(?!(?:localhost|127\.0\.0\.1)(?::|\/))/g],
  ['smtp-literal', /(?:SMTP_PASS[^\n]{0,100}\|\|\s*['"][^'"\r\n]{5,}['"]|pass\s*:\s*['"][a-z]{4}(?: [a-z]{4}){3}['"])/g],
];
const findings = [];
for (const file of [...new Set(files)]) {
  const resolved = path.resolve(root, file);
  if (!resolved.startsWith(root + path.sep) || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) continue;
  if (/(^|\/)\.env($|\.)/.test(file) && !/\.example$/.test(file)) { findings.push({ file, line: 0, category: 'environment-file' }); continue; }
  if (!/\.(?:[cm]?[jt]sx?|json|ya?ml|toml|md|sql|sh|txt|prisma)$/.test(file) || fs.statSync(resolved).size > 3 * 1024 * 1024) continue;
  const source = fs.readFileSync(resolved, 'utf8');
  for (const [category, pattern] of patterns) { pattern.lastIndex = 0; for (const match of source.matchAll(pattern)) findings.push({ file, line: source.slice(0, match.index).split('\n').length, category }); }
}
console.log(JSON.stringify({ scanned: files.length, findings }, null, 2));
if (findings.length) process.exitCode = 1;
