import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';

import { api } from '~api';
import { Button } from '@/components/ui/button';

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

	const { data: org } = useSuspenseQuery(convexQuery(api.org.getDetails, { orgSlug }));

	return (
		<div className='container'>
			<div className='mt-6 flex items-center gap-4'>
				{!projects ? (
					<div>
						<div>
							<span>No projects found.</span>
						</div>
						<div>
							{org.permissions.canEdit && (
								<div>
									<Button>Create a new project</Button>
								</div>
							)}
						</div>
					</div>
				) : (
					projects?.map((project) => {
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
					})
				)}
			</div>
		</div>
	);
}
