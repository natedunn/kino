import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_default/$org/_default')({
	component: RouteComponent,
	loader: async ({ context }) => {
		return {
			user: context.user,
		};
	},
});

function RouteComponent() {
	return (
		<div className='flex flex-1 flex-col'>
			<Outlet />
		</div>
	);
}
