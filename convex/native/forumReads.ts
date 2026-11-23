import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

import { ConvexError, v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { resolveProjectAccess } from './access';
import { getCurrentUser, requireCurrentUser } from './identity';

// Per-viewer unread state for forum topics. `forum.list` and `forum.pinned`
// attach it to each item; the topic page reads `topicState` and calls `markRead`.
//
// "new" has no age limit here: queries can't read the clock, so the client
// hides "new" on topics idle for longer than its window.
export const unreadValidator = v.union(
	v.null(),
	v.object({
		state: v.union(v.literal('new'), v.literal('replies'), v.literal('read')),
		newReplies: v.number(),
	})
);

type Unread = { state: 'new' | 'replies' | 'read'; newReplies: number };
type ReadTopic = Pick<Doc<'forumTopics'>, '_id' | 'projectId' | 'commentCount' | 'lastActivityAt'>;

export type ForumReader = { profileId: Id<'profiles'>; readAllAt: number };

const READ: Unread = { state: 'read', newReplies: 0 };

async function readAllMarker(ctx: QueryCtx, profileId: Id<'profiles'>, projectId: Id<'projects'>) {
	return ctx.db
		.query('forumReadMarkers')
		.withIndex('by_profileId_and_projectId', (q) =>
			q.eq('profileId', profileId).eq('projectId', projectId)
		)
		.unique();
}

async function readRow(ctx: QueryCtx, topicId: Id<'forumTopics'>, profileId: Id<'profiles'>) {
	return ctx.db
		.query('forumReads')
		.withIndex('by_profileId_and_topicId', (q) =>
			q.eq('profileId', profileId).eq('topicId', topicId)
		)
		.unique();
}

// The signed-in viewer and their "mark all as read" time; null when signed out.
export async function forumReader(
	ctx: QueryCtx,
	projectId: Id<'projects'>
): Promise<ForumReader | null> {
	const profileId = (await getCurrentUser(ctx))?.profileId;
	if (!profileId) return null;
	const marker = await readAllMarker(ctx, profileId, projectId);
	return { profileId, readAllAt: marker?.readAllAt ?? 0 };
}

// Replies are counted as well as timed so two writes in the same millisecond
// still register. A drop in count (deleted replies) never reads as unread.
function isUpToDate(row: Doc<'forumReads'>, topic: ReadTopic) {
	return row.lastReadAt >= topic.lastActivityAt && row.readCommentCount >= topic.commentCount;
}

function unreadFrom(reader: ForumReader, topic: ReadTopic, row: Doc<'forumReads'> | null): Unread {
	if (topic.lastActivityAt <= reader.readAllAt) return READ;
	if (!row) return { state: 'new', newReplies: 0 };
	if (isUpToDate(row, topic)) return READ;
	// Activity only moves forward with a new reply, so there is at least one.
	// Replies read before a later "mark all as read" still count here.
	return { state: 'replies', newReplies: Math.max(1, topic.commentCount - row.readCommentCount) };
}

export async function topicUnread(
	ctx: QueryCtx,
	reader: ForumReader | null,
	topic: ReadTopic
): Promise<Unread | null> {
	if (!reader) return null;
	// Skips the row lookup for topics settled by "mark all as read".
	if (topic.lastActivityAt <= reader.readAllAt) return READ;
	return unreadFrom(reader, topic, await readRow(ctx, topic._id, reader.profileId));
}

// Records that `profileId` has seen `topic` as it is now. Skips the write when
// the stored read is already current, so repeat visits cost no writes.
export async function recordRead(ctx: MutationCtx, topic: ReadTopic, profileId: Id<'profiles'>) {
	const row = await readRow(ctx, topic._id, profileId);
	if (row && isUpToDate(row, topic)) return;
	const read = { lastReadAt: Date.now(), readCommentCount: topic.commentCount };
	if (row) await ctx.db.patch('forumReads', row._id, read);
	else
		await ctx.db.insert('forumReads', {
			projectId: topic.projectId,
			topicId: topic._id,
			profileId,
			...read,
		});
}

async function readableTopic(ctx: QueryCtx, topicId: Id<'forumTopics'>) {
	const topic = await ctx.db.get('forumTopics', topicId);
	if (!topic || topic.deletingAt !== undefined) return null;
	const access = await resolveProjectAccess(ctx, topic.projectId);
	// Mirrors forum.forumEnabled; imported there, so not imported back here.
	return access.project && access.project.forumEnabled !== false ? topic : null;
}

// The viewer's read state for one topic, for the topic page. `lastReadAt` is
// the boundary for the "New" divider: the later of the topic's last read and
// "mark all as read", or null when the viewer has seen none of it.
export const topicState = query({
	args: { topicId: v.id('forumTopics') },
	returns: v.union(
		v.null(),
		v.object({
			lastReadAt: v.union(v.number(), v.null()),
			unread: v.boolean(),
			// False when `markRead` would record something.
			upToDate: v.boolean(),
		})
	),
	handler: async (ctx, args) => {
		const topic = await readableTopic(ctx, args.topicId);
		if (!topic) return null;
		const reader = await forumReader(ctx, topic.projectId);
		if (!reader) return null;
		const row = await readRow(ctx, topic._id, reader.profileId);
		const lastReadAt = Math.max(row?.lastReadAt ?? 0, reader.readAllAt);
		return {
			lastReadAt: lastReadAt || null,
			unread: unreadFrom(reader, topic, row).state !== 'read',
			upToDate: !!row && isUpToDate(row, topic),
		};
	},
});

export const markRead = mutation({
	args: { topicId: v.id('forumTopics') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await requireCurrentUser(ctx);
		if (!user.profileId) throw new ConvexError('PROFILE_NOT_FOUND');
		const topic = await readableTopic(ctx, args.topicId);
		if (!topic) throw new ConvexError('TOPIC_NOT_FOUND');
		await recordRead(ctx, topic, user.profileId);
		return null;
	},
});

export const markAllRead = mutation({
	args: { projectId: v.id('projects') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await requireCurrentUser(ctx);
		if (!user.profileId) throw new ConvexError('PROFILE_NOT_FOUND');
		const access = await resolveProjectAccess(ctx, args.projectId);
		if (!access.project || access.project.forumEnabled === false)
			throw new ConvexError('PROJECT_NOT_FOUND');
		const readAllAt = Date.now();
		const marker = await readAllMarker(ctx, user.profileId, args.projectId);
		if (marker) await ctx.db.patch('forumReadMarkers', marker._id, { readAllAt });
		else
			await ctx.db.insert('forumReadMarkers', {
				projectId: args.projectId,
				profileId: user.profileId,
				readAllAt,
			});
		return null;
	},
});
