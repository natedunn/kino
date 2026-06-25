import { z } from "zod"
import { eq } from "kitcn/orm"
import { CRPCError } from "kitcn/server"
import {
  authAction,
  authQuery,
  optionalAuthQuery,
  privateMutation,
  privateQuery,
} from "../lib/crpc"
import {
  asId,
  getCurrentProfileOrThrow,
  getDoc,
  getDocOrThrow,
  toPublicDoc,
  verifyProjectAccess,
} from "../lib/kino"
import {
  createInstallationToken,
  createIssueComment,
  createRepositoryIssue,
  getRepositoryIssue,
  searchRepositoryIssues,
  type GitHubIssueTarget,
  type GitHubRepository,
} from "../lib/github-client"
import {
  feedbackSearchSchema,
  githubBodySchema,
  githubNodeIdSchema,
  githubStateValueSchema,
  githubTitleSchema,
  githubUrlSchema,
  idSchema,
} from "../lib/validation"
import { createFeedbackGithubCaller } from "./generated/feedbackGithub.runtime"
import { feedbackGithubConnectionTable } from "./schema"

const kindSchema = z.literal("issue")

type ConnectionKind = z.infer<typeof kindSchema>
type GitHubTarget = GitHubIssueTarget

function repositoryFromConnection(connection: {
  repoFullName: string
  repoId: number
  repoName: string
  repoNodeId: string
  repoOwner: string
}): GitHubRepository {
  return {
    full_name: connection.repoFullName,
    id: connection.repoId,
    name: connection.repoName,
    node_id: connection.repoNodeId,
    owner: {
      login: connection.repoOwner,
    },
    private: false,
  }
}

function buildKinoConnectionBody(args: {
  feedbackTitle: string
  feedbackUrl: string
}) {
  return `Connected to Kino Feedback: [${args.feedbackTitle}](${args.feedbackUrl})`
}

function assertCanUseConnection(args: { connection: any }) {
  if (args.connection.mode !== "read_write") {
    throw new CRPCError({
      code: "FORBIDDEN",
      message:
        "This GitHub repository is connected read-only. Reconnect it with read/write access to connect feedback.",
    })
  }

  const source = "issues"
  if (!args.connection.enabledSources?.includes(source)) {
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: `GitHub ${source} are not enabled for this project connection`,
    })
  }
}

async function getActiveRepositoryConnection(ctx: any, projectId: string) {
  const connections = await ctx.db
    .query("githubRepositoryConnection")
    .withIndex("by_projectId", (q: any) => q.eq("projectId", projectId))
    .take(20)

  return connections.find((connection: any) => !connection.deletedTime) ?? null
}

async function getVerifiedContext(
  ctx: any,
  args: {
    feedbackId: string
    kind: ConnectionKind
    requireSource?: boolean
    userId: string
  }
) {
  const feedback = await getDocOrThrow(
    ctx,
    asId<"feedback">(args.feedbackId),
    "Feedback not found"
  )

  const project = await getDocOrThrow(
    ctx,
    feedback.projectId,
    "Project not found"
  )
  const access = await verifyProjectAccess(ctx, {
    slug: project.slug,
    userId: args.userId,
  })
  if (!access.permissions.canEdit) {
    throw new CRPCError({
      code: "FORBIDDEN",
      message: "Only project admins and editors can connect GitHub items",
    })
  }

  const profile = await getCurrentProfileOrThrow(ctx, args.userId)
  const connection = await getActiveRepositoryConnection(ctx, project._id)
  if (!connection) {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "Connect a GitHub repository before linking feedback",
    })
  }
  if (args.requireSource !== false) {
    assertCanUseConnection({ connection })
  } else if (connection.mode !== "read_write") {
    throw new CRPCError({
      code: "FORBIDDEN",
      message:
        "This GitHub repository is connected read-only. Reconnect it with read/write access to connect feedback.",
    })
  }

  const installation = await ctx.db.get(connection.githubInstallationId)
  if (!installation || installation.status !== "active") {
    throw new CRPCError({
      code: "NOT_FOUND",
      message: "GitHub installation is no longer active",
    })
  }

  return {
    connection: toPublicDoc(connection),
    feedback: toPublicDoc(feedback),
    installation: toPublicDoc(installation),
    profile: toPublicDoc(profile),
    project: toPublicDoc(project),
    repository: repositoryFromConnection(connection),
  }
}

export const getContextForAction = privateQuery
  .input(
    z.object({
      feedbackId: idSchema,
      kind: kindSchema,
      requireSource: z.boolean().optional(),
      userId: idSchema,
    })
  )
  .query(async ({ ctx, input }) => await getVerifiedContext(ctx, input))

