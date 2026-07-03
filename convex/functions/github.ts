import { z } from "zod"
import { CRPCError } from "kitcn/server"
import { eq } from "kitcn/orm"
import {
  authMutation,
  authQuery,
  privateMutation,
  privateQuery,
} from "../lib/crpc"
import { toPublicDoc, verifyOrgAccess } from "../lib/kino"
import {
  createGitHubAppState,
  githubAppInstallationUrl,
  githubAppUserAuthorizationUrl,
  resolveGitHubCallbackTargetUrl,
  sha256Hex,
  verifyGitHubAppStateForCurrentTarget,
} from "../lib/github-client"
import {
  feedbackGithubConnectionTable,
  githubConnectionStateTable,
  githubInstallationTable,
  githubRepositoryConnectionTable,
  githubWebhookDeliveryTable,
} from "./schema"
import {
  callbackTargetUrlSchema,
  githubStateSchema,
  idSchema,
  orgSlugSchema,
  projectSlugSchema,
  webhookActionSchema,
  webhookDeliveryIdSchema,
  webhookEventSchema,
} from "../lib/validation"
import {
  connectionModeSchema,
  getProjectBySlugs,
  githubInstallationSchema,
  githubRepositorySchema,
  sourceSchema,
  verificationSummarySchema,
  verifyOrgAdmin,
  verifyOrgAdminForProject,
  webhookInstallationSchema,
  webhookIssueSchema,
} from "./github.lib"

