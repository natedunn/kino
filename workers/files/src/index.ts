const PUBLIC_ID_PATTERN = /^[a-f0-9]{32}$/;
const ORIGINAL_KEY_PREFIX = 'PUBLIC_FILE.';
const THUMBNAIL_KEY_PREFIX = 'PUBLIC_FILE_THUMBNAIL.';
const THUMBNAIL_NAME = 'thumb-128.webp';
const CACHE_CONTROL = 'public, max-age=300, s-maxage=3600';
const CACHE_TAG_PREFIX = 'kino-file-';

const INLINE_MIME_TYPES = new Set([
	'application/pdf',
	'image/avif',
	'image/gif',
	'image/jpeg',
	'image/png',
	'image/webp',
	'text/csv',
	'text/markdown',
	'text/plain',
	'video/mp4',
	'video/webm',
]);

type ParsedAssetRequest = {
	filename: string;
	key: string;
	publicId: string;
	variant: 'original' | 'thumbnail';
};

function jsonResponse(body: Record<string, unknown>, status: number, headers?: HeadersInit) {
	return new Response(JSON.stringify(body), {
		headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
		status,
	});
}

function parseAssetRequest(url: URL): ParsedAssetRequest | null {
	const segments = url.pathname.split('/').filter(Boolean);
	if (segments.length !== 2) return null;

	const [publicId, encodedFilename] = segments;
	if (!publicId || !PUBLIC_ID_PATTERN.test(publicId) || !encodedFilename) return null;

	let filename: string;
	try {
		filename = decodeURIComponent(encodedFilename);
	} catch {
		return null;
	}
	if (!filename || filename.length > 255 || /[\\/\0\r\n]/.test(filename)) return null;

	const variant = filename === THUMBNAIL_NAME ? 'thumbnail' : 'original';
	return {
		filename,
		key:
			variant === 'thumbnail'
				? `${THUMBNAIL_KEY_PREFIX}${publicId}.webp`
				: `${ORIGINAL_KEY_PREFIX}${publicId}`,
		publicId,
		variant,
	};
}

