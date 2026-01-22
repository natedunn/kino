import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SmilePlus } from 'lucide-react';

import { api, API } from '~api';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Id } from '@/convex/_generated/dataModel';
import { cn } from '@/lib/utils';

// Emote types matching the schema
export type EmoteContent =
	| 'thumbsUp'
	| 'thumbsDown'
	| 'laugh'
	| 'questionMark'
	| 'sad'
	| 'tada'
	| 'eyes'
	| 'heart'
	| 'skull'
	| 'explodingHead';

// Map emote types to emoji characters
export const EMOTE_EMOJI: Record<EmoteContent, string> = {
	thumbsUp: '👍',
	thumbsDown: '👎',
	laugh: '😄',
	questionMark: '❓',
	sad: '🙁',
	tada: '🎉',
	eyes: '👀',
	heart: '❤️',
	skull: '💀',
	explodingHead: '🤯',
};

type Comment = NonNullable<API['feedbackComment']['listByFeedback']>[number];

// Helper to optimistically update emote counts in the query cache
function useOptimisticEmoteToggle(feedbackId: Id<'feedback'>, currentProfileId?: string) {
	const queryClient = useQueryClient();
	const mutationFn = useConvexMutation(api.feedbackCommentEmote.toggle);

	return useMutation({
		mutationFn,
		onMutate: async (variables) => {
			const queryKey = convexQuery(api.feedbackComment.listByFeedback, { feedbackId }).queryKey;

			// Cancel outgoing refetches
			await queryClient.cancelQueries({ queryKey });

			// Snapshot previous value
			const previousComments = queryClient.getQueryData<Comment[]>(queryKey);

			// Optimistically update the cache
			if (previousComments && currentProfileId) {
				const updatedComments = previousComments.map((comment) => {
					if (comment._id !== variables.feedbackCommentId) return comment;

					const emoteCounts = { ...comment.emoteCounts };
					const emoteData = emoteCounts[variables.content];

					if (emoteData && emoteData.authorProfileIds.includes(currentProfileId)) {
						// User is removing their emote
						const newCount = emoteData.count - 1;
						if (newCount <= 0) {
							// Remove the emote entirely
							delete emoteCounts[variables.content];
						} else {
							emoteCounts[variables.content] = {
								count: newCount,
								authorProfileIds: emoteData.authorProfileIds.filter(
									(id) => id !== currentProfileId
								),
							};
						}
					} else {
						// User is adding an emote
						if (emoteData) {
							emoteCounts[variables.content] = {
								count: emoteData.count + 1,
								authorProfileIds: [...emoteData.authorProfileIds, currentProfileId],
							};
						} else {
							emoteCounts[variables.content] = {
								count: 1,
								authorProfileIds: [currentProfileId],
							};
						}
					}

					return { ...comment, emoteCounts };
				});

				queryClient.setQueryData(queryKey, updatedComments);
			}

			return { previousComments, queryKey };
		},
		onError: (_err, _variables, context) => {
			// Rollback on error
			if (context?.previousComments) {
				queryClient.setQueryData(context.queryKey, context.previousComments);
			}
		},
	});
}

type EmotePickerProps = {
	feedbackId: Id<'feedback'>;
	commentId: Id<'feedbackComment'>;
	currentProfileId?: string;
};

export function EmotePicker({ feedbackId, commentId, currentProfileId }: EmotePickerProps) {
	const { mutate: toggleEmote } = useOptimisticEmoteToggle(feedbackId, currentProfileId);

	const handleSelect = (content: EmoteContent) => {
		toggleEmote({
			feedbackId,
			feedbackCommentId: commentId,
			content,
		});
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button className='gap-2 rounded-full' variant='outline' size='sm'>
					<SmilePlus size={16} />
					<span className='sr-only'>Add reaction</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='start' className='grid grid-cols-5 gap-1 p-2'>
				{(Object.keys(EMOTE_EMOJI) as EmoteContent[]).map((emoteType) => (
					<DropdownMenuItem
						key={emoteType}
						onClick={() => handleSelect(emoteType)}
						className='flex cursor-pointer items-center justify-center p-2 text-lg hover:bg-accent'
					>
						{EMOTE_EMOJI[emoteType]}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

type EmoteButtonProps = {
	feedbackId: Id<'feedback'>;
	commentId: Id<'feedbackComment'>;
	emoteType: EmoteContent;
	count: number;
	isActive: boolean;
	currentProfileId?: string;
};

export function EmoteButton({
	feedbackId,
	commentId,
	emoteType,
	count,
	isActive,
	currentProfileId,
}: EmoteButtonProps) {
	const { mutate: toggleEmote } = useOptimisticEmoteToggle(feedbackId, currentProfileId);

	const handleClick = () => {
		toggleEmote({
			feedbackId,
			feedbackCommentId: commentId,
			content: emoteType,
		});
	};

	return (
		<Button
			variant='outline'
			size='sm'
			onClick={handleClick}
			className={cn('gap-2 rounded-full', {
				'border-primary/50 bg-primary/10': isActive,
			})}
		>
			<span>{EMOTE_EMOJI[emoteType]}</span>
			<span>{count}</span>
		</Button>
	);
}
