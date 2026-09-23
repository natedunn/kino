import { afterEach, describe, expect, it, vi } from 'vitest';

import worker from './index';

const PUBLIC_ID = '0123456789abcdef0123456789abcdef';

function executionContext() {
	const ctx = Object.create(null) as ExecutionContext;
	ctx.passThroughOnException = vi.fn();
	ctx.waitUntil = vi.fn();
	return ctx;
}

function objectBody(contentType = 'image/png', range?: R2Range) {
	const bytes = new TextEncoder().encode('file-body');
	return {
		body: new ReadableStream({
			start(controller) {
				controller.enqueue(bytes);
				controller.close();
			},
		}),
		bodyUsed: false,
		checksums: {},
		customMetadata: {},
		etag: 'etag-value',
		httpEtag: '"etag-value"',
		httpMetadata: { contentType },
		key: `PUBLIC_FILE.${PUBLIC_ID}`,
		range,
		size: bytes.byteLength,
		storageClass: 'Standard',
		uploaded: new Date('2026-08-14T00:00:00.000Z'),
		version: '1',
		writeHttpMetadata(headers: Headers) {
			headers.set('content-type', contentType);
		},
	} as R2ObjectBody;
}

function environment(get: (key: string) => Promise<R2ObjectBody | null>) {
	const bucket = Object.create(null) as R2Bucket;
	bucket.get = get;
	bucket.head = vi.fn(async () => null);
	return {
		NATIVE_CONVEX_URL: '',
		ORG_UPLOADS: bucket,
	} satisfies Env;
}

function installEmptyCache() {
	const put = vi.fn(async (_request: RequestInfo | URL, _response: Response) => undefined);
	const cache = Object.create(null) as Cache;
	cache.match = vi.fn(async () => undefined);
	cache.put = put;
	const storage = Object.create(null) as CacheStorage;
	Object.defineProperty(storage, 'default', { value: cache });
	Object.defineProperty(globalThis, 'caches', {
		configurable: true,
		value: storage,
	});
	return put;
}

afterEach(() => {
	vi.unstubAllGlobals();
	Reflect.deleteProperty(globalThis, 'caches');
});

