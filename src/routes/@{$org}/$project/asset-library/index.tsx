'use client';

import type { ChangeEvent } from 'react';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
	FILE_CATEGORIES,
	FILE_INPUT_ACCEPT,
	getFileBaseName,
	getFileFormatPolicy,
	MAX_DIRECT_UPLOAD_BATCH_BYTES,
	MAX_DIRECT_UPLOAD_BATCH_FILES,
} from '@convex/files';
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router';
import {
	ChevronRight,
	Download,
	ExternalLink,
	File,
	FileArchive,
	FileImage,
	FileText,
	FileVideo,
	Folder,
	FolderInput,
	FolderPlus,
	MoreHorizontal,
	Pencil,
	Search,
	Trash2,
	Upload,
	X,
} from 'lucide-react';

import { useCommandPalette } from '@/components/command';
import { FolderPicker } from '@/components/files/folder-picker';
import { MoveFileDialog } from '@/components/files/move-file-dialog';
import { RoutePending } from '@/components/route-pending';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
	ResponsiveDialog,
	ResponsiveDialogBody,
	ResponsiveDialogContent,
	ResponsiveDialogFooter,
	ResponsiveDialogHeader,
} from '@/components/ui/responsive-dialog';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { useCRPC, useCRPCClient } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { extractErrorMessage } from '@/lib/errors';
import { capturePostHogEvent } from '@/lib/posthog';
import { projectTitle, titleMeta } from '@/lib/seo';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

const FILE_SORTS = [
	'created_desc',
	'created_asc',
	'edited_desc',
	'edited_asc',
	'name_asc',
	'name_desc',
	'size_asc',
	'size_desc',
] as const;
type FileSort = (typeof FILE_SORTS)[number];
type FileCategory = (typeof FILE_CATEGORIES)[number];
const FILE_SORT_LABELS: Record<FileSort, string> = {
	created_asc: 'Oldest created',
	created_desc: 'Newest created',
	edited_asc: 'Least recently edited',
	edited_desc: 'Recently edited',
	name_asc: 'Name A–Z',
	name_desc: 'Name Z–A',
	size_asc: 'Smallest',
	size_desc: 'Largest',
};
type FilesSearch = {
	category?: FileCategory;
	cursor?: string;
	ext?: string;
	folder?: string;
	limit?: 25 | 50;
	q?: string;
	sort?: FileSort;
};

const categories = new Set<string>(FILE_CATEGORIES);
const sorts = new Set<string>(FILE_SORTS);

function validateFilesSearch(search: Record<string, unknown>): FilesSearch {
	const category =
		typeof search.category === 'string' && categories.has(search.category)
			? (search.category as FileCategory)
			: undefined;
	const sort =
		typeof search.sort === 'string' && sorts.has(search.sort)
			? (search.sort as FileSort)
			: undefined;
	return {
		category,
		cursor: typeof search.cursor === 'string' ? search.cursor : undefined,
		ext: typeof search.ext === 'string' ? search.ext.toLowerCase().slice(0, 16) : undefined,
		folder: typeof search.folder === 'string' ? search.folder : undefined,
		limit: search.limit === 50 || search.limit === '50' ? 50 : undefined,
		q: typeof search.q === 'string' ? search.q.slice(0, 100) : undefined,
		sort,
	};
}

export const Route = createFileRoute('/@{$org}/$project/asset-library/')({
	loader: async ({ context, params }) => {
		const projectData = await context.queryClient.ensureQueryData(
			crpcServer.project.getDetails.queryOptions({ orgSlug: params.org, slug: params.project })
		);
		if (!projectData?.project) throw notFound();
	},
	pendingComponent: () => <RoutePending variant='page' />,
	validateSearch: validateFilesSearch,
	head: ({ params }) => ({
		meta: [titleMeta(['Files', projectTitle(params.org, params.project)])],
	}),
	component: FilesPage,
});

