import { useEffect, useMemo, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { InlineAlert } from '@/components/inline-alert';
import { Label, LabelDescription, LabelWrapper } from '@/components/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ALLOWED_AVATAR_TYPES, validateAvatarFile } from '@/lib/avatar';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { titleMeta } from '@/lib/seo';
import { cn } from '@/lib/utils';
import {
	filterUsernameInput,
	FORM_LIMITS,
	profileFormSchema,
	USERNAME_MIN_LENGTH,
	validationMessage,
} from '@/lib/validation';
import * as m from '@/paraglide/messages.js';

type ProfileSettingsFormValues = {
	avatarFile: File | null;
	name: string;
	username: string;
};

export const Route = createFileRoute('/account/profile/')({
	head: () => ({
		meta: [titleMeta([m.account_profile(), m.account_title()])],
	}),
	loader: async ({ context }) => {
		if (!context.loaderToken) {
			return;
		}

		await context.queryClient.ensureQueryData(
			crpcServer.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
		);
	},
	// Auth is gated by the parent `/account` route (beforeLoad + AccountRoute).
	component: AuthenticatedProfileSettingsRoute,
});

// Manages the object URL lifecycle so the preview blob is revoked instead of
// leaking a new URL on every render.
function AvatarPreview({
	alt,
	fallback,
	file,
	fallbackSrc,
}: {
	alt: string;
	fallback: string;
	file: File | null;
	fallbackSrc?: string;
}) {
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);

	useEffect(() => {
		if (!file) {
			setPreviewUrl(null);
			return;
		}
		const url = URL.createObjectURL(file);
		setPreviewUrl(url);
		return () => URL.revokeObjectURL(url);
	}, [file]);

	return (
		<Avatar className='size-16 rounded-lg border'>
			<AvatarImage alt={alt} src={previewUrl ?? fallbackSrc} />
			<AvatarFallback className='rounded-lg text-lg font-semibold'>{fallback}</AvatarFallback>
		</Avatar>
	);
}

