import { createFileRoute } from '@tanstack/react-router';
import { LayoutGrid, List, Milestone, Search } from 'lucide-react';

import { projectTitle, titleMeta } from '@/lib/seo';
import * as m from '@/paraglide/messages.js';

export const Route = createFileRoute('/@{$org}/$project/roadmap/')({
	head: ({ params }) => ({
		meta: [titleMeta([m.project_nav_roadmap(), projectTitle(params.org, params.project)])],
	}),
	component: RoadmapPage,
});

const VIEW_OPTIONS = [
	{ label: m.roadmap_view_board, Icon: LayoutGrid },
	{ label: m.roadmap_view_list, Icon: List },
	{ label: m.roadmap_view_timeline, Icon: Milestone },
] as const;

function RoadmapPage() {
	return (
		<div className='flex flex-1 flex-col'>
			<div className='border-b'>
				<div className='container flex items-center justify-between gap-4 py-3'>
					<div
						aria-label={m.roadmap_view_label()}
						className='flex items-center gap-0.5 rounded-lg border bg-muted/70 p-1'
					>
						{VIEW_OPTIONS.map(({ label, Icon: ViewIcon }, index) => (
							<button
								key={index}
								type='button'
								disabled
								className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
									index === 0
										? 'border border-border/60 bg-background text-foreground shadow-xs'
										: 'text-muted-foreground'
								}`}
							>
								<ViewIcon className='size-3' />
								{label()}
							</button>
						))}
					</div>

					<div className='relative w-52'>
						<Search className='pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground' />
						<input
							type='search'
							aria-label={m.roadmap_search_label()}
							placeholder={m.roadmap_search_placeholder()}
							disabled
							className='w-full rounded-md border bg-muted/50 py-1.5 pr-3 pl-8 text-xs placeholder:text-muted-foreground/50'
						/>
					</div>
				</div>
			</div>

			<div className='container py-6'>
				<div className='rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center'>
					<Milestone aria-hidden='true' className='mx-auto size-8 text-muted-foreground' />
					<h1 className='mt-4 text-base font-semibold'>{m.roadmap_unavailable_title()}</h1>
					<p className='mt-1 text-sm text-muted-foreground'>
						{m.roadmap_unavailable_description()}
					</p>
				</div>
			</div>
		</div>
	);
}
