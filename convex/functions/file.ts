import type { Id } from './_generated/dataModel';

import { createFunctionHandle } from 'convex/server';
import { v } from 'convex/values';
import { eq } from 'kitcn/orm';
import { CRPCError } from 'kitcn/server';
import { z } from 'zod';

import { appError } from '../lib/app-error';
import { authMutation, authQuery, optionalAuthQuery } from '../lib/crpc';
import {
	createProjectUploadIntents,
	deleteFileThumbnail,
	ensureSystemFileFolder,
	UPLOAD_INTENT_TTL_MS,
} from '../lib/file-registry';
import {
	commitReadyFile,
	getProjectStorageUsage,
	rejectReservedFile,
	releaseReadyFile,
} from '../lib/file-usage';
import {
	asId,
	assertProjectWritable,
	getCurrentProfileOrThrow,
	getDoc,
	getProjectViewAccess,
	verifyOrgAccess,
	verifyProjectAccess,
} from '../lib/kino';
import { orgUploadsR2, userUploadsR2 } from '../lib/r2';
import { deleteCoverImageAttachment } from '../lib/storage';
import { idSchema, orgSlugSchema } from '../lib/validation';
import {
	getCurrentPublicFileId,
	getPublicFileDeliveryUrl,
	getPublicFileDownloadUrl,
	getPublicFileThumbnailObjectKey,
	getPublicFileThumbnailUrl,
	isPublicFileId,
} from '../shared/file-delivery';
import {
	buildFileSearchText,
	FILE_CATEGORIES,
	FILE_INPUT_ACCEPT,
	FILE_SOURCE_PROVIDERS,
	getFileFormatPolicy,
	getProjectStorageLimitBytes,
	isAcceptedFileMimeType,
	MAX_DIRECT_UPLOAD_BATCH_BYTES,
	MAX_DIRECT_UPLOAD_BATCH_FILES,
	renameFilePreservingExtension,
} from '../shared/files';
import { internal } from './_generated/api';
import { env, internalAction, internalQuery } from './_generated/server';
import { internalMutation } from './generated/server';
import { fileAssetTable, fileFolderTable, fileObjectTable } from './schema';

const fileSortSchema = z.enum([
	'created_desc',
	'created_asc',
	'edited_desc',
	'edited_asc',
	'name_asc',
	'name_desc',
	'size_asc',
	'size_desc',
]);

const uploadFileSchema = z.object({
	mimeType: z.string().trim().min(1).max(160),
	name: z.string().trim().min(1).max(255),
	sizeBytes: z.number().int().positive(),
});

const EMPTY_METADATA_RETRY_WINDOW_MS = 10_000;
const MAX_FILE_FOLDER_DEPTH = 12;
const MAX_FILE_TREE_ITEMS = 500;

// eslint-disable-next-line @typescript-eslint/require-await -- cRPC query handlers are promise-based
export const getPolicy = optionalAuthQuery.input(z.object({})).query(async () => ({
	accept: FILE_INPUT_ACCEPT,
	batchMaxBytes: MAX_DIRECT_UPLOAD_BATCH_BYTES,
	batchMaxFiles: MAX_DIRECT_UPLOAD_BATCH_FILES,
	projectLimitBytes: getProjectStorageLimitBytes(),
}));

export const createDirectUploadBatch = authMutation
	.input(
		z.object({
			files: z.array(uploadFileSchema).min(1).max(MAX_DIRECT_UPLOAD_BATCH_FILES),
			folderId: idSchema.nullish(),
			projectId: idSchema,
		})
	)
	.mutation(async ({ ctx, input }) => {
		const access = await verifyProjectAccess(ctx, { id: input.projectId, userId: ctx.userId });
		assertProjectWritable(access);
		if (!access.permissions.canManageContent) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'You cannot upload files to this project',
			});
		}
		const totalBytes = input.files.reduce((sum, file) => sum + file.sizeBytes, 0);
		if (totalBytes > MAX_DIRECT_UPLOAD_BATCH_BYTES) {
			throw appError({
				appCode: 'FILE_UPLOAD_BATCH_TOO_LARGE',
				code: 'BAD_REQUEST',
				message: 'This upload batch is larger than 50 MiB',
			});
		}
		const profile = await getCurrentProfileOrThrow(ctx, ctx.userId);
		const explicitRootFolder = input.folderId === null;
		let folderId = input.folderId ? asId<'fileFolder'>(input.folderId) : undefined;
		if (folderId) {
			const folder = await getDoc<'fileFolder'>(ctx, folderId);
			if (!folder || folder.projectId !== access.project.id) {
				throw new CRPCError({
					code: 'BAD_REQUEST',
					message: 'Folder does not belong to this project',
				});
			}
		} else if (!explicitRootFolder) {
			folderId = await ensureSystemFileFolder(ctx, {
				createdByProfileId: profile.id,
				name: 'Uploads',
				projectId: access.project.id,
				systemKey: 'uploads',
			});
		}

		const intents = await createProjectUploadIntents(ctx, {
			access: 'public',
			bucketKind: 'org_uploads',
			creationMethod: 'direct',
			files: input.files,
			folderId,
			listing: 'project_files',
			orgSlug: access.project.orgSlug,
			originFeature: 'files',
			projectId: access.project.id,
			uploadedByProfileId: profile.id,
			uploaderClass: 'staff',
		});
		for (const intent of intents) {
			await ctx.scheduler.runAfter(UPLOAD_INTENT_TTL_MS, internal.file.expireUploadIntent, {
				objectId: asId<'fileObject'>(intent.objectId),
			});
		}
		return intents;
	});

export const completeUpload = authMutation
	.input(z.object({ assetId: idSchema, key: z.string().trim().min(1).max(512) }))
	.mutation(async ({ ctx, input }) => {
		const asset = await getDoc<'fileAsset'>(ctx, asId<'fileAsset'>(input.assetId));
		if (!asset) throw new CRPCError({ code: 'NOT_FOUND', message: 'File not found' });
		const access = await verifyProjectAccess(ctx, { id: asset.projectId, userId: ctx.userId });
		assertProjectWritable(access);
		if (!access.permissions.canManageContent) {
			throw new CRPCError({ code: 'FORBIDDEN', message: 'You cannot complete this upload' });
		}
		const object = await ctx.db
			.query('fileObject')
			.withIndex('by_objectKey', (query) => query.eq('objectKey', input.key))
			.unique();
		if (!object || object.assetId !== asset._id || object.status !== 'pending') {
			throw new CRPCError({ code: 'BAD_REQUEST', message: 'Upload is not pending for this file' });
		}
		await ctx.db.patch('fileObject', object._id, { updatedTime: Date.now() });
		await ctx.scheduler.runAfter(0, orgUploadsR2.component.lib.syncMetadata, {
			...orgUploadsR2.config,
			key: input.key,
			onComplete: await createFunctionHandle(internal.file.onMetadataSynced),
		});
		return null;
	});

