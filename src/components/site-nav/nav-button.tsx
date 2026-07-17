import type * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function NavButton({
	className,
	variant = 'outline',
	...props
}: React.ComponentProps<typeof Button>) {
	return (
		<Button
			variant={variant}
			className={cn(
				'bg-white dark:bg-background hocus:border-foreground/55 hocus:bg-white dark:hocus:border-foreground/35 dark:hocus:bg-secondary',
				className
			)}
			{...props}
		/>
	);
}
