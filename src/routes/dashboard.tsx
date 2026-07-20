import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';

import { MainNav } from '@/components/site-nav/main-nav';
import { Button } from '@/components/ui/button';
import { requireAuth } from '@/lib/auth/require-auth';
import { useAuthLostRedirect } from '@/lib/auth/use-auth-lost';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { titleMeta } from '@/lib/seo';

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
			context.queryClient.ensureQueryData(
				crpcServer.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
			),
			context.queryClient.ensureQueryData(
				crpcServer.org.findMyOrgs.queryOptions({}, { skipUnauth: true })
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

	return <AuthenticatedDashboard />;
}

function AuthenticatedDashboard() {
	const crpc = useCRPC();
	const { data: user } = useSuspenseQuery(
		crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
	);
	const { data: orgsData } = useSuspenseQuery(
		crpc.org.findMyOrgs.queryOptions({}, { skipUnauth: true })
	);
	const teams = orgsData.teams;

	return (
		<div className='flex min-h-svh flex-col'>
			<MainNav context={{ type: 'global' }} isUserPending={false} user={user} />

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
						{orgsData.underLimit ? (
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
							<YourTeams teams={teams} underLimit={orgsData.underLimit} />
							<KinoNews />
						</aside>

						{/* Primary feed */}
						<div className='flex flex-col gap-4 py-8 md:col-span-8'>
							<DashboardFeed />
						</div>
					</div>
				</div>
			</main>

			<footer className='mt-auto border-t border-border py-4 text-center text-sm text-muted-foreground'>
				<div className='container'>
					<p>&copy; {new Date().getFullYear()} Kino</p>
				</div>
			</footer>
		</div>
	);
}
