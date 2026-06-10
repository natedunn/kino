import { z } from "zod"
import { CRPCError } from "kitcn/server"
import { authAction } from "../lib/crpc"
import {
  createInstallationToken,
  listInstallationRepositories,
  probeRepository,
  sanitizeGitHubRepository,
} from "../lib/github"
import { createGithubCaller } from "./generated/github.runtime"

const connectionModeSchema = z.enum(["read", "read_write"])
const sourceSchema = z.enum(["issues", "discussions"])

export const listInstallationRepositoriesForProject = authAction
  .input(
    z.object({
      installationId: z.number().int(),
      orgSlug: z.string(),
    })
  )
  .action(async ({ ctx, input }) => {
    const caller = createGithubCaller(ctx)
    await caller.getInstallationForExternal({
      installationId: input.installationId,
      orgSlug: input.orgSlug,
      userId: ctx.userId,
    })

    const token = await createInstallationToken({
      installationId: input.installationId,
      mode: "read",
    })
    const repositories = await listInstallationRepositories(token.token)
    return repositories.map((repository) => ({
      fullName: repository.full_name,
      id: repository.id,
      name: repository.name,
      nodeId: repository.node_id,
      owner: repository.owner.login,
      private: repository.private,
    }))
  })

export const connectRepository = authAction
  .input(
    z.object({
      enabledSources: z.array(sourceSchema).min(1).default(["issues"]),
      installationId: z.number().int(),
      mode: connectionModeSchema.default("read"),
      orgSlug: z.string(),
      projectSlug: z.string(),
      repoId: z.number().int(),
    })
  )
  .action(async ({ ctx, input }) => {
    const caller = createGithubCaller(ctx)
    await caller.getInstallationForExternal({
      installationId: input.installationId,
      orgSlug: input.orgSlug,
      userId: ctx.userId,
    })

    const token = await createInstallationToken({
      installationId: input.installationId,
      mode: input.mode,
      repositoryIds: [input.repoId],
    })
    const repositories = await listInstallationRepositories(token.token)
    const repository = repositories.find((item) => item.id === input.repoId)
    if (!repository) {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "GitHub repository is not available to this installation",
      })
    }

    const probe = await probeRepository({
      mode: input.mode,
      repository,
      token: token.token,
    })

    if (
      input.enabledSources.includes("discussions") &&
      !probe.discussions.enabled
    ) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "GitHub Discussions are not enabled for this repository",
      })
    }

    return await caller.saveRepositoryConnection({
      enabledSources: input.enabledSources,
      installationId: input.installationId,
      mode: input.mode,
      orgSlug: input.orgSlug,
      projectSlug: input.projectSlug,
      repository: sanitizeGitHubRepository(repository),
      userId: ctx.userId,
      verificationSummary: {
        discussions: probe.discussions,
        issues: probe.issues,
      },
    })
  })
