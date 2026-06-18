import { CRPCError } from "kitcn/server"
import { authQuery } from "../lib/crpc"
import { getCurrentProfileOrThrow } from "../lib/kino"
import { resolveProfileImageUrl } from "../lib/storage"

async function requireSystemAdmin(ctx: any) {
  const profile = await getCurrentProfileOrThrow(ctx, ctx.userId)
  if (profile.role !== "system:admin") {
    throw new CRPCError({
      code: "FORBIDDEN",
      message: "System admin access required",
    })
  }
  return profile
}

export const getSystemMetrics = authQuery.query(async ({ ctx }) => {
  await requireSystemAdmin(ctx)

  // Unfiltered ORM count() uses Convex's native count syscall — O(efficient),
  // exact at any scale, and never fetches rows. No aggregateIndex needed.
  const [users, organizations, projects, feedback, recentUserRows] =
    await Promise.all([
      ctx.orm.query.user.count(),
      ctx.orm.query.organization.count(),
      ctx.orm.query.project.count(),
      ctx.orm.query.feedback.count(),
      ctx.db.query("user").order("desc").take(5),
    ])

  const recentUsers = await Promise.all(
    recentUserRows.map(async (user: any) => ({
      createdAt: user.createdAt ?? user._creationTime ?? null,
      email: user.email ?? null,
      id: user._id,
      imageUrl: await resolveProfileImageUrl({
        imageKey: null,
        imageUrl: user.image ?? null,
      }),
      name: user.name ?? null,
    }))
  )

  return {
    counts: {
      feedback,
      organizations,
      projects,
      users,
    },
    recentUsers,
  }
})
