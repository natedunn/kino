import type { MouseEvent } from 'react';
import type { Id } from '../../../../../../convex/native/_generated/dataModel';

import { useState } from 'react';
import { useMutation as useConvexMutation } from 'convex/react';
import { ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { optimisticallyToggleFeedbackUpvote } from '@/lib/convex/native-feedback-optimistic';
import { localizeError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import * as m from '@/paraglide/messages.js';

import { api as nativeApi } from '../../../../../../convex/native/_generated/api';

type UpvoteButtonProps = {
	className?: string;
	feedbackId: string;
	initialCount: number;
	initialHasUpvoted: boolean;
	inline?: boolean;
	isAuthenticated: boolean;
	onUnauthenticated?: () => void;
};

export function UpvoteButton(props: UpvoteButtonProps) {
	return <NativeUpvoteButton {...props} />;
}

function NativeUpvoteButton({
	className,
	feedbackId,
	initialCount,
	initialHasUpvoted,
	inline = false,
	isAuthenticated,
	onUnauthenticated,
}: UpvoteButtonProps) {
	const toggleUpvote = useConvexMutation(nativeApi.feedback.toggleUpvote).withOptimisticUpdate(
		optimisticallyToggleFeedbackUpvote
	);
	const [pending, setPending] = useState(false);
	const count = initialCount;
	const hasUpvoted = initialHasUpvoted;
	const disabled = (!isAuthenticated && !onUnauthenticated) || pending;

	const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
		event.stopPropagation();
		if (!isAuthenticated) {
			onUnauthenticated?.();
			return;
		}
		setPending(true);
		void toggleUpvote({ feedbackId: feedbackId as Id<'feedback'> })
			.catch((error: unknown) => void toast.error(localizeError(error)))
			.finally(() => setPending(false));
	};

	return (
		<Button
			aria-label={hasUpvoted ? m.feedback_remove_upvote() : m.feedback_upvote_action()}
			className={
				inline
					? className
					: cn('h-auto flex-col gap-0 px-2 py-1.5', hasUpvoted && 'text-primary', className)
			}
			disabled={disabled}
			onClick={handleToggle}
			size={inline ? 'lg' : 'sm'}
			type='button'
			variant={hasUpvoted ? (inline ? 'default' : 'outline') : inline ? 'secondary' : 'ghost'}
		>
			<ChevronUp className={cn('size-4', hasUpvoted && 'fill-current')} />
			<span className={inline ? 'tabular-nums' : 'text-xs font-bold tabular-nums'}>{count}</span>
			{inline ? m.feedback_upvote_count({ count }) : null}
		</Button>
	);
}
