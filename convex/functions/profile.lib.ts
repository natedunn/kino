import { getDoc } from "../lib/kino"
import { resolveProfileImageUrl } from "../lib/storage"

export type PublicOrganizationSummary = {
  id: string
  name: string
  role: string
  slug: string
  visibility: string
}

export async function getVisibleOrganizationsForProfile(
  ctx: { db: any; orm: any },
  args: { includePrivate: boolean; userId: string }
) {
  const memberships = await ctx.orm.query.member.findMany({
    where: { userId: args.userId },
    limit: 50,
  })

  const visibleOrganizations = (
    await Promise.all(
      memberships.map(async (membership: any) => {
        const organization = await getDoc<"organization">(
          ctx,
          membership.organizationId
        )
        if (!organization) {
          return null
        }
        if (!args.includePrivate && organization.visibility !== "public") {
          return null
        }

        return {
          id: organization._id,
          name: organization.name,
          role: membership.role,
          slug: organization.slug,
          visibility: organization.visibility,
        } satisfies PublicOrganizationSummary
      })
    )
  ).filter(
    (organization): organization is PublicOrganizationSummary =>
      organization !== null
  )

  const ownedOrganizations = visibleOrganizations.filter(
    (organization) =>
      organization.role === "owner" || organization.role === "admin"
  )
  const memberOrganizations = visibleOrganizations.filter(
    (organization) =>
      organization.role !== "owner" && organization.role !== "admin"
  )

  return {
    memberOrganizations,
    ownedOrganizations,
  }
}

export async function toPublicProfileSummary(
  ctx: { db: any; orm: any; userId?: string | null },
  profile: any
) {
  const isViewerProfile = !!ctx.userId && ctx.userId === profile.userId
  const organizations = await getVisibleOrganizationsForProfile(ctx, {
    includePrivate: isViewerProfile,
    userId: profile.userId,
  })

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
  }
}
