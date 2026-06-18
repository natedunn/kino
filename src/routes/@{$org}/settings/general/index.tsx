import { useMemo } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useForm } from "@tanstack/react-form"
import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { InlineAlert } from "@/components/inline-alert"
import { EmptyState } from "@/components/kino/common"
import { Label, LabelDescription, LabelWrapper } from "@/components/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input-shadcn"
import { useCRPC } from "@/lib/convex/crpc"
import { crpcServer } from "@/lib/convex/crpc-server"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/@{$org}/settings/general/")({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(
      crpcServer.org.getDetails.queryOptions({ slug: params.org })
    )
  },
  component: GeneralSettingsRoute,
})

function GeneralSettingsRoute() {
  const params = Route.useParams()
  const navigate = useNavigate()
  const crpc = useCRPC()
  const slugUrlPrefix = useMemo(() => {
    const siteUrl =
      typeof window === "undefined"
        ? (import.meta.env.VITE_SITE_URL as string | undefined)
        : window.location.origin

    return `${(siteUrl ?? "https://kino.io").replace(/^https?:\/\//, "").replace(/\/$/, "")}/@`
  }, [])
  const orgQuery = useQuery(
    crpc.org.getDetails.queryOptions({
      slug: params.org,
    })
  )
  const updateMutation = useMutation(
    crpc.org.update.mutationOptions({
      onSuccess: (org) => {
        navigate({
          params: { org: org.slug },
          to: "/@{$org}/settings/general",
        })
      },
    })
  )

  const org = orgQuery.data?.org
  const formDefaultValues = useMemo(
    () => ({
      name: org?.name ?? "",
      slug: org?.slug ?? "",
    }),
    [org?.name, org?.slug]
  )

  const form = useForm({
    defaultValues: formDefaultValues,
    onSubmit: async ({ value }) => {
      const org = orgQuery.data?.org
      if (!org) return

      await updateMutation.mutateAsync({
        currentSlug: org.slug,
        name: value.name.trim(),
        updatedSlug: value.slug.trim(),
      })
    },
  })

  if (orgQuery.isLoading) {
    return <div className="h-64 animate-pulse rounded-xl border bg-muted/30" />
  }

  if (!orgQuery.data?.org || !orgQuery.data.permissions.canEdit) {
    return (
      <EmptyState
        title="Organization editing unavailable"
        description="Only organization editors can edit this workspace."
      />
    )
  }

  return (
    <section className="max-w-3xl">
      <header className="border-b pb-4">
        <h2 className="text-xl font-semibold">General</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your organization name and the slug used in URLs across Kino.
        </p>
      </header>

      <form
        className={cn("mt-6 flex flex-col gap-6", {
          "pointer-events-none opacity-50": updateMutation.isPending,
        })}
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          void form.handleSubmit()
        }}
      >
        <div className="rounded-xl border bg-card">
          <div className="flex flex-col gap-6 p-6">
            <form.Field name="name">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <LabelWrapper>
                    <Label>Name</Label>
                    <LabelDescription>
                      Displayed across Kino on profiles and project pages.
                    </LabelDescription>
                  </LabelWrapper>
                  <Input
                    autoFocus
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="slug">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <LabelWrapper>
                    <Label>Slug</Label>
                    <LabelDescription>
                      Unique identifier used in your organization URL.
                    </LabelDescription>
                  </LabelWrapper>
                  <div className="flex items-stretch overflow-hidden rounded-md border bg-background focus-within:ring-1 focus-within:ring-ring">
                    <span className="flex items-center bg-muted/60 px-3 font-mono text-sm text-muted-foreground">
                      {slugUrlPrefix}
                    </span>
                    <Input
                      className="rounded-none border-0 bg-transparent focus-visible:ring-0"
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      value={field.state.value}
                    />
                  </div>
                </div>
              )}
            </form.Field>
          </div>

          <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4">
            <p className="text-xs text-muted-foreground">
              Changing the slug will update every link to your organization.
            </p>
            <form.Subscribe
              selector={(state) => ({
                isSubmitting: state.isSubmitting,
                name: state.values.name,
              })}
            >
              {({ isSubmitting, name }) => {
                const visuallyDisabled =
                  !name.trim() || isSubmitting || updateMutation.isPending

                return (
                  <Button
                    className={cn({
                      "opacity-50 grayscale select-none": visuallyDisabled,
                    })}
                    disabled={updateMutation.isPending}
                    type="submit"
                  >
                    {isSubmitting || updateMutation.isPending
                      ? "Saving..."
                      : "Save changes"}
                  </Button>
                )
              }}
            </form.Subscribe>
          </div>
        </div>

        {updateMutation.error ? (
          <InlineAlert variant="danger">
            Unable to update organization: {updateMutation.error.message}
          </InlineAlert>
        ) : null}
      </form>
    </section>
  )
}
