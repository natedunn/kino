# Deployed Convex Auth v2 proof

This is a disposable cloud proof, separate from Kino's app, gateways and data.
It uses the same pinned official v2 source and two proposed patches as the local
proof. Nothing here makes those patches upstream-supported.

## Resources and current evidence

| Resource | Target |
| --- | --- |
| Start Worker | https://kino-auth-v2-proof-c318c09d.hello-fc8.workers.dev |
| Gateway Worker | https://kino-v2-gateway-proof-c318c09d.hello-fc8.workers.dev |
| Convex preview | `graceful-elephant-103`, reference `preview/auth-v2-proof-c318c09d` |
| Cloudflare account | Nate (`fc87b44f5832b25053fec2efb19fc208`) |
| GitHub registration | Temporary **Kino Convex v2 Proof** only |

The Convex preview and its scoped deployment key expire September 24, 2026 UTC
(September 23 in Mexico City); exact timestamp is in `deployment.json`.
Cloudflare Workers do not auto-expire and must be removed after the proof.

Completed on September 20 local time:

- Deployed backend, Start Worker, and separate signed-routing gateway.
- Real public TLS, anonymous Start response and protected-route redirect.
- Start -> GitHub authorization URL uses the gateway callback and PKCE S256.
- Simulated provider cancellation traverses the deployed gateway, Convex component,
  and Start return handler. This exercises real cloud code, not mocked fetch.
- Cross-origin initiation, missing browser state, and callback replay are rejected.
- Secure/HttpOnly state cookie is set and cleared on cancellation.
- 193 tests and parent/Start/cloud-backend TypeScript checks pass.

**Passed:** real GitHub consent/token exchange through the deployed gateway and
Convex preview, Secure/HttpOnly session cookies, no browser token storage, private
SSR, reload, logout, and repeat login preserving the same user ID. The browser
runner completed successfully at 2026-09-21 05:53 UTC (September 20 local time).
See [sanitized browser results](results-github.json). Chromium closed automatically
after all assertions passed.
Two cloud backends are now provisioned behind the same gateway. Live cancellation,
state-isolation and tampering checks pass. The synchronized real OAuth check
also passed, including cross-preview tickets/JWTs, SSR, data and logout isolation;
see the [two-preview proof](TWO-PREVIEWS.md).

## Deployed session reliability

All eight [session edge checks](../start/SESSION-EDGES.md) pass on the deployed
preview: refresh concurrency, cross-tab logout/account switching, missed notices,
refresh/sign-out races, expired refresh cookies, and real-expiry offline/frozen-tab
recovery. [Sanitized results](results-session-edges.json) record this separately
from the earlier real GitHub exchange. No new human sign-in was required.

The session adapter initially failed in deployed Workers because its random tab ID
was generated at module scope. It now generates the ID lazily in browser code;
a dedicated regression test passes. Successful Worker version:
`183a1af5-71bb-43fa-9565-50e4ba0cf0bd`.

The cloud fixture adds two synthetic identities via internal-only seed functions.
Anonymous access was rejected. Test sessions are revoked at completion; synthetic
users are removed with the preview at teardown/expiry. No Bento mail is sent.
Run `PROOF_CLOUD=1 node scripts/session-edges.mjs` from the parent experiment,
with `PROOF_PLAYWRIGHT` configured. The fixture source is `fixtures.ts.template`.

## Failure found during real consent

The first cloud GitHub return reached session creation but failed in
`mintAccessToken`: the provisioning script had set raw PEM instead of the
base64-encoded PEM required by upstream's `AUTH_PRIVATE_KEY` contract.
`configure.mjs` now encodes it correctly. The existing preview value was corrected
without rotating the key pair. `node cloud/preflight.mjs` then read the deployed
environment and verified signing against its publicly served JWKS. The subsequent real browser return and repeat login passed, closing this
provisioning issue. Cancellation checks alone do not exercise token minting.

## GitHub registration and completed human check

In GitHub Settings -> Developer settings -> OAuth Apps -> **Kino Convex v2 Proof**:

- Homepage: `https://kino-auth-v2-proof-c318c09d.hello-fc8.workers.dev`
- Authorization callback:
  `https://kino-v2-gateway-proof-c318c09d.hello-fc8.workers.dev/oauth/github/callback`

Nate confirmed these temporary registration settings are saved.
Leave Kino Auth, Kino Auth Dev, and Relay registrations unchanged. After saving,
Codex opened Chromium; Nate completed consent and the full return checks passed.
The runner closes Chromium after success. Changing the temporary app callback
means the old localhost callback tests require restoring that registration first.

## Routing contract

`gateway/routing.ts` signs a ten-minute HS256 envelope around the **original OAuth
provider state** returned in the authorization URL. This is distinct from the
browser's private flow state stored in the HttpOnly cookie. The envelope has an
immutable preview ID as key ID/issuer, a fixed gateway audience, issued-at/expiry,
and original provider state. It carries no destination URL.

Each preview has a separate random 256-bit signing key. The gateway's secret
registry maps that ID to the key, exact HTTPS Convex callback and exact HTTPS Start
callback. It verifies the envelope, restores the original provider state and
forwards only OAuth callback fields. It accepts only the registered app callback
from the backend. Cookies and arbitrary upstream bodies are not forwarded.

