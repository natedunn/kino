import { useState } from 'react';
import { useConvexMutation } from '@convex-dev/react-query';
import { revalidateLogic } from '@tanstack/react-form';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { convexQuery } from '@convex-dev/react-query';
import { X } from 'lucide-react';
import * as z from 'zod';

import { api, API } from '~api';
import { MarkdownEditor, sanitizeEditorContent } from '@/components/editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input-shadcn';
import { useAppForm, useFormError } from '@/components/ui/tanstack-form';
import { Id } from '@/convex/_generated/dataModel';
import { cn } from '@/lib/utils';

// Simplified form schema without relatedFeedbackIds (handled separately)
const formSchema = z.object({
	title: z.string().min(1).max(200),
	content: z.string().min(1),
	projectId: z.string(),
	tags: z.array(z.string()).optional(),
	coverImageId: z.string().optional(),
});
type FormSchema = z.infer<typeof formSchema>;

type CreateUpdateFormProps = {
	projectId: Id<'project'>;
	onSubmit?: (data: { updateId: Id<'update'>; slug: string }) => void;
};

export const CreateUpdateForm = ({ projectId, onSubmit }: CreateUpdateFormProps) => {
	const [tagInput, setTagInput] = useState('');
	const [selectedFeedbackIds, setSelectedFeedbackIds] = useState<Id<'feedback'>[]>([]);

	const formError = useFormError();

	const defaultValues: FormSchema = {
		title: '',
		content: '',
		projectId,
		tags: [],
		coverImageId: undefined,
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
			const sanitizedContent = sanitizeEditorContent(value.content);
			createUpdate({
				projectId: projectId,
				title: value.title,
				content: sanitizedContent,
				tags: value.tags,
				relatedFeedbackIds: selectedFeedbackIds.length > 0 ? selectedFeedbackIds : undefined,
				coverImageId: value.coverImageId,
			});
		},
	});

	const { mutate: createUpdate, status } = useMutation({
		mutationFn: useConvexMutation(api.update.create),
		onSuccess: (data: { updateId: Id<'update'>; slug: string }) => {
			form.reset();
			onSubmit?.(data);
		},
		onError: formError.setError,
	});

	const { mutate: publishUpdate, status: publishStatus } = useMutation({
		mutationFn: useConvexMutation(api.update.publish),
	});

	const handleAddTag = () => {
		if (!tagInput.trim()) return;
		const currentTags = form.getFieldValue('tags') || [];
		if (!currentTags.includes(tagInput.trim())) {
			form.setFieldValue('tags', [...currentTags, tagInput.trim()]);
		}
		setTagInput('');
	};

	const handleRemoveTag = (tagToRemove: string) => {
		const currentTags = form.getFieldValue('tags') || [];
		form.setFieldValue(
			'tags',
			currentTags.filter((tag: string) => tag !== tagToRemove)
		);
	};

	const handlePublish = async () => {
		formError.errorReset();
		const value = form.state.values;
		const sanitizedContent = sanitizeEditorContent(value.content);

		createUpdate(
			{
				projectId: projectId,
				title: value.title,
				content: sanitizedContent,
				tags: value.tags,
				relatedFeedbackIds: selectedFeedbackIds.length > 0 ? selectedFeedbackIds : undefined,
				coverImageId: value.coverImageId,
			},
			{
				onSuccess: (data) => {
					publishUpdate(
						{ _id: data.updateId },
						{
							onSuccess: () => {
								form.reset();
								onSubmit?.(data);
							},
						}
					);
				},
			}
		);
	};

	return (
		<div>
			<form.AppForm>
				<form.Form form={form} className='flex flex-col gap-6'>
					<form.AppField name='title'>
						{(field) => (
							<field.Provider>
								<field.Label>Title</field.Label>
								<field.Control>
									<Input
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder='Update title...'
									/>
								</field.Control>
							</field.Provider>
						)}
					</form.AppField>

					<form.AppField name='content'>
						{(field) => (
							<field.Provider>
								<field.Label>Content</field.Label>
								<field.Control>
									<MarkdownEditor
										value={field.state.value}
										onChange={(html) => field.handleChange(html)}
										placeholder='Write your update content...'
										minHeight='200px'
										maxHeight='600px'
									/>
								</field.Control>
							</field.Provider>
						)}
					</form.AppField>

					<form.AppField name='tags'>
						{(field) => (
							<field.Provider>
								<field.Label>Tags</field.Label>
								<div className='flex flex-wrap items-center gap-2'>
									{(field.state.value || []).map((tag: string) => (
										<Badge key={tag} variant='secondary' className='gap-1'>
											{tag}
											<button
												type='button'
												onClick={() => handleRemoveTag(tag)}
												className='ml-1 hover:text-destructive'
											>
												<X className='h-3 w-3' />
											</button>
										</Badge>
									))}
									<div className='flex items-center gap-2'>
										<Input
											value={tagInput}
											onChange={(e) => setTagInput(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === 'Enter') {
													e.preventDefault();
													handleAddTag();
												}
											}}
											placeholder='Add tag...'
											className='w-32'
										/>
										<Button type='button' variant='outline' size='sm' onClick={handleAddTag}>
											Add
										</Button>
									</div>
								</div>
							</field.Provider>
						)}
					</form.AppField>

					<formError.Message prefix='Unable to create update' />

					<div className='flex items-center gap-2'>
						<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
							{([canSubmit, isSubmitting]) => (
								<>
									<Button
										type='submit'
										variant='outline'
										className={cn({
											'opacity-50 grayscale select-none':
												!canSubmit || status === 'pending' || status === 'success',
										})}
									>
										{isSubmitting ? 'Saving...' : 'Save as Draft'}
									</Button>
									<Button
										type='button'
										onClick={handlePublish}
										className={cn({
											'opacity-50 grayscale select-none':
												!canSubmit ||
												status === 'pending' ||
												publishStatus === 'pending' ||
												status === 'success',
										})}
									>
										{publishStatus === 'pending' ? 'Publishing...' : 'Publish'}
									</Button>
								</>
							)}
						</form.Subscribe>
					</div>
				</form.Form>
			</form.AppForm>
		</div>
	);
};
