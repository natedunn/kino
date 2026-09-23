import type { Doc, Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';

import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';

import { getPublicFileDeliveryUrl, getPublicFileThumbnailUrl } from '../shared/file-delivery';
import { getProjectStorageLimitBytes } from '../shared/files';
import { api } from './_generated/api';
import { env, mutation, query } from './_generated/server';
import { requireOrganizationManager } from './access';
import { readFile, usageFor, viewFilesProject } from './files.lib';
import { fileCategory } from './filesSchema';

export const folders = query({
	args: { projectId: v.id('projects') },
	returns: v.array(
		v.object({
			id: v.string(),
			name: v.string(),
			parentFolderId: v.optional(v.string()),
			systemKey: v.optional(v.string()),
			createdTime: v.number(),
			updatedTime: v.number(),
		})
	),
	handler: async (ctx, args) =>
		(await ctx.runQuery(api.files.folders, args))
			.sort((a, b) => a.normalizedName.localeCompare(b.normalizedName))
			.map((f) => ({
				id: String(f._id),
				name: f.name,
				parentFolderId: f.parentId,
				systemKey: f.systemKey,
				createdTime: f._creationTime,
				updatedTime: f.updatedAt,
			})),
});
const breakdown = v.record(v.string(), v.object({ bytes: v.number(), files: v.number() }));
export const usage = query({
	args: { projectId: v.id('projects') },
	returns: v.object({
		byCategory: breakdown,
		byOrigin: breakdown,
		byUploaderClass: breakdown,
		fileCount: v.number(),
		limitBytes: v.number(),
		reservedBytes: v.number(),
		usedBytes: v.number(),
	}),
	handler: async (ctx, args) => {
		const { usage: currentUsage, limitBytes } = await ctx.runQuery(api.files.usage, args);
		return {
			byCategory: currentUsage?.byCategory ?? {},
			byOrigin: currentUsage?.byOrigin ?? {},
			byUploaderClass: currentUsage?.byUploaderClass ?? {},
			fileCount: currentUsage?.fileCount ?? 0,
			limitBytes,
			reservedBytes: currentUsage?.reservedBytes ?? 0,
			usedBytes: currentUsage?.usedBytes ?? 0,
		};
	},
});

export const editableOrganizations = query({
	args: {},
	returns: v.array(
		v.object({
			logo: v.union(v.null(), v.string()),
			name: v.string(),
			slug: v.string(),
			role: v.union(v.literal('owner'), v.literal('admin')),
		})
	),
	handler: async (ctx) => {
		const rows = await ctx.runQuery(api.organizations.listMine, {});
		return rows.flatMap((o) =>
			o.role === 'owner' || o.role === 'admin'
				? [{ name: o.name, slug: o.slug, role: o.role, logo: o.logo }]
				: []
		);
	},
});
export const organizationUsage = query({
	args: { orgSlug: v.string() },
	returns: v.object({
		projects: v.array(
			v.object({
				id: v.string(),
				name: v.string(),
				slug: v.string(),
				fileCount: v.number(),
				limitBytes: v.number(),
				reservedBytes: v.number(),
				usedBytes: v.number(),
			})
		),
		totalFiles: v.number(),
		totalReservedBytes: v.number(),
		totalUsedBytes: v.number(),
	}),
	handler: async (ctx, args) => {
		const org = await ctx.db
			.query('organizations')
			.withIndex('by_slug', (q) => q.eq('slug', args.orgSlug))
			.unique();
		if (!org) throw new ConvexError('ORGANIZATION_NOT_FOUND');
		await requireOrganizationManager(ctx, org._id);
		const rows = await ctx.db
			.query('projects')
			.withIndex('by_organizationId', (q) => q.eq('organizationId', org._id))
			.take(201);
		if (rows.length > 200) throw new ConvexError('ORGANIZATION_LIMIT_REACHED');
		const projects = await Promise.all(
			rows.map(async (p) => {
				const u = await usageFor(ctx, p._id);
				return {
					id: String(p._id),
					name: p.name,
					slug: p.slug,
					fileCount: u?.fileCount ?? 0,
					usedBytes: u?.usedBytes ?? 0,
					reservedBytes: u?.reservedBytes ?? 0,
					limitBytes: getProjectStorageLimitBytes(),
				};
			})
		);
		return {
			projects,
			totalFiles: projects.reduce((n, p) => n + p.fileCount, 0),
			totalReservedBytes: projects.reduce((n, p) => n + p.reservedBytes, 0),
			totalUsedBytes: projects.reduce((n, p) => n + p.usedBytes, 0),
		};
	},
});
const row = v.object({
	id: v.string(),
	name: v.string(),
	folderId: v.optional(v.string()),
	category: fileCategory,
	extension: v.string(),
	mimeType: v.string(),
	createdTime: v.number(),
	updatedTime: v.number(),
	sizeBytes: v.optional(v.number()),
	originFeature: v.string(),
	sourceProvider: v.literal('kino'),
	thumbnailStatus: v.optional(
		v.union(v.literal('pending'), v.literal('ready'), v.literal('failed'))
	),
	thumbnailUrl: v.union(v.string(), v.null()),
	hasThumbnail: v.boolean(),
});
async function publicOrigin(ctx: QueryCtx, projectId: Id<'projects'>) {
	const { project } = await viewFilesProject(ctx, projectId);
	const org = await ctx.db.get('organizations', project.organizationId);
	return project.visibility === 'public' && org?.visibility === 'public'
		? env.NATIVE_FILES_ORIGIN
		: undefined;
}
async function toRow(ctx: QueryCtx, asset: Doc<'fileAssets'>, origin?: string) {
	const object = asset.objectId ? await ctx.db.get('fileObjects', asset.objectId) : null;
	return {
		id: String(asset._id),
		name: asset.name,
		folderId: asset.folderId,
		category: asset.category,
		extension: asset.extension,
		mimeType: object?.mimeType ?? 'application/octet-stream',
		createdTime: asset._creationTime,
		updatedTime: asset.updatedAt,
		sizeBytes: object?.actualBytes ?? 0,
		originFeature: asset.origin,
		sourceProvider: 'kino' as const,
		thumbnailStatus: object?.thumbnailKey ? ('ready' as const) : ('failed' as const),
		hasThumbnail: !!object?.thumbnailKey,
		thumbnailUrl:
			object?.thumbnailKey && origin
				? getPublicFileThumbnailUrl({ origin, publicId: asset.publicId })
				: null,
	};
}
export const list = query({
	args: {
		projectId: v.id('projects'),
		folderId: v.optional(v.union(v.id('fileFolders'), v.null())),
		category: v.optional(fileCategory),
		extension: v.optional(v.string()),
		search: v.optional(v.string()),
		sourceProvider: v.optional(v.string()),
		sort: v.optional(v.union(v.literal('created_desc'), v.literal('edited_desc'))),
		paginationOpts: paginationOptsValidator,
	},
	returns: paginationResultValidator(row),
	handler: async (ctx, args) => {
		const origin = await publicOrigin(ctx, args.projectId);
		if (args.sourceProvider && args.sourceProvider !== 'kino')
			return { page: [], isDone: true, continueCursor: '' };
		const { sourceProvider: _source, ...listArgs } = args;
		const result = await ctx.runQuery(api.files.list, listArgs);
		return {
			...result,
			page: await Promise.all(result.page.map((asset) => toRow(ctx, asset, origin))),
		};
	},
});
export const tree = query({
	args: { projectId: v.id('projects') },
	returns: v.object({
		files: v.array(
			v.object({
				id: v.string(),
				name: v.string(),
				category: fileCategory,
				folderId: v.optional(v.string()),
			})
		),
		truncated: v.boolean(),
	}),
	handler: async (ctx, args) => {
		await viewFilesProject(ctx, args.projectId);
		const rows = await ctx.db
			.query('fileAssets')
			.withIndex('by_projectId_and_listing_and_access_and_state_and_normalizedName', (q) =>
				q
					.eq('projectId', args.projectId)
					.eq('listing', 'project_files')
					.eq('access', 'public')
					.eq('state', 'ready')
			)
			.take(501);
		return {
			files: rows.slice(0, 500).map((a) => ({
				id: String(a._id),
				name: a.name,
				category: a.category,
				folderId: a.folderId,
			})),
			truncated: rows.length > 500,
		};
	},
});
const source = v.object({
	access: v.string(),
	creationMethod: v.string(),
	originFeature: v.string(),
	publicId: v.string(),
	readyTime: v.union(v.number(), v.null()),
	referenceCount: v.number(),
	references: v.array(v.object({ entityType: v.string(), feature: v.string(), field: v.string() })),
	referencesTruncated: v.boolean(),
	sourceProvider: v.string(),
	storageProvider: v.string(),
	uploaderClass: v.string(),
});
export const detail = query({
	args: { assetId: v.id('fileAssets'), projectId: v.id('projects') },
	returns: v.union(
		v.null(),
		v.object({
			id: v.string(),
			name: v.string(),
			category: fileCategory,
			extension: v.string(),
			createdTime: v.number(),
			updatedTime: v.number(),
			sizeBytes: v.number(),
			mimeType: v.string(),
			previewText: v.union(v.string(), v.null()),
			deliveryUrl: v.string(),
			canManage: v.boolean(),
			listing: v.string(),
			folder: v.union(v.null(), v.object({ id: v.string(), name: v.string() })),
			uploadedBy: v.union(
				v.null(),
				v.object({ id: v.string(), name: v.string(), username: v.string() })
			),
			sourceAndUsage: v.union(source, v.null()),
		})
	),
	handler: async (ctx, args) => {
		const candidate = await ctx.db.get('fileAssets', args.assetId);
		if (
			!candidate ||
			candidate.state !== 'ready' ||
			candidate.projectId !== args.projectId ||
			candidate.listing !== 'project_files'
		)
			return null;
		const asset = await readFile(ctx, args.assetId);
		const { permissions, isArchived } = await viewFilesProject(ctx, args.projectId);
		const object = asset.objectId ? await ctx.db.get('fileObjects', asset.objectId) : null;
		if (!object || object.state !== 'ready') return null;
		const folder = asset.folderId ? await ctx.db.get('fileFolders', asset.folderId) : null;
		const profile = await ctx.db
			.query('profiles')
			.withIndex('by_userId', (q) => q.eq('userId', asset.uploaderId))
			.unique();
		const refs = permissions.canManageContent
			? await ctx.db
					.query('fileReferences')
					.withIndex('by_assetId', (q) => q.eq('assetId', asset._id))
					.take(100)
			: [];
		const origin = await publicOrigin(ctx, args.projectId);
		return {
			id: String(asset._id),
			name: asset.name,
			category: asset.category,
			extension: asset.extension,
			createdTime: asset._creationTime,
			updatedTime: asset.updatedAt,
			sizeBytes: object.actualBytes ?? 0,
			mimeType: object.mimeType,
			previewText: asset.extractedText ?? null,
			deliveryUrl: origin
				? (getPublicFileDeliveryUrl({ origin, publicId: asset.publicId, fileName: asset.name }) ??
					'')
				: '',
			canManage: permissions.canManageContent && !isArchived,
			listing: asset.listing,
			folder: folder ? { id: String(folder._id), name: folder.name } : null,
			uploadedBy: profile
				? { id: String(profile._id), name: profile.name, username: profile.username }
				: null,
			sourceAndUsage: permissions.canManageContent
				? {
						access: asset.access,
						creationMethod: asset.origin === 'files' ? 'direct' : 'feature',
						originFeature: asset.origin,
						publicId: asset.publicId,
						readyTime: null,
						referenceCount: refs.length,
						references: refs.map(() => ({
							entityType: 'update',
							feature: 'updates',
							field: 'cover',
						})),
						referencesTruncated: refs.length === 100,
						sourceProvider: 'kino',
						storageProvider: 'r2',
						uploaderClass: asset.uploaderClass,
					}
				: null,
		};
	},
});
export const changeAsset = mutation({
	args: {
		assetId: v.id('fileAssets'),
		name: v.optional(v.string()),
		folderId: v.optional(v.union(v.id('fileFolders'), v.null())),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const a = await readFile(ctx, args.assetId);
		return ctx.runMutation(api.files.edit, {
			assetId: a._id,
			name: args.name ?? a.name,
			folderId: args.folderId === undefined ? a.folderId : (args.folderId ?? undefined),
		});
	},
});
export const changeFolder = mutation({
	args: {
		folderId: v.id('fileFolders'),
		name: v.optional(v.string()),
		parentFolderId: v.optional(v.union(v.id('fileFolders'), v.null())),
	},
	returns: v.id('fileFolders'),
	handler: async (ctx, args) => {
		const f = await ctx.db.get('fileFolders', args.folderId);
		if (!f) throw new ConvexError('FOLDER_NOT_FOUND');
		return ctx.runMutation(api.files.saveFolder, {
			projectId: f.projectId,
			folderId: f._id,
			name: args.name ?? f.name,
			parentId: args.parentFolderId === undefined ? f.parentId : (args.parentFolderId ?? undefined),
		});
	},
});
