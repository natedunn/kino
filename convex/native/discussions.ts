import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

import { RateLimiter } from '@convex-dev/rate-limiter';
import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';

import { getUpdateListPreviewData } from '../shared/update-content';
import { VALIDATION_LIMITS } from '../shared/validation';
import { components, internal } from './_generated/api';
import { internalMutation, mutation, query } from './_generated/server';
import { assertProjectWritable, requireProjectAccess, resolveProjectAccess } from './access';
import { getCurrentUser, requireCurrentUser } from './identity';
import { discussionsPostingPolicy, emoteReaction } from './schema';
import { profileValidator, summary } from './updates';

// Stored HTML; the visible-text limit (VALIDATION_LIMITS.discussionBody) is enforced client-side.
const MAX_CONTENT = 50_000;
const MAX_COMMENT_EMOTES = 100;
const EXCERPT_CHARS = 300;
const DELETE_BATCH_SIZE = 100;

const limits = new RateLimiter(components.authLimits, {
	discussionWrite: { kind: 'token bucket', rate: 30, period: 60_000, capacity: 30 },
});

const commentValidator = v.object({
	id: v.id('discussionComments'),
	creationTime: v.number(),
	updatedTime: v.union(v.number(), v.null()),
	author: profileValidator,
	content: v.string(),
	canEdit: v.boolean(),
	canDelete: v.boolean(),
	emotes: v.array(
		v.object({
			content: emoteReaction,
			count: v.number(),
			authorProfileIds: v.array(v.id('profiles')),
		})
	),
});
const listItemValidator = v.object({
	id: v.id('discussions'),
	slug: v.string(),
	title: v.string(),
	excerpt: v.string(),
	author: profileValidator,
	commentCount: v.number(),
	createdAt: v.number(),
	lastActivityAt: v.number(),
});

type Access = Awaited<ReturnType<typeof resolveProjectAccess>>;

export function postingPolicy(project: Doc<'projects'>) {
	return project.discussionsPostingPolicy ?? 'everyone';
}

function canStartDiscussion(access: Access) {
	if (!access.project || access.isArchived) return false;
	return postingPolicy(access.project) === 'everyone' || access.permissions.canManageContent;
}

async function actor(ctx: MutationCtx) {
	const user = await requireCurrentUser(ctx);
	if (!user.profileId) throw new ConvexError('PROFILE_NOT_FOUND');
	const result = await limits.limit(ctx, 'discussionWrite', { key: user._id });
	if (!result.ok) throw new ConvexError('RATE_LIMITED');
	return user.profileId;
}

async function readableDiscussion(ctx: QueryCtx, discussion: Doc<'discussions'> | null) {
	if (!discussion || discussion.deletingAt !== undefined) return null;
	const access = await resolveProjectAccess(ctx, discussion.projectId);
	return access.project ? access : null;
}

async function writableDiscussion(ctx: MutationCtx, discussionId: Id<'discussions'>) {
	const profileId = await actor(ctx);
	const discussion = await ctx.db.get('discussions', discussionId);
	const access = await readableDiscussion(ctx, discussion);
	if (!discussion || !access) throw new ConvexError('DISCUSSION_NOT_FOUND');
	assertProjectWritable(access);
	return { access, discussion, profileId };
}

function validateTitle(value: string) {
	const title = value.trim();
	if (!title || title.length > VALIDATION_LIMITS.discussionTitle)
		throw new ConvexError('INVALID_TITLE');
	return title;
}

function validateContent(value: string) {
	const content = value.trim();
	if (!content || content.length > MAX_CONTENT) throw new ConvexError('INVALID_COMMENT');
	return content;
}

function plainText(content: string) {
	return getUpdateListPreviewData(content).preview;
}

function searchContent(title: string, body: string) {
	return `${title} ${plainText(body)}`.trim();
}

async function uniqueSlug(ctx: MutationCtx, projectId: Id<'projects'>) {
	for (let attempt = 0; attempt < 5; attempt += 1) {
		const slug = crypto.randomUUID().replaceAll('-', '').slice(0, 10);
		const existing = await ctx.db
			.query('discussions')
			.withIndex('by_projectId_and_slug', (q) => q.eq('projectId', projectId).eq('slug', slug))
			.unique();
		if (!existing) return slug;
	}
	throw new ConvexError('SLUG_GENERATION_FAILED');
}

