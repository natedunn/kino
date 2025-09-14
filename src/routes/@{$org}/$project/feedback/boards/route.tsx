import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/@{$org}/$project/feedback/boards')({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className='flex flex-1 flex-col'>
			<Outlet />
		</div>
	);
}
