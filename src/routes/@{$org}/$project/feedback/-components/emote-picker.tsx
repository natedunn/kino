import { useConvexMutation } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';
import { SmilePlus } from 'lucide-react';

import { api } from '~api';
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

type EmotePickerProps = {
	feedbackId: Id<'feedback'>;
	commentId: Id<'feedbackComment'>;
};

export function EmotePicker({ feedbackId, commentId }: EmotePickerProps) {
	const { mutate: toggleEmote } = useMutation({
		mutationFn: useConvexMutation(api.feedbackCommentEmote.toggle),
	});

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
				<Button className="gap-2 rounded-full" variant="ghost" size="sm">
					<SmilePlus size={16} />
					<span className="sr-only">Add reaction</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="grid grid-cols-5 gap-1 p-2">
				{(Object.keys(EMOTE_EMOJI) as EmoteContent[]).map((emoteType) => (
					<DropdownMenuItem
						key={emoteType}
						onClick={() => handleSelect(emoteType)}
						className="flex cursor-pointer items-center justify-center p-2 text-lg hover:bg-accent"
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
};

export function EmoteButton({ feedbackId, commentId, emoteType, count, isActive }: EmoteButtonProps) {
	const { mutate: toggleEmote } = useMutation({
		mutationFn: useConvexMutation(api.feedbackCommentEmote.toggle),
	});

	const handleClick = () => {
		toggleEmote({
			feedbackId,
			feedbackCommentId: commentId,
			content: emoteType,
		});
	};

	return (
		<Button
			variant="outline"
			size="sm"
			onClick={handleClick}
			className={cn('gap-2 rounded-full', {
				'bg-primary/10 border-primary/50': isActive,
			})}
		>
			<span>{EMOTE_EMOJI[emoteType]}</span>
			<span>{count}</span>
		</Button>
	);
}