function safeAsciiFilename(filename: string) {
	const ascii = filename
		.normalize('NFKD')
		.replace(/[^\x20-\x7e]/g, '')
		.replace(/["\\]/g, '_')
		.trim();
	return ascii || 'download';
}

function contentDisposition(filename: string, contentType: string, forceDownload: boolean) {
	const mode =
		!forceDownload && INLINE_MIME_TYPES.has(contentType.toLowerCase()) ? 'inline' : 'attachment';
	return `${mode}; filename="${safeAsciiFilename(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function applyObjectHeaders(
	headers: Headers,
	object: R2Object,
	asset: ParsedAssetRequest,
	forceDownload: boolean
) {
	object.writeHttpMetadata(headers);
	const contentType =
		asset.variant === 'thumbnail'
			? 'image/webp'
			: (object.httpMetadata?.contentType ?? 'application/octet-stream');
	headers.set('Accept-Ranges', 'bytes');
	headers.set('Access-Control-Allow-Origin', '*');
	headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, ETag');
	headers.set('Cache-Control', CACHE_CONTROL);
	headers.set(
		'Content-Disposition',
		contentDisposition(asset.filename, contentType, forceDownload)
	);
	headers.set('Content-Type', contentType);
	headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
	headers.set('ETag', object.httpEtag);
	headers.set('Last-Modified', object.uploaded.toUTCString());
	headers.set('Referrer-Policy', 'no-referrer');
	headers.set('X-Content-Type-Options', 'nosniff');
	return headers;
}

function rangeHeaders(headers: Headers, object: R2ObjectBody, requestedRange: boolean) {
	if (
		!requestedRange ||
		!object.range ||
		!('offset' in object.range) ||
		object.range.offset === undefined
	) {
		headers.set('Content-Length', String(object.size));
		return 200;
	}
	const length = object.range.length ?? object.size - object.range.offset;
	const end = Math.min(object.size - 1, object.range.offset + length - 1);
	headers.set('Content-Length', String(Math.max(0, end - object.range.offset + 1)));
	headers.set('Content-Range', `bytes ${object.range.offset}-${end}/${object.size}`);
	return 206;
}

async function serveHead(request: Request, env: Env, asset: ParsedAssetRequest) {
	const object = await env.ORG_UPLOADS.head(asset.key);
	if (!object) return jsonResponse({ error: 'not_found' }, 404, { 'cache-control': 'no-store' });
	const headers = applyObjectHeaders(
		new Headers(),
		object,
		asset,
		new URL(request.url).searchParams.get('download') === '1'
	);
	headers.set('Content-Length', String(object.size));
	return new Response(null, { headers, status: 200 });
}

async function serveGet(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
	asset: ParsedAssetRequest
) {
	const cache = caches.default;
	const cacheRequest = new Request(request.url, { headers: request.headers, method: 'GET' });
	const cached = await cache.match(cacheRequest);
	if (cached) {
		const response = new Response(cached.body, cached);
		response.headers.delete('Cache-Tag');
		return response;
	}

	let object: R2ObjectBody | R2Object | null;
	try {
		object = await env.ORG_UPLOADS.get(asset.key, {
			onlyIf: request.headers,
			range: request.headers,
		});
	} catch (error) {
		console.warn(JSON.stringify({ event: 'files_r2_read_failed', key: asset.key, error }));
		return jsonResponse({ error: 'invalid_range' }, 416, { 'cache-control': 'no-store' });
	}
	if (!object) return jsonResponse({ error: 'not_found' }, 404, { 'cache-control': 'no-store' });

	const headers = applyObjectHeaders(
		new Headers(),
		object,
		asset,
		new URL(request.url).searchParams.get('download') === '1'
	);
	if (!('body' in object)) {
		const notModified =
			request.headers.has('if-none-match') || request.headers.has('if-modified-since');
		return new Response(null, { headers, status: notModified ? 304 : 412 });
	}

	const status = rangeHeaders(headers, object, request.headers.has('range'));
	const response = new Response(object.body, { headers, status });
	if (status === 200 && !request.headers.has('range')) {
		const cacheResponse = response.clone();
		cacheResponse.headers.set('Cache-Tag', `${CACHE_TAG_PREFIX}${asset.publicId}`);
		ctx.waitUntil(cache.put(new Request(request.url), cacheResponse));
	}
	return response;
}

async function handleRequest(request: Request, env: Env, ctx: ExecutionContext) {
	const url = new URL(request.url);
	if (url.pathname === '/health') {
		return jsonResponse({ ok: true, service: 'kino-files' }, 200, {
			'cache-control': 'no-store',
		});
	}
	if (request.method === 'OPTIONS') {
		return new Response(null, {
			headers: {
				'Access-Control-Allow-Headers': 'If-Modified-Since, If-None-Match, Range',
				'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Max-Age': '86400',
			},
			status: 204,
		});
	}
	if (request.method !== 'GET' && request.method !== 'HEAD') {
		return jsonResponse({ error: 'method_not_allowed' }, 405, {
			allow: 'GET, HEAD, OPTIONS',
			'cache-control': 'no-store',
		});
	}

	const asset = parseAssetRequest(url);
	if (!asset) return jsonResponse({ error: 'not_found' }, 404, { 'cache-control': 'no-store' });
	if (env.NATIVE_CONVEX_URL) {
		// Authorize before even consulting the edge cache. A visibility change or
		// deletion must revoke a formerly public URL on the next request.
		try {
			const response = await fetch(`${env.NATIVE_CONVEX_URL}/api/query`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					path: 'files:publicMetadata',
					args: { publicId: asset.publicId },
					format: 'json',
				}),
				signal: AbortSignal.timeout(10_000),
			});
			const data: unknown = await response.json();
			if (
				!response.ok ||
				!data ||
				typeof data !== 'object' ||
				!('status' in data) ||
				data.status !== 'success' ||
				!('value' in data) ||
				!data.value ||
				typeof data.value !== 'object' ||
				!('name' in data.value) ||
				typeof data.value.name !== 'string' ||
				(asset.variant === 'thumbnail' && (!('thumbnail' in data.value) || !data.value.thumbnail))
			) {
				return jsonResponse({ error: 'not_found' }, 404, { 'cache-control': 'no-store' });
			}
			asset.filename = data.value.name;
			asset.key =
				asset.variant === 'thumbnail'
					? `NATIVE_THUMB.${asset.publicId}.webp`
					: `NATIVE_FILE.${asset.publicId}`;
		} catch {
			return jsonResponse({ error: 'unavailable' }, 503, { 'cache-control': 'no-store' });
		}
		const response =
			request.method === 'HEAD'
				? await serveHead(request, env, asset)
				: await serveGet(request, env, ctx, asset);
		// Browsers must return here to recheck authorization; only our gated edge
		// cache can reuse bytes without another R2 read.
		response.headers.set('Cache-Control', 'no-store');
		return response;
	}
	return request.method === 'HEAD'
		? serveHead(request, env, asset)
		: serveGet(request, env, ctx, asset);
}

export default {
	fetch(request, env, ctx) {
		return handleRequest(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
