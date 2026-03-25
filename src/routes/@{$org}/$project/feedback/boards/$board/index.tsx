import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { api } from '~api';
import { RoutePending } from '@/components/route-pending';
import { Id } from '@/convex/_generated/dataModel';

export const Route = createFileRoute('/@{$org}/$project/feedback/boards/$board/')({
	pendingComponent: () => <RoutePending variant='detail' />,
	pendingMs: 150,
	loader: async ({ context, params }) => {
		const boardData = await context.queryClient.ensureQueryData(
			convexQuery(api.feedbackBoard.get, {
				_id: params.board,
				projectSlug: params.project,
				orgSlug: params.org,
			})
		);

		if (!boardData) {
			throw notFound();
		}
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { org, project, board } = Route.useParams();

	const { data: boardData } = useSuspenseQuery(
		convexQuery(api.feedbackBoard.get, {
			_id: board as Id<'feedbackBoard'>,
			projectSlug: project,
			orgSlug: org,
		})
	);

	if (!boardData) {
		throw notFound();
	}

	return (
		<div className='container'>
			<pre>
				<code>{JSON.stringify(boardData, null, 2)}</code>
			</pre>
		</div>
	);
}
