import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Calendar, Heart, MessageSquare } from 'lucide-react';

import { EditorContentDisplay } from '@/components/editor';
import { Badge } from '@/components/ui/badge';
import { useCRPC } from '@/lib/convex/crpc';
import { cn } from '@/lib/utils';
import { formatFullDate } from '@/lib/utils/format-timestamp';

import { CategoryBadge } from './category-badge';

const heartPopKeyframes = `
@keyframes heart-pop {
  0% { transform: scale(1); }
  15% { transform: scale(1.3); }
  30% { transform: scale(0.95); }
  45% { transform: scale(1.15); }
  60% { transform: scale(1); }
}
`;

export function UpdateCard({
  update,
  orgSlug,
  projectSlug,
  currentProfileId,
  className,
  isLast = false,
}: {
  update: any;
  orgSlug: string;
  projectSlug: string;
  currentProfileId?: string;
  className?: string;
  isLast?: boolean;
}) {
  const crpc = useCRPC();
  const {
    id: updateId,
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

  const heartData = emoteCounts?.heart;
  const serverLikeCount = heartData?.count ?? 0;
  const serverIsLiked = currentProfileId
    ? heartData?.authorProfileIds?.includes(currentProfileId)
    : false;

  const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
  const [optimisticCount, setOptimisticCount] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const isLiked = optimisticLiked ?? serverIsLiked;
  const likeCount = optimisticCount ?? serverLikeCount;
  const prevLikedRef = useRef(isLiked);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingStateRef = useRef<boolean | null>(null);

  const toggleEmote = useMutation(crpc.updateEmote.toggle.mutationOptions());

  useEffect(() => {
    if (optimisticLiked !== null && serverIsLiked === optimisticLiked) {
      setOptimisticLiked(null);
      setOptimisticCount(null);
    }
  }, [serverIsLiked, serverLikeCount, optimisticLiked]);

  useEffect(() => {
    if (isLiked && !prevLikedRef.current) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 600);
      return () => clearTimeout(timer);
    }
    prevLikedRef.current = isLiked;
  }, [isLiked]);

  const handleLike = () => {
    if (!currentProfileId) return;

    const newIsLiked = !isLiked;
    const newCount = newIsLiked ? likeCount + 1 : Math.max(0, likeCount - 1);
    setOptimisticLiked(newIsLiked);
    setOptimisticCount(newCount);
    pendingStateRef.current = newIsLiked;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (pendingStateRef.current !== serverIsLiked) {
        toggleEmote.mutate({ content: 'heart', updateId });
      } else {
        setOptimisticLiked(null);
        setOptimisticCount(null);
      }
      pendingStateRef.current = null;
    }, 300);
  };

  const plainText = content.replace(/<[^>]*>/g, '');
  const isTruncated = plainText.length > 2000;

  return (
    <li className={cn('relative flex', className)}>
      {!isLast ? <div aria-hidden="true" className="absolute inset-x-0 bottom-0 border-b md:-mr-8.25" /> : null}
      <div className="w-full py-10">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <CategoryBadge category={category} />
          {publishedAt ? (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="size-3.5" />
              <span suppressHydrationWarning>{formatFullDate(publishedAt)}</span>
            </span>
          ) : null}
          {author ? (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              {author.imageUrl ? (
                <img alt={author.username} className="size-5 rounded-full" src={author.imageUrl} />
              ) : (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {author.name?.charAt(0) ?? '?'}
                </span>
              )}
              <span>@{author.username}</span>
            </span>
          ) : null}
          {status === 'draft' ? (
            <Badge className="text-yellow-600 dark:text-yellow-400" variant="outline">
              Draft
            </Badge>
          ) : null}
        </div>

        <h3 className="mb-6 text-3xl font-semibold">
          <Link
            className="link-text"
            params={{ org: orgSlug, project: projectSlug, slug }}
            to="/@{$org}/$project/updates/$slug"
          >
            {title}
          </Link>
        </h3>

        {coverImageUrl ? (
          <div className="mb-6 w-full overflow-hidden rounded-lg bg-muted">
            <img alt={title} className="h-full w-full object-cover" src={coverImageUrl} />
          </div>
        ) : null}

        <div className={cn('mt-4', isTruncated && 'relative max-h-[64rem] overflow-hidden')}>
          <EditorContentDisplay content={content} />
          {isTruncated ? <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-background to-transparent" /> : null}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <style>{heartPopKeyframes}</style>
            <button
              className={cn(
                'group flex cursor-pointer items-center gap-2 text-sm transition-colors duration-200',
                isLiked ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground hover:text-red-500',
                !currentProfileId && 'cursor-not-allowed opacity-50'
              )}
              disabled={!currentProfileId}
              onClick={handleLike}
              type="button"
            >
              <Heart
                className={cn(
                  'size-4 transition-transform duration-200',
                  isLiked && 'fill-current',
                  currentProfileId && 'group-hover:scale-110',
                  isAnimating && 'animate-[heart-pop_0.6s_ease-out]'
                )}
              />
              <span className="font-medium">
                {likeCount} {likeCount === 1 ? 'like' : 'likes'}
              </span>
            </button>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageSquare className="size-4" />
              <span className="font-medium">
                {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
              </span>
            </div>
          </div>

          <Link
            className="link-text text-sm font-medium"
            params={{ org: orgSlug, project: projectSlug, slug }}
            to="/@{$org}/$project/updates/$slug"
          >
            View More
          </Link>
        </div>
      </div>
    </li>
  );
}
