import type { QueryClient } from '@tanstack/react-query';

import { notFound } from '@tanstack/react-router';

import { nativeFilesReads } from './files-api';

export async function preloadNativeFiles(
	client: QueryClient,
	params: { org: string; project: string; folderId?: string; fileId?: string },
	search: {
		cursor?: string;
		limit?: number;
		q?: string;
		category?: 'image' | 'video' | 'document' | 'text' | 'data' | 'package' | 'design';
		ext?: string;
		source?: string;
	} = {},
	advanced = false
) {
	const data = await client.ensureQueryData(
		nativeFilesReads.project.getDetails.queryOptions({ orgSlug: params.org, slug: params.project })
	);
	if (!data) throw notFound();
	const projectId = data.project.id;
	const reads = [nativeFilesReads.file.listFolders.queryOptions({ projectId })];
	const pending: Array<Promise<unknown>> = reads.map((options) =>
		typeof window === 'undefined' ? client.ensureQueryData(options) : client.prefetchQuery(options)
	);
	if (!advanced) {
		pending.push(
			client.prefetchQuery(nativeFilesReads.file.listFileTreeItems.queryOptions({ projectId }))
		);
		if (data.permissions.canManageContent)
			pending.push(
				client.prefetchQuery(nativeFilesReads.file.getProjectUsage.queryOptions({ projectId }))
			);
	}
	if (params.fileId) {
		const detail = await client.ensureQueryData(
			nativeFilesReads.file.getFileDetail.queryOptions({ projectId, assetId: params.fileId })
		);
		if (!detail) throw notFound();
	} else {
		const options = nativeFilesReads.file.listProjectFiles.queryOptions({
			projectId,
			folderId: advanced ? undefined : (params.folderId ?? null),
			cursor: search.cursor ?? null,
			limit: search.limit ?? 25,
			search: search.q,
			category: search.category,
			extension: search.ext,
			sourceProvider: search.source,
		});
		pending.push(
			typeof window === 'undefined'
				? client.ensureQueryData(options)
				: client.prefetchQuery(options)
		);
	}
	if (typeof window === 'undefined') await Promise.all(pending);
	else void Promise.all(pending);
}
