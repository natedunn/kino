# TanStack Start + Convex Auth v2 live proof

Isolated developer proof using the existing local email backend on port 4420.
Kino's auth, routes, gateway, and root dependency versions are unchanged.

## Architecture

- Actual TanStack Start 1.168.49 / Router 1.170.32 / SSR Query integration 1.167.1,
  matching Kino's top-level pins. The experiment has a separate npm lockfile.
- Framework-neutral official v2 `setupConvexAuthServer` handlers mounted as Start
  server routes; `ServerAuthSession` supplies the SSR access token through a Start
  server function. A request-keyed WeakMap shares refresh work for parallel callers.
- Official `AuthClient` in SSR mode feeds `ConvexProviderWithAuth`. Its refresh
  requests use a separate HTTP endpoint, avoiding a paused-WebSocket deadlock.
- Access and refresh cookies are HttpOnly; only the access token reaches SSR
  hydration. Browser token storage is memory-only; reload uses server cookies.
- Every router instance has its own QueryClient and ConvexQueryClient. Protected
  queries check verified identity in Convex and read only that user's counter.
- Route loader `ensureQueryData` and component `useSuspenseQuery` share query keys.
  Intent preloading starts the next subscription on hover. Dehydration includes
  successful queries, not unresolved subscription promises.

