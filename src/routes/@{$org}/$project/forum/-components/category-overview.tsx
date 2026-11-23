import type { FunctionReturnType } from 'convex/server';
import type { api as nativeApi } from '../../../../../../convex/native/_generated/api';

import { Link } from '@tanstack/react-router';
import { Lock, MessageSquare } from 'lucide-react';

import { BoardIcon } from '@/components/board-icon';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeDay } from '@/lib/utils/format-timestamp';
import * as m from '@/paraglide/messages.js';

import { withCategory } from './list-search';

type CategoryStats = NonNullable<FunctionReturnType<typeof nativeApi.forumStats.overview>>[number];

type RouteParams = { org: string; project: string };

/**
 * The forum home: one card per category with its topic count and most
 * recently active topic, like a classic forum index.
 */
export function CategoryOverview({
	categories,
	params,
}: {
	/** Undefined while loading. */
	categories: Array<CategoryStats> | undefined;
	params: RouteParams;
}) {
	return (
		<section aria-labelledby='forum-categories' className='flex flex-col gap-2'>
			<h2 className='text-sm font-bold text-muted-foreground' id='forum-categories'>
				{m.forum_list_categories()}
			</h2>
			{categories ? (
				<ul className='grid gap-3 sm:grid-cols-2'>
					{categories.map((category) => (
						<CategoryCard category={category} key={category.id} params={params} />
					))}
				</ul>
			) : (
				<div aria-hidden='true' className='grid gap-3 sm:grid-cols-2'>
					{Array.from({ length: 4 }).map((_, index) => (
						<Skeleton className='h-32 rounded-lg' key={index} />
					))}
				</div>
			)}
		</section>
	);
}

function CategoryCard({ category, params }: { category: CategoryStats; params: RouteParams }) {
	return (
		<li className='relative flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors focus-within:bg-accent/50 hover:bg-accent/50'>
			<div className='flex items-start gap-3'>
				<span className='mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-background'>
					<BoardIcon icon={category.icon} name={category.name} size='16px' />
				</span>
				<div className='flex min-w-0 flex-1 flex-col gap-0.5'>
					<div className='flex items-center justify-between gap-2'>
						<Link
							className='link-text truncate font-semibold after:absolute after:inset-0'
							params={params}
							search={(prev) => withCategory(prev, category)}
							to='/@{$org}/$project/forum'
						>
							{category.name}
						</Link>
						<span className='flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground'>
							{category.postingPolicy === 'team' ? (
								<span title={m.forum_category_team_only()}>
									<Lock aria-hidden='true' className='size-3' />
									<span className='sr-only'>{m.forum_category_team_only()}</span>
								</span>
							) : null}
							{m.forum_overview_topic_count({ count: category.topicCount })}
						</span>
					</div>
					{category.description ? (
						<p className='line-clamp-2 text-sm text-muted-foreground'>{category.description}</p>
					) : null}
				</div>
			</div>
			<div
				className='mt-auto flex min-w-0 items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground'
				suppressHydrationWarning
			>
				<MessageSquare aria-hidden='true' className='size-3.5 shrink-0' />
				{category.latest ? (
					<>
						<span className='sr-only'>{m.forum_overview_latest_topic()}</span>
						{/* Sits above the card's stretched link so it stays clickable. */}
						<Link
							className='link-text relative z-10 min-w-0 truncate text-sm'
							params={{ ...params, slug: category.latest.slug }}
							preload='intent'
							title={category.latest.title}
							to='/@{$org}/$project/forum/$slug'
						>
							{category.latest.title}
						</Link>
						<span aria-hidden='true'>·</span>
						<span className='shrink-0'>{formatRelativeDay(category.latest.lastActivityAt)}</span>
					</>
				) : (
					<span>{m.forum_overview_no_topics()}</span>
				)}
			</div>
		</li>
	);
}
