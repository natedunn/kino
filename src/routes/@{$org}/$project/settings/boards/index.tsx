
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import type { IconName } from '@/icons';

import { EmptyState } from '@/components/kino/common';
import { Button, buttonVariants } from '@/components/ui/button';
import { Icon } from '@/icons';
import Eye from '@/icons/eye';
import Pen from '@/icons/pen';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/@{$org}/$project/settings/boards/')({
	head: () => ({
		meta: [titleMeta(['Boards'])],
	}),
	loader: async ({ context, params }) => {
		const details = await context.queryClient.ensureQueryData(
			crpcServer.project.getDetails.queryOptions({
				orgSlug: params.org,
				slug: params.project,
			})
		);
		const projectId = (details as { project?: { id?: string } } | null)?.project?.id;
		if (projectId) {
			await context.queryClient.ensureQueryData(
				crpcServer.feedbackBoard.listProjectBoards.queryOptions({ projectId })
			);
		}
	},
	component: BoardsIndexRoute,
});

function BoardsIndexRoute() {
	const params = Route.useParams();
	const crpc = useCRPC();

	const projectQuery = useQuery(
		crpc.project.getDetails.queryOptions({
			orgSlug: params.org,
			slug: params.project,
		})
	);
	const boardsQuery = useQuery(
		crpc.feedbackBoard.listProjectBoards.queryOptions(
			{
				projectId: projectQuery.data?.project?.id,
			},
			{ enabled: !!projectQuery.data?.project?.id }
		)
	);

	const boards = boardsQuery.data ?? [];

	if (!projectQuery.data?.project && projectQuery.isLoading) {
		return <div className='h-64 animate-pulse rounded-xl border bg-muted/30' />;
	}

	if (!projectQuery.data?.project || !projectQuery.data.permissions.canEdit) {
		return (
			<EmptyState
				title='Board management unavailable'
				description='Only project editors can manage feedback boards.'
			/>
		);
	}

	return (
		<section className='space-y-6'>
			<header className='flex flex-col items-start gap-4 border-b pb-4 sm:flex-row sm:items-end sm:justify-between'>
				<div>
					<h2 className='text-xl font-semibold'>Boards</h2>
					<p className='mt-1 text-sm text-muted-foreground'>
						Manage the feedback boards available in this project.
					</p>
				</div>
				<Button asChild>
					<Link params={params} to='/@{$org}/$project/feedback/boards/new'>
						<Plus className='size-4' />
						Create board
					</Link>
				</Button>
			</header>

			{boards.length === 0 ? (
				<div className='rounded-xl border border-dashed bg-muted/20 p-10 text-center'>
					<div className='mx-auto flex size-10 items-center justify-center rounded-full bg-background shadow-sm'>
						<Icon fallback='box' name='box' size='20px' />
					</div>
					<p className='mt-3 text-sm font-medium'>No boards yet</p>
					<p className='mt-1 text-sm text-muted-foreground'>
						Create your first board to start collecting feedback.
					</p>
					<Link
						className={buttonVariants({ className: 'mt-4' })}
						params={params}
						to='/@{$org}/$project/feedback/boards/new'
					>
						<Plus className='size-4' />
						Create board
					</Link>
				</div>
			) : (
				<div className='grid gap-4 md:grid-cols-2'>
					{boards.map((board) => (
						<div
							className='group flex h-full flex-col gap-4 rounded-xl border bg-card p-5 transition-colors hover:border-foreground/20'
							key={board.id}
						>
							<div className='flex items-start gap-4'>
								<div className='flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40'>
									<Icon
										fallback='box'
										name={(board.icon as IconName | null) ?? 'box'}
										size='20px'
									/>
								</div>
								<div className='min-w-0 flex-1'>
									<div className='truncate text-base font-semibold'>{board.name}</div>
									<div className='mt-1 text-sm text-muted-foreground'>
										{board.description ?? (
											<span className='italic opacity-60'>No description added</span>
										)}
									</div>
								</div>
							</div>

							<div className='mt-auto flex flex-wrap items-center gap-4 border-t pt-3 text-sm'>
								<Link
									className='link-text inline-flex items-center gap-1.5'
									params={{ ...params, board: board.id }}
									to='/@{$org}/$project/feedback/boards/$board/edit'
								>
									<Pen className='text-muted-foreground' size='14px' />
									Edit
								</Link>
								<Link
									className='link-text inline-flex items-center gap-1.5'
									params={{ org: params.org, project: params.project }}
									search={{ board: board.slug }}
									to='/@{$org}/$project/feedback'
								>
									<Eye className='text-muted-foreground' size='14px' />
									View
								</Link>
							</div>
						</div>
					))}
				</div>
			)}
		</section>
	);
}
