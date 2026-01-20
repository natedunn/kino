import { useConvexMutation } from '@convex-dev/react-query';
import { convexQuery } from '@convex-dev/react-query';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { MoreHorizontal, Pencil, Quote, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

import { api, API } from '~api';
import { EditorContentDisplay, MarkdownEditor, type MarkdownEditorRef, useEditorRef, sanitizeEditorContent } from '@/components/editor';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Id } from '@/convex/_generated/dataModel';
import { formatTimestamp } from '@/lib/utils/format-timestamp';

import { EmoteButton, EmoteContent, EmotePicker } from './emote-picker';

type Comment = NonNullable<API['feedbackComment']['listByFeedback']>[number];

type CommentItemProps = {
	comment: Comment;
	feedbackId: Id<'feedback'>;
	currentProfileId?: Id<'profile'>;
};

function CommentItem({ comment, feedbackId, currentProfileId }: CommentItemProps) {
	const { author, emoteCounts } = comment;

	// Edit state
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState(comment.content);
	const editEditorRef = useRef<MarkdownEditorRef>(null);

	// Check if current user owns this comment (client-side check for UI)
	const isOwner = currentProfileId && author?._id === currentProfileId;

	// Get editor ref for Quote feature
	let editorRef: React.RefObject<any> | null = null;
	try {
		editorRef = useEditorRef();
	} catch {
		// Not within EditorRefProvider - Quote won't be available
	}

	const handleQuote = () => {
		if (!editorRef?.current) return;
		// Strip HTML tags for plain text quote
		const plainText = comment.content.replace(/<[^>]*>/g, '');
		editorRef.current.insertBlockquote(plainText);
		editorRef.current.focus();
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
		<li className="update-comment relative flex overflow-hidden rounded-lg border">
			<div className="flex flex-col items-center justify-start border-r bg-muted pt-3 pl-4">
				<div className="relative z-10 -mr-4 size-8 overflow-hidden rounded-full border bg-gradient-to-tr from-white/50 to-accent shadow-xl shadow-black">
					{author?.imageUrl ? (
						<img className="size-8" src={author.imageUrl} alt={author.username} />
					) : (
						<div className="flex size-8 items-center justify-center bg-primary text-xs font-bold text-primary-foreground">
							{author?.name?.charAt(0) ?? '?'}
						</div>
					)}
				</div>
			</div>
			<div className="flex w-full flex-col bg-background">
				<div className="flex w-full justify-between gap-2 border-b px-6 py-4">
					<span>
						{author ? (
							<Link className="hocus:underline" to="/@{$org}" params={{ org: author.username }}>
								@{author.username}
							</Link>
						) : (
							<span className="text-muted-foreground">Unknown user</span>
						)}{' '}
						<span className="text-muted-foreground">commented</span>
					</span>
					<div className="flex items-center gap-2">
						<span className="text-muted-foreground">{formatTimestamp(comment._creationTime)}</span>
						<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm" disabled={isDeleting}>
								<MoreHorizontal className="h-4 w-4" />
								<span className="sr-only">More Actions</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{editorRef && (
								<DropdownMenuItem onClick={handleQuote}>
									<Quote size={14} />
									Quote
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
										className="text-destructive focus:text-destructive"
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
				<div className="flex flex-col gap-4 p-6">
					{isEditing ? (
						<div className="flex flex-col gap-3">
							<MarkdownEditor
								ref={editEditorRef}
								value={editContent}
								onChange={setEditContent}
								placeholder="Edit your comment..."
								disabled={isUpdating}
								minHeight="80px"
							/>
							<div className="flex justify-end gap-2">
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={handleCancelEdit}
									disabled={isUpdating}
								>
									Cancel
								</Button>
								<Button
									type="button"
									size="sm"
									onClick={handleSaveEdit}
									disabled={isUpdating}
								>
									{isUpdating ? 'Saving...' : 'Save'}
								</Button>
							</div>
						</div>
					) : (
						<EditorContentDisplay content={comment.content} />
					)}
					<div className="flex items-center gap-2">
						<EmotePicker feedbackId={feedbackId} commentId={comment._id} currentProfileId={currentProfileId} />
						{emoteEntries.map(([emoteType, data]) => (
							<EmoteButton
								key={emoteType}
								feedbackId={feedbackId}
								commentId={comment._id}
								emoteType={emoteType}
								count={data.count}
								isActive={currentProfileId ? data.authorProfileIds.includes(currentProfileId) : false}
								currentProfileId={currentProfileId}
							/>
						))}
					</div>
				</div>
			</div>
		</li>
	);
}

type CommentsListProps = {
	feedbackId: Id<'feedback'>;
	currentProfileId?: Id<'profile'>;
};

export function CommentsList({ feedbackId, currentProfileId }: CommentsListProps) {
	const { data: comments } = useSuspenseQuery(
		convexQuery(api.feedbackComment.listByFeedback, { feedbackId })
	);

	// Filter out the initial comment (shown separately)
	const additionalComments = comments?.filter((c) => !c.initial) ?? [];

	if (additionalComments.length === 0) {
		return null;
	}

	return (
		<ul className="mt-6 flex flex-col gap-6">
			{additionalComments.map((comment) => (
				<CommentItem
					key={comment._id}
					comment={comment}
					feedbackId={feedbackId}
					currentProfileId={currentProfileId}
				/>
			))}
		</ul>
	);
}
