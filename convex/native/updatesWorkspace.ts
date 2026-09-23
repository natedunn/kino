import type { Doc } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';

import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';

import { getUpdateListPreviewData } from '../shared/update-content';
import { api } from './_generated/api';
import { mutation, query } from './_generated/server';
import { resolveProjectAccess } from './access';
import { isFeedbackLive } from './feedbackLifecycle';
import { getCurrentUser } from './identity';
import { feedbackStatus, updateCategory, updateStatus } from './schema';
import { profileValidator, readAccess, summary } from './updates';

const counts = v.record(
	v.string(),
	v.object({ count: v.number(), authorProfileIds: v.array(v.string()) })
);
const itemValidator = v.object({
	id: v.id('updates'),
	projectId: v.id('projects'),
	authorProfileId: v.id('profiles'),
	title: v.string(),
	content: v.string(),
	slug: v.string(),
	category: updateCategory,
	status: updateStatus,
	tags: v.array(v.string()),
	relatedFeedbackIds: v.array(v.id('feedback')),
	createdAt: v.number(),
	updatedTime: v.optional(v.number()),
	publishedAt: v.union(v.number(), v.null()),
	featuredAt: v.union(v.number(), v.null()),
	coverImageId: v.union(v.string(), v.null()),
	coverAssetId: v.optional(v.id('fileAssets')),
});
const listItem = v.object({
	...itemValidator.fields,
	author: profileValidator,
	coverImageUrl: v.union(v.string(), v.null()),
	commentCount: v.number(),
	contentPreview: v.string(),
	contentPreviewIsTruncated: v.boolean(),
	emoteCounts: counts,
});
const feedbackItem = v.object({
	id: v.id('feedback'),
	title: v.string(),
	slug: v.string(),
	status: feedbackStatus,
	board: v.union(
		v.null(),
		v.object({
			id: v.id('feedbackBoards'),
			name: v.string(),
			slug: v.string(),
			icon: v.optional(v.string()),
		})
	),
});
const commentItem = v.object({
	id: v.id('updateComments'),
	content: v.string(),
	author: profileValidator,
	createdAt: v.number(),
	updatedTime: v.optional(v.number()),
	canEdit: v.boolean(),
	canDelete: v.boolean(),
	emoteCounts: counts,
	isTeamMember: v.boolean(),
});
function item(d: Doc<'updates'>) {
	return {
		id: d._id,
		projectId: d.projectId,
		authorProfileId: d.authorProfileId,
		title: d.title,
		content: d.content,
		slug: d.slug,
		category: d.category,
		status: d.status,
		tags: d.tags,
		relatedFeedbackIds: d.relatedFeedbackIds,
		createdAt: d._creationTime,
		updatedTime: d.updatedAt,
		publishedAt: d.publishedAt ?? null,
		featuredAt: d.featuredAt ?? null,
		coverImageId: d.coverAssetId ?? null,
		coverAssetId: d.coverAssetId,
	};
}
async function feedbackView(ctx: QueryCtx, d: Doc<'feedback'>) {
	const board = await ctx.db.get('feedbackBoards', d.boardId);
	return {
		id: d._id,
		title: d.title,
		slug: d.slug,
		status: d.status,
		board: board ? { id: board._id, name: board.name, slug: board.slug, icon: board.icon } : null,
	};
}
async function listView(
	ctx: QueryCtx,
	d: Doc<'updates'>,
	liked: boolean,
	author: ReturnType<typeof summary>
) {
	const user = await getCurrentUser(ctx);
	const preview = getUpdateListPreviewData(d.content);
	return {
		...item(d),
		author,
		coverImageUrl: null,
		commentCount: d.commentCount,
		contentPreview: preview.preview,
		contentPreviewIsTruncated: preview.isTruncated,
		emoteCounts: {
			heart: {
				count: d.heartCount,
				authorProfileIds: liked && user?.profileId ? [user.profileId] : [],
			},
		},
	};
}
export const list = query({
	args: {
		projectId: v.id('projects'),
		category: v.optional(updateCategory),
		search: v.optional(v.string()),
		management: v.optional(v.boolean()),
		paginationOpts: paginationOptsValidator,
	},
	returns: paginationResultValidator(listItem),
	handler: async (ctx, args) => {
		const result = await ctx.runQuery(api.updates.list, args);
		return {
			...result,
			page: await Promise.all(result.page.map((e) => listView(ctx, e.update, e.liked, e.author))),
		};
	},
});
export const featured = query({
	args: { projectId: v.id('projects') },
	returns: v.object({ items: v.array(listItem) }),
	handler: async (ctx, args) => {
		const result = await ctx.runQuery(api.updates.featured, args);
		return {
			items: await Promise.all(result.map((e) => listView(ctx, e.update, e.liked, e.author))),
		};
	},
});
async function commentView(
	ctx: QueryCtx,
	d: Doc<'updateComments'>,
	projectId: Doc<'projects'>['_id']
) {
	const user = await getCurrentUser(ctx),
		access = await resolveProjectAccess(ctx, projectId);
	const own = user?.profileId
		? await ctx.db
				.query('updateCommentEmotes')
				.withIndex('by_commentId_and_authorProfileId_and_content', (q) =>
					q.eq('commentId', d._id).eq('authorProfileId', user.profileId!)
				)
				.take(10)
		: [];
	const author = await ctx.db.get('profiles', d.authorProfileId);
	const authorAccess =
		author && access.project
			? await ctx.db
					.query('memberships')
					.withIndex('by_organizationId_and_userId', (q) =>
						q.eq('organizationId', access.project!.organizationId).eq('userId', author.userId)
					)
					.unique()
			: null;
	return {
		id: d._id,
		content: d.content,
		author: summary(author),
		createdAt: d._creationTime,
		updatedTime: d.updatedAt,
		canEdit: !access.isArchived && user?.profileId === d.authorProfileId,
		canDelete:
			!access.isArchived &&
			!!user &&
			(user.profileId === d.authorProfileId || access.permissions.canManageContent),
		isTeamMember: !!authorAccess,
		emoteCounts: Object.fromEntries(
			Object.entries(d.emoteCounts).map(([content, count]) => [
				content,
				{
					count,
					authorProfileIds:
						user?.profileId && own.some((e) => e.content === content) ? [user.profileId] : [],
				},
			])
		),
	};
}
const detailValidator = v.object({
	update: itemValidator,
	author: profileValidator,
	coverImageUrl: v.union(v.string(), v.null()),
	emoteCounts: counts,
	canEdit: v.boolean(),
	currentProfile: profileValidator,
	relatedFeedback: v.array(feedbackItem),
	commentCount: v.number(),
	commentWindow: v.object({
		head: v.array(commentItem),
		tail: v.array(commentItem),
		tailCommentIds: v.array(v.string()),
		middleCursor: v.union(v.string(), v.null()),
	}),
});
export const detail = query({
	args: { projectId: v.id('projects'), slug: v.string() },
	returns: v.union(v.null(), detailValidator),
	handler: async (ctx, args) => {
		const result = await ctx.runQuery(api.updates.detail, args);
		if (!result) return null;
		const d = result.update,
			user = await getCurrentUser(ctx);
		const head = await ctx.db
			.query('updateComments')
			.withIndex('by_updateId', (q) => q.eq('updateId', d._id))
			.order('asc')
			.paginate({ cursor: null, numItems: 5 });
		const tail = await ctx.db
			.query('updateComments')
			.withIndex('by_updateId', (q) => q.eq('updateId', d._id))
			.order('desc')
			.take(10);
		const probe = await ctx.db
			.query('updateComments')
			.withIndex('by_updateId', (q) => q.eq('updateId', d._id))
			.order('asc')
			.take(6);
		const tailIds = tail.map((c) => c._id);
		const related = await Promise.all(
			result.relatedFeedback.map(async (f) =>
				feedbackView(ctx, (await ctx.db.get('feedback', f.id))!)
			)
		);
		return {
			update: item(d),
			author: result.author,
			coverImageUrl: null,
			emoteCounts: {
				heart: {
					count: d.heartCount,
					authorProfileIds: result.liked && user?.profileId ? [user.profileId] : [],
				},
			},
			canEdit: result.canEdit,
			currentProfile:
				result.writable && user?.profileId
					? summary(await ctx.db.get('profiles', user.profileId))
					: null,
			relatedFeedback: related,
			commentCount: d.commentCount,
			commentWindow: {
				head: await Promise.all(head.page.map((c) => commentView(ctx, c, d.projectId))),
				tail: await Promise.all(tail.reverse().map((c) => commentView(ctx, c, d.projectId))),
				tailCommentIds: tailIds,
				middleCursor:
					!head.isDone && probe[5] && !tailIds.includes(probe[5]._id) ? head.continueCursor : null,
			},
		};
	},
});
export const interactive = query({
	args: { projectId: v.id('projects'), updateId: v.id('updates') },
	returns: v.union(
		v.null(),
		v.object({
			canEdit: v.boolean(),
			currentProfile: profileValidator,
			emoteCounts: counts,
			relatedFeedback: v.array(feedbackItem),
		})
	),
	handler: async (ctx, args) => {
		const d = await ctx.db.get('updates', args.updateId);
		if (!d || d.projectId !== args.projectId || !(await readAccess(ctx, d))) return null;
		const result = await ctx.runQuery(api.updates.detail, {
			projectId: args.projectId,
			slug: d.slug,
		});
		if (!result) return null;
		const user = await getCurrentUser(ctx);
		return {
			canEdit: result.canEdit,
			currentProfile:
				result.writable && user?.profileId
					? summary(await ctx.db.get('profiles', user.profileId))
					: null,
			emoteCounts: {
				heart: {
					count: d.heartCount,
					authorProfileIds: result.liked && user?.profileId ? [user.profileId] : [],
				},
			},
			relatedFeedback: await Promise.all(
				result.relatedFeedback.map(async (f) =>
					feedbackView(ctx, (await ctx.db.get('feedback', f.id))!)
				)
			),
		};
	},
});
export const middleComments = query({
	args: {
		updateId: v.id('updates'),
		cursor: v.string(),
		limit: v.optional(v.number()),
		tailCommentIds: v.optional(v.array(v.string())),
	},
	returns: v.object({ comments: v.array(commentItem), nextCursor: v.union(v.string(), v.null()) }),
	handler: async (ctx, args) => {
		const d = await ctx.db.get('updates', args.updateId);
		if (!d || !(await readAccess(ctx, d))) return { comments: [], nextCursor: null };
		const page = await ctx.db
			.query('updateComments')
			.withIndex('by_updateId', (q) => q.eq('updateId', d._id))
			.order('asc')
			.paginate({ cursor: args.cursor, numItems: Math.max(1, Math.min(args.limit ?? 20, 50)) });
		const tail = new Set(args.tailCommentIds ?? []);
		return {
			comments: await Promise.all(
				page.page.filter((c) => !tail.has(c._id)).map((c) => commentView(ctx, c, d.projectId))
			),
			nextCursor:
				page.isDone || page.page.some((c) => tail.has(c._id)) ? null : page.continueCursor,
		};
	},
});
export const feedbackByIds = query({
	args: { ids: v.array(v.id('feedback')) },
	returns: v.array(feedbackItem),
	handler: async (ctx, args) => {
		if (args.ids.length > 100) throw new ConvexError('INVALID_RELATED_FEEDBACK');
		const results = await Promise.all(
			args.ids.map(async (id) => {
				const d = await ctx.db.get('feedback', id);
				if (
					!d ||
					!(await isFeedbackLive(ctx, d)) ||
					!(await resolveProjectAccess(ctx, d.projectId)).project
				)
					return null;
				return feedbackView(ctx, d);
			})
		);
		return results.filter((d) => d !== null);
	},
});
export const searchFeedback = query({
	args: { projectId: v.id('projects'), search: v.optional(v.string()) },
	returns: v.array(feedbackItem),
	handler: async (ctx, args) => {
		const result = await ctx.runQuery(api.feedback.list, {
			...args,
			paginationOpts: { cursor: null, numItems: 20 },
		});
		if (!result) return [];
		return Promise.all(
			result.page.map(async (f: { id: Doc<'feedback'>['_id'] }) =>
				feedbackView(ctx, (await ctx.db.get('feedback', f.id))!)
			)
		);
	},
});
export const change = mutation({
	args: {
		id: v.id('updates'),
		title: v.optional(v.string()),
		content: v.optional(v.string()),
		category: v.optional(updateCategory),
		tags: v.optional(v.array(v.string())),
		featured: v.optional(v.boolean()),
		relatedFeedbackIds: v.optional(v.array(v.id('feedback'))),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const d = await ctx.db.get('updates', args.id);
		if (!d) throw new ConvexError('UPDATE_NOT_FOUND');
		const retained = await Promise.all(
			d.relatedFeedbackIds.map(async (id) => {
				const feedback = await ctx.db.get('feedback', id);
				return feedback?.projectId === d.projectId && (await isFeedbackLive(ctx, feedback))
					? id
					: null;
			})
		);
		await ctx.runMutation(api.updates.save, {
			id: d._id,
			projectId: d.projectId,
			title: args.title ?? d.title,
			content: args.content ?? d.content,
			category: args.category ?? d.category,
			tags: args.tags ?? d.tags,
			featured: args.featured ?? d.featuredAt !== undefined,
			relatedFeedbackIds: args.relatedFeedbackIds ?? retained.filter((id) => id !== null),
		});
		return null;
	},
});
export const changeStatus = mutation({
	args: { id: v.id('updates'), status: updateStatus },
	returns: v.null(),
	handler: async (ctx, args) => {
		const d = await ctx.db.get('updates', args.id);
		if (!d) throw new ConvexError('UPDATE_NOT_FOUND');
		await ctx.runMutation(api.updates.changeStatus, {
			projectId: d.projectId,
			ids: [d._id],
			status: args.status,
		});
		return null;
	},
});
export const remove = mutation({
	args: { id: v.id('updates') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const d = await ctx.db.get('updates', args.id);
		if (!d) throw new ConvexError('UPDATE_NOT_FOUND');
		await ctx.runMutation(api.updates.remove, { projectId: d.projectId, ids: [d._id] });
		return null;
	},
});
export const changeComment = mutation({
	args: { id: v.id('updateComments'), content: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const d = await ctx.db.get('updateComments', args.id);
		if (!d) throw new ConvexError('COMMENT_NOT_FOUND');
		await ctx.runMutation(api.updates.saveComment, { ...args, updateId: d.updateId });
		return null;
	},
});
export const toggleComment = mutation({
	args: { updateCommentId: v.id('updateComments'), content: v.string() },
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const d = await ctx.db.get('updateComments', args.updateCommentId);
		if (!d) throw new ConvexError('COMMENT_NOT_FOUND');
		// The native mutation validates the closed set of supported reactions.
		return ctx.runMutation(api.updates.toggleReaction, {
			updateId: d.updateId,
			commentId: d._id,
			content: args.content as 'heart',
		});
	},
});