function AuthenticatedProfileSettingsRoute() {
	const crpc = useCRPC();
	const uploadUrlMutation = useMutation(crpc.profile.generateAvatarUploadUrl.mutationOptions());
	const syncMetadataMutation = useMutation(crpc.profile.syncMetadata.mutationOptions());
	const updateMutation = useMutation(crpc.profile.update.mutationOptions());
	const [formError, setFormError] = useState<string | null>(null);
	const profileQuery = useSuspenseQuery(
		crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
	);
	const profile = profileQuery.data;
	const formDefaultValues = useMemo<ProfileSettingsFormValues>(
		() => ({
			avatarFile: null,
			name: profile?.name ?? '',
			username: profile?.username ?? '',
		}),
		[profile?.name, profile?.username]
	);

	const form = useForm({
		defaultValues: formDefaultValues,
		onSubmit: async ({ value, formApi }) => {
			if (!profile) return;
			setFormError(null);

			try {
				const parsed = profileFormSchema.safeParse(value);
				if (!parsed.success) {
					setFormError(validationMessage(parsed.error));
					return;
				}

				let imageKey: string | undefined;
				if (value.avatarFile) {
					const { key, url } = await uploadUrlMutation.mutateAsync({});
					const response = await fetch(url, {
						body: value.avatarFile,
						headers: { 'Content-Type': value.avatarFile.type },
						method: 'PUT',
					});

					if (!response.ok) {
						throw new Error(m.profile_avatar_upload_failed());
					}

					await syncMetadataMutation.mutateAsync({ key });
					imageKey = key;
				}

				const updatedProfile = await updateMutation.mutateAsync({
					profile: {
						...(imageKey ? { imageKey } : {}),
					},
					user: {
						name: parsed.data.name,
						username: parsed.data.username,
					},
				});

				// findMyProfile is a reactive Convex query, so its cache updates on its
				// own once the mutation commits — reset the form from the mutation
				// result instead of forcing an extra non-reactive refetch.
				formApi.reset({
					avatarFile: null,
					name: updatedProfile.name ?? value.name,
					username: updatedProfile.username ?? value.username,
				});
			} catch (error) {
				setFormError(error instanceof Error ? error.message : m.profile_update_failed());
			}
		},
	});

	if (!profile) {
		return null;
	}

	const isSaving =
		updateMutation.isPending || uploadUrlMutation.isPending || syncMetadataMutation.isPending;

	return (
		<section className='max-w-3xl'>
			<header className='border-b pb-4'>
				<h2 className='text-xl font-semibold'>{m.account_profile()}</h2>
				<p className='mt-1 text-sm text-muted-foreground'>{m.profile_description()}</p>
			</header>

			<form
				className={cn('mt-6 flex flex-col gap-6', {
					'pointer-events-none opacity-50': isSaving,
				})}
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					void form.handleSubmit();
				}}
			>
				<div className='rounded-xl border bg-card'>
					<div className='flex flex-col gap-6 p-6'>
						<form.Field name='avatarFile'>
							{(field) => (
								<div className='flex flex-col gap-2'>
									<LabelWrapper>
										<Label>{m.profile_avatar()}</Label>
										<LabelDescription>{m.profile_avatar_description()}</LabelDescription>
									</LabelWrapper>
									<div className='flex items-center gap-4'>
										<AvatarPreview
											alt={profile.name ?? profile.username ?? ''}
											fallback={(profile.name?.[0] ?? profile.username?.[0] ?? '').toUpperCase()}
											fallbackSrc={profile.imageUrl ?? undefined}
											file={field.state.value}
										/>
										<Input
											accept={ALLOWED_AVATAR_TYPES.join(',')}
											className='h-auto! max-w-sm py-4 file:h-auto file:leading-4 hocus:bg-accent/50'
											onChange={async (event) => {
												const file = event.target.files?.[0] ?? null;
												if (!file) {
													field.handleChange(null);
													return;
												}

												const validationError = await validateAvatarFile(file);
												if (validationError) {
													setFormError(validationError);
													field.handleChange(null);
													event.target.value = '';
													return;
												}

												setFormError(null);
												field.handleChange(file);
											}}
											type='file'
										/>
									</div>
								</div>
							)}
						</form.Field>

						<form.Field name='username'>
							{(field) => (
								<div className='flex flex-col gap-2'>
									<LabelWrapper>
										<Label>{m.profile_username()}</Label>
										<LabelDescription>
											{m.profile_username_description_prefix()}{' '}
											<span className='font-medium text-foreground'>
												/u/{field.state.value || 'username'}
											</span>
											. {m.profile_username_description_suffix()}
										</LabelDescription>
									</LabelWrapper>
									<Input
										autoCapitalize='none'
										autoCorrect='off'
										maxLength={FORM_LIMITS.username}
										minLength={USERNAME_MIN_LENGTH}
										onChange={(event) =>
											field.handleChange(
												filterUsernameInput(event.target.value, FORM_LIMITS.username)
											)
										}
										spellCheck={false}
										value={field.state.value}
									/>
									{field.state.value.length > 0 &&
									field.state.value.length < USERNAME_MIN_LENGTH ? (
										<p className='text-xs text-muted-foreground'>
											{m.profile_username_min({ count: USERNAME_MIN_LENGTH })}
										</p>
									) : null}
								</div>
							)}
						</form.Field>

						<form.Field name='name'>
							{(field) => (
								<div className='flex flex-col gap-2'>
									<LabelWrapper>
										<Label>{m.auth_name()}</Label>
										<LabelDescription>{m.profile_name_description()}</LabelDescription>
									</LabelWrapper>
									<Input
										maxLength={FORM_LIMITS.orgName}
										onChange={(event) => field.handleChange(event.target.value)}
										value={field.state.value}
									/>
								</div>
							)}
						</form.Field>

						<div className='flex flex-col gap-2'>
							<LabelWrapper>
								<Label>{m.common_email()}</Label>
								<LabelDescription>{m.profile_email_description()}</LabelDescription>
							</LabelWrapper>
							<Input disabled value={profile.email ?? ''} />
						</div>
					</div>

					<div className='flex items-center justify-end gap-3 border-t bg-muted/30 px-6 py-4'>
						<form.Subscribe selector={(state) => state.isSubmitting}>
							{(isSubmitting) => {
								const disabled = isSubmitting || isSaving;

								return (
									<Button
										className={cn({
											'opacity-50 grayscale select-none': disabled,
										})}
										disabled={disabled}
										type='submit'
									>
										{disabled ? m.common_saving() : m.profile_save_changes()}
									</Button>
								);
							}}
						</form.Subscribe>
					</div>
				</div>

				{formError ? <InlineAlert variant='danger'>{formError}</InlineAlert> : null}
			</form>
		</section>
	);
}
