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
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/@{$org}/options/general/")({
  component: GeneralOptionsRoute,
})

function GeneralOptionsRoute() {
  const params = Route.useParams()
  const navigate = useNavigate()
  const crpc = useCRPC()
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
          to: "/@{$org}/options/general",
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
    return null
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
    <section className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">General</h2>
        <p className="text-sm text-muted-foreground">
          Update the organization name and slug.
        </p>
      </div>

      <form
        className={cn("flex flex-col gap-6", {
          "pointer-events-none opacity-50": updateMutation.isPending,
        })}
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          void form.handleSubmit()
        }}
      >
        <form.Field name="name">
          {(field) => (
            <div className="flex items-end gap-3">
              <div className="flex flex-1 flex-col gap-2">
                <LabelWrapper>
                  <Label>Name</Label>
                </LabelWrapper>
                <Input
                  autoFocus
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
              </div>
            </div>
          )}
        </form.Field>
        <form.Field name="slug">
          {(field) => (
            <div className="flex items-end gap-3">
              <div className="flex flex-1 flex-col gap-2">
                <LabelWrapper>
                  <Label>Slug</Label>
                  <LabelDescription>
                    Unique identifier for your organization.
                  </LabelDescription>
                </LabelWrapper>
                <Input
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
              </div>
            </div>
          )}
        </form.Field>

        {updateMutation.error ? (
          <InlineAlert variant="danger">
            Unable to update organization: {updateMutation.error.message}
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
                    ? "Updating..."
                    : "Update"}
                </Button>
              )
            }}
          </form.Subscribe>
        </div>
      </form>
    </section>
  )
}
