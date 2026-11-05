# Zero Trust and hosting setup — design only

No Cloudflare, Vercel, Render, DNS or production environment change was made. No gateway assertion verifier is implemented in Batch 1. Proposed variable names/files below must not be treated as deployed features.

## Recommendation and hosting comparison

Recommend a private internal frontend/API origin behind Cloudflare Tunnel (Approach B), with separate OS and Cash access applications and a separate public KYC/customer ingress. Keep application RBAC/object authorization after gateway admission. Confirm cash operators' identity/device eligibility independently of OS staff.

| Approach | Suitability | Cost/operations | Rollback tradeoff |
|---|---|---|---|
| A: existing Vercel/Render plus verified origins | Interim only if every frontend origin, alias, asset and internal API path has unavoidable server/edge assertion verification | Existing hosts plus gateway/identity features; a trusted frontend execution layer is required | Preserve verified origin enforcement during policy rollback; never remove it to restore broad access |
| B: private origin and outbound Tunnel | Preferred network boundary; origin has no public listener/reachable direct address | Private compute, connector operations, patching, backups, monitoring, redundancy and identity/device services | Restore a reviewed prior policy/connector configuration; retain private origin and controlled emergency access |
| C: supported hosting protection | Potential alternative for Vercel-hosted frontend origins, subject to plan/coverage | Plan/feature dependent; separate API solution still needed | Keep production and alternate domains covered during rollback |

Current Vercel/Render plan/settings and domains were not accessed. Vercel Standard Protection excludes production domains in the current documentation. Trusted IPs and other options have plan requirements; do not assume Hobby provides them. If the company actually uses Hobby, review commercial-use suitability. No dollar prices or plan purchase decisions are assumed here.

Official references:

