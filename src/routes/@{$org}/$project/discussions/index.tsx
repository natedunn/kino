import type { MouseEvent } from 'react';
import type { DiscussionsFilter, DiscussionsSort } from './-components/list-search';

import { useEffect, useRef, useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { usePaginatedQuery } from 'convex/react';
import { Bell, CircleQuestionMark, Lock, PanelLeftOpen, Search, SquarePen, X } from 'lucide-react';

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
import { projectTitle, titleMeta } from '@/lib/seo';
import { FORM_LIMITS } from '@/lib/validation';
import * as m from '@/paraglide/messages.js';

import { api as nativeApi } from '../../../../../convex/native/_generated/api';
import { CategoriesNav } from './-components/categories-nav';
import { DiscussionListSkeleton, DiscussionRow, PinnedDiscussions } from './-components/list-items';
import { validateDiscussionsSearch } from './-components/list-search';

const PAGE_SIZE = 25;
const SORT_OPTIONS = [
	{ label: m.discussions_list_sort_activity, value: 'activity' },
	{ label: m.discussions_list_sort_newest, value: 'newest' },
	{ label: m.discussions_list_sort_replies, value: 'replies' },
] as const;

export const Route = createFileRoute('/@{$org}/$project/discussions/')({
	validateSearch: validateDiscussionsSearch,
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
			convexQuery(nativeApi.discussions.viewerAccess, { projectId })
		);
		// Discussions can be switched off per project; the whole section 404s then.
		if (!access?.enabled) throw notFound();
		const categoryId = access.categories.find((item) => item.slug === deps.category)?.id;
		const pinned = convexQuery(nativeApi.discussions.pinned, {
			projectId,
			...(categoryId ? { categoryId } : {}),
		});
		if (typeof window === 'undefined') {
			await context.queryClient.ensureQueryData(pinned).catch(() => undefined);
		} else {
			void context.queryClient.prefetchQuery(pinned);
		}
	},
	head: ({ params }) => ({
		meta: [titleMeta([m.discussions_heading(), projectTitle(params.org, params.project)])],
	}),
	component: DiscussionsRoute,
});

function DiscussionsRoute() {
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
		convexQuery(nativeApi.discussions.viewerAccess, { projectId })
	);
	if (!access?.enabled) throw notFound();

	// Unknown slugs fall back to "All"; filters that can't apply are ignored.
	const category = access.categories.find((item) => item.slug === searchParams.category);
	const filter: DiscussionsFilter | undefined =
		searchParams.filter === 'unanswered'
			? category?.format === 'qa'
				? 'unanswered'
				: undefined
			: access.signedIn
				? searchParams.filter
				: undefined;
	// Search results are relevance-ordered, so sort only applies without one.
	const sort: DiscussionsSort = searchParams.sort ?? 'activity';
	const showCategory = !category;

	const { results, status, loadMore } = usePaginatedQuery(
		nativeApi.discussions.list,
		{
			projectId,
			...(category ? { categoryId: category.id } : {}),
			...(search ? { search } : { sort }),
			...(filter ? { filter } : {}),
		},
		{ initialNumItems: PAGE_SIZE }
	);
	const { data: pinned } = useQuery(
		convexQuery(nativeApi.discussions.pinned, {
			projectId,
			...(category ? { categoryId: category.id } : {}),
		})
	);
	const showPinned = !search && !filter && !!pinned?.length;

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
					{ icon: SquarePen, label: m.discussions_list_filter_mine(), value: 'mine' as const },
					{ icon: Bell, label: m.discussions_list_filter_following(), value: 'following' as const },
				]
			: []),
		...(category?.format === 'qa'
			? [
					{
						icon: CircleQuestionMark,
						label: m.discussions_list_filter_unanswered(),
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
				to='/@{$org}/$project/discussions/new'
			>
				<CirclePlusOutline size='16px' />
				{m.discussions_list_start()}
			</Link>
		</Button>
	) : null;

	const sidebar = (
		<>
			<div className='-mr-5 border-b pr-5 pb-6'>
				<h2 className='mx-2 text-sm font-bold text-muted-foreground'>
					{m.discussions_list_categories()}
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
					<h2 className='mx-2 text-sm font-bold text-muted-foreground'>
						{m.discussions_list_filters()}
					</h2>
					<SidebarNavGroup className='mt-2'>
						{filters.map(({ icon: Icon, label, value }) => (
							// Quick filters toggle: clicking the active one clears it.
							<Link
								key={value}
								params={params}
								search={(prev) => ({ ...prev, filter: filter === value ? undefined : value })}
								to='/@{$org}/$project/discussions'
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
										{category?.name ?? m.discussions_heading()}
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
											{m.discussions_description()}
										</p>
									)}
								</div>
								<Button
									aria-label={m.discussions_list_browse()}
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
										{m.discussions_category_team_only_notice()}
									</p>
								) : null}
								<div className='flex items-center gap-2'>
									<div className='relative min-w-0 flex-1'>
										<Search className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
										<Input
											aria-label={m.discussions_search_placeholder()}
											className='pr-10 pl-9'
											maxLength={FORM_LIMITS.discussionSearch}
											onChange={(event) => updateSearch(event.target.value)}
											placeholder={m.discussions_search_placeholder()}
											type='search'
											value={searchTerm}
										/>
										{searchTerm ? (
											<Button
												aria-label={m.discussions_clear_search()}
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
													}),
												})
											}
											value={sort}
										/>
									)}
								</div>
								{showPinned ? (
									<PinnedDiscussions items={pinned} params={params} showCategory={showCategory} />
								) : null}
								{status === 'LoadingFirstPage' ? (
									<DiscussionListSkeleton />
								) : results.length === 0 ? (
									<div className='flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/25 p-10 text-center text-muted-foreground'>
										<p>
											{search
												? m.discussions_empty_search()
												: filter === 'mine'
													? m.discussions_list_empty_mine()
													: filter === 'following'
														? m.discussions_list_empty_following()
														: filter === 'unanswered'
															? m.discussions_list_empty_unanswered()
															: category
																? m.discussions_list_empty_category({ category: category.name })
																: m.discussions_empty()}
										</p>
										{filter && !search ? (
											<Button asChild size='sm' variant='outline'>
												<Link
													params={params}
													search={(prev) => ({ ...prev, filter: undefined })}
													to='/@{$org}/$project/discussions'
												>
													{m.discussions_list_clear_filter()}
												</Link>
											</Button>
										) : null}
									</div>
								) : (
									<ul className='flex flex-col divide-y overflow-hidden rounded-lg border bg-card'>
										{results.map((item) => (
											<DiscussionRow
												item={item}
												key={item.id}
												params={params}
												showCategory={showCategory}
											/>
										))}
									</ul>
								)}
								{status === 'CanLoadMore' || status === 'LoadingMore' ? (
									<div>
										<Button
											disabled={status === 'LoadingMore'}
											onClick={() => loadMore(PAGE_SIZE)}
											variant='outline'
										>
											{status === 'LoadingMore'
												? m.discussions_loading()
												: m.discussions_load_more()}
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
					<ResponsiveDialogHeader icon={<PanelLeftOpen />} title={m.discussions_list_browse()} />
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
	onChange: (value: DiscussionsSort) => void;
	value: DiscussionsSort;
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
			<SelectTrigger aria-label={m.discussions_list_sort_label()} className='w-40 shrink-0'>
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