export const listByFeedback = optionalAuthQuery
  .input(
    z.object({
      feedbackId: idSchema,
    })
  )
  .query(async ({ ctx, input }) => {
    const feedback = await getDoc(ctx, asId<"feedback">(input.feedbackId))
    if (!feedback) return []

    const project = await getDoc(ctx, feedback.projectId)
    if (!project) return []

    const access = await verifyProjectAccess(ctx, {
      slug: project.slug,
      userId: ctx.userId,
    })
    if (!access.permissions.canView) return []

    const connections = await ctx.db
      .query("feedbackGithubConnection")
      .withIndex("by_feedbackId", (q: any) => q.eq("feedbackId", feedback._id))
      .take(100)

    const visibleConnections = []
    for (const connection of connections) {
      if (connection.deletedTime) continue

      const repositoryConnection = await ctx.db.get(
        connection.githubRepositoryConnectionId
      )
      if (repositoryConnection?.repoPrivate && !access.permissions.canEdit) {
        continue
      }

      visibleConnections.push(toPublicDoc(connection))
    }

    return visibleConnections
  })

export const getAvailability = authQuery
  .input(
    z.object({
      feedbackId: idSchema,
    })
  )
  .query(async ({ ctx, input }) => {
    const feedback = await getDoc(ctx, asId<"feedback">(input.feedbackId))
    if (!feedback) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Feedback not found" })
    }

    const project = await getDocOrThrow(
      ctx,
      feedback.projectId,
      "Project not found"
    )
    const access = await verifyProjectAccess(ctx, {
      slug: project.slug,
      userId: ctx.userId,
    })
    if (!access.permissions.canEdit) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Only project admins and editors can connect GitHub items",
      })
    }

    const connection = await getActiveRepositoryConnection(ctx, project._id)
    if (!connection) {
      return {
        connected: false,
        enabledSources: [],
        issuesEnabled: false,
        mode: null,
        repoFullName: null,
        writable: false,
      }
    }

    const enabledSources = connection.enabledSources ?? []
    return {
      connected: true,
      enabledSources,
      issuesEnabled: enabledSources.includes("issues"),
      mode: connection.mode,
      repoFullName: connection.repoFullName,
      repoPrivate: connection.repoPrivate === true,
      writable: connection.mode === "read_write",
    }
  })

export const ensureNotConnected = privateQuery
  .input(
    z.object({
      feedbackId: idSchema,
      githubNodeId: githubNodeIdSchema,
      kind: kindSchema,
    })
  )
  .query(async ({ ctx, input }) => {
    const existing = await ctx.db
      .query("feedbackGithubConnection")
      .withIndex("by_feedbackId_kind_githubNodeId", (q: any) =>
        q
          .eq("feedbackId", input.feedbackId)
          .eq("kind", input.kind)
          .eq("githubNodeId", input.githubNodeId)
      )
      .unique()
    if (existing && !existing.deletedTime) {
      throw new CRPCError({
        code: "CONFLICT",
        message: "This GitHub item is already connected to this feedback",
      })
    }
    return { available: true }
  })

