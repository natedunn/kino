'use client';

import type { FolderPickerFolder } from '@/components/files/folder-picker-utils';
import type { ChangeEvent, FormEvent } from 'react';

import { useEffect, useState } from 'react';
import {
	FILE_INPUT_ACCEPT,
	getFileFormatPolicy,
	MAX_DIRECT_UPLOAD_BATCH_BYTES,
	MAX_DIRECT_UPLOAD_BATCH_FILES,
} from '@convex/files';
import { useMutation } from '@tanstack/react-query';
import { ChevronRight, File, FolderInput, FolderPlus, Trash2, Upload } from 'lucide-react';

import { FolderPicker } from '@/components/files/folder-picker';
import { folderDescendantIds } from '@/components/files/folder-picker-utils';
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
import { localizeError } from '@/lib/errors';
import { capturePostHogEvent } from '@/lib/posthog';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import * as m from '@/paraglide/messages.js';

export type FileWorkspaceAction = 'new-folder' | 'upload';

export function ManageFolderDialog({
	folder,
	folders,
	onDeleted,
	onOpenChange,
	open,
}: {
	folder: FolderPickerFolder;
	folders: Array<FolderPickerFolder>;
	onDeleted: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const crpc = useCRPC();
	const renameMutation = useMutation(crpc.file.renameFolder.mutationOptions());
	const moveMutation = useMutation(crpc.file.moveFolder.mutationOptions());
	const removeMutation = useMutation(crpc.file.removeFolder.mutationOptions());
	const [name, setName] = useState(folder.name);
	const [parentFolderId, setParentFolderId] = useState<string | null>(
		folder.parentFolderId ?? null
	);
	const excludedIds = folderDescendantIds(folders, folder.id);

	useEffect(() => {
		if (!open) return;
		setName(folder.name);
		setParentFolderId(folder.parentFolderId ?? null);
	}, [folder.name, folder.parentFolderId, open]);

	const save = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		try {
			if (name.trim() !== folder.name) {
				await renameMutation.mutateAsync({ folderId: folder.id, name });
			}
			if (parentFolderId !== (folder.parentFolderId ?? null)) {
				await moveMutation.mutateAsync({ folderId: folder.id, parentFolderId });
			}
			onOpenChange(false);
			await toast.success(m.files_folder_updated());
		} catch (error) {
			await toast.error(localizeError(error, m.files_folder_update_failed()));
		}
	};

	const remove = async () => {
		if (!window.confirm(m.files_folder_delete_confirm({ name: folder.name }))) return;
		try {
			await removeMutation.mutateAsync({ folderId: folder.id });
			onOpenChange(false);
			onDeleted();
			await toast.success(m.files_folder_deleted());
		} catch (error) {
			await toast.error(localizeError(error, m.files_folder_delete_failed()));
		}
	};

	return (
		<ResponsiveDialog onOpenChange={onOpenChange} open={open}>
			<ResponsiveDialogContent
				className='flex flex-col gap-0 overflow-hidden p-0'
				dialogClassName='max-h-[88vh] sm:max-w-lg'
				showCloseButton={false}
			>
				<ResponsiveDialogHeader
					icon={<FolderInput />}
					subtitle={m.files_manage_folder_description()}
					title={m.files_manage_folder_title()}
				/>
				<form onSubmit={save}>
					<ResponsiveDialogBody className='space-y-4'>
						<div className='space-y-2'>
							<label className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
								{m.files_folder_name()}
							</label>
							<Input
								disabled={renameMutation.isPending || moveMutation.isPending}
								maxLength={80}
								onChange={(event) => setName(event.target.value)}
								value={name}
							/>
						</div>
						<div className='space-y-2'>
							<label className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
								{m.files_move_to()}
							</label>
							<FolderPicker
								disabled={renameMutation.isPending || moveMutation.isPending}
								folders={folders.filter(
									(candidate) => candidate.id !== folder.id && !excludedIds.has(candidate.id)
								)}
								onValueChange={setParentFolderId}
								value={parentFolderId}
							/>
						</div>
					</ResponsiveDialogBody>
					<ResponsiveDialogFooter className='justify-between'>
						<Button
							disabled={removeMutation.isPending}
							onClick={remove}
							size='sm'
							type='button'
							variant='destructive'
						>
							<Trash2 /> {m.files_delete()}
						</Button>
						<div className='flex gap-2'>
							<Button onClick={() => onOpenChange(false)} size='sm' type='button' variant='outline'>
								{m.common_cancel()}
							</Button>
							<Button
								disabled={!name.trim() || renameMutation.isPending || moveMutation.isPending}
								size='sm'
								type='submit'
							>
								{renameMutation.isPending || moveMutation.isPending
									? m.common_saving()
									: m.profile_save_changes()}
							</Button>
						</div>
					</ResponsiveDialogFooter>
				</form>
			</ResponsiveDialogContent>
		</ResponsiveDialog>
	);
}

