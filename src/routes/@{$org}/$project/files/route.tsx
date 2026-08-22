'use client';

import type { AppCommand } from '@/components/command';
import type { FileWorkspaceAction } from '@/components/files/file-workspace-actions';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import {
	createFileRoute,
	Link,
	notFound,
	Outlet,
	ScriptOnce,
	useNavigate,
	useParams,
	useRouterState,
} from '@tanstack/react-router';
import {
	ChevronRight,
	FileSearch,
	FolderPlus,
	FolderTree as FolderTreeIcon,
	PanelLeftClose,
	PanelLeftOpen,
	Search,
	SlidersHorizontal,
	Upload,
} from 'lucide-react';

import { useCommandPalette, useRegisterCommands } from '@/components/command';
import {
	FileWorkspaceActions,
	ManageFolderDialog,
} from '@/components/files/file-workspace-actions';
import { RoutePending } from '@/components/route-pending';
import { useRegisterShortcuts } from '@/components/shortcuts';
import { formatBytes } from '@/components/storage-usage';
import { Button } from '@/components/ui/button';
import {
	ResponsiveDialog,
	ResponsiveDialogBody,
	ResponsiveDialogContent,
	ResponsiveDialogHeader,
} from '@/components/ui/responsive-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { useIsBelow } from '@/lib/hooks/use-mobile';
import { projectTitle, titleMeta } from '@/lib/seo';
import { cn } from '@/lib/utils';

import { buildFolderPath, FilesWorkspaceProvider } from './-components/files-workspace-context';
import { FolderTree } from './-components/folder-tree';

type FilesWorkspaceSearch = {
	action?: FileWorkspaceAction;
};

const FILES_SIDEBAR_STORAGE_KEY = 'kino:sidebar:files';
const FILES_SIDEBAR_ATTRIBUTE = 'data-files-sidebar';
const FILES_SIDEBAR_BOOTSTRAP = `try{document.documentElement.setAttribute('${FILES_SIDEBAR_ATTRIBUTE}',localStorage.getItem('${FILES_SIDEBAR_STORAGE_KEY}')==='closed'?'closed':'open')}catch{}`;

function readFilesSidebarPreference() {
	if (typeof window === 'undefined') return true;
	try {
		return window.localStorage.getItem(FILES_SIDEBAR_STORAGE_KEY) !== 'closed';
	} catch {
		return true;
	}
}

function persistFilesSidebarPreference(open: boolean) {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(FILES_SIDEBAR_STORAGE_KEY, open ? 'open' : 'closed');
	} catch {
		// Keep the in-memory state working if storage is unavailable.
	}
}

function validateFilesWorkspaceSearch(search: Record<string, unknown>): FilesWorkspaceSearch {
	return {
		action:
			search.action === 'upload' || search.action === 'new-folder' ? search.action : undefined,
	};
}

export const Route = createFileRoute('/@{$org}/$project/files')({
	component: FilesWorkspaceRoute,
	loader: async ({ context, location, params }) => {
		const projectData = await context.queryClient.ensureQueryData(
			crpcServer.project.getDetails.queryOptions({ orgSlug: params.org, slug: params.project })
		);
		if (!projectData?.project) throw notFound();

		const foldersOptions = crpcServer.file.listFolders.queryOptions({
			projectId: projectData.project.id,
		});
		const treeOptions = crpcServer.file.listFileTreeItems.queryOptions({
			projectId: projectData.project.id,
		});
		const usageOptions = crpcServer.file.getProjectUsage.queryOptions({
			projectId: projectData.project.id,
		});
		const isAdvancedSearch = location.pathname.endsWith('/files/search');
		const canViewUsage = projectData.permissions.canManageContent;

		if (typeof window === 'undefined') {
			// Ship the bounded tree snapshot with the document so a hard refresh does
			// not paint a client-only sidebar skeleton. Convex subscriptions take over
			// after hydration and keep this data current.
			await Promise.all([
				context.queryClient.ensureQueryData(foldersOptions).catch(() => undefined),
				isAdvancedSearch
					? Promise.resolve()
					: context.queryClient.ensureQueryData(treeOptions).catch(() => undefined),
				!isAdvancedSearch && canViewUsage
					? context.queryClient.ensureQueryData(usageOptions).catch(() => undefined)
					: Promise.resolve(),
			]);
			return;
		}

		// Intent preloads warm the same cache before client-side navigation.
		void context.queryClient.prefetchQuery(foldersOptions);
		if (!isAdvancedSearch) void context.queryClient.prefetchQuery(treeOptions);
		if (!isAdvancedSearch && canViewUsage) void context.queryClient.prefetchQuery(usageOptions);
	},
	pendingComponent: () => <RoutePending variant='page' />,
	validateSearch: validateFilesWorkspaceSearch,
	head: ({ params }) => ({
		meta: [titleMeta(['Files', projectTitle(params.org, params.project)])],
	}),
});

