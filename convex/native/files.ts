import type { Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';

import { createPublicFileId } from '../shared/file-delivery';
import {
	buildFileSearchText,
	getFileFormatPolicy,
	getProjectStorageLimitBytes,
	isAcceptedFileMimeType,
	MAX_DIRECT_UPLOAD_BATCH_BYTES,
	MAX_DIRECT_UPLOAD_BATCH_FILES,
	MEBIBYTE,
	normalizeFileName,
	renameFilePreservingExtension,
} from '../shared/files';
import { internal } from './_generated/api';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import { requireOrganizationManager, requireProjectAccess, resolveProjectAccess } from './access';
import {
	account,
	detachUpdateFiles,
	enqueueCleanup,
	manageFiles,
	readFile,
	reserve,
	usageFor,
	viewFilesProject,
} from './files.lib';
import { fileCategory } from './filesSchema';
import { requireCurrentUser } from './identity';
import schema from './schema';

export const uploadInput = {
	projectId: v.id('projects'),
	folderId: v.optional(v.union(v.id('fileFolders'), v.null())),
	updateId: v.optional(v.id('updates')),
	files: v.array(v.object({ name: v.string(), mimeType: v.string(), sizeBytes: v.number() })),
};
export const reservationResult = v.array(
	v.object({
		assetId: v.id('fileAssets'),
		objectId: v.id('fileObjects'),
		stagingKey: v.string(),
		mimeType: v.string(),
		sizeBytes: v.number(),
		expiresAt: v.number(),
	})
);

async function folderInProject(ctx: QueryCtx, id: Id<'fileFolders'>, projectId: Id<'projects'>) {
	const folder = await ctx.db.get('fileFolders', id);
	if (!folder || folder.projectId !== projectId) throw new ConvexError('FOLDER_NOT_FOUND');
	return folder;
}
async function systemFolder(
	ctx: MutationCtx,
	projectId: Id<'projects'>,
	key: 'uploads' | 'updates'
) {
	const existing = await ctx.db
		.query('fileFolders')
		.withIndex('by_projectId_and_systemKey', (q) =>
			q.eq('projectId', projectId).eq('systemKey', key)
		)
		.unique();
	if (existing) return existing._id;
	if (
		(
			await ctx.db
				.query('fileFolders')
				.withIndex('by_projectId_and_systemKey', (q) => q.eq('projectId', projectId))
				.take(500)
		).length >= 500
	)
		throw new ConvexError('FOLDER_LIMIT_REACHED');
	return ctx.db.insert('fileFolders', {
		projectId,
		name: key === 'uploads' ? 'Uploads' : 'Updates',
		normalizedName: key,
		systemKey: key,
		updatedAt: Date.now(),
	});
}
export const reserveUpload = internalMutation({
	args: uploadInput,
	returns: reservationResult,
	handler: async (ctx, args) => {
		const { user, project } = await manageFiles(ctx, args.projectId);
		if (!args.files.length || args.files.length > MAX_DIRECT_UPLOAD_BATCH_FILES)
			throw new ConvexError('INVALID_FILE_BATCH');
		if (args.updateId) {
			const update = await ctx.db.get('updates', args.updateId);
			if (!update || update.projectId !== args.projectId || update.deletingAt !== undefined)
				throw new ConvexError('UPDATE_NOT_FOUND');
			if (args.files.length !== 1) throw new ConvexError('INVALID_FILE_BATCH');
			// Bound replacement races and the work needed when an update is deleted.
			const candidates = await ctx.db
				.query('fileAssets')
				.withIndex('by_coverUpdateId', (q) => q.eq('coverUpdateId', args.updateId))
				.take(100);
			if (candidates.some((a) => a.state === 'pending'))
				throw new ConvexError({ code: 'CONFLICT' });
			if (candidates.length >= 100) throw new ConvexError({ code: 'CONFLICT' });
		}
		const prepared = args.files.map((file) => {
			const name = normalizeFileName(file.name),
				policy = getFileFormatPolicy(name);
			if (
				!policy ||
				!name ||
				!Number.isSafeInteger(file.sizeBytes) ||
				file.sizeBytes <= 0 ||
				file.sizeBytes >
					Math.min(policy.maxBytes, args.updateId ? 5 * MEBIBYTE : policy.maxBytes) ||
				!isAcceptedFileMimeType(policy, file.mimeType) ||
				(args.updateId && policy.preview !== 'image')
			)
				throw new ConvexError('INVALID_FILE');
			return { ...file, name, policy };
		});
		const total = prepared.reduce((sum, f) => sum + f.sizeBytes, 0);
		if (total > MAX_DIRECT_UPLOAD_BATCH_BYTES) throw new ConvexError('FILE_UPLOAD_BATCH_TOO_LARGE');
		await reserve(ctx, project, total);
		let folderId = args.folderId ?? undefined;
		if (args.updateId) folderId = await systemFolder(ctx, project._id, 'updates');
		else if (folderId) await folderInProject(ctx, folderId, project._id);
		else if (args.folderId !== null) folderId = await systemFolder(ctx, project._id, 'uploads');
		const result = [];
		for (const file of prepared) {
			const publicId = createPublicFileId();
			if (
				await ctx.db
					.query('fileAssets')
					.withIndex('by_publicId', (q) => q.eq('publicId', publicId))
					.unique()
			)
				throw new Error('PUBLIC_ID_COLLISION');
			const origin = args.updateId ? ('update_cover' as const) : ('files' as const);
			const assetId = await ctx.db.insert('fileAssets', {
				projectId: project._id,
				folderId,
				name: file.name,
				normalizedName: file.name.toLowerCase(),
				extension: file.policy.extension,
				category: file.policy.category,
				searchContent: buildFileSearchText([
					file.name,
					file.policy.extension,
					file.policy.category,
					file.mimeType,
					origin,
				]),
				origin,
				uploaderId: user._id,
				uploaderClass: 'staff',
				access: 'public',
				listing: args.updateId ? 'unlisted' : 'project_files',
				publicId,
				state: 'pending',
				updatedAt: Date.now(),
				coverUpdateId: args.updateId,
			});
			const expiresAt = Date.now() + 15 * 60_000;
			const stagingKey = `NATIVE_STAGING.${publicId}`;
			const objectId = await ctx.db.insert('fileObjects', {
				projectId: project._id,
				assetId,
				stagingKey,
				key: `NATIVE_FILE.${publicId}`,
				declaredBytes: file.sizeBytes,
				mimeType: file.mimeType,
				maxBytes: Math.min(
					file.policy.maxBytes,
					args.updateId ? 5 * MEBIBYTE : file.policy.maxBytes
				),
				state: 'pending',
				expiresAt,
				settleAfter: expiresAt + 11 * 60_000,
				accounting: 'reserved',
			});
			await ctx.db.patch('fileAssets', assetId, { objectId });
			await ctx.scheduler.runAfter(15 * 60_000, internal.files.expire, { objectId });
			result.push({
				assetId,
				objectId,
				stagingKey,
				mimeType: file.mimeType,
				sizeBytes: file.sizeBytes,
				expiresAt,
			});
		}
		return result;
	},
});
export const claimUpload = internalMutation({
	args: { assetId: v.id('fileAssets') },
	returns: v.union(
		v.null(),
		v.object({
			object: schema.doc('fileObjects'),
			asset: schema.doc('fileAssets'),
			attempt: v.string(),
		})
	),
	handler: async (ctx, args) => {
		const asset = await ctx.db.get('fileAssets', args.assetId);
		if (!asset?.objectId) throw new ConvexError('FILE_NOT_FOUND');
		const { user } = await manageFiles(ctx, asset.projectId);
		if (asset.uploaderId !== user._id) throw new ConvexError('FORBIDDEN');
		const object = await ctx.db.get('fileObjects', asset.objectId);
		if (!object) throw new ConvexError('FILE_NOT_FOUND');
		if (object.state === 'ready') return null;
		if (object.state !== 'pending' || Date.now() >= object.expiresAt)
			throw new ConvexError('INVALID_UPLOAD_STATE');
		// A processing attempt is never replaced. A crashed attempt expires and the
		// caller starts a new intent, preventing a late writer from overwriting a
		// newer attempt's validated object.
		if (object.processingAttempt) throw new ConvexError({ code: 'CONFLICT' });
		const attempt = crypto.randomUUID();
		await ctx.db.patch('fileObjects', object._id, {
			processingAttempt: attempt,
			processingUntil: Date.now() + 120_000,
		});
		return { object, asset, attempt };
	},
});
export const finishUpload = internalMutation({
	args: {
		objectId: v.id('fileObjects'),
		attempt: v.string(),
		bytes: v.number(),
		mimeType: v.string(),
		thumbnailBytes: v.optional(v.number()),
		extractedText: v.optional(v.string()),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const object = await ctx.db.get('fileObjects', args.objectId);
		if (
			!object ||
			object.state !== 'pending' ||
			object.processingAttempt !== args.attempt ||
			(object.processingUntil ?? 0) < Date.now()
		)
			return false;
		const asset = await ctx.db.get('fileAssets', object.assetId);
		if (!asset) return false;
		const policy = getFileFormatPolicy(asset.extension);
		const access = await resolveProjectAccess(ctx, asset.projectId);
		// Completion is an internal transaction; recheck the original uploader's current authority
		// through the action's propagated identity, including revocation/archive races.
		const current = await requireCurrentUser(ctx);
		if (
			!access.project ||
			access.project.storageDeletingAt !== undefined ||
			access.isArchived ||
			!access.permissions.canManageContent ||
			current._id !== asset.uploaderId ||
			!policy ||
			args.bytes !== object.declaredBytes ||
			args.bytes > object.maxBytes ||
			!isAcceptedFileMimeType(policy, args.mimeType)
		) {
			await enqueueCleanup(ctx, object);
			return false;
		}
		if (asset.coverUpdateId) {
			const update = await ctx.db.get('updates', asset.coverUpdateId);
			if (!update || update.deletingAt !== undefined || update.projectId !== asset.projectId) {
				await enqueueCleanup(ctx, object);
				return false;
			}
			await detachUpdateFiles(ctx, update._id, asset._id);
			await ctx.db.insert('fileReferences', {
				projectId: asset.projectId,
				assetId: asset._id,
				updateId: update._id,
			});
			await ctx.db.patch('updates', update._id, { coverAssetId: asset._id, updatedAt: Date.now() });
		}
		await account(ctx, asset, object, 'commit', args.bytes);
		await ctx.db.patch('fileObjects', object._id, {
			state: 'ready',
			actualBytes: args.bytes,
			mimeType: args.mimeType,
			thumbnailBytes: args.thumbnailBytes,
			thumbnailKey: args.thumbnailBytes ? `NATIVE_THUMB.${asset.publicId}.webp` : undefined,
			processingAttempt: undefined,
			processingUntil: undefined,
		});
		await ctx.db.patch('fileAssets', asset._id, {
			state: 'ready',
			extractedText: args.extractedText?.slice(0, 16_000),
			searchContent: buildFileSearchText([
				asset.name,
				asset.extension,
				asset.category,
				args.mimeType,
				asset.origin,
				args.extractedText?.slice(0, 16_000),
			]),
			updatedAt: Date.now(),
		});
		await enqueueCleanup(ctx, object, true);
		return true;
	},
});
export const rejectUpload = internalMutation({
	args: { objectId: v.id('fileObjects'), attempt: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const object = await ctx.db.get('fileObjects', args.objectId);
		if (object?.state === 'pending' && object.processingAttempt === args.attempt)
			await enqueueCleanup(ctx, object);
		return null;
	},
});
export const expire = internalMutation({
	args: { objectId: v.id('fileObjects') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const object = await ctx.db.get('fileObjects', args.objectId);
		if (object?.state === 'pending') await enqueueCleanup(ctx, object);
		return null;
	},
});
export const list = query({
	args: {
		projectId: v.id('projects'),
		folderId: v.optional(v.union(v.id('fileFolders'), v.null())),
		search: v.optional(v.string()),
		category: v.optional(fileCategory),
		extension: v.optional(v.string()),
		sort: v.optional(v.union(v.literal('created_desc'), v.literal('edited_desc'))),
		paginationOpts: paginationOptsValidator,
	},
	returns: paginationResultValidator(schema.doc('fileAssets')),
	handler: async (ctx, args) => {
		await viewFilesProject(ctx, args.projectId);
		if (args.folderId) await folderInProject(ctx, args.folderId, args.projectId);
		const search = args.search?.trim().slice(0, 100);
		const base = ctx.db.query('fileAssets');
		if (search)
			return base
				.withSearchIndex('search_by_searchContent', (q) => {
					let next = q
						.search('searchContent', search)
						.eq('projectId', args.projectId)
						.eq('state', 'ready')
						.eq('access', 'public')
						.eq('listing', 'project_files');
					if (args.category) next = next.eq('category', args.category);
					if (args.extension) next = next.eq('extension', args.extension.toLowerCase());
					if (args.folderId !== undefined) next = next.eq('folderId', args.folderId ?? undefined);
					return next;
				})
				.paginate(args.paginationOpts);
		if (args.category && args.extension) throw new ConvexError('INVALID_FILE_FILTER');
		// Every public listing starts with an indexed visibility fence. Optional facets
		// are indexed too; only combined directory/facet filtering is post-pagination.
		const listingQuery = args.extension
			? base.withIndex('by_projectId_and_listing_and_access_and_state_and_extension', (q) =>
					q
						.eq('projectId', args.projectId)
						.eq('listing', 'project_files')
						.eq('access', 'public')
						.eq('state', 'ready')
						.eq('extension', args.extension!.toLowerCase())
				)
			: args.category
				? base.withIndex('by_projectId_and_listing_and_access_and_state_and_category', (q) =>
						q
							.eq('projectId', args.projectId)
							.eq('listing', 'project_files')
							.eq('access', 'public')
							.eq('state', 'ready')
							.eq('category', args.category!)
					)
				: args.folderId !== undefined
					? base.withIndex('by_projectId_and_listing_and_access_and_state_and_folderId', (q) =>
							q
								.eq('projectId', args.projectId)
								.eq('listing', 'project_files')
								.eq('access', 'public')
								.eq('state', 'ready')
								.eq('folderId', args.folderId ?? undefined)
						)
					: args.sort === 'edited_desc'
						? base.withIndex('by_projectId_and_listing_and_access_and_state_and_updatedAt', (q) =>
								q
									.eq('projectId', args.projectId)
									.eq('listing', 'project_files')
									.eq('access', 'public')
									.eq('state', 'ready')
							)
						: base.withIndex('by_projectId_and_listing_and_access_and_state', (q) =>
								q
									.eq('projectId', args.projectId)
									.eq('listing', 'project_files')
									.eq('access', 'public')
									.eq('state', 'ready')
							);
		const result = await listingQuery.order('desc').paginate(args.paginationOpts);
		return {
			...result,
			page: result.page.filter(
				(a) => args.folderId === undefined || a.folderId === (args.folderId ?? undefined)
			),
		};
	},
});
export const detail = query({
	args: { assetId: v.id('fileAssets') },
	returns: v.object({
		asset: schema.doc('fileAssets'),
		bytes: v.number(),
		mimeType: v.string(),
		thumbnail: v.boolean(),
		canManage: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const asset = await readFile(ctx, args.assetId);
		const object = asset.objectId ? await ctx.db.get('fileObjects', asset.objectId) : null;
		if (!object || object.state !== 'ready') throw new ConvexError('FILE_NOT_FOUND');
		const access = await viewFilesProject(ctx, asset.projectId);
		return {
			asset,
			bytes: object.actualBytes ?? 0,
			mimeType: object.mimeType,
			thumbnail: !!object.thumbnailKey,
			canManage: access.permissions.canManageContent && !access.isArchived,
		};
	},
});
export const deliverySource = internalQuery({
	args: { assetId: v.id('fileAssets'), thumbnail: v.optional(v.boolean()) },
	returns: v.object({ key: v.string(), mimeType: v.string(), name: v.string() }),
	handler: async (ctx, args) => {
		const asset = await readFile(ctx, args.assetId);
		const object = asset.objectId ? await ctx.db.get('fileObjects', asset.objectId) : null;
		const key = args.thumbnail ? object?.thumbnailKey : object?.key;
		if (!key || object?.state !== 'ready') throw new ConvexError('FILE_NOT_FOUND');
		return { key, mimeType: args.thumbnail ? 'image/webp' : object.mimeType, name: asset.name };
	},
});
export const folders = query({
	args: { projectId: v.id('projects') },
	returns: v.array(schema.doc('fileFolders')),
	handler: async (ctx, args) => {
		await viewFilesProject(ctx, args.projectId);
		return ctx.db
			.query('fileFolders')
			.withIndex('by_projectId_and_systemKey', (q) => q.eq('projectId', args.projectId))
			.take(500);
	},
});
export const saveFolder = mutation({
	args: {
		projectId: v.id('projects'),
		folderId: v.optional(v.id('fileFolders')),
		parentId: v.optional(v.id('fileFolders')),
		name: v.string(),
	},
	returns: v.id('fileFolders'),
	handler: async (ctx, args) => {
		await manageFiles(ctx, args.projectId);
		const name = normalizeFileName(args.name);
		if (!name || name.length > 100) throw new ConvexError('INVALID_FOLDER');
		if (!args.parentId && ['uploads', 'updates'].includes(name.toLowerCase()))
			throw new ConvexError('FOLDER_NAME_TAKEN');
		const all = await ctx.db
			.query('fileFolders')
			.withIndex('by_projectId_and_systemKey', (q) => q.eq('projectId', args.projectId))
			.take(501);
		const current = args.folderId
			? await folderInProject(ctx, args.folderId, args.projectId)
			: null;
		if (current?.systemKey) throw new ConvexError('FORBIDDEN');
		if (!current && all.length >= 500) throw new ConvexError('FOLDER_LIMIT_REACHED');
		if (args.parentId) await folderInProject(ctx, args.parentId, args.projectId);
		if (
			all.some(
				(f) =>
					f._id !== args.folderId &&
					f.parentId === args.parentId &&
					f.normalizedName === name.toLowerCase()
			)
		)
			throw new ConvexError('FOLDER_NAME_TAKEN');
		// Validate the proposed entire bounded hierarchy: cycles and descendant depth.
		const proposed = all.map((f) =>
			f._id === args.folderId ? { ...f, parentId: args.parentId } : f
		);
		const byId = new Map(proposed.map((f) => [f._id, f]));
		for (const start of [...proposed, { _id: args.folderId, parentId: args.parentId }]) {
			const seen = new Set<string>();
			let cursor: Id<'fileFolders'> | undefined = start.parentId;
			let depth = 1;
			if (start._id) seen.add(start._id);
			while (cursor) {
				if (seen.has(cursor)) throw new ConvexError('INVALID_FOLDER_CYCLE');
				seen.add(cursor);
				depth++;
				if (depth > 12) throw new ConvexError('FOLDER_DEPTH_EXCEEDED');
				cursor = byId.get(cursor)?.parentId;
			}
		}
		const fields = {
			name,
			normalizedName: name.toLowerCase(),
			parentId: args.parentId,
			updatedAt: Date.now(),
		};
		if (current) {
			await ctx.db.patch('fileFolders', current._id, fields);
			return current._id;
		}
		return ctx.db.insert('fileFolders', { projectId: args.projectId, ...fields });
	},
});
export const removeFolder = mutation({
	args: { folderId: v.id('fileFolders') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const folder = await ctx.db.get('fileFolders', args.folderId);
		if (!folder) throw new ConvexError('FOLDER_NOT_FOUND');
		await manageFiles(ctx, folder.projectId);
		if (folder.systemKey) throw new ConvexError('FORBIDDEN');
		if (
			await ctx.db
				.query('fileFolders')
				.withIndex('by_projectId_and_parentId_and_normalizedName', (q) =>
					q.eq('projectId', folder.projectId).eq('parentId', folder._id)
				)
				.first()
		)
			throw new ConvexError('FOLDER_NOT_EMPTY');
		for (const state of ['pending', 'ready', 'deleting'] as const)
			if (
				await ctx.db
					.query('fileAssets')
					.withIndex('by_projectId_and_state_and_folderId', (q) =>
						q.eq('projectId', folder.projectId).eq('state', state).eq('folderId', folder._id)
					)
					.first()
			)
				throw new ConvexError('FOLDER_NOT_EMPTY');
		await ctx.db.delete('fileFolders', folder._id);
		return null;
	},
});
export const edit = mutation({
	args: {
		assetId: v.id('fileAssets'),
		name: v.string(),
		folderId: v.optional(v.id('fileFolders')),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const asset = await readFile(ctx, args.assetId);
		await manageFiles(ctx, asset.projectId);
		if (args.folderId) await folderInProject(ctx, args.folderId, asset.projectId);
		const name = renameFilePreservingExtension(args.name, asset.extension);
		if (!name) throw new ConvexError('INVALID_FILE_NAME');
		await ctx.db.patch('fileAssets', asset._id, {
			name,
			normalizedName: name.toLowerCase(),
			folderId: args.folderId,
			searchContent: buildFileSearchText([
				name,
				asset.extension,
				asset.category,
				asset.origin,
				asset.extractedText,
			]),
			updatedAt: Date.now(),
		});
		return null;
	},
});
export const remove = mutation({
	args: { assetId: v.id('fileAssets') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const asset = await ctx.db.get('fileAssets', args.assetId);
		if (!asset) throw new ConvexError('FILE_NOT_FOUND');
		await manageFiles(ctx, asset.projectId);
		if (
			await ctx.db
				.query('fileReferences')
				.withIndex('by_assetId', (q) => q.eq('assetId', asset._id))
				.first()
		)
			throw new ConvexError('FILE_IN_USE');
		const object = asset.objectId ? await ctx.db.get('fileObjects', asset.objectId) : null;
		if (object && object.state !== 'deleted') await enqueueCleanup(ctx, object);
		return null;
	},
});
export const removeCover = mutation({
	args: { updateId: v.id('updates') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const update = await ctx.db.get('updates', args.updateId);
		if (!update || update.deletingAt !== undefined) throw new ConvexError('UPDATE_NOT_FOUND');
		await manageFiles(ctx, update.projectId);
		await detachUpdateFiles(ctx, update._id);
		await ctx.db.patch('updates', update._id, { coverAssetId: undefined, updatedAt: Date.now() });
		return null;
	},
});
export const usage = query({
	args: { projectId: v.id('projects') },
	returns: v.object({
		usage: v.union(schema.doc('storageUsage'), v.null()),
		limitBytes: v.number(),
	}),
	handler: async (ctx, args) => {
		const access = await requireProjectAccess(ctx, args.projectId);
		if (!access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
		return {
			usage: await usageFor(ctx, args.projectId),
			limitBytes: getProjectStorageLimitBytes(),
		};
	},
});
export const organizationUsage = query({
	args: { organizationId: v.id('organizations'), paginationOpts: paginationOptsValidator },
	returns: paginationResultValidator(schema.doc('storageUsage')),
	handler: async (ctx, args) => {
		await requireOrganizationManager(ctx, args.organizationId);
		return ctx.db
			.query('storageUsage')
			.withIndex('by_organizationId', (q) => q.eq('organizationId', args.organizationId))
			.paginate(args.paginationOpts);
	},
});

// Public delivery must check public visibility independently of the caller's
// identity: an administrator's authenticated query must never mint a public URL
// for a private project or an unpublished cover.
export const publicMetadata = query({
	args: { publicId: v.string() },
	returns: v.union(v.null(), v.object({ name: v.string(), thumbnail: v.boolean() })),
	handler: async (ctx, args) => {
		if (!/^[a-f0-9]{32}$/.test(args.publicId)) return null;
		const asset = await ctx.db
			.query('fileAssets')
			.withIndex('by_publicId', (q) => q.eq('publicId', args.publicId))
			.unique();
		if (!asset || asset.state !== 'ready' || asset.access !== 'public') return null;
		if (asset.listing !== 'project_files' && !asset.coverUpdateId) return null;
		const project = await ctx.db.get('projects', asset.projectId);
		const org = project ? await ctx.db.get('organizations', project.organizationId) : null;
		if (
			project?.visibility !== 'public' ||
			project.storageDeletingAt !== undefined ||
			org?.visibility !== 'public'
		)
			return null;
		if (asset.coverUpdateId) {
			const update = await ctx.db.get('updates', asset.coverUpdateId);
			if (
				update?.status !== 'published' ||
				update.deletingAt !== undefined ||
				update.coverAssetId !== asset._id
			)
				return null;
		}
		const object = asset.objectId ? await ctx.db.get('fileObjects', asset.objectId) : null;
		return object?.state === 'ready'
			? { name: asset.name, thumbnail: !!object.thumbnailKey }
			: null;
	},
});
