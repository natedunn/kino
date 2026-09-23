# Convex Auth v2: first local proofs

For overall progress and Nate's manual follow-ups, see the
[migration status document](../../docs/native-convex-migration-status.md).
The subsequent [live GitHub proof](github/README.md) has confirmed direct sign-in
and reload persistence; its limits are recorded separately below that link.
The [live email proof](email/README.md) covers Bento verification/recovery, and
the [Start proof](start/README.md) covers cookie sessions, SSR, hydration, live
updates and hover preloading. The [gateway follow-up](gateway/README.md) proves
real GitHub through an isolated local gateway into HTTPS Start cookie sessions.

This standalone experiment tests the first migration assumptions. It is not
mounted in Kino or a production-ready auth integration. The unit-test commands
below do not change deployments or environment variables. The separate live
proof instructions start isolated local backends; root app dependency pins and
gateway registrations remain unchanged.

## Reproduce

From this directory, with Node 22+ and Git:

```sh
npm ci --ignore-scripts
npm run setup:source
npm test
npm run typecheck
```

The separate npm lockfile intentionally isolates the proof from Kino's pnpm
workspace. `setup:source` fetches the exact upstream Git commit into ignored
`.upstream/`. Tests refuse a modified or different upstream checkout. Root Kino
tests/lint exclude experiments; formatting excludes the upstream checkout.

## What is pinned

- Official `get-convex/convex-auth` source:
  `1d105a04d124785441ce655cef33b54103c7bc2e` from `reboot`.
- Convex `1.46.0`, required by that source revision.
- Official query adapter `@convex-dev/react-query` `0.1.0`.
- React Query `5.101.4` and React `19.2.4`, matching Kino's package pins.
- Published `argon2id-wasm` `0.0.0-alpha.2`, as required by upstream.

**Version label caveat:** the source package labels itself `2.0.0-alpha.2`, but the
published package with that label is older. The registry package declares Convex
`^1.43.0`; this source declares `^1.46.0`. Installing the published alpha does not
reproduce this proof. The experiment imports upstream source directly and leaves
it unchanged; it does not depend on the published auth package.

## Results

Combined local run: **193 tests pass; TypeScript passes**, including the
email lifecycle and separate [session-revocation proposal](SESSION-REVOCATION.md).
See [the email proof](EMAIL-PROOF.md), including the confirmed session-revocation gap.
The original 73-test baseline and the added lifecycle suite are itemized below.

| Suite | Tests | What ran | Boundary of the evidence |
| --- | ---: | --- | --- |
| Request auth candidate | 6 | Real upstream session/cookie primitives, request-scoped memoization, WHATWG responses | Refresh callback simulated; no Start server or browser cookie jar |
| Auth routes | 4 | Real upstream sign-in, refresh, logout handlers | Backend HTTP responses simulated |
| Query SSR | 4 | Real official adapter, React Query, Suspense streaming SSR, serialized cache hydration | Convex HTTP transport simulated; hydration is into another server-side cache, not a browser |
| Upstream core | 37 | Unmodified upstream tests, actual component functions in `convex-test`, real RSA signing/verification | No deployed Convex JWT authentication boundary or app-owned users integration |
| Upstream password | 22 | Unmodified upstream tests, actual password component, WASM hashing, rate limiter | No email delivery/recovery workflow; local durations are not deployment benchmarks |
| Email/password provider | 14 | Test-only provider composed with actual core/password/limiter components | Mail transport captured locally; reset does not revoke existing sessions; no production-readiness claim |
| Proposed session revocation | 11 | Same provider using a separately patched core | Refresh revocation works in local tests; access JWTs retain their 60-second TTL; no live contention test |
| Patched core regression | 37 | Original upstream core suite rerun against the patch | Repeated regression evidence, not 37 new test cases |

The upstream tests are imported, not rewritten or counted as new Kino coverage.
`npm test` prepares the ignored `.revocation/` copy using the checked-in patch.
The original `.upstream/` source and live GitHub proof remain unchanged.
Expected replay-detection warnings appear during negative core tests.

### Supported by the tests

- Anonymous requests and fresh access cookies need no refresh round trip.
- Parallel callers within one request can share a single refresh promise.
- Separate request objects do not share token/cookie state.
- Rotated cookies reach the returned response; a reused refresh only writes the
  access cookie, preserving the winner's replacement refresh cookie.