async function enrichComment(
	ctx: QueryCtx,
	comment: Doc<'discussionComments'>,
	viewerProfileId: Id<'profiles'> | null,
	access: Access
) {
	const [author, emotes] = await Promise.all([
		ctx.db.get('profiles', comment.authorProfileId),
		ctx.db
			.query('discussionCommentEmotes')
			.withIndex('by_commentId_and_authorProfileId_and_content', (q) =>
				q.eq('commentId', comment._id)
			)
			.take(MAX_COMMENT_EMOTES),
	]);
	const grouped = new Map<
		Doc<'discussionCommentEmotes'>['content'],
		{ count: number; authorProfileIds: Array<Id<'profiles'>> }
	>();
	for (const emote of emotes) {
		const entry = grouped.get(emote.content) ?? { count: 0, authorProfileIds: [] };
		entry.count += 1;
		entry.authorProfileIds.push(emote.authorProfileId);
		grouped.set(emote.content, entry);
	}
	const isAuthor = !!viewerProfileId && viewerProfileId === comment.authorProfileId;
	return {
		id: comment._id,
		creationTime: comment._creationTime,
		updatedTime: comment.updatedAt ?? null,
		author: summary(author),
		content: comment.content,
		canEdit: isAuthor && !access.isArchived,
		canDelete:
			!comment.initial && !access.isArchived && (isAuthor || access.permissions.canManageContent),
		emotes: Array.from(grouped, ([content, value]) => ({ content, ...value })),
	};
}

export const viewerAccess = query({
	args: { projectId: v.id('projects') },
	returns: v.union(
		v.null(),
		v.object({
			canCreate: v.boolean(),
			postingPolicy: discussionsPostingPolicy,
			writable: v.boolean(),
		})
	),
	handler: async (ctx, { projectId }) => {
		const access = await resolveProjectAccess(ctx, projectId);
		if (!access.project) return null;
		const user = await getCurrentUser(ctx);
		return {
			// Signed-out visitors see the button so it can route them through sign-in.
			canCreate: canStartDiscussion(access) && (!user || !!user.profileId),
			postingPolicy: postingPolicy(access.project),
			writable: !access.isArchived,
		};
	},
});

export const list = query({
	args: {
		projectId: v.id('projects'),
		search: v.optional(v.string()),
		paginationOpts: paginationOptsValidator,
	},
	returns: paginationResultValidator(listItemValidator),
	handler: async (ctx, args) => {
		const access = await resolveProjectAccess(ctx, args.projectId);
		if (!access.project) return { page: [], isDone: true, continueCursor: '' };
		const search = args.search?.trim();
		if (search && search.length > VALIDATION_LIMITS.discussionSearch)
			throw new ConvexError('INVALID_SEARCH');
		const result = search
			? await ctx.db
					.query('discussions')
					.withSearchIndex('search_by_searchContent', (q) =>
						q.search('searchContent', search).eq('projectId', args.projectId)
					)
					.paginate(args.paginationOpts)
			: await ctx.db
					.query('discussions')
					.withIndex('by_projectId_and_lastActivityAt', (q) => q.eq('projectId', args.projectId))
					.order('desc')
					.paginate(args.paginationOpts);
		const page = await Promise.all(
			result.page
				.filter((item) => item.deletingAt === undefined)
				.map(async (item) => {
					const [author, first] = await Promise.all([
						ctx.db.get('profiles', item.authorProfileId),
						item.firstCommentId ? ctx.db.get('discussionComments', item.firstCommentId) : null,
					]);
					const text = first ? plainText(first.content) : '';
					return {
						id: item._id,
						slug: item.slug,
						title: item.title,
						excerpt: text.length > EXCERPT_CHARS ? `${text.slice(0, EXCERPT_CHARS)}…` : text,
						author: summary(author),
						commentCount: item.commentCount,
						createdAt: item._creationTime,
						lastActivityAt: item.lastActivityAt,
					};
				})
		);
		return { ...result, page };
	},
});

