import { createFunctionHandle } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import { z } from 'zod';
import { CRPCError } from 'kitcn/server';
import { authMutation, authQuery, optionalAuthQuery, publicQuery } from '../lib/crpc';
import { getCurrentProfile, getDoc, toPublicDoc } from '../lib/kino';
import {
  getUserUploadR2Metadata,
  resolveProfileImageUrl,
  validateProfileImageMetadata,
} from '../lib/storage';
import { userUploadsR2 } from '../lib/r2';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { internalMutation } from './generated/server';

const urlSchema = z.object({
  text: z.string().min(1).max(100),
  url: z.string().url(),
});

type PublicOrganizationSummary = {
  id: string;
  name: string;
  role: string;
  slug: string;
  visibility: string;
};

async function getVisibleOrganizationsForProfile(
  ctx: { db: any; orm: any },
  args: { includePrivate: boolean; userId: string }
) {
  const memberships = await ctx.orm.query.member.findMany({
    where: { userId: args.userId },
    limit: 50,
  });

  const visibleOrganizations = (
    await Promise.all(
      memberships.map(async (membership: any) => {
        const organization = await getDoc<'organization'>(ctx, membership.organizationId);
        if (!organization) {
          return null;
        }
        if (!args.includePrivate && organization.visibility !== 'public') {
          return null;
        }

        return {
          id: organization._id,
          name: organization.name,
          role: membership.role,
          slug: organization.slug,
          visibility: organization.visibility,
        } satisfies PublicOrganizationSummary;
      })
    )
  ).filter((organization): organization is PublicOrganizationSummary => organization !== null);

  const ownedOrganizations = visibleOrganizations.filter(
    (organization) => organization.role === 'owner' || organization.role === 'admin'
  );
  const memberOrganizations = visibleOrganizations.filter(
    (organization) => organization.role !== 'owner' && organization.role !== 'admin'
  );

  return {
    memberOrganizations,
    ownedOrganizations,
  };
}

async function toPublicProfileSummary(
  ctx: { db: any; orm: any; userId?: string | null },
  profile: any
) {
  const isViewerProfile = !!ctx.userId && ctx.userId === profile.userId;
  const organizations = await getVisibleOrganizationsForProfile(ctx, {
    includePrivate: isViewerProfile,
    userId: profile.userId,
  });

  return {
    bio: profile.bio ?? null,
    id: profile._id ?? profile.id,
    imageUrl: await resolveProfileImageUrl(profile),
    isViewerProfile,
    location: profile.location ?? null,
    name: profile.name ?? null,
    memberOrganizations: organizations.memberOrganizations,
    ownedOrganizations: organizations.ownedOrganizations,
    urls: profile.urls ?? [],
    username: profile.username,
  };
}

export const getList = publicQuery
  .input(
    z.object({
      limit: z.number().min(1).max(50).default(20).optional(),
    })
  )
  .query(async ({ ctx, input }) => {
    const profiles = await ctx.orm.query.profile.findMany({
      limit: input.limit ?? 20,
      orderBy: { createdAt: 'desc' },
    });

    return await Promise.all(
      profiles.map(async (profile) => ({
        ...profile,
        imageUrl: await resolveProfileImageUrl(profile),
      }))
    );
  });

export const findMyProfile = authQuery.query(async ({ ctx }) => {
  const profile = await getCurrentProfile(ctx, ctx.userId);
  if (!profile) return null;

  return {
    ...toPublicDoc(profile),
    imageUrl: (await resolveProfileImageUrl(profile)) ?? ctx.user.image ?? null,
  };
});

export const getByUsername = optionalAuthQuery
  .input(
    z.object({
      username: z.string().min(3).max(39),
    })
  )
  .query(async ({ ctx, input }) => {
    const profile = await ctx.orm.query.profile.findFirst({
      where: { username: input.username },
    });

    if (!profile) {
      return null;
    }

    return await toPublicProfileSummary(ctx, profile);
  });

export const generateAvatarUploadUrl = authMutation
  .input(z.object({}))
  .mutation(async ({ ctx }) => {
    const profile = await getCurrentProfile(ctx, ctx.userId);
    if (!profile) {
      throw new CRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
    }

    return await userUploadsR2.generateUploadUrl(`PFP_${profile._id}`);
  });

export const syncMetadata = authMutation
  .input(
    z.object({
      key: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const [type, profileId] = input.key.split('_');
    if (type !== 'PFP' || !profileId) {
      throw new ConvexError({
        code: '400',
        message: 'Invalid key format for avatar upload',
      });
    }

    const profile = await getCurrentProfile(ctx, ctx.userId);
    if (!profile) {
      throw new CRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
    }

    if (profile._id !== profileId) {
      throw new CRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to upload this avatar',
      });
    }

    await ctx.db.patch(profile._id, {
      imageKey: input.key,
    });

    await ctx.scheduler.runAfter(0, userUploadsR2.component.lib.syncMetadata, {
      ...userUploadsR2.config,
      key: input.key,
      onComplete: await createFunctionHandle(internal.profile.onAvatarMetadataSynced),
    });

    return null;
  });

export const onAvatarMetadataSynced = internalMutation({
  args: {
    bucket: v.string(),
    isNew: v.boolean(),
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const [type, profileId] = args.key.split('_');
    if (type !== 'PFP' || !profileId) {
      throw new ConvexError({
        code: '400',
        message: 'Invalid key format for avatar upload',
      });
    }

    const profile = await ctx.db.get(profileId as Id<'profile'>);
    if (!profile) return;

    const metadata = await getUserUploadR2Metadata(ctx as any, args.key);
    if (!metadata) return;

    validateProfileImageMetadata(metadata);
  },
});

export const update = authMutation
  .input(
    z.object({
      profile: z.object({
        bio: z.string().max(150).nullish(),
        imageKey: z.string().nullish(),
        location: z.string().max(100).nullish(),
        urls: z.array(urlSchema).max(10).nullish(),
      }),
      user: z.object({
        image: z.string().url().nullish(),
        name: z.string().min(1).max(100).nullish(),
        username: z.string().min(3).max(39).nullish(),
      }),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const profile = await getCurrentProfile(ctx, ctx.userId);
    if (!profile) {
      throw new CRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
    }

    if (input.user.username && input.user.username !== profile.username) {
      const existing = await ctx.db
        .query('profile')
        .withIndex('by_username', (q: any) => q.eq('username', input.user.username))
        .first();

      if (existing && existing.userId !== ctx.userId) {
        throw new CRPCError({ code: 'BAD_REQUEST', message: 'Username is already taken' });
      }
    }

    const nextUser = Object.fromEntries(
      Object.entries(input.user).filter(([, value]) => value !== undefined)
    );
    if (Object.keys(nextUser).length > 0) {
      await ctx.auth.api.updateUser({
        body: nextUser,
        headers: ctx.headers,
      });
    }

    const nextProfile = Object.fromEntries(
      Object.entries(input.profile).filter(([, value]) => value !== undefined)
    );
    if (Object.keys(nextProfile).length > 0) {
      await ctx.db.patch(profile._id as any, nextProfile);
    }

    const updatedProfile = (await getCurrentProfile(ctx, ctx.userId)) ?? {
      ...profile,
      ...nextProfile,
    };

    return {
      ...toPublicDoc(updatedProfile),
      imageUrl: (await resolveProfileImageUrl(updatedProfile)) ?? input.user.image ?? ctx.user.image ?? null,
    };
  });
