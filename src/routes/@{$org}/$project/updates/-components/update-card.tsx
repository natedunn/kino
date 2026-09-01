import { memo } from 'react';
import { Link } from '@tanstack/react-router';
import { Calendar, Heart, MessageSquare } from 'lucide-react';

import { formatInlineCode } from '@/components/editor/format-inline-code';
import { sanitizeEditorContent } from '@/components/editor/sanitize-content';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatFullDate } from '@/lib/utils/format-timestamp';
import * as m from '@/paraglide/messages.js';

import { CategoryBadge } from './category-badge';
import { useEmoteToggle } from './use-emote-toggle';

const SEARCH_PREVIEW_CHARS = 420;

function UpdateCardContent({ content }: { content: string }) {
	const isHTML = content.startsWith('<') && content.includes('</');

	if (!isHTML) {
		return (
			<div className='text-base leading-8 whitespace-pre-wrap break-words text-muted-foreground'>
				{content}
			</div>
		);
	}

	const sanitizedContent = sanitizeEditorContent(content);
	const formattedContent = sanitizedContent.includes('<pre') ? sanitizedContent : formatInlineCode(sanitizedContent);

	return (
		<div
			className='markdown-prose max-w-none break-words pb-1 text-muted-foreground [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border/70 [&_pre]:bg-card/70'
			dangerouslySetInnerHTML={{ __html: formattedContent }}
		/>
	);
}

// Memoized: the updates list re-renders on local state changes (e.g. "Load
// more") while each row's props stay referentially stable, so memo skips
// re-rendering unchanged rows.
type UpdateCardVariant = 'index' | 'search';

