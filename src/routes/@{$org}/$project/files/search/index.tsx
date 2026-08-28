'use client';

import type { ApiOutputs } from '@convex/api';
import type { FormEvent } from 'react';

import { useEffect, useState } from 'react';
import { FILE_CATEGORIES, FILE_INPUT_ACCEPT, FILE_SOURCE_PROVIDERS } from '@convex/files';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
	File,
	FileArchive,
	FileImage,
	FileText,
	FileVideo,
	Folder,
	Search,
	SlidersHorizontal,
	X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { useCRPC } from '@/lib/convex/crpc';
import * as m from '@/paraglide/messages.js';

import { formatBytes, formatDate } from '../-components/file-explorer';
import { useFilesWorkspace } from '../-components/files-workspace-context';

type FileCategory = (typeof FILE_CATEGORIES)[number];
type FileSourceProvider = (typeof FILE_SOURCE_PROVIDERS)[number];
type SearchResult = ApiOutputs['file']['listProjectFiles']['page'][number];

type AdvancedFileSearch = {
	category?: FileCategory;
	cursor?: string;
	ext?: string;
	q?: string;
	source?: FileSourceProvider;
};

const categories = new Set<string>(FILE_CATEGORIES);
const sources = new Set<string>(FILE_SOURCE_PROVIDERS);

function validateAdvancedFileSearch(search: Record<string, unknown>): AdvancedFileSearch {
	return {
		category:
			typeof search.category === 'string' && categories.has(search.category)
				? (search.category as FileCategory)
				: undefined,
		cursor: typeof search.cursor === 'string' ? search.cursor : undefined,
		ext: typeof search.ext === 'string' ? search.ext.toLowerCase().slice(0, 16) : undefined,
		q: typeof search.q === 'string' ? search.q.slice(0, 100) : undefined,
		source:
			typeof search.source === 'string' && sources.has(search.source)
				? (search.source as FileSourceProvider)
				: undefined,
	};
}

export const Route = createFileRoute('/@{$org}/$project/files/search/')({
	component: AdvancedFilesSearch,
	validateSearch: validateAdvancedFileSearch,
});

