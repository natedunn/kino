import type { MouseEvent } from 'react';
import type { ForumFilter, ForumPeriod, ForumSort } from './-components/list-search';

import { useEffect, useRef, useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { useMutation, usePaginatedQuery } from 'convex/react';
import {
	Bell,
	CheckCheck,
	CircleQuestionMark,
	Lock,
	PanelLeftOpen,
	Search,
	SquarePen,
	X,
} from 'lucide-react';

import { SidebarNavGroup, SidebarNavItem } from '@/components/sidebar-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	ResponsiveDialog,
	ResponsiveDialogBody,
	ResponsiveDialogContent,
	ResponsiveDialogHeader,
} from '@/components/ui/responsive-dialog';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import CirclePlusOutline from '@/icons/circle-plus-outline';
import { localizeError } from '@/lib/errors';
import { projectTitle, titleMeta } from '@/lib/seo';
import { toast } from '@/lib/toast';
import { FORM_LIMITS } from '@/lib/validation';
import * as m from '@/paraglide/messages.js';

import { api as nativeApi } from '../../../../../convex/native/_generated/api';
import { CategoriesNav } from './-components/categories-nav';
import { CategoryOverview } from './-components/category-overview';
import { PinnedTopics, TopicListSkeleton, TopicRow } from './-components/list-items';
import { DEFAULT_PERIOD, periodStart, validateForumSearch } from './-components/list-search';

const PAGE_SIZE = 25;
const SORT_OPTIONS = [
	{ label: m.forum_list_sort_activity, value: 'activity' },
	{ label: m.forum_list_sort_newest, value: 'newest' },
	{ label: m.forum_list_sort_replies, value: 'replies' },
	{ label: m.forum_list_sort_top, value: 'top' },
] as const;
const PERIOD_OPTIONS = [
	{ label: m.forum_list_period_week, value: 'week' },
	{ label: m.forum_list_period_month, value: 'month' },
	{ label: m.forum_list_period_year, value: 'year' },
	{ label: m.forum_list_period_all, value: 'all' },
] as const;

export const Route = createFileRoute('/@{$org}/$project/forum/')({
	validateSearch: validateForumSearch,
	loaderDeps: ({ search }) => ({ category: search.category }),
	loader: async ({ context, deps, params }) => {
		const projectData = await context.queryClient.ensureQueryData(
			convexQuery(nativeApi.projects.getBySlugs, {
				organizationSlug: params.org,
				projectSlug: params.project,
			})
		);
		if (!projectData?.project) throw notFound();
		const projectId = projectData.project.id;
		const access = await context.queryClient.ensureQueryData(
			convexQuery(nativeApi.forum.viewerAccess, { projectId })
		);
		// The forum can be switched off per project; the whole section 404s then.
		if (!access?.enabled) throw notFound();
		const categoryId = access.categories.find((item) => item.slug === deps.category)?.id;
		const pinned = convexQuery(nativeApi.forum.pinned, {
			projectId,
			...(categoryId ? { categoryId } : {}),
		});
		// The categories overview only shows on "All".
		const overview = categoryId ? null : convexQuery(nativeApi.forumStats.overview, { projectId });
		if (typeof window === 'undefined') {
			await Promise.all([
				context.queryClient.ensureQueryData(pinned).catch(() => undefined),
				overview ? context.queryClient.ensureQueryData(overview).catch(() => undefined) : undefined,
			]);
		} else {
			void context.queryClient.prefetchQuery(pinned);
			if (overview) void context.queryClient.prefetchQuery(overview);
		}
	},
	head: ({ params }) => ({
		meta: [titleMeta([m.forum_heading(), projectTitle(params.org, params.project)])],
	}),
	component: ForumRoute,
});

