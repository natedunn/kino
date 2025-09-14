import type { FeedbackBoardSelectSchema } from '@/convex/schema/feedbackBoard.schema';

import React from 'react';
import { useConvexMutation } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import { api } from '~api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppForm, useFormError } from '@/components/ui/tanstack-form';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export const EditBoardForm = ({
	board,
	orgSlug,
	projectSlug,
}: {
	board: FeedbackBoardSelectSchema;
	orgSlug: string;
	projectSlug: string;
}) => {
	const navigate = useNavigate();
	const formError = useFormError();

	const { mutate: updateBoard } = useMutation({
		mutationFn: useConvexMutation(api.feedbackBoard.update),
		onSuccess: () => {
			form.reset();
			navigate({
				to: '/@{$org}/$project/feedback/boards',
				params: {
					org: orgSlug,
					project: projectSlug,
				},
			});
		},
		onError: formError.setError,
	});

	const form = useAppForm({
		defaultValues: board,
		onSubmit: async ({ value }) => {
			formError.errorReset();
			updateBoard({
				...value,
				orgSlug,
				projectSlug,
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
			<form onSubmit={handleSubmit} className='flex flex-col gap-6'>
				<form.AppField name='name'>
					{(field) => (
						<field.Provider>
							<field.Label>Name</field.Label>
							<field.Description>
								Name of your public board. Must be unique to your project.
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

				<form.AppField name='description'>
					{(field) => (
						<field.Provider>
							<field.Label>Name</field.Label>
							<field.Description>
								Name of your public board. Must be unique to your project.
							</field.Description>
							<field.Control>
								<Textarea
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</field.Control>
							<field.Message />
						</field.Provider>
					)}
				</form.AppField>

				<formError.Message prefix='Unable to update board' />

				<div className='flex items-center justify-between gap-4'>
					<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
						{([canSubmit, isSubmitting]) => (
							<Button
								type='submit'
								className={cn({ 'opacity-50 grayscale select-none': !canSubmit })}
							>
								{isSubmitting ? 'Updating...' : 'Update board'}
							</Button>
						)}
					</form.Subscribe>
					<Button variant='destructive'>Delete Board</Button>
				</div>
			</form>
		</form.AppForm>
	);
};
