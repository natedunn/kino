# GitHub Integration & Gateway Architecture

Canonical reference for how Kino talks to GitHub across environments.
**Read this before editing anything in `workers/gateway/`, the auth proxy
flow, or the webhook pipeline.** The Invariants section exists because each
item was learned the hard way; violating them produces failures that pass
every local test and only break in deployed OAuth flows.

## Naming scheme

Three things, three names — used consistently in env vars, URLs, code, docs:

| Name | What it is | Env prefix |
|---|---|---|
| **Kino Auth** (+ Dev) | GitHub **OAuth app** — user login via Better Auth | `GITHUB_AUTH_*` |
| **Kino Relay** (+ Dev) | **GitHub App** — org/repo sync, installations, webhooks | `GITHUB_RELAY_*` |
| **Gateway** | Per-tier Cloudflare Worker owning the stable URLs GitHub needs | `GATEWAY_*` |

Two tiers, fully isolated:

| | Production tier | Dev tier |
|---|---|---|
| App environments | usekino.com + prod Convex | every CF preview, Portless worktree, Convex dev deployment |
| GitHub registrations | Kino Auth, Kino Relay | Kino Auth Dev, Kino Relay Dev |
| Gateway | `kino-gateway` → `gateway.usekino.com` | `kino-gateway-dev` → `gateway-dev.usekino.com` |
| Secrets | prod-only, never on dev machines | dev-only, in `workers/gateway/secrets.dev.local` (gitignored) |

## Why the gateway exists

GitHub hard limits: an OAuth app has **one** callback URL; a GitHub App has
**one** webhook URL. The gateway is a tiny, independently deployed Worker that
owns those URLs per tier, so the app's release cadence is decoupled from
GitHub's registration and every app environment (prod included) is identical —
no environment special-casing exists anywhere in app code.

```
GitHub (tier registrations)
  │ callbacks / webhook (single stable URLs)
  ▼
gateway[-dev].usekino.com          (workers/gateway, deployed via wrangler)
  ├─ /api/auth/*                   Better Auth oAuthProxy production leg
  │                                  └─ redirect rewritten to the app origin
  ├─ /github-relay/oauth-callback  Kino Relay signed-state trampoline
  ├─ /hooks/github                 webhook intake: verify HMAC → fan out
  └─ /hooks/targets                bearer-token registry of fan-out targets (KV)
        ├─ https://<prod>.convex.site/api/github/webhook
        ├─ https://<preview>.convex.site/api/github/webhook
        └─ https://<local-dev>.convex.site/api/github/webhook
```

Key fact that shapes the design: **every Convex deployment — including local
`npx convex dev` — has a publicly reachable `*.convex.site` URL**, so webhook
fan-out reaches local dev directly. No tunnels.

## Login flow (identical in every environment)

1. App env starts sign-in. The `oAuthProxy` plugin (configured in
   `convex/functions/auth.ts`) rewrites GitHub's `redirect_uri` to the tier
   gateway, taken from `OAUTH_PROXY_PRODUCTION_URL`.
2. GitHub redirects to the gateway. Its better-auth instance
   (`workers/gateway/src/auth.ts`) decrypts the proxy state with the shared
   tier `OAUTH_PROXY_SECRET`, exchanges the code, fetches the profile,
   encrypts it, and 302s toward the originating env's
   `/api/auth/oauth-proxy-callback`.
3. **`workers/gateway/src/redirect-rewrite.ts` rewrites that redirect's host**
   from the env's convex.site URL to the app origin embedded in the inner
   `callbackURL` (validated against `TRUSTED_TARGET_PATTERNS`). Without this
   the session cookies land on `*.convex.site` and the user stays logged out —
   see Invariant 2.
4. The app origin proxies `/api/auth/*` to its Convex deployment
   (`src/lib/convex/auth-server.ts`), which creates the session and sets
   cookies on the app origin.

## Webhook flow

1. GitHub posts to `/hooks/github` on the tier gateway.
2. The gateway verifies `X-Hub-Signature-256` against the tier
   `GITHUB_RELAY_WEBHOOK_SECRET`, then forwards the **raw body with the
   original signature** to every registered target (`workers/gateway/src/hooks.ts`).
3. Each target (`POST /api/github/webhook`, `convex/functions/githubRoutes.ts`)
   re-verifies the HMAC, dedupes on `X-GitHub-Delivery` (the
   `githubWebhookDelivery` table), and dispatches by event type in
   `processWebhookEvent` (`convex/functions/github.ts`). Receiving events for
   unknown installations is **normal** under the broadcast model — record and
   ignore, never error.
4. Target registration is automatic and best-effort (missing env = silent
   no-op): CI builds register via `scripts/cloudflare-vite-build.sh`,
   `pnpm dev` registers via `scripts/dev-supervisor.mjs`, preview cleanup
   scripts unregister, and a 14-day KV TTL ages out stragglers. Manual:
   `pnpm gateway:webhook:register` / `:unregister`.