function ForumRoute() {
	const params = Route.useParams();
	const searchParams = Route.useSearch();
	const { search } = searchParams;
	const navigate = Route.useNavigate();
	const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
	const { data: projectData } = useSuspenseQuery(
		convexQuery(nativeApi.projects.getBySlugs, {
			organizationSlug: params.org,
			projectSlug: params.project,
		})
	);
	if (!projectData?.project) throw notFound();
	const projectId = projectData.project.id;
	const { data: access } = useSuspenseQuery(
		convexQuery(nativeApi.forum.viewerAccess, { projectId })
	);
	if (!access?.enabled) throw notFound();

	// Unknown slugs fall back to "All"; filters that can't apply are ignored.
	const category = access.categories.find((item) => item.slug === searchParams.category);
	const filter: ForumFilter | undefined =
		searchParams.filter === 'unanswered'
			? category?.format === 'qa'
				? 'unanswered'
				: undefined
			: access.signedIn
				? searchParams.filter
				: undefined;
	// Search results are relevance-ordered, so sort only applies without one.
	const sort: ForumSort = searchParams.sort ?? 'activity';
	const period: ForumPeriod = searchParams.period ?? DEFAULT_PERIOD;
	const showCategory = !category;
	// Captured once: queries can't read the clock, and a fixed, hour-rounded
	// cutoff keeps the paginated query's args stable.
	const [now] = useState(() => Date.now());
	// The server ignores the window for "Mine" and "Following", which keep their own order.
	const since =
		!search && sort === 'top' && filter !== 'mine' && filter !== 'following'
			? periodStart(period, now)
			: undefined;

	const listArgs = {
		projectId,
		...(category ? { categoryId: category.id } : {}),
		...(search ? { search } : { sort }),
		...(since !== undefined ? { since } : {}),
		...(filter ? { filter } : {}),
	};
	const { results, status, loadMore } = usePaginatedQuery(nativeApi.forum.list, listArgs, {
		initialNumItems: PAGE_SIZE,
	});
	// Windowed "Top" pages skip older topics within a read budget, so a page can
	// come back short. Keep loading until the requested count is on screen.
	const listKey = JSON.stringify(listArgs);
	const [wanted, setWanted] = useState({ key: listKey, count: PAGE_SIZE });
	const wantedCount = wanted.key === listKey ? wanted.count : PAGE_SIZE;
	const windowed = since !== undefined;
	useEffect(() => {
		if (windowed && status === 'CanLoadMore' && results.length < wantedCount) loadMore(PAGE_SIZE);
	}, [windowed, status, results.length, wantedCount, loadMore]);
	const filling = windowed && results.length < wantedCount && status !== 'Exhausted';
	function showMore() {
		setWanted({ key: listKey, count: wantedCount + PAGE_SIZE });
		loadMore(PAGE_SIZE);
	}
	const showOverview = !category && !search && !filter;
	const { data: overview } = useQuery({
		...convexQuery(nativeApi.forumStats.overview, { projectId }),
		enabled: showOverview,
	});
	const { data: pinned } = useQuery(
		convexQuery(nativeApi.forum.pinned, {
			projectId,
			...(category ? { categoryId: category.id } : {}),
		})
	);
	const showPinned = !search && !filter && !!pinned?.length;
	const markAllRead = useMutation(nativeApi.forumReads.markAllRead);

	const [searchTerm, setSearchTerm] = useState(search ?? '');
	const searchTimeout = useRef<number | null>(null);
	useEffect(
		() => () => {
			if (searchTimeout.current !== null) window.clearTimeout(searchTimeout.current);
		},
		[]
	);
	function updateSearch(value: string) {
		setSearchTerm(value);
		if (searchTimeout.current !== null) window.clearTimeout(searchTimeout.current);
		searchTimeout.current = window.setTimeout(() => {
			void navigate({
				search: (prev) => ({ ...prev, search: value.trim() || undefined }),
				replace: true,
			});
		}, 250);
	}

	const filters = [
		...(access.signedIn
			? [
					{ icon: SquarePen, label: m.forum_list_filter_mine(), value: 'mine' as const },
					{ icon: Bell, label: m.forum_list_filter_following(), value: 'following' as const },
				]
			: []),
		...(category?.format === 'qa'
			? [
					{
						icon: CircleQuestionMark,
						label: m.forum_list_filter_unanswered(),
						value: 'unanswered' as const,
					},
				]
			: []),
	];

	const startButton = access.canCreate ? (
		<Button asChild>
			<Link
				params={params}
				search={category?.canPost ? { category: category.slug } : {}}
				to='/@{$org}/$project/forum/new'
			>
				<CirclePlusOutline size='16px' />
				{m.forum_list_start()}
			</Link>
		</Button>
	) : null;

	const sidebar = (
		<>
			<div className='-mr-5 border-b pr-5 pb-6'>
				<h2 className='mx-2 text-sm font-bold text-muted-foreground'>
					{m.forum_list_categories()}
				</h2>
				<div className='mt-2'>
					<CategoriesNav
						categories={access.categories}
						org={params.org}
						project={params.project}
						selectedSlug={category?.slug}
					/>
				</div>
			</div>
			{filters.length ? (
				<div className='mt-6 pb-6'>
					<h2 className='mx-2 text-sm font-bold text-muted-foreground'>{m.forum_list_filters()}</h2>
					<SidebarNavGroup className='mt-2'>
						{filters.map(({ icon: Icon, label, value }) => (
							// Quick filters toggle: clicking the active one clears it.
							<Link
								key={value}
								params={params}
								search={(prev) => ({ ...prev, filter: filter === value ? undefined : value })}
								to='/@{$org}/$project/forum'
							>
								<SidebarNavItem
									active={filter === value}
									className='data-[active]:pointer-events-auto'
									icon={<Icon className='size-4' />}
								>
									{label}
								</SidebarNavItem>
							</Link>
						))}
						{access.signedIn ? (
							<Button
								className='group w-full justify-start'
								onClick={() =>
									void markAllRead({ projectId }).catch(
										(error: unknown) => void toast.error(localizeError(error))
									)
								}
								variant='ghost'
							>
								<span className='inline-flex items-center gap-3'>
									<span className='opacity-60 transition-opacity group-hover:opacity-100'>
										<CheckCheck className='size-4' />
									</span>
									{m.forum_unread_mark_all()}
								</span>
							</Button>
						) : null}
					</SidebarNavGroup>
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
						<aside className='hidden h-full min-h-0 min-w-0 overflow-hidden border-r border-border/75 lg:block'>
							<div className='sticky top-0 flex h-full w-[17rem] flex-col overflow-hidden'>
								<div className='flex h-[81px] shrink-0 items-center pr-5'>{startButton}</div>
								<div className='mt-4 min-h-0 flex-1 overflow-y-auto pr-5 pb-6'>{sidebar}</div>
							</div>
						</aside>
						<div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
							<div className='flex h-[81px] shrink-0 items-center justify-between gap-4 lg:pl-7'>
								<div className='flex min-w-0 flex-col gap-0.5'>
									<h1 className='truncate text-xl font-bold md:text-2xl'>
										{category?.name ?? m.forum_heading()}
									</h1>
									{category ? (
										category.description ? (
											<p
												className='truncate text-sm text-muted-foreground'
												title={category.description}
											>
												{category.description}
											</p>
										) : null
									) : (
										<p className='truncate text-sm text-muted-foreground'>
											{m.forum_description()}
										</p>
									)}
								</div>
								<Button
									aria-label={m.forum_list_browse()}
									className='lg:hidden'
									onClick={() => setMobileSidebarOpen(true)}
									size='icon'
									variant='outline'
								>
									<PanelLeftOpen />
								</Button>
							</div>
							<div
								aria-busy={status === 'LoadingFirstPage' || status === 'LoadingMore'}
								className='flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto py-6 lg:pl-7'
							>
								{category?.postingPolicy === 'team' && !category.canPost && access.writable ? (
									<p className='-mb-2 flex items-center gap-2 text-sm text-muted-foreground'>
										<Lock aria-hidden='true' className='size-3.5 shrink-0' />
										{m.forum_category_team_only_notice()}
									</p>
								) : null}
								<div className='flex flex-wrap items-center gap-2'>
									<div className='relative min-w-48 flex-1'>
										<Search className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
										<Input
											aria-label={m.forum_search_placeholder()}
											className='pr-10 pl-9'
											maxLength={FORM_LIMITS.forumSearch}
											onChange={(event) => updateSearch(event.target.value)}
											placeholder={m.forum_search_placeholder()}
											type='search'
											value={searchTerm}
										/>
										{searchTerm ? (
											<Button
												aria-label={m.forum_clear_search()}
												className='absolute top-1/2 right-1 -translate-y-1/2'
												onClick={() => updateSearch('')}
												size='icon'
												variant='ghost'
											>
												<X className='size-4' />
											</Button>
										) : null}
									</div>
									{search ? null : (
										<SortSelect
											onChange={(value) =>
												void navigate({
													search: (prev) => ({
														...prev,
														sort: value === 'activity' ? undefined : value,
														period: value === 'top' ? prev.period : undefined,
													}),
												})
											}
											value={sort}
										/>
									)}
									{!search && sort === 'top' ? (
										<PeriodSelect
											onChange={(value) =>
												void navigate({
													search: (prev) => ({
														...prev,
														period: value === DEFAULT_PERIOD ? undefined : value,
													}),
												})
											}
											value={period}
										/>
									) : null}
								</div>
								{showPinned ? (
									<PinnedTopics items={pinned} params={params} showCategory={showCategory} />
								) : null}
								{showOverview ? (
									<>
										<CategoryOverview categories={overview ?? undefined} params={params} />
										<h2 className='-mb-4 text-sm font-bold text-muted-foreground'>
											{sort === 'activity'
												? m.forum_overview_latest()
												: SORT_OPTIONS.find((option) => option.value === sort)?.label()}
										</h2>
									</>
								) : null}
								{status === 'LoadingFirstPage' || (filling && results.length === 0) ? (
									<TopicListSkeleton />
								) : results.length === 0 ? (
									<div className='flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/25 p-10 text-center text-muted-foreground'>
										<p>
											{search
												? m.forum_empty_search()
												: filter === 'mine'
													? m.forum_list_empty_mine()
													: filter === 'following'
														? m.forum_list_empty_following()
														: filter === 'unanswered'
															? m.forum_list_empty_unanswered()
															: windowed
																? m.forum_list_empty_period()
																: category
																	? m.forum_list_empty_category({ category: category.name })
																	: m.forum_empty()}
										</p>
										{filter && !search ? (
											<Button asChild size='sm' variant='outline'>
												<Link
													params={params}
													search={(prev) => ({ ...prev, filter: undefined })}
													to='/@{$org}/$project/forum'
												>
													{m.forum_list_clear_filter()}
												</Link>
											</Button>
										) : null}
									</div>
								) : (
									<ul className='flex flex-col divide-y overflow-hidden rounded-lg border bg-card'>
										{results.map((item) => (
											<TopicRow
												item={item}
												key={item.id}
												params={params}
												showCategory={showCategory}
												showScore={!search && sort === 'top'}
											/>
										))}
									</ul>
								)}
								{(status === 'CanLoadMore' || status === 'LoadingMore') &&
								!(filling && results.length === 0) ? (
									<div>
										<Button
											disabled={status === 'LoadingMore' || filling}
											onClick={showMore}
											variant='outline'
										>
											{status === 'LoadingMore' || filling
												? m.forum_loading()
												: m.forum_load_more()}
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
					<ResponsiveDialogHeader icon={<PanelLeftOpen />} title={m.forum_list_browse()} />
					{/* Any link inside closes the dialog once it navigates. */}
					<ResponsiveDialogBody className='p-3' onClick={closeOnLinkClick(setMobileSidebarOpen)}>
						{startButton ? <div className='mb-3 border-b pb-3'>{startButton}</div> : null}
						{sidebar}
					</ResponsiveDialogBody>
				</ResponsiveDialogContent>
			</ResponsiveDialog>
		</>
	);
}

function closeOnLinkClick(setOpen: (open: boolean) => void) {
	return (event: MouseEvent<HTMLElement>) => {
		if (event.target instanceof Element && event.target.closest('a')) setOpen(false);
	};
}

function SortSelect({
	onChange,
	value,
}: {
	onChange: (value: ForumSort) => void;
	value: ForumSort;
}) {
	const options = SORT_OPTIONS.map((option) => ({ ...option, label: option.label() }));
	return (
		<Select
			items={options}
			onValueChange={(next) => {
				if (next) onChange(next);
			}}
			value={value}
		>
			<SelectTrigger aria-label={m.forum_list_sort_label()} className='w-40 shrink-0'>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function PeriodSelect({
	onChange,
	value,
}: {
	onChange: (value: ForumPeriod) => void;
	value: ForumPeriod;
}) {
	const options = PERIOD_OPTIONS.map((option) => ({ ...option, label: option.label() }));
	return (
		<Select
			items={options}
			onValueChange={(next) => {
				if (next) onChange(next);
			}}
			value={value}
		>
			<SelectTrigger aria-label={m.forum_list_period_label()} className='w-36 shrink-0'>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
