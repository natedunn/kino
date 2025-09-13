import type { FeedbackBoardCreateSchema } from '@/convex/schema/feedbackBoard.schema';

import React from 'react';
import { useConvexMutation } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';

import { api } from '~api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppForm, useFormError } from '@/components/ui/tanstack-form';
import { Textarea } from '@/components/ui/textarea';
import { Id } from '@/convex/_generated/dataModel';
import { feedbackBoardCreateSchema } from '@/convex/schema/feedbackBoard.schema';
import { cn } from '@/lib/utils';

const formSchema = feedbackBoardCreateSchema;
type FormSchema = FeedbackBoardCreateSchema;

export const CreateBoardForm = ({ projectId }: { projectId: Id<'project'> }) => {
	const formError = useFormError();

	const { mutate: createBoard } = useMutation({
		mutationFn: useConvexMutation(api.feedbackBoard.create),
		onSuccess: () => form.reset(),
		onError: formError.setError,
	});

	const form = useAppForm({
		defaultValues: {
			projectId,
			name: '',
			description: '',
			fakeThing: '',
		} as FormSchema,
		validators: {
			onChange: formSchema,
		},
		onSubmit: (opts) => {
			formError.errorReset();
			createBoard(opts.value);
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
		<div>
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
								<field.Label>Description</field.Label>
								<field.Description>
									Describe what feedback should belong in this board.
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

					<formError.Message prefix='Unable to create board' />

					<div>
						<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
							{([canSubmit, isSubmitting]) => (
								<Button
									type='submit'
									className={cn({ 'opacity-50 grayscale select-none': !canSubmit })}
								>
									{isSubmitting ? 'Creating...' : 'Create'}
								</Button>
							)}
						</form.Subscribe>
					</div>
				</form>
			</form.AppForm>
		</div>
	);
};
