import { z } from "zod"
import { CRPCError } from "kitcn/server"
import { verifyOrgAccess } from "../lib/kino"

// Org membership is for the team that runs the org (and, by cascade, all its
// projects). owner/admin manage; editor edits content. There is no plain org
// "member" role — public users participate in public projects without org
// membership, and private-project access is granted per-project (see
// projectMember). So org roles are only owner/admin/editor.
export const assignableRoleSchema = z.enum(["admin", "editor"])
export const updatableRoleSchema = z.enum(["owner", "admin", "editor"])

export async function requireOrgManage(
  ctx: any,
  args: { id?: string; slug?: string }
) {
  const access = await verifyOrgAccess(ctx, { ...args, userId: ctx.userId })
  if (!access.organization) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Organization not found",
    })
  }
  if (!access.permissions.canDelete) {
    throw new CRPCError({
      code: "FORBIDDEN",
      message: "Only organization admins can manage members",
    })
  }
  return access
}
