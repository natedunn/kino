import type { RoadmapItem } from '../-types';

import { ChevronUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { CURRENT_QUARTER, QUARTERS, STATUS_CONFIG } from '../-config';

function TimelineCard({ item }: { item: RoadmapItem }) {
	const config = STATUS_CONFIG[item.status];
	const { Icon } = config;

	return (
		<div className='group cursor-pointer rounded-md border bg-card p-2.5 transition-all hover:border-foreground/15 hover:shadow-sm dark:hover:border-foreground/10'>
			<div className='mb-2 flex items-start gap-1.5'>
				<Icon className={cn('mt-0.5 size-3 shrink-0', config.colorClass)} />
				<p className='text-xs leading-snug font-medium transition-colors group-hover:text-primary'>
					{item.title}
				</p>
			</div>
			<div className='flex items-center justify-between gap-2'>
				<div className='flex min-w-0 gap-1 overflow-hidden'>
					{item.tags.slice(0, 1).map((tag) => (
						<Badge
							key={tag}
							variant='outline'
							className='h-3.5 shrink-0 px-1 py-0 text-[9px] font-normal text-muted-foreground'
						>
							{tag}
						</Badge>
					))}
				</div>
				<span className='flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-muted-foreground'>
					<ChevronUp className='size-2.5' />
					{item.upvotes}
				</span>
			</div>
		</div>
	);
}

export function TimelineView({ items }: { items: Array<RoadmapItem> }) {
	const itemsByQuarter: Record<string, Array<RoadmapItem>> = {};
	for (const q of QUARTERS) {
		itemsByQuarter[q] = items.filter((i) => i.quarter === q);
	}
	const currentIndex = QUARTERS.indexOf(CURRENT_QUARTER);

	return (
		<div className='overflow-x-auto py-6'>
			<div className='min-w-max px-6'>
				{/* Quarter grid */}
				<div className='relative flex'>
					{/* Connecting timeline line — vertically centered on the dot (28px from top),
              inset by half the column width (110px) so it spans dot-to-dot */}
					<div
						className='pointer-events-none absolute h-px bg-border'
						style={{
							top: '28px',
							left: '110px',
							right: '110px',
						}}
					/>

					{QUARTERS.map((quarter, index) => {
						const isPast = index < currentIndex;
						const isCurrent = quarter === CURRENT_QUARTER;
						const qItems = itemsByQuarter[quarter] ?? [];

						return (
							<div key={quarter} className='w-[220px] shrink-0 px-3'>
								{/* Quarter marker */}
								<div className='mb-6 flex flex-col items-center'>
									<span
										className={cn(
											'mb-3 text-[11px] font-semibold',
											isCurrent
												? 'text-primary'
												: isPast
													? 'text-muted-foreground'
													: 'text-foreground/60'
										)}
									>
										{quarter}
										{isCurrent && (
											<span className='ml-1.5 inline-flex items-center rounded-full bg-primary/15 px-1.5 py-px text-[9px] font-bold tracking-wide text-primary uppercase'>
												Now
											</span>
										)}
									</span>

									{/* Timeline dot */}
									<div
										className={cn(
											'relative z-10 size-3 rounded-full border-2 transition-all',
											isCurrent
												? 'border-primary bg-primary shadow-[0_0_0_4px_color-mix(in_oklch,var(--color-primary)_15%,transparent)]'
												: isPast
													? 'border-emerald-500 bg-emerald-500'
													: 'border-border bg-background'
										)}
									/>
								</div>

								{/* Items */}
								<div className='flex flex-col gap-2'>
									{qItems.map((item) => (
										<TimelineCard key={item.id} item={item} />
									))}
									{qItems.length === 0 && (
										<div className='flex h-16 items-center justify-center rounded-md border border-dashed'>
											<span className='text-xs text-muted-foreground/40'>—</span>
										</div>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
