# GitHub publication and production release are separate

The user requested publishing all backend changes. This integration branch is prepared for GitHub publication with `[skip render]` in its commit message. Render documents this marker as suppressing the normal automatic deployment for that commit: https://render.com/docs/deploys#skipping-an-auto-deploy . The verification workflow contains no deployment jobs. A manual or custom deployment process must not be treated as verified or controlled by this marker.

Publication includes the independent OS/Cash security implementation, private documents, financial integrity changes, migrations, tests, health endpoint, CI and cutover documentation. The omitted case-sensitive `Donation` table was added to the private-API migration, with fixture checks for RLS and role access. No production migration, identity mapping, configuration change or customer-record access is performed by publication.

**This branch is not production-ready.** The user confirmed prerequisite preparation is incomplete. Follow [production-cutover-plan.md](production-cutover-plan.md); do not manually deploy the candidate just because it is available on GitHub. Deployed Render SHA remains unverified, and the application requires coordinated database/account/configuration and frontend preparation.

Preflight and earlier audit documents record the state before this publication request, including their then-uncommitted status and original HEADs. Use the actual Git commit and remote branch references for publication evidence. Do not confuse the original baseline SHA, a passing local test, or a push result with production deployment evidence.

The production branch is not merged or changed by this integration-branch publication. Frontend and unrelated repositories are outside this backend-only publication request and remain untouched.
