import type { MarkdownEditorRef } from '@/components/editor/markdown-editor';
import type { Id } from '../../../../../../convex/native/_generated/dataModel';

import { useRef, useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation } from 'convex/react';

import { LazyMarkdownEditor } from '@/components/editor/markdown-editor.lazy';
import { sanitizeEditorContent } from '@/components/editor/sanitize-content';
import { InlineAlert } from '@/components/inline-alert';
import { EmptyState } from '@/components/kino/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { requireAuth } from '@/lib/auth/require-auth';
import { localizeError } from '@/lib/errors';
import { projectTitle, titleMeta } from '@/lib/seo';
import { cn } from '@/lib/utils';
import { FORM_LIMITS } from '@/lib/validation';
import * as m from '@/paraglide/messages.js';

import { api as nativeApi } from '../../../../../../convex/native/_generated/api';

export const Route = createFileRoute('/@{$org}/$project/discussions/new/')({
	head: ({ params }) => ({
		meta: [titleMeta([m.discussions_new_heading(), projectTitle(params.org, params.project)])],
	}),
	// Starting a discussion requires a signed-in user; `discussions.create`
	// remains the real boundary (including the team-only posting policy).
	loader: ({ context, location }) => requireAuth(context, location),
	component: NewDiscussionRoute,
});

function NewDiscussionRoute() {
	const params = Route.useParams();
	const projectQuery = useQuery(
		convexQuery(nativeApi.projects.getBySlugs, {
			organizationSlug: params.org,
			projectSlug: params.project,
		})
	);
	const projectId = projectQuery.data?.project.id;
	const accessQuery = useQuery(
		convexQuery(nativeApi.discussions.viewerAccess, projectId ? { projectId } : 'skip')
	);

	const access = accessQuery.data;
	if (projectQuery.isPending || (projectId && access === undefined)) return null;
	if (!projectId || !access?.canCreate)
		return (
			<div className='container py-10 [--max-width:52rem]'>
				<EmptyState
					action={
						<Button asChild variant='outline'>
							<Link params={params} to='/@{$org}/$project/discussions'>
								{m.discussions_back()}
							</Link>
						</Button>
					}
					description={m.discussions_cannot_create_description()}
					title={m.discussions_cannot_create_title()}
				/>
			</div>
		);
	return <NewDiscussionForm params={params} projectId={projectId} />;
}

function NewDiscussionForm({
	params,
	projectId,
}: {
	params: { org: string; project: string };
	projectId: Id<'projects'>;
}) {
	const navigate = useNavigate();
	const create = useMutation(nativeApi.discussions.create);
	const editorRef = useRef<MarkdownEditorRef>(null);
	const [title, setTitle] = useState('');
	const [body, setBody] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	async function submit() {
		if (submitting) return;
		setError(null);
		const trimmedTitle = title.trim();
		const text = editorRef.current?.getText() ?? '';
		const content = sanitizeEditorContent(editorRef.current?.getHTML() ?? body);
		if (!trimmedTitle) return setError(m.discussions_title_required());
		if (trimmedTitle.length > FORM_LIMITS.discussionTitle)
			return setError(m.discussions_title_too_long({ count: FORM_LIMITS.discussionTitle }));
		if (!text.trim() || !content) return setError(m.discussions_body_required());
		// Count visible text, not HTML markup; the server caps stored HTML length.
		if (text.length > FORM_LIMITS.discussionBody)
			return setError(m.discussions_body_too_long({ count: FORM_LIMITS.discussionBody }));
		setSubmitting(true);
		try {
			const result = await create({ projectId, title: trimmedTitle, body: content });
			editorRef.current?.clearLocalDraft();
			await navigate({
				params: { ...params, slug: result.slug },
				to: '/@{$org}/$project/discussions/$slug',
			});
		} catch (createError) {
			setError(localizeError(createError, m.discussions_create_failed()));
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div>
			<div className='border-b'>
				<div className='container pt-10 pb-6 [--max-width:52rem]'>
					<h1 className='text-2xl font-bold md:text-3xl'>{m.discussions_new_heading()}</h1>
				</div>
			</div>
			<div className='container py-6 [--max-width:52rem]'>
				<form
					className={cn('flex flex-col gap-6', { 'pointer-events-none opacity-50': submitting })}
					onSubmit={(event) => {
						event.preventDefault();
						void submit();
					}}
				>
					<div className='flex flex-col gap-2'>
						<label className='text-sm font-medium' htmlFor='discussion-title'>
							{m.discussions_field_title()}
						</label>
						<Input
							autoFocus
							disabled={submitting}
							id='discussion-title'
							maxLength={FORM_LIMITS.discussionTitle}
							onChange={(event) => setTitle(event.target.value)}
							placeholder={m.discussions_title_placeholder()}
							value={title}
						/>
					</div>
					<div className='flex flex-col gap-2'>
						<span className='text-sm font-medium'>{m.discussions_field_body()}</span>
						<LazyMarkdownEditor
							ariaLabel={m.discussions_field_body()}
							disabled={submitting}
							localDraftKey={`discussion-new:${projectId}`}
							minHeight='160px'
							onChange={setBody}
							onSubmitShortcut={() => void submit()}
							placeholder={m.discussions_body_placeholder()}
							ref={editorRef}
							value={body}
						/>
					</div>
					{error ? <InlineAlert variant='danger'>{error}</InlineAlert> : null}
					<div className='flex justify-end gap-2'>
						<Button asChild type='button' variant='ghost'>
							<Link params={params} to='/@{$org}/$project/discussions'>
								{m.common_cancel()}
							</Link>
						</Button>
						<Button disabled={submitting} type='submit'>
							{submitting ? m.discussions_creating() : m.discussions_create()}
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
}
