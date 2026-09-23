import type { MarkdownEditorRef } from '@/components/editor/markdown-editor';
import type { Id } from '../../../../../../convex/native/_generated/dataModel';

import { useRef, useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useForm } from '@tanstack/react-form';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation as useConvexMutation } from 'convex/react';

import { BoardIcon } from '@/components/board-icon';
import { LazyMarkdownEditor } from '@/components/editor/markdown-editor.lazy';
import { sanitizeEditorContent } from '@/components/editor/sanitize-content';
import { InlineAlert } from '@/components/inline-alert';
import { EmptyState } from '@/components/kino/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { useAuthSession } from '@/lib/auth/auth-client';
import { requireAuth } from '@/lib/auth/require-auth';
import { localizeError } from '@/lib/errors';
import { projectTitle, titleMeta } from '@/lib/seo';
import { cn } from '@/lib/utils';
import { feedbackFormSchema, FORM_LIMITS, validationMessage } from '@/lib/validation';

import { api as nativeApi } from '../../../../../../convex/native/_generated/api';

export const Route = createFileRoute('/@{$org}/$project/feedback/new/')({
	head: ({ params }) => ({
		meta: [titleMeta(['New Feedback', projectTitle(params.org, params.project)])],
	}),
	// Creating feedback requires a signed-in user. Redirect to `/auth` (and back)
	// rather than dead-ending on a sign-in prompt. Guarded in the `loader` (the
	// guard pattern used across the `@{$org}` subtree) rather than `beforeLoad`.
	// The `feedback.create` mutation remains the real boundary; the component still
	// handles in-place sign-out and the softer `canView` check.
	loader: ({ context, location }) => requireAuth(context, location),
	component: NewFeedbackRoute,
});

function NewFeedbackRoute() {
	return <NativeNewFeedbackRoute />;
}

function NativeNewFeedbackRoute() {
	const params = Route.useParams();
	const session = useAuthSession();
	const projectQuery = useQuery(
		convexQuery(nativeApi.projects.getBySlugs, {
			organizationSlug: params.org,
			projectSlug: params.project,
		})
	);
	const projectId = projectQuery.data?.project?.id;

	if (session.isPending) return null;
	if (!session.user)
		return (
			<EmptyState
				title='Sign in to create feedback'
				description='Sign in, then come back here to post feedback.'
			/>
		);
	if (projectQuery.isPending) return null;
	if (!projectId || !projectQuery.data.permissions.canView)
		return (
			<EmptyState
				title='Project not available'
				description='The selected project cannot be loaded for feedback creation.'
			/>
		);
	return <NativeNewFeedbackForm params={params} projectId={projectId} />;
}

function NativeNewFeedbackForm({
	params,
	projectId,
}: {
	params: { org: string; project: string };
	projectId: Id<'projects'>;
}) {
	const navigate = useNavigate();
	const [formError, setFormError] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const editorRef = useRef<MarkdownEditorRef>(null);
	const boardsQuery = useQuery(convexQuery(nativeApi.feedbackBoards.list, { projectId }));
	const createFeedback = useConvexMutation(nativeApi.feedback.create);
	const form = useForm({
		defaultValues: { boardId: '', firstComment: '', title: '' },
		onSubmit: async ({ value }) => {
			if (!projectId) return;
			setFormError(null);
			const parsed = feedbackFormSchema.safeParse({
				firstComment: sanitizeEditorContent(value.firstComment),
				title: value.title,
			});
			if (!parsed.success) {
				setFormError(validationMessage(parsed.error));
				return;
			}
			setCreating(true);
			try {
				const result = await createFeedback({
					boardId: value.boardId as Id<'feedbackBoards'>,
					firstComment: parsed.data.firstComment,
					projectId,
					title: parsed.data.title,
				});
				editorRef.current?.clearLocalDraft();
				await navigate({
					params: { ...params, slug: result.slug },
					to: '/@{$org}/$project/feedback/$slug',
				});
			} catch (error) {
				setFormError(localizeError(error));
			} finally {
				setCreating(false);
			}
		},
	});
	const boards = (boardsQuery.data ?? []) as Array<{
		id: string;
		icon: string | null;
		name: string;
	}>;

	return (
		<div>
			<div className='border-b bg-muted/50'>
				<div className='container pt-12 pb-6'>
					<h1 className='text-2xl font-bold md:text-3xl'>Add Feedback</h1>
				</div>
			</div>
			<div className='container py-6'>
				<form
					className={cn('flex flex-col gap-6', { 'pointer-events-none opacity-50': creating })}
					onSubmit={(event) => {
						event.preventDefault();
						event.stopPropagation();
						void form.handleSubmit();
					}}
				>
					<form.Field name='boardId'>
						{(field) => (
							<div className='flex flex-col gap-2'>
								<label className='text-sm font-medium'>Board</label>
								<Select
									disabled={creating}
									items={boards.map((item) => ({ label: item.name, value: item.id }))}
									onValueChange={(value) => field.handleChange(value ?? '')}
									value={field.state.value}
								>
									<SelectTrigger className='w-48'>
										<SelectValue placeholder='Select Board' />
									</SelectTrigger>
									<SelectContent>
										{boards.map((item) => (
											<SelectItem key={item.id} value={item.id}>
												<BoardIcon icon={item.icon} name={item.name} size='14px' />
												{item.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						)}
					</form.Field>
					<form.Field name='title'>
						{(field) => (
							<div className='flex flex-col gap-2'>
								<label className='text-sm font-medium'>Title</label>
								<Input
									disabled={creating}
									maxLength={FORM_LIMITS.feedbackTitle}
									onChange={(event) => field.handleChange(event.target.value)}
									value={field.state.value}
								/>
							</div>
						)}
					</form.Field>
					<form.Field name='firstComment'>
						{(field) => (
							<div className='flex flex-col gap-2'>
								<label className='text-sm font-medium'>Content</label>
								<LazyMarkdownEditor
									ariaLabel='Feedback description'
									disabled={creating}
									localDraftKey='feedback-new-description'
									minHeight='120px'
									onChange={(html) => field.handleChange(html)}
									onSubmitShortcut={() => form.handleSubmit()}
									placeholder='Describe your feedback...'
									ref={editorRef}
									value={field.state.value}
								/>
							</div>
						)}
					</form.Field>
					{formError ? (
						<InlineAlert variant='danger'>Unable to create feedback: {formError}</InlineAlert>
					) : null}
					<Button disabled={creating} type='submit'>
						{creating ? 'Creating...' : 'Create'}
					</Button>
				</form>
			</div>
		</div>
	);
}
