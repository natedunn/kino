import type { AppCommand } from '@/components/command';
import type { ReactNode } from 'react';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router';
import { Search, Settings2 } from 'lucide-react';

import { useRegisterCommands } from '@/components/command';
import { NavTab, navTabLinkClassName } from '@/components/nav-tab';
import { RoutePending } from '@/components/route-pending';
import { useRegisterShortcuts } from '@/components/shortcuts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import CirclePlusOutline from '@/icons/circle-plus-outline';
import Missing from '@/icons/missing';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { projectTitle, titleMeta } from '@/lib/seo';
import * as m from '@/paraglide/messages.js';

import { CATEGORY_CONFIG } from './-components/category-badge';
import { FeaturedUpdatesSection } from './-components/featured-updates';
import { UpdateRow } from './-components/update-row';

const NUM_OF_ITEMS_PER_PAGE = 20;
const SEARCH_INPUT_ID = 'updates-search';
const SEARCH_DEBOUNCE_MS = 250;
const MAX_SEARCH_CHARS = 100;

type UpdateCategory = 'changelog' | 'article' | 'announcement';

const UPDATE_CATEGORIES = new Set<UpdateCategory>(['changelog', 'article', 'announcement']);

const CATEGORY_TABS: Array<{
	label: () => string;
	value: UpdateCategory | undefined;
}> = [
	{ label: m.updates_all, value: undefined },
	{ label: CATEGORY_CONFIG.changelog.label, value: 'changelog' },
	{ label: CATEGORY_CONFIG.article.label, value: 'article' },
	{ label: CATEGORY_CONFIG.announcement.label, value: 'announcement' },
];

function validateUpdatesSearch(search: Record<string, unknown>): {
	category?: UpdateCategory;
	q?: string;
} {
	const result: { category?: UpdateCategory; q?: string } = {};
	if (typeof search.category === 'string') {
		const category = search.category.trim();
		if (UPDATE_CATEGORIES.has(category as UpdateCategory)) {
			result.category = category as UpdateCategory;
		}
	}
	if (typeof search.q === 'string') {
		const q = search.q.trim().slice(0, MAX_SEARCH_CHARS);
		if (q) {
			result.q = q;
		}
	}
	return result;
}

type FirstPageArgs = {
	category?: UpdateCategory;
	cursor: string | null;
	limit: number;
	projectId: string;
	search?: string;
};

function getFirstPageOptions(crpcApi: typeof crpcServer, args: FirstPageArgs, staticQuery = false) {
	const { search, ...listArgs } = args;
	if (search) {
		const searchArgs = { ...listArgs, search };
		return staticQuery
			? crpcApi.update.searchProject.staticQueryOptions(searchArgs)
			: crpcApi.update.searchProject.queryOptions(searchArgs);
	}
	return staticQuery
		? crpcApi.update.listByProject.staticQueryOptions(listArgs)
		: crpcApi.update.listByProject.queryOptions(listArgs);
}

