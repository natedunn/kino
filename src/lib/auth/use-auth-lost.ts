import { useAuth } from "kitcn/react"

/**
 * Returns `true` once client auth has been *lost* — i.e. the auth bridge has
 * settled (`!isLoading`) and reports unauthenticated. This is exactly kitcn's
 * own `<Unauthenticated>` predicate.
 *
 * Why authed route guards need this in addition to the server `loaderToken`:
 * when a user signs out, kitcn's sign-out mutation synchronously sets
 * `isAuthenticated = false` and resets the auth-bound queries. Routes that read
 * data via `useSuspenseQuery` (with no Suspense boundary above them) would then
 * suspend to a blank screen for the ~1–3s the sign-out network round-trip takes.
 * Redirecting on auth-loss removes the suspending subtree *instead of* letting
 * it blank, so the transition to /auth is instant.
 *
 * It is safe against false positives on load: `useAuth()` reports
 * `{ isLoading: true, isAuthenticated: false }` during SSR and initial
 * hydration, so this stays `false` until auth genuinely resolves — an
 * SSR-authenticated user (guarded by `loaderToken`) never flashes a redirect.
 */
export function useAuthLost() {
  const { isAuthenticated, isLoading } = useAuth()
  return !isLoading && !isAuthenticated
}
