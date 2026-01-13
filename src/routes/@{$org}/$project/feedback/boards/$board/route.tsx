import { convexQuery } from '@convex-dev/react-query';
import { createFileRoute, notFound, Outlet } from '@tanstack/react-router';
import { zid } from 'convex-helpers/server/zod4';

import { api } from '~api';
import { NotFound } from '@/components/_not-found';

export const Route = createFileRoute('/@{$org}/$project/feedback/boards/$board')({
	loader: async ({ context, params }) => {
		const board = await context.queryClient.ensureQueryData(
			convexQuery(api.feedbackBoard.get, {
				_id: params.board,
				projectSlug: params.project,
				orgSlug: params.org,
			})
		)

		if (!board) {
			throw notFound();
		}
	},
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
	)
}
