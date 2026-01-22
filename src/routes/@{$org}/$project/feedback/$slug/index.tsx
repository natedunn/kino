import type { MarkdownEditorRef } from '@/components/editor';

import { useEffect, useRef, useState } from 'react';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound, useLocation } from '@tanstack/react-router';
import {
	Bell,
	Calendar,
	ChevronDown,
	ChevronRight,
	Link as LinkIcon,
	MoreHorizontal,
	Pencil,
	Plus,
	Settings2,
	Tag,
	Users,
} from 'lucide-react';

import { api, API } from '~api';
import {
	EditorContentDisplay,
	EditorRefProvider,
	MarkdownEditor,
	sanitizeEditorContent,
} from '@/components/editor';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Id } from '@/convex/_generated/dataModel';
import { StatusIcon } from '@/icons';
import { cn } from '@/lib/utils';
import { formatFullDate, formatRelativeDay, formatTimestamp } from '@/lib/utils/format-timestamp';

import { AssigneeSwitcher } from '../-components/assignee-switcher';
import { BoardSwitcher } from '../-components/board-switcher';
import { CommentForm } from '../-components/comment-form';
import { CommentsList } from '../-components/comments-list';
import { EmoteButton, EmoteContent, EmotePicker } from '../-components/emote-picker';
import { StatusSwitcher } from '../-components/status-switcher';
import { UpvoteButton } from '../-components/upvote-button';

// Sidebar collapse state management with localStorage persistence
const SIDEBAR_STORAGE_KEY = 'feedback-sidebar-state';

type SidebarSections = {
	details: boolean;
	people: boolean;
	labels: boolean;
	related: boolean;
};

const DEFAULT_SIDEBAR_STATE: SidebarSections = {
	details: true,
	people: true,
	labels: true,
	related: true,
};

function useSidebarState() {
	const [state, setState] = useState<SidebarSections>(() => {
		if (typeof window === 'undefined') return DEFAULT_SIDEBAR_STATE;
		try {
			const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
			if (stored) {
				return { ...DEFAULT_SIDEBAR_STATE, ...JSON.parse(stored) };
			}
		} catch {
			// Ignore parse errors
		}
		return DEFAULT_SIDEBAR_STATE;
	});

	const setSection = (section: keyof SidebarSections, open: boolean) => {
		setState((prev) => {
			const next = { ...prev, [section]: open };
			try {
				localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(next));
			} catch {
				// Ignore storage errors
			}
			return next;
		});
	};

	return { state, setSection };
}

type FirstCommentItemProps = {
	comment: NonNullable<API['feedback']['getBySlug']>['firstComment'];
	author: NonNullable<API['feedback']['getBySlug']>['author'];
	feedbackId: Id<'feedback'>;
	emoteCounts?: Record<EmoteContent, { count: number; authorProfileIds: string[] }>;
	currentProfileId?: Id<'profile'>;
	isOwner: boolean;
	isTeamMember: boolean;
};

