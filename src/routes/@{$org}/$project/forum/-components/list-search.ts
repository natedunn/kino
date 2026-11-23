import { FORM_LIMITS } from '@/lib/validation';

export type ForumSort = 'activity' | 'newest' | 'replies';
export type ForumFilter = 'unanswered' | 'mine' | 'following';

export type ForumSearch = {
	/** Category slug; absent means "All". */
	category?: string;
	filter?: ForumFilter;
	search?: string;
	/** Absent means the default, latest activity. */
	sort?: Exclude<ForumSort, 'activity'>;
};

const FILTERS = new Set<string>(['unanswered', 'mine', 'following']);

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
	return {
		...(category ? { category } : {}),
		...(filter && FILTERS.has(filter) ? { filter: filter as ForumFilter } : {}),
		...(query ? { search: query.slice(0, FORM_LIMITS.forumSearch) } : {}),
		...(sort === 'newest' || sort === 'replies' ? { sort } : {}),
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
