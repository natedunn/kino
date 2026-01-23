import { useEffect, useRef, useState } from 'react';
import { useConvexMutation } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Calendar, Heart, MessageSquare } from 'lucide-react';

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
		<li className={cn('flex', className)}>
			<div className={cn('grid w-full grid-cols-12 gap-8', !isLast && 'mb-12 border-b pb-12')}>
				{/* Left Column - Meta (sticky) */}
				<div className='col-span-12 md:col-span-3'>
					<div className='sticky top-8 flex flex-col gap-4'>
						{/* Date */}
						{publishedAt && (
							<div className='flex items-center gap-2 text-sm text-muted-foreground'>
								<Calendar className='size-4' />
								<span suppressHydrationWarning>{formatFullDate(publishedAt)}</span>
							</div>
						)}

						{/* Author */}
						{author && (
							<div className='flex items-center gap-2'>
								{author.imageUrl ? (
									<img
										className='size-6 rounded-full'
										src={author.imageUrl}
										alt={author.username}
									/>
								) : (
									<div className='flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground'>
										{author.name?.charAt(0) ?? '?'}
									</div>
								)}
								<span className='text-sm'>@{author.username}</span>
							</div>
						)}

						{/* Draft Status */}
						{status === 'draft' && (
							<Badge variant='outline' className='text-yellow-600 dark:text-yellow-400'>
								Draft
							</Badge>
						)}
					</div>
				</div>

				{/* Right Column - Content */}
				<div className='col-span-12 md:col-span-9'>
					{/* Category */}
					{category && <CategoryBadge category={category} className='mb-3' />}

					{/* Title */}
					<h3 className='text-3xl font-semibold'>
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
						<div className='mt-4 mb-6 w-full overflow-hidden rounded-lg bg-muted'>
							<img src={coverImageUrl} alt={title} className='h-full w-full object-cover' />
						</div>
					)}

					{/* Content */}
					<div className={cn('mt-4', isTruncated && 'relative max-h-[32rem] overflow-hidden')}>
						<EditorContentDisplay content={content} />
						{isTruncated && (
							<div className='absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent' />
						)}
					</div>

					{/* Bottom Action Bar */}
					<div className='mt-6 flex items-center justify-between border-t pt-6'>
						{/* Left side - Like & Comments */}
						<div className='flex items-center gap-6'>
							{/* Inject keyframes */}
							<style>{heartPopKeyframes}</style>

							{/* Like Button */}
							<button
								onClick={handleLike}
								disabled={!currentProfileId}
								className={cn(
									'group flex cursor-pointer items-center gap-2 text-base transition-colors duration-200',
									isLiked
										? 'text-red-500 hover:text-red-600'
										: 'text-muted-foreground hover:text-red-500',
									!currentProfileId && 'cursor-not-allowed opacity-50'
								)}
							>
								<Heart
									className={cn(
										'size-5 transition-transform duration-200',
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
							<div className='flex items-center gap-2 text-base text-muted-foreground'>
								<MessageSquare className='size-5' />
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
							className='group flex items-center gap-2 text-base font-medium text-primary transition-colors hover:text-primary/80'
						>
							<span>View Update</span>
							<ArrowRight className='size-5 transition-transform group-hover:translate-x-1' />
						</Link>
					</div>
				</div>
			</div>
		</li>
	);
};
