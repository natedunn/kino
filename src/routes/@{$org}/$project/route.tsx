import { createFileRoute, notFound, Outlet } from '@tanstack/react-router';

import { NotFound } from '@/components/_not-found';
import { getProjectForRoute } from '@/lib/convex/route-visibility-query';
import { projectTitle, titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/@{$org}/$project')({
	head: ({ params }) => ({
		meta: [titleMeta([projectTitle(params.org, params.project)])],
	}),
	loader: async ({ context, params }) => {
		const projectDetails = await getProjectForRoute(context.queryClient, params);
		if (!projectDetails?.project) throw notFound();
		return projectDetails;
	},
	component: ProjectRoute,
	notFoundComponent: () => (
		<div className='container'>
			<NotFound />
		</div>
	),
});

function ProjectRoute() {
	return <Outlet />;
}
