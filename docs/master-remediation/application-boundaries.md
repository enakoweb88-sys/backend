# Architecture correction: independent applications

ENAKO OS is company management. Cash Dashboard records the owner's personal and other business activities. Sharing a deployment, database server or technical utility does not authorize sharing business data.

## Dependencies discovered and reported before correction

| Existing dependency | Local correction | Existing records |
|---|---|---|
| Cash frontend performed a second OS login and used company CEO/manager roles | Cash login only; explicit Cash operator/administrator grants | No credential or account migration executed |
| Cash collectors and sessions used OS User/RefreshToken | Independent CashUser/CashSession models and APIs | Legacy OS references retained for an approval-held migration |
| Cash FX called company transactions and float APIs | CashTransaction/CashFloatAccount/CashExchangeRate and Cash-authenticated routes | Old transactions must be classified by an authorized owner; never automatically copied |
| Cash KYC read company KYC and generated clients from it | Independent CashKycSubmission and CashDocument stores | No existing KYC documents copied, moved or deleted |
| Cash receipts used company contacts, templates and audit logs | Cash-only mail configuration, CashAuditLog and document authorization | Existing mail configuration untouched |
| Company OS displayed Cash records and linked the personal Cash workspace | Remove Cash API exports and data widgets from OS | Company cash-position accounting remains an OS-only function |
| During remediation, a collection-to-company-transaction relationship was introduced | Relationship, mirrored writes and cancellation coupling removed before any commit/deployment | Never deployed; no production records affected |

## Boundary contract

- OS bearer credentials cannot authenticate Cash routes; Cash bearer credentials cannot authenticate OS routes.
- Matching email addresses identify separate accounts. Password changes, roles and session revocations stay within their application.
- Cash permissions depend solely on explicit Cash grants. Company roles are never consulted for Cash authorization.
- Cash collections do not create, settle or cancel company transactions. Cash financial writes use only Cash ledger and float tables.
- Cash documents and KYC never use company private-file, employee, report or KYC stores.
- Shared utilities may validate input, scan bytes, verify gateway signatures or transport HTTP. They do not join business records.

## Approval-held legacy transition

The new schema is intentionally not a production data migration. Existing cash_collections.collectorId and its old user relationship are retained solely to preserve historical rows. Active Cash ownership uses cashUserId, referencing CashUser. Unmapped legacy rows are not exposed through broad administrator queries.

Before deployment, an authorized owner must approve an explicit inventory and mapping of legacy Cash identities, collection ownership, FX records, KYC, documents and outstanding sessions. Provision new Cash identities and grants separately; do not copy OS permissions or assume shared passwords. Validate row counts, monetary totals, ownership and document hashes in isolated staging, prepare rollback, and obtain separate production migration approval. Until then, deployment readiness is BLOCKED. No production SQL, customer-record access or migration has been performed.

Security integration branches must pass cross-application token, same-email identity, independent-session, file, KYC and financial-write regression tests before commit/push. Historical audit documents describing shared accounts are superseded by this contract.
