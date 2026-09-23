import type { QueryFunctionContext } from '@tanstack/react-query';

import { QueryClient } from '@tanstack/react-query';
import { expect, test, vi } from 'vitest';

import { nativeUpdatesReads } from './updates-api';

test('native update search maps command-palette input to the paginated Convex query', async () => {
	const expected = { page: [], continueCursor: '', isDone: true };
	const queryFn = vi.fn(async (_context: QueryFunctionContext) => expected);
	const client = new QueryClient({ defaultOptions: { queries: { queryFn, retry: false } } });

	const result = await client.ensureQueryData(
		nativeUpdatesReads.update.searchProject.queryOptions({
			category: undefined,
			cursor: null,
			limit: 10,
			projectId: 'project',
			search: 'release',
		})
	);

	expect(result).toEqual(expected);
	expect(queryFn).toHaveBeenCalledOnce();
	const [context] = queryFn.mock.calls[0]!;
	expect(context.queryKey).toEqual([
		'convexQuery',
		'updatesWorkspace:list',
		{
			projectId: 'project',
			category: undefined,
			search: 'release',
			paginationOpts: { cursor: null, numItems: 10 },
		},
	]);
	client.clear();
});
