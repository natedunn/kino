import type { MarkdownEditorRef } from '@/components/editor';

import { useRef, useState } from 'react';
import { useConvexMutation } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';
import { Link, useLocation } from '@tanstack/react-router';
import { MessageCircle } from 'lucide-react';

import { api } from '~api';
import { MarkdownEditor, sanitizeEditorContent, useEditorRef } from '@/components/editor';
import { Button } from '@/components/ui/button';
import { Id } from '@/convex/_generated/dataModel';

type CommentFormProps = {
	feedbackId: Id<'feedback'>;
	isAuthenticated?: boolean;
};

function SignInPrompt() {
	const location = useLocation();

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
						<Link to='/sign-in' search={{ redirect: location.href }}>
							Sign in to comment
						</Link>
					</Button>
					<Button asChild variant='outline'>
						<Link to='/' search={{ redirect: location.href }}>
							Create an account
						</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}

export function CommentForm({ feedbackId, isAuthenticated = false }: CommentFormProps) {
	if (!isAuthenticated) {
		return <SignInPrompt />;
	}
	const [content, setContent] = useState('');
	const localRef = useRef<MarkdownEditorRef>(null);

	// Try to get shared ref from context, fall back to local ref
	let editorRef: React.RefObject<MarkdownEditorRef | null>;
	try {
		editorRef = useEditorRef();
	} catch {
		editorRef = localRef;
	}

	const { mutate: createComment, status } = useMutation({
		mutationFn: useConvexMutation(api.feedbackComment.create),
		onSuccess: () => {
			setContent('');
			editorRef.current?.clear();
		},
	});

	const submitComment = () => {
		const html = editorRef.current?.getHTML() ?? content;
		const text = editorRef.current?.getText() ?? '';

		if (!text.trim()) return;

		// Sanitize content to prevent excessive line breaks
		const sanitizedContent = sanitizeEditorContent(html);
		if (!sanitizedContent) return;

		createComment({
			feedbackId,
			content: sanitizedContent,
		});
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		submitComment();
	};

	const isSubmitting = status === 'pending';

	return (
		<form
			onSubmit={handleSubmit}
			className='relative mt-6 rounded-lg border bg-accent/30 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50'
		>
			<MarkdownEditor
				ref={editorRef}
				value={content}
				onChange={setContent}
				placeholder='Leave a comment...'
				disabled={isSubmitting}
				minHeight='120px'
				maxHeight='400px'
				variant='borderless'
				contentClassName='[&_.ProseMirror]:pb-16'
				onSubmitShortcut={submitComment}
			/>
			<div className='pointer-events-none absolute right-4 bottom-4'>
				<Button
					type='submit'
					disabled={isSubmitting || !content.trim()}
					className='pointer-events-auto'
				>
					{isSubmitting ? 'Posting...' : 'Comment'}
				</Button>
			</div>
		</form>
	);
}
