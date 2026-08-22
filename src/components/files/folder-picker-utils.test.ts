import { describe, expect, it } from 'vitest';

import { buildFolderPath, folderDescendantIds, folderPickerPathLabel } from './folder-picker-utils';

const folders = [
	{ id: 'design', name: 'Design', parentFolderId: null },
	{ id: 'brand', name: 'Brand', parentFolderId: 'design' },
	{ id: 'logos', name: 'Logos', parentFolderId: 'brand' },
];

describe('folder picker paths', () => {
	it('builds a nested destination label', () => {
		expect(folderPickerPathLabel(folders, 'logos')).toBe('Root / Design / Brand / Logos');
	});

	it('uses Root for the root destination', () => {
		expect(folderPickerPathLabel(folders, null)).toBe('Root');
	});

	it('stops safely when folder data contains a cycle', () => {
		const cyclic = [
			{ id: 'one', name: 'One', parentFolderId: 'two' },
			{ id: 'two', name: 'Two', parentFolderId: 'one' },
		];
		const path = buildFolderPath(new Map(cyclic.map((folder) => [folder.id, folder])), 'one');
		expect(path.map((folder) => folder.id)).toEqual(['two', 'one']);
	});

	it('finds every nested descendant without including the selected folder', () => {
		expect(Array.from(folderDescendantIds(folders, 'design')).sort()).toEqual(['brand', 'logos']);
	});
});
