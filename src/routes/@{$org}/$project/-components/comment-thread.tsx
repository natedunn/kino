import type { MarkdownEditorRef } from '@/components/editor';
import type { EmoteContent } from '@/components/emote';
import type { ReactNode, RefObject } from 'react';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import {
	Link as LinkIcon,
	MessageCircle,
	MoreHorizontal,
	Pencil,
	Quote,
	Trash2,
} from 'lucide-react';

import { EditorContentDisplay, MarkdownEditor, sanitizeEditorContent } from '@/components/editor';
import { EmoteButton, EmotePicker } from '@/components/emote';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatFullDate, formatRelativeDay, toTimestamp } from '@/lib/utils/format-timestamp';
import { FORM_LIMITS } from '@/lib/validation';

const COLLAPSED_MAX_HEIGHT = 600;

const CommentEditorContext = createContext<RefObject<MarkdownEditorRef | null> | null>(null);

export type CommentAuthor = {
	id?: string;
	imageUrl?: string | null;
	name?: string | null;
	username?: string | null;
};

export type ThreadComment = {
	author: CommentAuthor | null;
	canDelete?: boolean;
	canEdit?: boolean;
	content: string;
	createdAt: Date | number | string;
	emoteCounts?: Record<string, { authorProfileIds: Array<string>; count: number }>;
	id: string;
	updatedTime?: Date | number | string | null;
};

export function CommentEditorProvider({ children }: { children: ReactNode }) {
	const editorRef = useRef<MarkdownEditorRef>(null);
	return (
		<CommentEditorContext.Provider value={editorRef}>{children}</CommentEditorContext.Provider>
	);
}

export function CommentList<TComment extends ThreadComment>({
	comments,
	currentProfileId,
	getAction,
	getBadges,
	getClassName,
	getDropdownItems,
	getRailClassName,
	isDeleting,
	isUpdating,
	onDelete,
	onToggleEmote,
	onUpdate,
}: {
	comments: Array<TComment>;
	currentProfileId?: string;
	getAction?: (comment: TComment) => ReactNode;
	getBadges?: (comment: TComment) => ReactNode;
	getClassName?: (comment: TComment) => string | undefined;
	getDropdownItems?: (comment: TComment) => ReactNode;
	getRailClassName?: (comment: TComment) => string | undefined;
	isDeleting?: boolean;
	isUpdating?: boolean;
	onDelete?: (commentId: string) => void;
	onToggleEmote?: (commentId: string, content: EmoteContent) => void;
	onUpdate?: (commentId: string, content: string) => void | Promise<unknown>;
}) {
	if (comments.length === 0) return null;

	return (
		<ul
			className={cn(
				'relative mt-6 flex flex-col gap-6',
				comments.length > 1 &&
					'before:absolute before:top-0 before:bottom-0 before:left-[33px] before:z-0 before:border-r before:border-border'
			)}
		>
			{comments.map((comment) => (
				<CommentCard
					action={getAction?.(comment)}
					badges={getBadges?.(comment)}
					className={getClassName?.(comment)}
					comment={comment}
					currentProfileId={currentProfileId}
					dropdownItems={getDropdownItems?.(comment)}
					isDeleting={isDeleting}
					isUpdating={isUpdating}
					key={comment.id}
					onDelete={onDelete}
					onToggleEmote={onToggleEmote}
					onUpdate={onUpdate}
					railClassName={getRailClassName?.(comment)}
				/>
			))}
		</ul>
	);
}

