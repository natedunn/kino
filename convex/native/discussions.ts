import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

import { RateLimiter } from '@convex-dev/rate-limiter';
import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';

import { isRichTextHtml, sanitizeStoredContent } from '../shared/rich-text';
import { decodeBasicHtmlEntities, getUpdateListPreviewData } from '../shared/update-content';
import { VALIDATION_LIMITS } from '../shared/validation';
import { components, internal } from './_generated/api';
import { internalMutation, mutation, query } from './_generated/server';
import { assertProjectWritable, requireProjectAccess, resolveProjectAccess } from './access';
import { categoryView, liveCategories, toCategoryView } from './discussionCategories';
import { insertFeedback, recordEvent as recordFeedbackEvent } from './feedback';
import { isFeedbackLive } from './feedbackLifecycle';
import { getCurrentUser, requireCurrentUser } from './identity';
import { discussionEventType, emoteReaction, feedbackStatus } from './schema';
import { profileValidator, summary } from './updates';

// Hard cap on stored HTML; visible-text limits are checked separately in validateContent.
const MAX_CONTENT = 50_000;
const MAX_COMMENT_EMOTES = 100;
const EXCERPT_CHARS = 300;
const DELETE_BATCH_SIZE = 100;
const MAX_PINNED = 4;
const MAX_LINKS = 20;
const MAX_PARTICIPANTS = 12;
// Comments scanned for the participant list; long threads show a lower bound.
const PARTICIPANT_SCAN = 200;
const LINK_CANDIDATES = 8;
// Events returned with a discussion; older ones are dropped from the thread.
const MAX_EVENTS = 100;

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
const categorySummaryValidator = v.union(
	v.null(),
	v.object({
		id: v.id('discussionCategories'),
		name: v.string(),
		slug: v.string(),
		icon: v.union(v.string(), v.null()),
		format: v.union(v.literal('open'), v.literal('qa')),
	})
);
const listItemValidator = v.object({
	id: v.id('discussions'),
	slug: v.string(),
	title: v.string(),
	excerpt: v.string(),
	author: profileValidator,
	category: categorySummaryValidator,
	commentCount: v.number(),
	createdAt: v.number(),
	lastActivityAt: v.number(),
	pinned: v.boolean(),
	locked: v.boolean(),
	answered: v.boolean(),
});
const linkValidator = v.union(
	v.object({
		id: v.id('discussionLinks'),
		kind: v.literal('feedback'),
		targetId: v.id('feedback'),
		slug: v.string(),
		title: v.string(),
		status: feedbackStatus,
	}),
	v.object({
		id: v.id('discussionLinks'),
		kind: v.literal('update'),
		targetId: v.id('updates'),
		slug: v.string(),
		title: v.string(),
	})
);
const feedbackSummaryValidator = v.object({
	slug: v.string(),
	title: v.string(),
	status: feedbackStatus,
});
const eventValidator = v.object({
	id: v.id('discussionEvents'),
	createdAt: v.number(),
	actor: profileValidator,
	eventType: discussionEventType,
	oldValue: v.union(v.string(), v.null()),
	newValue: v.union(v.string(), v.null()),
	feedback: v.union(feedbackSummaryValidator, v.null()),
});
const sortValidator = v.union(v.literal('activity'), v.literal('newest'), v.literal('replies'));
const filterValidator = v.union(v.literal('unanswered'), v.literal('mine'), v.literal('following'));

type Access = Awaited<ReturnType<typeof resolveProjectAccess>>;

export function discussionsEnabled(project: Doc<'projects'>) {
	return project.discussionsEnabled !== false;
}

function canPostIn(access: Access, category: Doc<'discussionCategories'>) {
	if (!access.project || access.isArchived || !discussionsEnabled(access.project)) return false;
	return category.postingPolicy === 'everyone' || access.permissions.canManageContent;
}

function isManager(access: Access) {
	return access.permissions.canManageContent;
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
	return access.project && discussionsEnabled(access.project) ? access : null;
}

async function writableDiscussion(ctx: MutationCtx, discussionId: Id<'discussions'>) {
	const profileId = await actor(ctx);
	const discussion = await ctx.db.get('discussions', discussionId);
	const access = await readableDiscussion(ctx, discussion);
	if (!discussion || !access) throw new ConvexError('DISCUSSION_NOT_FOUND');
	assertProjectWritable(access);
	return { access, discussion, profileId };
}

