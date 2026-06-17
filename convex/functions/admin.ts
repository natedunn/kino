import { CRPCError } from "kitcn/server"
import { authQuery } from "../lib/crpc"
import { getCurrentProfileOrThrow } from "../lib/kino"
import { resolveProfileImageUrl } from "../lib/storage"

// Bounded read cap for admin counts. The app has no aggregate indexes yet, so we
// read up to this many rows and flag `capped` when the real total may exceed it.
// Revisit with an aggregateIndex if/when tables outgrow this.
const COUNT_CAP = 5000

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

async function boundedCount(ctx: any, table: string) {
  const rows = await ctx.db.query(table).take(COUNT_CAP)
  return { capped: rows.length >= COUNT_CAP, count: rows.length }
}

export const getSystemMetrics = authQuery.query(async ({ ctx }) => {
  await requireSystemAdmin(ctx)

  const [users, organizations, projects, feedback, recentUserRows] =
    await Promise.all([
      boundedCount(ctx, "user"),
      boundedCount(ctx, "organization"),
      boundedCount(ctx, "project"),
      boundedCount(ctx, "feedback"),
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
    capped:
      users.capped ||
      organizations.capped ||
      projects.capped ||
      feedback.capped,
    countCap: COUNT_CAP,
    counts: {
      feedback: feedback.count,
      organizations: organizations.count,
      projects: projects.count,
      users: users.count,
    },
    recentUsers,
  }
})
