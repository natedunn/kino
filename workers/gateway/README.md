# kino-gateway

Per-tier Cloudflare Worker that owns the stable URLs GitHub needs, decoupling
the app's release cadence from GitHub's one-callback / one-webhook limits.
Deployed as `kino-gateway-dev` (`gateway-dev.usekino.com`, used by previews +
Portless/local) and `kino-gateway` (`gateway.usekino.com`, production).

**Before editing, read `docs/github-environments.md` in the repo root** —
especially its Invariants section (better-auth version lock, the load-bearing
redirect rewrite, the memoryAdapter bundling trap).

Routes:

- `/api/auth/*` — Better Auth `oAuthProxy` production leg for GitHub login
  (`src/auth.ts`), with the proxy-callback redirect rewritten onto the app
  origin (`src/redirect-rewrite.ts`).
- `GET /github-relay/oauth-callback` — Kino Relay (GitHub App)
  install/authorize trampoline: verifies the HMAC-signed state minted by
  `convex/lib/github.ts`, 302s to the originating environment
  (`src/github-relay.ts`).
- `POST /hooks/github` — webhook intake: verifies `X-Hub-Signature-256`, fans
  the raw delivery out to registered targets (`src/hooks.ts`).
- `GET/PUT/DELETE /hooks/targets` — bearer-token registry of fan-out targets
  (KV, 14-day TTL). Driven by `scripts/gateway-webhook-target.mjs` in the app
  repo.
- `GET /health` — liveness.

```sh
pnpm install
pnpm typecheck && pnpm test            # includes the better-auth version-lock test
npx wrangler deploy --env dev          # always verify on dev tier first
npx wrangler deploy --env production
```

Secrets live in the gitignored `secrets.dev.local` / `secrets.production.local`
files here and are pushed with `wrangler secret put <NAME> --env <env>`. This
package is intentionally standalone (own lockfile, not part of the app build)
so it deploys independently and rarely.