function UpdateCardImpl({
	update,
	orgSlug,
	projectSlug,
	currentProfileId,
	className,
	isLast = false,
	variant = 'index',
}: {
	update: any;
	orgSlug: string;
	projectSlug: string;
	currentProfileId?: string;
	className?: string;
	isLast?: boolean;
	variant?: UpdateCardVariant;
}) {
	const {
		id: updateId,
		title,
		content,
		contentPreview,
		contentPreviewIsTruncated,
		slug,
		author,
		category,
		status,
		publishedAt,
		emoteCounts,
		commentCount,
		coverImageUrl,
	} = update;

	const heartData = emoteCounts?.heart;
	const serverLikeCount = heartData?.count ?? 0;
	const serverIsLiked = currentProfileId
		? Boolean(heartData?.authorProfileIds?.includes(currentProfileId))
		: false;

	const { isLiked, likeCount, isAnimating, toggle } = useEmoteToggle({
		updateId,
		serverIsLiked,
		serverLikeCount,
		canInteract: Boolean(currentProfileId),
	});

	const isSearchVariant = variant === 'search';
	const compactPreviewSource = (contentPreview ?? '').trim();
	const compactPreview = compactPreviewSource.length > SEARCH_PREVIEW_CHARS
		? `${compactPreviewSource.slice(0, SEARCH_PREVIEW_CHARS).trimEnd()}...`
		: compactPreviewSource;
	const isCompactPreviewTruncated =
		contentPreviewIsTruncated || compactPreviewSource.length > SEARCH_PREVIEW_CHARS;

	return (
		<li className={cn('relative flex min-w-0', className)}>
			<div
				className={cn(
					'relative min-w-0 w-full',
					isSearchVariant ? 'px-4 py-7 md:px-6' : 'py-10'
				)}
			>
				{!isLast ? (
					<div
						aria-hidden='true'
						className={cn(
							'absolute right-0 bottom-0 left-0 border-b',
							!isSearchVariant && 'lg:-left-7 md:-right-8.25'
						)}
					/>
				) : null}
				<div className='mb-4 flex min-w-0 flex-wrap items-center gap-3'>
					<CategoryBadge category={category} />
					{publishedAt ? (
						<span className='flex items-center gap-1.5 text-sm text-muted-foreground'>
							<Calendar className='size-3.5' />
							<span suppressHydrationWarning>{formatFullDate(publishedAt)}</span>
						</span>
					) : null}
					{author ? (
						<span className='flex items-center gap-1.5 text-sm text-muted-foreground'>
							<Avatar className='size-5' fallbackName={author.username ?? author.name ?? 'Unknown'}>
								<AvatarImage alt={author.username} src={author.imageUrl ?? undefined} />
								<AvatarFallback />
							</Avatar>
							<span>@{author.username}</span>
						</span>
					) : null}
					{status === 'draft' ? (
						<Badge className='text-yellow-600 dark:text-yellow-400' variant='outline'>
							{m.updates_status_draft()}
						</Badge>
					) : null}
				</div>

				<h3
					className={cn(
						'min-w-0 break-words font-semibold',
						isSearchVariant ? 'mb-4 text-[1.9rem] leading-tight' : 'mb-6 text-3xl'
					)}
				>
					<Link
						className='link-text'
						params={{ org: orgSlug, project: projectSlug, slug }}
						to='/@{$org}/$project/updates/$slug'
					>
						{title}
					</Link>
				</h3>

				{coverImageUrl ? (
					<div className='mb-6 w-full overflow-hidden rounded-lg bg-muted'>
						<img alt={title} className='h-full w-full object-cover' src={coverImageUrl} />
					</div>
				) : null}

				{content && !isSearchVariant ? (
					<div className='relative mt-4 min-w-0 overflow-hidden'>
						<div
							className={cn(
								'min-w-0 overflow-hidden',
								contentPreviewIsTruncated ? 'max-h-[72rem]' : ''
							)}
						>
							<UpdateCardContent content={content} />
						</div>
						{contentPreviewIsTruncated ? (
							<div className='pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-linear-to-t from-background via-background/94 to-transparent' />
						) : null}
					</div>
				) : null}
				{isSearchVariant && compactPreview ? (
					<div className='mt-3 text-[0.95rem] leading-7 break-words text-muted-foreground'>
						{compactPreview}
					</div>
				) : null}

				<div className={cn('flex min-w-0 items-center justify-between gap-6', isSearchVariant ? 'mt-5' : 'mt-6')}>
					<div className='flex min-w-0 items-center gap-6'>
						<button
							className={cn(
								'group flex cursor-pointer items-center gap-2 text-sm transition-colors duration-200',
								isLiked
									? 'text-red-500 hover:text-red-600'
									: 'text-muted-foreground hover:text-red-500',
								!currentProfileId && 'cursor-not-allowed opacity-50'
							)}
							disabled={!currentProfileId}
							onClick={toggle}
							type='button'
						>
							<Heart
								className={cn(
									'size-4 transition-transform duration-200',
									isLiked && 'fill-current',
									currentProfileId && 'group-hover:scale-110',
									isAnimating && 'animate-[heart-pop_0.6s_ease-out]'
								)}
							/>
							<span className='font-medium'>
								{likeCount === 1
									? m.updates_like_count({ count: likeCount })
									: m.updates_like_count_plural({ count: likeCount })}
							</span>
						</button>

						<div className='flex items-center gap-2 text-sm text-muted-foreground'>
							<MessageSquare className='size-4' />
							<span className='font-medium'>
								{commentCount === 1
									? m.updates_comment_count({ count: commentCount })
									: m.updates_comment_count_plural({ count: commentCount })}
							</span>
						</div>
					</div>

					<div className='flex shrink-0 items-center gap-3'>
						{(isSearchVariant ? isCompactPreviewTruncated : contentPreviewIsTruncated) ? (
							<Link
								className='inline-flex items-center rounded-full border border-border/70 bg-background/80 px-3.5 py-1.5 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground'
								params={{ org: orgSlug, project: projectSlug, slug }}
								to='/@{$org}/$project/updates/$slug'
							>
								{m.updates_click_to_read_more()}
							</Link>
						) : null}
						{!(isSearchVariant ? isCompactPreviewTruncated : contentPreviewIsTruncated) ? (
							<Link
								className='link-text text-sm font-medium'
								params={{ org: orgSlug, project: projectSlug, slug }}
								to='/@{$org}/$project/updates/$slug'
							>
								{m.updates_view_more()}
							</Link>
						) : null}
					</div>
				</div>
			</div>
		</li>
	);
}

export const UpdateCard = memo(UpdateCardImpl);
