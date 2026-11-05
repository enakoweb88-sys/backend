# ENAKO backend production cutover plan

Prepared 2026-11-05. **PLAN ONLY — NOT CLEARED FOR EXECUTION.** The user confirmed production prerequisites are not prepared. No production queries, customer-record access, migrations, configuration updates, commits, pushes or deployments were performed while preparing this plan.

This plan covers the entire local backend release, including the health endpoint. It does not authorize changing production records, provisioning identities, changing hosting settings or publishing frontends. Those steps require review of the concrete staging results and migration/mapping artifacts first. Existing deployment authorization can be used once these prerequisites and the confirmed deployment target are ready; another generic approval to deploy code is unnecessary.

## 1. Release owners and required evidence

| Owner | Deliverable | Present state |
|---|---|---|
| Release operator | Connect Render and restore GitHub publishing access; record service, repository, production branch, live SHA and previous rollback SHA | Not available in this session; GitHub CLI token invalid |
| Database administrator | Schema-only inventory, existing migration history, backup/restore evidence, reviewed reconciliation SQL, restricted runtime account | Not prepared |
| Cash business owner | Explicit Cash identity, ownership and historical-record classification approvals | Not prepared |
| OS administrator | Company role/grant review and test accounts; independent from Cash | Not prepared |
| Infrastructure operator | Gateway, scanner, runtime database connection, mail and secret configuration evidence | Not prepared |
| QA/release operator | Staging rehearsal, compatibility matrix, reconciliation and rollback results | Local tests passed; staging not performed |

Store secret values, personal identities, record-level mappings and backups outside the repository in an access-controlled location. The templates accompanying this plan contain headers only. They are not authorization to access customer records. An authorized owner/DBA must provide the approved mappings; never infer ownership from matching emails, names or OS roles.

## 2. Confirm scope and isolate deployment automation

1. Record exact Render service ID, live deployment SHA, deployment branch, build/start commands, auto-deploy behavior and health-check path. Record the deployed OS, Cash, Client KYC and Outreach frontend versions separately. The current Render commit remains **UNVERIFIED**.
2. Do not push the integration branch while it can trigger production. Use an approved isolated staging service or an approved temporary deployment-automation hold, managed by the operator. Do not change those settings as part of preparing this document.
3. Freeze the candidate backend and frontend commit SHAs after review. Preserve unrelated local work. Record dependency findings and resolve release-blocking defects before sign-off; tests passing is not evidence that all security findings are resolved.
4. Rehearse with synthetic fixtures first. If a production-derived backup is needed, obtain separate access approval, restrict it to isolated staging, redact/minimize it as required, and prevent staging mail/payment calls from reaching real recipients/providers.

## 3. Resolve known code/migration blockers before rehearsal

| Blocker | Required correction and proof |
|---|---|
| `Donation` omitted from `20261105000300_private_api` table list | Subsequently corrected in the local publication candidate. Regression checks now cover anonymous/authenticated denial, runtime donation access and RLS on every fixture table. Production application remains pending the same reviewed migration cutover. The schema uses the case-sensitive, unmapped table name `Donation`; do not substitute `donations`. |
| Existing database is not a fresh baseline | Compare actual schema and `_prisma_migrations` with the baseline and incremental migrations. Prior runtime schema edits may create drift. Resolve conflicts in staging; do not blindly apply the baseline or mark it applied merely because tables exist. |
| Float-to-Decimal donation conversion | Check finite values, precision/range, rounding impact, currency totals, indexes and lock duration. Quantify and approve any change to stored values. Do not accept silent rounding or loss. |
| Independent Cash identity/ownership transition | Supply and test an explicit mapping. New Cash tables are initially empty; existing collections with null `cashUserId` are deliberately excluded from active access. |
| Frontend/backend contract changes | Verify each currently deployed frontend against the candidate backend. Coordinate compatible OS/Cash frontend versions, or implement and test an explicitly approved compatibility strategy. Never restore OS access to Cash as a compatibility shortcut. |
| Antivirus absent from current container recipe | Prove a supported loopback scanner deployment/startup/update arrangement. The current Dockerfile installs no ClamAV daemon. Setting a host variable alone will not make scanning work. Do not disable mandatory scanning to pass readiness. |
| Remaining audit findings/provider contracts | Track unresolved dependency advisories, historical credential rotation and unsupported Orange/PixiPay/public-account/newsletter integrations. Required unsupported workflows block release; do not present disabled integrations as functional. |

