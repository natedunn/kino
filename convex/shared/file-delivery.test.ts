import { describe, expect, it } from 'vitest';

import {
	createPublicFileId,
	getFilesOrigin,
	getPublicFileDeliveryUrl,
	getPublicFileDownloadUrl,
	getPublicFileObjectKey,
	getPublicFileThumbnailObjectKey,
	getPublicFileThumbnailUrl,
	isPublicFileDeliveryEligible,
	isPublicFileId,
} from './file-delivery';

describe('public file delivery contract', () => {
	it('generates high-entropy URL-safe public IDs', () => {
		const ids = Array.from({ length: 20 }, () => createPublicFileId());
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) {
			expect(id).toMatch(/^[a-f0-9]{32}$/);
			expect(isPublicFileId(id)).toBe(true);
		}
	});

	it('builds the exact R2 keys shared with the delivery Worker', () => {
		const publicId = '0123456789abcdef0123456789abcdef';
		expect(getPublicFileObjectKey(publicId)).toBe(`PUBLIC_FILE.${publicId}`);
		expect(getPublicFileThumbnailObjectKey(publicId)).toBe(
			`PUBLIC_FILE_THUMBNAIL.${publicId}.webp`
		);
	});

	it('builds clean delivery URLs while treating the filename as one path segment', () => {
		const publicId = '0123456789abcdef0123456789abcdef';
		expect(
			getPublicFileDeliveryUrl({
				fileName: 'Launch plan #1.pdf',
				origin: 'https://files.usekino.com/',
				publicId,
			})
		).toBe(`https://files.usekino.com/${publicId}/Launch%20plan%20%231.pdf`);
		expect(
			getPublicFileDownloadUrl({
				fileName: 'Launch plan #1.pdf',
				origin: 'https://files.usekino.com',
				publicId,
			})
		).toBe(`https://files.usekino.com/${publicId}/Launch%20plan%20%231.pdf?download=1`);
		expect(getPublicFileThumbnailUrl({ origin: 'https://files.usekino.com', publicId })).toBe(
			`https://files.usekino.com/${publicId}/thumb-128.webp`
		);
	});

	it('requires an explicit delivery origin and rejects unsafe configured origins', () => {
		const publicId = '0123456789abcdef0123456789abcdef';
		expect(getFilesOrigin()).toBeNull();
		expect(getPublicFileDeliveryUrl({ fileName: 'asset.png', publicId })).toBeNull();
		expect(getPublicFileDownloadUrl({ fileName: 'asset.png', publicId })).toBeNull();
		expect(getPublicFileThumbnailUrl({ publicId })).toBeNull();
		expect(getFilesOrigin('http://localhost:8787')).toBe('http://localhost:8787');
		expect(() => getFilesOrigin('http://files.usekino.com')).toThrow('HTTPS');
		expect(() => getFilesOrigin('https://files.usekino.com/path')).toThrow('without credentials');
	});

	it('only exposes public, listed files in the organization uploads bucket', () => {
		expect(
			isPublicFileDeliveryEligible({
				access: 'public',
				bucketKind: 'org_uploads',
				listing: 'project_files',
			})
		).toBe(true);
		for (const candidate of [
			{ access: 'private_user', bucketKind: 'user_uploads', listing: 'unlisted' },
			{ access: 'project_staff', bucketKind: 'org_uploads', listing: 'staff_only' },
			{ access: 'public', bucketKind: 'user_uploads', listing: 'project_files' },
		]) {
			expect(isPublicFileDeliveryEligible(candidate)).toBe(false);
		}
	});
});
