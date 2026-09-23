import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

import { RateLimiter } from '@convex-dev/rate-limiter';
import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';

import { buildUpdateSearchContent } from '../shared/update-content';
import { components, internal } from './_generated/api';
import { internalMutation, mutation, query } from './_generated/server';
import { assertProjectWritable, requireProjectAccess, resolveProjectAccess } from './access';
import { isFeedbackLive } from './feedbackLifecycle';
import { detachUpdateFiles } from './files.lib';
import { getCurrentUser, requireCurrentUser } from './identity';
import schema, { updateCategory, updateStatus } from './schema';

const limits = new RateLimiter(components.authLimits, {
	updateWrite: { kind: 'token bucket', rate: 60, period: 60_000, capacity: 60 },
});
export const profileValidator = v.union(
	v.null(),
	v.object({
		id: v.id('profiles'),
		name: v.string(),
		username: v.string(),
		imageUrl: v.union(v.string(), v.null()),
	})
);
const entryValidator = v.object({
	update: schema.doc('updates'),
	author: profileValidator,
	liked: v.boolean(),
});
const commentValidator = v.object({
	comment: schema.doc('updateComments'),
	author: profileValidator,
	canEdit: v.boolean(),
	canDelete: v.boolean(),
	ownEmotes: v.array(v.string()),
});
const editFields = {
	title: v.string(),
	content: v.string(),
	tags: v.array(v.string()),
	category: updateCategory,
	featured: v.boolean(),
	relatedFeedbackIds: v.array(v.id('feedback')),
};
const reaction = v.union(
	v.literal('heart'),
	v.literal('thumbsUp'),
	v.literal('thumbsDown'),
	v.literal('laugh'),
	v.literal('questionMark'),
	v.literal('sad'),
	v.literal('tada'),
	v.literal('eyes'),
	v.literal('skull'),
	v.literal('explodingHead')
);

