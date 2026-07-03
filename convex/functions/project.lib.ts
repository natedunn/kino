import { z } from "zod"

// Deleting a project cascades through many child tables (boards → feedback →
// comments/events/upvotes/emotes/GitHub connections, plus updates and members).
// That can exceed Convex's per-mutation document limit, so `_delete` soft-hides
// the project immediately and `purgeProject` clears its children in bounded
// batches, rescheduling itself until the tree is empty before removing the row.
export const PROJECT_PURGE_BATCH_SIZE = 25

export const visibilitySchema = z.enum(["public", "private", "archived"])

// Finds the project's single active (non-deleted) connected GitHub repo, if any.
// Newest-first so the active connection surfaces even for projects that have
// churned through many historical (disconnected) connections.
export async function getActiveRepoConnection(ctx: any, projectId: any) {
  const connections = await ctx.db
    .query("githubRepositoryConnection")
    .withIndex("by_projectId", (q: any) => q.eq("projectId", projectId))
    .order("desc")
    .take(20)
  return connections.find((connection: any) => !connection.deletedTime) ?? null
}

// Canonical https URL for a connected repo ("owner/name" → github.com URL).
export function repoCanonicalUrl(repoFullName: string) {
  return `https://github.com/${repoFullName}`
}

// Loose match so re-verification survives trailing slashes / casing differences.
export function normalizeUrl(url: string) {
  return url.trim().replace(/\/+$/, "").toLowerCase()
}
