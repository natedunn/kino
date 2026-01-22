import { useState } from 'react';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { revalidateLogic } from '@tanstack/react-form';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { FileText, X } from 'lucide-react';
import * as z from 'zod';

import { api } from '~api';
import { MarkdownEditor, sanitizeEditorContent } from '@/components/editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input-shadcn';
import { useAppForm, useFormError } from '@/components/ui/tanstack-form';
import { Id } from '@/convex/_generated/dataModel';
import { updateSchema } from '@/convex/schema/update.schema';
import { cn } from '@/lib/utils';

import { FeedbackSelector } from '../-components/feedback-selector';

const formSchema = updateSchema.pick({
	title: true,
	content: true,
	tags: true,
	coverImageId: true,
});
type FormSchema = z.infer<typeof formSchema>;

export const Route = createFileRoute('/@{$org}/$project/updates/$slug/edit')({
	loader: async ({ context, params }) => {
		const project = await context.queryClient.ensureQueryData(
			convexQuery(api.project.getDetails, {
				orgSlug: params.org,
				slug: params.project,
			})
		);

		if (!project?.project?._id) {
			throw redirect({
				to: '/@{$org}/$project/updates',
				params: {
					org: params.org,
					project: params.project,
				},
			});
		}

		const updateData = await context.queryClient.ensureQueryData(
			convexQuery(api.update.getBySlug, {
				projectId: project.project._id,
				slug: params.slug,
			})
		);

		// Check if user can edit
		if (!updateData?.canEdit) {
			throw redirect({
				to: '/@{$org}/$project/updates/$slug',
				params: {
					org: params.org,
					project: params.project,
					slug: params.slug,
				},
			});
		}

		return { updateData };
	},
	component: RouteComponent,
});

function RouteComponent() {
	const router = useRouter();
	const params = Route.useParams();
	const { org: orgSlug, project: projectSlug, slug } = params;

	const { data: projectData } = useSuspenseQuery(
		convexQuery(api.project.getDetails, {
			orgSlug,
			slug: projectSlug,
		})
	);

	const { data: updateData } = useSuspenseQuery(
		convexQuery(api.update.getBySlug, {
			projectId: projectData?.project?._id!,
			slug,
		})
	);

	const [tagInput, setTagInput] = useState('');
	const formError = useFormError();

	const { update } = updateData!;

	const [selectedFeedbackIds, setSelectedFeedbackIds] = useState<Id<'feedback'>[]>(
		update.relatedFeedbackIds ?? []
	);

	const defaultValues: FormSchema = {
		title: update.title,
		content: update.content,
		tags: update.tags ?? [],
		coverImageId: update.coverImageId,
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
			updateMutation({
				_id: update._id,
				title: value.title,
				content: sanitizedContent,
				tags: value.tags,
				coverImageId: value.coverImageId,
				relatedFeedbackIds: selectedFeedbackIds.length > 0 ? selectedFeedbackIds : undefined,
			});
		},
	});

	const { mutate: updateMutation, status } = useMutation({
		mutationFn: useConvexMutation(api.update.update),
		onSuccess: () => {
			router.navigate({
				to: '/@{$org}/$project/updates/$slug',
				params: {
					org: orgSlug,
					project: projectSlug,
					slug,
				},
			});
		},
		onError: formError.setError,
	});

	const { mutate: publishMutation, status: publishStatus } = useMutation({
		mutationFn: useConvexMutation(api.update.publish),
		onSuccess: () => {
			router.navigate({
				to: '/@{$org}/$project/updates/$slug',
				params: {
					org: orgSlug,
					project: projectSlug,
					slug,
				},
			});
		},
	});

	const { mutate: unpublishMutation, status: unpublishStatus } = useMutation({
		mutationFn: useConvexMutation(api.update.unpublish),
	});

	const { mutate: deleteMutation, status: deleteStatus } = useMutation({
		mutationFn: useConvexMutation(api.update.remove),
		onSuccess: () => {
			router.navigate({
				to: '/@{$org}/$project/updates',
				params: {
					org: orgSlug,
					project: projectSlug,
				},
			});
		},
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

	const handlePublish = () => {
		publishMutation({ _id: update._id });
	};

	const handleUnpublish = () => {
		unpublishMutation({ _id: update._id });
	};

	const handleDelete = () => {
		if (confirm('Are you sure you want to delete this update? This cannot be undone.')) {
			deleteMutation({ _id: update._id });
		}
	};

	const isPublished = update.status === 'published';

	return (
		<div className='container py-8'>
			<div className='mx-auto max-w-2xl'>
				<div className='mb-8 flex items-start gap-4'>
					<div className='mt-1'>
						<FileText className='size-8 text-primary dark:text-blue-300' aria-hidden='true' />
					</div>
					<div>
						<h1 className='text-2xl font-bold'>Edit Update</h1>
						<p className='text-muted-foreground'>
							{isPublished ? 'This update is published.' : 'This update is a draft.'}
						</p>
					</div>
				</div>
				<div className='rounded-lg border bg-background p-6'>
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

							<div className='flex flex-col gap-2'>
								<label className='text-sm font-medium'>Related Feedback</label>
								<FeedbackSelector
									projectId={projectData?.project?._id!}
									selectedIds={selectedFeedbackIds}
									onChange={setSelectedFeedbackIds}
								/>
								<p className='text-xs text-muted-foreground'>
									Link feedback items that are addressed by this update.
								</p>
							</div>

							<formError.Message prefix='Unable to update' />

							<div className='flex items-center justify-between gap-4'>
								<div className='flex items-center gap-2'>
									<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
										{([canSubmit, isSubmitting]) => (
											<Button
												type='submit'
												className={cn({
													'opacity-50 grayscale select-none':
														!canSubmit || status === 'pending',
												})}
											>
												{status === 'pending' ? 'Saving...' : 'Save Changes'}
											</Button>
										)}
									</form.Subscribe>
									{isPublished ? (
										<Button
											type='button'
											variant='outline'
											onClick={handleUnpublish}
											disabled={unpublishStatus === 'pending'}
										>
											{unpublishStatus === 'pending' ? 'Unpublishing...' : 'Unpublish'}
										</Button>
									) : (
										<Button
											type='button'
											variant='outline'
											onClick={handlePublish}
											disabled={publishStatus === 'pending'}
										>
											{publishStatus === 'pending' ? 'Publishing...' : 'Publish'}
										</Button>
									)}
								</div>
								<Button
									type='button'
									variant='destructive'
									onClick={handleDelete}
									disabled={deleteStatus === 'pending'}
								>
									{deleteStatus === 'pending' ? 'Deleting...' : 'Delete'}
								</Button>
							</div>
						</form.Form>
					</form.AppForm>
				</div>
			</div>
		</div>
	);
}
