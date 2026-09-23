import type { OptimisticLocalStore } from 'convex/browser';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';

import { api } from '../../../convex/native/_generated/api';

type Entry = FunctionReturnType<typeof api.updates.featured>[number];
export function optimisticUpdateHeart(
	store: OptimisticLocalStore,
	args: FunctionArgs<typeof api.updates.toggleReaction>
) {
	if (args.commentId || args.content !== 'heart') return;
	const toggle = <T extends Entry>(entry: T): T =>
		entry.update._id === args.updateId
			? {
					...entry,
					liked: !entry.liked,
					update: {
						...entry.update,
						heartCount: Math.max(0, entry.update.heartCount + (entry.liked ? -1 : 1)),
					},
				}
			: entry;
	for (const query of store.getAllQueries(api.updates.detail))
		if (query.value) store.setQuery(api.updates.detail, query.args, toggle(query.value));
	for (const query of store.getAllQueries(api.updates.list))
		if (query.value)
			store.setQuery(api.updates.list, query.args, {
				...query.value,
				page: query.value.page.map(toggle),
			});
	for (const query of store.getAllQueries(api.updates.featured))
		if (query.value) store.setQuery(api.updates.featured, query.args, query.value.map(toggle));
}