export const startProjectConnection = authMutation
  .input(
    z.object({
      callbackTargetUrl: callbackTargetUrlSchema.optional(),
      mode: connectionModeSchema.default("read"),
      orgSlug: orgSlugSchema,
      projectSlug: projectSlugSchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { organization, profile, project } = await verifyOrgAdminForProject(
      ctx,
      {
        orgSlug: input.orgSlug,
        projectSlug: input.projectSlug,
        userId: ctx.userId,
      }
    )

    const nonce = crypto.randomUUID()
    const now = Date.now()
    const expiresAt = now + 10 * 60 * 1000
    const state = await createGitHubAppState({
      exp: expiresAt,
      nonce,
      targetUrl: resolveGitHubCallbackTargetUrl(input.callbackTargetUrl),
    })

    await ctx.orm.insert(githubConnectionStateTable).values({
      createdByProfileId: profile._id as any,
      createdByUserId: ctx.userId,
      expiresAt,
      mode: input.mode,
      orgId: organization.id,
      orgSlug: organization.slug,
      projectId: project._id,
      projectSlug: project.slug,
      stateHash: await sha256Hex(nonce),
      status: "pending",
      updatedTime: now,
    })

    return {
      installUrl: githubAppInstallationUrl(state),
    }
  })

export const startOrgConnection = authMutation
  .input(
    z.object({
      callbackTargetUrl: callbackTargetUrlSchema.optional(),
      mode: connectionModeSchema.default("read"),
      orgSlug: orgSlugSchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { organization, profile } = await verifyOrgAdmin(ctx, {
      orgSlug: input.orgSlug,
      userId: ctx.userId,
    })

    const nonce = crypto.randomUUID()
    const now = Date.now()
    const expiresAt = now + 10 * 60 * 1000
    const state = await createGitHubAppState({
      exp: expiresAt,
      nonce,
      targetUrl: resolveGitHubCallbackTargetUrl(input.callbackTargetUrl),
    })

    await ctx.orm.insert(githubConnectionStateTable).values({
      createdByProfileId: profile._id as any,
      createdByUserId: ctx.userId,
      expiresAt,
      mode: input.mode,
      orgId: organization.id,
      orgSlug: organization.slug,
      stateHash: await sha256Hex(nonce),
      status: "pending",
      updatedTime: now,
    })

    return {
      installUrl: githubAppInstallationUrl(state),
    }
  })

export const startInstallationRefresh = authMutation
  .input(
    z.object({
      callbackTargetUrl: callbackTargetUrlSchema.optional(),
      mode: connectionModeSchema.default("read"),
      orgSlug: orgSlugSchema,
      projectSlug: projectSlugSchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { organization, profile, project } = await verifyOrgAdminForProject(
      ctx,
      {
        orgSlug: input.orgSlug,
        projectSlug: input.projectSlug,
        userId: ctx.userId,
      }
    )

    const nonce = crypto.randomUUID()
    const now = Date.now()
    const expiresAt = now + 10 * 60 * 1000
    const state = await createGitHubAppState({
      exp: expiresAt,
      nonce,
      targetUrl: resolveGitHubCallbackTargetUrl(input.callbackTargetUrl),
    })

    await ctx.orm.insert(githubConnectionStateTable).values({
      createdByProfileId: profile._id as any,
      createdByUserId: ctx.userId,
      expiresAt,
      mode: input.mode,
      orgId: organization.id,
      orgSlug: organization.slug,
      projectId: project._id,
      projectSlug: project.slug,
      stateHash: await sha256Hex(nonce),
      status: "pending",
      updatedTime: now,
    })

    return {
      authorizeUrl: githubAppUserAuthorizationUrl(state),
    }
  })

export const startOrgInstallationRefresh = authMutation
  .input(
    z.object({
      callbackTargetUrl: callbackTargetUrlSchema.optional(),
      mode: connectionModeSchema.default("read"),
      orgSlug: orgSlugSchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { organization, profile } = await verifyOrgAdmin(ctx, {
      orgSlug: input.orgSlug,
      userId: ctx.userId,
    })

    const nonce = crypto.randomUUID()
    const now = Date.now()
    const expiresAt = now + 10 * 60 * 1000
    const state = await createGitHubAppState({
      exp: expiresAt,
      nonce,
      targetUrl: resolveGitHubCallbackTargetUrl(input.callbackTargetUrl),
    })

    await ctx.orm.insert(githubConnectionStateTable).values({
      createdByProfileId: profile._id as any,
      createdByUserId: ctx.userId,
      expiresAt,
      mode: input.mode,
      orgId: organization.id,
      orgSlug: organization.slug,
      stateHash: await sha256Hex(nonce),
      status: "pending",
      updatedTime: now,
    })

    return {
      authorizeUrl: githubAppUserAuthorizationUrl(state),
    }
  })

export const getProjectIntegration = authQuery
  .input(
    z.object({
      orgSlug: orgSlugSchema,
      projectSlug: projectSlugSchema,
    })
  )
  .query(async ({ ctx, input }) => {
    const project = await getProjectBySlugs(ctx, input)
    if (!project) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Project not found" })
    }

    const access = await verifyOrgAccess(ctx, {
      slug: input.orgSlug,
      userId: ctx.userId,
    })
    if (!access.organization) {
      return { installations: [] }
    }

    if (!access.permissions.canCreate) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Only organization admins can view GitHub connections",
      })
    }

    const [rawInstallations, rawConnections] = await Promise.all([
      ctx.db
        .query("githubInstallation")
        .withIndex("by_orgId", (q: any) =>
          q.eq("orgId", access.organization.id)
        )
        .take(100),
      ctx.db
        .query("githubRepositoryConnection")
        .withIndex("by_projectId", (q: any) => q.eq("projectId", project._id))
        .take(20),
    ])
    const installations = rawInstallations
      .filter((installation: any) => installation.status === "active")
      .slice(0, 20)
    const connections = rawConnections.filter(
      (connection: any) => !connection.deletedTime
    )
    return {
      connections: connections.map(toPublicDoc),
      installations: installations.map(toPublicDoc),
    }
  })

export const getOrgIntegration = authQuery
  .input(
    z.object({
      orgSlug: orgSlugSchema,
    })
  )
  .query(async ({ ctx, input }) => {
    const access = await verifyOrgAccess(ctx, {
      slug: input.orgSlug,
      userId: ctx.userId,
    })
    if (!access.organization || !access.permissions.canCreate) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Only organization admins can view GitHub connections",
      })
    }

    const rawInstallations = await ctx.db
      .query("githubInstallation")
      .withIndex("by_orgId", (q: any) => q.eq("orgId", access.organization.id))
      .take(100)
    const installations = rawInstallations
      .filter((installation: any) => installation.status === "active")
      .slice(0, 20)
    return {
      installations: installations.map(toPublicDoc),
    }
  })

