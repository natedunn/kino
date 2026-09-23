import type { ConvexQueryClient } from '@convex-dev/react-query';
import type { QueryClient } from '@tanstack/react-query';

import { useEffect } from 'react';
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router';

import { ProofAuth } from '../auth-client';
import { getInitialToken } from '../auth-server';

export const Route = createRootRouteWithContext<{
	convex: ConvexQueryClient;
	query: QueryClient;
}>()({
	beforeLoad: async ({ context }) => {
		if (typeof window !== 'undefined') return {};
		const [initialToken] = await Promise.all([getInitialToken(), getInitialToken()]);
		if (initialToken) context.convex.serverHttpClient?.setAuth(initialToken);
		return { initialToken };
	},
	component: Root,
});
function Root() {
	const context = Route.useRouteContext();
	useEffect(() => {
		document.documentElement.dataset.hydrated = 'true';
	}, []);
	return (
		<html lang='en'>
			<head>
				<HeadContent />
			</head>
			<body>
				<ProofAuth client={context.convex.convexClient} initialToken={context.initialToken ?? null}>
					<Outlet />
				</ProofAuth>
				<Scripts />
			</body>
		</html>
	);
}
