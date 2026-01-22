import type { MarkdownEditorRef } from '@/components/editor';

import { useRef, useState } from 'react';
import { useConvexMutation } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { api } from '~api';
import { MarkdownEditor, sanitizeEditorContent } from '@/components/editor';
import { Button } from '@/components/ui/button';
import { Id } from '@/convex/_generated/dataModel';

type UpdateCommentFormProps = {
	updateId: Id<'update'>;
	orgSlug: string;
	projectSlug: string;
	updateSlug: string;
	isAuthenticated: boolean;
};

export function UpdateCommentForm({
	updateId,
	orgSlug,
	projectSlug,
	updateSlug,
	isAuthenticated,
}: UpdateCommentFormProps) {
	const [content, setContent] = useState('');
	const editorRef = useRef<MarkdownEditorRef>(null);

	const { mutate: createComment, status } = useMutation({
		mutationFn: useConvexMutation(api.updateComment.create),
		onSuccess: () => {
			setContent('');
			editorRef.current?.clear();
		},
	});

	const handleSubmit = () => {
		const html = editorRef.current?.getHTML() ?? content;
		const text = editorRef.current?.getText() ?? '';

		if (!text.trim()) return;

		const sanitizedContent = sanitizeEditorContent(html);
		if (!sanitizedContent) return;

		createComment({
			updateId,
			content: sanitizedContent,
		});
	};

	const isSubmitting = status === 'pending';

	if (!isAuthenticated) {
		return (
			<div className='mt-6 rounded-lg border bg-muted/50 p-6 text-center'>
				<p className='text-muted-foreground'>
					<Link
						to='/sign-in'
						search={{
							redirect: `/@${orgSlug}/${projectSlug}/updates/${updateSlug}`,
						}}
						className='font-medium text-primary underline-offset-4 hover:underline'
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
			<div className='ml-6'>
				<div className='inline-block rounded-t-md bg-primary px-2 py-0.5 text-sm text-primary-foreground'>
					Add a comment
				</div>
			</div>
			<MarkdownEditor
				ref={editorRef}
				value={content}
				onChange={setContent}
				placeholder='Write a comment...'
				disabled={isSubmitting}
				minHeight='80px'
				maxHeight='400px'
				className='rounded-b-none'
				onSubmitShortcut={handleSubmit}
			/>
			<div className='flex justify-end gap-2 rounded-b-md border-x border-b bg-muted p-3'>
				<Button type='button' onClick={handleSubmit} disabled={isSubmitting || !content.trim()}>
					{isSubmitting ? 'Posting...' : 'Post Comment'}
				</Button>
			</div>
		</div>
	);
}
