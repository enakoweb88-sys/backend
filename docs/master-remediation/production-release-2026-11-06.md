# Backend production publication and database cutover — 2026-11-06

This is the current execution record. Earlier preflight/cutover documents describe the state before the user authorized database backups, migration execution and production publication. The owner retained responsibility for Render deployment and Cash ownership assignments.

Publication preparation continued on 2026-11-07 (Africa/Douala).

## Database work actually completed

- Created an AES-256-GCM encrypted, consistent PostgreSQL database archive, protected by Windows DPAPI for the current Windows account. Its directory permits the current account and SYSTEM, and is excluded from Git and Docker build context.
- Authenticated/decrypted the archive, restored the application/public data and actual auth-schema dependencies in protected, disposable loopback PostgreSQL, and verified all 65 application table counts.
- Rehearsed the reviewed schema/RLS changes and canonical migration-history recording against that restored data. Anonymous donation access was denied and the restricted role could query the required schema.
- Retained a second, post-cutover encrypted full database snapshot using certificate-verified TLS. Its isolated auth/public restore passed all 77 public table counts and verified the three completed migration-history entries. Both snapshots remain local and private; no plaintext restore archive was left after validation.
- Reconciled the baseline's `OutreachEventStatus` order to match the existing database. No live enum was rebuilt or reordered.
- Applied the reviewed changes to the locally configured database in a bounded transaction with schema-drift checks, short lock timeout, and before/after original-record digests across all 65 application tables. No existing ownership mapping or original record content was changed. The first attempt rolled back completely when provider role-switch permission prevented verification; the successful attempt temporarily enabled only the creator's SET permission for verification and disabled it before commit.
- Created the non-owner, non-superuser `enako_runtime` role without DDL, role-management or RLS-bypass privileges. Real login, Prisma startup privilege validation and SELECT checks passed.
- Recorded the verified existing baseline and the two applied migrations with canonical LF-normalized SHA-256 checksums. The Prisma CLI's connection attempt timed out, so the rehearsed SQL was executed through the PostgreSQL driver with canonical Prisma history recorded in the same transaction. A subsequent independent, read-only history check verified all three checksums and completion states. No reset, seed, ownership remapping or drop/recreate of application tables was performed.

The inspected connection is the configured database the user authorized us to prepare; Render's runtime binding and live deployed SHA remain owner-managed and unverified from this session.

## Database transport

Validation found that the legacy local connection configuration did not require TLS. The backup export used encrypted transport; the final snapshot uses certificate-verified transport. The new backend enforces TLS and strict server certificate verification for Supabase using its official public CA. The newly created runtime password was rotated again over verified TLS before handoff, and the previous runtime password was verified rejected. No database passwords, signing keys or raw customer records are included in this report or Git.

## Migration history

| Migration | Recorded checksum | State |
|---|---|---|
| `20261105000100_baseline` | `09b6e593194f683a4709eda2ec86c1f38c364e5ffd2ae1f4689b4a81e39d4525` | Verified existing baseline; recorded applied |
| `20261105000200_security` | `44f4b86e5439040c81ce200ec8e9678ad1e0517bca9de1a26efa0af905fe92e6` | Applied and verified |
| `20261105000300_private_api` | `106d6ba828ad16f38d89ff0463fcf21957ec599a61a19d3655088d384315c8c8` | Applied and verified, including `Donation` |

Do not reapply the baseline SQL to this database. Future privileged migration jobs must use the matching release files/history. The ordinary backend starts without migration or schema-repair privileges.

## Owner's Render steps

1. Use the private local `copy-render-settings.cmd` handoff, then import those values into Render's environment settings. It copies secrets to the local clipboard without printing them in chat or putting them in Git. Clear the clipboard after import. The runtime database credential is distinct from the retained administrative migration connection.
2. Supply these real Cloudflare settings, which were absent from local configuration: `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_OS_AUDIENCE`, `CF_ACCESS_CASH_AUDIENCE`. The audiences must identify separate OS and Cash Access applications. They cannot be invented or replaced with random strings. Production startup intentionally fails closed without valid configuration.
3. Cash account/grant provisioning and legacy ownership mapping remain with the owner, as explicitly requested. `CASH_ACCESS_GRANTS={}` grants nobody Cash access. Existing history is retained; unmapped records are not exposed through broad access or automatic OS membership.
4. Use the Docker runtime for the bundled scanner, allocate appropriate memory, then enable `FILE_SCANNER_EMBEDDED=true`. The default is false; without another working loopback scanner, document uploads will return 503. Initial signature download may take time. This release does not change hosting plans or purchase resources.
5. Deploy the reviewed backend production commit after CI passes. The commit uses `[skip render]` because the owner explicitly chose to handle the Render deployment/configuration; publishing to `main` is not proof of a live deployment. Configure the monitor path `/api/v1/health`, verify 200/ok when PostgreSQL is ready, then share the deployment logs without environment values or secrets.
6. Coordinate compatible frontend versions before declaring all workflows verified. This backend publication does not silently publish other repositories. Verify login, private files, report review and independent Cash access through the actual gateways after deployment.

## Backup/recovery limits

The backups are recovery snapshots, not permission to overwrite subsequent acknowledged transactions. A rollback/restore must account for writes after the snapshot and should first be tested on an empty replacement target. Global role passwords and external Supabase Storage object bytes are not part of `pg_dump`; the protected runtime/admin configuration is kept separately. Full managed-platform recovery requires the appropriate Supabase roles/extensions and any external object backups. The local restore verified the application data/schema and their auth dependencies, not every managed platform component.

DPAPI recovery requires this Windows account/profile. The private recovery helper can export a portable archive key for the owner to store separately in a password manager/offline location; it is not printed in chat or committed. Keep an off-machine encrypted copy if protection against loss of this computer is required.

## Verification and limits

Latest full local verification: TypeScript and production build passed; lint passed with 49 existing warnings and zero errors; 34 unit tests, 92 security checks, 16 disposable database checks and 10 full HTTP checks passed. Additional shell fixture checks verified disabled-scanner startup and signature-retry/daemon startup without running real services. Real strict-TLS runtime login, Prisma startup and migration-checksum checks passed against the configured database.

Docker build and scanner-binary smoke checks were added to GitHub CI. Local Docker execution remains unavailable, so a successful hosted container build must be checked separately before deployment. Actual Render startup, Cloudflare policies, antivirus definition availability, live mail/provider delivery and frontend compatibility remain deployment-time checks. Previously documented moderate/low dependency findings and historical credential rotation are not declared fixed by this publication.
