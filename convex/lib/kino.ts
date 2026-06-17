import { CRPCError } from 'kitcn/server';
import type { Doc, Id, TableNames } from '../functions/_generated/dataModel';
import { memberTable, organizationTable, profileTable } from '../functions/schema';

export const DEFAULT_FEEDBACK_BOARDS = ['Bugs', 'Feature Requests', 'Improvements'] as const;

export const SYSTEM_ROLES = ['system:admin', 'system:editor', 'user'] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

/**
 * The single sanitizer for the system role. `user.role` (better-auth) is the
 * source of truth; `profile.role` is a derived copy. Any code that writes
 * `profile.role` MUST funnel through here so the two never diverge into an
 * unexpected value.
 */
export function sanitizeSystemRole(role: string | null | undefined): SystemRole {
  return role === 'system:admin' || role === 'system:editor' ? role : 'user';
}

export const LIMITS = {
  ADMIN: { MAX_ORGS: 100, MAX_PROJECTS: 100 },
  FREE: { MAX_ORGS: 1, MAX_PROJECTS: 1 },
} as const;

export const urlItemSchemaShape = {
  text: true,
  url: true,
} as const;

type OrmCtx = {
  db?: any;
  orm: any;
};

type OrmMutationCtx = OrmCtx;

type AuthUserBootstrapDoc = {
  _id?: string;
  email: string;
  id: string;
  image?: string | null;
  name?: string | null;
  profileId?: string | null;
  role?: string | null;
  username?: string | null;
};

type LegacyAliases = {
  _creationTime: number;
  _id: string;
};

type PersonalOrganizationMembershipCandidate = {
  organizationId: string;
  role: string | null | undefined;
  slug?: string | null;
};

function toCreationTime(value: unknown) {
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  return 0;
}

function withLegacyAliases<T extends { createdAt?: unknown; id: string }>(
  row: T | null | undefined
): (T & LegacyAliases) | null {
  if (!row) return null;
  return {
    ...row,
    _creationTime: toCreationTime(row.createdAt),
    _id: row.id,
  };
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_ -]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function generateRandomSuffix() {
  return crypto.randomUUID().slice(0, 8);
}

export function generateRandomSlug() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 15);
}

export function asId<TableName extends TableNames>(value: string) {
  return value as Id<TableName>;
}

export async function getDoc<TableName extends TableNames>(
  ctx: Pick<OrmCtx, 'db'>,
  id: Id<TableName> | string | null | undefined
) {
  if (!id) return null;
  return (await ctx.db?.get(id as Id<TableName>)) as Doc<TableName> | null;
}

export async function getDocOrThrow<TableName extends TableNames>(
  ctx: Pick<OrmCtx, 'db'>,
  id: Id<TableName> | string | null | undefined,
  message: string
) {
  const doc = await getDoc<TableName>(ctx, id);
  if (!doc) {
    throw new CRPCError({ code: 'NOT_FOUND', message });
  }
  return doc;
}

export function toPublicDoc(doc: any): any {
  if (!doc) return null;

  const { _id, _creationTime, ...rest } = doc;
  return {
    ...rest,
    createdAt: rest.createdAt ?? _creationTime ?? 0,
    id: rest.id ?? _id,
  };
}

export function pickPersonalOrganizationId(args: {
  memberships: PersonalOrganizationMembershipCandidate[];
  profileUsername: string | null | undefined;
}) {
  const adminMemberships = args.memberships.filter(
    (membership) => membership.role === 'admin' || membership.role === 'owner'
  );

  if (args.profileUsername) {
    const matchingSlugMembership = adminMemberships.find(
      (membership) => membership.slug === args.profileUsername
    );
    if (matchingSlugMembership) {
      return matchingSlugMembership.organizationId;
    }
  }

  if (adminMemberships.length === 1) {
    return adminMemberships[0].organizationId;
  }

  return null;
}

export async function ensureUniqueUsername(ctx: OrmCtx, preferred: string) {
  const base = slugify(preferred).replace(/-/g, '_').slice(0, 30) || `user_${generateRandomSuffix()}`;
  let candidate = base;
  let attempt = 0;
  while (attempt < 10) {
    const existing = await ctx.orm.query.profile.findFirst({
      where: { username: candidate },
    });
    if (!existing) return candidate;
    candidate = `${base.slice(0, 21)}_${generateRandomSuffix()}`.slice(0, 30);
    attempt++;
  }
  throw new CRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Unable to generate a unique username',
  });
}

