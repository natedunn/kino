import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import { internalMutation, mutation, query } from './_generated/server';
import { assertProjectWritable, requireProjectAccess, resolveProjectAccess } from './access';
import { isFeedbackLive } from './feedbackLifecycle';
import { requireCurrentUser } from './identity';
import { feedbackPriority, feedbackStatus, targetGranularity } from './schema';

const MAX_COMMENT_EMOTES = 100;
const DELETE_BATCH_SIZE = 100;
const profileSummaryValidator = v.union(
	v.null(),
	v.object({
		id: v.id('profiles'),
		imageUrl: v.union(v.string(), v.null()),
		name: v.string(),
		username: v.string(),
	})
);
const projectPermissionsValidator = v.object({
	canView: v.boolean(),
	canManageContent: v.boolean(),
	canEditSettings: v.boolean(),
	canManageAccess: v.boolean(),
	canManageIntegrations: v.boolean(),
	canDelete: v.boolean(),
});
const enrichedCommentValidator = v.object({
	id: v.id('feedbackComments'),
	creationTime: v.number(),
	author: profileSummaryValidator,
	canDelete: v.boolean(),
	canEdit: v.boolean(),
	content: v.string(),
	emotes: v.array(
		v.object({ content: v.string(), authorProfileIds: v.array(v.string()), count: v.number() })
	),
	initial: v.boolean(),
	replyFeedbackCommentId: v.union(v.id('feedbackComments'), v.null()),
	updatedTime: v.union(v.number(), v.null()),
});
const timelineItemValidator = v.union(
	v.object({
		type: v.literal('comment'),
		creationTime: v.number(),
		data: enrichedCommentValidator,
	}),
	v.object({
		type: v.literal('event'),
		creationTime: v.number(),
		data: v.object({
			id: v.id('feedbackEvents'),
			actor: profileSummaryValidator,
			eventType: v.union(
				v.literal('status_changed'),
				v.literal('priority_changed'),
				v.literal('title_changed'),
				v.literal('board_changed'),
				v.literal('answer_marked'),
				v.literal('answer_unmarked'),
				v.literal('assigned'),
				v.literal('unassigned')
			),
			metadata: v.union(
				v.null(),
				v.object({
					oldValue: v.optional(v.string()),
					newValue: v.optional(v.string()),
					targetProfileId: v.optional(v.id('profiles')),
				})
			),
		}),
	})
);
const feedbackListItemValidator = v.object({
	id: v.id('feedback'),
	slug: v.string(),
	title: v.string(),
	status: feedbackStatus,
	priority: feedbackPriority,
	upvotes: v.number(),
	hasUpvoted: v.boolean(),
	firstComment: v.union(v.null(), v.object({ content: v.string() })),
	board: v.object({
		id: v.id('feedbackBoards'),
		icon: v.union(v.string(), v.null()),
		name: v.string(),
		slug: v.string(),
	}),
});
const relatedFeedbackValidator = v.object({
	id: v.id('feedback'),
	slug: v.string(),
	status: feedbackStatus,
	title: v.string(),
});

async function currentProfile(ctx: QueryCtx) {
	const user = await requireCurrentUser(ctx);
	if (!user.profileId) throw new ConvexError('PROFILE_NOT_FOUND');
	const profile = await ctx.db.get('profiles', user.profileId);
	if (!profile) throw new ConvexError('PROFILE_NOT_FOUND');
	return profile;
}

function profileSummary(profile: Doc<'profiles'> | null) {
	return profile
		? {
				id: profile._id,
				imageUrl: profile.imageUrl ?? null,
				name: profile.name,
				username: profile.username,
			}
		: null;
}

async function enrichComment(
	ctx: QueryCtx,
	comment: Doc<'feedbackComments'>,
	viewerProfileId: Id<'profiles'> | null,
	canManageContent: boolean
) {
	const [author, emotes] = await Promise.all([
		ctx.db.get('profiles', comment.authorProfileId),
		ctx.db
			.query('feedbackCommentEmotes')
			.withIndex('by_feedbackCommentId', (q) => q.eq('feedbackCommentId', comment._id))
			.take(MAX_COMMENT_EMOTES),
	]);
	const emoteCounts = new Map<string, { authorProfileIds: Array<string>; count: number }>();
	for (const emote of emotes) {
		const entry = emoteCounts.get(emote.content) ?? { authorProfileIds: [], count: 0 };
		entry.count += 1;
		entry.authorProfileIds.push(emote.authorProfileId);
		emoteCounts.set(emote.content, entry);
	}
	return {
		id: comment._id,
		creationTime: comment._creationTime,
		author: profileSummary(author),
		canDelete:
			!comment.initial && (viewerProfileId === comment.authorProfileId || canManageContent),
		canEdit: viewerProfileId === comment.authorProfileId,
		content: comment.content,
		emotes: Array.from(emoteCounts, ([content, value]) => ({ content, ...value })),
		initial: comment.initial,
		replyFeedbackCommentId: comment.replyFeedbackCommentId ?? null,
		updatedTime: comment.updatedAt ?? null,
	};
}

