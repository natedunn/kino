
import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { LayoutGrid, List, Milestone, Search } from 'lucide-react';


import { BoardView } from './-components/board-view';
import { ListView } from './-components/list-view';
import { TimelineView } from './-components/timeline-view';
import { MOCK_ITEMS } from './-mock-data';
import type { RoadmapItem, ViewMode } from './-types';
import { cn } from '@/lib/utils';
import { projectTitle, titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/@{$org}/$project/roadmap/')({
	head: ({ params }) => ({
		meta: [titleMeta(['Roadmap', projectTitle(params.org, params.project)])],
	}),
	component: RoadmapPage,
});

const VIEW_OPTIONS: Array<{
	mode: ViewMode;
	label: string;
	Icon: typeof LayoutGrid;
}> = [
	{ mode: 'board', label: 'Board', Icon: LayoutGrid },
	{ mode: 'list', label: 'List', Icon: List },
	{ mode: 'timeline', label: 'Timeline', Icon: Milestone },
];

function RoadmapPage() {
	const [view, setView] = useState<ViewMode>('board');
	const [search, setSearch] = useState('');
	const [items, setItems] = useState<Array<RoadmapItem>>(MOCK_ITEMS);

	const filteredItems = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return items;
		return items.filter(
			(item) =>
				item.title.toLowerCase().includes(q) ||
				item.tags.some((tag) => tag.toLowerCase().includes(q))
		);
	}, [items, search]);

	return (
		<div className='flex flex-1 flex-col'>
			{/* Toolbar */}
			<div className='border-b'>
				<div className='container flex items-center justify-between gap-4 py-3'>
					{/* View toggle — left */}
					<div
						role='tablist'
						aria-label='Roadmap view'
						className='flex items-center gap-0.5 rounded-lg border bg-muted/70 p-1'
					>
						{VIEW_OPTIONS.map(({ mode, label, Icon: ViewIcon }) => (
							<button
								key={mode}
								role='tab'
								type='button'
								aria-selected={view === mode}
								onClick={() => setView(mode)}
								className={cn(
									'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
									view === mode
										? 'border border-border/60 bg-background text-foreground shadow-xs'
										: 'text-muted-foreground hover:text-foreground'
								)}
							>
								<ViewIcon className='size-3' />
								{label}
							</button>
						))}
					</div>

					{/* Search — right */}
					<div className='relative w-52'>
						<Search className='pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground' />
						<input
							type='search'
							aria-label='Search roadmap'
							placeholder='Search roadmap…'
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className='w-full rounded-md border bg-muted/50 py-1.5 pr-3 pl-8 text-xs transition-colors placeholder:text-muted-foreground/50 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none'
						/>
					</div>
				</div>
			</div>

			{/* View content */}
			{view === 'board' && <BoardView items={filteredItems} onStatusChange={setItems} />}
			{view === 'list' && <ListView items={filteredItems} />}
			{view === 'timeline' && <TimelineView items={filteredItems} />}
		</div>
	);
}
