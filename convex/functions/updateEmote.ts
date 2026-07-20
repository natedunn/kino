import { eq } from 'kitcn/orm';
import { z } from 'zod';

import { authMutation } from '../lib/crpc';
import { emoteContentSchema, ensureUpdateReactionAccess } from '../lib/emote';
import { getCurrentProfileOrThrow } from '../lib/kino';
import { idSchema } from '../lib/validation';
import { updateEmoteTable } from './schema';

export const toggle = authMutation
	.input(
		z.object({
			content: emoteContentSchema,
			updateId: idSchema,
		})
	)
	.mutation(async ({ ctx, input }) => {
		const profile = await getCurrentProfileOrThrow(ctx, ctx.userId);
		const item = await ensureUpdateReactionAccess(ctx, input.updateId, ctx.userId);

		const existing = await ctx.db
			.query('updateEmote')
			.withIndex('by_updateId_authorProfileId_content', (q: any) =>
				q.eq('updateId', item._id).eq('authorProfileId', profile._id).eq('content', input.content)
			)
			.first();

		if (existing) {
			await ctx.orm.delete(updateEmoteTable).where(eq(updateEmoteTable.id, existing._id as any));
			return { action: 'removed' as const };
		}

		await ctx.orm.insert(updateEmoteTable).values({
			authorProfileId: profile._id,
			content: input.content,
			updateId: item._id,
		});
		return { action: 'added' as const };
	});
