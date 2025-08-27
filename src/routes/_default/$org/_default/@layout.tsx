import { createFileRoute, Outlet } from '@tanstack/react-router';

import { MainNav } from '../../-components/main-nav';

export const Route = createFileRoute('/_default/$org/_default')({
	component: RouteComponent,
	loader: async ({ context }) => {
		return {
			user: context.user,
		}
	},
});

function RouteComponent() {
	const { user } = Route.useLoaderData();

	return (
		<div className='flex flex-1 flex-col'>
			<MainNav user={user} />
			<div>
				<Outlet />
			</div>
		</div>
	)
}
