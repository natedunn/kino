import { eq } from 'kitcn/orm';
import { CRPCError } from 'kitcn/server';
import { z } from 'zod';

import { authMutation } from '../lib/crpc';
import { emoteContentSchema, ensureUpdateReactionAccess } from '../lib/emote';
import { asId, getCurrentProfileOrThrow, getDocOrThrow } from '../lib/kino';
import { idSchema } from '../lib/validation';
import { updateCommentEmoteTable } from './schema';

export const toggle = authMutation
	.input(
		z.object({
			content: emoteContentSchema,
			updateCommentId: idSchema,
			updateId: idSchema,
		})
	)
	.mutation(async ({ ctx, input }) => {
		const profile = await getCurrentProfileOrThrow(ctx, ctx.userId);
		const item = await ensureUpdateReactionAccess(ctx, input.updateId, ctx.userId, {
			draftMessage: 'You cannot react to comments on draft updates',
		});

		const comment = await getDocOrThrow(
			ctx,
			asId<'updateComment'>(input.updateCommentId),
			'Comment not found'
		);
		if (comment.updateId !== item._id) {
			throw new CRPCError({
				code: 'BAD_REQUEST',
				message: 'Comment does not belong to this update',
			});
		}

		const existing = await ctx.db
			.query('updateCommentEmote')
			.withIndex('by_updateCommentId_authorProfileId_content', (q: any) =>
				q
					.eq('updateCommentId', comment._id)
					.eq('authorProfileId', profile._id)
					.eq('content', input.content)
			)
			.first();

		if (existing) {
			await ctx.orm
				.delete(updateCommentEmoteTable)
				.where(eq(updateCommentEmoteTable.id, existing._id as any));
			return { action: 'removed' as const };
		}

		await ctx.orm.insert(updateCommentEmoteTable).values({
			authorProfileId: profile._id,
			content: input.content,
			updateCommentId: comment._id,
			updateId: item._id,
		});
		return { action: 'added' as const };
	});
