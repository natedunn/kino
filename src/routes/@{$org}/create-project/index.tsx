import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { api } from '~api';
import { NotFound } from '@/components/_not-found';
import { RoutePending } from '@/components/route-pending';

import { CreateProjectForm } from './-create-project-form';

export const Route = createFileRoute('/@{$org}/create-project/')({
	component: RouteComponent,
	pendingComponent: () => <RoutePending variant='form' />,
	pendingMs: 150,
	loader: async ({ context, params }) => {
		const orgDetails = await context.queryClient.ensureQueryData(
			convexQuery(api.org.getDetails, {
				slug: params.org,
			})
		);

		if (!orgDetails?.org || !orgDetails.permissions.canEdit) {
			throw notFound();
		}

		await context.queryClient.ensureQueryData(
			convexQuery(api.org.getMyPermission, {
				slug: params.org,
			})
		);
	},
	notFoundComponent: () => <NotFound isContainer />,
});

function RouteComponent() {
	const { org: orgSlug } = Route.useParams();

	const { data: orgDetails } = useSuspenseQuery(
		convexQuery(api.org.getDetails, {
			slug: orgSlug,
		})
	);

	const { data: limits } = useSuspenseQuery(
		convexQuery(api.org.getMyPermission, {
			slug: orgSlug,
		})
	);

	if (!orgDetails.permissions.canEdit) {
		throw notFound();
	}

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
