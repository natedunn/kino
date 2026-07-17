/**
 * Module-level mirror of the client auth bridge (deliberately NOT React state).
 *
 * Why this exists: route `beforeLoad` runs outside React, so it can't call
 * kitcn's `useAuth()` hook to read auth state. But `beforeLoad` is exactly where
 * we want to gate protected routes (a real redirect, before the route renders —
 * no render-then-`<Navigate>` bounce). This snapshot is kept in sync with the
 * auth bridge by `<AuthSnapshotSync>` (mounted inside the auth provider) so that
 * `beforeLoad` can read "is the user authenticated" synchronously on the client.
 *
 * The server doesn't use this — there `beforeLoad` reads the request's
 * `loaderToken` directly (see `routes/__root.tsx`). This is purely the
 * client-side signal for client-side navigations. The accessors below are
 * hard-guarded to no-op / return `false` on the server: a module-global is
 * shared across requests in a worker isolate, so reading it during SSR would
 * leak one user's auth state into another's request. Today nothing does that;
 * the guard keeps it that way.
 *
 * `isLoading` starts `true`: until the bridge has resolved we don't *know* the
 * auth state.
 */
type AuthSnapshot = {
	isAuthenticated: boolean;
	isLoading: boolean;
};

let snapshot: AuthSnapshot = {
	isAuthenticated: false,
	isLoading: true,
};

const isServer = () => typeof window === 'undefined';

export function setAuthSnapshot(next: AuthSnapshot) {
	// Only ever written from a client effect; never persist state on the server.
	if (isServer()) return;
	snapshot = next;
}

export function getAuthSnapshot(): AuthSnapshot {
	return snapshot;
}

/** Pure derivation: authed *or still loading* (fails open). Exported for tests. */
export function deriveClientAuthed(snap: AuthSnapshot): boolean {
	return snap.isLoading || snap.isAuthenticated;
}

/** Pure derivation: settled *and* authenticated (fails closed). Exported for tests. */
export function deriveClientDefinitelyAuthed(snap: AuthSnapshot): boolean {
	return !snap.isLoading && snap.isAuthenticated;
}

/**
 * Whether `beforeLoad` should consider this client navigation authenticated.
 * Fails OPEN while the bridge is still loading — used by `requireAuth`, whose
 * job is to keep authed users in; an SSR-authed user mid-load is never bounced,
 * and the in-component `useAuthLost()` guard settles a genuine sign-out.
 * Always `false` on the server (see file header).
 */
export function isClientAuthed(): boolean {
	return !isServer() && deriveClientAuthed(snapshot);
}

/**
 * Whether `beforeLoad` should consider this client navigation *definitely*
 * authenticated. Fails CLOSED while loading — used by the `/` inverse gate,
 * which bounces authed users to /dashboard. Failing open there would flash a
 * just-loaded anonymous visitor to /dashboard (and on to /auth) instead of
 * showing the public landing page. Always `false` on the server.
 */
export function isClientDefinitelyAuthed(): boolean {
	return !isServer() && deriveClientDefinitelyAuthed(snapshot);
}
