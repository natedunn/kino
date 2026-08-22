'use client';

import type { ApiOutputs } from '@convex/api';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
	Download,
	File,
	FileArchive,
	FileImage,
	FileText,
	FileVideo,
	Folder,
	FolderInput,
	MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';

import { MoveFileDialog } from '@/components/files/move-file-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCRPC, useCRPCClient } from '@/lib/convex/crpc';
import { extractErrorMessage } from '@/lib/errors';

import { useFilesWorkspace } from './files-workspace-context';

type ProjectFile = ApiOutputs['file']['listProjectFiles']['page'][number];

export type FileExplorerSearch = {
	cursor?: string;
	limit?: 25 | 50;
};

export function validateFileExplorerSearch(search: Record<string, unknown>): FileExplorerSearch {
	return {
		cursor: typeof search.cursor === 'string' ? search.cursor : undefined,
		limit: search.limit === 50 || search.limit === '50' ? 50 : undefined,
	};
}

export function FileExplorer({
	folderId,
	params,
	search,
}: {
	folderId: string | null;
	params: { org: string; project: string };
	search: FileExplorerSearch;
}) {
	const { canManage, folders, manageFolder, projectId } = useFilesWorkspace();
	const crpc = useCRPC();
	const crpcClient = useCRPCClient();
	const navigate = useNavigate();
	const currentFolder = folderId ? folders.find((folder) => folder.id === folderId) : null;
	const childFolders = folders.filter(
		(folder) => (folder.parentFolderId ?? null) === (folderId ?? null)
	);
	const filesQuery = useQuery(
		crpc.file.listProjectFiles.queryOptions({
			category: undefined,
			cursor: search.cursor ?? null,
			extension: undefined,
			folderId,
			limit: search.limit ?? 25,
			projectId,
			search: undefined,
			sort: 'created_desc',
			sourceProvider: undefined,
		})
	);
	const files = filesQuery.data?.page ?? [];
	const ensureThumbnails = useMutation(crpc.file.ensureThumbnails.mutationOptions());
	const missingThumbnailIds = files
		.filter((file) => file.category === 'image' && !file.thumbnailStatus)
		.map((file) => file.id);
	const missingThumbnailKey = missingThumbnailIds.join(',');

	useEffect(() => {
		if (!canManage || !missingThumbnailKey) return;
		ensureThumbnails.mutate({ assetIds: missingThumbnailIds, projectId });
		// The stable key prevents the reactive file result from repeatedly queueing
		// the same batch while thumbnail status propagates.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [canManage, missingThumbnailKey, projectId]);

	if (folderId && !currentFolder && folders.length) {
		return (
			<div className='flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground'>
				This folder no longer exists.
			</div>
		);
	}

	const openFolder = (nextFolderId: string | null) => {
		if (nextFolderId) {
			void navigate({
				params: { folderId: nextFolderId, ...params },
				to: '/@{$org}/$project/files/folder/$folderId',
			});
			return;
		}
		void navigate({ params, to: '/@{$org}/$project/files' });
	};

	const download = async (file: ProjectFile) => {
		try {
			const url = await crpcClient.file.getDownloadUrl.query({ assetId: file.id });
			if (!url) throw new Error('Download is unavailable');
			window.location.assign(url);
		} catch (error) {
			toast.error(extractErrorMessage(error, 'Unable to download file'));
		}
	};

	return (
		<div className='flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden py-6'>
			<div className='w-full min-w-0 max-w-full overflow-hidden rounded-xl border bg-card shadow-xs'>
				<div className='w-full max-w-full contain-paint overflow-x-auto overscroll-x-contain'>
					<table className='w-full min-w-[660px] border-collapse text-sm'>
						<thead>
							<tr className='border-b bg-muted/35 text-left text-xs tracking-wider text-muted-foreground uppercase'>
								<th className='px-4 py-3'>Name</th>
								<th className='px-4 py-3'>Category</th>
								<th className='px-4 py-3'>Size</th>
								<th className='px-4 py-3'>Date created</th>
								<th className='px-4 py-3'>Date edited</th>
								<th className='px-4 py-3'>
									<span className='sr-only'>Actions</span>
								</th>
							</tr>
						</thead>
						<tbody>
							{childFolders.map((folder) => (
								<tr
									className='border-b border-border/40 hover:bg-muted/30'
									key={folder.id}
									onContextMenu={(event) => {
										if (!canManage || folder.systemKey) return;
										event.preventDefault();
										manageFolder(folder.id);
									}}
								>
									<td className='px-4 py-3'>
										<button
											className='flex cursor-pointer items-center gap-3 font-medium'
											onClick={() => openFolder(folder.id)}
											type='button'
										>
											<span className='flex size-9 items-center justify-center rounded-lg border bg-muted/45 text-muted-foreground'>
												<Folder className='size-4' />
											</span>
											{folder.name}
										</button>
									</td>
									<td className='px-4 py-3'>
										<Badge variant='outline'>Folder</Badge>
									</td>
									<td className='px-4 py-3 text-muted-foreground'>—</td>
									<td className='px-4 py-3 text-muted-foreground'>
										{formatDate(folder.createdTime)}
									</td>
									<td className='px-4 py-3 text-muted-foreground'>
										{formatDate(folder.updatedTime)}
									</td>
									<td className='px-4 py-3 text-right'>
										{canManage && !folder.systemKey ? (
											<Button
												aria-label={`Manage ${folder.name}`}
												onClick={() => manageFolder(folder.id)}
												size='icon-sm'
												variant='ghost'
											>
												<MoreHorizontal />
											</Button>
										) : null}
									</td>
								</tr>
							))}
							{filesQuery.isPending ? <LoadingRows /> : null}
							{!filesQuery.isPending && !childFolders.length && !files.length ? (
								<tr>
									<td className='py-20 text-center' colSpan={6}>
										<File className='mx-auto mb-3 size-8 text-muted-foreground/45' />
										<p className='font-medium'>This folder is empty</p>
										<p className='mt-1 text-sm text-muted-foreground'>
											Use Cmd+K to upload a file or create a folder.
										</p>
									</td>
								</tr>
							) : null}
							{files.map((file) => (
								<FileRow
									canManage={canManage}
									file={file}
									folders={folders}
									key={file.id}
									onDownload={() => download(file)}
									params={params}
								/>
							))}
						</tbody>
					</table>
				</div>

				<div className='flex items-center justify-between border-t bg-muted/15 px-4 py-3'>
					<p className='text-xs text-muted-foreground'>
						{childFolders.length} folder{childFolders.length === 1 ? '' : 's'} · {files.length} file
						{files.length === 1 ? '' : 's'}
					</p>
					<Button
						disabled={!filesQuery.data || filesQuery.data.isDone}
						onClick={() => {
							if (!filesQuery.data?.continueCursor) return;
							const nextSearch = {
								cursor: filesQuery.data.continueCursor,
								limit: search.limit,
							};
							if (folderId) {
								void navigate({
									params: { folderId, ...params },
									search: nextSearch,
									to: '/@{$org}/$project/files/folder/$folderId',
								});
							} else {
								void navigate({
									params,
									search: nextSearch,
									to: '/@{$org}/$project/files',
								});
							}
						}}
						size='sm'
						variant='outline'
					>
						Next page
					</Button>
				</div>
			</div>
		</div>
	);
}

function FileRow({
	canManage,
	file,
	folders,
	onDownload,
	params,
}: {
	canManage: boolean;
	file: ProjectFile;
	folders: ReturnType<typeof useFilesWorkspace>['folders'];
	onDownload: () => void;
	params: { org: string; project: string };
}) {
	const [moveOpen, setMoveOpen] = useState(false);
	const [thumbnailFailed, setThumbnailFailed] = useState(false);
	const Icon = fileIcon(file.category);
	useEffect(() => setThumbnailFailed(false), [file.thumbnailUrl]);
	return (
		<>
			<tr className='group border-b border-border/40 last:border-0 hover:bg-muted/30'>
				<td className='px-4 py-3'>
					<Link
						className='flex min-w-0 items-center gap-3 font-medium'
						params={{ fileId: file.id, ...params }}
						search={{}}
						to='/@{$org}/$project/files/file/$fileId'
					>
						<span className='flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/45'>
							{file.thumbnailUrl && !thumbnailFailed ? (
								<img
									alt=''
									className='size-full object-cover'
									decoding='async'
									loading='lazy'
									onError={() => setThumbnailFailed(true)}
									src={file.thumbnailUrl}
								/>
							) : (
								<Icon className='size-4 text-muted-foreground' />
							)}
						</span>
						<span className='max-w-80 truncate'>{file.name}</span>
					</Link>
				</td>
				<td className='px-4 py-3'>
					<Badge className='capitalize' variant='outline'>
						{file.category}
					</Badge>
				</td>
				<td className='px-4 py-3 font-mono text-xs text-muted-foreground'>
					{formatBytes(file.sizeBytes ?? 0)}
				</td>
				<td className='px-4 py-3 text-muted-foreground'>{formatDate(file.createdTime)}</td>
				<td className='px-4 py-3 text-muted-foreground'>{formatDate(file.updatedTime)}</td>
				<td className='px-4 py-3 text-right'>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button aria-label={`Actions for ${file.name}`} size='icon-sm' variant='ghost' />
							}
						>
							<MoreHorizontal />
						</DropdownMenuTrigger>
						<DropdownMenuContent align='end'>
							<DropdownMenuItem onClick={onDownload}>
								<Download /> Download
							</DropdownMenuItem>
							{canManage ? (
								<DropdownMenuItem onClick={() => setMoveOpen(true)}>
									<FolderInput /> Move to folder
								</DropdownMenuItem>
							) : null}
						</DropdownMenuContent>
					</DropdownMenu>
				</td>
			</tr>
			{canManage ? (
				<MoveFileDialog file={file} folders={folders} onOpenChange={setMoveOpen} open={moveOpen} />
			) : null}
		</>
	);
}

function LoadingRows() {
	return Array.from({ length: 5 }).map((_, index) => (
		<tr className='border-b' key={index}>
			<td className='px-4 py-5' colSpan={6}>
				<div className='h-5 animate-pulse rounded bg-muted' />
			</td>
		</tr>
	));
}

function fileIcon(category: string) {
	if (category === 'image') return FileImage;
	if (category === 'video') return FileVideo;
	if (category === 'package') return FileArchive;
	return FileText;
}

export function formatBytes(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
	return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
}

export function formatDate(timestamp: number) {
	return new Intl.DateTimeFormat('en-US', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
	}).format(new Date(timestamp));
}