export function FileWorkspaceActions({
	action,
	currentFolderId,
	folders,
	onClose,
	projectId,
}: {
	action?: FileWorkspaceAction;
	currentFolderId: string | null;
	folders: Array<FolderPickerFolder>;
	onClose: () => void;
	projectId: string;
}) {
	return (
		<>
			<UploadFilesDialog
				folders={folders}
				initialFolderId={currentFolderId}
				onOpenChange={(open) => {
					if (!open) onClose();
				}}
				open={action === 'upload'}
				projectId={projectId}
			/>
			<CreateFolderDialog
				folders={folders}
				onOpenChange={(open) => {
					if (!open) onClose();
				}}
				open={action === 'new-folder'}
				parentFolderId={currentFolderId}
				projectId={projectId}
			/>
		</>
	);
}

function UploadFilesDialog({
	folders,
	initialFolderId,
	onOpenChange,
	open,
	projectId,
}: {
	folders: Array<FolderPickerFolder>;
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
		const nextFiles = Array.from(event.target.files ?? []);
		setError(null);
		setSelectedFiles([]);
		if (nextFiles.length > MAX_DIRECT_UPLOAD_BATCH_FILES) {
			setError(m.files_too_many({ count: MAX_DIRECT_UPLOAD_BATCH_FILES }));
			return;
		}
		if (nextFiles.reduce((sum, file) => sum + file.size, 0) > MAX_DIRECT_UPLOAD_BATCH_BYTES) {
			setError(m.files_batch_too_large());
			return;
		}
		for (const file of nextFiles) {
			const policy = getFileFormatPolicy(file.name);
			if (!policy) {
				setError(m.files_format_not_allowed({ name: file.name }));
				return;
			}
			if (file.size > policy.maxBytes) {
				setError(
					m.files_size_limit_exceeded({ limit: formatBytes(policy.maxBytes), name: file.name })
				);
				return;
			}
		}
		setSelectedFiles(nextFiles);
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
				capturePostHogEvent('file_uploaded', {
					category: getFileFormatPolicy(file.name)?.category,
					creation_method: 'direct',
					origin_feature: 'files',
					size_bucket: sizeBucket(file.size),
					uploader_class: 'staff',
				});
			}
			await toast.success(m.files_uploaded({ count: selectedFiles.length }));
			onOpenChange(false);
		} catch (uploadError) {
			setError(localizeError(uploadError, m.files_upload_failed()));
			capturePostHogEvent('file_upload_failed', {
				failure_reason: 'upload_or_completion',
				origin_feature: 'files',
			});
		} finally {
			setUploading(false);
		}
	};

	return (
		<ResponsiveDialog
			onOpenChange={(nextOpen) => {
				if (!uploading || nextOpen) onOpenChange(nextOpen);
			}}
			open={open}
		>
			<ResponsiveDialogContent
				className='flex flex-col gap-0 overflow-hidden p-0'
				dialogClassName='max-h-[90vh] sm:max-w-lg'
				showCloseButton={false}
			>
				<ResponsiveDialogHeader
					icon={<Upload />}
					subtitle={m.files_upload_description()}
					title={m.files_upload_title()}
				/>
				<UploadStepIndicator step={step} />
				<ResponsiveDialogBody>
					{step === 'files' ? (
						<div className='space-y-4'>
							<label className='group flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed bg-muted/15 p-8 text-center transition-colors hover:border-primary/35 hover:bg-primary/5'>
								<span className='flex size-11 items-center justify-center rounded-xl border bg-background text-muted-foreground shadow-xs transition-transform group-hover:-translate-y-0.5 group-hover:text-foreground'>
									<Upload className='size-5' />
								</span>
								<span className='font-medium'>
									{m.files_choose_up_to({ count: MAX_DIRECT_UPLOAD_BATCH_FILES })}
								</span>
								<span className='text-xs text-muted-foreground'>{m.files_batch_max()}</span>
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
										<span>{m.files_selected_count({ count: selectedFiles.length })}</span>
										<span>{formatBytes(selectedBytes)}</span>
									</div>
									<div className='max-h-40 overflow-y-auto p-1.5'>
										{selectedFiles.map((file) => (
											<div
												className='flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm'
												key={`${file.name}-${file.size}`}
											>
												<File className='size-3.5 shrink-0 text-muted-foreground' />
												<span className='min-w-0 flex-1 truncate'>{file.name}</span>
												<span className='text-xs text-muted-foreground'>
													{formatBytes(file.size)}
												</span>
											</div>
										))}
									</div>
								</div>
							) : null}
						</div>
					) : (
						<div className='space-y-2'>
							<p className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
								{m.files_choose_destination()}
							</p>
							<FolderPicker
								disabled={uploading}
								folders={folders}
								onValueChange={setFolderId}
								value={folderId}
							/>
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
						{step === 'destination' ? m.files_back() : m.common_cancel()}
					</Button>
					{step === 'files' ? (
						<Button
							disabled={!selectedFiles.length}
							onClick={() => setStep('destination')}
							size='sm'
						>
							{m.files_choose_destination()} <ChevronRight />
						</Button>
					) : (
						<Button disabled={uploading} onClick={upload} size='sm'>
							<Upload /> {uploading ? m.files_uploading() : m.files_upload()}
						</Button>
					)}
				</ResponsiveDialogFooter>
			</ResponsiveDialogContent>
		</ResponsiveDialog>
	);
}

