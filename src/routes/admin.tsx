import { Suspense } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link, Navigate, createFileRoute, redirect } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { requireAuth } from '@/lib/auth/require-auth';
import { useAuthLostRedirect } from '@/lib/auth/use-auth-lost';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/admin')({
	head: () => ({
		meta: [titleMeta(['Admin'])],
	}),
	beforeLoad: async ({ context, location }) => {
		requireAuth(context, location);
		// System-admin only. On the server we can resolve the role up front and
		// bounce non-admins before anything renders. On client navigations
		// (no `loaderToken`) this falls open and the component's `<Navigate>` guard
		// handles it. Server procedures remain the real boundary regardless.
		if (!context.loaderToken) return;
		const profile = await context.queryClient.ensureQueryData(
			crpcServer.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
		);
		if (profile?.role !== 'system:admin') {
			throw redirect({ to: '/dashboard' });
		}
	},
	component: AdminPage,
});

function AdminPage() {
	// Entry is gated in `beforeLoad` (requireAuth); this only catches auth lost
	// in place (sign-out), which `beforeLoad` can't see.
	const lost = useAuthLostRedirect();
	if (lost) return lost;

	return <AuthedAdmin />;
}

function AuthedAdmin() {
	const crpc = useCRPC();
	const { data: profile } = useSuspenseQuery(
		crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
	);

	// System-admin only. Anyone else is bounced to their dashboard.
	if (!profile || profile.role !== 'system:admin') {
		return <Navigate to='/dashboard' />;
	}

	return (
		<div className='flex min-h-svh flex-col'>
			<header className='border-b border-border/50 bg-background dark:bg-absolute'>
				<div className='container flex items-center justify-between py-3'>
					<Link to='/dashboard' className='flex items-center gap-2.5'>
						<div className='flex h-7 w-7 items-center justify-center rounded-full bg-primary'>
							<span className='text-xs font-bold text-primary-foreground'>K</span>
						</div>
						<span className='text-sm font-semibold tracking-tight'>Kino Admin</span>
					</Link>
					<Link
						to='/dashboard'
						className='flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground'
					>
						<ArrowLeft className='size-3.5' />
						Back to dashboard
					</Link>
				</div>
			</header>

			<main className='flex-1'>
				<div className='container py-10 md:py-14'>
					<div>
						<h1 className='text-2xl font-bold tracking-tight'>System metrics</h1>
						<p className='mt-1 text-sm text-muted-foreground'>
							Platform-wide totals across all organizations.
						</p>
					</div>

					<Suspense fallback={<MetricsSkeleton />}>
						<AdminMetrics />
					</Suspense>
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

function AdminMetrics() {
	const crpc = useCRPC();
	const { data } = useSuspenseQuery(crpc.admin.getSystemMetrics.queryOptions({}));

	const stats = [
		{ label: 'Users', value: data.counts.users },
		{ label: 'Organizations', value: data.counts.organizations },
		{ label: 'Projects', value: data.counts.projects },
		{ label: 'Feedback', value: data.counts.feedback },
	];

	return (
		<div className='mt-8 space-y-10'>
			<div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
				{stats.map((stat) => (
					<div key={stat.label} className='rounded-lg border border-border bg-card p-5'>
						<p className='text-2xl font-bold tracking-tight'>{stat.value.toLocaleString()}</p>
						<p className='mt-1 text-sm text-muted-foreground'>{stat.label}</p>
					</div>
				))}
			</div>

			<section>
				<h2 className='text-lg font-semibold'>Recent sign-ups</h2>
				<div className='mt-4 flex flex-col gap-2'>
					{data.recentUsers.length === 0 ? (
						<p className='text-sm text-muted-foreground'>No users yet.</p>
					) : (
						data.recentUsers.map((user) => (
							<div
								key={user.id}
								className='flex items-center justify-between rounded-lg border border-border px-4 py-2.5'
							>
								<div className='min-w-0'>
									<p className='truncate text-sm font-medium'>{user.name ?? 'Unnamed'}</p>
									<p className='truncate text-xs text-muted-foreground'>{user.email ?? '—'}</p>
								</div>
								{user.createdAt ? (
									<span className='shrink-0 text-xs text-muted-foreground'>
										{new Date(user.createdAt).toLocaleDateString()}
									</span>
								) : null}
							</div>
						))
					)}
				</div>
			</section>
		</div>
	);
}

function MetricsSkeleton() {
	return (
		<div className='mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4'>
			{Array.from({ length: 4 }).map((_, i) => (
				<div key={i} className='rounded-lg border border-border p-5'>
					<Skeleton className='h-7 w-16' />
					<Skeleton className='mt-2 h-3 w-20' />
				</div>
			))}
		</div>
	);
}