async function feedbackWriteAccess(ctx: MutationCtx, feedbackId: Id<'feedback'>) {
	const profile = await currentProfile(ctx);
	const feedback = await ctx.db.get('feedback', feedbackId);
	if (!feedback || !(await isFeedbackLive(ctx, feedback)))
		throw new ConvexError('FEEDBACK_NOT_FOUND');
	const access = await requireProjectAccess(ctx, feedback.projectId);
	assertProjectWritable(access);
	return { access, feedback, isOwner: feedback.authorProfileId === profile._id, profile };
}

async function recordEvent(
	ctx: MutationCtx,
	args: {
		actorProfileId: Id<'profiles'>;
		feedbackId: Id<'feedback'>;
		eventType: Doc<'feedbackEvents'>['eventType'];
		metadata?: {
			oldValue?: string;
			newValue?: string;
			targetProfileId?: Id<'profiles'>;
		};
	}
) {
	const eventId = await ctx.db.insert('feedbackEvents', args);
	await ctx.db.insert('feedbackTimelineEntries', {
		feedbackId: args.feedbackId,
		kind: 'event',
		eventId,
	});
}

async function enrichTimelineEntry(
	ctx: QueryCtx,
	entry: Doc<'feedbackTimelineEntries'>,
	viewerProfileId: Id<'profiles'> | null,
	canManageContent: boolean
) {
	if (entry.kind === 'comment' && entry.commentId) {
		const comment = await ctx.db.get('feedbackComments', entry.commentId);
		if (!comment) return null;
		return {
			type: 'comment' as const,
			creationTime: entry._creationTime,
			data: await enrichComment(ctx, comment, viewerProfileId, canManageContent),
		};
	}
	if (entry.kind === 'event' && entry.eventId) {
		const event = await ctx.db.get('feedbackEvents', entry.eventId);
		if (!event) return null;
		return {
			type: 'event' as const,
			creationTime: entry._creationTime,
			data: {
				id: event._id,
				actor: profileSummary(await ctx.db.get('profiles', event.actorProfileId)),
				eventType: event.eventType,
				metadata: event.metadata ?? null,
			},
		};
	}
	return null;
}

function isValidTarget(target: string, granularity: 'day' | 'month' | 'quarter' | 'year') {
	if (granularity === 'year') return /^\d{4}$/.test(target);
	if (granularity === 'quarter') return /^\d{4}-Q[1-4]$/.test(target);
	if (granularity === 'month') return /^\d{4}-(0[1-9]|1[0-2])$/.test(target);
	return /^\d{4}-(0[1-9]|1[0-2])-([012]\d|3[01])$/.test(target);
}

async function uniqueSlug(ctx: MutationCtx, projectId: Id<'projects'>) {
	for (let attempt = 0; attempt < 5; attempt += 1) {
		const slug = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
		const existing = await ctx.db
			.query('feedback')
			.withIndex('by_projectId_and_slug', (q) => q.eq('projectId', projectId).eq('slug', slug))
			.unique();
		if (!existing) return slug;
	}
	throw new ConvexError('SLUG_GENERATION_FAILED');
}

export const create = mutation({
	args: {
		boardId: v.id('feedbackBoards'),
		firstComment: v.string(),
		projectId: v.id('projects'),
		title: v.string(),
	},
	returns: v.object({
		feedbackCommentId: v.id('feedbackComments'),
		feedbackId: v.id('feedback'),
		slug: v.string(),
	}),
	handler: async (ctx, args) => {
		const profile = await currentProfile(ctx);
		const access = await requireProjectAccess(ctx, args.projectId);
		assertProjectWritable(access);
		const board = await ctx.db.get('feedbackBoards', args.boardId);
		if (!board || board.projectId !== args.projectId || board.deletingAt !== undefined)
			throw new ConvexError('INVALID_BOARD');
		const title = args.title.trim();
		const firstComment = args.firstComment.trim();
		if (!title || title.length > 200) throw new ConvexError('INVALID_TITLE');
		if (!firstComment || firstComment.length > 50_000) throw new ConvexError('INVALID_COMMENT');
		const slug = await uniqueSlug(ctx, args.projectId);
		const now = Date.now();
		const feedbackId = await ctx.db.insert('feedback', {
			projectId: args.projectId,
			boardId: args.boardId,
			authorProfileId: profile._id,
			slug,
			title,
			status: 'open',
			priority: 'none',
			upvotes: 0,
			tags: [],
			searchContent: `${title} ${firstComment}`,
			updatedAt: now,
		});
		const feedbackCommentId = await ctx.db.insert('feedbackComments', {
			feedbackId,
			authorProfileId: profile._id,
			content: firstComment,
			initial: true,
		});
		await ctx.db.patch('feedback', feedbackId, { firstCommentId: feedbackCommentId });
		return { feedbackCommentId, feedbackId, slug };
	},
});

