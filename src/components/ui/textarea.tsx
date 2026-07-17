import type { VariantProps } from 'class-variance-authority';

import * as React from 'react';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

function supportsFieldSizing() {
	return (
		typeof CSS !== 'undefined' &&
		typeof CSS.supports === 'function' &&
		CSS.supports('field-sizing', 'content')
	);
}

const textareaVariants = cva(
	'flex field-sizing-content w-full rounded-lg border border-input bg-absolute text-base transition-colors outline-none placeholder:text-muted-foreground/50 read-only:cursor-default read-only:bg-input-readonly-background read-only:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring-accent/20 read-only:focus-visible:border-input read-only:focus-visible:ring-0 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input-background dark:read-only:bg-input-readonly-background dark:focus-visible:ring-ring-accent/40 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
	{
		variants: {
			size: {
				xs: 'min-h-10 rounded-[min(var(--radius-md),10px)] px-2 py-1 text-xs md:text-xs',
				sm: 'min-h-12 rounded-[min(var(--radius-md),12px)] px-2.5 py-1.5 text-sm',
				default: 'min-h-16 px-2.5 py-2',
				lg: 'min-h-24 px-3.5 py-3',
				xl: 'min-h-28 px-4 py-3.5 text-base md:text-base',
			},
		},
		defaultVariants: {
			size: 'default',
		},
	}
);

function Textarea({
	className,
	size,
	...props
}: React.ComponentProps<'textarea'> & VariantProps<typeof textareaVariants>) {
	const ref = React.useRef<HTMLTextAreaElement>(null);

	// Modern browsers auto-grow via the CSS `field-sizing: content` rule below.
	// Firefox and Safari < 17.4 don't support it yet, so fall back to a JS
	// resize listener there. This is a no-op on browsers that do support it.
	React.useEffect(() => {
		const el = ref.current;
		if (!el || supportsFieldSizing()) return;

		const resize = () => {
			el.style.height = 'auto';
			el.style.height = `${el.scrollHeight}px`;
		};

		resize();
		el.addEventListener('input', resize);
		return () => el.removeEventListener('input', resize);
	}, []);

	// Keep height in sync when the value is controlled externally.
	React.useEffect(() => {
		const el = ref.current;
		if (!el || supportsFieldSizing()) return;

		el.style.height = 'auto';
		el.style.height = `${el.scrollHeight}px`;
	}, [props.value]);

	return (
		<textarea
			ref={ref}
			data-slot='textarea'
			data-size={size}
			className={cn(textareaVariants({ size, className }))}
			{...props}
		/>
	);
}

export { Textarea, textareaVariants };
