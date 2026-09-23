# Native Convex cutover and recovery runbook

Status: **release-candidate preview validated; production cutover not yet
authorized**. Updated September 22, 2026 (America/Mexico City).

This runbook covers one coordinated release unit: the native Convex deployment,
Kino Start Worker, Kino Files Worker, production OAuth gateway, GitHub OAuth app,
and Kino Relay continuity. PR #154 is native-only: root `convex.json` targets
`convex/native`, and the app no longer contains a Kitcn runtime or auth feature
flag. Better Auth remains only in the standalone gateway as a temporary legacy
proxy during the acceptance window.

Kino is prelaunch and has no legacy-user or product-data migration requirement.
Use a distinct native production Convex deployment. Once native writes are
accepted, the separate legacy database is not a rollback target; recovery is a
forward fix on the native stack.

## Current release-candidate evidence

The PR branch now builds an isolated Cloudflare Worker Preview and a matching
Convex preview. CI writes the branch-specific app origin and dev-gateway callback
to that exact Convex preview, rejects placeholder GitHub credentials, registers
an expiring branch-specific OAuth route, and publishes the route key as a Worker
Preview secret. Real GitHub sign-in returned to `/dashboard`, and reload remained
authenticated. The Cloudflare build and `pnpm run verify:pr` pass.

Earlier disposable proofs remain useful historical evidence:

- The native app Worker was rolled back one version and restored. Anonymous
  route behavior passed at both versions.
- The shared dev gateway staged the SQLite Durable Object while preserving
  legacy behavior, activated dual-protocol routing, rolled back to the
  migration-compatible stage, and restored native routing.
- Real GitHub login, private SSR, reload, sign-out, repeat identity, malformed
  state, wrong-secret rejection, single-use consumption, and replay rejection
  passed on the shared dev gateway.
- Native Files, cache purge, Relay webhook transport/deduplication, issue linking,
  and cleanup passed against disposable resources.

Those checks do not authorize production and do not replace the final PR-preview
acceptance list in `native-convex-migration-status.md`.

## Freeze the release

Record these values without recording secret contents:

- app commit and expected `kino` Worker version;
- native production Convex cloud/site URLs and deployment identifier;
- Files Worker version, route, `NATIVE_CONVEX_URL`, and production R2 bucket;
- gateway migration-stage version and active dual-protocol version;
- pinned Convex Auth revision and gateway Better Auth version;
- GitHub OAuth and Relay callback/webhook URLs;
- production native route ID and a fingerprint of its route mapping/key.

From the frozen commit, complete `pnpm run verify:pr`, root and native Convex
tests, gateway tests/typecheck, Files Worker tests/typecheck, lint, and a
production build. The local `auth:native:smoke` command exercises only the
anonymous loopback backend and is not hosted OAuth evidence.

## Production prerequisites

### Native Convex

Create or select a distinct native production deployment and point
`CONVEX_PROD_DEPLOY_KEY` at it. Do not aim that key at the legacy database unless
existing documents have been inspected and proven compatible with the native
schema.

Configure and verify:

- required auth: `AUTH_PRIVATE_KEY`, `AUTH_JWKS`, `AUTH_GITHUB_CLIENT_ID`,
  `AUTH_GITHUB_CLIENT_SECRET`, `AUTH_GITHUB_CALLBACK_URL`, `AUTH_APP_ORIGIN`;
- Bento: `BENTO_PUBLISHABLE_KEY`, `BENTO_SECRET_KEY`, `BENTO_SITE_UUID`,
  `BENTO_FROM`, and `NATIVE_OPERATIONS_ALERT_EMAIL`;
- Relay: `GITHUB_RELAY_APP_ID`, `GITHUB_RELAY_CLIENT_ID`,
  `GITHUB_RELAY_CLIENT_SECRET`, `GITHUB_RELAY_PRIVATE_KEY`,
  `GITHUB_RELAY_SLUG`, `GITHUB_RELAY_STATE_SECRET`,
  `GITHUB_RELAY_WEBHOOK_SECRET`, and the callback target when explicitly set;
- storage: `NATIVE_R2_ENDPOINT`, `NATIVE_R2_BUCKET`,
  `NATIVE_R2_ACCESS_KEY_ID`, `NATIVE_R2_SECRET_ACCESS_KEY`,
  `NATIVE_FILES_ORIGIN`, `NATIVE_FILES_PURGE_ZONE_ID`, and
  `NATIVE_FILES_PURGE_TOKEN`.

Use exact production values:

- `AUTH_APP_ORIGIN=https://usekino.com`
- `AUTH_GITHUB_CALLBACK_URL=https://gateway.usekino.com/oauth/github/callback`
- `NATIVE_FILES_ORIGIN=https://files.usekino.com`

### Files Worker

Confirm the production binding is `kino-prod-org-uploads`. Set the Worker's
runtime `NATIVE_CONVEX_URL` to the native production Convex cloud URL, deploy
`workers/files` to production, and verify `https://files.usekino.com/health`
before enabling native public file URLs. The Git-connected `kino` build does not
deploy this standalone Worker.