export const detail = query({
	args: { projectId: v.id('projects'), slug: v.string() },
	returns: v.union(
		v.null(),
		v.object({
			discussion: v.object({
				id: v.id('discussions'),
				slug: v.string(),
				title: v.string(),
				commentCount: v.number(),
				createdAt: v.number(),
				lastActivityAt: v.number(),
			}),
			author: profileValidator,
			firstComment: v.union(commentValidator, v.null()),
			viewerProfileId: v.union(v.id('profiles'), v.null()),
			canEditTitle: v.boolean(),
			canDelete: v.boolean(),
			writable: v.boolean(),
		})
	),
	handler: async (ctx, args) => {
		const discussion = await ctx.db
			.query('discussions')
			.withIndex('by_projectId_and_slug', (q) =>
				q.eq('projectId', args.projectId).eq('slug', args.slug)
			)
			.unique();
		const access = await readableDiscussion(ctx, discussion);
		if (!discussion || !access) return null;
		const user = await getCurrentUser(ctx);
		const viewerProfileId = user?.profileId ?? null;
		const [author, first] = await Promise.all([
			ctx.db.get('profiles', discussion.authorProfileId),
			discussion.firstCommentId
				? ctx.db.get('discussionComments', discussion.firstCommentId)
				: null,
		]);
		const writable = !access.isArchived;
		const manager = access.permissions.canManageContent;
		return {
			discussion: {
				id: discussion._id,
				slug: discussion.slug,
				title: discussion.title,
				commentCount: discussion.commentCount,
				createdAt: discussion._creationTime,
				lastActivityAt: discussion.lastActivityAt,
			},
			author: summary(author),
			firstComment: first ? await enrichComment(ctx, first, viewerProfileId, access) : null,
			viewerProfileId,
			canEditTitle:
				writable &&
				(manager || (!!viewerProfileId && viewerProfileId === discussion.authorProfileId)),
			canDelete: writable && manager,
			writable,
		};
	},
});

// Replies in conversation order. The initial comment is served by `detail`.
export const replies = query({
	args: { discussionId: v.id('discussions'), paginationOpts: paginationOptsValidator },
	returns: paginationResultValidator(commentValidator),
	handler: async (ctx, args) => {
		const access = await readableDiscussion(
			ctx,
			await ctx.db.get('discussions', args.discussionId)
		);
		if (!access) return { page: [], isDone: true, continueCursor: '' };
		const user = await getCurrentUser(ctx);
		const result = await ctx.db
			.query('discussionComments')
			.withIndex('by_discussionId_and_initial', (q) =>
				q.eq('discussionId', args.discussionId).eq('initial', false)
			)
			.order('asc')
			.paginate(args.paginationOpts);
		return {
			...result,
			page: await Promise.all(
				result.page.map((comment) => enrichComment(ctx, comment, user?.profileId ?? null, access))
			),
		};
	},
});

export const create = mutation({
	args: { projectId: v.id('projects'), title: v.string(), body: v.string() },
	returns: v.object({ id: v.id('discussions'), slug: v.string() }),
	handler: async (ctx, args) => {
		const profileId = await actor(ctx);
		const access = await requireProjectAccess(ctx, args.projectId);
		assertProjectWritable(access);
		if (!canStartDiscussion(access)) throw new ConvexError('DISCUSSIONS_TEAM_ONLY');
		const title = validateTitle(args.title);
		const body = validateContent(args.body);
		const slug = await uniqueSlug(ctx, args.projectId);
		const now = Date.now();
		const id = await ctx.db.insert('discussions', {
			projectId: args.projectId,
			authorProfileId: profileId,
			slug,
			title,
			searchContent: searchContent(title, body),
			commentCount: 0,
			lastActivityAt: now,
		});
		const firstCommentId = await ctx.db.insert('discussionComments', {
			discussionId: id,
			authorProfileId: profileId,
			content: body,
			initial: true,
		});
		await ctx.db.patch('discussions', id, { firstCommentId });
		return { id, slug };
	},
});

export const updateTitle = mutation({
	args: { discussionId: v.id('discussions'), title: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const { access, discussion, profileId } = await writableDiscussion(ctx, args.discussionId);
		if (discussion.authorProfileId !== profileId && !access.permissions.canManageContent)
			throw new ConvexError('FORBIDDEN');
		const title = validateTitle(args.title);
		if (title === discussion.title) return null;
		const first = discussion.firstCommentId
			? await ctx.db.get('discussionComments', discussion.firstCommentId)
			: null;
		await ctx.db.patch('discussions', discussion._id, {
			title,
			searchContent: searchContent(title, first?.content ?? ''),
		});
		return null;
	},
});

export const addComment = mutation({
	args: { discussionId: v.id('discussions'), content: v.string() },
	returns: v.id('discussionComments'),
	handler: async (ctx, args) => {
		const { discussion, profileId } = await writableDiscussion(ctx, args.discussionId);
		const id = await ctx.db.insert('discussionComments', {
			discussionId: discussion._id,
			authorProfileId: profileId,
			content: validateContent(args.content),
			initial: false,
		});
		await ctx.db.patch('discussions', discussion._id, {
			commentCount: discussion.commentCount + 1,
			lastActivityAt: Date.now(),
		});
		return id;
	},
});

