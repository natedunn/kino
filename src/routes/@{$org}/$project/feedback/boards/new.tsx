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
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { projectTitle, titleMeta } from '@/lib/seo';
import { boardFormSchema, FORM_LIMITS, validationMessage } from '@/lib/validation';

export const Route = createFileRoute('/@{$org}/$project/feedback/boards/new')({
	loader: async ({ context, params }) => {
		const projectData = await context.queryClient.ensureQueryData(
			crpcServer.project.getDetails.queryOptions({
				orgSlug: params.org,
				slug: params.project,
			})
		);
		if (!projectData?.permissions.canEdit) {
			throw redirect({
				to: '/@{$org}/$project/feedback',
				params: { org: params.org, project: params.project },
			});
		}
	},
	head: ({ params }) => ({
		meta: [titleMeta(['New Board', 'Feedback', projectTitle(params.org, params.project)])],
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

	if (!projectQuery.data?.project || !projectQuery.data.permissions.canEdit) {
		return (
			<EmptyState
				title='Board creation unavailable'
				description='Only project editors can create new feedback boards.'
			/>
		);
	}

	return (
		<div className='container'>
			<div className='py-6'>
				<h1 className='text-3xl font-bold'>
					Create a new board for project {projectQuery.data.project.name}
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
									<label className='text-sm font-medium'>Name</label>
									<p className='text-sm text-muted-foreground'>
										Name of your public board. Must be unique to your project.
									</p>
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
									<label className='text-sm font-medium'>Icon</label>
									<p className='text-sm text-muted-foreground'>
										Pick the visual marker used anywhere this board appears.
									</p>
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
									<label className='text-sm font-medium'>Description</label>
									<p className='text-sm text-muted-foreground'>
										Describe what feedback should belong in this board.
									</p>
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
								Unable to create board: {formError ?? createMutation.error?.message}
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
											{isSubmitting || createMutation.isPending ? 'Creating...' : 'Create'}
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
