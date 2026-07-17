import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { RoadmapItem, RoadmapStatus } from '../-types';

import { useMemo, useState } from 'react';
import {
	DndContext,
	DragOverlay,
	PointerSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import { ChevronDown, ChevronUp, GripHorizontal, MessageSquare } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { GithubIcon } from '@/icons';
import { cn } from '@/lib/utils';

import { STATUS_CONFIG, STATUSES } from '../-config';

type DragHandle = Pick<ReturnType<typeof useDraggable>, 'listeners' | 'attributes'>;

function BoardCard({
	item,
	dragHandle,
	isDragging = false,
	isOverlay = false,
}: {
	item: RoadmapItem;
	dragHandle?: DragHandle;
	isDragging?: boolean;
	isOverlay?: boolean;
}) {
	return (
		<div
			className={cn(
				'group rounded-lg border bg-card p-3.5 transition-all duration-150',
				!isOverlay &&
					'cursor-pointer hover:border-foreground/20 hover:shadow-sm dark:hover:border-foreground/10',
				isOverlay && 'rotate-[1.5deg] border-foreground/15 shadow-xl dark:border-foreground/10',
				isDragging && 'scale-[0.98] opacity-30'
			)}
		>
			<p
				className={cn(
					'mb-2.5 text-sm leading-snug font-medium transition-colors',
					!isOverlay && 'group-hover:text-primary'
				)}
			>
				{item.title}
			</p>
			<div className='mb-3 flex flex-wrap gap-1'>
				{item.tags.map((tag) => (
					<Badge
						key={tag}
						variant='outline'
						className='h-4 border-border/60 py-0 text-[10px] font-normal text-muted-foreground'
					>
						{tag}
					</Badge>
				))}
			</div>
			<div className='flex items-center justify-between'>
				<div className='flex items-center gap-3'>
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
				</div>
				<span className='flex items-center gap-1 text-xs font-medium text-muted-foreground'>
					<ChevronUp className='size-3' />
					{item.upvotes}
				</span>
			</div>

			{/* Grab handle — admin / editor only */}
			{dragHandle && (
				<div
					{...dragHandle.listeners}
					{...dragHandle.attributes}
					className='-mx-3.5 mt-3 -mb-3.5 flex cursor-grab items-center justify-center rounded-b-lg border-t bg-muted py-1.5 transition-colors hover:bg-accent active:cursor-grabbing'
				>
					<GripHorizontal className='size-3 text-muted-foreground' />
				</div>
			)}
		</div>
	);
}

function DraggableBoardCard({ item }: { item: RoadmapItem }) {
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id: item.id,
		data: { item },
	});

	return (
		<div ref={setNodeRef}>
			<BoardCard item={item} dragHandle={{ listeners, attributes }} isDragging={isDragging} />
		</div>
	);
}

function DroppableColumn({
	status,
	items,
	className,
	hideHeader = false,
}: {
	status: RoadmapStatus;
	items: Array<RoadmapItem>;
	className?: string;
	hideHeader?: boolean;
}) {
	const config = STATUS_CONFIG[status];
	const { Icon } = config;
	const { setNodeRef, isOver } = useDroppable({ id: status });

	return (
		<div
			ref={setNodeRef}
			className={cn(
				'flex w-[272px] shrink-0 flex-col self-start rounded-xl transition-all duration-150',
				isOver && 'ring-2 ring-primary/40',
				className
			)}
		>
			{/* Column header — hidden on mobile (parent renders the select instead) */}
			{!hideHeader && (
				<div
					className={cn(
						'mb-3 flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors',
						isOver ? 'border-primary/30 bg-primary/10' : cn(config.bgClass, config.borderClass)
					)}
				>
					<div className='flex items-center gap-2'>
						<Icon className={cn('size-3.5', config.colorClass)} />
						<span className='text-xs font-semibold'>{config.label}</span>
					</div>
					<span
						className={cn('font-mono text-[10px] font-semibold tabular-nums', config.colorClass)}
					>
						{items.length}
					</span>
				</div>
			)}

			{/* Card area */}
			<div
				className={cn(
					'flex min-h-[160px] flex-col gap-2 transition-colors duration-150',
					!hideHeader && 'rounded-b-xl',
					isOver && 'bg-primary/5'
				)}
			>
				{items.map((item) => (
					<DraggableBoardCard key={item.id} item={item} />
				))}
				{items.length === 0 && (
					<div
						className={cn(
							'flex items-center justify-center rounded-lg border border-dashed py-10 transition-colors',
							isOver ? 'border-primary/40 bg-primary/5' : 'bg-muted/30'
						)}
					>
						<span className='text-xs text-muted-foreground/50'>
							{isOver ? 'Drop here' : 'No items yet'}
						</span>
					</div>
				)}
			</div>
		</div>
	);
}

