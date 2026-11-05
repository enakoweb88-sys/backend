# Security remediation — Batch 1

Date: 2026-11-04. Status: LOCAL IMPLEMENTATION ONLY; NOT APPROVED FOR DEPLOYMENT.

This report covers SEC-001, SEC-002 and SEC-003, plus the authentication boundary needed to keep dedicated cash identities out of ENAKO OS. It does not claim completion of Batches 2–5. No production systems, databases, DNS, keys, policies or records were changed. No commit or push was made.

## Change control and plan

| Repository | Original branch / commit | Existing work preserved | Remediation branch |
|---|---|---|---|
| Workspace | master / 73a18ed9921781e6785e0ae7fdc939da5c8149f2 | 280 tracked changes and 1,314 untracked entries at preflight; no conflicts | Unchanged |
| backend | main / b90985fe7443145499322805fcce89bf21d3d5e1 | Existing staged package.json and package-lock.json; neither edited nor staged by this work | security/batch-1-cash-2026-11-04 |
| cash | main / 5cf0a1a7d419c8dbdff5e3251db12fe8ddd7821a | Clean at preflight | security/batch-1-cash-2026-11-04 |
| enako-os | main / d1805e78c59cbe45b26bc78d6ac645478a260cb4 | Existing src/pages/StaffMeals.tsx change; repository not edited | Unchanged |
| client | main / d9285141e7023ab62360ad535a9974e60ae7f694 | Clean; not edited | Unchanged |
| testing | main / ee91db7b72a84c4687de109eb16d20b531ba83a3 | Clean; not edited | Unchanged |

Branches were created at the current commits without checkout, reset, stash or index changes. Preflight and post-branch working-tree status, staged diff and package-file hashes were compared. The full working-tree status was inspected; unrelated application repositories were left alone.

| Batch | Planned scope | Risk / disposition |
|---|---|---|
| 1 | Cash authorization/credentials, shared staff response exposure, necessary application identity boundary | Implemented locally; compatibility and account migration gates below |
| 2 | Complete OS permission catalogue, role-grant hierarchy, JWT configuration/rotation/reuse, session revocation | Not implemented; significant remaining risks |
| 3 | Authenticated WebSockets, public/admin API split, private KYC/general uploads, actual provider webhook verification | Not implemented; must preserve public onboarding and provider compatibility |
| 4 | OS frontend typing/integration, meal/support ownership, expense controls; separate financial atomicity/reconciliation workstream | Not implemented; real database persistence verification required |
| 5 | Dependencies, containers, CI, schema privilege separation and Zero Trust readiness | Design only; no infrastructure activation |

## A. Change register

See [change-register.md](./change-register.md) for every changed source/test file with original and changed line ranges. New documentation consists of this report, that register, [migration-and-rollback.md](./migration-and-rollback.md), [zero-trust-setup.md](./zero-trust-setup.md), and the cash application's separate `cash/docs/security-batch-1.md`.

## B. Implementation report

### SEC-001 — independent cash authorization

`backend/src/modules/cash-collections/cash-access.ts:5–45` defines operator/administrator grants keyed by immutable account ID, read from server-only configuration. OS role, email, browser role and editable job title cannot grant cash access. Missing grants deny access; malformed grants fail closed. Unknown permission names are denied.

| Cash permission | Operator | Administrator |
|---|---|---|
| session | Own | Own |
| records.read | Own collector FK only, including statistics | All cash records |
| records.create | Own pending record only | Own or explicitly granted active account |
| records.update | Own pending record to a permitted final status | Any pending cash record to a permitted final status |
| clients.read | Shared cash-client directory | Shared cash-client directory |
| clients.create | Denied | Allowed |
| collectors.manage | Denied | Allowed, with dedicated-account restrictions |
| receipts.send | Denied | Server-generated receipt for an existing record and unique registered cash client |

The client directory is explicitly shared among granted cash operators; the current CashClient model has no assignment/owner relationship. It is not claimed to have per-collector client isolation. A narrower territory/client policy requires an approved data-model change.

`cash-access.guard.ts:9–18` authenticates the separate cash session and requires route permission metadata. Every existing cash controller route has this class-level guard and an explicit permission, in `cash-collections.controller.ts:35–133`. A native ThrottlerGuard is active on these routes. `cash-auth.controller.ts:20–34` limits login to five attempts per minute per observed IP and protects session inspection/logout.

