import type { OptimisticLocalStore } from 'convex/browser';
import type { Id } from '../../../convex/native/_generated/dataModel';

import { api as nativeApi } from '../../../convex/native/_generated/api';

export function optimisticallyToggleFeedbackUpvote(
	localStore: OptimisticLocalStore,
	args: { feedbackId: Id<'feedback'> }
) {
	for (const query of localStore.getAllQueries(nativeApi.feedback.getDetail)) {
		const current = query.value;
		if (!current || current.feedback.id !== args.feedbackId) continue;
		const hasUpvoted = !current.hasUpvoted;
		localStore.setQuery(nativeApi.feedback.getDetail, query.args, {
			...current,
			feedback: {
				...current.feedback,
				upvotes: Math.max(0, current.feedback.upvotes + (hasUpvoted ? 1 : -1)),
			},
			hasUpvoted,
		});
	}

	for (const query of localStore.getAllQueries(nativeApi.feedback.list)) {
		const current = query.value;
		if (!current) continue;
		localStore.setQuery(nativeApi.feedback.list, query.args, {
			...current,
			page: current.page.map((item) => {
				if (item.id !== args.feedbackId) return item;
				const hasUpvoted = !item.hasUpvoted;
				return {
					...item,
					hasUpvoted,
					upvotes: Math.max(0, item.upvotes + (hasUpvoted ? 1 : -1)),
				};
			}),
		});
	}
}