export const onMetadataSynced = internalMutation({
	args: { bucket: v.string(), isNew: v.boolean(), key: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const object = await ctx.db
			.query('fileObject')
			.withIndex('by_objectKey', (query) => query.eq('objectKey', args.key))
			.unique();
		if (!object || object.status !== 'pending') return null;
		const asset = await ctx.db.get('fileAsset', object.assetId);
		if (!asset) return null;
		const r2 = object.bucketKind === 'user_uploads' ? userUploadsR2 : orgUploadsR2;
		const metadata = await r2.getMetadata(ctx, args.key);
		const policy = getFileFormatPolicy(asset.extension);
		const actualBytes = metadata?.size ?? 0;
		const actualMimeType = metadata?.contentType ?? '';
		if (
			metadata &&
			actualBytes === 0 &&
			object.declaredBytes > 0 &&
			Date.now() - object.updatedTime < EMPTY_METADATA_RETRY_WINDOW_MS
		) {
			await ctx.scheduler.runAfter(500, orgUploadsR2.component.lib.syncMetadata, {
				...orgUploadsR2.config,
				key: args.key,
				onComplete: await createFunctionHandle(internal.file.onMetadataSynced),
			});
			return null;
		}

		try {
			if (
				!policy ||
				actualBytes <= 0 ||
				actualBytes !== object.declaredBytes ||
				actualBytes > (object.maxBytes ?? policy.maxBytes)
			) {
				throw new Error('invalid size');
			}
			if (!isAcceptedFileMimeType(policy, actualMimeType)) throw new Error('invalid type');
			await commitReadyFile(ctx, {
				actualBytes,
				category: asset.category,
				object,
				originFeature: asset.originFeature,
				uploaderClass: asset.uploaderClass,
			});
		} catch {
			await r2.deleteObject(ctx, args.key);
			await rejectReservedFile(ctx, object);
			const now = Date.now();
			await ctx.db.patch('fileObject', object._id, {
				actualBytes,
				actualMimeType: actualMimeType || undefined,
				status: 'rejected',
				updatedTime: now,
			});
			await ctx.db.patch('fileAsset', asset._id, { status: 'rejected', updatedTime: now });
			const references = await ctx.db
				.query('fileReference')
				.withIndex('by_assetId', (query) => query.eq('assetId', asset._id))
				.take(50);
			for (const reference of references) {
				if (
					reference.feature === 'update_cover' &&
					reference.entityType === 'update' &&
					reference.field === 'coverImageId'
				) {
					const update = await ctx.db.get('update', reference.entityId as Id<'update'>);
					if (update?.coverImageId === args.key) {
						await ctx.db.patch('update', update._id, { coverImageId: undefined, updatedTime: now });
					}
				}
				await ctx.db.delete('fileReference', reference._id);
			}
			return null;
		}

		const now = Date.now();
		await ctx.db.patch('fileObject', object._id, {
			actualBytes,
			actualMimeType,
			expiresAt: undefined,
			readyTime: now,
			status: 'ready',
			updatedTime: now,
		});
		await ctx.db.patch('fileAsset', asset._id, {
			mimeType: actualMimeType,
			sizeBytes: actualBytes,
			status: 'ready',
			thumbnailStatus:
				policy.preview === 'image' && asset.access === 'public' && asset.listing === 'project_files'
					? 'pending'
					: undefined,
			updatedTime: now,
		});
		const references = await ctx.db
			.query('fileReference')
			.withIndex('by_assetId', (query) => query.eq('assetId', asset._id))
			.take(50);
		for (const reference of references) {
			if (
				reference.feature !== 'update_cover' ||
				reference.entityType !== 'update' ||
				reference.field !== 'coverImageId'
			) {
				continue;
			}
			const update = await ctx.db.get('update', reference.entityId as Id<'update'>);
			if (!update) continue;
			if (update.coverImageId && update.coverImageId !== args.key) {
				await deleteCoverImageAttachment(ctx, {
					coverImageId: update.coverImageId,
					orgSlug: object.orgSlug,
				});
			}
			await ctx.db.patch('update', update._id, { coverImageId: args.key, updatedTime: now });
		}
		if (policy.preview === 'text') {
			await ctx.scheduler.runAfter(0, internal.file.extractTextContent, { assetId: asset._id });
		}
		if (
			policy.preview === 'image' &&
			asset.access === 'public' &&
			asset.listing === 'project_files'
		) {
			await ctx.scheduler.runAfter(0, internal.fileThumbnail.generate, { assetId: asset._id });
		}
		return null;
	},
});

export const getThumbnailSource = internalQuery({
	args: { assetId: v.id('fileAsset') },
	returns: v.union(
		v.object({
			bucketKind: v.union(v.literal('org_uploads'), v.literal('user_uploads')),
			objectKey: v.string(),
			publicId: v.optional(v.string()),
			sizeBytes: v.number(),
		}),
		v.null()
	),
	handler: async (ctx, args) => {
		const asset = await ctx.db.get('fileAsset', args.assetId);
		if (
			!asset ||
			asset.status !== 'ready' ||
			asset.thumbnailStatus !== 'pending' ||
			asset.category !== 'image' ||
			asset.access !== 'public' ||
			asset.listing !== 'project_files'
		) {
			return null;
		}
		const objects = await ctx.db
			.query('fileObject')
			.withIndex('by_assetId', (query) => query.eq('assetId', asset._id))
			.order('desc')
			.take(5);
		const object = objects.find((candidate) => candidate.status === 'ready');
		if (!object || object.bucketKind !== 'org_uploads' || !object.actualBytes) return null;
		return {
			bucketKind: object.bucketKind,
			objectKey: object.objectKey,
			publicId: asset.publicId ?? undefined,
			sizeBytes: object.actualBytes,
		};
	},
});