`cash-collections.service.ts:31–84,154–163` binds list/read/aggregate/update queries to the real collector FK. Descriptive JSON never grants ownership. Creation, status changes, client creation, collector creation and deactivation use transactions containing audit inserts. Status transitions use a pending-only conditional update; repeated finalization returns conflict. This is not full financial ledger idempotency.

`cash-collections.service.ts:108–125` changes individual DELETE semantics to confirmed deactivation. It requires exact target ID confirmation and a reason, rejects self-deactivation and unrelated/shared OS accounts, suspends only dedicated cash-managed employee accounts, revokes refresh/session rows and retains all cash history. The audit retains the action/target and that a reason was provided, not the free-text reason. Bulk deletion always returns 405; no history purge remains in that operation.

Audit entries contain actor, action, entity and limited metadata. Existing AuditLog storage is not made immutable or tamper-evident by this batch. Retention/access/integrity policy remains a later control.

### SEC-002 — server authentication and credential sanitization

`cash-auth.service.ts:19–60,69–91` implements server-side bcrypt verification, a separate cash signing secret, HS256 allowlisting, fixed issuer/audience, a 15-minute maximum lifetime and a persisted SHA-256 token digest. The existing RefreshToken table stores these revocable cash-session rows under device purpose `cash-session-v1`; the cash token is not a refresh credential and there is no cash refresh endpoint. Users reauthenticate after expiry.

Each request checks token signature/time/issuer/audience, persisted token digest, revocation, current account status, password-change version and current cash grant. Password-version equality avoids allowing an old password verification to survive a concurrent credential change. Logout revokes the specific cash session. Suspension also prevents its use, even when a different administration path did not revoke the row.

Configured cash grants require a separate key of at least 32 UTF-8 bytes and prohibit reusing configured OS access/refresh keys. Startup fails for provisioned cash with missing/invalid security configuration. Without grants, cash stays inaccessible; the shared public applications can still start. No production values were read, invented or configured.

Login accepts an exact email, exact terminal identifier or exact normalized phone among explicitly granted active accounts. Ambiguous matches fail. Short suffix matching, client PIN comparisons and bypass PINs are removed. Legacy plaintext/placeholder hashes are not accepted, converted or changed automatically.

`cash-collections.service.ts:17–21,86–90,127–141` uses an allowlisted collector response, bcrypt cost 12, a server-generated terminal ID and fixed EMPLOYEE identity for new dedicated accounts. No password is stored in responsibilities or returned. Existing-email creation returns conflict instead of the existing raw account. New accounts require separate grant approval; creating a collector never elevates the creating or created account.

`cash/src/api/cashApi.ts:374–413` stores cash credentials in sessionStorage only, revalidates restoration with `/cash-auth/me`, and clears local credentials immediately during logout while requesting server revocation. `cash/src/App.tsx:85–90,251–356` no longer authenticates from local profiles or caches collector passwords. Legacy credential caches are removed when this new frontend runs; legacy shared ledger/draft stores are not automatically purged or imported.

The cash frontend has separate token keys/headers for cash versus existing shared OS/financial APIs. An explicitly granted cash administrator who independently has an OS CEO/Manager role may perform the existing OS login for those existing shared APIs; that credential is never used to bypass cash authorization. Other cash accounts do not gain that session. Browser-readable tokens still require XSS hardening and may later move to a BFF/cookie design.

`backend/src/common/application-boundary.ts:2–5`, `modules/auth/auth.service.ts` login/refresh and `modules/auth/jwt.strategy.ts:18–22` prevent dedicated cash-managed accounts from using OS authentication. The OS JWT strategy also checks active status and obtains the current database role. Existing dual-purpose OS accounts are not automatically marked cash-only. General OS signing defaults, refresh rotation and comprehensive logout invalidation remain Batch 2 work.

Cash write/registration forms now await server results before claiming success. Assignments send actual database account IDs, not terminal aliases. Receipt requests no longer fall back to the unguarded generic email endpoint and no longer report a failed dispatch as successful. Existing cash-to-financial mirroring is still a separate, non-atomic workflow and is not certified by these changes.

