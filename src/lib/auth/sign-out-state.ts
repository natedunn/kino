/**
 * Module-level sign-out flag (deliberately NOT React state, so it survives the
 * cross-route navigation from a protected page to /auth during sign-out).
 *
 * Why this exists: kitcn's `AuthStateSync` continuously re-derives
 * `isAuthenticated` from `hasSession || token !== null`. For the ~1–3s a
 * sign-out takes to complete, the Better Auth session and the Convex token are
 * still present client-side, so auth state transiently reads as authenticated
 * again right after we've left the app. Without suppression, /auth's
 * "already authenticated → go to the app" redirect fires on that transient
 * state and bounces the just-signed-out user /auth → /dashboard → /auth.
 *
 * The flag is set when sign-out starts and lifted once auth has genuinely
 * settled (the Better Auth session is gone — see /auth's redirect effect) or if
 * the sign-out errors.
 */
let signingOut = false;

export function beginSignOut() {
	signingOut = true;
}

export function endSignOut() {
	signingOut = false;
}

export function isSigningOut() {
	return signingOut;
}
