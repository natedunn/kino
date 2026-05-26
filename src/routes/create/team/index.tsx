import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import {
  Navigate,
  createFileRoute,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';

import { InlineAlert } from '@/components/inline-alert';
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
import { crpcOptions } from '@/lib/convex/crpc-options';
import { fetchConvexLoaderQuery } from '@/lib/convex/server';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/create/team/')({
  loader: async ({ context }) => {
    if (!context.loaderToken) {
      return;
    }

    await fetchConvexLoaderQuery(
      context.queryClient,
      crpcOptions.org.findMyOrgs.staticQueryOptions({}),
      context.loaderToken
    );
  },
  component: CreateTeamRoute,
});

function CreateTeamRoute() {
  const { loaderToken } = Route.useRouteContext();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  if (!loaderToken) {
    return <Navigate search={{ redirect: pathname }} to="/auth" />;
  }

  return <AuthenticatedCreateTeamRoute />;
}

function AuthenticatedCreateTeamRoute() {
  const navigate = useNavigate();
  const crpc = useCRPC();
  const [formError, setFormError] = useState<string>();
  const { data: orgsData } = useSuspenseQuery(
    crpc.org.findMyOrgs.queryOptions({})
  );
  const createMutation = useMutation(
    crpc.org.create.mutationOptions({
      onError: (error) => setFormError(error.message),
      onSuccess: (org) => {
        form.reset();
        navigate({ params: { org: org.slug }, to: '/@{$org}' });
      },
    })
  );

  const form = useForm({
    defaultValues: {
      logo: '',
      name: '',
      slug: '',
      visibility: 'public' as 'public' | 'private',
    },
    onSubmit: async ({ value }) => {
      setFormError(undefined);
      await createMutation.mutateAsync({
        ...(value.logo ? { logo: value.logo } : {}),
        name: value.name,
        slug: value.slug,
        visibility: value.visibility,
      });
    },
  });

  const underLimit = orgsData?.underLimit ?? true;

  return (
    <div className="relative w-full">
      <div className="absolute top-0 right-0 left-0 z-0 h-64 w-full bg-linear-to-t from-background to-muted" />
      <div className="relative z-10 mx-auto max-w-2xl px-10 py-12">
        <div>
          <h1 className="text-3xl font-bold">Create a team</h1>
          {!underLimit ? (
            <InlineAlert className="mt-6" variant="warning">
              Maximum teams created. Please <a className="link-text" href="#">change your plan</a> or contact support.
            </InlineAlert>
          ) : null}
          <form
            className={cn('mt-6 flex flex-col gap-6', {
              'pointer-events-none opacity-50': !underLimit,
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
                    <label className="text-sm font-medium">Team name</label>
                    <Input
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
                    <label className="text-sm font-medium">Slug</label>
                    <Input
                      onChange={(event) => field.handleChange(event.target.value)}
                      value={field.state.value}
                    />
                  </div>
                </div>
              )}
            </form.Field>

            <form.Field name="visibility">
              {(field) => (
                <div className="flex items-end gap-3">
                  <div className="flex flex-1 flex-col gap-2">
                    <label className="text-sm font-medium">Visibility</label>
                    <Select
                      defaultValue="public"
                      onValueChange={(value) => field.handleChange(value as 'public' | 'private')}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Sort by..." />
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

            {formError ? <InlineAlert variant="danger">{formError}</InlineAlert> : null}

            <div className="flex items-center gap-2">
              <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                {([canSubmit, isSubmitting]) => (
                  <Button
                    className={cn({ 'opacity-50 grayscale select-none': !canSubmit })}
                    disabled={!underLimit || createMutation.isPending}
                    type="submit"
                  >
                    {isSubmitting || createMutation.isPending ? 'Creating...' : 'Create Team'}
                  </Button>
                )}
              </form.Subscribe>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
