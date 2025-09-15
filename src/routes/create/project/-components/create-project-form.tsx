import React from 'react';
import { useConvexMutation } from '@convex-dev/react-query';
import { Label } from '@radix-ui/react-dropdown-menu';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { createProjectSchema } from 'convex/schema/project.schema';
import { ConvexError } from 'convex/values';
import z from 'zod';

import { api } from '~api';
import CheckboxButton from '@/components/checkbox-button';
import { InlineAlert } from '@/components/inline-alert';
import { LabelWrapper } from '@/components/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const formSchema = createProjectSchema;

type FormSchema = z.infer<typeof formSchema>;

export const CreateProjectForm = ({
	underLimit,
	activeOrgName,
	activeOrgSlug,
}: {
	underLimit: boolean;
	activeOrgName: string;
	activeOrgSlug: string;
}) => {
	const [formError, setFormError] = React.useState<string>();

	const { mutate: createProject } = useMutation({
		mutationFn: useConvexMutation(api.project.create),
		onSuccess: () => {
			form.reset();
		},
		onError: (error) => {
			if (error instanceof ConvexError) {
				setFormError(error.data.message);
			}
		},
	});

	const defaultValues: FormSchema = {
		name: '',
		slug: '',
		visibility: 'public',
		orgSlug: activeOrgSlug,
	};

	const form = useForm({
		defaultValues,
		validators: {
			onChange: formSchema,
		},
		onSubmit: async ({ value }) => {
			setFormError(undefined);
			createProject({
				name: value.name,
				slug: value.slug,
				visibility: value.visibility,
				orgSlug: value.orgSlug,
			});
		},
	});

	return (
		<div>
			<h1 className='inline-flex flex-wrap items-center gap-y-1 text-3xl font-bold'>
				<span className='mr-2 inline-block'>Create a Project for</span>
				<span className='inline-flex items-center gap-2 rounded-lg bg-gradient-to-bl from-foreground/30 to-foreground/10 px-2 py-1 font-bold text-foreground shadow-2xl shadow-foreground/50'>
					<Avatar className='size-6 rounded-full'>
						{/* <AvatarImage src={user.avatar} alt={user.name} /> */}
						<AvatarFallback className='rounded-lg'>{activeOrgName[0].toUpperCase()}</AvatarFallback>
					</Avatar>
					<span>{activeOrgName}</span>
				</span>
			</h1>
			{!underLimit && (
				<InlineAlert variant='warning' className='mt-6'>
					Maximum projects created. Please{' '}
					<a className='link-text' href='#'>
						change your plan
					</a>{' '}
					or contact support.
				</InlineAlert>
			)}
			<form
				className={cn('mt-6 flex flex-col gap-6', {
					'pointer-events-none opacity-50': !underLimit,
				})}
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name='name'>
					{(field) => {
						return (
							<div className='flex items-end gap-3'>
								<div className='flex flex-1 flex-col gap-2'>
									<LabelWrapper>
										<Label>Project name</Label>
									</LabelWrapper>
									<Input
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
								</div>
							</div>
						);
					}}
				</form.Field>

				<form.Field name='slug'>
					{(field) => {
						return (
							<div className='flex items-end gap-3'>
								<div className='flex flex-1 flex-col gap-2'>
									<LabelWrapper>
										<Label>Slug</Label>
									</LabelWrapper>
									<Input
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
								</div>
							</div>
						);
					}}
				</form.Field>

				{/* <form.Field name='private'>
					{(field) => {
						return (
							<div className='flex items-end gap-3'>
								<div className='flex flex-1 flex-col gap-2'>
									<LabelWrapper>
										<Label>Privacy</Label>
									</LabelWrapper>
									<div>
										<CheckboxButton
											checked={field.state.value}
											onChange={(checked) => {
												return field.handleChange(checked);
											}}
											className='text-sm'
										>
											Make the project private
										</CheckboxButton>
									</div>
								</div>
							</div>
						);
					}}
				</form.Field> */}

				{!!formError && <InlineAlert variant='danger'>{formError}</InlineAlert>}

				<div className='flex items-center gap-2'>
					<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
						{([canSubmit, isSubmitting]) => (
							<Button
								type='submit'
								className={cn({ 'opacity-50 grayscale select-none': !canSubmit })}
							>
								{isSubmitting ? 'Creating...' : 'Create Team'}
							</Button>
						)}
					</form.Subscribe>
				</div>
			</form>
		</div>
	);
};
