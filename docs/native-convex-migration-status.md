# Native Convex migration: status and follow-up checklist

Last updated: September 23, 2026 (America/Mexico_City).

This is the working record for the Kitcn migration investigation. The
**Authoritative current status** and **Remaining release checklist** below govern
the cutover. Later dated checkpoints preserve the evidence available when they
were written; statements there about the then-current default runtime, feature
flags, deployment scripts, or remaining work are historical unless repeated in
the authoritative sections.

## Cutover decision

Kino is prelaunch and has no production user/data migration requirement. This
work will ship as one native-only PR and one coordinated release rather than a
long-lived dual-runtime rollout. Legacy Better Auth session continuity,
cross-database identity migration, and password/GitHub account linking are not
release blockers unless they are needed to develop or verify this PR. The native
GitHub Relay, Files Worker, preview workflow, and production release pipeline do
remain in scope because the shipped application depends on them.

After public launch, rollback to the legacy database is not a safe recovery
strategy: native accounts and writes would not exist there. Operational recovery
should use a forward fix on the native backend. The prelaunch rehearsal still
proves Worker and gateway version recovery, but it does not establish a data
bridge between the separate databases.

## Authoritative current status

PR #154 is native-only. The root `convex.json` targets `convex/native`; the app
no longer includes the Kitcn ORM/cRPC/auth runtime, its generated application,
or a build-time auth-runtime selector. Better Auth remains only in the standalone
gateway so the old production OAuth proxy can stay available during the cutover
acceptance window. It is not part of the native application runtime.

The PR's Cloudflare Worker Preview and matching Convex preview are isolated from
production. The build provisions their exact auth origins, validates non-placeholder
GitHub credentials, registers a branch-specific expiring route with the shared dev
gateway, and publishes the route signing key as a Worker Preview secret. Real
GitHub sign-in returned to `/dashboard`, and a reload remained authenticated.
The final Cloudflare preview build and `pnpm run verify:pr` pass. Production has
not been changed.

The native implementation now covers auth, SSR and live TanStack Query data,
organizations and permissions, projects and boards, Feedback, Updates, Files,
settings, admin operations, email, GitHub Relay, storage accounting and cleanup,
and the current product UI. Dated proof deployments below remain useful evidence,
but the PR preview is the release candidate.

## Remaining release checklist

### Before marking the PR ready

- [x] Complete the final native authorization, tenant-boundary, indexed-read,
      relationship, cascade, scheduled-cleanup, and deployment audit. Resolve or
      explicitly record every material finding.
- [x] On the actual PR preview, repeat verified email signup, verification,
      password recovery, reset replay rejection, and rejection of the old session.
- [x] On the actual PR preview, accept an invitation and exercise a representative
      private-organization/private-project permission and revocation flow.
- [ ] Complete a compact browser pass through dashboard, organizations, projects,
      boards, Feedback, Updates, Files, settings, Relay, and the important mobile
      layouts. Include populated data, file preview/upload/delete, and the
      non-manager organization summary.
- [x] Confirm cancellation, expired, tampered, and replayed OAuth state fail safely
      against the release-candidate preview. The protocol already has automated
      and earlier hosted evidence; this check verifies the final deployed pair.
- [x] Repeat a deployment-transition navigation/reload check so a stale route asset
      either refreshes cleanly or shows the existing new-version prompt.
- [ ] Resolve or explicitly accept the remaining lost-refresh-response risk.
      The observed sign-out coincided with a spent refresh-token rejection after
      its grace window; browser navigation is now mitigated, but an interrupted
      SSR response or network loss can still discard a newly rotated cookie.
- [x] Run the final root, native Convex, gateway, and Files Worker checks plus
      `pnpm run verify:pr`, lint, and the production build from the frozen commit.

### Production preparation

- [ ] Select a distinct native production Convex deployment and record its exact
      cloud/site URLs. Point `CONVEX_PROD_DEPLOY_KEY` at it. Do not replace the
      legacy deployment in place unless its documents have first been inspected
      and proven compatible with the native schema.
- [ ] Set and verify the native production environment: the six required auth
      values; Bento sender credentials; operations alert recipient; Relay
      credentials/callback; R2 credentials; Files origin; and cache-purge zone/token.
- [ ] Configure and deploy the production Files Worker with the native production
      `NATIVE_CONVEX_URL`, confirm the `kino-prod-org-uploads` binding, and verify
      `https://files.usekino.com/health` before enabling native file URLs.
- [ ] Deploy the production gateway's migration-bearing legacy stage first and
      record that compatible rollback version. Then configure its fixed native
      `NATIVE_GITHUB_ROUTES` entry, deploy the reviewed dual-protocol version, and
      verify health, the retained legacy proxy, Relay, and native state storage.
- [ ] Configure Workers Builds with the production Convex key, exact app origin,
      gateway URL/admin token, fixed native route ID/secret, and existing PostHog
      values. Separately configure the `kino` Worker's runtime bindings
      `NATIVE_GITHUB_GATEWAY_URL`, `NATIVE_GITHUB_ROUTE_ID`, and secret
      `NATIVE_GITHUB_ROUTE_SECRET`; suffixed build variables do not create those
      runtime bindings, and the production deploy intentionally uses `--keep-vars`.
- [ ] Freeze the app commit, native Convex deployment, Files Worker version,
      gateway stage/active versions, auth package revision, callback URLs, and a
      non-secret fingerprint of the native route mapping.
- [ ] Review the exact release sequence and rollback/forward-fix thresholds, then
      obtain explicit production deployment authorization.

### Release and acceptance

- [ ] Change the production Kino Auth OAuth app callback to
      `https://gateway.usekino.com/oauth/github/callback` at the coordinated
      cutover point. Leave the Kino Relay registration unchanged.
- [ ] Release the native Convex and app Worker from the frozen commit, then test
      logged-out GitHub sign-in, protected reload/logout, verified email and
      recovery, private access, Relay, Files, and one representative write.
- [ ] Inspect Convex errors and operations jobs, gateway and Files logs, Bento
      delivery, and Relay webhook receipts immediately after release.

### Cleanup after acceptance

- [ ] Rotate the root worktree's previously exposed `CONVEX_MANAGEMENT_TOKEN`.
- [ ] Delete the temporary **Kino Convex v2 Proof** OAuth app and disposable proof
      Workers/Convex deployments; remove ignored proof credentials and state.
- [ ] Retry `node scripts/native-settings-live-proof.mjs cleanup-visual` until the
      retained proof folder is removed.
- [ ] Delete preview OAuth route records when convenient or allow their 14-day TTL
      to expire; the preview cleanup workflow deletes the Worker and Convex preview
      but does not currently delete the route record directly.
- [ ] After an agreed native stability window, remove the gateway's legacy Better
      Auth proxy, its rollback secrets/tests, and obsolete legacy documentation.

### Deferred scale follow-ups

These are not prelaunch blockers at the current data volume:

- [ ] Move user-data export to an asynchronous job/download flow before raising
      the current synchronous cap of 200 comments per source.
- [ ] Paginate or rotate the operations incident scan beyond the oldest
      `PER_KIND_LIMIT=25` rows so a large persistent stalled backlog cannot
      starve later jobs of inspection and alerts.

## Historical evidence log

The checkpoints below are dated observations. They intentionally preserve the
state and limitations recorded during the investigation and are not the current
release checklist.

### September 22 equivalent dashboard timing checkpoint

The current production and isolated native builds now have a same-component
`/dashboard` browser comparison: ten authenticated, fresh Chrome contexts per
target. Median/p95 document TTFB was 982/1,948ms on production and 311/619ms
on native; FCP was 1,120/2,108ms versus 480/812ms. Every load contained the
team section in server HTML and made zero browser HTTP query calls. Production
sent four WebSocket subscription adds per load; native sent two. The accounts,
organization data, domains, and backend conditions differ, so this is observed
route timing, not an isolated Kitcn/Better Auth speedup estimate. The known
production GitHub `/session` failure occurred when GitHub was logged out;
pre-signing into GitHub allowed the benchmark to complete. No production fix
was deployed. Anonymous public feedback-list timing also passed, but the
native fixture is empty while production has one item. See the
[performance report](../experiments/convex-auth-v2/performance/README.md).

The native expired-access SSR probe also passed with a fresh, untouched
refresh cookie after 75 seconds: the dashboard remained private in server HTML,
the response set two refreshed cookies, and the single observed load took 651ms
TTFB / 840ms FCP. This is one edge-case observation, not a percentile estimate.
Backend read attribution is now recorded in the performance report: both
dashboard query paths were mostly cached in their sampled windows, while the
legacy auth token/session HTTP endpoints took hundreds of milliseconds per
call. Those windows include sign-in, so no per-load attribution is claimed.
An [initial cutover rehearsal](native-convex-cutover-rehearsal.md) switched the
disposable native app Worker to its prior version and back, with anonymous
route checks passing at both points. The complete native-to-legacy rollback
gate remains open: the release pipeline still targets Kitcn and the separate
databases need a write policy. The shared dev gateway now has native routes,
live single-use state storage, and a staged version it successfully rolled
back to and restored from. The isolated Kino preview now has matching native
Convex and Start code, and its callback and routing secrets point to the shared
dev gateway. Real GitHub login, reload, logout, repeat login, app rollback with
session survival, app restore, gateway compatible rollback, and gateway restore
all pass. The native gateway's negative state checks also pass after restore.
Next: repeat a real Better Auth login and Relay webhook on the shared dev
gateway, then finish the coordinated Files/release-pipeline rehearsal.
Production OAuth login still needs the short-state mitigation before a
logged-out first-login acceptance run can pass.

### September 22 native admin metrics checkpoint

The native `/admin` page now renders the stable dashboard's four platform-wide
totals (users, organizations, projects, feedback) and five most recent active
signups above the native job operations. The users total includes pending and
disabled accounts, matching the stable table count; the recent list exposes
only verified email evidence. The query rechecks the system-admin role and the
route preloads metrics during SSR. A backend test covers exact totals, recent
ordering, and ordinary/unauthenticated denial. All 107 native tests pass.

The pinned Convex runtime provides fast whole-table counts, but currently marks
`QueryInitializer.count()` internal in published typings. Its call is isolated
in `countTable` and must be rechecked when upgrading Convex. A temporary
system-admin grant to the signed-in proof account allowed browser acceptance:
the four cards rendered 3 users, 5 organizations, 3 projects, and 2 feedback
items, exactly matching separate proof-database reads. The three recent
signup rows and operations sections rendered and survived a full reload.
The account was restored to `user`, the temporary internal mutation was
removed and redeployed, and `/admin` again redirects that account to its
dashboard. The corrected query was pushed to Convex preview
`giant-jaguar-319` and the native Worker build to
`kino-native-auth-proof-c318c09d` (version
`f82c7f3c-6e79-4967-9986-76a9c5c6d003`). Unauthenticated `/admin` still
redirects to sign-in. Production was unchanged.

### September 22 native operations checkpoint

The native app now has a system-admin-only operations surface at `/admin` for
the six asynchronous job families currently used by the product: storage-object
cleanup, project deletion, board deletion, feedback deletion, update deletion,
and project-storage purge. The live, bounded query reports pending, running,
failed, and age/lease-stalled work. Resume actions recheck the system-admin role
inside the mutation and invoke the existing idempotent workers; storage cleanup
only resets a failed or expired lease. Orphaned feedback/update jobs remain
visible even when their parent document is already gone, and resuming an
orphaned update job removes the stale job row.

The isolated hosted proof confirmed that its signed-in regular user cannot open
`/admin` and is redirected to `/dashboard`. System-admin listing, denial for a
regular user, resumption, board cleanup, and orphan-job cleanup are covered by
the backend test. The application emitted no page-level errors during the hosted
check; the collaborative Electron shell logged only its own renderer startup
diagnostics. All 103 native tests pass, along with root, legacy Convex, and
native Convex TypeScript and the three complete locale catalogs. Convex preview
`giant-jaguar-319` contains the final backend. The route-free proof Worker is
version `632f3374-976f-463e-a16c-853f4abe35ae`; production was not changed.

