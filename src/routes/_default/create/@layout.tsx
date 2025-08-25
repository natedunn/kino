import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_default/create')({
	component: RouteComponent,
	loader: async ({ context }) => {
		if (!context.user) {
			throw redirect({
				to: '/sign-in',
			});
		}
	},
});

function RouteComponent() {
	return <Outlet />;
}