export const updateComment = mutation({
	args: { commentId: v.id('discussionComments'), content: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const comment = await ctx.db.get('discussionComments', args.commentId);
		if (!comment) throw new ConvexError('COMMENT_NOT_FOUND');
		const { discussion, profileId } = await writableDiscussion(ctx, comment.discussionId);
		if (comment.authorProfileId !== profileId) throw new ConvexError('FORBIDDEN');
		const content = validateContent(args.content);
		await ctx.db.patch('discussionComments', comment._id, { content, updatedAt: Date.now() });
		if (comment.initial)
			await ctx.db.patch('discussions', discussion._id, {
				searchContent: searchContent(discussion.title, content),
			});
		return null;
	},
});

export const removeComment = mutation({
	args: { commentId: v.id('discussionComments') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const comment = await ctx.db.get('discussionComments', args.commentId);
		if (!comment) throw new ConvexError('COMMENT_NOT_FOUND');
		const { access, discussion, profileId } = await writableDiscussion(ctx, comment.discussionId);
		if (comment.initial) throw new ConvexError('INITIAL_COMMENT_REQUIRED');
		if (comment.authorProfileId !== profileId && !access.permissions.canManageContent)
			throw new ConvexError('FORBIDDEN');
		await ctx.db.delete('discussionComments', comment._id);
		await ctx.db.patch('discussions', discussion._id, {
			commentCount: Math.max(0, discussion.commentCount - 1),
		});
		await ctx.scheduler.runAfter(0, internal.discussions.cleanComment, { commentId: comment._id });
		return null;
	},
});

export const cleanComment = internalMutation({
	args: { commentId: v.id('discussionComments') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const emotes = await ctx.db
			.query('discussionCommentEmotes')
			.withIndex('by_commentId_and_authorProfileId_and_content', (q) =>
				q.eq('commentId', args.commentId)
			)
			.take(DELETE_BATCH_SIZE);
		for (const emote of emotes) await ctx.db.delete('discussionCommentEmotes', emote._id);
		if (emotes.length === DELETE_BATCH_SIZE)
			await ctx.scheduler.runAfter(0, internal.discussions.cleanComment, args);
		return null;
	},
});

export const toggleReaction = mutation({
	args: { commentId: v.id('discussionComments'), content: emoteReaction },
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const comment = await ctx.db.get('discussionComments', args.commentId);
		if (!comment) throw new ConvexError('COMMENT_NOT_FOUND');
		const { discussion, profileId } = await writableDiscussion(ctx, comment.discussionId);
		const existing = await ctx.db
			.query('discussionCommentEmotes')
			.withIndex('by_commentId_and_authorProfileId_and_content', (q) =>
				q.eq('commentId', comment._id).eq('authorProfileId', profileId).eq('content', args.content)
			)
			.unique();
		if (existing) {
			await ctx.db.delete('discussionCommentEmotes', existing._id);
			return false;
		}
		await ctx.db.insert('discussionCommentEmotes', {
			discussionId: discussion._id,
			commentId: comment._id,
			authorProfileId: profileId,
			content: args.content,
		});
		return true;
	},
});

export const remove = mutation({
	args: { discussionId: v.id('discussions') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const { access, discussion } = await writableDiscussion(ctx, args.discussionId);
		if (!access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
		await ctx.db.patch('discussions', discussion._id, { deletingAt: Date.now() });
		await ctx.scheduler.runAfter(0, internal.discussions.deleteBatch, { id: discussion._id });
		return null;
	},
});

// Deletes one bounded batch of a discussion's children, then the discussion.
// Returns true while more work remains.
export async function deleteDiscussionBatch(ctx: MutationCtx, id: Id<'discussions'>) {
	const [comments, emotes] = await Promise.all([
		ctx.db
			.query('discussionComments')
			.withIndex('by_discussionId_and_initial', (q) => q.eq('discussionId', id))
			.take(DELETE_BATCH_SIZE),
		ctx.db
			.query('discussionCommentEmotes')
			.withIndex('by_discussionId', (q) => q.eq('discussionId', id))
			.take(DELETE_BATCH_SIZE),
	]);
	for (const row of comments) await ctx.db.delete('discussionComments', row._id);
	for (const row of emotes) await ctx.db.delete('discussionCommentEmotes', row._id);
	if (comments.length === DELETE_BATCH_SIZE || emotes.length === DELETE_BATCH_SIZE) return true;
	await ctx.db.delete('discussions', id);
	return false;
}

export const deleteBatch = internalMutation({
	args: { id: v.id('discussions') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const discussion = await ctx.db.get('discussions', args.id);
		if (!discussion || discussion.deletingAt === undefined) return null;
		if (await deleteDiscussionBatch(ctx, args.id))
			await ctx.scheduler.runAfter(0, internal.discussions.deleteBatch, args);
		return null;
	},
});
