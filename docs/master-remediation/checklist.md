# Master remediation checklist

Date: 2026-11-05. Integration branch: security/master-integration-2026-11-05. Push is conditionally authorized after verification and will trigger production deployment. Production database/configuration changes remain unauthorized. FIXED requires implementation and relevant passing tests; database/hosting/provider assertions require separate evidence.

| ID | Finding | Status | Evidence / next step |
|---|---|---|---|
| ENK-001 | Main ENAKO OS login lacks backend throttling. | LOCAL_IMPLEMENTED | AuthSession, strict JWT policy, shared PostgreSQL throttling; 15 real-database and 10 HTTP integration checks passed |
| ENK-002 | Refresh-token endpoint lacks backend throttling. | LOCAL_IMPLEMENTED | AuthSession, strict JWT policy, shared PostgreSQL throttling; 15 real-database and 10 HTTP integration checks passed |
| ENK-003 | No globally enforced NestJS ThrottlerGuard. | LOCAL_IMPLEMENTED | AuthSession, strict JWT policy, shared PostgreSQL throttling; 15 real-database and 10 HTTP integration checks passed |
| ENK-004 | In-memory rate limiting does not support consistent enforcement across multiple instances. | LOCAL_IMPLEMENTED | AuthSession, strict JWT policy, shared PostgreSQL throttling; 15 real-database and 10 HTTP integration checks passed |
| ENK-005 | Client-IP identification behind Cloudflare and Render is not fully verified. | PARTIAL / PRODUCTION_UNVERIFIED | AuthSession, strict JWT policy, shared PostgreSQL throttling; 15 real-database and 10 HTTP integration checks passed; hosting, legacy records or provider prerequisites remain unverified |
| ENK-006 | JWT signing contains insecure fallback secrets. | LOCAL_IMPLEMENTED | AuthSession, strict JWT policy, shared PostgreSQL throttling; 15 real-database and 10 HTTP integration checks passed |
| ENK-007 | JWT issuer, audience and algorithm restrictions need review. | LOCAL_IMPLEMENTED | AuthSession, strict JWT policy, shared PostgreSQL throttling; 15 real-database and 10 HTTP integration checks passed |
| ENK-008 | Refresh-token rotation is incomplete. | LOCAL_IMPLEMENTED | AuthSession, strict JWT policy, shared PostgreSQL throttling; 15 real-database and 10 HTTP integration checks passed |
| ENK-009 | Logout does not reliably revoke issued access-token sessions. | LOCAL_IMPLEMENTED | AuthSession, strict JWT policy, shared PostgreSQL throttling; 15 real-database and 10 HTTP integration checks passed |
| ENK-010 | Password changes do not comprehensively revoke existing sessions. | LOCAL_IMPLEMENTED | AuthSession, strict JWT policy, shared PostgreSQL throttling; 15 real-database and 10 HTTP integration checks passed |
| ENK-011 | Missing rate limiting on sensitive password operations. | LOCAL_IMPLEMENTED | AuthSession, strict JWT policy, shared PostgreSQL throttling; 15 real-database and 10 HTTP integration checks passed |
| ENK-012 | Potentially inconsistent disabled-user and role validation between committed and local code. | LOCAL_IMPLEMENTED | AuthSession, strict JWT policy, shared PostgreSQL throttling; 15 real-database and 10 HTTP integration checks passed |
| ENK-013 | Cash Dashboard authentication changes are implemented locally but not committed. | UNCOMMITTED | Independent Cash identities/grants and manager privilege restrictions; security, Cash auth and cross-application HTTP tests passed; no commit or push performed |
| ENK-014 | Cash Dashboard frontend credential/PIN bypasses must be eliminated. | LOCAL_IMPLEMENTED | Independent Cash identities/grants and manager privilege restrictions; security, Cash auth and cross-application HTTP tests passed |
| ENK-015 | Dedicated cash-only accounts must not gain unintended OS access. | LOCAL_IMPLEMENTED | Independent Cash identities/grants and manager privilege restrictions; security, Cash auth and cross-application HTTP tests passed |
| ENK-016 | Managers may assign themselves or other users CEO privileges. | LOCAL_IMPLEMENTED | Independent Cash identities/grants and manager privilege restrictions; security, Cash auth and cross-application HTTP tests passed |
| ENK-017 | Outreach administrative endpoints lack authentication. | LOCAL_IMPLEMENTED | Server permissions, ownership and safe projections; authorization/security and real HTTP checks passed |
| ENK-018 | Some finance, analytics, digital, BD and dashboard routes rely only on JWT authentication. | LOCAL_IMPLEMENTED | Server permissions, ownership and safe projections; authorization/security and real HTTP checks passed |
| ENK-019 | Some meal dispute operations lack ownership verification. | LOCAL_IMPLEMENTED | Server permissions, ownership and safe projections; authorization/security and real HTTP checks passed |
| ENK-020 | Support reply operations lack ticket ownership checks. | LOCAL_IMPLEMENTED | Server permissions, ownership and safe projections; authorization/security and real HTTP checks passed |
| ENK-021 | Expense approval lacks adequate separation of duties. | LOCAL_IMPLEMENTED | Server permissions, ownership and safe projections; authorization/security and real HTTP checks passed |
| ENK-022 | Some administrative operations are insufficiently restricted. | LOCAL_IMPLEMENTED | Server permissions, ownership and safe projections; authorization/security and real HTTP checks passed |
| ENK-023 | Cash collection permissions and ownership controls exist only in uncommitted changes. | UNCOMMITTED | Server permissions, ownership and safe projections; authorization/security and real HTTP checks passed; no commit or push performed |
| ENK-024 | Sensitive employee and HR information needs consistent response filtering. | LOCAL_IMPLEMENTED | Server permissions, ownership and safe projections; authorization/security and real HTTP checks passed |
| ENK-025 | Role and permission checks must be enforced server-side, not only in frontend navigation. | LOCAL_IMPLEMENTED | Server permissions, ownership and safe projections; authorization/security and real HTTP checks passed |
| ENK-026 | KYC approval permissions require verification against the intended business policy. | LOCAL_IMPLEMENTED | Server permissions, ownership and safe projections; authorization/security and real HTTP checks passed |
| ENK-027 | Financial settlement operations are not consistently atomic. | LOCAL_IMPLEMENTED | Serializable ledgers, conditional balances, audit and replay protection; 15 real-database tests passed |
| ENK-028 | Repeated SETTLED transitions may apply duplicate balance changes. | LOCAL_IMPLEMENTED | Serializable ledgers, conditional balances, audit and replay protection; 15 real-database tests passed |
| ENK-029 | Payment callbacks may accept unverified payment status updates. | LOCAL_IMPLEMENTED | Serializable ledgers, conditional balances, audit and replay protection; 15 real-database tests passed |
| ENK-030 | Payment callbacks lack adequate replay protection. | LOCAL_IMPLEMENTED | Serializable ledgers, conditional balances, audit and replay protection; 15 real-database tests passed |
| ENK-031 | Financial state changes need idempotency controls. | LOCAL_IMPLEMENTED | Serializable ledgers, conditional balances, audit and replay protection; 15 real-database tests passed |
| ENK-032 | Float and transaction updates need consistent database transaction boundaries. | LOCAL_IMPLEMENTED | Serializable ledgers, conditional balances, audit and replay protection; 15 real-database tests passed |
| ENK-033 | Concurrent financial operations require testing. | LOCAL_IMPLEMENTED | Serializable ledgers, conditional balances, audit and replay protection; 15 real-database tests passed |
| ENK-034 | Financial records require reliable audit trails and reconciliation. | LOCAL_IMPLEMENTED | Serializable ledgers, conditional balances, audit and replay protection; 15 real-database tests passed |
| ENK-035 | Collector deactivation must preserve historical transactions. | LOCAL_IMPLEMENTED | Serializable ledgers, conditional balances, audit and replay protection; 15 real-database tests passed |
| ENK-036 | Bulk deletion of financial records must be prevented or strictly controlled. | LOCAL_IMPLEMENTED | Serializable ledgers, conditional balances, audit and replay protection; 15 real-database tests passed |
| ENK-037 | WebSocket connections lack adequate authentication. | LOCAL_IMPLEMENTED | Authenticated gateway and socket membership/revocation controls; 6 boundary and 4 chat regression checks passed |
| ENK-038 | Some sender identities are supplied by clients rather than derived from authenticated sessions. | LOCAL_IMPLEMENTED | Authenticated gateway and socket membership/revocation controls; 6 boundary and 4 chat regression checks passed |
| ENK-039 | Notification-room joins lack sufficient authorization. | LOCAL_IMPLEMENTED | Authenticated gateway and socket membership/revocation controls; 6 boundary and 4 chat regression checks passed |
| ENK-040 | Non-DM channel membership checks are incomplete. | LOCAL_IMPLEMENTED | Authenticated gateway and socket membership/revocation controls; 6 boundary and 4 chat regression checks passed |
| ENK-041 | WebSocket sessions need revocation and rate-limit protections. | LOCAL_IMPLEMENTED | Authenticated gateway and socket membership/revocation controls; 6 boundary and 4 chat regression checks passed |
| ENK-042 | Sensitive KYC files may be stored at publicly accessible paths. | PARTIAL / PRODUCTION_UNVERIFIED | Private database files, bounded content validation and mandatory scanner; boundary and real KYC HTTP checks passed; hosting, legacy records or provider prerequisites remain unverified |
| ENK-043 | Static `/uploads` paths may expose receipts and internal files. | LOCAL_IMPLEMENTED | Private database files, bounded content validation and mandatory scanner; boundary and real KYC HTTP checks passed |
| ENK-044 | File validation relies too heavily on client-supplied MIME types. | LOCAL_IMPLEMENTED | Private database files, bounded content validation and mandatory scanner; boundary and real KYC HTTP checks passed |
| ENK-045 | Multipart upload size and count limits are incomplete. | LOCAL_IMPLEMENTED | Private database files, bounded content validation and mandatory scanner; boundary and real KYC HTTP checks passed |
| ENK-046 | Upload filename and extension handling needs hardening. | LOCAL_IMPLEMENTED | Private database files, bounded content validation and mandatory scanner; boundary and real KYC HTTP checks passed |
| ENK-047 | Internal exception messages may be exposed in KYC responses. | LOCAL_IMPLEMENTED | Private database files, bounded content validation and mandatory scanner; boundary and real KYC HTTP checks passed |
| ENK-048 | Public report endpoints may expose internal financial or employee exports. | LOCAL_IMPLEMENTED | Private database files, bounded content validation and mandatory scanner; boundary and real KYC HTTP checks passed |
| ENK-049 | Sensitive webhook payloads may be logged. | LOCAL_IMPLEMENTED | Private database files, bounded content validation and mandatory scanner; boundary and real KYC HTTP checks passed |
| ENK-050 | Legacy public file links require a safe migration strategy. | PARTIAL / PRODUCTION_UNVERIFIED | Private database files, bounded content validation and mandatory scanner; boundary and real KYC HTTP checks passed; hosting, legacy records or provider prerequisites remain unverified |
| ENK-051 | Direct Render access bypasses Cloudflare-only protections. | PARTIAL / PRODUCTION_UNVERIFIED | Verified gateway assertions, explicit proxy/CORS and restricted runtime/RLS; local boundary and HTTP checks passed; hosting, legacy records or provider prerequisites remain unverified |
| ENK-052 | CORS configuration may reflect arbitrary origins while allowing credentials. | LOCAL_IMPLEMENTED | Verified gateway assertions, explicit proxy/CORS and restricted runtime/RLS; local boundary and HTTP checks passed |
| ENK-053 | Request body limits are overly broad. | LOCAL_IMPLEMENTED | Verified gateway assertions, explicit proxy/CORS and restricted runtime/RLS; local boundary and HTTP checks passed |
| ENK-054 | Backend gateway assertions are not verified. | PARTIAL / PRODUCTION_UNVERIFIED | Verified gateway assertions, explicit proxy/CORS and restricted runtime/RLS; local boundary and HTTP checks passed; hosting, legacy records or provider prerequisites remain unverified |
| ENK-055 | Runtime database schema changes may use excessive privileges. | PARTIAL / PRODUCTION_UNVERIFIED | Verified gateway assertions, explicit proxy/CORS and restricted runtime/RLS; local boundary and HTTP checks passed; hosting, legacy records or provider prerequisites remain unverified |
| ENK-056 | Database RLS and grants require review. | PARTIAL / PRODUCTION_UNVERIFIED | Verified gateway assertions, explicit proxy/CORS and restricted runtime/RLS; local boundary and HTTP checks passed; hosting, legacy records or provider prerequisites remain unverified |
| ENK-057 | Rate limiting must work without blocking legitimate shared-office traffic. | LOCAL_IMPLEMENTED | Verified gateway assertions, explicit proxy/CORS and restricted runtime/RLS; local boundary and HTTP checks passed |
| ENK-058 | Public KYC, Outreach and payment callbacks must remain functional. | PARTIAL / PRODUCTION_UNVERIFIED | Verified gateway assertions, explicit proxy/CORS and restricted runtime/RLS; local boundary and HTTP checks passed; hosting, legacy records or provider prerequisites remain unverified |
| ENK-059 | ESLint configuration is incompatible with the project's CommonJS setup. | LOCAL_IMPLEMENTED | CommonJS-compatible ESLint configuration; backend lint passes with warnings |
| ENK-060 | Existing TypeScript, build and dependency problems must be identified and resolved. | PARTIAL | All five applications build; compatible security patches applied; moderate/low dependency findings remain |
| ENK-061 | Multer dependency versions require security upgrades. | LOCAL_IMPLEMENTED | Multer 2.5.0 installed and bounded multipart handling verified |
| ENK-062 | Finance and administration modules contain hardcoded or fallback business figures. | PARTIAL | Backend finance/administration fake metrics removed; broader business-metric review remains open |
| ENK-063 | Mock data and silent frontend fallback data must not masquerade as real database records. | PARTIAL | Fabricated audit/website records and silent failure successes removed from reviewed paths; final fallback review remains open |
| ENK-064 | Frontend edits must persist through the backend into PostgreSQL. | PARTIAL | Real PostgreSQL task, objective, expense, meal, KYC and Cash persistence exercised; not every form covered |
| ENK-065 | Goals and tasks requests, including HTTP 304 behavior, require correct cache and response handling. | LOCAL_IMPLEMENTED | No-store API requests and task/goal HTTP persistence/privacy checks pass |
| ENK-066 | API authentication, refresh, error handling and session persistence must be consistent across applications. | PARTIAL | OS refresh and independent Cash auth tested; public Outreach account contract explicitly unavailable |
| ENK-067 | CI/CD lacks fully verified security and release gates. | PARTIAL | Five verification workflows parsed; hosted CI and production deployment binding remain unverified |
| ENK-068 | Existing tests do not cover all important authorization and financial operations. | PARTIAL | 22 unit, 92 security, 16 database and 10 HTTP checks plus frontend/browser regressions; full coverage not claimed |

