# Upload availability correction — 2026-11-07

The owner explicitly requested that client KYC and employee report uploads remain
available without purchasing scanner hosting. The prior release required an
antivirus daemon for every upload and would reject submissions on Render Free.
This follow-up changes that policy before the owner's backend deployment.

## Configuration

- `FILE_SCANNER_MODE=auto` (also the default when absent): explicit
  `FILE_SCANNER_EMBEDDED=false` permits uploads without antivirus. An embedded
  value of true, missing configuration or other values still require scanning.
- `FILE_SCANNER_MODE=required`: always require the loopback scanner, even if the
  bundled daemon is disabled. Connection failure, timeout, invalid replies and
  infection still reject uploads. An outage never automatically bypasses a scan.
- `FILE_SCANNER_MODE=disabled`: explicit unscanned operation regardless of the
  daemon toggle. Unknown mode values fail closed.

The existing Render setting `FILE_SCANNER_EMBEDDED=false` is sufficient for auto
mode; no new secret, paid resource or database migration is needed. If a scanner
mode override already exists in Render, it must reflect the chosen policy.

## Retained controls and honest metadata

KYC remains limited to supported PDF/image content, with bounded sizes, safe
filenames, executable-content rejection and private storage. OS and Cash use
their own document tables, identities and authorization. Content hashes,
expiration, authentication, review workflow, private response headers and download
permissions remain enforced. Reports retain attachment count/size limits and
arbitrary document-format support, and now explicitly reject executable files,
HTML and SVG by the shared validation rule even without antivirus.

OS SecureFile and CashDocument uploads skipped by this explicit policy are stored
as `UNSCANNED`, not falsely certified `CLEAN`. Their existing string status columns
already support this value. Reads permit `UNSCANNED` only while unscanned operation
is configured; pending, failed and infected states remain inaccessible. Previously
scanned clean files remain available. Turning required scanning on later blocks
unscanned private documents until an explicit rescan transition is implemented.
Report documents do not have an existing antivirus-status column and are not
labelled clean; they retain their existing private file metadata and hashes.

This configuration does not provide malware scanning. File signatures and type
restrictions reduce risk but do not certify that a document is malware-free.
A warning is logged once per process when unscanned operation is first used,
without document contents, credentials or customer information.

## Verification

Regression coverage verifies explicit disabled mode, invalid/missing settings,
required-mode override and genuine ClamAV infection rejection. Report PDF
upload/download tests use the real scan-policy service with scanning disabled.
Full HTTP tests submit and privately download OS KYC, Cash KYC and employee report
PDFs with the scanner disabled, using a disposable local database. They retain
cross-application and unauthorized-employee denial assertions and the existing
required-scanner outage test. No customer records or production configuration are
accessed by these tests.

Completed checks: TypeScript and production build passed; lint reported zero errors and the same 49
existing warnings; 34 unit tests, 95 security tests, 16 database integration checks
and 10 full HTTP integration groups passed. The HTTP groups include disabled-mode
OS KYC, Cash KYC and report upload/download assertions. Secret scan: zero findings.
Both scanner startup lifecycle checks passed. The database fixtures required
access to the existing protected local test directory; no remote database was
used. Production behavior remains subject to deploying this correction and
verifying the real configuration.
