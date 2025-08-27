import React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

import { cn } from '@/lib/utils';

import { MainNav } from '../../-components/main-nav';
import { DynamicNavigation } from './-components/dynamic-nav';

export const Route = createFileRoute('/_default/$org/$project')({
	component: RouteComponent,
	loader: async ({ context }) => {
		return {
			user: context.user,
		};
	},
});

function RouteComponent() {
	const { org: orgSlug, project: projectSlug } = Route.useParams();
	const { user } = Route.useLoaderData();

	const [navCalculated, setNavCalculated] = React.useState(false);

	return (
		<div className={cn('flex flex-1 flex-col', !navCalculated && 'overflow-x-hidden')}>
			<MainNav user={user}>
				<DynamicNavigation
					orgSlug={orgSlug}
					projectSlug={projectSlug}
					onStateChange={(state) => setNavCalculated(!state.isCalculating)}
				/>
			</MainNav>
			<Outlet />
		</div>
	);
}