export const getRefreshInstallationsForCallback = privateQuery
  .input(
    z.object({
      state: githubStateSchema,
    })
  )
  .query(async ({ ctx, input }) => {
    const statePayload = await verifyGitHubAppStateForCurrentTarget(input.state)
    const stateHash = await sha256Hex(statePayload.nonce)
    const stateDoc = await ctx.db
      .query("githubConnectionState")
      .withIndex("by_stateHash", (q: any) => q.eq("stateHash", stateHash))
      .unique()
    if (!stateDoc || stateDoc.status !== "pending") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "GitHub connection state is invalid",
      })
    }
    if (stateDoc.expiresAt < Date.now()) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "GitHub connection state expired",
      })
    }

    const installations = await ctx.db
      .query("githubInstallation")
      .withIndex("by_orgId", (q: any) => q.eq("orgId", stateDoc.orgId))
      .take(100)

    return {
      installations: installations
        .filter((installation: any) => installation.status === "active")
        .map((installation: any) => ({
          installationId: installation.installationId,
        })),
      orgSlug: stateDoc.orgSlug,
      projectSlug: stateDoc.projectSlug,
    }
  })

export const getInstallationForExternal = privateQuery
  .input(
    z.object({
      installationId: z.number().int(),
      orgSlug: orgSlugSchema,
      userId: idSchema,
    })
  )
  .query(async ({ ctx, input }) => {
    const access = await verifyOrgAccess(ctx, {
      slug: input.orgSlug,
      userId: input.userId,
    })
    if (!access.organization || !access.permissions.canCreate) {
      throw new CRPCError({
        code: "FORBIDDEN",
        message: "Only organization admins can use this installation",
      })
    }

    const installation = await ctx.db
      .query("githubInstallation")
      .withIndex("by_orgId_installationId", (q: any) =>
        q
          .eq("orgId", access.organization.id)
          .eq("installationId", input.installationId)
      )
      .unique()
    if (!installation || installation.status !== "active") {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "GitHub installation not found",
      })
    }

    return {
      installation: toPublicDoc(installation),
      organization: access.organization,
    }
  })

export const completeInstallationCallback = privateMutation
  .input(
    z.object({
      installation: githubInstallationSchema,
      setupAction: z.string().trim().max(40).optional(),
      state: githubStateSchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    const statePayload = await verifyGitHubAppStateForCurrentTarget(input.state)
    const stateHash = await sha256Hex(statePayload.nonce)
    const stateDoc = await ctx.db
      .query("githubConnectionState")
      .withIndex("by_stateHash", (q: any) => q.eq("stateHash", stateHash))
      .unique()
    if (!stateDoc || stateDoc.status !== "pending") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "GitHub connection state is invalid",
      })
    }
    if (stateDoc.expiresAt < Date.now()) {
      await ctx.orm
        .update(githubConnectionStateTable)
        .set({
          status: "expired",
          updatedTime: Date.now(),
        })
        .where(eq(githubConnectionStateTable.id, stateDoc._id))
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "GitHub connection state expired",
      })
    }
    if (!input.installation.account) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "GitHub installation is missing account data",
      })
    }

    const existing = await ctx.db
      .query("githubInstallation")
      .withIndex("by_orgId_installationId", (q: any) =>
        q
          .eq("orgId", stateDoc.orgId)
          .eq("installationId", input.installation.id)
      )
      .unique()

    const values = {
      accountId: input.installation.account.id,
      accountLogin: input.installation.account.login,
      accountType: input.installation.account.type,
      connectedByProfileId: stateDoc.createdByProfileId,
      events: input.installation.events,
      installationId: input.installation.id,
      orgId: stateDoc.orgId,
      orgSlug: stateDoc.orgSlug,
      permissions: input.installation.permissions,
      repositorySelection: input.installation.repository_selection,
      status:
        input.setupAction === "remove"
          ? ("deleted" as const)
          : ("active" as const),
      updatedTime: Date.now(),
    }

    if (existing) {
      await ctx.orm
        .update(githubInstallationTable)
        .set(values)
        .where(eq(githubInstallationTable.id, existing._id))
    } else {
      await ctx.orm.insert(githubInstallationTable).values(values)
    }

    await ctx.orm
      .update(githubConnectionStateTable)
      .set({
        consumedAt: Date.now(),
        status: "consumed",
        updatedTime: Date.now(),
      })
      .where(eq(githubConnectionStateTable.id, stateDoc._id))

    return {
      mode: stateDoc.mode,
      orgSlug: stateDoc.orgSlug,
      projectSlug: stateDoc.projectSlug,
    }
  })

