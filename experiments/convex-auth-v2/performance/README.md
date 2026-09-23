# Deployed performance proof

This records initial preview benchmarks and a subsequent user-authorized current
production comparison. The latter completed real GitHub OAuth and protected
reloads. Different page workloads and one successful login per stack mean it
is not a controlled estimate of the full application's migration speedup.

## Same dashboard component and public feedback — September 22, 2026

The [dashboard runner](../scripts/equivalent-dashboard-performance.mjs) loaded
the deployed `/dashboard` route ten times per target in fresh Chrome contexts
with authenticated cookies, en-US locale, and no throttling. Both builds render
the same `DashboardLayout` component. Every response contained the team section
in server HTML and reached the Dashboard heading; neither made a browser HTTP
`/api/query` request. The new native sample uses the integrated Kino app, rather
than the small counter proof used in the earlier comparison.

| Dashboard metric                                 | Current production |      Native proof |
| ------------------------------------------------ | -----------------: | ----------------: |
| Document TTFB, median / sample p95               |      982 / 1,948ms |       311 / 619ms |
| First Contentful Paint, median / sample p95      |    1,120 / 2,108ms |       480 / 812ms |
| Largest Contentful Paint, median / sample p95    |    1,704 / 2,728ms |       480 / 812ms |
| Load then heading confirmed, median / sample p95 |    1,277 / 2,271ms |       668 / 906ms |
| WebSocket subscription adds after navigation     |  4 in every sample | 2 in every sample |

Raw samples: [production](equivalent-dashboard-production.json) and
[native](equivalent-dashboard-native.json). “Load then heading” waits for the
load event before checking the heading, so it is an upper bound on visible
content, not the first paint or a user-interaction metric. Sample p95 is the
maximum of ten values. The two accounts and their organization data differ,
the backends and domains differ, and server coldness was not controlled. These
measurements show a faster observed native dashboard under these conditions;
they do not isolate auth-library or Kitcn overhead. WebSocket adds are client
subscriptions, not backend function calls or database reads.

### Backend execution attribution for the dashboard run

Read-only Convex execution logs were sampled for the first minute after each
dashboard runner started (production `brainy-boar-871` from
`2026-09-22T23:52:34Z`; native preview `giant-jaguar-319` from
`2026-09-22T23:35:52Z`). The runner signs in before its ten dashboard loads,
so these windows contain login work as well as the loads. Logs cannot reliably
identify which invocation belongs to which browser context, and unrelated
requests may appear. These counts are **window totals, not per-load costs**.

| Function in the observed window         | Calls | Cached results |    Documents read | Median execution |
| --------------------------------------- | ----: | -------------: | ----------------: | ---------------: |
| Production `profile:findMyProfile`      |    31 |             29 |                 8 |             <1ms |
| Production `org:findMyOrgs`             |    23 |             21 |                16 |             <1ms |
| Production `GET /api/auth/convex/token` |    23 |              0 | 0 at HTTP wrapper |            364ms |
| Production `GET /api/auth/get-session`  |    12 |              0 | 0 at HTTP wrapper |            521ms |
| Native `profiles:me`                    |    34 |             33 |                 2 |             <1ms |
| Native `organizations:listMineForRoute` |    31 |             30 |                 7 |             <1ms |
| Native `auth:refreshSession`            |    14 |              0 |                32 |             53ms |

The HTTP wrapper's zero document count does **not** mean Better Auth avoided
database work: its nested `generated/auth:*` functions have separate log rows.
Both dashboard query paths were mostly cached during these windows. The
production token/session endpoint time is large enough to be a plausible
contributor to document TTFB, but these aggregate logs cannot establish its
causal share. Native refresh also ran in this short synthetic run, so the
native path was not simply a no-auth-work case. A request-correlated trace with
matching account data is needed for a precise library/ORM comparison.

The 72-hour Convex insights report had no read-limit or contention findings
for production. The native preview had four OCC retry warnings in deletion and
storage-cleanup jobs, unrelated to the dashboard reads. This is a bounded
health observation, not a guarantee of future capacity.

The first production login attempt hit the previously isolated GitHub `/session`
error. After signing into GitHub before starting Kino OAuth, the same-route run
completed. No production auth fix was deployed. The temporary test Chrome
profile was removed after the run; no login cookies, tokens, or account IDs are
stored in the result files.

The [anonymous public-feedback runner](../scripts/public-feedback-performance.mjs)
also took ten fresh-context samples per target. Production TTFB was 1,210ms
median / 1,751ms sample p95, versus 464 / 564ms on the native proof; FCP was
1,424 / 2,512ms versus 580 / 692ms. These are contextual SSR checks: production
had one feedback item and the native fixture was empty. See
[raw public samples](public-feedback-results.json). No public-route speedup claim
rests on this unequal data set.

