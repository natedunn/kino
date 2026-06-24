// @vitest-environment edge-runtime
import { eq, unsetToken } from "kitcn/orm"
import { describe, expect, it } from "vitest"
import { internal } from "./_generated/api"
import {
  feedbackBoardTable,
  feedbackCommentEmoteTable,
  feedbackCommentTable,
  feedbackEventTable,
  feedbackTable,
  feedbackUpvoteTable,
  profileTable,
  projectTable,
  updateCommentEmoteTable,
  updateCommentTable,
  updateEmoteTable,
  updateTable,
  userTable,
} from "./schema"
import { convexTest, runCtx } from "./setup.testing"

type Ctx = Awaited<ReturnType<typeof runCtx>>

async function seedAuthor(ctx: Ctx) {
  const [user] = await ctx.orm
    .insert(userTable)
    .values({
      createdAt: new Date(),
      email: "author@example.com",
      emailVerified: true,
      name: "Author",
      updatedAt: new Date(),
    })
    .returning()
  const [profile] = await ctx.orm
    .insert(profileTable)
    .values({
      email: "author@example.com",
      name: "Author",
      role: "user",
      userId: user.id,
      username: "author",
    })
    .returning()
  return { profile, user }
}

async function seedProjectWithBoard(ctx: Ctx) {
  const [project] = await ctx.orm
    .insert(projectTable)
    .values({
      name: "Acme",
      orgSlug: "acme",
      slug: "acme",
      visibility: "public",
    })
    .returning()
  const [board] = await ctx.orm
    .insert(feedbackBoardTable)
    .values({
      name: "Bugs",
      projectId: project.id,
      slug: "bugs-test",
    })
    .returning()
  return { board, project }
}

async function seedFeedbackTree(
  ctx: Ctx,
  args: { boardId: string; profileId: string; projectId: string }
) {
  const [feedback] = await ctx.orm
    .insert(feedbackTable)
    .values({
      authorProfileId: args.profileId,
      boardId: args.boardId,
      projectId: args.projectId,
      slug: "feedback-1",
      status: "open",
      title: "Feedback 1",
      upvotes: 0,
    })
    .returning()
  const [comment] = await ctx.orm
    .insert(feedbackCommentTable)
    .values({
      authorProfileId: args.profileId,
      content: "A comment",
      feedbackId: feedback.id,
      initial: false,
    })
    .returning()
  await ctx.orm.insert(feedbackCommentEmoteTable).values({
    authorProfileId: args.profileId,
    content: "heart",
    feedbackCommentId: comment.id,
    feedbackId: feedback.id,
  })
  await ctx.orm.insert(feedbackEventTable).values({
    actorProfileId: args.profileId,
    eventType: "status_changed",
    feedbackId: feedback.id,
  })
  await ctx.orm.insert(feedbackUpvoteTable).values({
    authorProfileId: args.profileId,
    feedbackId: feedback.id,
  })
  return { comment, feedback }
}

async function counts(ctx: Ctx) {
  const [feedback, comments, emotes, events, upvotes, boards] =
    await Promise.all([
      ctx.orm.query.feedback.findMany({ limit: 100 }),
      ctx.orm.query.feedbackComment.findMany({ limit: 100 }),
      ctx.orm.query.feedbackCommentEmote.findMany({ limit: 100 }),
      ctx.orm.query.feedbackEvent.findMany({ limit: 100 }),
      ctx.orm.query.feedbackUpvote.findMany({ limit: 100 }),
      ctx.orm.query.feedbackBoard.findMany({ limit: 100 }),
    ])
  return {
    boards: boards.length,
    comments: comments.length,
    emotes: emotes.length,
    events: events.length,
    feedback: feedback.length,
    upvotes: upvotes.length,
  }
}

