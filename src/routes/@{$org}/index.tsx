import type { FunctionReturnType } from 'convex/server';

import { convexQuery } from '@convex-dev/react-query';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
	Activity,
	ArrowRight,
	Clock,
	FolderOpen,
	Globe,
	Lock,
	Settings,
	Users,
} from 'lucide-react';

import { EmptyState } from '@/components/kino/common';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { titleFromSlug, titleMeta } from '@/lib/seo';
import * as m from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';

import { api as nativeApi } from '../../../convex/native/_generated/api';
import { NoPublicProjects } from './-components/no-public-projects';
import { OrgProjects } from './-components/org-projects';

type OverviewOrganization = NonNullable<
	FunctionReturnType<typeof nativeApi.organizations.getBySlug>
>;
type OverviewProject = FunctionReturnType<typeof nativeApi.projects.listByOrganization>[number];
type OverviewMember = FunctionReturnType<
	typeof nativeApi.organizations.listMembers
>['members'][number];
type OverviewSummary = NonNullable<FunctionReturnType<typeof nativeApi.organizationOverview.get>>;

export const Route = createFileRoute('/@{$org}/')({
	head: ({ params }) => ({
		meta: [titleMeta([titleFromSlug(params.org)])],
	}),
	loader: async ({ context, params }) => {
		const organization = await context.queryClient.ensureQueryData(
			convexQuery(nativeApi.organizations.getBySlug, { slug: params.org })
		);
		await Promise.all([
			context.queryClient.ensureQueryData(convexQuery(nativeApi.organizations.listMine, {})),
			organization
				? context.queryClient.ensureQueryData(
						convexQuery(nativeApi.projects.listByOrganization, {
							organizationId: organization.id,
						})
					)
				: Promise.resolve(),
			organization
				? context.queryClient.ensureQueryData(
						convexQuery(nativeApi.organizationOverview.get, { organizationId: organization.id })
					)
				: Promise.resolve(),
		]);
		if (organization?.permissions.canManageMembers) {
			await Promise.all([
				context.queryClient.ensureQueryData(
					convexQuery(nativeApi.organizations.listMembers, {
						organizationId: organization.id,
					})
				),
				context.queryClient.ensureQueryData(
					convexQuery(nativeApi.invitations.listPending, {
						organizationId: organization.id,
					})
				),
			]);
		}
	},
	component: OrganizationRoute,
});

function OrganizationRoute() {
	return <NativeOrganizationRoute />;
}

function NativeOrganizationRoute() {
	const params = Route.useParams();
	const { data: organization } = useSuspenseQuery(
		convexQuery(nativeApi.organizations.getBySlug, { slug: params.org })
	);
	if (!organization) {
		return (
			<div className='container py-10'>
				<EmptyState
					title={m.org_members_unavailable()}
					description={m.org_members_unavailable_description()}
				/>
			</div>
		);
	}
	return <NativeOrganizationContent organization={organization} />;
}

function NativeOrganizationContent({
	organization,
}: {
	organization: NonNullable<FunctionReturnType<typeof nativeApi.organizations.getBySlug>>;
}) {
	const { data: projects } = useSuspenseQuery(
		convexQuery(nativeApi.projects.listByOrganization, { organizationId: organization.id })
	);
	const { data: summary } = useSuspenseQuery(
		convexQuery(nativeApi.organizationOverview.get, { organizationId: organization.id })
	);
	const { data: creationPermission } = useQuery(
		convexQuery(nativeApi.policy.getMyProjectCreationPermission, { orgSlug: organization.slug })
	);
	const { data: memberData } = useQuery({
		...convexQuery(nativeApi.organizations.listMembers, { organizationId: organization.id }),
		enabled: organization.permissions.canManageMembers,
	});
	return (
		<OrganizationOverview
			organization={organization}
			projects={projects}
			summary={summary}
			members={organization.permissions.canManageMembers ? (memberData?.members ?? []) : []}
			orgSlug={organization.slug}
			canCreate={organization.permissions.canCreateProjects}
			canEdit={organization.permissions.canEdit}
			canManageMembers={organization.permissions.canManageMembers}
			canAddProjects={creationPermission?.canAddProjects ?? false}
		/>
	);
}

