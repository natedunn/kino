import * as React from 'react';
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';

import { useProjectThemeStyle } from '@/lib/project-theme';
import { cn } from '@/lib/utils';

function TooltipProvider({
	children,
	delayDuration: _delayDuration,
}: {
	children: React.ReactNode;
	delayDuration?: number;
}) {
	// delayDuration is accepted for API compatibility but Base UI handles delay differently
	return <>{children}</>;
}

function Tooltip({
	delayDuration: _delayDuration,
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
			<TooltipPrimitive.Trigger
				data-slot='tooltip-trigger'
				render={children}
				delay={delay}
				{...props}
			/>
		);
	}
	return (
		<TooltipPrimitive.Trigger data-slot='tooltip-trigger' delay={delay} {...props}>
			{children}
		</TooltipPrimitive.Trigger>
	);
}

function TooltipContent({
	align,
	alignOffset,
	className,
	sideOffset = 8,
	side = 'top',
	children,
	style,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Popup> & {
	align?: React.ComponentProps<typeof TooltipPrimitive.Positioner>['align'];
	alignOffset?: React.ComponentProps<typeof TooltipPrimitive.Positioner>['alignOffset'];
	sideOffset?: number;
	side?: 'top' | 'bottom' | 'left' | 'right';
}) {
	const themeStyle = useProjectThemeStyle();
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Positioner
				data-project-theme={themeStyle ? '' : undefined}
				style={themeStyle}
				align={align}
				alignOffset={alignOffset}
				sideOffset={sideOffset}
				side={side}
				className='isolate z-50'
			>
				<TooltipPrimitive.Popup
					data-slot='tooltip-content'
					data-project-theme={themeStyle ? '' : undefined}
					className={cn(
						'z-50 w-fit origin-(--transform-origin) rounded-md bg-primary px-3 py-1.5 text-xs text-balance text-primary-foreground duration-100 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
						className
					)}
					style={{ ...themeStyle, ...style }}
					{...props}
				>
					{children}
					{/* Base UI tracks the arrow to the anchor centre, which drifts to the
					    edge over wide triggers. Force it to the centre of the tooltip body
					    instead (important overrides Base UI's inline left/top). */}
					<TooltipPrimitive.Arrow className='absolute data-[side=bottom]:-top-1.5 data-[side=bottom]:left-1/2! data-[side=bottom]:-translate-x-1/2! data-[side=bottom]:rotate-180 data-[side=left]:top-1/2! data-[side=left]:-right-1.5 data-[side=left]:-translate-y-1/2! data-[side=left]:-rotate-90 data-[side=right]:top-1/2! data-[side=right]:-left-1.5 data-[side=right]:-translate-y-1/2! data-[side=right]:rotate-90 data-[side=top]:-bottom-1.5 data-[side=top]:left-1/2! data-[side=top]:-translate-x-1/2!'>
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
