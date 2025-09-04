import React from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, notFound, Outlet } from '@tanstack/react-router';

import { api } from '~api';
import { NotFound } from '@/components/_not-found';
import { cn } from '@/lib/utils';

import { DynamicNavigation } from './-components/dynamic-nav';

export const Route = createFileRoute('/_default/@{$org}/$project')({
	component: RouteComponent,
	loader: async ({ context, params }) => {
		if (params.org !== '.well-known' || params.project !== 'appspecific') {
			const project = await context.queryClient.ensureQueryData(
				convexQuery(api.project.getFullProject, {
					orgSlug: params.org,
					slug: params.project,
				})
			);

			const org = await context.queryClient.ensureQueryData(
				convexQuery(api.org.getFullOrg, {
					orgSlug: params.org,
				})
			);

			if (!project || !org) {
				notFound({
					throw: true,
				});
			}

			return {
				org: org,
				project: project,
			};
		}
	},
	notFoundComponent: () => {
		return (
			<div className='container'>
				<NotFound />
			</div>
		);
	},
});

function RouteComponent() {
	const { project: projectSlug, org: orgSlug } = Route.useParams();

	const [navCalculated, setNavCalculated] = React.useState(false);

	const { data: org } = useSuspenseQuery(
		convexQuery(api.org.getFullOrg, {
			orgSlug,
		})
	);

	const { data: project } = useSuspenseQuery(
		convexQuery(api.project.getFullProject, {
			orgSlug,
			slug: projectSlug,
		})
	);

	if (!org || !project) {
		return null;
	}

	return (
		<div className={cn('flex flex-1 flex-col', !navCalculated && 'overflow-x-hidden')}>
			<DynamicNavigation
				orgSlug={org.slug}
				projectSlug={projectSlug}
				onStateChange={(state) => setNavCalculated(!state.isCalculating)}
			/>
			<Outlet />
		</div>
	);
}
