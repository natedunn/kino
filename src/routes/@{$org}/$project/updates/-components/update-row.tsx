import type { UpdateCategory } from './category-badge';

import { Link } from '@tanstack/react-router';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatFullDate } from '@/lib/utils/format-timestamp';
import * as m from '@/paraglide/messages.js';

import { CategoryBadge } from './category-badge';

export type UpdateRowItem = {
	author: { id: string; imageUrl?: string | null; name: string; username: string } | null;
	category: UpdateCategory;
	id: string;
	publishedAt?: number | null;
	slug: string;
	status: 'draft' | 'published';
	title: string;
};

// Minimal inline row for the updates index list: title on the left; category,
// author, and date on the right. The full update opens on its detail page.
export function UpdateRow({
	isLast = false,
	orgSlug,
	projectSlug,
	update,
}: {
	isLast?: boolean;
	orgSlug: string;
	projectSlug: string;
	update: UpdateRowItem;
}) {
	return (
		<li className={cn('relative min-w-0', !isLast && 'border-b border-border/75')}>
			<Link
				className='group block w-full transition-colors outline-none hover:bg-muted/30 focus-visible:bg-primary/10'
				params={{ org: orgSlug, project: projectSlug, slug: update.slug }}
				to='/@{$org}/$project/updates/$slug'
			>
				{/* The link itself spans the viewport so the whole row is a hover and
				    click target; this inner wrapper keeps the content aligned to the
				    page container. */}
				<div className='container flex min-w-0 items-center gap-3 py-4 sm:gap-4'>
					<span className='link-text min-w-0 flex-1 truncate font-medium'>{update.title}</span>
					{update.status === 'draft' ? (
						<Badge className='shrink-0 text-yellow-600 dark:text-yellow-400' variant='outline'>
							{m.updates_status_draft()}
						</Badge>
					) : null}
					<CategoryBadge category={update.category} className='hidden shrink-0 sm:inline-flex' />
					{update.author ? (
						<Avatar className='size-5 shrink-0' fallbackName={update.author.username}>
							<AvatarImage alt={update.author.username} src={update.author.imageUrl ?? undefined} />
							<AvatarFallback />
						</Avatar>
					) : null}
					{update.publishedAt ? (
						<span
							className='shrink-0 text-sm whitespace-nowrap text-muted-foreground tabular-nums'
							suppressHydrationWarning
						>
							{formatFullDate(update.publishedAt)}
						</span>
					) : null}
				</div>
			</Link>
		</li>
	);
}
