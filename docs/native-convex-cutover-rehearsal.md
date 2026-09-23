# Native Convex cutover rehearsal

Status: **partial preview rehearsal, not production cutover approval**. Updated
September 22, 2026 (America/Mexico City). This runbook covers one coordinated
release unit: native Convex, the Kino Start Worker, the native Files Worker, and
the OAuth gateway. Kino Relay and the existing Better Auth route must keep
working throughout the transition.

Kino is prelaunch, so the intended release is now a native-only cutover in one
PR rather than a live migration with legacy-user continuity. Legacy runtime
checks below are retained only where they protect development previews, the
shared gateway, or Relay. Once public native writes begin, recovery is a forward
fix; the separate legacy database is not a data rollback target.

## What was actually rehearsed

The disposable `kino-native-auth-proof-c318c09d` Worker was pinned at version
`f82c7f3c-6e79-4967-9986-76a9c5c6d003` (100% traffic). Wrangler rolled it
back to the immediately prior version
`9e25cba8-e123-4bb7-a655-a09814719699`, then restored the pinned version.
`wrangler deployments status` confirmed 100% traffic on each selected version.
On both versions, `/` and `/auth` returned 200 and an anonymous `/dashboard`
request returned a 307 to `/auth?redirect=%2Fdashboard`. The restored deployment
was `cb94bfa7-e264-4b89-bc22-3c9920ccc614`. During that app Worker switch, no
Convex, gateway, Files Worker, or production deployment was changed.
Authenticated behavior was not retested after this brief version switch;
earlier hosted proof results remain separate.

Inventory after the isolated preview deploy and OAuth rebind:

| Resource                 | Target                             | Observed state                                                                                                                             |
| ------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Native app Worker        | `kino-native-auth-proof-c318c09d`  | Code deployed as `853e90d4-b419-428e-9d3a-6c48cdee5762`; routing secrets rebound in version `739dee9f-eeac-4e13-a89b-1a07af274996` at 100% |
| Native Convex preview    | `giant-jaguar-319`                 | Native functions pushed; `AUTH_GITHUB_CALLBACK_URL` now targets the shared dev gateway; separate database                                  |
| Native Files Worker      | `kino-native-files-proof-c318c09d` | Version `c602e4ce-98a6-40f7-914c-22ed03a6b929`; unchanged                                                                                  |
| Disposable OAuth gateway | `kino-v2-gateway-proof-c318c09d`   | Version `06a14c38-fb42-449b-ade8-3908cbe065c1`; `/health` reports `opaque-state-v1` with storage ready                                     |
| Shared dev gateway       | `gateway-dev.usekino.com`          | Version `d5a5a65c-e0f7-4091-8779-e09e8f345c29` at 100%; Better Auth `1.7.1`, native protocol/storage enabled                               |

The shared dev gateway was then staged with the SQLite Durable Object and its
legacy routes (version `144384cf-2e1f-40f7-9bbe-51368e8b6da2`). Adding the
two disposable proof routes as a dev-only secret produced the pinned compatible
rollback version `680f6c11-cc0c-4936-9e50-8c8f0bc7917d`. The active
dual-protocol version `3a1f4405-e404-4a8a-9a7a-2e639fd51a61` retained
Better Auth `1.7.1` and exposed native protocol/storage readiness. A live
signed registration returned a 43-character reference; a malformed callback
did not consume it, the next callback did, replay failed, and a signature from
the wrong preview was rejected. The gateway was rolled back to the pinned
legacy-behavior version and restored to the dual-protocol version. Health,
route status, and the Better Auth version gate passed at both points. Edge
propagation briefly served mixed old/new responses immediately after deploy;
the recorded checks used the settled state.

The dev-only route registry was then extended with a distinct integrated Kino
preview route, producing gateway version
`d5a5a65c-e0f7-4091-8779-e09e8f345c29`. Its live registration,
wrong-secret rejection, malformed callback, single-use callback, and replay
checks passed. The guarded preview script deployed native Convex code and the
matching Start build, then the proof Worker's route ID, route secret, and
gateway callback were rebound. The native Convex preview callback was changed
to `https://gateway-dev.usekino.com/oauth/github/callback`. `/` and `/auth`
return 200; anonymous `/dashboard` redirects to auth. The temporary GitHub
OAuth app registration was changed to the same shared dev callback. Real Chrome
GitHub login returned to the dashboard as the existing `natedunn` GitHub user;
reload, sign-out, and repeat login all passed. The separate `hello` password
user was unchanged, matching the deliberate no-automatic-email-linking policy.
The Files Worker was not redeployed in this pass.

The integrated app was then rolled back from
`739dee9f-eeac-4e13-a89b-1a07af274996` to the pinned pre-cutover version
`f82c7f3c-6e79-4967-9986-76a9c5c6d003`. Its routes passed and the live
`natedunn` session survived a dashboard reload. The app was restored to
`739dee9f-eeac-4e13-a89b-1a07af274996`. The shared dev gateway was rolled back
to compatible legacy-behavior version
`680f6c11-cc0c-4936-9e50-8c8f0bc7917d`: native state registration returned
404 while the legacy auth route returned 200 and native storage remained bound.
Restoring `d5a5a65c-e0f7-4091-8779-e09e8f345c29` re-enabled native routing;
signed registration, signature rejection, malformed-state handling,
single-use consumption, and replay rejection passed again. A fresh browser
login after restoration also returned as `natedunn`.

