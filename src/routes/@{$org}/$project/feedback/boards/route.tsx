import { createFileRoute, Outlet } from '@tanstack/react-router';

import { InlineAlert } from '@/components/inline-alert';

export const Route = createFileRoute('/@{$org}/$project/feedback/boards')({
	component: RouteComponent,
	errorComponent: () => {
		return (
			<div className='container py-6'>
				<InlineAlert variant='danger'>Unable to load boards</InlineAlert>
			</div>
		);
	},
});

function RouteComponent() {
	return (
		<div className='flex flex-1 flex-col'>
			<Outlet />
		</div>
	);
}
