import { useEffect, useMemo, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';

import { InlineAlert } from '@/components/inline-alert';
import { EmptyState } from '@/components/kino/common';
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
	filterSlugInput,
	FORM_LIMITS,
	orgFormSchema,
	SLUG_INPUT_PATTERN,
	validationMessage,
} from '@/lib/validation';

import { SettingsSkeleton } from '../-components/settings-skeleton';
import { useDelayedFlag } from '../-components/use-delayed-flag';
import { persistSettingsOrg, useSettingsOrgSlug } from '../-components/use-settings-org';

type GeneralSettingsFormValues = {
	avatarFile: File | null;
	name: string;
	slug: string;
};

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

export const Route = createFileRoute('/org/settings/general/')({
	head: () => ({
		meta: [titleMeta(['General Settings'])],
	}),
	loader: async ({ context, location }) => {
		const orgSlug = (location.search as { org?: string }).org;
		if (!context.loaderToken || !orgSlug) return;
		const orgData = await context.queryClient.ensureQueryData(
			crpcServer.org.getDetails.queryOptions({ slug: orgSlug }, { skipUnauth: true })
		);
		// Org general settings is edit-only. Bounce non-editors before render.
		if (!orgData?.permissions.canEdit) {
			throw redirect({ to: '/dashboard' });
		}
	},
	component: GeneralSettingsRoute,
});

