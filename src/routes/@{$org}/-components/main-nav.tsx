import React from 'react';
import { Link, useParams, useRouterState } from '@tanstack/react-router';
import { Bell, Command, Search } from 'lucide-react';

import { CommandPalette } from '@/components/command-palette';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { API } from '@/lib/api';

import { UserDropdown } from './user-dropdown';

const notifications = [
	{
		id: 1,
		title: 'New issue assigned',
		description: 'Bug report #123 needs attention',
		time: '2 min ago',
	},
	{
		id: 2,
		title: 'PR review requested',
		description: 'Feature/auth-system ready for review',
		time: '1 hour ago',
	},
	{
		id: 3,
		title: 'Deployment successful',
		description: 'Production deploy completed',
		time: '3 hours ago',
	},
];

type MainNavProps = {
	children?: React.ReactNode;
	org?: {
		slug: string;
		name: string;
	};
	user: API['user']['getCurrentUser'];
};

export const MainNav = ({ children, user }: MainNavProps) => {
	const [isCommandOpen, setIsCommandOpen] = React.useState(false);
	const routerState = useRouterState();

	const orgParams = useParams({
		from: '/@{$org}',
		shouldThrow: false,
	});

	const projectParams = useParams({
		from: '/@{$org}/$project',
		shouldThrow: false,
	});

	const orgSlug = orgParams?.org;
	const projectSlug = projectParams?.project;

	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault();
				setIsCommandOpen(true);
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, []);

	return (
		<>
			<nav className='border-b bg-muted'>
				<div className='container'>
					{/* Top row */}
					<div className='flex items-center justify-between py-3'>
						{/* Left: Logo and org/project */}
						<div className='flex min-w-0 flex-shrink-0 items-center gap-3'>
							<div className='flex items-center gap-2'>
								<div className='flex h-8 w-8 items-center justify-center rounded-full bg-primary'>
									<span className='text-sm font-bold text-primary-foreground'>K</span>
								</div>
								{!!orgSlug && (
									<div className='-ml-3 flex h-8 w-8 items-center justify-center rounded-full bg-foreground ring-2 ring-background'>
										<span className='text-sm font-bold text-background'>
											{String(orgSlug)[0].toUpperCase()}
										</span>
									</div>
								)}
							</div>
							<div className='hidden min-w-0 items-center gap-1 text-sm sm:flex md:text-base'>
								{!!orgSlug && (
									<Link
										to='/@{$org}'
										className='link-text !no-underline hocus:!underline'
										params={(prev) => ({ ...prev, org: orgSlug })}
									>
										{orgSlug}
									</Link>
								)}
								{!!orgSlug && !!projectSlug && (
									<>
										<span className='text-muted-foreground'>/</span>
										<Link
											to='/@{$org}/$project'
											className='link-text !no-underline hocus:!underline'
											params={(prev) => ({
												...prev,
												org: orgSlug,
												project: projectSlug,
											})}
										>
											{projectSlug}
										</Link>
									</>
								)}
							</div>
						</div>

						<div className='flex flex-shrink-0 items-center gap-3'>
							<div className='hidden md:block'>
								<Button
									variant='outline'
									className='max-w-xs justify-start border-border bg-muted/50 px-3 !py-4 text-muted-foreground hover:bg-muted'
									onClick={() => setIsCommandOpen(true)}
								>
									<Search className='mr-2 h-4 w-4 flex-shrink-0' />
									<span className='truncate'>Search or jump to...</span>
									<div className='ml-auto flex flex-shrink-0 items-center gap-1'>
										<kbd className='pointer-events-none inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground select-none'>
											<Command className='h-3 w-3' />K
										</kbd>
									</div>
								</Button>
							</div>

							<Button
								variant='outline'
								size='sm'
								className='border-border bg-muted/50 text-muted-foreground hover:bg-muted md:hidden'
								onClick={() => setIsCommandOpen(true)}
							>
								<Search className='h-4 w-4' />
								<span className='sr-only'>Search</span>
							</Button>

							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant='ghost' size='icon' className='relative'>
										<Bell className='h-4 w-4' />
										<Badge
											variant='destructive'
											className='absolute -top-1 -right-1 h-4 w-4 p-0 text-xs'
										>
											{notifications.length}
										</Badge>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align='end' className='z-20 w-80'>
									<div className='px-3 py-2 text-sm font-semibold'>Notifications</div>
									<DropdownMenuSeparator />
									{notifications.map((notification) => (
										<DropdownMenuItem
											key={notification.id}
											className='flex flex-col items-start p-3'
										>
											<div className='font-medium'>{notification.title}</div>
											<div className='text-sm text-muted-foreground'>
												{notification.description}
											</div>
											<div className='mt-1 text-xs text-muted-foreground'>{notification.time}</div>
										</DropdownMenuItem>
									))}
									<DropdownMenuSeparator />
									<DropdownMenuItem className='text-center text-sm text-muted-foreground'>
										View all notifications
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>

							{user ? (
								<UserDropdown user={user} />
							) : (
								<Link
									to='/sign-in'
									search={{
										redirect: routerState.location.pathname,
									}}
								>
									Sign In
								</Link>
							)}
						</div>
					</div>
				</div>

				{children}
			</nav>

			<CommandPalette open={isCommandOpen} onOpenChange={setIsCommandOpen} />
		</>
	);
};
