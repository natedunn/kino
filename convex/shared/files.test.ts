import { describe, expect, it } from 'vitest';

import {
	FREE_PROJECT_STORAGE_BYTES,
	getFileBaseName,
	getFileExtension,
	getFileFormatPolicy,
	isAcceptedFileMimeType,
	MEBIBYTE,
	normalizeFileName,
	renameFilePreservingExtension,
} from './files';

describe('file policy', () => {
	it('classifies requested formats into stable buckets', () => {
		expect(getFileFormatPolicy('hero.PNG')).toMatchObject({ category: 'image', extension: 'png' });
		expect(getFileFormatPolicy('notes.mdx')).toMatchObject({ category: 'text' });
		expect(getFileFormatPolicy('prototype.fig')).toMatchObject({ category: 'design' });
		expect(getFileFormatPolicy('source.ts')).toBeNull();
	});

	it('validates MIME aliases per extension', () => {
		const ai = getFileFormatPolicy('art.ai');
		expect(ai).not.toBeNull();
		expect(isAcceptedFileMimeType(ai!, 'application/pdf; charset=binary')).toBe(true);
		expect(isAcceptedFileMimeType(ai!, 'text/html')).toBe(false);
	});

	it('normalizes leaf names without changing the extension', () => {
		expect(normalizeFileName('../brand/hero.png')).toBe('..-brand-hero.png');
		expect(getFileExtension('.env')).toBeNull();
		expect(getFileExtension('archive.tar.gz')).toBe('gz');
	});

	it('renames only the base name and always preserves the stored extension', () => {
		expect(getFileBaseName('Launch Plan.PDF', 'pdf')).toBe('Launch Plan');
		expect(renameFilePreservingExtension('Updated launch plan', 'pdf')).toBe(
			'Updated launch plan.pdf'
		);
		expect(renameFilePreservingExtension('Updated launch plan.pdf', 'pdf')).toBe(
			'Updated launch plan.pdf'
		);
		expect(renameFilePreservingExtension('Updated launch plan.jpg', 'pdf')).toBe(
			'Updated launch plan.pdf'
		);
		expect(renameFilePreservingExtension('.pdf', 'pdf')).toBeNull();
	});

	it('starts every project on the documented free floor', () => {
		expect(FREE_PROJECT_STORAGE_BYTES).toBe(100 * MEBIBYTE);
	});
});
