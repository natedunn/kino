import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { api } from '~api';
import { NotFound } from '@/components/_not-found';

import { CreateProjectForm } from './-create-project-form';

export const Route = createFileRoute('/@{$org}/create-project/')({
	component: RouteComponent,
	loader: async ({ context, params }) => {
		const orgDetails = await context.queryClient.ensureQueryData(
			convexQuery(api.org.getDetails, {
				slug: params.org,
			})
		);

		if (!orgDetails.permissions.canEdit) {
			throw notFound();
		}

		const limits = await context.queryClient.ensureQueryData(
			convexQuery(api.org.limits, {
				slug: params.org,
			})
		);

		return { limits };
	},
	notFoundComponent: () => <NotFound isContainer />,
});

function RouteComponent() {
	const { org: orgSlug } = Route.useParams();

	const { limits } = Route.useLoaderData();

	if (!limits) return null;

	const { data: orgDetails } = useSuspenseQuery(
		convexQuery(api.org.getDetails, {
			slug: orgSlug,
		})
	);

	if (!orgDetails.org) return null;

	const { org } = orgDetails;

	return (
		<div className='flex flex-auto flex-col'>
			<div className='container flex flex-auto flex-col'>
				<CreateProjectForm enabled={limits.canAddProjects} orgSlug={org.slug} orgName={org.name} />
			</div>
		</div>
	);
}
