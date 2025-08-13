import { createFileRoute, Link, LinkProps, Outlet } from '@tanstack/react-router';
import { ClassValue } from 'clsx';
import {
	AudioLines,
	Calendar,
	ChevronRight,
	FolderClosed,
	Home,
	LucideIcon,
	MessageSquareText,
	MessagesSquare,
	Notebook,
} from 'lucide-react';

import { NavUser } from '@/components/nav-user';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import ThemeToggle from '../../-components/theme-toggle';

export const Route = createFileRoute('/_default/$team/$project')({
	component: RouteComponent,
});

function RouteComponent() {
	const { team: teamSlug, project: projectSlug } = Route.useParams();

	const featureLinks = [
		{
			to: '/$team/$project/overview',
			params: {
				team: teamSlug,
				project: projectSlug,
			},
			children: 'Overview',
			icon: Home,
		},
		{
			to: '/$team/$project/feedback',
			params: {
				team: teamSlug,
				project: projectSlug,
			},
			children: 'Feedback',
			icon: AudioLines,
		},
		{
			to: '/$team/$project/updates',
			params: {
				team: teamSlug,
				project: projectSlug,
			},
			children: 'Updates',
			icon: Notebook,
		},
		{
			to: '/$team/$project/roadmap',
			params: {
				team: teamSlug,
				project: projectSlug,
			},
			children: 'Roadmap',
			icon: Calendar,
		},
		{
			to: '/$team/$project/files',
			param: {
				team: teamSlug,
				project: projectSlug,
			},
			children: 'Files',
			icon: FolderClosed,
		},
		{
			to: '/$team/$project/discussions',
			params: {
				team: teamSlug,
				project: projectSlug,
			},
			children: 'Discussions',
			icon: MessageSquareText,
		},
		{
			to: '/$team/$project/chat',
			params: {
				team: teamSlug,
				project: projectSlug,
			},
			children: 'Chat',
			icon: MessagesSquare,
		},
	] as (Omit<LinkProps, 'children'> & {
		className?: ClassValue;
		children?: React.ReactNode;
		icon?: LucideIcon;
	})[];

	return (
		<div className='grid w-full grid-cols-1 md:grid-cols-[1fr_250px_minmax(0,1000px)_1fr]'>
			<aside className='border-r border-gray-200 bg-muted/50 md:col-span-2 md:grid md:grid-cols-subgrid dark:border-gray-800'>
				<div className='flex flex-col md:col-start-2'>
					<Link
						to='/'
						className='group back mt-4 mr-4 inline-flex h-14 items-center rounded-xl border border-primary/20 bg-gradient-to-b from-primary/20 to-primary/10 px-5 text-primary shadow-[0px_10px_16px_-3px_rgba(0,_0,_0,_0.05)] backdrop-blur-md transition-all duration-200 ease-in-out hocus:border-primary hocus:bg-primary/10'
					>
						<span className='font-bold tracking-widest text-primary uppercase transition-all'>
							Kino
						</span>
					</Link>
					<nav className='sticky top-4 mt-6 flex flex-col gap-4'>
						<Button variant='outline' className='group mr-4 justify-start'>
							<Avatar className='h-6 w-6 rounded-full'>
								<AvatarImage alt='Test user' />
								<AvatarFallback className='rounded-full'>A</AvatarFallback>
							</Avatar>
							<div className='text-sm text-muted-foreground group-hocus:text-foreground'>
								{teamSlug}/{projectSlug}
							</div>
						</Button>
						<div className='mt-4 flex flex-col px-2'>
							{featureLinks.map(({ children, className, icon: Icon, ...rest }) => (
								<Link key={rest.to as string} className='group' {...rest}>
									{({ isActive }) => (
										<span
											className={cn(
												'inline-flex w-full items-center justify-between gap-2 py-2',
												className
											)}
										>
											<span className='flex items-center gap-3'>
												{Icon && (
													<Icon
														className={cn(
															'size-5',
															isActive
																? 'text-primary'
																: 'text-muted-foreground group-hocus:text-foreground'
														)}
													/>
												)}
												<span
													className={cn(
														'inline-block text-foreground/75 transition-colors duration-200 ease-in-out group-hocus:text-foreground',
														isActive &&
															'text-primary group-hocus:!text-primary group-hocus:!no-underline dark:text-blue-200 dark:group-hocus:!text-blue-200',
														className
													)}
												>
													{children}
												</span>
											</span>
											<span>
												<ChevronRight
													className={cn(
														'size-5',
														isActive
															? 'text-primary'
															: 'opacity-0 transition-opacity duration-200 ease-in-out group-hocus:opacity-100'
													)}
												/>
											</span>
										</span>
									)}
								</Link>
							))}
						</div>
					</nav>
					<div className='sticky bottom-6 mt-auto mr-4 mb-6'>
						<ThemeToggle />
						<NavUser
							user={{
								email: 'hello@natedunn.net',
								name: 'Nate',
							}}
						/>
					</div>
				</div>
			</aside>
			<div className='flex flex-1 flex-col items-stretch'>
				<Outlet />
			</div>
		</div>
	);
}
