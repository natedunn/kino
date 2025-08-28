import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { api } from '~api';

export const Route = createFileRoute('/_default/$org/_default/')({
	component: RouteComponent,
});

function RouteComponent() {
	const { org: orgSlug } = Route.useParams();

	const { data: projects } = useSuspenseQuery(
		convexQuery(api.project.getManyByOrg, {
			orgSlug,
		})
	);

	return (
		<div className='container'>
			{projects?.map((project) => {
				return (
					<div key={project._id}>
						{project.name} - {project.visibility}
					</div>
				);
			})}
		</div>
	);
}