export async function ensureUniqueOrgSlug(ctx: OrmCtx, preferred: string) {
  const base = slugify(preferred).slice(0, 100) || `org-${generateRandomSuffix()}`;
  let candidate = base;
  let attempt = 0;
  while (attempt < 10) {
    const existing = await ctx.orm.query.organization.findFirst({
      where: { slug: candidate },
    });
    if (!existing) return candidate;
    candidate = `${base.slice(0, 91)}-${generateRandomSuffix()}`.slice(0, 100);
    attempt++;
  }
  throw new CRPCError({
    code: 'BAD_REQUEST',
    message: 'Could not generate unique slug',
  });
}

export async function getCurrentProfile(ctx: OrmCtx, userId: string | null | undefined) {
  if (!userId) return null;
  const profiles = await ctx.orm.query.profile.findMany({
    where: { userId },
    limit: 1,
  });
  return withLegacyAliases(profiles[0] as any);
}

export async function getCurrentProfileOrThrow(ctx: OrmCtx, userId: string | null | undefined) {
  const profile = await getCurrentProfile(ctx, userId);
  if (!profile) {
    throw new CRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
  }
  return profile;
}

export async function getUserOrThrow(ctx: OrmCtx, userId: string) {
  const user = await ctx.orm.query.user.findFirst({
    where: { id: userId },
  });
  if (!user) {
    throw new CRPCError({ code: 'NOT_FOUND', message: 'User not found' });
  }
  return user;
}

export async function findOrganization(ctx: OrmCtx, args: { id?: string; slug?: string }) {
  if (args.id) {
    const organizations = await ctx.orm.query.organization.findMany({
      where: { id: args.id },
      limit: 1,
    });
    return withLegacyAliases(organizations[0] as any);
  }
  if (args.slug) {
    const organizations = await ctx.orm.query.organization.findMany({
      where: { slug: args.slug },
      limit: 1,
    });
    return withLegacyAliases(organizations[0] as any);
  }
  return null;
}

export async function getOrganizationOrThrow(ctx: OrmCtx, args: { id?: string; slug?: string }) {
  const organization = await findOrganization(ctx, args);
  if (!organization) {
    throw new CRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
  }
  return organization;
}

export async function findMember(ctx: OrmCtx, args: { organizationId: string; userId: string }) {
  const members = await ctx.orm.query.member.findMany({
    where: {
      organizationId: args.organizationId,
      userId: args.userId,
    },
    limit: 1,
  });
  return withLegacyAliases(members[0] as any);
}

export async function findProject(ctx: OrmCtx, args: { id?: string; slug?: string }) {
  if (args.id) {
    const projects = await ctx.orm.query.project.findMany({
      where: { id: args.id },
      limit: 1,
    });
    return withLegacyAliases(projects[0] as any);
  }
  if (args.slug) {
    const projects = await ctx.orm.query.project.findMany({
      where: { slug: args.slug },
      limit: 1,
    });
    return withLegacyAliases(projects[0] as any);
  }
  return null;
}

export async function getProjectOrThrow(ctx: OrmCtx, args: { id?: string; slug?: string }) {
  const project = await findProject(ctx, args);
  if (!project) {
    throw new CRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
  }
  return project;
}

export async function findProjectMember(
  ctx: OrmCtx,
  args: { projectId?: string; projectSlug?: string; profileId: string }
) {
  if (args.projectId) {
    const members = await ctx.orm.query.projectMember.findMany({
      where: {
        profileId: args.profileId,
        projectId: args.projectId,
      },
      limit: 1,
    });
    return withLegacyAliases(members[0] as any);
  }
  if (args.projectSlug) {
    const members = await ctx.orm.query.projectMember.findMany({
      where: {
        profileId: args.profileId,
        projectSlug: args.projectSlug,
      },
      limit: 1,
    });
    return withLegacyAliases(members[0] as any);
  }
  return null;
}

export async function verifyOrgAccess(
  ctx: OrmCtx,
  args: { id?: string; slug?: string; userId?: string | null }
) {
  const organization = await getOrganizationOrThrow(ctx, args);
  const profile = await getCurrentProfile(ctx, args.userId);
  const member = args.userId
    ? await findMember(ctx, { organizationId: organization.id, userId: args.userId })
    : null;

  if (profile?.role === 'system:admin') {
    return {
      member,
      organization,
      profile,
      permissions: { canCreate: true, canDelete: true, canEdit: true, canView: true },
    };
  }

  if (profile?.role === 'system:editor') {
    return {
      member,
      organization,
      profile,
      permissions: { canCreate: false, canDelete: false, canEdit: true, canView: true },
    };
  }

  const role = member?.role ?? null;
  const canView = organization.visibility === 'public' || !!role;
  const canEdit = role === 'admin' || role === 'owner' || role === 'editor';
  const canDelete = role === 'admin' || role === 'owner';
  const canCreate = role === 'admin' || role === 'owner';

  return {
    member,
    organization: canView ? organization : null,
    profile,
    permissions: { canCreate, canDelete, canEdit, canView },
  };
}

