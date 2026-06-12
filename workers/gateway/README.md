# kino-gateway

Tiny per-tier Cloudflare Worker owning the stable URLs GitHub needs, so the
app's release cadence is decoupled from GitHub's registered URLs. Deployed as
`kino-gateway-dev` (dev tier: previews + Portless/local) and `kino-gateway`
(prod tier).

Routes:

- `GET/POST /api/auth/*` — Better Auth `oAuthProxy` production leg for GitHub
  login. Runs a DB-less better-auth instance; **must stay version-pinned to
  the app's better-auth** (encrypted payload formats must match).
- `GET /github-relay/oauth-callback` — GitHub App install/authorize trampoline:
  verifies the HMAC-signed state minted by `convex/lib/github.ts`, then 302s
  to the originating environment.
- `POST /hooks/github` — GitHub App webhook intake: verifies
  `X-Hub-Signature-256`, fans out the raw delivery to registered targets.
- `GET/PUT/DELETE /hooks/targets` — bearer-token registry of fan-out targets
  (KV, 14-day TTL). Used by `scripts/gateway-webhook-target.mjs` in the app repo.

Full setup/ops runbook: `docs/github-environments.md` in the repo root.

```sh
pnpm install
pnpm typecheck && pnpm test
pnpm deploy:dev          # wrangler deploy --env dev
pnpm deploy:production   # wrangler deploy --env production
```

This package is intentionally standalone (own lockfile, not part of the app
build) so it can be deployed independently and rarely.
