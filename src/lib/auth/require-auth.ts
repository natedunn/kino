import { redirect } from '@tanstack/react-router';

/**
 * `beforeLoad` auth gate for protected routes. Redirects unauthenticated
 * visitors to /auth *before* the route renders — a real redirect, on both the
 * server (direct loads / SSR) and the client (SPA navigations), so there's no
 * render-then-`<Navigate>` bounce.
 *
 * `context.isAuthenticated` is populated by the root `beforeLoad`: on the server
 * from the request's `loaderToken`, on the client from the auth snapshot (see
 * `auth-snapshot.ts`). It fails open while the client bridge is still loading,
 * so an SSR-authenticated user never gets bounced here; the in-place sign-out
 * case is handled separately by the component-level `useAuthLost()` guard
 * (`beforeLoad` doesn't re-run when auth is lost without a navigation).
 */
export function requireAuth(context: { isAuthenticated?: boolean }, location: { href: string }) {
	if (!context.isAuthenticated) {
		throw redirect({
			to: '/auth',
			// `href` is the relative path + search + hash, so deep links like
			// `/org/settings?org=acme` survive the round-trip through /auth.
			// `getSafeRedirectTarget` rejects `/auth` and `/` targets, so this can't
			// loop back here.
			search: { redirect: location.href },
		});
	}
}
