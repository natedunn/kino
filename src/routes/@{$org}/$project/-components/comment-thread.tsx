import type { MarkdownEditorRef } from '@/components/editor/markdown-editor';
import type { EmoteContent } from '@/components/emote';
import type { ReactNode, RefObject } from 'react';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { isRichTextHtml } from '@convex/rich-text';
import { Link, useLocation } from '@tanstack/react-router';
import {
	CornerUpLeft,
	Link as LinkIcon,
	MessageCircle,
	MoreHorizontal,
	Pencil,
	Quote,
	Reply,
	Trash2,
	Users,
} from 'lucide-react';

import { EditorContentDisplay } from '@/components/editor';
import { LazyMarkdownEditor } from '@/components/editor/markdown-editor.lazy';
import { sanitizeEditorContent } from '@/components/editor/sanitize-content';
import { EmoteButton, EmotePicker } from '@/components/emote';
import { GradientIconBadge } from '@/components/gradient-icon-badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { localizeError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { formatFullDate, formatRelativeDay, toTimestamp } from '@/lib/utils/format-timestamp';
import { FORM_LIMITS } from '@/lib/validation';
import * as m from '@/paraglide/messages.js';

const COLLAPSED_MAX_HEIGHT = 600;
const REVEAL_EVENT = 'comment-reveal';
// Block elements a cloned selection may contain; anything else is inline text
// that needs a paragraph around it.
const BLOCK_SELECTOR = 'p, pre, ul, ol, blockquote, h1, h2, h3, h4, h5, h6, hr';

const CommentEditorContext = createContext<RefObject<MarkdownEditorRef | null> | null>(null);
// How a page brings a comment into view. Paginated threads override it so a
// target that isn't loaded yet can be paged in first.
const CommentJumpContext = createContext<(commentId: string) => void>(revealComment);
// The `#comment-<id>` hash a card already revealed. Cards that remount (or a
// re-render) must not scroll the page back to it again.
let revealedHash: string | null = null;

export type CommentAuthor = {
	id?: string;
	imageUrl?: string | null;
	name?: string | null;
	username?: string | null;
};

// The comment a reply answers. Threads stay flat; this only links back to it.
export type CommentReplyTo = {
	author: CommentAuthor | null;
	id: string;
};

export type ThreadComment = {
	author: CommentAuthor | null;
	canDelete?: boolean;
	canEdit?: boolean;
	content: string;
	createdAt: Date | number | string;
	emoteCounts?: Record<string, { authorProfileIds: Array<string>; count: number }>;
	id: string;
	replyTo?: CommentReplyTo | null;
	updatedTime?: Date | number | string | null;
};

// "@username", or the unknown-user label for deleted accounts.
function authorHandle(author: CommentAuthor | null | undefined) {
	return author?.username ? `@${author.username}` : (author?.name ?? m.feedback_unknown_user());
}

/**
 * Scrolls to and highlights a rendered comment and points the URL at it.
 * Returns false when the comment isn't on the page (the hash is still set, so
 * the card highlights itself once it mounts).
 */
export function revealComment(commentId: string) {
	const hash = `comment-${commentId}`;
	window.history.replaceState(window.history.state, '', `#${hash}`);
	if (!document.getElementById(hash)) return false;
	revealedHash = `#${hash}`;
	window.dispatchEvent(new CustomEvent(REVEAL_EVENT, { detail: commentId }));
	return true;
}

export function CommentEditorProvider({
	children,
	onJumpToComment = revealComment,
}: {
	children: ReactNode;
	onJumpToComment?: (commentId: string) => void;
}) {
	const editorRef = useRef<MarkdownEditorRef>(null);
	return (
		<CommentEditorContext.Provider value={editorRef}>
			<CommentJumpContext.Provider value={onJumpToComment}>{children}</CommentJumpContext.Provider>
		</CommentEditorContext.Provider>
	);
}

// Marks authors who belong to the project's organization.
export function TeamBadge() {
	return (
		<span className='inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'>
			<Users className='size-3' />
			{m.feedback_team()}
		</span>
	);
}

