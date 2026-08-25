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
		ORG_UPLOADS: bucket,
	} satisfies Env;
}

function installEmptyCache() {
	const put = vi.fn(async () => undefined);
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
	Reflect.deleteProperty(globalThis, 'caches');
});

describe('Kino Files Worker', () => {
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
