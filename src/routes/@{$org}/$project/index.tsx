import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';


import { OverviewActivity } from './-components/overview-activity';
import { OverviewHeader } from './-components/overview-header';
import { OverviewRecentUpdates } from './-components/overview-recent-updates';
import { OverviewStats } from './-components/overview-stats';
import { OverviewTeam } from './-components/overview-team';
import { projectTitle, titleMeta } from '@/lib/seo';
import { useCRPC } from '@/lib/convex/crpc';

export const Route = createFileRoute('/@{$org}/$project/')({
	head: ({ params }) => ({
		meta: [titleMeta([projectTitle(params.org, params.project)])],
	}),
	component: ProjectIndexRoute,
});

function ProjectIndexRoute() {
	const params = Route.useParams();
	const crpc = useCRPC();

	// The parent `$project` route loader already ensured this query, so it reads
	// warm from cache with no loading flash. Only the header binds to this real
	// data — every dashboard section below is a static draft (mock data).
	const projectQuery = useQuery(
		crpc.project.getDetails.queryOptions(
			{ orgSlug: params.org, slug: params.project },
			{ subscribe: false }
		)
	);

	const project = projectQuery.data?.project;
	const canEdit = projectQuery.data?.permissions.canEdit ?? false;

	return (
		<div className='container flex flex-1 flex-col'>
			{/* Header + KPIs span the full width above the feed. */}
			<div className='flex flex-col gap-6 py-8'>
				{project && <OverviewHeader project={project} params={params} canEdit={canEdit} />}
				<OverviewStats />
			</div>

			{/* Mirrors the Feedback detail layout: the primary feed sits on the left
          at md:col-span-8 (same side + width as the comment thread), with a
          secondary sidebar on the right (order-last + border-l). */}
			<div className='flex flex-1 flex-col gap-8 border-t md:grid md:grid-cols-12'>
				{/* Secondary context — right sidebar */}
				<aside className='order-last flex flex-col gap-6 py-8 md:col-span-4 md:border-l md:border-border/75 md:pl-8'>
					<OverviewTeam params={params} canEdit={canEdit} />
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
