'use client';

import type { ApiOutputs } from '@convex/api';

import { useEffect, useMemo, useRef, useState } from 'react';
import { hotkeysCoreFeature, selectionFeature, syncDataLoaderFeature } from '@headless-tree/core';
import { useTree } from '@headless-tree/react';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
	ArrowRight,
	FileArchive,
	FileImage,
	FileText,
	FileVideo,
	Folder,
	FolderOpen,
} from 'lucide-react';

import { Tree, TreeItem, TreeItemLabel } from '@/components/reui/tree';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { buildFolderPath, useFilesWorkspace } from './files-workspace-context';

type FolderTreeItem = {
	children: Array<string>;
	category?: string;
	folderId?: string;
	id: string;
	kind: 'file' | 'folder' | 'root';
	name: string;
	system: boolean;
};

export type FileTreeFile = ApiOutputs['file']['listFileTreeItems']['files'][number];

const ROOT_ID = 'files-root';
const EXPANDED_FOLDERS_STORAGE_PREFIX = 'kino:files:expanded-folders:';
const folderNodeId = (id: string) => `folder:${id}`;
const fileNodeId = (id: string) => `file:${id}`;

export function FolderTree({
	activeFolderId,
	className,
	files,
	isLoading = false,
	onManageFolder,
}: {
	activeFolderId?: string | null;
	className?: string;
	files: Array<FileTreeFile>;
	isLoading?: boolean;
	onManageFolder?: (folderId: string) => void;
}) {
	const { folders, projectId } = useFilesWorkspace();
	const navigate = useNavigate();
	const projectParams = useParams({ from: '/@{$org}/$project' });
	const routeParams = useParams({ strict: false });
	const currentFolderId = routeParams.folderId ?? activeFolderId ?? undefined;
	const items = useMemo(() => buildTreeItems(folders, files), [files, folders]);
	const selectedItemId =
		routeParams.fileId && Object.hasOwn(items, fileNodeId(routeParams.fileId))
			? fileNodeId(routeParams.fileId)
			: currentFolderId && Object.hasOwn(items, folderNodeId(currentFolderId))
				? folderNodeId(currentFolderId)
				: ROOT_ID;
	const selectedPath = useMemo(
		() => buildFolderPath(folders, currentFolderId).map((folder) => folderNodeId(folder.id)),
		[currentFolderId, folders]
	);
	const foldersToReveal = useMemo(
		() => (selectedItemId.startsWith('folder:') ? selectedPath.slice(0, -1) : selectedPath),
		[selectedItemId, selectedPath]
	);
	const [expandedItems, setExpandedItems] = useState<Array<string>>([ROOT_ID, ...foldersToReveal]);
	const [hasHydrated, setHasHydrated] = useState(false);
	const [loadedStorageKey, setLoadedStorageKey] = useState<string | null>(null);
	const expandedFoldersStorageKey = `${EXPANDED_FOLDERS_STORAGE_PREFIX}${projectId}`;

	useEffect(() => {
		setHasHydrated(true);
	}, []);

	useEffect(() => {
		setExpandedItems((current) => Array.from(new Set([...current, ROOT_ID, ...foldersToReveal])));
	}, [foldersToReveal, selectedItemId]);

	useEffect(() => {
		if (loadedStorageKey === expandedFoldersStorageKey) return;
		let storedFolderIds: Array<string> = [];
		try {
			const stored = window.localStorage.getItem(expandedFoldersStorageKey);
			const parsed: unknown = stored ? JSON.parse(stored) : [];
			if (Array.isArray(parsed)) {
				storedFolderIds = parsed.filter((value): value is string => typeof value === 'string');
			}
		} catch {
			// Storage can be unavailable in privacy-restricted browser contexts.
		}

		const availableFolderIds = new Set<string>(folders.map((folder) => String(folder.id)));
		const restoredItems = storedFolderIds
			.filter((folderId) => availableFolderIds.has(folderId))
			.map(folderNodeId);
		setExpandedItems((current) =>
			Array.from(new Set([ROOT_ID, ...current, ...restoredItems, ...foldersToReveal]))
		);
		setLoadedStorageKey(expandedFoldersStorageKey);
	}, [expandedFoldersStorageKey, folders, foldersToReveal, loadedStorageKey]);

	useEffect(() => {
		if (loadedStorageKey !== expandedFoldersStorageKey) return;
		const expandedFolderIds = expandedItems.flatMap((itemId) => {
			if (!Object.hasOwn(items, itemId)) return [];
			const item = items[itemId];
			return item.kind === 'folder' ? [item.id] : [];
		});
		try {
			window.localStorage.setItem(expandedFoldersStorageKey, JSON.stringify(expandedFolderIds));
		} catch {
			// The tree remains fully functional when persistence is unavailable.
		}
	}, [expandedFoldersStorageKey, expandedItems, items, loadedStorageKey]);

	const tree = useTree<FolderTreeItem>({
		dataLoader: {
			getChildren: (itemId) => items[itemId].children,
			getItem: (itemId) => items[itemId],
		},
		features: [syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature],
		getItemName: (item) => item.getItemData().name,
		isItemFolder: (item) => item.getItemData().kind !== 'file',
		onPrimaryAction: (item) => {
			const data = item.getItemData();
			if (data.kind === 'root') {
				void navigate({
					params: projectParams,
					to: '/@{$org}/$project/files',
				});
				return;
			}
			if (data.kind === 'file') {
				void navigate({
					params: { fileId: data.id, ...projectParams },
					search: {},
					to: '/@{$org}/$project/files/file/$fileId',
				});
				return;
			}
			void navigate({
				params: { folderId: data.id, ...projectParams },
				to: '/@{$org}/$project/files/folder/$folderId',
			});
		},
		rootItemId: ROOT_ID,
		setExpandedItems,
		state: { expandedItems, selectedItems: [selectedItemId] },
	});
	const previousItems = useRef(items);
	if (previousItems.current !== items) {
		// Headless Tree only rebuilds its synchronous item metadata when controlled
		// expansion state changes. Convex can remove a file while that state stays
		// identical, so schedule the rebuild before getItems reads the old item ID.
		tree.scheduleRebuildTree();
		previousItems.current = items;
	}
	const visibleItems = tree.getItems();
	const isTreeInitializing =
		!hasHydrated || ((folders.length > 0 || files.length > 0) && visibleItems.length === 0);

	if (isLoading || isTreeInitializing) {
		return <FolderTreeSkeleton className={className} />;
	}

	return (
		<Tree className={cn('gap-0.5 p-1', className)} indent={14} indentGuides tree={tree}>
			{visibleItems.map((item) => {
				const data = item.getItemData();
				const isSelected = item.getId() === selectedItemId;
				const ItemIcon =
					data.kind === 'file'
						? fileTreeIcon(data.category)
						: item.isExpanded()
							? FolderOpen
							: Folder;
				return (
					<TreeItem
						className='cursor-pointer'
						item={item}
						key={item.getId()}
						onContextMenu={(event) => {
							if (data.kind !== 'folder' || data.system || !onManageFolder) return;
							event.preventDefault();
							onManageFolder(data.id);
						}}
					>
						<TreeItemLabel
							className='min-h-8 w-full gap-1 px-1.5 py-1 text-[13px] in-data-[selected=true]:bg-primary/9 in-data-[selected=true]:text-foreground in-data-[selected=true]:hover:bg-primary/9'
							onExpansionToggle={(folderItem) => {
								const isCollapsing = folderItem.isExpanded();
								if (isCollapsing) {
									folderItem.collapse();
									const isHidingCurrentSelection =
										selectedItemId !== folderItem.getId() &&
										selectedPath.includes(folderItem.getId());
									if (isHidingCurrentSelection) {
										void navigate({
											params: { folderId: data.id, ...projectParams },
											to: '/@{$org}/$project/files/folder/$folderId',
										});
									}
									return;
								}
								folderItem.expand();
							}}
						>
							<span className='flex min-w-0 items-center gap-2'>
								<ItemIcon className='size-3.5 text-muted-foreground' />
								<span className='truncate'>{data.name}</span>
							</span>
							{isSelected ? (
								<ArrowRight className='ml-auto size-3.5 shrink-0 text-primary' />
							) : null}
						</TreeItemLabel>
					</TreeItem>
				);
			})}
		</Tree>
	);
}