function GeneralSettingsRoute() {
	const orgSlug = useSettingsOrgSlug();
	const navigate = useNavigate();
	const crpc = useCRPC();
	// Start from the SSR-safe value so the first client render matches the server,
	// then swap to the live origin after mount to avoid a hydration mismatch.
	const [originHost, setOriginHost] = useState<string>(
		() => (import.meta.env.VITE_SITE_URL as string | undefined) ?? 'https://kino.io'
	);
	useEffect(() => {
		setOriginHost(window.location.origin);
	}, []);
	const slugUrlPrefix = useMemo(
		() => `${originHost.replace(/^https?:\/\//, '').replace(/\/$/, '')}/@`,
		[originHost]
	);
	const orgQuery = useQuery(
		crpc.org.getDetails.queryOptions(
			{
				slug: orgSlug ?? '',
			},
			{ enabled: !!orgSlug, skipUnauth: true }
		)
	);
	const updateMutation = useMutation(crpc.org.update.mutationOptions());
	const uploadUrlMutation = useMutation(crpc.org.generateAvatarUploadUrl.mutationOptions());
	const syncMetadataMutation = useMutation(crpc.org.syncAvatarMetadata.mutationOptions());
	const [formError, setFormError] = useState<string | null>(null);

	const org = orgQuery.data?.org;
	const formDefaultValues = useMemo<GeneralSettingsFormValues>(
		() => ({
			avatarFile: null,
			name: org?.name ?? '',
			slug: org?.slug ?? '',
		}),
		[org?.name, org?.slug]
	);

	const form = useForm({
		defaultValues: formDefaultValues,
		onSubmit: async ({ value, formApi }) => {
			const org = orgQuery.data?.org;
			if (!org) return;
			setFormError(null);

			try {
				const parsed = orgFormSchema.safeParse({
					name: value.name,
					slug: value.slug,
					visibility: org.visibility,
				});
				if (!parsed.success) {
					setFormError(validationMessage(parsed.error));
					return;
				}

				if (value.avatarFile) {
					const { key, url } = await uploadUrlMutation.mutateAsync({
						organizationId: org.id,
					});
					const response = await fetch(url, {
						body: value.avatarFile,
						headers: { 'Content-Type': value.avatarFile.type },
						method: 'PUT',
					});

					if (!response.ok) {
						throw new Error('Organization avatar upload failed');
					}

					await syncMetadataMutation.mutateAsync({ key });
				}

				const updatedOrg = await updateMutation.mutateAsync({
					currentSlug: org.slug,
					name: parsed.data.name,
					updatedSlug: parsed.data.slug || undefined,
				});

				formApi.reset({
					avatarFile: null,
					name: updatedOrg.name ?? value.name,
					slug: updatedOrg.slug ?? value.slug,
				});

				if (updatedOrg.slug && updatedOrg.slug !== orgSlug) {
					persistSettingsOrg(updatedOrg.slug);
					await navigate({
						replace: true,
						search: (prev) => ({ ...prev, org: updatedOrg.slug }),
						to: '/org/settings/general',
					});
				}
			} catch (error) {
				setFormError(error instanceof Error ? error.message : 'Unable to update organization');
			}
		},
	});

	const isLoading = !orgSlug || orgQuery.isLoading;
	const showSkeleton = useDelayedFlag(isLoading);
	if (isLoading) {
		return showSkeleton ? <SettingsSkeleton /> : null;
	}

	if (!orgQuery.data?.org || !orgQuery.data.permissions.canEdit) {
		return (
			<EmptyState
				title='Organization editing unavailable'
				description='Only organization editors can edit this workspace.'
			/>
		);
	}

	return (
		<section className='max-w-3xl'>
			<header className='border-b pb-4'>
				<h2 className='text-xl font-semibold'>General</h2>
				<p className='mt-1 text-sm text-muted-foreground'>
					Update your organization name and the slug used in URLs across Kino.
				</p>
			</header>

			<form
				className={cn('mt-6 flex flex-col gap-6', {
					'pointer-events-none opacity-50':
						updateMutation.isPending ||
						uploadUrlMutation.isPending ||
						syncMetadataMutation.isPending,
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
										<Label>Avatar</Label>
										<LabelDescription>
											Used anywhere this organization appears in Kino. JPEG, PNG, or WebP, up to 5
											MB.
										</LabelDescription>
									</LabelWrapper>
									<div className='flex items-center gap-4'>
										<AvatarPreview
											alt={org.name}
											fallback={org.name[0]?.toUpperCase() ?? ''}
											fallbackSrc={org.logo ?? undefined}
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

						<form.Field name='name'>
							{(field) => (
								<div className='flex flex-col gap-2'>
									<LabelWrapper>
										<Label>Name</Label>
										<LabelDescription>
											Displayed across Kino on profiles and project pages.
										</LabelDescription>
									</LabelWrapper>
									<Input
										autoFocus
										maxLength={FORM_LIMITS.orgName}
										onChange={(event) => field.handleChange(event.target.value)}
										value={field.state.value}
									/>
								</div>
							)}
						</form.Field>

						<form.Field name='slug'>
							{(field) => (
								<div className='flex flex-col gap-2'>
									<LabelWrapper>
										<Label>Slug</Label>
										<LabelDescription>
											Unique identifier used in your organization URL.
										</LabelDescription>
									</LabelWrapper>
									<div className='flex items-stretch overflow-hidden rounded-md border bg-background focus-within:ring-1 focus-within:ring-ring'>
										<span className='flex items-center bg-muted/60 px-3 font-mono text-sm text-muted-foreground'>
											{slugUrlPrefix}
										</span>
										<Input
											autoCapitalize='none'
											className='rounded-none border-0 bg-transparent focus-visible:ring-0'
											maxLength={FORM_LIMITS.orgSlug}
											onChange={(event) =>
												field.handleChange(filterSlugInput(event.target.value, FORM_LIMITS.orgSlug))
											}
											pattern={SLUG_INPUT_PATTERN}
											spellCheck={false}
											value={field.state.value}
										/>
									</div>
								</div>
							)}
						</form.Field>
					</div>

					<div className='flex items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4'>
						<p className='text-xs text-muted-foreground'>
							Changing the slug will update every link to your organization.
						</p>
						<form.Subscribe
							selector={(state) => ({
								isSubmitting: state.isSubmitting,
								name: state.values.name,
							})}
						>
							{({ isSubmitting, name }) => {
								const isSaving =
									isSubmitting ||
									updateMutation.isPending ||
									uploadUrlMutation.isPending ||
									syncMetadataMutation.isPending;
								const disabled = !name.trim() || isSaving;

								return (
									<Button
										className={cn({
											'opacity-50 grayscale select-none': disabled,
										})}
										disabled={disabled}
										type='submit'
									>
										{isSaving ? 'Saving...' : 'Save changes'}
									</Button>
								);
							}}
						</form.Subscribe>
					</div>
				</div>

				{(formError ?? updateMutation.error) ? (
					<InlineAlert variant='danger'>
						Unable to update organization: {formError ?? updateMutation.error?.message}
					</InlineAlert>
				) : null}
			</form>
		</section>
	);
}
