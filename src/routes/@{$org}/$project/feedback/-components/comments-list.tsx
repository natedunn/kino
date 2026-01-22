import type { MarkdownEditorRef } from '@/components/editor';

import { useEffect, useRef, useState } from 'react';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Link, useLocation } from '@tanstack/react-router';
import {
	Check,
	Link as LinkIcon,
	MoreHorizontal,
	Pencil,
	Quote,
	Trash2,
	Users,
} from 'lucide-react';

import { api, API } from '~api';
import {
	EditorContentDisplay,
	MarkdownEditor,
	sanitizeEditorContent,
	useEditorRef,
} from '@/components/editor';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Id } from '@/convex/_generated/dataModel';
import { cn } from '@/lib/utils';
import { formatFullDate, formatRelativeDay } from '@/lib/utils/format-timestamp';

import { EmoteButton, EmoteContent, EmotePicker } from './emote-picker';
import { EventsTimeline } from './events-timeline';

const COLLAPSED_MAX_HEIGHT = 600; // pixels

function CollapsibleContent({ children }: { children: React.ReactNode }) {
	const contentRef = useRef<HTMLDivElement>(null);
	const [isOverflowing, setIsOverflowing] = useState(false);
	const [isExpanded, setIsExpanded] = useState(false);

	useEffect(() => {
		if (contentRef.current) {
			setIsOverflowing(contentRef.current.scrollHeight > COLLAPSED_MAX_HEIGHT);
		}
	}, [children]);

	return (
		<div className='relative'>
			<div
				ref={contentRef}
				className={cn('overflow-hidden transition-[max-height] duration-300', {
					'max-h-[600px]': !isExpanded && isOverflowing,
				})}
				style={
					isExpanded ? undefined : { maxHeight: isOverflowing ? COLLAPSED_MAX_HEIGHT : undefined }
				}
			>
				{children}
			</div>
			{isOverflowing && !isExpanded && (
				<div className='absolute inset-x-0 bottom-0 flex h-20 items-end justify-center bg-gradient-to-t from-background to-transparent'>
					<Button variant='outline' size='sm' onClick={() => setIsExpanded(true)} className='mb-2'>
						Show more
					</Button>
				</div>
			)}
		</div>
	);
}

type Comment = NonNullable<API['feedbackComment']['listByFeedback']>[number];
type FeedbackEvent = NonNullable<API['feedbackEvent']['listByFeedback']>[number];

type TimelineItem = { type: 'comment'; data: Comment } | { type: 'event'; data: FeedbackEvent };

type CommentItemProps = {
	comment: Comment;
	feedbackId: Id<'feedback'>;
	feedbackAuthorProfileId: Id<'profile'>;
	currentProfileId?: Id<'profile'>;
	isAnswer?: boolean;
	canMarkAnswer?: boolean;
};

