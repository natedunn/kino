import type { VariantProps } from 'class-variance-authority';

import * as React from 'react';
import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
	"inline-flex shrink-0 items-center justify-center gap-1 rounded-md text-sm font-medium whitespace-nowrap transition-colors outline-none select-none disabled:pointer-events-none disabled:opacity-50 disabled:grayscale aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
	{
		variants: {
			variant: {
				default:
					'border border-blue-500 bg-gradient-to-tl from-primary to-blue-400 text-background dark:border-blue-300 dark:text-foreground hocus:border-blue-800 hocus:to-blue-600 hocus:dark:border-blue-400 [&:active]:border-blue-900 [&:active]:from-primary [&:active]:to-blue-800 dark:[&:active]:border-blue-500 dark:[&:active]:from-blue-600 dark:[&:active]:to-blue-700 [&:is(:hover,:focus-visible):active]:border-blue-900 [&:is(:hover,:focus-visible):active]:to-blue-800 dark:[&:is(:hover,:focus-visible):active]:border-blue-500 dark:[&:is(:hover,:focus-visible):active]:from-blue-600 dark:[&:is(:hover,:focus-visible):active]:to-blue-700',
				destructive: [
					'border bg-gradient-to-tl',
					'border-red-800 from-red-500 via-red-700 to-red-700 text-red-50',
					'hocus:border-red-900 hocus:from-red-600 hocus:via-red-800 hocus:to-red-800 hocus:text-background',
					'[&:active]:border-red-950 [&:active]:from-red-700 [&:active]:via-red-900 [&:active]:to-red-950 [&:active]:text-white',
					'dark:border-red-400 dark:from-red-500 dark:via-red-700 dark:to-red-700',
					'hocus:dark:border-red-500 hocus:dark:from-red-600 hocus:dark:via-red-800 hocus:dark:to-red-800 hocus:dark:text-red-50 dark:[&:active]:border-red-700 dark:[&:active]:from-red-700 dark:[&:active]:via-red-900 dark:[&:active]:to-red-900 dark:[&:active]:text-white [&:is(:hover,:focus-visible):active]:border-red-950 [&:is(:hover,:focus-visible):active]:from-red-700 [&:is(:hover,:focus-visible):active]:via-red-900 [&:is(:hover,:focus-visible):active]:to-red-950 [&:is(:hover,:focus-visible):active]:text-white dark:[&:is(:hover,:focus-visible):active]:border-red-700 dark:[&:is(:hover,:focus-visible):active]:from-red-700 dark:[&:is(:hover,:focus-visible):active]:via-red-900 dark:[&:is(:hover,:focus-visible):active]:to-red-900 dark:[&:is(:hover,:focus-visible):active]:text-white',
				],
				outline: [
					'border border-foreground/25 bg-background text-foreground',
					'hocus:border-foreground/40 hocus:bg-muted',
					'[&:active]:border-foreground/50 [&:active]:bg-accent',
					'dark:border-foreground/20 dark:bg-background',
					'hocus:dark:border-foreground/35 hocus:dark:bg-secondary',
					'dark:[&:active]:border-foreground/45 dark:[&:active]:bg-accent [&:is(:hover,:focus-visible):active]:border-foreground/50 [&:is(:hover,:focus-visible):active]:bg-accent dark:[&:is(:hover,:focus-visible):active]:border-foreground/45 dark:[&:is(:hover,:focus-visible):active]:bg-accent',
				],
				secondary: [
					'border border-foreground/20 bg-gradient-to-tl from-[oklch(0.91_0_0)] via-accent to-background text-secondary-foreground',
					'aria-expanded:border-foreground/25 aria-expanded:from-accent aria-expanded:via-muted aria-expanded:to-muted aria-expanded:text-accent-foreground',
					'hocus:border-foreground/30 hocus:from-[oklch(0.85_0_0)] hocus:via-accent hocus:to-muted hocus:text-accent-foreground',
					'[&:active]:border-foreground/35 [&:active]:from-[oklch(0.80_0_0)] [&:active]:via-accent [&:active]:to-[oklch(0.93_0_0)] [&:active]:text-accent-foreground',
					'dark:border-foreground/20 dark:from-[oklch(0.36_0_0)] dark:via-accent dark:to-background',
					'aria-expanded:dark:border-foreground/25 aria-expanded:dark:from-accent aria-expanded:dark:via-secondary aria-expanded:dark:to-secondary',
					'hocus:dark:border-foreground/30 hocus:dark:from-[oklch(0.44_0_0)] hocus:dark:via-accent hocus:dark:to-background',
					'dark:[&:active]:border-foreground/35 dark:[&:active]:from-[oklch(0.28_0_0)] dark:[&:active]:via-accent dark:[&:active]:to-background [&:is(:hover,:focus-visible):active]:border-foreground/35 [&:is(:hover,:focus-visible):active]:from-[oklch(0.80_0_0)] [&:is(:hover,:focus-visible):active]:via-accent [&:is(:hover,:focus-visible):active]:to-[oklch(0.93_0_0)] dark:[&:is(:hover,:focus-visible):active]:border-foreground/35 dark:[&:is(:hover,:focus-visible):active]:from-[oklch(0.28_0_0)] dark:[&:is(:hover,:focus-visible):active]:via-accent dark:[&:is(:hover,:focus-visible):active]:to-background',
				],
				ghost: [
					'border border-transparent bg-transparent bg-gradient-to-tl from-transparent via-transparent to-transparent hocus:text-accent-foreground',
					'hocus:border-foreground/20 hocus:from-accent hocus:via-white hocus:to-white',
					'[&:active]:border-foreground/35 [&:active]:from-accent [&:active]:via-accent [&:active]:to-muted [&:active]:text-accent-foreground',
					'hocus:dark:border-foreground/20 hocus:dark:from-accent hocus:dark:via-secondary hocus:dark:to-background dark:[&:active]:border-foreground/35 dark:[&:active]:from-accent dark:[&:active]:via-accent dark:[&:active]:to-secondary [&:is(:hover,:focus-visible):active]:border-foreground/35 [&:is(:hover,:focus-visible):active]:from-accent [&:is(:hover,:focus-visible):active]:via-accent [&:is(:hover,:focus-visible):active]:to-muted dark:[&:is(:hover,:focus-visible):active]:border-foreground/35 dark:[&:is(:hover,:focus-visible):active]:from-accent dark:[&:is(:hover,:focus-visible):active]:via-accent dark:[&:is(:hover,:focus-visible):active]:to-secondary',
				],
				link: 'text-primary underline-offset-4 hover:underline active:text-primary/70 active:underline',
			},
			size: {
				default:
					'h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
				xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
				sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
				lg: "h-10 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-4",
				xl: "h-11 gap-2 px-5 text-base has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4 [&_svg:not([class*='size-'])]:size-4",
				icon: 'size-8',
				'icon-xs':
					"size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
				'icon-sm':
					'size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg',
				'icon-lg': "size-10 [&_svg:not([class*='size-'])]:size-4",
				'icon-xl': "size-11 [&_svg:not([class*='size-'])]:size-4",
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	}
);

function Button({
	asChild = false,
	className,
	variant = 'default',
	size = 'default',
	children,
	...props
}: ButtonPrimitive.Props &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	return (
		<ButtonPrimitive
			data-slot='button'
			className={cn(buttonVariants({ variant, size, className }))}
			nativeButton={!asChild}
			render={asChild && React.isValidElement(children) ? children : undefined}
			{...props}
		>
			{asChild ? undefined : children}
		</ButtonPrimitive>
	);
}

export { Button, buttonVariants };
