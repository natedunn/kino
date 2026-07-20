import type { Doc } from './_generated/dataModel';

import { CRPCError } from 'kitcn/server';
import { z } from 'zod';

import {
	asId,
	getCurrentProfileOrThrow,
	getDoc,
	getDocOrThrow,
	isProjectEditorRole,
	toPublicDoc,
	verifyProjectAccess,
} from '../lib/kino';
import { resolveProfileImageUrl } from '../lib/storage';
import { resolveTargetOrNull, targetGranularities } from '../shared/target';

export const feedbackStatusSchema = z.enum([
	'open',
	'in-progress',
	'closed',
	'completed',
	'paused',
]);
export const targetGranularitySchema = z.enum(targetGranularities);
export const CRITICAL_COMMENT_HEAD_COUNT = 5;
export const CRITICAL_COMMENT_TAIL_COUNT = 10;
export const MIDDLE_COMMENT_PAGE_SIZE = 20;

export function hasOverlap(left: Array<string>, right: Array<string>) {
	return left.some((value) => right.includes(value));
}

export function assertCanAdminFeedback(permissions: { canEdit: boolean }) {
	if (!permissions.canEdit) {
		throw new CRPCError({
			code: 'FORBIDDEN',
			message: 'You do not have permission to manage this feedback',
		});
	}
}

export function toPublicFeedbackDoc(feedback: Doc<'feedback'>) {
	return {
		...toPublicDoc(feedback),
		targetRange: resolveTargetOrNull(feedback.target, feedback.targetGranularity),
	};
}

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

export async function toPublicFeedbackComment(
	ctx: any,
	comment: Doc<'feedbackComment'>,
	projectId: string,
	currentProfile?: Doc<'profile'> | null,
	cache: CommentEnrichCache = createCommentEnrichCache()
) {
	const author = await getCachedAuthor(ctx, comment.authorProfileId, cache);
	const isTeamMember = await getCachedIsTeamMember(ctx, author, projectId, cache);

	const emotes = await ctx.db
		.query('feedbackCommentEmote')
		.withIndex('by_feedbackCommentId', (q: any) => q.eq('feedbackCommentId', comment._id))
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
		canDelete:
			!!currentProfile && !comment.initial && comment.authorProfileId === currentProfile._id,
		canEdit: !!currentProfile && comment.authorProfileId === currentProfile._id,
		content: comment.content,
		emoteCounts,
		initial: comment.initial,
		isTeamMember,
		updatedTime: comment.updatedTime,
	};
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

export async function getFeedbackCommentWindow(ctx: any, args: { feedbackId: string }) {
	const feedbackId = asId<'feedback'>(args.feedbackId);
	const headPage = await ctx.db
		.query('feedbackComment')
		.withIndex('by_feedbackId', (q: any) => q.eq('feedbackId', feedbackId))
		.order('asc')
		.paginate({ cursor: null, numItems: CRITICAL_COMMENT_HEAD_COUNT });
	const tailDocs = await ctx.db
		.query('feedbackComment')
		.withIndex('by_feedbackId', (q: any) => q.eq('feedbackId', feedbackId))
		.order('desc')
		.take(CRITICAL_COMMENT_TAIL_COUNT);
	const tailIds = new Set(tailDocs.map((comment: Doc<'feedbackComment'>) => comment._id));

	let middleCursor: string | null = null;
	if (!headPage.isDone) {
		// Probe the first comment after the head to decide whether a middle gap
		// exists. This must use `.take()`, not a second `.paginate()` — Convex
		// allows only one paginated query per function, and the head page above is
		// it. (A second `.paginate()` here throws once a thread exceeds the head
		// count.)
		const headPlusOne = await ctx.db
			.query('feedbackComment')
			.withIndex('by_feedbackId', (q: any) => q.eq('feedbackId', feedbackId))
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

export async function verifyFeedbackWriteAccess(ctx: any, feedbackId: string, userId: string) {
	const profile = await getCurrentProfileOrThrow(ctx, userId);
	const feedback = await getDocOrThrow(ctx, asId<'feedback'>(feedbackId), 'Feedback not found');
	const project = await getDocOrThrow(ctx, feedback.projectId, 'Project not found');
	const access = await verifyProjectAccess(ctx, { slug: project.slug, userId });
	return {
		feedback,
		isOwner: feedback.authorProfileId === profile._id,
		profile,
		project,
		projectMember: access.projectMember,
		permissions: access.permissions,
	};
}
