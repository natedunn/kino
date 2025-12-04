import React, { JSX } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { usePaginatedQuery } from 'convex/react';
import * as z from 'zod';

import { api } from '~api';
import { Button } from '@/components/ui/button';
import { Id } from '@/convex/_generated/dataModel';
import { feedbackSelectSchema } from '@/convex/schema/feedback.schema';
import CirclePlusOutline from '@/icons/circle-plus-outline';
import LoaderQuarter from '@/icons/loader-quarter';
import Megaphone from '@/icons/megaphone';
import Missing from '@/icons/missing';
import { cn } from '@/lib/utils';

import { BoardsNav } from './-components/boards-nav';
import { FeedbackCard } from './-components/feedback-card';
import { FeedbackOptions } from './-components/feedback-options';
import { FeedbackToolbar } from './-components/feedback-toolbar';

const NUM_OF_ITEMS_PER_PAGE = 10;

const feedbackSearchParams = z.object({
	board: z.optional(z.string()).default('all'),
	search: z.optional(z.string().transform((val) => (val?.trim() === '' ? undefined : val))),
	status: z.optional(
		feedbackSelectSchema.shape.status.transform((val) => (val?.trim() === '' ? undefined : val))
	),
});

export const Route = createFileRoute('/@{$org}/$project/feedback/')({
	validateSearch: feedbackSearchParams,
	loaderDeps: ({ search }) => ({ search }),
	loader: async ({ context, params, deps }) => {
		await context.queryClient.ensureQueryData(
			convexQuery(api.features.feedback, {
				projectSlug: params.project,
			})
		);

		const boards = await context.queryClient.ensureQueryData(
			convexQuery(api.feedbackBoard.listProjectBoards, {
				slug: params.project,
			})
		);

		// This will be rewritten 👇
		const project = await context.queryClient.ensureQueryData(
			convexQuery(api.project.getDetails, {
				orgSlug: params.org,
				slug: params.project,
			})
		);

		const feedback = await context.queryClient.ensureQueryData(
			convexQuery(api.feedback.listProjectFeedback, {
				projectId: project?.project?._id!,
				search: deps.search.search,
				boardId: boards?.find((b) => b.slug === deps.search.board)?._id ?? 'all',
				status: deps.search.status,
				paginationOpts: {
					numItems: NUM_OF_ITEMS_PER_PAGE,
					cursor: null,
				},
			})
		);

		return { feedback: feedback.page };
	},
	component: RouteComponent,
});

const Notice = ({ icon, children }: { icon: React.JSX.Element; children: React.ReactNode }) => {
	return (
		<div className='text-bold flex items-center justify-center gap-3 rounded-lg border bg-muted p-4 text-xl text-muted-foreground md:p-10'>
			<div>{icon}</div>
			<div>{children}</div>
		</div>
	);
};

