import * as React from 'react';
import { Popover as PopoverPrimitive } from '@base-ui/react/popover';

import { cn } from '@/lib/utils';

function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
	return <PopoverPrimitive.Root data-slot='popover' {...props} />;
}

function PopoverTrigger({
	asChild,
	children,
	...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger> & {
	asChild?: boolean;
}) {
	if (asChild && React.isValidElement(children)) {
		return <PopoverPrimitive.Trigger data-slot='popover-trigger' render={children} {...props} />;
	}
	return <PopoverPrimitive.Trigger data-slot='popover-trigger' {...props}>{children}</PopoverPrimitive.Trigger>;
}

function PopoverContent({
	className,
	align = 'center',
	side = 'bottom',
	sideOffset = 4,
	...props
}: React.ComponentProps<typeof PopoverPrimitive.Popup> & {
	align?: 'start' | 'center' | 'end';
	side?: 'top' | 'bottom' | 'left' | 'right';
	sideOffset?: number;
}) {
	return (
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Positioner align={align} side={side} sideOffset={sideOffset} className="z-50">
				<PopoverPrimitive.Popup
					data-slot='popover-content'
					className={cn(
						'z-50 w-72 origin-[var(--transform-origin)] rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[ending-style]:animate-out data-[ending-style]:fade-out-0 data-[ending-style]:zoom-out-95 data-[starting-style]:animate-in data-[starting-style]:fade-in-0 data-[starting-style]:zoom-in-95',
						className
					)}
					{...props}
				/>
			</PopoverPrimitive.Positioner>
		</PopoverPrimitive.Portal>
	);
}

export { Popover, PopoverTrigger, PopoverContent };