export const completeUserInstallationsCallback = privateMutation
  .input(
    z.object({
      deletedInstallationIds: z.array(z.number().int()).max(100).default([]),
      installations: z.array(githubInstallationSchema).max(100),
      state: githubStateSchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    const statePayload = await verifyGitHubAppStateForCurrentTarget(input.state)
    const stateHash = await sha256Hex(statePayload.nonce)
    const stateDoc = await ctx.db
      .query("githubConnectionState")
      .withIndex("by_stateHash", (q: any) => q.eq("stateHash", stateHash))
      .unique()
    if (!stateDoc || stateDoc.status !== "pending") {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "GitHub connection state is invalid",
      })
    }
    if (stateDoc.expiresAt < Date.now()) {
      await ctx.orm
        .update(githubConnectionStateTable)
        .set({
          status: "expired",
          updatedTime: Date.now(),
        })
        .where(eq(githubConnectionStateTable.id, stateDoc._id))
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "GitHub connection state expired",
      })
    }

    const now = Date.now()
    let savedCount = 0
    for (const installation of input.installations) {
      if (!installation.account) continue

      const existing = await ctx.db
        .query("githubInstallation")
        .withIndex("by_orgId_installationId", (q: any) =>
          q.eq("orgId", stateDoc.orgId).eq("installationId", installation.id)
        )
        .unique()

      const values = {
        accountId: installation.account.id,
        accountLogin: installation.account.login,
        accountType: installation.account.type,
        connectedByProfileId: stateDoc.createdByProfileId,
        events: installation.events,
        installationId: installation.id,
        orgId: stateDoc.orgId,
        orgSlug: stateDoc.orgSlug,
        permissions: installation.permissions,
        repositorySelection: installation.repository_selection,
        status: "active" as const,
        updatedTime: now,
      }

      if (existing) {
        await ctx.orm
          .update(githubInstallationTable)
          .set(values)
          .where(eq(githubInstallationTable.id, existing._id))
      } else {
        await ctx.orm.insert(githubInstallationTable).values(values)
      }
      savedCount += 1
    }

    let deletedCount = 0
    const deletedInstallationIds = new Set(input.deletedInstallationIds)
    for (const installationId of deletedInstallationIds) {
      const existing = await ctx.db
        .query("githubInstallation")
        .withIndex("by_orgId_installationId", (q: any) =>
          q.eq("orgId", stateDoc.orgId).eq("installationId", installationId)
        )
        .unique()
      if (!existing || existing.status === "deleted") continue

      await ctx.orm
        .update(githubInstallationTable)
        .set({
          status: "deleted",
          updatedTime: now,
        })
        .where(eq(githubInstallationTable.id, existing._id))
      deletedCount += 1
    }

    await ctx.orm
      .update(githubConnectionStateTable)
      .set({
        consumedAt: now,
        status: "consumed",
        updatedTime: now,
      })
      .where(eq(githubConnectionStateTable.id, stateDoc._id))

    return {
      deletedInstallationCount: deletedCount,
      installationCount: savedCount,
      mode: stateDoc.mode,
      orgSlug: stateDoc.orgSlug,
      projectSlug: stateDoc.projectSlug,
    }
  })

