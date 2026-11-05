const { spawnSync } = require('node:child_process');
// Deliberately allowlisted. Legacy production/maintenance scripts are never tests.
const suites = ["test-master-access.cjs","test-master-boundaries.cjs","test-cash-security.cjs","test-staff-redaction.cjs","test-work-privacy.cjs","test-private-chat.cjs","test-report-documents.cjs","test-reports.cjs","test-report-alerts.cjs"];
for (const file of suites) { const result = spawnSync(process.execPath, ['scripts/' + file], { stdio: 'inherit', windowsHide: true }); if (result.status !== 0) process.exit(result.status || 1); }
