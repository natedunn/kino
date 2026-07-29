import type { MouseEvent } from 'react';

import { useMutation } from '@tanstack/react-query';
import { ChevronUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCRPC } from '@/lib/convex/crpc';
import { cn } from '@/lib/utils';

export function UpvoteButton({
	className,
	feedbackId,
	initialCount,
	initialHasUpvoted,
	inline = false,
	isAuthenticated,
	onUnauthenticated,
}: {
	className?: string;
	feedbackId: string;
	initialCount: number;
	initialHasUpvoted: boolean;
	// `inline` renders a standard horizontal button (label + count) to sit in a row
	// alongside other actions; the default is the vertical vote pill used on cards.
	inline?: boolean;
	isAuthenticated: boolean;
	// When provided, a signed-out click stays enabled and calls this (e.g. to open
	// a sign-in prompt) instead of disabling the button. Without it, the button is
	// disabled while signed out.
	onUnauthenticated?: () => void;
}) {
	const crpc = useCRPC();
	const mutation = useMutation(crpc.feedbackUpvote.toggle.mutationOptions());
	const isThisFeedback = mutation.variables?.feedbackId === feedbackId;
	const showOptimistic = mutation.isPending && isThisFeedback;
	const optimisticHasUpvoted = !initialHasUpvoted;
	const optimisticCount = optimisticHasUpvoted ? initialCount + 1 : Math.max(0, initialCount - 1);
	// After the mutation settles there's a brief window before the live query
	// subscription pushes the new value back down through props. Prefer the
	// server-confirmed result during that window so the button doesn't flicker
	// back to the pre-toggle value. The result only "wins" while it still
	// disagrees with props; once props catch up we fall back to them, so a later
	// count change from another viewer isn't masked by a stale result.
	const showResult =
		mutation.isSuccess && isThisFeedback && mutation.data.upvoted !== initialHasUpvoted;
	const count = showOptimistic ? optimisticCount : showResult ? mutation.data.count : initialCount;
	const hasUpvoted = showOptimistic
		? optimisticHasUpvoted
		: showResult
			? mutation.data.upvoted
			: initialHasUpvoted;

	const disabled = (!isAuthenticated && !onUnauthenticated) || mutation.isPending;
	const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
		event.stopPropagation();
		if (!isAuthenticated) {
			onUnauthenticated?.();
			return;
		}
		mutation.mutate({ feedbackId });
	};

	if (inline) {
		return (
			<Button
				aria-label={hasUpvoted ? 'Remove upvote' : 'Upvote feedback'}
				className={className}
				disabled={disabled}
				onClick={handleToggle}
				size='lg'
				type='button'
				variant={hasUpvoted ? 'default' : 'secondary'}
			>
				<ChevronUp className={cn('size-4', hasUpvoted && 'fill-current')} />
				<span className='tabular-nums'>{count}</span>
				{count === 1 ? 'Upvote' : 'Upvotes'}
			</Button>
		);
	}

	return (
		<Button
			aria-label={hasUpvoted ? 'Remove upvote' : 'Upvote feedback'}
			className={cn('h-auto flex-col gap-0 px-2 py-1.5', hasUpvoted && 'text-primary', className)}
			disabled={disabled}
			onClick={handleToggle}
			size='sm'
			type='button'
			variant={hasUpvoted ? 'outline' : 'ghost'}
		>
			<ChevronUp className={cn('size-4', hasUpvoted && 'fill-current')} />
			<span className='text-xs font-bold tabular-nums'>{count}</span>
		</Button>
	);
}
