import type { ApiOutputs } from '@convex/api';
import type { ReactNode } from 'react';

import { createContext, useContext } from 'react';

export type FileFolder = ApiOutputs['file']['listFolders'][number];

export type FilesWorkspaceContextValue = {
	canManage: boolean;
	folders: Array<FileFolder>;
	manageFolder: (folderId: string) => void;
	projectId: string;
};

const FilesWorkspaceContext = createContext<FilesWorkspaceContextValue | null>(null);

export function FilesWorkspaceProvider({
	children,
	value,
}: {
	children: ReactNode;
	value: FilesWorkspaceContextValue;
}) {
	return <FilesWorkspaceContext.Provider value={value}>{children}</FilesWorkspaceContext.Provider>;
}

export function useFilesWorkspace() {
	const context = useContext(FilesWorkspaceContext);
	if (!context) throw new Error('useFilesWorkspace must be used inside FilesWorkspaceProvider');
	return context;
}

export function buildFolderPath(folders: Array<FileFolder>, folderId?: string) {
	if (!folderId) return [];
	const foldersById = new Map<string, FileFolder>(
		folders.map((folder) => [String(folder.id), folder])
	);
	const path: Array<FileFolder> = [];
	const seen = new Set<string>();
	let current = foldersById.get(folderId);
	while (current && path.length < 12 && !seen.has(current.id)) {
		seen.add(current.id);
		path.unshift(current);
		current = current.parentFolderId ? foldersById.get(String(current.parentFolderId)) : undefined;
	}
	return path;
}
