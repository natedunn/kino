# Native Convex auth integration contract

Status: implementation boundary introduced; Kino still runs Kitcn/Better Auth.

This contract keeps application code stable while the authentication runtime is
replaced. Product routes must consume the Kino-owned modules in `src/lib/auth`.
Provider-specific APIs belong in an adapter and must not be imported by routes or
feature components.

## Pinned candidate

- Repository: `get-convex/convex-auth`, branch `reboot`
- Tested source commit: `1d105a04d124785441ce655cef33b54103c7bc2e`
- Source package version: `2.0.0-alpha.2`
- Required Convex version in the proof: `1.46.0`
- Do not substitute the differently-built published alpha without repeating the
  auth, SSR, OAuth, and regression proofs.

The integration must carry two isolated patches until equivalent upstream
behavior is available:

1. Password reset increments a core-owned session generation so every old
   refresh token is rejected after the credential change.
2. OAuth supports a server-configured callback URL for the stable gateway.

The short opaque OAuth state registry is Kino gateway infrastructure. It is not
implemented by either auth provider and remains required after the provider
change.

The root package now installs that exact Git commit and applies
`patches/convex-auth-v2-reboot.patch` reproducibly through pnpm. The package
verification script checks both the pin and the emitted `dist` runtime, because
patching only the package's TypeScript source would leave consumers executing
the original compiled JavaScript. During the parallel period Kino uses Convex
1.46 with a documented Kitcn peer override; `verify:pr` remains the compatibility
gate until Kitcn is removed.

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

The current implementation lives in
`src/lib/auth/adapters/kitcn-client.ts`. The v2 adapter must implement the same
observable application behavior before it becomes the selected runtime.

## Stable server surface

TanStack Start and HTTP routes use `src/lib/auth/auth-server.ts`:

- `handleAuthRequest(request)`
- `getServerAuthToken()`
- Transitional authenticated Convex fetch helpers used by unmigrated server
  code

The v2 implementation will use `setupConvexAuthServer`, `ServerAuthSession`, and
HttpOnly access/refresh cookies behind this surface. A request-scoped cache must
share one refresh operation among parallel SSR token consumers. Only the access
token may enter SSR hydration; refresh tokens remain HttpOnly.

## Runtime coexistence rules

The first v2 integration runs only on a dedicated integration preview and its
isolated Convex deployment.

- The stable Kitcn/Better Auth path remains unchanged while parity is tested.
- Native and Better Auth cookies use distinct names.
- A request is handled by exactly one auth runtime.
- The integration preview uses the temporary proof OAuth registration until its
  gateway route is ready.
- Kino Auth and Kino Relay remain separate registrations and credential sets.
- Production OAuth configuration does not change during parallel integration.

The native backend source is `convex/native/`, selected by
`integrations/native-convex/convex.json`; the root config continues selecting
the legacy backend. Each has its own generated API and database. Both providers
default to the deployment site URL as issuer and `convex` as audience, so the
parallel period uses separate deployments instead of merging their JWKS sets.
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
  These UI routes are pending; backend tests do not establish browser acceptance.
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

## Integration-preview acceptance

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

Only after these checks pass should the project/board/feedback vertical slice
begin replacing Kitcn ORM and cRPC calls.
