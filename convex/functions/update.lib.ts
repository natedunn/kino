import type { Doc } from './_generated/dataModel';

import { z } from 'zod';

import { asId, getDoc, isProjectEditorRole, toPublicDoc } from '../lib/kino';
import { resolveProfileImageUrl } from '../lib/storage';

export const updateCategorySchema = z.enum(['changelog', 'article', 'announcement']);
export const UPDATE_LIST_PREVIEW_CHARS = 420;
export const CRITICAL_COMMENT_HEAD_COUNT = 5;
export const CRITICAL_COMMENT_TAIL_COUNT = 10;
export const MIDDLE_COMMENT_PAGE_SIZE = 20;

export async function toProfileSummary(profile: Doc<'profile'> | null) {
	return profile
		? {
				id: profile._id,
				imageUrl: await resolveProfileImageUrl(profile),
				name: profile.name,
				username: profile.username,
			}
		: null;
}

export function dedupeComments<T extends { id: string }>(comments: Array<T>) {
	const seen = new Set<string>();
	return comments.filter((comment) => {
		if (seen.has(comment.id)) return false;
		seen.add(comment.id);
		return true;
	});
}

export function dedupeDocsById<T extends { _id: string }>(docs: Array<T>) {
	const seen = new Set<string>();
	return docs.filter((doc) => {
		if (seen.has(doc._id)) return false;
		seen.add(doc._id);
		return true;
	});
}

// Request-scoped memoization so a comment window (head + tail, or a paged batch)
// doesn't re-run the same author/projectMember lookups once per comment. Promises
// are cached so concurrent enrichment of comments by the same author dedupes too.
export type CommentEnrichCache = {
	author: Map<string, Promise<Doc<'profile'> | null>>;
	teamMember: Map<string, Promise<boolean>>;
};

export function createCommentEnrichCache(): CommentEnrichCache {
	return { author: new Map(), teamMember: new Map() };
}

export function getCachedAuthor(ctx: any, authorProfileId: any, cache: CommentEnrichCache) {
	const key = String(authorProfileId);
	let cached = cache.author.get(key);
	if (!cached) {
		cached = getDoc<'profile'>(ctx, authorProfileId);
		cache.author.set(key, cached);
	}
	return cached;
}

export function getCachedIsTeamMember(
	ctx: any,
	author: Doc<'profile'> | null,
	projectId: string,
	cache: CommentEnrichCache
) {
	if (!author) return Promise.resolve(false);
	const key = String(author._id);
	let cached = cache.teamMember.get(key);
	if (!cached) {
		cached = (async () => {
			const projectMember = await ctx.db
				.query('projectMember')
				.withIndex('by_profileId_projectId', (q: any) =>
					q.eq('profileId', author._id).eq('projectId', asId<'project'>(projectId))
				)
				.first();
			return !!projectMember && isProjectEditorRole(projectMember.role);
		})();
		cache.teamMember.set(key, cached);
	}
	return cached;
}

export async function toPublicUpdateComment(
	ctx: any,
	comment: Doc<'updateComment'>,
	projectId: string,
	currentProfile?: Doc<'profile'> | null,
	cache: CommentEnrichCache = createCommentEnrichCache()
) {
	const author = await getCachedAuthor(ctx, comment.authorProfileId, cache);
	const isTeamMember = await getCachedIsTeamMember(ctx, author, projectId, cache);

	const emotes = await ctx.db
		.query('updateCommentEmote')
		.withIndex('by_updateCommentId', (q: any) => q.eq('updateCommentId', comment._id))
		.collect();
	const emoteCounts: Record<string, { authorProfileIds: Array<string>; count: number }> = {};
	for (const emote of emotes) {
		if (!Object.hasOwn(emoteCounts, emote.content)) {
			emoteCounts[emote.content] = { authorProfileIds: [], count: 0 };
		}
		emoteCounts[emote.content].count++;
		emoteCounts[emote.content].authorProfileIds.push(emote.authorProfileId);
	}

	return {
		...toPublicDoc(comment),
		author: await toProfileSummary(author),
		canDelete: !!currentProfile && comment.authorProfileId === currentProfile._id,
		canEdit: !!currentProfile && comment.authorProfileId === currentProfile._id,
		content: comment.content,
		emoteCounts,
		isTeamMember,
		updatedTime: comment.updatedTime,
	};
}

export async function getUpdateCommentWindow(ctx: any, args: { updateId: string }) {
	const updateId = asId<'update'>(args.updateId);
	const headPage = await ctx.db
		.query('updateComment')
		.withIndex('by_updateId', (q: any) => q.eq('updateId', updateId))
		.order('asc')
		.paginate({ cursor: null, numItems: CRITICAL_COMMENT_HEAD_COUNT });
	const tailDocs = await ctx.db
		.query('updateComment')
		.withIndex('by_updateId', (q: any) => q.eq('updateId', updateId))
		.order('desc')
		.take(CRITICAL_COMMENT_TAIL_COUNT);
	const tailIds = new Set(tailDocs.map((comment: Doc<'updateComment'>) => comment._id));

	let middleCursor: string | null = null;
	if (!headPage.isDone) {
		// Probe the first comment after the head to decide whether a middle gap
		// exists. This must use `.take()`, not a second `.paginate()` — Convex
		// allows only one paginated query per function, and the head page above is
		// it. (A second `.paginate()` here throws once a thread exceeds the head
		// count.)
		const headPlusOne = await ctx.db
			.query('updateComment')
			.withIndex('by_updateId', (q: any) => q.eq('updateId', updateId))
			.order('asc')
			.take(CRITICAL_COMMENT_HEAD_COUNT + 1);
		const probeComment = headPlusOne[CRITICAL_COMMENT_HEAD_COUNT];
		if (probeComment && !tailIds.has(probeComment._id)) {
			middleCursor = headPage.continueCursor;
		}
	}

	return {
		head: headPage.page,
		middleCursor,
		tail: tailDocs.reverse(),
		tailCommentIds: Array.from(tailIds),
	};
}

export function decodeBasicHtmlEntities(value: string) {
	const namedEntities: Record<string, string> = {
		amp: '&',
		apos: "'",
		gt: '>',
		lt: '<',
		nbsp: ' ',
		quot: '"',
	};

	return value.replace(/&(#(\d+)|#x([\da-f]+)|[a-z]+);/gi, (match, entity, decimal, hex) => {
		const codePoint = decimal ? Number(decimal) : hex ? Number.parseInt(hex, 16) : null;

		if (codePoint !== null) {
			return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
				? String.fromCodePoint(codePoint)
				: match;
		}

		return namedEntities[String(entity).toLowerCase()] ?? match;
	});
}

export function getUpdateListPreview(content: string) {
	const plainText = decodeBasicHtmlEntities(
		content
			.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
			.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
			.replace(/<[^>]*>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
	);
	const isTruncated = plainText.length > UPDATE_LIST_PREVIEW_CHARS;
	return isTruncated ? `${plainText.slice(0, UPDATE_LIST_PREVIEW_CHARS).trimEnd()}...` : plainText;
}
