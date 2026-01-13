import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';

import { api } from '~api';
import { NotFound } from '@/components/_not-found';
import { Id } from '@/convex/_generated/dataModel';

import { EditBoardForm } from './-components/edit-board-form';

export const Route = createFileRoute('/@{$org}/$project/feedback/boards/$board/edit')({
	component: RouteComponent,
	loader: async ({ context, params }) => {
		const board = await context.queryClient.ensureQueryData(
			convexQuery(api.feedbackBoard.get, {
				_id: params.board,
				projectSlug: params.project,
				orgSlug: params.org,
			})
		);

		if (!board) {
			// throw new Error();
			throw notFound();
		}
	},
	notFoundComponent: () => <NotFound isContainer />,
});

function RouteComponent() {
	const { board: boardId, project: projectSlug, org: orgSlug } = Route.useParams();

	const { data: board } = useSuspenseQuery(
		convexQuery(api.feedbackBoard.get, {
			_id: boardId as Id<'feedbackBoard'>,
			projectSlug,
			orgSlug,
		})
	);

	if (!board) throw new Error('No board found.');

	return (
		<div className='container'>
			<div className='space-y-6 py-12'>
				<Link
					to='/@{$org}/$project/feedback/boards'
					params={{
						org: orgSlug,
						project: projectSlug,
					}}
					className='link-text inline-flex items-center gap-2 text-muted-foreground hocus:text-foreground'
				>
					<ChevronLeft className='size-3' />
					Back to all boards
				</Link>
				<h1 className='text-3xl font-bold'>Edit Board</h1>
				<div>
					<EditBoardForm board={board} orgSlug={orgSlug} projectSlug={projectSlug} />
				</div>
			</div>
		</div>
	);
}
