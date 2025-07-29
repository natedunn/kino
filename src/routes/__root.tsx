import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { convexQuery, ConvexQueryClient } from '@convex-dev/react-query';
import { QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	ScriptOnce,
	Scripts,
	useRouteContext,
} from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { createServerFn } from '@tanstack/react-start';
import { getCookie, getWebRequest } from '@tanstack/react-start/server';
import { ConvexQueryCacheProvider } from 'convex-helpers/react/cache';
import { ConvexReactClient } from 'convex/react';

import { API, api } from '~api';
import { DefaultCatchBoundary } from '@/components/_default-catch-boundary';
import { NotFound } from '@/components/_not-found';
import { Toaster } from '@/components/ui/sonner';
import { Id } from '@/convex/_generated/dataModel';
import { authClient } from '@/lib/auth/auth-client';
import { fetchSession, getCookieName } from '@/lib/auth/auth-server-utils';

import appCss from '../styles/app.css?url';

const fetchAuth = createServerFn({ method: 'GET' }).handler(async () => {
	const sessionCookieName = await getCookieName();
	const token = getCookie(sessionCookieName);
	const request = getWebRequest();
	const { session } = await fetchSession(request);

	return {
		userId: session?.user.id,
		token,
	};
});

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
	convexClient: ConvexReactClient;
	convexQueryClient: ConvexQueryClient;
}>()({
	beforeLoad: async (ctx) => {
		const auth = await fetchAuth();
		const { userId, token } = auth;

		let user = null as API['user']['getUserIndexes'] | null;

		if (token) {
			ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
		}

		if (token && userId) {
			user = await ctx.context.queryClient.ensureQueryData(
				convexQuery(api.user.getUserIndexes, {
					_id: userId as Id<'user'>,
				})
			);
		}

		return {
			user,
			isAuthenticated: !!user,
			token,
		};
	},
	head: () => ({
		meta: [
			{
				charSet: 'utf-8',
			},
			{
				name: 'viewport',
				content: 'width=device-width, initial-scale=1',
			},
			{
				title: 'Buildstory',
			},
		],
		links: [
			{
				rel: 'stylesheet',
				href: appCss,
			},
			{
				rel: 'preconnect',
				href: 'https://fonts.googleapis.com',
			},
			{
				rel: 'preconnect',
				href: 'https://fonts.gstatic.com',
				crossOrigin: '',
			},
			{
				rel: 'stylesheet',
				href: 'https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap',
			},
		],
	}),
	errorComponent: (props) => {
		return (
			<RootDocument>
				<DefaultCatchBoundary {...props} />
			</RootDocument>
		);
	},
	notFoundComponent: () => <NotFound />,
	component: RootComponent,
});

function RootComponent() {
	const context = useRouteContext({ from: Route.id });
	return (
		<ConvexBetterAuthProvider client={context.convexClient} authClient={authClient}>
			<ConvexQueryCacheProvider>
				<RootDocument>
					<Outlet />
				</RootDocument>
			</ConvexQueryCacheProvider>
		</ConvexBetterAuthProvider>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body>
				<ScriptOnce>
					{`document.documentElement.classList.toggle(
						'dark',
						localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
					)`}
				</ScriptOnce>
				{children}
				<Toaster position='top-right' closeButton richColors />
				<TanStackRouterDevtools position='bottom-right' />
				<ReactQueryDevtools buttonPosition='bottom-left' />
				<Scripts />
			</body>
		</html>
	);
}
