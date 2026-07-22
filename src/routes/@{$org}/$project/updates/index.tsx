import type { ReactNode } from 'react';

import { useState } from 'react';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { Settings2 } from 'lucide-react';

import { RoutePending } from '@/components/route-pending';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import CirclePlusOutline from '@/icons/circle-plus-outline';
import Missing from '@/icons/missing';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { projectTitle, titleMeta } from '@/lib/seo';

import { CategoriesNav } from './-components/categories-nav';
import { UpdateCard } from './-components/update-card';

const NUM_OF_ITEMS_PER_PAGE = 10;

type UpdateCategory = 'changelog' | 'article' | 'announcement';

type UpdateListArgs = {
	projectId: string;
	category?: UpdateCategory;
	cursor: string | null;
	limit: number;
};

function getUpdateListArgs({
	projectId,
	category,
	cursor,
}: Omit<UpdateListArgs, 'limit'>): UpdateListArgs {
	return {
		projectId,
		category,
		cursor,
		limit: NUM_OF_ITEMS_PER_PAGE,
	};
}

const UPDATE_CATEGORIES = new Set<UpdateCategory>(['changelog', 'article', 'announcement']);

function validateUpdatesSearch(search: Record<string, unknown>): {
	category?: UpdateCategory;
} {
	if (typeof search.category !== 'string') return {};
	const category = search.category.trim();
	return UPDATE_CATEGORIES.has(category as UpdateCategory)
		? { category: category as UpdateCategory }
		: {};
}

