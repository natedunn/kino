import type { FormEvent } from 'react';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router';
import { Search, SlidersHorizontal, X } from 'lucide-react';

import { RoutePending } from '@/components/route-pending';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { projectTitle, titleMeta } from '@/lib/seo';
import * as m from '@/paraglide/messages.js';

import { UpdateCard } from '../-components/update-card';

type UpdateCategory = 'changelog' | 'article' | 'announcement';

type UpdateSearch = {
	category?: UpdateCategory;
	cursor?: string;
	q?: string;
};

const UPDATE_CATEGORIES = new Set<UpdateCategory>(['changelog', 'article', 'announcement']);

function validateUpdatesAdvancedSearch(search: Record<string, unknown>): UpdateSearch {
	return {
		category:
			typeof search.category === 'string' &&
			UPDATE_CATEGORIES.has(search.category as UpdateCategory)
				? (search.category as UpdateCategory)
				: undefined,
		cursor: typeof search.cursor === 'string' ? search.cursor : undefined,
		q: typeof search.q === 'string' ? search.q.slice(0, 100) : undefined,
	};
}

export const Route = createFileRoute('/@{$org}/$project/updates/search/')({
	component: AdvancedUpdatesSearch,
	loaderDeps: ({ search }) => ({ category: search.category, q: search.q }),
	loader: async ({ context, params }) => {
		const projectData = await context.queryClient.ensureQueryData(
			crpcServer.project.getDetails.queryOptions({
				orgSlug: params.org,
				slug: params.project,
			})
		);

		if (!projectData?.project) {
			throw notFound();
		}
	},
	pendingComponent: () => <RoutePending variant='page' />,
	validateSearch: validateUpdatesAdvancedSearch,
	head: ({ params }) => ({
		meta: [titleMeta([m.updates_advanced_search(), projectTitle(params.org, params.project)])],
	}),
});