export const list = query({
	args: {
		projectId: v.id('projects'),
		boardId: v.optional(v.id('feedbackBoards')),
		status: v.optional(feedbackStatus),
		search: v.optional(v.string()),
		paginationOpts: paginationOptsValidator,
	},
	returns: v.union(v.null(), paginationResultValidator(feedbackListItemValidator)),
	handler: async (ctx, args) => {
		const access = await resolveProjectAccess(ctx, args.projectId);
		if (!access.project) return null;
		const search = args.search?.trim();
		const result = search
			? await ctx.db
					.query('feedback')
					.withSearchIndex('search_by_searchContent', (q) => {
						const base = q.search('searchContent', search).eq('projectId', args.projectId);
						if (args.boardId && args.status)
							return base.eq('boardId', args.boardId).eq('status', args.status);
						if (args.boardId) return base.eq('boardId', args.boardId);
						if (args.status) return base.eq('status', args.status);
						return base;
					})
					.paginate(args.paginationOpts)
			: args.boardId && args.status
				? await ctx.db
						.query('feedback')
						.withIndex('by_projectId_and_boardId_and_status', (q) =>
							q
								.eq('projectId', args.projectId)
								.eq('boardId', args.boardId!)
								.eq('status', args.status!)
						)
						.order('desc')
						.paginate(args.paginationOpts)
				: args.boardId
					? await ctx.db
							.query('feedback')
							.withIndex('by_projectId_and_boardId', (q) =>
								q.eq('projectId', args.projectId).eq('boardId', args.boardId!)
							)
							.order('desc')
							.paginate(args.paginationOpts)
					: args.status
						? await ctx.db
								.query('feedback')
								.withIndex('by_projectId_and_status', (q) =>
									q.eq('projectId', args.projectId).eq('status', args.status!)
								)
								.order('desc')
								.paginate(args.paginationOpts)
						: await ctx.db
								.query('feedback')
								.withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
								.order('desc')
								.paginate(args.paginationOpts);

		const viewer = await currentProfile(ctx).catch(() => null);
		const page = await Promise.all(
			result.page.map(async (item) => {
				if (item.deletingAt !== undefined) return null;
				const [board, firstComment, upvote] = await Promise.all([
					ctx.db.get('feedbackBoards', item.boardId),
					item.firstCommentId
						? ctx.db.get('feedbackComments', item.firstCommentId)
						: Promise.resolve(null),
					viewer
						? ctx.db
								.query('feedbackUpvotes')
								.withIndex('by_feedbackId_and_authorProfileId', (q) =>
									q.eq('feedbackId', item._id).eq('authorProfileId', viewer._id)
								)
								.unique()
						: Promise.resolve(null),
				]);
				if (!board || board.deletingAt !== undefined) return null;
				return {
					id: item._id,
					slug: item.slug,
					title: item.title,
					status: item.status,
					priority: item.priority,
					upvotes: item.upvotes,
					hasUpvoted: !!upvote,
					firstComment: firstComment ? { content: firstComment.content } : null,
					board: { id: board._id, icon: board.icon ?? null, name: board.name, slug: board.slug },
				};
			})
		);
		return { ...result, page: page.filter((item) => item !== null) };
	},
});

