import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Trash2 } from "lucide-react"

import { InlineAlert } from "@/components/inline-alert"
import { EmptyState } from "@/components/kino/common"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input-shadcn"
import { useCRPC } from "@/lib/convex/crpc"
import { crpcServer } from "@/lib/convex/crpc-server"

export const Route = createFileRoute("/@{$org}/$project/settings/members/")({
  loader: async ({ context, params }) => {
    const details = await context.queryClient.ensureQueryData(
      crpcServer.project.getDetails.queryOptions({
        orgSlug: params.org,
        slug: params.project,
      })
    )
    const projectId = (details as { project?: { id?: string } } | null)?.project
      ?.id
    if (projectId && context.loaderToken) {
      await context.queryClient.ensureQueryData(
        crpcServer.projectMember.listProjectMembers.queryOptions({ projectId })
      )
    }
  },
  component: ProjectMembersRoute,
})

function mutationErrorMessage(error: unknown) {
  if (!error) return null
  const anyError = error as { data?: { message?: string }; message?: string }
  return anyError.data?.message ?? anyError.message ?? "Something went wrong"
}

function ProjectMembersRoute() {
  const params = Route.useParams()
  const crpc = useCRPC()

  const detailsQuery = useQuery(
    crpc.project.getDetails.queryOptions({
      orgSlug: params.org,
      slug: params.project,
    })
  )

  const project = detailsQuery.data?.project
  const projectId = project?.id
  const canEdit = detailsQuery.data?.permissions.canEdit ?? false

  const membersQuery = useQuery(
    crpc.projectMember.listProjectMembers.queryOptions(
      { projectId: projectId ?? "" },
      { enabled: !!projectId && canEdit }
    )
  )

  const invite = useMutation(
    crpc.projectMember.inviteProjectMember.mutationOptions()
  )
  const removeMember = useMutation(
    crpc.projectMember.removeProjectMember.mutationOptions()
  )

  const [email, setEmail] = useState("")

  if (detailsQuery.isLoading) {
    return <div className="h-64 animate-pulse rounded-xl border bg-muted/30" />
  }

  if (!project || !projectId) {
    return (
      <EmptyState
        title="Project unavailable"
        description="This project either does not exist or your session cannot view it."
      />
    )
  }

  if (!canEdit) {
    return (
      <EmptyState
        title="Member management unavailable"
        description="Only organization admins and editors can manage project members."
      />
    )
  }

  const isPrivate = project.visibility === "private"
  const members = membersQuery.data?.members ?? []
  const actionError =
    mutationErrorMessage(invite.error) ??
    mutationErrorMessage(removeMember.error)

  return (
    <section className="max-w-3xl">
      <header className="border-b pb-4">
        <h2 className="text-xl font-semibold">Project members</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Give specific people access to this project when it is private. They
          get normal access — view, comment, and submit feedback — just like any
          user on a public project. Org admins and editors already have access
          via the organization.
        </p>
      </header>

      {!isPrivate ? (
        <div className="mt-4">
          <InlineAlert variant="info">
            This project is public, so anyone can already participate — members
            aren’t required. People you add here are saved and take effect if
            you switch the project to private.
          </InlineAlert>
        </div>
      ) : null}

      {/* Invite */}
      <form
        className="mt-6 flex flex-col gap-3 rounded-xl border bg-card p-6 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault()
          if (!email.trim()) return
          invite.mutate(
            { email: email.trim(), projectId },
            { onSuccess: () => setEmail("") }
          )
        }}
      >
        <div className="flex flex-1 flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="member-email">
            Add a member by email
          </label>
          <Input
            id="member-email"
            type="email"
            placeholder="person@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={invite.isPending || !email.trim()}>
          {invite.isPending ? "Adding..." : "Add member"}
        </Button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">
        The person must already have a Kino account.
      </p>

      {actionError ? (
        <div className="mt-4">
          <InlineAlert variant="danger">{actionError}</InlineAlert>
        </div>
      ) : null}

      {/* Members */}
      <div className="mt-8">
        <h3 className="text-sm font-bold text-muted-foreground">
          {members.length} member{members.length === 1 ? "" : "s"}
        </h3>
        {members.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No project members yet.
          </p>
        ) : (
          <div className="mt-3 flex flex-col divide-y rounded-xl border bg-card">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <Avatar className="size-8 shrink-0">
                  {member.profile.imageUrl ? (
                    <AvatarImage src={member.profile.imageUrl} />
                  ) : null}
                  <AvatarFallback className="text-xs font-semibold">
                    {(member.profile.name ??
                      member.profile.username)[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {member.profile.name ?? member.profile.username}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{member.profile.username}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={removeMember.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Remove ${member.profile.name ?? member.profile.username} from this project?`
                      )
                    ) {
                      removeMember.mutate({ projectMemberId: member.id })
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                  <span className="sr-only">Remove member</span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
