import { z } from 'zod';
import { createFunctionHandle } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import { eq } from 'kitcn/orm';
import { CRPCError } from 'kitcn/server';
import { authMutation, optionalAuthQuery } from '../lib/crpc';
import {
  asId,
  generateRandomSlug,
  getCurrentProfileOrThrow,
  getDoc,
  getDocOrThrow,
  toPublicDoc,
  verifyProjectAccess,
} from '../lib/kino';
import {
  deleteCoverImageAttachment,
  getCoverImageR2Metadata,
  resolveCoverImageUrl,
  resolveProfileImageUrl,
  updateOrgStorageUsage,
  validateCoverImageMetadata,
} from '../lib/storage';
import { orgUploadsR2 } from '../lib/r2';
import { updateTable } from './schema';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { internalMutation } from './generated/server';

const updateCategorySchema = z.enum(['changelog', 'article', 'announcement']);

export const create = authMutation
  .input(
    z.object({
      category: updateCategorySchema.optional(),
      content: z.string().min(1),
      coverImageId: z.string().optional(),
      projectId: z.string(),
      relatedFeedbackIds: z.array(z.string()).optional(),
      tags: z.array(z.string()).max(20).optional(),
      title: z.string().min(1).max(200),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const profile = await getCurrentProfileOrThrow(ctx, ctx.userId);
    const project = await getDocOrThrow(ctx, asId<'project'>(input.projectId), 'Project not found');
    const access = await verifyProjectAccess(ctx, { slug: project.slug, userId: ctx.userId });

    if (!access.permissions.canEdit) {
      throw new CRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to create updates for this project',
      });
    }

    const [updateRow] = await ctx.orm
      .insert(updateTable)
      .values({
        authorProfileId: profile._id as any,
        category: input.category ?? 'changelog',
        content: input.content,
        coverImageId: input.coverImageId ?? null,
        projectId: project._id as any,
        relatedFeedbackIds: input.relatedFeedbackIds?.map((id) => asId<'feedback'>(id)) ?? [],
        slug: generateRandomSlug(),
        status: 'draft',
        tags: input.tags ?? [],
        title: input.title,
      })
      .returning();

    return { slug: updateRow.slug, updateId: updateRow.id };
  });

export const update = authMutation
  .input(
    z.object({
      id: z.string(),
      category: updateCategorySchema.optional(),
      content: z.string().min(1).optional(),
      coverImageId: z.string().nullable().optional(),
      relatedFeedbackIds: z.array(z.string()).optional(),
      tags: z.array(z.string()).max(20).optional(),
      title: z.string().min(1).max(200).optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const existingUpdate = await getDocOrThrow(ctx, asId<'update'>(input.id), 'Update not found');
    const project = await getDocOrThrow(ctx, existingUpdate.projectId, 'Project not found');
    const access = await verifyProjectAccess(ctx, { slug: project.slug, userId: ctx.userId });

    if (!access.permissions.canEdit) {
      throw new CRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to edit this update' });
    }

    const nextCoverImageId =
      input.coverImageId === undefined ? existingUpdate.coverImageId ?? null : input.coverImageId;

    const patch = Object.fromEntries(
      Object.entries({
        category: input.category,
        content: input.content,
        coverImageId: input.coverImageId === undefined ? undefined : nextCoverImageId,
        relatedFeedbackIds: input.relatedFeedbackIds?.map((id) => asId<'feedback'>(id)),
        tags: input.tags,
        title: input.title,
        updatedTime: Date.now(),
      }).filter(([, value]) => value !== undefined)
    );

    await ctx.orm.update(updateTable).set(patch).where(eq(updateTable.id, existingUpdate._id as any));
    return { success: true };
  });

export const publish = authMutation
  .input(
    z.object({
      id: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const existingUpdate = await getDocOrThrow(ctx, asId<'update'>(input.id), 'Update not found');
    const project = await getDocOrThrow(ctx, existingUpdate.projectId, 'Project not found');
    const access = await verifyProjectAccess(ctx, { slug: project.slug, userId: ctx.userId });

    if (!access.permissions.canEdit) {
      throw new CRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to publish this update',
      });
    }

    await ctx.orm
      .update(updateTable)
      .set({
        publishedAt: Date.now(),
        status: 'published',
        updatedTime: Date.now(),
      })
      .where(eq(updateTable.id, existingUpdate._id as any));
    return { success: true };
  });

export const unpublish = authMutation
  .input(
    z.object({
      id: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const existingUpdate = await getDocOrThrow(ctx, asId<'update'>(input.id), 'Update not found');
    const project = await getDocOrThrow(ctx, existingUpdate.projectId, 'Project not found');
    const access = await verifyProjectAccess(ctx, { slug: project.slug, userId: ctx.userId });

    if (!access.permissions.canEdit) {
      throw new CRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to unpublish this update',
      });
    }

    await ctx.orm
      .update(updateTable)
      .set({
        status: 'draft',
        updatedTime: Date.now(),
      })
      .where(eq(updateTable.id, existingUpdate._id as any));
    return { success: true };
  });