export const Route = createFileRoute('/@{$org}/$project/updates/')({
	component: UpdatesListRoute,
	loaderDeps: ({ search }) => ({ category: search.category, q: search.q }),
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

		const featuredOptions = crpcServer.update.listFeatured.queryOptions({
			projectId: projectData.project.id,
		});
		const firstPageOptions = getFirstPageOptions(crpcServer, {
			category: deps.category,
			cursor: null,
			limit: NUM_OF_ITEMS_PER_PAGE,
			projectId: projectData.project.id,
			search: deps.q,
		});

		if (typeof window === 'undefined') {
			await Promise.all([
				context.queryClient.ensureQueryData(featuredOptions).catch(() => undefined),
				context.queryClient.ensureQueryData(firstPageOptions).catch(() => undefined),
			]);
			return;
		}

		void context.queryClient.prefetchQuery(featuredOptions);
		void context.queryClient.prefetchQuery(firstPageOptions);
	},
	pendingComponent: () => <RoutePending variant='page' />,
	validateSearch: validateUpdatesSearch,
	head: ({ params }) => ({
		meta: [titleMeta([m.updates_meta(), projectTitle(params.org, params.project)])],
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

function FeaturedSkeleton() {
	return (
		<div aria-hidden='true' className='grid items-center gap-6 md:grid-cols-2 md:gap-10'>
			<Skeleton className='aspect-video w-full rounded-xl' />
			<div className='flex flex-col gap-4'>
				<Skeleton className='h-5 w-32' />
				<Skeleton className='h-8 w-4/5' />
				<Skeleton className='h-4 w-full' />
				<Skeleton className='h-4 w-2/3' />
				<Skeleton className='h-5 w-40' />
			</div>
		</div>
	);
}

function UpdatesListSkeleton() {
	return (
		<div aria-hidden='true' className='flex flex-col'>
			{Array.from({ length: 6 }).map((_, index) => (
				<div
					className='flex items-center justify-between gap-4 border-b border-border/75 py-4'
					key={index}
				>
					<Skeleton className='h-5 w-3/5' />
					<div className='flex items-center gap-4'>
						<Skeleton className='hidden h-5 w-20 sm:block' />
						<Skeleton className='h-4 w-24' />
					</div>
				</div>
			))}
		</div>
	);
}

function CategoryTabs({
	activeCategory,
	orgSlug,
	projectSlug,
	q,
}: {
	activeCategory: UpdateCategory | undefined;
	orgSlug: string;
	projectSlug: string;
	q: string | undefined;
}) {
	return (
		<nav
			aria-label={m.updates_categories()}
			className='flex min-w-0 flex-nowrap items-end gap-1 overflow-x-auto'
		>
			{CATEGORY_TABS.map((tab) => (
				<Link
					className={navTabLinkClassName}
					key={tab.value ?? 'all'}
					params={{ org: orgSlug, project: projectSlug }}
					search={{ category: tab.value, q }}
					to='/@{$org}/$project/updates'
				>
					<NavTab className='pb-3' isActive={activeCategory === tab.value} label={tab.label()} />
				</Link>
			))}
		</nav>
	);
}

function UpdatesListRoute() {
	const { org: orgSlug, project: projectSlug } = Route.useParams();
	const { category: categoryParam, q: qParam } = Route.useSearch();
	const crpc = useCRPC();
	const queryClient = useQueryClient();
	const { navigate } = useRouter();

	const [searchTerm, setSearchTerm] = useState(qParam ?? '');
	const searchTimeoutRef = useRef<number | null>(null);

	const clearSearchTimeout = useCallback(() => {
		if (searchTimeoutRef.current === null) return;
		window.clearTimeout(searchTimeoutRef.current);
		searchTimeoutRef.current = null;
	}, []);

	const scheduleSearch = useCallback(
		(nextSearchTerm: string) => {
			clearSearchTimeout();
			searchTimeoutRef.current = window.setTimeout(() => {
				const trimmed = nextSearchTerm.trim();
				navigate({
					params: { org: orgSlug, project: projectSlug },
					search: { category: categoryParam, q: trimmed === '' ? undefined : trimmed },
					to: '/@{$org}/$project/updates',
				});
				searchTimeoutRef.current = null;
			}, SEARCH_DEBOUNCE_MS);
		},
		[categoryParam, clearSearchTimeout, navigate, orgSlug, projectSlug]
	);

	useEffect(() => {
		return clearSearchTimeout;
	}, [clearSearchTimeout]);

	// The URL is the source of truth. When navigation changes `q` out from under
	// the input (back/forward, a tab link), drop any pending debounce so stale
	// keystrokes can't overwrite it, and re-sync the field. Comparing on the
	// trimmed value keeps the effect from eating a trailing space mid-typing
	// when our own debounce lands.
	useEffect(() => {
		clearSearchTimeout();
		const next = qParam ?? '';
		setSearchTerm((current) => (current.trim() === next ? current : next));
	}, [clearSearchTimeout, qParam]);

	const focusSearch = useCallback(() => {
		// The desktop and mobile inputs are separate elements; focus whichever is
		// currently rendered visible.
		for (const id of [SEARCH_INPUT_ID, `${SEARCH_INPUT_ID}-mobile`]) {
			const input = document.getElementById(id);
			if (input instanceof HTMLInputElement && input.offsetParent !== null) {
				input.focus();
				input.select();
				return;
			}
		}
	}, []);

	const shortcuts = useMemo(
		() => [
			{
				group: 'Updates' as const,
				id: 'updates.search',
				keys: ['f'],
				description: m.updates_command_search(),
				run: focusSearch,
			},
		],
		[focusSearch]
	);
	const updateCommands = useMemo<Array<AppCommand>>(() => {
		return [
			{
				group: 'Updates',
				icon: Search,
				id: 'updates.search',
				keywords: ['search', 'updates', 'changelog', 'announcement', 'article'],
				shortcut: 'F',
				title: m.updates_command_search(),
				run: focusSearch,
			},
		];
	}, [focusSearch]);

	useRegisterShortcuts('updates', shortcuts);
	useRegisterCommands('updates', updateCommands);

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
	const canEdit = projectData.permissions.canManageContent;

	const featuredQuery = useQuery(crpc.update.listFeatured.queryOptions({ projectId }));
	const featuredItems = featuredQuery.data?.items ?? [];

	const firstPageArgs: FirstPageArgs = {
		category: categoryParam,
		cursor: null,
		limit: NUM_OF_ITEMS_PER_PAGE,
		projectId,
		search: qParam,
	};
	const firstPageKey = JSON.stringify(firstPageArgs);
	const firstPageQuery = useQuery(
		getFirstPageOptions(crpc as unknown as typeof crpcServer, firstPageArgs)
	);
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
				getFirstPageOptions(
					crpc as unknown as typeof crpcServer,
					{ ...firstPageArgs, cursor: lastPage.continueCursor },
					true
				)
			);
			setAdditionalState((state) => ({
				key: firstPageKey,
				pages: state.key === firstPageKey ? [...state.pages, nextPage] : [nextPage],
			}));
		} catch (error) {
			setLoadMoreErrorState({
				error: error instanceof Error ? error : new Error(m.updates_load_failed()),
				key: firstPageKey,
			});
		} finally {
			setLoadingMore(false);
		}
	}

	const renderSearchInput = (id: string) => (
		<div className='relative min-w-0 flex-1'>
			<Search className='pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground' />
			<Input
				autoCapitalize='none'
				autoComplete='off'
				autoCorrect='off'
				className='min-w-0 pl-9'
				id={id}
				maxLength={MAX_SEARCH_CHARS}
				onChange={(event) => {
					setSearchTerm(event.target.value);
					scheduleSearch(event.target.value);
				}}
				placeholder={m.updates_search_placeholder()}
				spellCheck={false}
				value={searchTerm}
			/>
		</div>
	);

	const authorActions = canEdit ? (
		<div className='flex shrink-0 items-center gap-2'>
			<Button asChild>
				<Link params={{ org: orgSlug, project: projectSlug }} to='/@{$org}/$project/updates/new'>
					<CirclePlusOutline size='16px' /> {m.updates_new()}
				</Link>
			</Button>
			<Tooltip>
				<TooltipTrigger asChild delay={200}>
					<Button aria-label={m.updates_manage()} asChild size='icon' variant='outline'>
						<Link
							params={{ org: orgSlug, project: projectSlug }}
							search={{ pageSize: 20 }}
							to='/@{$org}/$project/updates/edit'
						>
							<Settings2 className='size-3.5' />
						</Link>
					</Button>
				</TooltipTrigger>
				<TooltipContent side='bottom'>{m.updates_manage()}</TooltipContent>
			</Tooltip>
		</div>
	) : null;

	const hasAnyContent = featuredItems.length > 0 || updates.length > 0;
	const showFeatured = featuredQuery.isPending || featuredItems.length > 0;

	return (
		<div className='flex w-full min-w-0 flex-1 flex-col'>
			{showFeatured ? (
				<div className='container w-full min-w-0 pt-8 pb-10 md:pt-10 md:pb-12'>
					{featuredQuery.isPending ? (
						<FeaturedSkeleton />
					) : (
						<FeaturedUpdatesSection
							items={featuredItems}
							orgSlug={orgSlug}
							projectSlug={projectSlug}
						/>
					)}
				</div>
			) : (
				<div className='pt-4' />
			)}

			{/* Full-bleed border with the category tabs sitting on top of it. */}
			<div className='w-full border-b'>
				<div className='container flex w-full min-w-0 items-end justify-between gap-4'>
					<CategoryTabs
						activeCategory={categoryParam}
						orgSlug={orgSlug}
						projectSlug={projectSlug}
						q={qParam}
					/>
					<div className='hidden min-w-0 items-center gap-2 pb-4 md:flex md:w-90 lg:w-105'>
						{renderSearchInput(SEARCH_INPUT_ID)}
						{authorActions}
					</div>
				</div>
			</div>

			<div className='container w-full min-w-0 pt-4 md:hidden'>
				<div className='flex min-w-0 items-center gap-2'>
					{renderSearchInput(`${SEARCH_INPUT_ID}-mobile`)}
					{authorActions}
				</div>
			</div>

			<div
				aria-busy={isInitialUpdatesLoading || refreshingUpdates || loadingMore}
				aria-live='polite'
				className='w-full min-w-0 flex-1 pb-10'
			>
				{isInitialUpdatesLoading ? (
					<div className='container'>
						<span className='sr-only'>{m.updates_loading()}</span>
						<UpdatesListSkeleton />
					</div>
				) : null}
				{!isInitialUpdatesLoading && updates.length === 0 ? (
					<div className='container pt-6'>
						<Notice icon={<Missing aria-hidden='true' size='32px' />}>
							{qParam && hasAnyContent ? m.updates_search_no_results() : m.updates_empty()}
						</Notice>
					</div>
				) : null}
				{updates.length > 0 ? (
					<>
						<ul className='flex flex-col'>
							{updates.map((update, index) => (
								<UpdateRow
									isLast={!canLoadMore && index === updates.length - 1}
									key={update.id}
									orgSlug={orgSlug}
									projectSlug={projectSlug}
									update={update}
								/>
							))}
						</ul>
						{canLoadMore ? (
							<div className='container flex justify-center pt-6'>
								<Button
									disabled={loadingMore}
									onClick={() => void loadMoreUpdates()}
									variant='outline'
								>
									{loadingMore ? m.updates_loading_more() : m.updates_load_more()}
								</Button>
							</div>
						) : null}
						{loadMoreError ? (
							<p className='container pt-4 text-center text-sm text-destructive'>
								{loadMoreError.message}
							</p>
						) : null}
					</>
				) : null}
			</div>
		</div>
	);
}
