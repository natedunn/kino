import { convexQuery } from '@convex-dev/react-query';
import { createFileRoute, Outlet } from '@tanstack/react-router';

import { api } from '~api';
import { InlineAlert } from '@/components/inline-alert';

export const Route = createFileRoute('/@{$org}/$project/feedback/boards')({
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(
			convexQuery(api.features.feedback, {
				projectSlug: params.project,
			})
		);
	},
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
