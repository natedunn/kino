import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { EMOTE_EMOJI, EmoteContent } from './types';

type EmoteButtonProps = {
	emoteType: EmoteContent;
	count: number;
	isActive: boolean;
	onClick: () => void;
	disabled?: boolean;
};

export function EmoteButton({ emoteType, count, isActive, onClick, disabled }: EmoteButtonProps) {
	return (
		<Button
			variant='outline'
			size='sm'
			onClick={onClick}
			disabled={disabled}
			className={cn('gap-2 rounded-full', {
				'border-primary/50 bg-primary/10': isActive,
			})}
		>
			<span>{EMOTE_EMOJI[emoteType]}</span>
			<span>{count}</span>
		</Button>
	);
}
