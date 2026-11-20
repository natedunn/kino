import type { FunctionReturnType } from 'convex/server';
import type { ReactNode } from 'react';
import type { api as nativeApi } from '../../../../../../convex/native/_generated/api';

import { Link } from '@tanstack/react-router';
import { CircleCheck, Lock, MessageSquare, Pin } from 'lucide-react';

import { BoardIcon } from '@/components/board-icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatRelativeDay } from '@/lib/utils/format-timestamp';
import * as m from '@/paraglide/messages.js';

export type DiscussionListItem = FunctionReturnType<
	typeof nativeApi.discussions.list
>['page'][number];

type RouteParams = { org: string; project: string };

export function DiscussionRow({
	item,
	params,
	showCategory,
}: {
	item: DiscussionListItem;
	params: RouteParams;
	/** Category chips are only useful when the list spans every category. */
	showCategory: boolean;
}) {
	const username = item.author?.username;
	return (
		<li className='group relative flex gap-4 p-5 transition-colors focus-within:bg-accent/50 hover:bg-accent/50'>
			<Avatar className='mt-0.5 size-8 shrink-0 border' fallbackName={username ?? '?'}>
				<AvatarImage alt={username ?? ''} src={item.author?.imageUrl ?? undefined} />
				<AvatarFallback />
			</Avatar>
			<div className='flex min-w-0 flex-1 flex-col gap-1'>
				<div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
					<Link
						className='link-text text-lg font-medium after:absolute after:inset-0'
						params={{ ...params, slug: item.slug }}
						preload='intent'
						to='/@{$org}/$project/discussions/$slug'
					>
						{item.title}
					</Link>
					<DiscussionMarkers item={item} />
				</div>
				{item.excerpt ? (
					<p className='line-clamp-2 text-sm text-muted-foreground'>{item.excerpt}</p>
				) : null}
				<p
					className='mt-1 flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground'
					suppressHydrationWarning
				>
					{showCategory && item.category ? (
						<>
							<CategoryChip category={item.category} />
							<span aria-hidden='true'>·</span>
						</>
					) : null}
					{username ? (
						<>
							<span>{m.discussions_started_by({ username })}</span>
							<span aria-hidden='true'>·</span>
						</>
					) : null}
					<span>
						{m.discussions_last_activity({ time: formatRelativeDay(item.lastActivityAt) })}
					</span>
				</p>
			</div>
			<ReplyCount className='pt-1' count={item.commentCount} />
		</li>
	);
}

/** Compact cards for the pinned discussions shown above the list. */
export function PinnedDiscussions({
	items,
	params,
	showCategory,
}: {
	items: Array<DiscussionListItem>;
	params: RouteParams;
	showCategory: boolean;
}) {
	return (
		<section aria-labelledby='pinned-discussions' className='flex flex-col gap-2'>
			<h2
				className='flex items-center gap-1.5 text-sm font-bold text-muted-foreground'
				id='pinned-discussions'
			>
				<Pin aria-hidden='true' className='size-3.5' />
				{m.discussions_list_pinned()}
			</h2>
			<ul className='grid gap-3 sm:grid-cols-2'>
				{items.map((item) => (
					<li
						className='relative flex flex-col gap-2 rounded-lg border bg-card p-4 transition-colors focus-within:bg-accent/50 hover:bg-accent/50'
						key={item.id}
					>
						<Link
							className='link-text line-clamp-2 font-medium after:absolute after:inset-0'
							params={{ ...params, slug: item.slug }}
							preload='intent'
							to='/@{$org}/$project/discussions/$slug'
						>
							{item.title}
						</Link>
						<div className='mt-auto flex items-center justify-between gap-2 text-xs text-muted-foreground'>
							<span className='flex min-w-0 items-center gap-2'>
								{showCategory && item.category ? <CategoryChip category={item.category} /> : null}
								{item.answered && item.category?.format === 'qa' ? <AnsweredBadge /> : null}
							</span>
							<ReplyCount className='text-xs [&_svg]:size-3.5' count={item.commentCount} />
						</div>
					</li>
				))}
			</ul>
		</section>
	);
}

function DiscussionMarkers({ item }: { item: DiscussionListItem }) {
	return (
		<>
			{item.pinned ? (
				<Marker label={m.discussions_list_pinned()}>
					<Pin aria-hidden='true' className='size-3.5' />
				</Marker>
			) : null}
			{item.locked ? (
				<Marker label={m.discussions_list_locked()}>
					<Lock aria-hidden='true' className='size-3.5' />
				</Marker>
			) : null}
			{item.answered && item.category?.format === 'qa' ? <AnsweredBadge /> : null}
		</>
	);
}

function Marker({ label, children }: { label: string; children: ReactNode }) {
	return (
		<span className='inline-flex text-muted-foreground' title={label}>
			{children}
			<span className='sr-only'>{label}</span>
		</span>
	);
}

function AnsweredBadge() {
	return (
		<Badge
			className='border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
			variant='outline'
		>
			<CircleCheck aria-hidden='true' />
			{m.discussions_list_answered()}
		</Badge>
	);
}

function CategoryChip({ category }: { category: NonNullable<DiscussionListItem['category']> }) {
	return (
		<span className='inline-flex min-w-0 items-center gap-1'>
			<BoardIcon icon={category.icon} name={category.name} size='12px' />
			<span className='truncate'>{category.name}</span>
		</span>
	);
}

function ReplyCount({ className, count }: { className?: string; count: number }) {
	return (
		<div
			className={cn('flex shrink-0 items-start gap-1.5 text-sm text-muted-foreground', className)}
		>
			<MessageSquare aria-hidden='true' className='size-4' />
			<span className='sr-only'>{m.discussions_reply_count({ count })}</span>
			<span aria-hidden='true'>{count}</span>
		</div>
	);
}

export function DiscussionListSkeleton() {
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