export const saveThumbnail = internalMutation({
	args: {
		assetId: v.id('fileAsset'),
		bucketKind: v.union(v.literal('org_uploads'), v.literal('user_uploads')),
		bytes: v.number(),
		objectKey: v.string(),
	},
	returns: v.object({ accepted: v.boolean() }),
	handler: async (ctx, args) => {
		const asset = await ctx.db.get('fileAsset', args.assetId);
		if (
			!asset ||
			asset.status !== 'ready' ||
			asset.thumbnailStatus !== 'pending' ||
			asset.access !== 'public' ||
			asset.listing !== 'project_files' ||
			args.bucketKind !== 'org_uploads' ||
			(asset.publicId &&
				(!isPublicFileId(asset.publicId) ||
					args.objectKey !== getPublicFileThumbnailObjectKey(asset.publicId)))
		) {
			return { accepted: false };
		}
		await ctx.db.patch('fileAsset', asset._id, {
			thumbnailBucketKind: args.bucketKind,
			thumbnailBytes: args.bytes,
			thumbnailMimeType: 'image/webp',
			thumbnailObjectKey: args.objectKey,
			thumbnailStatus: 'ready',
		});
		return { accepted: true };
	},
});

export const markThumbnailFailed = internalMutation({
	args: { assetId: v.id('fileAsset') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const asset = await ctx.db.get('fileAsset', args.assetId);
		if (asset?.status === 'ready' && asset.thumbnailStatus === 'pending') {
			await ctx.db.patch('fileAsset', asset._id, { thumbnailStatus: 'failed' });
		}
		return null;
	},
});

export const getTextExtractionSource = internalQuery({
	args: { assetId: v.id('fileAsset') },
	returns: v.union(
		v.object({
			bucketKind: v.union(v.literal('org_uploads'), v.literal('user_uploads')),
			objectKey: v.string(),
		}),
		v.null()
	),
	handler: async (ctx, args) => {
		const asset = await ctx.db.get('fileAsset', args.assetId);
		if (!asset || asset.status !== 'ready') return null;
		const objects = await ctx.db
			.query('fileObject')
			.withIndex('by_assetId', (query) => query.eq('assetId', asset._id))
			.order('desc')
			.take(5);
		const object = objects.find((candidate) => candidate.status === 'ready');
		if (!object || object.bucketKind === 'external') return null;
		return { bucketKind: object.bucketKind, objectKey: object.objectKey };
	},
});

export const saveExtractedText = internalMutation({
	args: { assetId: v.id('fileAsset'), text: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const asset = await ctx.db.get('fileAsset', args.assetId);
		if (!asset || asset.status !== 'ready') return null;
		await ctx.db.patch('fileAsset', asset._id, {
			extractedText: args.text,
			searchContent: buildFileSearchText([
				asset.name,
				asset.extension,
				asset.category,
				asset.mimeType,
				asset.originFeature,
				args.text,
			]),
		});
		return null;
	},
});

export const extractTextContent = internalAction({
	args: { assetId: v.id('fileAsset') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const source = await ctx.runQuery(internal.file.getTextExtractionSource, args);
		if (!source) return null;
		const r2 = source.bucketKind === 'user_uploads' ? userUploadsR2 : orgUploadsR2;
		const response = await fetch(await r2.getUrl(source.objectKey, { expiresIn: 60 }), {
			headers: { Range: 'bytes=0-262143' },
		});
		if (!response.ok) return null;
		const text = (await response.text()).split('\0').join(' ').slice(0, 30_000);
		await ctx.runMutation(internal.file.saveExtractedText, { assetId: args.assetId, text });
		return null;
	},
});

export const getUploadStatus = authQuery
	.input(z.object({ assetId: idSchema }))
	.query(async ({ ctx, input }) => {
		const asset = await getDoc<'fileAsset'>(ctx, asId<'fileAsset'>(input.assetId));
		if (!asset) return null;
		const access = await verifyProjectAccess(ctx, { id: asset.projectId, userId: ctx.userId });
		if (!access.permissions.canManageContent) return null;
		return asset.status;
	});

export const expireUploadIntent = internalMutation({
	args: { objectId: v.id('fileObject') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const object = await ctx.db.get('fileObject', args.objectId);
		if (!object || object.status !== 'pending') return null;
		const asset = await ctx.db.get('fileAsset', object.assetId);
		const r2 = object.bucketKind === 'user_uploads' ? userUploadsR2 : orgUploadsR2;
		await r2.deleteObject(ctx, object.objectKey);
		await rejectReservedFile(ctx, object);
		const now = Date.now();
		await ctx.db.patch('fileObject', object._id, {
			deletedTime: now,
			status: 'rejected',
			updatedTime: now,
		});
		if (asset?.status === 'pending') {
			await ctx.db.patch('fileAsset', asset._id, { status: 'rejected', updatedTime: now });
			const references = await ctx.db
				.query('fileReference')
				.withIndex('by_assetId', (query) => query.eq('assetId', asset._id))
				.take(50);
			for (const reference of references) {
				await ctx.db.delete('fileReference', reference._id);
			}
		}
		return null;
	},
});

export const listFolders = optionalAuthQuery
	.input(z.object({ projectId: idSchema }))
	.query(async ({ ctx, input }) => {
		const access = await getProjectViewAccess(ctx, { id: input.projectId, userId: ctx.userId });
		if (!access.permissions.canView) return [];
		const folders = await ctx.db
			.query('fileFolder')
			.withIndex('by_projectId', (query) => query.eq('projectId', asId<'project'>(input.projectId)))
			.take(500);
		return folders
			.sort((a, b) => a.normalizedName.localeCompare(b.normalizedName))
			.map((folder) => ({ ...folder, id: folder._id }));
	});

export const listFileTreeItems = optionalAuthQuery
	.input(z.object({ projectId: idSchema }))
	.query(async ({ ctx, input }) => {
		const access = await getProjectViewAccess(ctx, { id: input.projectId, userId: ctx.userId });
		if (!access.permissions.canView) return { files: [], truncated: false };
		const assets = await ctx.db
			.query('fileAsset')
			.withIndex('by_projectId_listing_status_normalizedName', (query) =>
				query
					.eq('projectId', asId<'project'>(input.projectId))
					.eq('listing', 'project_files')
					.eq('status', 'ready')
			)
			.take(MAX_FILE_TREE_ITEMS + 1);
		return {
			files: assets.slice(0, MAX_FILE_TREE_ITEMS).map((asset) => ({
				category: asset.category,
				folderId: asset.folderId,
				id: asset._id,
				name: asset.name,
			})),
			truncated: assets.length > MAX_FILE_TREE_ITEMS,
		};
	});

