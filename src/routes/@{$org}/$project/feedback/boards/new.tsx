import { useMutation, useQuery } from "@tanstack/react-query"
import { useForm } from "@tanstack/react-form"
import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { EmptyState, slugify } from "@/components/kino/common"
import { InlineAlert } from "@/components/inline-alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input-shadcn"
import { Textarea } from "@/components/ui/textarea"
import { useCRPC } from "@/lib/convex/crpc"

export const Route = createFileRoute("/@{$org}/$project/feedback/boards/new")({
  component: NewBoardRoute,
})

function NewBoardRoute() {
  const params = Route.useParams()
  const navigate = useNavigate()
  const crpc = useCRPC()

  const projectQuery = useQuery(
    crpc.project.getDetails.queryOptions({
      orgSlug: params.org,
      slug: params.project,
    })
  )
  const createMutation = useMutation(
    crpc.feedbackBoard.create.mutationOptions({
      onSuccess: () => {
        navigate({
          params,
          to: "/@{$org}/$project/options/boards",
        })
      },
    })
  )

  const form = useForm({
    defaultValues: {
      description: "",
      name: "",
    },
    onSubmit: async ({ value }) => {
      const project = projectQuery.data?.project
      if (!project) return

      await createMutation.mutateAsync({
        description: value.description || undefined,
        name: value.name,
        projectId: project.id,
        slug: slugify(value.name),
      })
    },
  })

  if (!projectQuery.data?.project || !projectQuery.data.permissions.canEdit) {
    return (
      <EmptyState
        title="Board creation unavailable"
        description="Only project editors can create new feedback boards."
      />
    )
  }

  return (
    <div className="container">
      <div className="py-6">
        <h1 className="text-3xl font-bold">
          Create a new board for project {projectQuery.data.project.name}
        </h1>
        <div className="mt-4">
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
            <form.Field name="description">
              {(field) => (
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Description</label>
                  <p className="text-sm text-muted-foreground">
                    Describe what feedback should belong in this board.
                  </p>
                  <Textarea
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>
            <form.Subscribe selector={(state) => state.values.name}>
              {(name) => (
                <div className="hidden">
                  <Input readOnly value={slugify(name)} />
                </div>
              )}
            </form.Subscribe>
            {createMutation.error ? (
              <InlineAlert variant="danger">
                Unable to create board: {createMutation.error.message}
              </InlineAlert>
            ) : null}
            <div className="flex items-center gap-3">
              <form.Subscribe
                selector={(state) => ({
                  isSubmitting: state.isSubmitting,
                  name: state.values.name,
                })}
              >
                {({ isSubmitting, name }) => {
                  const nextSlug = slugify(name)
                  const disabled =
                    !name.trim() ||
                    !nextSlug ||
                    isSubmitting ||
                    createMutation.isPending

                  return (
                    <Button disabled={disabled} type="submit">
                      {isSubmitting || createMutation.isPending
                        ? "Creating..."
                        : "Create"}
                    </Button>
                  )
                }}
              </form.Subscribe>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
