import { CRPCError } from "kitcn/server"
import { asId, getDocOrThrow, verifyProjectAccess } from "../lib/kino"

export async function ensureUpdateCommentAccess(
  ctx: any,
  updateId: string,
  userId: string | null | undefined
) {
  const item = await getDocOrThrow(
    ctx,
    asId<"update">(updateId),
    "Update not found"
  )

  const project = await getDocOrThrow(ctx, item.projectId, "Project not found")
  const access = await verifyProjectAccess(ctx, { slug: project.slug, userId })
  if (item.status === "draft") {
    if (!access.permissions.canEdit) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "You cannot comment on draft updates",
      })
    }
  } else if (!access.permissions.canView) {
    throw new CRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this update",
    })
  }
  return item
}