export const ensureThumbnails = authMutation
	.input(
		z.object({
			assetIds: z.array(idSchema).max(50),
			projectId: idSchema,
		})
	)
	.mutation(async ({ ctx, input }) => {
		const access = await verifyProjectAccess(ctx, { id: input.projectId, userId: ctx.userId });
		if (!access.permissions.canManageContent) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'You cannot generate thumbnails for this project',
			});
		}
		let queued = 0;
		for (const assetId of input.assetIds) {
			const asset = await ctx.db.get('fileAsset', asId<'fileAsset'>(assetId));
			if (
				!asset ||
				asset.projectId !== access.project.id ||
				asset.status !== 'ready' ||
				asset.category !== 'image' ||
				asset.access !== 'public' ||
				asset.listing !== 'project_files' ||
				asset.thumbnailStatus
			) {
				continue;
			}
			await ctx.db.patch('fileAsset', asset._id, { thumbnailStatus: 'pending' });
			await ctx.scheduler.runAfter(0, internal.fileThumbnail.generate, { assetId: asset._id });
			queued += 1;
		}
		return { queued };
	});

export const listProjectFiles = optionalAuthQuery
	.input(
		z.object({
			category: z.enum(FILE_CATEGORIES).optional(),
			extension: z.string().trim().max(16).optional(),
			folderId: idSchema.nullish(),
			projectId: idSchema,
			search: z.string().trim().max(100).optional(),
			sort: fileSortSchema.optional(),
			sourceProvider: z.enum(FILE_SOURCE_PROVIDERS).optional(),
		})
	)
	.paginated({ limit: 50, item: z.any() })
	.query(async ({ ctx, input }) => {
		const access = await getProjectViewAccess(ctx, { id: input.projectId, userId: ctx.userId });
		if (!access.permissions.canView) return { continueCursor: '', isDone: true, page: [] };
		const projectId = asId<'project'>(input.projectId);
		const directoryRequested = input.folderId !== undefined;
		const folderId = input.folderId ? asId<'fileFolder'>(input.folderId) : undefined;
		if (folderId) {
			const folder = await getDoc<'fileFolder'>(ctx, folderId);
			if (!folder || folder.projectId !== projectId) {
				throw new CRPCError({ code: 'NOT_FOUND', message: 'Folder not found' });
			}
		}
		let result: { continueCursor: string; isDone: boolean; page: Array<any> };
		if (input.search?.trim()) {
			const query = ctx.db
				.query('fileAsset')
				.withSearchIndex('by_projectId_listing_status_searchContent', (builder) => {
					let next = builder
						.search('searchContent', input.search!)
						.eq('projectId', projectId)
						.eq('listing', 'project_files')
						.eq('status', 'ready');
					if (input.category) next = next.eq('category', input.category);
					if (input.extension) next = next.eq('extension', input.extension.toLowerCase());
					if (directoryRequested) next = next.eq('folderId', folderId);
					if (input.sourceProvider) next = next.eq('sourceProvider', input.sourceProvider);
					return next;
				});
			result = await query.paginate({ cursor: input.cursor, numItems: input.limit });
		} else {
			const activeFacets = [input.category, input.extension].filter(Boolean).length;
			if (activeFacets > 1) {
				throw new CRPCError({
					code: 'BAD_REQUEST',
					message: 'Choose one category or extension filter when search is empty',
				});
			}
			const sort = input.sort ?? 'created_desc';
			if (!directoryRequested && input.category && input.sourceProvider) {
				result = await ctx.db
					.query('fileAsset')
					.withIndex('by_projectId_listing_category_sourceProvider_status_createdTime', (query) =>
						query
							.eq('projectId', projectId)
							.eq('listing', 'project_files')
							.eq('category', input.category!)
							.eq('sourceProvider', input.sourceProvider!)
							.eq('status', 'ready')
					)
					.order('desc')
					.paginate({ cursor: input.cursor, numItems: input.limit });
			} else if (!directoryRequested && input.extension && input.sourceProvider) {
				result = await ctx.db
					.query('fileAsset')
					.withIndex('by_projectId_listing_extension_sourceProvider_status_createdTime', (query) =>
						query
							.eq('projectId', projectId)
							.eq('listing', 'project_files')
							.eq('extension', input.extension!.toLowerCase())
							.eq('sourceProvider', input.sourceProvider!)
							.eq('status', 'ready')
					)
					.order('desc')
					.paginate({ cursor: input.cursor, numItems: input.limit });
			} else if (!directoryRequested && input.sourceProvider) {
				result = await ctx.db
					.query('fileAsset')
					.withIndex('by_projectId_listing_sourceProvider_status_createdTime', (query) =>
						query
							.eq('projectId', projectId)
							.eq('listing', 'project_files')
							.eq('sourceProvider', input.sourceProvider!)
							.eq('status', 'ready')
					)
					.order('desc')
					.paginate({ cursor: input.cursor, numItems: input.limit });
			} else if (directoryRequested && input.category) {
				result = await ctx.db
					.query('fileAsset')
					.withIndex('by_projectId_listing_folderId_category_status_createdTime', (query) =>
						query
							.eq('projectId', projectId)
							.eq('listing', 'project_files')
							.eq('folderId', folderId)
							.eq('category', input.category!)
							.eq('status', 'ready')
					)
					.order('desc')
					.paginate({ cursor: input.cursor, numItems: input.limit });
			} else if (directoryRequested && input.extension) {
				result = await ctx.db
					.query('fileAsset')
					.withIndex('by_projectId_listing_folderId_extension_status_createdTime', (query) =>
						query
							.eq('projectId', projectId)
							.eq('listing', 'project_files')
							.eq('folderId', folderId)
							.eq('extension', input.extension!.toLowerCase())
							.eq('status', 'ready')
					)
					.order('desc')
					.paginate({ cursor: input.cursor, numItems: input.limit });
			} else if (directoryRequested && sort.startsWith('edited')) {
				result = await ctx.db
					.query('fileAsset')
					.withIndex('by_projectId_listing_folderId_status_updatedTime', (query) =>
						query
							.eq('projectId', projectId)
							.eq('listing', 'project_files')
							.eq('folderId', folderId)
							.eq('status', 'ready')
					)
					.order(sort.endsWith('asc') ? 'asc' : 'desc')
					.paginate({ cursor: input.cursor, numItems: input.limit });
			} else if (directoryRequested && sort.startsWith('name')) {
				result = await ctx.db
					.query('fileAsset')
					.withIndex('by_projectId_listing_folderId_status_normalizedName', (query) =>
						query
							.eq('projectId', projectId)
							.eq('listing', 'project_files')
							.eq('folderId', folderId)
							.eq('status', 'ready')
					)
					.order(sort.endsWith('asc') ? 'asc' : 'desc')
					.paginate({ cursor: input.cursor, numItems: input.limit });
			} else if (directoryRequested && sort.startsWith('size')) {
				result = await ctx.db
					.query('fileAsset')
					.withIndex('by_projectId_listing_folderId_status_sizeBytes', (query) =>
						query
							.eq('projectId', projectId)
							.eq('listing', 'project_files')
							.eq('folderId', folderId)
							.eq('status', 'ready')
					)
					.order(sort.endsWith('asc') ? 'asc' : 'desc')
					.paginate({ cursor: input.cursor, numItems: input.limit });
			} else if (directoryRequested) {
				result = await ctx.db
					.query('fileAsset')
					.withIndex('by_projectId_listing_folderId_status_createdTime', (query) =>
						query
							.eq('projectId', projectId)
							.eq('listing', 'project_files')
							.eq('folderId', folderId)
							.eq('status', 'ready')
					)
					.order(sort.endsWith('asc') ? 'asc' : 'desc')
					.paginate({ cursor: input.cursor, numItems: input.limit });
			} else if (input.category) {
				result = await ctx.db
					.query('fileAsset')
					.withIndex('by_projectId_listing_category_status_createdTime', (query) =>
						query
							.eq('projectId', projectId)
							.eq('listing', 'project_files')
							.eq('category', input.category!)
							.eq('status', 'ready')
					)
					.order('desc')
					.paginate({ cursor: input.cursor, numItems: input.limit });
			} else if (input.extension) {
				result = await ctx.db
					.query('fileAsset')
					.withIndex('by_projectId_listing_extension_status_createdTime', (query) =>
						query
							.eq('projectId', projectId)
							.eq('listing', 'project_files')
							.eq('extension', input.extension!.toLowerCase())
							.eq('status', 'ready')
					)
					.order('desc')
					.paginate({ cursor: input.cursor, numItems: input.limit });
			} else if (sort.startsWith('edited')) {
				result = await ctx.db
					.query('fileAsset')
					.withIndex('by_projectId_listing_status_updatedTime', (query) =>
						query.eq('projectId', projectId).eq('listing', 'project_files').eq('status', 'ready')
					)
					.order(sort.endsWith('asc') ? 'asc' : 'desc')
					.paginate({ cursor: input.cursor, numItems: input.limit });
			} else if (sort.startsWith('name')) {
				result = await ctx.db
					.query('fileAsset')
					.withIndex('by_projectId_listing_status_normalizedName', (query) =>
						query.eq('projectId', projectId).eq('listing', 'project_files').eq('status', 'ready')
					)
					.order(sort.endsWith('asc') ? 'asc' : 'desc')
					.paginate({ cursor: input.cursor, numItems: input.limit });
			} else if (sort.startsWith('size')) {
				result = await ctx.db
					.query('fileAsset')
					.withIndex('by_projectId_listing_status_sizeBytes', (query) =>
						query.eq('projectId', projectId).eq('listing', 'project_files').eq('status', 'ready')
					)
					.order(sort.endsWith('asc') ? 'asc' : 'desc')
					.paginate({ cursor: input.cursor, numItems: input.limit });
			} else {
				result = await ctx.db
					.query('fileAsset')
					.withIndex('by_projectId_listing_status_createdTime', (query) =>
						query.eq('projectId', projectId).eq('listing', 'project_files').eq('status', 'ready')
					)
					.order(sort.endsWith('asc') ? 'asc' : 'desc')
					.paginate({ cursor: input.cursor, numItems: input.limit });
			}
		}

		return {
			continueCursor: result.continueCursor,
			isDone: result.isDone,
			page: result.page.map((asset) => {
				const deliveryUrl =
					asset.publicId && isPublicFileId(asset.publicId)
						? getPublicFileDeliveryUrl({
								fileName: asset.name,
								origin: env.FILES_ORIGIN,
								publicId: asset.publicId,
							})
						: null;
				const thumbnailUrl =
					asset.publicId &&
					isPublicFileId(asset.publicId) &&
					asset.thumbnailObjectKey === getPublicFileThumbnailObjectKey(asset.publicId) &&
					asset.thumbnailBucketKind === 'org_uploads'
						? getPublicFileThumbnailUrl({
								origin: env.FILES_ORIGIN,
								publicId: asset.publicId,
							})
						: null;
				return {
					category: asset.category,
					createdTime: asset.createdTime,
					deliveryUrl,
					extension: asset.extension,
					folderId: asset.folderId,
					id: asset._id,
					mimeType: asset.mimeType,
					name: asset.name,
					originFeature: asset.originFeature,
					publicId: asset.publicId ?? null,
					sizeBytes: asset.sizeBytes,
					thumbnailStatus: asset.thumbnailStatus,
					thumbnailUrl,
					updatedTime: asset.updatedTime,
				};
			}),
		};
	});

