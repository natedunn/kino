import { Outlet, createFileRoute, notFound } from '@tanstack/react-router';

import { NotFound } from '@/components/_not-found';
import { crpcServer } from '@/lib/convex/crpc-server';
import { projectTitle, titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/@{$org}/$project')({
	head: ({ params }) => ({
		meta: [titleMeta([projectTitle(params.org, params.project)])],
	}),
	loader: async ({ context, params }) => {
		const projectDetails = await context.queryClient.ensureQueryData(
			crpcServer.project.getDetails.queryOptions({
				orgSlug: params.org,
				slug: params.project,
			})
		);

		if (!projectDetails?.project) {
			throw notFound();
		}
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