export const Route = createFileRoute('/@{$org}/$project/updates/')({
	component: UpdatesListRoute,
	loaderDeps: ({ search }) => ({ category: search.category }),
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

		const firstPageOptions = crpcServer.update.listByProject.queryOptions(
			getUpdateListArgs({
				projectId: projectData.project.id,
				category: deps.category,
				cursor: null,
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
	pendingComponent: () => <RoutePending variant='page' />,
	validateSearch: validateUpdatesSearch,
	head: ({ params }) => ({
		meta: [titleMeta(['Updates', projectTitle(params.org, params.project)])],
	}),
});

function Notice({ icon, children }: { icon: ReactNode; children: ReactNode }) {
	return (
		<div className='text-bold flex items-center justify-center gap-3 rounded-lg border bg-muted p-4 text-xl text-muted-foreground md:p-10'>
			<div>{icon}</div>
			<div>{children}</div>
		</div>
	);
}

function UpdatesListSkeleton() {
	return (
		<div className='flex flex-col' aria-hidden='true'>
			{Array.from({ length: 4 }).map((_, index) => (
				<div key={index} className='border-b border-border/75 py-6 first:pt-0'>
					<Skeleton className='h-4 w-28' />
					<Skeleton className='mt-3 h-6 w-3/5' />
					<Skeleton className='mt-4 h-4 w-full' />
					<Skeleton className='mt-2 h-4 w-4/5' />
					<div className='mt-5 flex gap-2'>
						<Skeleton className='h-6 w-20' />
						<Skeleton className='h-6 w-24' />
					</div>
				</div>
			))}
		</div>
	);
}

function UpdatesListRoute() {
	const { org: orgSlug, project: projectSlug } = Route.useParams();
	const { category: categoryParam } = Route.useSearch();
	const crpc = useCRPC();
	const queryClient = useQueryClient();

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
	const canEdit = projectData.permissions.canEdit;

	const currentProfileQuery = useQuery(
		crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true, subscribe: false })
	);

	// Server-side cursor pagination. The first page loads after the route shell
	// mounts; "Load more" appends subsequent pages. The category filter is
	// applied server-side, so a fresh filter resets the accumulated pages via the
	// args key.
	const firstPageArgs = getUpdateListArgs({
		projectId,
		category: categoryParam,
		cursor: null,
	});
	const firstPageKey = JSON.stringify(firstPageArgs);
	const firstPageQuery = useQuery(crpc.update.listByProject.queryOptions(firstPageArgs));
	const firstPage = firstPageQuery.data;
	const isInitialUpdatesLoading = firstPageQuery.isPending && !firstPage;
	const refreshingUpdates = firstPageQuery.isFetching && !isInitialUpdatesLoading;

	if (firstPageQuery.isError && !firstPage) {
		throw firstPageQuery.error;
	}

	const [additionalState, setAdditionalState] = useState<{
		key: string;
		pages: Array<NonNullable<typeof firstPage>>;
	}>({ key: firstPageKey, pages: [] });
	const [loadingMore, setLoadingMore] = useState(false);
	const [loadMoreErrorState, setLoadMoreErrorState] = useState<{
		error: Error | null;
		key: string;
	}>({
		error: null,
		key: firstPageKey,
	});

	const additionalPages = additionalState.key === firstPageKey ? additionalState.pages : [];
	const loadMoreError = loadMoreErrorState.key === firstPageKey ? loadMoreErrorState.error : null;
	const pages = firstPage ? [firstPage, ...additionalPages] : additionalPages;
	const lastPage = additionalPages.at(-1) ?? firstPage;
	const updates = pages
		.flatMap((page) => page.page)
		.filter(
			(item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index
		);
	const canLoadMore = !!lastPage && !lastPage.isDone && !!lastPage.continueCursor;

	async function loadMoreUpdates() {
		if (!canLoadMore || loadingMore) return;

		setLoadingMore(true);
		setLoadMoreErrorState({ error: null, key: firstPageKey });
		try {
			const nextPage = await queryClient.fetchQuery(
				crpc.update.listByProject.staticQueryOptions(
					getUpdateListArgs({
						projectId,
						category: categoryParam,
						cursor: lastPage.continueCursor,
					})
				)
			);
			setAdditionalState((state) => ({
				key: firstPageKey,
				pages: state.key === firstPageKey ? [...state.pages, nextPage] : [nextPage],
			}));
		} catch (error) {
			setLoadMoreErrorState({
				error: error instanceof Error ? error : new Error('Failed to load more updates'),
				key: firstPageKey,
			});
		} finally {
			setLoadingMore(false);
		}
	}

	return (
		<div className='container flex flex-1 flex-col overflow-visible'>
			<div className='flex flex-1 flex-col gap-8 md:grid md:grid-cols-12'>
				<div className='order-last py-6 md:order-first md:col-span-3 md:border-r md:border-border/75'>
					<div className='sticky top-6 flex flex-col overflow-hidden'>
						<div className='pb-6 md:pr-6'>
							<h2 className='mx-2 text-sm font-bold text-muted-foreground'>Categories</h2>
							<div className='mt-2'>
								<CategoriesNav />
							</div>
						</div>
						{canEdit ? (
							<div className='border-t pt-6 md:pr-6'>
								<h2 className='mx-2 text-sm font-bold text-muted-foreground'>Actions</h2>
								<div className='mt-2 flex flex-col gap-3'>
									<Button asChild className='w-full'>
										<Link
											params={{ org: orgSlug, project: projectSlug }}
											to='/@{$org}/$project/updates/new'
										>
											<CirclePlusOutline size='16px' /> New Update
										</Link>
									</Button>
									<Button asChild className='w-full' variant='outline'>
										<Link
											params={{ org: orgSlug, project: projectSlug }}
											search={{ pageSize: 20 }}
											to='/@{$org}/$project/updates/edit'
										>
											<Settings2 className='size-4' /> Manage Updates
										</Link>
									</Button>
								</div>
							</div>
						) : null}
					</div>
				</div>

				<div
					className='flex flex-col gap-4 py-8 md:col-span-9'
					aria-busy={isInitialUpdatesLoading || refreshingUpdates || loadingMore}
					aria-live='polite'
				>
					{isInitialUpdatesLoading ? (
						<>
							<span className='sr-only'>Loading updates...</span>
							<UpdatesListSkeleton />
						</>
					) : null}
					{!isInitialUpdatesLoading && updates.length === 0 ? (
						<Notice icon={<Missing aria-hidden='true' size='32px' />}>No updates yet.</Notice>
					) : null}
					{updates.length > 0 ? (
						<>
							<ul className='flex flex-col'>
								{updates.map((update, index) => (
									<UpdateCard
										key={update.id}
										currentProfileId={currentProfileQuery.data?.id}
										isLast={!canLoadMore && index === updates.length - 1}
										orgSlug={orgSlug}
										projectSlug={projectSlug}
										update={update}
									/>
								))}
							</ul>
							{canLoadMore ? (
								<div className='flex justify-center pt-2'>
									<Button
										disabled={loadingMore}
										onClick={() => void loadMoreUpdates()}
										variant='outline'
									>
										{loadingMore ? 'Loading…' : 'Load more updates'}
									</Button>
								</div>
							) : null}
							{loadMoreError ? (
								<p className='text-center text-sm text-destructive'>{loadMoreError.message}</p>
							) : null}
						</>
					) : null}
				</div>
			</div>
		</div>
	);
}
