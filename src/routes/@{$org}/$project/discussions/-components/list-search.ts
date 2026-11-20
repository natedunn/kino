import { FORM_LIMITS } from '@/lib/validation';

export type DiscussionsSort = 'activity' | 'newest' | 'replies';
export type DiscussionsFilter = 'unanswered' | 'mine' | 'following';

export type DiscussionsSearch = {
	/** Category slug; absent means "All". */
	category?: string;
	filter?: DiscussionsFilter;
	search?: string;
	/** Absent means the default, latest activity. */
	sort?: Exclude<DiscussionsSort, 'activity'>;
};

const FILTERS = new Set<string>(['unanswered', 'mine', 'following']);

function optionalString(value: unknown) {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed === '' ? undefined : trimmed;
}

export function validateDiscussionsSearch(search: Record<string, unknown>): DiscussionsSearch {
	const category = optionalString(search.category);
	const filter = optionalString(search.filter);
	const query = optionalString(search.search);
	const sort = optionalString(search.sort);
	return {
		...(category ? { category } : {}),
		...(filter && FILTERS.has(filter) ? { filter: filter as DiscussionsFilter } : {}),
		...(query ? { search: query.slice(0, FORM_LIMITS.discussionSearch) } : {}),
		...(sort === 'newest' || sort === 'replies' ? { sort } : {}),
	};
}

// Switching category keeps search/sort/filter, except "Unanswered", which only
// applies to Q&A categories.
export function withCategory(
	prev: DiscussionsSearch,
	category: { slug: string | undefined; format: 'open' | 'qa' | undefined }
): DiscussionsSearch {
	return {
		...prev,
		category: category.slug,
		filter: prev.filter === 'unanswered' && category.format !== 'qa' ? undefined : prev.filter,
	};
}
