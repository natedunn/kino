import { SectionCard } from '@/components/section-card';
import { Badge } from '@/components/ui/badge';
import Sparkle from '@/icons/sparkle';

import { KINO_NEWS } from './dashboard-mock-data';

// Sidebar card of app-level Kino news / announcements. Placeholder content until
// a real news backend exists; the row layout matches the overview "Latest
// updates" list so it can swap to live data cleanly.
export function KinoNews() {
	return (
		<SectionCard title='Kino news' Icon={Sparkle} bodyClassName='p-0'>
			<ul className='divide-y'>
				{KINO_NEWS.map((item) => (
					<li
						key={item.id}
						className='flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-muted/40'
					>
						<div className='flex items-start justify-between gap-2'>
							<p className='text-sm font-medium'>{item.title}</p>
							{item.tag ? (
								<Badge variant='secondary' className='shrink-0 text-[10px]'>
									{item.tag}
								</Badge>
							) : null}
						</div>
						<p className='text-xs leading-relaxed text-muted-foreground'>{item.blurb}</p>
						<span className='text-xs text-muted-foreground/70'>{item.date}</span>
					</li>
				))}
			</ul>
		</SectionCard>
	);
}
