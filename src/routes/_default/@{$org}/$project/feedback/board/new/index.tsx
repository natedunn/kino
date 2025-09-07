import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { api } from '~api';

import { CreateBoardForm } from './-components/create-board-form';

export const Route = createFileRoute('/_default/@{$org}/$project/feedback/board/new/')({
	component: RouteComponent,
});

function RouteComponent() {
	const { data: project } = useSuspenseQuery(
		convexQuery(api.project.getFullProject, {
			orgSlug: Route.useParams().org,
			slug: Route.useParams().project,
		})
	);

	if (!project) throw new Error('No project found');

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
