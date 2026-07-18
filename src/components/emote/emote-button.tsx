import { EMOTE_EMOJI } from './types';
import type { EmoteContent } from './types';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';


type EmoteButtonProps = {
	count: number;
	disabled?: boolean;
	emoteType: EmoteContent;
	isActive: boolean;
	onClick: () => void;
};

export function EmoteButton({ count, disabled, emoteType, isActive, onClick }: EmoteButtonProps) {
	return (
		<Button
			className={cn('gap-2 rounded-full', {
				'border-primary/50 bg-primary/10': isActive,
			})}
			disabled={disabled}
			onClick={onClick}
			size='sm'
			variant='outline'
		>
			<span>{EMOTE_EMOJI[emoteType]}</span>
			<span>{count}</span>
		</Button>
	);
}
