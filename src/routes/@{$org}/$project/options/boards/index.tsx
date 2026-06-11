import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"

import { EmptyState } from "@/components/kino/common"
import { buttonVariants } from "@/components/ui/button"
import { Icon, type IconName } from "@/icons"
import Eye from "@/icons/eye"
import Pen from "@/icons/pen"
import { useCRPC } from "@/lib/convex/crpc"

export const Route = createFileRoute("/@{$org}/$project/options/boards/")({
  component: BoardsIndexRoute,
})

function BoardsIndexRoute() {
  const params = Route.useParams()
  const crpc = useCRPC()

  const projectQuery = useQuery(
    crpc.project.getDetails.queryOptions({
      orgSlug: params.org,
      slug: params.project,
    })
  )
  const boardsQuery = useQuery(
    crpc.feedbackBoard.listProjectBoards.queryOptions(
      {
        projectId: projectQuery.data?.project?.id,
      },
      { enabled: !!projectQuery.data?.project?.id }
    )
  )

  const boards = boardsQuery.data ?? []

  if (!projectQuery.data?.project && projectQuery.isLoading) {
    return <div className="h-48 animate-pulse rounded-lg bg-muted/40" />
  }

  if (!projectQuery.data?.project || !projectQuery.data.permissions.canEdit) {
    return (
      <EmptyState
        title="Board management unavailable"
        description="Only project editors can manage feedback boards."
      />
    )
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Boards</h2>
          <p className="text-sm text-muted-foreground">
            Manage the feedback boards available in this project.
          </p>
        </div>
        <Link
          className={buttonVariants({ variant: "default" })}
          params={params}
          to="/@{$org}/$project/feedback/boards/new"
        >
          Create board
        </Link>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {boards.length === 0 ? (
          <div className="col-span-12 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No boards have been created yet.
          </div>
        ) : (
          boards.map((board) => (
            <div key={board.id} className="col-span-12 md:col-span-6">
              <div className="flex h-full flex-col justify-center gap-2 rounded-lg border bg-muted p-6">
                <div className="flex items-start gap-6">
                  <div className="mt-1">
                    <Icon
                      fallback="box"
                      name={(board.icon as IconName | null) ?? "box"}
                      size="32px"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-lg font-bold">{board.name}</span>
                    <span className="text-muted-foreground">
                      {board.description ?? (
                        <span className="opacity-50">No description added</span>
                      )}
                    </span>
                    <div className="mt-4 flex flex-wrap items-center gap-4">
                      <Link
                        className="link-text flex items-center gap-2"
                        params={{ ...params, board: board.id }}
                        to="/@{$org}/$project/feedback/boards/$board/edit"
                      >
                        <Pen className="text-muted-foreground" size="14px" />
                        Edit
                      </Link>
                      <Link
                        className="link-text flex items-center gap-2"
                        params={{ org: params.org, project: params.project }}
                        search={{ board: board.slug }}
                        to="/@{$org}/$project/feedback"
                      >
                        <Eye className="text-muted-foreground" size="14px" />
                        View
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
