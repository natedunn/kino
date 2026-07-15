import { useRef, useState } from "react"
import { revalidateLogic, useForm } from "@tanstack/react-form"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  Link,
  Navigate,
  createFileRoute,
  getRouteApi,
  useNavigate,
} from "@tanstack/react-router"
import { ArrowLeft, LinkIcon, Settings2, Tag } from "lucide-react"

import {
  CategoryField,
  RelatedFeedbackField,
  TagsField,
  UpdateEditorCard,
  UpdateTitleInput,
} from "../-components/update-editor-fields"
import type { UpdateCategory } from "../-components/category-badge"
import { LazyMarkdownEditor } from "@/components/editor/markdown-editor.lazy"
import { sanitizeEditorContent } from "@/components/editor/sanitize-content"
import { InlineAlert } from "@/components/inline-alert"
import { SidebarSection } from "@/components/sidebar-section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { authClient } from "@/lib/convex/auth-client"
import { useCRPC } from "@/lib/convex/crpc"
import { useSidebarState } from "@/lib/hooks/use-sidebar-state"
import { projectTitle, titleMeta } from "@/lib/seo"
import { cn } from "@/lib/utils"
import {
  FORM_LIMITS,
  updateFormSchema,
  validationMessage,
} from "@/lib/validation"

const SIDEBAR_STORAGE_KEY = "update-new-sidebar-state"

const DEFAULT_SIDEBAR_STATE = {
  relatedFeedback: false,
  settings: true,
  tags: true,
}

const routeApi = getRouteApi("/@{$org}/$project/updates/new/")

export const Route = createFileRoute("/@{$org}/$project/updates/new/")({
  component: NewUpdateRoute,
  head: ({ params }) => ({
    meta: [titleMeta(["New Update", projectTitle(params.org, params.project)])],
  }),
})

