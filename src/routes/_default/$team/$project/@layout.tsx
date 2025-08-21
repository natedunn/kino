import React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

import { cn } from '@/lib/utils';
import { ProjectNav } from '@/routes/_default/$team/$project/-components/project-nav';

export const Route = createFileRoute('/_default/$team/$project')({
	component: RouteComponent,
});

function RouteComponent() {
	const { team: teamSlug, project: projectSlug } = Route.useParams();

	const [navCalculated, setNavCalculated] = React.useState(false);

	return (
		<div className={cn('flex flex-1 flex-col', !navCalculated && 'overflow-x-hidden')}>
			<ProjectNav
				team={teamSlug}
				project={projectSlug}
				onNavCalculation={(isCalculating) => setNavCalculated(!isCalculating)}
			/>
			<Outlet />
		</div>
	);
}
