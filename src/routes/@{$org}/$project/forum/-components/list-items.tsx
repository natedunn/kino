import type { FunctionReturnType } from 'convex/server';
import type { ReactNode } from 'react';
import type { api as nativeApi } from '../../../../../../convex/native/_generated/api';

import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { CircleCheck, Lock, MessageSquare, Pin } from 'lucide-react';

import { BoardIcon } from '@/components/board-icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatRelativeDay } from '@/lib/utils/format-timestamp';
import * as m from '@/paraglide/messages.js';

export type TopicListItem = FunctionReturnType<typeof nativeApi.forum.list>['page'][number];

type RouteParams = { org: string; project: string };

// Unopened topics stop counting as new once they've been idle this long.
// Applied here because Convex queries can't read the clock.
const NEW_TOPIC_WINDOW = 14 * 24 * 60 * 60 * 1000;

type Unread = NonNullable<TopicListItem['unread']>;

function useNow() {
	const [now] = useState(() => Date.now());
	return now;
}

/** The viewer's unread state worth showing, or null when read or signed out. */
function visibleUnread(item: TopicListItem, now: number) {
	const unread = item.unread;
	if (!unread || unread.state === 'read') return null;
	if (unread.state === 'new' && item.lastActivityAt < now - NEW_TOPIC_WINDOW) return null;
	return unread;
}

// Signed-out viewers keep the default weight; signed-in ones see unread topics
// bold and read ones regular.
function titleWeight(item: TopicListItem, unread: Unread | null) {
	if (!item.unread) return 'font-medium';
	return unread ? 'font-semibold text-foreground' : 'font-normal';
}

export function TopicRow({
	item,
	params,
	showCategory,
}: {
	item: TopicListItem;
	params: RouteParams;
	/** Category chips are only useful when the list spans every category. */
	showCategory: boolean;
}) {
	const username = item.author?.username;
	const unread = visibleUnread(item, useNow());
	return (
		<li className='group relative flex gap-4 p-5 transition-colors focus-within:bg-accent/50 hover:bg-accent/50'>
			<Avatar className='mt-0.5 size-8 shrink-0 border' fallbackName={username ?? '?'}>
				<AvatarImage alt={username ?? ''} src={item.author?.imageUrl ?? undefined} />
				<AvatarFallback />
			</Avatar>
			<div className='flex min-w-0 flex-1 flex-col gap-1'>
				<div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
					<Link
						className={cn(
							'link-text text-lg after:absolute after:inset-0',
							titleWeight(item, unread)
						)}
						// The topic page jumps to the first unread reply.
						hash={unread?.state === 'replies' ? 'unread' : undefined}
						params={{ ...params, slug: item.slug }}
						preload='intent'
						to='/@{$org}/$project/forum/$slug'
					>
						{item.title}
					</Link>
					{unread ? <UnreadBadge unread={unread} /> : null}
					<TopicMarkers item={item} />
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
							<span>{m.forum_started_by({ username })}</span>
							<span aria-hidden='true'>·</span>
						</>
					) : null}
					<span>{m.forum_last_activity({ time: formatRelativeDay(item.lastActivityAt) })}</span>
				</p>
			</div>
			<ReplyCount className='pt-1' count={item.commentCount} />
		</li>
	);
}

/** Compact cards for the pinned topics shown above the list. */
export function PinnedTopics({
	items,
	params,
	showCategory,
}: {
	items: Array<TopicListItem>;
	params: RouteParams;
	showCategory: boolean;
}) {
	const now = useNow();
	return (
		<section aria-labelledby='pinned-topics' className='flex flex-col gap-2'>
			<h2
				className='flex items-center gap-1.5 text-sm font-bold text-muted-foreground'
				id='pinned-topics'
			>
				<Pin aria-hidden='true' className='size-3.5' />
				{m.forum_list_pinned()}
			</h2>
			<ul className='grid gap-3 sm:grid-cols-2'>
				{items.map((item) => {
					const unread = visibleUnread(item, now);
					return (
						<li
							className='relative flex flex-col gap-2 rounded-lg border bg-card p-4 transition-colors focus-within:bg-accent/50 hover:bg-accent/50'
							key={item.id}
						>
							<Link
								className={cn(
									'link-text line-clamp-2 after:absolute after:inset-0',
									titleWeight(item, unread)
								)}
								hash={unread?.state === 'replies' ? 'unread' : undefined}
								params={{ ...params, slug: item.slug }}
								preload='intent'
								to='/@{$org}/$project/forum/$slug'
							>
								{item.title}
							</Link>
							<div className='mt-auto flex items-center justify-between gap-2 text-xs text-muted-foreground'>
								<span className='flex min-w-0 items-center gap-2'>
									{unread ? <UnreadBadge unread={unread} /> : null}
									{showCategory && item.category ? <CategoryChip category={item.category} /> : null}
									{item.answered && item.category?.format === 'qa' ? <AnsweredBadge /> : null}
								</span>
								<ReplyCount className='text-xs [&_svg]:size-3.5' count={item.commentCount} />
							</div>
						</li>
					);
				})}
			</ul>
		</section>
	);
}

function UnreadBadge({ unread }: { unread: Unread }) {
	const label =
		unread.state === 'new'
			? m.forum_unread_new_label()
			: m.forum_unread_replies_label({ count: unread.newReplies });
	return (
		<Badge
			className='border-primary/30 bg-primary/10 text-foreground'
			title={label}
			variant='outline'
		>
			<span aria-hidden='true'>
				{unread.state === 'new'
					? m.forum_unread_new()
					: m.forum_unread_replies({ count: unread.newReplies })}
			</span>
			<span className='sr-only'>{label}</span>
		</Badge>
	);
}

function TopicMarkers({ item }: { item: TopicListItem }) {
	return (
		<>
			{item.pinned ? (
				<Marker label={m.forum_list_pinned()}>
					<Pin aria-hidden='true' className='size-3.5' />
				</Marker>
			) : null}
			{item.locked ? (
				<Marker label={m.forum_list_locked()}>
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
			{m.forum_list_answered()}
		</Badge>
	);
}

function CategoryChip({ category }: { category: NonNullable<TopicListItem['category']> }) {
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
			<span className='sr-only'>{m.forum_reply_count({ count })}</span>
			<span aria-hidden='true'>{count}</span>
		</div>
	);
}

export function TopicListSkeleton() {
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