The follow-up reliability slice is also complete. A five-minute cron records
deduplicated failed/stalled incidents for all six job families, sends Bento
alerts to the explicit `NATIVE_OPERATIONS_ALERT_EMAIL` recipient, retries a
rejected delivery twice, and sends at most one reminder per 24 hours. Resuming a
job resolves and suppresses its incident for five minutes. The admin page shows
recent delivery/resolution state. Alert bodies escape stored identifiers and do
not include credentials, raw transport errors, or user content.

A daily retention pass removes completed storage-cleanup rows after 30 days and
resolved alert/completed-maintenance history after 90 days. System admins can
start cursor-bounded dry-run or repair jobs for native Feedback upvote totals and
Update comment/heart totals. Dry runs only report checked/drifted counts; repair
runs use the same resumable worker and update only mismatches. One active job per
aggregate kind prevents overlapping rebuilds.

The proof deployment's operator recipient is `hello@natedunn.net`. A hosted
scan completed with zero active incidents, so no proof alert email was sent.
The proof has no system-admin identity, so its regular signed-in user was again
confirmed redirected from `/admin`; system-admin rendering and maintenance
execution are covered by authenticated backend tests. Captured Bento transport
tests prove configured delivery, escaping, and credential exclusion. All 106
native tests pass. Convex preview `giant-jaguar-319` and route-free Worker version
`9e25cba8-e123-4bb7-a655-a09814719699` contain the slice. Production was not
changed.

### September 22 storage entry-point closeout

The active uploads are Files, update covers, profile avatars, and organization
logos. Native Files and covers already used the isolated R2 transport; native
avatars and logos already uploaded to Convex storage. The remaining lifecycle
gap is now closed for successfully registered image uploads: the client records
the returned storage ID against its short-lived intent, failed saves discard
the blob immediately, and the existing expiry cron deletes registered orphaned
blobs. Owner/manager checks, cross-intent claims, replacement, and physical
deletion are covered by native tests. Old `asset-library` routes redirect into
native Files only in the native build, so direct old links no longer invoke
Kitcn's file queries. A legacy file ID has no native equivalent before data
migration and may still lead to a missing-file page.

The isolated hosted proof used the dedicated synthetic storage identity: it
uploaded both a PNG avatar and a PNG logo, registered and discarded them, then
confirmed neither discarded intent could be committed. It made no changes to
real user images or production. Native Worker version
`6c47eaf0-a259-48f3-a2f5-cbef6c05a757` and Convex dev
`giant-jaguar-319` contain the change. All 100 native tests passed. The
25 MiB per-file and 50 MiB batch limits are shared with the current app;
multipart is not needed for an accepted upload. A later hardening pass added a
six-hourly, paginated root-storage reconciliation. It deletes unreferenced
root-storage blobs once they are at least 24 hours old, including files whose
type or size would fail the later commit checks. This closes the permanent
leak when a browser exits between the storage POST and
registration. The blob can remain until that delayed pass runs. This rule
assumes root Convex storage in the native deployment is used only for avatar
and organization-logo images; any new root-storage writer must add its
references to the reconciliation guard before release. The hosted proof above
predates the reconciliation change; its delayed cleanup is covered by the
current 102 native tests, not a new live 24-hour observation.

### September 22 cross-domain write and visibility audit

Traced the current and native write paths for organization/project slug changes,
visibility changes, Feedback title/initial-comment search updates, Update
create/edit/publication search, related Feedback, Relay slug copies, and file
delivery. Native content, files, and Relay reference immutable project IDs;
`settings.updateProject` updates the active Relay project slug, while
`settings.updateOrganization` updates bounded Relay installation/connection
slug copies. Pending OAuth states intentionally expire on rename. Feedback
deletion is fenced by `isFeedbackLive`; Update related-feedback reads filter
deleted or inaccessible targets. Update deletion detaches cover files before
the row is removed. No new notification dispatch was found in the current
Feedback/Update write paths.

- [x] Native Update create/edit now use the same `buildUpdateSearchContent`
      helper as the current app. Search no longer indexes script/style text or
      raw HTML entity names. A create-then-edit search test checks visible hits
      and removal of old/hidden terms.
- [x] Organization privacy supersedes project visibility. Making an organization
      private atomically changes its public projects to private; making it
      public again does not re-expose them. Native creation and both project
      settings mutations reject public projects in private organizations. The
      native create/settings UI disables Public with an explanation. Native
      project reads and file delivery continue to fence outsider access even
      if inconsistent legacy data is encountered. This resolves the earlier
      cutover policy decision in favor of the stricter privacy boundary.

The native backend tests pass (96 tests in 16 files), as do root TypeScript,
focused ESLint, and formatting. These backend changes were deployed only to
the isolated native Convex preview `giant-jaguar-319`. The privacy rule and
localized create/settings controls were also deployed to isolated Worker
`kino-native-auth-proof-c318c09d` (version
`0ec57478-5c2d-4d7c-9581-e39a67a7d9a2`). No production deploy or data
migration was performed for this checkpoint.

### September 22 populated project UI comparison

Production `usekino.com/@natedunn/kino` and the isolated native proof were
compared in the same signed-in Chrome window at desktop width. Native was
populated with a disposable board, feedback thread, published update and
comment, folder, and uploaded image; production was only read.

- [x] Populated Feedback and Updates lists use the production card layouts,
      including featured update treatment. The native Feedback detail no longer
      uses its diagnostic proof layout: it uses the production header,
      discussion cards, event rail, rich comment editor, sidebar sections,
      and mobile details drawer while retaining native mutations and
      permission checks. Its mobile header now exposes Edit title.
- [x] The native Updates detail uses the production body, discussion, and
      sidebar layout. Its Edit update button now renders from the critical
      permission data while the interactive query loads, and was confirmed in
      Chrome on the proof deployment.
- [x] Populated Files root and folder views show the production explorer,
      breadcrumb, file row, and storage layout. One uploaded PNG and its folder
      were checked in Chrome. The file was marked for deletion after the check;
      the empty folder remains until the scheduled storage cleanup releases
      its deleting asset (the folder ID is retained in the ignored
      `integrations/native-convex/.env.settings-proof.local.json`). The
      disposable feedback/update/board fixture was removed. After the storage
      job completes, run `node scripts/native-settings-live-proof.mjs cleanup-visual`
      to remove the folder; the command safely reports if it is still waiting.
- [ ] This is layout parity for these specific states, not exhaustive visual
      parity. Feedback now shares the production target drawer; its tag editing
      control is still less polished than production's picker. Production has team badges,
      avatars, and populated metadata not present in the proof account. File
      preview, upload interactions, menus, and all small-screen Files states
      still need side-by-side Chrome review. The deployment-transition stale
      route-asset issue below remains open.

Native Convex preview `giant-jaguar-319` and isolated Worker version
`69fcebfe-49a9-4863-82ff-90ce97cd2702` contain these changes; production was
not deployed. Native Feedback and Files tests (19 cases), root TypeScript,
focused ESLint, translation catalog checks, and native and stable Worker
builds passed.

### September 22 Chrome UI comparison: dashboard, organizations, and projects

The signed-in production site (`natedunn`/Spanish) and isolated native proof
(`hello`/English) were compared in the same Chrome window and viewport. The
native organization overview was still a diagnostic page, and the project
overview was missing its data-backed header. Both are now repaired in the
working tree and deployed to Convex preview `giant-jaguar-319` and isolated
Worker version `252340dd-2822-4141-96e5-2a7e5b0c317f` only:

- [x] Dashboard: same header, feed, team/news card layout. Account data, locale,
      avatar, and creation entitlement differ, so screenshots are not identical.
- [x] Organization overview: native and Kitcn now share the same hero, counts,
      project cards, member sidebar, and activity presentation. The native
      adapter supplies live organization, project, permission, and manager-visible
      member data. Native project cards now include stored descriptions. The
      inline diagnostic project/invitation forms are gone; the original create
      and organization-settings routes remain available.
- [x] Project overview: native now uses its already-prefetched project query to
      show the original name, visibility, description, first link, creation time,
      and permission-gated Settings action. The original stats/feed/sidebar
      component tree remains shared.
- [x] In the tested empty-data state, Feedback, Updates, Files, and project
      General Settings match the production layouts. Their text and accent
      colors differ because the accounts use different locales and themes.
- [ ] This is **visual parity for the inspected states**, not full data or role
      parity. Non-manager member summaries on native organization overview still
      need a read-safe query; manager summaries work. Other project tabs,
      populated content, dialogs, mobile widths, and mutation states still need
      direct side-by-side review.
- [ ] Organization activity, two organization KPI values, and the project
      overview's KPI/activity/team/update panels are existing static draft data
      in both runtimes. They must be backed by real native data before claiming
      product-data parity; matching their appearance is not proof that the
      metrics are accurate.

The first post-deploy Chrome navigation reused stale route assets and still
displayed the diagnostic organization page. Navigating with a new query string
loaded the new layout. Deployment-transition asset/cache handling remains an
acceptance check. Root and native Convex TypeScript, focused ESLint, native
production build, and `i18n:check` pass for this change.

### September 22 dashboard and creation-limit checkpoint

- [x] The native `/dashboard` branch now renders the original shared dashboard
      layout, including its header, team sidebar, feed, news card, and team
      creation link when allowed. The native loader preloads the profile and
      organization list for SSR; the team sidebar uses that reactive list,
      including logos.
      The original feed and news cards still use their existing placeholder
      data on both transports.
- [x] Native team and project creation now enforce the stable app's existing
      role-based limits in the same transaction as the write: one team and one
      project per organization for a regular account; 100 each for a system
      admin. The automatically created native personal organization does not
      consume the regular account's team slot. The original creation forms and
      dashboard read the same server-side team/project decisions. No paid-plan
      entitlement exists in the stable app yet, so none was inferred here.
- [x] Hosted acceptance on Worker `d6fa1602-fc9b-4862-9831-5c050d8631ce`
      showed the original dashboard with both existing organizations, feed,
      and news; "New team" was hidden for an account with its free team already
      created. The team and project creation forms showed their limit message
      and disabled submission. No disposable organization or project was added.

A same-size Chrome comparison with the signed-in production dashboard confirmed
that the header, feed cards, grid, and team/news cards use the same layout. The
screenshots are not identical: production is signed in as `natedunn` with one
team, a photo, Spanish search text, and available team creation; the isolated
native proof is signed in as `hello` with two organizations, a generated avatar,
English text, and its regular-user team limit reached. The second team row moves
the news card down. Layout parity here does not imply migrated account data,
matching permissions, or matching locale between those two identities.

Validation: `verify:pr`, 93 native tests in 16 files, focused lint/format checks,
and the native client/SSR production build pass. The backend was pushed only to
Convex preview `preview-native-auth-kino-c318c09d` at `giant-jaguar-319`; the
Worker deployment has no custom-domain routes.

At that checkpoint, equivalent-workload performance and cutover rehearsal remained. The dashboard's feed/news content
remains the original placeholder surface, not a completed cross-project feed.

### September 22 account, export, creation, and command-palette checkpoint

- [x] The existing Account Data screen now exports the signed-in user's authored
      feedback and update comments from native Convex. The JSON contract remains
      `kino-user-data-export` version 1, with visible/missing/inaccessible parent
      context, verified account email, ascending ISO timestamps, 750 comments per
      source, and a 900 KB synchronous-download ceiling. Reads are indexed and
      require the current user and linked profile.
- [x] Profile, language, security, and public-profile routes now use a shared
      native/legacy profile facade without changing their UI. Native profiles
      preserve username uniqueness, verified-email precedence, locale, bio,
      location, URLs, self-only private organization visibility, and avatar
      replacement through owner-bound, expiring, single-use upload intents.
      Expired intent rows are cleaned every 15 minutes. Abandoned uploaded blobs
      still need the broader storage reconciliation policy already tracked below.
- [x] The original team and project creation screens now use a native/legacy
      creation facade. Native writes preserve selected public/private visibility,
      collision-safe organization slugs, project slug uniqueness, manager checks,
      and default boards. The command palette's project update search now uses the
      native updates facade; its UI, debounce, and navigation are unchanged.