function FilesWorkspaceRoute() {
	const params = Route.useParams();
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const looseParams = useParams({ strict: false });
	const crpc = useCRPC();
	const { openFileSearch } = useCommandPalette();
	const isBelowLg = useIsBelow(1024);
	const isAdvancedSearch = useRouterState({
		select: (state) =>
			state.matches.some((match) => match.routeId === '/@{$org}/$project/files/search/'),
	});
	const [mobileTreeOpen, setMobileTreeOpen] = useState(false);
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [sidebarPreferenceLoaded, setSidebarPreferenceLoaded] = useState(false);
	const [managedFolderId, setManagedFolderId] = useState<string | null>(null);
	const openWorkspaceFileSearch = useCallback(
		(query = '') => {
			// On mobile the search controls live inside the file-tree drawer. Close
			// that parent overlay before opening the command palette so selecting a
			// result cannot reveal a still-open drawer underneath it.
			setMobileTreeOpen(false);
			openFileSearch(query);
		},
		[openFileSearch]
	);
	const toggleSidebar = useCallback(() => {
		setSidebarOpen((open) => {
			const nextOpen = !open;
			persistFilesSidebarPreference(nextOpen);
			return nextOpen;
		});
	}, []);
	useEffect(() => {
		const storedOpen = readFilesSidebarPreference();
		setSidebarOpen(storedOpen);
		setSidebarPreferenceLoaded(true);
	}, []);
	useEffect(() => {
		if (!sidebarPreferenceLoaded) return;
		document.documentElement.removeAttribute(FILES_SIDEBAR_ATTRIBUTE);
	}, [sidebarPreferenceLoaded]);
	const { data: projectData } = useSuspenseQuery(
		crpc.project.getDetails.queryOptions({ orgSlug: params.org, slug: params.project })
	);
	if (!projectData?.project) throw notFound();
	const project = projectData.project;
	const canManage = projectData.permissions.canManageContent;
	const foldersQuery = useQuery(crpc.file.listFolders.queryOptions({ projectId: project.id }));
	const treeFilesQuery = useQuery({
		...crpc.file.listFileTreeItems.queryOptions({ projectId: project.id }),
		enabled: !isAdvancedSearch,
	});
	const usageQuery = useQuery(
		crpc.file.getProjectUsage.queryOptions(
			{ projectId: project.id },
			{ enabled: canManage && !isAdvancedSearch, skipUnauth: true }
		)
	);
	const activeFileId = looseParams.fileId;
	const activeFileQuery = useQuery({
		...crpc.file.getFileDetail.queryOptions({
			assetId: activeFileId ?? '',
			projectId: project.id,
		}),
		enabled: !!activeFileId && !isAdvancedSearch,
	});
	const folders = useMemo(() => foldersQuery.data ?? [], [foldersQuery.data]);
	const treeFiles = useMemo(() => {
		const files = treeFilesQuery.data?.files ?? [];
		const activeFile = activeFileQuery.data;
		if (!activeFile || files.some((file) => file.id === activeFile.id)) return files;
		return [
			...files,
			{
				category: activeFile.category,
				folderId: activeFile.folder?.id,
				id: activeFile.id,
				name: activeFile.name,
			},
		];
	}, [activeFileQuery.data, treeFilesQuery.data?.files]);
	const contextValue = useMemo(
		() => ({ canManage, folders, manageFolder: setManagedFolderId, projectId: project.id }),
		[canManage, folders, project.id]
	);
	const currentFolderId = looseParams.folderId ?? activeFileQuery.data?.folder?.id ?? null;
	const locationFolders = buildFolderPath(folders, currentFolderId ?? undefined);
	const activeFileName = activeFileQuery.data?.name;
	const managedFolder = folders.find((folder) => folder.id === managedFolderId) ?? null;
	const openFileAction = useCallback(
		(action: FileWorkspaceAction) =>
			navigate({
				replace: true,
				search: (previous) => ({ ...previous, action }),
			}),
		[navigate]
	);
	const fileCommands = useMemo(() => {
		const commands: Array<AppCommand> = [
			{
				closeOnRun: false,
				group: 'Files' as const,
				icon: FileSearch,
				id: 'files.search',
				keywords: ['find', 'search', 'assets', 'documents', 'images'],
				title: 'Search files',
				run: () => openWorkspaceFileSearch(),
			},
		];
		if (!isBelowLg) {
			commands.push({
				group: 'Files',
				icon: sidebarOpen ? PanelLeftClose : PanelLeftOpen,
				id: 'files.toggle-sidebar',
				keywords: ['folders', 'navigation', 'tree', 'collapse', 'expand'],
				shortcut: '[',
				title: 'Toggle sidebar',
				run: toggleSidebar,
			});
		}
		if (canManage) {
			commands.push(
				{
					group: 'Files',
					icon: Upload,
					id: 'files.upload',
					keywords: ['add', 'upload', 'asset'],
					title: 'Upload a file',
					run: () => openFileAction('upload'),
				},
				{
					group: 'Files',
					icon: FolderPlus,
					id: 'files.new-folder',
					keywords: ['add', 'create', 'directory'],
					title: 'Add a folder',
					run: () => openFileAction('new-folder'),
				}
			);
		}
		return commands;
	}, [canManage, isBelowLg, openFileAction, openWorkspaceFileSearch, sidebarOpen, toggleSidebar]);
	const fileShortcuts = useMemo(
		() => [
			{
				description: 'Toggle sidebar',
				enabled: () => !isBelowLg,
				group: 'Files' as const,
				id: 'files.toggle-sidebar',
				keys: ['['],
				run: toggleSidebar,
			},
		],
		[isBelowLg, toggleSidebar]
	);
	useRegisterCommands('files', fileCommands);
	useRegisterShortcuts('files', fileShortcuts);

	const closeAction = () => {
		void navigate({
			replace: true,
			search: (previous) => ({ ...previous, action: undefined }),
		});
	};

	const controls = (
		<div className='flex w-full items-center gap-2'>
			<Button className='min-w-0 flex-1' onClick={() => openWorkspaceFileSearch()}>
				<Search className='size-3.5' /> Search
			</Button>
			<Tooltip>
				<TooltipTrigger asChild delay={200}>
					<Button aria-label='Advanced Search' asChild size='icon' variant='outline'>
						<Link params={params} to='/@{$org}/$project/files/search'>
							<SlidersHorizontal className='size-3.5' />
						</Link>
					</Button>
				</TooltipTrigger>
				<TooltipContent side='bottom'>Advanced Search</TooltipContent>
			</Tooltip>
		</div>
	);
	const fileTreeActions = canManage ? (
		<div className='mb-4 flex w-full items-center gap-2'>
			<Button
				className='min-w-0 flex-1 px-2'
				onClick={() => {
					setMobileTreeOpen(false);
					openFileAction('upload');
				}}
			>
				<Upload className='size-3.5' />
				Upload file
			</Button>
			<Button
				className='min-w-0 flex-1 px-2'
				onClick={() => {
					setMobileTreeOpen(false);
					openFileAction('new-folder');
				}}
				variant='outline'
			>
				<FolderPlus className='size-3.5' />
				Add folder
			</Button>
		</div>
	) : null;
	const usage = usageQuery.data;
	const usedPercent = usage
		? Math.min(100, (usage.usedBytes / Math.max(1, usage.limitBytes)) * 100)
		: 0;
	const reservedPercent = usage
		? Math.min(100 - usedPercent, (usage.reservedBytes / Math.max(1, usage.limitBytes)) * 100)
		: 0;
	const storageUsage = canManage ? (
		<div className='shrink-0 border-t py-4 pr-5'>
			<div className='flex items-center justify-between gap-3'>
				<p className='text-[11px] font-semibold tracking-wider text-muted-foreground uppercase'>
					Storage usage
				</p>
				<Link
					className='inline-flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline'
					params={params}
					to='/@{$org}/$project/settings/storage'
				>
					View usage
					<ChevronRight className='size-3' />
				</Link>
			</div>
			{usage ? (
				<>
					<div
						aria-label={`${usedPercent.toFixed(usedPercent < 1 ? 1 : 0)}% of project storage used`}
						aria-valuemax={100}
						aria-valuemin={0}
						aria-valuenow={Math.round(usedPercent)}
						className='mt-3 flex h-1.5 overflow-hidden rounded-full bg-muted'
						role='progressbar'
					>
						<div className='bg-primary transition-[width]' style={{ width: `${usedPercent}%` }} />
						<div
							className='bg-primary/35 transition-[width]'
							style={{ width: `${reservedPercent}%` }}
						/>
					</div>
					<p className='mt-2 text-xs text-muted-foreground'>
						{formatBytes(usage.usedBytes)} of {formatBytes(usage.limitBytes)} · {usage.fileCount}{' '}
						file{usage.fileCount === 1 ? '' : 's'}
					</p>
					{usage.reservedBytes ? (
						<p className='mt-0.5 text-xs text-muted-foreground'>
							{formatBytes(usage.reservedBytes)} currently uploading
						</p>
					) : null}
				</>
			) : usageQuery.isPending ? (
				<div className='mt-3 space-y-2' aria-label='Loading storage usage'>
					<div className='h-1.5 animate-pulse rounded-full bg-muted' />
					<div className='h-3 w-32 animate-pulse rounded bg-muted' />
				</div>
			) : (
				<p className='mt-2 text-xs text-muted-foreground'>Usage unavailable</p>
			)}
		</div>
	) : null;
	const location = (
		<nav
			aria-label='Current file location'
			className='flex min-w-0 flex-1 justify-end overflow-hidden'
		>
			<div className='flex w-max min-w-full shrink-0 items-center text-sm whitespace-nowrap'>
				<button
					aria-current={!currentFolderId && !activeFileId ? 'location' : undefined}
					className={cn(
						'rounded-md px-1.5 py-1 transition-colors hover:bg-muted hover:text-foreground',
						!currentFolderId && !activeFileId ? 'text-foreground' : 'text-muted-foreground'
					)}
					onClick={() => void navigate({ params, to: '/@{$org}/$project/files' })}
					type='button'
				>
					Root
				</button>
				{locationFolders.map((folder, index) => {
					const isCurrent = !activeFileId && index === locationFolders.length - 1;
					return (
						<span className='flex items-center' key={folder.id}>
							<ChevronRight className='size-3.5 shrink-0 text-muted-foreground/55' />
							<button
								aria-current={isCurrent ? 'location' : undefined}
								className={cn(
									'rounded-md px-1.5 py-1 transition-colors hover:bg-muted hover:text-foreground',
									isCurrent ? 'text-foreground' : 'text-muted-foreground'
								)}
								onClick={() =>
									void navigate({
										params: { folderId: folder.id, ...params },
										to: '/@{$org}/$project/files/folder/$folderId',
									})
								}
								type='button'
							>
								{folder.name}
							</button>
						</span>
					);
				})}
				{activeFileId ? (
					<span className='flex items-center'>
						<ChevronRight className='size-3.5 shrink-0 text-muted-foreground/55' />
						<span aria-current='location' className='px-1.5 py-1 text-foreground'>
							{activeFileName ?? 'File'}
						</span>
					</span>
				) : null}
			</div>
		</nav>
	);

	return (
		<FilesWorkspaceProvider value={contextValue}>
			<ScriptOnce>{FILES_SIDEBAR_BOOTSTRAP}</ScriptOnce>
			{isAdvancedSearch ? (
				<div className='container flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden'>
					<Outlet />
				</div>
			) : (
				<>
					<div className='relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden'>
						<div
							aria-hidden='true'
							className='pointer-events-none absolute inset-x-0 top-20 border-b'
						/>
						<div className='container flex min-h-0 w-full min-w-0 flex-1 flex-col'>
							<div
								data-files-sidebar-grid
								className={cn(
									'flex min-h-0 w-full max-w-full min-w-0 flex-1 flex-col transition-[grid-template-columns] duration-200 ease-out motion-reduce:transition-none lg:grid',
									sidebarOpen
										? 'lg:grid-cols-[17rem_minmax(0,1fr)]'
										: 'lg:grid-cols-[0_minmax(0,1fr)]'
								)}
							>
								<aside
									aria-hidden={!sidebarOpen}
									data-files-sidebar-aside
									id='files-tree-sidebar'
									className={cn(
										'hidden min-w-0 overflow-hidden transition-colors duration-200 lg:block',
										sidebarOpen
											? 'border-r border-border/75'
											: 'pointer-events-none border-r border-transparent'
									)}
								>
									<div
										data-files-sidebar-panel
										className={cn(
											'sticky top-0 flex h-full w-[17rem] max-w-none flex-col overflow-hidden transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none',
											sidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
										)}
									>
										<div className='flex h-[81px] shrink-0 items-center pr-5'>{controls}</div>
										<div className='mt-4 min-h-0 flex-1 overflow-y-auto pr-5 pb-6'>
											{fileTreeActions}
											<p className='mb-2 px-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase'>
												File tree
											</p>
											<FolderTree
												activeFolderId={currentFolderId}
												files={treeFiles}
												isLoading={foldersQuery.isPending || treeFilesQuery.isPending}
												onManageFolder={canManage ? setManagedFolderId : undefined}
											/>
											{treeFilesQuery.data?.truncated ? (
												<p className='mt-2 px-1.5 text-xs text-muted-foreground'>
													Showing the first 500 files.
												</p>
											) : null}
										</div>
										{storageUsage}
									</div>
								</aside>

								<div className='flex w-full max-w-full min-w-0 flex-1 flex-col'>
									<div
										data-files-sidebar-main
										className={cn(
											'flex h-[81px] min-w-0 shrink-0 items-center gap-2 transition-[padding] duration-200 ease-out motion-reduce:transition-none',
											sidebarOpen ? 'lg:pl-7' : 'lg:pl-0'
										)}
									>
										<Tooltip
											onOpenChange={(open, eventDetails) => {
												if (open && eventDetails.reason === 'trigger-focus') {
													eventDetails.cancel();
												}
											}}
										>
											<TooltipTrigger asChild delay={200}>
												<Button
													aria-controls='files-tree-sidebar'
													aria-expanded={sidebarOpen}
													aria-keyshortcuts='['
													aria-label={sidebarOpen ? 'Hide folders' : 'Show folders'}
													className='hidden lg:inline-flex'
													onClick={toggleSidebar}
													size='icon'
													variant='outline'
												>
													{sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
												</Button>
											</TooltipTrigger>
											<TooltipContent className='flex items-center gap-2' side='bottom'>
												<span>Toggle Sidebar</span>
												<kbd className='rounded border border-white/20 bg-black/45 px-1.5 py-0.5 font-sans text-[10px] text-white'>
													[
												</kbd>
											</TooltipContent>
										</Tooltip>
										<Button
											aria-label='Browse files'
											className='lg:hidden'
											onClick={() => setMobileTreeOpen(true)}
											size='icon'
											variant='outline'
										>
											<FolderTreeIcon />
										</Button>
										<div className='min-w-0 flex-1'>{location}</div>
									</div>
									<div
										data-files-sidebar-main
										className={cn(
											'flex min-h-0 w-full max-w-full min-w-0 flex-1 flex-col overflow-x-hidden transition-[padding] duration-200 ease-out motion-reduce:transition-none',
											sidebarOpen ? 'lg:pl-7' : 'lg:pl-0'
										)}
									>
										<Outlet />
									</div>
								</div>
							</div>
						</div>
					</div>

					<ResponsiveDialog onOpenChange={setMobileTreeOpen} open={mobileTreeOpen}>
						<ResponsiveDialogContent
							className='flex flex-col gap-0 overflow-hidden p-0'
							dialogClassName='sm:max-w-md'
							showCloseButton={false}
						>
							<ResponsiveDialogHeader icon={<FolderTreeIcon />} title='Browse files' />
								<ResponsiveDialogBody className='p-3'>
									<div className='mb-3 border-b pb-3'>{controls}</div>
									{fileTreeActions}
									<p className='mb-2 px-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase'>
										File tree
									</p>
									<FolderTree
									activeFolderId={currentFolderId}
									files={treeFiles}
									isLoading={foldersQuery.isPending || treeFilesQuery.isPending}
									onManageFolder={canManage ? setManagedFolderId : undefined}
								/>
								{treeFilesQuery.data?.truncated ? (
									<p className='mt-2 px-1.5 text-xs text-muted-foreground'>
										Showing the first 500 files.
									</p>
								) : null}
							</ResponsiveDialogBody>
						</ResponsiveDialogContent>
					</ResponsiveDialog>
				</>
			)}

			{canManage ? (
				<FileWorkspaceActions
					action={search.action}
					currentFolderId={currentFolderId}
					folders={folders}
					onClose={closeAction}
					projectId={project.id}
				/>
			) : null}
			{canManage && managedFolder ? (
				<ManageFolderDialog
					folder={managedFolder}
					folders={folders}
					onDeleted={() => {
						if (currentFolderId === managedFolder.id) {
							void navigate({
								params,
								to: '/@{$org}/$project/files',
							});
						}
					}}
					onOpenChange={(open) => {
						if (!open) setManagedFolderId(null);
					}}
					open
				/>
			) : null}
		</FilesWorkspaceProvider>
	);
}