To add sync features (issues/discussions): extend the dispatch in
`processWebhookEvent` — the receive/verify/dedupe pipeline is done.

## Invariants — do not break these

1. **better-auth version lock.** `workers/gateway/package.json` must pin the
   exact better-auth version the app resolves (kitcn pins it as an exact peer
   dep). The oAuthProxy state/profile payloads are symmetric-encrypted;
   mismatched versions silently break login.
   `workers/gateway/src/version-lock.test.ts` enforces this. On a kitcn
   upgrade: bump the gateway's better-auth to match and deploy the gateway
   **before or with** the app.
2. **`redirect-rewrite.ts` is load-bearing, not cosmetic.** The sign-in proxy
   state always embeds the Convex site URL as the return origin (the app's
   auth handler runs on Convex; forwarded-host inference does not reach the
   oAuthProxy hook — a plugin that tried was removed as non-functional). The
   gateway-side rewrite is what gets cookies onto the app origin. If login
   "works on GitHub's side" but users land back signed out, start here.
3. **Never import `memoryAdapter` in the gateway.** Passing no `database` to
   `betterAuth()` makes it build its own in-memory adapter, which is what we
   want. A static import of `better-auth/adapters/memory` resolves to
   `undefined` at runtime in the Workers bundle (esbuild lazy-init) and
   crashes the auth handler with "memoryAdapter is not a function".
4. **The gateway holds no state worth keeping.** No sessions, no database;
   KV holds only the fan-out target registry. It must stay safe to redeploy
   at any time.
5. **No environment special-casing in app code.** Production is just another
   environment behind its gateway. `OAUTH_PROXY_PRODUCTION_URL` must be set
   explicitly per environment (no default — a wrong fallback sends GitHub a
   `redirect_uri` it rejects, which breaks login with a misleading GitHub-side
   error).
6. **Secrets are shared within a tier, never across tiers.**
   `OAUTH_PROXY_SECRET`, `GITHUB_RELAY_STATE_SECRET`, and
   `GITHUB_RELAY_WEBHOOK_SECRET` must be identical between a tier's gateway
   and its app deployments.
7. **`TRUSTED_TARGET_PATTERNS` (gateway var) is the allowlist** for both
   auth-redirect targets and webhook fan-out targets. Keep it tight; new
   hosting domains must be added here deliberately.
8. **Webhook receipt depends only on `GITHUB_RELAY_WEBHOOK_SECRET`.**
   `verifyGitHubWebhookSignature` deliberately does not use
   `getRequiredGitHubRelayEnv()` — an unrelated missing var must not 500 the
   webhook endpoint.
9. **The dedupe in `processWebhookEvent` is correct.** Convex mutations are
   serializable transactions; the read-then-insert on `deliveryId` cannot
   race. AI reviewers regularly flag this as a TOCTOU bug — it is not.
10. **Schema changes must consider deployed prod data.** Convex validates
    *existing documents* against the new schema on deploy. Before
    adding/removing fields on tables that prod writes to, check prod data
    (`npx convex data <table> --prod`); a stale field on one document blocks
    the entire deploy.

## Editing & deploying the gateway

```sh
cd workers/gateway
pnpm install
pnpm typecheck && pnpm test      # includes the version-lock test
npx wrangler deploy --env dev          # → kino-gateway-dev / gateway-dev.usekino.com
npx wrangler deploy --env production   # → kino-gateway / gateway.usekino.com
```

- The package is standalone (own lockfile) so it deploys independently of the
  app — that decoupling is the point of the architecture.
- Always deploy + verify on `--env dev` first; dev-tier auth/webhooks are
  fully exercisable without touching prod.
- Custom domains attach automatically on deploy; a **fresh** domain takes
  ~1–2 min to get its edge certificate (`SSL handshake failure` until then).
- Secrets (`wrangler secret put <NAME> --env <env>`, values in the gitignored
  `workers/gateway/secrets.<tier>.local` files): `OAUTH_PROXY_SECRET`,
  `BETTER_AUTH_SECRET` (gateway-local), `GITHUB_AUTH_CLIENT_ID`,
  `GITHUB_AUTH_CLIENT_SECRET`, `GITHUB_RELAY_STATE_SECRET`,
  `GITHUB_RELAY_WEBHOOK_SECRET`, `GATEWAY_ADMIN_TOKEN`.

### Verifying after a change

