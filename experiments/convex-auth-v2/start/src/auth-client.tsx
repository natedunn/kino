import type { ConvexReactClient } from 'convex/react';
import type { ReactNode } from 'react';
import type { AuthSessionResponse } from '../../.upstream/packages/core/src/lib/types';

import { useEffect, useMemo } from 'react';
import { ConvexHttpClient } from 'convex/browser';
import { ConvexProviderWithAuth } from 'convex/react';

import { AuthClient } from '../../.upstream/packages/core/src/browser/sessionManager';
import { InMemoryStorage } from '../../.upstream/packages/core/src/browser/storage';
import { AuthProvider, useAuth } from '../../.upstream/packages/core/src/react/client';
import { restartSession, tokenSubject, watchSessionChanges } from './session-sync';

async function post(path: string): Promise<AuthSessionResponse> {
	const response = await fetch(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: '{}',
	});
	if (response.status !== 401 && !response.ok) throw new Error('Auth transport failed');
	return response.json();
}
export function ProofAuth({
	client,
	initialToken,
	children,
}: {
	client: ConvexReactClient;
	initialToken: string | null;
	children: ReactNode;
}) {
	useEffect(watchSessionChanges, []);
	const { authClient, signInApi } = useMemo(() => {
		const authClient = new AuthClient({
			mode: 'ssr',
			initialAccessToken: initialToken,
			storage: new InMemoryStorage(),
			storageNamespace: 'start-proof',
			authApi: {
				refreshSession: async () => {
					const tokens = (await post('/api/auth/refresh')).tokens;
					if (tokenSubject(tokens?.accessToken) !== tokenSubject(initialToken)) {
						restartSession();
						return new Promise<never>(() => {});
					}
					return tokens;
				},
				signOut: async () => {
					await post('/api/auth/signout');
				},
			},
		});
		const proxy = new ConvexHttpClient('/api/auth/signin?path=', {
			skipConvexDeploymentUrlCheck: true,
		});
		return {
			authClient,
			signInApi: { mutation: proxy.mutation.bind(proxy), action: proxy.action.bind(proxy) },
		};
	}, [client]);
	useEffect(() => {
		let refreshing = false;
		const resume = async () => {
			if (document.visibilityState !== 'visible' || !navigator.onLine || refreshing) return;
			refreshing = true;
			try {
				await authClient.fetchAccessToken({ forceRefreshToken: true });
			} catch {
				/* A failed network check is not a sign-out. Retry on the next resume. */
			} finally {
				refreshing = false;
			}
		};
		window.addEventListener('online', resume);
		window.addEventListener('focus', resume);
		document.addEventListener('visibilitychange', resume);
		return () => {
			window.removeEventListener('online', resume);
			window.removeEventListener('focus', resume);
			document.removeEventListener('visibilitychange', resume);
		};
	}, [authClient]);
	return (
		<AuthProvider authClient={authClient} signInApi={signInApi}>
			<ConvexProviderWithAuth client={client} useAuth={useAuth}>
				{children}
			</ConvexProviderWithAuth>
		</AuthProvider>
	);
}
