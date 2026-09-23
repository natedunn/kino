import type { OptimisticLocalStore } from 'convex/browser';
import type { Id } from '../../../convex/native/_generated/dataModel';

import { describe, expect, it, vi } from 'vitest';

import { optimisticallyToggleFeedbackUpvote } from './native-feedback-optimistic';

describe('native feedback optimistic upvote', () => {
	it('updates matching detail and paginated list snapshots immutably', () => {
		const feedbackId = 'feedback-1' as Id<'feedback'>;
		const otherId = 'feedback-2' as Id<'feedback'>;
		const detailArgs = { projectId: 'project-1', slug: 'one' };
		const listArgs = {
			projectId: 'project-1',
			paginationOpts: { cursor: null, numItems: 50 },
		};
		const detail = {
			feedback: { id: feedbackId, upvotes: 4 },
			hasUpvoted: false,
		};
		const list = {
			continueCursor: '',
			isDone: true,
			page: [
				{ id: feedbackId, hasUpvoted: false, upvotes: 4 },
				{ id: otherId, hasUpvoted: true, upvotes: 2 },
			],
		};
		const setQuery = vi.fn();
		const store = {
			getAllQueries: vi
				.fn()
				.mockReturnValueOnce([{ args: detailArgs, value: detail }])
				.mockReturnValueOnce([{ args: listArgs, value: list }]),
			setQuery,
		} as unknown as OptimisticLocalStore;

		optimisticallyToggleFeedbackUpvote(store, { feedbackId });

		expect(setQuery).toHaveBeenCalledTimes(2);
		expect(setQuery.mock.calls[0][2]).toMatchObject({
			feedback: { id: feedbackId, upvotes: 5 },
			hasUpvoted: true,
		});
		expect(setQuery.mock.calls[1][2].page).toEqual([
			{ id: feedbackId, hasUpvoted: true, upvotes: 5 },
			{ id: otherId, hasUpvoted: true, upvotes: 2 },
		]);
		expect(detail).toMatchObject({ feedback: { upvotes: 4 }, hasUpvoted: false });
		expect(list.page[0]).toMatchObject({ upvotes: 4, hasUpvoted: false });
	});

	it('never makes an optimistic count negative', () => {
		const feedbackId = 'feedback-1' as Id<'feedback'>;
		const setQuery = vi.fn();
		const store = {
			getAllQueries: vi
				.fn()
				.mockReturnValueOnce([
					{
						args: { projectId: 'project-1', slug: 'one' },
						value: { feedback: { id: feedbackId, upvotes: 0 }, hasUpvoted: true },
					},
				])
				.mockReturnValueOnce([]),
			setQuery,
		} as unknown as OptimisticLocalStore;

		optimisticallyToggleFeedbackUpvote(store, { feedbackId });

		expect(setQuery.mock.calls[0][2]).toMatchObject({
			feedback: { upvotes: 0 },
			hasUpvoted: false,
		});
	});
});
