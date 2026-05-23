import { z } from 'zod';
import { CRPCError } from 'kitcn/server';
import { authMutation, authQuery, optionalAuthQuery } from '../lib/crpc';
import {
  LIMITS,
  ensureUniqueOrgSlug,
  getCurrentProfile,
  verifyOrgAccess,
} from '../lib/kino';

const visibilitySchema = z.enum(['public', 'private']);

export const create = authMutation
  .input(
    z.object({
      logo: z.string().url().optional(),
      name: z.string().min(1).max(100),
      slug: z.string().min(1).max(100).optional(),
      visibility: visibilitySchema.default('public'),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const profile = await getCurrentProfile(ctx, ctx.userId);
    const memberships = await ctx.orm.query.member.findMany({
      where: { userId: ctx.userId },
      limit: LIMITS.ADMIN.MAX_ORGS + 1,
    });

    const maxOrgs = profile?.role === 'system:admin' ? LIMITS.ADMIN.MAX_ORGS : LIMITS.FREE.MAX_ORGS;
    if (memberships.length >= maxOrgs) {
      throw new CRPCError({
        code: 'FORBIDDEN',
        message: 'Organization limit reached',
      });
    }

    const slug = await ensureUniqueOrgSlug(ctx, input.slug ?? input.name);
    const organization = await ctx.auth.api.createOrganization({
      body: {
        logo: input.logo,
        name: input.name,
        slug,
        visibility: input.visibility,
      },
      headers: ctx.headers,
    });

    if (!organization) {
      throw new CRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create organization',
      });
    }

    return organization;
  });

export const update = authMutation
  .input(
    z.object({
      currentSlug: z.string(),
      logo: z.string().url().optional(),
      name: z.string().min(1).max(100).optional(),
      updatedSlug: z.string().min(1).max(100).optional(),
      visibility: visibilitySchema.optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const access = await verifyOrgAccess(ctx, { slug: input.currentSlug, userId: ctx.userId });
    if (!access.organization) {
      throw new CRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
    }
    if (!access.permissions.canEdit) {
      throw new CRPCError({ code: 'FORBIDDEN', message: 'User does not have permission' });
    }

    const nextSlug =
      input.updatedSlug && input.updatedSlug !== access.organization.slug
        ? await ensureUniqueOrgSlug(ctx, input.updatedSlug)
        : undefined;

    const patch = Object.fromEntries(
      Object.entries({
        logo: input.logo,
        name: input.name,
        slug: nextSlug,
        visibility: input.visibility,
      }).filter(([, value]) => value !== undefined)
    );

    if (Object.keys(patch).length === 0) return access.organization;

    await ctx.auth.api.updateOrganization({
      body: {
        data: patch,
        organizationId: access.organization.id,
      },
      headers: ctx.headers,
    });

    return {
      ...access.organization,
      ...patch,
      slug: nextSlug ?? access.organization.slug,
    };
  });

export const getDetails = optionalAuthQuery
  .input(z.object({ slug: z.string() }))
  .query(async ({ ctx, input }) => {
    const access = await verifyOrgAccess(ctx, { slug: input.slug, userId: ctx.userId });
    if (!access.organization) {
      return null;
    }

    return {
      member: access.member,
      org: access.organization,
      permissions: access.permissions,
      userId: access.profile?.id ?? null,
    };
  });

export const getMyPermission = authQuery
  .input(z.object({ slug: z.string() }))
  .query(async ({ ctx, input }) => {
    const access = await verifyOrgAccess(ctx, { slug: input.slug, userId: ctx.userId });
    if (!access.organization || !access.permissions.canCreate) {
      return { canAddProjects: false };
    }

    const projects = await ctx.orm.query.project.findMany({
      where: { orgSlug: input.slug },
      limit: LIMITS.ADMIN.MAX_PROJECTS + 1,
    });

    const maxProjects =
      access.profile?.role === 'system:admin' ? LIMITS.ADMIN.MAX_PROJECTS : LIMITS.FREE.MAX_PROJECTS;

    return {
      canAddProjects: projects.length < maxProjects,
    };
  });

export const findMyOrgs = authQuery.query(async ({ ctx }) => {
  const teams = await ctx.auth.api.listOrganizations({ headers: ctx.headers });

  const profile = await getCurrentProfile(ctx, ctx.userId);
  const maxOrgs = profile?.role === 'system:admin' ? LIMITS.ADMIN.MAX_ORGS : LIMITS.FREE.MAX_ORGS;

  return {
    teams,
    underLimit: teams.length < maxOrgs,
  };
});