export const remove = authMutation
  .input(
    z.object({
      id: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const existingUpdate = await getDocOrThrow(ctx, asId<'update'>(input.id), 'Update not found');
    const project = await getDocOrThrow(ctx, existingUpdate.projectId, 'Project not found');
    const access = await verifyProjectAccess(ctx, { slug: project.slug, userId: ctx.userId });

    if (!access.permissions.canEdit) {
      throw new CRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to delete this update',
      });
    }

    await deleteCoverImageAttachment(ctx, {
      coverImageId: existingUpdate.coverImageId ?? null,
      orgSlug: project.orgSlug,
    });

    await ctx.orm.delete(updateTable).where(eq(updateTable.id, existingUpdate._id as any));
    return { success: true };
  });

export const generateCoverImageUploadUrl = authMutation
  .input(
    z.object({
      updateId: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const existingUpdate = await getDocOrThrow(ctx, asId<'update'>(input.updateId), 'Update not found');
    const project = await getDocOrThrow(ctx, existingUpdate.projectId, 'Project not found');
    const access = await verifyProjectAccess(ctx, { slug: project.slug, userId: ctx.userId });

    if (!access.permissions.canEdit) {
      throw new CRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to upload cover images for this update',
      });
    }

    return await orgUploadsR2.generateUploadUrl(`UPDATE_COVER_PHOTO.${input.updateId}`);
  });

export const syncMetadata = authMutation
  .input(
    z.object({
      key: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const parts = input.key.split('.');
    if (parts[0] !== 'UPDATE_COVER_PHOTO' || !parts[1]) {
      throw new ConvexError({
        code: '400',
        message: 'Invalid key format for cover image upload',
      });
    }

    const updateId = parts[1] as Id<'update'>;
    const existingUpdate = await ctx.db.get(updateId);
    if (!existingUpdate) {
      throw new ConvexError({
        code: '404',
        message: 'Update not found',
      });
    }

    const project = await ctx.db.get(existingUpdate.projectId);
    if (!project) {
      throw new ConvexError({
        code: '404',
        message: 'Project not found',
      });
    }

    const access = await verifyProjectAccess(ctx, { slug: project.slug, userId: ctx.userId });
    if (!access.permissions.canEdit) {
      throw new CRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to upload cover images for this update',
      });
    }

    await ctx.db.patch(updateId, {
      coverImageId: input.key,
      updatedTime: Date.now(),
    });

    await ctx.scheduler.runAfter(0, orgUploadsR2.component.lib.syncMetadata, {
      ...orgUploadsR2.config,
      key: input.key,
      onComplete: await createFunctionHandle(internal.update.onCoverImageMetadataSynced),
    });

    return null;
  });

export const clearCoverImage = authMutation
  .input(
    z.object({
      updateId: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const existingUpdate = await getDocOrThrow(ctx, asId<'update'>(input.updateId), 'Update not found');
    const project = await getDocOrThrow(ctx, existingUpdate.projectId, 'Project not found');
    const access = await verifyProjectAccess(ctx, { slug: project.slug, userId: ctx.userId });

    if (!access.permissions.canEdit) {
      throw new CRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to clear this update cover image',
      });
    }

    await deleteCoverImageAttachment(ctx, {
      coverImageId: existingUpdate.coverImageId ?? null,
      orgSlug: project.orgSlug,
    });

    await ctx.orm
      .update(updateTable)
      .set({
        coverImageId: null,
        updatedTime: Date.now(),
      })
      .where(eq(updateTable.id, existingUpdate._id as any));

    return { success: true };
  });

export const onCoverImageMetadataSynced = internalMutation({
  args: {
    bucket: v.string(),
    isNew: v.boolean(),
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const parts = args.key.split('.');
    if (parts[0] !== 'UPDATE_COVER_PHOTO' || !parts[1]) {
      throw new ConvexError({
        code: '400',
        message: 'Invalid key format for cover image upload',
      });
    }

    const updateId = parts[1] as Id<'update'>;
    const existingUpdate = await ctx.db.get(updateId);
    if (!existingUpdate) return;

    const project = await ctx.db.get(existingUpdate.projectId);
    if (!project) return;

    const metadata = await getCoverImageR2Metadata(ctx as any, args.key);
    if (!metadata) return;

    validateCoverImageMetadata(metadata);
    await updateOrgStorageUsage(ctx as any, project.orgSlug, metadata.size ?? 0, args.isNew ? 1 : 0);
  },
});

