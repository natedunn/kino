import { convexQuery } from '@convex-dev/react-query';
import { createFileRoute, notFound, Outlet } from '@tanstack/react-router';

import { NotFound } from '@/components/_not-found';
import { projectTitle, titleMeta } from '@/lib/seo';

import { api as nativeApi } from '../../../../convex/native/_generated/api';

export const Route = createFileRoute('/@{$org}/$project')({
	head: ({ params }) => ({
		meta: [titleMeta([projectTitle(params.org, params.project)])],
	}),
	loader: async ({ context, params }) => {
		const projectDetails = await context.queryClient.ensureQueryData(
			convexQuery(nativeApi.projects.getBySlugs, {
				organizationSlug: params.org,
				projectSlug: params.project,
			})
		);
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