### SEC-003 — safe staff responses

`backend/src/common/staff-response.dto.ts` provides explicit directory DTOs and safe Prisma projections. `/users` always returns a minimal directory. `/employees` gives ordinary EMPLOYEE/OUTREACH_MANAGER users a minimal directory; CEO/Manager HR responses retain authorized HR fields. Legacy JSON responsibilities are suppressed from HR/export responses because they can contain cash credentials.

`modules/admin/admin.controller.ts` now declares CEO/Manager authorization for overview, with a service-side check as well. Recent staff are projected and serialized through the safe DTO. Ordinary staff can still submit their own leave request; that separate operation is not converted into a management-only route. Personal export no longer returns a raw User object with only one field removed.

This does not close every personnel-data access path elsewhere in the system. Dashboard/analytics/other permission gaps from the audit remain subject to Batch 2 review.

## C. Test report

The new cash HTTP tests use an isolated Nest application, disposable in-memory records and a mocked Prisma provider. Staff-redaction tests instantiate services/guards with mocks. HTTP requests bind to `127.0.0.1` on an ephemeral port. Neither suite loads AppModule, dotenv files, production URLs, SMTP or a real Prisma connection.

| Command / location | Result | Scope and limitations |
|---|---|---|
| `node scripts/test-cash-security.cjs` in backend | 24 passed | Actual HTTP routing, validation and guards; in-memory transactional fixtures, not PostgreSQL |
| `node scripts/test-staff-redaction.cjs` in backend | 7 passed | Projection/DTO redaction, HR permission checks and legacy metadata suppression |
| `node --test test-cash-auth.cjs test-collection-sync.cjs test-fx-collectors.cjs test-idle-session.cjs` in cash | 34 passed | Mocked fetch/storage, cash/OS credential separation, client regressions; not browser rendering |
| Existing five backend privacy/report suites through the in-memory TypeScript loader | 57 passed | Tasks/goals, private HTTP chat, report documents and workflows; mocks only |
| `node_modules/.bin/tsc --project tsconfig.build.json --noEmit --incremental false --pretty false` in backend | Passed | Production TypeScript configuration; no build artifacts |
| `node_modules/.bin/tsc --noEmit --incremental false --pretty false` in cash | Passed | Cash frontend type check |
| `git diff --check` in both changed repositories | Passed | No whitespace-error findings; Git emits normal LF/CRLF notices |

The exact existing-suite command, from backend, is:

```powershell
@'
const Module=require('module');
const load=Module._load;
Module._load=function(name){if(name==='tsx/cjs')return {};return load.apply(this,arguments)};
require('./scripts/register-typescript.cjs');
for(const file of ['test-work-privacy.cjs','test-objectives.cjs','test-private-chat.cjs','test-report-documents.cjs','test-reports.cjs'])require('./scripts/'+file);
'@ | node
```

New cash backend cases cover anonymous denial on all 12 existing cash routes; no automatic OS-role cash access; granted login; legacy credential rejection; management denial; response redaction; forged assignment; cross-owner list/read/update/statistics; invalid amount/status; repeated finalization; disabled bulk deletion; target confirmation; shared-account protection; suspension/session revocation/history retention; hashed creation without role escalation; duplicate-email privacy; password changes; grant removal; logout; signature/issuer/audience/expiry/algorithm checks; throttling and forwarded-header resistance; malformed/missing configuration; audit rollback fixtures; and cash-only OS login/refresh rejection.

Staff tests cover minimal user projection, EMPLOYEE and OUTREACH_MANAGER directory redaction, retained authorized HR access, overview denial before data access, safe overview staff responses and personal export sanitization. Frontend test names and assertions are in `cash/test-cash-auth.cjs`.

Initial test runs exposed GET-with-body in the test helper, an incorrectly classified fixture manager, and a non-async callback left in the collection form. These were corrected. Final status is recorded above; no production exploit test was performed.

Real database writes followed by independent reads, database concurrency, browser workflows, email delivery and deployed persistence are NOT VERIFIED. No isolated PostgreSQL instance was provisioned for this batch; an unknown DATABASE_URL was not used. The OS frontend and full backend seed/test type checks failed in the prior audit and are not claimed fixed by the passing production-backend/cash checks.

