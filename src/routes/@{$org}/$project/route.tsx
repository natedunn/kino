import React from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { createFileRoute, Outlet } from '@tanstack/react-router';

import { api } from '~api';
import { NotFound } from '@/components/_not-found';
import { cn } from '@/lib/utils';

import { DynamicNavigation } from './-components/dynamic-nav';

export const Route = createFileRoute('/@{$org}/$project')({
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(
			convexQuery(api.project.getDetails, {
				orgSlug: params.org,
				slug: params.project,
			})
		);
	},
	component: RouteComponent,
	pendingMs: 5000,
	// pendingComponent: () => {
	// 	return (
	// 		<div className='container'>
	// 			<div className='text-red-500'>PENDING in PROJECT LAYOUT</div>
	// 		</div>
	// 	);
	// },
	notFoundComponent: () => {
		return (
			<div className='container'>
				<NotFound />
			</div>
		);
	},
});

function RouteComponent() {
	const { org: orgSlug, project: projectSlug } = Route.useParams();
	const [navCalculated, setNavCalculated] = React.useState(false);

	return (
		<div
			className={cn(
				'flex flex-1 flex-col', //
				!navCalculated && 'overflow-x-hidden'
			)}
		>
			<DynamicNavigation
				orgSlug={orgSlug}
				projectSlug={projectSlug}
				onStateChange={(state) => setNavCalculated(!state.isCalculating)}
			/>
			<Outlet />
		</div>
	);
}
