import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';

import { api } from '~api';

export const Route = createFileRoute('/@{$org}/')({
	component: RouteComponent,
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(
			convexQuery(api.project.getManyByOrg, {
				orgSlug: params.org,
			})
		);
	},
});

function RouteComponent() {
	const { org: orgSlug } = Route.useParams();

	const { data: projects } = useSuspenseQuery(
		convexQuery(api.project.getManyByOrg, {
			orgSlug,
		})
	);

	console.log(projects);

	return (
		<div className='container'>
			<div className='mt-6 flex items-center gap-4'>
				Hello
				{projects?.map((project) => {
					return (
						<Link
							key={project._id}
							to='/@{$org}/$project'
							params={(prev) => ({
								...prev,
								org: orgSlug,
								project: project.slug,
							})}
						>
							<span className='inline-flex gap-3 rounded border bg-muted p-4 hocus:border-foreground/50 hocus:bg-accent/50'>
								{project.name} - {project.visibility}
							</span>
						</Link>
					);
				})}
			</div>
		</div>
	);
}
