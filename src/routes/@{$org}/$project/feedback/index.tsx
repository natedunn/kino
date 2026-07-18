import { useState } from 'react';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, createFileRoute, notFound, useRouter } from '@tanstack/react-router';
import { BoardsNav } from './-components/boards-nav';
import { FeedbackCard } from './-components/feedback-card';
import { FeedbackOptions } from './-components/feedback-options';
import { FeedbackToolbar } from './-components/feedback-toolbar';
import type { ReactNode } from 'react';


import { RoutePending } from '@/components/route-pending';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import CirclePlusOutline from '@/icons/circle-plus-outline';
import Missing from '@/icons/missing';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { projectTitle, titleMeta } from '@/lib/seo';


const NUM_OF_ITEMS_PER_PAGE = 50;

type BoardSummary = {
	id: string;
	slug: string;
};

type FeedbackListArgs = {
	boardId: string;
	cursor: string | null;
	limit: number;
	projectId: string;
	search?: string;
	status?: 'open' | 'in-progress' | 'closed' | 'completed' | 'paused';
};

type FeedbackStatus = NonNullable<FeedbackListArgs['status']>;
type FeedbackSearch = {
	board?: string;
	search?: string;
	status?: FeedbackStatus;
};

const FEEDBACK_STATUSES = new Set<FeedbackStatus>([
	'open',
	'in-progress',
	'closed',
	'completed',
	'paused',
]);

function parseOptionalString(value: unknown) {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed === '' ? undefined : trimmed;
}

function validateFeedbackSearch(search: Record<string, unknown>): FeedbackSearch {
	const status = parseOptionalString(search.status);
	const board = parseOptionalString(search.board);
	const query = parseOptionalString(search.search);

	return {
		...(board ? { board } : {}),
		...(query ? { search: query } : {}),
		status:
			status && FEEDBACK_STATUSES.has(status as FeedbackStatus)
				? (status as FeedbackStatus)
				: undefined,
	};
}

export const Route = createFileRoute('/@{$org}/$project/feedback/')({
	component: FeedbackListRoute,
	loaderDeps: ({ search }) => ({
		board: search.board,
		search: search.search,
		status: search.status,
	}),
	loader: async ({ context, deps, params }) => {
		const projectData = await context.queryClient.ensureQueryData(
			crpcServer.project.getDetails.queryOptions({
				orgSlug: params.org,
				slug: params.project,
			})
		);

		if (!projectData?.project) {
			throw notFound();
		}

		const boards = await context.queryClient.ensureQueryData(
			crpcServer.feedbackBoard.listProjectBoards.queryOptions({
				projectId: projectData.project.id,
			})
		);

		// Non-blocking warm-up: `intent` preload runs this loader on hover/focus, so
		// the first page (and current profile) is usually cached by the time the
		// user clicks — the list paints without a skeleton. We intentionally do not
		// await: a cold navigation still renders the shell immediately and falls
		// back to the skeleton while these resolve.
		void context.queryClient.prefetchQuery(
			crpcServer.feedback.listProjectFeedback.queryOptions(
				getFeedbackListArgs({
					boardId: getBoardId(boards, deps.board),
					cursor: null,
					projectId: projectData.project.id,
					search: deps.search,
					status: deps.status,
				})
			)
		);
		void context.queryClient.prefetchQuery(
			crpcServer.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
		);
	},
	pendingComponent: () => <RoutePending variant='sidebar' />,
	pendingMs: 600,
	validateSearch: validateFeedbackSearch,
	head: ({ params }) => ({
		meta: [titleMeta(['Feedback', projectTitle(params.org, params.project)])],
	}),
});

function getBoardId(boards: Array<BoardSummary> | null | undefined, boardSlug: string | undefined) {
	return boards?.find((item) => item.slug === boardSlug)?.id ?? 'all';
}

function getFeedbackListArgs({
	boardId,
	cursor,
	projectId,
	search,
	status,
}: Omit<FeedbackListArgs, 'limit'>): FeedbackListArgs {
	return {
		boardId,
		cursor,
		limit: NUM_OF_ITEMS_PER_PAGE,
		projectId,
		search,
		status,
	};
}

