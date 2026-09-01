'use client';

import type { FormEvent } from 'react';

import { useState } from 'react';
import { getFileBaseName, getFileFormatPolicy } from '@convex/files';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import go from 'highlight.js/lib/languages/go';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import plaintext from 'highlight.js/lib/languages/plaintext';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import shell from 'highlight.js/lib/languages/shell';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import {
	Copy,
	Download,
	ExternalLink,
	FileArchive,
	FileCode2,
	FileImage,
	FileText,
	FileVideo,
	Folder,
	FolderInput,
	Info,
	Trash2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Field } from '@/components/field';
import { MoveFileDialog } from '@/components/files/move-file-dialog';
import { RoutePending } from '@/components/route-pending';
import { SidebarSection } from '@/components/sidebar-section';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EditIcon } from '@/icons';
import { useCRPC, useCRPCClient } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { extractErrorMessage } from '@/lib/errors';
import { useSidebarState } from '@/lib/hooks/use-sidebar-state';
import { capturePostHogEvent } from '@/lib/posthog';
import { projectTitle, titleMeta } from '@/lib/seo';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

import css from 'highlight.js/lib/languages/css';

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('css', css);
hljs.registerLanguage('go', go);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('plaintext', plaintext);
hljs.registerLanguage('python', python);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('shell', shell);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('yaml', yaml);

const FILE_SIDEBAR_STORAGE_KEY = 'file-detail-sidebar-state';

const DEFAULT_FILE_SIDEBAR_STATE = {
	information: true,
	sourceAndUsage: true,
};

export const Route = createFileRoute('/@{$org}/$project/asset-library/$fileId/')({
	component: FilePreviewPage,
	loader: async ({ context, params }) => {
		const projectData = await context.queryClient.ensureQueryData(
			crpcServer.project.getDetails.queryOptions({
				orgSlug: params.org,
				slug: params.project,
			})
		);
		if (!projectData?.project) throw notFound();
		const file = await context.queryClient.ensureQueryData(
			crpcServer.file.getFileDetail.queryOptions({
				assetId: params.fileId,
				projectId: projectData.project.id,
			})
		);
		if (!file) throw notFound();
		return { name: file.name };
	},
	pendingComponent: () => <RoutePending variant='page' />,
	head: ({ loaderData, params }) => ({
		meta: [
			titleMeta([
				loaderData?.name ?? 'File preview',
				'Files',
				projectTitle(params.org, params.project),
			]),
		],
	}),
});