function CommentItem({
	comment,
	feedbackId,
	feedbackAuthorProfileId,
	currentProfileId,
	isAnswer,
	canMarkAnswer,
}: CommentItemProps) {
	const { author, emoteCounts, isTeamMember } = comment;
	const isFeedbackAuthor = author?._id === feedbackAuthorProfileId;
	const location = useLocation();
	const commentRef = useRef<HTMLLIElement>(null);
	const commentId = `comment-${comment._id}`;

	// Edit state
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState(comment.content);
	const editEditorRef = useRef<MarkdownEditorRef>(null);

	// Highlight state for permalink
	const [isHighlighted, setIsHighlighted] = useState(false);

	// Check if current user owns this comment (client-side check for UI)
	const isOwner = currentProfileId && author?._id === currentProfileId;
	const isAuthenticated = !!currentProfileId;

	// Get editor ref for Quote feature
	let editorRef: React.RefObject<any> | null = null;
	try {
		editorRef = useEditorRef();
	} catch {
		// Not within EditorRefProvider - Quote won't be available
	}

	// Handle scroll-to and highlight on hash match
	useEffect(() => {
		if (typeof window === 'undefined') return;

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

	const handleQuote = () => {
		if (!editorRef?.current) return;
		// Preserve HTML styles in the quote
		editorRef.current.insertBlockquote(comment.content, true);
		editorRef.current.focus();
	};

	const handlePermalink = async () => {
		const url = `${window.location.origin}${location.pathname}#${commentId}`;
		await navigator.clipboard.writeText(url);
	};

	const { mutate: deleteComment, status: deleteStatus } = useMutation({
		mutationFn: useConvexMutation(api.feedbackComment.remove),
	});

	const { mutate: updateComment, status: updateStatus } = useMutation({
		mutationFn: useConvexMutation(api.feedbackComment.update),
		onSuccess: () => {
			setIsEditing(false);
		},
	});

	const { mutate: setAnswerComment } = useMutation({
		mutationFn: useConvexMutation(api.feedback.setAnswerComment),
	});

	const handleToggleAnswer = () => {
		setAnswerComment({
			feedbackId,
			commentId: isAnswer ? null : comment._id,
		});
	};

	const handleDelete = () => {
		if (confirm('Are you sure you want to delete this comment?')) {
			deleteComment({ _id: comment._id });
		}
	};

	const handleEdit = () => {
		setEditContent(comment.content);
		setIsEditing(true);
	};

	const handleCancelEdit = () => {
		setIsEditing(false);
		setEditContent(comment.content);
	};

	const handleSaveEdit = () => {
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

	// Get list of emotes with counts > 0
	const emoteEntries = Object.entries(emoteCounts) as [
		EmoteContent,
		{ count: number; authorProfileIds: string[] },
	][];

	const isDeleting = deleteStatus === 'pending';
	const isUpdating = updateStatus === 'pending';

	return (
		<li
			id={commentId}
			ref={commentRef}
			className={cn(
				'update-comment relative flex overflow-hidden rounded-lg border transition-all duration-500',
				{
					'ring-2 ring-primary ring-offset-2 ring-offset-background': isHighlighted,
					'border-green-500 dark:border-green-600': isAnswer,
				}
			)}
		>
			{isEditing ? (
				<div className='relative z-30 flex w-full flex-col p-6'>
					<div className='ml-6'>
						<div className='inline-block rounded-t-md bg-primary px-2 py-0.5 text-sm'>
							Editing comment
						</div>
					</div>
					<MarkdownEditor
						ref={editEditorRef}
						value={editContent}
						onChange={setEditContent}
						placeholder='Edit your comment...'
						disabled={isUpdating}
						minHeight='80px'
						maxHeight='600px'
						autoFocus
						className='relative rounded-b-none'
						onSubmitShortcut={handleSaveEdit}
					/>
					<div className='flex justify-end gap-2 rounded-b-md border-x border-b bg-background p-3'>
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
				className={cn(`flex w-full min-w-0`, {
					absolute: isEditing,
				})}
			>
				<div
					className={cn(
						'flex shrink-0 flex-col items-center justify-start border-r pt-3 pl-4',
						isAnswer
							? 'border-r-green-700 bg-linear-to-b from-green-400/20 via-green-400/10 to-transparent'
							: 'bg-muted'
					)}
				>
					<div className='relative -mr-4 size-8 overflow-hidden rounded-full border bg-linear-to-tr from-white/50 to-accent shadow-xl shadow-black'>
						{author?.imageUrl ? (
							<img className='size-8' src={author.imageUrl} alt={author.username} />
						) : (
							<div className='flex size-8 items-center justify-center bg-primary text-xs font-bold text-primary-foreground'>
								{author?.name?.charAt(0) ?? '?'}
							</div>
						)}
					</div>
				</div>
				<div className='flex w-full min-w-0 flex-col bg-background'>
					<div className='flex w-full justify-between gap-2 border-b px-6 py-4'>
						<span>
							{author ? (
								<Link className='hocus:underline' to='/@{$org}' params={{ org: author.username }}>
									@{author.username}
								</Link>
							) : (
								<span className='text-muted-foreground'>Unknown user</span>
							)}{' '}
							<span className='text-muted-foreground'>
								commented{' '}
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
							{isFeedbackAuthor && (
								<span className='inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground'>
									<Pencil className='h-3 w-3' />
									Author
								</span>
							)}
							{isTeamMember && (
								<span className='inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'>
									<Users className='h-3 w-3' />
									Team
								</span>
							)}
							{isAnswer && (
								<span className='inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400'>
									<Check className='h-3 w-3' />
									Answer
								</span>
							)}
						</div>
					</div>
					{/* EDIT STATE: Content area - add styles to this div using isEditing */}
					<div className={`flex min-w-0 flex-col gap-4 overflow-hidden p-6 ${isEditing ? '' : ''}`}>
						{/* EDIT STATE: Add overlay/background elements here */}
						<CollapsibleContent>
							<EditorContentDisplay content={comment.content} />
						</CollapsibleContent>
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
									<Button variant='ghost' size='sm' disabled={isDeleting}>
										<MoreHorizontal className='h-4 w-4' />
										<span className='sr-only'>More Actions</span>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align='end'>
									<DropdownMenuItem onClick={handlePermalink}>
										<LinkIcon size={14} />
										Permalink
									</DropdownMenuItem>
									{isAuthenticated && editorRef && (
										<DropdownMenuItem onClick={handleQuote}>
											<Quote size={14} />
											Quote
										</DropdownMenuItem>
									)}
									{canMarkAnswer && (
										<DropdownMenuItem onClick={handleToggleAnswer}>
											<Check size={14} />
											{isAnswer ? 'Unmark as answer' : 'Mark as answer'}
										</DropdownMenuItem>
									)}
									{isOwner && (
										<>
											<DropdownMenuItem onClick={handleEdit}>
												<Pencil size={14} />
												Edit
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={handleDelete}
												className='text-destructive focus:text-destructive'
											>
												<Trash2 size={14} />
												Delete
											</DropdownMenuItem>
										</>
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

type CommentsListProps = {
	feedbackId: Id<'feedback'>;
	feedbackAuthorProfileId: Id<'profile'>;
	currentProfileId?: Id<'profile'>;
	answerCommentId?: Id<'feedbackComment'>;
	canMarkAnswer?: boolean;
	events?: FeedbackEvent[];
};

export function CommentsList({
	feedbackId,
	feedbackAuthorProfileId,
	currentProfileId,
	answerCommentId,
	canMarkAnswer,
	events = [],
}: CommentsListProps) {
	const { data: comments } = useSuspenseQuery(
		convexQuery(api.feedbackComment.listByFeedback, { feedbackId })
	);

	// Filter out the initial comment (shown separately)
	const additionalComments = comments?.filter((c) => !c.initial) ?? [];

	// Create unified timeline of comments and events
	const timelineItems: TimelineItem[] = [
		...additionalComments.map((comment) => ({ type: 'comment' as const, data: comment })),
		...events.map((event) => ({ type: 'event' as const, data: event })),
	].sort((a, b) => a.data._creationTime - b.data._creationTime);

	if (timelineItems.length === 0) {
		return null;
	}

	return (
		<ul className='mt-6 flex flex-col gap-6'>
			{timelineItems.map((item) =>
				item.type === 'comment' ? (
					<CommentItem
						key={item.data._id}
						comment={item.data}
						feedbackId={feedbackId}
						feedbackAuthorProfileId={feedbackAuthorProfileId}
						currentProfileId={currentProfileId}
						isAnswer={answerCommentId === item.data._id}
						canMarkAnswer={canMarkAnswer}
					/>
				) : (
					<li key={item.data._id} className='relative'>
						<EventsTimeline events={[item.data]} />
					</li>
				)
			)}
		</ul>
	);
}
