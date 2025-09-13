import React from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { ClientOnly, createFileRoute, notFound, Outlet } from '@tanstack/react-router';

import { api } from '~api';
import { NotFound } from '@/components/_not-found';
import { cn } from '@/lib/utils';

import { DynamicNavigation } from './-components/dynamic-nav';

export const Route = createFileRoute('/@{$org}/$project')({
	beforeLoad: async ({ context, params }) => {},

	loader: async ({ context, params }) => {
		// await context.queryClient.ensureQueryData(
		// 	convexQuery(api.project.getFullProject, {
		// 		orgSlug: params.org,
		// 		slug: params.project,
		// 	})
		// )
		// const project = await context.queryClient.ensureQueryData(
		// 	convexQuery(api.project.getFullProject, {
		// 		orgSlug: params.org,
		// 		slug: params.project,
		// 	})
		// )
		// const org = await context.queryClient.ensureQueryData(
		// 	convexQuery(api.org.getFullOrg, {
		// 		orgSlug: params.org,
		// 	})
		// )
		// if (!project || !org) {
		// 	notFound({
		// 		throw: true,
		// 	});
		// }
	},
	notFoundComponent: () => {
		return (
			<div className='container'>
				<NotFound />
			</div>
		);
	},
	pendingMs: 5000,
	pendingComponent: () => {
		return (
			<div className='container'>
				<div className='text-red-500'>PENDING in PROJECT LAYOUT</div>
			</div>
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { org: orgSlug, project: projectSlug } = Route.useParams();
	const [navCalculated, setNavCalculated] = React.useState(false);

	// const { data: orgData } = useSuspenseQuery(
	// 	convexQuery(api.org.getFullOrg, {
	// 		orgSlug,
	// 	})
	// );

	// const org = orgData?.org;

	// const { data: project } = useSuspenseQuery(
	// 	convexQuery(api.project.getFullProject, {
	// 		orgSlug,
	// 		slug: projectSlug,
	// 	})
	// );

	// if (!org || !project) {
	// 	return <div>Nothing to see</div>;
	// }

	return (
		<div
			className={cn(
				'flex flex-1 flex-col', //
				!navCalculated && 'overflow-x-hidden'
			)}
		>
			<ClientOnly fallback={<div>Loading...</div>}>
				<DynamicNavigation
					orgSlug={orgSlug}
					projectSlug={projectSlug}
					onStateChange={(state) => setNavCalculated(!state.isCalculating)}
				/>
			</ClientOnly>
			<Outlet />
		</div>
	);
}
