# Configured database schema comparison — 2026-11-06

Historical pre-cutover snapshot. Subsequent owner-authorized migration and verification results are recorded in [production-release-2026-11-06.md](production-release-2026-11-06.md).

**Production database identity remains UNVERIFIED.** The locally configured connection works, but Render's service/database binding has not been inspected. These findings apply to that configured database only.

## Read-only evidence

The configured database was inspected using PostgreSQL metadata queries inside an explicit `BEGIN READ ONLY` transaction, with read-only mode verified and the transaction rolled back after inspection. No application/customer rows were queried and no remote schema/data changes were applied. The committed baseline was reconstructed separately in disposable, verified loopback PostgreSQL for comparison.

- All 65 baseline application tables exist.
- No baseline columns are missing and no additional application columns were found.
- Column types, nullability, defaults and numeric precision/scale match the baseline.
- Baseline constraint and index definitions match.
- The sole enum difference is label order for `OutreachEventStatus`: baseline `DRAFT, OPEN, SCHEDULED, CLOSED`; configured database `DRAFT, OPEN, CLOSED, SCHEDULED`. Labels are identical as a set. Enum ordering can affect SQL comparisons and sorting; do not rebuild/reorder the production enum merely to match an assumed baseline.
- There is no `public._prisma_migrations` table.
- Eleven required new security/Cash tables are absent, as listed in the cutover plan's schema transition.
- The inspected connection does not use the required `enako_runtime` role and has privileges that do not satisfy the application's runtime checks. This may be an administrative connection; it does not establish which account Render actually uses.

Prisma migration-status attempts did not produce a conclusive classified result, so they are not reported as a successful migration-history verification. The separate metadata checks establish the findings above. The shared database is not inferred to be the live Render target from local configuration alone.

## Concrete preparation and remaining release gates

1. Verify the intended Render service, current live SHA, runtime database target and migration target. Record credentials securely outside Git/chat; only confirmation of matching targets belongs in the release report.
2. Reconcile the baseline's enum order with the verified existing database representation and validate the final baseline/migration plan in staging. Preserve the existing enum's production semantics. Do not mark the baseline applied until the reviewed schema comparison and staging rehearsal establish that doing so represents reality.
3. Verify a restorable backup and an approved cutover/write-freeze window. Keep privileged migration credentials separate from the restricted runtime identity.
4. Rehearse the reviewed incremental schema/RLS/grant changes against the reconciled baseline. Missing tables are implementation work, not a request for the user to write SQL. Runtime-role/grant provisioning must account for effective inherited privileges and other applications sharing infrastructure.
5. Obtain owner-approved Cash identity, ownership and historical classification inputs. Do not derive them from OS roles or matching emails. No record-level mapping or customer-record inventory was performed in this check.
6. Verify gateway/scanner configuration and compatible deployed frontend versions before production rollout. The health check only verifies basic database connectivity, not these release prerequisites.

The implementation/rehearsal work can continue locally. Production writes and deployment remain dependent on the verified target, backup/cutover evidence, approved mapping and platform access described in [production-cutover-plan.md](production-cutover-plan.md).
