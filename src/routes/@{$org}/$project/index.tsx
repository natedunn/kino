import type { Id } from '../../../../convex/native/_generated/dataModel';
import type { ProjectOverviewData } from './-overview-types';

import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, notFound } from '@tanstack/react-router';

import {
	getProjectForRoute,
	getProjectOverviewForRoute,
} from '@/lib/convex/route-visibility-query';
import { projectTitle, titleMeta } from '@/lib/seo';

import { api as nativeApi } from '../../../../convex/native/_generated/api';
import { OverviewActivity } from './-components/overview-activity';
import { OverviewHeader } from './-components/overview-header';
import { OverviewRecentUpdates } from './-components/overview-recent-updates';
import { OverviewStats } from './-components/overview-stats';
import { OverviewTeam } from './-components/overview-team';

export const Route = createFileRoute('/@{$org}/$project/')({
	loader: async ({ context, params }) => {
		const data = await getProjectForRoute(context.queryClient, params);
		if (!data?.project) throw notFound();
		await getProjectOverviewForRoute(context.queryClient, data.project.id);
	},
	head: ({ params }) => ({
		meta: [titleMeta([projectTitle(params.org, params.project)])],
	}),
	component: ProjectIndexRoute,
});

function ProjectIndexRoute() {
	return <NativeProjectIndexRoute />;
}

function NativeProjectIndexRoute() {
	const params = Route.useParams();
	const { data } = useSuspenseQuery(
		convexQuery(nativeApi.projects.getBySlugs, {
			organizationSlug: params.org,
			projectSlug: params.project,
		})
	);
	if (!data?.project) throw notFound();
	return (
		<NativeProjectOverview project={data.project} permissions={data.permissions} params={params} />
	);
}

function NativeProjectOverview({
	project,
	permissions,
	params,
}: {
	project: {
		id: Id<'projects'>;
		name: string;
		description?: string | null;
		visibility: 'public' | 'private' | 'archived';
		logoUrl?: string | null;
		urls?: Array<{ url: string; text: string }> | null;
		updatedTime?: number | null;
		createdAt?: number;
	};
	permissions: { canEditSettings: boolean; canManageAccess: boolean };
	params: { org: string; project: string };
}) {
	const { data: overview } = useSuspenseQuery(
		convexQuery(nativeApi.projectOverview.get, { projectId: project.id })
	);
	if (!overview) throw notFound();
	return (
		<ProjectOverview
			project={project}
			overview={overview}
			params={params}
			canEditSettings={permissions.canEditSettings}
			canManageAccess={permissions.canManageAccess}
		/>
	);
}

function ProjectOverview({
	project,
	overview,
	params,
	canEditSettings,
	canManageAccess,
}: {
	project?: {
		name: string;
		description?: string | null;
		visibility: 'public' | 'private' | 'archived';
		logoUrl?: string | null;
		urls?: Array<{ url: string; text: string }> | null;
		updatedTime?: number | null;
		createdAt?: number;
	} | null;
	overview: ProjectOverviewData;
	params: { org: string; project: string };
	canEditSettings: boolean;
	canManageAccess: boolean;
}) {
	return (
		<div className='container flex flex-1 flex-col'>
			{/* Header + KPIs span the full width above the feed. */}
			<div className='flex flex-col gap-6 py-8'>
				{project && <OverviewHeader project={project} params={params} canEdit={canEditSettings} />}
				<OverviewStats stats={overview.stats} />
			</div>

			{/* Mirrors the Feedback detail layout: the primary feed sits on the left
          at md:col-span-8 (same side + width as the comment thread), with a
          secondary sidebar on the right (order-last + border-l). */}
			<div className='flex flex-1 flex-col gap-8 border-t md:grid md:grid-cols-12'>
				{/* Secondary context — right sidebar */}
				<aside className='order-last flex flex-col gap-6 py-8 md:col-span-4 md:border-l md:border-border/75 md:pl-8'>
					<OverviewTeam
						params={params}
						canEdit={canManageAccess}
						members={overview.members}
						memberCount={overview.stats.members}
					/>
					<OverviewRecentUpdates params={params} updates={overview.recentUpdates} />
				</aside>

				{/* Primary feed — activity */}
				<div className='flex flex-col gap-4 py-8 md:col-span-8'>
					<OverviewActivity activity={overview.activity} />
				</div>
			</div>
		</div>
	);
}