## Phase progress

- A: Inventory recorded; existing work preserved on dedicated branches. Additional independent Finance/Moneyflow repositories have extensive pre-existing edits and must not be blindly folded into the shared-backend release.
- B?H: Implementations and local verification substantially progressed; incomplete controls and deployment prerequisites remain blocked. See verification-snapshot.md.

## Release gates

- No commits/push until mandatory verification and sensitive-file review pass.
- A push triggers production deployment; do not push until all release prerequisites pass. No production DNS/configuration/database changes or merge performed.
- Provider contracts, hosting automation and GitHub access must be evidenced; unavailable dependencies are blockers, never silently bypassed.

## Additional findings discovered during implementation

- ENK-069: Existing OS/Cash shared identities, ledgers, KYC and mail dependencies violate the clarified architecture. Active local code separated and tested; legacy ownership migration and provisioning remain BLOCKED.
- ENK-070: Historical source credentials and browser-side AI key exposure. Local fallbacks/browser keys removed; full-history scan and credential rotation remain UNVERIFIED.
- ENK-071: Browser-generated security audit entries and false hash assurances. Replaced with permission-protected saved company audit events; HTTP permissions/projection tests pass.
- ENK-072: Newsletter/account/image-generation failure paths claimed success or used unsupported contracts. Honest unavailable/error paths implemented; actual missing provider/public-account contracts remain BLOCKED.
- ENK-073: Avatar uploads trusted image metadata and swallowed storage errors. Bounded byte validation, mandatory scan and visible provider failures added; seven boundary tests pass.
