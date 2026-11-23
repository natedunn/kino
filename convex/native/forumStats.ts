import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalMutation, query } from './_generated/server';
import { resolveProjectAccess } from './access';
import { categoryView, liveCategories, toCategoryView } from './forumCategories';

// Topic `score` ranks the forum's "Top" view. It measures how much a topic
// engaged people: one point per reply, per reaction on the opening post and
// per poll voter. Reactions on replies don't count; they praise the reply, not
// the topic. Kept in step by `forum.addComment`, `forum.removeComment`,
// `forum.toggleReaction` and `forumPolls.vote`.

// Reactions counted per opening post when backfilling; past it the score is a
// lower bound.
const MAX_SCORED_REACTIONS = 1000;
// Topics skipped (being deleted) before a category's latest topic is found.
const LATEST_SCAN = 10;
const SCORE_BACKFILL_BATCH = 50;
const CATEGORY_BACKFILL_BATCH = 25;
const COUNT_BATCH = 200;

/** A topic's score after `delta`, for patches that change other fields too. */
export function nextScore(topic: Doc<'forumTopics'>, delta: number) {
	return Math.max(0, (topic.score ?? 0) + delta);
}

export async function adjustScore(ctx: MutationCtx, topicId: Id<'forumTopics'>, delta: number) {
	if (delta === 0) return;
	const topic = await ctx.db.get('forumTopics', topicId);
	if (!topic) return;
	await ctx.db.patch('forumTopics', topicId, { score: nextScore(topic, delta) });
}

async function computeScore(ctx: QueryCtx, topic: Doc<'forumTopics'>) {
	const firstCommentId = topic.firstCommentId;
	const [reactions, poll] = await Promise.all([
		firstCommentId
			? ctx.db
					.query('forumCommentEmotes')
					.withIndex('by_commentId_and_authorProfileId_and_content', (q) =>
						q.eq('commentId', firstCommentId)
					)
					.take(MAX_SCORED_REACTIONS)
			: [],
		ctx.db
			.query('forumPolls')
			.withIndex('by_topicId', (q) => q.eq('topicId', topic._id))
			.first(),
	]);
	return topic.commentCount + reactions.length + (poll?.voterCount ?? 0);
}

async function latestTopic(ctx: QueryCtx, categoryId: Id<'forumCategories'>) {
	const rows = await ctx.db
		.query('forumTopics')
		.withIndex('by_categoryId_and_lastActivityAt', (q) => q.eq('categoryId', categoryId))
		.order('desc')
		.take(LATEST_SCAN);
	return rows.find((row) => row.deletingAt === undefined) ?? null;
}

// The forum home: each live category with its topic count and most recently
// active topic, in display order.
export const overview = query({
	args: { projectId: v.id('projects') },
	returns: v.union(
		v.null(),
		v.array(
			v.object({
				...categoryView.fields,
				topicCount: v.number(),
				latest: v.union(
					v.null(),
					v.object({
						id: v.id('forumTopics'),
						slug: v.string(),
						title: v.string(),
						lastActivityAt: v.number(),
					})
				),
			})
		)
	),
	handler: async (ctx, { projectId }) => {
		const access = await resolveProjectAccess(ctx, projectId);
		// Mirrors forum.forumEnabled, which imports this module.
		if (!access.project || access.project.forumEnabled === false) return null;
		const categories = await liveCategories(ctx, projectId);
		return Promise.all(
			categories.map(async (category) => {
				const latest = await latestTopic(ctx, category._id);
				return {
					...toCategoryView(category),
					topicCount: category.topicCount ?? 0,
					latest: latest
						? {
								id: latest._id,
								slug: latest.slug,
								title: latest.title,
								lastActivityAt: latest.lastActivityAt,
							}
						: null,
				};
			})
		);
	},
});

/**
 * Computes `forumTopics.score` and then `forumCategories.topicCount` for data
 * written before they existed. Safe to rerun. Run once per deployment:
 * `npx convex run forumStats:backfill`.
 */
export const backfill = internalMutation({
	args: { cursor: v.optional(v.union(v.string(), v.null())) },
	returns: v.null(),
	handler: async (ctx, args) => {
		const result = await ctx.db
			.query('forumTopics')
			.paginate({ numItems: SCORE_BACKFILL_BATCH, cursor: args.cursor ?? null });
		for (const topic of result.page) {
			if (topic.deletingAt !== undefined) continue;
			const score = await computeScore(ctx, topic);
			if (score !== topic.score) await ctx.db.patch('forumTopics', topic._id, { score });
		}
		if (!result.isDone)
			await ctx.scheduler.runAfter(0, internal.forumStats.backfill, {
				cursor: result.continueCursor,
			});
		else await ctx.scheduler.runAfter(0, internal.forumStats.backfillCategories, {});
		return null;
	},
});

export const backfillCategories = internalMutation({
	args: { cursor: v.optional(v.union(v.string(), v.null())) },
	returns: v.null(),
	handler: async (ctx, args) => {
		const result = await ctx.db
			.query('forumCategories')
			.paginate({ numItems: CATEGORY_BACKFILL_BATCH, cursor: args.cursor ?? null });
		for (const category of result.page) {
			if (category.deletingAt !== undefined) continue;
			await ctx.scheduler.runAfter(0, internal.forumStats.countCategoryTopics, {
				categoryId: category._id,
				count: 0,
			});
		}
		if (!result.isDone)
			await ctx.scheduler.runAfter(0, internal.forumStats.backfillCategories, {
				cursor: result.continueCursor,
			});
		return null;
	},
});

// Counts a category's live topics in batches, then stores the total.
export const countCategoryTopics = internalMutation({
	args: {
		categoryId: v.id('forumCategories'),
		cursor: v.optional(v.union(v.string(), v.null())),
		count: v.number(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const category = await ctx.db.get('forumCategories', args.categoryId);
		if (!category || category.deletingAt !== undefined) return null;
		const result = await ctx.db
			.query('forumTopics')
			.withIndex('by_categoryId', (q) => q.eq('categoryId', args.categoryId))
			.paginate({ numItems: COUNT_BATCH, cursor: args.cursor ?? null });
		const count = args.count + result.page.filter((topic) => topic.deletingAt === undefined).length;
		if (!result.isDone)
			await ctx.scheduler.runAfter(0, internal.forumStats.countCategoryTopics, {
				categoryId: args.categoryId,
				cursor: result.continueCursor,
				count,
			});
		else if (count !== category.topicCount)
			await ctx.db.patch('forumCategories', category._id, { topicCount: count });
		return null;
	},
});
