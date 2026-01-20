import type { MarkdownEditorRef } from '@/components/editor';

import { useRef, useState } from 'react';
import { useConvexMutation } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';

import { api } from '~api';
import { MarkdownEditor, sanitizeEditorContent, useEditorRef } from '@/components/editor';
import { Button } from '@/components/ui/button';
import { Id } from '@/convex/_generated/dataModel';

type CommentFormProps = {
	feedbackId: Id<'feedback'>;
};

export function CommentForm({ feedbackId }: CommentFormProps) {
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

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
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

	const isSubmitting = status === 'pending';

	return (
		<form
			onSubmit={handleSubmit}
			className='mt-6 flex flex-col gap-3 rounded-lg border bg-accent/30'
		>
			<MarkdownEditor
				ref={editorRef}
				value={content}
				onChange={setContent}
				placeholder='Leave a comment...'
				disabled={isSubmitting}
				minHeight='60px'
				variant='borderless'
			/>
			<div className='mr-4 mb-4 flex justify-end'>
				<Button type='submit' disabled={isSubmitting || !content.trim()}>
					{isSubmitting ? 'Posting...' : 'Comment'}
				</Button>
			</div>
		</form>
	);
}
