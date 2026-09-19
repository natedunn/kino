# GitHub sign-in performance research

Research date: 2026-09-18. No auth behavior or dependencies changed during this
research. Installed versions: Better Auth 1.7.1, kitcn 0.31.1, Convex 1.44.0.

## Production evidence

An instrument-free production log trace for request `93030aac0a1081be` on
`brainy-boar-871` showed the following sequential operations:

| Operation | Duration | Documents read / written |
| --- | ---: | ---: |
| `generated/auth:create` | 688 ms | 1 / 1 |
| `generated/auth:findMany` (state lookup) | 498 ms | 1 / 0 |
| `generated/auth:findMany` (expired-record lookup) | 366 ms | 0 / 0 |
| `generated/auth:deleteMany` (cleanup) | 365 ms | 0 / 0 |
| Entire sign-in HTTP action, including the above | 2,506 ms | — |

The corresponding app Worker spent 2,562 ms wall time and 5 ms CPU. Direct
backend probes also reproduced the delay. The lookup/cleanup interpretation
comes from matching the sequence to the installed Better Auth adapter and OAuth
proxy source. The exact source of hundreds of milliseconds inside each tiny
function remains unprofiled; this trace does not prove cold starts or schema
construction are responsible.

## Upstream findings

1. **Verification cleanup is documented behavior, still present in 1.7.5.**
   `findVerificationValue` awaits expired-record deletion before returning.
   `deleteManyWithHooks` first reads candidate records, then deletes them, even
   when the read returns nothing. This matches our two empty cleanup operations.
   [Options](https://better-auth.com/docs/reference/options#verification),
   [1.7.5 adapter source](https://github.com/better-auth/better-auth/blob/v1.7.5/packages/better-auth/src/db/internal-adapter.ts),
   [hook integration PR #6803](https://github.com/better-auth/better-auth/pull/6803).

2. **There is a related cleanup race report, but it is about passkeys.**
   [Better Auth #8376](https://github.com/better-auth/better-auth/issues/8376)
   reports cleanup deleting a record still being used by passkey verification.
   The issue is closed; its proposed [PR #8412](https://github.com/better-auth/better-auth/pull/8412)
   is closed without merging. Do not interpret this as a shipped fix for our
   GitHub click behavior. The report describes disabling inline cleanup and
   managing cleanup separately as a workaround.

3. **kitcn has addressed repeated auth runtime work already.**
   [PR #338](https://github.com/udecode/kitcn/pull/338), merged 2026-08-17,
   shares Better Auth schema derivation once per isolate and memoizes other
   schema views. Our 0.31.1 changelog and installed implementation already
   include this work. It cannot simply be applied again as our fix.

4. **kitcn 0.33.4 contains a relevant but different social-sign-in fix.**
   [PR #465](https://github.com/udecode/kitcn/pull/465), merged 2026-09-15,
   skips JWT minting when the initial OAuth redirect has no session and supplies
   a real `Headers` object. The reported internal error reproduces with Better
   Auth 1.7.3 and 1.7.4; the unfixed HTTP test passes on 1.7.1. This is relevant
   to upgrade planning, not proof of our intermittent dead click or latency.

5. **Similar Convex auth latency has been reported, without a published cause.**
   [get-convex/better-auth #284](https://github.com/get-convex/better-auth/issues/284)
   is open and reports >100 ms auth queries on a nearly empty local database.
   It had no comments at research time and concerns a different adapter.

## Upgrade assessment

The latest GitHub releases checked were
[kitcn 0.33.5](https://github.com/udecode/kitcn/releases/tag/v0.33.5) and
[Better Auth 1.7.5](https://github.com/better-auth/better-auth/releases/tag/v1.7.5).
No reviewed release removes the synchronous cleanup in our trace.

A broad upgrade needs a separate compatibility review: kitcn 0.32/0.33 contain
pagination-order changes, and Better Auth 1.7.3 reverses the account-issuer schema
change introduced in 1.7.0. Follow `github-environments.md`, including matched
app/gateway Better Auth versions and deployed-data validation.

## Recommended fix order

- Reproduce the OAuth state operation sequence locally and validate
  `verification.disableCleanup` together with a bounded, indexed scheduled
  cleanup. Test expired and replayed OAuth state rejection, verification and
  password-reset expiry, and valid login before changing a deployed environment.
  About 731 ms was spent on cleanup in this trace; that is an opportunity, not
  an end-to-end performance guarantee.
- Profile the remaining generated auth functions to separate module/runtime
  setup from handler work. Avoid speculative request-global auth caching.
- Diagnose the dead click separately with hydration/click/request/navigation
  observations and Back-button restoration. No reviewed issue proves its cause.
- Treat dependency upgrades as a separate compatibility change. Do not disable
  expiration checks, state validation, replay protection, or the gateway rewrite.

## Local implementation

The app now sets Better Auth's documented `verification.disableCleanup: true`.
`crons.cleanupExpiredVerifications` replaces the inline sweep with an hourly,
internal-only job using the existing `verification.expiresAt` index. Each
transaction deletes at most 200 expired records and schedules a continuation
when the batch is full. No schema migration or dependency patch is needed.

Expired rows can remain physically stored until the sweep runs (normally up to
an hour); this does not extend token validity. Better Auth still checks expiry
and consumes OAuth state. The job deletes only rows strictly older than its
current time, matching the previous sweep. There are no verification deletion
hooks configured in this app; future hooks would need to be considered here
because the scheduled job deletes directly through Convex.

Regression tests cover bounded deletion and continuation, preserving unexpired
rows, and idempotence. Tests against the installed Better Auth OAuth proxy
callback cover successful state consumption, rejection of sequential replay,
and rejection of expired state with inline cleanup disabled. They use an
in-memory adapter and synthetic encrypted gateway payloads; they do not replace
an end-to-end GitHub login check against the deployed Convex adapter.

After deploying the auth option and cron together, compare sign-in traces for
the disappearance of the expired-record lookup/delete pair, test a real GitHub
login, and confirm successful cron runs in Convex. The earlier trace suggests
about 0.7 seconds of avoidable work, not a guaranteed speedup. Production timing
has not yet been measured with this change. To roll back, remove the option
(or set it false); the scheduled sweep can safely coexist with inline cleanup.

## Measured local sign-in improvement (2026-09-18)

Measured the real `POST /api/auth/sign-in/social` HTTP handler against the
running local Convex backend at `127.0.0.1:20561`, using the app's installed
Better Auth + kitcn adapters and database (not the in-memory test adapter).
The only auth setting changed between runs was `verification.disableCleanup`.
Each batch made 23 sequential requests: three warmups excluded, 20 measured.
Every request returned HTTP 200 with a GitHub authorization URL. The order was
optimized → original → optimized, to check that the result repeated.

| Version | Median | Mean | p95 |
| --- | ---: | ---: | ---: |
| after-1 | 657.6 ms | 656.9 ms | 730.4 ms |
| before-1 | 1369.3 ms | 1306.9 ms | 1535.9 ms |
| after-2 | 654.8 ms | 663.3 ms | 768.4 ms |

The original median was 1,369.3 ms; the repeated optimized median was 654.8 ms:
**714.5 ms faster (52.2% lower latency)**. The first optimized batch independently
measured 657.6 ms median. Convex logs confirmed four adapter calls with inline
cleanup (create, state lookup, expired lookup, deleteMany) versus two after the
change (create, state lookup).

This measures sign-in initiation through receipt of the GitHub authorization
URL. It excludes the frontend proxy, GitHub page load, and the return callback.
These are local warm-request timings, not a production forecast or a cold-start
benchmark. The optimized setting was restored and pushed to the local backend
after the experiment. Production was not changed.
