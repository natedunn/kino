# Kino native backend integration

This directory selects the real native backend in `convex/native/`. It uses
the root install and its pinned, patched Convex Auth package. Do not run a
separate dependency install here. The existing app still selects
`convex/functions/` through the root `convex.json`.

## Deployment boundary

For the September 22 storage and original Files UI checkpoint, see
[the migration handoff](../../docs/native-convex-migration-status.md#september-22-storage-checkpoint--original-files-ui-restored).
The scoped-token follow-up confirmed cache-purge API acknowledgement, direct R2
object absence, and zero retained quota for the scripted fixture. All seven earlier
browser cleanup jobs are done. The original Files components now use native view
queries and mutations. Mobile drawer, cover-widget, file-delete, and original
project-delete confirmation checks pass in the hosted preview. The handoff records
the live-proof boundaries and remaining adapters.

### Resuming a project deletion

The project is hidden immediately but retained internally until cleanup finishes.
Preserve its ID when investigating a failed deletion. Authorized organization
owners/admins (or system admins) can repeat `projectDeletion:remove` with `{ id }`
to resume the database cascade. This does not reset exhausted storage retries.
Use `filesJobs:list` with the project ID, state `failed`, and cursor pagination to
inspect storage failures; repair the underlying transport/token issue, then call
`filesJobs:resume` for those job IDs as an authorized manager. Successful cleanup
acknowledgement automatically wakes the project cascade. Never force accounting to
zero or remove the project/storage records to bypass the barrier. Normal cleanup
may wait for outstanding signed upload URLs and processing leases to settle.

The native Node transport externalizes Sharp. Run the existing native preparation
script to create this directory's ignored `node_modules` link to the root install;
`node-dependencies.ts` preserves the package-resolution boundary used by Convex's
external dependency bundling. Keep the local manifest and the Sharp external
package entry in `convex.json` together.

The native backend has its own Convex deployment, database, signing keys,
generated API, and authentication configuration. The first local target uses
ports **4440/4441** and project-local state in this directory's `.convex/`.
It does not share the root worktree's local database or the old proof databases.

Better Auth and Convex Auth v2 both default to the deployment site URL as JWT
issuer and `convex` as audience. Separate deployments avoid introducing a
combined keyset or a new issuer patch solely for temporary coexistence.
Kino's integration preview will select the native backend; existing product
routes continue using the old backend until ported. No cross-backend identity
or product-data bridge exists in this milestone.

## Implemented

- Core auth, password (with nested rate limiter), and GitHub OAuth components.
- Exact app-origin redirect allowlist and server-configured GitHub callback.
- App-owned `users` and `profiles`; component-owned accounts, credentials and
  sessions. GitHub create/sign-in callbacks are internal functions.
- Atomic profile bootstrap with an indexed username uniqueness check. Repeat
  login preserves profile edits and updates verified GitHub email evidence.
- No automatic identity linking by matching email and no email-based automatic
  system-administrator elevation. Separate GitHub accounts remain separate even
  if their verified emails match. Password accounts use normalized, unique email addresses without adopting a
  matching GitHub identity.
- `auth:isAuthenticated` and `profiles:me` require the exact deployment issuer,
  a valid app user ID, and an active user. Disabled users lose private query
  access immediately even if an access token has not expired.
- Verified email/password signup, sign-in, resend, and recovery. Signup creates
  a pending account without a session, profile, or organization. Verification
  creates the profile, personal organization, owner membership, and session in
  one transaction. GitHub also bootstraps a personal organization.
- App-owned personal organizations and memberships. Repeat login preserves
  ownership; a removed/demoted owner is not silently restored. Inconsistent
  ownership stops login and requires an explicit repair rather than elevation.
- App-owned team organizations, indexed memberships, owner/admin/moderator
  roles, project assignments, public/private/archived project policy, and
  server-owned system roles. Authorization derives the actor from the session
  and re-reads membership on every operation, so demotion and removal apply on
  the next request.
- App-owned invitations bind acceptance to a verified password or GitHub email,
  expire and cancel explicitly, revalidate the inviter's current authority, and
  cannot recreate a removed membership through replay. Creation is rate-limited
  and schedules localized Bento delivery transactionally.
- One hashed 256-bit challenge per user/purpose; 15-minute expiry, single use,
  and resend replacement. A scheduled cleanup deletes at most 100 expired
  challenges every 15 minutes.
- Existing English, Latin American Spanish, and Simplified Chinese email
  templates sent through Bento, with at most three delivery attempts. Stale
  queued messages are skipped. No links/codes or raw transport exceptions are
  logged. Missing Bento configuration blocks signup/mail requests.
- Per-normalized-email token buckets: three mail requests/minute and five login
  attempts/minute, plus the password component's credential-verification limit.
  Unknown/ineligible recipients receive the same accepted response. These are
  application limits, not a complete deployment-level abuse defense.
- Reset atomically changes the password, consumes the challenge, and revokes all
  old refresh sessions (including spent-token replay). Rejected new passwords
  leave the recovery challenge usable. Issued access JWTs keep their original
  expiry, up to the 60-second default.
- Core refresh and sign-out functions; 60-second access tokens and the pinned
  core's 30-day refresh lifetime. Disabling an app user is checked on reads and
  new GitHub sign-ins; refresh-session revocation must accompany a future
  account-disable mutation. The provider-independent core does not read users.

## Local setup

From the repository root, run `pnpm install --frozen-lockfile`, then
`pnpm run auth:native:prepare-local`. This creates a fresh signing key in the
ignored, mode-0600 `.env.auth.local` file and never overwrites an existing file.
The GitHub values are placeholders: this setup alone cannot complete OAuth.

Start the dedicated local backend from this directory, with hosted-deployment
selectors removed from the shell environment:

```sh
env -u CONVEX_DEPLOY_KEY -u CONVEX_DEPLOYMENT -u CONVEX_SELF_HOSTED_URL \
  -u CONVEX_SELF_HOSTED_ADMIN_KEY CONVEX_AGENT_MODE=anonymous \
  ../../node_modules/.bin/convex dev \
  --local-cloud-port 4440 --local-site-port 4441 --tail-logs disable
```

On first startup it creates `.env.local` and local state; the first push waits
for the required auth environment. Confirm `.env.local` selects the anonymous
loopback backend, then from a second terminal in this directory load the file:

```sh
../../node_modules/.bin/convex env set --from-file .env.auth.local
```

The watcher then deploys the native components and generates
`convex/native/_generated/`. Keep that generated output with source changes.

From the repository root:

```sh
pnpm run auth:native:verify-package
pnpm run typecheck:convex:native
pnpm exec vitest run convex/native
pnpm run auth:native:smoke
```

To run the actual Kino TanStack Start application against this backend, keep the
native watcher running and start Vite with the native runtime selected:

```sh
VITE_AUTH_RUNTIME=native \
VITE_CONVEX_URL=http://127.0.0.1:4440 \
VITE_CONVEX_SITE_URL=http://127.0.0.1:4441 \
VITE_SITE_URL=http://127.0.0.1:5190 \
PORT=5190 pnpm exec vite dev --host 127.0.0.1 --port 5190 --strictPort
```

The default runtime remains Kitcn. The native flag selects Kino-owned Start
request handlers, HttpOnly refresh cookies, the official Convex query adapter,
and the native auth provider. A request shares a single token refresh across
parallel SSR consumers. Protected loaders warm the same `convexQuery` keys that
`useSuspenseQuery` reads after hydration.

Native GitHub login is a separate opt-in because its callback must use the
opaque-state gateway. Set `VITE_NATIVE_GITHUB_ENABLED=true` only when all of the
following are configured for the same environment:

- Convex: `AUTH_GITHUB_CLIENT_ID`, `AUTH_GITHUB_CLIENT_SECRET`, and
  `AUTH_GITHUB_CALLBACK_URL=https://<gateway>/oauth/github/callback`.
- Start Worker: `NATIVE_GITHUB_GATEWAY_URL` with that exact callback URL,
  `NATIVE_GITHUB_ROUTE_ID`, and secret `NATIVE_GITHUB_ROUTE_SECRET`.
- Gateway: the same route ID/secret mapped to the environment's exact
  `https://<convex-site>/oauth/github/callback` and
  `https://<app>/api/auth/github/callback` URLs.

Kino registers the signed routing envelope server-to-server and exposes only a
43-character random reference to GitHub. It keeps the provider/browser state
and validated post-login return path in short-lived HttpOnly cookies. The
authorization URL has a 1,024-byte application budget. Missing configuration
returns 503 and the native GitHub button remains disabled unless the public
feature flag is explicitly enabled.

For a same-account `workers.dev` proof, the Start Worker also needs Cloudflare's
`global_fetch_strictly_public` compatibility flag or a service binding to reach
the gateway Worker. The hosted proof used the compatibility flag only in its
generated disposable configuration. Prefer the environment's gateway custom
domain or a service binding for the durable deployment design.

The smoke script refuses any target except the dedicated anonymous loopback
backend on 4440/4441. It writes disposable user/password fixtures there,
checks JWT validation and actual password WASM, and never prints credentials.
It signs a local test JWT using the local key; it is **not** a GitHub browser
exchange or a verified-email signup test.

## Email configuration and browser handoff

The local key-preparation command does **not** copy Bento credentials. To enable
real delivery on the native target later, load `BENTO_PUBLISHABLE_KEY`,
`BENTO_SECRET_KEY`, `BENTO_SITE_UUID`, and verified-author `BENTO_FROM` from an
ignored credentials file using the same target-checked env workflow above.
Never paste credentials or links into logs. The current tests capture the actual
SDK transport and render the real templates; no new inbox delivery is claimed.

`AUTH_APP_ORIGIN` must be an exact origin. Mail links use
`/auth/verify-email#code=…` and `/auth/reset-password#code=…`. The native Kino UI
implements both routes. It captures and removes the fragment immediately,
requires an explicit click before consuming a verification challenge, keeps the
code out of analytics, and adopts the resulting session through the Start
server boundary. Signup/resend return `accepted`, while verification/login
return `complete` with tokens; only the latter sets session cookies. Customer
copy exists in all three application locales.

Email normalization trims whitespace and lowercases the address, with a bounded
format check; it does not strip plus tags or provider-specific dots. Password
and GitHub accounts remain separate. An explicit linking UX is not implemented.

## Evidence (September 21, 2026)

- All component mounts and schema/index deployment succeed on the real local backend.
- 31 component-backed tests pass using the actual core, Argon2 WASM, rate
  limiters, and localized Bento rendering with a captured HTTP transport. They
  cover recovery/session revocation, expiry/resend/replay, rollback, disabled
  users, separate identities, ownership isolation, invitations, the central
  role matrix, immediate revocation, and bounded cleanup.
- Live mounted JWKS, valid JWT/profile query, wrong-issuer rejection, anonymous
  access denial, internal callback privacy, component-call privacy, redirect
  rejection, and actual password hashing/verification pass.
- Native TypeScript validation is included in root `typecheck:convex` and thus
  in `verify:pr`.
- The actual Kino native auth pages, anonymous dashboard redirect, pending-user
  login rejection, explicit verification UI, and verification/reset fragment
  removal pass in a browser against ports 4440/4441. Live Bento verification
  and reset links were consumed through the Kino UI; protected SSR, reload,
  sign-out, reset replay rejection, new-password login, and a second reload all
  passed. The run also added a neutral resend affordance and fixed legacy
  `callbackURL` leaking into the native sign-in mutation. A native production
  build and the integration/backend test suites pass.
- A disposable hosted Kino Worker and Convex preview passed real GitHub login,
  profile/personal-organization loading, full reload persistence, sign-out, and
  repeat login. The provider URL was 365 bytes with a 43-character opaque state;
  both browser-state cookies were Secure, HttpOnly, SameSite=Lax, and scoped to
  `/api/auth/github`. Sign-out unmounts the protected route immediately, and its
  cached nullable profile/organization reads settle without an auth exception.
  The stable Kino app, production backend, and existing Kino OAuth registration
  were unchanged.
- The same hosted preview passed team creation, live localized invitation
  delivery, a second verified password identity with the same mailbox as the
  GitHub owner, acceptance as admin, SSR reload, hover-driven switching between
  personal and team organizations, owner removal, immediate loss of manager
  controls, and rejection of invitation replay after removal. Matching email
  addresses remained separate identities as designed.

## Next integration gates

1. Port the stable system-admin totals/recent-signup view. Operational alerting,
   retention, and aggregate repair are complete. The existing notifications and
   account-deletion placeholders are not new feature commitments.
2. Compare equivalent current/native workloads, continue longer
   subscription-retention measurement, and complete the cutover/failure rehearsal.

The original dashboard layout and the stable app's current team/project limits
are verified on isolated Worker `d6fa1602-fc9b-4862-9831-5c050d8631ce`.
Regular accounts have one team and one project per organization; system admins
have 100 each. Native personal organizations do not consume the team slot.
There is no paid-plan entitlement in the stable app to port yet. See the newest
checkpoint in the migration handoff for tests and hosted evidence.

The original account data export, profile/language/security/public-profile flows,
team/project creation forms, and command-palette update search now use native/legacy
facades in the integrated app. Hosted export download and profile edit/restore
checks pass on Worker `f8a14b65-6c73-4302-8eb5-841029271360`; focused backend tests
cover export privacy/size limits, profile/avatar authorization, and creation
visibility/authorization. See the newest checkpoint in the migration handoff for
the precise evidence and remaining limits.

Project/organization general settings, project themes, and organization logos
now use native storage while retaining the original forms. Focused tests and
live rename/logo/theme persistence checks pass. See the
[settings checkpoint](../../docs/native-convex-migration-status.md#september-22-general-settings-and-appearance-checkpoint)
for deployment evidence and remaining browser/cleanup checks.

Organization members/invitations, project membership management, and board
settings CRUD are now ported. Board removal uses a bounded cascade and closes
feedback write paths as soon as deletion starts. See the
[members and boards checkpoint](../../docs/native-convex-migration-status.md#september-22-members-and-board-settings-checkpoint)
for validation and outstanding acceptance checks.

Relay acceptance is complete for the linked-issue scope: authorization, repository
selection, disconnect/reconnect, live issue creation/linking, duplicate rejection,
real webhook title/state updates, and cleanup pass. The disposable
[`natedunn/onda#1`](https://github.com/natedunn/onda/issues/1) is closed; temporary
feedback is removed and `natedunn/dos` is restored read-only. The existing-installation
entry is exposed in all three locales. See the
[Relay checkpoint](../../docs/native-convex-migration-status.md#september-22-relay-checkpoint--native-port-and-live-delivery-verified)
for evidence and remaining validation/operations limits.

Relay uses the existing **Kino Relay (Dev)** registration and gateway, independently
of login OAuth. Its native callback target is the exact Convex site URL
`https://giant-jaguar-319.convex.site/api/github/callback`; success redirects to the
configured preview app origin. The gateway's existing Convex-site allowlist covers
this callback, so no gateway or GitHub registration change was necessary. The
webhook target is registered with the dev gateway. Dev secrets are in ignored
`.env.relay.local`; preserve the deployed private key (local newline formatting
differs but normalized values match). Production is unchanged.

The first product slice's deployed browser acceptance passes: private project
creation and default boards, hover navigation, feedback create/list/detail,
full-text miss/hit search, live vote/reaction/comment updates, status and priority
timeline events, and hard-reload persistence. The parity pass also covers title,
board, assignment, target, labels, follows/watchers, answers, reply/edit/delete,
symmetric related-feedback add/remove, and feedback deletion through the deployed
UI. The final parity pass added latest-first cursor retention, chronological
older-page merging, localized mutation failures, and Convex-managed optimistic
vote rollback. A deployed 24-comment proof passed and deleted its fixture.
Worker version `06240148-36c8-4315-9351-d4d3c4770f82`; Convex
`giant-jaguar-319`.

The core updates slice now runs on native Convex: draft create/edit, publication
and bulk status changes, stable slugs, indexed search/category pagination,
featured lists, related feedback, comment ownership and reactions, optimistic
hearts, and bounded deletion of comments/emotes. The existing Start routes use
native suspense queries, SSR preloads, intent links, and live subscriptions.
Eight multi-user tests cover visibility, validation, foreign-project rejection,
archive fences, pagination, rate limiting, and a 240-comment cascade.

Deployed browser acceptance confirmed draft creation, publish, heart, comment,
hard reload, server-rendered update/comment content, search hit/miss, management
unpublish, and deletion. The disposable update was removed. Worker version
`bbb30066-6f14-472f-bcb2-6c7c68ef80a6`; Convex `giant-jaguar-319`.
Validation: 400 Vitest tests in 63 files, the separate Node sourcemap test,
`verify:pr`, focused lint, and a native production build. Run Vitest with
`--exclude scripts/remove-dangling-sourcemap-references.test.mjs` and run that file
with `node --test`; the unqualified test command incorrectly collects the Node test.

The latest checkpoint replaces the simplified native Updates screens with the
original components, using `updatesWorkspace.ts` and the temporary
`updates-api.ts` transport facade. Management filters/table/bulk controls,
editor/sidebar, sharing, related-feedback title/board labels, comment windows,
and native cover styling now reuse the original UI. Older comment and list pages
use one-shot snapshots instead of retaining subscriptions for every cached page.
The publication audit found no legacy notification dispatch. RSS remains an
existing placeholder, not a verified feed implementation.

Hosted checks passed draft/save/publish, selected-feedback labels, copy-link,
SSR title/body, bulk unpublish, comment creation/editing, and confirmed deletion.
The disposable update was removed, preserving the existing cover fixture.
Validation passes:
415 Vitest tests in 65 files, the Node sourcemap test, `verify:pr`, and the native
build; focused lint reports zero errors and three shadow-name warnings.
Worker `f7688c48-59c0-4913-bd42-71379eada0bf`; dev `giant-jaguar-319`.
See the [latest Updates checkpoint](../../docs/native-convex-migration-status.md#september-22-updates-checkpoint--original-ui-restored).

The first navigation during an earlier deployment saw stale assets and
an old `project:getDetails` call; fresh navigation worked. Deployment-transition
asset/cache handling remains a cutover acceptance item.

No production deployment or existing GitHub registration change is part of
this setup. Stop the local watcher when finished; retain its ignored state while
the integration work continues. Do not copy local private keys into a hosted
deployment.
