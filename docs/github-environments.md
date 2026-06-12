# GitHub Multi-Environment Architecture

Last updated: June 11, 2026.

## Naming scheme

Three things, three names — used consistently across env vars, URLs, code,
and docs:

| Name | What it is | Env prefix |
|---|---|---|
| **Kino Auth** | GitHub **OAuth app** used for user login (Better Auth) | `GITHUB_AUTH_*` |
| **Kino Relay** | **GitHub App** used for org/repo sync (installations, issues, discussions, webhooks) | `GITHUB_RELAY_*` |
| **Gateway** | Per-tier Cloudflare Worker that owns the stable URLs GitHub needs | `GATEWAY_*` |

## The problem this solves

GitHub imposes hard limits: OAuth apps have one callback URL, GitHub Apps have
one webhook URL. Previously all of these pointed at production
(`usekino.com`), which meant auth changes had to ship to prod before they
could be tested anywhere, and webhooks could only reach prod.

The fix has two halves:

1. **Two tiers of GitHub registrations.** The prod Kino Auth + Kino Relay
   apps are used only by `usekino.com`. A second pair — **Kino Auth Dev** and
   **Kino Relay Dev** — is used by every Cloudflare preview, every Portless
   worktree, and every Convex dev/preview deployment. Prod secrets never
   leave prod.
2. **A gateway Worker per tier** (`workers/gateway`, deployed as
   `kino-gateway` and `kino-gateway-dev`) that owns the stable URLs:
   - Better Auth `oAuthProxy` production leg (Kino Auth callback).
   - Kino Relay install/authorize signed-state trampoline.
   - Kino Relay webhook intake + fan-out to registered environment targets.

   The gateway is deployed independently of the app and changes rarely, so
   the app's release cadence is no longer coupled to GitHub's registered URLs.

```
GitHub (dev tier: Kino Auth Dev + Kino Relay Dev)
  │  callbacks / webhook (single stable URLs)
  ▼
kino-gateway-dev (gateway-dev.usekino.com)
  ├─ /api/auth/*                  oAuthProxy leg → 302 to origin env
  ├─ /github-relay/oauth-callback verify signed state → 302 to origin env
  └─ /hooks/github                verify HMAC → fan out to registered targets
                                    ├─ https://<preview>.convex.site/api/github/webhook
                                    └─ https://<local-dev>.convex.site/api/github/webhook
```

Key insight: every Convex deployment — including local `npx convex dev` — has
a publicly reachable `*.convex.site` URL, so webhook fan-out reaches local dev
directly. No tunnels, and Portless's localhost restriction is irrelevant.

## Setup

Follow `docs/gateway-setup-checklist.md` step by step. Everything below is
reference material.

## Environment variables

### Convex deployments (dev, preview defaults, prod)

| Var | What |
|---|---|
| `GITHUB_AUTH_CLIENT_ID` / `GITHUB_AUTH_CLIENT_SECRET` | tier Kino Auth OAuth app |
| `GITHUB_RELAY_APP_ID` | tier Kino Relay app id |
| `GITHUB_RELAY_CLIENT_ID` / `GITHUB_RELAY_CLIENT_SECRET` | tier Kino Relay client creds |
| `GITHUB_RELAY_PRIVATE_KEY` | tier Kino Relay private key (PEM) |
| `GITHUB_RELAY_SLUG` | tier Kino Relay slug (install URL) |
| `GITHUB_RELAY_STATE_SECRET` | HMAC secret for the signed-state trampoline |
| `GITHUB_RELAY_WEBHOOK_SECRET` | webhook HMAC secret |
| `GITHUB_RELAY_CALLBACK_TARGET_URL` | optional explicit callback target override |
| `OAUTH_PROXY_SECRET` | shared within the tier (app envs + gateway) |
| `OAUTH_PROXY_PRODUCTION_URL` | the tier gateway origin |

There are **no legacy fallbacks**; the old `GITHUB_CLIENT_*` / `GITHUB_APP_*`
names are gone.

### Scripts / CI only (`.env.local`, Workers Builds env — never read by Convex functions)

| Var | What |
|---|---|
| `GATEWAY_URL` | tier gateway origin, e.g. `https://gateway-dev.usekino.com` |
| `GATEWAY_ADMIN_TOKEN` | bearer token for the gateway target registry |

Both optional: absent → webhook target registration is a silent no-op.

### Gateway Worker (wrangler secrets + vars per env)

Secrets: `OAUTH_PROXY_SECRET`, `BETTER_AUTH_SECRET` (gateway-local),
`GITHUB_AUTH_CLIENT_ID`, `GITHUB_AUTH_CLIENT_SECRET`,
`GITHUB_RELAY_STATE_SECRET`, `GITHUB_RELAY_WEBHOOK_SECRET`,
`GATEWAY_ADMIN_TOKEN`.
Vars (in `wrangler.jsonc`): `GATEWAY_ORIGIN`, `TRUSTED_TARGET_PATTERNS`.

## How webhook targets are managed

- The gateway keeps a KV registry of target URLs (14-day TTL, refreshed on
  every registration). All entries receive every delivery with the original
  `X-Hub-Signature-256`; each environment re-verifies the HMAC and ignores
  events for installations it doesn't know — normal under the broadcast model.
- Registration is automatic and best-effort (missing gateway env vars = no-op):
  - `scripts/cloudflare-vite-build.sh` registers during `convex deploy --cmd`
    builds (previews and prod).
  - `scripts/dev-supervisor.mjs` registers the local dev deployment on
    `pnpm dev`.
  - `scripts/cleanup-convex-preview.mjs` and
    `scripts/cleanup-stale-convex-previews.mjs` unregister before deleting.
  - Manual: `pnpm gateway:webhook:register` / `pnpm gateway:webhook:unregister`.
- The in-app receiver is `POST /api/github/webhook`
  (`convex/functions/githubRoutes.ts`): verifies the HMAC, dedupes on
  `X-GitHub-Delivery`, and currently processes `installation` lifecycle events
  (deleted/suspend/unsuspend/new_permissions_accepted). Issues/discussions
  sync handlers extend `processWebhookEvent` in `convex/functions/github.ts`.

## Login flow (all tiers, identical shape)

1. Env starts sign-in; `oAuthProxy` rewrites the GitHub `redirect_uri` to the
   tier gateway (`OAUTH_PROXY_PRODUCTION_URL`).
2. GitHub redirects to the gateway. The gateway's pinned better-auth instance
   (same version as the app — see `workers/gateway/src/auth.ts`) decrypts the
   proxy state with the shared tier `OAUTH_PROXY_SECRET`, exchanges the code,
   fetches the profile, and 302s back to the originating env's
   `/api/auth/oauth-proxy-callback` with the encrypted profile.
3. The originating env creates its own session cookies.

The gateway never persists anything (memory adapter); it holds no sessions.

## Invariants to keep

- `workers/gateway` better-auth version must equal the app's better-auth
  version (kitcn pins it as an exact peer dep — when kitcn upgrades, bump the
  gateway to match; `workers/gateway/src/version-lock.test.ts` enforces this).
- `OAUTH_PROXY_SECRET`, `GITHUB_RELAY_STATE_SECRET`, and
  `GITHUB_RELAY_WEBHOOK_SECRET` are shared within a tier, never across tiers.
- Gateway `TRUSTED_TARGET_PATTERNS` is the allowlist for both auth trampoline
  targets and webhook fan-out targets; keep it tight.

See also: `docs/auth-oauth-proxy.md` (historical notes on the prod-anchored
proxy flow this replaces).