- [x] A hosted account export produced `kino-user-data-2026-09-22.json` with the
      expected format/version and the disposable fixture's two feedback comments
      plus one update comment. The fixture was removed afterward. A profile name
      change appeared on `/u/hello` and was restored to its prior value. Both
      creation forms load in the hosted native app; creation authorization and
      persistence are covered by the focused backend tests rather than disposable
      hosted organizations.

Validation: 92 native/adapter tests in 17 files pass, along with `verify:pr`,
root/native TypeScript, focused lint/format checks, all 1,107 messages in three
locales, and the native client/SSR build. Deployed only to Convex dev
`giant-jaguar-319` and isolated Worker version
`f8a14b65-6c73-4302-8eb5-841029271360`. Production and the default Kitcn runtime
are unchanged.

The newer dashboard checkpoint above closes the creation limit and dashboard
visual gaps. Notification and account deletion screens remain existing
placeholders; no new behavior was invented.

### September 22 members and board-settings checkpoint

- [x] Organization members and invitation forms now use native subscriptions and
      mutations, including role changes, removal, cancellation, and moderator
      project assignments. Existing moderators can have every grant revoked;
      invitations and transitions into moderator still require a project.
      Owner protections and the existing native invitation-acceptance flow remain.
- [x] Project members now support manager-only direct membership by verified
      account email, removal, and moderator assignment. Ambiguous email matches
      between separate auth identities are rejected. Direct and organization
      access remain independent, matching the existing product behavior. Archived
      projects reject membership writes.
- [x] Board settings/new/edit now use native CRUD and the original layouts.
      Shared validation, unique slugs, project boundaries, and archive restrictions
      are enforced. New/edit copy is complete in all three locales.
- [x] Board deletion hides the board immediately and drains feedback plus its
      children in bounded transactions. Feedback comments, votes, relations,
      update links, and Relay entry points check the board tombstone. Update
      editors discard dead existing links so unrelated edits remain possible;
      newly submitted invalid links still reject. High-fanout cascade tests cover
      both relation directions and preservation of unrelated boards.

Validation: all 81 native tests in 14 files pass, root TypeScript and focused
lint pass, all 1,107 messages have all three translations, and the native client/
Worker build passes. Changes target dev `giant-jaguar-319` and the isolated native
preview only. Three agents owned organization members, project members, and board
settings; integration review caught and fixed the stale update-link edge case.

Live acceptance passed on Worker `15e50a81-4ebb-440b-a6ed-0213e5ae7384`:
organization member/invite form and project picker load; owner removal is disabled
in the UI and rejected by the deployed API; a disposable direct membership was
removed through the original confirmation flow. The board form created a board,
renamed it, and retained the change after fresh navigation. Deleting it after
adding feedback, a reply, and a vote returned to settings and removed the board
and feedback from native queries; the three original boards remained. Actual
child-row cleanup is asserted by the cascade tests, not inferred from the UI.
No invitation email was sent in this checkpoint. All disposable live records
were submitted for cleanup; the reusable settings project remains.

The embedded preview's native confirmation temporarily blocked automation; the
exact test confirmation was accepted through macOS accessibility and testing
continued. An alternate password-browser attempt authenticated a separate
existing identity and correctly lacked access to the fixture; no grants were
added to work around that separation.

The unlinked board-detail JSON placeholder is still legacy and intentionally
outside the completed settings flow. Mobile/browser role-change acceptance and
the remaining migration gates are tracked separately; these checks do not imply
production cutover readiness.

### September 22 general-settings and appearance checkpoint

- [x] The original project general form now uses native queries/mutations in the
      native build: name, slug, description, links, featured-update mode, and
      visibility. Slug uniqueness, archive permissions, and verified GitHub link
      provenance are enforced on the backend. Renames atomically update active
      Relay references; pending authorization attempts using old slugs fail safely.
- [x] The original organization general form now saves native names/slugs and
      uploads organization logos. Upload intents expire and are single-use;
      commit checks manager permissions, image MIME/size, and attached-file reuse.
      Replacing a logo deletes the previous stored object. Uncommitted uploaded
      blob cleanup remains an operational follow-up; intent cleanup alone does
      not remove abandoned blobs.
- [x] The existing appearance editor publishes native project themes with
      revision-conflict protection, curated-preset/contrast validation, and
      archive restrictions. Saved themes and organization logos now reach the
      shared project shell. Project deletion also removes its theme.
- [x] Browser acceptance on the isolated deployment passed project name/slug/
      description/link saves, organization name/slug changes, PNG logo upload,
      and publishing Purple. Fresh navigation confirmed the renamed project,
      loaded logo, and persisted theme CSS. Backend inspection independently
      confirmed the saved values. Visibility permissions were unit-tested;
      the browser's synthetic select interaction did not change the selection,
      so this is not recorded as a live visibility-change pass.
- [ ] Narrow-viewport acceptance remains open: preview resize again timed out.
- [x] Organization members/invitations UI, project membership management, and
      board settings CRUD are ported (see the newer checkpoint above). Invitation
      acceptance was reused. Feedback exports follow.

Validation: 18 focused settings/appearance/logo/files tests pass, alongside the
earlier 24-test settings/organization/Relay/files run. Root TypeScript, focused
lint, and the native production build pass. Deployed only to dev
`giant-jaguar-319` and isolated Worker version
`31202486-df19-4101-8ab6-4ef1d21fdc58`.

