import { z } from "zod"
import { CRPCError } from "kitcn/server"
import { asId, getDocOrThrow, verifyProjectAccess } from "./kino"
import { EMOTE_CONTENTS } from "../functions/schema"

/**
 * The single source of truth for emote reaction contents on the server.
 * `EMOTE_CONTENTS` (convex/functions/schema.ts) backs the table validators;
 * this schema validates mutation input against the same list so the two can't
 * drift. The client keeps its own copy in `src/components/emote/types.ts`
 * because it lives in a separate build context.
 */
export const emoteContentSchema = z.enum(EMOTE_CONTENTS)

/**
 * Shared access guard for reacting to an update (or its comments). Draft
 * updates are visible only to editors, so reacting to one requires edit
 * access; published updates only require view access. Returns the resolved
 * update document so callers can reuse it.
 */
export async function ensureUpdateReactionAccess(
  ctx: any,
  updateId: string,
  userId: string | null | undefined,
  options?: { draftMessage?: string }
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
        message: options?.draftMessage ?? "You cannot react to draft updates",
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
