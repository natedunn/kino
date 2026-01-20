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
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger> & {
	asChild?: boolean;
}) {
	if (asChild && React.isValidElement(children)) {
		return <TooltipPrimitive.Trigger data-slot='tooltip-trigger' render={children} {...props} />;
	}
	return <TooltipPrimitive.Trigger data-slot='tooltip-trigger' {...props}>{children}</TooltipPrimitive.Trigger>;
}

function TooltipContent({
	className,
	sideOffset = 0,
	side = 'top',
	children,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Popup> & {
	sideOffset?: number;
	side?: 'top' | 'bottom' | 'left' | 'right';
}) {
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Positioner sideOffset={sideOffset} side={side} className="z-50">
				<TooltipPrimitive.Popup
					data-slot='tooltip-content'
					className={cn(
						'z-50 w-fit origin-[var(--transform-origin)] animate-in rounded-md bg-primary px-3 py-1.5 text-xs text-balance text-primary-foreground fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[ending-style]:animate-out data-[ending-style]:fade-out-0 data-[ending-style]:zoom-out-95',
						className
					)}
					{...props}
				>
					{children}
					<TooltipPrimitive.Arrow className='z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-primary fill-primary' />
				</TooltipPrimitive.Popup>
			</TooltipPrimitive.Positioner>
		</TooltipPrimitive.Portal>
	);
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
