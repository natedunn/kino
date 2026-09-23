import type { Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import { internalMutation } from './_generated/server';

// Root Convex storage in this native deployment is owned by avatar and logo
// uploads. If another feature begins writing root storage, add its references
// here before enabling that writer. Component storage is isolated from root.
const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 20;

type Intent =
	| { kind: 'profile'; id: Id<'profileAvatarUploadIntents'> }
	| { kind: 'organization'; id: Id<'organizationLogoUploadIntents'> };

async function references(ctx: QueryCtx, storageId: Id<'_storage'>) {
	const [profile, organization, profileIntent, organizationIntent] = await Promise.all([
		ctx.db
			.query('profiles')
			.withIndex('by_avatarStorageId', (q) => q.eq('avatarStorageId', storageId))
			.unique(),
		ctx.db
			.query('organizations')
			.withIndex('by_logoStorageId', (q) => q.eq('logoStorageId', storageId))
			.unique(),
		ctx.db
			.query('profileAvatarUploadIntents')
			.withIndex('by_storageId', (q) => q.eq('storageId', storageId))
			.unique(),
		ctx.db
			.query('organizationLogoUploadIntents')
			.withIndex('by_storageId', (q) => q.eq('storageId', storageId))
			.unique(),
	]);
	return { profile, organization, profileIntent, organizationIntent };
}

export async function assertImageUploadUnclaimed(
	ctx: QueryCtx,
	storageId: Id<'_storage'>,
	intent: Intent
) {
	const linked = await references(ctx, storageId);
	if (
		linked.profile ||
		linked.organization ||
		(linked.profileIntent &&
			(intent.kind !== 'profile' || linked.profileIntent._id !== intent.id)) ||
		(linked.organizationIntent &&
			(intent.kind !== 'organization' || linked.organizationIntent._id !== intent.id))
	)
		throw new ConvexError('IMAGE_UPLOAD_ALREADY_CLAIMED');
}

export async function deleteUnclaimedImageUpload(ctx: MutationCtx, storageId: Id<'_storage'>) {
	const linked = await references(ctx, storageId);
	if (linked.profile || linked.organization || linked.profileIntent || linked.organizationIntent)
		return;
	if (await ctx.db.system.get('_storage', storageId)) await ctx.storage.delete(storageId);
}

// The storage POST may succeed even when the browser dies before it can send
// the storage ID to register*Upload. A delayed scan is the only way to recover
// that ID with Convex's direct-upload URL transport. Each continuation is a
// separate bounded transaction; the grace period exceeds the URL/intent TTL.
export const reconcileOrphanedImages = internalMutation({
	args: {
		cursor: v.optional(v.union(v.string(), v.null())),
		cutoff: v.optional(v.number()),
		since: v.optional(v.number()),
	},
	returns: v.object({ checked: v.number(), deleted: v.number(), done: v.boolean() }),
	handler: async (ctx, args) => {
		const state = await ctx.db
			.query('imageUploadReconciliation')
			.withIndex('by_key', (q) => q.eq('key', 'root-storage'))
			.unique();
		const since = args.since ?? state?.checkedThrough ?? 0;
		const cutoff = args.cutoff ?? Date.now() - ORPHAN_GRACE_MS;
		if (since >= cutoff) return { checked: 0, deleted: 0, done: true };
		const page = await ctx.db.system
			.query('_storage')
			.withIndex('by_creation_time', (q) =>
				q.gte('_creationTime', since).lt('_creationTime', cutoff)
			)
			.paginate({ cursor: args.cursor ?? null, numItems: PAGE_SIZE });
		let checked = 0;
		let deleted = 0;
		for (const file of page.page) {
			checked++;
			const linked = await references(ctx, file._id);
			if (
				linked.profile ||
				linked.organization ||
				linked.profileIntent ||
				linked.organizationIntent
			)
				continue;
			await ctx.storage.delete(file._id);
			deleted++;
		}
		const done = page.isDone;
		if (!done)
			await ctx.scheduler.runAfter(0, internal.imageUpload.reconcileOrphanedImages, {
				cursor: page.continueCursor,
				cutoff,
				since,
			});
		else if (state) {
			if (state.checkedThrough < cutoff)
				await ctx.db.patch('imageUploadReconciliation', state._id, { checkedThrough: cutoff });
		} else
			await ctx.db.insert('imageUploadReconciliation', {
				key: 'root-storage',
				checkedThrough: cutoff,
			});
		return { checked, deleted, done };
	},
});
