import { useConvexMutation } from '@convex-dev/react-query';
import { revalidateLogic } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import * as z from 'zod';

import { api, API } from '~api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input-shadcn';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select-shadcn';
import { useAppForm, useFormError } from '@/components/ui/tanstack-form';
import { MarkdownEditor } from '@/components/editor';
import { Id } from '@/convex/_generated/dataModel';
import { feedbackCreateSchema } from '@/convex/schema/feedback.schema';
import { cn } from '@/lib/utils';

const formSchema = feedbackCreateSchema
	.omit({
		projectId: true,
		boardId: true,
	})
	.extend(
		z.object({
			projectId: z.string(),
			boardId: z.string(),
		}).shape
	);
type FormSchema = z.infer<typeof formSchema>;

type CreateFeedbackFormProps = {
	projectId: Id<'project'>;
	boards: API['feedbackBoard']['listProjectBoards'];
	onSubmit?: (data: { feedbackId: Id<'feedback'>; slug: string }) => void;
};

export const CreateFeedbackForm = ({ projectId, boards, onSubmit }: CreateFeedbackFormProps) => {
	const enabled = true;

	const formError = useFormError();

	const defaultValues: FormSchema = {
		title: '',
		boardId: '',
		projectId,
		firstComment: '',
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
			createFeedback({
				boardId: value.boardId as Id<'feedbackBoard'>,
				projectId: projectId,
				title: value.title,
				firstComment: value.firstComment,
			});
		},
	});

	const { mutate: createFeedback, status } = useMutation({
		mutationFn: useConvexMutation(api.feedback.create),
		onSuccess: (data: { feedbackId: Id<'feedback'>; slug: string }) => {
			form.reset();
			onSubmit?.(data);
		},
		onError: formError.setError,
	});

	if (!boards) {
		throw new Error('No boards found: 019a6c0b');
	}

	return (
		<div>
			<form.AppForm>
				<form.Form
					form={form}
					className={cn('flex flex-col gap-6', {
						'pointer-events-none opacity-50': !enabled,
					})}
				>
					<form.AppField name='boardId'>
						{(field) => (
							<field.Provider>
								<field.Label>Board</field.Label>
								<field.Control>
									<Select
										defaultValue={defaultValues.boardId}
										onValueChange={(value) => field.handleChange(value)}
										disabled={!enabled}
									>
										<SelectTrigger className='w-48'>
											<SelectValue placeholder='Select Board' />
										</SelectTrigger>
										<SelectContent>
											{/* <SelectItem value='public'>Public</SelectItem> */}
											{boards?.map((board) => {
												return (
													<SelectItem key={board._id} value={board._id}>
														{board.name}
													</SelectItem>
												);
											})}
										</SelectContent>
									</Select>
								</field.Control>
							</field.Provider>
						)}
					</form.AppField>

					<form.AppField name='title'>
						{(field) => (
							<field.Provider>
								<field.Label>Title</field.Label>
								<field.Control>
									<Input
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										disabled={!enabled}
									/>
								</field.Control>
							</field.Provider>
						)}
					</form.AppField>

					<form.AppField name='firstComment'>
						{(field) => (
							<field.Provider>
								<field.Label>Content</field.Label>
								<field.Control>
									<MarkdownEditor
										value={field.state.value}
										onChange={(html) => field.handleChange(html)}
										disabled={!enabled}
										placeholder="Describe your feedback..."
										minHeight="120px"
									/>
								</field.Control>
							</field.Provider>
						)}
					</form.AppField>

					<formError.Message prefix='Unable to create feedback' />

					<div className='flex items-center gap-2'>
						<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
							{([canSubmit, isSubmitting]) => (
								<Button
									type='submit'
									className={cn({
										'opacity-50 grayscale select-none':
											!canSubmit || status === 'pending' || status === 'success',
									})}
									disabled={!enabled}
								>
									{isSubmitting ? 'Creating...' : 'Create'}
								</Button>
							)}
						</form.Subscribe>
					</div>
				</form.Form>
			</form.AppForm>
		</div>
	);
};
