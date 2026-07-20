import type { Icon as IconType } from '@/icons/types';
import type { ReactNode } from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Shared shell for a dashboard/sidebar section: a titled Card with an optional
// leading icon and a trailing action slot (e.g. a typed "View all" Link).
export function SectionCard({
	title,
	Icon,
	action,
	className,
	bodyClassName,
	children,
}: {
	title: string;
	Icon?: IconType;
	action?: ReactNode;
	className?: string;
	bodyClassName?: string;
	children: ReactNode;
}) {
	return (
		<Card className={cn('gap-0 py-0', className)}>
			<div className='flex items-center justify-between gap-2 border-b px-4 py-3'>
				<div className='flex items-center gap-2'>
					{Icon && <Icon className='size-4 text-muted-foreground' />}
					<h2 className='text-sm font-semibold'>{title}</h2>
				</div>
				{action}
			</div>
			<div className={cn('px-4 py-3', bodyClassName)}>{children}</div>
		</Card>
	);
}
