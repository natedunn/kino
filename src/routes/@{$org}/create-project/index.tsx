import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { api } from '~api';
import { NotFound } from '@/components/_not-found';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

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

		await context.queryClient.ensureQueryData(
			convexQuery(api.org.limits, {
				slug: params.org,
			})
		);
	},
	notFoundComponent: () => <NotFound inContainer />,
});

function RouteComponent() {
	const { org: orgSlug } = Route.useParams();

	const { data: orgDetails } = useSuspenseQuery(
		convexQuery(api.org.getDetails, {
			slug: orgSlug,
		})
	);

	const { data: limits } = useSuspenseQuery(
		convexQuery(api.org.limits, {
			slug: orgSlug,
		})
	);

	if (!orgDetails.org) return null;

	const { org } = orgDetails;

	return (
		<div>
			<div className='border-b bg-muted/50 pt-12 pb-6'>
				<div className='container'>
					<h1 className='inline-flex flex-wrap items-center gap-y-1 text-3xl font-bold'>
						<span className='mr-2 inline-block'>Create a new project for</span>
						<span className='inline-flex items-center gap-2 rounded-lg px-2 text-foreground'>
							<Avatar className='size-6 rounded-full border'>
								<AvatarFallback className='rounded-lg'>{org.name[0].toUpperCase()}</AvatarFallback>
							</Avatar>
							<span>{org.name}</span>
						</span>
					</h1>
				</div>
			</div>
			<div className='container py-4'>
				<CreateProjectForm enabled={limits.canAddProjects} orgSlug={org.slug} />
			</div>
		</div>
	);
}