export const getFileDetail = optionalAuthQuery
	.input(z.object({ assetId: idSchema, projectId: idSchema }))
	.query(async ({ ctx, input }) => {
		const projectId = asId<'project'>(input.projectId);
		const asset = await getDoc<'fileAsset'>(ctx, asId<'fileAsset'>(input.assetId));
		if (
			!asset ||
			asset.projectId !== projectId ||
			asset.status !== 'ready' ||
			asset.access !== 'public' ||
			asset.listing !== 'project_files'
		) {
			return null;
		}
		const access = await getProjectViewAccess(ctx, { id: projectId, userId: ctx.userId });
		if (!access.permissions.canView) return null;
		const canManage = access.permissions.canManageContent;

		const [folder, uploader, objects, references] = await Promise.all([
			asset.folderId ? getDoc<'fileFolder'>(ctx, asset.folderId) : null,
			asset.uploadedByProfileId ? getDoc<'profile'>(ctx, asset.uploadedByProfileId) : null,
			ctx.db
				.query('fileObject')
				.withIndex('by_assetId', (query) => query.eq('assetId', asset._id))
				.order('desc')
				.take(5),
			canManage
				? ctx.db
						.query('fileReference')
						.withIndex('by_assetId', (query) => query.eq('assetId', asset._id))
						.take(100)
				: Promise.resolve([]),
		]);
		const readyObject = objects.find(
			(object) => object.status === 'ready' && object.bucketKind === 'org_uploads'
		);
		if (!readyObject) return null;

		const publicId = getCurrentPublicFileId({
			objectKey: readyObject.objectKey,
			publicId: asset.publicId,
		});
		if (!publicId) return null;
		const deliveryUrl =
			getPublicFileDeliveryUrl({
				fileName: asset.name,
				origin: env.FILES_ORIGIN,
				publicId,
			}) ??
			(await orgUploadsR2.getUrl(readyObject.objectKey, {
				expiresIn: 60 * 15,
			}));

		return {
			canManage,
			category: asset.category,
			createdTime: asset.createdTime,
			deliveryUrl,
			extension: asset.extension,
			folder: folder ? { id: folder._id, name: folder.name } : null,
			id: asset._id,
			listing: asset.listing,
			mimeType: asset.mimeType,
			name: asset.name,
			previewText: asset.extractedText ?? null,
			sizeBytes: asset.sizeBytes ?? readyObject.actualBytes ?? 0,
			sourceAndUsage: canManage
				? {
						access: asset.access,
						creationMethod: asset.creationMethod,
						originFeature: asset.originFeature,
						publicId: asset.publicId ?? null,
						readyTime: readyObject.readyTime ?? null,
						referenceCount: references.length,
						references: references.map((reference) => ({
							entityType: reference.entityType,
							feature: reference.feature,
							field: reference.field,
						})),
						referencesTruncated: references.length === 100,
						sourceProvider: asset.sourceProvider,
						storageProvider: readyObject.storageProvider,
						uploaderClass: asset.uploaderClass,
					}
				: null,
			updatedTime: asset.updatedTime,
			uploadedBy: uploader
				? { id: uploader._id, name: uploader.name, username: uploader.username }
				: null,
		};
	});

