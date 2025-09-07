import type { FeedbackBoardCreateSchema } from '@/convex/schema/feedbackBoard.schema';

import React from 'react';
import { useConvexMutation } from '@convex-dev/react-query';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { Authenticated } from 'convex/react';
import { ConvexError } from 'convex/values';

import { api } from '~api';
import { InlineAlert } from '@/components/inline-alert';
import { Label, LabelWrapper } from '@/components/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Id } from '@/convex/_generated/dataModel';
import { feedbackBoardCreateSchema } from '@/convex/schema/feedbackBoard.schema';
import { cn } from '@/lib/utils';

const formSchema = feedbackBoardCreateSchema;
type FormSchema = FeedbackBoardCreateSchema;

export const CreateBoardForm = ({ projectId }: { projectId: Id<'project'> }) => {
	const [formError, setFormError] = React.useState<string | null>(null);

	const { mutate: createBoard } = useMutation({
		mutationFn: useConvexMutation(api.feedbackBoard.create),
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
		projectId,
		name: '',
	};

	const form = useForm({
		defaultValues,
		validators: {
			onChange: formSchema,
		},
		onSubmit: ({ value }) => {
			createBoard(value);
		},
	});

	return (
		<div>
			<Authenticated>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					className='flex flex-col gap-6'
				>
					<form.Field name='name'>
						{(field) => {
							return (
								<div className='flex items-end gap-3'>
									<div className='flex flex-1 flex-col gap-2'>
										<LabelWrapper>
											<Label>Name</Label>
										</LabelWrapper>
										<div className='flex items-center gap-4'>
											<Input
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
											/>
										</div>
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
									{isSubmitting ? 'Creating...' : 'Create'}
								</Button>
							)}
						</form.Subscribe>
					</div>
				</form>
			</Authenticated>
		</div>
	);
};
