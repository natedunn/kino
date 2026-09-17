import { createFileRoute, Outlet } from '@tanstack/react-router';

import { AppShell } from '@/components/app-shell';

/**
 * Pathless layout for the public marketing pages. Copy on these pages is a
 * deliberately deferred placeholder surface (like the landing page) and is
 * not yet in the translation catalogs — see docs/marketing-site.md.
 */
export const Route = createFileRoute('/_marketing')({
	component: MarketingLayout,
});

function MarketingLayout() {
	return (
		<AppShell>
			<main className='flex flex-1 flex-col'>
				<Outlet />
			</main>
		</AppShell>
	);
}