describe("feedback cascade deletes (ORM layer)", () => {
  it("deleting a board cascades to feedback and all its descendants", async () => {
    const t = convexTest()
    await t.run(async (baseCtx) => {
      const ctx = await runCtx(baseCtx)
      const { profile } = await seedAuthor(ctx)
      const { board, project } = await seedProjectWithBoard(ctx)
      await seedFeedbackTree(ctx, {
        boardId: board.id,
        profileId: profile.id,
        projectId: project.id,
      })

      const before = await counts(ctx)
      expect(before.feedback).toBe(1)
      expect(before.comments).toBe(1)
      expect(before.emotes).toBe(1)
      expect(before.events).toBe(1)
      expect(before.upvotes).toBe(1)

      await ctx.orm
        .delete(feedbackBoardTable)
        .where(eq(feedbackBoardTable.id, board.id))

      const after = await counts(ctx)
      expect(after.feedback).toBe(0)
      expect(after.comments).toBe(0)
      expect(after.emotes).toBe(0)
      expect(after.events).toBe(0)
      expect(after.upvotes).toBe(0)
    })
  })

  it("deleting a feedback cascades to its comments, emotes, events, and upvotes", async () => {
    const t = convexTest()
    await t.run(async (baseCtx) => {
      const ctx = await runCtx(baseCtx)
      const { profile } = await seedAuthor(ctx)
      const { board, project } = await seedProjectWithBoard(ctx)
      const { feedback } = await seedFeedbackTree(ctx, {
        boardId: board.id,
        profileId: profile.id,
        projectId: project.id,
      })

      await ctx.orm
        .delete(feedbackTable)
        .where(eq(feedbackTable.id, feedback.id))

      const after = await counts(ctx)
      expect(after.feedback).toBe(0)
      expect(after.comments).toBe(0)
      expect(after.emotes).toBe(0)
      expect(after.events).toBe(0)
      expect(after.upvotes).toBe(0)
      // The board itself must survive a feedback delete.
      expect(after.boards).toBeGreaterThanOrEqual(1)
    })
  })

  it("deleting a single comment removes only its emotes, leaving feedback intact", async () => {
    const t = convexTest()
    await t.run(async (baseCtx) => {
      const ctx = await runCtx(baseCtx)
      const { profile } = await seedAuthor(ctx)
      const { board, project } = await seedProjectWithBoard(ctx)
      const { comment } = await seedFeedbackTree(ctx, {
        boardId: board.id,
        profileId: profile.id,
        projectId: project.id,
      })

      await ctx.orm
        .delete(feedbackCommentTable)
        .where(eq(feedbackCommentTable.id, comment.id))

      const after = await counts(ctx)
      expect(after.feedback).toBe(1)
      expect(after.comments).toBe(0)
      expect(after.emotes).toBe(0)
      expect(after.events).toBe(1)
      expect(after.upvotes).toBe(1)
    })
  })

  it("nulls feedback.answerCommentId when the answer comment is deleted (FK set null)", async () => {
    const t = convexTest()
    await t.run(async (baseCtx) => {
      const ctx = await runCtx(baseCtx)
      const { profile } = await seedAuthor(ctx)
      const { board, project } = await seedProjectWithBoard(ctx)
      const { comment, feedback } = await seedFeedbackTree(ctx, {
        boardId: board.id,
        profileId: profile.id,
        projectId: project.id,
      })

      // Mark the comment as the accepted answer, then delete it.
      await ctx.orm
        .update(feedbackTable)
        .set({ answerCommentId: comment.id })
        .where(eq(feedbackTable.id, feedback.id))
      await ctx.orm
        .delete(feedbackCommentTable)
        .where(eq(feedbackCommentTable.id, comment.id))

      const row = await ctx.orm.query.feedback.findFirst({
        where: { id: feedback.id },
      })
      // The feedback survives; its dangling answer pointer is nulled, not stale.
      expect(row).not.toBeNull()
      expect(row?.answerCommentId ?? null).toBeNull()
    })
  })

  it("purgeBoard removes a board's feedback tree then the board row", async () => {
    const t = convexTest()
    let boardId = ""
    await t.run(async (baseCtx) => {
      const ctx = await runCtx(baseCtx)
      const { profile } = await seedAuthor(ctx)
      const { board, project } = await seedProjectWithBoard(ctx)
      await seedFeedbackTree(ctx, {
        boardId: board.id,
        profileId: profile.id,
        projectId: project.id,
      })
      boardId = board.id
    })

    // Drives the same scheduled internal mutation that `_delete` enqueues.
    await t.mutation(internal.feedbackBoard.purgeBoard, {
      boardId: boardId as never,
    })

    await t.run(async (baseCtx) => {
      const ctx = await runCtx(baseCtx)
      const after = await counts(ctx)
      expect(after.feedback).toBe(0)
      expect(after.comments).toBe(0)
      expect(after.emotes).toBe(0)
      expect(after.events).toBe(0)
      expect(after.upvotes).toBe(0)

      const gone = await ctx.orm.query.feedbackBoard.findFirst({
        where: { id: boardId },
      })
      expect(gone ?? null).toBeNull()
    })
  })
})