function FilePreviewPage() {
	const params = Route.useParams();
	const router = useRouter();
	const crpc = useCRPC();
	const crpcClient = useCRPCClient();
	const projectQuery = useSuspenseQuery(
		crpc.project.getDetails.queryOptions({ orgSlug: params.org, slug: params.project })
	);
	const project = projectQuery.data?.project;
	if (!project) throw notFound();
	const fileQuery = useSuspenseQuery(
		crpc.file.getFileDetail.queryOptions({ assetId: params.fileId, projectId: project.id })
	);
	const file = fileQuery.data;
	if (!file) throw notFound();
	const foldersQuery = useSuspenseQuery(
		crpc.file.listFolders.queryOptions({ projectId: project.id })
	);

	const removeMutation = useMutation(crpc.file.removeAsset.mutationOptions());
	const renameMutation = useMutation(crpc.file.renameAsset.mutationOptions());
	const [imageFailed, setImageFailed] = useState(false);
	const [moveOpen, setMoveOpen] = useState(false);
	const [renameOpen, setRenameOpen] = useState(false);
	const [draftName, setDraftName] = useState('');
	const [renameError, setRenameError] = useState('');
	const HeaderIcon = fileCategoryIcon(file.category);
	const previewKind = getFileFormatPolicy(file.extension)?.preview ?? 'download';
	const isImagePreview = previewKind === 'image';
	const isTextPreview = previewKind === 'text';
	const currentBaseName = getFileBaseName(file.name, file.extension);
	const trimmedDraftName = draftName.trim();
	const canSaveRename =
		trimmedDraftName.length > 0 &&
		trimmedDraftName.length <= 255 &&
		trimmedDraftName !== currentBaseName &&
		!renameMutation.isPending;
	const { state: sidebarState, setSection: setSidebarSection } = useSidebarState(
		FILE_SIDEBAR_STORAGE_KEY,
		DEFAULT_FILE_SIDEBAR_STATE
	);

	const download = async () => {
		try {
			const url = await crpcClient.file.getDownloadUrl.query({ assetId: file.id });
			if (!url) throw new Error('Download is unavailable');
			const response = await fetch(url);
			if (!response.ok) throw new Error('Download failed');
			const objectUrl = URL.createObjectURL(await response.blob());
			const anchor = document.createElement('a');
			anchor.href = objectUrl;
			anchor.download = file.name;
			anchor.click();
			URL.revokeObjectURL(objectUrl);
		} catch (error) {
			await toast.error(extractErrorMessage(error, 'Unable to download file'));
		}
	};

	const copyLink = async () => {
		await navigator.clipboard.writeText(window.location.href);
		await toast.success('Preview link copied');
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
			await toast.success('File renamed');
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
			await toast.success('File deleted');
			await router.navigate({
				params: { org: params.org, project: params.project },
				to: '/@{$org}/$project/asset-library',
			});
		} catch (error) {
			await toast.error(extractErrorMessage(error, 'Unable to delete file'));
		}
	};

	return (
		<div className='flex flex-1 flex-col'>
			{file.canManage ? (
				<>
					<ResponsiveDialog onOpenChange={setRenameOpen} open={renameOpen}>
						<ResponsiveDialogContent
							className='flex flex-col gap-0 overflow-hidden p-0'
							dialogClassName='max-h-[85vh] sm:max-w-md'
							showCloseButton={false}
						>
							<ResponsiveDialogHeader icon={<EditIcon />} title='Rename file' />
							<form className='flex min-h-0 flex-1 flex-col' onSubmit={saveRename}>
								<ResponsiveDialogBody className='flex flex-col gap-4'>
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
									<Button
										disabled={renameMutation.isPending}
										onClick={() => setRenameOpen(false)}
										size='sm'
										type='button'
										variant='outline'
									>
										Cancel
									</Button>
									<Button disabled={!canSaveRename} size='sm' type='submit'>
										{renameMutation.isPending ? 'Saving...' : 'Save'}
									</Button>
								</ResponsiveDialogFooter>
							</form>
						</ResponsiveDialogContent>
					</ResponsiveDialog>
					<MoveFileDialog
						file={{ folderId: file.folder?.id, id: file.id, name: file.name }}
						folders={foldersQuery.data}
						onOpenChange={setMoveOpen}
						open={moveOpen}
					/>
				</>
			) : null}
			<header className='border-b'>
				<div className='container flex items-start gap-4 pt-8 pb-6 [--max-width:52rem] lg:[--max-width:75rem]'>
					<div className='mt-1 flex size-7 shrink-0 items-center justify-center text-muted-foreground'>
						<HeaderIcon className='size-6' />
					</div>
					<div className='flex min-w-0 flex-1 flex-col gap-2'>
						{file.canManage ? (
							<Tooltip>
								<TooltipTrigger
									className='group relative -mx-3 -my-1.5 flex cursor-pointer rounded-lg px-3 py-1.5 text-left max-md:pointer-events-none'
									onClick={openRename}
									type='button'
								>
									<span
										aria-hidden
										className='pointer-events-none absolute inset-0 scale-95 rounded-lg bg-accent opacity-0 ring-1 ring-accent transition-all duration-200 md:group-hover:scale-100 md:group-hover:opacity-100'
									/>
									<h1 className='relative text-xl break-words md:text-3xl'>{file.name}</h1>
								</TooltipTrigger>
								<TooltipContent align='start' alignOffset={12}>
									Click to edit
								</TooltipContent>
							</Tooltip>
						) : (
							<h1 className='text-xl break-words md:text-3xl'>{file.name}</h1>
						)}
						<div className='flex flex-wrap items-center gap-2 text-sm text-muted-foreground'>
							<Link
								className='font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:underline'
								params={{ org: params.org, project: params.project }}
								to='/@{$org}/$project/asset-library'
							>
								View all files
							</Link>
							<span aria-hidden='true'>·</span>
							<span>{formatLabel(file.category)}</span>
							{file.canManage ? (
								<>
									<span aria-hidden='true' className='md:hidden'>
										·
									</span>
									<button
										className='font-medium text-foreground underline underline-offset-2 md:hidden'
										onClick={openRename}
										type='button'
									>
										Edit name
									</button>
								</>
							) : null}
						</div>
					</div>
				</div>
			</header>

			<div className='container flex flex-1 flex-col [--max-width:52rem] lg:[--max-width:75rem]'>
				<div className='flex flex-1 flex-col gap-8 lg:grid lg:grid-cols-12'>
					<main className='flex min-w-0 flex-col py-6 lg:col-span-8 lg:py-8'>
						<div
							className={cn(
								'flex min-h-[62vh] items-center justify-center overflow-hidden rounded-lg border',
								isTextPreview ? 'bg-card' : 'bg-background',
								isImagePreview &&
									'bg-[repeating-conic-gradient(from_0deg,color-mix(in_oklab,var(--muted)_40%,var(--background))_0_25%,transparent_0_50%)] bg-[length:20px_20px]'
							)}
						>
							<FilePreview
								file={file}
								imageFailed={imageFailed}
								onImageError={() => setImageFailed(true)}
							/>
						</div>
					</main>

					<aside className='order-last py-6 lg:col-span-4 lg:border-l lg:border-border/75 lg:py-8 lg:pl-8'>
						<div className='flex flex-col gap-6 lg:sticky lg:top-4'>
							<div className='flex flex-wrap items-center gap-2'>
								<Button onClick={download}>
									<Download /> Download
								</Button>
								<Button asChild variant='outline'>
									<a href={file.deliveryUrl} rel='noreferrer' target='_blank'>
										<ExternalLink /> Open original
									</a>
								</Button>
								<Button variant='outline' onClick={copyLink}>
									<Copy /> Copy link
								</Button>
								{file.canManage ? (
									<Button variant='outline' onClick={() => setMoveOpen(true)}>
										<FolderInput /> Move
									</Button>
								) : null}
							</div>

							<SidebarSection
								icon={<Info className='size-3.5' />}
								onOpenChange={(open) => setSidebarSection('information', open)}
								open={sidebarState.information}
								title='File information'
							>
								<dl className='space-y-3 text-sm'>
									<Detail label='MIME type'>{file.mimeType}</Detail>
									<Detail label='Size'>{formatBytes(file.sizeBytes)}</Detail>
									<Detail label='Folder'>
										<Link
											className='inline-flex items-center gap-1.5 text-foreground underline-offset-2 hover:underline'
											params={{ org: params.org, project: params.project }}
											search={{ folder: file.folder?.id }}
											to='/@{$org}/$project/asset-library'
										>
											<Folder className='size-3.5' /> {file.folder?.name ?? 'Root'}
										</Link>
									</Detail>
									<Detail label='Uploaded by'>
										{file.uploadedBy?.name ?? file.uploadedBy?.username ?? 'Kino'}
									</Detail>
									<Detail label='Created'>{formatDateTime(file.createdTime)}</Detail>
									<Detail label='Last edited'>{formatDateTime(file.updatedTime)}</Detail>
								</dl>
							</SidebarSection>

							{file.sourceAndUsage ? (
								<SidebarSection
									icon={<Info className='size-3.5' />}
									onOpenChange={(open) => setSidebarSection('sourceAndUsage', open)}
									open={sidebarState.sourceAndUsage}
									title='Source and usage'
								>
									<dl className='space-y-3 text-sm'>
										<Detail label='Added through'>
											{formatLabel(file.sourceAndUsage.originFeature)}
										</Detail>
										<Detail label='Creation method'>
											{formatLabel(file.sourceAndUsage.creationMethod)}
										</Detail>
										<Detail label='Source provider'>
											{formatLabel(file.sourceAndUsage.sourceProvider)}
										</Detail>
										<Detail label='Storage provider'>
											{formatLabel(file.sourceAndUsage.storageProvider)}
										</Detail>
										<Detail label='Uploader class'>
											{formatLabel(file.sourceAndUsage.uploaderClass)}
										</Detail>
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
										<div className='mt-4 border-t pt-3'>
											<p className='mb-2 text-xs font-medium text-muted-foreground'>Used in</p>
											<div className='flex flex-wrap gap-1.5'>
												{Array.from(
													new Set(
														file.sourceAndUsage.references.map(
															(reference: { entityType: string; feature: string; field: string }) =>
																`${formatLabel(reference.feature)} · ${formatLabel(reference.field)}`
														)
													)
												).map((reference) => (
													<Badge key={reference} variant='secondary'>
														{reference}
													</Badge>
												))}
											</div>
										</div>
									) : null}
								</SidebarSection>
							) : null}

							{file.canManage ? (
								<div className='border-t pt-4'>
									<Button disabled={removeMutation.isPending} onClick={remove} variant='outline'>
										<Trash2 /> Delete file
									</Button>
								</div>
							) : null}
						</div>
					</aside>
				</div>
			</div>
		</div>
	);
}

