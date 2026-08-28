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
import * as m from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';

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
			if (!url) throw new Error(m.files_download_unavailable());
			window.location.assign(url);
		} catch (error) {
			toast.error(extractErrorMessage(error, m.files_download_failed()));
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
			toast.success(m.files_renamed());
		} catch (error) {
			setRenameError(extractErrorMessage(error, m.files_rename_failed()));
		}
	};

	const remove = async () => {
		if (!window.confirm(m.files_delete_confirm({ name: file.name }))) return;
		try {
			await removeMutation.mutateAsync({ assetId: file.id });
			capturePostHogEvent('file_deleted', {
				category: file.category,
				origin_feature: file.sourceAndUsage?.originFeature ?? 'files',
			});
			toast.success(m.files_deleted());
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
			toast.error(extractErrorMessage(error, m.files_delete_failed()));
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
						<ResponsiveDialogHeader icon={<Pencil />} title={m.files_rename_title()} />
						<form className='flex min-h-0 flex-1 flex-col' onSubmit={saveRename}>
							<ResponsiveDialogBody>
								<Field error={renameError} label={m.files_file_name()}>
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
									{m.common_cancel()}
								</Button>
								<Button disabled={!canSaveRename} type='submit'>
									{renameMutation.isPending ? m.common_saving() : m.profile_save_changes()}
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
						<Download /> {m.files_download()}
					</Button>
					<Button asChild size='sm' variant='outline'>
						<a href={file.deliveryUrl} rel='noreferrer' target='_blank'>
							<ExternalLink /> {m.files_open_original()}
						</a>
					</Button>
					<Button
						onClick={() => {
							void navigator.clipboard.writeText(window.location.href);
							toast.success(m.files_link_copied());
						}}
						size='sm'
						variant='outline'
					>
						<Copy /> {m.files_copy_link()}
					</Button>
					{file.canManage ? (
						<>
							<Button onClick={openRename} size='sm' variant='outline'>
								<Pencil /> {m.files_rename()}
							</Button>
							<Button onClick={() => setMoveOpen(true)} size='sm' variant='outline'>
								<FolderInput /> {m.files_move()}
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
						{nextTab === 'preview' ? m.files_preview() : m.files_details()}
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
				<h2 className='mb-4 text-sm font-semibold'>{m.files_information()}</h2>
				<dl className='space-y-3 text-sm'>
					<Detail label={m.files_mime_type()}>{file.mimeType}</Detail>
					<Detail label={m.files_size()}>{formatBytes(file.sizeBytes)}</Detail>
					<Detail label={m.files_folder()}>
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
							<Folder className='size-3.5' /> {file.folder?.name ?? m.files_root()}
						</Link>
					</Detail>
					<Detail label={m.files_created()}>{formatDateTime(file.createdTime)}</Detail>
					<Detail label={m.files_last_edited()}>{formatDateTime(file.updatedTime)}</Detail>
				</dl>
			</section>
			{file.sourceAndUsage ? (
				<section className='rounded-xl border bg-card p-5 shadow-xs'>
					<h2 className='mb-4 text-sm font-semibold'>{m.files_source_usage()}</h2>
					<dl className='space-y-3 text-sm'>
						<Detail label={m.files_added_through()}>
							{formatLabel(file.sourceAndUsage.originFeature)}
						</Detail>
						<Detail label={m.files_creation_method()}>
							{formatLabel(file.sourceAndUsage.creationMethod)}
						</Detail>
						<Detail label={m.files_source_provider()}>
							{formatLabel(file.sourceAndUsage.sourceProvider)}
						</Detail>
						<Detail label={m.files_storage_provider()}>
							{formatLabel(file.sourceAndUsage.storageProvider)}
						</Detail>
						<Detail label={m.files_uploader_class()}>
							{formatLabel(file.sourceAndUsage.uploaderClass)}
						</Detail>
						<Detail label={m.files_visibility()}>{formatLabel(file.sourceAndUsage.access)}</Detail>
						<Detail label={m.files_references()}>
							{file.sourceAndUsage.referenceCount}
							{file.sourceAndUsage.referencesTruncated ? '+' : ''}
						</Detail>
						<Detail label={m.files_id()}>
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
							<h2 className='text-sm font-semibold'>{m.files_delete_file()}</h2>
							<p className='mt-1 text-sm text-muted-foreground'>{m.files_delete_description()}</p>
						</div>
						<Button disabled={removePending} onClick={() => void onDelete()} variant='destructive'>
							<Trash2 /> {removePending ? m.files_deleting() : m.files_delete_file()}
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
	return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(
		new Date(timestamp)
	);
}

function formatLabel(value: string) {
	const labels: Record<string, () => string> = {
		direct: m.files_label_direct,
		feature: m.files_label_feature,
		feedback_attachment: m.storage_label_feedback_attachment,
		files: m.storage_label_files,
		google_drive: m.files_label_google_drive,
		integration: m.storage_label_integration,
		kino: () => 'Kino',
		org_avatar: m.storage_label_org_avatar,
		private_user: m.files_label_private_user,
		project_header: m.storage_label_project_header,
		project_staff: m.files_label_project_staff,
		public: m.files_label_public,
		s3: m.files_label_s3,
		staff: m.storage_label_staff,
		system: m.storage_label_system,
		update_body: m.storage_label_update_body,
		update_cover: m.storage_label_update_cover,
		user: m.storage_label_user,
		user_avatar: m.storage_label_user_avatar,
		wiki_attachment: m.storage_label_wiki_attachment,
		youtube: m.files_label_youtube,
	};
	if (labels[value]) return labels[value]();
	return value
		.split('_')
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(' ');
}