export function FolderTreeSkeleton({ className }: { className?: string }) {
	const rows = [
		{ depth: 0, width: 'w-20' },
		{ depth: 1, width: 'w-28' },
		{ depth: 2, width: 'w-24' },
		{ depth: 0, width: 'w-24' },
		{ depth: 1, width: 'w-32' },
		{ depth: 1, width: 'w-20' },
	] as const;

	return (
		<div aria-label='Loading file tree' className={cn('space-y-0.5 p-1', className)} role='status'>
			{rows.map((row, index) => (
				<div
					className='relative flex h-8 items-center gap-2 px-1.5'
					key={`${row.depth}-${row.width}-${index}`}
					style={{ paddingLeft: `${row.depth * 14 + 6}px` }}
				>
					{row.depth > 0 ? (
						<span
							aria-hidden='true'
							className='absolute inset-y-0 w-px bg-border/70'
							style={{ left: `${(row.depth - 1) * 14 + 12}px` }}
						/>
					) : null}
					<Skeleton className='size-3.5 shrink-0 rounded-sm' />
					<Skeleton className={cn('h-3.5', row.width)} />
				</div>
			))}
		</div>
	);
}

function buildTreeItems(
	folders: ReturnType<typeof useFilesWorkspace>['folders'],
	files: Array<FileTreeFile>
) {
	const items: Record<string, FolderTreeItem> = {
		[ROOT_ID]: { children: [], id: ROOT_ID, kind: 'root', name: 'Root', system: true },
	};
	for (const folder of folders) {
		items[folderNodeId(folder.id)] = {
			children: [],
			id: folder.id,
			kind: 'folder',
			name: folder.name,
			system: !!folder.systemKey,
		};
	}
	for (const folder of folders) {
		const parentId =
			folder.parentFolderId && Object.hasOwn(items, folderNodeId(folder.parentFolderId))
				? folderNodeId(folder.parentFolderId)
				: ROOT_ID;
		items[parentId].children.push(folderNodeId(folder.id));
	}
	for (const file of files) {
		const nodeId = fileNodeId(file.id);
		items[nodeId] = {
			category: file.category,
			children: [],
			folderId: file.folderId ?? undefined,
			id: file.id,
			kind: 'file',
			name: file.name,
			system: false,
		};
		const parentId =
			file.folderId && Object.hasOwn(items, folderNodeId(file.folderId))
				? folderNodeId(file.folderId)
				: ROOT_ID;
		items[parentId].children.push(nodeId);
	}
	for (const item of Object.values(items)) {
		item.children.sort((a, b) => {
			if (items[a].kind !== items[b].kind) return items[a].kind === 'folder' ? -1 : 1;
			return items[a].name.localeCompare(items[b].name);
		});
	}
	return items;
}

function fileTreeIcon(category?: string) {
	if (category === 'image') return FileImage;
	if (category === 'video') return FileVideo;
	if (category === 'package') return FileArchive;
	return FileText;
}
