'use client';

import { createFileRoute, Outlet } from '@tanstack/react-router';

import { AuthBackground } from '@/components/auth/auth-background';
import { titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/auth')({
	head: () => ({
		meta: [titleMeta(['Sign in'])],
	}),
	component: AuthLayout,
});

/**
 * Resolve a safe in-app redirect target after authentication. Avoids bouncing
 * back to the auth page or the public landing page, and rejects off-site URLs.
 * Exported for unit testing (see routes/-auth.test.ts).
 */
export function getSafeRedirectTarget(redirect: string | undefined) {
	if (!redirect) {
		return '/dashboard';
	}

	try {
		const resolved = new URL(redirect, 'https://usekino.com');
		if (resolved.pathname === '/auth' || resolved.pathname === '/') {
			return '/dashboard';
		}
		return `${resolved.pathname}${resolved.search}${resolved.hash}`;
	} catch {
		return '/dashboard';
	}
}

function AuthLayout() {
	return (
		<div className='relative flex min-h-svh flex-col sm:items-center sm:justify-center sm:px-6 sm:py-16'>
			<AuthBackground />
			{/* The shared card box. Mobile: full-bleed — flush to every edge, no
          border/radius/shadow. sm+: a centered, rounded, shadowed card. */}
			<main className='relative z-10 flex w-full grow flex-col justify-center bg-card p-6 sm:max-w-md sm:grow-0 sm:rounded-xl sm:border sm:border-border sm:p-8 sm:shadow-[0_1px_2px_-1px_rgb(0_0_0/0.04),0_4px_8px_-2px_rgb(0_0_0/0.06),0_16px_32px_-8px_rgb(0_0_0/0.10),0_32px_56px_-16px_rgb(0_0_0/0.12)] dark:sm:shadow-[0_2px_4px_-1px_rgb(0_0_0/0.4),0_16px_36px_-8px_rgb(0_0_0/0.55)]'>
				<Outlet />
			</main>
		</div>
	);
}
