import { ConvexError } from "convex/values"
import { z } from "zod"
import type { Id } from "./_generated/dataModel"
import {
  getOrganizationLogoObjectKey,
  resolveOrganizationLogoUrl,
} from "../lib/storage"

export const visibilitySchema = z.enum(["public", "private"])

export function parseOrgAvatarKey(key: string) {
  const objectKey = getOrganizationLogoObjectKey(key) ?? key
  const [type, organizationId] = objectKey.split(".")
  if (type !== "ORG_AVATAR" || !organizationId) {
    throw new ConvexError({
      code: "400",
      message: "Invalid key format for organization avatar upload",
    })
  }

  return organizationId as Id<"organization">
}

export async function withResolvedLogo<T extends { logo?: string | null }>(
  organization: T
) {
  return {
    ...organization,
    logo: await resolveOrganizationLogoUrl(organization),
  }
}
