import type { ProfileImageUrlCache } from '../lib/storage';
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
export const feedbackPrioritySchema = z.enum(['none', 'low', 'medium', 'high', 'urgent']);
export const targetGranularitySchema = z.enum(targetGranularities);
// Safety bound on emote reactions read per comment (a comment realistically has a
// small number of distinct reactors); prevents an unbounded per-comment scan.
export const MAX_COMMENT_EMOTES = 1000;

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

export async function toProfileSummary(
	profile: Doc<'profile'> | null,
	imageUrlCache?: ProfileImageUrlCache
) {
	return profile
		? {
				id: profile._id,
				imageUrl: await resolveProfileImageUrl(profile, imageUrlCache),
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
	cache: CommentEnrichCache = createCommentEnrichCache(),
	imageUrlCache?: ProfileImageUrlCache
) {
	const author = await getCachedAuthor(ctx, comment.authorProfileId, cache);
	const isTeamMember = await getCachedIsTeamMember(ctx, author, projectId, cache);

	const emotes = await ctx.db
		.query('feedbackCommentEmote')
		.withIndex('by_feedbackCommentId', (q: any) => q.eq('feedbackCommentId', comment._id))
		.take(MAX_COMMENT_EMOTES);
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
		author: await toProfileSummary(author, imageUrlCache),
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
