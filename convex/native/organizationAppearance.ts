import { ConvexError, v } from 'convex/values';

import { internalMutation, mutation } from './_generated/server';
import { requireOrganizationManager } from './access';
import { assertImageUploadUnclaimed, deleteUnclaimedImageUpload } from './imageUpload';

const ALLOWED_LOGO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const MAX_PENDING_LOGO_UPLOADS = 10;
const UPLOAD_INTENT_TTL_MS = 10 * 60 * 1000;

export const generateLogoUploadUrl = mutation({
	args: { organizationId: v.id('organizations') },
	returns: v.object({ uploadToken: v.string(), uploadUrl: v.string() }),
	handler: async (ctx, { organizationId }) => {
		const { user } = await requireOrganizationManager(ctx, organizationId);
		const now = Date.now();
		const existing = await ctx.db
			.query('organizationLogoUploadIntents')
			.withIndex('by_organizationId', (q) => q.eq('organizationId', organizationId))
			.take(MAX_PENDING_LOGO_UPLOADS + 1);
		for (const intent of existing) {
			if (intent.expiresAt <= now) {
				await ctx.db.delete('organizationLogoUploadIntents', intent._id);
				if (intent.storageId) await deleteUnclaimedImageUpload(ctx, intent.storageId);
			}
		}
		if (existing.filter((intent) => intent.expiresAt > now).length >= MAX_PENDING_LOGO_UPLOADS)
			throw new ConvexError('LOGO_UPLOAD_LIMIT_REACHED');
		const uploadToken = crypto.randomUUID();
		await ctx.db.insert('organizationLogoUploadIntents', {
			createdAt: now,
			expiresAt: now + UPLOAD_INTENT_TTL_MS,
			organizationId,
			requestedByUserId: user._id,
			token: uploadToken,
		});
		return { uploadToken, uploadUrl: await ctx.storage.generateUploadUrl() };
	},
});

export const registerLogoUpload = mutation({
	args: {
		organizationId: v.id('organizations'),
		storageId: v.id('_storage'),
		uploadToken: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const { user } = await requireOrganizationManager(ctx, args.organizationId);
		const intent = await ctx.db
			.query('organizationLogoUploadIntents')
			.withIndex('by_token', (q) => q.eq('token', args.uploadToken))
			.unique();
		if (
			!intent ||
			intent.organizationId !== args.organizationId ||
			intent.requestedByUserId !== user._id ||
			intent.expiresAt <= Date.now() ||
			(intent.storageId && intent.storageId !== args.storageId)
		)
			throw new ConvexError('INVALID_LOGO_UPLOAD_INTENT');
		const metadata = await ctx.db.system.get('_storage', args.storageId);
		if (!metadata || metadata._creationTime < intent.createdAt)
			throw new ConvexError('LOGO_UPLOAD_NOT_FOUND');
		await assertImageUploadUnclaimed(ctx, args.storageId, {
			kind: 'organization',
			id: intent._id,
		});
		await ctx.db.patch('organizationLogoUploadIntents', intent._id, { storageId: args.storageId });
		return null;
	},
});

export const discardLogoUpload = mutation({
	args: { organizationId: v.id('organizations'), uploadToken: v.string() },
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const { user } = await requireOrganizationManager(ctx, args.organizationId);
		const intent = await ctx.db
			.query('organizationLogoUploadIntents')
			.withIndex('by_token', (q) => q.eq('token', args.uploadToken))
			.unique();
		if (!intent) return false;
		if (intent.organizationId !== args.organizationId || intent.requestedByUserId !== user._id)
			throw new ConvexError('FORBIDDEN');
		await ctx.db.delete('organizationLogoUploadIntents', intent._id);
		if (intent.storageId) await deleteUnclaimedImageUpload(ctx, intent.storageId);
		return true;
	},
});

export const commitLogo = mutation({
	args: {
		organizationId: v.id('organizations'),
		storageId: v.id('_storage'),
		uploadToken: v.string(),
	},
	returns: v.object({ logo: v.union(v.null(), v.string()) }),
	handler: async (ctx, args) => {
		const { organization, user } = await requireOrganizationManager(ctx, args.organizationId);
		const intent = await ctx.db
			.query('organizationLogoUploadIntents')
			.withIndex('by_token', (q) => q.eq('token', args.uploadToken))
			.unique();
		if (
			!intent ||
			intent.organizationId !== args.organizationId ||
			intent.requestedByUserId !== user._id ||
			intent.expiresAt <= Date.now()
		)
			throw new ConvexError('INVALID_LOGO_UPLOAD_INTENT');
		if (intent.storageId && intent.storageId !== args.storageId)
			throw new ConvexError('INVALID_LOGO_UPLOAD_INTENT');
		await assertImageUploadUnclaimed(ctx, args.storageId, {
			kind: 'organization',
			id: intent._id,
		});
		const [metadata, attached] = await Promise.all([
			ctx.db.system.get('_storage', args.storageId),
			ctx.db
				.query('organizations')
				.withIndex('by_logoStorageId', (q) => q.eq('logoStorageId', args.storageId))
				.unique(),
		]);
		if (!metadata) throw new ConvexError('LOGO_UPLOAD_NOT_FOUND');
		if (metadata._creationTime < intent.createdAt)
			throw new ConvexError('LOGO_UPLOAD_PREDATES_INTENT');
		if (!metadata.contentType || !ALLOWED_LOGO_TYPES.has(metadata.contentType))
			throw new ConvexError('INVALID_LOGO_TYPE');
		if (metadata.size > MAX_LOGO_BYTES) throw new ConvexError('LOGO_TOO_LARGE');
		if (attached && attached._id !== args.organizationId)
			throw new ConvexError('LOGO_ALREADY_ATTACHED');
		await ctx.db.delete('organizationLogoUploadIntents', intent._id);
		const previousStorageId = organization.logoStorageId;
		await ctx.db.patch('organizations', args.organizationId, { logoStorageId: args.storageId });
		const logo = await ctx.storage.getUrl(args.storageId);
		if (previousStorageId && previousStorageId !== args.storageId)
			await ctx.storage.delete(previousStorageId);
		return { logo };
	},
});

export const clearExpiredLogoUploadIntents = internalMutation({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		const expired = await ctx.db
			.query('organizationLogoUploadIntents')
			.withIndex('by_expiresAt', (q) => q.lt('expiresAt', Date.now()))
			.take(100);
		for (const intent of expired) {
			await ctx.db.delete('organizationLogoUploadIntents', intent._id);
			if (intent.storageId) await deleteUnclaimedImageUpload(ctx, intent.storageId);
		}
		return expired.length;
	},
});
