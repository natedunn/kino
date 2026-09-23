# Live GitHub OAuth proof — sign-in and reload confirmed

See the [migration status and follow-up checklist](../../../docs/native-convex-migration-status.md)
for what to test now, in the integration preview, and after deployment. This
local proof does not require a merge; merging these files does not migrate Kino.

This scaffold adapts the pinned upstream `examples/react-github` example. It
imports exactly the source revision used by the parent proof harness. The
upstream source is Apache-2.0 licensed; see `../.upstream/LICENSE`.

This example is running on an isolated local backend. The user confirmed real
GitHub sign-in, an app user ID, and persistence after reload. It exercises the official SPA
provider, not TanStack Start SSR or Kino's gateway. The session uses the upstream
SPA storage behavior; it does not prove HttpOnly cookie integration.

## OAuth registration decision

The existing Kino Auth callback targets the Better Auth gateway, whose state and
completion protocol differs from v2. A separate disposable registration permits
a direct provider test without changing existing login routing. Reusing the
current registration requires implementing and testing a compatible gateway
route first; changing its registered callback would affect existing logins.

For a disposable registration:

- Homepage: `http://127.0.0.1:5179`
- Callback: `http://127.0.0.1:4411/oauth/github/callback`
- Enter `AUTH_GITHUB_CLIENT_ID` and `AUTH_GITHUB_CLIENT_SECRET` into the empty,
  gitignored `.env.github.local` beside this file. Do not commit it.

The local backend must use cloud port 4410 and site port 4411. Startup,
key provisioning, code generation, and callback reachability must be verified
before presenting this URL as ready to test. No existing app/gateway secrets
are read or reused by this scaffold.

## Acceptance evidence before continuing the migration

- [x] Backend deployed to a separately identified local-only instance.
- [x] Signing keys and disposable OAuth credentials configured on that instance.
- [x] Real authorization URL has the expected callback, state, and PKCE fields.
- [x] User completes GitHub consent and returns to the proof app (user-confirmed).
- [x] A protected Convex query returns the created app user ID (user-confirmed UI).
- [x] Reload remains authenticated (user-confirmed).
- [x] Sign-out returns to signed-out state (user-confirmed sequence).
- [x] A second login resolves the same user ID (user-confirmed).
- [ ] Cancellation and callback replay fail safely.
- [x] User confirmation or browser evidence recorded here.

Even after these pass, account linking across password/GitHub, Start cookie/SSR
integration, and Kino gateway compatibility remain separate proof gates.

## Observed local readiness

- Deployment selector: `anonymous:anonymous-agent`, scoped to this directory's
  `.convex` state. API `http://127.0.0.1:4410`, site `http://127.0.0.1:4411`.
- Frontend: `http://127.0.0.1:5179/`.
- Core and OAuth components installed successfully; backend TypeScript passes.
- Unauthenticated `users:getCurrentUser` returns null.
- `/auth/.well-known/jwks.json` returns 200 with one public signing key.
- Browser button reaches GitHub login for **Kino Convex v2 Proof**. Authorization
  request has callback `http://127.0.0.1:4411/oauth/github/callback`, nonempty state,
  S256 PKCE, and scopes `read:user user:email`.
- User reported: "Signed in with a user ID; reload also works."
- Read-only local database inspection found one app user, one GitHub account,
  and one session. The account maps to the app user, and the session maps to
  that account and user. No token values or provider account identifiers are
  recorded in this report.
- User subsequently completed the sign-out/re-login check and confirmed the same
  user ID. The basic live GitHub login lifecycle is confirmed.
- Cancellation and callback replay remain unchecked in the live browser flow.
  Passing upstream unit tests are not substituted for those live checks.

## Restart after this session

Keep both processes running in separate terminals, from this directory:

```sh
CONVEX_AGENT_MODE=anonymous node ../node_modules/convex/bin/main.js dev --local-cloud-port 4410 --local-site-port 4411 --tail-logs disable
```

```sh
node ../node_modules/vite/bin/vite.js --config vite.config.ts
```

The credentials and generated signing key have already been provisioned on this
local instance. They are retained in gitignored files for this experiment only.
Do not change the deployment selector to a shared or production deployment.