## D. Application boundary report

| Boundary | Functional scope | Security boundary / current change |
|---|---|---|
| ENAKO OS (`enako-os/`) | Staff/department administration, tasks, goals, meals, expenses, reports, announcements, internal communication, performance, OS analytics and KYC review | Existing OS frontend untouched; staff responses and OS admission hardened. Cash collections/collector management are not OS functional modules |
| Cash Dashboard (`cash/`) | Collectors, collections, cash clients, cash history/reconciliation and existing cash financial workflows | Explicit cash grants, separate session signing/audience and scoped records; separate functional documentation |
| Public KYC (`client/`) | Applicant onboarding | No gateway requirement or route restriction added to public submissions |
| Outreach/Public (`testing/` and public endpoints) | Published content, applications/donations and partner-facing functions | Unchanged in Batch 1; mixed public/admin findings still open |
| Shared backend (`backend/`) | Hosts distinct route/security domains | Cash tokens and OS tokens are not interchangeable; public routes not blanket-protected |
| Shared database | Existing User, RefreshToken, CashCollection, CashClient and AuditLog models | Shared persistence does not imply shared permissions. New cash-only identities are marked server-side; grants live in server configuration. No production migration performed |

## E. Environment variable register — names only

| Name | Purpose | Target | Mandatory / implemented status |
|---|---|---|---|
| CASH_ACCESS_GRANTS | Approved account-ID to operator/administrator mapping | Backend secret/configuration store | Required for any cash access; absent means deny all. Invalid value fails startup |
| CASH_JWT_SECRET | Independent cash-session signing credential, at least 32 bytes | Backend secret store only | Required when cash is provisioned; no default; must differ from configured OS signing credentials |
| JWT_ACCESS_SECRET | Existing independent OS signing key | Backend only | Existing OS configuration; insecure fallback not removed in this batch |
| JWT_REFRESH_SECRET | Existing OS refresh signing key | Backend only | Existing OS configuration; rotation/default remediation pending |
| DATABASE_URL / DIRECT_URL | Existing runtime/migration database connections | Backend only | Existing application requirement; values not read or changed; tests do not use them |
| VITE_API_URL | Public API base URL including API prefix | Cash frontend build configuration | Optional existing fallback; not a secret and not an authorization control |

Proposed gateway variables are documented separately and are NOT implemented or ready to configure as if enforcement existed. No secret should be placed in a VITE_ variable.

## F. Hosting / Zero Trust setup guide

See [zero-trust-setup.md](./zero-trust-setup.md). It is a staging-first design and approval checklist, not evidence of deployed enforcement.

## G. Security evidence guide

Capture source path and line numbers, test names/counts and relevant denied/successful fixture statuses. Redact ALL signing material, bearer headers, credential form contents, database URLs, personal records and actual permission-map values.

1. `cash-access.ts:5–45`: independent grants and permission restrictions.
2. `cash-access.guard.ts:9–18`: verified session and mandatory permission metadata.
3. `cash-auth.controller.ts:20–34`: active login throttling and protected session routes.
4. `cash-auth.service.ts:19–60,69–91`: fail-closed configuration, password verification and session checks; hide signing values in debugger/environment panes.
5. `cash-collections.controller.ts:35–133`: guards and every route permission.
6. `cash-collections.service.ts:31–84`: FK ownership and conditional finalization.
7. Same service:108–141: deactivation/history preservation and credential-free creation.
8. `staff-response.dto.ts`: safe selections and explicit output fields.
9. Employees list/controller and Admin overview/controller: requester-aware HR access.
10. `auth/jwt.strategy.ts:18–22`: active-account, cash-only and current-role enforcement.
11. `cash/src/api/cashApi.ts:374–413`: separate token storage/headers and server restoration.
12. `cash/src/App.tsx:283–356`: no client credential comparisons and confirmed deactivation.
13. Test terminal output for the 24, 7, 34 and 57 passing tests and both passing type checks.
14. Later staging-only screenshot of anonymous/OS-only cash denial and granted-operator success with dummy data.
15. Later approved migration/reconciliation checklist, without exporting credentials into evidence.

