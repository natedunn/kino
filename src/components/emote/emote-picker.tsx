import { SmilePlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { EMOTE_EMOJI, EmoteContent } from './types';

type EmotePickerProps = {
	onSelect: (emoteType: EmoteContent) => void;
	disabled?: boolean;
};

export function EmotePicker({ onSelect, disabled }: EmotePickerProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button className='gap-2 rounded-full' variant='outline' size='sm' disabled={disabled}>
					<SmilePlus size={16} />
					<span className='sr-only'>Add reaction</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='start' className='grid grid-cols-5 gap-1 p-2'>
				{(Object.keys(EMOTE_EMOJI) as EmoteContent[]).map((emoteType) => (
					<DropdownMenuItem
						key={emoteType}
						onClick={() => onSelect(emoteType)}
						className='flex cursor-pointer items-center justify-center p-2 text-lg hover:bg-accent'
					>
						{EMOTE_EMOJI[emoteType]}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
