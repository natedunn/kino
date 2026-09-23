# Native organization authorization proof

September 21, 2026. In-process backend proof only; not deployed or wired into Kino.

This separate schema keeps organization ownership and permissions in app-owned
Convex tables. Authentication supplies only a user identity. Every protected
operation reads current membership and project assignment records, so a role
change does not wait for a JWT refresh. Queries depend on those records; live
browser subscription behavior will be checked when this slice is integrated.

## Proven behavior

Eight multi-user convex-test scenarios cover:

- Verified creators receive an owner membership in the organization-creation
  transaction; a duplicate slug is rejected.
- Anonymous, unverified, and deleted users are denied.
- Paginated organization membership results are scoped to the authenticated user;
  client-supplied identity overrides are rejected.
- Assigned moderators can read and mutate project content; unassigned and
  foreign-organization projects are denied. Returned permissions exclude access,
  integrations, and deletion. Those future endpoints must independently enforce
  their permissions, not trust these UI flags.
- Admins manage memberships, but an owner in another organization cannot.
- Assignment replacement rejects foreign projects, duplicates, empty moderator
  assignments, admin assignments, and oversized sets without losing prior access.
- Reassignment, demotion, and removal take effect on subsequent requests using
  the same identity. Removed membership assignments are deleted transactionally.
- Owner removal/demotion/granting is prohibited through role management; the
  last owner cannot leave. A moderator can leave with assignment cleanup.

Run from `experiments/convex-auth-v2`:

```sh
node node_modules/vitest/vitest.mjs run tests/organizations.test.ts
node node_modules/typescript/bin/tsc --noEmit
```

The standard generated server/data-model bindings are copied from the existing
proof; their model derives from this schema. No generated application API imports
or deployment credentials are needed for these tests. The original permission tests seed memberships at the acceptance boundary; the
invitation tests now create them through the public acceptance mutation. There
is no public direct-add-member shortcut.

## Decisions and limits

- Roles match current `orgMember.lib.ts`: owner, admin, moderator. There is no
  invented generic organization member role.
- Projects reference stable organization IDs instead of mutable organization
  slugs. Project assignments reference memberships, so leaving and rejoining
  cannot inherit an old membership's grants.
- Indexed point lookups and paginated membership reads replace ORM relationship
  loading. Uniqueness is checked inside the same mutation as insertion.
- Assignment replacement has an explicit **50-project proof limit** and rejects
  overflow. This is not claimed as current Kino parity; establish the actual
  product limit or implement bounded background work before integration.
- This implements private management access only. Current Kino public visibility,
  independent project members, archived-project write guards, and system-admin
  overrides are not implemented here. Do not substitute this helper wholesale
  for `verifyProjectAccess`.
- The proof user table is a minimal verified-identity fixture, not a replacement
  for the v2 auth/user schema or evidence of OAuth email verification/linking.

## Next gates

1. Integrate the now-tested invitation lifecycle with trusted-origin Bento
   delivery and an acceptance page. Explicitly resolve GitHub verified-email
   identity and password-account linking policy.
2. Complete public/private/project-member/archived/system-admin policy parity,
   including all mutation guards and organization creation policy.
3. Wire into the Start proof: organization switch, SSR, hover preload,
   `useSuspenseQuery`, and live membership revocation/cache clearing across tabs.
4. Relationship and deletion lifecycle: project/org deletion, orphan prevention,
   batches/retries, storage and other dependent records. This proof only tests
   membership-to-assignment cleanup.
5. Performance measurements with realistic organization/project workload and
   deployed integration/security checks. In-process tests do not prove deployed
   concurrency, WebSocket invalidation timing, or UI cache isolation.

## Invitation lifecycle proof (September 21)

Ten additional multi-user scenarios pass in `tests/invitations.test.ts`:
normalized verified-email acceptance; anonymous/wrong/unverified recipient denial;
manager-only issuance/cancellation and assignment validation; cancellation and
rejection; pending-duplicate prevention and expired reissue; replay safety across
role changes/removal/rejoining; existing-member protection; deleted/moved project
checks with no partial membership creation; organization/inviter revocation; and
admin invitation acceptance. Both roles use the same app-owned membership tables.

Invitations expire after seven days. The authenticated user's stored verified
email must match; knowing an invitation ID alone grants nothing. Pending lookup
uses an organization/email/status index. Expiry is enforced inside mutations,
not a wall-clock query. Expired rows are marked on reissue; no background cleanup
job or expiry UI is claimed. Reissue creates a new ID. Terminal transitions clear
the bounded project-ID payload. The 50-project limit applies here too.