Official ANTIC control identifiers remain PENDING SOURCE DOCUMENT REVIEW. These screenshots support provisional access management, application security, data protection, change control and verification areas; they do not establish compliance.

## H. Deployment readiness

**NOT READY FOR PRODUCTION DEPLOYMENT.**

Breaking/intentional compatibility changes:

- All cash data/administration routes require a cash session and explicit grant. Existing OS bearer tokens alone are rejected.
- Legacy plaintext/PIN accounts and bypass PINs no longer authenticate; no silent production migration occurs.
- Collector creation is administrator-only, has a 12-character minimum/72-byte maximum and requires separate access approval.
- Terminal matching is exact; short suffix matching is removed. New terminal IDs are server-generated.
- Legacy description-only assignments are not trusted. Reviewed collector-FK reconciliation is required before operators rely on their migrated history.
- Individual DELETE deactivates dedicated cash accounts and retains history; shared/legacy accounts require migration review. Bulk DELETE is disabled.
- Operators create pending records; terminal records cannot be reopened through status updates.
- Receipts derive their content/recipient server-side; arbitrary recipient/PDF submission and fallback dispatch are removed.
- Staff directories omit private HR fields. Admin overview requires CEO/Manager. JSON responsibilities metadata is suppressed.
- Cash-only users cannot use the OS login, refresh or JWT strategy. Existing dual-purpose identities must be classified explicitly.

No new tables/columns or Prisma generation are required by Batch 1. Existing runtime boot DDL was not changed and remains a later deployment risk. Existing account credential cleanup, cash-only classification, session revocation and grant provisioning are data/configuration migrations requiring approval: [migration plan](./migration-and-rollback.md).

Production gates: review the source; approve account classification/grants; approve credential handling and local-cache migration; verify schema compatibility/privileges; provision an isolated staging database; pass real persistence/concurrency/browser/public-client tests; address remaining critical/high findings; rehearse rollback; then obtain explicit deployment approval. No push/deploy approval is implied by this report.

## I. Remaining risk register

| Risk | Severity / status | Required next step |
|---|---|---|
| Existing plaintext credentials/metadata and browser caches | Critical exposure history; cleanup not performed | Approved reset/removal/session revocation and incident assessment; never export credential values into reports |
| OS manager role escalation and incomplete module permissions | High, still open | Batch 2 hierarchy/catalogue with role tests |
| OS signing defaults, refresh reuse and comprehensive session revocation | High, partly open | Batch 2; cash uses independent stronger session controls |
| Unauthenticated non-DM WebSockets | High, open | Batch 3 handshake/room/message/session controls |
| Public internal report data; outreach administration; unsigned webhooks; generic email dispatch | High/Medium, open | Batch 3 exact public/internal/partner boundaries and actual provider verification |
| Public KYC/general/legacy cash receipt files; upload safety | High, open | Private storage migration/quarantine and authorized retrieval; current inline cash receipt compatibility is retained, not certified secure |
| Financial float/transaction non-atomicity and repeated settlement | High, open outside cash status CAS | Separate financial workstream, database transactions/idempotency/reconciliation |
| Known Multer dependency and other dependency findings | High/conditional, open | Batch 5 reviewed upgrades; existing staged package files preserved |
| Actual PostgreSQL persistence/concurrency and email delivery | Not verified | Isolated DB/browser/provider fixtures, not production |
| In-memory throttling under replicas/proxy/NAT | Medium, deployment design unresolved | Shared rate-limit store, account limits and reviewed proxy identity in later batch; no trust of arbitrary forwarded headers added |
| Cash client directory shared among operators | Explicit policy needing organizational approval | Confirm business need or add approved assignment data model |
| Browser-readable cash/OS tokens, offline logout delivery failure | Residual session risk | XSS/browser hardening; max cash lifetime 15 minutes; consider BFF. Server revocation needs a successful request |
| Mutable audit storage and unspecified retention | Medium, open | Access/retention/integrity controls and monitoring |
| Metadata-based dedicated-account marker | Transitional design | Protect employee administration; prefer explicit application-membership schema in a reviewed migration |
| Cloud settings, origin bypass, backups and release protections | Not verified / proposed only | Setup guide, dashboard evidence and staging negative tests |

No finding is marked production-remediated solely because local tests pass.