function FirstCommentItem({
	comment,
	author,
	feedbackId,
	emoteCounts,
	currentProfileId,
	isOwner,
	isTeamMember,
}: FirstCommentItemProps) {
	const location = useLocation();
	const commentRef = useRef<HTMLLIElement>(null);
	const commentId = comment ? `comment-${comment._id}` : '';

	// Edit state
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState(comment?.content ?? '');
	const editEditorRef = useRef<MarkdownEditorRef>(null);

	// Highlight state for permalink
	const [isHighlighted, setIsHighlighted] = useState(false);

	// Handle scroll-to and highlight on hash match
	useEffect(() => {
		if (typeof window === 'undefined' || !commentId) return;

		const hash = window.location.hash;
		if (hash === `#${commentId}`) {
			// Small delay to ensure DOM is ready
			setTimeout(() => {
				commentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
				setIsHighlighted(true);
				// Remove highlight after animation
				setTimeout(() => setIsHighlighted(false), 2000);
			}, 100);
		}
	}, [commentId]);

	const { mutate: updateComment, status: updateStatus } = useMutation({
		mutationFn: useConvexMutation(api.feedbackComment.update),
		onSuccess: () => {
			setIsEditing(false);
		},
	});

	const handleEdit = () => {
		setEditContent(comment?.content ?? '');
		setIsEditing(true);
	};

	const handleCancelEdit = () => {
		setIsEditing(false);
		setEditContent(comment?.content ?? '');
	};

	const handleSaveEdit = () => {
		if (!comment) return;
		const html = editEditorRef.current?.getHTML() ?? editContent;
		const text = editEditorRef.current?.getText() ?? '';

		if (!text.trim()) return;

		const sanitizedContent = sanitizeEditorContent(html);
		if (!sanitizedContent) return;

		updateComment({
			_id: comment._id,
			content: sanitizedContent,
		});
	};

	const handlePermalink = async () => {
		if (!commentId) return;
		const url = `${window.location.origin}${location.pathname}#${commentId}`;
		await navigator.clipboard.writeText(url);
	};

	const isUpdating = updateStatus === 'pending';

	if (!comment || !author) return null;

	const emoteEntries = emoteCounts
		? (Object.entries(emoteCounts) as [
				EmoteContent,
				{ count: number; authorProfileIds: string[] },
			][])
		: [];

	return (
		<li
			id={commentId}
			ref={commentRef}
			className={cn(
				'update-comment relative flex overflow-hidden rounded-lg border transition-all duration-500',
				'border-foreground/40 dark:border-foreground/30',
				{
					'ring-2 ring-primary ring-offset-2 ring-offset-background': isHighlighted,
				}
			)}
		>
			{isEditing ? (
				<div className='relative z-30 flex w-full flex-col p-6'>
					<div className='ml-6'>
						<div className='inline-block rounded-t-md bg-primary px-2 py-0.5 text-sm'>
							Editing post
						</div>
					</div>
					<MarkdownEditor
						ref={editEditorRef}
						value={editContent}
						onChange={setEditContent}
						placeholder='Edit your post...'
						disabled={isUpdating}
						minHeight='80px'
						maxHeight='600px'
						autoFocus
						className='rounded-b-none'
						onSubmitShortcut={handleSaveEdit}
					/>
					<div className='flex justify-end gap-2 rounded-b-md border-x border-b bg-muted p-3'>
						<Button
							type='button'
							variant='ghost'
							size='sm'
							onClick={handleCancelEdit}
							disabled={isUpdating}
						>
							Cancel
						</Button>
						<Button type='button' size='sm' onClick={handleSaveEdit} disabled={isUpdating}>
							{isUpdating ? 'Saving...' : 'Save'}
						</Button>
					</div>
				</div>
			) : null}
			{isEditing && (
				<>
					<div className='absolute inset-0 z-20 bg-background/70 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.15)_0,rgba(255,255,255,0.15)_1px,transparent_1px,transparent_8px)]'></div>
					<div className='absolute inset-0 z-10 bg-background/70'></div>
				</>
			)}
			<div
				className={cn('flex w-full min-w-0', {
					absolute: isEditing,
				})}
			>
				<div className='flex shrink-0 flex-col items-center justify-start border-r bg-muted pt-3 pl-4'>
					<div className='relative z-10 -mr-4 size-8 overflow-hidden rounded-full border bg-linear-to-tr from-white/50 to-accent shadow-xl shadow-black'>
						{author.imageUrl ? (
							<img className='size-8' src={author.imageUrl} alt={author.username} />
						) : (
							<div className='flex size-8 items-center justify-center bg-primary text-xs font-bold text-primary-foreground'>
								{author.name?.charAt(0) ?? '?'}
							</div>
						)}
					</div>
				</div>
				<div className='flex w-full min-w-0 flex-col bg-background'>
					<div className='flex w-full justify-between gap-2 border-b px-6 py-4'>
						<span>
							<Link className='hocus:underline' to='/@{$org}' params={{ org: author.username }}>
								@{author.username}
							</Link>{' '}
							<span className='text-muted-foreground'>
								opened this feedback{' '}
								<Tooltip>
									<TooltipTrigger asChild delay={100}>
										<span
											className='cursor-pointer border-b border-dotted border-foreground/50 text-foreground/70'
											suppressHydrationWarning
										>
											{formatRelativeDay(comment._creationTime)}
										</span>
									</TooltipTrigger>
									<TooltipContent>
										<span suppressHydrationWarning>{formatFullDate(comment._creationTime)}</span>
									</TooltipContent>
								</Tooltip>
								{comment.updatedTime && (
									<>
										{' • '}
										<Tooltip>
											<TooltipTrigger asChild delay={100}>
												<span
													className='cursor-pointer border-b border-dotted border-foreground/50 text-foreground/70'
													suppressHydrationWarning
												>
													edited
												</span>
											</TooltipTrigger>
											<TooltipContent>
												<span suppressHydrationWarning>{formatFullDate(comment.updatedTime)}</span>
											</TooltipContent>
										</Tooltip>
									</>
								)}
							</span>
						</span>
						<div className='flex items-center gap-2'>
							<span className='inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground'>
								<Pencil className='h-3 w-3' />
								Author
							</span>
							{isTeamMember && (
								<span className='inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'>
									<Users className='h-3 w-3' />
									Team
								</span>
							)}
						</div>
					</div>
					<div className='flex min-w-0 flex-col gap-4 overflow-hidden p-6'>
						<EditorContentDisplay content={comment.content} />
						<div className='flex items-center justify-between'>
							<div className='flex items-center gap-2'>
								<EmotePicker
									feedbackId={feedbackId}
									commentId={comment._id}
									currentProfileId={currentProfileId}
								/>
								{emoteEntries.map(([emoteType, data]) => (
									<EmoteButton
										key={emoteType}
										feedbackId={feedbackId}
										commentId={comment._id}
										emoteType={emoteType}
										count={data.count}
										isActive={
											currentProfileId ? data.authorProfileIds.includes(currentProfileId) : false
										}
										currentProfileId={currentProfileId}
									/>
								))}
							</div>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant='ghost' size='sm'>
										<MoreHorizontal className='h-4 w-4' />
										<span className='sr-only'>More Actions</span>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align='end'>
									<DropdownMenuItem onClick={handlePermalink}>
										<LinkIcon size={14} />
										Permalink
									</DropdownMenuItem>
									{isOwner && (
										<DropdownMenuItem onClick={handleEdit}>
											<Pencil size={14} />
											Edit
										</DropdownMenuItem>
									)}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>
				</div>
			</div>
		</li>
	);
}

