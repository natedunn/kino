import { z } from 'zod';
import { eq } from 'kitcn/orm';
import { CRPCError } from 'kitcn/server';
import { authMutation } from '../lib/crpc';
import { getCurrentProfileOrThrow, asId, getDocOrThrow, verifyProjectAccess } from '../lib/kino';
import { updateEmoteTable } from './schema';

const emoteContentSchema = z.enum([
  'thumbsUp',
  'thumbsDown',
  'laugh',
  'questionMark',
  'sad',
  'tada',
  'eyes',
  'heart',
  'skull',
  'explodingHead',
]);

async function ensureUpdateReactionAccess(ctx: any, updateId: string, userId: string | null | undefined) {
  const item = await getDocOrThrow(ctx, asId<'update'>(updateId), 'Update not found');
  if (item.status !== 'draft') {
    return item;
  }

  const project = await getDocOrThrow(ctx, item.projectId, 'Project not found');
  const access = await verifyProjectAccess(ctx, { slug: project.slug, userId });
  if (!access.permissions.canEdit) {
    throw new CRPCError({ code: 'FORBIDDEN', message: 'You cannot react to draft updates' });
  }
  return item;
}

export const toggle = authMutation
  .input(
    z.object({
      content: emoteContentSchema,
      updateId: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const profile = await getCurrentProfileOrThrow(ctx, ctx.userId);
    const item = await ensureUpdateReactionAccess(ctx, input.updateId, ctx.userId);

    const existing = await ctx.db
      .query('updateEmote')
      .withIndex('by_updateId_authorProfileId', (q: any) =>
        q.eq('updateId', item._id).eq('authorProfileId', profile._id)
      )
      .filter((q: any) => q.eq(q.field('content'), input.content))
      .first();

    if (existing) {
      await ctx.orm.delete(updateEmoteTable).where(eq(updateEmoteTable.id, existing._id as any));
      return { action: 'removed' as const };
    }

    await ctx.orm.insert(updateEmoteTable).values({
      authorProfileId: profile._id as any,
      content: input.content,
      updateId: item._id as any,
    });
    return { action: 'added' as const };
  });