- Completed sign-in removes the refresh token from JSON and puts it into secure
  HttpOnly cookies. Cross-origin requests and unlisted sign-in functions fail.
- Core can create an account/user without a session, then sign in the same user
  later. This supports a verification gate, but does not itself implement one.
- Core tests cover session rotation, concurrent refresh, replay detection,
  sign-out, provider identity separation, and rollback of failed callbacks.
- Password replacement invalidates the old password; actual hashing and common
  password/format/rate-limit behavior run successfully.
- Loader-style `ensureQueryData(convexQuery(...))` and `useSuspenseQuery` share
  cached data without a second HTTP query. Direct-entry Suspense SSR fetches.
- A serialized successful query cache hydrates into a distinct cache and renders
  without a second fetch. Arguments and separate request caches stay distinct.

### Findings that affect the architecture

1. **Pending verification is not a sign-in proxy response.** Its accepted envelope
   only handles `complete` or `error`. A `verificationRequired` response fails
   closed with 500. Signup initiation/resend must use a separate endpoint; only
   verification completion/login that issues a session belongs on the proxy.
2. **Core provides `signUpWithoutSession`.** A local email provider can use the
   provider-authoring seam rather than inventing another session system. Every
   path to `completeSignIn` must still enforce verified status.
3. **Password-change session revocation is unfinished upstream.** The password
   recipe explicitly has a TODO requiring core support. Recovery is not complete
   merely because `setPassword` works. Decide how to revoke existing sessions
   without writing private component tables.
4. **Token decoding is not verification.** `getToken` checks expiry to decide
   whether to refresh; it does not establish a trusted user. Our candidate exposes
   no `isAuthenticated` boolean from this check. Protected Convex functions must
   verify identity and authorize access. Request-cookie fixtures are unsigned
   deliberately and establish no signature-verification claim.
5. **WASM needs appropriate bundling.** A plain Vitest import initially failed on
   the wasm-bindgen `wbg` module. The config now follows upstream's WASM-module
   loader and inlines `argon2id-wasm`; hashing is not mocked. Actual Convex/Worker
   bundling remains to be tested independently.

## Next proof gates

These are intentionally unresolved, not implied by the passing tests:

1. **Email provider lifecycle:** the local provider now proves verification,
   password login/replacement, and rollback. Finish the recovery revocation policy
   and supported implementation, then real delivery/browser testing. See
   [the email proof](EMAIL-PROOF.md) for evidence and missing coverage.
2. **Real Start integration:** mount request middleware and auth routes in a
   standalone Start app, then test response cookies through normal rendering,
   redirects, error responses, and streaming. The request adapter here is only a
   candidate WHATWG boundary, not a mounted Start middleware implementation.
3. **Real local backend and browser:** valid and forged JWTs, sign-in to protected
   SSR, hydrated live subscriptions, actual hover preloading, account switching,
   concurrent refresh, reconnect, and sleeping tabs. Test Cloudflare bundling.
4. **Gateway OAuth:** exercise real GitHub authorization and the callback through
   the intended gateway architecture. No gateway/registration changes were made.
5. **Performance:** measure current and candidate callback-to-useful-content,
   public/protected SSR, and hover-to-navigation. Unit-test timings establish no
   latency improvement.

## Source references

- [Official core provider setup](https://github.com/get-convex/convex-auth/blob/1d105a04d124785441ce655cef33b54103c7bc2e/packages/core/src/components/core/setup.ts)
- [Official password recipe](https://github.com/get-convex/convex-auth/blob/1d105a04d124785441ce655cef33b54103c7bc2e/packages/core/src/components/password/setup.ts)
- [Official framework-neutral primitives](https://github.com/get-convex/convex-auth/blob/1d105a04d124785441ce655cef33b54103c7bc2e/packages/core/src/server/index.ts)
- [Convex TanStack Start integration](https://docs.convex.dev/client/tanstack/tanstack-start)

No Kitcn replacement or production-readiness decision follows solely from this
first local proof.

The [cloud proof](cloud/README.md) adds signed multi-target routing tests and an
isolated deployed Start/gateway/Convex preview. Its real OAuth result is tracked
separately from the local evidence.