The [expired-access probe](../scripts/expired-dashboard-performance.mjs) held
fresh native login cookies unused for 75 seconds, beyond the 60-second access
token lifetime, then loaded `/dashboard` in a new context. Private dashboard
content was in server HTML, the response refreshed two cookies, and the page
remained signed in. That single load recorded 651ms TTFB and 840ms FCP, with no
browser `/api/auth/refresh` request. These are correctness evidence and one
latency observation, not a p50/p95 estimate. The first attempt reused a refresh
cookie after an immediate page load had rotated it; it was discarded as an
invalid test setup. [Raw expiry result](expired-dashboard-results.json).

## Results — September 21, 2026

Sanitized samples: [results.json](results.json). Computed nearest-rank summaries:
[summary.json](summary.json). Recompute with `node
experiments/convex-auth-v2/scripts/performance-summary.mjs`.

| Measurement                                       | Samples |    Median | Sample p95 |
| ------------------------------------------------- | ------: | --------: | ---------: |
| Kino September 17 preview: OAuth initiation       |      20 | 2,433.8ms |  2,990.7ms |
| Native proof: OAuth initiation                    |      20 |   208.2ms |    474.3ms |
| Kino preview: anonymous login-page TTFB           |      10 |   850.5ms |  1,456.2ms |
| Native proof: anonymous login-page TTFB           |      10 |   157.3ms |    214.3ms |
| Native proof: protected document TTFB             |      10 |   287.3ms |    462.4ms |
| Native proof: navigation to hydrated counter      |      10 |   445.1ms |    628.8ms |
| Native proof: click after completed hover preload |      10 |    22.3ms |     26.7ms |

All ten protected-page checks passed: counter in server HTML, zero browser HTTP
query calls, exactly one beta subscription added before clicking and reused
through navigation, and no observed pending fallback. Sessions were synthetic,
with a 300-second access token to keep refresh out of this measurement. The
normal proof default is shorter; expired-token timing remains a separate check.

The initiation difference is a useful signal, **not a claimed migration speedup**:
the older baseline may include costs already removed from today's code. Public
page timing also includes different layouts, assets, and SSR work. No full
GitHub callback-to-dashboard timing was captured in this run.

## Current production follow-up

[production-results.json](production-results.json) records one successful actual
GitHub login and five warm-browser-cache protected reloads per stack. Both
successful timed logins began with GitHub already signed in. The preceding
production failure and native logged-out success are documented separately in
[GITHUB-LOGGED-OUT.md](GITHUB-LOGGED-OUT.md).

| Measurement                                             | Current Kino production | Native proof |
| ------------------------------------------------------- | ----------------------: | -----------: |
| OAuth initiation, one successful attempt                |               1,620.1ms |      131.2ms |
| Gateway callback request → visible content, one attempt |               8,679.8ms |    1,024.6ms |
| Protected reload → visible content, median of 5         |               1,013.1ms |      307.1ms |
| Protected reload TTFB, median of 5                      |                 878.0ms |      197.0ms |

The production return included about 2,699ms at the gateway callback, 3,185ms at
its app OAuth-proxy callback, and 2,589ms for the dashboard document. Native's
corresponding requests took about 577ms, 160ms and 158ms. These are browser network
request durations, not isolated server CPU or database timings. Gateway requests
also include provider exchange/profile work.

Production readiness means the Dashboard heading and Your teams section are
visible, not that all feed queries or hydration are complete. Native readiness
requires its hydration marker and visible counter. All five reloads on each
stack contained the corresponding content in server HTML and retained the
protected URL. The native page is much smaller and was recently exercised by
the diagnostic login, so workload and warmness differences remain confounders.
No p95 login claim is supported by one login per stack.

The dedicated browser closed after completion; browser credentials were not
persisted. No production deployment or product-data edit occurred. Authentication
created ordinary login sessions. Rerun the timed flow with
`scripts/production-performance.mjs` and the same `PROOF_PLAYWRIGHT` setting;
GitHub credentials/consent require the user. The logged-out diagnostic was an
additional controlled browser interaction, not part of that script's normal loop.

## Integrated feedback slice

The native implementation was also measured inside Kino's real feedback route,
using ten authenticated hard reloads and five navigations at each of 0ms, 100ms,
and 700ms hover dwell. Each sample used a fresh browser context with copied
HttpOnly proof cookies. The runner observed Convex WebSocket subscription adds
and verified that no browser `/api/query` request occurred.

| Measurement                           | Before loader coverage | After loader coverage |
| ------------------------------------- | ---------------------: | --------------------: |
| Protected detail TTFB p50 / p95       |        549.0 / 956.2ms |     502.2 / 1,399.2ms |
| Protected detail FCP p50 / p95        |          692 / 1,104ms |         660 / 1,600ms |
| Protected detail load p50 / p95       |      810.9 / 1,214.8ms |     761.7 / 1,734.3ms |
| 0ms hover click-to-detail p50 / p95   |        882.3 / 929.7ms |       347.6 / 422.5ms |
| 100ms hover click-to-detail p50 / p95 |        852.1 / 929.9ms |       244.2 / 263.2ms |
| 700ms hover click-to-detail p50 / p95 |        833.8 / 843.0ms |         76.4 / 93.0ms |

