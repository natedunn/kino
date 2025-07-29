import { createFileRoute } from '@tanstack/react-router';
import {
	Bell,
	FolderOpen,
	GitBranch,
	Mail,
	MessageSquare,
	Star,
	Trophy,
	Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

import { AppSidebar } from './-components/sidebar';

export const Route = createFileRoute('/dashboard/')({
	component: RouteComponent,
});

const activityData = [
	{
		id: 1,
		type: 'blog_post',
		title: 'New Architecture Guide Published',
		project: 'React Native',
		author: 'Dan Abramov',
		time: '2 hours ago',
		description: 'A comprehensive guide to the new React Native architecture and its benefits.',
		icon: <MessageSquare className='h-4 w-4' />,
		color: 'bg-blue-500',
	},
	{
		id: 2,
		type: 'release',
		title: 'v2.1.0 Released',
		project: 'Next.js',
		author: 'Vercel Team',
		time: '4 hours ago',
		description: 'Major performance improvements and new App Router features.',
		icon: <GitBranch className='h-4 w-4' />,
		color: 'bg-green-500',
	},
	{
		id: 3,
		type: 'forum_reply',
		title: 'Reply to: Best practices for state management',
		project: 'Vue.js',
		author: 'Evan You',
		time: '6 hours ago',
		description: "Great question! Here's how I approach state management in large applications...",
		icon: <Users className='h-4 w-4' />,
		color: 'bg-purple-500',
	},
	{
		id: 4,
		type: 'dm',
		title: 'Direct Message',
		project: 'Personal',
		author: 'Sarah Chen',
		time: '1 day ago',
		description: 'Thanks for your contribution to the TypeScript definitions!',
		icon: <Mail className='h-4 w-4' />,
		color: 'bg-orange-500',
	},
	{
		id: 5,
		type: 'blog_post',
		title: 'Performance Optimization Tips',
		project: 'Svelte',
		author: 'Rich Harris',
		time: '2 days ago',
		description: 'Learn how to optimize your Svelte applications for better performance.',
		icon: <MessageSquare className='h-4 w-4' />,
		color: 'bg-blue-500',
	},
];

const awards = [
	{
		id: 1,
		title: 'Top Contributor',
		project: 'React',
		description: 'Recognized for outstanding contributions to React core',
		icon: <Trophy className='h-6 w-6 text-yellow-500' />,
		date: 'March 2024',
		level: 'Gold',
	},
	{
		id: 2,
		title: 'Community Helper',
		project: 'TypeScript',
		description: 'Helped 100+ developers in the community forum',
		icon: <Users className='h-6 w-6 text-blue-500' />,
		date: 'February 2024',
		level: 'Silver',
	},
	{
		id: 3,
		title: 'Bug Hunter',
		project: 'Next.js',
		description: 'Identified and reported 10+ critical bugs',
		icon: <Star className='h-6 w-6 text-purple-500' />,
		date: 'January 2024',
		level: 'Bronze',
	},
	{
		id: 4,
		title: 'Documentation Master',
		project: 'Vue.js',
		description: 'Improved documentation clarity and completeness',
		icon: <MessageSquare className='h-6 w-6 text-green-500' />,
		date: 'December 2023',
		level: 'Gold',
	},
];

function RouteComponent() {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset className='overflow-hidden border border-border bg-black/30'>
				<header className='flex h-16 shrink-0 items-center border-b pr-4'>
					<SidebarTrigger className='flex h-full w-16 items-center justify-center hover:bg-muted' />
					<Separator orientation='vertical' className='mr-2 h-4' />
					<div className='flex items-center gap-2 px-4'>
						<h1 className='text-lg font-semibold'>Dashboard Overview</h1>
					</div>
					<div className='ml-auto flex items-center gap-2'>
						<Button variant='ghost' size='icon'>
							<Bell className='h-4 w-4' />
						</Button>
					</div>
				</header>

				<div className='flex flex-1 flex-col gap-4 p-8'>
					<div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
						<Card>
							<CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
								<CardTitle className='text-sm font-medium'>Following</CardTitle>
								<FolderOpen className='h-4 w-4 text-muted-foreground' />
							</CardHeader>
							<CardContent>
								<div className='text-2xl font-bold'>12</div>
								<p className='text-xs text-muted-foreground'>Active projects</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
								<CardTitle className='text-sm font-medium'>Unread Updates</CardTitle>
								<Bell className='h-4 w-4 text-muted-foreground' />
							</CardHeader>
							<CardContent>
								<div className='text-2xl font-bold'>23</div>
								<p className='text-xs text-muted-foreground'>New notifications</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
								<CardTitle className='text-sm font-medium'>Awards Earned</CardTitle>
								<Trophy className='h-4 w-4 text-muted-foreground' />
							</CardHeader>
							<CardContent>
								<div className='text-2xl font-bold'>4</div>
								<p className='text-xs text-muted-foreground'>This year</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
								<CardTitle className='text-sm font-medium'>Contributions</CardTitle>
								<GitBranch className='h-4 w-4 text-muted-foreground' />
							</CardHeader>
							<CardContent>
								<div className='text-2xl font-bold'>156</div>
								<p className='text-xs text-muted-foreground'>Total contributions</p>
							</CardContent>
						</Card>
					</div>

					<div className='grid gap-4 md:grid-cols-2'>
						<Card className='col-span-1'>
							<CardHeader>
								<CardTitle>Recent Activity</CardTitle>
								<CardDescription>Updates from projects you follow</CardDescription>
							</CardHeader>
							<CardContent className='space-y-4'>
								{activityData.map((activity) => (
									<div key={activity.id} className='flex items-start space-x-3'>
										<div
											className={`flex h-8 w-8 items-center justify-center rounded-full ${activity.color} text-white`}
										>
											{activity.icon}
										</div>
										<div className='flex-1 space-y-1'>
											<div className='flex items-center justify-between'>
												<p className='text-sm font-medium'>{activity.title}</p>
												<span className='text-xs text-muted-foreground'>{activity.time}</span>
											</div>
											<div className='flex items-center gap-2'>
												<Badge variant='secondary' className='text-xs'>
													{activity.project}
												</Badge>
												<span className='text-xs text-muted-foreground'>by {activity.author}</span>
											</div>
											<p className='line-clamp-2 text-xs text-muted-foreground'>
												{activity.description}
											</p>
										</div>
									</div>
								))}
								<Button variant='outline' className='w-full bg-transparent'>
									View All Activity
								</Button>
							</CardContent>
						</Card>

						<Card className='col-span-1'>
							<CardHeader>
								<CardTitle>Your Awards</CardTitle>
								<CardDescription>Recognition for your contributions</CardDescription>
							</CardHeader>
							<CardContent className='space-y-4'>
								{awards.map((award) => (
									<div key={award.id} className='flex items-start space-x-3'>
										<div className='flex h-10 w-10 items-center justify-center rounded-full bg-muted'>
											{award.icon}
										</div>
										<div className='flex-1 space-y-1'>
											<div className='flex items-center justify-between'>
												<p className='text-sm font-medium'>{award.title}</p>
												<Badge
													variant={
														award.level === 'Gold'
															? 'default'
															: award.level === 'Silver'
																? 'secondary'
																: 'outline'
													}
													className='text-xs'
												>
													{award.level}
												</Badge>
											</div>
											<div className='flex items-center gap-2'>
												<Badge variant='outline' className='text-xs'>
													{award.project}
												</Badge>
												<span className='text-xs text-muted-foreground'>{award.date}</span>
											</div>
											<p className='text-xs text-muted-foreground'>{award.description}</p>
										</div>
									</div>
								))}
								<Button variant='outline' className='w-full bg-transparent'>
									View All Awards
								</Button>
							</CardContent>
						</Card>
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
