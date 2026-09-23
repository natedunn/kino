# Native Convex cutover and recovery runbook

Status: **release-candidate preview validated; production data reset complete;
runtime deployment not yet authorized**. Updated September 23, 2026
(America/Mexico City).

This runbook covers one coordinated release unit: the native Convex deployment,
Kino Start Worker, Kino Files Worker, production OAuth gateway, GitHub OAuth app,
and Kino Relay continuity. PR #154 is native-only: root `convex.json` targets
`convex/native`, and the app no longer contains a Kitcn runtime or auth feature
flag. Better Auth remains only in the standalone gateway as a temporary legacy
proxy during the acceptance window.

Kino is prelaunch and has no legacy-user or product-data migration requirement.
Reuse the existing Kino production Convex deployment after destructively
clearing its disposable Kitcn application data. Once the native schema is
deployed and native writes are accepted, the old Kitcn model is not a rollback
target; recovery is a forward fix on the native stack.

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

Keep `CONVEX_PROD_DEPLOY_KEY` pointed at the existing Kino production deployment:

- deployment: `brainy-boar-871`
- cloud URL: `https://brainy-boar-871.convex.cloud`
- site URL: `https://brainy-boar-871.convex.site`

Before merging, while the legacy Kitcn deployment is still selected:

1. Confirm the deployment name and cloud/site URLs from both the key and the
   Convex dashboard.
2. Use Convex's snapshot import with `--replace-all` and a previously validated
   empty snapshot. A disposable local deployment proved this with a real Convex
   export containing only `README.md` and an empty `_tables/documents.jsonl`:
   after importing one `disposableResetProbe` document, `convex import
   --replace-all --yes empty-snapshot.zip` deleted that document and its table;
   a subsequent export had an empty table registry. The exact tested 716-byte
   ZIP is checked in at `integrations/native-convex/empty-snapshot.zip` so the
   production command can name a reviewable artifact. This clears current and
   stale application tables atomically;
   the generated Kitcn reset is insufficient because it only knows the current
   ORM schema and production still contains older undeclared tables.
3. Verify every legacy application table is empty, especially the reused
   `feedback` table name.
4. Clear disposable legacy `_storage` objects and production upload objects, or
   record them for the post-acceptance cleanup. They cannot become native file
   records without rows in the new native tables.

These steps were completed on September 23 against `brainy-boar-871`. The
checked-in 716-byte snapshot (SHA-256
`0dcb6f40c1a171106ea0274a1fc58656f89319af6eee36255da5492c57b63977`)
was imported with `--replace-all --yes`. Convex reported zero documents added
and deleted every legacy application/component row. A read-only follow-up
inspected all 68 remaining application, component, and system tables, including
`_storage`: 68 were empty, none were nonempty, and none failed inspection.
Stale undeclared legacy tables were absent afterward. Do not repeat this reset
unless a later release rehearsal writes disposable production data and a fresh
production action is explicitly authorized.

The native schema intentionally differs from the Kitcn storage model: most
singular tables become plural native tables, relationships use native document
IDs, and explicit cleanup/job tables are added. Emptying the legacy tables makes
this a schema replacement rather than a data migration. Do not start the first
native deploy while any legacy application document remains.

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

On September 23, all of these values were configured on `brainy-boar-871` and
read back for an exact comparison with the ignored production bundle. The 14
new names matched, including fresh `AUTH_PRIVATE_KEY`/`AUTH_JWKS`, copied GitHub
login and R2 credentials, exact native origins, operations email, and purge
credentials. Existing Bento and Relay values remained in place.

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

Completed September 23: version
`8d2e539c-f6a5-492b-8558-230582879d1f` is deployed at 100% with
`NATIVE_CONVEX_URL=https://brainy-boar-871.convex.cloud` and the
`kino-prod-org-uploads` binding. The live health endpoint returned 200 and a
nonexistent public ID returned the expected 404 through the native lookup path.
The pre-cutover rollback version is
`9d47763d-45ba-4e03-903e-b66cf0af753a`.

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

The existing `kino` production Workers Build already has
`CONVEX_PROD_DEPLOY_KEY`, production gateway URL/admin token, and PostHog values.
On September 23, the following native inputs were added to its `main` trigger
and verified after a dashboard reload: `NATIVE_APP_ORIGIN_PRODUCTION`,
`NATIVE_GITHUB_GATEWAY_URL_PRODUCTION`, `NATIVE_GITHUB_ROUTE_ID_PRODUCTION`, and
the encrypted `NATIVE_GITHUB_ROUTE_SECRET_PRODUCTION`.

Keep Workers Builds configured with `CONVEX_PROD_DEPLOY_KEY`,
`NATIVE_APP_ORIGIN_PRODUCTION`, `NATIVE_GITHUB_GATEWAY_URL_PRODUCTION`,
`NATIVE_GITHUB_ROUTE_ID_PRODUCTION`, `NATIVE_GITHUB_ROUTE_SECRET_PRODUCTION`,
the production gateway URL/admin token, and the existing PostHog values.

The production `scripts/cloudflare-deploy.sh` command supplies the deployed
`kino` Worker's runtime values from those build inputs:

- `NATIVE_GITHUB_GATEWAY_URL=https://gateway.usekino.com/oauth/github/callback`
- `NATIVE_GITHUB_ROUTE_ID=<the fixed production route ID>`
- secret `NATIVE_GITHUB_ROUTE_SECRET=<the matching route key>`

The suffixed Workers Builds values are build inputs. The deploy script passes
the URL and route ID with `--var` and the route key with `--secrets-file` while
retaining existing bindings with `--keep-vars`. Verify these bindings on the
published Worker after the release; a separate pre-release runtime edit is not
required.

## Coordinated release order

Production actions require explicit authorization.

1. Freeze the release and complete all checks and PR-preview acceptance.
2. Reset the existing production Convex data, verify the legacy tables are
   empty, and configure its native environment.
3. Deploy and verify the production Files Worker.
4. Deploy and verify the migration-bearing gateway stage, then the reviewed
   dual-protocol gateway. Keep the legacy proxy and Relay paths working.
5. Verify the production build's native GitHub route ID/key agree with the
   gateway's static route mapping. The app deployment supplies the runtime
   bindings when it publishes.
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

Do not attempt to restore the erased Kitcn data model. Pause writes or place the
app in maintenance if necessary, then forward-fix the native app/backend. A gateway
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
