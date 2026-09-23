import type { Icon as IconType } from '@/icons/types';

import CalendarDays from '@/icons/calendar-days';
import Megaphone from '@/icons/megaphone';
import Pen from '@/icons/pen';
import * as m from '@/paraglide/messages.js';

type UpdateCategory = 'changelog' | 'article' | 'announcement';

export const UPDATE_CATEGORY_CONFIG: Record<
	UpdateCategory,
	{ label: () => string; Icon: IconType; colorClass: string }
> = {
	changelog: {
		label: m.updates_changelog,
		Icon: CalendarDays,
		colorClass: 'text-emerald-500 dark:text-emerald-400',
	},
	article: {
		label: m.updates_article,
		Icon: Pen,
		colorClass: 'text-blue-500 dark:text-blue-400',
	},
	announcement: {
		label: m.updates_announcement,
		Icon: Megaphone,
		colorClass: 'text-violet-500 dark:text-violet-400',
	},
};