export function summary(profile: Doc<'profiles'> | null) {
	return profile
		? {
				id: profile._id,
				name: profile.name,
				username: profile.username,
				imageUrl: profile.imageUrl ?? null,
			}
		: null;
}
async function actor(ctx: MutationCtx) {
	const user = await requireCurrentUser(ctx);
	if (!user.profileId) throw new ConvexError('PROFILE_NOT_FOUND');
	const result = await limits.limit(ctx, 'updateWrite', { key: user._id });
	if (!result.ok) throw new ConvexError('RATE_LIMITED');
	return user.profileId;
}
export async function readAccess(ctx: QueryCtx, item: Doc<'updates'> | null) {
	if (!item || item.deletingAt !== undefined) return null;
	const access = await resolveProjectAccess(ctx, item.projectId);
	return access.project && (item.status === 'published' || access.permissions.canManageContent)
		? access
		: null;
}
async function writeAccess(ctx: MutationCtx, id: Id<'updates'>, manage = false) {
	const profileId = await actor(ctx);
	const item = await ctx.db.get('updates', id);
	const access = await readAccess(ctx, item);
	if (!item || !access) throw new ConvexError('UPDATE_NOT_FOUND');
	assertProjectWritable(access);
	if (manage && !access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
	return { item, access, profileId };
}
async function validateFields(
	ctx: QueryCtx,
	projectId: Id<'projects'>,
	fields: {
		title: string;
		content: string;
		tags: Array<string>;
		relatedFeedbackIds: Array<Id<'feedback'>>;
	}
) {
	if (
		!fields.title.trim() ||
		fields.title.trim().length > 200 ||
		!fields.content.trim() ||
		fields.content.length > 50_000 ||
		fields.tags.length > 20 ||
		fields.tags.some((tag) => !tag.trim() || tag.length > 40) ||
		fields.relatedFeedbackIds.length > 100
	)
		throw new ConvexError('INVALID_UPDATE');
	for (const id of fields.relatedFeedbackIds) {
		const feedback = await ctx.db.get('feedback', id);
		if (!feedback || feedback.projectId !== projectId || !(await isFeedbackLive(ctx, feedback)))
			throw new ConvexError('INVALID_RELATED_FEEDBACK');
	}
	const title = fields.title.trim();
	const tags = [...new Set(fields.tags.map((tag) => tag.trim()))];
	const searchContent = buildUpdateSearchContent({ title, tags, content: fields.content });
	return {
		title,
		content: fields.content,
		tags,
		searchContent,
		relatedFeedbackIds: [...new Set(fields.relatedFeedbackIds)],
	};
}
async function entry(ctx: QueryCtx, item: Doc<'updates'>, profileId: Id<'profiles'> | undefined) {
	const [author, liked] = await Promise.all([
		ctx.db.get('profiles', item.authorProfileId),
		profileId
			? ctx.db
					.query('updateEmotes')
					.withIndex('by_updateId_and_authorProfileId_and_content', (q) =>
						q.eq('updateId', item._id).eq('authorProfileId', profileId).eq('content', 'heart')
					)
					.unique()
			: null,
	]);
	return { update: item, author: summary(author), liked: !!liked };
}

export const save = mutation({
	args: {
		projectId: v.id('projects'),
		id: v.optional(v.id('updates')),
		publish: v.optional(v.boolean()),
		...editFields,
	},
	returns: v.object({ id: v.id('updates'), slug: v.string() }),
	handler: async (ctx, args) => {
		const profileId = await actor(ctx);
		const access = await requireProjectAccess(ctx, args.projectId);
		assertProjectWritable(access);
		if (!access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
		const existing = args.id ? await ctx.db.get('updates', args.id) : null;
		if (
			args.id &&
			(!existing || existing.projectId !== args.projectId || existing.deletingAt !== undefined)
		)
			throw new ConvexError('UPDATE_NOT_FOUND');
		const fields = await validateFields(ctx, args.projectId, args);
		const now = Date.now();
		const patch = {
			...fields,
			category: args.category,
			featuredAt: args.featured ? (existing?.featuredAt ?? now) : undefined,
			updatedAt: now,
			...(args.publish
				? {
						status: 'published' as const,
						publishedAt: existing?.status === 'published' ? existing.publishedAt : now,
					}
				: {}),
		};
		if (existing) {
			await ctx.db.patch('updates', existing._id, patch);
			return { id: existing._id, slug: existing.slug };
		}
		const slug = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
		if (
			await ctx.db
				.query('updates')
				.withIndex('by_projectId_and_slug', (q) =>
					q.eq('projectId', args.projectId).eq('slug', slug)
				)
				.unique()
		)
			throw new ConvexError('CONFLICT');
		const id = await ctx.db.insert('updates', {
			projectId: args.projectId,
			authorProfileId: profileId,
			status: 'draft',
			commentCount: 0,
			heartCount: 0,
			slug,
			...patch,
		});
		return { id, slug };
	},
});

export const list = query({
	args: {
		projectId: v.id('projects'),
		paginationOpts: paginationOptsValidator,
		category: v.optional(updateCategory),
		search: v.optional(v.string()),
		management: v.optional(v.boolean()),
	},
	returns: paginationResultValidator(entryValidator),
	handler: async (ctx, args) => {
		const access = await resolveProjectAccess(ctx, args.projectId);
		if (!access.project || (args.management && !access.permissions.canManageContent))
			return { page: [], isDone: true, continueCursor: '' };
		if ((args.search?.length ?? 0) > 100) throw new ConvexError('INVALID_SEARCH');
		const manager = access.permissions.canManageContent;
		const search = args.search?.trim();
		const source = search
			? ctx.db.query('updates').withSearchIndex('search_by_searchContent', (q) => {
					let builder = q.search('searchContent', search).eq('projectId', args.projectId);
					if (!manager) builder = builder.eq('status', 'published');
					if (args.category) builder = builder.eq('category', args.category);
					return builder;
				})
			: args.management && !args.category
				? ctx.db
						.query('updates')
						.withIndex('by_projectId_and_updatedAt', (q) => q.eq('projectId', args.projectId))
						.order('desc')
				: args.category
					? ctx.db
							.query('updates')
							.withIndex('by_projectId_and_category_and_status_and_publishedAt', (q) =>
								manager
									? q.eq('projectId', args.projectId).eq('category', args.category!)
									: q
											.eq('projectId', args.projectId)
											.eq('category', args.category!)
											.eq('status', 'published')
							)
							.order('desc')
					: ctx.db
							.query('updates')
							.withIndex('by_projectId_and_status_and_publishedAt', (q) =>
								manager
									? q.eq('projectId', args.projectId)
									: q.eq('projectId', args.projectId).eq('status', 'published')
							)
							.order('desc');
		const page = await source.paginate(args.paginationOpts);
		const user = await getCurrentUser(ctx);
		return {
			...page,
			page: await Promise.all(
				page.page
					.filter((item) => item.deletingAt === undefined)
					.map((item) => entry(ctx, item, user?.profileId))
			),
		};
	},
});

export const featured = query({
	args: { projectId: v.id('projects') },
	returns: v.array(entryValidator),
	handler: async (ctx, args) => {
		const access = await resolveProjectAccess(ctx, args.projectId);
		if (!access.project) return [];
		let items: Array<Doc<'updates'>> = [];
		if (access.project.updatesFeaturedMode === 'manual') {
			items = (
				await ctx.db
					.query('updates')
					.withIndex('by_projectId_and_status_and_featuredAt', (q) =>
						q.eq('projectId', args.projectId).eq('status', 'published').gt('featuredAt', 0)
					)
					.order('desc')
					.take(50)
			)
				.filter((item) => item.deletingAt === undefined)
				.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
				.slice(0, 3);
		}
		if (!items.length)
			items = (
				await ctx.db
					.query('updates')
					.withIndex('by_projectId_and_status_and_publishedAt', (q) =>
						q.eq('projectId', args.projectId).eq('status', 'published')
					)
					.order('desc')
					.take(20)
			)
				.filter((item) => item.deletingAt === undefined)
				.slice(0, 3);
		const user = await getCurrentUser(ctx);
		return Promise.all(items.map((item) => entry(ctx, item, user?.profileId)));
	},
});

export const detail = query({
	args: { projectId: v.id('projects'), slug: v.string() },
	returns: v.union(
		v.null(),
		v.object({
			...entryValidator.fields,
			canEdit: v.boolean(),
			writable: v.boolean(),
			viewerProfileId: v.union(v.id('profiles'), v.null()),
			relatedFeedback: v.array(
				v.object({ id: v.id('feedback'), slug: v.string(), title: v.string() })
			),
		})
	),
	handler: async (ctx, args) => {
		const item = await ctx.db
			.query('updates')
			.withIndex('by_projectId_and_slug', (q) =>
				q.eq('projectId', args.projectId).eq('slug', args.slug)
			)
			.unique();
		const access = await readAccess(ctx, item);
		if (!item || !access) return null;
		const user = await getCurrentUser(ctx);
		const related = await Promise.all(
			item.relatedFeedbackIds.map(async (id) => {
				const feedback = await ctx.db.get('feedback', id);
				return (await isFeedbackLive(ctx, feedback)) ? feedback : null;
			})
		);
		const liveRelated = related.filter(
			(f): f is Doc<'feedback'> => f !== null && f.projectId === item.projectId
		);
		return {
			...(await entry(ctx, item, user?.profileId)),
			update: { ...item, relatedFeedbackIds: liveRelated.map((f) => f._id) },
			canEdit: access.permissions.canManageContent && !access.isArchived,
			writable: !access.isArchived,
			viewerProfileId: user?.profileId ?? null,
			relatedFeedback: liveRelated.map((f) => ({ id: f._id, title: f.title, slug: f.slug })),
		};
	},
});

export const comments = query({
	args: { updateId: v.id('updates'), paginationOpts: paginationOptsValidator },
	returns: paginationResultValidator(commentValidator),
	handler: async (ctx, args) => {
		const access = await readAccess(ctx, await ctx.db.get('updates', args.updateId));
		if (!access) return { page: [], isDone: true, continueCursor: '' };
		const user = await getCurrentUser(ctx);
		const page = await ctx.db
			.query('updateComments')
			.withIndex('by_updateId', (q) => q.eq('updateId', args.updateId))
			.order('desc')
			.paginate(args.paginationOpts);
		return {
			...page,
			page: await Promise.all(
				page.page.map(async (comment) => {
					const own = user?.profileId
						? await ctx.db
								.query('updateCommentEmotes')
								.withIndex('by_commentId_and_authorProfileId_and_content', (q) =>
									q.eq('commentId', comment._id).eq('authorProfileId', user.profileId!)
								)
								.take(10)
						: [];
					return {
						comment,
						author: summary(await ctx.db.get('profiles', comment.authorProfileId)),
						canEdit: !access.isArchived && user?.profileId === comment.authorProfileId,
						canDelete:
							!access.isArchived &&
							!!user &&
							(user.profileId === comment.authorProfileId || access.permissions.canManageContent),
						ownEmotes: own.map((e) => e.content),
					};
				})
			),
		};
	},
});

export const saveComment = mutation({
	args: {
		updateId: v.id('updates'),
		id: v.optional(v.id('updateComments')),
		replyCommentId: v.optional(v.id('updateComments')),
		content: v.string(),
	},
	returns: v.id('updateComments'),
	handler: async (ctx, args) => {
		const { item, profileId } = await writeAccess(ctx, args.updateId);
		if (!args.content.trim() || args.content.length > 1200)
			throw new ConvexError('INVALID_COMMENT');
		if (args.id) {
			const comment = await ctx.db.get('updateComments', args.id);
			if (!comment || comment.updateId !== item._id) throw new ConvexError('COMMENT_NOT_FOUND');
			if (comment.authorProfileId !== profileId) throw new ConvexError('FORBIDDEN');
			await ctx.db.patch('updateComments', comment._id, {
				content: args.content.trim(),
				updatedAt: Date.now(),
			});
			return comment._id;
		}
		if (
			args.replyCommentId &&
			(await ctx.db.get('updateComments', args.replyCommentId))?.updateId !== item._id
		)
			throw new ConvexError('INVALID_REPLY');
		const id = await ctx.db.insert('updateComments', {
			updateId: item._id,
			authorProfileId: profileId,
			content: args.content.trim(),
			replyCommentId: args.replyCommentId,
			emoteCounts: {},
		});
		await ctx.db.patch('updates', item._id, { commentCount: item.commentCount + 1 });
		return id;
	},
});

export const removeComment = mutation({
	args: { id: v.id('updateComments') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const comment = await ctx.db.get('updateComments', args.id);
		if (!comment) throw new ConvexError('COMMENT_NOT_FOUND');
		const { item, access, profileId } = await writeAccess(ctx, comment.updateId);
		if (comment.authorProfileId !== profileId && !access.permissions.canManageContent)
			throw new ConvexError('FORBIDDEN');
		await ctx.db.delete('updateComments', comment._id);
		await ctx.db.patch('updates', item._id, { commentCount: Math.max(0, item.commentCount - 1) });
		await ctx.scheduler.runAfter(0, internal.updates.cleanComment, { id: comment._id });
		return null;
	},
});
export const cleanComment = internalMutation({
	args: { id: v.id('updateComments') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const emotes = await ctx.db
			.query('updateCommentEmotes')
			.withIndex('by_commentId_and_authorProfileId_and_content', (q) => q.eq('commentId', args.id))
			.take(100);
		for (const emote of emotes) await ctx.db.delete('updateCommentEmotes', emote._id);
		const replies = await ctx.db
			.query('updateComments')
			.withIndex('by_replyCommentId', (q) => q.eq('replyCommentId', args.id))
			.take(100);
		for (const reply of replies)
			await ctx.db.patch('updateComments', reply._id, { replyCommentId: undefined });
		if (emotes.length === 100 || replies.length === 100)
			await ctx.scheduler.runAfter(0, internal.updates.cleanComment, args);
		return null;
	},
});

export const toggleReaction = mutation({
	args: {
		updateId: v.id('updates'),
		commentId: v.optional(v.id('updateComments')),
		content: reaction,
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const { item, profileId } = await writeAccess(ctx, args.updateId);
		if (args.commentId) {
			const comment = await ctx.db.get('updateComments', args.commentId);
			if (!comment || comment.updateId !== item._id) throw new ConvexError('COMMENT_NOT_FOUND');
			const existing = await ctx.db
				.query('updateCommentEmotes')
				.withIndex('by_commentId_and_authorProfileId_and_content', (q) =>
					q
						.eq('commentId', comment._id)
						.eq('authorProfileId', profileId)
						.eq('content', args.content)
				)
				.unique();
			if (existing) await ctx.db.delete('updateCommentEmotes', existing._id);
			else
				await ctx.db.insert('updateCommentEmotes', {
					updateId: item._id,
					commentId: comment._id,
					authorProfileId: profileId,
					content: args.content,
				});
			await ctx.db.patch('updateComments', comment._id, {
				emoteCounts: {
					...comment.emoteCounts,
					[args.content]: Math.max(
						0,
						(comment.emoteCounts[args.content] ?? 0) + (existing ? -1 : 1)
					),
				},
			});
			return !existing;
		}
		const existing = await ctx.db
			.query('updateEmotes')
			.withIndex('by_updateId_and_authorProfileId_and_content', (q) =>
				q.eq('updateId', item._id).eq('authorProfileId', profileId).eq('content', args.content)
			)
			.unique();
		if (existing) await ctx.db.delete('updateEmotes', existing._id);
		else
			await ctx.db.insert('updateEmotes', {
				updateId: item._id,
				authorProfileId: profileId,
				content: args.content,
			});
		if (args.content === 'heart')
			await ctx.db.patch('updates', item._id, {
				heartCount: Math.max(0, item.heartCount + (existing ? -1 : 1)),
			});
		return !existing;
	},
});

export const setFeaturedMode = mutation({
	args: { projectId: v.id('projects'), mode: v.union(v.literal('latest'), v.literal('manual')) },
	returns: v.null(),
	handler: async (ctx, args) => {
		await actor(ctx);
		const access = await requireProjectAccess(ctx, args.projectId);
		assertProjectWritable(access);
		if (!access.permissions.canEditSettings) throw new ConvexError('FORBIDDEN');
		await ctx.db.patch('projects', args.projectId, { updatesFeaturedMode: args.mode });
		return null;
	},
});

export const changeStatus = mutation({
	args: { projectId: v.id('projects'), ids: v.array(v.id('updates')), status: updateStatus },
	returns: v.null(),
	handler: async (ctx, args) => {
		await actor(ctx);
		const access = await requireProjectAccess(ctx, args.projectId);
		assertProjectWritable(access);
		if (!access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
		if (!args.ids.length || args.ids.length > 100) throw new ConvexError('INVALID_UPDATES');
		for (const id of new Set(args.ids)) {
			const item = await ctx.db.get('updates', id);
			if (!item || item.projectId !== args.projectId || item.deletingAt !== undefined)
				throw new ConvexError('UPDATE_NOT_FOUND');
			await ctx.db.patch('updates', id, {
				status: args.status,
				updatedAt: Date.now(),
				...(args.status === 'published' ? { publishedAt: Date.now() } : {}),
			});
		}
		return null;
	},
});

export const remove = mutation({
	args: { projectId: v.id('projects'), ids: v.array(v.id('updates')) },
	returns: v.null(),
	handler: async (ctx, args) => {
		await actor(ctx);
		const access = await requireProjectAccess(ctx, args.projectId);
		assertProjectWritable(access);
		if (!access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
		if (!args.ids.length || args.ids.length > 100) throw new ConvexError('INVALID_UPDATES');
		for (const id of new Set(args.ids)) {
			const item = await ctx.db.get('updates', id);
			if (!item || item.projectId !== args.projectId) throw new ConvexError('UPDATE_NOT_FOUND');
			if (item.deletingAt !== undefined) continue;
			await ctx.db.patch('updates', id, { deletingAt: Date.now() });
			await ctx.db.insert('updateDeletionJobs', { updateId: id });
			await ctx.scheduler.runAfter(0, internal.updates.deleteBatch, { id });
		}
		return null;
	},
});
export const deleteBatch = internalMutation({
	args: { id: v.id('updates') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const item = await ctx.db.get('updates', args.id);
		if (!item) {
			const job = await ctx.db
				.query('updateDeletionJobs')
				.withIndex('by_updateId', (q) => q.eq('updateId', args.id))
				.unique();
			if (job) await ctx.db.delete('updateDeletionJobs', job._id);
			return null;
		}
		if (item.deletingAt === undefined) return null;
		const commentBatch = await ctx.db
			.query('updateComments')
			.withIndex('by_updateId', (q) => q.eq('updateId', args.id))
			.take(100);
		const emotes = await ctx.db
			.query('updateEmotes')
			.withIndex('by_updateId_and_authorProfileId_and_content', (q) => q.eq('updateId', args.id))
			.take(100);
		const commentEmotes = await ctx.db
			.query('updateCommentEmotes')
			.withIndex('by_updateId', (q) => q.eq('updateId', args.id))
			.take(100);
		for (const comment of commentBatch) await ctx.db.delete('updateComments', comment._id);
		for (const emote of emotes) await ctx.db.delete('updateEmotes', emote._id);
		for (const emote of commentEmotes) await ctx.db.delete('updateCommentEmotes', emote._id);
		if (commentBatch.length === 100 || emotes.length === 100 || commentEmotes.length === 100)
			await ctx.scheduler.runAfter(0, internal.updates.deleteBatch, args);
		else {
			await detachUpdateFiles(ctx, args.id);
			await ctx.db.delete('updates', args.id);
			const job = await ctx.db
				.query('updateDeletionJobs')
				.withIndex('by_updateId', (q) => q.eq('updateId', args.id))
				.unique();
			if (job) await ctx.db.delete('updateDeletionJobs', job._id);
		}
		return null;
	},
});
