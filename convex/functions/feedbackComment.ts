import { eq } from 'kitcn/orm';
import { CRPCError } from 'kitcn/server';
import { z } from 'zod';

import { authMutation, optionalAuthQuery } from '../lib/crpc';
import {
	asId,
	assertProjectWritable,
	getCurrentProfile,
	getCurrentProfileOrThrow,
	getDoc,
	getProjectViewAccess,
	isProjectTeamMember,
	toPublicDoc,
	verifyProjectAccess,
} from '../lib/kino';
import { resolveProfileImageUrl } from '../lib/storage';
import { commentContentSchema, idSchema } from '../lib/validation';
import { getActiveFeedbackOrThrow } from './feedbackComment.lib';
import { feedbackCommentTable } from './schema';

export const create = authMutation
	.input(
		z.object({
			content: commentContentSchema,
			feedbackId: idSchema,
		})
	)
	.mutation(async ({ ctx, input }) => {
		const profile = await getCurrentProfileOrThrow(ctx, ctx.userId);
		const feedback = await getActiveFeedbackOrThrow(ctx, input.feedbackId);
		const access = await verifyProjectAccess(ctx, {
			id: feedback.projectId,
			userId: ctx.userId,
		});
		if (!access.permissions.canView) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'You do not have access to this feedback',
			});
		}
		assertProjectWritable(access);
		const [comment] = await ctx.orm
			.insert(feedbackCommentTable)
			.values({
				authorProfileId: profile._id,
				content: input.content,
				feedbackId: asId<'feedback'>(input.feedbackId),
				initial: false,
			})
			.returning();
		return { commentId: comment.id };
	});

export const update = authMutation
	.input(
		z.object({
			_id: idSchema,
			content: commentContentSchema,
		})
	)
	.mutation(async ({ ctx, input }) => {
		const profile = await getCurrentProfileOrThrow(ctx, ctx.userId);
		const comment = await getDoc(ctx, asId<'feedbackComment'>(input._id));
		if (!comment) throw new CRPCError({ code: 'NOT_FOUND', message: 'Comment not found' });
		const feedback = await getActiveFeedbackOrThrow(ctx, comment.feedbackId);
		assertProjectWritable(
			await verifyProjectAccess(ctx, { id: feedback.projectId, userId: ctx.userId })
		);
		if (comment.authorProfileId !== profile._id) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'You can only edit your own comments',
			});
		}

		await ctx.orm
			.update(feedbackCommentTable)
			.set({
				content: input.content,
				updatedTime: Date.now(),
			})
			.where(eq(feedbackCommentTable.id, comment._id));
		return { updated: true };
	});

export const remove = authMutation
	.input(
		z.object({
			_id: idSchema,
		})
	)
	.mutation(async ({ ctx, input }) => {
		const profile = await getCurrentProfileOrThrow(ctx, ctx.userId);
		const comment = await getDoc(ctx, asId<'feedbackComment'>(input._id));
		if (!comment) throw new CRPCError({ code: 'NOT_FOUND', message: 'Comment not found' });
		const feedback = await getActiveFeedbackOrThrow(ctx, comment.feedbackId);
		const access = await verifyProjectAccess(ctx, {
			id: feedback.projectId,
			userId: ctx.userId,
		});
		assertProjectWritable(access);
		if (comment.authorProfileId !== profile._id && !access.permissions.canManageContent) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'You do not have permission to moderate this comment',
			});
		}
		if (comment.initial) {
			throw new CRPCError({
				code: 'BAD_REQUEST',
				message: 'Cannot delete the initial feedback comment',
			});
		}

		// ORM delete so the comment's emotes cascade and any feedback answer/first
		// pointers null out via FK referential actions.
		await ctx.orm.delete(feedbackCommentTable).where(eq(feedbackCommentTable.id, comment._id));
		return { deleted: true };
	});

export const listByFeedback = optionalAuthQuery
	.input(
		z.object({
			feedbackId: idSchema,
		})
	)
	.query(async ({ ctx, input }) => {
		const feedback = await getDoc(ctx, asId<'feedback'>(input.feedbackId));
		if (!feedback) return [];

		const access = await getProjectViewAccess(ctx, {
			id: feedback.projectId,
			userId: ctx.userId,
		});
		if (!access.permissions.canView) return [];

		const comments = await ctx.db
			.query('feedbackComment')
			.withIndex('by_feedbackId', (q: any) =>
				q.eq('feedbackId', asId<'feedback'>(input.feedbackId))
			)
			.order('asc')
			.collect();

		const projectId = feedback.projectId;
		const currentProfile = await getCurrentProfile(ctx, ctx.userId);

		return await Promise.all(
			comments.map(async (comment: any) => {
				const author = await getDoc<'profile'>(ctx, comment.authorProfileId);
				let isTeamMember = false;

				if (projectId && author) {
					isTeamMember = await isProjectTeamMember(ctx, {
						profile: author,
						projectId,
					});
				}

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
					author: author
						? {
								id: author._id,
								imageUrl: await resolveProfileImageUrl(author),
								name: author.name,
								username: author.username,
							}
						: null,
					canDelete:
						!!currentProfile &&
						!comment.initial &&
						(comment.authorProfileId === currentProfile._id || access.permissions.canManageContent),
					canEdit: !!currentProfile && comment.authorProfileId === currentProfile._id,
					emoteCounts,
					isTeamMember,
				};
			})
		);
	});