export const getCoverImageUrl = optionalAuthQuery
  .input(
    z.object({
      key: z.string(),
    })
  )
  .query(async ({ input }) => {
    return await resolveCoverImageUrl(input.key);
  });

export const getBySlug = optionalAuthQuery
  .input(
    z.object({
      projectId: z.string(),
      slug: z.string(),
    })
  )
  .query(async ({ ctx, input }) => {
    const item = await ctx.db
      .query('update')
      .withIndex('by_projectId_slug', (q: any) =>
        q.eq('projectId', asId<'project'>(input.projectId)).eq('slug', input.slug)
      )
      .first();
    if (!item) return null;

    const project = await getDoc(ctx, asId<'project'>(input.projectId));
    if (!project) return null;

    const access = await verifyProjectAccess(ctx, { slug: project.slug, userId: ctx.userId });
    if (item.status === 'draft' && !access.permissions.canEdit) {
      return null;
    }

    const author = await getDoc<'profile'>(ctx, item.authorProfileId);
    const relatedFeedback = await Promise.all(
      (item.relatedFeedbackIds ?? []).map(async (feedbackId) => {
        const feedback = await getDoc<'feedback'>(ctx, feedbackId);
        if (!feedback) return null;
        const board = await getDoc<'feedbackBoard'>(ctx, feedback.boardId);
        return {
          id: feedback._id,
          board: board
            ? {
                id: board._id,
                icon: board.icon,
                name: board.name,
                slug: board.slug,
              }
            : null,
          slug: feedback.slug,
          status: feedback.status,
          title: feedback.title,
        };
      })
    );

    const emotes = await ctx.db
      .query('updateEmote')
      .withIndex('by_updateId', (q: any) => q.eq('updateId', item._id))
      .collect();
    const emoteCounts: Record<string, { authorProfileIds: string[]; count: number }> = {};
    for (const emote of emotes) {
      if (!emoteCounts[emote.content]) {
        emoteCounts[emote.content] = { authorProfileIds: [], count: 0 };
      }
      emoteCounts[emote.content].count++;
      emoteCounts[emote.content].authorProfileIds.push(emote.authorProfileId);
    }

    const comments = await ctx.db
      .query('updateComment')
      .withIndex('by_updateId', (q: any) => q.eq('updateId', item._id))
      .collect();

    return {
      author: author
        ? {
            id: author._id,
            imageUrl: await resolveProfileImageUrl(author),
            name: author.name,
            username: author.username,
          }
        : null,
      canEdit: access.permissions.canEdit,
      commentCount: comments.length,
      coverImageUrl: await resolveCoverImageUrl(item.coverImageId ?? null),
      emoteCounts,
      relatedFeedback: relatedFeedback.filter((value): value is NonNullable<typeof value> => value !== null),
      update: toPublicDoc(item),
    };
  });

export const listByProject = optionalAuthQuery
  .input(
    z.object({
      projectId: z.string(),
    })
  )
  .query(async ({ ctx, input }) => {
    const project = await getDoc(ctx, asId<'project'>(input.projectId));
    if (!project) {
      return { canEdit: false, updates: [] };
    }

    const access = await verifyProjectAccess(ctx, { slug: project.slug, userId: ctx.userId });
    const query = ctx.db
      .query('update')
      .withIndex('by_projectId_status_publishedAt', (q: any) =>
        access.permissions.canEdit
          ? q.eq('projectId', project._id)
          : q.eq('projectId', project._id).eq('status', 'published')
      )
      .order('desc');

    const updates = await query.collect();

    return {
      canEdit: access.permissions.canEdit,
      updates: await Promise.all(
        updates.map(async (item) => {
          const author = await getDoc<'profile'>(ctx, item.authorProfileId);
          const emotes = await ctx.db
            .query('updateEmote')
            .withIndex('by_updateId', (q: any) => q.eq('updateId', item._id))
            .collect();
          const emoteCounts: Record<string, { authorProfileIds: string[]; count: number }> = {};
          for (const emote of emotes) {
            if (!emoteCounts[emote.content]) {
              emoteCounts[emote.content] = { authorProfileIds: [], count: 0 };
            }
            emoteCounts[emote.content].count++;
            emoteCounts[emote.content].authorProfileIds.push(emote.authorProfileId);
          }
          const comments = await ctx.db
            .query('updateComment')
            .withIndex('by_updateId', (q: any) => q.eq('updateId', item._id))
            .collect();

          return {
            ...toPublicDoc(item),
            author: author
              ? {
                  id: author._id,
                  imageUrl: await resolveProfileImageUrl(author),
                  name: author.name,
                  username: author.username,
                }
              : null,
            commentCount: comments.length,
            coverImageUrl: await resolveCoverImageUrl(item.coverImageId ?? null),
            emoteCounts,
          };
        })
      ),
    };
  });
