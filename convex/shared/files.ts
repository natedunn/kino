export const MEBIBYTE = 1024 * 1024;

export const FREE_PROJECT_STORAGE_BYTES = 100 * MEBIBYTE;
export const MAX_DIRECT_UPLOAD_BATCH_BYTES = 50 * MEBIBYTE;
export const MAX_DIRECT_UPLOAD_BATCH_FILES = 10;

export const FILE_CATEGORIES = [
	'image',
	'video',
	'document',
	'text',
	'data',
	'package',
	'design',
] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];

export const FILE_ACCESS_LEVELS = ['public', 'project_staff', 'private_user'] as const;
export type FileAccessLevel = (typeof FILE_ACCESS_LEVELS)[number];

export const FILE_LISTINGS = ['project_files', 'staff_only', 'unlisted'] as const;
export type FileListing = (typeof FILE_LISTINGS)[number];

export const FILE_UPLOADER_CLASSES = ['staff', 'user', 'system', 'integration'] as const;
export type FileUploaderClass = (typeof FILE_UPLOADER_CLASSES)[number];

export const FILE_CREATION_METHODS = ['direct', 'feature', 'integration'] as const;
export type FileCreationMethod = (typeof FILE_CREATION_METHODS)[number];

export const FILE_SOURCE_PROVIDERS = ['kino', 'github', 'google_drive', 'youtube', 's3'] as const;
export type FileSourceProvider = (typeof FILE_SOURCE_PROVIDERS)[number];

export const FILE_ORIGIN_FEATURES = [
	'files',
	'update_cover',
	'update_body',
	'wiki_attachment',
	'project_header',
	'feedback_attachment',
	'user_avatar',
	'org_avatar',
	'integration',
] as const;
export type FileOriginFeature = (typeof FILE_ORIGIN_FEATURES)[number];

export type FileFormatPolicy = {
	category: FileCategory;
	extension: string;
	maxBytes: number;
	mimeTypes: ReadonlyArray<string>;
	preview: 'image' | 'video' | 'pdf' | 'text' | 'download';
};

const TEN_MIB = 10 * MEBIBYTE;
const TWENTY_FIVE_MIB = 25 * MEBIBYTE;
const OCTET_STREAM = 'application/octet-stream';

const policies: ReadonlyArray<FileFormatPolicy> = [
	...formats('image', TEN_MIB, 'image', {
		png: ['image/png'],
		jpg: ['image/jpeg'],
		jpeg: ['image/jpeg'],
		webp: ['image/webp'],
		avif: ['image/avif'],
		gif: ['image/gif'],
		bmp: ['image/bmp', 'image/x-bmp'],
		tif: ['image/tiff'],
		tiff: ['image/tiff'],
		heic: ['image/heic', 'image/heif', OCTET_STREAM],
		heif: ['image/heif', 'image/heic', OCTET_STREAM],
		ico: ['image/x-icon', 'image/vnd.microsoft.icon'],
	}),
	policy('svg', 'image', TEN_MIB, ['image/svg+xml'], 'download'),
	policy('mp4', 'video', TWENTY_FIVE_MIB, ['video/mp4'], 'video'),
	policy('webm', 'video', TWENTY_FIVE_MIB, ['video/webm'], 'video'),
	policy('pdf', 'document', TEN_MIB, ['application/pdf'], 'pdf'),
	policy('md', 'text', TEN_MIB, ['text/markdown', 'text/plain', OCTET_STREAM], 'text'),
	policy('mdx', 'text', TEN_MIB, ['text/mdx', 'text/markdown', 'text/plain', OCTET_STREAM], 'text'),
	policy('txt', 'text', TEN_MIB, ['text/plain', OCTET_STREAM], 'text'),
	policy('csv', 'data', TEN_MIB, ['text/csv', 'application/csv', 'text/plain'], 'text'),
	policy('json', 'data', TEN_MIB, ['application/json', 'text/json', 'text/plain'], 'text'),
	policy(
		'zip',
		'package',
		TWENTY_FIVE_MIB,
		['application/zip', 'application/x-zip-compressed'],
		'download'
	),
	...formats('design', TWENTY_FIVE_MIB, 'download', {
		fig: [OCTET_STREAM, 'application/zip'],
		sketch: [OCTET_STREAM, 'application/zip'],
		xd: [OCTET_STREAM, 'application/zip'],
		psd: [OCTET_STREAM, 'image/vnd.adobe.photoshop', 'application/vnd.adobe.photoshop'],
		ai: [OCTET_STREAM, 'application/pdf', 'application/postscript'],
		indd: [OCTET_STREAM, 'application/x-indesign'],
		afdesign: [OCTET_STREAM],
		afphoto: [OCTET_STREAM],
		procreate: [OCTET_STREAM, 'application/zip'],
		aep: [OCTET_STREAM, 'application/vnd.adobe.after-effects.project'],
	}),
];

