import type { MarkdownEditorRef } from '@/components/editor';

import { useEffect, useRef, useState } from 'react';
import { useConvexMutation } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';
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

import { api } from '~api';
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

// ─── Collapsible content for long comments ───────────────────────────────────

const COLLAPSED_MAX_HEIGHT = 600;

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
					'max-h-150': !isExpanded && isOverflowing,
				})}
				style={
					isExpanded ? undefined : { maxHeight: isOverflowing ? COLLAPSED_MAX_HEIGHT : undefined }
				}
			>
				{children}
			</div>
			{isOverflowing && !isExpanded && (
				<div className='absolute inset-x-0 bottom-0 flex h-20 items-end justify-center bg-linear-to-t from-background to-transparent'>
					<Button variant='outline' size='sm' onClick={() => setIsExpanded(true)} className='mb-2'>
						Show more
					</Button>
				</div>
			)}
		</div>
	);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type FeedbackCommentAuthor = {
	_id: Id<'profile'>;
	username: string;
	name?: string;
	imageUrl?: string;
} | null;

export type FeedbackCommentData = {
	_id: Id<'feedbackComment'>;
	content: string;
	_creationTime: number;
	updatedTime?: number;
	author: FeedbackCommentAuthor;
	emoteCounts: Record<EmoteContent, { count: number; authorProfileIds: string[] }>;
	isTeamMember: boolean;
};

type FeedbackCommentProps = {
	/** "initial" = the first comment (question/description), "reply" = a regular comment */
	variant: 'initial' | 'reply';
	comment: FeedbackCommentData;
	feedback: {
		_id: Id<'feedback'>;
		authorProfileId: Id<'profile'>;
	};
	currentProfileId?: Id<'profile'>;
	isAnswer?: boolean;
	canMarkAnswer?: boolean;
};

