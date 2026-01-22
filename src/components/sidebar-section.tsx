import { ChevronDown } from 'lucide-react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

type SidebarSectionProps = {
	title: string;
	icon?: React.ReactNode;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: React.ReactNode;
	className?: string;
};

export function SidebarSection({
	title,
	icon,
	open,
	onOpenChange,
	children,
	className,
}: SidebarSectionProps) {
	return (
		<Collapsible open={open} onOpenChange={onOpenChange} className={className}>
			<CollapsibleTrigger className='group flex w-full cursor-pointer items-center justify-between border-b pb-2'>
				<h3 className='flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase transition-colors group-hover:text-foreground'>
					{icon}
					{title}
				</h3>
				<ChevronDown className='size-4 text-muted-foreground transition-all group-hover:text-foreground group-data-[state=open]:rotate-180' />
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className='pt-3'>{children}</div>
			</CollapsibleContent>
		</Collapsible>
	);
}
