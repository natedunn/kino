import type { ReactNode } from 'react';

import { useState } from 'react';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router';
import { PanelLeftOpen } from 'lucide-react';

import { RoutePending } from '@/components/route-pending';
import { Button } from '@/components/ui/button';
import {
	ResponsiveDialog,
	ResponsiveDialogBody,
	ResponsiveDialogContent,
	ResponsiveDialogHeader,
} from '@/components/ui/responsive-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import CirclePlusOutline from '@/icons/circle-plus-outline';
import Missing from '@/icons/missing';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { projectTitle, titleMeta } from '@/lib/seo';
import * as m from '@/paraglide/messages.js';

import { BoardsNav } from './-components/boards-nav';
import { FeedbackCard } from './-components/feedback-card';
import { FeedbackOptions } from './-components/feedback-options';
import { FeedbackToolbar } from './-components/feedback-toolbar';

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

		const firstPageOptions = crpcServer.feedback.listProjectFeedback.queryOptions(
			getFeedbackListArgs({
				boardId: getBoardId(boards, deps.board),
				cursor: null,
				projectId: projectData.project.id,
				search: deps.search,
				status: deps.status,
			})
		);

		if (typeof window === 'undefined') {
			// Hard refresh: pending Convex queries are not dehydrated (see
			// `hydrationConfig`), so a fire-and-forget prefetch is discarded and the
			// client refetches from scratch — a skeleton phase after first paint.
			// Await so the first page ships inside the document and the list paints
			// once, with data.
			await context.queryClient.ensureQueryData(firstPageOptions).catch(() => undefined);
			return;
		}

		// Non-blocking warm-up: `intent` preload runs this loader on hover/focus, so
		// the first page (and current profile) is usually cached by the time the
		// user clicks — the list paints without a skeleton. We intentionally do not
		// await: a cold navigation still renders the shell immediately and falls
		// back to the skeleton while these resolve.
		void context.queryClient.prefetchQuery(firstPageOptions);
		void context.queryClient.prefetchQuery(
			crpcServer.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
		);
	},
	pendingComponent: () => <RoutePending variant='sidebar' />,
	validateSearch: validateFeedbackSearch,
	head: ({ params }) => ({
		meta: [titleMeta([m.project_nav_feedback(), projectTitle(params.org, params.project)])],
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
	const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
		} catch {
			setLoadMoreErrorState({
				error: new Error(m.feedback_index_load_more_failed()),
				key: firstFeedbackPageKey,
			});
		} finally {
			setLoadingMoreFeedback(false);
		}
	}

	const sidebarContent = (
		<>
			<div className='-mr-5 border-b pr-5 pb-6'>
				<h2 className='mx-2 text-sm font-bold text-muted-foreground'>
					{m.feedback_index_boards()}
				</h2>
				<div className='mt-2'>
					<BoardsNav boards={boards} />
				</div>
			</div>
			{projectData.permissions.canManageContent ? (
				<div className='mt-6 pb-6'>
					<h2 className='mx-2 text-sm font-bold text-muted-foreground'>
						{m.feedback_index_actions()}
					</h2>
					<div className='mt-2'>
						<FeedbackOptions />
					</div>
				</div>
			) : null}
		</>
	);

	return (
		<>
			<div className='relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden lg:h-[calc(100dvh-9.75rem)] lg:flex-none'>
				<div
					aria-hidden='true'
					className='pointer-events-none absolute inset-x-0 top-20 border-b'
				/>
				<div className='container flex min-h-0 w-full min-w-0 flex-1 flex-col'>
					<div className='flex min-h-0 w-full max-w-full min-w-0 flex-1 flex-col lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]'>
						<aside
							id='feedback-sidebar'
							className='hidden h-full min-h-0 min-w-0 overflow-hidden border-r border-border/75 lg:block'
						>
							<div className='sticky top-0 flex h-full w-[17rem] max-w-none flex-col overflow-hidden'>
								<div className='flex h-[81px] shrink-0 items-center pr-5'>
									<Button asChild>
										<Link
											params={{ org: orgSlug, project: projectSlug }}
											to='/@{$org}/$project/feedback/new'
										>
											<CirclePlusOutline size='16px' />
											{m.feedback_index_add_feedback()}
										</Link>
									</Button>
								</div>
								<div className='mt-4 min-h-0 flex-1 overflow-y-auto pr-5 pb-6'>
									{sidebarContent}
								</div>
							</div>
						</aside>

						<div className='flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden'>
							<div className='flex h-[81px] min-w-0 shrink-0 items-center lg:pl-7'>
								<FeedbackToolbar
									leadingControl={
										<Button
											aria-label={m.feedback_index_browse_sidebar()}
											className='lg:hidden'
											onClick={() => setMobileSidebarOpen(true)}
											size='icon'
											variant='outline'
										>
											<PanelLeftOpen />
										</Button>
									}
									topRowClassName='w-full'
								/>
							</div>

							<div
								aria-busy={isInitialFeedbackLoading || refreshingFeedback || loadingMoreFeedback}
								aria-live='polite'
								className='flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto py-6 lg:pl-7'
							>
								{isInitialFeedbackLoading ? (
									<>
										<span className='sr-only'>{m.feedback_index_loading()}</span>
										<FeedbackListSkeleton />
									</>
								) : null}
								{!isInitialFeedbackLoading && feedback.length === 0 ? (
									<Notice icon={<Missing aria-hidden='true' size='32px' />}>
										{m.feedback_index_empty()}
									</Notice>
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
								{loadMoreError ? (
									<p className='mt-4 text-sm text-destructive'>{loadMoreError.message}</p>
								) : null}
								{canLoadMoreFeedback ? (
									<div className='mt-4 flex items-center gap-3'>
										<Button
											disabled={loadingMoreFeedback}
											onClick={() => void loadMoreFeedback()}
											variant='outline'
										>
											{loadingMoreFeedback
												? m.feedback_index_loading()
												: m.feedback_index_load_more()}
										</Button>
									</div>
								) : null}
							</div>
						</div>
					</div>
				</div>
			</div>

			<ResponsiveDialog onOpenChange={setMobileSidebarOpen} open={mobileSidebarOpen}>
				<ResponsiveDialogContent
					className='flex flex-col gap-0 overflow-hidden p-0'
					dialogClassName='sm:max-w-md'
					showCloseButton={false}
				>
					<ResponsiveDialogHeader
						icon={<PanelLeftOpen />}
						title={m.feedback_index_browse_sidebar()}
					/>
					<ResponsiveDialogBody className='p-3'>
						<div className='mb-3 border-b pb-3'>
							<Button asChild>
								<Link
									params={{ org: orgSlug, project: projectSlug }}
									to='/@{$org}/$project/feedback/new'
								>
									<CirclePlusOutline size='16px' />
									{m.feedback_index_add_feedback()}
								</Link>
							</Button>
						</div>
						{sidebarContent}
					</ResponsiveDialogBody>
				</ResponsiveDialogContent>
			</ResponsiveDialog>
		</>
	);
}
