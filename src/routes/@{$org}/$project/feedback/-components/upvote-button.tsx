import { useEffect, useRef, useState } from 'react';
import { useConvexMutation } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';
import { useLocation, useRouter } from '@tanstack/react-router';

import { api } from '~api';
import { Button } from '@/components/ui/button';
import { Id } from '@/convex/_generated/dataModel';
import ChevronUp from '@/icons/chevron-up';
import { cn } from '@/lib/utils';

type UpvoteButtonProps = {
	feedbackId: Id<'feedback'>;
	initialCount: number;
	initialHasUpvoted: boolean;
	isAuthenticated: boolean;
	variant?: 'default' | 'compact';
};

export function UpvoteButton({
	feedbackId,
	initialCount,
	initialHasUpvoted,
	isAuthenticated,
	variant = 'default',
}: UpvoteButtonProps) {
	const router = useRouter();
	const location = useLocation();

	// Track if we have a pending optimistic update
	const isPendingRef = useRef(false);

	// Local optimistic state
	const [optimisticCount, setOptimisticCount] = useState(initialCount);
	const [optimisticHasUpvoted, setOptimisticHasUpvoted] = useState(initialHasUpvoted);

	// Sync with props when they change, but only if we don't have a pending mutation
	useEffect(() => {
		if (!isPendingRef.current) {
			setOptimisticCount(initialCount);
			setOptimisticHasUpvoted(initialHasUpvoted);
		}
	}, [initialCount, initialHasUpvoted]);

	const toggleMutation = useConvexMutation(api.feedbackUpvote.toggle);

	const { mutate: toggleUpvote, isPending } = useMutation({
		mutationFn: (args: { feedbackId: Id<'feedback'> }) => toggleMutation(args),
		onMutate: async () => {
			// Mark that we have a pending mutation
			isPendingRef.current = true;

			// Optimistically update the UI immediately
			const previousCount = optimisticCount;
			const previousHasUpvoted = optimisticHasUpvoted;

			setOptimisticHasUpvoted(!optimisticHasUpvoted);
			setOptimisticCount(optimisticHasUpvoted ? optimisticCount - 1 : optimisticCount + 1);

			return { previousCount, previousHasUpvoted };
		},
		onError: (_error, _variables, context) => {
			// Revert to previous state on error
			if (context) {
				setOptimisticCount(context.previousCount);
				setOptimisticHasUpvoted(context.previousHasUpvoted);
			}
		},
		onSettled: () => {
			// Clear the pending flag after mutation completes (success or error)
			isPendingRef.current = false;
		},
	});

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();

		if (!isAuthenticated) {
			// Redirect to sign-in with redirect param
			router.navigate({
				to: '/sign-in',
				search: { redirect: location.href },
			});
			return;
		}

		toggleUpvote({ feedbackId });
	};

	if (variant === 'compact') {
		return (
			<Button
				variant={optimisticHasUpvoted ? 'default' : 'outline'}
				size='sm'
				onClick={handleClick}
				disabled={isPending}
				className={cn('h-auto gap-1 px-2 py-1 text-xs select-none transition-colors')}
			>
				<ChevronUp size='14' />
				{optimisticCount}
			</Button>
		);
	}

	return (
		<Button
			variant={optimisticHasUpvoted ? 'default' : 'outline'}
			size='sm'
			onClick={handleClick}
			disabled={isPending}
			className={cn(
				'h-auto w-12 flex-col py-2 font-bold select-none transition-colors',
				optimisticCount > 9999 ? 'text-xs' : optimisticCount > 999 ? 'text-sm' : 'text-base',
				!optimisticHasUpvoted &&
					'bg-background hocus:bg-primary! hocus:text-background! dark:hocus:text-foreground!'
			)}
		>
			<ChevronUp size='20' />
			{optimisticCount}
		</Button>
	);
}
