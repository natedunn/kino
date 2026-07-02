import { z } from "zod"
import { authAction } from "../lib/crpc"
import { createInstallationToken, fetchRepository } from "../lib/github-client"
import { idSchema } from "../lib/validation"
import { createProjectCaller } from "./generated/project.runtime"

// Read-only helper for the "Add from GitHub" button. Being an action, it can
// mint an installation token and hit the GitHub REST API for the repo's
// homepage. It writes NOTHING — the client stages the returned links in the
// form and they persist (and get re-verified) only on Save.
export const importGithubUrls = authAction
  .input(z.object({ id: idSchema }))
  .action(async ({ ctx, input }) => {
    const caller = createProjectCaller(ctx)
    const prep = await caller.prepareGithubUrlImport({
      id: input.id,
      userId: ctx.userId,
    })

    const token = await createInstallationToken({
      installationId: prep.installationId,
      mode: "read",
      repositoryIds: [prep.repoId],
    })
    const repository = await fetchRepository({
      fullName: prep.repoFullName,
      token: token.token,
    })

    // The repo URL is the verifiable link; its "homepage" is a free-text field
    // the client adds as a normal editable link (only when a real http(s) URL).
    const homepage = repository.homepage?.trim()
    return {
      homepage: homepage && /^https?:\/\//i.test(homepage) ? homepage : null,
      repoUrl: repository.htmlUrl,
    }
  })
