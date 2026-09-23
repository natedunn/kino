# kino-gateway

Per-tier Cloudflare Worker that owns the stable URLs GitHub needs, decoupling
the app's release cadence from GitHub's one-callback / one-webhook limits.
Deployed as `kino-gateway-dev` (`gateway-dev.usekino.com`, used by previews +
Portless/local) and `kino-gateway` (`gateway.usekino.com`, production).

**Before editing, read `docs/github-environments.md` in the repo root** —
especially its Invariants section (standalone better-auth pin, the load-bearing
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
- `GET/PUT/DELETE /dev/share-origins` — dev-only, bearer-protected registry of
  exact temporary `trycloudflare.com` origins used by `pnpm dev:share` (KV,
  6-hour TTL). Disabled in production.
- `GET /health` — liveness.
- `POST /oauth/state` and `GET /oauth/github/callback` — native Convex Auth
  GitHub login. A signed, per-preview routing envelope stays in a short-lived
  SQLite Durable Object; GitHub sees only a 43-character opaque reference.
  The native endpoints return 503 until `NATIVE_GITHUB_ROUTES` is configured.

```sh
pnpm install
pnpm types
pnpm typecheck && pnpm test # includes the standalone better-auth pin test

pnpm deploy:preview         # always verify on the shared dev/preview tier first
curl https://gateway-dev.usekino.com/health

pnpm deploy:production
curl https://gateway.usekino.com/health
```

Secrets live in the gitignored `secrets.dev.local` / `secrets.production.local`
files here and are pushed with `wrangler secret put <NAME> --env <env>`. This
package is intentionally standalone (own lockfile, not part of the app build)
so it deploys independently and rarely.

## Native OAuth rollout and rollback

`NATIVE_GITHUB_ROUTES` is a tier-specific Wrangler secret containing a JSON
object keyed by route ID. Each value has `backendCallback`, `appCallback`, and
`secret`. Both callbacks must be exact HTTPS URLs with paths
`/oauth/github/callback` (Convex site) and `/api/auth/github/callback` (app).
The route ID and secret must match the Start Worker's
`NATIVE_GITHUB_ROUTE_ID` and `NATIVE_GITHUB_ROUTE_SECRET`. Never put this JSON
in `wrangler.jsonc`, a command argument, or a log. Use interactive
`wrangler secret put NATIVE_GITHUB_ROUTES --env dev` after preparing the value
in a gitignored local file. The native Convex deployment must advertise
`AUTH_GITHUB_CALLBACK_URL=https://gateway-dev.usekino.com/oauth/github/callback`.

For branch previews, the dev gateway also accepts expiring routes through its
admin API. This uses the existing `TARGETS` KV binding and
`GATEWAY_ADMIN_TOKEN`; it is unavailable in production. After creating the
Convex preview and learning its `.convex.site` URL, CI registers its exact
callback pair before publishing the app. Send a private JSON file containing
`backendCallback`, `appCallback`, and `secret` as the request body:

```sh
curl -X PUT "https://gateway-dev.usekino.com/oauth/routes/<preview-route-id>" \
  -H "Authorization: Bearer $GATEWAY_ADMIN_TOKEN_PREVIEW" \
  -H 'Content-Type: application/json' \
  --data-binary @<private-route-json-file>
```

The route ID must contain only lowercase letters, digits, and hyphens (at most
64 characters). The backend must be an exact `.convex.site` callback, and the
app must be an exact `*.workers.dev` callback allowed by the dev gateway's
`TRUSTED_TARGET_PATTERNS`. The shared preview signing secret must be at least
32 characters and match the Start Worker's runtime secret. `GET` on the same
URL returns only the callback URLs for verification; `DELETE` removes the route.
All three methods require the admin token. A `PUT` renews the route's 14-day
TTL. KV writes can take time to reach every edge location, so CI should verify
the registered route and allow a brief propagation window before a browser
sign-in check. The static secret map remains a fallback for existing routes.

The new `OAuthState` Durable Object class is a Cloudflare migration boundary:
Cloudflare cannot roll back to a version published before its class migration.
Deploy a migration-bearing version that serves only legacy routes first, then
record its version ID. Do this on dev and rehearse the complete login and
rollback before considering production.

```sh
pnpm install --frozen-lockfile --ignore-workspace
pnpm typecheck && pnpm test
pnpm exec wrangler deploy src/stage.ts --config wrangler.jsonc --env dev --dry-run
pnpm deploy:stage:dev
pnpm exec wrangler deployments list --env dev # record the stage version ID
curl -fsS https://gateway-dev.usekino.com/health # storage true, enabled false

# Configure exact dev routes with interactive secret input, then record the
# resulting stage version ID: a secret update itself publishes a Worker version.
pnpm exec wrangler secret put NATIVE_GITHUB_ROUTES --env dev
pnpm exec wrangler deployments list --env dev
pnpm deploy:dev
curl -fsS https://gateway-dev.usekino.com/health # storage true, enabled true
pnpm exec wrangler deployments list --env dev # record the active version ID

# Rehearsal rollback target is the stage version after the secret update.
pnpm exec wrangler rollback <stage-version-id> --env dev
curl -fsS https://gateway-dev.usekino.com/health # storage true, enabled false
```

The stage entrypoint exports the same Durable Object class and retains the
existing Better Auth, Relay, and webhook routes. The active entrypoint adds
native routes without altering those paths. Health keeps `betterAuthVersion`
and adds `nativeGithub.protocol`, `storage`, and `enabled`; it never exposes
route IDs, callback URLs, or secrets. A production rollout uses the identical
sequence with `--env production` and `deploy:stage:production` /
`deploy:production`, after the matching app and Convex release is ready.
Preserve the recorded stage version as the gateway rollback target. Cloudflare
rollback does not restore connected resource data; users with an in-flight
native login must restart it. App and backend rollback must use their own
matching, tested versions.