export const getDownloadUrl = optionalAuthQuery
	.input(z.object({ assetId: idSchema }))
	.query(async ({ ctx, input }) => {
		const asset = await getDoc<'fileAsset'>(ctx, asId<'fileAsset'>(input.assetId));
		if (!asset || asset.status !== 'ready') return null;
		const access = await getProjectViewAccess(ctx, { id: asset.projectId, userId: ctx.userId });
		const publiclyAvailable = asset.access === 'public' && asset.listing === 'project_files';
		if (
			!access.permissions.canView ||
			(!publiclyAvailable && !access.permissions.canManageContent)
		) {
			return null;
		}
		const object = await ctx.db
			.query('fileObject')
			.withIndex('by_assetId', (query) => query.eq('assetId', asset._id))
			.order('desc')
			.take(5);
		const ready = object.find((item) => item.status === 'ready');
		if (!ready || ready.bucketKind !== 'org_uploads') return null;
		if (publiclyAvailable) {
			const publicId = getCurrentPublicFileId({
				objectKey: ready.objectKey,
				publicId: asset.publicId,
			});
			if (!publicId) return null;
			return (
				getPublicFileDownloadUrl({
					fileName: asset.name,
					origin: env.FILES_ORIGIN,
					publicId,
				}) ?? (await orgUploadsR2.getUrl(ready.objectKey, { expiresIn: 60 * 15 }))
			);
		}
		return await orgUploadsR2.getUrl(ready.objectKey, { expiresIn: 60 * 15 });
	});

export const createFolder = authMutation
	.input(
		z.object({
			name: z.string().trim().min(1).max(80),
			parentFolderId: idSchema.nullish(),
			projectId: idSchema,
		})
	)
	.mutation(async ({ ctx, input }) => {
		const access = await verifyProjectAccess(ctx, { id: input.projectId, userId: ctx.userId });
		assertProjectWritable(access);
		if (!access.permissions.canManageContent)
			throw new CRPCError({ code: 'FORBIDDEN', message: 'You cannot manage folders' });
		const profile = await getCurrentProfileOrThrow(ctx, ctx.userId);
		const folderLimitCheck = await ctx.db
			.query('fileFolder')
			.withIndex('by_projectId', (query) => query.eq('projectId', access.project.id))
			.take(500);
		if (folderLimitCheck.length >= 500) {
			throw appError({
				appCode: 'FOLDER_LIMIT_REACHED',
				code: 'BAD_REQUEST',
				message: 'Projects can contain up to 500 folders',
			});
		}
		const parentFolderId = input.parentFolderId
			? asId<'fileFolder'>(input.parentFolderId)
			: undefined;
		if (parentFolderId) {
			let parent = await getDoc<'fileFolder'>(ctx, parentFolderId);
			let depth = 1;
			while (parent) {
				if (parent.projectId !== access.project.id)
					throw new CRPCError({ code: 'BAD_REQUEST', message: 'Parent folder is invalid' });
				depth += 1;
				if (depth > MAX_FILE_FOLDER_DEPTH) {
					throw appError({
						appCode: 'FOLDER_DEPTH_EXCEEDED',
						code: 'BAD_REQUEST',
						message: `Folders can be nested up to ${MAX_FILE_FOLDER_DEPTH} levels deep`,
						values: { count: MAX_FILE_FOLDER_DEPTH },
					});
				}
				parent = parent.parentFolderId
					? await getDoc<'fileFolder'>(ctx, parent.parentFolderId)
					: null;
			}
		}
		const normalizedName = input.name.toLowerCase();
		const duplicate = folderLimitCheck.find(
			(folder) =>
				(folder.parentFolderId ?? undefined) === parentFolderId &&
				folder.normalizedName === normalizedName
		);
		if (duplicate)
			throw appError({
				appCode: 'FOLDER_NAME_TAKEN',
				code: 'CONFLICT',
				message: 'A folder with this name already exists here',
			});
		const now = Date.now();
		const [folder] = await ctx.orm
			.insert(fileFolderTable)
			.values({
				createdByProfileId: profile.id,
				createdTime: now,
				name: input.name,
				normalizedName,
				parentFolderId,
				projectId: access.project.id,
				updatedTime: now,
			})
			.returning();
		return { id: folder.id };
	});

export const renameFolder = authMutation
	.input(z.object({ folderId: idSchema, name: z.string().trim().min(1).max(80) }))
	.mutation(async ({ ctx, input }) => {
		const folder = await getDoc<'fileFolder'>(ctx, asId<'fileFolder'>(input.folderId));
		if (!folder) throw new CRPCError({ code: 'NOT_FOUND', message: 'Folder not found' });
		const access = await verifyProjectAccess(ctx, { id: folder.projectId, userId: ctx.userId });
		assertProjectWritable(access);
		if (!access.permissions.canManageContent) {
			throw new CRPCError({ code: 'FORBIDDEN', message: 'You cannot manage folders' });
		}
		if (folder.systemKey) {
			throw new CRPCError({ code: 'BAD_REQUEST', message: 'System folders cannot be renamed' });
		}
		const normalizedName = input.name.toLowerCase();
		const projectFolders = await ctx.db
			.query('fileFolder')
			.withIndex('by_projectId', (query) => query.eq('projectId', folder.projectId))
			.take(501);
		if (projectFolders.length > 500) {
			throw new CRPCError({
				code: 'BAD_REQUEST',
				message: 'This project has too many folders to rename safely',
			});
		}
		const duplicate = projectFolders.find(
			(candidate) =>
				candidate._id !== folder._id &&
				(candidate.parentFolderId ?? undefined) === (folder.parentFolderId ?? undefined) &&
				candidate.normalizedName === normalizedName
		);
		if (duplicate && duplicate._id !== folder._id) {
			throw appError({
				appCode: 'FOLDER_NAME_TAKEN',
				code: 'CONFLICT',
				message: 'A folder with this name already exists here',
			});
		}
		await ctx.orm
			.update(fileFolderTable)
			.set({ name: input.name, normalizedName, updatedTime: Date.now() })
			.where(eq(fileFolderTable.id, folder._id));
		return null;
	});

