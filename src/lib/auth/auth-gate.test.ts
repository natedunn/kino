import { afterEach, describe, expect, it } from 'vitest';

import {
	deriveClientAuthed,
	deriveClientDefinitelyAuthed,
	isClientAuthed,
	isClientDefinitelyAuthed,
	setAuthSnapshot,
} from './auth-snapshot';
import { requireAuth } from './require-auth';

// `redirect()` returns `{ options: { to, search, statusCode } }` and is thrown.
function catchRedirect(fn: () => void) {
	try {
		fn();
	} catch (thrown) {
		return thrown as {
			options?: { to?: string; search?: { redirect?: string } };
		};
	}
	return null;
}

describe('requireAuth', () => {
	it('redirects unauthenticated visitors to /auth, preserving the full href', () => {
		const thrown = catchRedirect(() =>
			requireAuth({ isAuthenticated: false }, { href: '/org/settings?org=acme' })
		);

		expect(thrown).not.toBeNull();
		expect(thrown?.options?.to).toBe('/auth');
		expect(thrown?.options?.search?.redirect).toBe('/org/settings?org=acme');
	});

	it('treats a missing flag as unauthenticated', () => {
		const thrown = catchRedirect(() => requireAuth({}, { href: '/dashboard' }));

		expect(thrown?.options?.to).toBe('/auth');
		expect(thrown?.options?.search?.redirect).toBe('/dashboard');
	});

	it('lets authenticated visitors through', () => {
		expect(() => requireAuth({ isAuthenticated: true }, { href: '/dashboard' })).not.toThrow();
	});
});

describe('auth-snapshot derivations', () => {
	it('deriveClientAuthed fails OPEN while loading', () => {
		expect(deriveClientAuthed({ isAuthenticated: false, isLoading: true })).toBe(true);
		expect(deriveClientAuthed({ isAuthenticated: false, isLoading: false })).toBe(false);
		expect(deriveClientAuthed({ isAuthenticated: true, isLoading: false })).toBe(true);
	});

	it('deriveClientDefinitelyAuthed fails CLOSED while loading', () => {
		expect(deriveClientDefinitelyAuthed({ isAuthenticated: true, isLoading: true })).toBe(false);
		expect(deriveClientDefinitelyAuthed({ isAuthenticated: true, isLoading: false })).toBe(true);
		expect(deriveClientDefinitelyAuthed({ isAuthenticated: false, isLoading: false })).toBe(false);
	});
});

describe('auth-snapshot server safety', () => {
	afterEach(() => {
		// Reset the module-global between cases (no-op on the server, but explicit).
		setAuthSnapshot({ isAuthenticated: false, isLoading: true });
	});

	it('never reports authed on the server, even after a write', () => {
		// This suite runs in the default (node) env, where `window` is undefined.
		expect(typeof window).toBe('undefined');

		// Writes are dropped on the server, and the accessors hard-return false —
		// so one request can never leak auth state into another's SSR.
		setAuthSnapshot({ isAuthenticated: true, isLoading: false });
		expect(isClientAuthed()).toBe(false);
		expect(isClientDefinitelyAuthed()).toBe(false);
	});
});