function FilePreview({
	file,
	imageFailed,
	onImageError,
}: {
	file: any;
	imageFailed: boolean;
	onImageError: () => void;
}) {
	const preview = getFileFormatPolicy(file.extension)?.preview ?? 'download';
	if (preview === 'image' && !imageFailed) {
		return (
			<img
				alt={file.name}
				className='max-h-[78vh] max-w-full object-contain'
				onError={onImageError}
				src={file.deliveryUrl}
			/>
		);
	}
	if (preview === 'video') {
		return (
			<video className='max-h-[78vh] w-full bg-black' controls preload='metadata'>
				<source src={file.deliveryUrl} type={file.mimeType} />
			</video>
		);
	}
	if (preview === 'pdf') {
		return <iframe className='h-[78vh] w-full' src={file.deliveryUrl} title={file.name} />;
	}
	if (preview === 'text') {
		return <TextPreview extension={file.extension} name={file.name} text={file.previewText} />;
	}
	return (
		<DownloadOnlyPreview category={file.category} extension={file.extension} name={file.name} />
	);
}

function TextPreview({
	extension,
	name,
	text,
}: {
	extension: string;
	name: string;
	text: string | null;
}) {
	if (!text) {
		return (
			<div className='max-w-md px-6 py-16 text-center'>
				<FileText className='mx-auto mb-4 size-10 text-muted-foreground' />
				<h2 className='font-semibold'>Text preview is being prepared</h2>
				<p className='mt-1 text-sm text-muted-foreground'>
					Download {name} to view it immediately.
				</p>
			</div>
		);
	}
	if (extension === 'md' || extension === 'mdx') {
		return (
			<div className='markdown-prose w-full max-w-4xl self-start px-6 py-8 md:px-10'>
				<ReactMarkdown
					remarkPlugins={[remarkGfm]}
					components={{
						a: ({ children, ...props }) => (
							<a {...props} rel='noreferrer' target='_blank'>
								{children}
							</a>
						),
						code: ({ children, className, ...props }) => {
							const value = String(children).replace(/\n$/, '');
							const language = /language-([\w-]+)/.exec(className ?? '')?.[1];
							if (!language && !value.includes('\n')) {
								return (
									<code className={className} {...props}>
										{children}
									</code>
								);
							}
							return (
								<code
									className={cn(className, 'hljs')}
									dangerouslySetInnerHTML={{ __html: highlightSource(value, language) }}
								/>
							);
						},
					}}
				>
					{text}
				</ReactMarkdown>
				{text.length >= 30_000 ? <PreviewLimitNotice /> : null}
			</div>
		);
	}

	const formatted = (() => {
		if (extension !== 'json') return text;
		try {
			return JSON.stringify(JSON.parse(text), null, 2);
		} catch {
			return text;
		}
	})();
	const language = rawTextLanguage(extension);
	return (
		<div className='w-full self-stretch overflow-auto p-5'>
			<pre className='min-w-max font-mono text-xs leading-5'>
				<code
					className='hljs'
					dangerouslySetInnerHTML={{ __html: highlightSource(formatted, language) }}
				/>
			</pre>
			{text.length >= 30_000 ? <PreviewLimitNotice /> : null}
		</div>
	);
}

