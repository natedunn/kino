import type { Doc, Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';

import { ConvexError, v } from 'convex/values';

import { VALIDATION_LIMITS } from '../shared/validation';
import { query } from './_generated/server';
import { resolveProjectAccess } from './access';
import { searchLiveFeedback } from './feedback';
import { forumEnabled, readableTopic } from './forum';
import { feedbackStatus } from './schema';

// Rows shown per list. Searches read a few extra so the topic itself and
// tombstoned rows can be dropped without coming up short.
const MAX_SUGGESTIONS = 5;
const SEARCH_SCAN = MAX_SUGGESTIONS + 3;
// Convex search caps the terms in one query; long titles keep their first words.
const MAX_SEARCH_TERMS = 16;

const similarTopicValidator = v.object({
	id: v.id('forumTopics'),
	slug: v.string(),
	title: v.string(),
	commentCount: v.number(),
	category: v.union(
		v.null(),
		v.object({
			name: v.string(),
			icon: v.union(v.string(), v.null()),
			format: v.union(v.literal('open'), v.literal('qa')),
		})
	),
});
const similarFeedbackValidator = v.object({
	id: v.id('feedback'),
	slug: v.string(),
	title: v.string(),
	status: feedbackStatus,
});

/**
 * Turns free text into a search query: words only (in any script), capped at
 * the engine's term limit. Empty when nothing searchable is left.
 */
export function searchQuery(text: string) {
	return text
		.split(/[^\p{L}\p{N}]+/u)
		.filter(Boolean)
		.slice(0, MAX_SEARCH_TERMS)
		.join(' ');
}

async function searchTopics(
	ctx: QueryCtx,
	projectId: Id<'projects'>,
	search: string,
	excludeId: Id<'forumTopics'> | null
) {
	const rows = await ctx.db
		.query('forumTopics')
		.withSearchIndex('search_by_searchContent', (q) =>
			q.search('searchContent', search).eq('projectId', projectId)
		)
		.take(SEARCH_SCAN);
	const kept = rows
		.filter((row) => row._id !== excludeId && row.deletingAt === undefined)
		.slice(0, MAX_SUGGESTIONS);
	const categories = new Map<Id<'forumCategories'>, Promise<Doc<'forumCategories'> | null>>();
	return Promise.all(
		kept.map(async (row) => {
			let category: Doc<'forumCategories'> | null = null;
			if (row.categoryId) {
				if (!categories.has(row.categoryId))
					categories.set(row.categoryId, ctx.db.get('forumCategories', row.categoryId));
				category = (await categories.get(row.categoryId)) ?? null;
			}
			return {
				id: row._id,
				slug: row.slug,
				title: row.title,
				commentCount: row.commentCount,
				category:
					category && category.deletingAt === undefined
						? { name: category.name, icon: category.icon ?? null, format: category.format }
						: null,
			};
		})
	);
}

// Other topics in the same project that read like this one, for the topic
// page's sidebar. Visible to anyone who can read the topic, signed in or not.
export const similarTopics = query({
	args: { topicId: v.id('forumTopics') },
	returns: v.array(similarTopicValidator),
	handler: async (ctx, args) => {
		const topic = await ctx.db.get('forumTopics', args.topicId);
		const access = await readableTopic(ctx, topic);
		if (!topic || !access) return [];
		const search = searchQuery(topic.title.slice(0, VALIDATION_LIMITS.forumSearch));
		if (!search) return [];
		return searchTopics(ctx, topic.projectId, search, topic._id);
	},
});

// Existing topics and feedback matching a title while a topic is being
// written, so people can find answers or join an existing request.
export const suggestions = query({
	args: { projectId: v.id('projects'), title: v.string() },
	returns: v.object({
		topics: v.array(similarTopicValidator),
		feedback: v.array(similarFeedbackValidator),
	}),
	handler: async (ctx, args) => {
		const empty = { topics: [], feedback: [] };
		const title = args.title.trim();
		if (title.length > VALIDATION_LIMITS.forumSearch) throw new ConvexError('INVALID_SEARCH');
		const access = await resolveProjectAccess(ctx, args.projectId);
		if (!access.project || !forumEnabled(access.project)) return empty;
		const search = searchQuery(title);
		if (!search) return empty;
		const [topics, feedback] = await Promise.all([
			searchTopics(ctx, args.projectId, search, null),
			searchLiveFeedback(ctx, args.projectId, search, SEARCH_SCAN),
		]);
		return {
			topics,
			feedback: feedback
				// Feedback moved into the forum lives on as a topic, listed above.
				.filter((item) => item.movedToTopicId === undefined)
				.slice(0, MAX_SUGGESTIONS)
				.map((item) => ({
					id: item._id,
					slug: item.slug,
					title: item.title,
					status: item.status,
				})),
		};
	},
});