function OrganizationOverview({
	organization,
	projects,
	summary,
	members,
	orgSlug,
	canCreate,
	canEdit,
	canManageMembers,
	canAddProjects,
}: {
	organization: OverviewOrganization;
	projects: Array<OverviewProject>;
	summary: OverviewSummary | null;
	members: Array<OverviewMember>;
	orgSlug: string;
	canCreate: boolean;
	canEdit: boolean;
	canManageMembers: boolean;
	canAddProjects: boolean;
}) {
	const isPublic = organization.visibility === 'public';
	const numberFormatter = new Intl.NumberFormat(getLocale());
	const memberCount = summary?.memberCount;
	const projectHistory = [...projects].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

	return (
		<div>
			{/* ── Hero ──────────────────────────────────────────── */}
			<div className='relative overflow-hidden border-b bg-card'>
				{/* Subtle dot-grid background */}
				<div
					aria-hidden='true'
					className='pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.06]'
					style={{
						backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
						backgroundSize: '24px 24px',
					}}
				/>
				{/* Primary glow in top-right */}
				<div
					aria-hidden='true'
					className='pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl'
				/>

				<div className='relative container py-12'>
					<div className='flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between'>
						<div className='flex items-center gap-5'>
							{/* Org avatar */}
							<div className='relative shrink-0'>
								<Avatar
									className='h-16 w-16 rounded-full shadow-lg shadow-primary/20 md:h-20 md:w-20'
									fallbackAnimate='always'
									fallbackKind='org-initial'
									fallbackName={organization.slug}
								>
									<AvatarImage alt={organization.name} src={organization.logo ?? undefined} />
									<AvatarFallback />
								</Avatar>
								{/* Online dot */}
								<span className='absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full bg-background'>
									<span className='h-2.5 w-2.5 rounded-full bg-green-500' />
								</span>
							</div>

							<div className='flex flex-col gap-1.5'>
								<div className='flex flex-wrap items-center gap-2.5'>
									<h1 className='text-2xl font-bold tracking-tight md:text-3xl'>
										{organization.name}
									</h1>
									<Badge variant='outline' className='gap-1 text-xs'>
										{isPublic ? <Globe className='size-3' /> : <Lock className='size-3' />}
										{isPublic ? m.project_overview_public() : m.project_overview_private()}
									</Badge>
								</div>
								<p className='text-sm text-muted-foreground'>{m.org_overview_description()}</p>
								<div className='mt-1 flex flex-wrap items-center gap-4 text-sm text-muted-foreground'>
									<span className='flex items-center gap-1.5'>
										<Users className='size-3.5' />
										{memberCount === undefined
											? m.org_overview_count_unavailable()
											: m.org_overview_member_count({ count: numberFormatter.format(memberCount) })}
									</span>
									<span className='flex items-center gap-1.5'>
										<FolderOpen className='size-3.5' />
										{m.org_overview_project_count({
											count: numberFormatter.format(projects.length),
										})}
									</span>
								</div>
							</div>
						</div>

						{canEdit ? (
							<Button asChild variant='outline' className='shrink-0 self-start'>
								<Link search={{ org: orgSlug }} to='/org/settings'>
									<Settings className='size-4' />
									{m.project_overview_settings()}
								</Link>
							</Button>
						) : null}
					</div>
				</div>
			</div>

			{/* ── Stats bar ─────────────────────────────────────── */}
			{projects.length > 0 && (
				<div className='border-b bg-muted/40'>
					<div className='container'>
						<div className='flex divide-x divide-border overflow-x-auto'>
							<StatCell
								icon={<FolderOpen className='size-4 text-primary' />}
								value={numberFormatter.format(projects.length)}
								label={m.org_overview_visible_projects()}
							/>
							<StatCell
								icon={<Users className='size-4 text-violet-500' />}
								value={memberCount === undefined ? '—' : numberFormatter.format(memberCount)}
								label={m.org_overview_team_members()}
							/>
						</div>
					</div>
				</div>
			)}

			{/* ── Body ──────────────────────────────────────────── */}
			<div className='container py-10'>
				{projects.length === 0 ? (
					<NoPublicProjects canCreate={canCreate} orgName={organization.name} orgSlug={orgSlug} />
				) : (
					<div className='grid grid-cols-1 gap-10 md:grid-cols-12'>
						{/* ── Projects ───────────────────────────────── */}
						<section className='col-span-1 md:col-span-8'>
							<div className='mb-5 flex items-center justify-between'>
								<h2 className='text-lg font-semibold'>{m.org_overview_projects()}</h2>
								{canCreate && canAddProjects ? (
									<Link
										className='inline-flex items-center gap-1 text-sm text-primary underline decoration-primary/40 decoration-2 underline-offset-2 hover:decoration-primary/70'
										params={{ org: orgSlug }}
										to='/@{$org}/create-project'
									>
										{m.org_overview_new_project()}
										<ArrowRight className='size-3.5' />
									</Link>
								) : null}
							</div>
							<OrgProjects orgSlug={orgSlug} projects={projects} />
						</section>

						{/* ── Sidebar ────────────────────────────────── */}
						<aside className='col-span-1 flex flex-col gap-8 md:col-span-4'>
							{/* Members */}
							<div>
								<div className='mb-4 flex items-center justify-between'>
									<h2 className='text-lg font-semibold'>{m.project_overview_members()}</h2>
									{canManageMembers ? (
										<Link
											className='text-sm text-primary underline decoration-primary/40 decoration-2 underline-offset-2 hover:decoration-primary/70'
											search={{ org: orgSlug }}
											to='/org/settings/members'
										>
											{m.project_overview_manage()}
										</Link>
									) : (
										<span className='text-sm text-muted-foreground'>
											{memberCount === undefined
												? m.org_overview_count_unavailable()
												: m.org_overview_total_count({
														count: numberFormatter.format(memberCount),
													})}
										</span>
									)}
								</div>
								{members.length === 0 ? (
									<p className='text-sm text-muted-foreground'>
										{memberCount === 0
											? m.project_overview_no_members()
											: m.org_overview_roster_restricted()}
									</p>
								) : (
									<div className='flex flex-col gap-2'>
										{members.slice(0, 5).map((member) => (
											<div key={member.id} className='flex items-center gap-3 rounded-lg px-1 py-1'>
												<Avatar className='size-8 shrink-0' fallbackName={member.user.username}>
													{member.user.image ? (
														<AvatarImage
															alt={member.user.name || member.user.username || member.user.email}
															src={member.user.image}
														/>
													) : null}
													<AvatarFallback />
												</Avatar>
												<div className='flex min-w-0 flex-1 items-center justify-between gap-2'>
													<span className='truncate text-sm font-medium'>{member.user.name}</span>
													<Badge
														variant='outline'
														className='shrink-0 text-[10px] text-muted-foreground capitalize'
													>
														{m[`project_overview_${member.role}`]()}
													</Badge>
												</div>
											</div>
										))}
										{members.length > 5 && canManageMembers ? (
											<Link
												className='mt-1 text-left text-sm text-muted-foreground transition-colors hover:text-foreground'
												search={{ org: orgSlug }}
												to='/org/settings/members'
											>
												{m.project_overview_more_members({
													count: numberFormatter.format(members.length - 5),
												})}
											</Link>
										) : members.length > 5 ? (
											<span className='mt-1 text-sm text-muted-foreground'>
												{m.project_overview_more_members({
													count: numberFormatter.format(members.length - 5),
												})}
											</span>
										) : null}
									</div>
								)}
							</div>

							{/* History of projects shown on this page */}
							<div>
								<div className='mb-4 flex items-center gap-2'>
									<h2 className='text-lg font-semibold'>{m.org_overview_project_history()}</h2>
									<Activity className='size-4 text-muted-foreground' />
								</div>
								{projectHistory.length > 0 && (
									<div className='relative flex flex-col gap-0'>
										<div className='absolute top-0 bottom-0 left-[7px] w-px bg-border' />
										{projectHistory.map((project) => (
											<div key={project.id} className='relative flex gap-4 pb-5 last:pb-0'>
												<div className='relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full bg-primary ring-2 ring-background' />
												<div className='flex min-w-0 flex-col gap-0.5'>
													<span className='text-sm leading-snug font-medium'>
														{m.org_overview_project_created()}
													</span>
													<Link
														className='truncate text-xs text-primary hover:underline'
														params={{ org: orgSlug, project: project.slug }}
														to='/@{$org}/$project'
													>
														{project.name}
													</Link>
													<span className='flex items-center gap-1 text-[11px] text-muted-foreground/60'>
														<Clock className='size-2.5' />
														{new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium' }).format(
															project.createdAt
														)}
													</span>
												</div>
											</div>
										))}
									</div>
								)}
								{projectHistory.length === 0 && (
									<p className='text-sm text-muted-foreground'>
										{m.org_overview_no_project_history()}
									</p>
								)}
							</div>
						</aside>
					</div>
				)}
			</div>
		</div>
	);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type StatCellProps = {
	icon: React.ReactNode;
	value: string;
	label: string;
};

function StatCell({ icon, value, label }: StatCellProps) {
	return (
		<div className='flex min-w-[120px] flex-1 flex-col gap-1 px-6 py-4'>
			<div className='flex items-center gap-2'>
				{icon}
				<span className='text-gradient-primary text-2xl font-bold'>{value}</span>
			</div>
			<span className='text-xs text-muted-foreground'>{label}</span>
		</div>
	);
}