async function liveCategory(
	ctx: QueryCtx,
	projectId: Id<'projects'>,
	categoryId: Id<'discussionCategories'>
) {
	const category = await ctx.db.get('discussionCategories', categoryId);
	if (!category || category.projectId !== projectId || category.deletingAt !== undefined)
		throw new ConvexError('INVALID_CATEGORY');
	return category;
}

async function follow(ctx: MutationCtx, discussion: Doc<'discussions'>, profileId: Id<'profiles'>) {
	const existing = await ctx.db
		.query('discussionWatchers')
		.withIndex('by_discussionId_and_profileId', (q) =>
			q.eq('discussionId', discussion._id).eq('profileId', profileId)
		)
		.unique();
	if (!existing)
		await ctx.db.insert('discussionWatchers', {
			projectId: discussion.projectId,
			discussionId: discussion._id,
			profileId,
		});
}

async function recordEvent(
	ctx: MutationCtx,
	discussionId: Id<'discussions'>,
	actorProfileId: Id<'profiles'>,
	eventType: Doc<'discussionEvents'>['eventType'],
	metadata?: Doc<'discussionEvents'>['metadata']
) {
	await ctx.db.insert('discussionEvents', {
		discussionId,
		actorProfileId,
		eventType,
		...(metadata ? { metadata } : {}),
	});
}

async function liveFeedbackSummary(ctx: QueryCtx, feedbackId: Id<'feedback'> | undefined) {
	if (!feedbackId) return null;
	const feedback = await ctx.db.get('feedback', feedbackId);
	if (!feedback || !(await isFeedbackLive(ctx, feedback))) return null;
	return { slug: feedback.slug, title: feedback.title, status: feedback.status };
}

async function events(ctx: QueryCtx, discussionId: Id<'discussions'>) {
	const rows = await ctx.db
		.query('discussionEvents')
		.withIndex('by_discussionId', (q) => q.eq('discussionId', discussionId))
		.order('desc')
		.take(MAX_EVENTS);
	return Promise.all(
		rows.reverse().map(async (row) => ({
			id: row._id,
			createdAt: row._creationTime,
			actor: summary(await ctx.db.get('profiles', row.actorProfileId)),
			eventType: row.eventType,
			oldValue: row.metadata?.oldValue ?? null,
			newValue: row.metadata?.newValue ?? null,
			feedback: await liveFeedbackSummary(ctx, row.metadata?.feedbackId),
		}))
	);
}

async function isFollowing(
	ctx: QueryCtx,
	discussionId: Id<'discussions'>,
	profileId: Id<'profiles'> | null
) {
	if (!profileId) return false;
	return !!(await ctx.db
		.query('discussionWatchers')
		.withIndex('by_discussionId_and_profileId', (q) =>
			q.eq('discussionId', discussionId).eq('profileId', profileId)
		)
		.unique());
}

function validateTitle(value: string) {
	const title = value.trim();
	if (!title || title.length > VALIDATION_LIMITS.discussionTitle)
		throw new ConvexError('INVALID_TITLE');
	return title;
}

// Text the reader sees. Tags are dropped without inserting separators so the
// count never exceeds the editor's `getText()` length the client checks against.
function visibleText(content: string) {
	return isRichTextHtml(content)
		? decodeBasicHtmlEntities(content.replace(/<[^>]*>/g, ''))
		: content;
}

// Every stored body and reply passes through here, so editor HTML is
// allowlist-sanitized before the empty and length checks run on the result.
// `maxVisible` mirrors the client limit: discussionBody for the opening post,
// comment for replies.
function validateContent(value: string, maxVisible: number) {
	const content = sanitizeStoredContent(value);
	const text = visibleText(content);
	if (!content || content.length > MAX_CONTENT || !text.trim() || text.length > maxVisible)
		throw new ConvexError('INVALID_COMMENT');
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
	// The sample above is capped and ordered by author, so a capped sample may
	// miss the viewer's own reactions; merge them in so the toggle state is right.
	// Counts past the cap are a lower bound.
	if (viewerProfileId && emotes.length === MAX_COMMENT_EMOTES) {
		const own = await ctx.db
			.query('discussionCommentEmotes')
			.withIndex('by_commentId_and_authorProfileId_and_content', (q) =>
				q.eq('commentId', comment._id).eq('authorProfileId', viewerProfileId)
			)
			.take(MAX_COMMENT_EMOTES);
		const seen = new Set(emotes.map((emote) => emote._id));
		emotes.push(...own.filter((emote) => !seen.has(emote._id)));
	}
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
			enabled: v.boolean(),
			canCreate: v.boolean(),
			canManage: v.boolean(),
			writable: v.boolean(),
			signedIn: v.boolean(),
			categories: v.array(v.object({ ...categoryView.fields, canPost: v.boolean() })),
		})
	),
	handler: async (ctx, { projectId }) => {
		const access = await resolveProjectAccess(ctx, projectId);
		if (!access.project) return null;
		const user = await getCurrentUser(ctx);
		const categories = (await liveCategories(ctx, projectId)).map((category) => ({
			...toCategoryView(category),
			canPost: canPostIn(access, category),
		}));
		return {
			enabled: discussionsEnabled(access.project),
			// Signed-out visitors see the button so it can route them through sign-in.
			canCreate: categories.some((category) => category.canPost) && (!user || !!user.profileId),
			canManage: isManager(access),
			writable: !access.isArchived,
			signedIn: !!user?.profileId,
			categories,
		};
	},
});