- [Cloudflare Access JWT verification](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/)
- [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection)
- [Vercel fair-use guidelines](https://vercel.com/docs/limits/fair-use-guidelines)
- [Render custom domains and disabling the default subdomain](https://render.com/docs/custom-domains)

## Stage 0 — inventory and approval

1. Vercel Project → Settings → Domains: inventory all production domains, aliases, branch/preview URLs and applicable protection coverage. Include cash hosting once its actual project/domain is identified.
2. Vercel Project → Settings → Deployment Protection: capture the actual plan, protection mode and any bypass configuration; redact bypass secrets.
3. Render Service → Settings → Custom Domains: record every custom/default domain. Record the actual deployed commit, service port/start command and health settings. Do not capture environment values.
4. DNS provider/registrar: obtain an approved record inventory, delegation and recovery access. Preserve website, API, email/MX/SPF/DKIM/DMARC and verification records. Do not assume the registrar and DNS provider are the same.
5. Approve separate OS workforce, cash operator/admin, public KYC/customer and partner requirements. Resolve managed-device exceptions, office static IPs and emergency administrators.
6. Provision an isolated staging database/storage and dummy accounts. Never point staging tests at an unknown or production DATABASE_URL.

## Stage 1 — prepare origin enforcement in source

Later implementation must modify `backend/src/main.ts`, `src/app.module.ts`, `src/common/jwt-auth.guard.ts`, internal controllers, the communications gateway and private file-serving routes.

Proposed new files, NOT present as implemented features: `backend/src/common/cloudflare-access.guard.ts` for verified gateway assertions and `backend/src/common/public-route.policy.ts` for exact public/partner exceptions. Naming may change during the reviewed implementation.

Requirements:

- Verify Access JWT signature with the configured team's HTTPS JWKS, expected issuer, exact application audience, expiration/time claims and an explicit accepted algorithm. Cache keys safely and bound fetch time/rate; never fetch a JWKS URL supplied by the request/token.
- Proposed server-only configuration names: `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_OS_AUDIENCE`, `CF_ACCESS_CASH_AUDIENCE`, `GATEWAY_ENFORCEMENT_MODE`. These are planning names, not configuration supported by Batch 1.
- Require BOTH gateway admission and application identity/permission on internal OS routes. Cash additionally requires its own cash session/grant and its own gateway policy/audience.
- Reject a valid OS gateway assertion on a cash-only policy when its audience differs, and vice versa. Do not treat Access identity as an application role.
- Public KYC submission remains public. Internal KYC list/review/documents remain internal. Public customer reads/submissions use an exact method/path allowlist and minimal publication fields.
- Separate Outreach administration from published reads/submissions. No blanket `/outreach/*`, `/kyc/*`, `/uploads/*` or `/api/v1/*` Access bypass.
- Partner webhooks require the actual provider-supported verification method, replay protection and payment binding. Do not invent a signature header/secret. If verification cannot be established, hold that integration or use a reviewed server-side provider confirmation flow.
- Apply equivalent handshake, room, session and origin controls to WebSockets. Eliminate public static paths for private documents.
- Restrict trusted proxies to the actual known topology. Do not set blanket proxy trust or accept arbitrary forwarded IPs as office proof.
- Origin protection must execute outside React. The current Vite SPA/vercel.json rewrite cannot enforce Access assertions by itself. If Vercel middleware/edge routing cannot be proved to cover all relevant domains/assets/requests, use private hosting or an appropriate native protection feature instead.

## Stage 2 — configure staging Cloudflare identity and policies

Dashboard labels can change; validate against the linked current provider documentation before applying changes.

1. Cloudflare Zero Trust → Settings → Authentication: connect the approved managed company identity provider; enforce MFA and approved groups. Do not permit arbitrary personal accounts.
2. Zero Trust → Devices/WARP enrollment settings: restrict enrollment to approved identities/groups. Define supported OS, patch/endpoint requirements and posture checks. Account for employee offboarding and lost devices.
3. Zero Trust → Access → Applications → Add application: create separate self-hosted applications for the actual staging OS and cash hostnames/internal API boundaries. Record each application's audience for the origin verifier; keep any service credentials server-only.
4. Define policies equivalent to: approved managed identity with MFA AND (approved office egress IP OR enrolled company WARP device satisfying posture). Office IP alone is insufficient. A random VPN/WARP connection without approved identity/enrollment is insufficient.
5. Give cash its separately approved account/device policy. A grant in one application does not automatically grant the other.
6. Define short, documented session durations and privileged reauthentication. Create narrowly scoped, time-limited break-glass recovery with strong MFA and audit review; no permanent unrestricted bypass.
7. Configure access logs/denial monitoring, retention and alerts. Correlate gateway identity with application user/request IDs without logging tokens or sensitive payloads.

## Stage 3 — private Tunnel option

1. Prepare private compute for internal OS/cash frontend/API workloads, with non-root services, patching, approved backups, private database access and no public inbound application listener.
2. Zero Trust → Networks → Tunnels (or current connector navigation): create the approved staging Tunnel and run outbound connectors on that compute. Store connector credentials in an approved secret store, never in Git or React.
3. Add public hostname mappings for the approved internal staging hosts, routed to private services. Put the matching Access applications/policies in place before admitting staff.
4. Keep KYC/customer ingress on a separate public service/hostname or a tightly reviewed public boundary. Public ingress must not expose administrative handlers through shared routing.
5. Verify origin listener/firewall reachability from outside, connector redundancy/restart, health monitoring and emergency access. Tunnel presence alone does not prove every alternate origin has been removed.

## Existing-host interim option

1. Implement and locally test the origin verifier and route split before adding production policy requirements.
2. For Vercel: prove trusted edge/server verification on production, stable aliases, branch previews and direct `.vercel.app` routes, including sensitive assets. React route guards are insufficient. Alternatively choose a native protection mode that actually covers those deployment/domain types on the purchased plan.
3. For Render: Settings → Custom Domains → disable the Render default subdomain once an approved custom domain exists, then verify its documented 404 behavior in staging. This does not protect other direct origins; the backend verifier must reject internal traffic lacking a valid assertion regardless of hostname.
4. Test gateway-free direct requests with a valid application JWT. They must fail on every reachable internal origin. Public KYC/customer paths must still work under their exact allowlist.

## Expected DNS changes — approval required

The existing user-supplied domain context is `enakoos.com`, `api.enakoos.com` and the Render default hostname; it was not independently verified. Cash/KYC hostnames must be inventoried, not guessed.

- If adopting Cloudflare full-zone DNS, prepare an approved record export/import and change nameservers at the registrar only after validation. Preserve every unrelated website/email record and DNSSEC/delegation requirements; do not simply overwrite the Vercel zone.
- Internal OS/API/cash records will point through the reviewed Cloudflare/Tunnel or proxied-origin design, with matching certificates and origin enforcement. Public KYC/customer records remain intentionally public.
- Retain original record/delegation values in the approved recovery system, not in this report. Test TTL/certificate/redirect behavior in staging before production approval.
- Do not publish a private origin IP or leave another DNS alias that bypasses enforcement. DNS hiding is not itself access control.

## Required negative/compatibility tests

Use locally signed fixture assertions/JWKS and an isolated staging deployment before any production probing:

1. Missing assertion; spoofed header; invalid signature/key; wrong issuer/audience; expired/not-yet-valid assertion.
2. Valid app JWT without gateway assertion; valid gateway identity without app permission.
3. OS assertion on cash policy and cash assertion on OS policy.
4. Direct custom origins, `.vercel.app`, previews/aliases, Render default host and redirects.
5. Spoofed forwarded IP, unmanaged WARP device, unenrolled identity and failed posture.
6. Approved office identity and compliant remote device succeed according to their separate policies.
7. Public applicant submission and published customer content remain functional; internal KYC/documents/admin routes remain protected.
8. Partner callbacks verify authenticity/replay/payment binding using the actual provider contract.
9. WebSocket identity/rooms and private uploads cannot bypass gateway/application authorization.
10. Offboarding, privilege changes, session expiry, connector failure, denied-request logging and break-glass recovery behave as documented.

These gateway tests are NOT implemented by Batch 1. Do not claim readiness until they pass and cloud evidence is captured.

## Rollback and approval gates

Snapshot approved DNS, policy, deployment and connector configuration before change. Rehearse recovery in staging. Roll back to a reviewed configuration while retaining an internal denial/maintenance boundary; never expose an unverified public origin as the recovery shortcut. Keep public KYC/customer availability separate. Revoke emergency access after the incident and review logs.

Production DNS, environment values, Cloudflare policies, credential/data migrations, push and deployment each remain subject to explicit user approval. The local implementation/report does not grant that approval.
