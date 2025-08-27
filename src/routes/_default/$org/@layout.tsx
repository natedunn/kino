import { convexQuery } from '@convex-dev/react-query';
import { createFileRoute, notFound, Outlet } from '@tanstack/react-router';

import { api } from '~api';

import { MainNav } from '../-components/main-nav';

export const Route = createFileRoute('/_default/$org')({
	component: RouteComponent,
	beforeLoad: async ({ context, params }) => {
		const org = await context.queryClient.ensureQueryData(
			convexQuery(api.org.getFullOrg, {
				orgSlug: params.org,
			})
		);

		return {
			org: org!,
		};
	},
	loader: async ({ context }) => {
		if (!context.org) {
			notFound({
				throw: true,
			});
		}

		return {
			user: context.user,
			org: context.org,
		};
	},
});

function RouteComponent() {
	const { user, org } = Route.useLoaderData();

	return (
		<div className='flex flex-1 flex-col'>
			<MainNav
				user={user}
				org={{
					id: org.id,
					slug: org.slug,
					name: org.name,
				}}
			/>
			<Outlet />
		</div>
	);
}
