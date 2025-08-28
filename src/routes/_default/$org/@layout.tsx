import { convexQuery } from '@convex-dev/react-query';
import { createFileRoute, notFound, Outlet } from '@tanstack/react-router';

import { api } from '~api';

import { MainNav } from '../-components/main-nav';

export const Route = createFileRoute('/_default/$org')({
	component: RouteComponent,
	loader: async ({ context, params }) => {
		const org = await context.queryClient.ensureQueryData(
			convexQuery(api.org.getFullOrg, {
				orgSlug: params.org,
			})
		);

		if (!org) {
			notFound({
				throw: true,
			});
		}
	},
});

function RouteComponent() {
	const { userId } = Route.useRouteContext();

	return (
		<div className='flex flex-1 flex-col'>
			<MainNav userId={userId} />
			<Outlet />
		</div>
	);
}
