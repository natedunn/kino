export const PUBLIC_FILE_ID_PATTERN = /^[a-f0-9]{32}$/;

export function createPublicFileId(): string {
	const publicId = crypto.randomUUID().replaceAll('-', '').toLowerCase();
	if (!PUBLIC_FILE_ID_PATTERN.test(publicId)) {
		throw new Error('Could not generate a valid public file ID');
	}
	return publicId;
}

export function isPublicFileId(value: string): boolean {
	return PUBLIC_FILE_ID_PATTERN.test(value);
}

function assertPublicFileId(publicId: string) {
	if (!isPublicFileId(publicId)) throw new Error('Invalid public file ID');
}

export function getPublicFileObjectKey(publicId: string): string {
	assertPublicFileId(publicId);
	return `PUBLIC_FILE.${publicId}`;
}

export function getCurrentPublicFileId(args: {
	objectKey: string;
	publicId: string | null | undefined;
}): string | null {
	if (!args.publicId || !isPublicFileId(args.publicId)) return null;
	return args.objectKey === getPublicFileObjectKey(args.publicId) ? args.publicId : null;
}

export function getPublicFileThumbnailObjectKey(publicId: string): string {
	assertPublicFileId(publicId);
	return `PUBLIC_FILE_THUMBNAIL.${publicId}.webp`;
}

export function getFilesOrigin(configuredOrigin?: string): string | null {
	const value = configuredOrigin?.trim();
	if (!value) return null;
	let origin: URL;
	try {
		origin = new URL(value);
	} catch {
		throw new Error('FILES_ORIGIN must be an absolute URL');
	}
	const localHttp =
		origin.protocol === 'http:' &&
		(origin.hostname === 'localhost' ||
			origin.hostname === '127.0.0.1' ||
			origin.hostname === '::1');
	if (origin.protocol !== 'https:' && !localHttp) {
		throw new Error('FILES_ORIGIN must use HTTPS outside local development');
	}
	if (
		origin.username ||
		origin.password ||
		origin.search ||
		origin.hash ||
		(origin.pathname !== '/' && origin.pathname !== '')
	) {
		throw new Error('FILES_ORIGIN must be an origin without credentials, a path, query, or hash');
	}
	return origin.origin;
}

export function getPublicFileDeliveryUrl(args: {
	fileName: string;
	origin?: string;
	publicId: string;
}): string | null {
	assertPublicFileId(args.publicId);
	const origin = getFilesOrigin(args.origin);
	if (!origin) return null;
	return `${origin}/${args.publicId}/${encodeURIComponent(args.fileName)}`;
}

export function getPublicFileDownloadUrl(args: {
	fileName: string;
	origin?: string;
	publicId: string;
}): string | null {
	const deliveryUrl = getPublicFileDeliveryUrl(args);
	return deliveryUrl ? `${deliveryUrl}?download=1` : null;
}

export function getPublicFileThumbnailUrl(args: {
	origin?: string;
	publicId: string;
}): string | null {
	assertPublicFileId(args.publicId);
	const origin = getFilesOrigin(args.origin);
	return origin ? `${origin}/${args.publicId}/thumb-128.webp` : null;
}

export function isPublicFileDeliveryEligible(args: {
	access: string;
	bucketKind: string;
	listing: string;
}): boolean {
	return (
		args.access === 'public' &&
		args.listing === 'project_files' &&
		args.bucketKind === 'org_uploads'
	);
}