Existing legacy OAuth and Relay/webhook paths were retained in code and their
focused tests passed; a real post-deployment legacy login and Relay webhook were
not repeated.

## Rehearsal gate before a production switch

1. **Freeze an exact release pair.** Record app and Files Worker version IDs,
   native and legacy Convex deployment names and code revisions, gateway
   version, auth package versions, exact callback origins, and a fingerprint of
   each route mapping. Store no secret values in this record. Complete
   `pnpm run verify:pr`, native Convex tests, gateway tests, Files Worker tests,
   and a native production build against the intended `VITE_CONVEX_URL` and
   `VITE_CONVEX_SITE_URL`. The local `auth:native:smoke` command exercises only
   the anonymous loopback backend; it does not validate hosted OAuth.
2. **Stage the shared gateway without changing login behavior.** Add the
   opaque-state routes, route registry, and SQLite Durable Object to the dev
   gateway while retaining `/api/auth/*`, redirect rewriting, Relay callbacks,
   and webhooks. First deploy a gateway version with the new Durable Object
   class/binding but legacy behavior, and record it as a compatible rollback
   point. Then enable native routing and verify `/health` exposes both the
   Better Auth version and native protocol/storage readiness. The dev gateway
   staging, active-route, storage, rollback, restore, and integrated native Kino
   browser checks above pass; its legacy/Relay end-to-end checks remain.
3. **Switch only an isolated preview.** Deploy native Convex explicitly through
   `integrations/native-convex/convex.json`; deploy the matching native Files
   Worker and Start build. Verify the exact Convex callback URL, app callback
   URL, gateway route ID/secret, Bento origin, Relay target, and Files Worker
   `NATIVE_CONVEX_URL` all identify the same preview. Do not infer target from
   `VITE_AUTH_RUNTIME=native` alone: the current Cloudflare build script still
   deploys root Kitcn/Convex first.
4. **Exercise complete behavior.** Test logged-out GitHub sign-in through the
   real callback, private SSR, reload, sign-out, repeat login, password signup
   and recovery, invitations, revocation, project/board/feedback/Updates/Files
   writes and reads, and Relay. Include cancelled, expired, tampered, replayed,
   and cross-preview OAuth state. Check anonymous denial and public pages, file
   cache purge/physical deletion, in-progress cascade recovery, and old route
   links. Confirm existing Better Auth login, Relay installs, and webhooks still
   work on the same dev gateway. A successful OAuth initiation or HTTP health
   response alone is insufficient.
5. **Rehearse the whole rollback while writes are controlled.** Keep the legacy
   backend intact. Restore the pinned legacy app build/config and matching Files
   Worker target, then verify old cookies or fresh legacy login, protected SSR,
   and legacy data. Keep the dual-protocol gateway available while native flows
   may be in flight; only then restore its known-good compatible version and
   repeat both legacy auth and Relay checks. A Convex code rollback must be
   checked separately against its current schema/data. Repeat forward rollout
   once to prove the preview can return to native without account confusion.

## Unresolved conditions

- **Gateway legacy regression:** The shared dev gateway's native Kino flow and
  compatible rollback/restore now pass end to end. A real post-deployment
  Better Auth login and Relay installation/webhook should still be repeated on
  the shared dev gateway. No production gateway change was made.
- **Release pipeline:** `scripts/cloudflare-build.sh` now invokes native
  `convex deploy` from the root `convex.json` and validates the tier-specific
  app origin, callback, route credentials, and deployed gateway before push.
  Production still requires a coordinated, explicitly authorized rollout.
- **Data on rollback:** Native and Kitcn use different Convex databases, users,
  sessions, and signing keys, with no bridge. Reverting code cannot make writes
  from the native window appear in the legacy database. A preview rehearsal can
  use disposable writes, but a production decision requires a write freeze,
  reconciliation/reverse migration, or an explicit decision to discard those
  writes. Worker rollback also does not restore connected resource data.
- **Gateway rollback compatibility:** Cloudflare disallows Worker rollback
  across a Durable Object class lifecycle change. The rollback target must be
  deployed after the new class/binding has been staged, or a forward deploy of
  compatible code is required. See [Cloudflare's rollback limits](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).
- **Acceptance:** The board-detail route's native adapter fix is typechecked,
  covered by native board tests, and deployed to the isolated preview; it still
  needs browser acceptance with populated content. Remaining populated-content,
  mobile, and release-transition checks stay on the migration checklist.

The broader [migration checklist](native-convex-migration-status.md) stays open
until the shared-gateway integration and full preview forward/rollback sequence
pass. The [gateway environment guide](github-environments.md) governs separate
gateway deployment and production OAuth verification.
