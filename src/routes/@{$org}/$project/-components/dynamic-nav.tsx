'use client';

import type { Icon } from '@/icons/types';

import { useEffect, useRef, useState } from 'react';
import { Link, LinkProps } from '@tanstack/react-router';
import { ClassValue } from 'clsx';

import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ArchivePencil from '@/icons/archive-pencil';
import CalendarDays from '@/icons/calendar-days';
import Chat from '@/icons/chat';
import Dots from '@/icons/dots';
import Folder from '@/icons/folder';
import Home from '@/icons/home';
import Interview from '@/icons/interview';
import Roadmap from '@/icons/roadmap';
import { cn } from '@/lib/utils';

export interface NavigationItem extends Omit<LinkProps, 'children'> {
	className?: ClassValue;
	children: string;
	icon?: string | Icon;
}

interface DynamicNavigationProps {
	orgSlug: string;
	projectSlug: string;
	className?: string;
	onStateChange?: (state: { isCalculating: boolean }) => void;
}

export function DynamicNavigation({ orgSlug, projectSlug, onStateChange }: DynamicNavigationProps) {
	const params = {
		team: orgSlug,
		project: projectSlug,
	};

	const items: NavigationItem[] = [
		{
			children: 'Overview',
			icon: Home,
			to: '/@{$org}/$project',
			params: (prev) => ({ ...prev, ...params }),
		},
		{
			children: 'Feedback',
			icon: ArchivePencil,
			to: '/@{$org}/$project/feedback',
			params: (prev) => ({ ...prev, ...params }),
		},
		{
			children: 'Updates',
			icon: CalendarDays,
			to: '/@{$org}/$project/updates',
			params: (prev) => ({ ...prev, ...params }),
		},
		{
			children: 'Roadmap',
			icon: Roadmap,
			to: '/@{$org}/$project/roadmap',
			params: (prev) => ({ ...prev, ...params }),
		},
		{
			children: 'Files',
			icon: Folder,
			to: '/@{$org}/$project/files',
			params: (prev) => ({ ...prev, ...params }),
		},
		{
			children: 'Discussions',
			icon: Interview,
			to: '/@{$org}/$project/discussions',
			params: (prev) => ({ ...prev, ...params }),
		},
		{
			children: 'Chat',
			icon: Chat,
			to: '/@{$org}/$project/chat',
			params: (prev) => ({ ...prev, ...params }),
		},
		// { children: 'Forms', icon: FileSpreadsheet, to: '/' },
		// { children: 'Jobs', icon: Briefcase, to: '/' },
		// { children: 'Wiki', icon: BookOpen, to: '/' },
		// { children: 'Feeds', icon: Rss, to: '/' },
	];

	const [visibleItems, setVisibleItems] = useState<number>(10);
	const containerRef = useRef<HTMLDivElement>(null);
	const itemButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
	const [isCalculating, setIsCalculating] = useState<boolean>(true);

	useEffect(() => {
		onStateChange?.({ isCalculating });
	}, [isCalculating, onStateChange]);

	useEffect(() => {
		const calculateVisibleItems = () => {
			if (!containerRef.current) {
				setIsCalculating(false);
				return;
			}

			const container = containerRef.current;
			const containerWidth = container.offsetWidth;

			// Reserve space for the "more" button and add a safety buffer
			const moreButtonWidth = 40;
			const safetyBuffer = 24; // Extra buffer to prevent flickering
			const availableWidth = containerWidth - moreButtonWidth - safetyBuffer;

			let totalWidth = 0;
			let visibleCount = 0;

			// Measure actual button widths
			for (let i = 0; i < items.length; i++) {
				const buttonRef = itemButtonRefs.current[i];
				let itemWidth = 0;

				if (!buttonRef) {
					// Conservative estimate for unrendered buttons
					// Icon (16px) + padding (32px) + text width (9px per char) + margin
					itemWidth = 48 + items[i].children.length * 9;
				} else {
					// Use actual measured width with extra margin
					itemWidth = buttonRef.offsetWidth + 8; // +8 for gap and buffer
				}

				if (totalWidth + itemWidth <= availableWidth) {
					totalWidth += itemWidth;
					visibleCount = i + 1;
				} else {
					break;
				}
			}

			// Ensure at least one item is visible, but show all if container is very wide
			const finalCount = Math.max(1, Math.min(visibleCount, items.length));

			// Only update if there's a meaningful change to prevent unnecessary re-renders
			if (Math.abs(finalCount - visibleItems) > 0) {
				setVisibleItems(finalCount);
			}
			setIsCalculating(false);
		};

		// Initial calculation with a delay to ensure DOM is ready
		const initialTimeout = setTimeout(calculateVisibleItems, 50);

		// Debounced resize handler to prevent excessive calculations
		let resizeTimeout: NodeJS.Timeout;
		const handleResize = () => {
			setIsCalculating(true);
			clearTimeout(resizeTimeout);
			resizeTimeout = setTimeout(calculateVisibleItems, 100);
		};

		window.addEventListener('resize', handleResize);

		// Observer for container size changes
		const observer = new ResizeObserver(() => {
			setIsCalculating(true);
			clearTimeout(resizeTimeout);
			resizeTimeout = setTimeout(calculateVisibleItems, 50);
		});

		if (containerRef.current) {
			observer.observe(containerRef.current);
		}

		return () => {
			clearTimeout(initialTimeout);
			clearTimeout(resizeTimeout);
			window.removeEventListener('resize', handleResize);
			observer.disconnect();
		};
	}, [items.length, visibleItems]);

	const visibleItemsList = items.slice(0, visibleItems);
	const hiddenItems = items.slice(visibleItems);

	return (
		<div ref={containerRef} className='relative overflow-x-hidden border-b bg-muted'>
			<div className='container'>
				<div className={`flex flex-nowrap items-center gap-1 py-2`}>
					{visibleItemsList.map((item, index) => {
						const Icon = item.icon;
						return (
							<Button
								key={item.children}
								ref={(el) => {
									itemButtonRefs.current[index] = el;
								}}
								variant='ghost'
								size='sm'
								className={cn(['group flex shrink-0 items-center gap-2 text-xs! md:text-sm', ''])}
								asChild
							>
								<Link
									activeOptions={{
										exact: item.to === '/@{$org}/$project',
									}}
									to={item.to}
									params={item.params}
									className='flex items-center gap-2'
								>
									{({ isActive }) => (
										<>
											{typeof Icon === 'string' ? (
												<>{Icon}</>
											) : (
												Icon && (
													<Icon
														className={cn(
															'size-4 text-muted-foreground group-active:text-foreground group-hocus:text-foreground',
															{ 'text-blue-300 group-hocus:text-blue-300': isActive }
														)}
													/>
												)
											)}
											<span>{item.children}</span>
										</>
									)}
								</Link>
							</Button>
						);
					})}

					{hiddenItems.length > 0 && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant='ghost' size='sm' className='shrink-0'>
									<Dots className='size-4 text-muted-foreground' />
									<span className='sr-only'>More features</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent>
								{hiddenItems.map((item) => {
									const Icon = item.icon;
									return (
										<DropdownMenuItem key={item.children} asChild>
											<Link to={item.to} params={item.params} className='flex items-center gap-2'>
												{typeof Icon === 'string'
													? Icon
													: Icon && <Icon className='size-4 text-muted-foreground' />}
												{item.children}
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
	);
}
