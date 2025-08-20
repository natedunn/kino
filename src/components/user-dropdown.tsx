import { ChevronDown, Monitor, Moon, Sun, User } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function UserDropdown() {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant='ghost' size='sm' className='flex items-center gap-2'>
					<Avatar className='h-6 w-6'>
						<AvatarImage src='/placeholder.svg?height=24&width=24' />
						<AvatarFallback>
							<User className='h-3 w-3' />
						</AvatarFallback>
					</Avatar>
					<span className='hidden text-sm font-medium sm:inline'>username</span>
					<ChevronDown className='h-3 w-3' />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end'>
				<DropdownMenuItem>Your profile</DropdownMenuItem>
				<DropdownMenuItem>Your organizations</DropdownMenuItem>
				<DropdownMenuItem>Your projects</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<span>Theme</span>
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<DropdownMenuItem
							onClick={() => {
								document.documentElement.classList.remove('dark');
								localStorage.theme = 'light';
							}}
						>
							<Sun className='mr-2 h-4 w-4' />
							Light
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => {
								document.documentElement.classList.add('dark');
								localStorage.theme = 'dark';
							}}
						>
							<Moon className='mr-2 h-4 w-4' />
							Dark
						</DropdownMenuItem>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuItem>Settings</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem>Sign out</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
