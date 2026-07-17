import type { RoadmapItem } from '../-types';

import { ChevronUp, MessageSquare } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { GithubIcon } from '@/icons';
import { cn } from '@/lib/utils';

import { LIST_ORDER, STATUS_CONFIG } from '../-config';

function ListItem({ item }: { item: RoadmapItem }) {
	const config = STATUS_CONFIG[item.status];
	const { Icon } = config;

	return (
		<div
			className={cn(
				'flex items-center gap-4 bg-card px-4 py-3 hover:bg-accent/50',
				'group cursor-pointer border-l-2 transition-colors',
				config.leftBorderClass
			)}
		>
			<Icon className={cn('size-3.5 shrink-0', config.colorClass)} />
			<div className='min-w-0 flex-1'>
				<p className='truncate text-sm font-medium transition-colors group-hover:text-primary'>
					{item.title}
				</p>
			</div>
			<div className='hidden shrink-0 items-center gap-1.5 sm:flex'>
				{item.tags.slice(0, 2).map((tag) => (
					<Badge
						key={tag}
						variant='outline'
						className='h-4 py-0 text-[10px] font-normal text-muted-foreground'
					>
						{tag}
					</Badge>
				))}
			</div>
			<span className='hidden w-16 shrink-0 text-right text-xs text-muted-foreground md:block'>
				{item.quarter}
			</span>
			<div className='flex shrink-0 items-center gap-4'>
				{item.feedbackCount > 0 && (
					<span className='flex items-center gap-1 text-xs text-muted-foreground'>
						<MessageSquare className='size-3' />
						{item.feedbackCount}
					</span>
				)}
				{item.githubIssues > 0 && (
					<span className='flex items-center gap-1 text-xs text-muted-foreground'>
						<GithubIcon className='size-3' />
						{item.githubIssues}
					</span>
				)}
				<span className='flex w-9 items-center justify-end gap-1 text-xs font-medium text-muted-foreground'>
					<ChevronUp className='size-3' />
					{item.upvotes}
				</span>
			</div>
		</div>
	);
}

export function ListView({ items }: { items: Array<RoadmapItem> }) {
	return (
		<div className='container py-6'>
			<div className='flex flex-col gap-6'>
				{LIST_ORDER.map((status) => {
					const statusItems = items.filter((i) => i.status === status);
					if (statusItems.length === 0) return null;
					const config = STATUS_CONFIG[status];
					const { Icon } = config;

					return (
						<div key={status}>
							<div className='mb-2 flex items-center gap-2 px-1'>
								<Icon className={cn('size-3.5', config.colorClass)} />
								<h2 className='text-xs font-bold tracking-wider text-muted-foreground uppercase'>
									{config.label}
								</h2>
								<span className={cn('ml-1 font-mono text-[10px] font-semibold', config.colorClass)}>
									{statusItems.length}
								</span>
							</div>
							<div className='divide-y divide-border/50 overflow-hidden rounded-lg border'>
								{statusItems.map((item) => (
									<ListItem key={item.id} item={item} />
								))}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