type ListItemSource = Doc<'discussions'>;

async function toListItems(ctx: QueryCtx, items: Array<ListItemSource>) {
	const categories = new Map<Id<'discussionCategories'>, Doc<'discussionCategories'> | null>();
	return Promise.all(
		items
			.filter((item) => item.deletingAt === undefined)
			.map(async (item) => {
				let category: Doc<'discussionCategories'> | null = null;
				if (item.categoryId) {
					if (!categories.has(item.categoryId))
						categories.set(
							item.categoryId,
							await ctx.db.get('discussionCategories', item.categoryId)
						);
					category = categories.get(item.categoryId) ?? null;
				}
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
					category:
						category && category.deletingAt === undefined
							? {
									id: category._id,
									name: category.name,
									slug: category.slug,
									icon: category.icon ?? null,
									format: category.format,
								}
							: null,
					commentCount: item.commentCount,
					createdAt: item._creationTime,
					lastActivityAt: item.lastActivityAt,
					pinned: item.pinnedAt !== undefined,
					locked: item.lockedAt !== undefined,
					answered: item.answerCommentId !== undefined,
				};
			})
	);
}

export const list = query({
	args: {
		projectId: v.id('projects'),
		categoryId: v.optional(v.id('discussionCategories')),
		search: v.optional(v.string()),
		sort: v.optional(sortValidator),
		filter: v.optional(filterValidator),
		paginationOpts: paginationOptsValidator,
	},
	returns: paginationResultValidator(listItemValidator),
	handler: async (ctx, args) => {
		const empty = { page: [], isDone: true, continueCursor: '' };
		const access = await resolveProjectAccess(ctx, args.projectId);
		if (!access.project || !discussionsEnabled(access.project)) return empty;
		const search = args.search?.trim();
		if (search && search.length > VALIDATION_LIMITS.discussionSearch)
			throw new ConvexError('INVALID_SEARCH');
		const categoryId = args.categoryId;
		if (categoryId) await liveCategory(ctx, args.projectId, categoryId);
		const viewer =
			args.filter === 'mine' || args.filter === 'following'
				? ((await getCurrentUser(ctx))?.profileId ?? null)
				: null;
		if ((args.filter === 'mine' || args.filter === 'following') && !viewer) return empty;
		const sort = args.sort ?? 'activity';

		if (search) {
			const result = await ctx.db
				.query('discussions')
				.withSearchIndex('search_by_searchContent', (q) => {
					const scoped = q.search('searchContent', search).eq('projectId', args.projectId);
					return categoryId ? scoped.eq('categoryId', categoryId) : scoped;
				})
				.paginate(args.paginationOpts);
			// Search pages are relevance-ordered; filters narrow each page.
			const kept = [];
			for (const item of result.page) {
				if (args.filter === 'unanswered' && item.answerCommentId !== undefined) continue;
				if (args.filter === 'mine' && item.authorProfileId !== viewer) continue;
				if (args.filter === 'following' && !(await isFollowing(ctx, item._id, viewer))) continue;
				kept.push(item);
			}
			return { ...result, page: await toListItems(ctx, kept) };
		}

		if (args.filter === 'following' && viewer) {
			const result = await ctx.db
				.query('discussionWatchers')
				.withIndex('by_profileId_and_projectId', (q) =>
					q.eq('profileId', viewer).eq('projectId', args.projectId)
				)
				.order('desc')
				.paginate(args.paginationOpts);
			const discussions = await Promise.all(
				result.page.map((row) => ctx.db.get('discussions', row.discussionId))
			);
			return {
				...result,
				page: await toListItems(
					ctx,
					discussions.filter(
						(item): item is Doc<'discussions'> =>
							!!item && (!categoryId || item.categoryId === categoryId)
					)
				),
			};
		}

		const base = ctx.db.query('discussions');
		let query;
		if (args.filter === 'mine' && viewer) {
			query = base
				.withIndex('by_projectId_and_authorProfileId_and_lastActivityAt', (q) =>
					q.eq('projectId', args.projectId).eq('authorProfileId', viewer)
				)
				.order('desc');
			if (categoryId) query = query.filter((q) => q.eq(q.field('categoryId'), categoryId));
		} else if (categoryId) {
			query = (
				sort === 'replies'
					? base.withIndex('by_categoryId_and_commentCount', (q) => q.eq('categoryId', categoryId))
					: sort === 'newest'
						? base.withIndex('by_categoryId', (q) => q.eq('categoryId', categoryId))
						: base.withIndex('by_categoryId_and_lastActivityAt', (q) =>
								q.eq('categoryId', categoryId)
							)
			).order('desc');
		} else {
			query = (
				sort === 'replies'
					? base.withIndex('by_projectId_and_commentCount', (q) =>
							q.eq('projectId', args.projectId)
						)
					: sort === 'newest'
						? base.withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
						: base.withIndex('by_projectId_and_lastActivityAt', (q) =>
								q.eq('projectId', args.projectId)
							)
			).order('desc');
		}
		if (args.filter === 'unanswered')
			query = query.filter((q) => q.eq(q.field('answerCommentId'), undefined));
		const result = await query.paginate(args.paginationOpts);
		return { ...result, page: await toListItems(ctx, result.page) };
	},
});

