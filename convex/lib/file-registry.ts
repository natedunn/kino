import type { Id } from '../functions/_generated/dataModel';
import type { MutationCtx } from '../functions/generated/server';
import type {
	FileAccessLevel,
	FileCreationMethod,
	FileListing,
	FileOriginFeature,
	FileUploaderClass,
} from '../shared/files';

import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CRPCError } from 'kitcn/server';

import {
	fileAssetTable,
	fileFolderTable,
	fileObjectTable,
	fileReferenceTable,
} from '../functions/schema';
import {
	createPublicFileId,
	getPublicFileObjectKey,
	isPublicFileDeliveryEligible,
} from '../shared/file-delivery';
import {
	buildFileSearchText,
	getFileFormatPolicy,
	isAcceptedFileMimeType,
	normalizeFileName,
} from '../shared/files';
import { rejectReservedFile, releaseReadyFile, reserveProjectStorage } from './file-usage';
import { orgUploadsR2, userUploadsR2 } from './r2';

export const UPLOAD_INTENT_TTL_MS = 60 * 60 * 1000;

type UploadFileInput = { mimeType: string; name: string; sizeBytes: number };

export async function deleteFileThumbnail(
	ctx: Pick<MutationCtx, 'runMutation' | 'runQuery'>,
	asset: {
		thumbnailBucketKind?: 'org_uploads' | 'user_uploads' | null;
		thumbnailObjectKey?: string | null;
	}
) {
	if (!asset.thumbnailObjectKey || !asset.thumbnailBucketKind) return;
	const r2 = asset.thumbnailBucketKind === 'user_uploads' ? userUploadsR2 : orgUploadsR2;
	await r2.deleteObject(ctx, asset.thumbnailObjectKey);
}

export async function ensureSystemFileFolder(
	ctx: Pick<MutationCtx, 'db' | 'orm'>,
	args: {
		createdByProfileId?: Id<'profile'> | null;
		name: string;
		projectId: Id<'project'>;
		systemKey: string;
	}
) {
	const existing = await ctx.db
		.query('fileFolder')
		.withIndex('by_projectId_systemKey', (query) =>
			query.eq('projectId', args.projectId).eq('systemKey', args.systemKey)
		)
		.unique();
	if (existing) return existing._id;

	const now = Date.now();
	const [folder] = await ctx.orm
		.insert(fileFolderTable)
		.values({
			createdByProfileId: args.createdByProfileId ?? null,
			createdTime: now,
			name: args.name,
			normalizedName: args.name.trim().toLowerCase(),
			projectId: args.projectId,
			systemKey: args.systemKey,
			updatedTime: now,
		})
		.returning();
	return folder.id as Id<'fileFolder'>;
}

