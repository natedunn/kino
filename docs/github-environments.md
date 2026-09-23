# GitHub Integration & Gateway Architecture

Canonical reference for how Kino talks to GitHub across environments.
**Read this before editing anything in `workers/gateway/`, the auth proxy
flow, or the webhook pipeline.** The Invariants section exists because each
item was learned the hard way; violating them produces failures that pass
every local test and only break in deployed OAuth flows.

## Naming scheme

Three things, three names — used consistently in env vars, URLs, code, docs:

| Name                   | What it is                                                     | Env prefix       |
| ---------------------- | -------------------------------------------------------------- | ---------------- |
| **Kino Auth** (+ Dev)  | GitHub **OAuth app** — native Convex Auth user login           | `GITHUB_AUTH_*`  |
| **Kino Relay** (+ Dev) | **GitHub App** — org/repo sync, installations, webhooks        | `GITHUB_RELAY_*` |
| **Gateway**            | Per-tier Cloudflare Worker owning the stable URLs GitHub needs | `GATEWAY_*`      |

Two tiers, fully isolated:

|                      | Production tier                        | Dev tier                                                      |
| -------------------- | -------------------------------------- | ------------------------------------------------------------- |
| App environments     | usekino.com + prod Convex              | every CF preview, Portless worktree, Convex dev deployment    |
| GitHub registrations | Kino Auth, Kino Relay                  | Kino Auth Dev, Kino Relay Dev                                 |
| Gateway              | `kino-gateway` → `gateway.usekino.com` | `kino-gateway-dev` → `gateway-dev.usekino.com`                |
| Secrets              | prod-only, never on dev machines       | dev-only, in `workers/gateway/secrets.dev.local` (gitignored) |

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
  ├─ /api/auth/*                   Temporary Better Auth rollback proxy
  │                                  └─ redirect rewritten to the legacy app origin
  ├─ /oauth/state                 Native Convex Auth signed-state registration
  ├─ /oauth/github/callback       Native GitHub return via single-use state
  ├─ /github-relay/oauth-callback  Kino Relay signed-state trampoline
  ├─ /hooks/github                 webhook intake: verify HMAC → fan out
  ├─ /hooks/targets                bearer-token registry of fan-out targets (KV)
        ├─ https://<prod>.convex.site/api/github/webhook
        ├─ https://<preview>.convex.site/api/github/webhook
        └─ https://<local-dev>.convex.site/api/github/webhook
  └─ /dev/share-origins            dev-only exact Quick Tunnel origin registry
```

Ordinary anonymous Convex development stays loopback-only and skips webhook
registration. `pnpm dev:share` temporarily tunnels the app plus the local
Convex cloud/site endpoints and registers only that session's exact app and
site origins in the dev gateway.

## Native login flow

1. The Start Worker asks its native Convex deployment to begin GitHub OAuth,
   preserving the provider state in a short-lived HttpOnly cookie.
2. The Start Worker signs that provider state with the deployment's fixed or
   branch-derived route ID and route secret, then registers the envelope at
   `POST /oauth/state`.
3. The gateway stores the envelope
   in a ten-minute SQLite Durable Object and sends GitHub a 43-character opaque
   reference.
4. GitHub returns to `GET /oauth/github/callback`. The gateway consumes the
   reference once, forwards only the callback fields to the exact native Convex
   site URL, and permits a redirect only to the exact registered Start callback.
5. The Start callback completes the native session and sets secure HttpOnly
   cookies on the app origin.

Production uses a fixed static route in `NATIVE_GITHUB_ROUTES`. Dev previews
use the authenticated, expiring route registry. The current production Kino Auth
registration remains on the legacy `/api/auth/callback/github` path until the
coordinated cutover changes it to `/oauth/github/callback`.

### Temporary legacy rollback flow

The gateway retains `/api/auth/*`, its pinned Better Auth proxy, and the
load-bearing redirect rewrite during the production acceptance window. These
exist only to recover the prelaunch app before native writes are accepted. They
are not dependencies of the native Kino application.

## Webhook flow

1. GitHub posts to `/hooks/github` on the tier gateway.
2. The gateway verifies `X-Hub-Signature-256` against the tier
   `GITHUB_RELAY_WEBHOOK_SECRET`, then forwards the **raw body with the
   original signature** to every registered target (`workers/gateway/src/hooks.ts`).
3. Each target (`POST /api/github/webhook`, `convex/native/http.ts`)
   re-verifies the HMAC, dedupes on `X-GitHub-Delivery` (the
   `githubWebhookDelivery` table), and dispatches by event type in
   the native Relay functions. Receiving events for
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

1. **The legacy proxy dependency stays exact and gateway-local.**
   `workers/gateway/package.json` pins Better Auth while `/api/auth/*` remains
   available for rollback. `workers/gateway/src/version-lock.test.ts` checks
   that the installed proxy reports that exact standalone package version. The
   native app has no Better Auth dependency and does not share this version
   lock. Deploy and verify the gateway whenever its pin changes.
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
4. **Gateway state is bounded but real.** The Better Auth proxy holds no
   sessions or database state; KV holds the fan-out target registry and
   expiring dev share origins. Native GitHub OAuth additionally stores a
   single-use, at-most-ten-minute routing envelope in a SQLite Durable Object.
   Redeployment preserves the object namespace, but an in-flight login must
   restart if its route/key is removed or its callback cannot be handled by the
   new version. Do not assume a Worker rollback restores object data.
5. **No environment special-casing in app code.** Production is another exact
   route behind its gateway. Native callback, route ID, route key, Convex site,
   and app origin must all describe the same environment. The legacy
   `OAUTH_PROXY_PRODUCTION_URL` remains explicit only while the rollback proxy
   exists.
6. **Secrets are shared within a tier, never across tiers.** A native route key
   must match only its Start Worker and gateway route. Relay state/webhook
   secrets must match the tier's gateway and native Convex deployment. The
   legacy `OAUTH_PROXY_SECRET` remains tier-scoped only during rollback support.
7. **Target trust stays exact or deliberately patterned.**
   `TRUSTED_TARGET_PATTERNS` is the static allowlist for auth redirects and
   webhook targets. The dev-only `/dev/share-origins` registry adds exact
   `*.trycloudflare.com` origins for an active `pnpm dev:share` session, guarded
   by `GATEWAY_ADMIN_TOKEN`, refreshed hourly, and expired from KV after six
   hours. Production never enables this endpoint. Do not add a permanent
   `*.trycloudflare.com` wildcard.
8. **Webhook receipt depends only on `GITHUB_RELAY_WEBHOOK_SECRET`.**
   `verifyGitHubWebhookSignature` deliberately does not use
   `getRequiredGitHubRelayEnv()` — an unrelated missing var must not 500 the
   webhook endpoint.
9. **The dedupe in `processWebhookEvent` is correct.** Convex mutations are
   serializable transactions; the read-then-insert on `deliveryId` cannot
   race. AI reviewers regularly flag this as a TOCTOU bug — it is not.
10. **Schema changes must consider deployed prod data.** Convex validates
    _existing documents_ against the new schema on deploy. Before
    adding/removing fields on tables that prod writes to, check prod data
    (`npx convex data <table> --prod`); a stale field on one document blocks
    the entire deploy.

## Editing & deploying the gateway

```sh
cd workers/gateway
pnpm install
pnpm typecheck && pnpm test      # includes the standalone Better Auth pin test
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

# Dev Quick Tunnel support probe (must return {"enabled":true}):
curl -H "Authorization: Bearer $GATEWAY_ADMIN_TOKEN" https://gateway-dev.usekino.com/dev/share-origins
```

## Environment variable reference

### Native app (Convex deployments: dev, preview defaults, prod)

The native backend requires these values on every target before deployment:
`AUTH_PRIVATE_KEY`, `AUTH_JWKS`, `AUTH_GITHUB_CLIENT_ID`,
`AUTH_GITHUB_CLIENT_SECRET`, `AUTH_GITHUB_CALLBACK_URL`, and
`AUTH_APP_ORIGIN`. Preview deployments inherit the shared credentials from the
Convex project's preview defaults when they are created. The build then writes
the branch-specific `AUTH_APP_ORIGIN` and the tier callback directly to that
preview before pushing application code. This ordering matters: an origin from
another branch passes type validation but makes OAuth redirects and email links
point at the wrong app.

| Var                                                                                                                            | Meaning                                                                |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `AUTH_GITHUB_CLIENT_ID` / `AUTH_GITHUB_CLIENT_SECRET`                                                                          | tier Kino Auth OAuth app used by native Convex Auth                    |
| `GITHUB_RELAY_APP_ID`, `GITHUB_RELAY_CLIENT_ID`, `GITHUB_RELAY_CLIENT_SECRET`, `GITHUB_RELAY_PRIVATE_KEY`, `GITHUB_RELAY_SLUG` | tier Kino Relay app                                                    |
| `GITHUB_RELAY_STATE_SECRET`                                                                                                    | HMAC for the install trampoline's signed state (required, no fallback) |
| `GITHUB_RELAY_WEBHOOK_SECRET`                                                                                                  | webhook HMAC                                                           |
| `GITHUB_RELAY_CALLBACK_TARGET_URL`                                                                                             | optional explicit install-callback target override                     |
| `NATIVE_GITHUB_GATEWAY_URL` / route ID / route secret                                                                          | Start Worker native OAuth routing; route secret is a Worker secret     |
| `AUTH_DEBUG=1`                                                                                                                 | (app Worker) opt-in structured auth flow logging                       |

The production gateway also retains `GITHUB_AUTH_CLIENT_ID`,
`GITHUB_AUTH_CLIENT_SECRET`, `OAUTH_PROXY_SECRET`, and
`OAUTH_PROXY_PRODUCTION_URL` while the legacy rollback proxy is available.

Convex preview deployments inherit values from the dashboard's preview default
env vars — note these apply **at deployment creation**, not retroactively.

### Scripts / CI

| Var                                                         | Where                 | Meaning                                                                 |
| ----------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------- |
| `GATEWAY_URL` + `GATEWAY_ADMIN_TOKEN`                       | `.env.local`          | local target registration on `pnpm dev`                                 |
| `GATEWAY_URL_PREVIEW` + `GATEWAY_ADMIN_TOKEN_PREVIEW`       | Workers Builds env    | preview-branch builds (mapped by `scripts/cloudflare-build.sh`)         |
| `GATEWAY_URL_PRODUCTION` + `GATEWAY_ADMIN_TOKEN_PRODUCTION` | Workers Builds env    | main-branch builds                                                      |
| `NATIVE_APP_ORIGIN_PRODUCTION`                              | Workers Builds env    | exact production Start Worker origin                                    |
| `NATIVE_APP_PREVIEW_HOST_SUFFIX`                            | Workers Builds env    | preview host suffix after `<alias>-`, e.g. `kino.hello-fc8.workers.dev` |
| `NATIVE_GITHUB_GATEWAY_URL_PREVIEW` / `_PRODUCTION`         | Workers Builds env    | exact native `/oauth/github/callback` URL                               |
| `NATIVE_GITHUB_ROUTE_ID_PRODUCTION`                         | Workers Builds env    | fixed production opaque-state route ID                                  |
| `NATIVE_GITHUB_ROUTE_SECRET_PREVIEW` / `_PRODUCTION`        | Workers Builds secret | opaque-state route signing secret for the tier                          |
| `CONVEX_PROD_DEPLOY_KEY`                                    | Workers Builds secret | distinct native production deployment key                               |
| `CONVEX_MANAGEMENT_TOKEN`                                   | Workers Builds secret | management token used to create/reuse and provision branch previews     |
| `CONVEX_PREVIEW_DEPLOY_KEY`                                 | Workers Builds secret | project preview key used by `convex deploy --preview-name`              |
| `CONVEX_TEAM_SLUG` / `CONVEX_PROJECT_SLUG`                  | Workers Builds env    | exact project selector used by preview provisioning                     |

The branch-suffixed split exists because Workers Builds env vars apply to all
branches; the mapping in `cloudflare-build.sh` makes cross-tier registration
structurally impossible. Cloudflare Worker Previews isolate preview runtime
settings and receive the route signing key through Wrangler's secrets file.
Cloudflare's stable preview URL is derived as
`https://<40-character-normalized-alias>-<NATIVE_APP_PREVIEW_HOST_SUFFIX>`;
Convex keeps its independently normalized 48-character preview reference. The
build uses the management token because the current Convex CLI cannot authorize
a specific preview for environment updates with either a preview deploy key or
a project deploy key. It then deploys using the project preview key. Shared
secrets stay in Convex preview defaults and are
never copied through shell arguments. Convex validates all six required
deployment variables during its push.

Each preview's route ID is `preview-` plus the first 40 hex characters of the
SHA-256 hash of its exact app origin. The build registers that route with the
dev gateway's authenticated `/oauth/routes/:id` API, including the exact
Convex and app callback URLs. Routes expire after 14 days unless a build renews
them. The Start Worker derives the same ID from the request origin, while the
shared preview secret is uploaded as a Worker Preview secret. Production keeps
its explicit route ID and static gateway route.

The `kino` Worker uses Cloudflare Worker Previews (`wrangler preview`, Wrangler
4.135 or newer) rather than aliased production versions. Workers Builds runs
`pnpm run deploy:preview`, which invokes `npx wrangler preview` using the
generated server bundle. This CLI path published the branch preview without
switching the Worker's dashboard preview model; the dashboard's separate
one-time switch is not required for this rollout. The preview's gateway URL is
declared in `wrangler.jsonc` under `previews.vars`, and the build supplies its
signing key through `--secrets-file`. Preview settings do not inherit production
settings.

Production uses `wrangler deploy --keep-vars`. The suffixed Workers Builds
values are build inputs and validation; they do not create runtime bindings on
the deployed `kino` Worker. Before release, separately set and verify runtime
`NATIVE_GITHUB_GATEWAY_URL`, `NATIVE_GITHUB_ROUTE_ID`, and secret
`NATIVE_GITHUB_ROUTE_SECRET` on that Worker. The production gateway's static
`NATIVE_GITHUB_ROUTES` entry must use the same route ID/key and exact native
Convex/app callbacks.

Set the preview defaults for `AUTH_PRIVATE_KEY`, `AUTH_JWKS`,
`AUTH_GITHUB_CLIENT_ID`, and `AUTH_GITHUB_CLIENT_SECRET` before enabling the
build. `AUTH_GITHUB_CALLBACK_URL` may also have the dev gateway value as a
default, but CI overwrites it on the exact target. Do not set
`AUTH_APP_ORIGIN` as a shared preview default; every branch has a different
Cloudflare alias.

`QUICK_TUNNEL_TARGETS_ENABLED=true` is a non-secret gateway variable present
only in the dev environment. Deploy the dev gateway before releasing app-side
`pnpm dev:share` changes; the command deliberately fails its support probe when
the endpoint is absent. Never add the variable to production.

## Ops appendix

### GitHub registration settings (per tier)

OAuth app (native login): callback `https://<gateway>/oauth/github/callback`.
Before cutover, production still uses the rollback callback
`https://<gateway>/api/auth/callback/github`; change it only at the coordinated
release point.
GitHub App (sync): callback `https://<gateway>/github-relay/oauth-callback`;
webhook `https://<gateway>/hooks/github` with the tier webhook secret;
permissions Issues R/W, Discussions R/W, Metadata R; events Issues, Issue
comment, Discussion, Discussion comment; installable on any account.

⚠️ When URLs change (renames, new domains), update **both** the callback and
webhook URLs on **both** apps — a stale webhook URL fails with GitHub's
"failed to connect to host" in Recent Deliveries.

### Standing up a new tier

1. Register a new Kino Auth + Kino Relay pair pointing at the new gateway
   hostname. Use `/oauth/github/callback` for native Kino Auth.
2. Create `workers/gateway/secrets.<tier>.local` (5× `openssl rand -hex 32`
   for the shared secrets/tokens + the GitHub creds), add an env block to
   `wrangler.jsonc` (name, custom domain, `GATEWAY_ORIGIN`,
   `TRUSTED_TARGET_PATTERNS`, KV namespace via
   `wrangler kv namespace create TARGETS --env <tier>`).
3. `wrangler secret put` the gateway secrets, including a static production
   `NATIVE_GITHUB_ROUTES` mapping when applicable; deploy; `curl /health`.
4. Point the tier's Convex deployments at it (env table above).

### Rotating a shared secret

Update it in lockstep: GitHub (if it's the webhook secret) → gateway secret →
all tier Convex deployments (+ preview defaults). In-flight OAuth states
signed with the old secret fail until users restart sign-in; that's expected.

## Auth release gate and September 2026 incident

**Merging the app PR does not deploy either gateway.** Cloudflare's `kino`
Workers Build deploys Convex and the app Worker. `kino-gateway` and
`kino-gateway-dev` are standalone packages with separate deployments. The
repository version-lock test checks the gateway's standalone package only; it
cannot establish which library version is running on Cloudflare.

On September 19, 2026, production sign-in initiation succeeded but the return
callback failed in `generated/auth:findOne`: the `issuer` filter had no `value`.
The app expected Better Auth 1.7.1's account issuer, while the production gateway
still ran a June 12 deployment predating the package upgrade. Removing expired
verification cleanup from sign-in did not repair that deployment mismatch.

The gateway now reports `betterAuthVersion` from the bundled OAuth proxy plugin
in its uncached `/health` response. `scripts/cloudflare-build.sh` checks the
appropriate tier with `scripts/check-gateway-auth-version.mjs` **before invoking
Convex deploy**, so mismatch, missing version, or unreachable health stops the
release before it changes Convex. This check does not deploy the gateway.

### Rollout order (including first installation of this gate)

1. Install the standalone gateway package with
   `pnpm --dir workers/gateway install --frozen-lockfile`; run its typecheck and
   tests. Native app dependencies do not participate in the legacy proxy pin.
2. Deploy the reviewed gateway to dev first, then check:
   `node scripts/check-gateway-auth-version.mjs https://gateway-dev.usekino.com`.
3. Exercise native GitHub login on a matching app preview through
   `/oauth/github/callback`, session creation, and a protected page. Synthetic
   callback tests do not replace a real GitHub exchange against the deployed
   Convex backend.
4. With production deployment authorization, first run
   `pnpm --dir workers/gateway run deploy:stage:production`. Record that
   migration-bearing legacy version and verify legacy login plus Relay; it is the
   compatible rollback point across the Durable Object migration.
5. Configure the reviewed static `NATIVE_GITHUB_ROUTES` secret, deploy the active
   gateway with `pnpm --dir workers/gateway run deploy:production`, then run
   `node scripts/check-gateway-auth-version.mjs https://gateway.usekino.com`.
   Confirm the active version with `wrangler deployments list --env production`
   from `workers/gateway`. Preserve the legacy proxy, redirect rewrite, and
   Relay paths through the acceptance window.
6. Change the production Kino Auth OAuth callback to
   `https://gateway.usekino.com/oauth/github/callback`, release the app/Convex
   changes, and complete a real production GitHub login.
   Inspect Convex callback logs and verify the signed-in protected page. Record
   the gateway deployment ID, app commit, and auth versions in the release notes.

The version check now verifies the separately deployed gateway matches this
checkout; it is no longer an app/gateway dependency lock. Keep the legacy proxy
route unchanged for rollback until the native cutover is accepted. This PR
alone cannot repair the live gateway until its separate rollout is performed.