function PreviewLimitNotice() {
	return (
		<p className='mt-4 rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground'>
			Preview limited to the first 30,000 characters. Download the file to view everything.
		</p>
	);
}

function DownloadOnlyPreview({
	category,
	extension,
	name,
}: {
	category: string;
	extension: string;
	name: string;
}) {
	const Icon = fileCategoryIcon(category);
	return (
		<div className='max-w-md px-6 py-16 text-center'>
			<span className='mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl border bg-muted/50'>
				<Icon className='size-7 text-muted-foreground' />
			</span>
			<h2 className='font-semibold'>{name}</h2>
			<p className='mt-1 text-sm text-muted-foreground'>
				.{extension} files are download-only in this preview version.
			</p>
		</div>
	);
}

function Detail({ children, label }: { children: React.ReactNode; label: string }) {
	return (
		<div className='grid grid-cols-[105px_minmax(0,1fr)] gap-3'>
			<dt className='text-muted-foreground'>{label}</dt>
			<dd className='flex min-w-0 items-center justify-end text-right break-words'>{children}</dd>
		</div>
	);
}

function fileCategoryIcon(category: string) {
	if (category === 'image') return FileImage;
	if (category === 'video') return FileVideo;
	if (category === 'package') return FileArchive;
	if (category === 'design') return FileCode2;
	return FileText;
}

function highlightSource(source: string, requestedLanguage?: string) {
	const aliases: Record<string, string> = {
		html: 'xml',
		js: 'javascript',
		jsx: 'javascript',
		md: 'markdown',
		mdx: 'markdown',
		py: 'python',
		sh: 'shell',
		text: 'plaintext',
		ts: 'typescript',
		tsx: 'typescript',
		yml: 'yaml',
	};
	const language = aliases[requestedLanguage ?? ''] ?? requestedLanguage;
	return language && hljs.getLanguage(language)
		? hljs.highlight(source, { language }).value
		: hljs.highlight(source, { language: 'plaintext' }).value;
}

function rawTextLanguage(extension: string) {
	if (extension === 'txt' || extension === 'csv') return 'plaintext';
	return extension;
}

function formatBytes(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
	return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
}

function formatDateTime(timestamp: number) {
	return new Intl.DateTimeFormat('en-US', {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(new Date(timestamp));
}

function formatLabel(value: string) {
	return value
		.split('_')
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(' ');
}
