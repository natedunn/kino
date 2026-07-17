import { Suspense, useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight, ChevronDown, FolderOpen, Lock, Plus, Settings } from 'lucide-react';

import { MainNav } from '@/components/site-nav/main-nav';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { requireAuth } from '@/lib/auth/require-auth';
import { useAuthLostRedirect } from '@/lib/auth/use-auth-lost';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { titleMeta } from '@/lib/seo';

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
	const orgs = orgsData?.teams ?? [];

	return (
		<div className='flex min-h-svh flex-col'>
			<MainNav context={{ type: 'global' }} isUserPending={false} user={user} />

			<main className='flex-1'>
				<div className='container py-10 md:py-14'>
					{/* Page header */}
					<div className='flex items-end justify-between'>
						<div>
							<h1 className='text-2xl font-bold tracking-tight'>Your teams</h1>
							<p className='mt-1 text-sm text-muted-foreground'>
								{orgs.length === 0
									? "You're not part of any teams yet."
									: `${orgs.length} team${orgs.length === 1 ? '' : 's'}`}
							</p>
						</div>
						{orgsData?.underLimit ? (
							<Button asChild size='sm'>
								<Link to='/create/team'>
									<Plus className='size-3.5' />
									New team
								</Link>
							</Button>
						) : null}
					</div>

					{/* Org list */}
					{orgs.length === 0 ? (
						<div className='mt-12 rounded-lg border border-dashed border-border p-12 text-center'>
							<FolderOpen className='mx-auto size-8 text-muted-foreground/60' />
							<h3 className='mt-4 text-sm font-medium'>No teams yet</h3>
							<p className='mt-1.5 text-sm text-muted-foreground'>
								Create a team to start organizing your projects.
							</p>
							<div className='mt-5'>
								<Button asChild size='sm'>
									<Link to='/create/team'>Create a team</Link>
								</Button>
							</div>
						</div>
					) : (
						<div className='mt-8 space-y-10'>
							{orgs.map((org) => (
								<OrgSection key={org.id} org={org} />
							))}
						</div>
					)}
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

function OrgSection({
	org,
}: {
	org: { id: string; name: string; slug: string; logo?: string | null };
}) {
	const [isExpanded, setIsExpanded] = useState(false);
	const projectsId = `org-projects-${org.slug}`;

	return (
		<section>
			{/* Org header */}
			<div className='flex items-center justify-between'>
				<Link to='/@{$org}' params={{ org: org.slug }} className='group flex items-center gap-3'>
					<Avatar className='size-8 border'>
						{org.logo ? <AvatarImage src={org.logo} /> : null}
						<AvatarFallback className='text-sm font-semibold'>
							{org.name[0]?.toUpperCase()}
						</AvatarFallback>
					</Avatar>
					<span className='font-semibold decoration-2 underline-offset-2 group-hover:underline'>
						{org.name}
					</span>
					<ArrowRight className='size-3.5 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100' />
				</Link>
				<div className='flex items-center gap-1'>
					<Button
						aria-controls={projectsId}
						aria-expanded={isExpanded}
						onClick={() => setIsExpanded((value) => !value)}
						type='button'
						variant='ghost'
						size='sm'
					>
						Projects
						<ChevronDown
							className={`size-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
						/>
					</Button>
					<Button asChild variant='ghost' size='sm'>
						<Link to='/org/settings/general' search={{ org: org.slug }}>
							<Settings className='size-3.5' />
							<span className='sr-only sm:not-sr-only'>Settings</span>
						</Link>
					</Button>
				</div>
			</div>

			{/* Projects */}
			{isExpanded ? (
				<div id={projectsId} className='mt-4'>
					<Suspense fallback={<ProjectsSkeleton />}>
						<OrgProjectsList orgSlug={org.slug} />
					</Suspense>
				</div>
			) : null}
		</section>
	);
}

function OrgProjectsList({ orgSlug }: { orgSlug: string }) {
	const crpc = useCRPC();
	const { data: projects } = useSuspenseQuery(
		crpc.project.getManyByOrg.queryOptions({
			limit: 24,
			orgSlug,
		})
	);

	if (!projects || projects.length === 0) {
		return (
			<div className='rounded-lg border border-dashed border-border px-6 py-8 text-center'>
				<p className='text-sm text-muted-foreground'>No projects yet</p>
				<Button asChild variant='ghost' size='sm' className='mt-2'>
					<Link to='/@{$org}/create-project' params={{ org: orgSlug }}>
						<Plus className='size-3.5' />
						Create project
					</Link>
				</Button>
			</div>
		);
	}

	return (
		<div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
			{projects.map((project) => (
				<Link
					key={project.id}
					to='/@{$org}/$project'
					params={{ org: orgSlug, project: project.slug }}
					className='group rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/20 hover:bg-accent/30'
				>
					<div className='flex items-start justify-between'>
						<h4 className='text-sm font-medium decoration-1 underline-offset-2 group-hover:underline'>
							{project.name}
						</h4>
						{project.visibility === 'private' ? (
							<Lock className='mt-0.5 size-3 shrink-0 text-muted-foreground' />
						) : null}
					</div>
					{project.description ? (
						<p className='mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground'>
							{project.description}
						</p>
					) : (
						<p className='mt-1.5 text-xs text-muted-foreground/60 italic'>No description</p>
					)}
				</Link>
			))}
			<Link
				to='/@{$org}/create-project'
				params={{ org: orgSlug }}
				className='flex items-center justify-center rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-accent/30 hover:text-foreground'
			>
				<Plus className='mr-1.5 size-3.5' />
				New project
			</Link>
		</div>
	);
}

function ProjectsSkeleton() {
	return (
		<div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
			{Array.from({ length: 3 }).map((_, i) => (
				<div key={i} className='rounded-lg border border-border p-4'>
					<Skeleton className='h-4 w-24' />
					<Skeleton className='mt-3 h-3 w-full' />
					<Skeleton className='mt-1.5 h-3 w-2/3' />
				</div>
			))}
		</div>
	);
}