export function BoardView({
	items,
	onStatusChange,
}: {
	items: Array<RoadmapItem>;
	onStatusChange: React.Dispatch<React.SetStateAction<Array<RoadmapItem>>>;
}) {
	const [activeItem, setActiveItem] = useState<RoadmapItem | null>(null);
	const [mobileStatus, setMobileStatus] = useState<RoadmapStatus>('in-progress');

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

	const itemsByStatus = useMemo(
		() =>
			Object.fromEntries(STATUSES.map((s) => [s, items.filter((i) => i.status === s)])) as Record<
				RoadmapStatus,
				Array<RoadmapItem>
			>,
		[items]
	);

	function handleDragStart(event: DragStartEvent) {
		const dragged = event.active.data.current?.item as RoadmapItem | undefined;
		setActiveItem(dragged ?? null);
	}

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		setActiveItem(null);
		if (!over) return;
		const itemId = active.id as string;
		const newStatus = over.id as RoadmapStatus;
		onStatusChange((prev) =>
			prev.map((item) => (item.id === itemId ? { ...item, status: newStatus } : item))
		);
	}

	const mobileConfig = STATUS_CONFIG[mobileStatus];
	const MobileIcon = mobileConfig.Icon;

	return (
		<DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
			{/* ── Mobile (<sm): native-select header + single full-width column ── */}
			<div className='flex flex-col gap-3 px-4 py-4 sm:hidden'>
				{/* Styled select — count left, label, chevron right */}
				<div className='relative'>
					<div
						className={cn(
							'pointer-events-none flex items-center gap-2.5 rounded-lg border px-3 py-2.5',
							mobileConfig.bgClass,
							mobileConfig.borderClass
						)}
					>
						<span
							className={cn(
								'font-mono text-[10px] font-semibold tabular-nums',
								mobileConfig.colorClass
							)}
						>
							{itemsByStatus[mobileStatus].length}
						</span>
						<MobileIcon className={cn('size-3.5', mobileConfig.colorClass)} />
						<span className='flex-1 text-xs font-semibold'>{mobileConfig.label}</span>
						<ChevronDown className='size-3.5 text-muted-foreground' />
					</div>
					<select
						value={mobileStatus}
						onChange={(e) => setMobileStatus(e.target.value as RoadmapStatus)}
						className='absolute inset-0 w-full cursor-pointer opacity-0'
					>
						{STATUSES.map((s) => (
							<option key={s} value={s}>
								{STATUS_CONFIG[s].label} ({itemsByStatus[s].length})
							</option>
						))}
					</select>
				</div>

				{/* Cards — full width, no header (select above replaces it) */}
				<DroppableColumn
					status={mobileStatus}
					items={itemsByStatus[mobileStatus]}
					className='w-full'
					hideHeader
				/>
			</div>

			{/* ── sm+: wrapping grid (2-col → 4-col at lg) ── */}
			<div className='hidden py-6 sm:block'>
				<div className='container grid grid-cols-2 gap-4 lg:grid-cols-4'>
					{STATUSES.map((status) => (
						<DroppableColumn
							key={status}
							status={status}
							items={itemsByStatus[status]}
							className='w-full'
						/>
					))}
				</div>
			</div>

			{/* Fixed width wrapper prevents the overlay card from collapsing */}
			<DragOverlay dropAnimation={null}>
				{activeItem ? (
					<div className='w-[272px]'>
						<BoardCard item={activeItem} isOverlay />
					</div>
				) : null}
			</DragOverlay>
		</DndContext>
	);
}