export const saveConnection = privateMutation
  .input(
    z.object({
      connectedByProfileId: idSchema,
      feedbackId: idSchema,
      githubDatabaseId: z.number().int().optional(),
      githubNodeId: githubNodeIdSchema,
      githubNumber: z.number().int(),
      githubRepositoryConnectionId: idSchema,
      kind: kindSchema,
      projectId: idSchema,
      state: githubStateValueSchema,
      title: githubTitleSchema,
      url: githubUrlSchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    const existing = await ctx.db
      .query("feedbackGithubConnection")
      .withIndex("by_feedbackId_kind_githubNodeId", (q: any) =>
        q
          .eq("feedbackId", input.feedbackId)
          .eq("kind", input.kind)
          .eq("githubNodeId", input.githubNodeId)
      )
      .unique()

    const values = {
      connectedByProfileId: asId<"profile">(input.connectedByProfileId),
      deletedTime: null,
      feedbackId: asId<"feedback">(input.feedbackId),
      githubDatabaseId: input.githubDatabaseId,
      githubNodeId: input.githubNodeId,
      githubNumber: input.githubNumber,
      githubRepositoryConnectionId: asId<"githubRepositoryConnection">(
        input.githubRepositoryConnectionId
      ),
      kind: input.kind,
      projectId: asId<"project">(input.projectId),
      state: input.state,
      title: input.title,
      updatedTime: Date.now(),
      url: input.url,
    }

    if (existing) {
      if (!existing.deletedTime) {
        throw new CRPCError({
          code: "CONFLICT",
          message: "This GitHub item is already connected to this feedback",
        })
      }
      await ctx.orm
        .update(feedbackGithubConnectionTable)
        .set(values)
        .where(eq(feedbackGithubConnectionTable.id, existing._id as any))
      return { connectionId: existing._id }
    }

    const [connection] = await ctx.orm
      .insert(feedbackGithubConnectionTable)
      .values(values)
      .returning()
    return { connectionId: connection.id }
  })

export const updateConnectionSnapshot = privateMutation
  .input(
    z.object({
      connectionId: idSchema,
      state: githubStateValueSchema,
      title: githubTitleSchema,
      url: githubUrlSchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    await ctx.orm
      .update(feedbackGithubConnectionTable)
      .set({
        state: input.state,
        title: input.title,
        updatedTime: Date.now(),
        url: input.url,
      })
      .where(eq(feedbackGithubConnectionTable.id, input.connectionId as any))

    return { success: true }
  })

async function saveTarget(args: {
  caller: any
  context: Awaited<ReturnType<typeof getVerifiedContext>>
  kind: ConnectionKind
  target: GitHubTarget
}) {
  return await args.caller.saveConnection({
    connectedByProfileId: args.context.profile.id,
    feedbackId: args.context.feedback.id,
    githubDatabaseId:
      "databaseId" in args.target ? args.target.databaseId : undefined,
    githubNodeId: args.target.nodeId,
    githubNumber: args.target.number,
    githubRepositoryConnectionId: args.context.connection.id,
    kind: args.kind,
    projectId: args.context.project.id,
    state: args.target.state,
    title: args.target.title,
    url: args.target.url,
  })
}

export const searchTargets = authAction
  .input(
    z.object({
      feedbackId: idSchema,
      kind: kindSchema,
      query: feedbackSearchSchema.default(""),
    })
  )
  .action(async ({ ctx, input }) => {
    const caller = createFeedbackGithubCaller(ctx)
    const context = await caller.getContextForAction({
      feedbackId: input.feedbackId,
      kind: input.kind,
      userId: ctx.userId,
    })
    const token = await createInstallationToken({
      installationId: context.installation.installationId,
      mode: "read",
      repositoryIds: [context.repository.id],
    })

    const issues = await searchRepositoryIssues({
      query: input.query,
      repository: context.repository,
      token: token.token,
    })
    return issues.map((issue) => ({ ...issue, kind: "issue" as const }))
  })

export const connectExisting = authAction
  .input(
    z.object({
      feedbackId: idSchema,
      feedbackUrl: githubUrlSchema,
      githubNumber: z.number().int(),
      kind: kindSchema,
    })
  )
  .action(async ({ ctx, input }) => {
    const caller = createFeedbackGithubCaller(ctx)
    const context = await caller.getContextForAction({
      feedbackId: input.feedbackId,
      kind: input.kind,
      userId: ctx.userId,
    })
    const token = await createInstallationToken({
      installationId: context.installation.installationId,
      mode: "read_write",
      repositoryIds: [context.repository.id],
    })
    const body = buildKinoConnectionBody({
      feedbackTitle: context.feedback.title,
      feedbackUrl: input.feedbackUrl,
    })

    const issueBeforeComment = await getRepositoryIssue({
      issueNumber: input.githubNumber,
      repository: context.repository,
      token: token.token,
    })
    await caller.ensureNotConnected({
      feedbackId: context.feedback.id,
      githubNodeId: issueBeforeComment.nodeId,
      kind: input.kind,
    })
    await createIssueComment({
      body,
      issueNumber: input.githubNumber,
      repository: context.repository,
      token: token.token,
    })
    const issue = await getRepositoryIssue({
      issueNumber: input.githubNumber,
      repository: context.repository,
      token: token.token,
    })
    return await saveTarget({
      caller,
      context,
      kind: input.kind,
      target: issue,
    })
  })

export const createAndConnect = authAction
  .input(
    z.object({
      body: githubBodySchema.default(""),
      feedbackId: idSchema,
      feedbackUrl: githubUrlSchema,
      kind: kindSchema,
      title: githubTitleSchema,
    })
  )
  .action(async ({ ctx, input }) => {
    const caller = createFeedbackGithubCaller(ctx)
    const context = await caller.getContextForAction({
      feedbackId: input.feedbackId,
      kind: input.kind,
      userId: ctx.userId,
    })
    const token = await createInstallationToken({
      installationId: context.installation.installationId,
      mode: "read_write",
      repositoryIds: [context.repository.id],
    })
    const backlink = buildKinoConnectionBody({
      feedbackTitle: context.feedback.title,
      feedbackUrl: input.feedbackUrl,
    })
    const body = [input.body.trim(), backlink].filter(Boolean).join("\n\n")

    const issue = await createRepositoryIssue({
      body,
      repository: context.repository,
      title: input.title,
      token: token.token,
    })
    return await saveTarget({
      caller,
      context,
      kind: input.kind,
      target: issue,
    })
  })

export const refreshCounts = authAction
  .input(
    z.object({
      feedbackId: idSchema,
    })
  )
  .action(async ({ ctx, input }) => {
    const caller = createFeedbackGithubCaller(ctx)
    const context = await caller.getContextForAction({
      feedbackId: input.feedbackId,
      kind: "issue",
      requireSource: false,
      userId: ctx.userId,
    })
    const token = await createInstallationToken({
      installationId: context.installation.installationId,
      mode: "read",
      repositoryIds: [context.repository.id],
    })
    const connections = await caller.listByFeedback({
      feedbackId: input.feedbackId,
    })

    let updatedCount = 0
    for (const connection of connections) {
      if (connection.kind !== "issue") continue

      const target = await getRepositoryIssue({
        issueNumber: connection.githubNumber,
        repository: context.repository,
        token: token.token,
      })

      if (
        target.state === connection.state &&
        target.title === connection.title &&
        target.url === connection.url
      ) {
        continue
      }

      await caller.updateConnectionSnapshot({
        connectionId: connection.id,
        state: target.state,
        title: target.title,
        url: target.url,
      })
      updatedCount += 1
    }

    return { updatedCount }
  })