// Up to MAX_PINNED discussions shown above the list, newest pin first.
export const pinned = query({
	args: { projectId: v.id('projects'), categoryId: v.optional(v.id('discussionCategories')) },
	returns: v.array(listItemValidator),
	handler: async (ctx, args) => {
		const access = await resolveProjectAccess(ctx, args.projectId);
		if (!access.project || !discussionsEnabled(access.project)) return [];
		const rows = await ctx.db
			.query('discussions')
			.withIndex('by_projectId_and_pinnedAt', (q) =>
				q.eq('projectId', args.projectId).gte('pinnedAt', 0)
			)
			.order('desc')
			.take(MAX_PINNED * 2);
		return toListItems(
			ctx,
			rows
				.filter((row) => !args.categoryId || row.categoryId === args.categoryId)
				.slice(0, MAX_PINNED)
		);
	},
});

async function participants(ctx: QueryCtx, discussionId: Id<'discussions'>) {
	const comments = await ctx.db
		.query('discussionComments')
		.withIndex('by_discussionId_and_initial', (q) => q.eq('discussionId', discussionId))
		.take(PARTICIPANT_SCAN);
	const ids = [...new Set(comments.map((comment) => comment.authorProfileId))];
	const profiles = await Promise.all(
		ids.slice(0, MAX_PARTICIPANTS).map((id) => ctx.db.get('profiles', id))
	);
	return {
		profiles: profiles.map(summary).filter((profile) => profile !== null),
		total: ids.length,
	};
}

