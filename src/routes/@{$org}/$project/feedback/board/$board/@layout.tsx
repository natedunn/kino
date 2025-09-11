import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/@{$org}/$project/feedback/board/$board/@layout')({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div>
			<Outlet />
		</div>
	)
}
