import type { Doc } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';

import { ConvexError } from 'convex/values';

import { resolveOrganizationAccess, resolveProjectAccess } from './access';
import { isFeedbackLive } from './feedbackLifecycle';

export const EXPORT_FORMAT = 'kino-user-data-export' as const;
export const EXPORT_VERSION = 1;
export const COMMENTS_SECTION_VERSION = 1;
export const MAX_COMMENTS_PER_SOURCE = 750;
export const MAX_EXPORT_BYTES = 900_000;

export const exportSectionIds = ['comments'] as const;
export type ExportSectionId = (typeof exportSectionIds)[number];

export function toExportDate(value: number | null | undefined) {
	return typeof value === 'number' ? new Date(value).toISOString() : null;
}

function projectSummary(project: Doc<'projects'>, organization: Doc<'organizations'>) {
	return {
		id: project._id,
		name: project.name,
		orgSlug: organization.slug,
		slug: project.slug,
		visibility: project.visibility,
	};
}

async function visibleOrganizationSummary(
	ctx: QueryCtx,
	organizationId: Doc<'organizations'>['_id']
) {
	const access = await resolveOrganizationAccess(ctx, organizationId);
	const organization = access.organization;
	return organization
		? { id: organization._id, name: organization.name, slug: organization.slug }
		: null;
}

async function feedbackCommentContext(ctx: QueryCtx, comment: Doc<'feedbackComments'>) {
	const feedback = await ctx.db.get('feedback', comment.feedbackId);
	if (!feedback || !(await isFeedbackLive(ctx, feedback))) {
		return { contextAccess: 'missing' as const, feedbackId: comment.feedbackId };
	}

	const access = await resolveProjectAccess(ctx, feedback.projectId);
	if (!access.project) {
		return {
			contextAccess: 'inaccessible' as const,
			feedbackId: feedback._id,
			projectId: feedback.projectId,
		};
	}

	const organization = await ctx.db.get('organizations', access.project.organizationId);
	if (!organization) {
		return {
			contextAccess: 'inaccessible' as const,
			feedbackId: feedback._id,
			projectId: feedback.projectId,
		};
	}
	const board = await ctx.db.get('feedbackBoards', feedback.boardId);
	return {
		contextAccess: 'visible' as const,
		board:
			board && board.projectId === feedback.projectId && board.deletingAt === undefined
				? { id: board._id, name: board.name, slug: board.slug }
				: null,
		feedback: {
			id: feedback._id,
			slug: feedback.slug,
			status: feedback.status,
			title: feedback.title,
		},
		organization: await visibleOrganizationSummary(ctx, organization._id),
		project: projectSummary(access.project, organization),
	};
}

async function updateCommentContext(ctx: QueryCtx, comment: Doc<'updateComments'>) {
	const update = await ctx.db.get('updates', comment.updateId);
	if (!update || update.deletingAt !== undefined) {
		return { contextAccess: 'missing' as const, updateId: comment.updateId };
	}

	const access = await resolveProjectAccess(ctx, update.projectId);
	if (!access.project || (update.status === 'draft' && !access.permissions.canManageContent)) {
		return {
			contextAccess: 'inaccessible' as const,
			projectId: update.projectId,
			updateId: update._id,
		};
	}

	const organization = await ctx.db.get('organizations', access.project.organizationId);
	if (!organization) {
		return {
			contextAccess: 'inaccessible' as const,
			projectId: update.projectId,
			updateId: update._id,
		};
	}
	return {
		contextAccess: 'visible' as const,
		organization: await visibleOrganizationSummary(ctx, organization._id),
		project: projectSummary(access.project, organization),
		update: {
			category: update.category,
			id: update._id,
			publishedAt: toExportDate(update.publishedAt),
			slug: update.slug,
			status: update.status,
			title: update.title,
		},
	};
}

export async function buildCommentsSection(ctx: QueryCtx, profile: Doc<'profiles'>) {
	const [feedbackComments, updateComments] = await Promise.all([
		ctx.db
			.query('feedbackComments')
			.withIndex('by_authorProfileId', (q) => q.eq('authorProfileId', profile._id))
			.order('asc')
			.take(MAX_COMMENTS_PER_SOURCE + 1),
		ctx.db
			.query('updateComments')
			.withIndex('by_authorProfileId', (q) => q.eq('authorProfileId', profile._id))
			.order('asc')
			.take(MAX_COMMENTS_PER_SOURCE + 1),
	]);

	if (
		feedbackComments.length > MAX_COMMENTS_PER_SOURCE ||
		updateComments.length > MAX_COMMENTS_PER_SOURCE
	) {
		throw new ConvexError({
			code: 'BAD_REQUEST',
			message:
				'Your comments export is too large for immediate download. Try again after async exports are available.',
		});
	}

	return {
		version: COMMENTS_SECTION_VERSION,
		counts: {
			feedbackComments: feedbackComments.length,
			updateComments: updateComments.length,
			total: feedbackComments.length + updateComments.length,
		},
		feedbackComments: await Promise.all(
			feedbackComments.map(async (comment) => ({
				id: comment._id,
				content: comment.content,
				createdAt: toExportDate(comment._creationTime),
				updatedAt: toExportDate(comment.updatedAt),
				feedbackId: comment.feedbackId,
				initial: comment.initial,
				replyFeedbackCommentId: comment.replyFeedbackCommentId ?? null,
				source: 'feedback' as const,
				context: await feedbackCommentContext(ctx, comment),
			}))
		),
		updateComments: await Promise.all(
			updateComments.map(async (comment) => ({
				id: comment._id,
				content: comment.content,
				createdAt: toExportDate(comment._creationTime),
				updatedAt: toExportDate(comment.updatedAt),
				updateId: comment.updateId,
				source: 'update' as const,
				context: await updateCommentContext(ctx, comment),
			}))
		),
	};
}

export function resolveRequestedSections(requested: Array<ExportSectionId> | undefined) {
	return requested === undefined ? [...exportSectionIds] : [...new Set(requested)];
}
