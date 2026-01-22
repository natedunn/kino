import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { api } from '~api';

import { CreateBoardForm } from './-components/create-board-form';

export const Route = createFileRoute('/@{$org}/$project/feedback/boards/new')({
	loader: async () => {
		throw notFound();
	},
	component: RouteComponent,
	notFoundComponent: () => {
		return <div className='container'>Not found: index.tsx</div>;
	},
});

function RouteComponent() {
	const { org: orgSlug, project: projectSlug } = Route.useParams();

	const { data: projectData } = useSuspenseQuery(
		convexQuery(api.project.getDetails, {
			orgSlug,
			slug: projectSlug,
		})
	);

	if (!projectData?.project) throw new Error('No project found');

	const { project } = projectData;

	return (
		<div className='container'>
			<div className='py-6'>
				<h1 className='text-3xl font-bold'>Create a new board for project {project.name}</h1>
				<div className='mt-4'>
					<CreateBoardForm projectId={project._id} />
				</div>
			</div>
		</div>
	);
}
