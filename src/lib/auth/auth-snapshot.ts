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
 * client-side signal for client-side navigations.
 *
 * `isLoading` starts `true`: until the bridge has resolved we don't *know* the
 * auth state, so the gate fails open (treats as authed) and lets the in-component
 * `useAuthLost()` guard settle it — an SSR-authed user never flashes a redirect.
 */
type AuthSnapshot = {
  isAuthenticated: boolean
  isLoading: boolean
}

let snapshot: AuthSnapshot = {
  isAuthenticated: false,
  isLoading: true,
}

export function setAuthSnapshot(next: AuthSnapshot) {
  snapshot = next
}

export function getAuthSnapshot(): AuthSnapshot {
  return snapshot
}

/**
 * Whether `beforeLoad` should consider this client navigation authenticated.
 * Fails open while the bridge is still loading (see above).
 */
export function isClientAuthed(): boolean {
  return snapshot.isLoading || snapshot.isAuthenticated
}