// Links to the comment a reply answers; clicking scrolls to and highlights it.
function ReplyToLink({ children, commentId }: { children: ReactNode; commentId: string }) {
	const jumpToComment = useContext(CommentJumpContext);
	return (
		<a
			className='link-text'
			href={`#comment-${commentId}`}
			onClick={(event) => {
				event.preventDefault();
				jumpToComment(commentId);
			}}
		>
			{children}
		</a>
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
	onReply,
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
	onReply?: (commentId: string) => void;
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
					onReply={onReply}
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
	maxLength = FORM_LIMITS.comment,
	onDelete,
	onQuote,
	onReply,
	onToggleEmote,
	onUnauthenticated,
	onUpdate,
	railClassName,
	verb = m.feedback_commented(),
}: {
	action?: ReactNode;
	badges?: ReactNode;
	className?: string;
	comment: ThreadComment;
	currentProfileId?: string;
	dropdownItems?: ReactNode;
	isDeleting?: boolean;
	isUpdating?: boolean;
	// Visible-text limit for edits; topic bodies allow more than replies.
	maxLength?: number;
	onDelete?: (commentId: string) => void;
	// Called after the comment (or the selected part of it) is quoted into the composer.
	onQuote?: (commentId: string) => void;
	// Shows a Reply action; pages set their composer's reply target here.
	onReply?: (commentId: string) => void;
	onToggleEmote?: (commentId: string, content: EmoteContent) => void;
	// Called when a signed-out visitor tries to react, so callers can prompt them
	// to sign in instead of the emote controls being disabled.
	onUnauthenticated?: () => void;
	onUpdate?: (commentId: string, content: string) => void | Promise<unknown>;
	railClassName?: string;
	verb?: string;
}) {
	const location = useLocation();
	const editorRef = useContext(CommentEditorContext);
	const commentRef = useRef<HTMLLIElement>(null);
	const bodyRef = useRef<HTMLDivElement>(null);
	// The selected part of the body, captured as the menu opens (opening it can
	// move focus and drop the selection before Quote is chosen).
	const selectionRef = useRef<string | null>(null);
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
		const timers: Array<ReturnType<typeof setTimeout>> = [];
		function reveal() {
			timers.push(
				setTimeout(() => {
					commentRef.current?.scrollIntoView({
						behavior: 'smooth',
						block: 'center',
					});
					setIsHighlighted(true);
					timers.push(setTimeout(() => setIsHighlighted(false), 2000));
				}, 100)
			);
		}
		if (window.location.hash === `#${commentHashId}` && revealedHash !== `#${commentHashId}`) {
			revealedHash = `#${commentHashId}`;
			reveal();
		}
		function handleReveal(event: Event) {
			if (`comment-${(event as CustomEvent<string>).detail}` === commentHashId) reveal();
		}
		window.addEventListener(REVEAL_EVENT, handleReveal);
		return () => {
			window.removeEventListener(REVEAL_EVENT, handleReveal);
			for (const timer of timers) clearTimeout(timer);
		};
	}, [commentHashId]);

	function captureSelection() {
		selectionRef.current = selectedHtml(bodyRef.current);
	}

	function handleQuote() {
		if (!editorRef?.current) return;
		const selected = selectionRef.current;
		selectionRef.current = null;
		const content = isRichTextHtml(comment.content)
			? comment.content
			: `<p>${escapeText(comment.content)}</p>`;
		editorRef.current.insertBlockquote(
			selected ?? content,
			true,
			m.comment_quote_attribution({ name: authorHandle(comment.author) })
		);
		editorRef.current.focus();
		onQuote?.(comment.id);
	}

	function handleReply() {
		onReply?.(comment.id);
		editorRef?.current?.focus();
	}

	async function handlePermalink() {
		const url = `${window.location.origin}${location.pathname}#${commentHashId}`;
		await navigator.clipboard.writeText(url);
	}

	function handleDelete() {
		if (!onDelete) return;
		if (confirm(m.feedback_comment_delete_confirm())) {
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
		if (text.length > maxLength) {
			setEditError(m.feedback_comment_too_long({ count: maxLength }));
			return;
		}

		try {
			await onUpdate(comment.id, sanitizedContent);
			editEditorRef.current?.clearLocalDraft();
			setIsEditing(false);
		} catch (updateError) {
			setEditError(localizeError(updateError, m.feedback_comment_save_failed()));
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
							{m.feedback_comment_editing()}
						</div>
					</div>
					<LazyMarkdownEditor
						ariaLabel={m.feedback_comment_edit()}
						autoFocus
						className='relative rounded-b-none'
						disabled={isUpdating}
						localDraftKey={`comment-edit:${comment.id}`}
						maxHeight='600px'
						minHeight='80px'
						onChange={setEditContent}
						onSubmitShortcut={handleSaveEdit}
						placeholder={m.feedback_comment_edit_placeholder()}
						ref={editEditorRef}
						value={editContent}
					/>
					<div className='flex justify-end gap-2 rounded-b-md border-x border-b bg-muted/30 p-3'>
						{editError ? (
							<p className='mr-auto self-center text-sm text-destructive'>{editError}</p>
						) : null}
						<Button
							disabled={isUpdating}
							onClick={() => {
								editEditorRef.current?.clearLocalDraft();
								setIsEditing(false);
								setEditContent(comment.content);
								setEditError('');
							}}
							size='sm'
							type='button'
							variant='ghost'
						>
							{m.common_cancel()}
						</Button>
						<Button disabled={isUpdating} onClick={handleSaveEdit} size='sm' type='button'>
							{isUpdating ? m.common_saving() : m.common_save()}
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
					<Avatar
						className='relative -mr-4 size-8 border shadow-xl shadow-black'
						fallbackName={
							comment.author?.username ?? comment.author?.name ?? m.feedback_unknown_user()
						}
					>
						<AvatarImage
							alt={comment.author?.username ?? comment.author?.name ?? m.feedback_unknown_user()}
							src={comment.author?.imageUrl ?? undefined}
						/>
						<AvatarFallback />
					</Avatar>
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
								<span className='text-muted-foreground'>{m.feedback_unknown_user()}</span>
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
													{m.comment_edited()}
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
								{comment.replyTo ? (
									<>
										{' • '}
										<ReplyToLink commentId={comment.replyTo.id}>
											<CornerUpLeft className='mr-1 inline size-3.5 align-[-2px]' />
											{m.comment_in_reply_to({ name: authorHandle(comment.replyTo.author) })}
										</ReplyToLink>
									</>
								) : null}
							</span>
						</span>
						{badges ? (
							<div className='flex shrink-0 flex-wrap items-center justify-end gap-2'>{badges}</div>
						) : null}
					</div>
					<div className='flex min-w-0 flex-col gap-4 overflow-hidden p-6'>
						<CollapsibleContent>
							<div ref={bodyRef}>
								<EditorContentDisplay content={comment.content} />
							</div>
						</CollapsibleContent>
						<div className='flex items-center justify-between gap-4'>
							<div className='flex flex-wrap items-center gap-2'>
								{onToggleEmote ? (
									<EmotePicker
										disabled={!currentProfileId}
										onSelect={(content) => onToggleEmote(comment.id, content)}
										onUnauthenticated={!currentProfileId ? onUnauthenticated : undefined}
									/>
								) : null}
								{emoteEntries.map(([emoteType, data]) => (
									<EmoteButton
										count={data.count}
										disabled={!onToggleEmote || (!currentProfileId && !onUnauthenticated)}
										emoteType={emoteType}
										isActive={
											currentProfileId ? data.authorProfileIds.includes(currentProfileId) : false
										}
										key={emoteType}
										onClick={() => {
											if (!currentProfileId) {
												onUnauthenticated?.();
												return;
											}
											onToggleEmote?.(comment.id, emoteType);
										}}
									/>
								))}
							</div>
							<div className='flex items-center gap-2'>
								{action}
								{onReply ? (
									<Button onClick={handleReply} size='sm' type='button' variant='ghost'>
										<Reply className='size-4' />
										{m.feedback_reply()}
									</Button>
								) : null}
								<DropdownMenu>
									<DropdownMenuTrigger
										asChild
										onKeyDown={captureSelection}
										onPointerDown={captureSelection}
									>
										<Button disabled={isDeleting} size='sm' variant='ghost'>
											<MoreHorizontal className='h-4 w-4' />
											<span className='sr-only'>{m.feedback_more_actions()}</span>
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align='end'>
										<DropdownMenuItem onClick={handlePermalink}>
											<LinkIcon size={14} />
											{m.feedback_comment_permalink()}
										</DropdownMenuItem>
										{editorRef ? (
											<DropdownMenuItem onClick={handleQuote}>
												<Quote size={14} />
												{m.feedback_comment_quote()}
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
														{m.common_edit()}
													</DropdownMenuItem>
												) : null}
												{canDelete && onDelete ? (
													<DropdownMenuItem
														className='text-destructive focus:text-destructive'
														onClick={handleDelete}
													>
														<Trash2 size={14} />
														{m.common_delete()}
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
	onCancelReply,
	onSubmit,
	placeholder = m.feedback_write_comment(),
	redirectTo,
	replyTo,
	signedOut = 'simple',
	submitLabel = m.feedback_post_comment(),
}: {
	isAuthenticated: boolean;
	isSubmitting?: boolean;
	onCancelReply?: () => void;
	onSubmit: (content: string) => Promise<void>;
	placeholder?: string;
	redirectTo: string;
	// The comment the next post answers, shown as a chip above the editor.
	replyTo?: CommentReplyTo | null;
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
			setError(m.feedback_comment_too_long({ count: FORM_LIMITS.comment }));
			return;
		}

		try {
			await onSubmit(sanitizedContent);
			setContent('');
			editorRef?.current?.clear();
		} catch (submitError) {
			setError(localizeError(submitError, m.feedback_comment_post_failed()));
		}
	}

	if (!isAuthenticated) {
		if (signedOut === 'rich') {
			return (
				<div className='mt-6 overflow-hidden rounded-lg border border-border bg-muted/50 p-5 md:p-8'>
					<div className='flex flex-col items-center justify-center gap-3 text-center md:gap-5'>
						<GradientIconBadge className='size-11 md:size-14'>
							<MessageCircle className='size-5 md:size-6' />
						</GradientIconBadge>
						<div className='flex flex-col gap-1 md:gap-1.5'>
							<h3 className='font-semibold tracking-tight md:text-lg'>
								{m.feedback_join_conversation()}
							</h3>
							<p className='text-xs text-balance text-muted-foreground md:text-sm'>
								{m.feedback_comment_sign_in_description()}
							</p>
						</div>
						<div className='flex w-full flex-col items-center gap-2 sm:w-auto sm:flex-row'>
							<Button asChild className='w-full sm:w-auto' size='sm'>
								<Link search={{ redirect: redirectTo } as never} to='/auth'>
									{m.feedback_comment_sign_in_action()}
								</Link>
							</Button>
							<Button asChild className='w-full sm:w-auto' size='sm' variant='outline'>
								<Link search={{ redirect: redirectTo } as never} to='/auth/sign-up'>
									{m.auth_create_account_action()}
								</Link>
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
						{m.auth_sign_in_title()}
					</Link>{' '}
					{m.feedback_comment_sign_in_suffix()}
				</p>
			</div>
		);
	}

	return (
		<div className='mt-6'>
			{replyTo ? (
				<div className='ml-6 flex'>
					<div className='inline-flex min-w-0 items-center gap-1.5 rounded-t-md border border-b-0 bg-muted px-2.5 py-1 text-sm text-muted-foreground'>
						<CornerUpLeft className='size-3.5 shrink-0' />
						<ReplyToLink commentId={replyTo.id}>
							{m.comment_replying_to({ name: authorHandle(replyTo.author) })}
						</ReplyToLink>
						{onCancelReply ? (
							<>
								<span aria-hidden>·</span>
								<button className='link-text' onClick={onCancelReply} type='button'>
									{m.common_cancel()}
								</button>
							</>
						) : null}
					</div>
				</div>
			) : null}
			<LazyMarkdownEditor
				ariaLabel={placeholder}
				className='rounded-b-none'
				disabled={isSubmitting}
				localDraftKey='comment-new'
				maxHeight='400px'
				minHeight='80px'
				onChange={setContent}
				onSubmitShortcut={handleSubmit}
				placeholder={placeholder}
				ref={editorRef}
				value={content}
			/>
			<div className='flex justify-end gap-2 rounded-b-md border-x border-b bg-muted/30 p-3'>
				{error ? <p className='mr-auto self-center text-sm text-destructive'>{error}</p> : null}
				<Button
					disabled={isSubmitting || !hasEditorText(content)}
					onClick={handleSubmit}
					size='sm'
					type='button'
				>
					{isSubmitting ? m.feedback_posting() : submitLabel}
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
						{m.comment_show_more()}
					</Button>
				</div>
			) : null}
		</div>
	);
}

function escapeText(value: string) {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// The HTML of a non-empty selection that lies inside `container`, or null.
function selectedHtml(container: HTMLElement | null) {
	const selection = window.getSelection();
	if (!container || !selection || selection.isCollapsed || !selection.rangeCount) return null;
	const range = selection.getRangeAt(0);
	if (!container.contains(range.commonAncestorContainer)) return null;
	const wrapper = document.createElement('div');
	wrapper.append(range.cloneContents());
	if (!wrapper.textContent.trim()) return null;
	// A selection within one paragraph clones only its inline content.
	return wrapper.querySelector(BLOCK_SELECTOR) ? wrapper.innerHTML : `<p>${wrapper.innerHTML}</p>`;
}

function hasEditorText(value: string) {
	return (
		value
			.replace(/<[^>]*>/g, '')
			.replace(/&nbsp;/g, ' ')
			.trim().length > 0
	);
}