export function FeedbackComment({
	variant,
	comment,
	feedback,
	currentProfileId,
	isAnswer,
	canMarkAnswer,
}: FeedbackCommentProps) {
	const { _id: commentId, content, _creationTime: creationTime, updatedTime, author, emoteCounts, isTeamMember } = comment;
	const { _id: feedbackId, authorProfileId: feedbackAuthorProfileId } = feedback;

	const isInitial = variant === 'initial';
	const isFeedbackAuthor = author?._id === feedbackAuthorProfileId;
	const isOwner = currentProfileId && author?._id === currentProfileId;
	const isAuthenticated = !!currentProfileId;

	const location = useLocation();
	const commentRef = useRef<HTMLLIElement>(null);
	const htmlCommentId = `comment-${commentId}`;

	// Edit state
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState(content);
	const editEditorRef = useRef<MarkdownEditorRef>(null);

	// Highlight state for permalink
	const [isHighlighted, setIsHighlighted] = useState(false);

	// Get editor ref for Quote feature (reply comments only)
	let editorRef: React.RefObject<any> | null = null;
	if (!isInitial) {
		try {
			editorRef = useEditorRef();
		} catch {
			// Not within EditorRefProvider — Quote won't be available
		}
	}

	// Handle scroll-to and highlight on hash match
	useEffect(() => {
		if (typeof window === 'undefined') return;

		const hash = window.location.hash;
		if (hash === `#${htmlCommentId}`) {
			setTimeout(() => {
				commentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
				setIsHighlighted(true);
				setTimeout(() => setIsHighlighted(false), 2000);
			}, 100);
		}
	}, [htmlCommentId]);

	// ─── Mutations ─────────────────────────────────────────────────────────────

	const { mutate: updateComment, status: updateStatus } = useMutation({
		mutationFn: useConvexMutation(api.feedbackComment.update),
		onSuccess: () => {
			setIsEditing(false);
		},
	});

	const { mutate: deleteComment, status: deleteStatus } = useMutation({
		mutationFn: useConvexMutation(api.feedbackComment.remove),
	});

	const { mutate: setAnswerComment } = useMutation({
		mutationFn: useConvexMutation(api.feedback.setAnswerComment),
	});

	// ─── Handlers ──────────────────────────────────────────────────────────────

	const handleEdit = () => {
		setEditContent(content);
		setIsEditing(true);
	};

	const handleCancelEdit = () => {
		setIsEditing(false);
		setEditContent(content);
	};

	const handleSaveEdit = () => {
		const html = editEditorRef.current?.getHTML() ?? editContent;
		const text = editEditorRef.current?.getText() ?? '';

		if (!text.trim()) return;

		const sanitizedContent = sanitizeEditorContent(html);
		if (!sanitizedContent) return;

		updateComment({
			_id: commentId,
			content: sanitizedContent,
		});
	};

	const handlePermalink = async () => {
		const url = `${window.location.origin}${location.pathname}#${htmlCommentId}`;
		await navigator.clipboard.writeText(url);
	};

	const handleQuote = () => {
		if (!editorRef?.current) return;
		editorRef.current.insertBlockquote(content, true);
		editorRef.current.focus();
	};

	const handleToggleAnswer = () => {
		setAnswerComment({
			feedbackId,
			commentId: isAnswer ? null : commentId,
		});
	};

	const handleDelete = () => {
		if (confirm('Are you sure you want to delete this comment?')) {
			deleteComment({ _id: commentId });
		}
	};

	// ─── Derived state ─────────────────────────────────────────────────────────

	const isUpdating = updateStatus === 'pending';
	const isDeleting = deleteStatus === 'pending';

	const emoteEntries = Object.entries(emoteCounts) as [
		EmoteContent,
		{ count: number; authorProfileIds: string[] },
	][];

	const editLabel = isInitial ? 'Editing post' : 'Editing comment';
	const editPlaceholder = isInitial ? 'Edit your post...' : 'Edit your comment...';

	// ─── Render ────────────────────────────────────────────────────────────────

	if (!author && isInitial) return null;

	return (
		<li
			id={htmlCommentId}
			ref={commentRef}
			className={cn(
				'update-comment relative flex overflow-hidden rounded-lg border transition-all duration-500',
				{
					'ring-2 ring-primary ring-offset-2 ring-offset-background': isHighlighted,
					'border-green-500 dark:border-green-600': isAnswer,
				}
			)}
		>
			{/* ── Edit overlay ──────────────────────────────────────────────────── */}
			{isEditing ? (
				<div className='relative z-30 flex w-full flex-col p-6'>
					<div className='ml-6'>
						<div className='inline-block rounded-t-md bg-primary px-2 py-0.5 text-sm'>
							{editLabel}
						</div>
					</div>
					<MarkdownEditor
						ref={editEditorRef}
						value={editContent}
						onChange={setEditContent}
						placeholder={editPlaceholder}
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
					<div className='absolute inset-0 z-20 bg-background/70 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.15)_0,rgba(255,255,255,0.15)_1px,transparent_1px,transparent_8px)]' />
					<div className='absolute inset-0 z-10 bg-background/70' />
				</>
			)}

			{/* ── Comment body ──────────────────────────────────────────────────── */}
			<div
				className={cn('flex w-full min-w-0', {
					absolute: isEditing,
				})}
			>
				{/* Avatar rail */}
				<div
					className={cn(
						'flex shrink-0 flex-col items-center justify-start border-r pt-3 pl-4',
						isAnswer
							? 'border-r-green-700 bg-linear-to-b from-green-400/20 via-green-400/10 to-transparent'
							: 'bg-foreground/5'
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

				{/* Content */}
				<div className='flex w-full min-w-0 flex-col bg-muted'>
					{/* Header */}
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
								{isInitial ? 'opened this feedback ' : 'commented '}
								<Tooltip>
									<TooltipTrigger asChild delay={100}>
										<span
											className='cursor-pointer border-b border-dotted border-foreground/50 text-foreground/70'
											suppressHydrationWarning
										>
											{formatRelativeDay(creationTime)}
										</span>
									</TooltipTrigger>
									<TooltipContent>
										<span suppressHydrationWarning>{formatFullDate(creationTime)}</span>
									</TooltipContent>
								</Tooltip>
								{updatedTime && (
									<>
										{' \u2022 '}
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
												<span suppressHydrationWarning>{formatFullDate(updatedTime)}</span>
											</TooltipContent>
										</Tooltip>
									</>
								)}
							</span>
						</span>
						<div className='flex items-center gap-2'>
							{(isInitial || isFeedbackAuthor) && (
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

					{/* Body */}
					<div className='flex min-w-0 flex-col gap-4 overflow-hidden p-6'>
						{isInitial ? (
							<EditorContentDisplay content={content} />
						) : (
							<CollapsibleContent>
								<EditorContentDisplay content={content} />
							</CollapsibleContent>
						)}

						{/* Footer: emotes + actions */}
						<div className='flex items-center justify-between'>
							<div className='flex items-center gap-2'>
								<EmotePicker
									feedbackId={feedbackId}
									commentId={commentId}
									currentProfileId={currentProfileId}
								/>
								{emoteEntries.map(([emoteType, data]) => (
									<EmoteButton
										key={emoteType}
										feedbackId={feedbackId}
										commentId={commentId}
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
									{!isInitial && isAuthenticated && editorRef && (
										<DropdownMenuItem onClick={handleQuote}>
											<Quote size={14} />
											Quote
										</DropdownMenuItem>
									)}
									{!isInitial && canMarkAnswer && (
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
											{!isInitial && (
												<DropdownMenuItem
													onClick={handleDelete}
													className='text-destructive focus:text-destructive'
												>
													<Trash2 size={14} />
													Delete
												</DropdownMenuItem>
											)}
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
