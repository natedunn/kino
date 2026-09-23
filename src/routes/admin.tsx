import { Suspense, useEffect, useState } from 'react';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Navigate, redirect } from '@tanstack/react-router';
import { Play, RotateCcw, ShieldAlert } from 'lucide-react';

import { AppShell } from '@/components/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { requireAuth } from '@/lib/auth/require-auth';
import { useAuthLostRedirect } from '@/lib/auth/use-auth-lost';
import {
	adminOperationsServer,
	operationalJobReference,
	useAdminOperationsAPI,
} from '@/lib/convex/admin-operations-api';
import { profileServer, useProfileAPI } from '@/lib/convex/profile-api';
import { localizeError } from '@/lib/errors';
import { titleMeta } from '@/lib/seo';
import { toast } from '@/lib/toast';

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
			profileServer.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
		);
		if (profile?.role !== 'system:admin') {
			throw redirect({ to: '/dashboard' });
		}
		await Promise.all([
			context.queryClient.ensureQueryData(
				adminOperationsServer.adminOperations.getSystemMetrics.queryOptions({})
			),
			context.queryClient.ensureQueryData(
				adminOperationsServer.adminOperations.list.queryOptions({})
			),
			context.queryClient.ensureQueryData(
				adminOperationsServer.adminOperations.listAlerts.queryOptions({})
			),
			context.queryClient.ensureQueryData(
				adminOperationsServer.adminOperations.listMaintenance.queryOptions({})
			),
		]);
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
	const api = useProfileAPI();
	const { data: profile } = useSuspenseQuery(
		api.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
	);

	// System-admin only. Anyone else is bounced to their dashboard.
	if (!profile || profile.role !== 'system:admin') {
		return <Navigate to='/dashboard' />;
	}

	return (
		<AppShell>
			<main className='flex-1'>
				<div className='container py-10 md:py-14'>
					<div>
						<h1 className='text-2xl font-bold tracking-tight'>System metrics</h1>
						<p className='mt-1 text-sm text-muted-foreground'>
							Platform-wide totals across all organizations.
						</p>
					</div>

					<Suspense fallback={<MetricsSkeleton />}>
						<NativeAdminMetrics />
					</Suspense>
					<Suspense fallback={<OperationsSkeleton />}>
						<AdminOperations />
					</Suspense>
				</div>
			</main>
		</AppShell>
	);
}

const jobLabels = {
	storage_cleanup: 'Storage cleanup',
	project_deletion: 'Project deletion',
	feedback_deletion: 'Feedback deletion',
	update_deletion: 'Update deletion',
	storage_project_purge: 'Project storage purge',
	board_deletion: 'Board deletion',
} as const;