export const getDetail = query({
	args: { projectId: v.id('projects'), slug: v.string() },
	returns: v.union(
		v.null(),
		v.object({
			author: profileSummaryValidator,
			board: v.union(
				v.null(),
				v.object({
					id: v.id('feedbackBoards'),
					icon: v.union(v.string(), v.null()),
					name: v.string(),
					slug: v.string(),
				})
			),
			assignedProfile: profileSummaryValidator,
			currentProfile: profileSummaryValidator,
			feedback: v.object({
				createdAt: v.number(),
				id: v.id('feedback'),
				answerCommentId: v.union(v.id('feedbackComments'), v.null()),
				assignedProfileId: v.union(v.id('profiles'), v.null()),
				boardId: v.id('feedbackBoards'),
				priority: feedbackPriority,
				slug: v.string(),
				status: feedbackStatus,
				tags: v.array(v.string()),
				target: v.union(v.string(), v.null()),
				targetGranularity: v.union(targetGranularity, v.null()),
				title: v.string(),
				upvotes: v.number(),
			}),
			firstComment: v.union(enrichedCommentValidator, v.null()),
			following: v.boolean(),
			hasUpvoted: v.boolean(),
			permissions: projectPermissionsValidator,
			related: v.array(relatedFeedbackValidator),
			timeline: v.array(timelineItemValidator),
			timelineCursor: v.union(v.string(), v.null()),
			watchers: v.array(profileSummaryValidator),
		})
	),
	handler: async (ctx, args) => {
		const access = await resolveProjectAccess(ctx, args.projectId);
		if (!access.project) return null;
		const feedback = await ctx.db
			.query('feedback')
			.withIndex('by_projectId_and_slug', (q) =>
				q.eq('projectId', args.projectId).eq('slug', args.slug)
			)
			.unique();
		if (!feedback || !(await isFeedbackLive(ctx, feedback))) return null;
		const viewer = await currentProfile(ctx).catch(() => null);
		const [
			author,
			board,
			firstComment,
			assignedProfile,
			timelinePage,
			upvote,
			watcher,
			watchers,
			relations,
		] = await Promise.all([
			ctx.db.get('profiles', feedback.authorProfileId),
			ctx.db.get('feedbackBoards', feedback.boardId),
			feedback.firstCommentId
				? ctx.db.get('feedbackComments', feedback.firstCommentId)
				: Promise.resolve(null),
			feedback.assignedProfileId
				? ctx.db.get('profiles', feedback.assignedProfileId)
				: Promise.resolve(null),
			ctx.db
				.query('feedbackTimelineEntries')
				.withIndex('by_feedbackId', (q) => q.eq('feedbackId', feedback._id))
				.order('desc')
				.paginate({ cursor: null, numItems: 20 }),
			viewer
				? ctx.db
						.query('feedbackUpvotes')
						.withIndex('by_feedbackId_and_authorProfileId', (q) =>
							q.eq('feedbackId', feedback._id).eq('authorProfileId', viewer._id)
						)
						.unique()
				: Promise.resolve(null),
			viewer
				? ctx.db
						.query('feedbackWatchers')
						.withIndex('by_feedbackId_and_profileId', (q) =>
							q.eq('feedbackId', feedback._id).eq('profileId', viewer._id)
						)
						.unique()
				: Promise.resolve(null),
			ctx.db
				.query('feedbackWatchers')
				.withIndex('by_feedbackId_and_profileId', (q) => q.eq('feedbackId', feedback._id))
				.take(20),
			ctx.db
				.query('feedbackRelations')
				.withIndex('by_feedbackId', (q) => q.eq('feedbackId', feedback._id))
				.take(50),
		]);
		const timeline = (
			await Promise.all(
				[...timelinePage.page]
					.reverse()
					.map((entry) =>
						enrichTimelineEntry(
							ctx,
							entry,
							viewer?._id ?? null,
							access.permissions.canManageContent
						)
					)
			)
		).filter((item) => item !== null);
		const related = (
			await Promise.all(
				relations.map(async (relation) => {
					const item = await ctx.db.get('feedback', relation.relatedFeedbackId);
					return item && item.projectId === feedback.projectId && (await isFeedbackLive(ctx, item))
						? { id: item._id, slug: item.slug, status: item.status, title: item.title }
						: null;
				})
			)
		).filter((item) => item !== null);
		return {
			author: profileSummary(author),
			board: board
				? { id: board._id, icon: board.icon ?? null, name: board.name, slug: board.slug }
				: null,
			assignedProfile: profileSummary(assignedProfile),
			currentProfile: profileSummary(viewer),
			feedback: {
				createdAt: feedback._creationTime,
				id: feedback._id,
				answerCommentId: feedback.answerCommentId ?? null,
				assignedProfileId: feedback.assignedProfileId ?? null,
				boardId: feedback.boardId,
				priority: feedback.priority,
				slug: feedback.slug,
				status: feedback.status,
				tags: feedback.tags,
				target: feedback.target ?? null,
				targetGranularity: feedback.targetGranularity ?? null,
				title: feedback.title,
				upvotes: feedback.upvotes,
			},
			firstComment: firstComment
				? await enrichComment(
						ctx,
						firstComment,
						viewer?._id ?? null,
						access.permissions.canManageContent
					)
				: null,
			following: !!watcher,
			hasUpvoted: !!upvote,
			permissions: access.permissions,
			related,
			timeline,
			timelineCursor: timelinePage.isDone ? null : timelinePage.continueCursor,
			watchers: await Promise.all(
				watchers.map(async (item) => profileSummary(await ctx.db.get('profiles', item.profileId)))
			),
		};
	},
});

export const listTimelinePage = query({
	args: { feedbackId: v.id('feedback'), paginationOpts: paginationOptsValidator },
	returns: v.union(v.null(), paginationResultValidator(timelineItemValidator)),
	handler: async (ctx, args) => {
		const feedback = await ctx.db.get('feedback', args.feedbackId);
		if (!feedback || !(await isFeedbackLive(ctx, feedback))) return null;
		const access = await resolveProjectAccess(ctx, feedback.projectId);
		if (!access.project) return null;
		const viewer = await currentProfile(ctx).catch(() => null);
		const page = await ctx.db
			.query('feedbackTimelineEntries')
			.withIndex('by_feedbackId', (q) => q.eq('feedbackId', feedback._id))
			.order('desc')
			.paginate(args.paginationOpts);
		const items = (
			await Promise.all(
				[...page.page]
					.reverse()
					.map((entry) =>
						enrichTimelineEntry(
							ctx,
							entry,
							viewer?._id ?? null,
							access.permissions.canManageContent
						)
					)
			)
		).filter((item) => item !== null);
		return { ...page, page: items };
	},
});