export const saveRepositoryConnection = privateMutation
  .input(
    z.object({
      enabledSources: z.array(sourceSchema).min(1).max(2),
      installationId: z.number().int(),
      mode: connectionModeSchema,
      orgSlug: orgSlugSchema,
      projectSlug: projectSlugSchema,
      repository: githubRepositorySchema,
      userId: idSchema,
      verificationSummary: verificationSummarySchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { organization, profile, project } = await verifyOrgAdminForProject(
      ctx,
      {
        orgSlug: input.orgSlug,
        projectSlug: input.projectSlug,
        userId: input.userId,
      }
    )
    const installation = await ctx.db
      .query("githubInstallation")
      .withIndex("by_orgId_installationId", (q: any) =>
        q
          .eq("orgId", organization.id)
          .eq("installationId", input.installationId)
      )
      .unique()
    if (!installation || installation.status !== "active") {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "GitHub installation not found",
      })
    }

    const existingForRepo = await ctx.db
      .query("githubRepositoryConnection")
      .withIndex("by_orgId_repoId", (q: any) =>
        q.eq("orgId", organization.id).eq("repoId", input.repository.id)
      )
      .unique()
    if (
      existingForRepo &&
      !existingForRepo.deletedTime &&
      existingForRepo.projectId !== project._id
    ) {
      throw new CRPCError({
        code: "CONFLICT",
        message:
          "This GitHub repository is already connected to another Kino project",
      })
    }

    const now = Date.now()
    const values = {
      connectedByProfileId: profile._id as any,
      deletedTime: null,
      discussionsVerifiedAt: input.verificationSummary.discussions.ok
        ? now
        : undefined,
      enabledSources: input.enabledSources,
      githubInstallationId: installation._id,
      issuesVerifiedAt: input.verificationSummary.issues.ok ? now : undefined,
      mode: input.mode,
      orgId: organization.id,
      orgSlug: organization.slug,
      projectId: project._id,
      projectSlug: project.slug,
      repoFullName: input.repository.full_name,
      repoId: input.repository.id,
      repoName: input.repository.name,
      repoNodeId: input.repository.node_id,
      repoOwner: input.repository.owner.login,
      repoPrivate: input.repository.private,
      updatedTime: now,
      verificationStatus: "verified",
      verificationSummary: input.verificationSummary,
    }

    const projectConnections = await ctx.db
      .query("githubRepositoryConnection")
      .withIndex("by_projectId", (q: any) => q.eq("projectId", project._id))
      .take(20)

    await Promise.all(
      projectConnections
        .filter(
          (connection: any) =>
            !connection.deletedTime && connection._id !== existingForRepo?._id
        )
        .map((connection: any) =>
          ctx.orm
            .update(githubRepositoryConnectionTable)
            .set({
              deletedTime: now,
              updatedTime: now,
            })
            .where(eq(githubRepositoryConnectionTable.id, connection._id))
        )
    )

    if (existingForRepo) {
      await ctx.orm
        .update(githubRepositoryConnectionTable)
        .set(values)
        .where(
          eq(githubRepositoryConnectionTable.id, existingForRepo._id as any)
        )
      return { connectionId: existingForRepo._id }
    }

    const [connection] = await ctx.orm
      .insert(githubRepositoryConnectionTable)
      .values(values)
      .returning()
    return { connectionId: connection.id }
  })

export const disconnectRepository = authMutation
  .input(
    z.object({
      connectionId: idSchema,
      orgSlug: orgSlugSchema,
      projectSlug: projectSlugSchema,
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { organization, project } = await verifyOrgAdminForProject(ctx, {
      orgSlug: input.orgSlug,
      projectSlug: input.projectSlug,
      userId: ctx.userId,
    })
    const connections = await ctx.db
      .query("githubRepositoryConnection")
      .withIndex("by_projectId", (q: any) => q.eq("projectId", project._id))
      .take(20)
    const connection = connections.find(
      (item: any) =>
        item._id === input.connectionId &&
        item.orgId === organization.id &&
        !item.deletedTime
    )

    if (!connection) {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "GitHub repository connection not found",
      })
    }

    await ctx.orm
      .update(githubRepositoryConnectionTable)
      .set({
        deletedTime: Date.now(),
        updatedTime: Date.now(),
      })
      .where(eq(githubRepositoryConnectionTable.id, connection._id))

    return { success: true }
  })

