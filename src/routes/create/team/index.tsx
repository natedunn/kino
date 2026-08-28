import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { InlineAlert } from '@/components/inline-alert';
import { MainNav } from '@/components/site-nav/main-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { requireAuth } from '@/lib/auth/require-auth';
import { useAuthLostRedirect } from '@/lib/auth/use-auth-lost';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { localizeError } from '@/lib/errors';
import { titleMeta } from '@/lib/seo';
import { cn } from '@/lib/utils';
import {
	filterSlugInput,
	FORM_LIMITS,
	orgFormSchema,
	SLUG_INPUT_PATTERN,
	validationMessage,
} from '@/lib/validation';
import * as m from '@/paraglide/messages.js';

type Visibility = 'public' | 'private';
const VISIBILITY_VALUES: Array<Visibility> = ['public', 'private'];
const VISIBILITY_LABELS: Record<Visibility, () => string> = {
	private: m.project_visibility_private,
	public: m.project_visibility_public,
};

export const Route = createFileRoute('/create/team/')({
	head: () => ({
		meta: [titleMeta([m.create_team_meta()])],
	}),
	beforeLoad: ({ context, location }) => requireAuth(context, location),
	loader: async ({ context }) => {
		if (!context.loaderToken) {
			return;
		}

		await Promise.all([
			context.queryClient.ensureQueryData(
				crpcServer.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
			),
			context.queryClient.ensureQueryData(
				crpcServer.org.findMyOrgs.queryOptions({}, { skipUnauth: true })
			),
		]);
	},
	component: CreateTeamRoute,
});

function CreateTeamRoute() {
	// Entry is gated in `beforeLoad` (requireAuth); this only catches auth lost
	// in place (sign-out), which `beforeLoad` can't see.
	const lost = useAuthLostRedirect();
	if (lost) return lost;

	return <AuthenticatedCreateTeamRoute />;
}

function AuthenticatedCreateTeamRoute() {
	const navigate = useNavigate();
	const crpc = useCRPC();
	const [formError, setFormError] = useState<string>();
	const { data: profile } = useSuspenseQuery(
		crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
	);
	const { data: orgsData } = useSuspenseQuery(
		crpc.org.findMyOrgs.queryOptions({}, { skipUnauth: true })
	);
	const createMutation = useMutation(
		crpc.org.create.mutationOptions({
			onError: (error) => setFormError(localizeError(error, m.common_try_again())),
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
			const parsed = orgFormSchema.safeParse(value);
			if (!parsed.success) {
				setFormError(validationMessage(parsed.error));
				return;
			}
			await createMutation.mutateAsync({
				...(value.logo ? { logo: value.logo } : {}),
				name: parsed.data.name,
				...(parsed.data.slug ? { slug: parsed.data.slug } : {}),
				visibility: parsed.data.visibility,
			});
		},
	});

	const underLimit = orgsData.underLimit;
	const visibilityItems = VISIBILITY_VALUES.map((value) => ({
		label: VISIBILITY_LABELS[value](),
		value,
	}));

	return (
		<div className='flex min-h-svh flex-col'>
			<MainNav context={{ type: 'global' }} isUserPending={false} user={profile} />
			<main className='relative w-full flex-1'>
				<div className='absolute top-0 right-0 left-0 z-0 h-64 w-full bg-linear-to-t from-background to-muted' />
				<div className='relative z-10 mx-auto max-w-2xl px-4 py-12 sm:px-6 md:px-10'>
					<h1 className='text-3xl font-bold'>{m.create_team_title()}</h1>
					{!underLimit ? (
						<InlineAlert className='mt-6' variant='warning'>
							{m.create_team_limit_prefix()}{' '}
							<a className='link-text' href='#'>
								{m.create_team_change_plan()}
							</a>{' '}
							{m.create_team_limit_suffix()}
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
						<form.Field name='name'>
							{(field) => (
								<div className='flex items-end gap-3'>
									<div className='flex flex-1 flex-col gap-2'>
										<label className='text-sm font-medium'>{m.create_team_name()}</label>
										<Input
											maxLength={FORM_LIMITS.orgName}
											onChange={(event) => field.handleChange(event.target.value)}
											value={field.state.value}
										/>
									</div>
								</div>
							)}
						</form.Field>

						<form.Field name='slug'>
							{(field) => (
								<div className='flex items-end gap-3'>
									<div className='flex flex-1 flex-col gap-2'>
										<label className='text-sm font-medium'>{m.create_team_slug()}</label>
										<Input
											autoCapitalize='none'
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

						<form.Field name='visibility'>
							{(field) => (
								<div className='flex items-end gap-3'>
									<div className='flex flex-1 flex-col gap-2'>
										<label className='text-sm font-medium'>{m.create_visibility()}</label>
										<Select
											items={visibilityItems}
											value={field.state.value}
											onValueChange={(value) => field.handleChange(value as Visibility)}
										>
											<SelectTrigger className='w-full sm:w-48'>
												<SelectValue placeholder={m.create_select_visibility()}>
													{(value: Visibility | null) =>
														value ? VISIBILITY_LABELS[value]() : m.create_select_visibility()
													}
												</SelectValue>
											</SelectTrigger>
											<SelectContent>
												{visibilityItems.map((item) => (
													<SelectItem key={item.value} value={item.value}>
														{item.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>
							)}
						</form.Field>

						{formError ? <InlineAlert variant='danger'>{formError}</InlineAlert> : null}

						<div className='flex items-center gap-2'>
							<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
								{([canSubmit, isSubmitting]) => (
									<Button
										className={cn({
											'opacity-50 grayscale select-none': !canSubmit,
										})}
										disabled={!underLimit || createMutation.isPending}
										type='submit'
									>
										{isSubmitting || createMutation.isPending
											? m.create_team_creating()
											: m.create_team_action()}
									</Button>
								)}
							</form.Subscribe>
						</div>
					</form>
				</div>
			</main>
		</div>
	);
}
