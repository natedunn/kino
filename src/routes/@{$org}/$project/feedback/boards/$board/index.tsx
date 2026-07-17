import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { EmptyState } from '@/components/kino/common';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { projectTitle, titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/@{$org}/$project/feedback/boards/$board/')({
	loader: async ({ context, params }) => {
		const board = await context.queryClient.ensureQueryData(
			crpcServer.feedbackBoard.get.queryOptions({
				id: params.board,
				orgSlug: params.org,
				projectSlug: params.project,
			})
		);

		return {
			title: board?.name,
		};
	},
	head: ({ loaderData, params }) => ({
		meta: [titleMeta([loaderData?.title ?? 'Board', projectTitle(params.org, params.project)])],
	}),
	component: BoardDetailRoute,
});

function BoardDetailRoute() {
	const params = Route.useParams();
	const crpc = useCRPC();

	const boardQuery = useQuery(
		crpc.feedbackBoard.get.queryOptions({
			id: params.board,
			orgSlug: params.org,
			projectSlug: params.project,
		})
	);

	if (boardQuery.isLoading) {
		return <div className='h-48 animate-pulse rounded-lg bg-muted/40' />;
	}

	if (!boardQuery.data) {
		return (
			<EmptyState
				title='Board not found'
				description='The requested board could not be loaded for this project.'
			/>
		);
	}

	const board = boardQuery.data;

	return (
		<div className='container py-6'>
			<pre className='overflow-x-auto rounded-lg border bg-muted p-4 text-xs'>
				<code>{JSON.stringify(board, null, 2)}</code>
			</pre>
		</div>
	);
}