describe('Kino Files Worker', () => {
	it('native delivery authorizes before cache hits and fails closed on revoked access', async () => {
		installEmptyCache();
		const env = {
			...environment(async () => objectBody()),
			NATIVE_CONVEX_URL: 'https://native.convex.cloud',
		};
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ status: 'success', value: { name: 'actual.png', thumbnail: true } })
				)
			)
			.mockResolvedValueOnce(new Response(JSON.stringify({ status: 'success', value: null })));
		vi.stubGlobal('fetch', fetcher);
		const request: Parameters<typeof worker.fetch>[0] = new Request(
			`https://files.example/${PUBLIC_ID}/requested.png`
		);
		const allowed = await worker.fetch(request, env, executionContext());
		expect(allowed.status).toBe(200);
		expect(allowed.headers.get('cache-control')).toBe('no-store');
		expect(allowed.headers.get('content-disposition')).toContain('actual.png');
		const denied = await worker.fetch(request, env, executionContext());
		expect(denied.status).toBe(404);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});
	it('serves a no-store health response without touching R2', async () => {
		const response = await worker.fetch(
			new Request('https://files.usekino.com/health'),
			environment(async () => null),
			executionContext()
		);

		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({ ok: true, service: 'kino-files' });
	});

	it('rejects malformed and non-public identifiers before reading R2', async () => {
		const get = vi.fn(async () => null);
		const response = await worker.fetch(
			new Request('https://files.usekino.com/not-a-public-id/private.png'),
			environment(get),
			executionContext()
		);

		expect(response.status).toBe(404);
		expect(get).not.toHaveBeenCalled();
	});

	it('maps a clean URL only to the deterministic public object namespace', async () => {
		installEmptyCache();
		const get = vi.fn(async () => objectBody());
		const ctx = executionContext();
		const response = await worker.fetch(
			new Request(`https://files.usekino.com/${PUBLIC_ID}/header.png`),
			environment(get),
			ctx
		);

		expect(get).toHaveBeenCalledWith(`PUBLIC_FILE.${PUBLIC_ID}`, expect.any(Object));
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('image/png');
		expect(response.headers.get('content-disposition')).toContain('inline');
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
	});

	it('returns a full response when R2 supplies range metadata without a Range request', async () => {
		const put = installEmptyCache();
		const response = await worker.fetch(
			new Request(`https://files.usekino.com/${PUBLIC_ID}/full.png`),
			environment(async () => objectBody('image/png', { offset: 0, length: 9 })),
			executionContext()
		);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-range')).toBeNull();
		expect(response.headers.get('content-length')).toBe('9');
		expect(put).toHaveBeenCalledOnce();
	});

	it('forces unsafe formats to download and never trusts the URL extension', async () => {
		installEmptyCache();
		const response = await worker.fetch(
			new Request(`https://files.usekino.com/${PUBLIC_ID}/looks-safe.png`),
			environment(async () => objectBody('image/svg+xml')),
			executionContext()
		);

		expect(response.headers.get('content-type')).toBe('image/svg+xml');
		expect(response.headers.get('content-disposition')).toContain('attachment');
	});

	it('uses a separate deterministic thumbnail namespace', async () => {
		installEmptyCache();
		const get = vi.fn(async () => objectBody('image/webp'));
		await worker.fetch(
			new Request(`https://files.usekino.com/${PUBLIC_ID}/thumb-128.webp`),
			environment(get),
			executionContext()
		);

		expect(get).toHaveBeenCalledWith(`PUBLIC_FILE_THUMBNAIL.${PUBLIC_ID}.webp`, expect.any(Object));
	});

	it('tags every original and thumbnail URL variant for one global asset purge', async () => {
		const cachePut = installEmptyCache();
		const ctx = executionContext();
		for (const url of [
			`https://files.usekino.com/${PUBLIC_ID}/one.png`,
			`https://files.usekino.com/${PUBLIC_ID}/renamed.png?download=1`,
			`https://files.usekino.com/${PUBLIC_ID}/thumb-128.webp`,
		]) {
			await worker.fetch(
				new Request(url),
				environment(async () => objectBody()),
				ctx
			);
		}
		expect(cachePut).toHaveBeenCalledTimes(3);
		for (const [, response] of cachePut.mock.calls)
			expect(response.headers.get('cache-tag')).toBe(`kino-file-${PUBLIC_ID}`);
	});

	it('does not expose the internal purge tag on a cached response', async () => {
		const cache = Object.create(null) as Cache;
		cache.match = vi.fn(
			async () => new Response('cached', { headers: { 'Cache-Tag': `kino-file-${PUBLIC_ID}` } })
		);
		cache.put = vi.fn(async () => undefined);
		const storage = Object.create(null) as CacheStorage;
		Object.defineProperty(storage, 'default', { value: cache });
		Object.defineProperty(globalThis, 'caches', { configurable: true, value: storage });
		const response = await worker.fetch(
			new Request(`https://files.usekino.com/${PUBLIC_ID}/cached.png`),
			environment(async () => null),
			executionContext()
		);
		expect(await response.text()).toBe('cached');
		expect(response.headers.get('cache-tag')).toBeNull();
	});

	it('returns byte-range metadata for media seeking', async () => {
		installEmptyCache();
		const response = await worker.fetch(
			new Request(`https://files.usekino.com/${PUBLIC_ID}/clip.mp4`, {
				headers: { Range: 'bytes=2-4' },
			}),
			environment(async () => objectBody('video/mp4', { length: 3, offset: 2 })),
			executionContext()
		);

		expect(response.status).toBe(206);
		expect(response.headers.get('content-range')).toBe('bytes 2-4/9');
		expect(response.headers.get('content-length')).toBe('3');
	});
});
