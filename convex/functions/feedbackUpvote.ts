import { z } from "zod"
import { eq } from "kitcn/orm"
import { CRPCError } from "kitcn/server"
import { authMutation, optionalAuthQuery } from "../lib/crpc"
import {
  asId,
  getCurrentProfile,
  getDoc,
  getProjectViewAccess,
  verifyProjectAccess,
} from "../lib/kino"
import { idSchema } from "../lib/validation"
import { feedbackTable, feedbackUpvoteTable } from "./schema"

export const toggle = authMutation
  .input(
    z.object({
      feedbackId: idSchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    const profile = await getCurrentProfile(ctx, ctx.userId)
    if (!profile) {
      throw new CRPCError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to upvote feedback",
      })
    }

    const feedback = await getDoc(ctx, asId<"feedback">(input.feedbackId))
    if (!feedback) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Feedback not found" })
    }

    const access = await verifyProjectAccess(ctx, {
      id: feedback.projectId,
      userId: ctx.userId,
    })
    if (!access.permissions.canView) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "You do not have access to this feedback",
      })
    }

    const existing = await ctx.db
      .query("feedbackUpvote")
      .withIndex("by_feedbackId_authorProfileId", (q: any) =>
        q.eq("feedbackId", input.feedbackId).eq("authorProfileId", profile._id)
      )
      .unique()

    if (existing) {
      await ctx.orm
        .delete(feedbackUpvoteTable)
        .where(eq(feedbackUpvoteTable.id, existing._id))
      const count = Math.max(0, (feedback.upvotes ?? 0) - 1)
      await ctx.orm
        .update(feedbackTable)
        .set({ upvotes: count })
        .where(eq(feedbackTable.id, feedback._id))
      return { count, upvoted: false }
    }

    await ctx.orm.insert(feedbackUpvoteTable).values({
      authorProfileId: profile._id as any,
      feedbackId: asId<"feedback">(input.feedbackId),
    })
    const count = (feedback.upvotes ?? 0) + 1
    await ctx.orm
      .update(feedbackTable)
      .set({ upvotes: count })
      .where(eq(feedbackTable.id, feedback._id))
    return { count, upvoted: true }
  })

export const getCount = optionalAuthQuery
  .input(
    z.object({
      feedbackId: idSchema,
    })
  )
  .query(async ({ ctx, input }) => {
    const feedback = await getDoc(ctx, asId<"feedback">(input.feedbackId))
    if (!feedback) return 0

    // Don't leak counts for feedback in a project the caller can't view
    // (private/archived). Matches the canView gate on every other read here
    // and in feedbackComment/feedbackEvent.
    const access = await getProjectViewAccess(ctx, {
      id: feedback.projectId,
      userId: ctx.userId,
    })
    if (!access.permissions.canView) return 0

    // Read the denormalized counter kept in sync by `toggle` instead of
    // `.collect()`-ing every upvote row (which is unbounded and grows with
    // popularity). `upvotes` is a non-null integer column.
    return feedback.upvotes
  })

export const hasUpvoted = optionalAuthQuery
  .input(
    z.object({
      feedbackId: idSchema,
    })
  )
  .query(async ({ ctx, input }) => {
    const feedback = await getDoc(ctx, asId<"feedback">(input.feedbackId))
    if (!feedback) return false

    const access = await getProjectViewAccess(ctx, {
      id: feedback.projectId,
      userId: ctx.userId,
    })
    if (!access.permissions.canView) return false

    // Reuse the profile resolved by the access check instead of a second
    // getCurrentProfile lookup on this hot read path.
    const profile = access.profile
    if (!profile) return false

    const existing = await ctx.db
      .query("feedbackUpvote")
      .withIndex("by_feedbackId_authorProfileId", (q: any) =>
        q.eq("feedbackId", input.feedbackId).eq("authorProfileId", profile._id)
      )
      .unique()
    return !!existing
  })

export const getUpvoteData = optionalAuthQuery
  .input(
    z.object({
      feedbackId: idSchema,
    })
  )
  .query(async ({ ctx, input }) => {
    const feedback = await getDoc(ctx, asId<"feedback">(input.feedbackId))
    if (!feedback) return { count: 0, hasUpvoted: false }

    // Gate the count behind project visibility (private/archived).
    const access = await getProjectViewAccess(ctx, {
      id: feedback.projectId,
      userId: ctx.userId,
    })
    if (!access.permissions.canView) return { count: 0, hasUpvoted: false }

    const count = feedback.upvotes ?? 0

    // Reuse the profile resolved by the access check.
    const profile = access.profile
    if (!profile) return { count, hasUpvoted: false }

    const existing = await ctx.db
      .query("feedbackUpvote")
      .withIndex("by_feedbackId_authorProfileId", (q: any) =>
        q.eq("feedbackId", input.feedbackId).eq("authorProfileId", profile._id)
      )
      .unique()
    return { count, hasUpvoted: !!existing }
  })
