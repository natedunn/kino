import type { ActivityKind } from '@/components/feed/activity-feed';

// Placeholder data for the global dashboard. These stand in until the backend
// exists:
//   - FEED_ITEMS → a real "merged published updates across the projects you
//     follow / are a member of" query (see update.ts `listByProject` for the
//     per-project shape to aggregate).
//   - KINO_NEWS → a real app-level news / announcements backend.
// The shapes are intentionally close to the eventual live data so wiring them up
// is a drop-in replacement.

export interface DashboardFeedItem {
	id: string;
	kind: ActivityKind;
	/** The org the activity is happening in — the subject of the row. */
	org: string;
	/** The thing that happened, e.g. an update title. */
	title: string;
	/** Who did it — shown below the org, not as the focus. */
	author: string;
	when: string;
	href?: string;
}

export const FEED_ITEMS: Array<DashboardFeedItem> = [
	{
		id: 'f1',
		kind: 'update_published',
		org: 'Kino',
		title: 'Roadmap timeline view is now live',
		author: 'Nate Dunn',
		when: '2h ago',
	},
	{
		id: 'f2',
		kind: 'update_published',
		org: 'Relay',
		title: 'Introducing GitHub issue sync',
		author: 'Priya Shah',
		when: '5h ago',
	},
	{
		id: 'f3',
		kind: 'update_published',
		org: 'Atlas',
		title: 'Weekly changelog — faster search',
		author: 'Marcus Lee',
		when: 'Yesterday',
	},
	{
		id: 'f4',
		kind: 'update_published',
		org: 'Kino',
		title: 'How we think about public roadmaps',
		author: 'Jordan Kim',
		when: '2d ago',
	},
	{
		id: 'f5',
		kind: 'update_published',
		org: 'Relay',
		title: 'v2.4 — bulk actions and keyboard shortcuts',
		author: 'Sam Rivera',
		when: '3d ago',
	},
];

export interface KinoNewsItem {
	id: string;
	title: string;
	/** Human date label, e.g. "Jul 15". */
	date: string;
	blurb: string;
	href?: string;
	tag?: string;
}

export const KINO_NEWS: Array<KinoNewsItem> = [
	{
		id: 'n1',
		title: 'Merged activity feed',
		date: 'Jul 18',
		blurb: 'Your dashboard now brings updates from all your projects into one place.',
		tag: 'New',
	},
	{
		id: 'n2',
		title: 'GitHub issue sync is in beta',
		date: 'Jul 10',
		blurb: 'Link feedback to GitHub issues and keep statuses in sync automatically.',
		tag: 'Beta',
	},
	{
		id: 'n3',
		title: 'Roadmap timeline view',
		date: 'Jun 30',
		blurb: 'Visualize what’s in progress and shipped across your public roadmap.',
	},
];
