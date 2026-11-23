import { describe, expect, it } from 'vitest';

import { periodStart, validateForumSearch } from './list-search';

const HOUR = 60 * 60 * 1000;

describe('forum list search', () => {
	it('keeps a period only alongside the Top sort', () => {
		expect(validateForumSearch({ sort: 'top', period: 'week' })).toEqual({
			sort: 'top',
			period: 'week',
		});
		expect(validateForumSearch({ sort: 'top', period: 'decade' })).toEqual({ sort: 'top' });
		expect(validateForumSearch({ sort: 'newest', period: 'week' })).toEqual({ sort: 'newest' });
		expect(validateForumSearch({ sort: 'activity' })).toEqual({});
	});

	it('rounds the window start down to the hour', () => {
		const now = Date.UTC(2026, 10, 23, 15, 42, 7);
		expect(periodStart('all', now)).toBeUndefined();
		expect(periodStart('week', now)).toBe(Date.UTC(2026, 10, 16, 15));
		expect(periodStart('month', now)! % HOUR).toBe(0);
		expect(periodStart('month', now + 10 * 60 * 1000)).toBe(periodStart('month', now));
	});
});