function AdvancedUpdatesSearch() {
	const params = Route.useParams();
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const queryClient = useQueryClient();
	const crpc = useCRPC();
	const [query, setQuery] = useState(search.q ?? '');

	useEffect(() => setQuery(search.q ?? ''), [search.q]);

	const { data: projectData } = useSuspenseQuery(
		crpc.project.getDetails.queryOptions({
			orgSlug: params.org,
			slug: params.project,
		})
	);

	if (!projectData?.project) {
		throw notFound();
	}

	const projectId = projectData.project.id;
	const hasFilters = Boolean(search.category || search.q);
	const currentProfileQuery = useQuery(
		crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true, subscribe: false })
	);
	const firstPageQuery = useQuery(
		{
			...crpc.update.searchProject.queryOptions({
				category: search.category,
				cursor: search.cursor ?? null,
				projectId,
				search: search.q,
			}),
			enabled: hasFilters,
		}
	);
	const [additionalPages, setAdditionalPages] = useState<
		Array<NonNullable<typeof firstPageQuery.data>>
	>([]);
	const [loadingMore, setLoadingMore] = useState(false);
	const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

	useEffect(() => {
		setAdditionalPages([]);
		setLoadMoreError(null);
	}, [search.category, search.q]);

	const pages = firstPageQuery.data ? [firstPageQuery.data, ...additionalPages] : additionalPages;
	const lastPage = additionalPages.at(-1) ?? firstPageQuery.data;
	const updates = pages
		.flatMap((page) => page.page)
		.filter(
			(item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index
		);
	const canLoadMore = !!lastPage && !lastPage.isDone && !!lastPage.continueCursor;

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		void navigate({
			replace: true,
			search: (previous) => ({
				...previous,
				cursor: undefined,
				q: query.trim() || undefined,
			}),
		});
	};

	const clear = () => {
		setQuery('');
		void navigate({ replace: true, search: {} });
	};

	async function loadMoreUpdates() {
		if (!canLoadMore || loadingMore || !lastPage?.continueCursor) return;

		setLoadingMore(true);
		setLoadMoreError(null);
		try {
			const nextPage = await queryClient.fetchQuery(
				crpc.update.searchProject.staticQueryOptions({
					category: search.category,
					cursor: lastPage.continueCursor,
					projectId,
					search: search.q,
				})
			);
			setAdditionalPages((pagesState) => [...pagesState, nextPage]);
		} catch (error) {
			setLoadMoreError(
				error instanceof Error ? error.message : m.updates_advanced_search_load_failed()
			);
		} finally {
			setLoadingMore(false);
		}
	}

	return (
		<div className='container flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden py-6'>
			<div className='mb-5'>
				<div className='flex items-center gap-2 text-sm font-medium'>
					<SlidersHorizontal className='size-4' /> {m.updates_advanced_search()}
				</div>
				<p className='mt-1 text-sm text-muted-foreground'>{m.updates_search_description()}</p>
			</div>
			<form className='rounded-xl border bg-card p-4 shadow-xs' onSubmit={submit}>
				<div className='relative'>
					<Search className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
					<Input
						className='h-10 pr-10 pl-9'
						onChange={(event) => setQuery(event.target.value)}
						placeholder={m.updates_search_placeholder()}
						value={query}
					/>
					{query ? (
						<button
							aria-label={m.updates_clear_query()}
							className='absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground'
							onClick={() => setQuery('')}
							type='button'
						>
							<X className='size-4' />
						</button>
					) : null}
				</div>
				<div className='mt-3 flex flex-wrap items-center gap-2'>
					<Select
						value={search.category ?? 'all'}
						onValueChange={(value) => {
							const nextValue = value ?? 'all';
							void navigate({
								replace: true,
								search: (previous) => ({
									...previous,
									category: nextValue === 'all' ? undefined : (nextValue as UpdateCategory),
									cursor: undefined,
								}),
							});
						}}
					>
						<SelectTrigger className='min-w-40'>
							<SelectValue>
								{(value: string | null) =>
									value && value !== 'all'
										? categoryLabel(value as UpdateCategory)
										: m.updates_all_categories()
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>{m.updates_all_categories()}</SelectItem>
							<SelectItem value='announcement'>{m.updates_category_announcement()}</SelectItem>
							<SelectItem value='article'>{m.updates_category_article()}</SelectItem>
							<SelectItem value='changelog'>{m.updates_category_changelog()}</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className='mt-3 flex justify-end gap-2'>
					{hasFilters ? (
						<Button onClick={clear} type='button' variant='ghost'>
							{m.common_clear()}
						</Button>
					) : null}
					<Button type='submit'>
						<Search className='size-4' /> {m.updates_search()}
					</Button>
				</div>
			</form>

			<div className='mt-5 overflow-hidden rounded-xl border bg-card shadow-xs'>
				<div className='flex h-11 items-center justify-between border-b bg-muted/20 px-4'>
					<p className='text-sm font-medium'>{m.updates_results()}</p>
					<p className='text-xs text-muted-foreground'>
						{m.files_on_page({ count: updates.length })}
					</p>
				</div>
				<div className='divide-y'>
					{hasFilters && firstPageQuery.isPending
						? Array.from({ length: 4 }).map((_, index) => (
								<div className='p-4' key={index}>
									<Skeleton className='h-24 w-full' />
								</div>
							))
						: null}
					{!hasFilters ? (
						<div className='px-4 py-20 text-center text-muted-foreground'>
							{m.updates_search_empty_idle()}
						</div>
					) : null}
					{hasFilters && !firstPageQuery.isPending && updates.length === 0 ? (
						<div className='px-4 py-20 text-center text-muted-foreground'>
							{m.updates_no_matching_results()}
						</div>
					) : null}
					{updates.length > 0 ? (
						<ul className='flex flex-col'>
							{updates.map((update, index) => (
								<UpdateCard
									key={update.id}
									currentProfileId={currentProfileQuery.data?.id}
									isLast={!canLoadMore && index === updates.length - 1}
									orgSlug={params.org}
									projectSlug={params.project}
									update={update}
									variant='search'
								/>
							))}
						</ul>
					) : null}
				</div>
			</div>

			{canLoadMore ? (
				<div className='mt-5 flex justify-center'>
					<Button disabled={loadingMore} onClick={() => void loadMoreUpdates()} variant='outline'>
						{loadingMore ? m.updates_loading_more() : m.updates_load_more()}
					</Button>
				</div>
			) : null}
			{loadMoreError ? (
				<p className='mt-3 text-center text-sm text-destructive'>{loadMoreError}</p>
			) : null}
		</div>
	);
}

function categoryLabel(category: UpdateCategory) {
	if (category === 'announcement') return m.updates_category_announcement();
	if (category === 'article') return m.updates_category_article();
	return m.updates_category_changelog();
}
