import * as React from 'react';
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';

import { cn } from '@/lib/utils';

function TooltipProvider({
	children,
	delayDuration,
}: {
	children: React.ReactNode;
	delayDuration?: number;
}) {
	// delayDuration is accepted for API compatibility but Base UI handles delay differently
	return <>{children}</>;
}

function Tooltip({
	delayDuration,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Root> & {
	delayDuration?: number;
}) {
	// Base UI tooltip uses default delay behavior
	return <TooltipPrimitive.Root data-slot='tooltip' {...props} />;
}

function TooltipTrigger({
	asChild,
	children,
	delay,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger> & {
	asChild?: boolean;
	delay?: number;
}) {
	if (asChild && React.isValidElement(children)) {
		return (
			<TooltipPrimitive.Trigger data-slot='tooltip-trigger' render={children} delay={delay} {...props} />
		);
	}
	return (
		<TooltipPrimitive.Trigger data-slot='tooltip-trigger' delay={delay} {...props}>
			{children}
		</TooltipPrimitive.Trigger>
	);
}

function TooltipContent({
	className,
	sideOffset = 8,
	side = 'top',
	children,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Popup> & {
	sideOffset?: number;
	side?: 'top' | 'bottom' | 'left' | 'right';
}) {
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Positioner sideOffset={sideOffset} side={side} className='z-50'>
				<TooltipPrimitive.Popup
					data-slot='tooltip-content'
					className={cn(
						'z-50 w-fit origin-[var(--transform-origin)] animate-in rounded-md bg-primary px-3 py-1.5 text-xs text-balance text-primary-foreground fade-in-0 zoom-in-95 data-[ending-style]:animate-out data-[ending-style]:fade-out-0 data-[ending-style]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
						className
					)}
					{...props}
				>
					{children}
					<TooltipPrimitive.Arrow className='absolute data-[side=bottom]:-top-1.5 data-[side=bottom]:rotate-180 data-[side=left]:-right-1.5 data-[side=left]:-rotate-90 data-[side=right]:-left-1.5 data-[side=right]:rotate-90 data-[side=top]:-bottom-1.5'>
						<svg width='12' height='6' viewBox='0 0 12 6' className='fill-primary'>
							<path d='M0 0L6 6L12 0' />
						</svg>
					</TooltipPrimitive.Arrow>
				</TooltipPrimitive.Popup>
			</TooltipPrimitive.Positioner>
		</TooltipPrimitive.Portal>
	);
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
