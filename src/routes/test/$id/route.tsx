import { createFileRoute, notFound, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/test/$id')({
	loader: () => {
		throw notFound();
	},
	component: RouteComponent,
	notFoundComponent: () => <div>Not found: $id/route.tsx</div>,
});

function RouteComponent() {
	return (
		<div>
			Inner router.tsx
			<Outlet />
		</div>
	);
}