function FilesPage() {
	const params = Route.useParams();
	const search = Route.useSearch();
	const router = useRouter();
	const queryClient = useQueryClient();
	const crpc = useCRPC();
	const crpcClient = useCRPCClient();
	const commandPalette = useCommandPalette();
	const [searchTerm, setSearchTerm] = useState(search.q ?? '');
	const searchTimer = useRef<number | null>(null);
	const [uploadOpen, setUploadOpen] = useState(false);
	const [folderOpen, setFolderOpen] = useState(false);
	const [manageFolderOpen, setManageFolderOpen] = useState(false);
	const [managedFolder, setManagedFolder] = useState<any | null>(null);
	const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>([]);

	const { data: projectData } = useSuspenseQuery(
		crpc.project.getDetails.queryOptions({ orgSlug: params.org, slug: params.project })
	);
	if (!projectData?.project) throw notFound();
	const project = projectData.project;
	const canManage = projectData.permissions.canManageContent;

	const foldersQuery = useQuery(crpc.file.listFolders.queryOptions({ projectId: project.id }));
	const selectedFolder = foldersQuery.data?.find((folder) => folder.id === search.folder) ?? null;
	const childFolders = (foldersQuery.data ?? []).filter(
		(folder) => (folder.parentFolderId ?? undefined) === search.folder
	);
	const breadcrumbs = buildFolderBreadcrumbs(foldersQuery.data ?? [], selectedFolder);
	const visibleFolders =
		!search.q && !search.category && !search.ext && !search.cursor ? childFolders : [];
	const folderNotFound =
		foldersQuery.isSuccess && typeof search.folder === 'string' && !selectedFolder;
	const listArgs = {
		category: search.category,
		cursor: search.cursor ?? null,
		extension: search.ext,
		folderId: search.q ? undefined : (search.folder ?? null),
		limit: search.limit ?? 25,
		projectId: project.id,
		search: search.q,
		sort: search.q ? undefined : (search.sort ?? 'created_desc'),
		sourceProvider: undefined,
	};
	const filesQuery = useQuery({
		...crpc.file.listProjectFiles.queryOptions(listArgs),
		enabled: !search.folder || (foldersQuery.isSuccess && !!selectedFolder),
	});
	const files = filesQuery.data?.page ?? [];
	const ensureThumbnailsMutation = useMutation(crpc.file.ensureThumbnails.mutationOptions());
	const missingThumbnailKey = files
		.filter((file) => file.category === 'image' && !file.thumbnailStatus)
		.map((file) => file.id)
		.join(',');
	const queueMissingThumbnails = ensureThumbnailsMutation.mutate;

	useEffect(() => {
		if (!canManage || !missingThumbnailKey) return;
		queueMissingThumbnails({ assetIds: missingThumbnailKey.split(','), projectId: project.id });
	}, [canManage, missingThumbnailKey, project.id, queueMissingThumbnails]);

	const navigateSearch = useCallback(
		(next: Partial<FilesSearch>, resetCursor = true) => {
			if (resetCursor) setCursorHistory([]);
			router.navigate({
				params,
				replace: true,
				search: {
					...search,
					...next,
					cursor: resetCursor ? undefined : next.cursor,
				},
				to: '/@{$org}/$project/asset-library',
			});
		},
		[params, router, search]
	);

	useEffect(() => setSearchTerm(search.q ?? ''), [search.q]);
	useEffect(
		() => () => {
			if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
		},
		[]
	);
	useEffect(() => {
		if (folderNotFound) navigateSearch({ folder: undefined });
	}, [folderNotFound, navigateSearch]);

	const scheduleSearch = (value: string) => {
		setSearchTerm(value);
		if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
		searchTimer.current = window.setTimeout(() => {
			navigateSearch({ q: value.trim() || undefined });
			searchTimer.current = null;
		}, 250);
	};

	const chooseCategory = (category: FileCategory | undefined) =>
		navigateSearch({ category, ext: undefined, sort: undefined });
	const chooseExtension = (ext: string | undefined) =>
		navigateSearch({ category: undefined, ext, sort: undefined });
	const openFolder = (folder: string | undefined) => {
		setCursorHistory([]);
		router.navigate({
			params,
			search: {
				...search,
				cursor: undefined,
				folder,
				q: undefined,
			},
			to: '/@{$org}/$project/asset-library',
		});
	};
	const prefetchFolder = (folderId: string) => {
		void queryClient.prefetchQuery(
			crpc.file.listProjectFiles.queryOptions({
				...listArgs,
				cursor: null,
				folderId,
				search: undefined,
			})
		);
	};

	const nextPage = () => {
		const cursor = filesQuery.data?.continueCursor;
		if (!cursor || filesQuery.data?.isDone) return;
		setCursorHistory((current) => [...current, search.cursor]);
		navigateSearch({ cursor }, false);
	};
	const previousPage = () => {
		const previous = cursorHistory.at(-1);
		setCursorHistory((current) => current.slice(0, -1));
		navigateSearch({ cursor: previous }, false);
	};

	const download = async (assetId: string, name: string) => {
		try {
			const url = await crpcClient.file.getDownloadUrl.query({ assetId });
			if (!url) throw new Error('Download is unavailable');
			const response = await fetch(url);
			if (!response.ok) throw new Error('Download failed');
			const objectUrl = URL.createObjectURL(await response.blob());
			const anchor = document.createElement('a');
			anchor.href = objectUrl;
			anchor.download = name;
			anchor.click();
			URL.revokeObjectURL(objectUrl);
		} catch (error) {
			await toast.error(extractErrorMessage(error, 'Unable to download file'));
		}
	};

	return (
		<div className='flex flex-1 flex-col'>
			<div className='container flex flex-1 flex-col gap-4 py-6'>
				<div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
					<div className='relative w-full max-w-sm'>
						<Search className='absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground' />
						<Input
							aria-label='Search files'
							aria-haspopup='dialog'
							className='h-8 pr-8 pl-8'
							onClick={() => commandPalette.openFileSearch(searchTerm)}
							onKeyDown={(event) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									commandPalette.openFileSearch(searchTerm);
								}
							}}
							placeholder='Search all files in this project…'
							readOnly
							value={searchTerm}
						/>
						{searchTerm ? (
							<Button
								aria-label='Clear search'
								className='absolute top-1/2 right-1 size-6 -translate-y-1/2'
								onClick={() => scheduleSearch('')}
								size='icon-xs'
								variant='ghost'
							>
								<X className='size-3.5' />
							</Button>
						) : null}
					</div>
					{canManage ? (
						<div className='flex shrink-0 gap-2'>
							<Button variant='outline' className='gap-2' onClick={() => setFolderOpen(true)}>
								<FolderPlus className='size-4' /> New folder
							</Button>
							<Button className='gap-2' onClick={() => setUploadOpen(true)}>
								<Upload className='size-4' /> Upload
							</Button>
						</div>
					) : null}
				</div>

				<div className='flex flex-wrap items-center gap-2'>
					<Select
						value={search.category ?? 'all'}
						onValueChange={(value) =>
							chooseCategory(!value || value === 'all' ? undefined : (value as FileCategory))
						}
					>
						<SelectTrigger size='sm' className='min-w-32'>
							<SelectValue>
								{(value: string | null) =>
									value && value !== 'all'
										? value === 'package'
											? 'Packages'
											: `${value[0].toUpperCase()}${value.slice(1)}s`
										: 'All file types'
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>All file types</SelectItem>
							{FILE_CATEGORIES.map((category) => (
								<SelectItem key={category} value={category}>
									{category === 'package'
										? 'Packages'
										: `${category[0].toUpperCase()}${category.slice(1)}s`}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						value={search.ext ?? 'all'}
						onValueChange={(value) =>
							chooseExtension(!value || value === 'all' ? undefined : value)
						}
					>
						<SelectTrigger size='sm' className='min-w-32'>
							<SelectValue>
								{(value: string | null) =>
									value && value !== 'all' ? `.${value}` : 'All extensions'
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>All extensions</SelectItem>
							{Array.from(new Set(FILE_INPUT_ACCEPT.split(',').map((item) => item.slice(1)))).map(
								(extension) => (
									<SelectItem key={extension} value={extension}>
										.{extension}
									</SelectItem>
								)
							)}
						</SelectContent>
					</Select>
					<Select
						disabled={!!search.q || !!search.category || !!search.ext}
						value={search.sort ?? 'created_desc'}
						onValueChange={(value) => navigateSearch({ sort: value ?? 'created_desc' })}
					>
						<SelectTrigger size='sm' className='min-w-40'>
							<SelectValue>
								{(value: FileSort | null) =>
									value ? FILE_SORT_LABELS[value] : FILE_SORT_LABELS.created_desc
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='created_desc'>Newest created</SelectItem>
							<SelectItem value='created_asc'>Oldest created</SelectItem>
							<SelectItem value='edited_desc'>Recently edited</SelectItem>
							<SelectItem value='edited_asc'>Least recently edited</SelectItem>
							<SelectItem value='name_asc'>Name A–Z</SelectItem>
							<SelectItem value='name_desc'>Name Z–A</SelectItem>
							<SelectItem value='size_desc'>Largest</SelectItem>
							<SelectItem value='size_asc'>Smallest</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className='overflow-hidden rounded-xl border bg-card shadow-xs'>
					<div className='flex h-11 items-center justify-between gap-3 border-b px-5'>
						<nav aria-label='Folder breadcrumb' className='flex min-w-0 items-center gap-1 text-sm'>
							<button
								className={
									search.folder
										? 'shrink-0 text-muted-foreground hover:text-foreground hover:underline'
										: 'shrink-0 font-medium text-foreground'
								}
								onClick={() => openFolder(undefined)}
								type='button'
							>
								Files
							</button>
							{breadcrumbs.map((folder, index) => (
								<div className='flex min-w-0 items-center gap-1' key={folder.id}>
									<ChevronRight className='size-3.5 shrink-0 text-muted-foreground' />
									<button
										className={
											index === breadcrumbs.length - 1
												? 'truncate font-medium text-foreground'
												: 'truncate text-muted-foreground hover:text-foreground hover:underline'
										}
										onClick={() => openFolder(folder.id)}
										type='button'
									>
										{folder.name}
									</button>
								</div>
							))}
						</nav>
						{canManage && selectedFolder && !selectedFolder.systemKey ? (
							<Button
								aria-label='Manage current folder'
								onClick={() => {
									setManagedFolder(selectedFolder);
									setManageFolderOpen(true);
								}}
								size='icon-sm'
								variant='ghost'
							>
								<Pencil />
							</Button>
						) : null}
					</div>
					<div className='overflow-x-auto'>
						<table className='w-full min-w-[760px] border-collapse text-sm'>
							<thead>
								<tr className='border-b bg-muted/40 text-left text-xs tracking-wider text-muted-foreground uppercase'>
									<th className='px-5 py-3'>Name</th>
									<th className='px-4 py-3'>Category</th>
									<th className='px-4 py-3'>Size</th>
									<th className='px-4 py-3'>Date created</th>
									<th className='px-4 py-3'>Date edited</th>
									<th className='px-5 py-3'>
										<span className='sr-only'>Actions</span>
									</th>
								</tr>
							</thead>
							<tbody>
								{visibleFolders.map((folder) => (
									<FolderRow
										canManage={canManage}
										folder={folder}
										key={folder.id}
										onManage={() => {
											setManagedFolder(folder);
											setManageFolderOpen(true);
										}}
										onOpen={() => openFolder(folder.id)}
										onPrefetch={() => prefetchFolder(folder.id)}
									/>
								))}
								{filesQuery.isPending ? <LoadingRows /> : null}
								{!filesQuery.isPending && visibleFolders.length === 0 && files.length === 0 ? (
									<EmptyFiles
										inFolder={!!search.folder}
										searching={!!search.q || !!search.category || !!search.ext}
									/>
								) : null}
								{!filesQuery.isPending
									? files.map((file) => (
											<FileRow
												key={file.id}
												canManage={canManage}
												file={file}
												folders={foldersQuery.data ?? []}
												onDownload={() => download(file.id, file.name)}
												routeParams={params}
											/>
										))
									: null}
							</tbody>
						</table>
					</div>
					<div className='flex items-center justify-between border-t bg-muted/20 px-5 py-3'>
						<p className='text-xs text-muted-foreground'>
							Page {cursorHistory.length + 1}
							{visibleFolders.length
								? ` · ${visibleFolders.length} folder${visibleFolders.length === 1 ? '' : 's'}`
								: ''}{' '}
							· {files.length} file{files.length === 1 ? '' : 's'}
						</p>
						<div className='flex items-center gap-2'>
							<Select
								value={String(search.limit ?? 25)}
								onValueChange={(value) =>
									navigateSearch({ limit: value === '50' ? 50 : undefined })
								}
							>
								<SelectTrigger size='xs'>
									<SelectValue>{(value: string | null) => `${value ?? '25'} / page`}</SelectValue>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='25'>25 / page</SelectItem>
									<SelectItem value='50'>50 / page</SelectItem>
								</SelectContent>
							</Select>
							<Button
								variant='outline'
								size='sm'
								disabled={cursorHistory.length === 0}
								onClick={previousPage}
							>
								Previous
							</Button>
							<Button
								variant='outline'
								size='sm'
								disabled={!filesQuery.data || filesQuery.data.isDone}
								onClick={nextPage}
							>
								Next
							</Button>
						</div>
					</div>
				</div>
			</div>

			{canManage ? (
				<UploadDialog
					folders={foldersQuery.data ?? []}
					initialFolderId={search.folder ?? null}
					onOpenChange={setUploadOpen}
					open={uploadOpen}
					projectId={project.id}
				/>
			) : null}
			{canManage ? (
				<CreateFolderDialog
					currentFolderName={selectedFolder?.name ?? 'Files'}
					onOpenChange={setFolderOpen}
					open={folderOpen}
					parentFolderId={search.folder ?? null}
					projectId={project.id}
				/>
			) : null}
			{canManage && managedFolder ? (
				<ManageFolderDialog
					folder={managedFolder}
					folders={foldersQuery.data ?? []}
					onDeleted={() => {
						if (search.folder === managedFolder.id)
							openFolder(managedFolder.parentFolderId ?? undefined);
					}}
					onOpenChange={setManageFolderOpen}
					open={manageFolderOpen}
				/>
			) : null}
		</div>
	);
}

function FolderRow({
	canManage,
	folder,
	onManage,
	onOpen,
	onPrefetch,
}: {
	canManage: boolean;
	folder: any;
	onManage: () => void;
	onOpen: () => void;
	onPrefetch: () => void;
}) {
	return (
		<tr
			className='group border-b border-border/40 hover:bg-muted/30'
			onFocus={onPrefetch}
			onMouseEnter={onPrefetch}
		>
			<td className='px-5 py-3'>
				<button
					className='flex cursor-pointer items-center gap-3 text-left'
					onClick={onOpen}
					type='button'
				>
					<span className='flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50'>
						<Folder className='size-4 text-muted-foreground' />
					</span>
					<span className='max-w-72 truncate font-medium hover:underline'>{folder.name}</span>
				</button>
			</td>
			<td className='px-4 py-3'>
				<Badge variant='outline'>Folder</Badge>
			</td>
			<td className='px-4 py-3 text-muted-foreground'>—</td>
			<td className='px-4 py-3 text-muted-foreground'>{formatDate(folder.createdTime)}</td>
			<td className='px-4 py-3 text-muted-foreground'>{formatDate(folder.updatedTime)}</td>
			<td className='px-5 py-3 text-right'>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button aria-label={`Actions for ${folder.name}`} size='icon-sm' variant='ghost'>
							<MoreHorizontal />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align='end'>
						<DropdownMenuItem onClick={onOpen}>
							<Folder /> Open folder
						</DropdownMenuItem>
						{canManage && !folder.systemKey ? (
							<DropdownMenuItem onClick={onManage}>
								<Pencil /> Manage folder
							</DropdownMenuItem>
						) : null}
					</DropdownMenuContent>
				</DropdownMenu>
			</td>
		</tr>
	);
}

function FileRow({
	canManage,
	file,
	folders,
	onDownload,
	routeParams,
}: {
	canManage: boolean;
	file: any;
	folders: Array<any>;
	onDownload: () => void;
	routeParams: { org: string; project: string };
}) {
	const crpc = useCRPC();
	const removeMutation = useMutation(crpc.file.removeAsset.mutationOptions());
	const renameMutation = useMutation(crpc.file.renameAsset.mutationOptions());
	const [editOpen, setEditOpen] = useState(false);
	const [moveOpen, setMoveOpen] = useState(false);
	const currentBaseName = getFileBaseName(file.name, file.extension);
	const [name, setName] = useState(currentBaseName);
	const [thumbnailFailed, setThumbnailFailed] = useState(false);
	const Icon = fileIcon(file.category);
	useEffect(() => setThumbnailFailed(false), [file.thumbnailUrl]);
	const openEditor = () => {
		setName(getFileBaseName(file.name, file.extension));
		setEditOpen(true);
	};
	const remove = async () => {
		if (!window.confirm(`Delete ${file.name}? This cannot be undone.`)) return;
		try {
			await removeMutation.mutateAsync({ assetId: file.id });
			capturePostHogEvent('file_deleted', {
				category: file.category,
				origin_feature: file.originFeature,
			});
			await toast.success('File deleted');
		} catch (error) {
			await toast.error(extractErrorMessage(error, 'Unable to delete file'));
		}
	};
	const save = async () => {
		try {
			if (name.trim() !== currentBaseName)
				await renameMutation.mutateAsync({ assetId: file.id, name });
			setEditOpen(false);
			await toast.success('File renamed');
		} catch (error) {
			await toast.error(extractErrorMessage(error, 'Unable to update file'));
		}
	};
	return (
		<>
			<tr className='group border-b border-border/40 last:border-0 hover:bg-muted/30'>
				<td className='px-5 py-3'>
					<div className='flex items-center gap-3'>
						<span className='flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/50'>
							{file.thumbnailUrl && !thumbnailFailed ? (
								<img
									alt=''
									className='size-full object-cover'
									decoding='async'
									fetchPriority='low'
									loading='lazy'
									onError={() => setThumbnailFailed(true)}
									src={file.thumbnailUrl}
								/>
							) : (
								<Icon className='size-4 text-muted-foreground' />
							)}
						</span>
						<div className='min-w-0'>
							<Link
								className='block max-w-72 truncate font-medium hover:underline'
								params={{ ...routeParams, fileId: file.id }}
								to='/@{$org}/$project/asset-library/$fileId'
							>
								{file.name}
							</Link>
							<p className='text-[11px] text-muted-foreground'>{file.mimeType}</p>
						</div>
					</div>
				</td>
				<td className='px-4 py-3'>
					<Badge variant='outline' className='capitalize'>
						{file.category}
					</Badge>
				</td>
				<td className='px-4 py-3 font-mono text-xs text-muted-foreground'>
					{formatBytes(file.sizeBytes ?? 0)}
				</td>
				<td className='px-4 py-3 text-muted-foreground'>{formatDate(file.createdTime)}</td>
				<td className='px-4 py-3 text-muted-foreground'>{formatDate(file.updatedTime)}</td>
				<td className='px-5 py-3 text-right'>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant='ghost' size='icon-sm'>
								<MoreHorizontal />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align='end'>
							{file.deliveryUrl ? (
								<DropdownMenuItem
									onClick={() => window.open(file.deliveryUrl, '_blank', 'noopener,noreferrer')}
								>
									<ExternalLink /> Open file
								</DropdownMenuItem>
							) : null}
							<DropdownMenuItem onClick={onDownload}>
								<Download /> Download
							</DropdownMenuItem>
							{canManage ? (
								<>
									<DropdownMenuItem onClick={openEditor}>
										<Pencil /> Rename
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => setMoveOpen(true)}>
										<FolderInput /> Move to folder
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem variant='destructive' onClick={remove}>
										<Trash2 /> Delete
									</DropdownMenuItem>
								</>
							) : null}
						</DropdownMenuContent>
					</DropdownMenu>
				</td>
			</tr>
			{canManage ? (
				<Dialog open={editOpen} onOpenChange={setEditOpen}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Edit file</DialogTitle>
							<DialogDescription>Rename the file without changing its extension.</DialogDescription>
						</DialogHeader>
						<div className='space-y-3'>
							<div className='flex items-stretch'>
								<Input
									aria-label='File name'
									className='rounded-r-none'
									value={name}
									onChange={(event) => setName(event.target.value)}
								/>
								<span className='flex items-center rounded-r-lg border border-l-0 border-input bg-muted px-3 font-mono text-sm text-muted-foreground'>
									.{file.extension}
								</span>
							</div>
						</div>
						<DialogFooter>
							<Button variant='outline' onClick={() => setEditOpen(false)}>
								Cancel
							</Button>
							<Button disabled={!name.trim() || renameMutation.isPending} onClick={save}>
								Save
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			) : null}
			{canManage ? (
				<MoveFileDialog file={file} folders={folders} onOpenChange={setMoveOpen} open={moveOpen} />
			) : null}
		</>
	);
}

function UploadDialog({
	folders,
	initialFolderId,
	onOpenChange,
	open,
	projectId,
}: {
	folders: Array<any>;
	initialFolderId: string | null;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	projectId: string;
}) {
	const crpc = useCRPC();
	const crpcClient = useCRPCClient();
	const createMutation = useMutation(crpc.file.createDirectUploadBatch.mutationOptions());
	const completeMutation = useMutation(crpc.file.completeUpload.mutationOptions());
	const [selectedFiles, setSelectedFiles] = useState<Array<globalThis.File>>([]);
	const [folderId, setFolderId] = useState<string | null>(initialFolderId);
	const [error, setError] = useState<string | null>(null);
	const [step, setStep] = useState<'files' | 'destination'>('files');
	const [uploading, setUploading] = useState(false);
	useEffect(() => {
		if (!open) return;
		setFolderId(initialFolderId);
		setSelectedFiles([]);
		setError(null);
		setStep('files');
	}, [initialFolderId, open]);
	const selectedBytes = selectedFiles.reduce((sum, file) => sum + file.size, 0);

	const chooseFiles = (event: ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(event.target.files ?? []);
		setError(null);
		setSelectedFiles([]);
		if (files.length > MAX_DIRECT_UPLOAD_BATCH_FILES)
			return setError(`Choose at most ${MAX_DIRECT_UPLOAD_BATCH_FILES} files.`);
		if (files.reduce((sum, file) => sum + file.size, 0) > MAX_DIRECT_UPLOAD_BATCH_BYTES)
			return setError('The selected batch is larger than 50 MiB.');
		for (const file of files) {
			const policy = getFileFormatPolicy(file.name);
			if (!policy) return setError(`${file.name} is not an allowed format.`);
			if (file.size > policy.maxBytes)
				return setError(`${file.name} exceeds its ${formatBytes(policy.maxBytes)} limit.`);
		}
		setSelectedFiles(files);
	};

	const upload = async () => {
		if (!selectedFiles.length) return;
		setError(null);
		setUploading(true);
		try {
			const intents = await createMutation.mutateAsync({
				files: selectedFiles.map((file) => ({
					mimeType: file.type || 'application/octet-stream',
					name: file.name,
					sizeBytes: file.size,
				})),
				folderId,
				projectId,
			});
			for (const [index, intent] of intents.entries()) {
				const file = selectedFiles[index];
				await uploadFileToSignedUrl(intent.url, file);
				await completeMutation.mutateAsync({ assetId: intent.assetId, key: intent.key });
				await waitForUploadReady(crpcClient, intent.assetId, file.name);
				const policy = getFileFormatPolicy(file.name);
				capturePostHogEvent('file_uploaded', {
					category: policy?.category,
					creation_method: 'direct',
					origin_feature: 'files',
					size_bucket: sizeBucket(file.size),
					uploader_class: 'staff',
				});
			}
			await toast.success(
				`${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'} uploaded`
			);
			setSelectedFiles([]);
			onOpenChange(false);
		} catch (uploadError) {
			const message = extractErrorMessage(uploadError, 'Unable to upload files');
			setError(message);
			capturePostHogEvent('file_upload_failed', {
				failure_reason: 'upload_or_completion',
				origin_feature: 'files',
			});
		} finally {
			setUploading(false);
		}
	};
	const handleOpenChange = (nextOpen: boolean) => {
		if (uploading && !nextOpen) return;
		onOpenChange(nextOpen);
	};

	return (
		<ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
			<ResponsiveDialogContent
				className='flex flex-col gap-0 overflow-hidden p-0'
				dialogClassName='max-h-[90vh] sm:max-w-lg'
				showCloseButton={false}
			>
				<ResponsiveDialogHeader
					icon={<Upload />}
					subtitle='Public project files · 100 MiB free-tier limit'
					title='Upload files'
				/>
				<UploadStepIndicator step={step} />
				<ResponsiveDialogBody>
					{step === 'files' ? (
						<div className='space-y-4'>
							<label className='group flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border/90 bg-muted/15 p-8 text-center transition-colors hover:border-primary/35 hover:bg-primary/5'>
								<span className='flex size-11 items-center justify-center rounded-xl border bg-background text-muted-foreground shadow-xs transition-transform group-hover:-translate-y-0.5 group-hover:text-foreground'>
									<Upload className='size-5' />
								</span>
								<span className='font-medium'>Choose up to 10 files</span>
								<span className='text-xs text-muted-foreground'>50 MiB maximum per batch</span>
								<input
									accept={FILE_INPUT_ACCEPT}
									className='sr-only'
									multiple
									onChange={chooseFiles}
									type='file'
								/>
							</label>
							{selectedFiles.length ? (
								<div className='overflow-hidden rounded-xl border bg-card'>
									<div className='flex items-center justify-between border-b bg-muted/25 px-3 py-2 text-xs text-muted-foreground'>
										<span>
											{selectedFiles.length} file{selectedFiles.length === 1 ? '' : 's'} selected
										</span>
										<span>{formatBytes(selectedBytes)}</span>
									</div>
									<div className='max-h-40 space-y-0.5 overflow-y-auto p-1.5'>
										{selectedFiles.map((file) => (
											<div
												className='flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm'
												key={`${file.name}-${file.size}`}
											>
												<File className='size-3.5 shrink-0 text-muted-foreground' />
												<span className='min-w-0 flex-1 truncate'>{file.name}</span>
												<span className='shrink-0 text-xs text-muted-foreground'>
													{formatBytes(file.size)}
												</span>
											</div>
										))}
									</div>
								</div>
							) : null}
						</div>
					) : (
						<div>
							<div className='space-y-2'>
								<p className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
									Choose destination
								</p>
								<FolderPicker
									disabled={uploading}
									folders={folders}
									onValueChange={setFolderId}
									value={folderId}
								/>
							</div>
						</div>
					)}
					{error ? <p className='mt-3 text-sm text-destructive'>{error}</p> : null}
				</ResponsiveDialogBody>
				<ResponsiveDialogFooter className='justify-between'>
					<Button
						disabled={uploading}
						onClick={() => (step === 'destination' ? setStep('files') : onOpenChange(false))}
						size='sm'
						variant='outline'
					>
						{step === 'destination' ? 'Back' : 'Cancel'}
					</Button>
					{step === 'files' ? (
						<Button
							disabled={!selectedFiles.length}
							onClick={() => setStep('destination')}
							size='sm'
						>
							Choose destination <ChevronRight />
						</Button>
					) : (
						<Button disabled={uploading} onClick={upload} size='sm'>
							<Upload /> {uploading ? 'Uploading…' : 'Upload here'}
						</Button>
					)}
				</ResponsiveDialogFooter>
			</ResponsiveDialogContent>
		</ResponsiveDialog>
	);
}

function UploadStepIndicator({ step }: { step: 'files' | 'destination' }) {
	return (
		<div className='border-b bg-muted/15 px-5 py-3'>
			<ol className='mx-auto flex max-w-sm items-center gap-3 text-xs'>
				<li className='flex items-center gap-2 font-medium text-foreground'>
					<span className='flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground'>
						{step === 'destination' ? '✓' : '1'}
					</span>
					Files
				</li>
				<span
					aria-hidden='true'
					className={cn('h-px flex-1', step === 'destination' ? 'bg-primary/50' : 'bg-border')}
				/>
				<li
					className={cn(
						'flex items-center gap-2',
						step === 'destination' ? 'font-medium text-foreground' : 'text-muted-foreground'
					)}
				>
					<span
						className={cn(
							'flex size-5 items-center justify-center rounded-full border text-[11px] font-semibold',
							step === 'destination'
								? 'border-primary bg-primary text-primary-foreground'
								: 'bg-card'
						)}
					>
						2
					</span>
					Destination
				</li>
			</ol>
		</div>
	);
}

async function uploadFileToSignedUrl(url: string, file: globalThis.File): Promise<void> {
	const body = await file.arrayBuffer();
	if (body.byteLength !== file.size) {
		throw new Error(`Could not read all of ${file.name}. Please choose the file again.`);
	}
	await new Promise<void>((resolve, reject) => {
		const request = new XMLHttpRequest();
		request.open('PUT', url);
		request.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
		request.onload = () => {
			if (request.status >= 200 && request.status < 300) resolve();
			else reject(new Error(`Upload failed for ${file.name} (R2 returned ${request.status})`));
		};
		request.onerror = () =>
			reject(new Error(`Upload failed for ${file.name} before R2 returned a response`));
		request.send(body);
	});
}

async function waitForUploadReady(
	crpcClient: ReturnType<typeof useCRPCClient>,
	assetId: string,
	fileName: string
): Promise<void> {
	for (let attempt = 0; attempt < 60; attempt += 1) {
		const status = await crpcClient.file.getUploadStatus.query({ assetId });
		if (status === 'ready') return;
		if (status === 'rejected' || status === 'deleted' || status === null) {
			throw new Error(`${fileName} could not be verified after upload. Please try again.`);
		}
		await new Promise((resolve) => window.setTimeout(resolve, 250));
	}
	throw new Error(`${fileName} is still being verified. Please try again in a moment.`);
}

function CreateFolderDialog({
	currentFolderName,
	onOpenChange,
	open,
	parentFolderId,
	projectId,
}: {
	currentFolderName: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	parentFolderId: string | null;
	projectId: string;
}) {
	const crpc = useCRPC();
	const mutation = useMutation(crpc.file.createFolder.mutationOptions());
	const [name, setName] = useState('');
	const create = async () => {
		try {
			await mutation.mutateAsync({ name, parentFolderId, projectId });
			setName('');
			onOpenChange(false);
			await toast.success('Folder created');
		} catch (error) {
			await toast.error(extractErrorMessage(error, 'Unable to create folder'));
		}
	};
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>New folder</DialogTitle>
					<DialogDescription>Create a folder inside {currentFolderName}.</DialogDescription>
				</DialogHeader>
				<Input
					autoFocus
					value={name}
					onChange={(event) => setName(event.target.value)}
					placeholder='Folder name'
				/>
				<DialogFooter>
					<Button variant='outline' onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button disabled={!name.trim() || mutation.isPending} onClick={create}>
						Create folder
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ManageFolderDialog({
	folder,
	folders,
	onDeleted,
	onOpenChange,
	open,
}: {
	folder: any;
	folders: Array<any>;
	onDeleted: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const crpc = useCRPC();
	const rename = useMutation(crpc.file.renameFolder.mutationOptions());
	const move = useMutation(crpc.file.moveFolder.mutationOptions());
	const remove = useMutation(crpc.file.removeFolder.mutationOptions());
	const [name, setName] = useState(folder.name as string);
	const [parentFolderId, setParentFolderId] = useState<string>(folder.parentFolderId ?? 'root');
	useEffect(() => {
		setName(folder.name);
		setParentFolderId(folder.parentFolderId ?? 'root');
	}, [folder.name, folder.parentFolderId]);
	const excludedFolderIds = folderDescendantIds(folders, folder.id);
	const save = async () => {
		try {
			if (name.trim() !== folder.name) await rename.mutateAsync({ folderId: folder.id, name });
			if ((parentFolderId === 'root' ? null : parentFolderId) !== (folder.parentFolderId ?? null))
				await move.mutateAsync({
					folderId: folder.id,
					parentFolderId: parentFolderId === 'root' ? null : parentFolderId,
				});
			onOpenChange(false);
			await toast.success('Folder updated');
		} catch (error) {
			await toast.error(extractErrorMessage(error, 'Unable to rename folder'));
		}
	};
	const destroy = async () => {
		if (!window.confirm(`Delete the empty folder ${folder.name}?`)) return;
		try {
			await remove.mutateAsync({ folderId: folder.id });
			onOpenChange(false);
			onDeleted();
			await toast.success('Folder deleted');
		} catch (error) {
			await toast.error(extractErrorMessage(error, 'Unable to delete folder'));
		}
	};
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Manage folder</DialogTitle>
					<DialogDescription>
						Rename or move this folder, or delete it once it is empty.
					</DialogDescription>
				</DialogHeader>
				<div className='space-y-3'>
					<Input value={name} onChange={(event) => setName(event.target.value)} />
					<Select
						value={parentFolderId}
						onValueChange={(value) => setParentFolderId(value ?? 'root')}
					>
						<SelectTrigger className='w-full'>
							<Folder />
							<SelectValue>
								{(value: string | null) =>
									value && value !== 'root' ? folderPathLabel(folders, value) : 'Files (root)'
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='root'>Files (root)</SelectItem>
							{sortFoldersByPath(folders)
								.filter(
									(candidate) => candidate.id !== folder.id && !excludedFolderIds.has(candidate.id)
								)
								.map((candidate) => (
									<SelectItem key={candidate.id} value={candidate.id}>
										{folderPathLabel(folders, candidate.id)}
									</SelectItem>
								))}
						</SelectContent>
					</Select>
				</div>
				<DialogFooter>
					<Button variant='destructive' disabled={remove.isPending} onClick={destroy}>
						Delete folder
					</Button>
					<Button variant='outline' onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button disabled={!name.trim() || rename.isPending || move.isPending} onClick={save}>
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function LoadingRows() {
	return (
		<>
			{Array.from({ length: 5 }).map((_, index) => (
				<tr key={index} className='border-b'>
					<td className='px-5 py-5' colSpan={6}>
						<div className='h-5 animate-pulse rounded bg-muted' />
					</td>
				</tr>
			))}
		</>
	);
}
function EmptyFiles({ inFolder, searching }: { inFolder: boolean; searching: boolean }) {
	return (
		<tr>
			<td colSpan={6} className='py-16 text-center'>
				<div className='mx-auto flex max-w-sm flex-col items-center gap-2'>
					<File className='size-8 text-muted-foreground/50' />
					<p className='font-medium'>
						{searching ? 'No matching files' : inFolder ? 'This folder is empty' : 'No files yet'}
					</p>
					<p className='text-sm text-muted-foreground'>
						{searching
							? 'Try another search or filter.'
							: inFolder
								? 'Upload a file or create a folder here.'
								: 'Uploads and connected project assets will appear here.'}
					</p>
				</div>
			</td>
		</tr>
	);
}
function buildFolderBreadcrumbs(folders: Array<any>, currentFolder: any | null) {
	if (!currentFolder) return [];
	const byId = new Map(folders.map((folder) => [folder.id, folder]));
	const breadcrumbs: Array<any> = [];
	const seen = new Set<string>();
	let current: any | undefined = currentFolder;
	while (current && breadcrumbs.length < 12 && !seen.has(current.id)) {
		seen.add(current.id);
		breadcrumbs.unshift(current);
		current = current.parentFolderId ? byId.get(current.parentFolderId) : undefined;
	}
	return breadcrumbs;
}
function folderPathLabel(folders: Array<any>, folderId: string) {
	const folder = folders.find((candidate) => candidate.id === folderId);
	if (!folder) return 'Unknown folder';
	return buildFolderBreadcrumbs(folders, folder)
		.map((candidate) => candidate.name)
		.join(' / ');
}
function sortFoldersByPath(folders: Array<any>) {
	return [...folders].sort((a, b) =>
		folderPathLabel(folders, a.id).localeCompare(folderPathLabel(folders, b.id))
	);
}
function folderDescendantIds(folders: Array<any>, folderId: string) {
	const descendants = new Set<string>();
	const pending = [folderId];
	while (pending.length) {
		const parentId = pending.pop()!;
		for (const folder of folders) {
			if (folder.parentFolderId !== parentId || descendants.has(folder.id)) continue;
			descendants.add(folder.id);
			pending.push(folder.id);
		}
	}
	return descendants;
}
function fileIcon(category: string) {
	if (category === 'image') return FileImage;
	if (category === 'video') return FileVideo;
	if (category === 'package') return FileArchive;
	if (category === 'document' || category === 'text' || category === 'data') return FileText;
	return File;
}
function formatBytes(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
	return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
}
function formatDate(timestamp: number) {
	return new Intl.DateTimeFormat('en-US', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
	}).format(new Date(timestamp));
}
function sizeBucket(bytes: number) {
	if (bytes < 1024 ** 2) return 'under_1_mib';
	if (bytes < 10 * 1024 ** 2) return '1_to_10_mib';
	return '10_to_25_mib';
}