function Notice({ icon, children }: { icon: ReactNode; children: ReactNode }) {
	return (
		<div className='text-bold flex items-center justify-center gap-3 rounded-lg border bg-muted p-4 text-xl text-muted-foreground md:p-10'>
			<div>{icon}</div>
			<div>{children}</div>
		</div>
	);
}

function FeedbackListSkeleton() {
	return (
		<div className='flex flex-col gap-4' aria-hidden='true'>
			{Array.from({ length: 5 }).map((_, index) => (
				<div key={index} className='rounded-lg border p-5'>
					<div className='flex items-start justify-between gap-4'>
						<div className='min-w-0 flex-1'>
							<Skeleton className='h-5 w-3/5' />
							<Skeleton className='mt-3 h-4 w-full' />
							<Skeleton className='mt-2 h-4 w-2/3' />
						</div>
						<Skeleton className='size-10 shrink-0 rounded-md' />
					</div>
					<div className='mt-5 flex gap-2'>
						<Skeleton className='h-6 w-20' />
						<Skeleton className='h-6 w-24' />
					</div>
				</div>
			))}
		</div>
	);
}

function FeedbackListRoute() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const searchParams = Route.useSearch();
	const { search, status, board } = searchParams;
	const { org: orgSlug, project: projectSlug } = Route.useParams();
	const crpc = useCRPC();

	const { data: projectData } = useSuspenseQuery(
		crpc.project.getDetails.queryOptions({
			orgSlug,
			slug: projectSlug,
		})
	);

	if (!projectData?.project) {
		throw notFound();
	}
	const projectId = projectData.project.id;

	const { data: boards } = useSuspenseQuery(
		crpc.feedbackBoard.listProjectBoards.queryOptions({
			projectId,
		})
	);
	const profileQuery = useQuery(
		crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true, subscribe: false })
	);
	const boardId = getBoardId(boards, board);
	const firstFeedbackPageArgs = getFeedbackListArgs({
		boardId,
		cursor: null,
		projectId,
		search,
		status,
	});
	const firstFeedbackPageKey = JSON.stringify(firstFeedbackPageArgs);
	const firstFeedbackPageQuery = useQuery(
		crpc.feedback.listProjectFeedback.queryOptions(firstFeedbackPageArgs)
	);
	const firstFeedbackPage = firstFeedbackPageQuery.data;
	const isInitialFeedbackLoading = firstFeedbackPageQuery.isPending && !firstFeedbackPage;
	const refreshingFeedback = firstFeedbackPageQuery.isFetching && !isInitialFeedbackLoading;

	if (firstFeedbackPageQuery.isError && !firstFeedbackPage) {
		throw firstFeedbackPageQuery.error;
	}

	const [additionalFeedbackState, setAdditionalFeedbackState] = useState<{
		key: string;
		pages: Array<NonNullable<typeof firstFeedbackPage>>;
	}>({
		key: firstFeedbackPageKey,
		pages: [],
	});
	const [loadingMoreFeedback, setLoadingMoreFeedback] = useState(false);
	const [loadMoreErrorState, setLoadMoreErrorState] = useState<{
		error: Error | null;
		key: string;
	}>({
		error: null,
		key: firstFeedbackPageKey,
	});

	const additionalFeedbackPages =
		additionalFeedbackState.key === firstFeedbackPageKey ? additionalFeedbackState.pages : [];
	const loadMoreError =
		loadMoreErrorState.key === firstFeedbackPageKey ? loadMoreErrorState.error : null;
	const feedbackPages = firstFeedbackPage
		? [firstFeedbackPage, ...additionalFeedbackPages]
		: additionalFeedbackPages;
	const lastFeedbackPage = additionalFeedbackPages.at(-1) ?? firstFeedbackPage;
	const feedback = feedbackPages
		.flatMap((page) => page.page)
		.filter((item, index, items) => {
			return items.findIndex((candidate) => candidate.id === item.id) === index;
		});
	const canLoadMoreFeedback =
		!!lastFeedbackPage && !lastFeedbackPage.isDone && !!lastFeedbackPage.continueCursor;

	async function loadMoreFeedback() {
		if (!canLoadMoreFeedback || loadingMoreFeedback) return;

		setLoadingMoreFeedback(true);
		setLoadMoreErrorState({ error: null, key: firstFeedbackPageKey });

		try {
			const nextPage = await queryClient.fetchQuery(
				crpc.feedback.listProjectFeedback.staticQueryOptions(
					getFeedbackListArgs({
						boardId,
						cursor: lastFeedbackPage.continueCursor,
						projectId,
						search,
						status,
					})
				)
			);
			setAdditionalFeedbackState((state) => ({
				key: firstFeedbackPageKey,
				pages: state.key === firstFeedbackPageKey ? [...state.pages, nextPage] : [nextPage],
			}));
		} catch (error) {
			setLoadMoreErrorState({
				error: error instanceof Error ? error : new Error('Failed to load more feedback'),
				key: firstFeedbackPageKey,
			});
		} finally {
			setLoadingMoreFeedback(false);
		}
	}

	return (
		<div className='container flex flex-1 flex-col overflow-visible'>
			<div className='flex flex-1 flex-col gap-8 md:grid md:grid-cols-12'>
				<div className='order-last py-8 md:order-first md:col-span-3 md:border-r md:border-border/75'>
					<div className='sticky top-6 flex flex-col overflow-hidden'>
						<div className='border-b pb-6 md:pr-6'>
							<Button asChild className='w-full'>
								<Link
									params={{ org: orgSlug, project: projectSlug }}
									to='/@{$org}/$project/feedback/new'
								>
									<CirclePlusOutline size='16px' />
									Add feedback
								</Link>
							</Button>
						</div>
						<div className='mt-4'>
							<div className='border-b pb-6 md:pr-6'>
								<h2 className='mx-2 text-sm font-bold text-muted-foreground'>Boards</h2>
								<div className='mt-2'>
									<BoardsNav boards={boards} />
								</div>
							</div>
							{projectData.permissions.canEdit ? (
								<div className='mt-6 pb-6 md:pr-6'>
									<h2 className='mx-2 text-sm font-bold text-muted-foreground'>Options</h2>
									<div className='mt-2'>
										<FeedbackOptions />
									</div>
								</div>
							) : null}
						</div>
					</div>
				</div>
				<div className='flex flex-col gap-4 py-8 md:col-span-9'>
					<FeedbackToolbar />
					<div
						aria-busy={isInitialFeedbackLoading || refreshingFeedback || loadingMoreFeedback}
						aria-live='polite'
					>
						{isInitialFeedbackLoading ? (
							<>
								<span className='sr-only'>Loading feedback...</span>
								<FeedbackListSkeleton />
							</>
						) : null}
						{!isInitialFeedbackLoading && feedback.length === 0 ? (
							<Notice icon={<Missing aria-hidden='true' size='32px' />}>No feedback found.</Notice>
						) : null}
						{feedback.length > 0 ? (
							<ul className='flex flex-col gap-4'>
								{feedback.map((item) => {
									const feedbackLinkOptions = {
										params: {
											org: orgSlug,
											project: projectSlug,
											slug: item.slug,
										},
										to: '/@{$org}/$project/feedback/$slug',
									} as const;
									const feedbackLocation = router.buildLocation(feedbackLinkOptions);

									return (
										<FeedbackCard
											key={item.id}
											feedback={item}
											href={router.history.createHref(feedbackLocation.publicHref) || '/'}
											isAuthenticated={!!profileQuery.data}
											onNavigationClick={() => router.navigate(feedbackLinkOptions)}
											onPreload={() => router.preloadRoute(feedbackLinkOptions)}
										/>
									);
								})}
							</ul>
						) : null}
					</div>
					{loadMoreError ? (
						<p className='text-sm text-destructive'>{loadMoreError.message}</p>
					) : null}
					{canLoadMoreFeedback ? (
						<div className='flex items-center gap-3'>
							<Button
								disabled={loadingMoreFeedback}
								onClick={() => void loadMoreFeedback()}
								variant='outline'
							>
								{loadingMoreFeedback ? 'Loading feedback...' : 'Load more feedback'}
							</Button>
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
