> September 21 update: deployed previews now use [opaque state references](OPAQUE-STATE.md). The signed envelope remains server-side; prior signed-browser-state evidence below is historical.

# Local v2 GitHub gateway proof

The real flow passed: GitHub → this local Worker → the v2 OAuth component →
HTTPS TanStack Start → Secure/HttpOnly session cookies → authenticated SSR.
Nate completed GitHub consent in the automated Chromium window. The runner also
verified reload, logout, and a second login resolving the same app user.
See [recorded result](../start/results-github.json).

## What runs where

| Service | Address | Role |
| --- | --- | --- |
| Temporary GitHub OAuth app | Existing temporary registration | Callback stays `http://127.0.0.1:4411/oauth/github/callback` |
| Local gateway Worker | `127.0.0.1:4411` | Forwards only the fixed callback to the fixed local backend |
| Local Convex proof | API 4420, HTTP 4421 | Stores state hashes, verifies PKCE, exchanges GitHub code, mints single-use ticket |
| Start under local workerd | `https://127.0.0.1:5183` | Holds OAuth state in a Secure/HttpOnly cookie; redeems ticket and writes session cookies |

The old GitHub SPA backend must not occupy port 4411 at the same time. Its data
and OAuth registration were not deleted or rewritten. Kino Auth, Kino Relay,
shared dev/prod gateway Workers, and application deployments were unchanged.

The Start initiation route checks an exact Origin, calls v2's start mutation,
and saves the returned state in a ten-minute Secure/HttpOnly/Lax cookie. The
browser navigates to GitHub with state and S256 PKCE. On return, the gateway
forwards to one fixed component endpoint, without forwarding cookies, selecting
an arbitrary target, following upstream redirects, or exchanging credentials.
It accepts a redirect only to the exact Start callback origin/path.

The component does the OAuth exchange and returns its single-use ticket to Start.
Start pairs that ticket with its browser-state cookie, invokes the official sign-in
proxy allowlist, and copies its HttpOnly cookies onto a redirect to the private
page. Refresh tokens never appear in the callback URL or browser storage. OAuth
state is cleared on completion/cancellation. The temporary GitHub credentials
remain only in the local Convex proof, not in this gateway.

## Required upstream seam

The pinned official v2 source derives its callback URL from the component site URL.
It cannot advertise the gateway URL without an extension. The separate proposed
[callback URL patch](../patches/oauth-callback-url.patch) adds an optional,
server-configured `CALLBACK_URL` component environment value. It is stored on the
authorization request and reused verbatim for the token exchange. The default
remains unchanged. Non-HTTPS remote URLs, credentials, query strings, and fragments
are rejected; HTTP loopback is allowed for this local registration.

This is a second proposed patch, alongside session revocation. Neither patch is
an upstream-supported API. Choosing whether to maintain or contribute them remains
an integration decision. Pristine `.upstream` remains unchanged; the patches apply
only to the ignored `.revocation` copy.

## Verification

- Real GitHub sign-in, private SSR, Secure/HttpOnly cookies, reload, logout, repeat
  login: passed via `scripts/github-cookie-browser.mjs`.
- Running gateway + Convex + Start: exact redirect URI, PKCE, state-cookie flags,
  cross-origin initiation refusal, cancellation, callback replay refusal, and
  missing-browser-state refusal: passed via `scripts/github-gateway-negative.mjs`.
- Seven callback-configuration tests and three gateway unit tests pass.
- All 35 upstream OAuth component/HTTP tests pass against the patched copy.
- Total parent suite: 192 tests pass; TypeScript checks pass.

## Run

With the parent proof dependencies/source prepared and the email backend running,
use the already-provisioned ignored `email/.env.github.local` for the temporary
OAuth credentials and callback URL. Confirm the local deployment before pushing
that file. Never print its contents.

From this folder:

```sh
node ../node_modules/wrangler/bin/wrangler.js dev --local --port 4411 --ip 127.0.0.1
```

Start the HTTPS Worker as documented in [the Start proof](../start/README.md).
From the parent proof directory, with `PROOF_PLAYWRIGHT` set to an installed
Playwright package directory:

```sh
node scripts/github-gateway-negative.mjs
node scripts/github-cookie-browser.mjs
```

The real-flow runner opens a visible temporary Chromium window for human GitHub
consent and closes it automatically after completion. It permits the self-signed
local TLS certificate. This does not prove publicly trusted TLS or edge deployment.

## Limits before replacing the shared gateway

The original local entrypoint has one fixed target. The new cloud entrypoint uses
signed, expiring routing envelopes and an exact per-preview registry; nine added
tests cover two targets, tampering, expiry, key rotation and redirect isolation.
The [cloud runbook](../cloud/README.md) describes the deployed single-backend
proof and remaining real multi-preview/lifecycle checks. Never forward an arbitrary
URL from a callback query.

The proof does not implement Better Auth's encrypted proxy protocol. Migration
would use a distinct v2 route and a coordinated registration/rollout decision.
The existing Better Auth auth route, redirect rewrite, Relay callbacks, webhooks,
and dev share-origin registry retain their existing responsibilities.

GitHub users are intentionally separate from password users in this proof.
Matching email addresses do not link accounts. Production linking policy is open.
