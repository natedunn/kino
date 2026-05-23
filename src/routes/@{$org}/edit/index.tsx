import { useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';

import { EmptyState } from '@/components/kino/common';
import { InlineAlert } from '@/components/inline-alert';
import { Label, LabelDescription, LabelWrapper } from '@/components/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input-shadcn';
import { useCRPC } from '@/lib/convex/crpc';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/@{$org}/edit/')({
  component: EditOrganizationRoute,
});

function EditOrganizationRoute() {
  const params = Route.useParams();
  const navigate = useNavigate();
  const crpc = useCRPC();
  const orgQuery = useQuery(
    crpc.org.getDetails.queryOptions({
      slug: params.org,
    })
  );
  const updateMutation = useMutation(
    crpc.org.update.mutationOptions({
      onSuccess: (org) => {
        navigate({
          params: { org: org.slug },
          to: '/@{$org}',
        });
      },
    })
  );

  const form = useForm({
    defaultValues: {
      name: '',
      slug: '',
    },
    onSubmit: async ({ value }) => {
      const org = orgQuery.data?.org;
      if (!org) return;

      await updateMutation.mutateAsync({
        currentSlug: org.slug,
        name: value.name.trim(),
        updatedSlug: value.slug.trim(),
      });
    },
  });

  const org = orgQuery.data?.org;

  useEffect(() => {
    if (!org) return;
    form.reset({
      name: org.name,
      slug: org.slug,
    });
  }, [form, org?._id]);

  if (orgQuery.isLoading) {
    return null;
  }

  if (!orgQuery.data?.org || !orgQuery.data.permissions.canEdit) {
    return (
      <div className="container py-10">
        <EmptyState
          title="Organization editing unavailable"
          description="Only organization editors can edit this workspace."
        />
      </div>
    );
  }

  return (
    <div>
      <div className="border-b bg-muted/50">
        <div className="container pt-12 pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold md:text-3xl">Edit Organization</h1>
            </div>
          </div>
        </div>
      </div>
      <div className="container py-6">
        <Link
          className="link-text inline-flex items-center gap-2 text-sm opacity-75 hocus:opacity-100"
          params={{ org: org.slug }}
          to="/@{$org}"
        >
          <ArrowLeft className="size-3" />
          Back to organization
        </Link>
        <div className="mt-6 border-t pt-6">
          <form
            className={cn('flex flex-col gap-6', {
              'pointer-events-none opacity-50': updateMutation.isPending,
            })}
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
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
                    !name.trim() || isSubmitting || updateMutation.isPending;

                  return (
                    <Button
                      className={cn({
                        'opacity-50 grayscale select-none': visuallyDisabled,
                      })}
                      disabled={updateMutation.isPending}
                      type="submit"
                    >
                      {isSubmitting || updateMutation.isPending ? 'Updating...' : 'Update'}
                    </Button>
                  );
                }}
              </form.Subscribe>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