Accepted replay is idempotent only for the same user and exact original membership
record. It never reapplies roles/assignments or recreates deleted membership.
Inviting an existing member cannot change their permissions; acceptance returns
ALREADY_MEMBER. A pending invitation is also refused if its inviter has lost
management rights. These are explicit proof policies to review during integration,
not a claim that Better Auth already behaves identically.

The proof's verified user/email fixture assumes a trusted auth adapter. It does
not yet establish that a GitHub login has verified the invited email, link GitHub
to password accounts, or secure email changes. Those adapter decisions remain a
release gate. No invitation mail was sent and no deployment was changed. Email
outbox/retries, rate limiting, resend UI, status/list UI, localization, browser
acceptance and deployed concurrent-accept testing remain integration work.

## Start and live Bento integration (September 21)

The local email/auth backend now mounts the same organization tables and function
implementations, rather than a second copy of authorization logic. Its invitation
wrapper limits recipients to PROOF_EMAIL and schedules internal delivery in the
invitation transaction. The action uses Kino's existing localized invitation
email and Bento sender, with fixed origin `http://127.0.0.1:5181`. It checks pending
state and expiry, and records provider acceptance or failure. A cancellation that
races after this check may still produce a stale email; acceptance always checks
current state. There is no automatic retry or exactly-once delivery claim.

Start now provides `/organizations` and `/auth/accept-invitation`. The developer
screen creates organizations and invites the allowlisted mailbox as an admin.
Backend moderator invitations still require explicit projects; their picker UI
is not implemented. Membership listing uses SSR loader/Convex query integration;
the screen currently displays the first 20 memberships without pagination controls.

Password login preserves the invitation destination. GitHub retains its fixed
callback; the browser temporarily stores only the invitation ID in sessionStorage
and consumes it at the private landing page. No auth credentials are stored there.
This new GitHub invitation-return browser path has not been manually exercised.

Password recipients require their stored verified email. New GitHub users receive
an explicit githubEmailVerified marker only after the callback requires a verified
provider email. Unmarked GitHub emails fail closed, including older proof accounts.
GitHub and password accounts remain separate. An invite consumed by one cannot
be replayed by the other even with the same verified mailbox. Verification refresh
for old GitHub accounts and the eventual account-linking policy remain open.

Live evidence in `results-browser.json`: Bento accepted one invitation; Nate
confirmed inbox arrival; automated Chromium passed anonymous login routing, real
verified password sign-in and acceptance, accepted-state reload, live membership
listing, authenticated organization SSR, and no browser exceptions. The inviter
was a local internal fixture; the recipient used the actual cookie/password flow.
The first attempt hit Vite's dependency reload; the retry reused the same invitation
and sent no additional email.

Run with local backend 4420 and Start 5181 from the experiment root:

```sh
PROOF_PLAYWRIGHT=/path/to/playwright node scripts/invitation-browser.mjs
```

Each fresh run sends one email. The runner reads ignored credentials without
printing them. Its internal fixture refuses nonlocal CONVEX_SITE_URL values.
`live-invitation.json` contains only a non-secret invitation ID for reuse/debugging.
No Cloudflare or Kino deployment was changed. These additions supersede the
previous section's unimplemented local delivery/acceptance UI gap.

Remaining: live GitHub invitation return, old-account verification refresh,
management/resend UI, mail retries/rate limits, deployed preview/concurrency tests,
complete organization permission parity, switching/cache revocation across tabs.
The new UI is an English developer proof, not a customer-facing Kino replacement;
transactional mail reuses the existing localized template.

## Deployed GitHub invitation evidence (September 21)

`results-github-preview.json` records the successful real GitHub run against
alpha (`graceful-elephant-103` and `kino-auth-v2-proof-c318c09d`). Bento accepted
one preview invitation. The headed browser completed real sign-in/consent,
returned to the original invitation, cleared temporary invitation storage, and
created Secure HttpOnly session cookies. Invitation acceptance and reload passed;
six concurrent accepted retries returned the same original membership. The live
organization list and authenticated private/no-store SSR included the membership.
Removing it as the fixture owner immediately updated the live list, and replaying
the original invitation could not recreate membership. No browser exceptions.
The runner closed Chromium normally. Preview inbox arrival was not separately
confirmed; the earlier local email's arrival was confirmed by Nate.

The previous old-GitHub-account gap is now resolved through fresh sign-in evidence:
`github.onSignIn` validates stable account IDs and the provider-verified email on
each sign-in, then refreshes the explicit marker. Two new tests cover existing
accounts and refusal of unverified/mismatched provider data. No password-account
linking or trust-on-backfill was added. The full suite now has 223 passing tests;
experiment and Start TypeScript checks pass, and the Cloudflare build/deploy passed.

