# Native Convex auth integration contract

Status: native Convex Auth v2 is the application runtime. The gateway retains
the legacy Better Auth proxy only for the rollback boundary described in
[GitHub environments](github-environments.md).

This contract keeps application code stable across authentication runtime
changes. Product routes must consume the Kino-owned modules in `src/lib/auth`.
Provider-specific APIs belong in an adapter and must not be imported by routes or
feature components.

## Pinned runtime

- Repository: `get-convex/convex-auth`, branch `reboot`
- Tested source commit: `1d105a04d124785441ce655cef33b54103c7bc2e`
- Source package version: `2.0.0-alpha.2`
- Required Convex version in the proof: `1.46.0`
- Do not substitute the differently-built published alpha without repeating the
  auth, SSR, OAuth, and regression proofs.

The integration must carry three isolated patches until equivalent upstream
behavior is available:

1. Password reset increments a core-owned session generation so every old
   refresh token is rejected after the credential change.
2. OAuth supports a server-configured callback URL for the stable gateway.
3. A retry of the immediately previous refresh token inside the grace window
   recovers the exact successor, including when the first response was lost.

The patch removal conditions and current upstream assessment are maintained in
[Convex Auth v2 patch maintenance](convex-auth-v2-maintenance.md).

The short opaque OAuth state registry is Kino gateway infrastructure. It is not
implemented by either auth provider and remains required after the provider
change.

The root package now installs that exact Git commit and applies
`patches/convex-auth-v2-reboot.patch` reproducibly through pnpm. The package
verification script checks both the pin and the emitted `dist` runtime, because
patching only the package's TypeScript source would leave consumers executing
the original compiled JavaScript. Kino uses the tested Convex 1.46 runtime;
`verify:pr` checks generated application files, the installed auth package, and
TypeScript compatibility.

## Stable browser surface

Application code uses `src/lib/auth/auth-client.ts`:

- `useAuthState()`
- `useIsAuthenticated()`
- `useAuthSession()`
- `signInWithGitHub(callbackURL)`
- `signInWithPassword(input)`
- `signUpWithPassword(input)`
- `resendVerificationEmail(input)`
- `requestPasswordReset(input)`
- `resetPassword(input)`
- `useSignOutMutationOptions()`

The surface intentionally exposes only the user fields Kino consumes and a
small normalized error shape. Better Auth plugin methods and Convex Auth v2
component details do not belong in route code.

The current implementation uses the native actions and client adapter in
`src/lib/auth/adapters/`. Provider upgrades must preserve the same observable
application behavior behind this surface.

## Stable server surface

TanStack Start and HTTP routes use `src/lib/auth/auth-server.ts`:

- `handleAuthRequest(request)`
- `getServerAuthToken()`

The native server adapter uses `setupConvexAuthServer`, `ServerAuthSession`, and
HttpOnly access/refresh cookies behind this surface. A request-scoped cache must
share one refresh operation among parallel SSR token consumers. Only the access
token may enter SSR hydration; refresh tokens remain HttpOnly.

## Runtime and deployment boundaries

- A request is handled by exactly one auth runtime. The application selects the
  native adapters; the retained gateway rollback proxy is a separate path.
- Kino Auth and Kino Relay remain separate registrations and credential sets.
- GitHub login uses the stable per-tier gateway and its single-use state registry.
- A provider upgrade must be proven in an isolated local/preview deployment
  before changing production OAuth configuration.

The native backend source is `convex/native/`, selected by root `convex.json`.
`integrations/native-convex/convex.json` remains an isolated proof configuration.
During the original parallel proof, separate deployments avoided merging
Better Auth and native JWKS sets with the same issuer and audience. Native is
now the only application backend; no cross-backend identity bridge is required.
See [the native integration runbook](../integrations/native-convex/README.md).

## Identity rules

- Convex Auth owns provider account mappings, credentials, and sessions; the
  pinned reboot delegates app-user creation to Kino's callbacks.
- Kino owns users, profiles, organizations, memberships, invitations, system roles,
  project membership, and authorization.
- Backend authorization derives the caller from verified auth identity. It does
  not accept a caller identity from client arguments.
- GitHub and password identities are never linked solely by an email string.
- Provider account IDs and provider-verified email evidence are required for
  linking or verified-email refresh.
- Password email normalization trims and lowercases the address; uniqueness is
  enforced transactionally by indexed lookup. Plus tags and dots are preserved.
  Explicit account-linking UX is deferred; no email-based linking is available.
- Pending password signup creates no profile, organization, or session.
  Verification atomically activates the user and creates their profile, personal
  organization, owner membership and session. Repeat login does not restore
  removed/demoted ownership.
- Recovery revokes all old refresh sessions in the password-change transaction.
  Existing access tokens retain their original expiry (60 seconds by default).
- Native email links carry a code fragment at `/auth/verify-email` or
  `/auth/reset-password`. The Start adapter must consume them explicitly, keep
  them out of logging/analytics, and store returned sessions in HttpOnly cookies.
  The UI routes are implemented; backend tests alone do not establish browser
  acceptance for a provider upgrade.
- Native bootstrap always grants the ordinary user role. System-administrator
  provisioning must be an explicit internal operation; matching a provider email
  to an environment variable is not an elevation path.

## TanStack and Convex data contract

- Every SSR request owns its QueryClient and auth/session state.
- Protected route loaders obtain a request token before fetching private data.
- Loaders use `ensureQueryData`; rendered routes use `useSuspenseQuery` with the
  same query key.
- Hover intent starts the future route's Convex subscription; navigation reuses
  it.
- Protected documents must not let a pre-auth browser subscription overwrite an
  authorized SSR snapshot.
- Logout, account change, membership removal, and role demotion remove or fence
  protected cached data immediately.
- Public content must not wait for optional viewer authentication.

## Provider-upgrade acceptance

- Verified password signup sends mail through Bento and issues no session before
  verification.
- Password login, resend, recovery, reset, reset replay rejection, and old
  refresh-session rejection pass.
- GitHub login, callback, reload, logout, repeat login, cancellation, expiry,
  tampering, and state replay pass through the real dev gateway.
- Direct protected-route SSR contains the authorized data; anonymous HTML does
  not.
- Hydration reuses the SSR result and establishes one live subscription.
- Organization switching, invitation acceptance, membership removal, role
  demotion, and revoked writes pass in multiple tabs.
- Equivalent current/native flows record cold and warm p50/p95 timings for
  sign-in-to-content, authenticated reload, backend calls, reads, and
  subscription activity.

Run these checks against a candidate provider upgrade before promoting it.
Record the live-proof boundaries in the
[migration handoff](native-convex-migration-status.md).
