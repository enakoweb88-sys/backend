# Cash security cutover — approval required

This is a procedure for review, not an executed migration. Do not run against production or rotate/delete/move data without separate approval. Keep OS, cash, public KYC and public/customer boundaries distinct.

## Before scheduling a cutover

1. Approve an owner and maintenance/recovery window. Identify two independent cash administrators and their recovery process; do not infer authority from CEO/Manager role.
2. Inventory account IDs and credential format COUNTS in an approved secure environment. Do not print/hash-dump plaintext values, password hashes, tokens or raw responsibilities into tickets, chat or audit documents.
3. Classify accounts: dedicated cash identity, legitimate dual-purpose OS/cash identity, or unrelated OS user. Shared identities must not receive the cash-only marker. Confirm cases such as an accountant who also collects cash individually.
4. Approve each account's operator/administrator grant and the shared cash-client-directory policy. Newly created accounts are not automatically granted access.
5. Securely back up affected data and verify restoration using the organization's approved protected storage. Retain ledger/history and reconciliation baselines. Backups containing legacy credentials require strict access and expiry.
6. Inventory browser-only unsynced collections, drafts and financial caches per device. Export/reconcile them through an approved secure process before cutover. The new frontend does not import shared legacy caches automatically; it removes legacy credential/profile caches and stops trusting offline profiles for authentication.

## Proposed account migration

1. In an isolated staging clone containing only approved anonymized/disposable data, rehearse the changes first.
2. Reset exposed/plaintext/placeholder collector credentials through an approved channel. Hash new credentials with the reviewed bcrypt configuration; minimum 12 characters and maximum 72 UTF-8 bytes. Do not email passwords in reports or persist them in metadata.
3. Remove legacy plaintext credential properties from responsibilities/other stores without changing terminal, identity or ledger references. Record only redacted counts/IDs in protected operational logs.
4. Apply the server-managed cash-only marker ONLY to reviewed dedicated accounts. Do not relabel existing shared OS executives/accountants without an identity decision. Existing shared accounts retain their OS lifecycle and need an independent cash grant.
5. Revoke all pre-cutover sessions/refresh records for affected accounts and set passwordChangedAt consistently. Existing OS refresh rotation remains a separate remediation gate; do not assume cash hardening fixes it.
6. Provision a distinct backend CASH_JWT_SECRET through the approved secret store and CASH_ACCESS_GRANTS through approved server configuration. No values belong in React, Git, documentation or screenshot evidence. A provisioned grant map without a valid distinct signing key fails startup.
7. Deploy compatible backend/frontend versions only after explicit approval. Validate the expected schema already contains RefreshToken device/tokenHash/revokedAt/expiry, CashCollection collector FK and AuditLog fields. This batch supplies no automatic production schema migration.
8. Reconcile record counts, balances and collector references before enabling staff access. Legacy administration could store an executive/fallback user in the collector FK while naming a different assignee in description JSON. Resolve those assignments against authoritative business records and approved account IDs; never blindly grant ownership from JSON, names or terminal suffixes. Review/backfill FKs only with explicit data-change approval. No collection history is deleted. Compare independent reads to writes in staging and record idempotency/concurrency results.
9. Have each user log in through the server; verify exact terminal/email/phone matching, correct grant and fresh password. Check public KYC/customer paths remain available and shared OS sessions retain intended permissions.
10. Review security events and support issues during a monitored rollout. Delete protected migration exports only under the approved retention procedure.

## Rollback

- First disable cash admission by removing its approved grants in the hardened backend configuration, with explicit approval. Keep public KYC/customer access separate.
- Prefer rolling back the cash frontend while retaining the hardened backend and a cash maintenance/denial boundary. Older frontend authentication is incompatible and must not be re-enabled as a bypass.
- Do not restore plaintext credential metadata or bypass PINs. If credentials were exposed/reset, use another approved reset; reverting password material is not a safe rollback.
- Avoid deploying the old anonymous cash backend. If an emergency binary rollback is unavoidable, enforce an independently tested ingress denial for cash routes before restoring that binary; do not expose old routes publicly.
- Restore data only when an approved reconciliation/restore procedure establishes it is necessary. Deactivation retains ledger rows; undoing it requires approval and re-provisioning/re-authentication, not restoring deleted history.
- Preserve current worktree/index changes when reviewing local rollback. No reset, clean, stash, commit, push or destructive Git command is part of this procedure.

## Approval checklist

- [ ] Account classification and named cash grants approved.
- [ ] Password reset and legacy credential cleanup approved.
- [ ] Browser-only unsynced data reconciled.
- [ ] Backup and restore rehearsal evidenced.
- [ ] Isolated database integration/concurrency and browser tests passed.
- [ ] Existing public/customer/partner compatibility checked.
- [ ] Remaining high/critical findings resolved or explicitly treated.
- [ ] Emergency denial and rollback rehearsed.
- [ ] Push approval obtained separately, if requested.
- [ ] Deployment/configuration/data-change approval obtained separately.
