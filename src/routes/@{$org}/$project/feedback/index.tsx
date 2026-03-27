import React from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router';
import { usePaginatedQuery } from 'convex/react';
import * as z from 'zod';

import { api } from '~api';
import { RoutePending } from '@/components/route-pending';
import { Button } from '@/components/ui/button';
import { Id } from '@/convex/_generated/dataModel';
import { feedbackSelectSchema } from '@/convex/schema/feedback.schema';
import CirclePlusOutline from '@/icons/circle-plus-outline';
import LoaderQuarter from '@/icons/loader-quarter';
import ArchivePencil from '@/icons/archive-pencil';
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
	component: RouteComponent,
	pendingComponent: () => <RoutePending variant='sidebar' />,
	pendingMs: 150,
	loader: async ({ context, params }) => {
		const projectData = await context.queryClient.ensureQueryData(
			convexQuery(api.project.getDetails, {
				orgSlug: params.org,
				slug: params.project,
			})
		);

		if (!projectData?.project?._id) {
			throw notFound();
		}

		await context.queryClient.ensureQueryData(
			convexQuery(api.feedbackBoard.listProjectBoards, {
				slug: params.project,
			})
		);
	},
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

	const [boardId, setBoardId] = React.useState<Id<'feedbackBoard'> | 'all'>('all');

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

	const { data: currentProfile } = useQuery(convexQuery(api.profile.findMyProfile, {}));
	const isAuthenticated = !!currentProfile;

	if (!projectData?.project?._id) {
		throw notFound();
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
		if (boards) {
			setBoardId(boards?.find((b) => b.slug === board)?._id ?? 'all');
		}
	}, [board, boards]);

	const loadingFeedback =
		feedbackData.status === 'LoadingFirstPage' || feedbackData.status === 'LoadingMore';
	const feedback = feedbackData.results;

	return (
		<div className='container h-full overflow-visible'>
			<div className='h-full grid-cols-12 gap-8 md:grid'>
				<div className='order-first border-r border-border/75 py-6 md:col-span-3'>
					<div className='sticky top-6 flex flex-col overflow-hidden'>
						<div className='border-b pb-6 pl-6'>
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
							<div className='border-b pb-6 pl-6'>
								<h2 className='mx-2 text-sm font-bold text-muted-foreground'>Boards</h2>
								<div className='mt-2'>{!!boards && <BoardsNav boards={boards} />}</div>
							</div>
							{projectData?.permissions.canEdit && (
								<div className='mt-6 pb-6 pl-6'>
									<h2 className='mx-2 text-sm font-bold text-muted-foreground'>Options</h2>
									<div className='mt-2'>
										<FeedbackOptions />
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
				<div className='flex flex-col gap-4 py-8 md:col-span-9'>
					{/* Header */}
					<div className='flex items-start gap-3 border-b pt-6 pb-6 md:-mr-8.25'>
						<ArchivePencil size='28px' className='mt-1 text-muted-foreground' />
						<div className='flex flex-col gap-1'>
							<h1 className='text-3xl font-bold'>Feedback</h1>
							<p className='text-muted-foreground'>Share your ideas and help us improve.</p>
						</div>
					</div>
					<FeedbackToolbar />
					<div aria-live='polite' aria-busy={loadingFeedback}>
						{feedback.length === 0 && !loadingFeedback ? (
							<Notice icon={<Missing size='32px' aria-hidden='true' />}>No feedback found.</Notice>
						) : null}
						{feedback.length === 0 && loadingFeedback ? (
							<Notice
								icon={
									<LoaderQuarter
										className='animate-spin'
										size='32px'
										role='status'
										aria-label='Loading'
									/>
								}
							>
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
											isAuthenticated={isAuthenticated}
											onNavigationClick={() =>
												router.navigate({
													to: '/@{$org}/$project/feedback/$slug',
													params: {
														org: orgSlug,
														project: projectSlug,
														slug: f.slug,
													},
												})
											}
										/>
									);
								})}
							</div>
						) : null}
					</div>

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
