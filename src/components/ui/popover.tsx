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
	return (
		<PopoverPrimitive.Trigger data-slot='popover-trigger' {...props}>
			{children}
		</PopoverPrimitive.Trigger>
	);
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
			<PopoverPrimitive.Positioner
				align={align}
				side={side}
				sideOffset={sideOffset}
				className='z-50'
			>
				<PopoverPrimitive.Popup
					data-slot='popover-content'
					className={cn(
						'z-50 w-72 origin-[var(--transform-origin)] rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden transition-[opacity,transform] duration-150 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95',
						className
					)}
					{...props}
				/>
			</PopoverPrimitive.Positioner>
		</PopoverPrimitive.Portal>
	);
}

export { Popover, PopoverTrigger, PopoverContent };
