import type { EmoteContent } from './types';

import { SmilePlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { EMOTE_EMOJI } from './types';

type EmotePickerProps = {
	disabled?: boolean;
	onSelect: (emoteType: EmoteContent) => void;
	// When set, the trigger opens a sign-in prompt instead of the picker (used for
	// signed-out visitors) rather than rendering as a disabled button.
	onUnauthenticated?: () => void;
};

export function EmotePicker({ disabled, onSelect, onUnauthenticated }: EmotePickerProps) {
	if (onUnauthenticated) {
		return (
			<Button
				className='gap-2 rounded-full'
				onClick={onUnauthenticated}
				size='sm'
				variant='outline'
			>
				<SmilePlus size={16} />
				<span className='sr-only'>Add reaction</span>
			</Button>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button className='gap-2 rounded-full' disabled={disabled} size='sm' variant='outline'>
					<SmilePlus size={16} />
					<span className='sr-only'>Add reaction</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='start' className='grid grid-cols-5 gap-1 p-2'>
				{(Object.keys(EMOTE_EMOJI) as Array<EmoteContent>).map((emoteType) => (
					<DropdownMenuItem
						className='flex cursor-pointer items-center justify-center p-2 text-lg hover:bg-accent'
						key={emoteType}
						onClick={() => onSelect(emoteType)}
					>
						{EMOTE_EMOJI[emoteType]}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
