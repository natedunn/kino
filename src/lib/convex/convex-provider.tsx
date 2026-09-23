'use client';

import type { ConvexQueryClient } from '@convex-dev/react-query';
import type { ReactNode } from 'react';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { NativeAuthProvider } from '@/lib/auth/adapters/native-client';
import { useAuthState } from '@/lib/auth/auth-client';
import { setAuthSnapshot } from '@/lib/auth/auth-snapshot';

export function AppConvexProvider({
	children,
	convexQueryClient,
	initialToken,
}: {
	children: ReactNode;
	convexQueryClient: ConvexQueryClient;
	initialToken?: string | null;
}) {
	return (
		<NativeAuthProvider
			client={convexQueryClient.convexClient}
			initialToken={initialToken ?? undefined}
		>
			<NativeQueryProvider convexQueryClient={convexQueryClient}>{children}</NativeQueryProvider>
		</NativeAuthProvider>
	);
}

function NativeQueryProvider({
	children,
	convexQueryClient,
}: {
	children: ReactNode;
	convexQueryClient: ConvexQueryClient;
}) {
	const queryClient = useQueryClient();
	if (convexQueryClient.queryClient !== queryClient) {
		throw new Error('Convex and TanStack Query clients are not paired.');
	}

	return (
		<>
			<AuthSnapshotSync />
			{children}
		</>
	);
}

// Mirror the React-bound auth bridge into a module-level snapshot so route
// `beforeLoad` (which runs outside React) can read auth state synchronously on
// the client. See `@/lib/auth/auth-snapshot` and `requireAuth`.
function AuthSnapshotSync() {
	const { isAuthenticated, isLoading } = useAuthState();

	useEffect(() => {
		setAuthSnapshot({ isAuthenticated, isLoading });
	}, [isAuthenticated, isLoading]);

	return null;
}
