import { useEffect, useRef, useState } from 'react';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { Calendar, Edit, Heart, Link as LinkIcon, MessageSquare } from 'lucide-react';

import { api } from '~api';
import { EditorContentDisplay, EditorRefProvider } from '@/components/editor';
import { type EmoteContent } from '@/components/emote';
import { SidebarSection } from '@/components/sidebar-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusIcon } from '@/icons';
import { useSidebarState } from '@/lib/hooks/use-sidebar-state';
import { cn } from '@/lib/utils';
import { formatFullDate, formatRelativeDay } from '@/lib/utils/format-timestamp';

import { CategoryBadge } from '../-components/category-badge';
import { UpdateCommentForm } from '../-components/update-comment-form';
import { UpdateCommentsList } from '../-components/update-comments-list';

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

const SIDEBAR_STORAGE_KEY = 'update-detail-sidebar-state';

type SidebarSections = {
	related: boolean;
};

const DEFAULT_SIDEBAR_STATE: SidebarSections = {
	related: true,
};

export const Route = createFileRoute('/@{$org}/$project/updates/$slug/')({
	loader: async ({ context, params }) => {
		const project = await context.queryClient.ensureQueryData(
			convexQuery(api.project.getDetails, {
				orgSlug: params.org,
				slug: params.project,
			})
		);

		if (!project?.project?._id) {
			throw notFound();
		}

		const updateData = await context.queryClient.ensureQueryData(
			convexQuery(api.update.getBySlug, {
				projectId: project.project._id,
				slug: params.slug,
			})
		);

		if (!updateData) {
			throw notFound();
		}

		return { updateData };
	},
	component: RouteComponent,
});

function RouteComponent() {
	const params = Route.useParams();
	const { updateData: loaderData } = Route.useLoaderData();
	const { state: sidebarState, setSection: setSidebarSection } = useSidebarState(
		SIDEBAR_STORAGE_KEY,
		DEFAULT_SIDEBAR_STATE
	);

	const { data: projectData } = useSuspenseQuery(
		convexQuery(api.project.getDetails, {
			orgSlug: params.org,
			slug: params.project,
		})
	);

	const { data: updateData } = useSuspenseQuery(
		convexQuery(api.update.getBySlug, {
			projectId: projectData?.project?._id!,
			slug: params.slug,
		})
	);

	// Get current user's profile
	const { data: currentProfile } = useQuery(convexQuery(api.profile.findMyProfile, {}));

	const data = updateData ?? loaderData;

	if (!data) {
		return <div className='container py-10'>Update not found.</div>;
	}

	const { update, coverImageUrl, author, relatedFeedback, emoteCounts, commentCount, canEdit } =
		data;
	const isAuthenticated = !!currentProfile;
	const currentProfileId = currentProfile?._id;
	const hasRelatedFeedback = relatedFeedback && relatedFeedback.length > 0;

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
					updateId: update._id,
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

	return (
		<div>
			<header>
				<div className='w-full border-b bg-muted/50'>
					<div className='container pt-16 pb-6'>
						<div className='flex items-start justify-between gap-4'>
							<div className='flex flex-col gap-2'>
								<div className='flex items-center gap-2'>
									{update.status === 'draft' && (
										<Badge variant='outline' className='text-yellow-600 dark:text-yellow-400'>
											Draft
										</Badge>
									)}
									{update.category && <CategoryBadge category={update.category} />}
								</div>
								<h1 className='text-3xl font-bold'>{update.title}</h1>
								<div className='flex items-center gap-3 text-sm text-muted-foreground'>
									{author && (
										<Link
											to='/@{$org}'
											params={{ org: author.username }}
											className='flex items-center gap-2 hover:underline'
										>
											{author.imageUrl ? (
												<img
													className='h-5 w-5 rounded-full'
													src={author.imageUrl}
													alt={author.username}
												/>
											) : (
												<div className='flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground'>
													{author.name?.charAt(0) ?? '?'}
												</div>
											)}
											<span>@{author.username}</span>
										</Link>
									)}
									{update.publishedAt && (
										<Tooltip>
											<TooltipTrigger asChild delay={100}>
												<span className='flex cursor-pointer items-center gap-1'>
													<Calendar className='h-4 w-4' />
													<span suppressHydrationWarning>
														{formatRelativeDay(update.publishedAt)}
													</span>
												</span>
											</TooltipTrigger>
											<TooltipContent>
												<span suppressHydrationWarning>{formatFullDate(update.publishedAt)}</span>
											</TooltipContent>
										</Tooltip>
									)}
								</div>
							</div>
							{canEdit && (
								<Button variant='outline' asChild>
									<Link
										to='/@{$org}/$project/updates/$slug/edit'
										params={{
											org: params.org,
											project: params.project,
											slug: params.slug,
										}}
									>
										<Edit className='h-4 w-4' />
										Edit
									</Link>
								</Button>
							)}
						</div>
					</div>
				</div>
			</header>
			<div className='relative'>
				<div className='absolute h-64 w-full bg-linear-to-t from-background to-muted/50'></div>
				<div className='relative z-10 container py-10'>
					{/* Cover image */}
					{coverImageUrl && (
						<img
							src={coverImageUrl}
							alt={update.title}
							className='mb-10 w-full rounded-lg bg-muted object-cover'
						/>
					)}

					{/* Two-column layout: main content + sidebar */}
					<div className='grid grid-cols-1 gap-10 lg:grid-cols-[1fr_280px]'>
						{/* Main content column */}
						<div>
							{/* Update content */}
							<EditorContentDisplay content={update.content} className='prose-lg' />
						</div>

						{/* Sidebar column */}
						<div className='flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start'>
							{/* Inject keyframes */}
							<style>{heartPopKeyframes}</style>

							{/* Like Button */}
							<button
								onClick={handleLike}
								disabled={!currentProfileId}
								className={cn(
									'group flex cursor-pointer items-center gap-2 text-base transition-colors duration-200',
									isLiked ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground hover:text-red-500',
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

							{/* Related Feedback */}
							{hasRelatedFeedback && (
								<SidebarSection
									title='Related Feedback'
									icon={<LinkIcon className='size-3.5' />}
									open={sidebarState.related}
									onOpenChange={(open) => setSidebarSection('related', open)}
								>
									<div className='flex flex-col'>
										{relatedFeedback
											?.filter((item): item is NonNullable<typeof item> => item !== null)
											.map((item) => (
												<Link
													key={item._id}
													to='/@{$org}/$project/feedback/$slug'
													params={{
														org: params.org,
														project: params.project,
														slug: item.slug,
													}}
													className='flex cursor-pointer items-center gap-2.5 rounded-md py-2 transition-colors hover:bg-muted/50'
												>
													<StatusIcon status={item.status} size='14' colored />
													<span className='flex-1 truncate text-sm'>{item.title}</span>
												</Link>
											))}
									</div>
								</SidebarSection>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Comments section - full width border */}
			<div className='border-t'>
				<div className='container py-10'>
					<div className='grid grid-cols-1 gap-10 lg:grid-cols-[1fr_280px]'>
						<div>
							<EditorRefProvider>
								<h3 className='mb-4 flex items-center gap-2 text-lg font-semibold'>
									<MessageSquare className='size-5' />
									{commentCount} {commentCount === 1 ? 'Comment' : 'Comments'}
								</h3>
								<UpdateCommentsList updateId={update._id} currentProfileId={currentProfile?._id} />
								<UpdateCommentForm
									updateId={update._id}
									orgSlug={params.org}
									projectSlug={params.project}
									updateSlug={params.slug}
									isAuthenticated={isAuthenticated}
								/>
							</EditorRefProvider>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
