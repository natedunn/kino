'use client';

import { useEffect, useRef, useState } from 'react';
import { Link, LinkProps } from '@tanstack/react-router';
import { ClassValue } from 'clsx';
import { LucideIcon, MoreHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface NavigationItem extends Omit<LinkProps, 'children'> {
	className?: ClassValue;
	children: string;
	icon?: LucideIcon | string;
}

interface DynamicNavigationProps {
	items: NavigationItem[];
	className?: string;
}

export function DynamicNavigation({ items, className = '' }: DynamicNavigationProps) {
	const [visibleItems, setVisibleItems] = useState<number>(2);
	const containerRef = useRef<HTMLDivElement>(null);
	const itemButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

	useEffect(() => {
		const calculateVisibleItems = () => {
			if (!containerRef.current) return;

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
		};

		// Initial calculation with a delay to ensure DOM is ready
		const initialTimeout = setTimeout(calculateVisibleItems, 50);

		// Debounced resize handler to prevent excessive calculations
		let resizeTimeout: NodeJS.Timeout;
		const handleResize = () => {
			clearTimeout(resizeTimeout);
			resizeTimeout = setTimeout(calculateVisibleItems, 100);
		};

		window.addEventListener('resize', handleResize);

		// Observer for container size changes
		const observer = new ResizeObserver(() => {
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
		<div ref={containerRef} className={`flex min-w-0 flex-1 items-center gap-1 ${className}`}>
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
						className='flex shrink-0 items-center gap-2 !text-xs md:text-sm'
						asChild
					>
						<Link to={item.to} params={item.params}>
							{typeof Icon === 'string'
								? Icon
								: Icon && <Icon className='size-4 text-muted-foreground' />}
							<span>{item.children}</span>
						</Link>
					</Button>
				);
			})}

			{hiddenItems.length > 0 && (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant='ghost' size='sm' className='shrink-0'>
							<MoreHorizontal className='h-4 w-4' />
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
	);
}