### Gateway

The production gateway needs two reviewed deployments because Cloudflare cannot
roll back across the Durable Object class migration:

1. Run `pnpm --dir workers/gateway run deploy:stage:production`. This deploys
   the migration-bearing legacy entrypoint, preserves Better Auth and Relay, and
   creates the only safe pre-native rollback version. Record its version ID and
   verify legacy login and Relay.
2. Set the production `NATIVE_GITHUB_ROUTES` secret to a static mapping whose
   fixed route ID, secret, native Convex callback, and app callback exactly match
   the production configuration. Never enable the dev dynamic-route API in
   production.
3. Run `pnpm --dir workers/gateway run deploy:production`. Verify `/health`
   reports the expected Better Auth version and native protocol/storage readiness,
   and recheck legacy login plus Relay before changing GitHub's OAuth callback.

The native callbacks are:

- backend: `https://<native-production>.convex.site/oauth/github/callback`
- app: `https://usekino.com/api/auth/github/callback`

### App Worker and Workers Builds

Configure Workers Builds with `CONVEX_PROD_DEPLOY_KEY`,
`NATIVE_APP_ORIGIN_PRODUCTION`, `NATIVE_GITHUB_GATEWAY_URL_PRODUCTION`,
`NATIVE_GITHUB_ROUTE_ID_PRODUCTION`, `NATIVE_GITHUB_ROUTE_SECRET_PRODUCTION`,
the production gateway URL/admin token, and the existing PostHog values.

Separately configure the deployed `kino` Worker's runtime values:

- `NATIVE_GITHUB_GATEWAY_URL=https://gateway.usekino.com/oauth/github/callback`
- `NATIVE_GITHUB_ROUTE_ID=<the fixed production route ID>`
- secret `NATIVE_GITHUB_ROUTE_SECRET=<the matching route key>`

The suffixed Workers Builds values are build inputs. They do not by themselves
create the Worker's runtime bindings. Production deploy uses `--keep-vars`, so
stage and verify those runtime bindings before releasing.

## Coordinated release order

Production actions require explicit authorization.

1. Freeze the release and complete all checks and PR-preview acceptance.
2. Prepare the distinct native production Convex deployment and environment.
3. Deploy and verify the production Files Worker.
4. Deploy and verify the migration-bearing gateway stage, then the reviewed
   dual-protocol gateway. Keep the legacy proxy and Relay paths working.
5. Stage the production app Worker's native GitHub runtime bindings and verify
   the static route mapping agrees with them.
6. Change the existing Kino Auth OAuth app's callback to
   `https://gateway.usekino.com/oauth/github/callback`. Do not change the Kino
   Relay GitHub App registration.
7. Release the frozen app commit. `scripts/cloudflare-build.sh` deploys native
   Convex first; the later deploy command publishes the app Worker.
8. Complete a real logged-out GitHub sign-in, protected reload and logout,
   verified email signup/recovery, invitation/private access, Relay, Files, and
   one representative write.
9. Record the deployed IDs and inspect Convex operations/errors, gateway and
   Files logs, Bento delivery, and Relay webhook receipts.

The Convex and Worker phases are not atomic. If Convex succeeds and Wrangler
fails, the previous app Worker remains live. Native backend changes must remain
compatible with that Worker until the new Worker publishes, or the recovery is
an immediate forward deploy.

## Recovery phases

### Before the native app is published

No native app traffic exists. Restore GitHub's callback to
`https://gateway.usekino.com/api/auth/callback/github` if it was changed. The
migration-bearing gateway stage preserves legacy login and Relay. Fix the native
configuration and retry later.

### After publish, before accepting native writes

A coordinated prelaunch rollback is still possible: stop acceptance testing,
restore the frozen legacy app Worker version and GitHub callback, verify legacy
protected SSR/data, and keep the dual-protocol gateway deployed until all native
OAuth attempts have expired. The Files Worker may remain deployed because it is
not selected by the legacy app.

### After native writes are accepted

Do not point users back at the legacy database. Pause writes or place the app in
maintenance if necessary, then forward-fix the native app/backend. A gateway
recovery must deploy a version that retains the Durable Object class/binding and
native protocol; the legacy-only migration stage is no longer sufficient while
native OAuth is live. Roll Convex code back only when its current schema and data
are compatible with that revision. A Worker rollback does not restore Convex,
R2, KV, Durable Object, or GitHub state.

## Acceptance and cleanup

The final preview acceptance items live in the authoritative checklist in
`native-convex-migration-status.md`. After production acceptance:

- rotate the previously exposed Convex management token;
- delete temporary OAuth/proof resources and ignored credentials;
- remove any retained visual-test folder after its storage cleanup finishes;
- delete preview route records or allow their 14-day TTL to expire;
- after the agreed stability window, remove the gateway's legacy Better Auth
  proxy and rollback-only secrets/tests.

Keep the gateway environment guide authoritative for callback ownership,
standalone gateway deployment, and Relay invariants.
