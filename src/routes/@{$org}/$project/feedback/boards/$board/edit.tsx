import { useMemo } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useForm } from "@tanstack/react-form"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"

import { EmptyState } from "@/components/kino/common"
import { InlineAlert } from "@/components/inline-alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input-shadcn"
import { Textarea } from "@/components/ui/textarea"
import ChevronLeft from "@/icons/chevron-left"
import { useCRPC } from "@/lib/convex/crpc"

export const Route = createFileRoute(
  "/@{$org}/$project/feedback/boards/$board/edit"
)({
  component: EditBoardRoute,
})

function EditBoardRoute() {
  const params = Route.useParams()
  const navigate = useNavigate()
  const crpc = useCRPC()

  const projectQuery = useQuery(
    crpc.project.getDetails.queryOptions({
      orgSlug: params.org,
      slug: params.project,
    })
  )
  const boardQuery = useQuery(
    crpc.feedbackBoard.get.queryOptions({
      id: params.board,
      orgSlug: params.org,
      projectSlug: params.project,
    })
  )
  const updateMutation = useMutation(
    crpc.feedbackBoard.update.mutationOptions({
      onSuccess: () => {
        navigate({
          params,
          to: "/@{$org}/$project/settings/boards",
        })
      },
    })
  )
  const deleteMutation = useMutation(
    crpc.feedbackBoard.remove.mutationOptions({
      onSuccess: () => {
        navigate({
          params: { org: params.org, project: params.project },
          to: "/@{$org}/$project/settings/boards",
        })
      },
    })
  )

  const formDefaultValues = useMemo(
    () => ({
      description: boardQuery.data?.description ?? "",
      name: boardQuery.data?.name ?? "",
      slug: boardQuery.data?.slug ?? "",
    }),
    [
      boardQuery.data?.description,
      boardQuery.data?.id,
      boardQuery.data?.name,
      boardQuery.data?.slug,
    ]
  )

  const form = useForm({
    defaultValues: formDefaultValues,
    onSubmit: async ({ value }) => {
      if (!boardQuery.data) return

      await updateMutation.mutateAsync({
        id: boardQuery.data.id,
        description: value.description || undefined,
        name: value.name,
        orgSlug: params.org,
        projectSlug: params.project,
        slug: value.slug,
      })
    },
  })

  if (!projectQuery.data?.permissions.canEdit) {
    return (
      <EmptyState
        title="Board editing unavailable"
        description="Only project editors can edit feedback boards."
      />
    )
  }

  if (!boardQuery.data) {
    return (
      <EmptyState
        title="Board not found"
        description="The selected board could not be loaded."
      />
    )
  }
  return (
    <div className="container">
      <div className="space-y-6 py-12">
        <Link
          className="link-text inline-flex items-center gap-2 text-muted-foreground hocus:text-foreground"
          params={{ org: params.org, project: params.project }}
          to="/@{$org}/$project/settings/boards"
        >
          <ChevronLeft className="size-3" />
          Back to all boards
        </Link>
        <h1 className="text-3xl font-bold">Edit Board</h1>
        <div>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault()
              event.stopPropagation()
              void form.handleSubmit()
            }}
          >
            <form.Field name="name">
              {(field) => (
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Name</label>
                  <p className="text-sm text-muted-foreground">
                    Name of your public board. Must be unique to your project.
                  </p>
                  <Input
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="slug">
              {(field) => (
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Slug</label>
                  <p className="text-sm text-muted-foreground">
                    Must be unique to your project. Changing this may break old
                    permalinks.
                  </p>
                  <Input
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="description">
              {(field) => (
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Description</label>
                  <p className="text-sm text-muted-foreground">
                    Describe the purpose for the board so that your users know
                    where to add their feedback.
                  </p>
                  <Textarea
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>
            {updateMutation.error ? (
              <InlineAlert variant="danger">
                Unable to update board: {updateMutation.error.message}
              </InlineAlert>
            ) : null}
            <div className="flex items-center justify-between gap-4">
              <form.Subscribe
                selector={(state) => ({
                  isSubmitting: state.isSubmitting,
                  name: state.values.name,
                  slug: state.values.slug,
                })}
              >
                {({ isSubmitting, name, slug }) => {
                  const disabled =
                    !name.trim() ||
                    !slug.trim() ||
                    isSubmitting ||
                    updateMutation.isPending

                  return (
                    <Button disabled={disabled} type="submit">
                      {isSubmitting || updateMutation.isPending
                        ? "Updating..."
                        : "Update board"}
                    </Button>
                  )
                }}
              </form.Subscribe>
              <Button
                disabled={deleteMutation.isPending}
                onClick={() => {
                  const project = projectQuery.data?.project
                  if (!project) return
                  if (
                    window.confirm(
                      "Delete this board? Feedback items in this board will be removed too."
                    )
                  ) {
                    deleteMutation.mutate({
                      boardId: boardQuery.data.id,
                      projectId: project.id,
                    })
                  }
                }}
                type="button"
                variant="destructive"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete Board"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