The reusable browser fixture is
[`@native-settings-renamed/settings-renamed`](https://kino-native-auth-proof-c318c09d.hello-fc8.workers.dev/@native-settings-renamed/settings-renamed/settings/general).
`scripts/native-settings-live-proof.mjs inspect` checks persisted fixture values;
its admin impersonation is not evidence of login. The fixture remains private.

### September 22 project-navigation checkpoint

- [x] The native organization shell now detects project routes and reuses the
      original `MainNav` project context and `DynamicNavigation` subnav. The
      deployed preview shows the original breadcrumb and all seven tabs; native
      `canEditSettings` controls Settings visibility, Feedback receives the
      active state after client navigation, and the shared TanStack links retain
      the router's intent preloading and responsive overflow implementation.
      TypeScript, focused lint, and the native production build pass. The
      deployed isolated Worker version is
      `1c3c7144-e4a8-433b-8750-b44462ab3a15`.
- [x] Persisted project themes and organization logos now use the native data
      contract (see the settings checkpoint above). The preview resize control timed out, so the
      unchanged responsive nav implementation is source/build verified rather
      than newly browser-measured at a narrow viewport.

### September 22 Relay checkpoint — native port and live delivery verified

The original organization/project Integrations screens now select native Relay
queries/actions in the isolated build. The existing feedback issue dialog is
reused in native feedback detail. No production runtime switch or permanent
feature flag was added.

Implemented in `convex/native/relay*.ts` and `http.ts`:

- App-owned installation, repository, signed connection-state, linked-issue,
  and webhook-delivery tables; indexed and bounded reads.
- Install/refresh callbacks with exact app/deployment origins, ten-minute state,
  single-use consumption, and current initiating-user membership checks.
- Repository listing, read/read-write verification, one active repository per
  project, organization repository uniqueness, stale-installation recovery,
  authorized reinstall reconciliation, and disconnect fencing.
- Original issue search/create/link/refresh actions with scoped installation
  tokens, rate limits, and permission rechecks before persistence. Private
  repository snapshots are hidden from public viewers. Disconnected or inactive
  installations cannot serve linked-issue snapshots or perform writes.
- Raw-body webhook HMAC verification, delivery deduplication, installation
  lifecycle, repository-removal revocation, and issue snapshots bound to both
  installation and repository. Unknown installations are ignored normally.
- Bounded project/feedback deletion now removes Relay states/connections/links.

Validation: the full suite passed 421 tests in 66 files; one subsequently added
action test also passes (seven focused Relay tests total). `verify:pr`, the native
build, and the separate Node sourcemap test pass. Tests include the actual HTTP
callback with mocked GitHub, replay rejection before code exchange, current
membership revocation, expiry, reinstall reconciliation, repository conflicts,
private-link visibility, archive/disconnect fences, signed removal webhooks,
deduplication, feedback cascade, and mocked issue creation with scoped tokens.

Deployed only to dev `giant-jaguar-319` and Worker
`b8981d3e-aaff-4d74-b249-490fc5a26d86`. The hosted original organization settings
screen loads, installation initiation reaches GitHub's Kino Relay (Dev) login,
and a signed direct webhook returned `duplicate:false`, then `duplicate:true`
on replay. The native webhook target is registered with the existing dev gateway
(HTTP 200); real GitHub fan-out delivery is verified in the follow-up below. Existing dev credentials
matched; only `GITHUB_RELAY_CALLBACK_TARGET_URL` was set to
`https://giant-jaguar-319.convex.site/api/github/callback`. No GitHub registration
or gateway deployment changed. Local `.env.relay.local` is ignored.

Live follow-up: Nate completed existing-installation authorization in Chrome.
The real callback returned `github=connected` and saved the `natedunn` account.
The project picker loaded 69 repositories. Nate selected `natedunn/dos` and
verified/saved it in read-only mode. A fresh authenticated page navigation
confirmed the persisted repository, read-only selection, and disconnect controls.
Account refresh returns quickly when GitHub consent is already granted.

Nate confirmed disconnecting and reconnecting the same repository in Chrome.
Real GitHub fan-out delivery now passes: dev Relay delivery
`3843683281543364608` (`issue_comment/edited`, GUID
`d691bcb0-b473-11f1-98c8-ccefe6d9d679`) was redelivered twice using GitHub's
App webhook API. Redelivery attempts `3844208667974959104` and
`3844208712669462528` reached `gateway-dev.usekino.com` at
17:45:56 and 17:46:17 UTC on September 22, each returning HTTP 202.
Native Convex HTTP and `relay:webhook` completion logs confirm both arrivals
without errors (request IDs `bc41837eb3df2349`, `c0213d6cdd87cd80`).
The first arrival created exactly one receipt; its ID and timestamps remained
unchanged after the second arrival. The event concerned `natedunn/exile.sh`,
not the connected `dos` repository, and was correctly recorded as `ignored`.
This proves real transport, signature acceptance, and deduplication.

The authorized disposable test in `natedunn/onda` now also passes:
[issue #1](https://github.com/natedunn/onda/issues/1) was created through the
native action, linked to two temporary feedback items, and given a backlink
comment. Duplicate linking was rejected without posting another comment.
Closing and renaming the issue through GitHub updated both native snapshots via
real webhooks. The open feedback page changed to the new title and Closed
without a page reload or manual snapshot refresh. The issue is closed; both
feedback items were removed, and the original `natedunn/dos` read-only connection
was restored and verified through the native query and deployed browser UI.
The action harness impersonates the authorized fixture owner with the dev admin
key; login acceptance is the separate human Chrome check above.

The original `dos` target is archived: its read verification passed, but GitHub
rejected issue creation with 403. That attempt created no external issue/comment;
its temporary feedback was removed before the authorized `onda` test.

The organization empty state now exposes **Connect existing installation** using
the same authorization path already verified in Chrome. Known installations keep
**Refresh accounts**. All three locales are included. `verify:pr`, focused lint,
and the native build pass; the isolated app Worker version is
`924060f7-27f4-4f23-96c2-cf113de2b682`. The empty-state visibility change is
source/build checked; a second empty organization was not created solely to click
this label. Production and GitHub App registrations were unchanged.

Remaining acceptance limits:
GitHub writes and Convex persistence are not one atomic transaction, and this
port does not add automatic write retries or promise exactly-once issue creation.
The legacy feature links issue snapshots; it does not implement full bidirectional
discussion/issue import. Delivery/state retention and job operations remain in
the operations stage. The temporary native GitHub client port replaces Kitcn
errors/env dependencies; remove the legacy copy at cutover. GitHub API listing
uses bounded pagination rather than silently truncating repositories to page one
([GitHub installation API](https://docs.github.com/en/rest/apps/installations)).

### September 22 Updates checkpoint — original UI restored

The native build now reuses the original Updates list, featured cards, search,
management table, editor, detail/sidebar, sharing controls, and comment UI.
`updatesWorkspace.ts` supplies their native view models; `updates-api.ts` is the
temporary transport adapter. Cover rendering keeps the original styling. Selected
feedback displays its title and board, including after saving and reloading.
The original preview/search text helpers are shared by both backends.

Comment loading preserves the original five-comment head and ten-comment tail.
Older pages use one-shot queries so cached pages do not accumulate live
subscriptions. Tests cover all 24 comments across the windows, draft privacy,
permission failures, partial edits, and inaccessible related-feedback labels.
Failed optimistic reaction writes now clear the optimistic override.

Hosted browser checks passed original-editor draft creation, related-feedback
selection, persisted editing, publication, copy-link sharing, authenticated SSR
title/body, management bulk unpublish, comment creation/editing, and deletion via
the original confirmation dialog. The disposable update was removed; the existing
cover fixture remains. The existing
RSS affordance remains an existing placeholder: no feed route was found, and feed
delivery is not claimed. The legacy publish/unpublish implementation has no
notification dispatch to port; broader notifications and exports remain separate.

Validation: 415 Vitest tests in 65 files, the separate Node sourcemap test,
`pnpm run verify:pr`, and the native build pass. Focused lint has zero errors
and three shadow-name warnings. Isolated Worker version
`f7688c48-59c0-4913-bd42-71379eada0bf`, Convex dev `giant-jaguar-319`.
Production and the default runtime are unchanged. No manual action is required.

### September 22 storage checkpoint — original Files UI restored

The native Files slice now includes reserved quota before upload, validated
staging-to-final object promotion, folder operations, authorized delivery,
128px WebP thumbnails, text extraction, and update-cover replacement/deletion.
Real browser checks exercised file upload, detail, rename, download initiation,
cover upload/replacement, and deletion in the isolated application.

`scripts/native-files-preview-proof.mjs` additionally passed real R2 upload and
completion, GET, HEAD, byte ranges, thumbnail decoding, cached public-access
revocation, rename/move, and immediate delivery denial after deletion. Its
dedicated fixture identity tests storage, not OAuth. Fixture state is retained
in ignored `integrations/native-convex/.env.storage-proof.local.json`.

**Scoped-token follow-up passed.** Nate supplied the token in the ignored local
file, and it was installed only on `giant-jaguar-319`. Cloudflare accepted the
fixture's cache-tag purge with HTTP 200 and `success: true`. Direct R2 HEAD checks
returned 404 for its staging, final, and thumbnail objects. After the previous
failed attempt's lease expired, the deployed cleanup retry acknowledged deletion
and purge and released usage to zero. The saved scripted fixture is now `done`.
This verifies API acknowledgement of the global purge, not independent sampling
of every Cloudflare point of presence. All seven earlier browser-fixture cleanup
jobs were subsequently resumed and reached `done` as well.

Completed follow-up:

1. Completed: read `NATIVE_FILES_PURGE_TOKEN` from ignored
   `integrations/native-convex/.env.storage.local`; never print its value.
2. Completed: replace that secret only on native deployment `giant-jaguar-319`.
3. Fixed and tested cleanup-resume authorization for archived or deleting projects;
   readers remain rejected. Deployed this and the project-storage deletion barrier
   and extended upload-settlement window to the isolated native backend.
4. Completed for the scripted fixture: `node scripts/native-files-preview-proof.mjs`
   verifies acknowledged deletion and zero retained accounting. The seven earlier
   browser cleanup jobs also completed. That checkpoint's 1,335-byte update cover
   and Markdown acceptance file were subsequently removed through the UI. The PNG
   fixture remains; replacement-cover cleanup may retain quota until its upload
   settlement window ends. The browser project's usage is not expected to be zero.

The native runtime now uses the original Files shell, sidebar/tree, table, upload
wizard, folder/rename/move dialogs, detail previews, advanced search, and project
and organization storage settings. Native view queries adapt the data to these
components; the simplified replacement screens were removed. Update covers also
reuse the original cover-upload component. This is a temporary whole-build
transport seam, not a permanent product feature flag.

Validation: 413 Vitest tests in 65 files passed, plus the separate Node sourcemap
test, `pnpm run verify:pr`, focused lint, and the native application build. New tests
cover archived cleanup retries, view permissions/filtering, preserving the folder
on rename, preserving the name on move, reserved system-folder names, and inheriting
the request-scoped SSR query function.

Hosted browser checks passed original-dialog folder creation and two-file upload,
Markdown and PNG previews, thumbnails, rename, move to root, reload persistence,
search with an extension filter, and project/organization usage breakdowns.
Browser resize automation timed out, so responsive behavior was checked in a
same-origin 390px frame: the Files table had no viewport overflow and the mobile
drawer opened with its original search/upload/folder controls and tree. The
original file-delete confirmation path removed the Markdown fixture and updated
the listing and usage. The shared cover widget replaced the fixture cover with a
1200×500 PNG, retained it after reload, and removed it successfully across reload.
This proves the checked responsive behavior, not screenshot equality on every device.
The organization settings header now reads the same native profile as its shell,
fixing an authenticated page incorrectly showing the legacy sign-in link.

Hosted scope is only `giant-jaguar-319`,
`kino-native-auth-proof-c318c09d`, and `kino-native-files-proof-c318c09d`
at `native-files-proof.usekino.com`, using new `NATIVE_*` objects in the dev
bucket. Existing production services and objects are unchanged.
The refreshed application Worker version is `df36752a-706e-4ea1-bbb6-1701100eef06`.

The original project danger-zone page now invokes the native project-deletion
lifecycle. The slug confirmation and layout are unchanged. A deletion immediately
hides the project and denies new reads/writes, then removes feedback descendants,
updates and comments/reactions, boards, memberships/assignments, and invitation
project references in bounded batches. Empty pending moderator invitations are
cancelled. The project and storage metadata remain until original/thumbnail/staging
cleanup jobs are all acknowledged and usage is zero. Only then are the storage
records and project removed. Late duplicate scheduled calls are harmless.

Tests cover 130 feedback comments, 105 update comments, 105 invitations spanning
multiple pages, archived projects, unauthorized requests, interrupted cleanup and
resume, duplicate requests, blocked new writes, and preserving another project.
The deployed browser deleted a separate disposable project with an update and
default boards through the original confirmation dialog and returned to its
organization. Follow-up database inspection checked 13 relevant tables, found no
remaining project records, and confirmed the existing proof project was preserved.
This live project did not contain newly uploaded R2 objects; the
combined external-failure barrier is covered by tests, alongside the earlier real
R2 cleanup/purge evidence. Do not describe this as a fresh end-to-end R2 project
deletion timing benchmark.

Storage entry-point audit: the active upload controls are Files, update covers,
profile avatars, and organization logos; each has a native adapter. The old
`asset-library` URLs now redirect to native Files in the native build, while
the stable build retains its original routes. Avatar/logo uploads register
their returned Convex storage ID against an expiring intent, discard on failed
commit, and delete registered unclaimed blobs when an intent expires. The
delayed root-storage reconciler also deletes unregistered orphan uploads after
24 hours; a browser crash can leave a temporary untracked blob until it runs.
The shared policy
caps files at 25 MiB and direct batches at 50 MiB in both runtimes, so multipart
is not needed for a currently accepted file size. Future attachment surfaces
and higher limits will need a separate transport decision. Broader job
inspection/recovery remains in the operations stage. Public thumbnails use
stable URLs without signed-URL polling; private delivery refreshes short-lived
URLs. Root system-folder names are reserved case-insensitively.

**Historical direction recorded during the parallel-foundation phase:**

- Preferred direction: native Convex with official Convex Auth v2 (`reboot`).
- Preserve verified email/password signup, login, and password recovery.
- Move organizations and authorization into app-owned tables/functions.
- Use `convex-helpers` and `convex-verify` selectively; Fluent Convex remains optional.
- Preserve SSR, live data, hover preloading, and responsive navigation.
- Prelaunch data migration is a low priority; correctness and future maintenance
  are priorities.

At this checkpoint Kino still defaulted to Kitcn/Better Auth and selected the
native backend with `VITE_AUTH_RUNTIME=native`. That selector and the legacy app
runtime have since been removed in PR #154. The production OAuth registration,
app, and production gateway still have not been changed.

## Do I test now or after merging?

**Both, against different systems.**

| When                                                 | What the test establishes                                                                   | What it does not establish                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Now, in the local proof                              | The pinned v2 provider can complete real GitHub login against a real local Convex backend   | Kino gateway, Start SSR, or deployed cookie behavior               |
| Before merging the integration, in a working preview | The actual application, auth adapter, permissions, and dev gateway work together            | Production configuration or independently deployed gateway version |
| After deploying the integration                      | The released app and gateway work with that environment's credentials, domains, and cookies | Future upgrades remain safe without regression checks              |

The requested sign-out/re-login check can be performed **now**. It is not waiting
for a merge. It verifies whether the local v2 provider signs out and resolves the
same app user on the next login. Repeat it against the integrated preview and
released app later. An unperformed check stays pending; it is never inferred from
a merge or a successful reload.

Merging the proof files alone does not install v2 into Kino. Also, **merging or
deploying the app does not deploy its standalone OAuth gateway**. Follow
[the gateway release instructions](github-environments.md) when we reach that stage.

## Completed evidence

| Area                              | Result                                                                                                                               | Evidence / limits                                                                                                                                                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App inventory                     | Completed initial scan                                                                                                               | Auth, cRPC, ORM, schema side effects, routing, files, GitHub, tooling, and existing tests inventoried; inventory summarized below                                                                                                                                                    |
| Isolated proof harness            | 263 tests in 26 files pass; TypeScript passes                                                                                        | Rechecked September 21 after adding native organizations, invitations, policy, relationship cascades, storage cleanup, and project/storage integration                                                                                                                               |
| Kino integration foundation       | Historical parallel-runtime checkpoint passed                                                                                        | PR #154 subsequently removed the Kitcn application runtime and made `convex/native` the root application; see the authoritative status above                                                                                                                                         |
| Core session lifecycle            | Local component tests pass                                                                                                           | Includes no-session signup, later sign-in, rotation, replay handling, and sign-out; not the custom email workflow                                                                                                                                                                    |
| Password component                | Actual WASM hashing and component tests pass                                                                                         | Does not establish complete recovery or post-reset session revocation                                                                                                                                                                                                                |
| Request-scoped auth adapter       | Unit and live Start checks pass                                                                                                      | Actual server function/routes, HttpOnly cookies, parallel-token refresh sharing, anonymous isolation and logout verified; Local HTTPS/workerd and deployed GitHub cookie-session checks pass; broader refresh/streaming edge cases remain open                                       |
| Suspense SSR, hydration and hover | Local browser proof passes on dev and built preview                                                                                  | Real Start + official adapter + local backend; private HTML, hydration, external mutation updates, and hover subscription reuse verified; [evidence](../experiments/convex-auth-v2/start/README.md)                                                                                  |
| Temporary GitHub OAuth app        | Created and configured by Nate                                                                                                       | Separate registration; credentials stay in a gitignored local file                                                                                                                                                                                                                   |
| Live v2 GitHub sign-in            | **Confirmed by Nate**                                                                                                                | “Signed in with a user ID; reload also works.”                                                                                                                                                                                                                                       |
| Live sign-out and repeat login    | **Confirmed by Nate**                                                                                                                | Completed the requested sequence and confirmed the same app user ID                                                                                                                                                                                                                  |
| Local account/session linkage     | Confirmed by read-only inspection                                                                                                    | One app user, one GitHub account, one session; account/user/session references agree                                                                                                                                                                                                 |
| Live proof TypeScript             | Passes                                                                                                                               | Frontend and backend checked                                                                                                                                                                                                                                                         |
| Email/password lifecycle proof    | 14 new local tests pass; TypeScript passes                                                                                           | Actual core/password components with captured mail delivery; verification, login, replacement, expiry/replay and rollback covered                                                                                                                                                    |
| Upstream recovery revocation gap  | **Demonstrated at the pinned upstream revision**                                                                                     | The unpatched upstream core allowed a pre-reset refresh token to rotate after the password changed                                                                                                                                                                                   |
| Kino recovery revocation patch    | **Installed and exercised**                                                                                                          | Kino's pinned core patch blocks old refresh tokens; native component and browser recovery checks reject old sessions and spent-token replay                                                                                                                                          |
| Live email proof                  | Browser signup, unverified-login rejection, inbox verification, authenticated query and reload pass; second session has same user ID | Local backend 4420/4421, browser 5180; Delivered reset link consumed; both old sessions and spent refresh token rejected; old password rejected; new-password login/reload preserve user ID; reset replay rejected; see [email proof](../experiments/convex-auth-v2/email/README.md) |
| GitHub + Start + local gateway    | Real GitHub flow passes                                                                                                              | Secure/HttpOnly cookies, private SSR, reload, logout, repeat identity; Nate completed consent; [evidence](../experiments/convex-auth-v2/gateway/README.md)                                                                                                                           |
| Cloudflare runtime and packaging  | Local HTTPS browser checks, build and matching-toolchain dry-run pass                                                                | Exact-origin host adaptation required; plugin/standalone Wrangler mismatch documented; isolated cloud deployment now exists; real cloud OAuth, private SSR, reload, logout and repeat identity pass                                                                                  |
| Access tokens after reset         | Explicit bounded-expiry proof                                                                                                        | Previously issued JWTs remain valid until their original expiry (60-second default); immediate denial is not implemented                                                                                                                                                             |

Detailed evidence:

- [Local harness and limitations](../experiments/convex-auth-v2/README.md)
- [Live GitHub proof and restart commands](../experiments/convex-auth-v2/github/README.md)
- [Email/password proof and recovery gap](../experiments/convex-auth-v2/EMAIL-PROOF.md)
- [Proposed core revocation fix and remaining policy](../experiments/convex-auth-v2/SESSION-REVOCATION.md)

All auth source evidence is pinned to upstream commit
`1d105a04d124785441ce655cef33b54103c7bc2e`. Its package version says
`2.0.0-alpha.2`, but the published package with that label differs. This source
requires Convex `^1.46.0`; the proof uses `1.46.0`. Do not substitute the published
alpha and assume these results still apply.

## Latest application integration

The native backend lives in `convex/native/` and is now selected by the root
`convex.json`. The integration config remains for isolated proof tooling. Its core/password/GitHub components and
users/profiles schema are mounted on the dedicated local backend at 4440/4441.
Verified email/password signup, localized Bento sending, resend, recovery with
core session revocation, and personal-organization/owner bootstrap are now
implemented in this backend. The component tests use real Argon2 WASM and capture
Bento's HTTP transport; they do not send inbox mail. Live JWT/JWKS, profile and
personal-org access, wrong-issuer rejection, callback/component privacy, redirect
rejection, and deployed password WASM checks pass. See the
[integration runbook](../integrations/native-convex/README.md).

Validation: 31 native component tests; 392 application tests in 62 files;
the separate Node-only sourcemap test; `verify:pr`; focused lint/format checks;
and the local native smoke all pass. Bento inbox delivery and native UI
acceptance pass on the isolated local backend.

At the time of this checkpoint, the application still defaulted to Kitcn/Better
Auth. PR #154 has since removed that default and the temporary whole-build
selector. The native Start integration covers request-scoped cookies, SSR token handoff, native query
keys, the localized email/password UI, protected dashboard, organization
creation/listing, invitation management, role changes, removal, and switching.
A disposable hosted Kino preview passes the native GitHub gateway path, email
verification and invitation delivery, reload, sign-out, repeat login, switching,
and immediate membership revocation. The first product-data slice is deployed
to that isolated preview and its authenticated browser acceptance run passes.

The former runtime selector was a migration seam for whole-build comparison,
not a feature-flag system. PR #154 removed it together with the Kitcn application
branch.

### September 21: real Kino organization integration passed

The real feature-flagged Kino routes now use app-owned native organizations,
memberships, invitations, and the central project permission matrix. A hosted
proof created a team through the dashboard, delivered its localized Bento
invitation, and accepted it with a separately verified password identity that
shares the GitHub owner's mailbox. The identities remained separate, as required.

The invited admin survived SSR reload, switched between personal and team
organizations through intent-preloaded links, and immediately lost membership
and manager controls after the GitHub owner removed it. Because the team was
public, direct navigation correctly retained public viewer access; the removed
identity could not list members or manage invitations. Replaying the accepted
invitation returned the invalid-link state and did not restore membership.

The run also exposed and fixed native password sign-in waiting indefinitely on
the pre-sign-in router invalidation. Native sign-in now commits the HttpOnly
cookie and performs a document navigation so the protected SSR request reads the
new session directly; the deployed retest reached the dashboard within the first
one-second observation. Worker version `a3a41c8d-1d21-4b92-94ae-43f9b589bd48`;
Convex preview `giant-jaguar-319`. Stable Kino and production were unchanged.

## Latest cloud proof

The separate Cloudflare Start/gateway Workers and Convex preview are deployed.
Cloud cancellation, replay rejection, exact routing, PKCE and state cookies pass.
Real cloud GitHub login, private SSR, reload, logout and repeat identity pass.
Two-target routing is unit-tested;
both cloud backends now pass synchronized real OAuth and live negative routing
checks, including cross-preview ticket/JWT, data and logout isolation. See the [cloud proof runbook](../experiments/convex-auth-v2/cloud/README.md)
for URLs, the temporary GitHub app change, cleanup, and credential follow-up.

**Credential follow-up:** rotate the root worktree's `CONVEX_MANAGEMENT_TOKEN`;
an environment inspection accidentally printed it in a tool log. Do not paste
the replacement in chat. No secret is recorded in this document.

## Nate's checklist

### Completed local GitHub and email checks

The proof is at **http://127.0.0.1:5179/** while its local processes are running.

- [x] Create the temporary OAuth app and save its credentials locally.
- [x] Complete GitHub consent and return to a page displaying an app user ID.
- [x] Reload and remain signed in.
- [x] Note the user ID, sign out, and confirm the page returns to signed out.
- [x] Sign in with the same GitHub account and confirm the same app user ID.

- [x] Confirm verification email receipt and supply its link for browser automation.
- [x] Supply the delivered password-reset link for browser automation.
- [x] Complete GitHub consent in the automated HTTPS Start/gateway proof; both logins passed.

The basic isolated GitHub and email/password lifecycles are confirmed. The
feature-flagged Kino integration also passed live Bento verification, protected
SSR and reload, sign-out, recovery, reset replay rejection, new-password login,
and another reload against the isolated native backend.

Report success or the visible failure; no token or secret needs to be shared.
The engineer will handle diagnostics, state inspection, and automated negative
tests. There is no request to change the existing Kino OAuth app now.

### Later: when the engineer supplies a working integration preview

- [ ] Confirm verified email signup and verification delivery/links work.
- [ ] Confirm password login, forgotten-password recovery, and the agreed
      behavior of old sessions after a reset.
- [x] Confirm GitHub login through the proof gateway, reload, logout, and repeat
      login in the actual Kino UI.
- [ ] Review the agreed behavior for linking GitHub and password identities.
- [ ] Exercise an organization invitation and a representative private-project
      flow with the relevant test accounts.
- [ ] Review first-load and navigation responsiveness alongside measured results.

These are product acceptance checks. Setting up the preview, technical debugging,
permission regression tests, and performance measurements are engineering work.

### At release, after the rollout is prepared

- [ ] Review the concrete rollout/rollback instructions and any required OAuth
      registration changes. Exact callback changes will be supplied only after the
      gateway design is implemented and verified.
- [ ] Authorize production deployment actions when the release is ready.
- [ ] Complete a real sign-in/return/reload/logout smoke test on the released app.
- [ ] Confirm email verification and recovery against the released email/domain
      configuration using designated test accounts.

### After the temporary proof is no longer needed

- [ ] Delete the temporary **Kino Convex v2 Proof** OAuth app (or revoke its test
      secret if retaining the registration intentionally).
- [ ] Have engineering stop the proof processes and remove disposable local
      credentials/state when no longer needed. Never delete the existing Kino Auth
      or Kino Relay registrations as part of proof cleanup.

## Current migration checklist

Stages 1 through 4 are complete in the native-only PR. Stage 5 now consists of
final audit and release-candidate acceptance, production preparation, the
authorized coordinated release, and post-release smoke testing. The detailed
authoritative checklist is at the top of this document.

### Stage 1: architecture and risk proofs

- [x] Inventory Kitcn ORM, cRPC, auth, relationship, trigger, aggregate, SSR,
      storage, GitHub Relay, and generated-runtime dependencies.
- [x] Prove official Convex Auth v2 GitHub OAuth locally and on deployed HTTPS.
- [x] Replace long OAuth state with a bounded opaque reference and prove replay,
      cancellation, tampering, expiry, and two-preview isolation.
- [x] Prove verified email/password signup, Bento delivery, verification,
      recovery, and reset replay rejection.
- [x] Demonstrate the upstream password-reset session-revocation gap and prove a
      local core patch.
- [x] Prove TanStack Start SSR, protected loaders, `ensureQueryData`,
      `useSuspenseQuery`, live hydration, and hover preload/subscription reuse.
- [x] Prove app-owned organizations, roles, invitations, project access,
      cross-tab switching, and immediate revocation.
- [x] Inventory all 70 declared relationships across the 35 product tables and
      prove bounded, resumable database cascades under concurrent writes.
- [x] Prove durable external object cleanup, upload/delete races, quota
      reconciliation, cache-tag invalidation, and project deletion ordering.

### Stage 2: native foundation in the real Kino application

- [x] Record the integration contract and pin the exact Convex Auth v2 source;
      application auth calls now pass through a Kino-owned boundary and the two
      maintained patches are explicitly isolated requirements. See
      [the auth integration contract](native-convex-auth-contract.md).
- [x] Install the exact v2 Git revision with a reproducible pnpm patch, upgrade
      the shared Convex runtime to 1.46, and verify the emitted patched runtime
      during `verify:pr`.
- [x] Add the native Convex schema/function modules and make them the root
      application: `convex/native/` has a separate generated API and isolated local
      deployment. Core/password/GitHub mounts, JWT/profile reads and real WASM
      password checks pass. See [integration runbook](../integrations/native-convex/README.md).
- [x] Wire the native request/session adapter into Kino's actual TanStack Start
      server, router context, Query client, and auth-aware cache lifecycle. The
      local flag uses HttpOnly refresh cookies, shares refresh work per request,
      preloads native `convexQuery` keys in protected loaders, and reads those
      same keys through `useSuspenseQuery` after hydration.
- [x] Port verified email/password, localized mail, reset/session revocation,
      current-user/profile and personal-organization/owner bootstrap. Native
      tests cover transaction rollback and never restore a revoked owner grant.
- [x] Define normalized password-email uniqueness and no automatic cross-provider
      linking. Explicit identity-linking UX remains a separate decision.
- [x] Port app-owned organizations, membership, invitations, system roles, and
      the proven central permission matrix.
- [x] Deploy an integration preview through Kino's real dev gateway and repeat
      email, GitHub, SSR, reload, logout, switching, and revocation checks.

The native Kino GitHub Start endpoints now implement the proven opaque-state
protocol: server-side signed-envelope registration, a 43-character provider
state reference, HttpOnly browser state/return cookies, exact callback routing,
single-use completion through the native session proxy, and a 1,024-byte URL
budget. The button stays disabled by default and is enabled only in a deployment
with matching Convex, Start Worker, gateway-route, and public feature-flag
configuration. That exact hosted configuration passed in the disposable preview.

### Stage 3: first real vertical product slice

- [x] Port project and board reads, project defaults, feedback creation/read,
      comments, votes, reactions, timeline/search updates, and their permission
      checks using native Convex functions.
- [x] Preserve exact API return/error and pagination behavior needed by the UI;
      replace cRPC query options with native Convex/TanStack adapters.
- [x] Preserve hover preload, live subscriptions, and public
      content that does not wait on optional viewer auth.
- [x] Run the existing product tests plus native multi-user authorization,
      relationship, aggregate-drift, and cascade tests.

The deployed integrated feedback benchmark confirms SSR without browser HTTP
query fallbacks and useful hover work before navigation. With a 700ms dwell,
eight subscriptions started before click in every sample and median
click-to-detail fell from 833.8ms to 76.4ms after completing loader coverage.
See [the performance evidence](../experiments/convex-auth-v2/performance/README.md).

The final feedback parity pass keeps the latest 20 activity items live while
loading older cursor pages in chronological order, localizes native validation
and permission failures, and applies vote changes optimistically through the
Convex query cache so rejected writes roll back automatically. A deployed
24-comment browser proof verified the initial/latest page and older-page merge,
then deleted its fixture. The deployed UI also surfaced `INVALID_TARGET` as safe
localized copy and preserved the stored value, while a vote toggle settled in
both directions. Worker version `06240148-36c8-4315-9351-d4d3c4770f82`;
Convex preview `giant-jaguar-319`.

### Stage 4: remaining product and external systems

September 22 checkpoint: core updates are deployed to the disposable native
preview (Worker `bbb30066-6f14-472f-bcb2-6c7c68ef80a6`, Convex
`giant-jaguar-319`). Browser checks passed draft creation, publishing, a live
heart/comment, reload persistence, SSR update/comment content, search hit/miss,
management unpublish, and deletion. The temporary update was removed.
Eight new backend tests cover permissions, validation, tenant boundaries,
archive fences, pagination, rate limiting, and a 240-comment deletion cascade.
Validation passes: 400 Vitest tests in 63 files, the separate Node sourcemap test,
`verify:pr`, focused lint, and the native production build. The unqualified
`pnpm test` still incorrectly collects the Node-only test; run it separately.
Production is unchanged; Nate has no manual step for this checkpoint.

Native updates use the existing whole-build selector, suspense/SSR preloads,
intent links, live queries, and optimistic hearts with rollback. The first
navigation during deployment saw stale assets and an old `project:getDetails`
call; a fresh navigation resolved it. Keep deployment-transition asset/cache
behavior on the cutover checklist. This is core functionality acceptance, not
complete legacy UI or file/publication-side-effect parity.

- [x] Port core updates: create/edit, drafts/publication, stable slugs, search,
      featured lists, related feedback, comments/reactions, and bounded deletion.
- [x] Restore original Updates components: management controls, share affordances,
      related-feedback labels, editor, comment windows, and native covers. Audit
      publication behavior (no legacy notification dispatch); broader cross-domain
      effects remain below. See the latest checkpoint above for acceptance scope.
- [x] Port the current account JSON export, including feedback/update comment
      context and bounded immediate downloads.
- [x] Close the cross-domain slug/visibility/search audit. Private organization
      visibility now overrides project visibility, and the traced write paths
      and search correction are complete. Notification settings remain an
      existing placeholder rather than a new feature commitment.
- [x] Port files/folders/assets, real quota dimensions, thumbnails/public copies,
      multipart reconciliation, and the proven deletion outbox.
- [x] Validate real hosted R2 upload behavior and global cache-tag purge
      propagation with disposable objects.
- [x] Port GitHub Relay installation/repository sync and webhook deduplication;
      keep Relay credentials and lifecycle separate from login OAuth.
      Native implementation, authorization, repository selection/persistence,
      manual disconnect/reconnect, and real webhook transport/deduplication pass.
      Live issue creation/linking, webhook snapshot updates, and cleanup pass.
      Existing-installation entry is exposed (validation limits above).
- [x] Add bounded system-admin inspection and safe resume controls for native
      storage cleanup, project/board/feedback/update deletion, and project
      storage-purge jobs. Orphaned feedback/update jobs remain inspectable and
      can be drained safely.
- [x] Port the stable admin dashboard's platform totals and recent-signup view
      to the native system-admin boundary.
- [x] Add deduplicated alert delivery, completed-job/history retention, and
      cursor-bounded dry-run/repair tools for Feedback upvotes and Update
      comment/heart counts.

### Stage 5: cutover and removal

- [x] Compare equivalent current/native flows for cold and warm login, first
      useful content, SSR, reads, and subscription activity at p50/p95.
- [ ] Complete preview acceptance, browser coverage, failure rehearsal, and a
      coordinated app/Convex/gateway release and recovery plan.

The [partial rehearsal and full sequence](native-convex-cutover-rehearsal.md)
record the pinned disposable app Worker rollback, the shared dev gateway's
live state/rollback proof, and the remaining app/backend, data, and acceptance
gates. The combined checkbox stays open.

- [x] Cut application routes to the native implementation.
- [x] Remove Kitcn ORM/cRPC/auth generation and the application's Better Auth
      dependency. The gateway keeps its isolated legacy Better Auth proxy only
      through the production acceptance window.
- [ ] Run `pnpm run verify:pr`, deploy in the documented order, and repeat the
      production auth/data smoke tests.

The same-component dashboard timing run and a read-only backend-log follow-up
are recorded in the [performance evidence](../experiments/convex-auth-v2/performance/README.md).
Both stacks' dashboard queries were mostly cached during the sampled minute;
production token/session endpoints took hundreds of milliseconds per call,
whereas the native refresh mutation's median was 53ms. These windows also
include login and cannot assign calls to individual loads. Matching account
data and request-correlated traces remain necessary before claiming the auth
stack or ORM caused the observed TTFB difference.

Files/storage is now in progress: native upload, delivery, folders, quota
accounting, and update covers have passed isolated live checks. Cache-purge API
acknowledgement, physical object absence, and released accounting now pass for
the scripted fixture, and the seven earlier browser cleanup jobs are done. The
original Files UI and danger-zone deletion are connected to native functions;
mobile drawer, cover-widget, and file-delete acceptance now pass. The original
Updates UI is also restored and connected to native functions. GitHub Relay follows as a
separate bounded stage. The remaining proof-only items below are acceptance gates
rather than reasons to delay those application ports.

## Engineering work: remaining proofs

### 1. Close out GitHub provider behavior

- [x] Record the sign-out/repeat-login result: Nate confirmed the same user ID.
- [x] Verify cancellation, expired state, tampering, and replay fail safely in
      hosted gateway flows. Repeat this compact negative-flow check on the final
      PR preview before release.
- [x] Keep direct-provider success distinct from gateway/SSR success in the
      recorded evidence.

On September 23, the final PR preview passed the compact negative-flow check
against `gateway-dev.usekino.com`. Cancellation returned through the app's
`oauthError=access_denied` path; replay and a modified opaque reference returned
HTTP 400. Modifying one reference did not consume its legitimate flow. A fresh
reference held for 615 seconds returned HTTP 400 `Invalid routing state`, and
the original cookie jar still redirected `/dashboard` to `/auth`. A newly
registered flow then completed the cancellation path normally. No provider
codes, state values, cookies, or secrets were recorded.

The PR preview initially rejected verification email because its `BENTO_FROM`
was `noreply@mail.usekino.com`, which Bento did not authorize for the configured
site. The preview's credentials matched the working proof deployment, whose
sender is `mail@usekino.com`. After correcting only preview deployment
`animated-vole-389`, Bento accepted the resend to a tagged address at
`natedunn.net`; Nate confirmed inbox delivery. Verification, password sign-in,
and a dashboard reload passed in isolated Chrome. Nate also confirmed delivery
of the reset email. Reset, old-session rejection, old-password rejection,
new-password sign-in, and used-link rejection passed. A later browser session
intermittently signed out during token refresh; the PR now opts into Convex's
supported `initialAuthTokenReuse` behavior to avoid an unnecessary refresh on
each hydration. On the rebuilt preview, a fresh Chrome session survived 170
seconds, three scheduled refreshes, and two full navigations; no navigation
triggered an extra refresh or lost either auth cookie. The initial email failure
was sender authorization, not Gmail plus-address routing.

The same acceptance run found that a new private project's overview still
showed sample counts, people, updates, and activity. The PR now reads those
from a bounded, access-scoped native overview query with honest empty states.
The corrected overview has local type, translation, and private-access test
coverage. The rebuilt preview showed five true zero counts, its actual owner,
and empty updates/activity. The first navigation across that deployment
transition rendered a 404, while a hard reload resolved the new route. A later
controlled deployment-transition rehearsal passed, as recorded below.

The preview acceptance account also created a private organization and a private
project. The project creation UI correctly locked visibility to private, and
anonymous requests to both URLs returned 404. A moderator invitation scoped to
that project was created and Bento accepted its email; Nate confirmed inbox
delivery. The existing verified GitHub identity for `hello@natedunn.net`
accepted it, gained the scoped moderator assignment, and viewed the private
project. A signed-in non-manager could not open member management. Removing
the disposable membership as the owner deleted its project assignment and the
same GitHub browser immediately received 404 for both private URLs. The
non-manager organization overview showed fabricated summary counts and
activity. The PR now replaces those with a real access-checked member count,
visible-project count, and history from visible projects; preview browser
acceptance of that UI remains part of the compact pass.

An old preview tab once showed a project 404 immediately after a preview
rebuild, while direct authenticated backend queries succeeded and a hard reload
resolved it. No network trace survived, so its exact cause is unconfirmed. A
concrete cache bug was fixed in the PR: route loaders previously reused a
cached null for a newly granted private organization or project forever;
they now fetch once before returning 404. Focused regression tests cover that
case. A subsequent deployment-transition browser rehearsal passed.

The September 23 compact PR-preview browser pass has confirmed real private
organization/project counts and history, a populated feedback board/detail,
voting and commenting, board creation, an Updates draft, project and
organization settings, and narrow-width project/feedback/settings layouts.
The preview initially lacked `NATIVE_R2_*` variables; the build now provisions
them from the existing preview bucket. R2 then rejected browser PUT preflight
until Nate added the PR origin to that bucket's CORS policy. Its OPTIONS response
now allows the exact origin, PUT, and Content-Type. The rebuilt preview uploaded
a disposable 296 KiB image, rendered its R2-backed preview at its natural size,
and deleted it through the Files action menu. The row disappeared immediately;
storage usage remained charged while asynchronous object cleanup was pending.
The mobile Files layout now shows a direct Upload action, name/actions table,
and touch-oriented empty copy without horizontal document overflow. The upload
dialog's label and privacy-neutral copy were also verified. An inherited Roadmap
placeholder had displayed fabricated cards on every project; the rebuilt preview
now shows the localized coming-soon state instead.

An authenticated private-project tab stayed open while commit `9347f1d0` built.
On refocus it showed the existing localized new-version prompt. Clicking Reload
kept the same private project visible and both auth cookies present; a newly
visited Files route also loaded. This closes the deployment-transition check,
though it does not explain the separate cookie-loss event below.

During this pass both auth cookies disappeared once without an intentional
sign-out; subsequent private document requests correctly returned 404 and the
dashboard redirected to sign-in. Preview Convex logs at 10:18 a.m. local time
show the auth component rejected a spent refresh token after its 30-second
grace window and revoked a session. The log has no browser/request correlation,
so attribution to the observed sign-out is strong but not conclusive. A
controlled test reproduced the same
failure: rotating a preview session while deliberately discarding the response
left Chrome with the old cookie, and a request 32 seconds later returned 401
with both cookie deletions. The original lost response was not captured, so
the reason Chrome missed the replacement cookie remains unconfirmed.

The PR now sends browser refresh requests with Fetch `keepalive` to preserve
them across document navigation. The rebuilt preview emitted a scheduled
refresh with that option. A delayed refresh followed by immediate navigation
still rotated the cookie, and the dashboard stayed signed in. Twenty further
full navigations across dashboard and a private project, including one browser
refresh, kept both cookies and had no 401 or private-page failure. This
mitigates navigation loss; it does not make token rotation recoverable when a
server-rendered response or network response is discarded. The release check
above remains open for that protocol-level decision.

The basic real GitHub sign-in question is answered. Remaining checks improve
coverage; they are not evidence that the initial sign-in was unconfirmed.

### 2. Prove the verified email/password lifecycle

- [x] Implement a small local provider extension using the official provider seam.
- [x] Create the app user/account without issuing a session before verification.
- [x] Store hashed, expiring, single-use verification challenges and implement resend.
- [x] Enforce verification on every session-issuing path in the test provider.
- [x] Prove transactional completion and rollback when callbacks fail.
- [x] Prove password replacement, reset-code expiry/resend/replay rejection, and
      preservation of the reset proof when the replacement password is rejected.
- [x] Implement recovery with explicit session-revocation semantics in the native backend.
- [x] Prove a separate core-owned session-generation change can revoke old
      refresh tokens transactionally with reset, including overlapping refresh/login.
- [x] Verify the proposed patch on a real local backend: two old sessions cannot
      refresh after reset; new-password login preserves identity.
- [x] Adopt the maintained core revocation patch in the native integration; upstream adoption remains a follow-up.
- [ ] Accept the bounded access-token window or implement immediate authorization
      checks; add bounded revoked-session cleanup before release.
- [x] Define trim/lowercase email normalization, password-email uniqueness, and no automatic GitHub/password linking. Explicit linking UX is deferred.
- [ ] Test expiry, replay, rate limits, and account-enumeration behavior.

The local fixture covers challenge expiry/replay, per-email request limits,
password attempt limits, and generic response shapes. Deployment-level abuse,
timing resistance remain unproven; the broader item stays open. Real Bento
delivery, inbox links, browser verification/reset, login and reload now pass in
the isolated local email proof. Nate has no new manual task for this stage.

The revocation patch is now installed and exercised by the native backend.
Original upstream still has the demonstrated gap; full UI integration is not complete. Already-issued
access tokens retain their expiry. Bento is not used by these tests: an in-memory
mailbox captures scheduled messages without printing codes or tokens. The separate
live email proof uses the existing Bento sender and localized templates; both
delivered links were exercised by browser automation.

Known constraints at the pinned revision:

- `signUpWithoutSession` is available and tested upstream.
- The sign-in proxy accepts `complete` or `error`; a pending-verification response
  requires a separate endpoint from session completion.
- The password recipe has a TODO for revoking existing sessions. Password
  replacement alone does not prove recovery is complete.
- Token decoding/expiry inspection is not authentication. Protected backend
  functions must verify identity and enforce authorization.

### 3. Prove Start SSR, browser auth, and live queries together

- [x] Mount the framework-neutral primitives in actual Start server functions/routes.
- [ ] Verify response cookies through SSR, redirects, errors, and streaming.
- [x] Prove separate request caches and a single refresh shared by parallel token consumers; live anonymous/authenticated isolation passes.
- [x] Test HttpOnly refresh-token storage and browser bootstrap.
- [x] Test authenticated direct entry/reload, SSR refresh with a missing access
      cookie, and automatic browser renewal past the original access-token expiry.
- [x] Redirect an expired browser session to sign-in while preserving the
      protected return URL; focused unit tests cover path/query/fragment and loop
      avoidance. Live expired-token latency remains part of performance testing.
- [x] Locally test expired refresh sessions, concurrent refresh/sign-out, cross-tab logout/account switching, and frozen/offline recovery past real JWT expiry.
- [x] Repeat all eight session edge checks on the deployed Cloudflare/Convex preview using synthetic identities and public TLS.
- [ ] Broaden browser/lifecycle coverage: Safari/Firefox, actual OS sleep, back/forward cache, and longer concurrency stress.
- [x] Prove loader prefetch + `useSuspenseQuery` + live subscription hydration
      against a real backend, including actual hover navigation.
- [x] Keep optional viewer data from blocking public content and the app shell.
- [x] Verify local workerd HTTPS behavior, Cloudflare bundle and matching-toolchain packaging dry-run.
- [x] Verify GitHub cookie sessions, private SSR, reload, logout and repeat identity on an isolated deployed edge preview.
- [x] Align Kino's deployment toolchain on the root native Convex application,
      Cloudflare Worker Previews, and the pinned Wrangler toolchain.

The [session edge proof](../experiments/convex-auth-v2/start/SESSION-EDGES.md) found
and fixed missing cross-tab invalidation in the app adapter. Credential-free
notifications and identity checks now rebuild page/query state on account changes.
The same eight checks now pass on the deployed preview. Deployment caught a
module-scope random-number generation error; lazy browser initialization fixed it.
No new user consent or email was required.

The [Start proof](../experiments/convex-auth-v2/start/README.md) now passes browser
checks against local dev and a built preview. Local timings are recorded there;
they are not a deployed performance comparison.

The initial GitHub proof used SPA storage. The later HTTPS Start proof exercises
real cookies and private SSR; the deployed follow-up is tracked separately above.

### 4. Prove gateway compatibility and performance

The isolated [single-target v2 gateway](../experiments/convex-auth-v2/gateway/README.md)
now passes real GitHub sign-in through HTTPS Start cookies. Cancellation, replay,
and missing browser state checks also pass. This required a second small proposed
upstream patch for a server-configured callback URL. Signed multi-target routing
now passes unit tests, and a separate cloud proof gateway now routes two preview backends. Live
cancellation, tampering and cross-backend state checks pass. The real synchronized
OAuth check also passes, including ticket/JWT rejection, SSR/reload and mutation/logout
isolation, as recorded in the [two-preview proof](../experiments/convex-auth-v2/cloud/TWO-PREVIEWS.md).
Integration with Kino's real dev gateway now passes in the disposable Kino
preview; production routing remains unchanged.

- [x] Design isolated preview routing with signed state, exact target mappings and separate keys.
- [x] Prove synchronized real GitHub OAuth through one gateway into two deployed previews, with ticket/JWT, user/data, cookie and logout isolation.
- [ ] Complete the production routing rollout. Local sharing and branch-preview
      provisioning are integrated.
- [x] Preserve exact origin trust, state/PKCE checks, and callback replay defenses.
- [x] Keep Kino Auth OAuth separate from Kino Relay installation/webhook flows.
- [x] Deploy and exercise the dev gateway with a matching integration preview.
- [x] Capture an initial current/candidate sign-in-to-useful-content and protected
      reload comparison; the single-login and unequal-workload limits are recorded.
- [x] Measure public/protected SSR, hover navigation, backend calls, reads, and
      subscription activity. The same-component dashboard p50/p95 comparison and
      its account/backend limitations are recorded above.

An initial [deployed performance benchmark](../experiments/convex-auth-v2/performance/README.md)
is recorded: 20 measured OAuth-initiation requests per target and ten native
protected SSR/hover samples. Initiation medians were 2,433.8ms on the working
September 17 Kino preview and 208.2ms on the proof. Native protected content was
hydrated in 445.1ms median; completed-hover navigation took 22.3ms. All subscription
reuse/SSR assertions passed. The newer Kino preview's auth endpoint returns 404.
These results do not establish a current-production migration improvement:
the baseline is older, the page workloads differ, and full OAuth return plus
expired-token and equivalent-workload measurements remain open. A subsequent
user-authorized production run completed real GitHub login and five reloads per
stack: callback-to-visible-content was 8,679.8ms for production versus 1,024.6ms
for the native counter proof (one login each); reload medians were 1,013.1ms versus
307.1ms. These are different workloads, not a controlled migration speedup.
The native logged-out GitHub flow passed; production failed at GitHub `/session`
when initially logged out and passed after GitHub sign-in. A subsequent same-app
controlled test isolated the long-state/request-length trigger: original and
random 1,906-character states both caused GitHub POST /session HTTP 500 before
2FA; a 48-character state passed 2FA and returned to the intercepted callback.
The crash is on GitHub, triggered by the current proxy's long request; the exact
internal limit is unknown. No production mitigation is deployed. See the
benchmark's logged-out investigation.
The integrated native feedback route now has ten fresh-context protected reloads
and fifteen no/short/completed-hover samples. Completing the route loader moved
eight subscriptions ahead of a 700ms click and reduced its median click-to-detail
from 833.8ms to 76.4ms. Reload-tail and equivalent production-workload comparison
remain open; see the same performance report.
See [existing auth performance research](auth-performance-research.md) for the
prior optimization; do not count its gains again as migration gains.

## Migration inventory to preserve after the proofs

The initial scan found 35 explicit tables, roughly 165 function declarations,
ORM usage in 35 backend files including tests, and `useCRPC` in 58 frontend files.
Schema behavior includes 34 cascade declarations, eight set-null declarations,
one restrict declaration, and two aggregate indexes.

- [ ] Native schema, indexes, function references, validators, errors, and API
      return shapes; audit Date/timestamp and `_id`/`id` conversions.
- [ ] Indexed relationship reads, parent existence checks, defaults, uniqueness,
      protected fields, and optional-field clearing.
- [ ] Cascades, set-null/restrict behavior, bounded deletion jobs, and R2 cleanup.
- [x] Aggregate maintenance, drift tests, and rebuild/backfill operations for
      the native Feedback/Update derived counters. Storage accounting retains
      its separate transactional invariant tests and deletion barriers.
- [x] Native user/profile/personal-organization bootstrap; repeat login preserves
      app profile edits and refreshes verified GitHub email. Wiring the profile
      editing UI to native functions remains part of the application port.
- [x] Project default boards and feedback search-content updates. Project
      slug/visibility propagation still belongs to later project-management work.
- [x] App-owned organizations, invitations, memberships, moderator assignments,
      system roles, and public/private/archived access. Preserve the
      [permission matrix](permissions.md).
- [x] Feedback, comments, votes, reactions, search, title/board/status/priority,
      assignment, targets, labels, answers, watchers, related feedback, and
      cursor-paginated activity have native functions and UI. Small deletes are
      transactional; large deletes fence the record and continue through a
      resumable scheduled cascade. Native failures are localized in the UI and
      vote optimism rolls back through Convex. GitHub Relay connections now pass
      the checkpoint above; exports remain open.
- [x] Native upload intents, quota reservations, private/public file access,
      folders, thumbnails, text extraction, and update-cover integration.
- [x] Cache-purge API acknowledgement, physical object absence, and acknowledged
      cleanup against real storage (not independent sampling of every cache region).
- [x] Original Files UI acceptance and project-deletion integration for the current
      native data model (see scope and live-proof limits in the checkpoint above).
- [x] GitHub Relay installation/repository sync, webhook verification and dedupe
      (linked-issue scope and acceptance limits in the checkpoint above).
- [ ] Native cursor pagination, SSR hydration, hover route preload, live first-page
      subscriptions, vote continuity, optimistic rollback, and visible localized
      failures are wired. Deployed hover/subscription timing now passes; longer
      subscription retention measurement remains open.
- [ ] Codegen/build/deploy scripts, generated files, seeds, scheduled work, tests,
      localization, and relevant observability.

`convex-verify` is a candidate for defaults, protected fields, and transactional
uniqueness checks. It does not replace cascades, relationship loading, aggregates,
or authorization. Helper choices remain subject to targeted tests and review.

## Before an integration PR or release

- [x] Convert the proven approach into a reviewed implementation plan and
      native-only implementation PR.
- [ ] Preserve or explicitly replace every inventoried behavior.
- [x] Run the existing and new permission/auth/data-integrity regression checks.
- [x] Run `pnpm run verify:pr` before opening/updating the application PR; review
      generated changes and rerun if needed.
- [x] Validate the actual PR preview's native GitHub login and reload through the
      separately deployed dev gateway. The broader acceptance pass remains above.
- [ ] Reassess upstream v2 readiness and alpha upgrade limitations at launch time.
- [ ] Prepare and review the coordinated app/Convex/Files/gateway release and
      phase-specific rollback/forward-fix procedure.
- [ ] Repeat deployment-level smoke tests after release.

As work proceeds, update this document with evidence and dates. Keep outstanding
items unchecked, and distinguish automated tests, engineer observations, and
Nate's manual confirmation.

### September 21: short-state mitigation in the isolated proof

The proof now registers its signed route payload server-side and gives GitHub a
43-character random reference. A per-flow SQLite Durable Object consumes it
atomically, with ten-minute expiry/cleanup and current route/key revalidation.
Start enforces a 1,024-byte full authorization URL budget (an app policy, not a
published GitHub limit). The initial deployed alpha URL measured 365 characters.
The gateway and both preview apps passed deployed negative checks and the full
real GitHub OAuth runner on this protocol (September 21, 18:56 UTC); current
Kino production remains unchanged. All 198 tests pass, including real local
workerd/SQLite concurrency and expiration checks. See
[opaque-state design and validation](../experiments/convex-auth-v2/gateway/OPAQUE-STATE.md).
New-protocol evidence confirms the fresh signed-out GitHub login, simultaneous
alpha/beta callbacks, cross-preview ticket/JWT rejection, private SSR/reload,
reference replay rejection and mutation/logout isolation. The proof browser
closed successfully. This validates the isolated mitigation, not a production fix.

### September 21: native organization authorization core

An isolated, undeployed app-owned organization slice now covers owner/admin/
moderator roles, indexed membership lookups, paginated organization access,
project-scoped moderators, role replacement, removal, and leaving. Eight
multi-user tests prove allowed actions and denial of anonymous/unverified,
foreign-tenant, forged-identity, and unassigned-project access. Role changes take
effect with the same identity on the next request; membership assignment cleanup
is atomic. Owner role freezing and last-owner protection are tested.

This is not full organization parity: invitations, public/project-member and
system-admin access, archived write guards, deployed reactivity, and large
cascades remain outstanding. The assignment cap is explicitly 50 for this proof.
See the [organization proof and next gates](../experiments/convex-auth-v2/organizations/README.md).

### September 21: native invitation lifecycle

The isolated organization proof now creates app-owned invitations and accepts
verified recipients into native memberships. Ten new tests cover expiry/reissue,
cancellation/rejection, recipient and tenant checks, stale project/inviter checks,
existing-member protection, and idempotency without restoring revoked access.
Moderator assignments and membership creation commit in the same mutation.
This supersedes the preceding section's unimplemented invitation-core gap;
Bento invitation delivery, acceptance UI, real auth email binding/linking, rate
limits, and deployed concurrency remain outstanding. No email or deployment was
performed for this stage. Details and policy differences are in the organization
proof README.

### September 21: local invitation UI and live Bento integration

Start now provides organization listing/creation and invitation acceptance using
shared native authorization functions. Bento accepted one invitation to
hello@natedunn.net, and Nate confirmed inbox arrival. Automated Chromium passed
anonymous-to-password-login return, actual verified-account acceptance, reload,
live membership listing, and authenticated organization SSR. Evidence:
`experiments/convex-auth-v2/organizations/results-browser.json`.

GitHub invitation identity requires an explicit provider-verified email marker;
old proof accounts without it fail closed. Tests deny unmarked OAuth emails and
cross-account replay even when the mailbox matches. Live GitHub invitation-return
verification remains open. Scheduling, origin/recipient restrictions, cancellation
before send, and delivery failure state have tests. Mail retries/rate limits,
full management UI, and deployment checks remain release gates. No Cloudflare
preview or Kino deployment changed; this validates the local password flow.

### September 21: deployed GitHub invitation proof passed

The alpha preview passed real GitHub login from an invitation through callback,
verified-email refresh, acceptance, reload, live membership display, and private
SSR. Six concurrent accepted retries returned one original membership. Removing
membership immediately removed it from the live list; replay could not restore
access. Chromium completed with no browser exceptions and closed normally.
Bento accepted the preview invitation (preview inbox arrival not separately
confirmed). Evidence:
`experiments/convex-auth-v2/organizations/results-github-preview.json`.

The fresh GitHub onSignIn hook now refreshes verified-email evidence for old
accounts and rejects account mismatches/unverified provider email. This closes
the preceding old-account/GitHub-return gaps without automatic account linking.
All 223 experiment tests and TypeScript checks pass. Alpha Worker version:
`e59e9f49-7fa8-4d5c-9cc2-5d4ab7e3949a`. Gateway, beta, and production unchanged.
Next gate: complete organization/project policy parity, then organization switching
and cross-tab authorization/cache invalidation. Production mail retry/rate limits
and complete invitation management remain open.

### September 21: central permission matrix and two-tab switching

The native proof now covers public/private/archived project visibility, direct
project members, assigned moderators, and server-owned system-admin roles. Tests
preserve the archived-content-write ban (including system admins), manager-only
archive/unarchive/deletion, and role/access revocation. The full experiment suite
passes 231 tests. Product creation quotas/defaults, complete cascades, and actual
integration/storage endpoints remain outside this central-policy proof.

Local Chromium with real password auth passed route-based organization switching,
hover subscription reuse, independent tab selection, live demotion/removal, cached
back-navigation without an observed stale-data flash, denied SSR/reload, and
write denial after revocation. Evidence: organizations/results-switching.json.
The run exposed and fixed pre-auth subscriptions overwriting authorized SSR data;
protected documents now use Convex's installed experimental expectAuth gate.
No hydration errors in the passing run. This phase is local; the deployed alpha
still has the preceding invitation release until a subsequent preview rollout.

### September 21: preview switching and first native cascade proof

Alpha now passes deployed organization switching, hover subscription reuse,
independent tab selection, live demotion/removal, denied back-navigation/reload/SSR,
and revoked-write checks with no browser/hydration errors. This runner uses
synthetic fixture accounts with real issued sessions; the preceding human GitHub
run is still the OAuth evidence. Worker: ddb346ae-0185-484a-bc7e-8a80cc00824a.
Evidence: organizations/results-switching-preview.json. Production unchanged.

The new undeployed relationships experiment proves explicit parent checks,
cascade/set-null/restrict semantics, a deletion fence, and a versioned resumable
project purge bounded to 25 actual descendant deletions per step. Seven tests
include negative authorization, rollback-safe overflow refusal, duplicate/reordered
work, owner-only resume, and preserving another project's data. The fixture graph
is representative, not full product parity. Inventory and remaining file/R2,
GitHub, defaults, counters and search hooks are documented in
`experiments/convex-auth-v2/relationships/README.md`.

### September 21: expanded cascade proof

The relationship proof now covers default boards, initial feedback/search updates,
idempotent votes, and project/board/feedback/comment deletion. Sixteen targeted
tests include a 555-row cascade, interrupted/resumed scheduling, rollback,
overlapping jobs, tenant isolation and every exposed descendant write fence.
The schema inventory records 70 declared relationships across 35 tables, including
Kitcn's default `no action` behavior. See `relationships/CASCADE-MAP.md` under the
experiment.

A real isolated local backend race passed: 28 of 30 concurrent writes committed
and were purged, two were rejected, later writes were denied, no descendants
remained and sibling feedback survived (`relationships/results-race.json`). This
supersedes the earlier seven-test, undeployed-only description. No application
preview or production data changed. It does not establish full product parity.

Next gate: prove durable external file/R2 cleanup, retry/acknowledgement and quota
reconciliation with disposable objects. The contract and remaining product graphs
are in `experiments/convex-auth-v2/relationships/README.md`. No user action is
required for the completed database cascade proof.

### September 21: external file cleanup protocol

Added `experiments/convex-auth-v2/storage/README.md` and an isolated native schema.
Seven Convex tests prove durable deletion jobs, write/read fences, reference
restrictions, lease recovery, three-attempt caps and owner resume, stale/duplicate
acknowledgement rejection, and exactly-once used/reserved quota release.
Two local R2 runtime tests cover lost acknowledgement after deletion, replacement
and tenant isolation, and the actual public file Worker's cache behavior.

Confirmed limitation: after origin deletion, a warmed public URL still serves its
cached body while an uncached URL/HEAD returns 404. Public access revocation must
be an explicit integration gate. Also retain gates for outstanding upload grants,
original/thumbnail/public-copy cleanup, all accounting dimensions, project purge
integration, and hosted disposable-object rehearsal. No hosted storage was changed.

A small local Worker fix requires a request Range header before returning 206;
R2 can otherwise supply range metadata for a full GET. Regression covered; not
released or deployed. Full details and commands are in the storage proof README.

### September 21: upload races and public cache invalidation

The storage proof now handles both orderings of upload completion versus deletion.
Each upload uses an immutable staging key. Delete revokes completion immediately,
waits through grant expiry plus a settlement window, then removes staging/final/
thumbnail/public-copy keys. Reserved bytes remain charged until cleanup succeeds;
completion-first transfers them once to used bytes before ordinary deletion.

The files Worker now tags every original, thumbnail, filename and query-string
variant with one `kino-file-<publicId>` cache tag. The isolated adapter deletes R2
objects and then requests a global tag purge; Convex acknowledges only after both
succeed. Local tests cover purge failure followed by safe retry. This avoids an R2
HEAD on every cache hit. Nothing is deployed. A hosted disposable-object rehearsal
must still verify real presigned uploads and global purge propagation.

### September 21: project cascade plus external storage

The relationship and storage proofs are now connected. Project deletion enqueues
at most 25 asset cleanup jobs at a time, waits for R2 deletion and global cache-tag
purge acknowledgements, requires storage accounting to reach zero, removes storage
metadata in bounded batches, and then continues the existing database cascade.
Persistent cleanup failure keeps the project fenced, metadata and quota intact;
owner resume retries failed jobs. Outsiders cannot resume.

Four integration tests bring the relationship total to 20. They cover 31 assets
across enqueue batches, transport failure/resume, cross-tenant isolation, write
fencing, pending-upload settlement/reserved quota, and refusal to finalize after
forged cleanup completion. A real isolated
local-backend run deleted four assets/12 local R2 objects, issued four cache-tag
purges, removed the project afterward, and preserved another tenant. Evidence:
`relationships/results-project-storage-live.json`. No preview, production, or
hosted R2 resource changed.

### September 21: first native product-data slice

The real Kino project and feedback routes now have a native Convex path behind
the existing whole-build migration selector. The native schema and functions
cover project/board reads, three transactional default boards, feedback creation,
indexed cursor pagination, board/status filtering, full-text search, detail and
chronological timeline reads, comments, idempotent votes, reactions, status and
priority changes. Every read and write goes through the central project policy;
archived projects are frozen and revoked access takes effect on the next
transaction.

The TanStack Start integration preserves blocking SSR data for a hard load,
non-blocking intent preload on hover, Convex live subscriptions for the visible
page, manual cursor continuation, and native mutation updates. The legacy route
remains unchanged in Kitcn builds. There are no per-feature runtime flags; the
temporary selector chooses the complete native build and will be deleted at
cutover.

Seven multi-user Convex feedback tests cover defaults, public/private reads, search and
pagination, tenant isolation, voting/comments/reactions/timeline mutations,
role enforcement, immediate revocation, and archived-write denial. The complete
application run passes 387 Vitest tests in 60 files plus the separate Node-only
sourcemap test, `verify:pr`, TypeScript, focused lint, and a native production
build. The slice is deployed only to Convex `giant-jaguar-319` and Worker version
`c27d8bef-5aa1-486a-ba2c-f020fe5aa81f`; stable and production are unchanged.

The follow-up parity pass adds title editing, close/delete, board changes,
assignment, targets, normalized labels, answer marking, real watchers, symmetric
related-feedback links, comment edit/delete/reply presentation, and a unified
cursor-paginated activity stream. The previous watcher, label, and related rows
were static UI placeholders; the native path persists and authorizes them.
Small feedback cascades finish transactionally. Large cascades hide the root and
continue in bounded, resumable scheduled batches. GitHub Relay connections,
exports, and complete optimistic rollback/error UX remain open.

The deployed acceptance run used the existing verified GitHub identity. It
created a private project and confirmed its three default boards, hover navigation,
an empty feedback list, feedback creation, detail navigation, live vote, reaction
and comment updates, full-text miss/hit results, status and priority changes,
timeline events, and a hard reload retaining every mutation. Nate performed the
two trusted-pointer select interactions; the automated checks verified their
live and post-reload values. No visible browser or hydration failure occurred.
Production remained unchanged.

The parity acceptance pass used the verified password identity on the same
isolated deployment. It confirmed title, board, status, priority, assignment,
target, normalized-label, watcher, answer, reply, comment edit/delete, and
symmetric related-feedback persistence through real UI interactions and reloads.
It also created and deleted a temporary related item, leaving the original item
intact. A pending native profile briefly rendered the signed-out creation state;
the creation route now waits for the auth session to settle before choosing its
authenticated or signed-out surface. An expired refresh still reaches the route
error boundary instead of redirecting cleanly to sign-in and remains an auth UX
follow-up.
