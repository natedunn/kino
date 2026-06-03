import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Eye, EyeClosed } from 'lucide-react';

import { EmptyState } from '@/components/kino/common';
import { InlineAlert } from '@/components/inline-alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input-shadcn';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select-shadcn';
import { useCRPC } from '@/lib/convex/crpc';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/@{$org}/create-project/')({
  component: CreateProjectRoute,
});

function CreateProjectRoute() {
  const params = Route.useParams();
  const navigate = useNavigate();
  const crpc = useCRPC();

  const orgQuery = useQuery(
    crpc.org.getDetails.queryOptions({
      slug: params.org,
    })
  );
  const limitsQuery = useQuery(
    crpc.org.getMyPermission.queryOptions(
      { slug: params.org },
      { enabled: !!orgQuery.data?.permissions.canCreate, skipUnauth: true }
    )
  );

  const createMutation = useMutation(
    crpc.project.create.mutationOptions({
      onSuccess: (project) => {
        form.reset();
        navigate({
          params: { org: params.org, project: project.slug },
          to: '/@{$org}/$project',
        });
      },
    })
  );

  const form = useForm({
    defaultValues: {
      name: '',
      orgSlug: params.org,
      slug: '',
      visibility: 'public' as 'public' | 'private',
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync({
        name: value.name,
        orgSlug: value.orgSlug,
        slug: value.slug,
        visibility: value.visibility,
      });
    },
  });

  if (orgQuery.isLoading || limitsQuery.isLoading) {
    return <div className="container py-10"><div className="h-56 animate-pulse rounded-lg bg-muted/40" /></div>;
  }

  if (!orgQuery.data?.org || !orgQuery.data.permissions.canCreate) {
    return (
      <div className="container py-10">
        <EmptyState
          title="Project creation unavailable"
          description="Only organization admins can create projects here."
        />
      </div>
    );
  }

  const { org } = orgQuery.data;
  const enabled = !!limitsQuery.data?.canAddProjects;

  return (
    <div className="flex flex-auto flex-col">
      <div className="container flex flex-auto flex-col">
        <div className="grid flex-1 grid-cols-12">
          <div className="col-span-3 border-r">
            <form.Subscribe selector={(state) => state.values}>
              {(values) => (
                <div className="relative flex flex-col pr-6">
                  <div className="relative z-10 mx-auto rounded-b-lg bg-foreground/10 px-2 py-0.5 text-sm text-muted-foreground">
                    Preview
                  </div>
                  <div className="absolute inset-x-0 top-0 h-64 bg-linear-to-tr from-background to-foreground/10" />
                  <div className="z-10 flex w-full flex-col items-center justify-center pt-10">
                    <Avatar className="size-24 border">
                      <AvatarFallback className="rounded-lg text-xl font-bold">
                        {values.name?.[0]?.toUpperCase() ?? '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={cn('mt-3 w-full text-center text-2xl font-bold', {
                        'text-muted-foreground': !enabled || !values.name,
                      })}
                    >
                      {values.name || 'Unnamed'}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-sm">
                      {values.visibility === 'public' ? (
                        <>
                          <Eye className="size-4" />
                          <span>Public</span>
                        </>
                      ) : (
                        <>
                          <EyeClosed className="size-4" />
                          <span>Private</span>
                        </>
                      )}
                    </div>
                    <div className="mt-3 rounded-lg border bg-muted px-1 py-0.5 text-sm">
                      <span className="text-muted-foreground">@{params.org}/</span>
                      <span className="text-foreground">{values.slug || '...'}</span>
                    </div>
                  </div>
                </div>
              )}
            </form.Subscribe>
          </div>
          <div className="col-span-9 p-6 md:p-12">
            <h1 className="inline-flex flex-wrap items-center gap-y-1 text-3xl font-bold">
              <span className="mr-2 inline-block">Create a new project for</span>
              <span className="inline-flex items-center gap-2 rounded-lg px-2 text-foreground">
                <Avatar className="size-6 rounded-full border border-primary">
                  <AvatarFallback className="rounded-lg">{org.name[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="text-gradient-primary">{org.name}</span>
              </span>
            </h1>

            <div className="mt-10">
              {!enabled ? (
                <InlineAlert className="mb-6" variant="warning">
                  Maximum projects created. Please <a className="link-text" href="#">change your plan</a> or contact support if you believe this is an error.
                </InlineAlert>
              ) : null}

              <form
                className={cn('flex flex-col gap-6', {
                  'pointer-events-none opacity-50': !enabled,
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
                        <label className="text-sm font-medium">Project name</label>
                        <p className="text-sm text-muted-foreground">Name of your project.</p>
                        <Input
                          autoFocus
                          disabled={!enabled}
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
                        <label className="text-sm font-medium">Project Slug</label>
                        <p className="text-sm text-muted-foreground">
                          Will be be used in URL of your project. Must be unique to your organization.
                        </p>
                        <div className="flex items-stretch">
                          <div className="flex items-center rounded-l-lg border-y border-l border-border bg-muted px-3 text-sm">
                            <span className="text-muted-foreground">usekino.com/@{params.org}/</span>
                          </div>
                          <Input
                            className="rounded-l-none"
                            disabled={!enabled}
                            onChange={(event) => field.handleChange(event.target.value)}
                            value={field.state.value}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </form.Field>

                <form.Field name="visibility">
                  {(field) => (
                    <div className="flex items-end gap-3">
                      <div className="flex flex-1 flex-col gap-2">
                        <label className="text-sm font-medium">Visibility</label>
                        <p className="text-sm text-muted-foreground">Make your project public or private.</p>
                        <Select
                          value={field.state.value}
                          disabled={!enabled}
                          onValueChange={(value) => field.handleChange(value as 'public' | 'private')}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Select visibility" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="public">Public</SelectItem>
                            <SelectItem value="private">Private</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </form.Field>

                {createMutation.error ? (
                  <InlineAlert variant="danger">Unable to create project: {createMutation.error.message}</InlineAlert>
                ) : null}

                <form.Subscribe
                  selector={(state) => ({
                    isSubmitting: state.isSubmitting,
                    name: state.values.name,
                    slug: state.values.slug,
                  })}
                >
                  {(state) => {
                    const disabled =
                      !enabled || !state.name || !state.slug || state.isSubmitting || createMutation.isPending;

                    return (
                      <div className="flex items-center gap-2">
                        <Button
                          className={cn({
                            'opacity-50 grayscale select-none': disabled,
                          })}
                          disabled={disabled}
                          type="submit"
                        >
                          {createMutation.isPending ? 'Creating...' : 'Create Project'}
                        </Button>
                      </div>
                    );
                  }}
                </form.Subscribe>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