function AdminOperations() {
	const api = useAdminOperationsAPI();
	const { data: jobs } = useSuspenseQuery(api.adminOperations.list.queryOptions({}));
	const { data: alerts } = useSuspenseQuery(api.adminOperations.listAlerts.queryOptions({}));
	const { data: maintenance } = useSuspenseQuery(
		api.adminOperations.listMaintenance.queryOptions({})
	);
	const now = useOperationalNow();
	const resume = useMutation(
		api.adminOperations.resume.mutationOptions({
			onSuccess: async () => toast.success('Job requeued.'),
			onError: async (error) => toast.error(localizeError(error, 'Unable to resume job.')),
		})
	);
	const startMaintenance = useMutation(
		api.adminOperations.startMaintenance.mutationOptions({
			onSuccess: async () => toast.success('Maintenance job started.'),
			onError: async (error) => toast.error(localizeError(error, 'Unable to start maintenance.')),
		})
	);
	const resumeMaintenance = useMutation(
		api.adminOperations.resumeMaintenance.mutationOptions({
			onSuccess: async () => toast.success('Maintenance job resumed.'),
			onError: async (error) => toast.error(localizeError(error, 'Unable to resume maintenance.')),
		})
	);

	return (
		<div className='mt-8 space-y-10'>
			<section>
				<div className='flex items-end justify-between gap-4'>
					<div>
						<h2 className='text-lg font-semibold'>Background jobs</h2>
						<p className='mt-1 text-sm text-muted-foreground'>
							Active, failed, and stalled deletion or storage work. The list updates live.
						</p>
					</div>
					<Badge
						variant={
							jobs.some(
								(job) =>
									operationalState(job, now) === 'failed' ||
									operationalState(job, now) === 'stalled'
							)
								? 'destructive'
								: 'secondary'
						}
					>
						{jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}
					</Badge>
				</div>

				{jobs.length === 0 ? (
					<div className='mt-4 rounded-lg border border-dashed border-border px-5 py-10 text-center'>
						<p className='text-sm font-medium'>No active operational jobs</p>
						<p className='mt-1 text-xs text-muted-foreground'>
							Failed or stalled work will appear here automatically.
						</p>
					</div>
				) : (
					<div className='mt-4 flex flex-col gap-2'>
						{jobs.map((job) => {
							const displayedState = operationalState(job, now);
							const resumable = displayedState === 'failed' || displayedState === 'stalled';
							return (
								<div
									key={`${job.kind}:${job.jobId}`}
									className='flex flex-col gap-3 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between'
								>
									<div className='min-w-0'>
										<div className='flex flex-wrap items-center gap-2'>
											<p className='text-sm font-medium'>{jobLabels[job.kind]}</p>
											<Badge
												variant={
													displayedState === 'failed' || displayedState === 'stalled'
														? 'destructive'
														: 'secondary'
												}
											>
												{displayedState}
											</Badge>
											{job.attempt !== null ? (
												<span className='text-xs text-muted-foreground'>
													attempt {job.attempt}/{job.maxAttempt}
												</span>
											) : null}
										</div>
										<p className='mt-1 truncate font-mono text-xs text-muted-foreground'>
											{job.targetId}
										</p>
										<p className='mt-1 text-xs text-muted-foreground'>
											Started {new Date(job.createdAt).toLocaleString()}
										</p>
										{job.lastError ? (
											<p className='mt-1 text-xs text-destructive'>{job.lastError}</p>
										) : null}
									</div>
									{resumable ? (
										<Button
											className='self-start sm:self-center'
											disabled={resume.isPending}
											onClick={() => resume.mutate(operationalJobReference(job))}
											size='sm'
											variant='outline'
										>
											<RotateCcw />
											Resume
										</Button>
									) : null}
								</div>
							);
						})}
					</div>
				)}
			</section>

			<section>
				<div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
					<div>
						<h2 className='text-lg font-semibold'>Aggregate maintenance</h2>
						<p className='mt-1 text-sm text-muted-foreground'>
							Audit derived counters first, then run the same bounded worker in repair mode.
						</p>
					</div>
					<div className='flex flex-wrap gap-2'>
						{(['feedback_upvotes', 'update_counts'] as const).flatMap((kind) => [
							<Button
								disabled={startMaintenance.isPending || hasActiveMaintenance(maintenance, kind)}
								key={`${kind}:preview`}
								onClick={() => startMaintenance.mutate({ kind, dryRun: true })}
								size='sm'
								variant='outline'
							>
								<Play /> Preview {maintenanceLabels[kind]}
							</Button>,
							<Button
								disabled={startMaintenance.isPending || hasActiveMaintenance(maintenance, kind)}
								key={`${kind}:repair`}
								onClick={() => startMaintenance.mutate({ kind, dryRun: false })}
								size='sm'
							>
								<RotateCcw /> Repair {maintenanceLabels[kind]}
							</Button>,
						])}
					</div>
				</div>
				<div className='mt-4 flex flex-col gap-2'>
					{maintenance.length === 0 ? (
						<p className='rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground'>
							No maintenance runs yet.
						</p>
					) : (
						maintenance.map((job) => {
							const stalled = job.status === 'running' && now >= job.updatedAt + 5 * 60_000;
							return (
								<div
									className='flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between'
									key={job._id}
								>
									<div>
										<div className='flex flex-wrap items-center gap-2'>
											<p className='text-sm font-medium'>{maintenanceLabels[job.kind]}</p>
											<Badge
												variant={job.status === 'failed' || stalled ? 'destructive' : 'secondary'}
											>
												{stalled ? 'stalled' : job.status}
											</Badge>
											<Badge variant='outline'>{job.dryRun ? 'preview' : 'repair'}</Badge>
										</div>
										<p className='mt-1 text-xs text-muted-foreground'>
											{job.checked} checked · {job.changed} drifted
										</p>
										{job.error ? (
											<p className='mt-1 text-xs text-destructive'>{job.error}</p>
										) : null}
									</div>
									{job.status === 'failed' || stalled ? (
										<Button
											disabled={resumeMaintenance.isPending}
											onClick={() => resumeMaintenance.mutate({ jobId: job._id })}
											size='sm'
											variant='outline'
										>
											<RotateCcw /> Resume
										</Button>
									) : null}
								</div>
							);
						})
					)}
				</div>
			</section>

			<section>
				<div className='flex items-center gap-2'>
					<ShieldAlert className='size-4' />
					<h2 className='text-lg font-semibold'>Operational alerts</h2>
				</div>
				<p className='mt-1 text-sm text-muted-foreground'>
					Failed and stalled jobs are deduplicated and delivered to the configured operator inbox.
				</p>
				<div className='mt-4 flex flex-col gap-2'>
					{alerts.length === 0 ? (
						<p className='rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground'>
							No operational alerts.
						</p>
					) : (
						alerts.map((alert) => (
							<div className='rounded-lg border px-4 py-3' key={alert._id}>
								<div className='flex flex-wrap items-center gap-2'>
									<p className='text-sm font-medium'>{jobLabels[alert.kind]}</p>
									<Badge variant={alert.resolvedAt ? 'secondary' : 'destructive'}>
										{alert.resolvedAt ? 'resolved' : alert.state}
									</Badge>
									<Badge variant='outline'>{alert.deliveryStatus}</Badge>
								</div>
								<p className='mt-1 truncate font-mono text-xs text-muted-foreground'>
									{alert.targetId}
								</p>
							</div>
						))
					)}
				</div>
			</section>
		</div>
	);
}

