'use client';

import type { ApiOutputs } from '@convex/api';
import type { FormEvent } from 'react';

import { useState } from 'react';
import { getFileBaseName } from '@convex/files';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound, useNavigate } from '@tanstack/react-router';
import { Copy, Download, ExternalLink, Folder, FolderInput, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Field } from '@/components/field';
import { MoveFileDialog } from '@/components/files/move-file-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	ResponsiveDialog,
	ResponsiveDialogBody,
	ResponsiveDialogContent,
	ResponsiveDialogFooter,
	ResponsiveDialogHeader,
} from '@/components/ui/responsive-dialog';
import { useCRPC, useCRPCClient } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { extractErrorMessage } from '@/lib/errors';
import { capturePostHogEvent } from '@/lib/posthog';
import { cn } from '@/lib/utils';

import { formatBytes } from '../../-components/file-explorer';
import { fileCategoryIcon, FilePreviewBody } from '../../-components/file-preview-body';
import { useFilesWorkspace } from '../../-components/files-workspace-context';

type FileViewSearch = {
	tab?: 'details' | 'preview';
};

function validateFileViewSearch(search: Record<string, unknown>): FileViewSearch {
	return {
		tab: search.tab === 'details' ? 'details' : undefined,
	};
}

export const Route = createFileRoute('/@{$org}/$project/files/file/$fileId/')({
	component: FileWorkspacePreview,
	loader: async ({ context, params }) => {
		const projectData = await context.queryClient.ensureQueryData(
			crpcServer.project.getDetails.queryOptions({ orgSlug: params.org, slug: params.project })
		);
		if (!projectData?.project) throw notFound();
		const file = await context.queryClient.ensureQueryData(
			crpcServer.file.getFileDetail.queryOptions({
				assetId: params.fileId,
				projectId: projectData.project.id,
			})
		);
		if (!file) throw notFound();
	},
	validateSearch: validateFileViewSearch,
});

