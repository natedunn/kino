import { createFileRoute, Outlet } from '@tanstack/react-router';

import { NotFound } from '@/components/_not-found';

export const Route = createFileRoute('/@{$org}/$project/feedback/boards/$board')({
	component: RouteComponent,
	errorComponent: ({ error }) => {
		return <div>There was an error: {error.message}</div>;
	},
	notFoundComponent: () => (
		<NotFound isContainer message='The board you are looking for does not exist' />
	),
});

function RouteComponent() {
	return (
		<div>
			<Outlet />
		</div>
	);
}
