'use client';

import { useState } from 'react';
import { Link, useRouter } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { LogOut, Settings, User } from 'lucide-react';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from 'src/components/ui/dropdown-menu';
import { api, API } from 'src/lib/api';

import { authClient } from '@/lib/auth/auth-client';

interface UserDropdownProps {
	user: API['user']['getUserIndexes'];
	onSignOut?: () => void;
}

export function ProfileDropdown({ user, onSignOut }: UserDropdownProps) {
	const router = useRouter();
	const [open, setOpen] = useState(false);

	const userImage = useQuery(api.user.getUserImage, {
		_id: user._id,
	});

	const handleSignOut = () => {
		if (onSignOut) {
			onSignOut();
		}
		authClient.signOut();
		router.navigate({ to: '/', replace: true });
		setOpen(false);
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<button className='flex items-center gap-2 rounded-lg px-2 py-1 transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring'>
					<div className='relative h-6 w-6 overflow-hidden rounded-full'>
						<img
							src={userImage || '/placeholder.svg'}
							alt={`${user.username}'s avatar`}
							className='object-cover'
						/>
					</div>
					<span className='text-sm font-medium'>{user.username}</span>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end' className='w-40'>
				<DropdownMenuItem asChild>
					<Link
						to={`/profile/$username`}
						params={(prev) => ({ ...prev, username: user.username })}
						className='flex w-full cursor-pointer items-center gap-2'
					>
						<User className='h-4 w-4' />
						<span>Profile</span>
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link to='/settings' className='flex w-full cursor-pointer items-center gap-2'>
						<Settings className='h-4 w-4' />
						<span>Settings</span>
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link to='/dashboard' className='flex w-full cursor-pointer items-center gap-2'>
						<Settings className='h-4 w-4' />
						<span>Dashboard</span>
					</Link>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onClick={handleSignOut}
					className='flex cursor-pointer items-center gap-2 text-destructive focus:text-destructive'
				>
					<LogOut className='h-4 w-4' />
					<span>Sign out</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