Worker version: `e59e9f49-7fa8-4d5c-9cc2-5d4ab7e3949a`.
Only alpha received the invitation rollout/Bento configuration; beta, the gateway,
and Kino production were unchanged. The runner uses admin access only for the
isolated inviter fixture and removal; invitation acceptance uses the real GitHub
user's access token. No auth credentials are persisted in results.

Next: full organization policy parity (public/private, independent project members,
archived write guards and system-admin access), then organization switching and
cross-tab authorization/cache changes. Invitations still need production rate
limits, mail retry policy, and complete management UI. The tested concurrency is
accepted-invitation retries, not every possible first-accept/cancel/remove race.

## Permission matrix and organization switching (September 21)

The native policy proof now matches the central rules in `convex/lib/kino.ts`
and the archive/unarchive guard in `convex/functions/project.ts`:

| Caller | Public project | Private project | Archived project | Management |
| --- | --- | --- | --- | --- |
| Owner/admin or stored system admin | View | View | View | Full role permissions; archived content writes blocked |
| Assigned moderator | View | View | View | Content/settings only; cannot archive/unarchive, grant access or delete |
| Direct project member | View | View | Hidden | No management |
| Unassigned outsider/anonymous | View | Hidden | Hidden | No management |

Public organization visibility does not make private projects public. Direct
project membership grants no organization management. Public read helpers return
null data when denied; strict authenticated endpoints still reject anonymous or
unverified identities. Missing parent organizations fail closed. System role is
read from a server-owned user field, never a JWT role claim or client argument;
the eventual migration must map Kino's trusted role source to that field.

Eight new multi-user tests cover the visibility/role matrix, content writes,
organization boundaries, forged system roles, live role revocation, archive guards,
explicit admin unarchive/deletion, direct-member revocation and parent deletion.
Deletion cleans the proof's assignment/direct-member children with an explicit
200-row limit per child table; it rejects overflow atomically. This is not the
full Kino project cascade (files, boards, integrations, etc.). Integration access
is represented by the same permission result; actual Relay integration endpoints
have not been migrated. Creation quotas, slug rules/default visibility, storage,
full project listing/search and product UI still need implementation parity work.
Existing proof rows without visibility remain private by default; this is an
intentional proof default, not Kino's public organization-creation default.

Start has `/org/$organizationId` with ID-specific query keys, an SSR loader,
useSuspenseQuery, and intent-preloaded navigation. Selection is route-local;
switching one tab does not silently change another tab's organization. Browser
queries return a denied state after revocation, replacing private cached data.
The first-page switcher remains capped at 20 memberships without pagination UI.

`results-switching.json` records real local password-login browser evidence:
hover starts the target subscription and click reuses it; two tabs select separate
organizations; demotion updates only the affected organization's management UI;
removal updates both tabs' data/navigation; back-navigation shows no observed
revoked-data flash; reload and SSR omit that organization's name/data; revoked
writes fail while the other organization's writes still succeed. No browser
exceptions in the passing run. This phase has not been deployed to alpha/beta.

The first browser run exposed an auth/hydration ordering issue: an anonymous
subscription response could overwrite an authorized SSR snapshot before client
authentication was ready. Protected document routes now use the installed Convex
client's experimental `expectAuth` option to hold requests until the first token.
Public/anonymous entry pages do not enable this gate. The behavior is covered by
the real browser regression; preserve the Convex version pin and recheck this
experimental option during upgrades. No exception was suppressed to pass the test.

Cached data already downloaded cannot be remotely erased from an offline device.
These checks establish connected-tab updates and no observed stale flash after
revocation propagation, not zero-latency revocation on disconnected clients.
Backend mutations always recheck current authority.

After the startup-order fix, the existing `scripts/start-browser.mjs` regression
also passed real sign-in/cookies, authenticated SSR with no browser HTTP query,
live mutation updates, hover reuse, anonymous/CSRF denial, refresh-cookie recovery,
sign-out, and zero hydration/browser errors. Start's client/server build and both
backend/Start TypeScript checks pass.

## Preview switching validation (September 21)

`results-switching-preview.json` passes the same hover/two-tab/demotion/removal/
back-navigation/SSR checks on deployed alpha. It uses synthetic fixture users
with real Convex-issued sessions, not a new human GitHub login. The prior real
GitHub invitation test remains the OAuth evidence. No browser or hydration
exceptions occurred. Worker version: `ddb346ae-0185-484a-bc7e-8a80cc00824a`;
backend: graceful-elephant-103. Beta, gateway and Kino production are unchanged.
The central permission/startup-order changes are now deployed to alpha, superseding
the previous local-only note. The separate relationship lifecycle experiment is
still undeployed; see ../relationships/README.md for scope and remaining gaps.