This follows [Convex's Start guidance](https://docs.convex.dev/client/tanstack/tanstack-start/).
The current docs' `queryClient.query` examples require Query 5.102+, so this proof
uses `ensureQueryData` with Kino's pinned 5.101.4 instead.

## Evidence

See [development results](results.json) and [built-preview results](results-preview.json).
The browser runner checks:

- Browser sign-in creates two HttpOnly cookies; no refresh token in sign-in JSON,
  document HTML, localStorage or sessionStorage.
- Authenticated initial HTML already contains the user ID and private counter.
- Hydration makes no browser HTTP query; one alpha WebSocket subscription is
  established. Subscribing is still necessary; this is not a zero-network claim.
- A mutation through another client updates the hydrated page without reload.
- Hover opens the beta subscription while still on alpha. Clicking reuses that
  subscription, with no observed pending component and no extra beta subscription.
- Anonymous requests receive no private data; cross-origin refresh returns 403.
- Removing only the access cookie forces a real SSR refresh, restores the cookie,
  and retains the same user with two parallel token consumers sharing one refresh.
- Automatic cookie refresh occurred before JWT expiry; an open page accepted
  a mutation and received its live update after that original expiry.
- Sign-out clears cookies and removes protected SSR access.
- No browser/hydration errors on successful runs.
- TypeScript checks and both client/server production builds pass.
- Three backend tests reject anonymous/unverified access, isolate two users and
  route arguments, and reject attempts to supply an ownership override.

Timing files are single local samples, not p50/p95 or evidence of improvement over
Better Auth. They include browser automation overhead. Sign-in uses a full document
navigation to exercise authenticated SSR; this is not yet an optimized in-place
sign-in transition. The preview is a production build served locally, not Cloudflare.

## Run

First prepare dependencies/source and run the local email backend as documented
in [the parent proof](../README.md) and [email proof](../email/README.md).
The email account must already be verified and the ignored browser credentials
file must contain the password from the completed reset proof.

From this directory:

```sh
node ../node_modules/vite/bin/vite.js --config vite.config.ts
node ../node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
node ../node_modules/vite/bin/vite.js build --config vite.config.ts
node ../node_modules/vite/bin/vite.js preview --port 5182 --host 127.0.0.1
```

Dev uses http://127.0.0.1:5181/; built preview uses http://127.0.0.1:5182/.
From the parent proof folder, with `PROOF_PLAYWRIGHT` pointing to an installed
Playwright package directory and Chromium available:

```sh
node scripts/start-browser.mjs
PROOF_START_ORIGIN=http://127.0.0.1:5182 PROOF_ROLLOVER=1 node scripts/start-browser.mjs
```

The rollover option also waits past an actual access token's expiry to check
automatic cookie refresh and a subsequent live mutation. The runner reads ignored
local credentials internally; it never prints passwords or tokens. It increments
only this test user's proof counters. Rapid repeated sign-ins can hit the provider's
per-email login rate limit.

## Remaining integration work

- Local Cloudflare runtime and HTTPS/Secure cookie checks now pass (see below).
  The separate cloud preview now passes public TLS and cancellation checks;
  its real OAuth cookie-session, private SSR, reload, logout and repeat-login
  checks also pass; evidence is in the cloud runbook.
- Local refresh races, multi-tab logout/account switching, expired refresh sessions,
  and frozen/offline recovery now pass; see [session edge evidence](SESSION-EDGES.md).
  The deployed preview repeat also passes. Other browsers and streaming/error
  paths remain open.
- GitHub now works with this adapter through an isolated single-target gateway
  (see below). The deployed Kino gateway and multi-preview routing remain open.
- Integrate public-page loading without blocking it on optional viewer information.
- Measure comparable cold/warm deployed sign-in and first-content p50/p95.
- Choose the supported/maintained revocation patch strategy, token-expiry policy,
  and bounded cleanup before production adoption.

This deliberately temporary UI is developer-only; it is not shipped product copy.

## Cloudflare HTTPS and GitHub follow-up

The same browser checks now pass under **local workerd over HTTPS**, including
Secure/HttpOnly cookies, private SSR, hydration, live updates, hover, SSR refresh,
and sign-out. See [runtime results](results-cloudflare.json) and the
[real GitHub gateway proof](../gateway/README.md). Real GitHub login, reload,
logout, and repeat login all passed with this cookie adapter.

A concrete runtime difference was found and fixed: local Cloudflare rewrites the
Worker-visible host to `localhost`. The auth adapter now configures exact trusted
proof origins; the outer route also checks scheme and exact Origin. The browser
runner observes the browser's native fetch response, rather than reissuing the
request through Playwright (which had masked this host behavior).

Run local workerd from this directory:

```sh
node ../node_modules/vite/bin/vite.js --config vite.cloudflare.config.ts
node ../node_modules/vite/bin/vite.js build --config vite.cloudflare.config.ts
node ../node_modules/@cloudflare/vite-plugin/node_modules/wrangler/bin/wrangler.js deploy --dry-run --config dist-cloudflare/server/wrangler.json
```

These checks passed. `.certs/key.pem` and `.certs/cert.pem` are ignored local,
seven-day self-signed development certificates. Playwright accepts that certificate
explicitly. Recreate them with an IP/DNS SAN for 127.0.0.1/localhost when expired.

Tooling details matter here:

- Vite plugin 1.38.0 uses Wrangler 4.94.0 and a workerd binary supporting dates only
  through May 28. The proof uses Kino's existing May 22 compatibility date.
- The standalone Wrangler 4.118.0 rejects the plugin's generated `legacy_env`
  field. The packaging dry-run passes using the plugin's matching Wrangler 4.94.0.
  Do not silently hand-edit generated output. Align deployment tooling before an
  actual release; this run did not repair or validate Kino's deployment pipeline.
- No Worker was uploaded. All backend URLs are loopback proof endpoints. A real
  preview needs remote backend URLs, trusted HTTPS origins and appropriate secrets.
- The gateway currently forwards one exact target. Multi-preview routing is open.
- HTTPS rollover beyond JWT expiry has not been separately timed; that check passed
  in the earlier Node built-preview run. HTTPS SSR refresh itself passes.

Local cleanup: a diagnostic runner submitted before hydration and its timeout
included the generated proof password in a URL. The login form now explicitly
uses POST for its non-hydrated fallback. The generated password was rotated and
all password-user sessions revoked on the local backend; the ignored runner
credential file now holds the replacement. No credential value is recorded here.

## Deployed preview follow-up

See the [cloud proof runbook](../cloud/README.md) for the separate deployed Start
Worker, signed gateway routing, exact build configuration, and successful real GitHub
consent/session checks. Local results above remain separate from deployed evidence.
