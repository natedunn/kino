import type { RoadmapStatus, StatusConfig } from './-types';

import CircleCheck from '@/icons/circle-check';
import CircleDot from '@/icons/circle-dot';
import CirclePlay from '@/icons/circle-play';
import HourglassStart from '@/icons/hourglass-start';

export const STATUS_CONFIG: Record<RoadmapStatus, StatusConfig> = {
	backlog: {
		label: 'Backlog',
		Icon: CircleDot,
		colorClass: 'text-blue-500 dark:text-blue-400',
		bgClass: 'bg-blue-50 dark:bg-blue-500/10',
		borderClass: 'border-blue-200 dark:border-blue-900',
		leftBorderClass: 'border-l-blue-400 dark:border-l-blue-500',
	},
	planned: {
		label: 'Planned',
		Icon: HourglassStart,
		colorClass: 'text-amber-500 dark:text-amber-400',
		bgClass: 'bg-amber-50 dark:bg-amber-500/10',
		borderClass: 'border-amber-200 dark:border-amber-900',
		leftBorderClass: 'border-l-amber-400 dark:border-l-amber-500',
	},
	'in-progress': {
		label: 'In Progress',
		Icon: CirclePlay,
		colorClass: 'text-violet-500 dark:text-violet-400',
		bgClass: 'bg-violet-50 dark:bg-violet-500/10',
		borderClass: 'border-violet-200 dark:border-violet-900',
		leftBorderClass: 'border-l-violet-400 dark:border-l-violet-500',
	},
	released: {
		label: 'Released',
		Icon: CircleCheck,
		colorClass: 'text-emerald-500 dark:text-emerald-400',
		bgClass: 'bg-emerald-50 dark:bg-emerald-500/10',
		borderClass: 'border-emerald-200 dark:border-emerald-900',
		leftBorderClass: 'border-l-emerald-400 dark:border-l-emerald-500',
	},
};

export const STATUSES: Array<RoadmapStatus> = ['backlog', 'planned', 'in-progress', 'released'];

export const LIST_ORDER: Array<RoadmapStatus> = ['in-progress', 'planned', 'backlog', 'released'];

// TODO: derive QUARTERS and CURRENT_QUARTER from real data when wired to backend
export const QUARTERS = ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'];
export const CURRENT_QUARTER = 'Q2 2026';
