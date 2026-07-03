import { CRPCError } from "kitcn/server"
import { getCurrentProfileOrThrow } from "../lib/kino"

export async function requireSystemAdmin(ctx: any) {
  const profile = await getCurrentProfileOrThrow(ctx, ctx.userId)
  if (profile.role !== "system:admin") {
    throw new CRPCError({
      code: "FORBIDDEN",
      message: "System admin access required",
    })
  }
  return profile
}