Before the change, the detail loader warmed only `feedback.getDetail`; panel
queries began after navigation. It now starts detail, boards, assignees, and
link-search data in parallel. In every 700ms post-change sample, eight of the
eleven eventual subscriptions started during hover. The remaining three are
mounted only by the destination component. This proves useful hover work moved
ahead of the click. It does not turn a zero-dwell click into a completed preload.

The hard-reload medians improved slightly while p95 regressed in this small,
unthrottled sample. Backend coldness was not controlled, so no reload-tail
improvement is claimed. Raw post-change samples are in
[integrated-feedback-results.json](integrated-feedback-results.json). The runner
is [integrated-feedback-performance.mjs](../scripts/integrated-feedback-performance.mjs).
The post-change proof used Worker version
`df6a2df8-0ae1-47d1-9474-06095c9127af` and Convex preview
`giant-jaguar-319`; production was unchanged.

## Reproduce

From the repository root, with the existing proof dependencies installed:

```sh
PROOF_PLAYWRIGHT=/path/to/playwright node experiments/convex-auth-v2/scripts/performance.mjs
```

The runner uses the deployment-scoped key in `cloud/.env.deploy.local` only for
synthetic sessions on `graceful-elephant-103`. It verifies preview metadata and key
target before use. It revokes its fixture session afterward. No credentials,
provider state, callback codes, cookies, or user identifiers are recorded.

- OAuth initiation: three warmups then 20 samples per target, alternating target
  order. Measures POST through receipt of JSON containing a GitHub authorization
  URL. These requests create temporary OAuth flow records but do not contact
  GitHub or create signed-in users. Timing includes this machine's network path.
- Public page: ten new Chromium contexts per target, normal CPU/network. Measures
  navigation timings and resource transfer sizes at 500ms after load. Separate
  page designs make these contextual measurements, not an auth-only comparison.
- Protected native page: ten new contexts with admin-minted fixture cookies.
  Measures document TTFB and navigation-to-hydrated-counter. This explicitly
  bypasses login. Confirms private counter in SSR, zero browser HTTP query calls,
  one beta subscription before/after navigation, and no pending fallback.
- Hover: fixed 700ms dwell before a DOM click; click-to-heading includes automation
  polling and is not INP. It demonstrates completed preload reuse, not short-hover
  behavior or a human-interaction performance score.

First observations are not server cold starts: neither Worker nor Convex isolate
lifecycle is controlled. Fresh browser contexts mean empty browser caches, not
cold backend infrastructure. Sample p95 is a small-sample nearest-rank statistic,
not a population SLO. The September 21 proof did not capture backend reads; the
September 22 integrated dashboard follow-up has aggregate execution-log reads
above, but still no request-correlated CPU trace.

## Baseline caveats

The September 19 preview alias
`t3code-investigate-fresh-load-performanc-kino.hello-fc8.workers.dev` returns a
login page but its `/api/auth/sign-in/social` returns 404. The September 17 alias
`t3code-build-footer-marketing-pages-kino.hello-fc8.workers.dev` successfully starts
OAuth and is the baseline used here. Its Worker version was
`6cc78f2c-944d-48d0-9694-3778fb1b24e1` in the read-only version inventory.

The baseline's backend build and cleanup optimization were not independently
verified. Existing September 18 research already attributes substantial savings
to disabling inline verification cleanup; do not count those again as migration
gains. The proof uses Convex 1.46 and a minimal counter page, whereas current
repository Kino uses Convex 1.44 and a full product shell. This is an architecture
experiment, not an isolated library microbenchmark.

## Still needed for the performance decision

1. Completed the selected current production baseline with real OAuth, separating
   callback-to-visible-content from GitHub sign-in/consent. Expand sample size only
   when measuring an equivalent integrated app slice.
2. The native expired-access SSR path passes one live load above; obtain more
   samples only if an expired-token p95 target is needed. Normal authenticated
   reloads do not establish that case.
3. The same deployed dashboard component now has ten samples per stack above;
   aggregate backend function counts and reads are recorded above. Repeat with
   matching account data and request-correlated traces before attributing the
   difference to auth or ORM overhead. The earlier counter page could not
   establish organization/dashboard performance.
4. Completed fresh-context navigation with no, short, and completed hover on the
   integrated feedback slice. Warm-cache and controlled mobile constraints remain
   optional follow-ups if they become launch targets.

## Source findings to verify in the integrated slice

Kino's root `beforeLoad` awaits `getServerAuthToken()` (a Convex site HTTP request)
then the profile query; the dashboard additionally loads organizations. The proof
uses the native access cookie when usable and refreshes only when needed. This
is a concrete difference in request structure, but measured attribution requires
an equivalent protected route.

Both applications already use intent preloading and TanStack Query SSR integration.
The proof's `ensureQueryData` and `useSuspenseQuery` share the official Convex query
key and a live subscription. Migration preserves these capabilities; it does not
introduce hover preloading to an app that previously lacked it.