export async function verifyProjectAccess(
  ctx: OrmCtx,
  args: { id?: string; slug?: string; userId?: string | null }
) {
  const project = await getProjectOrThrow(ctx, args);
  const profile = await getCurrentProfile(ctx, args.userId);
  const projectMember = profile
    ? await findProjectMember(ctx, {
        profileId: profile.id,
        projectId: args.id,
        projectSlug: args.slug,
      })
    : null;

  if (profile?.role === 'system:admin') {
    return {
      profile,
      project,
      projectMember,
      permissions: { canDelete: true, canEdit: true, canView: true },
    };
  }

  if (profile?.role === 'system:editor') {
    return {
      profile,
      project,
      projectMember,
      permissions: { canDelete: false, canEdit: true, canView: true },
    };
  }

  const role = projectMember?.role ?? '_none';
  const editorRoles = ['admin', 'editor', 'org:admin', 'org:editor'];
  const memberRoles = [...editorRoles, 'member'];

  if (project.visibility === 'public') {
    const canEdit = editorRoles.includes(role);

    return {
      profile,
      project,
      projectMember,
      permissions: { canDelete: role === 'org:admin', canEdit, canView: true },
    };
  }

  if (project.visibility === 'private') {
    const canView = memberRoles.includes(role);
    const canEdit = editorRoles.includes(role);

    return {
      profile,
      project: canView ? project : null,
      projectMember,
      permissions: { canDelete: role === 'org:admin', canEdit, canView },
    };
  }

  if (project.visibility === 'archived') {
    const canView = editorRoles.includes(role);

    return {
      profile,
      project: canView ? project : null,
      projectMember,
      permissions: { canDelete: role === 'org:admin', canEdit: false, canView },
    };
  }

  return {
    profile,
    project: null,
    projectMember,
    permissions: { canDelete: false, canEdit: false, canView: false },
  };
}

const NO_ACCESS_PERMISSIONS = { canDelete: false, canEdit: false, canView: false } as const;

/**
 * Non-throwing project access check. Returns canView=false (rather than throwing
 * NOT_FOUND) when the project is missing, so read paths can fail closed/quietly.
 */
export async function getProjectViewAccess(
  ctx: OrmCtx,
  args: { id?: string; slug?: string; userId?: string | null }
) {
  const project = await findProject(ctx, args);
  if (!project) {
    return {
      profile: null,
      project: null,
      projectMember: null,
      permissions: { ...NO_ACCESS_PERMISSIONS },
    };
  }
  return await verifyProjectAccess(ctx, { id: project.id, userId: args.userId });
}

export async function setUserProfileId(ctx: OrmMutationCtx, userId: string, profileId: string) {
  await ctx.db.patch(userId as any, { profileId });
}

export async function createDefaultPersonalOrganization(ctx: OrmMutationCtx, user: { id: string; name: string; username: string }) {
  const slug = await ensureUniqueOrgSlug(ctx, user.username);
  if ((ctx as any).auth?.api?.createOrganization) {
    return await (ctx as any).auth.api.createOrganization({
      body: {
        name: user.name || user.username,
        slug,
        userId: user.id,
        visibility: 'public',
      },
    });
  }

  const [organization] = await ctx.orm
    .insert(organizationTable)
    .values({
      createdAt: new Date(),
      metadata: null,
      name: user.name || user.username,
      slug,
      visibility: 'public',
    })
    .returning();

  await ctx.orm.insert(memberTable).values({
    createdAt: new Date(),
    organizationId: organization.id,
    role: 'admin',
    userId: user.id,
  });

  return organization;
}

function getWritableId(doc: any) {
  return doc?._id ?? doc?.id;
}

async function setProfilePersonalOrganizationId(
  ctx: OrmMutationCtx,
  profileId: string | null | undefined,
  organizationId: string | null | undefined
) {
  if (!profileId || !organizationId) return;
  await ctx.db.patch(profileId as any, { personalOrganizationId: organizationId });
}

