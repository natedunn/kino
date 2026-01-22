'use client';

import { BarChart3, FileText, Search, Users } from 'lucide-react';

import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/components/ui/command';

interface CommandPaletteProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
	return (
		<CommandDialog open={open} onOpenChange={onOpenChange}>
			<CommandInput placeholder='Type a command or search...' />
			<CommandList>
				<CommandEmpty>No results found.</CommandEmpty>
				<CommandGroup heading='Suggestions'>
					<CommandItem>
						<Search className='mr-2 h-4 w-4' />
						<span>Search issues</span>
					</CommandItem>
					<CommandItem>
						<FileText className='mr-2 h-4 w-4' />
						<span>Go to files</span>
					</CommandItem>
					<CommandItem>
						<Users className='mr-2 h-4 w-4' />
						<span>Go to discussions</span>
					</CommandItem>
					<CommandItem>
						<BarChart3 className='mr-2 h-4 w-4' />
						<span>Go to overview</span>
					</CommandItem>
				</CommandGroup>
				<CommandGroup heading='Recent'>
					<CommandItem>
						<FileText className='mr-2 h-4 w-4' />
						<span>README.md</span>
					</CommandItem>
					<CommandItem>
						<FileText className='mr-2 h-4 w-4' />
						<span>package.json</span>
					</CommandItem>
				</CommandGroup>
			</CommandList>
		</CommandDialog>
	);
}
