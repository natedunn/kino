import type { VariantProps } from 'class-variance-authority';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium disabled:pointer-events-none disabled:opacity-50 disabled:grayscale [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3.5 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
	{
		variants: {
			variant: {
				default:
					'bg-gradient-to-tl from-primary to-blue-400 hocus:to-blue-600 text-background hocus:border-blue-800 dark:text-foreground border border-blue-500 dark:border-blue-300 hocus:dark:border-blue-400',
				destructive: [
					// 'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60'
					'bg-gradient-to-tl border',
					'text-red-50 from-red-500 via-red-700 to-red-700 border-red-800',
					'hocus:from-red-600 hocus:via-red-800 hocus:to-red-800 hocus:border-red-900 hocus:text-background',
					'dark:from-red-500 dark:via-red-700 dark:to-red-700 dark:border-red-400',
					'hocus:dark:from-red-600 hocus:dark:via-red-800 hocus:dark:to-red-800 hocus:dark:border-red-500 hocus:dark:text-red-50',
				],
				outline: [
					'bg-gradient-to-tl border border-foreground/30 hover:bg-accent',
					'from-muted via-white to-white',
					'hocus:from-muted hocus:via-muted hocus:to-white hocus:border-foreground/30',
					'dark:from-foreground/10 dark:to-foreground/5 dark:via-foreground/5 dark:border-foreground/15',
					'hocus:dark:!from-transparent hocus:dark:!to-foreground/10 hocus:dark:!via-transparent hocus:dark:!border-foreground/10',
					'active:dark:bg-foreground/10',
				],
				secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
				ghost: [
					'bg-gradient-to-tl from-transparent to-transparent   hocus:text-accent-foreground border border-transparent',
					'hocus:to-white hocus:from-accent/50 hocus:via-white hocus:border-foreground/20',
					'hocus:dark:to-foreground/5 hocus:dark:via-foreground/10 hocus:dark:border-foreground/10 hocus:dark:from-foreground/20 hocus:dark:border-foreground/10',
				],
				link: 'text-primary underline-offset-4 hover:underline',
			},
			size: {
				default: 'h-9 px-4 has-[>svg]:px-3',
				sm: 'h-7 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
				lg: 'h-11 rounded-md px-6 has-[>svg]:px-4',
				icon: 'size-[42px]',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	}
);

function Button({
	className,
	variant,
	size,
	asChild = false,
	...props
}: React.ComponentProps<'button'> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot : 'button';

	return (
		<Comp
			data-slot='button'
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
