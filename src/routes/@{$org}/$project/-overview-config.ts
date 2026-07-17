import type { Icon as IconType } from '@/icons/types';
import type { UpdateCategory } from './-overview-types';

import CalendarDays from '@/icons/calendar-days';
import Megaphone from '@/icons/megaphone';
import Pen from '@/icons/pen';

export const UPDATE_CATEGORY_CONFIG: Record<
	UpdateCategory,
	{ label: string; Icon: IconType; colorClass: string }
> = {
	changelog: {
		label: 'Changelog',
		Icon: CalendarDays,
		colorClass: 'text-emerald-500 dark:text-emerald-400',
	},
	article: {
		label: 'Article',
		Icon: Pen,
		colorClass: 'text-blue-500 dark:text-blue-400',
	},
	announcement: {
		label: 'Announcement',
		Icon: Megaphone,
		colorClass: 'text-violet-500 dark:text-violet-400',
	},
};
