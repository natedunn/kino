import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { api } from '~api';

export const Route = createFileRoute('/@{$org}/$project/feedback/boards/$board/')({
	component: RouteComponent,
});

function RouteComponent() {
	const { data: feedback } = useSuspenseQuery(
		convexQuery(api.features.feedback, {
			projectSlug: Route.useParams().project,
		})
	)

	if (!feedback?.boards) throw new Error('No boards found');

	const board = feedback.boards.find((board) => board._id === Route.useParams().board);

	if (!board) throw new Error('No board found');

	return (
		<div className='container'>
			<pre>
				<code>{JSON.stringify(board, null, 2)}</code>
			</pre>
		</div>
	)
}