function FileWorkspacePreview() {
	const params = Route.useParams();
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const { folders, projectId } = useFilesWorkspace();
	const crpc = useCRPC();
	const crpcClient = useCRPCClient();
	const [moveOpen, setMoveOpen] = useState(false);
	const [renameOpen, setRenameOpen] = useState(false);
	const [draftName, setDraftName] = useState('');
	const [renameError, setRenameError] = useState('');
	const renameMutation = useMutation(crpc.file.renameAsset.mutationOptions());
	const removeMutation = useMutation(crpc.file.removeAsset.mutationOptions());
	const { data: file } = useSuspenseQuery(
		crpc.file.getFileDetail.queryOptions({ assetId: params.fileId, projectId })
	);
	if (!file) throw notFound();
	const HeaderIcon = fileCategoryIcon(file.category);
	const tab = search.tab ?? 'preview';
	const currentBaseName = getFileBaseName(file.name, file.extension);
	const trimmedDraftName = draftName.trim();
	const canSaveRename =
		trimmedDraftName.length > 0 &&
		trimmedDraftName.length <= 255 &&
		trimmedDraftName !== currentBaseName &&
		!renameMutation.isPending;

	const download = async () => {
		try {
			const url = await crpcClient.file.getDownloadUrl.query({ assetId: file.id });
			if (!url) throw new Error('Download is unavailable');
			window.location.assign(url);
		} catch (error) {
			toast.error(extractErrorMessage(error, 'Unable to download file'));
		}
	};

	const openRename = () => {
		setDraftName(currentBaseName);
		setRenameError('');
		setRenameOpen(true);
	};

	const saveRename = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!canSaveRename) return;
		setRenameError('');
		try {
			await renameMutation.mutateAsync({ assetId: file.id, name: trimmedDraftName });
			setRenameOpen(false);
			toast.success('File renamed');
		} catch (error) {
			setRenameError(extractErrorMessage(error, 'Unable to rename file'));
		}
	};

	const remove = async () => {
		if (!window.confirm(`Delete ${file.name}? This cannot be undone.`)) return;
		try {
			await removeMutation.mutateAsync({ assetId: file.id });
			capturePostHogEvent('file_deleted', {
				category: file.category,
				origin_feature: file.sourceAndUsage?.originFeature ?? 'files',
			});
			toast.success('File deleted');
			if (file.folder?.id) {
				await navigate({
					params: { folderId: file.folder.id, org: params.org, project: params.project },
					to: '/@{$org}/$project/files/folder/$folderId',
				});
			} else {
				await navigate({
					params: { org: params.org, project: params.project },
					to: '/@{$org}/$project/files',
				});
			}
		} catch (error) {
			toast.error(extractErrorMessage(error, 'Unable to delete file'));
		}
	};

	return (
		<div className='flex min-h-0 flex-1 flex-col py-6'>
			{file.canManage ? (
				<ResponsiveDialog onOpenChange={setRenameOpen} open={renameOpen}>
					<ResponsiveDialogContent
						className='flex flex-col gap-0 overflow-hidden p-0'
						dialogClassName='max-h-[85vh] sm:max-w-md'
						showCloseButton={false}
					>
						<ResponsiveDialogHeader icon={<Pencil />} title='Rename file' />
						<form className='flex min-h-0 flex-1 flex-col' onSubmit={saveRename}>
							<ResponsiveDialogBody>
								<Field error={renameError} label='File name'>
									<div className='flex items-stretch'>
										<Input
											autoFocus
											className='rounded-r-none'
											disabled={renameMutation.isPending}
											maxLength={255}
											onChange={(event) => {
												setDraftName(event.target.value);
												setRenameError('');
											}}
											value={draftName}
										/>
										<span className='flex items-center rounded-r-lg border border-l-0 border-input bg-muted px-3 font-mono text-sm text-muted-foreground'>
											.{file.extension}
										</span>
									</div>
								</Field>
							</ResponsiveDialogBody>
							<ResponsiveDialogFooter>
								<Button onClick={() => setRenameOpen(false)} type='button' variant='outline'>
									Cancel
								</Button>
								<Button disabled={!canSaveRename} type='submit'>
									{renameMutation.isPending ? 'Saving…' : 'Save'}
								</Button>
							</ResponsiveDialogFooter>
						</form>
					</ResponsiveDialogContent>
				</ResponsiveDialog>
			) : null}
			<div className='mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
				<div className='flex min-w-0 items-start gap-3'>
					<span className='mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground shadow-xs'>
						<HeaderIcon className='size-4' />
					</span>
					<div className='min-w-0'>
						<h1 className='truncate text-xl font-semibold tracking-tight'>{file.name}</h1>
						<p className='mt-1 text-sm text-muted-foreground'>
							{file.mimeType} · {formatBytes(file.sizeBytes)}
						</p>
					</div>
				</div>
				<div className='flex flex-wrap gap-2'>
					<Button onClick={download} size='sm'>
						<Download /> Download
					</Button>
					<Button asChild size='sm' variant='outline'>
						<a href={file.deliveryUrl} rel='noreferrer' target='_blank'>
							<ExternalLink /> Open original
						</a>
					</Button>
					<Button
						onClick={() => {
							void navigator.clipboard.writeText(window.location.href);
							toast.success('Preview link copied');
						}}
						size='sm'
						variant='outline'
					>
						<Copy /> Copy link
					</Button>
					{file.canManage ? (
						<>
							<Button onClick={openRename} size='sm' variant='outline'>
								<Pencil /> Rename
							</Button>
							<Button onClick={() => setMoveOpen(true)} size='sm' variant='outline'>
								<FolderInput /> Move
							</Button>
						</>
					) : null}
				</div>
			</div>

			<div className='mb-4 flex items-center border-b'>
				{(['preview', 'details'] as const).map((nextTab) => (
					<button
						className={cn(
							'-mb-px border-b-2 px-3 py-2 text-sm font-normal transition-colors',
							tab === nextTab
								? 'border-primary text-foreground'
								: 'border-transparent text-muted-foreground/55 hover:text-muted-foreground'
						)}
						key={nextTab}
						onClick={() =>
							void navigate({
								replace: true,
								search: (previous) => ({
									...previous,
									tab: nextTab === 'preview' ? undefined : nextTab,
								}),
							})
						}
						type='button'
					>
						{nextTab === 'preview' ? 'Preview' : 'Details'}
					</button>
				))}
			</div>

			{tab === 'preview' ? (
				<FilePreviewBody file={file} />
			) : (
				<FileDetails
					file={file}
					onDelete={remove}
					params={params}
					removePending={removeMutation.isPending}
				/>
			)}

			{file.canManage ? (
				<MoveFileDialog
					file={{ folderId: file.folder?.id, id: file.id, name: file.name }}
					folders={folders}
					onOpenChange={setMoveOpen}
					open={moveOpen}
				/>
			) : null}
		</div>
	);
}

