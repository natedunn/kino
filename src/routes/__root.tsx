import { lazy, Suspense } from 'react';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { fetchSession, getCookieName } from '@convex-dev/better-auth/react-start';
import { ConvexQueryClient } from '@convex-dev/react-query';
import { QueryClient } from '@tanstack/react-query';
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	ScriptOnce,
	Scripts,
	useRouteContext,
} from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getCookie, getRequest } from '@tanstack/react-start/server';
import { ConvexReactClient } from 'convex/react';

import { DefaultCatchBoundary } from '@/components/_default-catch-boundary';
import { NotFound } from '@/components/_not-found';
import { Toaster } from '@/components/ui/sonner';
import { authClient } from '@/lib/auth/auth-client';

import appCss from '../styles/app.css?url';

// import { Devtools } from './-components/devtools';
const Devtools = lazy(() =>
	import('./-components/devtools').then((module) => ({ default: module.Devtools }))
);

const fetchAuth = createServerFn({ method: 'GET' }).handler(async () => {
	const { createAuth } = await import('@/convex/auth');
	const { session } = await fetchSession(getRequest());
	const sessionCookieName = getCookieName(createAuth);
	const token = getCookie(sessionCookieName);
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

		// During SSR only (the only time serverHttpClient exists),
		// set the auth token to make HTTP queries with.
		if (token) {
			ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
		}

		return {
			userId,
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
				title: 'Kino',
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
			<RootDocument>
				<Outlet />
			</RootDocument>
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
				{process.env.NODE_ENV === 'development' && (
					<Suspense fallback={null}>
						<Devtools />
					</Suspense>
				)}
				<Toaster position='top-right' closeButton richColors />
				<Scripts />
			</body>
		</html>
	);
}