/**
 * Webhook deliveries arrive via the relay broadcast, so this env may receive
 * events for installations it has never seen — that is normal, not an error.
 * Deliveries are deduped on GitHub's delivery GUID (relay retries, GitHub
 * redeliveries). Only `installation` lifecycle events mutate state today;
 * issue events update any linked feedback connection snapshots.
 */
export const processWebhookEvent = privateMutation
  .input(
    z.object({
      action: webhookActionSchema,
      deliveryId: webhookDeliveryIdSchema,
      event: webhookEventSchema,
      installation: webhookInstallationSchema.optional(),
      issue: webhookIssueSchema.optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const existing = await ctx.db
      .query("githubWebhookDelivery")
      .withIndex("by_deliveryId", (q: any) =>
        q.eq("deliveryId", input.deliveryId)
      )
      .unique()
    if (existing) {
      return { duplicate: true, result: existing.result }
    }

    const now = Date.now()
    let result: "processed" | "ignored" = "ignored"

    if (input.event === "installation" && input.installation) {
      const installations = await ctx.db
        .query("githubInstallation")
        .withIndex("by_installationId", (q: any) =>
          q.eq("installationId", input.installation!.id)
        )
        .take(50)

      const updates: Record<string, unknown> | null =
        input.action === "deleted"
          ? { status: "deleted" }
          : input.action === "suspend"
            ? { status: "suspended" }
            : input.action === "unsuspend"
              ? { status: "active" }
              : input.action === "new_permissions_accepted"
                ? {
                    ...(input.installation.events
                      ? { events: input.installation.events }
                      : {}),
                    ...(input.installation.permissions
                      ? { permissions: input.installation.permissions }
                      : {}),
                  }
                : null

      if (updates && installations.length > 0) {
        for (const installation of installations) {
          await ctx.orm
            .update(githubInstallationTable)
            .set({
              ...updates,
              updatedTime: now,
            })
            .where(eq(githubInstallationTable.id, installation._id))
        }
        result = "processed"
      }
    }

    if (
      (input.event === "issues" || input.event === "issue_comment") &&
      input.issue
    ) {
      const repositoryConnections = await ctx.db
        .query("githubRepositoryConnection")
        .withIndex("by_repoId", (q: any) =>
          q.eq("repoId", input.issue!.repositoryId)
        )
        .take(50)

      let updatedCount = 0
      for (const repositoryConnection of repositoryConnections) {
        if (repositoryConnection.deletedTime) continue

        const feedbackConnections = await ctx.db
          .query("feedbackGithubConnection")
          .withIndex("by_githubRepositoryConnectionId_githubNodeId", (q: any) =>
            q
              .eq("githubRepositoryConnectionId", repositoryConnection._id)
              .eq("githubNodeId", input.issue!.nodeId)
          )
          .take(50)

        for (const feedbackConnection of feedbackConnections) {
          if (feedbackConnection.deletedTime) continue

          if (
            feedbackConnection.githubNumber === input.issue.number &&
            feedbackConnection.state === input.issue.state &&
            feedbackConnection.title === input.issue.title &&
            feedbackConnection.url === input.issue.url
          ) {
            continue
          }

          await ctx.orm
            .update(feedbackGithubConnectionTable)
            .set({
              githubNumber: input.issue.number,
              state: input.issue.state,
              title: input.issue.title,
              updatedTime: now,
              url: input.issue.url,
            })
            .where(eq(feedbackGithubConnectionTable.id, feedbackConnection._id))
          updatedCount += 1
        }
      }

      if (updatedCount > 0) {
        result = "processed"
      }
    }

    await ctx.orm.insert(githubWebhookDeliveryTable).values({
      action: input.action,
      deliveryId: input.deliveryId,
      event: input.event,
      installationId: input.installation?.id,
      receivedTime: now,
      result,
    })

    return { duplicate: false, result }
  })
