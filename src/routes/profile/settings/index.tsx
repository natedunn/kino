import { useEffect, useState } from 'react';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { Navigate, createFileRoute, useRouterState } from '@tanstack/react-router';

import { InlineAlert } from '@/components/inline-alert';
import { Label, LabelWrapper } from '@/components/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input-shadcn';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcOptions } from '@/lib/convex/crpc-options';
import { fetchConvexLoaderQuery } from '@/lib/convex/server';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/profile/settings/')({
  loader: async ({ context }) => {
    if (!context.loaderToken) {
      return;
    }

    await fetchConvexLoaderQuery(
      context.queryClient,
      crpcOptions.profile.findMyProfile.staticQueryOptions({}),
      context.loaderToken
    );
  },
  component: ProfileSettingsRoute,
});

function ProfileSettingsRoute() {
  const { loaderToken } = Route.useRouteContext();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  if (!loaderToken) {
    return <Navigate search={{ redirect: pathname }} to="/auth" />;
  }

  return <AuthenticatedProfileSettingsRoute />;
}

function AuthenticatedProfileSettingsRoute() {
  const crpc = useCRPC();
  const uploadUrlMutation = useMutation(crpc.profile.generateAvatarUploadUrl.mutationOptions());
  const syncMetadataMutation = useMutation(crpc.profile.syncMetadata.mutationOptions());
  const updateMutation = useMutation(crpc.profile.update.mutationOptions());
  const [formError, setFormError] = useState<string | null>(null);
  const profileQuery = useSuspenseQuery(
    crpc.profile.findMyProfile.queryOptions({})
  );
  const profile = profileQuery.data;

  const form = useForm({
    defaultValues: {
      avatarFile: null as File | null,
      name: '',
      username: '',
    },
    onSubmit: async ({ value, formApi }) => {
      if (!profile) return;
      setFormError(null);

      try {
        let imageKey: string | undefined;
        if (value.avatarFile) {
          const { key, url } = await uploadUrlMutation.mutateAsync({});
          const response = await fetch(url, {
            body: value.avatarFile,
            headers: { 'Content-Type': value.avatarFile.type },
            method: 'PUT',
          });

          if (!response.ok) {
            throw new Error('Avatar upload failed');
          }

          await syncMetadataMutation.mutateAsync({ key });
          imageKey = key;
        }

        const updatedProfile = await updateMutation.mutateAsync({
          profile: {
            ...(imageKey ? { imageKey } : {}),
          },
          user: {
            name: value.name,
            username: value.username,
          },
        });

        formApi.reset({
          avatarFile: null,
          name: updatedProfile.name ?? value.name,
          username: updatedProfile.username ?? value.username,
        });
        await profileQuery.refetch();
      } catch (error) {
        setFormError(error instanceof Error ? error.message : 'Unable to update profile');
      }
    },
  });

  useEffect(() => {
    if (!profile) return;
    form.reset({
      avatarFile: null,
      name: profile.name ?? '',
      username: profile.username ?? '',
    });
  }, [form, profile?.id, profile?.name, profile?.username]);

  if (!profile) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="container py-12">
        <h1 className="text-2xl font-bold">Edit profile</h1>
        <div className="mt-6">
          <form
            className="flex flex-col gap-6"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <form.Field name="avatarFile">
              {(field) => {
                const avatarPreviewUrl = field.state.value
                  ? URL.createObjectURL(field.state.value)
                  : null;

                return (
                  <div className="flex items-end gap-3">
                    <div className="flex flex-1 flex-col gap-2">
                      <LabelWrapper>
                        <Label>Avatar</Label>
                      </LabelWrapper>
                      <div className="flex items-center gap-4">
                        {field.state.value || profile.imageUrl ? (
                          <Avatar className="size-16 rounded-lg">
                            <AvatarImage
                              alt={profile.name ?? profile.username ?? ''}
                              src={
                                field.state.value
                                  ? avatarPreviewUrl ?? undefined
                                  : profile.imageUrl ?? undefined
                              }
                            />
                            <AvatarFallback className="rounded-lg">
                              {profile.name?.[0] ?? profile.username?.[0]}
                            </AvatarFallback>
                          </Avatar>
                        ) : null}
                        <div className="flex items-center">
                          <Input
                            className="h-auto! py-4 file:h-auto file:leading-4 hocus:bg-accent/50"
                            onChange={(event) => {
                              if (event.target.files?.[0]) {
                                field.handleChange(event.target.files[0]);
                              }
                            }}
                            type="file"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }}
            </form.Field>

            <form.Field name="username">
              {(field) => (
                <div className="flex items-end gap-3">
                  <div className="flex flex-1 flex-col gap-2">
                    <LabelWrapper>
                      <Label>Username</Label>
                    </LabelWrapper>
                    <Input onChange={(event) => field.handleChange(event.target.value)} value={field.state.value} />
                  </div>
                </div>
              )}
            </form.Field>

            <form.Field name="name">
              {(field) => (
                <div className="flex items-end gap-3">
                  <div className="flex flex-1 flex-col gap-2">
                    <LabelWrapper>
                      <Label>Name</Label>
                    </LabelWrapper>
                    <Input onChange={(event) => field.handleChange(event.target.value)} value={field.state.value} />
                  </div>
                </div>
              )}
            </form.Field>

            <div className="flex items-end gap-3">
              <div className="flex flex-1 flex-col gap-2">
                <LabelWrapper>
                  <Label>Email</Label>
                </LabelWrapper>
                <Input disabled value={profile.email ?? ''} />
              </div>
            </div>

            {formError ? <InlineAlert variant="danger">{formError}</InlineAlert> : null}

            <div className="flex items-center gap-2">
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => {
                  const disabled =
                    isSubmitting ||
                    updateMutation.isPending ||
                    uploadUrlMutation.isPending ||
                    syncMetadataMutation.isPending;

                  return (
                    <Button
                      className={cn({
                        'opacity-50 grayscale select-none': disabled,
                      })}
                      type="submit"
                    >
                      {disabled ? 'Updating...' : 'Update'}
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
