import { useNavigate } from '@tanstack/react-router';
import { ChevronDown, Moon, Sun, User } from 'lucide-react';

import { API } from '~api';
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
import { authClient } from '@/lib/auth/auth-client';

export function UserDropdown({
	user,
}: {
	user: NonNullable<API['profile']['getCurrentProfileUser']>;
}) {
	const navigate = useNavigate();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant='ghost' className='flex items-center gap-2'>
					<Avatar className='size-6 border'>
						<AvatarImage src={user.imageUrl} />
						<AvatarFallback>
							<User className='size-4' />
						</AvatarFallback>
					</Avatar>
					<span className='hidden text-sm font-medium sm:inline'>{user.username}</span>
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
				<DropdownMenuItem
					onClick={() => {
						navigate({
							to: '/profile/settings',
						});
					}}
				>
					Settings
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onClick={() => {
						authClient.signOut();
						navigate({
							to: '/sign-in',
						});
					}}
				>
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
