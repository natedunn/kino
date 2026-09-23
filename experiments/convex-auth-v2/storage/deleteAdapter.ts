export interface DeleteBucket {
	delete(keys: string[]): Promise<void>;
}

export interface DeleteAdapterEnvironment {
	ORG_UPLOADS: DeleteBucket;
	CLOUDFLARE_ZONE_ID: string;
	CLOUDFLARE_API_TOKEN: string;
}

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function deleteObjectsAndPurgeTag(
	env: DeleteAdapterEnvironment,
	request: { keys: string[]; cacheTag: string },
	fetcher: FetchLike = fetch
) {
	if (!request.keys.length || request.keys.length > 1000) throw new Error('INVALID_KEY_COUNT');
	if (
		request.keys.some(
			(key) =>
				!key.startsWith('proof/') &&
				!key.startsWith('proof-staging/') &&
				!key.startsWith('STAGING.') &&
				!key.startsWith('PRIVATE.') &&
				!key.startsWith('PUBLIC_FILE.') &&
				!key.startsWith('PUBLIC_FILE_THUMBNAIL.')
		)
	)
		throw new Error('INVALID_OBJECT_KEY');
	if (!/^kino-file-[a-z0-9]+$/i.test(request.cacheTag)) throw new Error('INVALID_CACHE_TAG');
	await env.ORG_UPLOADS.delete(request.keys);
	const response = await fetcher(
		`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(env.CLOUDFLARE_ZONE_ID)}/purge_cache`,
		{
			method: 'POST',
			headers: {
				authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify({ tags: [request.cacheTag] }),
		}
	);
	if (!response.ok) throw new Error('CACHE_PURGE_FAILED');
}
