import { Calendar, FolderOpen, Home, Mail, Settings } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar';

const navigationItems = [
	{ title: 'Overview', icon: Home, url: '#', isActive: true },
	{ title: 'Projects', icon: FolderOpen, url: '#' },
	{ title: 'Messages', icon: Mail, url: '#' },
	{ title: 'Calendar', icon: Calendar, url: '#' },
	{ title: 'Settings', icon: Settings, url: '#' },
];

export function AppSidebar() {
	return (
		<Sidebar variant='inset'>
			<SidebarHeader>
				<div className='flex items-center gap-2 px-2 py-2'>
					<div className='flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground'>
						<Home className='h-4 w-4' />
					</div>
					<div className='flex flex-col'>
						<span className='text-sm font-semibold'>DevHub</span>
						<span className='text-xs text-muted-foreground'>Dashboard</span>
					</div>
				</div>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Navigation</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{navigationItems.map((item) => (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton asChild isActive={item.isActive}>
										<a href={item.url}>
											<item.icon />
											<span>{item.title}</span>
										</a>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton>
							<Avatar className='h-6 w-6'>
								<AvatarImage src='/placeholder.svg?height=24&width=24' />
								<AvatarFallback>JD</AvatarFallback>
							</Avatar>
							<span>John Doe</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
