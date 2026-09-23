# Session reliability proof

September 21, 2026. Run with the actual local Convex backend (4420/4421), HTTPS
Start/workerd (5183), and Chromium. The same eight checks now also pass on the
deployed Cloudflare/Convex preview with publicly trusted TLS. These changes are
not integrated into Kino.

## Findings and changes

The original adapter left private data visible in another open tab after logout.
Its memory-only auth storage does not provide cookie-session notifications across
tabs. The app now sends a credential-free BroadcastChannel notice on successful
password login, GitHub return, and logout. Each document has a random sender ID;
receivers ignore their own notices. Regression testing caught and fixed an initial
self-notification bug that interrupted password sign-in navigation.

Other tabs hide their current document and reload, creating fresh auth state,
Convex client and QueryClient. This avoids carrying the previous user's cached or
prefetched private data into another account. The GitHub callback marks the return
with `#session-changed`; the client removes that marker and announces the change.
No credentials are included in the marker, channel messages or browser storage.

Focus, visibility and online events request a session refresh. A changed or missing
identity causes a fresh document instead of updating a client holding another
account's private cache. A network failure is not interpreted as logout. Token
subject decoding detects UI transitions only; Convex still verifies authorization.

This is an app-owned adapter change, not a third upstream auth patch.

## Checks

The runner records sanitized results in [results-session-edges.json](results-session-edges.json):

1. Eight concurrent HTTP refresh requests preserve a usable cookie session.
2. Logout in one tab removes the other tab's private document.
3. Account switching via the GitHub-return notification path discards the old
   identity and prefetched page; navigation remains scoped to the new account.
4. Focus recovers an account change whose notification was missed.
5. Concurrent core refresh/sign-out leaves the session unable to refresh.
6. A genuinely expired refresh session clears cookies and denies private SSR.
7. Going offline past the current JWT's real expiry, then reconnecting, restores
   a working authenticated mutation and live query.
8. A frozen Chromium page, resumed after JWT expiry and a missed logout, returns
   to the public page without the previous user's private data.

The expiry checks use wall-clock time. A live-source formatting change disturbed
an early offline check; rerunning with unchanged source passed. Do not edit watched
source during these browser runs. Existing password sign-in, SSR, hover-preload,
live-update, cookie-refresh, anonymous-isolation and logout regression checks also
pass via `start-browser.mjs`.

## Run

From the parent experiment with its local services running:

```sh
PROOF_PLAYWRIGHT=/absolute/path/to/playwright node scripts/session-edges.mjs
```

The runner reads the ignored local admin config and two existing proof accounts.
It mints real component sessions directly, installs Secure/HttpOnly fixture cookies,
and exercises the real app/HTTP/backend boundaries. This isolates session behavior
from OAuth consent and inbox delivery; it is not new provider-login evidence.
The runner revokes its minted sessions afterward. It never prints credentials.

## Remaining limits

- Deployed preview repeat passed; promotion into Kino still requires integration checks.
- Chromium lifecycle freezing plus an explicit focus event approximates a sleeping
  tab; this does not establish operating-system sleep or Safari/Firefox behavior.
- Account transitions use full-document reloads, which discard unsaved in-memory
  UI state. Decide how Kino warns/preserves drafts before integration.
- Already-issued access JWTs retain their original expiry after logout/reset;
  these checks do not implement immediate server authorization revocation.
- A disconnected/frozen tab cannot process a cross-tab notice until it resumes.
- Browser back/forward cache restoration, streaming/error response cookies,
  longer repeated concurrency stress and deployed network failures remain separate
  checks. This is targeted evidence, not exhaustive session certification.

## Deployed repeat

All eight checks passed against `kino-auth-v2-proof-c318c09d` and Convex preview
`graceful-elephant-103`. See [cloud results](../cloud/results-session-edges.json).
Worker version: `183a1af5-71bb-43fa-9565-50e4ba0cf0bd`.

The first deployed attempt found a runtime difference: generating the tab ID via
`crypto.randomUUID()` at module scope fails in Cloudflare Workers. The adapter now
creates that ID lazily from browser lifecycle code. A regression test verifies
that importing the module does not generate randomness. Public homepage, all
eight session cases and gateway negative checks passed after redeployment.

The cloud runner uses two synthetic `proofFixture` identities seeded by an
**internal-only** function; an anonymous call to that function was rejected.
Fixtures do not use GitHub credentials, send mail or modify the existing GitHub
user. The runner revokes its minted sessions afterward. The synthetic users remain
in the disposable preview until teardown/expiry. This run proves deployed session
behavior, not an additional real OAuth exchange or email delivery.

From the parent experiment:

```sh
PROOF_CLOUD=1 PROOF_PLAYWRIGHT=/absolute/path/to/playwright node scripts/session-edges.mjs
```

The runner checks the exact preview URL/key target and accepts only publicly
trusted HTTPS in cloud mode. `cloud/prepare.mjs` installs the tracked internal
fixture template into the ignored cloud backend; it is never installed in Kino.