export function CommentCard({
	action,
	badges,
	className,
	comment,
	currentProfileId,
	dropdownItems,
	isDeleting,
	isUpdating,
	onDelete,
	onToggleEmote,
	onUpdate,
	railClassName,
	verb = 'commented',
}: {
	action?: ReactNode;
	badges?: ReactNode;
	className?: string;
	comment: ThreadComment;
	currentProfileId?: string;
	dropdownItems?: ReactNode;
	isDeleting?: boolean;
	isUpdating?: boolean;
	onDelete?: (commentId: string) => void;
	onToggleEmote?: (commentId: string, content: EmoteContent) => void;
	onUpdate?: (commentId: string, content: string) => void | Promise<unknown>;
	railClassName?: string;
	verb?: string;
}) {
	const location = useLocation();
	const editorRef = useContext(CommentEditorContext);
	const commentRef = useRef<HTMLLIElement>(null);
	const editEditorRef = useRef<MarkdownEditorRef>(null);
	const commentHashId = `comment-${comment.id}`;
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState(comment.content);
	const [editError, setEditError] = useState('');
	const [isHighlighted, setIsHighlighted] = useState(false);
	const canEdit =
		comment.canEdit ??
		(!!currentProfileId && !!comment.author?.id && comment.author.id === currentProfileId);
	const canDelete = comment.canDelete ?? canEdit;

	useEffect(() => {
		if (typeof window === 'undefined') return;
		if (window.location.hash !== `#${commentHashId}`) return;

		setTimeout(() => {
			commentRef.current?.scrollIntoView({
				behavior: 'smooth',
				block: 'center',
			});
			setIsHighlighted(true);
			setTimeout(() => setIsHighlighted(false), 2000);
		}, 100);
	}, [commentHashId]);

	function handleQuote() {
		if (!editorRef?.current) return;
		editorRef.current.insertBlockquote(comment.content, true);
		editorRef.current.focus();
	}

	async function handlePermalink() {
		const url = `${window.location.origin}${location.pathname}#${commentHashId}`;
		await navigator.clipboard.writeText(url);
	}

	function handleDelete() {
		if (!onDelete) return;
		if (confirm('Are you sure you want to delete this comment?')) {
			onDelete(comment.id);
		}
	}

	async function handleSaveEdit() {
		if (!onUpdate) return;
		setEditError('');
		const html = editEditorRef.current?.getHTML() ?? editContent;
		const text = editEditorRef.current?.getText() ?? '';
		if (!text.trim()) return;

		const sanitizedContent = sanitizeEditorContent(html);
		if (!sanitizedContent) return;
		// Count visible text, not HTML markup (see CommentForm.handleSubmit).
		if (text.length > FORM_LIMITS.comment) {
			setEditError(`Comments must be ${FORM_LIMITS.comment} characters or fewer.`);
			return;
		}

		try {
			await onUpdate(comment.id, sanitizedContent);
			setIsEditing(false);
		} catch (updateError) {
			setEditError(
				updateError instanceof Error
					? updateError.message
					: 'Failed to save comment. Please try again.'
			);
		}
	}

	const emoteEntries = Object.entries(comment.emoteCounts ?? {}) as Array<
		[EmoteContent, { authorProfileIds: Array<string>; count: number }]
	>;

	return (
		<li
			className={cn(
				'comment-component relative z-10 flex overflow-hidden rounded-lg border bg-card transition-all duration-500',
				isHighlighted && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
				className
			)}
			id={commentHashId}
			ref={commentRef}
		>
			{isEditing ? (
				<div className='relative z-30 flex w-full flex-col p-6'>
					<div className='ml-6'>
						<div className='inline-block rounded-t-md bg-primary px-2 py-0.5 text-sm'>
							Editing comment
						</div>
					</div>
					<MarkdownEditor
						ariaLabel='Edit comment'
						autoFocus
						className='relative rounded-b-none'
						disabled={isUpdating}
						maxHeight='600px'
						minHeight='80px'
						onChange={setEditContent}
						onSubmitShortcut={handleSaveEdit}
						placeholder='Edit your comment...'
						ref={editEditorRef}
						value={editContent}
					/>
					<div className='flex justify-end gap-2 rounded-b-md border-x border-b bg-background p-3'>
						{editError ? (
							<p className='mr-auto self-center text-sm text-destructive'>{editError}</p>
						) : null}
						<Button
							disabled={isUpdating}
							onClick={() => {
								setIsEditing(false);
								setEditContent(comment.content);
								setEditError('');
							}}
							size='sm'
							type='button'
							variant='ghost'
						>
							Cancel
						</Button>
						<Button disabled={isUpdating} onClick={handleSaveEdit} size='sm' type='button'>
							{isUpdating ? 'Saving...' : 'Save'}
						</Button>
					</div>
				</div>
			) : null}
			{isEditing ? (
				<>
					<div className='absolute inset-0 z-20 bg-background/70 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.15)_0,rgba(255,255,255,0.15)_1px,transparent_1px,transparent_8px)]' />
					<div className='absolute inset-0 z-10 bg-background/70' />
				</>
			) : null}
			<div className={cn('flex w-full min-w-0', { absolute: isEditing })}>
				<div
					className={cn(
						'flex shrink-0 flex-col items-center justify-start border-r bg-accent pt-3 pl-4',
						railClassName
					)}
				>
					<div className='relative -mr-4 size-8 overflow-hidden rounded-full border bg-linear-to-tr from-white/50 to-accent shadow-xl shadow-black'>
						{comment.author?.imageUrl ? (
							<img
								alt={comment.author.username ?? ''}
								className='size-8 object-cover'
								src={comment.author.imageUrl}
							/>
						) : (
							<div className='flex size-8 items-center justify-center bg-primary text-xs font-bold text-primary-foreground'>
								{comment.author?.name?.charAt(0) ?? comment.author?.username?.charAt(0) ?? '?'}
							</div>
						)}
					</div>
				</div>
				<div className='flex w-full min-w-0 flex-col bg-card'>
					<div className='flex w-full justify-between gap-2 border-b px-6 py-4'>
						<span>
							{comment.author?.username ? (
								<Link
									className='hocus:underline'
									params={{ username: comment.author.username }}
									to='/u/$username'
								>
									@{comment.author.username}
								</Link>
							) : (
								<span className='text-muted-foreground'>Unknown user</span>
							)}{' '}
							<span className='text-muted-foreground'>
								{verb}{' '}
								<Tooltip>
									<TooltipTrigger asChild delay={100}>
										<span
											className='cursor-pointer border-b border-dotted border-foreground/50 text-foreground/70'
											suppressHydrationWarning
										>
											{formatRelativeDay(toTimestamp(comment.createdAt))}
										</span>
									</TooltipTrigger>
									<TooltipContent>
										<span suppressHydrationWarning>
											{formatFullDate(toTimestamp(comment.createdAt))}
										</span>
									</TooltipContent>
								</Tooltip>
								{comment.updatedTime ? (
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
												<span suppressHydrationWarning>
													{formatFullDate(toTimestamp(comment.updatedTime))}
												</span>
											</TooltipContent>
										</Tooltip>
									</>
								) : null}
							</span>
						</span>
						{badges ? <div className='flex items-center gap-2'>{badges}</div> : null}
					</div>
					<div className='flex min-w-0 flex-col gap-4 overflow-hidden p-6'>
						<CollapsibleContent>
							<EditorContentDisplay content={comment.content} />
						</CollapsibleContent>
						<div className='flex items-center justify-between gap-4'>
							<div className='flex flex-wrap items-center gap-2'>
								{onToggleEmote ? (
									<EmotePicker
										disabled={!currentProfileId}
										onSelect={(content) => onToggleEmote(comment.id, content)}
									/>
								) : null}
								{emoteEntries.map(([emoteType, data]) => (
									<EmoteButton
										count={data.count}
										disabled={!currentProfileId || !onToggleEmote}
										emoteType={emoteType}
										isActive={
											currentProfileId ? data.authorProfileIds.includes(currentProfileId) : false
										}
										key={emoteType}
										onClick={() => onToggleEmote?.(comment.id, emoteType)}
									/>
								))}
							</div>
							<div className='flex items-center gap-2'>
								{action}
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button disabled={isDeleting} size='sm' variant='ghost'>
											<MoreHorizontal className='h-4 w-4' />
											<span className='sr-only'>More Actions</span>
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align='end'>
										<DropdownMenuItem onClick={handlePermalink}>
											<LinkIcon size={14} />
											Permalink
										</DropdownMenuItem>
										{editorRef ? (
											<DropdownMenuItem onClick={handleQuote}>
												<Quote size={14} />
												Quote
											</DropdownMenuItem>
										) : null}
										{dropdownItems}
										{canEdit || canDelete ? (
											<>
												{canEdit && onUpdate ? (
													<DropdownMenuItem
														onClick={() => {
															setEditContent(comment.content);
															setIsEditing(true);
														}}
													>
														<Pencil size={14} />
														Edit
													</DropdownMenuItem>
												) : null}
												{canDelete && onDelete ? (
													<DropdownMenuItem
														className='text-destructive focus:text-destructive'
														onClick={handleDelete}
													>
														<Trash2 size={14} />
														Delete
													</DropdownMenuItem>
												) : null}
											</>
										) : null}
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						</div>
					</div>
				</div>
			</div>
		</li>
	);
}