export const searchForLinking = query({
	args: { projectId: v.id('projects'), search: v.string() },
	returns: v.array(relatedFeedbackValidator),
	handler: async (ctx, args) => {
		const access = await resolveProjectAccess(ctx, args.projectId);
		if (!access.project) return [];
		const search = args.search.trim();
		const items = search
			? await ctx.db
					.query('feedback')
					.withSearchIndex('search_by_searchContent', (q) =>
						q.search('searchContent', search).eq('projectId', args.projectId)
					)
					.take(20)
			: await ctx.db
					.query('feedback')
					.withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
					.order('desc')
					.take(20);
		const live = await Promise.all(items.map((item) => isFeedbackLive(ctx, item)));
		return items
			.filter((_item, index) => live[index])
			.map((item) => ({
				id: item._id,
				slug: item.slug,
				status: item.status,
				title: item.title,
			}));
	},
});

export const toggleUpvote = mutation({
	args: { feedbackId: v.id('feedback') },
	returns: v.object({ count: v.number(), upvoted: v.boolean() }),
	handler: async (ctx, { feedbackId }) => {
		const { feedback, profile } = await feedbackWriteAccess(ctx, feedbackId);
		const existing = await ctx.db
			.query('feedbackUpvotes')
			.withIndex('by_feedbackId_and_authorProfileId', (q) =>
				q.eq('feedbackId', feedbackId).eq('authorProfileId', profile._id)
			)
			.unique();
		if (existing) {
			await ctx.db.delete('feedbackUpvotes', existing._id);
			const count = Math.max(0, feedback.upvotes - 1);
			await ctx.db.patch('feedback', feedbackId, { upvotes: count });
			return { count, upvoted: false };
		}
		await ctx.db.insert('feedbackUpvotes', { feedbackId, authorProfileId: profile._id });
		const count = feedback.upvotes + 1;
		await ctx.db.patch('feedback', feedbackId, { upvotes: count });
		return { count, upvoted: true };
	},
});

