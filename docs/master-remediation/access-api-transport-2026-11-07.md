# Access-protected browser API transport — 2026-11-07

## Owner's release decision

The owner retained Render Free and explicitly deferred scanner hosting. Keep
`FILE_SCANNER_EMBEDDED=false`; uploads remain fail-closed with 503 until a working
scanner is provisioned. Do not bypass scanning to make uploads appear functional.
The owner reports the separate OS API/chat and Cash API Worker routes installed,
with workers.dev/preview URLs disabled. Live authenticated verification remains
pending. Render's dashboard reports older commit `211668e` live; the production
publication prepared locally is a separate release, not proof of live deployment.

## Problem and decision

The OS and Cash websites called the shared API hostname directly. Their Access
cookies belong to their website hostnames. Merely enabling credentialed CORS does
not establish an API Access session, and Cash crosses registrable domains, where
third-party cookie restrictions can prevent the session working entirely.

Each website now uses its own same-origin API path. Two separate Cloudflare
Workers forward requests through the existing, separate website Access
applications to the fixed Render origin. This is infrastructure transport only:
no business modules, accounts, grants, records, database relationships or
workflows are merged. Backend HTTP and WebSocket authentication still verify the
Access JWT signature, issuer, expiry, application audience and account identity.
Application bearer authentication and permission checks remain mandatory.

## Implementation

- OS production browser API: `https://enakoos.com/api/v1`; chat uses
  `https://enakoos.com/socket.io/`. Refresh, legacy login, session-end beacon,
  reports and file retrieval use the same API configuration.
- Cash production browser API: `https://enakootc.com/api/v1`. All Cash requests,
  including login, logout, uploads and document retrieval, use same-origin
  credentials and no-store caching. Neither client copies Access cookies into JS.
- The canonical production hostnames override a legacy cross-origin
  `VITE_API_URL`. Explicit development/preview configuration is preserved on other
  hostnames; previews are not automatically granted production Access.
- Separate deployable Worker modules and route configurations are at
  `enako-os/edge/` and `cash/edge/` in their respective repositories. Both use the
  confirmed backend origin `https://backend-iw61.onrender.com`. If that service
  changes, review and update this fixed destination before publishing.
- Workers require Cloudflare-authenticated invocation context and the signed
  assertion. A caller-supplied assertion alone is insufficient at the proxy.
  NestJS remains the cryptographic verifier for every protected upstream handler.
- OS rejects Cash paths; Cash accepts only its four existing Cash API modules and
  rejects OS and chat paths. CSRF origin checks, fixed upstream, redirect denial,
  streaming bodies, private/no-store responses and removal of website cookies,
  service credentials and host/IP overrides prevent proxy credential leakage.
- Backend CORS credentials remain disabled: browser cookies go only to their
  own website's Cloudflare edge. No database/backend functional changes are needed
  for this transport. Existing signed-assertion guards are required in deployment.

## Cloudflare deployment configuration (not executed locally)

Keep the existing OS and Cash Access applications and distinct audiences. Do not
replace their allowlists with a shared company-role policy. Do not attach Bypass
to either API proxy, and do not add an interactive login policy across the shared
API hostname: it hosts deliberately public submission and callback routes too.

Create two ordinary Workers, without static assets, databases or custom domains:

| Worker | Source in its repository | Route patterns |
|---|---|---|
| `enako-os-api-proxy` | `edge/access-proxy.mjs` | `https://enakoos.com/api/v1/*`, `https://enakoos.com/socket.io/*` |
| `enako-cash-api-proxy` | `edge/access-proxy.mjs` | `https://enakootc.com/api/v1/*` |

Use **Routes**, not a new Custom Domain replacing the website origin. The
existing DNS must remain proxied. Both Workers must be behind their website's
Access application on these exact hostnames. Disable workers.dev and preview
URLs, as in each checked-in `edge/wrangler.jsonc`. No Worker secret or database
binding is needed. Do not enable sensitive request/response payload logging.

For dashboard editing, each `edge/copy-worker-code.cmd` copies that application's
complete, self-contained module to the Windows clipboard. Paste it over the
Worker editor's example code. The helper copies public source code only; it does
not publish anything, copy credentials or change the account configuration.

The narrowly scoped existing health exception remains
`api.enakoos.com/api/v1/health` with Bypass/Everyone. External KYC/Outreach public
submissions and callbacks continue using their existing public API endpoints and
backend protections; they are not routed through employee-only website proxies.

## Release order and validation

1. Run `npm run test:access`, lint and build in both frontend repositories.
   Backend security checks must confirm signed-assertion rejection and independent
   OS/Cash audiences. These checks use fixtures, not customer records.
2. Publish both Worker sources and their narrow routes first. Existing frontend
   versions use the old API configuration until updated; installing the new proxy
   paths does not make old browsers automatically use them.
3. With all runtime prerequisites prepared, coordinate the reviewed backend and
   compatible frontend releases. Do not deploy the required-gateway backend while
   continuing to serve incompatible old frontends. Cash account provisioning and
   file scanning remain separate release prerequisites from the earlier notes.
4. Test real Access authentication on each website, then OS login/refresh/logout,
   chat upgrade, PDF upload/view/download, Cash login and permitted Cash document
   retrieval. Browser requests must remain on the originating website hostname.
   Confirm missing, expired, forged and opposite-app assertions are rejected by
   protected backend routes, including direct Render-origin requests. An approved
   website email still needs an independent application account and permission.
5. Confirm health returns minimal 200/503 without an Access challenge, then verify
   public submission/callback routes retain their application-level validation.

Local proxy tests mock authenticated Cloudflare context and upstream transport.
They exercise headers, upload/document bytes, cross-app and origin denial,
redirect/error handling, statuses and WebSocket upgrade forwarding; they do not
prove Cloudflare policy evaluation or a real deployed WebSocket handshake. Those
remain explicit live validation steps. No production deployment, DNS change,
record access or configuration mutation was performed by this local fix.

Local verification completed:
- Both frontend TypeScript/lint commands and Vite production builds passed.
- OS: 10 proxy tests and 5 session/configuration regression groups passed;
  the existing build also passed 8 finance/workspace tests and UI render checks.
- Cash: 10 proxy tests and 12 authentication/document regression tests passed.
- Backend `npm run test:security` passed, including RSA assertion validation,
  independent OS/Cash audiences, file scanning, private reports and chat controls.
- Secret scans reported zero findings in all three repositories.
- Existing chart-size, dynamic-import and large-bundle warnings remain; no
  TypeScript or build errors were reported. Hosted CI has not run these new
  changes because they have not been committed or pushed.

Rollback is coordinated: restore the previously compatible backend/frontend
versions together before removing their proxy routes. Never roll back by
disabling gateway validation, reusing an audience across apps, or enabling Bypass
for private APIs. The database is not modified by this transport change.

References:
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/cors/
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/workers/configuration/routing/routes/
- https://developers.cloudflare.com/workers/examples/websockets/
