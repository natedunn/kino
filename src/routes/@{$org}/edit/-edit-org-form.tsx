import React from 'react';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { revalidateLogic } from '@tanstack/react-form';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import * as z from 'zod';

import { api } from '~api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input-shadcn';
import { useAppForm, useFormError } from '@/components/ui/tanstack-form';
import { updateOrgSchema } from '@/convex/schema/org.schema';
import { cn } from '@/lib/utils';

type EditOrgFormProps = { slug: string };

const formSchema = updateOrgSchema;

type FormSchema = z.infer<typeof formSchema>;

export function EditOrgForm({ slug }: EditOrgFormProps) {
	const enabled = true;

	const navigate = useNavigate();
	const formError = useFormError();
	const { data: orgDetails } = useSuspenseQuery(
		convexQuery(api.org.getDetails, {
			slug,
		})
	);
	const [currentSlug, setCurrentSlug] = React.useState(slug);

	const defaultValues: FormSchema = {
		name: orgDetails.org?.name ?? '',
		currentSlug: orgDetails.org?.slug ?? '',
		updatedSlug: orgDetails.org?.slug ?? '',
	};

	const form = useAppForm({
		defaultValues,
		validators: {
			onSubmit: formSchema,
		},
		validationLogic: revalidateLogic({
			mode: 'submit',
			modeAfterSubmission: 'change',
		}),
		onSubmitInvalid: () => {
			formError.errorReset();
		},
		onSubmit: async ({ value }) => {
			formError.errorReset();
			updateOrg({
				name: value.name,
				currentSlug: slug,
				updatedSlug: slug !== value.updatedSlug ? value.updatedSlug : undefined,
			});
		},
	});

	const { mutate: updateOrg, status } = useMutation({
		mutationFn: useConvexMutation(api.org.update),
		onSuccess: () => {
			form.reset();

			navigate({
				to: '/@{$org}',
				params: {
					org: currentSlug,
				},
			});
		},
		onError: formError.setError,
	});

	return (
		<form.AppForm>
			<form.Form
				form={form}
				className={cn('flex flex-col gap-6', {
					'pointer-events-none opacity-50': !enabled,
				})}
			>
				<form.AppField name='name'>
					{(field) => (
						<field.Provider>
							<field.Label>Name</field.Label>
							{/* <field.Description>Name of your organization.</field.Description> */}
							<field.Control>
								<Input
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									disabled={!enabled}
									autoFocus
								/>
							</field.Control>
						</field.Provider>
					)}
				</form.AppField>

				<form.AppField name='updatedSlug'>
					{(field) => (
						<field.Provider>
							<field.Label>Slug</field.Label>
							<field.Description>Unique identifier for your organization.</field.Description>
							<field.Control>
								<Input
									value={field.state.value}
									onChange={(e) => {
										field.handleChange(e.target.value);
										setCurrentSlug(e.target.value);
									}}
									disabled={!enabled}
								/>
							</field.Control>
						</field.Provider>
					)}
				</form.AppField>

				<formError.Message prefix='Unable to update organization' />

				<div className='flex items-center gap-2'>
					<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
						{([canSubmit]) => (
							<Button
								type='submit'
								className={cn({
									'opacity-50 grayscale select-none':
										!canSubmit || status === 'pending' || status === 'success',
								})}
								disabled={!enabled}
							>
								{status === 'pending' ? 'Updating...' : 'Update'}
							</Button>
						)}
					</form.Subscribe>
				</div>
			</form.Form>
		</form.AppForm>
	);
}
