import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { projectTitle, titleMeta } from '@/lib/seo';

import { api as nativeApi } from '../../../../convex/native/_generated/api';
import { OverviewActivity } from './-components/overview-activity';
import { OverviewHeader } from './-components/overview-header';
import { OverviewRecentUpdates } from './-components/overview-recent-updates';
import { OverviewStats } from './-components/overview-stats';
import { OverviewTeam } from './-components/overview-team';

export const Route = createFileRoute('/@{$org}/$project/')({
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
	return (
		<ProjectOverview
			project={data?.project}
			params={params}
			canEditSettings={data?.permissions.canEditSettings ?? false}
			canManageAccess={data?.permissions.canManageAccess ?? false}
		/>
	);
}

function ProjectOverview({
	project,
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
	params: { org: string; project: string };
	canEditSettings: boolean;
	canManageAccess: boolean;
}) {
	return (
		<div className='container flex flex-1 flex-col'>
			{/* Header + KPIs span the full width above the feed. */}
			<div className='flex flex-col gap-6 py-8'>
				{project && <OverviewHeader project={project} params={params} canEdit={canEditSettings} />}
				<OverviewStats />
			</div>

			{/* Mirrors the Feedback detail layout: the primary feed sits on the left
          at md:col-span-8 (same side + width as the comment thread), with a
          secondary sidebar on the right (order-last + border-l). */}
			<div className='flex flex-1 flex-col gap-8 border-t md:grid md:grid-cols-12'>
				{/* Secondary context — right sidebar */}
				<aside className='order-last flex flex-col gap-6 py-8 md:col-span-4 md:border-l md:border-border/75 md:pl-8'>
					<OverviewTeam params={params} canEdit={canManageAccess} />
					<OverviewRecentUpdates params={params} />
				</aside>

				{/* Primary feed — activity */}
				<div className='flex flex-col gap-4 py-8 md:col-span-8'>
					<OverviewActivity />
				</div>
			</div>
		</div>
	);
}