## 4. Rehearse the database transition in isolated staging

1. Verify a restorable backup and record its timestamp, checksum, retention, storage policy, estimated restore duration and business-approved recovery objectives. Include private document stores/files, not only PostgreSQL.
2. Obtain a schema-only inventory and migration history through the DBA. Review table/column/index/constraint differences against the exact release schema. Inventory every application that accesses this database directly before changing browser-role grants.
3. Create a privileged migration identity separate from runtime. Provision `enako_runtime` as a non-owner login without SUPERUSER, BYPASSRLS, CREATEDB, CREATEROLE or inherited equivalent privileges. Verify effective schema CREATE permissions, including grants inherited through PUBLIC or other roles. Do not revoke shared privileges blindly; preserve the legitimate access of other applications.
4. Reconcile baseline state. Only after exact compatibility is demonstrated may the DBA use Prisma's baseline-resolution workflow. If the deployed schema differs, prepare an explicit reconciled migration instead. No `db push`, reset, seed/demo population or destructive convenience operation belongs in this cutover.
5. Review and apply the security schema migration in staging. Retain legacy rows and references. Measure lock duration and abort conditions; establish migration/session lock and statement timeout policies for the reviewed operation, rather than assuming the script is harmless online.
6. Apply the corrected private-API migration with the runtime role already present. Verify intended table grants and policies, including `Donation` and the implicit department-leader join table. Policies named `enako_backend_access` must not collide with existing policies; rehearse existing-state behavior and transaction failure recovery. Do not rerun SQL by hand or edit applied migration checksums to conceal failure.
7. Prove the runtime identity passes the existing Prisma startup privilege checks. Prove browser roles cannot read private tables and intended public website content remains available through authorized public APIs. Keep OS/Cash business boundaries enforced by separate application credentials, permissions and tables.

Use the pinned repository Prisma CLI in a separately approved migration job. `prisma migrate status`, the appropriate baseline-resolution operation and `prisma migrate deploy` are execution steps only after schema reconciliation; this plan deliberately supplies no production connection strings or ready-to-run production SQL.

## 5. Prepare independent Cash accounts and history

1. The Cash owner supplies the identity/grant mapping template: approved new Cash identifier, explicit `operator` or `administrator` permission, and authorized approver. Provision fresh credentials through a secure onboarding process. Do not copy OS roles, sessions or password assumptions. Keep same-email accounts independent.
2. The Cash owner supplies the record mapping template for collections. Validate every mapped new Cash account exists; reject conflicts and ambiguous, missing or duplicate mappings. Keep legacy `collectorId` references solely for historical preservation. Update active ownership only through reviewed, scoped migration logic with before/after counts and rollback evidence.
3. Classify legacy FX records, balances, KYC and documents individually by application through authorized owners. Do not bulk copy shared OS tables into Cash or create new cross-application relationships. Do not delete or move OS records merely because Cash once displayed them.
4. Reconcile counts, monetary totals per currency, transaction status, ownership, document byte lengths and hashes. Record approved unresolved exceptions; missing access to business-critical history is a stop condition.
5. Set Cash grants against actual new Cash IDs and use independent signing/mail configuration. Verify Cash operator scope, administrator scope, deactivation/history preservation and password/session behavior without altering OS identity state.

## 6. Configure and validate staging infrastructure

| Area | Required staging proof |
|---|---|
| OS authentication | Distinct strong `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`; `JWT_ISSUER`, `JWT_AUDIENCE`; bounded TTLs; refresh reuse, logout and password/role revocation |
| Cash authentication | Distinct `CASH_JWT_SECRET`; explicit `CASH_ACCESS_GRANTS` using new Cash IDs; no OS role inheritance |
| Runtime/migrations | Runtime `DATABASE_URL` uses restricted role; privileged migration connection remains separate; migration credentials are not supplied to ordinary application queries |
| Gateway | `GATEWAY_ACCESS_MODE=required`, correct `CF_ACCESS_TEAM_DOMAIN`, distinct valid `CF_ACCESS_OS_AUDIENCE` and `CF_ACCESS_CASH_AUDIENCE`; real issuer/signature/audience/expiry tests |
| Network limits | Approved `CORS_ORIGIN` and `TRUSTED_PROXY_CIDRS`; strong `RATE_LIMIT_HASH_SECRET`; real shared-office tracker and direct-origin behavior |
| Scanner/files | Loopback `FILE_SCANNER_HOST` / `FILE_SCANNER_PORT`, clean/infected/outage tests, protected uploads and authenticated downloads; no public legacy-file migration without inventory/approval |
| Mail | Separate OS and Cash configuration; test recipients only in staging; CEO notification contact remains separate from login email |
| Monitoring | Anonymous `GET /api/v1/health` returns exactly 200/ok when ready and 503/unavailable during a dependency failure; no cached success or sensitive error data |

