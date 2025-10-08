import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';

import { ExtendedComponentProps } from '@/lib/types';
import { cn } from '@/lib/utils';

function LabelWrapper({ className, children, ...props }: ExtendedComponentProps<'div', {}>) {
	return (
		<div className={cn('mb-1.5 flex flex-col justify-center gap-1', className)} {...props}>
			{children}
		</div>
	);
}

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
	return (
		<LabelPrimitive.Root
			data-slot='label'
			className={cn(
				'flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
				className
			)}
			{...props}
		/>
	);
}

function LabelDescription({ className, children, ...props }: ExtendedComponentProps<'span', {}>) {
	return (
		<span
			className={cn(
				'text-xs text-muted-foreground peer-disabled:text-muted-foreground peer-disabled:opacity-50',
				className
			)}
			{...props}
		>
			{children}
		</span>
	);
}

export { LabelWrapper, Label, LabelDescription };
