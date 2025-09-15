import React from 'react';
import { useConvexMutation } from '@convex-dev/react-query';
import { Label } from '@radix-ui/react-dropdown-menu';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { createOrgSchema } from 'convex/schema/org.schema';
import { ConvexError } from 'convex/values';
import z from 'zod';

import { api } from '~api';
import { InlineAlert } from '@/components/inline-alert';
import { LabelWrapper } from '@/components/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const formSchema = createOrgSchema;

type FormSchema = z.infer<typeof formSchema>;

export const CreateTeamForm = ({ underLimit }: { underLimit: boolean }) => {
	const [formError, setFormError] = React.useState<string>();

	const { mutate: createTeam } = useMutation({
		mutationFn: useConvexMutation(api.org.create),
		onSuccess: () => {
			form.reset();
		},
		onError: (error) => {
			if (error instanceof ConvexError) {
				setFormError(error.data.message);
			}
		},
	});

	// const { data } = useSuspenseQuery(convexQuery(api.user.getTeamList, {}));

	// const handleDelete = async (id: string) => {
	// 	await authClient.organization.delete({
	// 		organizationId: id,
	// 	});
	// };

	const defaultValues: FormSchema = {
		name: '',
		slug: '',
		logo: '',
	};

	const form = useForm({
		defaultValues,
		validators: {
			onChange: formSchema,
		},
		onSubmit: async ({ value }) => {
			setFormError(undefined);
			createTeam({
				name: value.name,
				slug: value.slug,
				...(!!value.logo
					? {
							logo: value.logo,
						}
					: {}),
			});
		},
	});

	return (
		<div>
			<h1 className='text-3xl font-bold'>Create a team</h1>
			{!underLimit && (
				<InlineAlert variant='warning' className='mt-6'>
					Maximum teams created. Please{' '}
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
										<Label>Team name</Label>
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

				{/* <div className='mt-6 flex flex-col gap-2'>
					{data?.teams?.map((org) => (
						<div key={org.id}>
							<Button onClick={async () => await handleDelete(org.id)}>Delete: {org.name}</Button>
						</div>
					))}
				</div> */}
			</form>
		</div>
	);
};