export const updateStatus = mutation({
	args: { feedbackId: v.id('feedback'), status: feedbackStatus },
	returns: v.null(),
	handler: async (ctx, args) => {
		const { access, feedback, isOwner, profile } = await feedbackWriteAccess(ctx, args.feedbackId);
		if (!isOwner && !access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
		if (feedback.status !== args.status) {
			await ctx.db.patch('feedback', feedback._id, { status: args.status, updatedAt: Date.now() });
			await recordEvent(ctx, {
				actorProfileId: profile._id,
				feedbackId: feedback._id,
				eventType: 'status_changed',
				metadata: { oldValue: feedback.status, newValue: args.status },
			});
		}
		return null;
	},
});

export const updatePriority = mutation({
	args: { feedbackId: v.id('feedback'), priority: feedbackPriority },
	returns: v.null(),
	handler: async (ctx, args) => {
		const { access, feedback, profile } = await feedbackWriteAccess(ctx, args.feedbackId);
		if (!access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
		if (feedback.priority !== args.priority) {
			await ctx.db.patch('feedback', feedback._id, {
				priority: args.priority,
				updatedAt: Date.now(),
			});
			await recordEvent(ctx, {
				actorProfileId: profile._id,
				feedbackId: feedback._id,
				eventType: 'priority_changed',
				metadata: { oldValue: feedback.priority, newValue: args.priority },
			});
		}
		return null;
	},
});

export const updateTitle = mutation({
	args: { feedbackId: v.id('feedback'), title: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const { access, feedback, isOwner, profile } = await feedbackWriteAccess(ctx, args.feedbackId);
		if (!isOwner && !access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
		const title = args.title.trim();
		if (!title || title.length > 200) throw new ConvexError('INVALID_TITLE');
		if (title === feedback.title) return null;
		const firstComment = feedback.firstCommentId
			? await ctx.db.get('feedbackComments', feedback.firstCommentId)
			: null;
		await ctx.db.patch('feedback', feedback._id, {
			title,
			searchContent: `${title} ${firstComment?.content ?? ''}`.trim(),
			updatedAt: Date.now(),
		});
		await recordEvent(ctx, {
			actorProfileId: profile._id,
			feedbackId: feedback._id,
			eventType: 'title_changed',
			metadata: { oldValue: feedback.title, newValue: title },
		});
		return null;
	},
});

export const updateBoard = mutation({
	args: { feedbackId: v.id('feedback'), boardId: v.id('feedbackBoards') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const { access, feedback, isOwner, profile } = await feedbackWriteAccess(ctx, args.feedbackId);
		if (!isOwner && !access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
		const board = await ctx.db.get('feedbackBoards', args.boardId);
		if (!board || board.projectId !== feedback.projectId || board.deletingAt !== undefined)
			throw new ConvexError('INVALID_BOARD');
		if (board._id === feedback.boardId) return null;
		const oldBoard = await ctx.db.get('feedbackBoards', feedback.boardId);
		await ctx.db.patch('feedback', feedback._id, { boardId: board._id, updatedAt: Date.now() });
		await recordEvent(ctx, {
			actorProfileId: profile._id,
			feedbackId: feedback._id,
			eventType: 'board_changed',
			metadata: { oldValue: oldBoard?.name ?? 'Unknown', newValue: board.name },
		});
		return null;
	},
});

async function canBeAssigned(ctx: QueryCtx, project: Doc<'projects'>, profile: Doc<'profiles'>) {
	const membership = await ctx.db
		.query('memberships')
		.withIndex('by_organizationId_and_userId', (q) =>
			q.eq('organizationId', project.organizationId).eq('userId', profile.userId)
		)
		.unique();
	if (!membership) return false;
	if (membership.role !== 'moderator') return true;
	return !!(await ctx.db
		.query('projectModeratorAssignments')
		.withIndex('by_membershipId_and_projectId', (q) =>
			q.eq('membershipId', membership._id).eq('projectId', project._id)
		)
		.unique());
}

export const listAssignableProfiles = query({
	args: { projectId: v.id('projects') },
	returns: v.array(
		v.object({
			id: v.id('profiles'),
			imageUrl: v.union(v.string(), v.null()),
			name: v.string(),
			username: v.string(),
		})
	),
	handler: async (ctx, { projectId }) => {
		const access = await resolveProjectAccess(ctx, projectId);
		if (!access.project || !access.permissions.canManageContent) return [];
		const project = access.project;
		const memberships = await ctx.db
			.query('memberships')
			.withIndex('by_organizationId_and_role', (q) =>
				q.eq('organizationId', project.organizationId)
			)
			.take(100);
		const result = await Promise.all(
			memberships.map(async (membership) => {
				const user = await ctx.db.get('users', membership.userId);
				const profile = user?.profileId ? await ctx.db.get('profiles', user.profileId) : null;
				if (!profile || !(await canBeAssigned(ctx, project, profile))) return null;
				return profileSummary(profile);
			})
		);
		return result.filter((item) => item !== null);
	},
});

export const updateAssigned = mutation({
	args: { feedbackId: v.id('feedback'), assignedProfileId: v.optional(v.id('profiles')) },
	returns: v.null(),
	handler: async (ctx, args) => {
		const { access, feedback, profile } = await feedbackWriteAccess(ctx, args.feedbackId);
		if (!access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
		if (args.assignedProfileId) {
			const [assignee, project] = await Promise.all([
				ctx.db.get('profiles', args.assignedProfileId),
				ctx.db.get('projects', feedback.projectId),
			]);
			if (!assignee || !project || !(await canBeAssigned(ctx, project, assignee)))
				throw new ConvexError('INVALID_ASSIGNEE');
		}
		if (args.assignedProfileId === feedback.assignedProfileId) return null;
		await ctx.db.patch('feedback', feedback._id, {
			assignedProfileId: args.assignedProfileId,
			updatedAt: Date.now(),
		});
		await recordEvent(ctx, {
			actorProfileId: profile._id,
			feedbackId: feedback._id,
			eventType: args.assignedProfileId ? 'assigned' : 'unassigned',
			metadata: { targetProfileId: args.assignedProfileId ?? feedback.assignedProfileId },
		});
		return null;
	},
});

export const updateTarget = mutation({
	args: {
		feedbackId: v.id('feedback'),
		target: v.optional(v.string()),
		targetGranularity: v.optional(targetGranularity),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const { access, feedback } = await feedbackWriteAccess(ctx, args.feedbackId);
		if (!access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
		if (!!args.target !== !!args.targetGranularity) throw new ConvexError('INVALID_TARGET');
		if (
			args.target &&
			args.targetGranularity &&
			!isValidTarget(args.target, args.targetGranularity)
		)
			throw new ConvexError('INVALID_TARGET');
		await ctx.db.patch('feedback', feedback._id, {
			target: args.target,
			targetGranularity: args.targetGranularity,
			updatedAt: Date.now(),
		});
		return null;
	},
});

export const updateTags = mutation({
	args: { feedbackId: v.id('feedback'), tags: v.array(v.string()) },
	returns: v.null(),
	handler: async (ctx, args) => {
		const { access, feedback } = await feedbackWriteAccess(ctx, args.feedbackId);
		if (!access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
		const tags = [...new Set(args.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
		if (tags.length > 20 || tags.some((tag) => tag.length > 40))
			throw new ConvexError('INVALID_TAGS');
		await ctx.db.patch('feedback', feedback._id, { tags, updatedAt: Date.now() });
		return null;
	},
});

export const setAnswerComment = mutation({
	args: { feedbackId: v.id('feedback'), commentId: v.optional(v.id('feedbackComments')) },
	returns: v.null(),
	handler: async (ctx, args) => {
		const { access, feedback, isOwner, profile } = await feedbackWriteAccess(ctx, args.feedbackId);
		if (!isOwner && !access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
		if (args.commentId) {
			const comment = await ctx.db.get('feedbackComments', args.commentId);
			if (!comment || comment.feedbackId !== feedback._id || comment.initial)
				throw new ConvexError('INVALID_ANSWER');
		}
		if (args.commentId === feedback.answerCommentId) return null;
		await ctx.db.patch('feedback', feedback._id, {
			answerCommentId: args.commentId,
			updatedAt: Date.now(),
		});
		await recordEvent(ctx, {
			actorProfileId: profile._id,
			feedbackId: feedback._id,
			eventType: args.commentId ? 'answer_marked' : 'answer_unmarked',
		});
		return null;
	},
});

export const toggleFollow = mutation({
	args: { feedbackId: v.id('feedback') },
	returns: v.object({ following: v.boolean() }),
	handler: async (ctx, { feedbackId }) => {
		const { feedback, profile } = await feedbackWriteAccess(ctx, feedbackId);
		const existing = await ctx.db
			.query('feedbackWatchers')
			.withIndex('by_feedbackId_and_profileId', (q) =>
				q.eq('feedbackId', feedback._id).eq('profileId', profile._id)
			)
			.unique();
		if (existing) {
			await ctx.db.delete('feedbackWatchers', existing._id);
			return { following: false };
		}
		await ctx.db.insert('feedbackWatchers', { feedbackId: feedback._id, profileId: profile._id });
		return { following: true };
	},
});

export const addRelation = mutation({
	args: { feedbackId: v.id('feedback'), relatedFeedbackId: v.id('feedback') },
	returns: v.null(),
	handler: async (ctx, args) => {
		if (args.feedbackId === args.relatedFeedbackId) throw new ConvexError('INVALID_RELATION');
		const { access, feedback, profile } = await feedbackWriteAccess(ctx, args.feedbackId);
		if (!access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
		const related = await ctx.db.get('feedback', args.relatedFeedbackId);
		if (
			!related ||
			related.projectId !== feedback.projectId ||
			!(await isFeedbackLive(ctx, related))
		)
			throw new ConvexError('INVALID_RELATION');
		const pairs = [
			[feedback._id, related._id],
			[related._id, feedback._id],
		] as const;
		for (const [source, target] of pairs) {
			const existing = await ctx.db
				.query('feedbackRelations')
				.withIndex('by_feedbackId_and_relatedFeedbackId', (q) =>
					q.eq('feedbackId', source).eq('relatedFeedbackId', target)
				)
				.unique();
			if (!existing)
				await ctx.db.insert('feedbackRelations', {
					projectId: feedback.projectId,
					feedbackId: source,
					relatedFeedbackId: target,
					createdByProfileId: profile._id,
				});
		}
		return null;
	},
});

export const removeRelation = mutation({
	args: { feedbackId: v.id('feedback'), relatedFeedbackId: v.id('feedback') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const { access } = await feedbackWriteAccess(ctx, args.feedbackId);
		if (!access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
		for (const [source, target] of [
			[args.feedbackId, args.relatedFeedbackId],
			[args.relatedFeedbackId, args.feedbackId],
		] as const) {
			const relation = await ctx.db
				.query('feedbackRelations')
				.withIndex('by_feedbackId_and_relatedFeedbackId', (q) =>
					q.eq('feedbackId', source).eq('relatedFeedbackId', target)
				)
				.unique();
			if (relation) await ctx.db.delete('feedbackRelations', relation._id);
		}
		return null;
	},
});

async function deletionRows(ctx: MutationCtx, feedbackId: Id<'feedback'>) {
	return Promise.all([
		ctx.db
			.query('feedbackComments')
			.withIndex('by_feedbackId', (q) => q.eq('feedbackId', feedbackId))
			.take(DELETE_BATCH_SIZE + 1),
		ctx.db
			.query('feedbackEvents')
			.withIndex('by_feedbackId', (q) => q.eq('feedbackId', feedbackId))
			.take(DELETE_BATCH_SIZE + 1),
		ctx.db
			.query('feedbackUpvotes')
			.withIndex('by_feedbackId_and_authorProfileId', (q) => q.eq('feedbackId', feedbackId))
			.take(DELETE_BATCH_SIZE + 1),
		ctx.db
			.query('feedbackCommentEmotes')
			.withIndex('by_feedbackId', (q) => q.eq('feedbackId', feedbackId))
			.take(DELETE_BATCH_SIZE + 1),
		ctx.db
			.query('feedbackTimelineEntries')
			.withIndex('by_feedbackId', (q) => q.eq('feedbackId', feedbackId))
			.take(DELETE_BATCH_SIZE + 1),
		ctx.db
			.query('feedbackWatchers')
			.withIndex('by_feedbackId_and_profileId', (q) => q.eq('feedbackId', feedbackId))
			.take(DELETE_BATCH_SIZE + 1),
		ctx.db
			.query('feedbackRelations')
			.withIndex('by_feedbackId', (q) => q.eq('feedbackId', feedbackId))
			.take(DELETE_BATCH_SIZE + 1),
		ctx.db
			.query('feedbackRelations')
			.withIndex('by_relatedFeedbackId', (q) => q.eq('relatedFeedbackId', feedbackId))
			.take(DELETE_BATCH_SIZE + 1),
	]);
}

export async function deleteChildBatch(ctx: MutationCtx, feedbackId: Id<'feedback'>) {
	const relayLinks = await ctx.db
		.query('relayIssues')
		.withIndex('by_feedbackId', (q) => q.eq('feedbackId', feedbackId))
		.take(100);
	if (relayLinks.length) {
		for (const row of relayLinks) await ctx.db.delete('relayIssues', row._id);
		return true;
	}
	const [comments, events, upvotes, emotes, timeline, watchers, relations, reverseRelations] =
		await deletionRows(ctx, feedbackId);
	let remaining = DELETE_BATCH_SIZE;
	for (const row of comments.slice(0, remaining)) await ctx.db.delete('feedbackComments', row._id);
	remaining -= Math.min(comments.length, remaining);
	for (const row of events.slice(0, remaining)) await ctx.db.delete('feedbackEvents', row._id);
	remaining -= Math.min(events.length, remaining);
	for (const row of upvotes.slice(0, remaining)) await ctx.db.delete('feedbackUpvotes', row._id);
	remaining -= Math.min(upvotes.length, remaining);
	for (const row of emotes.slice(0, remaining))
		await ctx.db.delete('feedbackCommentEmotes', row._id);
	remaining -= Math.min(emotes.length, remaining);
	for (const row of timeline.slice(0, remaining))
		await ctx.db.delete('feedbackTimelineEntries', row._id);
	remaining -= Math.min(timeline.length, remaining);
	for (const row of watchers.slice(0, remaining)) await ctx.db.delete('feedbackWatchers', row._id);
	remaining -= Math.min(watchers.length, remaining);
	for (const row of relations.slice(0, remaining))
		await ctx.db.delete('feedbackRelations', row._id);
	remaining -= Math.min(relations.length, remaining);
	for (const row of reverseRelations.slice(0, remaining))
		await ctx.db.delete('feedbackRelations', row._id);
	const total =
		comments.length +
		events.length +
		upvotes.length +
		emotes.length +
		timeline.length +
		watchers.length +
		relations.length +
		reverseRelations.length;
	return total > DELETE_BATCH_SIZE;
}

export const remove = mutation({
	args: { feedbackId: v.id('feedback') },
	returns: v.null(),
	handler: async (ctx, { feedbackId }) => {
		const { access, feedback, profile } = await feedbackWriteAccess(ctx, feedbackId);
		if (!access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
		const hasMore = await deleteChildBatch(ctx, feedback._id);
		if (!hasMore) {
			await ctx.db.delete('feedback', feedback._id);
			return null;
		}
		const jobId = await ctx.db.insert('feedbackDeletionJobs', {
			feedbackId: feedback._id,
			requestedByProfileId: profile._id,
			startedAt: Date.now(),
		});
		await ctx.db.patch('feedback', feedback._id, { deletingAt: Date.now() });
		await ctx.scheduler.runAfter(0, internal.feedback.processDeletionJob, { jobId });
		return null;
	},
});

export const processDeletionJob = internalMutation({
	args: { jobId: v.id('feedbackDeletionJobs') },
	returns: v.null(),
	handler: async (ctx, { jobId }) => {
		const job = await ctx.db.get('feedbackDeletionJobs', jobId);
		if (!job) return null;
		const feedback = await ctx.db.get('feedback', job.feedbackId);
		if (!feedback) {
			await ctx.db.delete('feedbackDeletionJobs', job._id);
			return null;
		}
		if (await deleteChildBatch(ctx, feedback._id)) {
			await ctx.scheduler.runAfter(0, internal.feedback.processDeletionJob, { jobId });
			return null;
		}
		await ctx.db.delete('feedback', feedback._id);
		await ctx.db.delete('feedbackDeletionJobs', job._id);
		return null;
	},
});
