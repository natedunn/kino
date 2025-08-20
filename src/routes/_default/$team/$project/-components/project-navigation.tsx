'use client';

import { useEffect, useRef, useState } from 'react';
import { Link, LinkProps } from '@tanstack/react-router';
import { ClassValue } from 'clsx';
import {
	BarChart3,
	Bell,
	BookOpen,
	Briefcase,
	Calendar,
	Command,
	FileSpreadsheet,
	FileText,
	LucideIcon,
	Map,
	MessageCircle,
	MessageSquare,
	MoreHorizontal,
	Rss,
	Search,
	Users,
} from 'lucide-react';

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
import { UserDropdown } from '@/components/user-dropdown';

export function ProjectNav({ team, project }: { team: string; project: string }) {
	const [isCommandOpen, setIsCommandOpen] = useState(false);
	const [visibleFeatures, setVisibleFeatures] = useState<number>(11);
	const featuresContainerRef = useRef<HTMLDivElement>(null);
	const featureButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

	const params = {
		team,
		project,
	};

	const features = [
		{
			children: 'Overview',
			icon: BarChart3,
			to: '/$team/$project/',
			params: (prev) => ({ ...prev, ...params }),
		},
		{
			children: 'Feedback',
			icon: MessageSquare,
			to: '/$team/$project/feedback',
			params: (prev) => ({ ...prev, ...params }),
		},
		{
			children: 'Updates',
			icon: Calendar,
			to: '/$team/$project/updates',
			params: (prev) => ({ ...prev, ...params }),
		},
		{
			children: 'Roadmap',
			icon: Map,
			to: '/$team/$project/roadmap',
			params: (prev) => ({ ...prev, ...params }),
		},
		{
			children: 'Files',
			icon: FileText,
			to: '/$team/$project/files',
			params: (prev) => ({ ...prev, ...params }),
		},
		{
			children: 'Discussions',
			icon: Users,
			to: '/$team/$project/discussions',
			params: (prev) => ({ ...prev, ...params }),
		},
		{
			children: 'Chat',
			icon: MessageCircle,
			to: '/$team/$project/chat',
			params: (prev) => ({ ...prev, ...params }),
		},
		{ children: 'Forms', icon: FileSpreadsheet, to: '/' },
		{ children: 'Jobs', icon: Briefcase, to: '/' },
		{ children: 'Wiki', icon: BookOpen, to: '/' },
		{ children: 'Feeds', icon: Rss, to: '/' },
	] as (Omit<LinkProps, 'children'> & {
		className?: ClassValue;
		children: string;
		icon?: LucideIcon | string;
	})[];

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

	useEffect(() => {
		const calculateVisibleFeatures = () => {
			if (!featuresContainerRef.current) return;

			const container = featuresContainerRef.current;
			const containerWidth = container.offsetWidth;

			// Reserve space for the "more" button (approximately 40px)
			const moreButtonWidth = 40;
			const availableWidth = containerWidth - moreButtonWidth;

			let totalWidth = 0;
			let visibleCount = 0;

			// Measure actual button widths
			for (let i = 0; i < features.length; i++) {
				const buttonRef = featureButtonRefs.current[i];
				if (!buttonRef) {
					// If button isn't rendered yet, estimate width based on text length
					// Icon (16px) + padding (16px) + text width (approx 8px per char) + gap (8px)
					const estimatedWidth = 40 + features[i].children.length * 8;
					totalWidth += estimatedWidth;
				} else {
					// Use actual measured width
					totalWidth += buttonRef.offsetWidth + 4; // +4 for gap
				}

				if (totalWidth <= availableWidth) {
					visibleCount = i + 1;
				} else {
					break;
				}
			}

			// Ensure at least one item is visible
			setVisibleFeatures(Math.max(1, visibleCount));
		};

		// Initial calculation
		calculateVisibleFeatures();

		// Recalculate on resize
		const handleResize = () => {
			// Small delay to ensure DOM has updated
			setTimeout(calculateVisibleFeatures, 10);
		};

		window.addEventListener('resize', handleResize);

		// Also recalculate when buttons are rendered (for initial load)
		const observer = new ResizeObserver(calculateVisibleFeatures);
		if (featuresContainerRef.current) {
			observer.observe(featuresContainerRef.current);
		}

		return () => {
			window.removeEventListener('resize', handleResize);
			observer.disconnect();
		};
	}, []); // Removed features from the dependency array

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault();
				setIsCommandOpen(true);
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, []);

	const visibleFeaturesList = features.slice(0, visibleFeatures);
	const hiddenFeatures = features.slice(visibleFeatures);

	return (
		<>
			<nav className='border-b bg-background'>
				<div className='container'>
					{/* Top row */}
					<div className='flex items-center justify-between py-3'>
						{/* Left: Logo and org/project */}
						<div className='flex min-w-0 flex-shrink-0 items-center gap-3'>
							<div className='flex items-center gap-2'>
								<div className='flex h-8 w-8 items-center justify-center rounded-full bg-primary'>
									<span className='text-sm font-bold text-primary-foreground'>G</span>
								</div>
								<div className='-ml-3 flex h-8 w-8 items-center justify-center rounded-full bg-foreground ring-2 ring-background'>
									<span className='text-sm font-bold text-background'>O</span>
								</div>
							</div>
							<div className='hidden min-w-0 items-center gap-1 text-sm sm:flex'>
								<a href='#' className='hover:underline'>
									Organization
								</a>
								<span className='text-muted-foreground'>/</span>
								<a href='#' className='hover:underline'>
									Project
								</a>
							</div>
						</div>

						{/* Center/Right: Search and user controls */}
						<div className='flex flex-shrink-0 items-center gap-3'>
							<div className='hidden md:block'>
								<Button
									variant='outline'
									className='max-w-xs justify-start border-border bg-muted/50 px-3 py-2 text-muted-foreground hover:bg-muted'
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
									<Button variant='ghost' size='sm' className='relative'>
										<Bell className='h-4 w-4' />
										<Badge
											variant='destructive'
											className='absolute -top-1 -right-1 h-4 w-4 p-0 text-xs'
										>
											{notifications.length}
										</Badge>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align='end' className='w-80'>
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

							<UserDropdown />
						</div>
					</div>
				</div>

				<div className='border-t bg-muted/30'>
					<div className='container'>
						{/* Bottom row */}
						<div className='flex items-center justify-between py-2'>
							{/* Left: Features with dynamic overflow handling */}
							<div ref={featuresContainerRef} className='flex min-w-0 flex-1 items-center gap-1'>
								{visibleFeaturesList.map((feature, index) => {
									const Icon = feature.icon;
									return (
										<Button
											key={feature.children}
											ref={(el) => {
												featureButtonRefs.current[index] = el;
											}}
											variant='ghost'
											size='sm'
											className='flex shrink-0 items-center gap-2 text-sm'
											asChild
										>
											<Link to={feature.to} params={feature.params}>
												{typeof Icon === 'string'
													? Icon
													: Icon && <Icon className='size-4 text-muted-foreground' />}
												<span>{feature.children}</span>
											</Link>
										</Button>
									);
								})}

								{hiddenFeatures.length > 0 && (
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button variant='ghost' size='sm' className='shrink-0'>
												<MoreHorizontal className='h-4 w-4' />
												<span className='sr-only'>More features</span>
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent>
											{hiddenFeatures.map((feature) => {
												const Icon = feature.icon;
												return (
													<DropdownMenuItem key={feature.children} asChild>
														<Link
															to={feature.to}
															params={feature.params}
															className='flex items-center gap-2'
														>
															{typeof Icon === 'string'
																? Icon
																: Icon && <Icon className='size-4 text-muted-foreground' />}
															{feature.children}
														</Link>
													</DropdownMenuItem>
												);
											})}
										</DropdownMenuContent>
									</DropdownMenu>
								)}
							</div>
						</div>
					</div>
				</div>
			</nav>

			<CommandPalette open={isCommandOpen} onOpenChange={setIsCommandOpen} />
		</>
	);
}