function policy(
	extension: string,
	category: FileCategory,
	maxBytes: number,
	mimeTypes: ReadonlyArray<string>,
	preview: FileFormatPolicy['preview']
): FileFormatPolicy {
	return { category, extension, maxBytes, mimeTypes, preview };
}

function formats(
	category: FileCategory,
	maxBytes: number,
	preview: FileFormatPolicy['preview'],
	entries: Readonly<Record<string, ReadonlyArray<string>>>
): Array<FileFormatPolicy> {
	return Object.entries(entries).map(([extension, mimeTypes]) =>
		policy(extension, category, maxBytes, mimeTypes, preview)
	);
}

export const FILE_FORMAT_POLICIES = policies;
export const ACCEPTED_FILE_EXTENSIONS = policies.map((item) => item.extension);
export const FILE_INPUT_ACCEPT = policies.map((item) => `.${item.extension}`).join(',');

const policyByExtension = new Map(policies.map((item) => [item.extension, item] as const));

export function getFileExtension(fileName: string): string | null {
	const leaf = fileName.trim().split(/[\\/]/).at(-1) ?? '';
	const dot = leaf.lastIndexOf('.');
	if (dot <= 0 || dot === leaf.length - 1) return null;
	return leaf.slice(dot + 1).toLowerCase();
}

export function getFileFormatPolicy(fileNameOrExtension: string): FileFormatPolicy | null {
	const extension = fileNameOrExtension.includes('.')
		? getFileExtension(fileNameOrExtension)
		: fileNameOrExtension.trim().toLowerCase().replace(/^\./, '');
	return extension ? (policyByExtension.get(extension) ?? null) : null;
}

export function isAcceptedFileMimeType(formatPolicy: FileFormatPolicy, mimeType: string): boolean {
	const normalized = mimeType.trim().toLowerCase().split(';', 1)[0] ?? '';
	return normalized.length > 0 && formatPolicy.mimeTypes.includes(normalized);
}

export function normalizeFileName(fileName: string): string {
	return (
		fileName
			.trim()
			// eslint-disable-next-line no-control-regex -- filenames must drop ASCII control characters
			.replace(/[\u0000-\u001f\u007f]/g, '')
			.replace(/[\\/]+/g, '-')
			.slice(0, 240)
	);
}

export function getFileBaseName(fileName: string, extension: string): string {
	const normalizedName = normalizeFileName(fileName);
	const storedExtension = extension.trim().toLowerCase().replace(/^\./, '');
	const typedExtension = getFileExtension(normalizedName);
	const removableExtension =
		typedExtension && policyByExtension.has(typedExtension) ? typedExtension : storedExtension;
	const suffix = `.${removableExtension}`;
	return normalizedName.toLowerCase().endsWith(suffix)
		? normalizedName.slice(0, -suffix.length)
		: normalizedName;
}

export function renameFilePreservingExtension(
	requestedBaseName: string,
	extension: string
): string | null {
	const normalizedExtension = extension.trim().toLowerCase().replace(/^\./, '');
	if (!normalizedExtension) return null;
	const suffix = `.${normalizedExtension}`;
	const baseName = getFileBaseName(requestedBaseName, normalizedExtension)
		.trim()
		.replace(/\.+$/, '')
		.trim()
		.slice(0, 240 - suffix.length)
		.trim();
	return baseName ? `${baseName}${suffix}` : null;
}

export function buildFileSearchText(parts: ReadonlyArray<string | null | undefined>): string {
	return parts
		.filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
		.map((part) => part.trim().toLowerCase())
		.join(' ')
		.slice(0, 32_000);
}

export function getProjectStorageLimitBytes(): number {
	// The tier seam: a later PR can accept a project/tier descriptor here. Upload
	// code calls this resolver rather than embedding plan checks or numeric limits.
	return FREE_PROJECT_STORAGE_BYTES;
}