async function links(ctx: QueryCtx, discussionId: Id<'discussions'>) {
	const rows = await ctx.db
		.query('discussionLinks')
		.withIndex('by_discussionId', (q) => q.eq('discussionId', discussionId))
		.take(MAX_LINKS);
	const resolved = await Promise.all(
		rows.map(async (row) => {
			if (row.feedbackId) {
				const feedback = await ctx.db.get('feedback', row.feedbackId);
				if (!feedback || !(await isFeedbackLive(ctx, feedback))) return null;
				return {
					id: row._id,
					kind: 'feedback' as const,
					targetId: feedback._id,
					slug: feedback.slug,
					title: feedback.title,
					status: feedback.status,
				};
			}
			if (row.updateId) {
				const update = await ctx.db.get('updates', row.updateId);
				if (!update || update.deletingAt !== undefined || update.status !== 'published')
					return null;
				return {
					id: row._id,
					kind: 'update' as const,
					targetId: update._id,
					slug: update.slug,
					title: update.title,
				};
			}
			return null;
		})
	);
	return resolved.filter((link) => link !== null);
}

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
				pinned: v.boolean(),
				locked: v.boolean(),
				answerCommentId: v.union(v.id('discussionComments'), v.null()),
			}),
			category: v.union(categoryView, v.null()),
			author: profileValidator,
			firstComment: v.union(commentValidator, v.null()),
			answer: v.union(commentValidator, v.null()),
			participants: v.object({
				profiles: v.array(profileValidator),
				total: v.number(),
			}),
			links: v.array(linkValidator),
			events: v.array(eventValidator),
			// The feedback this discussion was converted into, while it still exists.
			convertedTo: v.union(feedbackSummaryValidator, v.null()),
			viewerProfileId: v.union(v.id('profiles'), v.null()),
			viewerFollowing: v.boolean(),
			canEditTitle: v.boolean(),
			canDelete: v.boolean(),
			canReply: v.boolean(),
			canMove: v.boolean(),
			canMarkAnswer: v.boolean(),
			canModerate: v.boolean(),
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
		const [author, first, answer, category] = await Promise.all([
			ctx.db.get('profiles', discussion.authorProfileId),
			discussion.firstCommentId
				? ctx.db.get('discussionComments', discussion.firstCommentId)
				: null,
			discussion.answerCommentId
				? ctx.db.get('discussionComments', discussion.answerCommentId)
				: null,
			discussion.categoryId ? ctx.db.get('discussionCategories', discussion.categoryId) : null,
		]);
		const writable = !access.isArchived;
		const manager = isManager(access);
		const isAuthor = !!viewerProfileId && viewerProfileId === discussion.authorProfileId;
		const liveCategoryDoc = category && category.deletingAt === undefined ? category : null;
		const locked = discussion.lockedAt !== undefined;
		return {
			discussion: {
				id: discussion._id,
				slug: discussion.slug,
				title: discussion.title,
				commentCount: discussion.commentCount,
				createdAt: discussion._creationTime,
				lastActivityAt: discussion.lastActivityAt,
				pinned: discussion.pinnedAt !== undefined,
				locked,
				answerCommentId: answer ? answer._id : null,
			},
			category: liveCategoryDoc ? toCategoryView(liveCategoryDoc) : null,
			author: summary(author),
			firstComment: first ? await enrichComment(ctx, first, viewerProfileId, access) : null,
			answer: answer ? await enrichComment(ctx, answer, viewerProfileId, access) : null,
			participants: await participants(ctx, discussion._id),
			links: await links(ctx, discussion._id),
			events: await events(ctx, discussion._id),
			convertedTo: await liveFeedbackSummary(ctx, discussion.convertedFeedbackId),
			viewerProfileId,
			viewerFollowing: await isFollowing(ctx, discussion._id, viewerProfileId),
			canEditTitle: writable && (manager || isAuthor),
			canDelete: writable && manager,
			// Signed-out visitors get the sign-in prompt, so only locking hides the form.
			canReply: writable && (!locked || manager),
			canMove: writable && (manager || isAuthor),
			canMarkAnswer: writable && liveCategoryDoc?.format === 'qa' && (manager || isAuthor),
			canModerate: writable && manager,
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
	args: {
		projectId: v.id('projects'),
		categoryId: v.id('discussionCategories'),
		title: v.string(),
		body: v.string(),
	},
	returns: v.object({ id: v.id('discussions'), slug: v.string() }),
	handler: async (ctx, args) => {
		const profileId = await actor(ctx);
		const access = await requireProjectAccess(ctx, args.projectId);
		assertProjectWritable(access);
		if (!discussionsEnabled(access.project)) throw new ConvexError('DISCUSSIONS_DISABLED');
		const category = await liveCategory(ctx, args.projectId, args.categoryId);
		if (!canPostIn(access, category)) throw new ConvexError('DISCUSSIONS_TEAM_ONLY');
		const title = validateTitle(args.title);
		const body = validateContent(args.body, VALIDATION_LIMITS.discussionBody);
		const slug = await uniqueSlug(ctx, args.projectId);
		const now = Date.now();
		const id = await ctx.db.insert('discussions', {
			projectId: args.projectId,
			categoryId: category._id,
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
		await ctx.db.insert('discussionWatchers', {
			projectId: args.projectId,
			discussionId: id,
			profileId,
		});
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
		await recordEvent(ctx, discussion._id, profileId, 'title_changed', {
			oldValue: discussion.title,
			newValue: title,
		});
		return null;
	},
});

export const addComment = mutation({
	args: { discussionId: v.id('discussions'), content: v.string() },
	returns: v.id('discussionComments'),
	handler: async (ctx, args) => {
		const { access, discussion, profileId } = await writableDiscussion(ctx, args.discussionId);
		if (discussion.lockedAt !== undefined && !isManager(access))
			throw new ConvexError('DISCUSSION_LOCKED');
		const id = await ctx.db.insert('discussionComments', {
			discussionId: discussion._id,
			authorProfileId: profileId,
			content: validateContent(args.content, VALIDATION_LIMITS.comment),
			initial: false,
		});
		await ctx.db.patch('discussions', discussion._id, {
			commentCount: discussion.commentCount + 1,
			lastActivityAt: Date.now(),
		});
		await follow(ctx, discussion, profileId);
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
		const content = validateContent(
			args.content,
			comment.initial ? VALIDATION_LIMITS.discussionBody : VALIDATION_LIMITS.comment
		);
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
		// Activity falls back to the newest remaining reply, or the discussion itself.
		const latest = await ctx.db
			.query('discussionComments')
			.withIndex('by_discussionId_and_initial', (q) =>
				q.eq('discussionId', discussion._id).eq('initial', false)
			)
			.order('desc')
			.first();
		await ctx.db.patch('discussions', discussion._id, {
			commentCount: Math.max(0, discussion.commentCount - 1),
			lastActivityAt: latest?._creationTime ?? discussion._creationTime,
			...(discussion.answerCommentId === comment._id ? { answerCommentId: undefined } : {}),
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

export const setCategory = mutation({
	args: { discussionId: v.id('discussions'), categoryId: v.id('discussionCategories') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const { access, discussion, profileId } = await writableDiscussion(ctx, args.discussionId);
		if (discussion.authorProfileId !== profileId && !isManager(access))
			throw new ConvexError('FORBIDDEN');
		const category = await liveCategory(ctx, discussion.projectId, args.categoryId);
		// Authors can't move their discussion into a team-only category.
		if (!canPostIn(access, category)) throw new ConvexError('DISCUSSIONS_TEAM_ONLY');
		if (category._id === discussion.categoryId) return null;
		const previous = discussion.categoryId
			? await ctx.db.get('discussionCategories', discussion.categoryId)
			: null;
		await ctx.db.patch('discussions', discussion._id, {
			categoryId: category._id,
			// Answers only exist in Q&A categories.
			...(category.format === 'qa' ? {} : { answerCommentId: undefined }),
		});
		await recordEvent(ctx, discussion._id, profileId, 'category_changed', {
			...(previous ? { oldValue: previous.name } : {}),
			newValue: category.name,
		});
		return null;
	},
});

export const setAnswer = mutation({
	args: {
		discussionId: v.id('discussions'),
		commentId: v.union(v.id('discussionComments'), v.null()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const { access, discussion, profileId } = await writableDiscussion(ctx, args.discussionId);
		if (discussion.authorProfileId !== profileId && !isManager(access))
			throw new ConvexError('FORBIDDEN');
		const category = discussion.categoryId
			? await ctx.db.get('discussionCategories', discussion.categoryId)
			: null;
		if (!category || category.deletingAt !== undefined || category.format !== 'qa')
			throw new ConvexError('ANSWERS_NOT_ENABLED');
		if (args.commentId) {
			const comment = await ctx.db.get('discussionComments', args.commentId);
			if (!comment || comment.discussionId !== discussion._id || comment.initial)
				throw new ConvexError('COMMENT_NOT_FOUND');
		}
		if ((args.commentId ?? undefined) === discussion.answerCommentId) return null;
		await ctx.db.patch('discussions', discussion._id, {
			answerCommentId: args.commentId ?? undefined,
		});
		await recordEvent(
			ctx,
			discussion._id,
			profileId,
			args.commentId ? 'answer_marked' : 'answer_unmarked'
		);
		return null;
	},
});

export const setPinned = mutation({
	args: { discussionId: v.id('discussions'), pinned: v.boolean() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const { access, discussion, profileId } = await writableDiscussion(ctx, args.discussionId);
		if (!isManager(access)) throw new ConvexError('FORBIDDEN');
		if (args.pinned === (discussion.pinnedAt !== undefined)) return null;
		if (args.pinned) {
			const pinnedNow = await ctx.db
				.query('discussions')
				.withIndex('by_projectId_and_pinnedAt', (q) =>
					q.eq('projectId', discussion.projectId).gte('pinnedAt', 0)
				)
				.take(MAX_PINNED + 1);
			if (pinnedNow.filter((row) => row.deletingAt === undefined).length >= MAX_PINNED)
				throw new ConvexError('PIN_LIMIT');
		}
		await ctx.db.patch('discussions', discussion._id, {
			pinnedAt: args.pinned ? Date.now() : undefined,
		});
		await recordEvent(ctx, discussion._id, profileId, args.pinned ? 'pinned' : 'unpinned');
		return null;
	},
});

export const setLocked = mutation({
	args: { discussionId: v.id('discussions'), locked: v.boolean() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const { access, discussion, profileId } = await writableDiscussion(ctx, args.discussionId);
		if (!isManager(access)) throw new ConvexError('FORBIDDEN');
		if (args.locked === (discussion.lockedAt !== undefined)) return null;
		await ctx.db.patch('discussions', discussion._id, {
			lockedAt: args.locked ? Date.now() : undefined,
		});
		await recordEvent(ctx, discussion._id, profileId, args.locked ? 'locked' : 'unlocked');
		return null;
	},
});

export const toggleFollow = mutation({
	args: { discussionId: v.id('discussions') },
	returns: v.object({ following: v.boolean() }),
	handler: async (ctx, args) => {
		const { discussion, profileId } = await writableDiscussion(ctx, args.discussionId);
		const existing = await ctx.db
			.query('discussionWatchers')
			.withIndex('by_discussionId_and_profileId', (q) =>
				q.eq('discussionId', discussion._id).eq('profileId', profileId)
			)
			.unique();
		if (existing) {
			await ctx.db.delete('discussionWatchers', existing._id);
			return { following: false };
		}
		await follow(ctx, discussion, profileId);
		return { following: true };
	},
});

async function addLinkRow(
	ctx: MutationCtx,
	discussion: Doc<'discussions'>,
	profileId: Id<'profiles'>,
	target: { feedbackId: Id<'feedback'> } | { updateId: Id<'updates'> }
) {
	const existing = await ctx.db
		.query('discussionLinks')
		.withIndex('by_discussionId', (q) => q.eq('discussionId', discussion._id))
		.take(MAX_LINKS);
	if (
		existing.some((row) =>
			'feedbackId' in target
				? row.feedbackId === target.feedbackId
				: row.updateId === target.updateId
		)
	)
		return;
	if (existing.length >= MAX_LINKS) throw new ConvexError('LINK_LIMIT');
	await ctx.db.insert('discussionLinks', {
		projectId: discussion.projectId,
		discussionId: discussion._id,
		createdByProfileId: profileId,
		...target,
	});
}

export const addLink = mutation({
	args: {
		discussionId: v.id('discussions'),
		target: v.union(
			v.object({ kind: v.literal('feedback'), id: v.id('feedback') }),
			v.object({ kind: v.literal('update'), id: v.id('updates') })
		),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const { access, discussion, profileId } = await writableDiscussion(ctx, args.discussionId);
		if (!isManager(access)) throw new ConvexError('FORBIDDEN');
		if (args.target.kind === 'feedback') {
			const feedback = await ctx.db.get('feedback', args.target.id);
			if (
				!feedback ||
				feedback.projectId !== discussion.projectId ||
				!(await isFeedbackLive(ctx, feedback))
			)
				throw new ConvexError('INVALID_LINK');
			await addLinkRow(ctx, discussion, profileId, { feedbackId: feedback._id });
		} else {
			const update = await ctx.db.get('updates', args.target.id);
			if (
				!update ||
				update.projectId !== discussion.projectId ||
				update.deletingAt !== undefined ||
				update.status !== 'published'
			)
				throw new ConvexError('INVALID_LINK');
			await addLinkRow(ctx, discussion, profileId, { updateId: update._id });
		}
		return null;
	},
});

export const removeLink = mutation({
	args: { linkId: v.id('discussionLinks') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const link = await ctx.db.get('discussionLinks', args.linkId);
		if (!link) return null;
		const { access } = await writableDiscussion(ctx, link.discussionId);
		if (!isManager(access)) throw new ConvexError('FORBIDDEN');
		await ctx.db.delete('discussionLinks', link._id);
		return null;
	},
});

// Feedback and published updates a moderator can link, matched by title/content.
export const linkCandidates = query({
	args: { discussionId: v.id('discussions'), search: v.string() },
	returns: v.array(
		v.union(
			v.object({
				kind: v.literal('feedback'),
				id: v.id('feedback'),
				title: v.string(),
				status: feedbackStatus,
			}),
			v.object({ kind: v.literal('update'), id: v.id('updates'), title: v.string() })
		)
	),
	handler: async (ctx, args) => {
		const discussion = await ctx.db.get('discussions', args.discussionId);
		const access = await readableDiscussion(ctx, discussion);
		if (!discussion || !access || !isManager(access)) return [];
		const search = args.search.trim().slice(0, VALIDATION_LIMITS.discussionSearch);
		if (!search) return [];
		const [feedback, updates] = await Promise.all([
			ctx.db
				.query('feedback')
				.withSearchIndex('search_by_searchContent', (q) =>
					q.search('searchContent', search).eq('projectId', discussion.projectId)
				)
				.take(LINK_CANDIDATES),
			ctx.db
				.query('updates')
				.withSearchIndex('search_by_searchContent', (q) =>
					q
						.search('searchContent', search)
						.eq('projectId', discussion.projectId)
						.eq('status', 'published')
				)
				.take(LINK_CANDIDATES),
		]);
		return [
			...feedback
				.filter((item) => item.deletingAt === undefined)
				.map((item) => ({
					kind: 'feedback' as const,
					id: item._id,
					title: item.title,
					status: item.status,
				})),
			...updates
				.filter((item) => item.deletingAt === undefined)
				.map((item) => ({ kind: 'update' as const, id: item._id, title: item.title })),
		];
	},
});

// Turns a discussion into actionable feedback: the feedback copies the title
// and opening post (credited to the original author), both are linked, and the
// discussion is locked so the conversation continues on the feedback item.
export const convertToFeedback = mutation({
	args: { discussionId: v.id('discussions'), boardId: v.id('feedbackBoards') },
	returns: v.object({ feedbackSlug: v.string() }),
	handler: async (ctx, args) => {
		const { access, discussion, profileId } = await writableDiscussion(ctx, args.discussionId);
		if (!isManager(access)) throw new ConvexError('FORBIDDEN');
		const first = discussion.firstCommentId
			? await ctx.db.get('discussionComments', discussion.firstCommentId)
			: null;
		if (!first) throw new ConvexError('COMMENT_NOT_FOUND');
		const created = await insertFeedback(ctx, {
			projectId: discussion.projectId,
			boardId: args.boardId,
			authorProfileId: discussion.authorProfileId,
			title: discussion.title.slice(0, 100),
			firstComment: first.content,
		});
		await addLinkRow(ctx, discussion, profileId, { feedbackId: created.feedbackId });
		await ctx.db.patch('discussions', discussion._id, {
			lockedAt: discussion.lockedAt ?? Date.now(),
			convertedFeedbackId: created.feedbackId,
		});
		await recordEvent(ctx, discussion._id, profileId, 'converted_to_feedback', {
			feedbackId: created.feedbackId,
		});
		await recordFeedbackEvent(ctx, {
			actorProfileId: profileId,
			feedbackId: created.feedbackId,
			eventType: 'imported_from_discussion',
			metadata: { discussionId: discussion._id, newValue: discussion.title },
		});
		return { feedbackSlug: created.slug };
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
	const [comments, emotes, watchers, links, discussionEvents] = await Promise.all([
		ctx.db
			.query('discussionComments')
			.withIndex('by_discussionId_and_initial', (q) => q.eq('discussionId', id))
			.take(DELETE_BATCH_SIZE),
		ctx.db
			.query('discussionCommentEmotes')
			.withIndex('by_discussionId', (q) => q.eq('discussionId', id))
			.take(DELETE_BATCH_SIZE),
		ctx.db
			.query('discussionWatchers')
			.withIndex('by_discussionId_and_profileId', (q) => q.eq('discussionId', id))
			.take(DELETE_BATCH_SIZE),
		ctx.db
			.query('discussionLinks')
			.withIndex('by_discussionId', (q) => q.eq('discussionId', id))
			.take(DELETE_BATCH_SIZE),
		ctx.db
			.query('discussionEvents')
			.withIndex('by_discussionId', (q) => q.eq('discussionId', id))
			.take(DELETE_BATCH_SIZE),
	]);
	for (const row of comments) await ctx.db.delete('discussionComments', row._id);
	for (const row of emotes) await ctx.db.delete('discussionCommentEmotes', row._id);
	for (const row of watchers) await ctx.db.delete('discussionWatchers', row._id);
	for (const row of links) await ctx.db.delete('discussionLinks', row._id);
	for (const row of discussionEvents) await ctx.db.delete('discussionEvents', row._id);
	if (
		[comments, emotes, watchers, links, discussionEvents].some(
			(rows) => rows.length === DELETE_BATCH_SIZE
		)
	)
		return true;
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