export const moveFolder = authMutation
	.input(z.object({ folderId: idSchema, parentFolderId: idSchema.nullish() }))
	.mutation(async ({ ctx, input }) => {
		const folder = await getDoc<'fileFolder'>(ctx, asId<'fileFolder'>(input.folderId));
		if (!folder) throw new CRPCError({ code: 'NOT_FOUND', message: 'Folder not found' });
		const access = await verifyProjectAccess(ctx, { id: folder.projectId, userId: ctx.userId });
		assertProjectWritable(access);
		if (!access.permissions.canManageContent) {
			throw new CRPCError({ code: 'FORBIDDEN', message: 'You cannot manage folders' });
		}
		if (folder.systemKey) {
			throw new CRPCError({ code: 'BAD_REQUEST', message: 'System folders cannot be moved' });
		}

		const parentFolderId = input.parentFolderId
			? asId<'fileFolder'>(input.parentFolderId)
			: undefined;
		if (parentFolderId === folder._id) {
			throw new CRPCError({ code: 'BAD_REQUEST', message: 'A folder cannot contain itself' });
		}
		if (parentFolderId === (folder.parentFolderId ?? undefined)) return null;

		const projectFolders = await ctx.db
			.query('fileFolder')
			.withIndex('by_projectId', (query) => query.eq('projectId', folder.projectId))
			.take(501);
		if (projectFolders.length > 500) {
			throw new CRPCError({
				code: 'BAD_REQUEST',
				message: 'This project has too many folders to move safely',
			});
		}
		const foldersById = new Map(projectFolders.map((item) => [String(item._id), item]));
		let parentDepth = 0;
		let ancestorId = parentFolderId;
		const seenAncestors = new Set<string>();
		while (ancestorId) {
			if (ancestorId === folder._id) {
				throw new CRPCError({
					code: 'BAD_REQUEST',
					message: 'A folder cannot be moved inside one of its descendants',
				});
			}
			const ancestorKey = String(ancestorId);
			if (seenAncestors.has(ancestorKey)) {
				throw new CRPCError({ code: 'BAD_REQUEST', message: 'Folder hierarchy is invalid' });
			}
			seenAncestors.add(ancestorKey);
			const ancestor = foldersById.get(ancestorKey);
			if (!ancestor) {
				throw new CRPCError({ code: 'BAD_REQUEST', message: 'Parent folder is invalid' });
			}
			parentDepth += 1;
			ancestorId = ancestor.parentFolderId ?? undefined;
		}

		const childrenByParent = new Map<string, Array<string>>();
		for (const item of projectFolders) {
			if (!item.parentFolderId) continue;
			const key = String(item.parentFolderId);
			childrenByParent.set(key, [...(childrenByParent.get(key) ?? []), String(item._id)]);
		}
		let subtreeDepth = 1;
		const stack = [{ depth: 1, id: String(folder._id) }];
		const seenSubtree = new Set<string>();
		while (stack.length) {
			const current = stack.pop()!;
			if (seenSubtree.has(current.id)) {
				throw new CRPCError({ code: 'BAD_REQUEST', message: 'Folder hierarchy is invalid' });
			}
			seenSubtree.add(current.id);
			subtreeDepth = Math.max(subtreeDepth, current.depth);
			for (const childId of childrenByParent.get(current.id) ?? []) {
				stack.push({ depth: current.depth + 1, id: childId });
			}
		}
		if (parentDepth + subtreeDepth > MAX_FILE_FOLDER_DEPTH) {
			throw appError({
				appCode: 'FOLDER_DEPTH_EXCEEDED',
				code: 'BAD_REQUEST',
				message: `Folders can be nested up to ${MAX_FILE_FOLDER_DEPTH} levels deep`,
				values: { count: MAX_FILE_FOLDER_DEPTH },
			});
		}

		const duplicate = projectFolders.find(
			(candidate) =>
				candidate._id !== folder._id &&
				(candidate.parentFolderId ?? undefined) === parentFolderId &&
				candidate.normalizedName === folder.normalizedName
		);
		if (duplicate && duplicate._id !== folder._id) {
			throw appError({
				appCode: 'FOLDER_NAME_TAKEN',
				code: 'CONFLICT',
				message: 'A folder with this name already exists there',
			});
		}
		await ctx.orm
			.update(fileFolderTable)
			.set({ parentFolderId, updatedTime: Date.now() })
			.where(eq(fileFolderTable.id, folder._id));
		return null;
	});

export const removeFolder = authMutation
	.input(z.object({ folderId: idSchema }))
	.mutation(async ({ ctx, input }) => {
		const folder = await getDoc<'fileFolder'>(ctx, asId<'fileFolder'>(input.folderId));
		if (!folder) throw new CRPCError({ code: 'NOT_FOUND', message: 'Folder not found' });
		const access = await verifyProjectAccess(ctx, { id: folder.projectId, userId: ctx.userId });
		assertProjectWritable(access);
		if (!access.permissions.canManageContent) {
			throw new CRPCError({ code: 'FORBIDDEN', message: 'You cannot manage folders' });
		}
		if (folder.systemKey) {
			throw new CRPCError({ code: 'BAD_REQUEST', message: 'System folders cannot be deleted' });
		}
		const [child, asset] = await Promise.all([
			ctx.db
				.query('fileFolder')
				.withIndex('by_parentFolderId', (query) => query.eq('parentFolderId', folder._id))
				.take(1),
			ctx.db
				.query('fileAsset')
				.withIndex('by_folderId', (query) => query.eq('folderId', folder._id))
				.take(1),
		]);
		if (child.length || asset.length) {
			throw appError({
				appCode: 'FOLDER_NOT_EMPTY',
				code: 'CONFLICT',
				message: 'Move this folder’s contents before deleting it',
			});
		}
		await ctx.orm.delete(fileFolderTable).where(eq(fileFolderTable.id, folder._id));
		return null;
	});