```sh
# Health + auth handler alive
curl https://gateway-dev.usekino.com/health            # {"ok":true,...}
curl -s -o /dev/null -w "%{http_code}" https://gateway-dev.usekino.com/api/auth/ok   # 200

# Headless sign-in probe from any app env (no browser needed):
URL="https://<app-env>"
curl -s "$URL/api/auth/sign-in/social" -X POST \
  -H "content-type: application/json" -H "origin: $URL" \
  --data "{\"provider\":\"github\",\"callbackURL\":\"$URL/auth\"}"
# → JSON url must contain redirect_uri=https://gateway[-dev].usekino.com/api/auth/callback/github
#   and a long (~2000 char) encrypted state. A short state or an app-origin
#   redirect_uri means the proxy is broken.

# Webhook fan-out (uses the tier webhook secret):
source workers/gateway/secrets.dev.local
BODY='{"action":"ping-test"}'
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$GITHUB_RELAY_WEBHOOK_SECRET" | awk '{print $2}')"
curl -s -X POST https://gateway-dev.usekino.com/hooks/github \
  -H "content-type: application/json" -H "x-github-event: ping" \
  -H "x-github-delivery: test-$(date +%s)" -H "x-hub-signature-256: $SIG" --data "$BODY"
# → {"forwardedTo":N,"ok":true}; rows appear in each target's githubWebhookDelivery table

# Registry inspection:
curl -H "Authorization: Bearer $GATEWAY_ADMIN_TOKEN" https://gateway-dev.usekino.com/hooks/targets
```

## Environment variable reference

### App (Convex deployments: dev, preview defaults, prod)

| Var | Meaning |
|---|---|
| `GITHUB_AUTH_CLIENT_ID` / `GITHUB_AUTH_CLIENT_SECRET` | tier Kino Auth OAuth app |
| `GITHUB_RELAY_APP_ID`, `GITHUB_RELAY_CLIENT_ID`, `GITHUB_RELAY_CLIENT_SECRET`, `GITHUB_RELAY_PRIVATE_KEY`, `GITHUB_RELAY_SLUG` | tier Kino Relay app |
| `GITHUB_RELAY_STATE_SECRET` | HMAC for the install trampoline's signed state (required, no fallback) |
| `GITHUB_RELAY_WEBHOOK_SECRET` | webhook HMAC |
| `GITHUB_RELAY_CALLBACK_TARGET_URL` | optional explicit install-callback target override |
| `OAUTH_PROXY_SECRET` | shared tier secret for proxy state/profile encryption |
| `OAUTH_PROXY_PRODUCTION_URL` | the tier gateway origin (required for the proxy to mount) |
| `AUTH_DEBUG=1` | (app Worker) opt-in structured auth flow logging |

Convex preview deployments inherit values from the dashboard's preview default
env vars — note these apply **at deployment creation**, not retroactively.

### Scripts / CI

| Var | Where | Meaning |
|---|---|---|
| `GATEWAY_URL` + `GATEWAY_ADMIN_TOKEN` | `.env.local` | local target registration on `pnpm dev` |
| `GATEWAY_URL_PREVIEW` + `GATEWAY_ADMIN_TOKEN_PREVIEW` | Workers Builds env | preview-branch builds (mapped by `scripts/cloudflare-build.sh`) |
| `GATEWAY_URL_PRODUCTION` + `GATEWAY_ADMIN_TOKEN_PRODUCTION` | Workers Builds env | main-branch builds |

The branch-suffixed split exists because Workers Builds env vars apply to all
branches; the mapping in `cloudflare-build.sh` makes cross-tier registration
structurally impossible.

## Ops appendix

### GitHub registration settings (per tier)

OAuth app (login): callback `https://<gateway>/api/auth/callback/github`.
GitHub App (sync): callback `https://<gateway>/github-relay/oauth-callback`;
webhook `https://<gateway>/hooks/github` with the tier webhook secret;
permissions Issues R/W, Discussions R/W, Metadata R; events Issues, Issue
comment, Discussion, Discussion comment; installable on any account.

⚠️ When URLs change (renames, new domains), update **both** the callback and
webhook URLs on **both** apps — a stale webhook URL fails with GitHub's
"failed to connect to host" in Recent Deliveries.

### Standing up a new tier

1. Register a new Kino Auth + Kino Relay pair pointing at the new gateway
   hostname.
2. Create `workers/gateway/secrets.<tier>.local` (5× `openssl rand -hex 32`
   for the shared secrets/tokens + the GitHub creds), add an env block to
   `wrangler.jsonc` (name, custom domain, `GATEWAY_ORIGIN`,
   `TRUSTED_TARGET_PATTERNS`, KV namespace via
   `wrangler kv namespace create TARGETS --env <tier>`).
3. `wrangler secret put` the seven secrets; deploy; `curl /health`.
4. Point the tier's Convex deployments at it (env table above).

### Rotating a shared secret

Update it in lockstep: GitHub (if it's the webhook secret) → gateway secret →
all tier Convex deployments (+ preview defaults). In-flight OAuth states
signed with the old secret fail until users restart sign-in; that's expected.