export const Route = createFileRoute('/@{$org}/$project/feedback/$slug/')({
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

		const feedbackData = await context.queryClient.ensureQueryData(
			convexQuery(api.feedback.getBySlug, {
				projectId: project.project._id,
				slug: params.slug,
			})
		);

		if (!feedbackData) {
			throw notFound();
		}

		return { feedbackData };
	},
	component: RouteComponent,
});

function RouteComponent() {
	const params = Route.useParams();
	const { feedbackData: loaderData } = Route.useLoaderData();

	const { data: projectData } = useSuspenseQuery(
		convexQuery(api.project.getDetails, {
			orgSlug: params.org,
			slug: params.project,
		})
	);

	const { data: feedbackData } = useSuspenseQuery(
		convexQuery(api.feedback.getBySlug, {
			projectId: projectData?.project?._id!,
			slug: params.slug,
		})
	);

	// Get current user's profile for highlighting their emotes
	const { data: currentProfile } = useQuery(convexQuery(api.profile.findMyProfile, {}));

	// Sidebar collapse state with localStorage persistence
	const { state: sidebarState, setSection: setSidebarSection } = useSidebarState();

	// Get comments with emotes for the first comment
	const { data: comments } = useSuspenseQuery(
		convexQuery(api.feedbackComment.listByFeedback, {
			feedbackId: feedbackData?.feedback._id!,
		})
	);

	// Get events for the timeline
	const { data: events } = useSuspenseQuery(
		convexQuery(api.feedbackEvent.listByFeedback, {
			feedbackId: feedbackData?.feedback._id!,
		})
	);

	const data = feedbackData ?? loaderData;

	if (!data) {
		return <div className='container py-10'>Feedback not found.</div>;
	}

	const { feedback, author, board, firstComment, assignedProfile, hasUpvoted } = data;

	// Find the first comment with emotes from the comments list
	const firstCommentWithEmotes = comments?.find((c) => c._id === firstComment?._id);

	// Determine if user can edit status (owner or has project edit permissions)
	const isOwner = currentProfile?._id === feedback.authorProfileId;
	const canEditStatus = isOwner || (projectData?.permissions?.canEdit ?? false);
	const isAuthenticated = !!currentProfile;

	return (
		<div>
			<header>
				<div className='w-full border-b bg-muted/50'>
					<div className='container flex items-start gap-4 px-8 pt-16 pb-6'>
						<div className='mt-1'>
							<StatusIcon status={feedback.status} size='28' colored />
						</div>
						<div className='flex flex-1 flex-col gap-2'>
							<h1 className='text-3xl'>{feedback.title}</h1>
							<div className='text-sm text-muted-foreground'>
								<span suppressHydrationWarning>
									{feedback.status === 'open' ? 'Opened' : 'Updated'}{' '}
									{formatTimestamp(feedback._creationTime)} · {feedback.upvotes} upvote
									{feedback.upvotes !== 1 ? 's' : ''}
								</span>
							</div>
						</div>
						<div className='mt-1'>
							<UpvoteButton
								feedbackId={feedback._id}
								initialCount={feedback.upvotes}
								initialHasUpvoted={hasUpvoted}
								isAuthenticated={isAuthenticated}
							/>
						</div>
					</div>
				</div>
			</header>
			<div className='relative'>
				<div className='absolute h-64 w-full bg-linear-to-t from-background to-muted/50'></div>
				<div className='relative z-10 container py-10'>
					<div className='flex flex-col gap-10 md:grid md:grid-cols-12'>
						<div className='order-first md:order-last md:col-span-4'>
							<div className='sticky top-4 flex flex-col gap-6'>
								{/* Upvote Section */}
								<div>
									<div className='flex items-center gap-3'>
										<UpvoteButton
											feedbackId={feedback._id}
											initialCount={feedback.upvotes}
											initialHasUpvoted={hasUpvoted}
											isAuthenticated={isAuthenticated}
										/>
										<div className='flex-1'>
											<div className='text-sm font-medium'>
												{feedback.upvotes} upvote{feedback.upvotes !== 1 ? 's' : ''}
											</div>
											<div className='text-xs text-muted-foreground'>
												{hasUpvoted ? "You've upvoted this" : 'Show your support'}
											</div>
										</div>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button variant='ghost' size='icon' className='size-8'>
													<Bell className='size-4' />
												</Button>
											</TooltipTrigger>
											<TooltipContent>Subscribe to updates</TooltipContent>
										</Tooltip>
									</div>
								</div>

								{/* Details Section */}
								<Collapsible open={sidebarState.details} onOpenChange={(open) => setSidebarSection('details', open)}>
									<CollapsibleTrigger className='group flex w-full cursor-pointer items-center justify-between border-b pb-2'>
										<h3 className='flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase transition-colors group-hover:text-foreground'>
											<Settings2 className='size-3.5' />
											Details
										</h3>
										<ChevronDown className='size-4 text-muted-foreground transition-all group-hover:text-foreground group-data-[state=open]:rotate-180' />
									</CollapsibleTrigger>
									<CollapsibleContent>
										<div className='flex flex-col pt-1'>
											{/* Status */}
											<div className='flex items-center justify-between py-2.5'>
												<span className='text-sm text-muted-foreground'>Status</span>
												<StatusSwitcher
													feedbackId={feedback._id}
													currentStatus={feedback.status}
													canEdit={canEditStatus}
												/>
											</div>

											{/* Board */}
											<div className='flex items-center justify-between py-2.5'>
												<span className='text-sm text-muted-foreground'>Board</span>
												<BoardSwitcher
													feedbackId={feedback._id}
													currentBoard={board}
													projectSlug={params.project}
													canEdit={canEditStatus}
												/>
											</div>

											{/* Priority - Placeholder */}
											<div className='flex items-center justify-between py-2.5'>
												<span className='text-sm text-muted-foreground'>Priority</span>
												<Button variant='outline' size='sm' className='h-auto gap-1.5 px-2 py-1 text-xs'>
													<span className='size-2 rounded-full bg-amber-500' />
													Medium
													<ChevronDown size={12} />
												</Button>
											</div>

											{/* Due Date - Placeholder */}
											<div className='flex items-center justify-between py-2.5'>
												<span className='text-sm text-muted-foreground'>Due date</span>
												<Button variant='ghost' size='sm' className='h-auto px-2 py-1 text-xs text-muted-foreground'>
													<Calendar className='mr-1.5 size-3' />
													Set date
												</Button>
											</div>
										</div>
									</CollapsibleContent>
								</Collapsible>

								{/* People Section */}
								<Collapsible open={sidebarState.people} onOpenChange={(open) => setSidebarSection('people', open)}>
									<CollapsibleTrigger className='group flex w-full cursor-pointer items-center justify-between border-b pb-2'>
										<h3 className='flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase transition-colors group-hover:text-foreground'>
											<Users className='size-3.5' />
											People
										</h3>
										<ChevronDown className='size-4 text-muted-foreground transition-all group-hover:text-foreground group-data-[state=open]:rotate-180' />
									</CollapsibleTrigger>
									<CollapsibleContent>
										<div className='flex flex-col pt-1'>
											{/* Assignee */}
											<div className='flex items-center justify-between py-2.5'>
												<span className='text-sm text-muted-foreground'>Assignee</span>
												<AssigneeSwitcher
													feedbackId={feedback._id}
													assignedProfile={assignedProfile}
													projectId={projectData?.project?._id!}
													canEdit={canEditStatus}
												/>
											</div>

											{/* Author */}
											<div className='flex items-center justify-between py-2.5'>
												<span className='text-sm text-muted-foreground'>Author</span>
												{author ? (
													<Link
														className='flex items-center gap-2 text-sm hover:underline'
														to='/@{$org}'
														params={{ org: author.username }}
													>
														<div className='size-5 overflow-hidden rounded-full'>
															{author.imageUrl ? (
																<img src={author.imageUrl} alt={author.username} className='size-5' />
															) : (
																<div className='flex size-5 items-center justify-center bg-primary text-[10px] font-bold text-primary-foreground'>
																	{author.name?.charAt(0) ?? author.username.charAt(0)}
																</div>
															)}
														</div>
														<span>{author.name ?? author.username}</span>
													</Link>
												) : (
													<span className='text-sm text-muted-foreground'>Unknown</span>
												)}
											</div>

											{/* Watchers - Placeholder */}
											<div className='flex items-center justify-between py-2.5'>
												<span className='text-sm text-muted-foreground'>Watchers</span>
												<div className='flex items-center -space-x-1.5'>
													<div className='size-5 rounded-full border-2 border-background bg-emerald-500' />
													<div className='size-5 rounded-full border-2 border-background bg-blue-500' />
													<div className='size-5 rounded-full border-2 border-background bg-purple-500' />
													<span className='ml-2 text-xs text-muted-foreground'>+12</span>
												</div>
											</div>
										</div>
									</CollapsibleContent>
								</Collapsible>

								{/* Labels Section - Placeholder */}
								<Collapsible open={sidebarState.labels} onOpenChange={(open) => setSidebarSection('labels', open)}>
									<CollapsibleTrigger className='group flex w-full cursor-pointer items-center justify-between border-b pb-2'>
										<h3 className='flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase transition-colors group-hover:text-foreground'>
											<Tag className='size-3.5' />
											Labels
										</h3>
										<ChevronDown className='size-4 text-muted-foreground transition-all group-hover:text-foreground group-data-[state=open]:rotate-180' />
									</CollapsibleTrigger>
									<CollapsibleContent>
										<div className='flex flex-wrap items-center gap-1.5 pt-3'>
											<Badge variant='secondary' className='gap-1 font-normal'>
												<span className='size-1.5 rounded-full bg-blue-500' />
												feature-request
											</Badge>
											<Badge variant='secondary' className='gap-1 font-normal'>
												<span className='size-1.5 rounded-full bg-purple-500' />
												ux
											</Badge>
											<Badge variant='secondary' className='gap-1 font-normal'>
												<span className='size-1.5 rounded-full bg-emerald-500' />
												enhancement
											</Badge>
											<Button variant='ghost' size='sm' className='h-6 gap-1 px-2 text-xs text-muted-foreground'>
												<Plus className='size-3' />
												Add
											</Button>
										</div>
									</CollapsibleContent>
								</Collapsible>

								{/* Related Section - Placeholder */}
								<Collapsible open={sidebarState.related} onOpenChange={(open) => setSidebarSection('related', open)}>
									<CollapsibleTrigger className='group flex w-full cursor-pointer items-center justify-between border-b pb-2'>
										<h3 className='flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase transition-colors group-hover:text-foreground'>
											<LinkIcon className='size-3.5' />
											Related
										</h3>
										<ChevronDown className='size-4 text-muted-foreground transition-all group-hover:text-foreground group-data-[state=open]:rotate-180' />
									</CollapsibleTrigger>
									<CollapsibleContent>
										<div className='flex flex-col pt-1'>
											<div className='flex cursor-pointer items-center gap-2.5 rounded-md py-2 transition-colors hover:bg-muted/50'>
												<StatusIcon status='completed' size='14' colored />
												<span className='flex-1 truncate text-sm'>
													Add dark mode support
												</span>
												<ChevronRight className='size-4 text-muted-foreground' />
											</div>
											<div className='flex cursor-pointer items-center gap-2.5 rounded-md py-2 transition-colors hover:bg-muted/50'>
												<StatusIcon status='in-progress' size='14' colored />
												<span className='flex-1 truncate text-sm'>
													Improve mobile responsiveness
												</span>
												<ChevronRight className='size-4 text-muted-foreground' />
											</div>
											<Button variant='ghost' size='sm' className='mt-1 h-8 w-full justify-start gap-1.5 px-0 text-xs text-muted-foreground'>
												<Plus className='size-3' />
												Link related feedback
											</Button>
										</div>
									</CollapsibleContent>
								</Collapsible>
							</div>
						</div>
						<div className='md:col-span-8'>
							{/* First comment (initial feedback content) */}
							{firstComment && author && (
								<div className='relative'>
									<div className='absolute left-8.25 h-full border-r opacity-50'></div>
									<ul className='flex flex-col gap-6'>
										<FirstCommentItem
											comment={firstComment}
											author={author}
											feedbackId={feedback._id}
											emoteCounts={firstCommentWithEmotes?.emoteCounts}
											currentProfileId={currentProfile?._id}
											isOwner={isOwner}
											isTeamMember={firstCommentWithEmotes?.isTeamMember ?? false}
										/>
									</ul>
								</div>
							)}

							<EditorRefProvider>
								{/* Additional comments and events timeline */}
								<CommentsList
									feedbackId={feedback._id}
									feedbackAuthorProfileId={feedback.authorProfileId}
									currentProfileId={currentProfile?._id}
									answerCommentId={feedback.answerCommentId}
									canMarkAnswer={canEditStatus}
									events={events ?? []}
								/>

								{/* Comment form */}
								<CommentForm feedbackId={feedback._id} isAuthenticated={!!currentProfile} />
							</EditorRefProvider>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
