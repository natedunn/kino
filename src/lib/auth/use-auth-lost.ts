import { useAuth } from "kitcn/react"

/**
 * Returns `true` once client auth has been *lost* — the auth bridge has settled
 * (`!isLoading`) and reports unauthenticated. This is kitcn's own
 * `<Unauthenticated>` predicate.
 *
 * Entry into a protected route is gated in `beforeLoad` (see `requireAuth`),
 * which redirects unauthenticated visitors before the route renders. This hook
 * covers the one case `beforeLoad` cannot: auth lost *in place*, without a
 * navigation — i.e. signing out while sitting on a protected page. kitcn's
 * sign-out flips `isAuthenticated` to `false` and resets the auth-bound queries;
 * a route reading data via `useSuspenseQuery` would otherwise suspend to a blank
 * screen for the ~1–3s round-trip. Redirecting on auth-loss removes that subtree
 * instead of letting it blank, so the transition to /auth is instant.
 *
 * It deliberately does NOT read `loaderToken` (an SSR-only value that is absent
 * on the client after any SPA navigation) — mixing that in caused an infinite
 * /auth ↔ protected-route redirect loop. The only signal here is the resolved
 * client auth bridge.
 *
 * Safe against false positives on load: `useAuth()` reports
 * `{ isLoading: true, isAuthenticated: false }` during SSR and initial
 * hydration, so this stays `false` until auth genuinely resolves.
 */
export function useAuthLost() {
  const { isAuthenticated, isLoading } = useAuth()
  return !isLoading && !isAuthenticated
}
