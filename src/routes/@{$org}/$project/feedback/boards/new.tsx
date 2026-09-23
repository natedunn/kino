import type { IconName } from '@/icons';

import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';

import { IconSelector } from '@/components/icon-selector';
import { InlineAlert } from '@/components/inline-alert';
import { EmptyState, slugify } from '@/components/kino/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { iconRegistryOptions } from '@/icons';
import { boardsServer as crpcServer, useBoardsAPI as useCRPC } from '@/lib/convex/boards-api';
import { localizeError } from '@/lib/errors';
import { projectTitle, titleMeta } from '@/lib/seo';
import { boardFormSchema, FORM_LIMITS, validationMessage } from '@/lib/validation';
import * as m from '@/paraglide/messages.js';

export const Route = createFileRoute('/@{$org}/$project/feedback/boards/new')({
	loader: async ({ context, params }) => {
		const projectData = await context.queryClient.ensureQueryData(
			crpcServer.project.getDetails.queryOptions({
				orgSlug: params.org,
				slug: params.project,
			})
		);
		if (!projectData?.permissions.canManageContent) {
			throw redirect({
				to: '/@{$org}/$project/feedback',
				params: { org: params.org, project: params.project },
			});
		}
	},
	head: ({ params }) => ({
		meta: [
			titleMeta([
				m.board_new_title(),
				m.project_nav_feedback(),
				projectTitle(params.org, params.project),
			]),
		],
	}),
	component: NewBoardRoute,
});

function NewBoardRoute() {
	const params = Route.useParams();
	const navigate = useNavigate();
	const crpc = useCRPC();
	const [formError, setFormError] = useState<string | null>(null);

	const projectQuery = useQuery(
		crpc.project.getDetails.queryOptions({
			orgSlug: params.org,
			slug: params.project,
		})
	);
	const createMutation = useMutation(
		crpc.feedbackBoard.create.mutationOptions({
			onSuccess: () => {
				navigate({
					params,
					to: '/@{$org}/$project/settings/boards',
				});
			},
		})
	);

	const form = useForm({
		defaultValues: {
			description: '',
			icon: 'box' as IconName,
			name: '',
		},
		onSubmit: async ({ value }) => {
			const project = projectQuery.data?.project;
			if (!project) return;
			setFormError(null);
			const parsed = boardFormSchema.safeParse({
				description: value.description,
				icon: value.icon,
				name: value.name,
				slug: slugify(value.name),
			});
			if (!parsed.success) {
				setFormError(validationMessage(parsed.error));
				return;
			}

			await createMutation.mutateAsync({
				description: parsed.data.description || undefined,
				icon: parsed.data.icon || undefined,
				name: parsed.data.name,
				projectId: project.id,
				slug: parsed.data.slug,
			});
		},
	});

	if (!projectQuery.data?.project || !projectQuery.data.permissions.canManageContent) {
		return (
			<EmptyState
				title={m.project_boards_unavailable()}
				description={m.project_boards_unavailable_description()}
			/>
		);
	}

	return (
		<div className='container'>
			<div className='py-6'>
				<h1 className='text-3xl font-bold'>
					{m.board_new_heading({ name: projectQuery.data.project.name })}
				</h1>
				<div className='mt-4'>
					<form
						className='space-y-5'
						onSubmit={(event) => {
							event.preventDefault();
							event.stopPropagation();
							void form.handleSubmit();
						}}
					>
						<form.Field name='name'>
							{(field) => (
								<div className='grid gap-2'>
									<label className='text-sm font-medium'>{m.board_name()}</label>
									<p className='text-sm text-muted-foreground'>{m.board_name_help()}</p>
									<Input
										maxLength={FORM_LIMITS.boardName}
										onChange={(event) => field.handleChange(event.target.value)}
										value={field.state.value}
									/>
								</div>
							)}
						</form.Field>
						<form.Field name='icon'>
							{(field) => (
								<div className='grid gap-2'>
									<label className='text-sm font-medium'>{m.board_icon()}</label>
									<p className='text-sm text-muted-foreground'>{m.board_icon_help()}</p>
									<IconSelector
										contentClassName='w-96'
										onValueChange={(value) => field.handleChange(value)}
										options={iconRegistryOptions}
										value={field.state.value}
									/>
								</div>
							)}
						</form.Field>
						<form.Field name='description'>
							{(field) => (
								<div className='grid gap-2'>
									<label className='text-sm font-medium'>{m.board_description()}</label>
									<p className='text-sm text-muted-foreground'>{m.board_description_help()}</p>
									<Textarea
										maxLength={FORM_LIMITS.boardDescription}
										onChange={(event) => field.handleChange(event.target.value)}
										value={field.state.value}
									/>
								</div>
							)}
						</form.Field>
						<form.Subscribe selector={(state) => state.values.name}>
							{(name) => (
								<div className='hidden'>
									<Input maxLength={FORM_LIMITS.projectSlug} readOnly value={slugify(name)} />
								</div>
							)}
						</form.Subscribe>
						{(formError ?? createMutation.error) ? (
							<InlineAlert variant='danger'>
								{formError ?? localizeError(createMutation.error)}
							</InlineAlert>
						) : null}
						<div className='flex items-center gap-3'>
							<form.Subscribe
								selector={(state) => ({
									isSubmitting: state.isSubmitting,
									name: state.values.name,
								})}
							>
								{({ isSubmitting, name }) => {
									const nextSlug = slugify(name);
									const disabled =
										!name.trim() || !nextSlug || isSubmitting || createMutation.isPending;

									return (
										<Button disabled={disabled} type='submit'>
											{isSubmitting || createMutation.isPending
												? m.board_creating()
												: m.board_create()}
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