function NewUpdateRoute() {
  const params = routeApi.useParams()
  const navigate = useNavigate()
  const crpc = useCRPC()
  const session = authClient.useSession()
  const [formError, setFormError] = useState("")
  const pendingPublishRef = useRef<null | { id: string; slug: string }>(null)
  const { state: sidebarState, setSection: setSidebarSection } =
    useSidebarState(SIDEBAR_STORAGE_KEY, DEFAULT_SIDEBAR_STATE)

  const projectQuery = useQuery(
    crpc.project.getDetails.queryOptions({
      orgSlug: params.org,
      slug: params.project,
    })
  )
  const createMutation = useMutation(
    crpc.update.create.mutationOptions({
      onError: (error) => setFormError(error.message),
    })
  )
  const publishMutation = useMutation(
    crpc.update.publish.mutationOptions({
      onSuccess: () => {
        const created = pendingPublishRef.current
        pendingPublishRef.current = null
        form.reset()
        navigate({
          params: { ...params, slug: created?.slug ?? "" },
          to: "/@{$org}/$project/updates/$slug",
        })
      },
      onError: (error) => setFormError(error.message),
    })
  )

  const form = useForm({
    defaultValues: {
      category: "changelog" as UpdateCategory,
      content: "",
      relatedFeedbackIds: [] as Array<string>,
      tags: [] as Array<string>,
      title: "",
    },
    onSubmit: async ({ value }) => {
      setFormError("")
      const project = projectQuery.data?.project
      if (!project) return
      const parsed = updateFormSchema.safeParse({
        content: sanitizeEditorContent(value.content),
        tags: value.tags,
        title: value.title,
      })
      if (!parsed.success) {
        setFormError(validationMessage(parsed.error))
        return
      }

      const data = await createMutation.mutateAsync({
        category: value.category,
        content: parsed.data.content,
        projectId: project.id,
        relatedFeedbackIds:
          value.relatedFeedbackIds.length > 0
            ? value.relatedFeedbackIds
            : undefined,
        tags: parsed.data.tags,
        title: parsed.data.title,
      })
      form.reset()
      navigate({
        params: { ...params, slug: data.slug },
        to: "/@{$org}/$project/updates/$slug",
      })
    },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "change",
    }),
  })

  if (!session.data?.user) {
    return (
      <InlineAlert variant="warning">Sign in to write updates.</InlineAlert>
    )
  }

  if (projectQuery.isLoading) {
    return <div className="h-48 animate-pulse rounded-lg bg-muted/40" />
  }

  if (!projectQuery.data?.permissions?.canEdit) {
    return (
      <Navigate
        params={{ org: params.org, project: params.project }}
        to="/@{$org}/$project/updates"
      />
    )
  }

  const project = projectQuery.data.project

  const publishFromDraft = async () => {
    setFormError("")
    const value = {
      category: form.getFieldValue("category"),
      content: form.getFieldValue("content"),
      relatedFeedbackIds: form.getFieldValue("relatedFeedbackIds"),
      tags: form.getFieldValue("tags"),
      title: form.getFieldValue("title"),
    }
    if (!value.title.trim() || !sanitizeEditorContent(value.content)) return

    try {
      const parsed = updateFormSchema.safeParse({
        content: sanitizeEditorContent(value.content),
        tags: value.tags,
        title: value.title,
      })
      if (!parsed.success) {
        setFormError(validationMessage(parsed.error))
        return
      }
      const created = await createMutation.mutateAsync({
        category: value.category,
        content: parsed.data.content,
        projectId: project.id,
        relatedFeedbackIds:
          value.relatedFeedbackIds.length > 0
            ? value.relatedFeedbackIds
            : undefined,
        tags: parsed.data.tags,
        title: parsed.data.title,
      })
      pendingPublishRef.current = { id: created.updateId, slug: created.slug }
      await publishMutation.mutateAsync({ id: created.updateId })
    } catch {}
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void form.handleSubmit()
      }}
    >
      {/* Sticky header bar */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
        <div className="container flex items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              aria-label="Back to Updates"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              params={{ org: params.org, project: params.project }}
              to="/@{$org}/$project/updates"
            >
              <ArrowLeft className="size-3.5" />
              <span aria-hidden="true" className="hidden sm:inline">
                Updates
              </span>
            </Link>
            <Separator className="h-4" orientation="vertical" />
            <span className="text-sm font-medium text-muted-foreground">
              New Update
            </span>
            <Badge
              className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
              variant="outline"
            >
              Draft
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <form.Subscribe
              selector={(state) => ({
                content: state.values.content,
                isSubmitting: state.isSubmitting,
                title: state.values.title,
              })}
            >
              {({ content, isSubmitting, title }) => {
                const missingRequired =
                  !title.trim() || !sanitizeEditorContent(content)
                const savingDisabled =
                  missingRequired || isSubmitting || createMutation.isPending
                const publishingDisabled =
                  missingRequired ||
                  isSubmitting ||
                  createMutation.isPending ||
                  publishMutation.isPending

                return (
                  <>
                    <Button
                      className={cn({
                        "opacity-50 grayscale select-none": savingDisabled,
                      })}
                      disabled={savingDisabled}
                      size="sm"
                      type="submit"
                      variant="outline"
                    >
                      {createMutation.isPending ? "Saving..." : "Save as Draft"}
                    </Button>
                    <Button
                      className={cn({
                        "opacity-50 grayscale select-none": publishingDisabled,
                      })}
                      disabled={publishingDisabled}
                      onClick={() => void publishFromDraft()}
                      size="sm"
                      type="button"
                    >
                      {publishMutation.isPending ? "Publishing..." : "Publish"}
                    </Button>
                  </>
                )
              }}
            </form.Subscribe>
          </div>
        </div>
      </div>

      {formError ? (
        <div className="container pt-4">
          <InlineAlert variant="danger">
            Unable to create update: {formError}
          </InlineAlert>
        </div>
      ) : null}

      {/* Two-column layout */}
      <div className="container flex-1 grid-cols-12 gap-8 md:grid">
        {/* Sidebar */}
        <div className="order-first border-l border-border/75 py-6 md:order-last md:col-span-4">
          <div className="sticky top-16 flex flex-col gap-6 pl-8">
            <SidebarSection
              icon={<Settings2 className="size-3.5" />}
              onOpenChange={(open) => setSidebarSection("settings", open)}
              open={sidebarState.settings}
              title="Settings"
            >
              <form.Field name="category">
                {(field) => (
                  <CategoryField
                    onValueChange={(value) => field.handleChange(value)}
                    value={field.state.value}
                  />
                )}
              </form.Field>
            </SidebarSection>

            <SidebarSection
              icon={<Tag className="size-3.5" />}
              onOpenChange={(open) => setSidebarSection("tags", open)}
              open={sidebarState.tags}
              title="Tags"
            >
              <form.Field name="tags">
                {(field) => (
                  <TagsField
                    onChange={(tags) => field.handleChange(tags)}
                    value={field.state.value}
                  />
                )}
              </form.Field>
            </SidebarSection>

            <SidebarSection
              icon={<LinkIcon className="size-3.5" />}
              onOpenChange={(open) =>
                setSidebarSection("relatedFeedback", open)
              }
              open={sidebarState.relatedFeedback}
              title="Related Feedback"
            >
              <form.Field name="relatedFeedbackIds">
                {(field) => (
                  <RelatedFeedbackField
                    onChange={(ids) => field.handleChange(ids)}
                    projectId={project.id}
                    selectedIds={field.state.value}
                  />
                )}
              </form.Field>
            </SidebarSection>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex flex-col gap-6 py-8 md:col-span-8">
          <UpdateEditorCard
            editor={
              <form.Field name="content">
                {(field) => (
                  <LazyMarkdownEditor
                    ariaLabel="Update content"
                    minHeight="200px"
                    onChange={(html) => field.handleChange(html)}
                    placeholder="Write your update content..."
                    value={field.state.value}
                    variant="borderless"
                  />
                )}
              </form.Field>
            }
            title={
              <form.Field name="title">
                {(field) => (
                  <UpdateTitleInput
                    autoFocus
                    maxLength={FORM_LIMITS.updateTitle}
                    onChange={(value) => field.handleChange(value)}
                    value={field.state.value}
                  />
                )}
              </form.Field>
            }
          />
        </div>
      </div>
    </form>
  )
}
