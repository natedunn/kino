import type { FunctionReturnType } from 'convex/server';

import { useEffect, useRef, useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { usePaginatedQuery } from 'convex/react';
import { MessageSquare, Search, X } from 'lucide-react';

import { InlineAlert } from '@/components/inline-alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import CirclePlusOutline from '@/icons/circle-plus-outline';
import { projectTitle, titleMeta } from '@/lib/seo';
import { formatRelativeDay } from '@/lib/utils/format-timestamp';
import { FORM_LIMITS } from '@/lib/validation';
import * as m from '@/paraglide/messages.js';

import { api as nativeApi } from '../../../../../convex/native/_generated/api';

const PAGE_SIZE = 25;

type DiscussionsSearch = { search?: string };

export const Route = createFileRoute('/@{$org}/$project/discussions/')({
	validateSearch: (search: Record<string, unknown>): DiscussionsSearch => {
		const value = typeof search.search === 'string' ? search.search.trim() : '';
		return value ? { search: value.slice(0, FORM_LIMITS.discussionSearch) } : {};
	},
	loader: async ({ context, params }) => {
		const projectData = await context.queryClient.ensureQueryData(
			convexQuery(nativeApi.projects.getBySlugs, {
				organizationSlug: params.org,
				projectSlug: params.project,
			})
		);
		if (!projectData?.project) throw notFound();
		await context.queryClient.ensureQueryData(
			convexQuery(nativeApi.discussions.viewerAccess, { projectId: projectData.project.id })
		);
	},
	head: ({ params }) => ({
		meta: [titleMeta([m.discussions_heading(), projectTitle(params.org, params.project)])],
	}),
	component: DiscussionsRoute,
});

function DiscussionsRoute() {
	const params = Route.useParams();
	const { search } = Route.useSearch();
	const navigate = Route.useNavigate();
	const { data: projectData } = useSuspenseQuery(
		convexQuery(nativeApi.projects.getBySlugs, {
			organizationSlug: params.org,
			projectSlug: params.project,
		})
	);
	if (!projectData?.project) throw notFound();
	const projectId = projectData.project.id;
	const { data: access } = useQuery(convexQuery(nativeApi.discussions.viewerAccess, { projectId }));
	const { results, status, loadMore } = usePaginatedQuery(
		nativeApi.discussions.list,
		{ projectId, ...(search ? { search } : {}) },
		{ initialNumItems: PAGE_SIZE }
	);

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
			void navigate({ search: value.trim() ? { search: value.trim() } : {}, replace: true });
		}, 250);
	}

	return (
		<div className='flex flex-1 flex-col'>
			<div className='border-b'>
				<div className='container flex flex-col gap-4 pt-10 pb-6 [--max-width:52rem] sm:flex-row sm:items-end sm:justify-between'>
					<div className='flex flex-col gap-1'>
						<h1 className='text-2xl font-bold md:text-3xl'>{m.discussions_heading()}</h1>
						<p className='text-sm text-muted-foreground'>{m.discussions_description()}</p>
					</div>
					{access?.canCreate ? (
						<Button asChild>
							<Link params={params} to='/@{$org}/$project/discussions/new'>
								<CirclePlusOutline size='16px' />
								{m.discussions_new()}
							</Link>
						</Button>
					) : null}
				</div>
			</div>
			<div className='container flex flex-col gap-6 py-6 [--max-width:52rem]'>
				{access?.postingPolicy === 'team' && !access.canCreate && access.writable ? (
					<InlineAlert>{m.discussions_team_only_notice()}</InlineAlert>
				) : null}
				<div className='relative'>
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
				{status === 'LoadingFirstPage' ? (
					<DiscussionListSkeleton />
				) : results.length === 0 ? (
					<div className='rounded-lg border border-dashed bg-muted/25 p-10 text-center text-muted-foreground'>
						{search ? m.discussions_empty_search() : m.discussions_empty()}
					</div>
				) : (
					<ul className='flex flex-col divide-y overflow-hidden rounded-lg border bg-card'>
						{results.map((item) => (
							<DiscussionRow item={item} key={item.id} params={params} />
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
							{status === 'LoadingMore' ? m.discussions_loading() : m.discussions_load_more()}
						</Button>
					</div>
				) : null}
			</div>
		</div>
	);
}

type DiscussionListItem = FunctionReturnType<typeof nativeApi.discussions.list>['page'][number];

function DiscussionRow({
	item,
	params,
}: {
	item: DiscussionListItem;
	params: { org: string; project: string };
}) {
	const username = item.author?.username;
	return (
		<li className='group relative flex gap-4 p-5 transition-colors focus-within:bg-accent/50 hover:bg-accent/50'>
			<Avatar className='mt-0.5 size-8 shrink-0 border' fallbackName={username ?? '?'}>
				<AvatarImage alt={username ?? ''} src={item.author?.imageUrl ?? undefined} />
				<AvatarFallback />
			</Avatar>
			<div className='flex min-w-0 flex-1 flex-col gap-1'>
				<Link
					className='link-text text-lg font-medium after:absolute after:inset-0'
					params={{ ...params, slug: item.slug }}
					preload='intent'
					to='/@{$org}/$project/discussions/$slug'
				>
					{item.title}
				</Link>
				{item.excerpt ? (
					<p className='line-clamp-2 text-sm text-muted-foreground'>{item.excerpt}</p>
				) : null}
				<p className='mt-1 text-xs text-muted-foreground' suppressHydrationWarning>
					{username ? m.discussions_started_by({ username }) : null}
					{username ? ' · ' : null}
					{m.discussions_last_activity({ time: formatRelativeDay(item.lastActivityAt) })}
				</p>
			</div>
			<div className='flex shrink-0 items-start gap-1.5 pt-1 text-sm text-muted-foreground'>
				<MessageSquare aria-hidden='true' className='size-4' />
				<span className='sr-only'>{m.discussions_reply_count({ count: item.commentCount })}</span>
				<span aria-hidden='true'>{item.commentCount}</span>
			</div>
		</li>
	);
}

function DiscussionListSkeleton() {
	return (
		<div aria-hidden='true' className='flex flex-col divide-y rounded-lg border'>
			{Array.from({ length: 4 }).map((_, index) => (
				<div className='flex gap-4 p-5' key={index}>
					<Skeleton className='size-8 shrink-0 rounded-full' />
					<div className='flex-1'>
						<Skeleton className='h-5 w-1/2' />
						<Skeleton className='mt-3 h-4 w-full' />
						<Skeleton className='mt-2 h-3 w-1/3' />
					</div>
				</div>
			))}
		</div>
	);
}
