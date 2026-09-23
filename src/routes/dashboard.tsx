import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';

import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { requireAuth } from '@/lib/auth/require-auth';
import { useAuthLostRedirect } from '@/lib/auth/use-auth-lost';
import { titleMeta } from '@/lib/seo';

import { api as nativeApi } from '../../convex/native/_generated/api';
import { DashboardFeed } from './-dashboard/dashboard-feed';
import { KinoNews } from './-dashboard/kino-news';
import { YourTeams } from './-dashboard/your-teams';

export const Route = createFileRoute('/dashboard')({
	head: () => ({
		meta: [titleMeta(['Dashboard'])],
	}),
	beforeLoad: ({ context, location }) => requireAuth(context, location),
	loader: async ({ context }) => {
		if (!context.loaderToken) {
			return;
		}

		await Promise.all([
			context.queryClient.ensureQueryData(convexQuery(nativeApi.profiles.me, {})),
			context.queryClient.ensureQueryData(
				convexQuery(nativeApi.organizations.listMineForRoute, {})
			),
		]);
	},
	component: DashboardPage,
});

function DashboardPage() {
	// Entry is gated in `beforeLoad` (requireAuth); this only catches auth lost
	// in place (sign-out), which `beforeLoad` can't see.
	const lost = useAuthLostRedirect();
	if (lost) return lost;
	return <NativeDashboard />;
}

function NativeDashboard() {
	// Warm the profile used by the shared navigation before it renders.
	useSuspenseQuery(convexQuery(nativeApi.profiles.me, {}));
	const { data: organizations } = useSuspenseQuery(
		convexQuery(nativeApi.organizations.listMineForRoute, {})
	);
	return <DashboardLayout teams={organizations.teams} underLimit={organizations.underLimit} />;
}

function DashboardLayout({
	teams,
	underLimit,
}: {
	teams: Parameters<typeof YourTeams>[0]['teams'];
	underLimit: boolean;
}) {
	return (
		<AppShell>
			<main className='flex flex-1 flex-col'>
				{/* Header band — the divider below it runs the full page width. */}
				<div className='border-b border-border'>
					<div className='container flex items-end justify-between py-8'>
						<div>
							<h1 className='text-2xl font-bold tracking-tight'>Dashboard</h1>
							<p className='mt-1 text-sm text-muted-foreground'>
								Updates from across all your projects.
							</p>
						</div>
						{underLimit ? (
							<Button asChild size='sm'>
								<Link to='/create/team'>
									<Plus className='size-3.5' />
									New team
								</Link>
							</Button>
						) : null}
					</div>
				</div>

				<div className='container flex flex-1 flex-col'>
					{/* Mirrors the Project Overview layout: the primary feed sits on the
					  left at md:col-span-8, with a secondary sidebar on the right
					  (order-last + border-l). */}
					<div className='flex flex-1 flex-col gap-8 md:grid md:grid-cols-12'>
						{/* Secondary context — right sidebar */}
						<aside className='order-last flex flex-col gap-6 py-8 md:col-span-4 md:border-l md:border-border/75 md:pl-8'>
							<YourTeams teams={teams} underLimit={underLimit} />
							<KinoNews />
						</aside>

						{/* Primary feed */}
						<div className='flex flex-col gap-4 py-8 md:col-span-8'>
							<DashboardFeed />
						</div>
					</div>
				</div>
			</main>
		</AppShell>
	);
}
