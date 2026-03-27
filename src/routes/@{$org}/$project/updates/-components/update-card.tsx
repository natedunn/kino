import { useEffect, useRef, useState } from 'react';
import { useConvexMutation } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Calendar, Heart, MessageSquare } from 'lucide-react';

import { api, API } from '~api';
import { EditorContentDisplay } from '@/components/editor';
import { type EmoteContent } from '@/components/emote';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatFullDate } from '@/lib/utils/format-timestamp';

import { CategoryBadge } from './category-badge';

// Heart pop animation styles
const heartPopKeyframes = `
@keyframes heart-pop {
  0% { transform: scale(1); }
  15% { transform: scale(1.3); }
  30% { transform: scale(0.95); }
  45% { transform: scale(1.15); }
  60% { transform: scale(1); }
}
`;

// Extract the non-empty return type which has 'updates' property
type ListByProjectResult = Exclude<API['update']['listByProject'], never[]>;
type SingleUpdate = ListByProjectResult['updates'][number];

type UpdateCardProps = {
	update: SingleUpdate;
	orgSlug: string;
	projectSlug: string;
	currentProfileId?: string;
	className?: string;
	isLast?: boolean;
};

export const UpdateCard = ({
	update,
	orgSlug,
	projectSlug,
	currentProfileId,
	className,
	isLast = false,
}: UpdateCardProps) => {
	const {
		_id: updateId,
		title,
		content,
		slug,
		author,
		category,
		status,
		publishedAt,
		emoteCounts,
		commentCount,
		coverImageUrl,
	} = update;

	// Get heart emote data with optimistic state
	const heartData = emoteCounts?.heart;
	const serverLikeCount = heartData?.count ?? 0;
	const serverIsLiked = currentProfileId
		? heartData?.authorProfileIds?.includes(currentProfileId)
		: false;

	// Optimistic state for likes
	const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
	const [optimisticCount, setOptimisticCount] = useState<number | null>(null);
	const [isAnimating, setIsAnimating] = useState(false);

	// Use optimistic values if set, otherwise use server values
	const isLiked = optimisticLiked ?? serverIsLiked;
	const likeCount = optimisticCount ?? serverLikeCount;

	// Track previous liked state to detect changes for animation
	const prevLikedRef = useRef(isLiked);

	// Clear optimistic state when server catches up
	useEffect(() => {
		if (optimisticLiked !== null && serverIsLiked === optimisticLiked) {
			setOptimisticLiked(null);
			setOptimisticCount(null);
		}
	}, [serverIsLiked, serverLikeCount, optimisticLiked]);

	// Trigger animation when transitioning to liked state
	useEffect(() => {
		if (isLiked && !prevLikedRef.current) {
			setIsAnimating(true);
			const timer = setTimeout(() => setIsAnimating(false), 600);
			return () => clearTimeout(timer);
		}
		prevLikedRef.current = isLiked;
	}, [isLiked]);

	// Like mutation - debounced to handle rapid clicks
	const { mutate: toggleEmote } = useMutation({
		mutationFn: useConvexMutation(api.updateEmote.toggle),
	});

	// Debounce ref to track pending mutation
	const debounceRef = useRef<NodeJS.Timeout | null>(null);
	const pendingStateRef = useRef<boolean | null>(null);

	const handleLike = () => {
		if (!currentProfileId) return;

		// Optimistically update immediately
		const newIsLiked = !isLiked;
		const newCount = newIsLiked ? likeCount + 1 : Math.max(0, likeCount - 1);
		setOptimisticLiked(newIsLiked);
		setOptimisticCount(newCount);

		// Track what state we want to end up in
		pendingStateRef.current = newIsLiked;

		// Clear existing debounce
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		// Debounce the mutation - only fire after 300ms of no clicks
		debounceRef.current = setTimeout(() => {
			// Only fire if the desired state differs from server state
			if (pendingStateRef.current !== serverIsLiked) {
				toggleEmote({
					updateId,
					content: 'heart' as EmoteContent,
				});
			} else {
				// States match, just clear optimistic
				setOptimisticLiked(null);
				setOptimisticCount(null);
			}
			pendingStateRef.current = null;
		}, 300);
	};

	// Check if content is too long (over ~2000 chars of plain text)
	const MAX_CONTENT_LENGTH = 2000;
	const plainText = content.replace(/<[^>]*>/g, '');
	const isTruncated = plainText.length > MAX_CONTENT_LENGTH;

	return (
		<li className={cn('relative flex', className)}>
			{!isLast && (
				<div className='absolute inset-x-0 bottom-0 border-b md:-mr-8.25' aria-hidden='true' />
			)}
			<div className='w-full py-10'>
				{/* Meta row: category, date, author, draft badge */}
				<div className='mb-4 flex flex-wrap items-center gap-3'>
					<CategoryBadge category={category} />
					{publishedAt && (
						<span className='flex items-center gap-1.5 text-sm text-muted-foreground'>
							<Calendar className='size-3.5' />
							<span suppressHydrationWarning>{formatFullDate(publishedAt)}</span>
						</span>
					)}
					{author && (
						<span className='flex items-center gap-1.5 text-sm text-muted-foreground'>
							{author.imageUrl ? (
								<img
									className='size-5 rounded-full'
									src={author.imageUrl}
									alt={author.username}
								/>
							) : (
								<span className='flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground'>
									{author.name?.charAt(0) ?? '?'}
								</span>
							)}
							<span>@{author.username}</span>
						</span>
					)}
					{status === 'draft' && (
						<Badge variant='outline' className='text-yellow-600 dark:text-yellow-400'>
							Draft
						</Badge>
					)}
				</div>

				{/* Title */}
				<h3 className='mb-6 text-3xl font-semibold'>
					<Link
						to='/@{$org}/$project/updates/$slug'
						params={{
							org: orgSlug,
							project: projectSlug,
							slug,
						}}
						className='link-text'
					>
						{title}
					</Link>
				</h3>

				{/* Cover Image */}
				{coverImageUrl && (
					<div className='mb-6 w-full overflow-hidden rounded-lg bg-muted'>
						<img src={coverImageUrl} alt={title} className='h-full w-full object-cover' />
					</div>
				)}

				{/* Content */}
				<div className={cn('mt-4', isTruncated && 'relative max-h-128 overflow-hidden')}>
					<EditorContentDisplay content={content} />
					{isTruncated && (
						<div className='absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-background to-transparent' />
					)}
				</div>

				{/* Bottom Action Bar */}
				<div className='mt-6 flex items-center justify-between'>
					{/* Left side - Like & Comments */}
					<div className='flex items-center gap-6'>
						{/* Inject keyframes */}
						<style>{heartPopKeyframes}</style>

						{/* Like Button */}
						<button
							onClick={handleLike}
							disabled={!currentProfileId}
							className={cn(
								'group flex cursor-pointer items-center gap-2 text-sm transition-colors duration-200',
								isLiked
									? 'text-red-500 hover:text-red-600'
									: 'text-muted-foreground hover:text-red-500',
								!currentProfileId && 'cursor-not-allowed opacity-50'
							)}
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
								{likeCount} {likeCount === 1 ? 'like' : 'likes'}
							</span>
						</button>

						{/* Comment Count */}
						<div className='flex items-center gap-2 text-sm text-muted-foreground'>
							<MessageSquare className='size-4' />
							<span className='font-medium'>
								{commentCount} {commentCount === 1 ? 'comment' : 'comments'}
							</span>
						</div>
					</div>

					{/* Right side - View Update */}
					<Link
						to='/@{$org}/$project/updates/$slug'
						params={{
							org: orgSlug,
							project: projectSlug,
							slug,
						}}
						className='link-text text-sm font-medium'
					>
						View More
					</Link>
				</div>
			</div>
		</li>
	);
};
