import type { QueryClient } from '@tanstack/react-query';
import type { ConvexQueryClient } from 'kitcn/react';
import type { ReactNode } from 'react';

import { lazy, Suspense, useRef } from 'react';
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	ScriptOnce,
	Scripts,
} from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';

import { DefaultCatchBoundary } from '@/components/_default-catch-boundary';
import { Providers } from '@/components/providers';
import { StaleBundleWatcher } from '@/components/stale-bundle-watcher';
import { getFaviconHref, inferAppEnvironment } from '@/lib/app-env';
import { isClientAuthed } from '@/lib/auth/auth-snapshot';
import { getServerAuthToken } from '@/lib/convex/auth-start-token';
import { crpcServer } from '@/lib/convex/crpc-server';

import appCss from '../styles.css?url';

const Devtools = import.meta.env.DEV
	? lazy(async () => {
			const [{ TanStackDevtools }, { TanStackRouterDevtoolsPanel }] = await Promise.all([
				import('@tanstack/react-devtools'),
				import('@tanstack/react-router-devtools'),
			]);

			return {
				default: function DevtoolsPanel() {
					return (
						<TanStackDevtools
							config={{
								position: 'bottom-right',
							}}
							plugins={[
								{
									name: 'Tanstack Router',
									render: <TanStackRouterDevtoolsPanel />,
								},
							]}
						/>
					);
				},
			};
		})
	: null;

const Toaster = lazy(() => import('@/components/ui/sonner').then((m) => ({ default: m.Toaster })));

const getLoaderToken = createServerFn({ method: 'GET' }).handler(async () => {
	return await getServerAuthToken();
});

const getAppEnvironment = createServerFn({ method: 'GET' }).handler(() => {
	const request = getRequest();

	return inferAppEnvironment({
		hostname: new URL(request.url).hostname,
		isDev: import.meta.env.DEV,
	});
});

function getClientAppEnvironment() {
	if (typeof window === 'undefined') return null;

	return inferAppEnvironment({
		hostname: window.location.hostname,
		isDev: import.meta.env.DEV,
	});
}

export const Route = createRootRouteWithContext<{
	loaderToken?: string | null;
	isAuthenticated?: boolean;
	convexQueryClient: ConvexQueryClient;
	queryClient: QueryClient;
}>()({
	beforeLoad: async ({ context }) => {
		if (typeof window !== 'undefined') {
			// On the client `beforeLoad` runs on every navigation but can't read the
			// request cookie. Derive the auth signal from the client auth snapshot
			// (kept in sync by `<AuthSnapshotSync>`) so child `beforeLoad` gates
			// (`requireAuth`) work on client navigations too. We intentionally do NOT
			// refresh `loaderToken` here — it's an SSR-only value.
			return { isAuthenticated: isClientAuthed() };
		}

		const loaderToken = await getLoaderToken();

		if (loaderToken) {
			context.convexQueryClient.serverHttpClient?.setAuth(loaderToken);
			await context.queryClient
				.ensureQueryData(crpcServer.profile.findMyProfile.queryOptions({}, { skipUnauth: true }))
				.catch(() => undefined);
		}

		return {
			loaderToken,
			isAuthenticated: Boolean(loaderToken),
		};
	},
	loader: async ({ context }) => {
		return {
			appEnvironment: getClientAppEnvironment() ?? (await getAppEnvironment()),
			loaderToken: context.loaderToken ?? null,
		};
	},
	head: ({ loaderData }) => {
		const faviconHref = getFaviconHref(loaderData?.appEnvironment ?? 'production');

		return {
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
					rel: 'icon',
					href: '/favicon.ico',
					sizes: 'any',
				},
				{
					rel: 'icon',
					href: faviconHref,
					type: 'image/svg+xml',
				},
				{
					rel: 'stylesheet',
					href: appCss,
				},
			],
		};
	},
	component: RootComponent,
	errorComponent: DefaultCatchBoundary,
	notFoundComponent: () => <div>Not found</div>,
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
	return (
		<html lang='en' suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body>
				<ScriptOnce>
					{`document.documentElement.classList.toggle('dark', localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches))`}
				</ScriptOnce>
				{children}
				<StaleBundleWatcher />
				<Suspense fallback={null}>
					<Toaster closeButton richColors />
				</Suspense>
				{Devtools ? (
					<Suspense fallback={null}>
						<Devtools />
					</Suspense>
				) : null}
				<Scripts />
			</body>
		</html>
	);
}

function RootComponent() {
	const { convexQueryClient, loaderToken: contextLoaderToken } = Route.useRouteContext();
	const { appEnvironment, loaderToken } = Route.useLoaderData();
	const initialTokenRef = useRef<string | null | undefined>(loaderToken ?? contextLoaderToken);

	if (!initialTokenRef.current && (loaderToken || contextLoaderToken)) {
		initialTokenRef.current = loaderToken ?? contextLoaderToken;
	}

	return (
		<Providers
			appEnvironment={appEnvironment}
			convexQueryClient={convexQueryClient}
			initialToken={initialTokenRef.current}
		>
			<Outlet />
		</Providers>
	);
}
