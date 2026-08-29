export type FolderPickerFolder = {
	id: string;
	name: string;
	parentFolderId?: string | null;
};

export function folderPickerPathLabel(
	folders: Array<FolderPickerFolder>,
	folderId: string | null,
	rootLabel = 'Root'
) {
	if (!folderId) return rootLabel;
	const breadcrumbs = buildFolderPath(
		new Map(folders.map((folder) => [folder.id, folder])),
		folderId
	);
	return breadcrumbs.length
		? `${rootLabel} / ${breadcrumbs.map((folder) => folder.name).join(' / ')}`
		: rootLabel;
}

export function buildFolderPath(
	foldersById: Map<string, FolderPickerFolder>,
	folderId: string | null
) {
	const path: Array<FolderPickerFolder> = [];
	const seen = new Set<string>();
	let current = folderId ? foldersById.get(folderId) : undefined;
	while (current && path.length < 12 && !seen.has(current.id)) {
		seen.add(current.id);
		path.unshift(current);
		current = current.parentFolderId ? foldersById.get(current.parentFolderId) : undefined;
	}
	return path;
}

export function folderDescendantIds(folders: Array<FolderPickerFolder>, folderId: string) {
	const descendants = new Set<string>();
	const pending = [folderId];
	while (pending.length) {
		const parentId = pending.pop();
		if (!parentId) continue;
		for (const folder of folders) {
			if (folder.parentFolderId !== parentId || descendants.has(folder.id)) continue;
			descendants.add(folder.id);
			pending.push(folder.id);
		}
	}
	return descendants;
}