describe("ctx.orm.update field clearing", () => {
  it("clears an optional field with unsetToken (setAnswerComment null path)", async () => {
    const t = convexTest()
    await t.run(async (baseCtx) => {
      const ctx = await runCtx(baseCtx)
      const { profile } = await seedAuthor(ctx)
      const { board, project } = await seedProjectWithBoard(ctx)
      const { comment, feedback } = await seedFeedbackTree(ctx, {
        boardId: board.id,
        profileId: profile.id,
        projectId: project.id,
      })

      // Set the answer pointer, then clear it the way `setAnswerComment(null)`
      // does — via unsetToken, which must remove the field entirely.
      await ctx.orm
        .update(feedbackTable)
        .set({ answerCommentId: comment.id })
        .where(eq(feedbackTable.id, feedback.id))
      let row = await ctx.orm.query.feedback.findFirst({
        where: { id: feedback.id },
      })
      expect(row?.answerCommentId).toBeTruthy()

      await ctx.orm
        .update(feedbackTable)
        .set({ answerCommentId: unsetToken })
        .where(eq(feedbackTable.id, feedback.id))
      row = await ctx.orm.query.feedback.findFirst({
        where: { id: feedback.id },
      })
      expect(row?.answerCommentId ?? null).toBeNull()
    })
  })
})

describe("retained business-logic triggers", () => {
  it("seeds the three default boards when a project is inserted", async () => {
    const t = convexTest()
    await t.run(async (baseCtx) => {
      const ctx = await runCtx(baseCtx)
      const [project] = await ctx.orm
        .insert(projectTable)
        .values({
          name: "Seeded",
          orgSlug: "seeded",
          slug: "seeded",
          visibility: "public",
        })
        .returning()

      const boards = await ctx.orm.query.feedbackBoard.findMany({
        where: { projectId: project.id },
        limit: 100,
      })
      expect(boards.map((b) => b.name).sort()).toEqual([
        "Bugs",
        "Feature Requests",
        "Improvements",
      ])
    })
  })
})

describe("update cascade deletes (ORM layer)", () => {
  async function seedUpdateTree(
    ctx: Ctx,
    args: { profileId: string; projectId: string }
  ) {
    const [update] = await ctx.orm
      .insert(updateTable)
      .values({
        authorProfileId: args.profileId,
        category: "changelog",
        content: "Body",
        projectId: args.projectId,
        slug: "update-1",
        status: "published",
        title: "Update 1",
        updatedTime: Date.now(),
      })
      .returning()
    const [comment] = await ctx.orm
      .insert(updateCommentTable)
      .values({
        authorProfileId: args.profileId,
        content: "Nice",
        updateId: update.id,
      })
      .returning()
    await ctx.orm.insert(updateEmoteTable).values({
      authorProfileId: args.profileId,
      content: "tada",
      updateId: update.id,
    })
    await ctx.orm.insert(updateCommentEmoteTable).values({
      authorProfileId: args.profileId,
      content: "heart",
      updateCommentId: comment.id,
      updateId: update.id,
    })
    return { comment, update }
  }

  async function updateCounts(ctx: Ctx) {
    const [updates, comments, emotes, commentEmotes] = await Promise.all([
      ctx.orm.query.update.findMany({ limit: 100 }),
      ctx.orm.query.updateComment.findMany({ limit: 100 }),
      ctx.orm.query.updateEmote.findMany({ limit: 100 }),
      ctx.orm.query.updateCommentEmote.findMany({ limit: 100 }),
    ])
    return {
      commentEmotes: commentEmotes.length,
      comments: comments.length,
      emotes: emotes.length,
      updates: updates.length,
    }
  }

  it("deleting an update cascades to its comments and all emotes", async () => {
    const t = convexTest()
    await t.run(async (baseCtx) => {
      const ctx = await runCtx(baseCtx)
      const { profile } = await seedAuthor(ctx)
      const { project } = await seedProjectWithBoard(ctx)
      const { update } = await seedUpdateTree(ctx, {
        profileId: profile.id,
        projectId: project.id,
      })

      await ctx.orm.delete(updateTable).where(eq(updateTable.id, update.id))

      const after = await updateCounts(ctx)
      expect(after.updates).toBe(0)
      expect(after.comments).toBe(0)
      expect(after.emotes).toBe(0)
      expect(after.commentEmotes).toBe(0)
    })
  })

  it("deleting a single update comment removes only its emotes", async () => {
    const t = convexTest()
    await t.run(async (baseCtx) => {
      const ctx = await runCtx(baseCtx)
      const { profile } = await seedAuthor(ctx)
      const { project } = await seedProjectWithBoard(ctx)
      const { comment } = await seedUpdateTree(ctx, {
        profileId: profile.id,
        projectId: project.id,
      })

      await ctx.orm
        .delete(updateCommentTable)
        .where(eq(updateCommentTable.id, comment.id))

      const after = await updateCounts(ctx)
      expect(after.updates).toBe(1)
      expect(after.comments).toBe(0)
      expect(after.emotes).toBe(1)
      expect(after.commentEmotes).toBe(0)
    })
  })
})