function CreateFolderDialog({
	folders,
	onOpenChange,
	open,
	parentFolderId,
	projectId,
}: {
	folders: Array<FolderPickerFolder>;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	parentFolderId: string | null;
	projectId: string;
}) {
	const crpc = useCRPC();
	const mutation = useMutation(crpc.file.createFolder.mutationOptions());
	const [name, setName] = useState('');
	const [destinationFolderId, setDestinationFolderId] = useState<string | null>(parentFolderId);

	useEffect(() => {
		if (!open) return;
		setName('');
		setDestinationFolderId(parentFolderId);
	}, [open, parentFolderId]);

	const create = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!name.trim()) return;
		try {
			await mutation.mutateAsync({
				name,
				parentFolderId: destinationFolderId,
				projectId,
			});
			onOpenChange(false);
			await toast.success(m.files_folder_created());
		} catch (error) {
			await toast.error(localizeError(error, m.files_folder_create_failed()));
		}
	};

	return (
		<ResponsiveDialog onOpenChange={onOpenChange} open={open}>
			<ResponsiveDialogContent
				className='flex flex-col gap-0 overflow-hidden p-0'
				dialogClassName='max-h-[90vh] sm:max-w-lg'
				showCloseButton={false}
			>
				<ResponsiveDialogHeader
					icon={<FolderPlus />}
					subtitle={m.files_new_folder_description()}
					title={m.files_new_folder()}
				/>
				<form onSubmit={create}>
					<ResponsiveDialogBody className='space-y-4'>
						<div className='space-y-2'>
							<label className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
								{m.files_folder_name()}
							</label>
							<Input
								autoFocus
								disabled={mutation.isPending}
								maxLength={80}
								onChange={(event) => setName(event.target.value)}
								placeholder={m.files_folder_name()}
								value={name}
							/>
						</div>
						<div className='space-y-2'>
							<p className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
								{m.files_choose_location()}
							</p>
							<FolderPicker
								disabled={mutation.isPending}
								folders={folders}
								onValueChange={setDestinationFolderId}
								value={destinationFolderId}
							/>
						</div>
					</ResponsiveDialogBody>
					<ResponsiveDialogFooter>
						<Button onClick={() => onOpenChange(false)} size='sm' type='button' variant='outline'>
							{m.common_cancel()}
						</Button>
						<Button disabled={!name.trim() || mutation.isPending} size='sm' type='submit'>
							{mutation.isPending ? m.files_adding() : m.files_add_folder()}
						</Button>
					</ResponsiveDialogFooter>
				</form>
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
					{m.project_nav_files()}
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
					{m.files_destination()}
				</li>
			</ol>
		</div>
	);
}

async function uploadFileToSignedUrl(url: string, file: globalThis.File) {
	const body = await file.arrayBuffer();
	if (body.byteLength !== file.size) {
		throw new Error(m.files_read_failed({ name: file.name }));
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
) {
	for (let attempt = 0; attempt < 60; attempt += 1) {
		const status = await crpcClient.file.getUploadStatus.query({ assetId });
		if (status === 'ready') return;
		if (status === 'rejected' || status === 'deleted' || status === null) {
			throw new Error(m.files_verification_failed({ name: fileName }));
		}
		await new Promise((resolve) => window.setTimeout(resolve, 250));
	}
	throw new Error(m.files_verification_pending({ name: fileName }));
}

function formatBytes(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
	return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
}

function sizeBucket(bytes: number) {
	if (bytes < 1024 ** 2) return 'under_1_mib';
	if (bytes < 10 * 1024 ** 2) return '1_to_10_mib';
	return '10_to_25_mib';
}
