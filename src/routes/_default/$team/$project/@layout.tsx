import { createFileRoute, Link, LinkProps, Outlet } from '@tanstack/react-router';
import { ClassValue } from 'clsx';
import {
	AudioLines,
	Calendar,
	FolderClosed,
	Home,
	LucideIcon,
	MessageCircle,
	Notebook,
} from 'lucide-react';

import { NavUser } from '@/components/nav-user';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
			to: '/$team/$project/chat',
			params: {
				team: teamSlug,
				project: projectSlug,
			},
			children: 'Chat',
			icon: MessageCircle,
		},
	] as (Omit<LinkProps, 'children'> & {
		className?: ClassValue;
		children?: React.ReactNode;
		icon?: LucideIcon;
	})[];

	return (
		<div className='flex flex-1'>
			<div className='flex w-full max-w-[14rem] flex-col border-r border-border'>
				<Link
					to='/'
					className='group flex h-14 items-center border-b border-primary/50 bg-primary/10 px-5 text-primary transition-all duration-200 ease-in-out hocus:border-primary hocus:bg-primary/20'
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
					<div className='flex flex-col gap-4 px-2'>
						{featureLinks.map(({ children, className, icon: Icon, ...rest }) => (
							<Link key={rest.to as string} {...rest}>
								{({ isActive }) => (
									<span className='inline-flex items-center gap-2'>
										{Icon && <Icon className={cn('h-4 w-4', isActive && 'text-primary')} />}
										<span
											className={cn(
												'link-text inline-block',
												isActive && 'text-primary hover:!no-underline',
												className
											)}
										>
											{children}
										</span>
									</span>
								)}
							</Link>
						))}
					</div>
				</nav>
				<div className='sticky bottom-6 mt-auto mr-4 mb-6'>
					<NavUser
						user={{
							email: 'hello@natedunn.net',
							name: 'Nate',
						}}
					/>
				</div>
			</div>
			<div className='flex flex-1 flex-col items-stretch border-r border-border'>
				<Outlet />
			</div>
		</div>
	);
}