export const renameAsset = authMutation
	.input(z.object({ assetId: idSchema, name: z.string().trim().min(1).max(255) }))
	.mutation(async ({ ctx, input }) => {
		const asset = await getDoc<'fileAsset'>(ctx, asId<'fileAsset'>(input.assetId));
		if (!asset) throw new CRPCError({ code: 'NOT_FOUND', message: 'File not found' });
		const access = await verifyProjectAccess(ctx, { id: asset.projectId, userId: ctx.userId });
		assertProjectWritable(access);
		if (!access.permissions.canManageContent)
			throw new CRPCError({ code: 'FORBIDDEN', message: 'You cannot rename this file' });
		const name = renameFilePreservingExtension(input.name, asset.extension);
		if (!name)
			throw new CRPCError({
				code: 'BAD_REQUEST',
				message: 'File name cannot be empty',
			});
		await ctx.orm
			.update(fileAssetTable)
			.set({
				name,
				normalizedName: name.toLowerCase(),
				searchContent: buildFileSearchText([
					name,
					asset.extension,
					asset.category,
					asset.mimeType,
					asset.originFeature,
					asset.extractedText,
				]),
				updatedTime: Date.now(),
			})
			.where(eq(fileAssetTable.id, asset._id));
		return null;
	});

export const moveAsset = authMutation
	.input(z.object({ assetId: idSchema, folderId: idSchema.nullish() }))
	.mutation(async ({ ctx, input }) => {
		const asset = await getDoc<'fileAsset'>(ctx, asId<'fileAsset'>(input.assetId));
		if (!asset) throw new CRPCError({ code: 'NOT_FOUND', message: 'File not found' });
		const access = await verifyProjectAccess(ctx, { id: asset.projectId, userId: ctx.userId });
		assertProjectWritable(access);
		if (!access.permissions.canManageContent)
			throw new CRPCError({ code: 'FORBIDDEN', message: 'You cannot move this file' });
		const folderId = input.folderId ? asId<'fileFolder'>(input.folderId) : undefined;
		if (folderId) {
			const folder = await getDoc<'fileFolder'>(ctx, folderId);
			if (!folder || folder.projectId !== asset.projectId)
				throw new CRPCError({
					code: 'BAD_REQUEST',
					message: 'Folder does not belong to this project',
				});
		}
		await ctx.orm
			.update(fileAssetTable)
			.set({ folderId, updatedTime: Date.now() })
			.where(eq(fileAssetTable.id, asset._id));
		return null;
	});

export const removeAsset = authMutation
	.input(z.object({ assetId: idSchema }))
	.mutation(async ({ ctx, input }) => {
		const asset = await getDoc<'fileAsset'>(ctx, asId<'fileAsset'>(input.assetId));
		if (!asset) throw new CRPCError({ code: 'NOT_FOUND', message: 'File not found' });
		const access = await verifyProjectAccess(ctx, { id: asset.projectId, userId: ctx.userId });
		assertProjectWritable(access);
		if (!access.permissions.canManageContent)
			throw new CRPCError({ code: 'FORBIDDEN', message: 'You cannot delete this file' });
		const reference = await ctx.db
			.query('fileReference')
			.withIndex('by_assetId', (query) => query.eq('assetId', asset._id))
			.take(1);
		if (reference.length)
			throw appError({
				appCode: 'FILE_IN_USE',
				code: 'CONFLICT',
				message: 'This file is still used by another feature',
			});
		const objects = await ctx.db
			.query('fileObject')
			.withIndex('by_assetId', (query) => query.eq('assetId', asset._id))
			.take(10);
		for (const object of objects) {
			if (object.status === 'pending') await rejectReservedFile(ctx, object);
			if (object.status === 'ready') await releaseReadyFile(ctx, { asset, object });
			if (object.bucketKind === 'org_uploads' && object.status !== 'deleted')
				await orgUploadsR2.deleteObject(ctx, object.objectKey);
			await ctx.orm
				.update(fileObjectTable)
				.set({ deletedTime: Date.now(), status: 'deleted', updatedTime: Date.now() })
				.where(eq(fileObjectTable.id, object._id));
		}
		await deleteFileThumbnail(ctx, asset);
		await ctx.orm
			.update(fileAssetTable)
			.set({ deletedTime: Date.now(), status: 'deleted', updatedTime: Date.now() })
			.where(eq(fileAssetTable.id, asset._id));
		return null;
	});

export const getProjectUsage = authQuery
	.input(z.object({ projectId: idSchema }))
	.query(async ({ ctx, input }) => {
		const access = await verifyProjectAccess(ctx, { id: input.projectId, userId: ctx.userId });
		if (!access.permissions.canEditSettings && !access.permissions.canManageContent)
			throw new CRPCError({ code: 'FORBIDDEN', message: 'You cannot view project storage' });
		const usage = await getProjectStorageUsage(ctx, access.project.id);
		return {
			byCategory: usage?.byCategory ?? {},
			byOrigin: usage?.byOrigin ?? {},
			byUploaderClass: usage?.byUploaderClass ?? {},
			fileCount: usage?.fileCount ?? 0,
			limitBytes: getProjectStorageLimitBytes(),
			reservedBytes: usage?.reservedBytes ?? 0,
			usedBytes: usage?.usedBytes ?? 0,
		};
	});

export const getOrgUsage = authQuery
	.input(z.object({ orgSlug: orgSlugSchema }))
	.query(async ({ ctx, input }) => {
		const access = await verifyOrgAccess(ctx, { slug: input.orgSlug, userId: ctx.userId });
		if (!access.organization || !access.permissions.canEdit)
			throw new CRPCError({ code: 'FORBIDDEN', message: 'You cannot view organization storage' });
		const [rows, orgProjects] = await Promise.all([
			ctx.db
				.query('projectStorageUsage')
				.withIndex('by_orgSlug', (query) => query.eq('orgSlug', input.orgSlug))
				.take(200),
			ctx.db
				.query('project')
				.withIndex('by_orgSlug', (query) => query.eq('orgSlug', input.orgSlug))
				.take(200),
		]);
		const usageByProjectId = new Map(rows.map((row) => [row.projectId, row]));
		const projects = orgProjects.map((project) => {
			const usage = usageByProjectId.get(project._id);
			return {
				fileCount: usage?.fileCount ?? 0,
				id: project._id,
				limitBytes: getProjectStorageLimitBytes(),
				name: project.name,
				reservedBytes: usage?.reservedBytes ?? 0,
				slug: project.slug,
				usedBytes: usage?.usedBytes ?? 0,
			};
		});
		return {
			projects,
			totalFiles: rows.reduce((sum, row) => sum + row.fileCount, 0),
			totalReservedBytes: rows.reduce((sum, row) => sum + row.reservedBytes, 0),
			totalUsedBytes: rows.reduce((sum, row) => sum + row.usedBytes, 0),
		};
	});