export function CommentForm({
	isAuthenticated,
	isSubmitting,
	onSubmit,
	placeholder = 'Write a comment...',
	redirectTo,
	signedOut = 'simple',
	submitLabel = 'Post Comment',
}: {
	isAuthenticated: boolean;
	isSubmitting?: boolean;
	onSubmit: (content: string) => Promise<void>;
	placeholder?: string;
	redirectTo: string;
	signedOut?: 'rich' | 'simple';
	submitLabel?: string;
}) {
	const [content, setContent] = useState('');
	const [error, setError] = useState('');
	const editorRef = useContext(CommentEditorContext);

	async function handleSubmit() {
		setError('');
		const html = editorRef?.current?.getHTML() ?? content;
		const text = editorRef?.current?.getText() ?? '';
		if (!text.trim()) return;

		const sanitizedContent = sanitizeEditorContent(html);
		if (!sanitizedContent) return;
		// Count visible text, not the HTML markup, so the "characters" the user is
		// told about matches what they actually typed. The server still caps the
		// stored HTML length as a hard backstop.
		if (text.length > FORM_LIMITS.comment) {
			setError(`Comments must be ${FORM_LIMITS.comment} characters or fewer.`);
			return;
		}

		try {
			await onSubmit(sanitizedContent);
			setContent('');
			editorRef?.current?.clear();
		} catch (submitError) {
			setError(submitError instanceof Error ? submitError.message : 'Unable to post comment');
		}
	}

	if (!isAuthenticated) {
		if (signedOut === 'rich') {
			return (
				<div className='mt-6 rounded-lg border border-dashed border-border bg-muted/50 p-8'>
					<div className='flex flex-col items-center justify-center gap-4 text-center'>
						<div className='flex size-12 items-center justify-center rounded-full bg-primary/10'>
							<MessageCircle className='size-6 text-primary' />
						</div>
						<div className='flex flex-col gap-1'>
							<h3 className='font-medium'>Join the conversation</h3>
							<p className='text-sm text-muted-foreground'>
								Sign in to share your thoughts and help improve this project.
							</p>
						</div>
						<div className='flex items-center gap-2'>
							<Button asChild>
								<Link search={{ redirect: redirectTo } as never} to='/auth'>
									Sign in to comment
								</Link>
							</Button>
							<Button asChild variant='outline'>
								<Link to='/'>Create an account</Link>
							</Button>
						</div>
					</div>
				</div>
			);
		}

		return (
			<div className='mt-6 rounded-lg border bg-muted/50 p-6 text-center'>
				<p className='text-muted-foreground'>
					<Link
						className='font-medium text-primary underline-offset-4 hover:underline'
						search={{ redirect: redirectTo } as never}
						to='/auth'
					>
						Sign in
					</Link>{' '}
					to leave a comment.
				</p>
			</div>
		);
	}

	return (
		<div className='mt-6'>
			<MarkdownEditor
				ariaLabel={placeholder}
				className='rounded-b-none'
				disabled={isSubmitting}
				maxHeight='400px'
				minHeight='80px'
				onChange={setContent}
				onSubmitShortcut={handleSubmit}
				placeholder={placeholder}
				ref={editorRef}
				value={content}
			/>
			<div className='flex justify-end gap-2 rounded-b-md border-x border-b bg-muted p-3'>
				{error ? <p className='mr-auto self-center text-sm text-destructive'>{error}</p> : null}
				<Button
					disabled={isSubmitting || !hasEditorText(content)}
					onClick={handleSubmit}
					type='button'
				>
					{isSubmitting ? 'Posting...' : submitLabel}
				</Button>
			</div>
		</div>
	);
}

function CollapsibleContent({ children }: { children: ReactNode }) {
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
				className={cn('overflow-hidden transition-[max-height] duration-300', {
					'max-h-[600px]': !isExpanded && isOverflowing,
				})}
				ref={contentRef}
				style={
					isExpanded ? undefined : { maxHeight: isOverflowing ? COLLAPSED_MAX_HEIGHT : undefined }
				}
			>
				{children}
			</div>
			{isOverflowing && !isExpanded ? (
				<div className='absolute inset-x-0 bottom-0 flex h-20 items-end justify-center bg-gradient-to-t from-background to-transparent'>
					<Button className='mb-2' onClick={() => setIsExpanded(true)} size='sm' variant='outline'>
						Show more
					</Button>
				</div>
			) : null}
		</div>
	);
}

function hasEditorText(value: string) {
	return (
		value
			.replace(/<[^>]*>/g, '')
			.replace(/&nbsp;/g, ' ')
			.trim().length > 0
	);
}
