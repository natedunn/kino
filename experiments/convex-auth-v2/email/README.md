# Live local email proof

Uses the pinned official v2 source with the proposed session-generation patch,
actual password WASM component, and Kino's existing localized Bento sender/templates.
This is an isolated developer experiment, not production auth or a Start adapter.
It stores tokens in sessionStorage for browser testing; HttpOnly cookies and SSR
are a separate pending proof. All public email operations restrict recipients to
`PROOF_EMAIL`. The later gateway proof adds GitHub users separately from password email lookup;
no automatic account linking or organization behavior is included.

## Evidence, September 20, 2026

- Parent harness: 135 tests pass; TypeScript passes.
- This frontend/backend: TypeScript passes.
- Real local Convex deployment: patched auth, password and rate limiter installed.
- Playwright Chromium: signup accepted; unverified login refused; no session
  stored and no browser exceptions.
- Existing Bento sender logged one accepted verification email.
- Nate confirmed that the verification email arrived.
- Playwright consumed the delivered verification link: verified account,
  authenticated user query and reload passed. A second session resolved to the same user.
- Browser requested recovery; Bento accepted one password-reset email.
- Nate supplied the delivered reset link; Playwright completed the password reset.
- Real backend rejected both pre-reset sessions and a spent refresh token.
- Old-password sign-in failed; new-password browser sign-in and reload preserved
  the original user ID. Replaying the consumed reset link failed.
- No browser exceptions occurred. Frontend production build also passes.
- **Local email/password lifecycle proof complete.** This is sequential live
  evidence; concurrent backend retries and production behavior remain unproven.
- **Not established:** Start SSR, browser hydration, live subscriptions, hover
  preloading, production performance, or production integration.

## Run

From the parent proof folder, install/setup as described in its README and run
`node scripts/prepare-revocation.mjs`. Do not regenerate the patched directory
while the local backend is watching it.

From this folder, start the local backend:

```sh
CONVEX_AGENT_MODE=anonymous node ../node_modules/convex/bin/main.js dev --local-cloud-port 4420 --local-site-port 4421 --typecheck disable --tail-logs disable
```

The ignored `.env.proof.local` was provisioned locally with a fresh signing key,
the existing dev Bento credentials, and the authorized `PROOF_EMAIL`. After
confirming `.env.local` targets this local backend, load it if needed:

```sh
node ../node_modules/convex/bin/main.js env set --from-file .env.proof.local
node ../node_modules/vite/bin/vite.js --config vite.config.ts
node ../node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
```

Frontend: http://127.0.0.1:5180/ . Backend: 4420; auth HTTP/JWKS: 4421.

The browser runner lives at `../scripts/email-browser.mjs`. Set
`PROOF_PLAYWRIGHT` to an installed Playwright package directory with Chromium
available, then run from the parent proof directory:

```sh
node scripts/email-browser.mjs signup
node scripts/email-browser.mjs verify
node scripts/email-browser.mjs reset
```

Run each phase once in order. Before `verify` and `reset`, save the corresponding
inbox link to `.env.link.local` in this folder. Links expire after 15 minutes.
The browser requires an explicit confirmation click, so merely loading a link
will not consume it. The verification phase also requests a reset email.

Random passwords and session tokens remain in ignored, mode-0600 local files.
Do not commit these files or print their contents. The runner checks real browser
forms, reload and authenticated queries; it uses HTTP calls for a second session,
old-token rejection and reset replay checks. It does not prove concurrent OCC
retry behavior. Already issued access JWTs retain their original expiry.