function AdvancedFilesSearch() {
	const params = Route.useParams();
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const { folders, projectId } = useFilesWorkspace();
	const crpc = useCRPC();
	const [query, setQuery] = useState(search.q ?? '');
	useEffect(() => setQuery(search.q ?? ''), [search.q]);
	const filesQuery = useQuery(
		crpc.file.listProjectFiles.queryOptions({
			category: search.category,
			cursor: search.cursor ?? null,
			extension: search.ext,
			folderId: undefined,
			limit: 25,
			projectId,
			search: search.q,
			sort: search.q ? undefined : 'created_desc',
			sourceProvider: search.source,
		})
	);
	const files = filesQuery.data?.page ?? [];
	const activeFilters = [search.q, search.category, search.ext, search.source].filter(
		Boolean
	).length;
	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		void navigate({
			search: (previous) => ({ ...previous, cursor: undefined, q: query.trim() || undefined }),
		});
	};
	const clear = () => {
		setQuery('');
		void navigate({ replace: true, search: {} });
	};

	return (
		<div className='flex min-h-0 flex-1 flex-col py-6'>
			<div className='mb-5'>
				<div className='flex items-center gap-2 text-sm font-medium'>
					<SlidersHorizontal className='size-4' /> {m.files_advanced_search()}
				</div>
				<p className='mt-1 text-sm text-muted-foreground'>{m.files_search_description()}</p>
			</div>
			<form className='rounded-xl border bg-card p-4 shadow-xs' onSubmit={submit}>
				<div className='relative'>
					<Search className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
					<Input
						className='h-10 pr-10 pl-9'
						onChange={(event) => setQuery(event.target.value)}
						placeholder={m.files_search_placeholder()}
						value={query}
					/>
					{query ? (
						<button
							aria-label={m.files_clear_query()}
							className='absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground'
							onClick={() => setQuery('')}
							type='button'
						>
							<X className='size-4' />
						</button>
					) : null}
				</div>
				<div className='mt-3 flex flex-wrap items-center gap-2'>
					<Select
						value={search.category ?? 'all'}
						onValueChange={(value) => {
							const nextValue = value ?? 'all';
							void navigate({
								replace: true,
								search: (previous) => ({
									...previous,
									category: nextValue === 'all' ? undefined : (nextValue as FileCategory),
									cursor: undefined,
									ext: nextValue === 'all' ? previous.ext : undefined,
								}),
							});
						}}
					>
						<SelectTrigger className='min-w-40'>
							<SelectValue>
								{(value: string | null) =>
									value && value !== 'all' ? categoryLabel(value) : m.files_all_categories()
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>{m.files_all_categories()}</SelectItem>
							{FILE_CATEGORIES.map((category) => (
								<SelectItem key={category} value={category}>
									{categoryLabel(category)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						value={search.ext ?? 'all'}
						onValueChange={(value) => {
							const nextValue = value ?? 'all';
							void navigate({
								replace: true,
								search: (previous) => ({
									...previous,
									category: nextValue === 'all' ? previous.category : undefined,
									cursor: undefined,
									ext: nextValue === 'all' ? undefined : nextValue,
								}),
							});
						}}
					>
						<SelectTrigger className='min-w-36'>
							<SelectValue>
								{(value: string | null) =>
									value && value !== 'all' ? `.${value}` : m.files_all_extensions()
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>{m.files_all_extensions()}</SelectItem>
							{extensions.map((extension) => (
								<SelectItem key={extension} value={extension}>
									.{extension}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						value={search.source ?? 'all'}
						onValueChange={(value) => {
							const nextValue = value ?? 'all';
							void navigate({
								replace: true,
								search: (previous) => ({
									...previous,
									cursor: undefined,
									source: nextValue === 'all' ? undefined : (nextValue as FileSourceProvider),
								}),
							});
						}}
					>
						<SelectTrigger className='min-w-36'>
							<SelectValue>
								{(value: string | null) =>
									value && value !== 'all' ? sourceLabel(value) : m.files_all_sources()
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>{m.files_all_sources()}</SelectItem>
							{FILE_SOURCE_PROVIDERS.map((source) => (
								<SelectItem key={source} value={source}>
									{sourceLabel(source)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className='mt-3 flex justify-end gap-2'>
					{activeFilters ? (
						<Button onClick={clear} type='button' variant='ghost'>
							{m.files_clear()}
						</Button>
					) : null}
					<Button type='submit'>
						<Search /> {m.files_search()}
					</Button>
				</div>
			</form>

			<div className='mt-5 overflow-hidden rounded-xl border bg-card shadow-xs'>
				<div className='flex h-11 items-center justify-between border-b bg-muted/20 px-4'>
					<p className='text-sm font-medium'>{m.files_results()}</p>
					<p className='text-xs text-muted-foreground'>
						{m.files_on_page({ count: files.length })}
					</p>
				</div>
				<div className='divide-y'>
					{filesQuery.isPending
						? Array.from({ length: 5 }).map((_, index) => (
								<div className='p-4' key={index}>
									<div className='h-10 animate-pulse rounded bg-muted' />
								</div>
							))
						: null}
					{!filesQuery.isPending && !files.length ? (
						<div className='py-20 text-center'>
							<File className='mx-auto mb-3 size-8 text-muted-foreground/45' />
							<p className='font-medium'>{m.files_no_matches()}</p>
							<p className='mt-1 text-sm text-muted-foreground'>{m.files_no_matches_help()}</p>
						</div>
					) : null}
					{files.map((file) => {
						const folderName = file.folderId
							? (folders.find((folder) => folder.id === file.folderId)?.name ??
								m.files_unknown_folder())
							: m.files_root();
						return (
							<SearchResultRow file={file} folderName={folderName} key={file.id} params={params} />
						);
					})}
				</div>
				<div className='flex justify-end border-t bg-muted/15 px-4 py-3'>
					<Button
						disabled={!filesQuery.data || filesQuery.data.isDone}
						onClick={() => {
							if (filesQuery.data?.continueCursor)
								void navigate({
									search: { ...search, cursor: filesQuery.data.continueCursor },
								});
						}}
						size='sm'
						variant='outline'
					>
						{m.files_next_page()}
					</Button>
				</div>
			</div>
		</div>
	);
}

function SearchResultRow({
	file,
	folderName,
	params,
}: {
	file: SearchResult;
	folderName: string;
	params: { org: string; project: string };
}) {
	const [thumbnailFailed, setThumbnailFailed] = useState(false);
	const Icon = fileIcon(file.category);
	return (
		<Link
			className='flex items-center gap-3 p-4 transition-colors hover:bg-muted/30'
			params={{ fileId: file.id, ...params }}
			search={{}}
			to='/@{$org}/$project/files/file/$fileId'
		>
			<span className='flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/45'>
				{file.thumbnailUrl && !thumbnailFailed ? (
					<img
						alt=''
						className='size-full object-cover'
						onError={() => setThumbnailFailed(true)}
						src={file.thumbnailUrl}
					/>
				) : (
					<Icon className='size-4 text-muted-foreground' />
				)}
			</span>
			<span className='min-w-0 flex-1'>
				<span className='block truncate text-sm font-medium'>{file.name}</span>
				<span className='mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground'>
					<span className='flex min-w-0 items-center gap-1'>
						<Folder className='size-3 shrink-0' />
						<span className='truncate'>{folderName}</span>
					</span>
					<span aria-hidden>·</span>
					<span className='truncate'>{file.mimeType}</span>
					<span aria-hidden>·</span>
					<span className='shrink-0'>{formatBytes(file.sizeBytes ?? 0)}</span>
				</span>
			</span>
			<Badge className='capitalize' variant='outline'>
				{file.category}
			</Badge>
			<span className='hidden text-xs text-muted-foreground sm:block'>
				{formatDate(file.updatedTime)}
			</span>
		</Link>
	);
}

const extensions = Array.from(new Set(FILE_INPUT_ACCEPT.split(',').map((item) => item.slice(1))));
function categoryLabel(value: string) {
	const labels: Record<string, () => string> = {
		data: m.storage_label_data,
		design: m.storage_label_design,
		document: m.storage_label_document,
		image: m.storage_label_image,
		package: m.storage_label_package,
		text: m.storage_label_text,
		video: m.storage_label_video,
	};
	return labels[value]?.() ?? value;
}
function sourceLabel(value: string) {
	return value
		.split('_')
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(' ');
}
function fileIcon(category: string) {
	if (category === 'image') return FileImage;
	if (category === 'video') return FileVideo;
	if (category === 'package') return FileArchive;
	return FileText;
}