Verify upstream Cloudflare policy lets the intended monitor reach this health path without opening protected application routes. A NestJS public decorator does not override an upstream Access policy. No new production configuration is applied by this plan.

## 7. Staging acceptance and rollback rehearsal

- Run `npm ci --ignore-scripts`, Prisma client generation and `npm run verify` in a clean, isolated build environment; validate the actual Linux/container artifact as well as the local Windows build. Keep the reviewed lockfile.
- Confirm real restricted-role startup and database-backed health. Exercise dependency interruption in staging and recovery; health success alone does not verify schema readiness, Cash mapping, gateway policy, scanner or mail delivery.
- Test an OS employee, manager, CEO, Cash operator and Cash administrator separately. Cross-application tokens, matching emails and record IDs must not grant access. Include unrelated-user private file/report denial.
- Exercise task delivery/privacy, report upload/review/private feedback, duplicate meals, expense review, financial concurrency/replay, and provider sandbox confirmation using approved test identities. Verify all required frontend combinations; synthetic browser fixture tests alone do not prove deployed contract compatibility.
- Confirm record reconciliation, notification delivery and document retrieval after restart. Validate public KYC/Outreach paths independently from protected OS/Cash routes.
- Rehearse rollback to recorded code/config versions while writes remain frozen. Test backup restore in staging and define how acknowledged post-cutover writes would be reconciled. Do not assume a code rollback alone reverses identity, RLS, precision or ownership changes.

## 8. Proposed production window — only after approval of completed evidence

1. Obtain sign-off on exact candidate SHAs, migration/mapping artifacts, backups, write-freeze procedure, compatible frontend deployment sequence, observation period and rollback decision owner. Confirm required GitHub/Render access works.
2. Begin the approved maintenance/write-freeze window across both applications and public payment/application entry points as appropriate. Handle in-flight transactions, delayed callbacks and retry queues explicitly; do not lose or silently settle them. Record the final checkpoint.
3. Take/verify the approved backup, perform the reviewed database/role/ownership transition, apply approved runtime/gateway/scanner configuration, then deploy the candidate backend to the confirmed Render service/branch. Coordinate approved compatible frontend releases. Observe Render's reported successful live commit; a push or a healthy old instance is not deployment evidence.
4. Verify both `https://api.enakoos.com/api/v1/health` and the intended direct-origin behavior, then perform approved synthetic smoke tests for OS and Cash separately. Check startup logs without exposing secrets. Compare post-migration reconciliation evidence to the checkpoint.
5. Reopen writes only after the release owner signs off. Observe health, 5xx responses, authentication failures, financial reconciliation, scanner failures and queued notifications during the approved observation period. Final report must record actual deployed SHAs, timestamps, tests and any exceptions.

## 9. Stop and rollback rules

Stop before publishing if any prerequisite or mapping is unknown, the baseline differs unexpectedly, conversion changes are unapproved, a required workflow is unsupported, or the candidate cannot pass clean-build and staging gates.

During the write freeze, stop on startup failure, unhealthy database/health endpoint, missing history, incorrect ownership/totals, unauthorized access, or broken required frontend integrations. Keep writes frozen. The release owner chooses the rehearsed rollback: restore compatible code/config and, if necessary, the approved coordinated data restore. Retain failed deployment/migration evidence; do not drop new tables, rewrite migration history or erase audit records as an improvised rollback.

After writes reopen, a restore can discard acknowledged business activity. Freeze again and escalate to the release/DB owners for the approved reconciliation or forward-repair process before any restore. Never automatically restore production or replay financial mutations.

## Review package and next decision

See [cash-identity-mapping.template.csv](cash-identity-mapping.template.csv), [cash-record-mapping.template.csv](cash-record-mapping.template.csv), [application-boundaries.md](application-boundaries.md), and [security-control-status.md](security-control-status.md).

Next: review this plan and authorize the specific staging preparation and migration/mapping work. Production cutover remains blocked. This document does not claim that a production backup, account inventory, migration, configuration change or deployment has happened.