export async function createProjectUploadIntents(
	ctx: Pick<MutationCtx, 'db' | 'orm'>,
	args: {
		access: FileAccessLevel;
		bucketKind: 'org_uploads' | 'user_uploads';
		creationMethod: FileCreationMethod;
		files: ReadonlyArray<UploadFileInput>;
		folderId?: Id<'fileFolder'> | null;
		listing: FileListing;
		maxBytes?: number;
		orgSlug: string;
		originFeature: FileOriginFeature;
		projectId: Id<'project'>;
		reference?: {
			entityId: string;
			entityType: string;
			feature: FileOriginFeature;
			field: string;
		};
		uploadedByProfileId?: Id<'profile'> | null;
		uploaderClass: FileUploaderClass;
	}
) {
	if (
		args.listing === 'project_files' &&
		(args.access !== 'public' || args.bucketKind !== 'org_uploads')
	) {
		throw new CRPCError({
			code: 'BAD_REQUEST',
			message: 'Only public organization uploads can be listed in project Files',
		});
	}
	const prepared = args.files.map((file) => {
		const name = normalizeFileName(file.name);
		const policy = getFileFormatPolicy(name);
		if (!name || !policy) {
			throw new CRPCError({
				code: 'BAD_REQUEST',
				message: `${file.name} is not an allowed file type`,
			});
		}
		if (!Number.isSafeInteger(file.sizeBytes) || file.sizeBytes <= 0) {
			throw new CRPCError({ code: 'BAD_REQUEST', message: `${name} has an invalid file size` });
		}
		const maxBytes = Math.min(policy.maxBytes, args.maxBytes ?? policy.maxBytes);
		if (file.sizeBytes > maxBytes) {
			throw new CRPCError({ code: 'BAD_REQUEST', message: `${name} exceeds its file-size limit` });
		}
		if (!isAcceptedFileMimeType(policy, file.mimeType)) {
			throw new CRPCError({
				code: 'BAD_REQUEST',
				message: `${name} has an unsupported content type`,
			});
		}
		return { file, maxBytes, name, policy };
	});

	await reserveProjectStorage(ctx, {
		bytes: prepared.reduce((sum, item) => sum + item.file.sizeBytes, 0),
		orgSlug: args.orgSlug,
		projectId: args.projectId,
	});

	const now = Date.now();
	const r2 = args.bucketKind === 'org_uploads' ? orgUploadsR2 : userUploadsR2;
	const publiclyDeliverable = isPublicFileDeliveryEligible(args);
	const intents = [];
	for (const item of prepared) {
		let publicId: string | undefined;
		if (publiclyDeliverable) {
			for (let attempt = 0; attempt < 3; attempt += 1) {
				const candidate = createPublicFileId();
				const existing = await ctx.db
					.query('fileAsset')
					.withIndex('by_publicId', (query) => query.eq('publicId', candidate))
					.unique();
				if (!existing) {
					publicId = candidate;
					break;
				}
			}
			if (!publicId) throw new Error('Could not allocate a unique public file ID');
		}
		const [asset] = await ctx.orm
			.insert(fileAssetTable)
			.values({
				access: args.access,
				category: item.policy.category,
				createdTime: now,
				creationMethod: args.creationMethod,
				extension: item.policy.extension,
				folderId: args.folderId ?? undefined,
				listing: args.listing,
				mimeType: item.file.mimeType,
				name: item.name,
				normalizedName: item.name.toLowerCase(),
				originFeature: args.originFeature,
				projectId: args.projectId,
				publicId,
				searchContent: buildFileSearchText([
					item.name,
					item.policy.extension,
					item.policy.category,
					item.file.mimeType,
					args.originFeature,
				]),
				sourceProvider: 'kino',
				status: 'pending',
				updatedTime: now,
				uploadedByProfileId: args.uploadedByProfileId ?? null,
				uploaderClass: args.uploaderClass,
			})
			.returning();
		const assetId = asset.id as Id<'fileAsset'>;
		const requestedKey = publicId
			? getPublicFileObjectKey(publicId)
			: `PROJECT_FILE.${args.projectId}.${assetId}.${item.policy.extension}`;
		if (args.reference) {
			await ctx.orm.insert(fileReferenceTable).values({
				assetId,
				createdTime: now,
				entityId: args.reference.entityId,
				entityType: args.reference.entityType,
				feature: args.reference.feature,
				field: args.reference.field,
				projectId: args.projectId,
			});
		}
		const upload = {
			key: requestedKey,
			url: await getSignedUrl(
				r2.client,
				new PutObjectCommand({
					Bucket: r2.config.bucket,
					ContentLength: item.file.sizeBytes,
					ContentType: item.file.mimeType,
					Key: requestedKey,
				})
			),
		};
		const [object] = await ctx.orm
			.insert(fileObjectTable)
			.values({
				assetId,
				bucketKind: args.bucketKind,
				createdTime: now,
				declaredBytes: item.file.sizeBytes,
				declaredMimeType: item.file.mimeType,
				expiresAt: now + UPLOAD_INTENT_TTL_MS,
				maxBytes: item.maxBytes,
				objectKey: upload.key,
				orgSlug: args.orgSlug,
				projectId: args.projectId,
				status: 'pending',
				storageProvider: 'r2',
				updatedTime: now,
			})
			.returning();
		intents.push({
			assetId: String(assetId),
			key: upload.key,
			maxBytes: item.maxBytes,
			objectId: String(object.id),
			publicId: publicId ?? null,
			url: upload.url,
		});
	}
	return intents;
}

export async function deleteRegisteredFileByObjectKey(
	ctx: Pick<MutationCtx, 'db' | 'runMutation' | 'runQuery'>,
	objectKey: string
) {
	const object = await ctx.db
		.query('fileObject')
		.withIndex('by_objectKey', (query) => query.eq('objectKey', objectKey))
		.unique();
	if (!object) return false;
	if (object.status === 'deleted') return true;
	const asset = await ctx.db.get('fileAsset', object.assetId);
	if (object.status === 'pending') await rejectReservedFile(ctx, object);
	if (object.status === 'ready' && asset) await releaseReadyFile(ctx, { asset, object });
	if (asset) await deleteFileThumbnail(ctx, asset);
	if (object.bucketKind !== 'external') {
		const r2 = object.bucketKind === 'user_uploads' ? userUploadsR2 : orgUploadsR2;
		await r2.deleteObject(ctx, object.objectKey);
	}
	const references = await ctx.db
		.query('fileReference')
		.withIndex('by_assetId', (query) => query.eq('assetId', object.assetId))
		.take(50);
	for (const reference of references) {
		await ctx.db.delete('fileReference', reference._id);
	}
	const now = Date.now();
	await ctx.db.patch('fileObject', object._id, {
		deletedTime: now,
		status: 'deleted',
		updatedTime: now,
	});
	if (asset) {
		await ctx.db.patch('fileAsset', asset._id, {
			deletedTime: now,
			status: 'deleted',
			updatedTime: now,
		});
	}
	return true;
}
