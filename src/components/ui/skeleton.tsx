import { cn } from 'src/lib/utils';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot='skeleton'
			className={cn('animate-pulse rounded-md bg-accent/50', className)}
			{...props}
		/>
	);
}

export { Skeleton };