const maintenanceLabels = {
	feedback_upvotes: 'feedback votes',
	update_counts: 'update counts',
} as const;

function hasActiveMaintenance(
	jobs: Array<{ kind: keyof typeof maintenanceLabels; status: string }>,
	kind: keyof typeof maintenanceLabels
) {
	return jobs.some(
		(job) => job.kind === kind && (job.status === 'pending' || job.status === 'running')
	);
}

function operationalState(
	job: { staleAfter: number; state: 'failed' | 'pending' | 'running' },
	now: number
) {
	return job.state !== 'failed' && now >= job.staleAfter ? ('stalled' as const) : job.state;
}

function useOperationalNow() {
	const [now, setNow] = useState(0);
	useEffect(() => {
		const update = () => setNow(Date.now());
		update();
		const interval = window.setInterval(update, 30_000);
		return () => window.clearInterval(interval);
	}, []);
	return now;
}

function NativeAdminMetrics() {
	const api = useAdminOperationsAPI();
	const { data } = useSuspenseQuery(api.adminOperations.getSystemMetrics.queryOptions({}));
	return <MetricsContent data={data} />;
}

function MetricsContent({
	data,
}: {
	data: {
		counts: { users: number; organizations: number; projects: number; feedback: number };
		recentUsers: Array<{
			id: string;
			name: string | null;
			email: string | null;
			createdAt: number | null;
		}>;
	};
}) {
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

function OperationsSkeleton() {
	return (
		<div className='mt-8 space-y-2'>
			<Skeleton className='h-5 w-40' />
			{Array.from({ length: 3 }).map((_, i) => (
				<Skeleton key={i} className='h-20 w-full rounded-lg' />
			))}
		</div>
	);
}
