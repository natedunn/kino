import { FORM_LIMITS } from '@/lib/validation';

export type ForumSort = 'activity' | 'newest' | 'replies' | 'top';
export type ForumFilter = 'unanswered' | 'mine' | 'following';
/** How far back "Top" looks, by topic creation. */
export type ForumPeriod = 'week' | 'month' | 'year' | 'all';

export const DEFAULT_PERIOD: ForumPeriod = 'month';

export type ForumSearch = {
	/** Category slug; absent means "All". */
	category?: string;
	filter?: ForumFilter;
	search?: string;
	/** Absent means the default, latest activity. */
	sort?: Exclude<ForumSort, 'activity'>;
	/** Only with `sort: 'top'`; absent means DEFAULT_PERIOD. */
	period?: ForumPeriod;
};

const FILTERS = new Set<string>(['unanswered', 'mine', 'following']);
const SORTS = new Set<string>(['newest', 'replies', 'top']);
const PERIODS = new Set<string>(['week', 'month', 'year', 'all']);

const HOUR = 60 * 60 * 1000;
const PERIOD_LENGTH: Record<Exclude<ForumPeriod, 'all'>, number> = {
	week: 7 * 24 * HOUR,
	month: 30 * 24 * HOUR,
	year: 365 * 24 * HOUR,
};

/**
 * The creation-time cutoff "Top" sends for a period, or undefined for all
 * time. Rounded down to the hour so the paginated query's args stay stable.
 */
export function periodStart(period: ForumPeriod, now: number) {
	if (period === 'all') return undefined;
	return Math.floor((now - PERIOD_LENGTH[period]) / HOUR) * HOUR;
}

function optionalString(value: unknown) {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed === '' ? undefined : trimmed;
}

export function validateForumSearch(search: Record<string, unknown>): ForumSearch {
	const category = optionalString(search.category);
	const filter = optionalString(search.filter);
	const query = optionalString(search.search);
	const sort = optionalString(search.sort);
	const period = optionalString(search.period);
	return {
		...(category ? { category } : {}),
		...(filter && FILTERS.has(filter) ? { filter: filter as ForumFilter } : {}),
		...(query ? { search: query.slice(0, FORM_LIMITS.forumSearch) } : {}),
		...(sort && SORTS.has(sort) ? { sort: sort as Exclude<ForumSort, 'activity'> } : {}),
		...(sort === 'top' && period && PERIODS.has(period) ? { period: period as ForumPeriod } : {}),
	};
}

// Switching category keeps search/sort/filter, except "Unanswered", which only
// applies to Q&A categories.
export function withCategory(
	prev: ForumSearch,
	category: { slug: string | undefined; format: 'open' | 'qa' | undefined }
): ForumSearch {
	return {
		...prev,
		category: category.slug,
		filter: prev.filter === 'unanswered' && category.format !== 'qa' ? undefined : prev.filter,
	};
}