The component retains PKCE, provider exchange and atomic state consumption.
The gateway itself does not consume envelopes: replay is rejected by the component,
as the deployed cancellation/replay check establishes. Gateway redeployment loses
no sessions. Removing a registry entry or rotating its key invalidates outstanding
envelopes. Use a new ID/key when recreating a preview; never retarget an existing ID
to another backend while its flows may be in flight.

This adds no third upstream patch. It does require app-owned routing code and
preview provisioning/cleanup. Automated registry lifecycle, overlapping key
rotation, account linking, and shared Kino gateway integration are deferred.

## Build, deploy and verify

`node cloud/prepare.mjs` derives ignored `cloud/convex` from the tracked local
backend and replaces its redirect origin and password mail action. The alpha invitation proof now has the allowlisted Bento sender enabled.
Password verification/recovery email delivery remains disabled. This is a GitHub
proof, not a deployed email verification/recovery test.

`cloud/configure.mjs` sets fresh proof signing keys, temporary GitHub credentials,
and local secret files. **Do not rerun casually:** it rotates keys and invalidates
sessions/flows. Announce and verify the target before every remote mutation.
`cloud/.env.deploy.local` is ignored, mode 0600, scoped to this preview. The API
reports type `preview`/non-default; the issued key and CLI label use `dev`, so
check the exact deployment name and management metadata rather than label alone.

From `cloud/`, deploy with the explicit environment file:

```sh
node ../node_modules/convex/bin/main.js deploy --env-file .env.deploy.local
node preflight.mjs
```

From `start/`, build the remote target explicitly:

```sh
PROOF_CLOUD=1 \
VITE_PROOF_CONVEX_URL=https://graceful-elephant-103.convex.cloud \
VITE_PROOF_APP_ORIGIN=https://kino-auth-v2-proof-c318c09d.hello-fc8.workers.dev \
VITE_PROOF_ROUTE_ID=c318c09d-alpha \
node ../node_modules/vite/bin/vite.js build --config vite.cloudflare.config.ts
node ../node_modules/@cloudflare/vite-plugin/node_modules/wrangler/bin/wrangler.js deploy --config dist-cloudflare/server/wrangler.json
node ../node_modules/@cloudflare/vite-plugin/node_modules/wrangler/bin/wrangler.js secret bulk .env.routing.local.json --config dist-cloudflare/server/wrangler.json
```

Use the Vite plugin's bundled Wrangler 4.94 for its generated config; standalone
4.118 rejects its generated `legacy_env` field. No root dependency was changed.
Build without `PROOF_CLOUD=1` to restore the local build. Both use the same output
folder, so inspect the generated target before deploying.

From `gateway/`:

```sh
node ../node_modules/wrangler/bin/wrangler.js deploy --config wrangler.preview.jsonc
node ../node_modules/wrangler/bin/wrangler.js secret bulk ../cloud/.env.routes.local.json --config wrangler.preview.jsonc
```

The deployed entrypoint fails closed without its registry; it never uses the local
single-target fallback. Request observability is disabled in both proof Workers to
avoid collecting OAuth query credentials. Secrets are runtime bindings, not Vite
client variables.

From the parent experiment, with `PROOF_PLAYWRIGHT` pointing to Playwright:

```sh
PROOF_CLOUD=1 node scripts/github-gateway-negative.mjs
PROOF_CLOUD=1 node scripts/github-cookie-browser.mjs
```

## Cleanup and credential follow-up

- Rotate the existing `CONVEX_MANAGEMENT_TOKEN` stored in the worktree root
  `.env.local`: an inspection command accidentally printed it into a tool log.
  Do not paste the replacement into chat. Check other consumers before revoking
  the old token; this proof uses its own scoped key after provisioning.
- Delete only `kino-auth-v2-proof-c318c09d` and `kino-v2-gateway-proof-c318c09d`
  after the cloud checks, or keep them temporarily with a recorded owner/end date.
- Delete the exact Convex preview (or let its three-day expiry clean it up), and
  revoke its scoped key. No automatic cleanup code targets Kino's existing gateways.
- Delete the temporary GitHub OAuth registration after all proofs, or restore its
  localhost settings if more local OAuth work is needed.
- Remove ignored proof secrets after teardown; preserve sanitized results/docs.


## September 21 invitation preview rollout

Alpha now includes native organization/invitation functions and Start pages.
Invitation mail uses the fixed alpha app origin and is restricted to PROOF_EMAIL.
Only the Bento credentials and proof recipient were added; signing/GitHub/gateway
keys were preserved. The password email action remains disabled.

The GitHub onSignIn callback revalidates the fresh provider email and updates
the explicit verification marker for existing accounts. It checks stable account
IDs and does not link a password account or change its email field.

Worker version: `e59e9f49-7fa8-4d5c-9cc2-5d4ab7e3949a`.
Backend: `graceful-elephant-103`, still the disposable preview.
Gateway and beta were not redeployed. During cleanup remove the preview's Bento
variables and ignored `.env.invitation.local` file along with other proof secrets.
The derive script supports invitation origins for both targets, but beta has not
been provisioned with Bento credentials or validated for invitations.
