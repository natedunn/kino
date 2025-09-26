import React from 'react';
import { useConvexMutation } from '@convex-dev/react-query';
import { Label } from '@radix-ui/react-dropdown-menu';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { ConvexError } from 'convex/values';
import z from 'zod';

import { api } from '~api';
import CheckboxButton from '@/components/checkbox-button';
import { InlineAlert } from '@/components/inline-alert';
import { LabelWrapper } from '@/components/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppForm, useFormError } from '@/components/ui/tanstack-form';
import { createProjectSchema } from '@/convex/schema/project.schema';
import { cn } from '@/lib/utils';

const formSchema = createProjectSchema;

type FormSchema = z.infer<typeof formSchema>;

type CreateProjectFormProps = {
	enabled: boolean;
	orgSlug: string;
};

export const CreateProjectForm = ({ enabled, orgSlug }: CreateProjectFormProps) => {
	const navigate = useNavigate();
	const formError = useFormError();

	const { mutate: createProject } = useMutation({
		mutationFn: useConvexMutation(api.project.create),
		onSuccess: () => {
			form.reset();
			console.log({
				orgSlug,
				form: form.state.values,
			});
			navigate({
				to: `/${orgSlug}/${form.state.values.slug}`,
			});
		},
		onError: formError.setError,
	});

	const defaultValues: FormSchema = {
		name: '',
		slug: '',
		visibility: 'public',
		orgSlug,
	};

	const form = useAppForm({
		defaultValues,
		validators: {
			onChange: formSchema,
		},
		onSubmit: async ({ value }) => {
			formError.errorReset();
			createProject({
				name: value.name,
				slug: value.slug,
				visibility: value.visibility,
				orgSlug: value.orgSlug,
			});
		},
	});

	const handleSubmit = React.useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();
			e.stopPropagation();
			form.handleSubmit();
		},
		[form]
	);

	return (
		<form.AppForm>
			{!enabled && (
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
					'pointer-events-none opacity-50': !enabled,
				})}
				onSubmit={handleSubmit}
			>
				<form.AppField name='name'>
					{(field) => (
						<field.Provider>
							<field.Label>Project name</field.Label>
							<field.Description>
								Name of your project. Must be unique to your organization.
							</field.Description>
							<field.Control>
								<Input
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</field.Control>
							<field.Message />
						</field.Provider>
					)}
				</form.AppField>

				<form.AppField name='slug'>
					{(field) => (
						<field.Provider>
							<field.Label>Project Slug</field.Label>
							<field.Description>
								Will be be used in URL of your project. Must be unique to your organization.
							</field.Description>
							<field.Control>
								<Input
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</field.Control>
							<field.Message />
						</field.Provider>
					)}
				</form.AppField>

				<form.AppField name='visibility'>
					{(field) => (
						<field.Provider>
							<field.Label>Visibility</field.Label>
							<field.Description>Make your project public or private.</field.Description>
							<field.Control>{/*  */}</field.Control>
							<field.Message />
						</field.Provider>
					)}
				</form.AppField>

				<formError.Message prefix='Unable to create project' />

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
		</form.AppForm>
	);
};