function FileDetails({
	file,
	onDelete,
	params,
	removePending,
}: {
	file: NonNullable<ApiOutputs['file']['getFileDetail']>;
	onDelete: () => Promise<void>;
	params: { fileId: string; org: string; project: string };
	removePending: boolean;
}) {
	return (
		<div className='grid gap-5 xl:grid-cols-2'>
			<section className='rounded-xl border bg-card p-5 shadow-xs'>
				<h2 className='mb-4 text-sm font-semibold'>File information</h2>
				<dl className='space-y-3 text-sm'>
					<Detail label='MIME type'>{file.mimeType}</Detail>
					<Detail label='Size'>{formatBytes(file.sizeBytes)}</Detail>
					<Detail label='Folder'>
						<Link
							className='inline-flex items-center gap-1.5 hover:underline'
							params={
								file.folder?.id
									? { folderId: file.folder.id, org: params.org, project: params.project }
									: { org: params.org, project: params.project }
							}
							to={
								file.folder?.id
									? '/@{$org}/$project/files/folder/$folderId'
									: '/@{$org}/$project/files'
							}
						>
							<Folder className='size-3.5' /> {file.folder?.name ?? 'Root'}
						</Link>
					</Detail>
					<Detail label='Created'>{formatDateTime(file.createdTime)}</Detail>
					<Detail label='Last edited'>{formatDateTime(file.updatedTime)}</Detail>
				</dl>
			</section>
			{file.sourceAndUsage ? (
				<section className='rounded-xl border bg-card p-5 shadow-xs'>
					<h2 className='mb-4 text-sm font-semibold'>Source and usage</h2>
					<dl className='space-y-3 text-sm'>
						<Detail label='Added through'>{formatLabel(file.sourceAndUsage.originFeature)}</Detail>
						<Detail label='Creation method'>
							{formatLabel(file.sourceAndUsage.creationMethod)}
						</Detail>
						<Detail label='Source provider'>
							{formatLabel(file.sourceAndUsage.sourceProvider)}
						</Detail>
						<Detail label='Storage provider'>
							{formatLabel(file.sourceAndUsage.storageProvider)}
						</Detail>
						<Detail label='Uploader class'>{formatLabel(file.sourceAndUsage.uploaderClass)}</Detail>
						<Detail label='Visibility'>{formatLabel(file.sourceAndUsage.access)}</Detail>
						<Detail label='References'>
							{file.sourceAndUsage.referenceCount}
							{file.sourceAndUsage.referencesTruncated ? '+' : ''}
						</Detail>
						<Detail label='File ID'>
							<code className='text-[11px] break-all'>{file.id}</code>
						</Detail>
					</dl>
					{file.sourceAndUsage.references.length ? (
						<div className='mt-4 flex flex-wrap gap-1.5 border-t pt-4'>
							{Array.from(
								new Set(
									file.sourceAndUsage.references.map(
										(reference) =>
											`${formatLabel(reference.feature)} · ${formatLabel(reference.field)}`
									)
								)
							).map((reference) => (
								<Badge key={reference} variant='secondary'>
									{reference}
								</Badge>
							))}
						</div>
					) : null}
				</section>
			) : null}
			{file.canManage ? (
				<section className='rounded-xl border border-destructive/25 bg-card p-5 xl:col-span-2'>
					<div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
						<div>
							<h2 className='text-sm font-semibold'>Delete file</h2>
							<p className='mt-1 text-sm text-muted-foreground'>
								Permanently remove this file and its stored object.
							</p>
						</div>
						<Button disabled={removePending} onClick={() => void onDelete()} variant='destructive'>
							<Trash2 /> {removePending ? 'Deleting…' : 'Delete file'}
						</Button>
					</div>
				</section>
			) : null}
		</div>
	);
}

function Detail({ children, label }: { children: React.ReactNode; label: string }) {
	return (
		<div className='grid grid-cols-[110px_minmax(0,1fr)] gap-4'>
			<dt className='text-muted-foreground'>{label}</dt>
			<dd className='min-w-0 text-right break-words'>{children}</dd>
		</div>
	);
}

function formatDateTime(timestamp: number) {
	return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
		new Date(timestamp)
	);
}

function formatLabel(value: string) {
	return value
		.split('_')
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(' ');
}
