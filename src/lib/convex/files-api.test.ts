import { QueryClient } from '@tanstack/react-query';
import { expect, test, vi } from 'vitest';

import { nativeFilesReads } from './files-api';

test('Files SSR options retain the request-scoped default query function', async () => {
	const expected = [{ id: 'folder', name: 'Work' }];
	const queryFn = vi.fn(async () => expected);
	const client = new QueryClient({ defaultOptions: { queries: { queryFn, retry: false } } });
	const result = await client.ensureQueryData(
		nativeFilesReads.file.listFolders.queryOptions({ projectId: 'project' })
	);
	expect(result).toEqual(expected);
	expect(queryFn).toHaveBeenCalledTimes(1);
	client.clear();
});
