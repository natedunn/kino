import { createFileRoute, Outlet } from '@tanstack/react-router';

import { ProjectNav } from '@/routes/_default/$team/$project/-components/project-navigation';

export const Route = createFileRoute('/_default/$team/$project')({
	component: RouteComponent,
});

function RouteComponent() {
	const { team: teamSlug, project: projectSlug } = Route.useParams();

	return (
		<div className='flex flex-1 flex-col'>
			<ProjectNav team={teamSlug} project={projectSlug} />
			<div>
				<Outlet />
			</div>
		</div>
	);
}
