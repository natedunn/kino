import type { QueryFunction, UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server';
import type { Id } from '../../../convex/native/_generated/dataModel';

import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { useConvex } from 'convex/react';

import { api } from '../../../convex/native/_generated/api';

export type FileFolder = FunctionReturnType<typeof api.filesWorkspace.folders>[number];
export type ProjectFile = FunctionReturnType<typeof api.filesWorkspace.list>['page'][number];
export type FileDetail = NonNullable<FunctionReturnType<typeof api.filesWorkspace.detail>>;
type Options<T> = Omit<UseQueryOptions<T>, 'queryFn'> & { queryFn?: QueryFunction<T> };
type Extra = { enabled?: boolean; skipUnauth?: boolean };
function read<TFunction extends FunctionReference<'query'>, TArgs>(
	fn: TFunction,
	args: (a: TArgs) => FunctionArgs<TFunction>
) {
	return {
		queryOptions: (a: TArgs, extra?: Extra): Options<FunctionReturnType<TFunction>> => {
			// This adapter never supplies "skip". Preserve omitted queryFn so TanStack
			// can inherit the request-scoped Convex default (explicit undefined erases it).
			const options = convexQuery(fn, args(a)) as Options<FunctionReturnType<TFunction>>;
			return { ...options, ...(extra?.enabled === undefined ? {} : { enabled: extra.enabled }) };
		},
	};
}
function write<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
	return { mutationOptions: (): UseMutationOptions<TResult, Error, TArgs> => ({ mutationFn }) };
}
type ProjectArg = { projectId: string };
type AssetArg = { assetId: string };
type FolderArg = { folderId: string };
type ListArg = ProjectArg & {
	folderId?: string | null;
	category?: FunctionArgs<typeof api.files.list>['category'];
	extension?: string;
	search?: string;
	sourceProvider?: string;
	sort?: string;
	cursor: string | null;
	limit: number;
};
const projectId = (a: ProjectArg) => ({ projectId: a.projectId as Id<'projects'> });
const assetId = (a: AssetArg) => ({ assetId: a.assetId as Id<'fileAssets'> });
const folderId = (a: FolderArg) => ({ folderId: a.folderId as Id<'fileFolders'> });
export const nativeFilesReads = {
	org: {
		findMyEditableOrgs: read(
			api.filesWorkspace.editableOrganizations,
			(_a: Record<string, never>) => ({})
		),
		getDetails: read(api.organizations.getBySlug, (a: { slug: string }) => a),
	},
	profile: { findMyProfile: read(api.profiles.me, (_a: Record<string, never>) => ({})) },
	project: {
		getDetails: read(api.projects.getBySlugs, (a: { orgSlug: string; slug: string }) => ({
			organizationSlug: a.orgSlug,
			projectSlug: a.slug,
		})),
	},
	file: {
		listFolders: read(api.filesWorkspace.folders, projectId),
		listFileTreeItems: read(api.filesWorkspace.tree, projectId),
		getProjectUsage: read(api.filesWorkspace.usage, projectId),
		getOrgUsage: read(api.filesWorkspace.organizationUsage, (a: { orgSlug: string }) => a),
		getFileDetail: read(api.filesWorkspace.detail, (a: AssetArg & ProjectArg) => ({
			...assetId(a),
			...projectId(a),
		})),
		listProjectFiles: read(api.filesWorkspace.list, (a: ListArg) => ({
			...projectId(a),
			folderId: a.folderId as Id<'fileFolders'> | null | undefined,
			category: a.category,
			extension: a.extension,
			search: a.search,
			sourceProvider: a.sourceProvider,
			sort: a.sort === 'edited_desc' ? ('edited_desc' as const) : ('created_desc' as const),
			paginationOpts: { cursor: a.cursor, numItems: a.limit },
		})),
	},
};
export function useFilesAPI() {
	const c = useConvex();
	return {
		...nativeFilesReads,
		project: {
			...nativeFilesReads.project,
			remove: write((a: { id: string }) =>
				c.mutation(api.projectDeletion.remove, { id: a.id as Id<'projects'> })
			),
		},
		file: {
			...nativeFilesReads.file,
			ensureThumbnails: write((_a: { assetIds: Array<string>; projectId: string }) =>
				Promise.resolve({
					queued: 0,
				})
			), // Native completion generates thumbnails before publishing the file.
			removeAsset: write((a: AssetArg) => c.mutation(api.files.remove, assetId(a))),
			renameAsset: write((a: AssetArg & { name: string }) =>
				c.mutation(api.filesWorkspace.changeAsset, { ...assetId(a), name: a.name })
			),
			moveAsset: write((a: AssetArg & { folderId: string | null }) =>
				c.mutation(api.filesWorkspace.changeAsset, {
					...assetId(a),
					folderId: a.folderId as Id<'fileFolders'> | null,
				})
			),
			renameFolder: write(async (a: FolderArg & { name: string }) => {
				await c.mutation(api.filesWorkspace.changeFolder, { ...folderId(a), name: a.name });
				return null;
			}),
			moveFolder: write(async (a: FolderArg & { parentFolderId: string | null }) => {
				await c.mutation(api.filesWorkspace.changeFolder, {
					...folderId(a),
					parentFolderId: a.parentFolderId as Id<'fileFolders'> | null,
				});
				return null;
			}),
			removeFolder: write((a: FolderArg) => c.mutation(api.files.removeFolder, folderId(a))),
			createFolder: write(
				async (a: ProjectArg & { name: string; parentFolderId?: string | null }) => ({
					id: String(
						await c.mutation(api.files.saveFolder, {
							...projectId(a),
							name: a.name,
							parentId: (a.parentFolderId ?? undefined) as Id<'fileFolders'> | undefined,
						})
					),
				})
			),
			createDirectUploadBatch: write(
				async (
					a: ProjectArg & {
						folderId?: string | null;
						files: Array<{ name: string; mimeType: string; sizeBytes: number }>;
					}
				) =>
					(
						await c.action(api.filesTransport.start, {
							...projectId(a),
							folderId: a.folderId as Id<'fileFolders'> | null | undefined,
							files: a.files,
						})
					).map((i) => ({ assetId: String(i.assetId), url: i.url, key: '' }))
			),
			completeUpload: write((a: AssetArg & { key: string }) =>
				c.action(api.filesTransport.complete, assetId(a))
			),
		},
	};
}
export function useFilesClient() {
	const c = useConvex();
	return {
		file: {
			getDownloadUrl: { query: (a: AssetArg) => c.action(api.filesTransport.download, assetId(a)) },
			getUploadStatus: {
				query: async (a: AssetArg) => {
					await c.query(api.files.detail, assetId(a));
					return 'ready';
				},
			},
		},
	};
}
export function useFileDelivery(file: FileDetail | null | undefined) {
	const c = useConvex();
	const signed = useQuery({
		queryKey: ['native-file-delivery', file?.id],
		enabled: !!file && !file.deliveryUrl,
		queryFn: () =>
			c.action(api.filesTransport.download, {
				assetId: file!.id as Id<'fileAssets'>,
				inline: true,
			}),
		staleTime: 45000,
		refetchInterval: file && !file.deliveryUrl ? 45000 : false,
	});
	return file ? { ...file, deliveryUrl: file.deliveryUrl || signed.data || '' } : file;
}
