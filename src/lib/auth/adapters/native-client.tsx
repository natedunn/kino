'use client';

import type { AuthClient as AuthClientType } from '@convex-dev/auth/browser';
import type { SlimTokenBundle } from '@convex-dev/auth/server';
import type { ConvexReactClient } from 'convex/react';
import type { ReactNode } from 'react';

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useSyncExternalStore,
} from 'react';
import { AuthClient, InMemoryStorage } from '@convex-dev/auth/browser';
import { ConvexProviderWithAuth } from 'convex/react';

const initialState = { isAuthenticated: false, isLoading: true, token: null } as const;
const AuthContext = createContext<{
	fetchAccessToken: (args: { forceRefreshToken: boolean }) => Promise<string | null>;
	isAuthenticated: boolean;
	isLoading: boolean;
} | null>(null);

let activeClient: AuthClientType | null = null;

async function post(path: string, keepalive = false) {
	const response = await fetch(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: '{}',
		keepalive,
	});
	if (response.status !== 401 && !response.ok) throw new Error('AUTH_TRANSPORT_FAILED');
	return (await response.json()) as { tokens: SlimTokenBundle | null };
}

export function expiredNativeSessionRedirectUrl(currentHref: string) {
	const current = new URL(currentHref);
	const redirect = `${current.pathname}${current.search}${current.hash}`;
	const auth = new URL('/auth', current.origin);
	if (redirect !== '/' && !redirect.startsWith('/auth')) {
		auth.searchParams.set('redirect', redirect);
	}
	return auth.toString();
}

function redirectExpiredNativeSession() {
	if (typeof window === 'undefined') return;
	window.location.replace(expiredNativeSessionRedirectUrl(window.location.href));
}

function useNativeConvexAuth() {
	const value = useContext(AuthContext);
	if (!value) throw new Error('Native auth hooks require NativeAuthProvider.');
	return value;
}

export function NativeAuthProvider({
	children,
	client,
	initialToken,
}: {
	children: ReactNode;
	client: ConvexReactClient;
	initialToken?: string | null;
}) {
	const authClient = useMemo(
		() =>
			new AuthClient({
				mode: 'ssr',
				initialAccessToken: initialToken,
				storage: new InMemoryStorage(),
				storageNamespace: 'kino-native-auth',
				authApi: {
					refreshSession: async () => {
						// A document navigation can discard an in-flight response after
						// Convex has already rotated the refresh token. Keep this tiny
						// request alive so its replacement cookie can reach the browser.
						const tokens = (await post('/api/auth/refresh', true)).tokens;
						if (!tokens) redirectExpiredNativeSession();
						return tokens;
					},
					signOut: async () => {
						await post('/api/auth/signout');
					},
				},
			}),
		[initialToken]
	);
	const state = useSyncExternalStore(
		authClient.subscribe,
		authClient.getSnapshot,
		() => initialState
	);

	useEffect(() => {
		activeClient = authClient;
		void authClient.init();
		return () => {
			if (activeClient === authClient) activeClient = null;
			authClient.dispose();
		};
	}, [authClient]);

	const fetchAccessToken = useCallback(
		(args: { forceRefreshToken: boolean }) => authClient.fetchAccessToken(args),
		[authClient]
	);
	const authState = useMemo(
		() => ({
			fetchAccessToken,
			isAuthenticated: state.isAuthenticated,
			isLoading: state.isLoading,
		}),
		[fetchAccessToken, state.isAuthenticated, state.isLoading]
	);

	return (
		<AuthContext.Provider value={authState}>
			<ConvexProviderWithAuth client={client} useAuth={useNativeConvexAuth}>
				{children}
			</ConvexProviderWithAuth>
		</AuthContext.Provider>
	);
}

function requireClient() {
	if (!activeClient) throw new Error('NATIVE_AUTH_NOT_READY');
	return activeClient;
}

export async function adoptNativeSession(tokens: SlimTokenBundle) {
	await requireClient().setSession(tokens);
}

export async function signOutNativeSession() {
	await requireClient().signOut();
}