async function inferPersonalOrganizationId(
  ctx: OrmMutationCtx,
  args: {
    profileUsername: string | null | undefined;
    userId: string;
  }
) {
  const memberships = await ctx.orm.query.member.findMany({
    where: { userId: args.userId },
    limit: 25,
  });

  if (memberships.length === 0) {
    return null;
  }

  const membershipCandidates = await Promise.all(
    memberships.map(async (membership: any) => {
      const organization = await findOrganization(ctx, {
        id: membership.organizationId,
      });

      return {
        organizationId: membership.organizationId,
        role: membership.role,
        slug: organization?.slug ?? null,
      };
    })
  );

  return pickPersonalOrganizationId({
    memberships: membershipCandidates,
    profileUsername: args.profileUsername,
  });
}

export async function ensureUserBootstrap(ctx: OrmMutationCtx, user: AuthUserBootstrapDoc) {
  const publicUserId = user.id;
  const legacyUserId = user._id && user._id !== publicUserId ? user._id : null;
  const username =
    user.username ?? user.email.split('@')[0] ?? user.name ?? `user_${crypto.randomUUID().slice(0, 8)}`;

  let profile = await ctx.orm.query.profile.findFirst({
    where: { userId: publicUserId },
  });

  if (!profile && legacyUserId) {
    profile = await ctx.orm.query.profile.findFirst({
      where: { userId: legacyUserId },
    });

    const profileId = getWritableId(profile);
    if (profileId) {
      await ctx.db.patch(profileId as any, { userId: publicUserId });
    }
  }

  if (!profile) {
    const resolvedUsername = await ensureUniqueUsername({ db: ctx.db, orm: ctx.orm }, username);
    const [createdProfile] = await ctx.orm
      .insert(profileTable)
      .values({
        email: user.email,
        imageKey: null,
        imageUrl: user.image,
        name: user.name ?? user.email,
        personalOrganizationId: null,
        role: sanitizeSystemRole(user.role),
        userId: publicUserId,
        username: resolvedUsername,
      })
      .returning();
    profile = createdProfile;
  }

  const profileId = getWritableId(profile);
  if (profileId && user._id && user.profileId !== profileId) {
    await setUserProfileId(ctx, user._id, profileId);
  }

  if (legacyUserId) {
    const legacyMemberships = await ctx.orm.query.member.findMany({
      where: { userId: legacyUserId },
      limit: 1000,
    });

    await Promise.all(
      legacyMemberships.flatMap((membership: any) => {
        const membershipId = getWritableId(membership);
        return membershipId ? [ctx.db.patch(membershipId as any, { userId: publicUserId })] : [];
      })
    );
  }

  const memberships = await ctx.orm.query.member.findMany({
    where: { userId: publicUserId },
    limit: 1,
  });

  if (memberships.length === 0) {
    const organization = await createDefaultPersonalOrganization(ctx, {
      id: publicUserId,
      name: user.name ?? username,
      username,
    });

    await setProfilePersonalOrganizationId(
      ctx,
      profileId,
      getWritableId(organization)
    );
  } else if (!profile?.personalOrganizationId) {
    const inferredPersonalOrganizationId = await inferPersonalOrganizationId(ctx, {
      profileUsername: profile?.username ?? username,
      userId: publicUserId,
    });

    await setProfilePersonalOrganizationId(
      ctx,
      profileId,
      inferredPersonalOrganizationId
    );
  }

  // Self-heal the derived role: keep profile.role aligned with the
  // source-of-truth user.role in case the user.change trigger ever missed one.
  const desiredRole = sanitizeSystemRole(user.role);
  if (profileId && profile && profile.role !== desiredRole) {
    await ctx.db.patch(profileId as any, { role: desiredRole });
    profile = { ...profile, role: desiredRole };
  }

  return profile;
}

/**
 * Re-derives profile.role from the source-of-truth user.role and patches it if
 * they have drifted. Safe to call on any session bootstrap. Returns the
 * resolved role, or null when no profile exists yet.
 */
export async function reconcileSystemRole(
  ctx: OrmMutationCtx,
  user: { id: string; role?: string | null }
) {
  const profile = await ctx.orm.query.profile.findFirst({
    where: { userId: user.id },
  });
  if (!profile) return null;
  const desired = sanitizeSystemRole(user.role);
  if (profile.role !== desired) {
    await ctx.db.patch((profile._id ?? profile.id) as any, { role: desired });
  }
  return desired;
}
