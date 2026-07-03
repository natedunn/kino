import { authQuery } from "../lib/crpc"
import { resolveProfileImageUrl } from "../lib/storage"
import { requireSystemAdmin } from "./admin.lib"

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