function RouteComponent() {
	const router = useRouter();
	const searchParams = Route.useSearch();
	const { search, status, board } = searchParams;
	const { org: orgSlug, project: projectSlug } = Route.useParams();
	const { feedback: serverResults } = Route.useLoaderData();

	const [feedback, setFeedback] = React.useState(serverResults);
	const [boardId, setBoardId] = React.useState<Id<'feedbackBoard'> | 'all'>('all');
	const [loadingFeedback, setLoadingFeedback] = React.useState(false);

	const { data: projectData } = useSuspenseQuery(
		convexQuery(api.project.getDetails, {
			orgSlug,
			slug: projectSlug,
		})
	);

	const { data: boards } = useSuspenseQuery(
		convexQuery(api.feedbackBoard.listProjectBoards, {
			slug: projectSlug,
		})
	);

	if (!projectData?.project?._id) {
		return null;
	}

	const feedbackData = usePaginatedQuery(
		api.feedback.listProjectFeedback,
		{
			projectId: projectData?.project?._id,
			search,
			boardId,
			status,
		},
		{
			initialNumItems: NUM_OF_ITEMS_PER_PAGE,
		}
	);

	React.useEffect(() => {
		if (feedbackData.status !== 'LoadingFirstPage' && feedbackData.status !== 'LoadingMore') {
			setFeedback(feedbackData.results);
		}
	}, [feedbackData]);

	React.useEffect(() => {
		if (board) {
			setBoardId(boards?.find((b) => b.slug === board)?._id ?? 'all');
		}
	}, [board]);

	React.useEffect(() => {
		if (
			feedbackData.status === 'LoadingFirstPage' ||
			feedbackData.status === 'LoadingMore' ||
			searchParams
		) {
			setLoadingFeedback(true);
		}

		if (feedbackData.status !== 'LoadingFirstPage' && feedbackData.status !== 'LoadingMore') {
			setLoadingFeedback(false);
		}
	}, [feedbackData.status, searchParams]);

	return (
		<div className='container h-full overflow-visible'>
			<div className='h-full grid-cols-12 gap-8 md:grid'>
				<div className='border-r border-border/75 py-6 md:col-span-3'>
					<div className='sticky top-6 flex flex-col overflow-hidden'>
						<div className='border-b pr-8 pb-6'>
							<Button size='lg' className='w-full' asChild>
								<Link
									to='/@{$org}/$project/feedback/new'
									params={{
										org: orgSlug,
										project: projectSlug,
									}}
								>
									<CirclePlusOutline size='16px' /> Add feedback
								</Link>
							</Button>
						</div>
						<div className='mt-4'>
							<div className='border-b pr-8 pb-6'>
								<span className='mx-2 inline-flex text-sm font-bold text-muted-foreground'>
									Boards
								</span>
								<div className='mt-2'>{!!boards && <BoardsNav boards={boards} />}</div>
							</div>
							{projectData?.permissions.canEdit && (
								<div className='mt-6 pr-8'>
									<span className='mx-2 inline-flex text-sm font-bold text-muted-foreground'>
										Options
									</span>
									<div className='mt-2'>
										<FeedbackOptions />
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
				<div className='flex flex-col gap-4 py-8 md:col-span-9'>
					<div className='overflow-hidden rounded-lg border border-primary/50 bg-linear-to-tl from-primary/20 to-primary/5 p-8'>
						<div className='flex items-start gap-4'>
							<div className='mt-1'>
								<Megaphone className='size-8 text-primary/75 dark:text-blue-300' />
							</div>
							<div>
								<h1 className='text-2xl font-bold text-primary dark:text-blue-50'>
									We want to hear your feedback
								</h1>
								<p className='text-primary/75 dark:text-blue-300'>
									Make sure to read the feedback rules and guidelines before posting.
								</p>
							</div>
						</div>
					</div>
					<FeedbackToolbar />
					{feedback.length === 0 && !loadingFeedback ? (
						<Notice icon={<Missing size='32px' />}>No feedback found.</Notice>
					) : null}
					{feedback.length === 0 && loadingFeedback ? (
						<Notice icon={<LoaderQuarter className='animate-spin' size='32px' />}>
							Loading feedback...
						</Notice>
					) : null}
					{feedback.length > 0 ? (
						<div
							className={cn('flex flex-col gap-4', {
								'pointer-events-none opacity-50': loadingFeedback,
							})}
						>
							{feedback.map((f) => {
								return (
									<FeedbackCard
										key={f._id}
										feedback={f}
										onNavigationClick={() =>
											router.navigate({
												to: '/@{$org}/$project/feedback/$feedbackId',
												params: {
													org: orgSlug,
													project: projectSlug,
													feedbackId: f._id,
												},
											})
										}
									/>
								);
							})}
						</div>
					) : null}

					{feedbackData.status === 'CanLoadMore' && (
						<div className='flex items-center gap-3'>
							<Button
								variant='outline'
								onClick={() => feedbackData.loadMore(NUM_OF_ITEMS_PER_PAGE)}
							>
								Load more feedback
							</Button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
