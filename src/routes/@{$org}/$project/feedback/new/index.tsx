import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useForm } from "@tanstack/react-form"
import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { EmptyState } from "@/components/kino/common"
import { MarkdownEditor, sanitizeEditorContent } from "@/components/editor"
import { InlineAlert } from "@/components/inline-alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { authClient } from "@/lib/convex/auth-client"
import { useCRPC } from "@/lib/convex/crpc"
import { cn } from "@/lib/utils"
import { projectTitle, titleMeta } from "@/lib/seo"
import {
  FORM_LIMITS,
  feedbackFormSchema,
  validationMessage,
} from "@/lib/validation"

export const Route = createFileRoute("/@{$org}/$project/feedback/new/")({
  head: ({ params }) => ({
    meta: [
      titleMeta(["New Feedback", projectTitle(params.org, params.project)]),
    ],
  }),
  component: NewFeedbackRoute,
})

function NewFeedbackRoute() {
  const params = Route.useParams()
  const navigate = useNavigate()
  const crpc = useCRPC()
  const session = authClient.useSession()
  const [formError, setFormError] = useState<string | null>(null)

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
  const createMutation = useMutation(
    crpc.feedback.create.mutationOptions({
      onSuccess: (data) => {
        navigate({
          params: { ...params, slug: data.slug },
          to: "/@{$org}/$project/feedback/$slug",
        })
      },
    })
  )

  const form = useForm({
    defaultValues: {
      boardId: "",
      firstComment: "",
      title: "",
    },
    onSubmit: async ({ value }) => {
      const project = projectQuery.data?.project
      if (!project) return
      setFormError(null)
      const parsed = feedbackFormSchema.safeParse({
        firstComment: sanitizeEditorContent(value.firstComment),
        title: value.title,
      })
      if (!parsed.success) {
        setFormError(validationMessage(parsed.error))
        return
      }

      await createMutation.mutateAsync({
        boardId: value.boardId,
        firstComment: parsed.data.firstComment,
        projectId: project.id,
        title: parsed.data.title,
      })
    },
  })

  const boards = boardsQuery.data ?? []

  if (!session.data?.user) {
    return (
      <EmptyState
        title="Sign in to create feedback"
        description="This route is wired to an authenticated mutation. Open the auth page first, then come back here to post feedback."
      />
    )
  }

  if (!projectQuery.data?.project || !projectQuery.data.permissions.canView) {
    return (
      <EmptyState
        title="Project not available"
        description="The selected project cannot be loaded for feedback creation."
      />
    )
  }

  return (
    <div>
      <div className="border-b bg-muted/50">
        <div className="container pt-12 pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold md:text-3xl">Add Feedback</h1>
            </div>
          </div>
        </div>
      </div>
      <div className="container py-6">
        <form
          className={cn("flex flex-col gap-6", {
            "pointer-events-none opacity-50": createMutation.isPending,
          })}
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <form.Field name="boardId">
            {(field) => {
              const boardItems = boards.map((board) => ({
                label: board.name,
                value: board.id,
              }))

              return (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Board</label>
                  <Select
                    disabled={createMutation.isPending}
                    items={boardItems}
                    onValueChange={(value) => field.handleChange(value ?? "")}
                    value={field.state.value}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select Board" />
                    </SelectTrigger>
                    <SelectContent>
                      {boards.map((board) => (
                        <SelectItem key={board.id} value={board.id}>
                          {board.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            }}
          </form.Field>

          <form.Field name="title">
            {(field) => (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  disabled={createMutation.isPending}
                  maxLength={FORM_LIMITS.feedbackTitle}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="firstComment">
            {(field) => (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Content</label>
                <MarkdownEditor
                  disabled={createMutation.isPending}
                  minHeight="120px"
                  onChange={(html) => field.handleChange(html)}
                  onSubmitShortcut={() => form.handleSubmit()}
                  placeholder="Describe your feedback..."
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>

          {(formError ?? createMutation.error) ? (
            <InlineAlert variant="danger">
              Unable to create feedback:{" "}
              {formError ?? createMutation.error?.message}
            </InlineAlert>
          ) : null}

          <div className="flex items-center gap-3">
            <form.Subscribe
              selector={(state) => ({
                boardId: state.values.boardId,
                firstComment: state.values.firstComment,
                isSubmitting: state.isSubmitting,
                title: state.values.title,
              })}
            >
              {({ boardId, firstComment, isSubmitting, title }) => {
                const visuallyDisabled =
                  !boardId ||
                  !title.trim() ||
                  !sanitizeEditorContent(firstComment) ||
                  isSubmitting ||
                  createMutation.isPending

                return (
                  <Button
                    className={cn({
                      "opacity-50 grayscale select-none": visuallyDisabled,
                    })}
                    disabled={createMutation.isPending}
                    type="submit"
                  >
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
  )
}
