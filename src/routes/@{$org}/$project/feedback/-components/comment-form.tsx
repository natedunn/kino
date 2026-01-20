import { useState } from 'react';
import { useConvexMutation } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';

import { api } from '~api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Id } from '@/convex/_generated/dataModel';

type CommentFormProps = {
	feedbackId: Id<'feedback'>;
};

export function CommentForm({ feedbackId }: CommentFormProps) {
	const [content, setContent] = useState('');

	const { mutate: createComment, status } = useMutation({
		mutationFn: useConvexMutation(api.feedbackComment.create),
		onSuccess: () => {
			setContent('');
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!content.trim()) return;

		createComment({
			feedbackId,
			content: content.trim(),
		});
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
			e.preventDefault();
			if (!content.trim() || isSubmitting) return;
			createComment({
				feedbackId,
				content: content.trim(),
			});
		}
	};

	const isSubmitting = status === 'pending';

	return (
		<form onSubmit={handleSubmit} className="mt-6 flex gap-3 rounded-lg border bg-accent/30 p-4">
			<Textarea
				value={content}
				onChange={(e) => setContent(e.target.value)}
				onKeyDown={handleKeyDown}
				rows={1}
				placeholder="Leave a comment..."
				disabled={isSubmitting}
				className="min-h-[40px] resize-none"
			/>
			<div>
				<Button type="submit" disabled={isSubmitting || !content.trim()}>
					{isSubmitting ? 'Posting...' : 'Comment'}
				</Button>
			</div>
		</form>
	);
}
