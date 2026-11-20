import type { MarkdownEditorRef } from '@/components/editor/markdown-editor';
import type { FunctionReturnType } from 'convex/server';
import type { Id } from '../../../../../../convex/native/_generated/dataModel';

import { useRef, useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound, useNavigate } from '@tanstack/react-router';
import { useMutation } from 'convex/react';

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
import { requireAuth } from '@/lib/auth/require-auth';
import { localizeError } from '@/lib/errors';
import { projectTitle, titleMeta } from '@/lib/seo';
import { cn } from '@/lib/utils';
import { FORM_LIMITS } from '@/lib/validation';
import * as m from '@/paraglide/messages.js';

import { api as nativeApi } from '../../../../../../convex/native/_generated/api';

type NewDiscussionSearch = { category?: string };

export const Route = createFileRoute('/@{$org}/$project/discussions/new/')({
	validateSearch: (search: Record<string, unknown>): NewDiscussionSearch => {
		const category = typeof search.category === 'string' ? search.category.trim() : '';
		return category ? { category } : {};
	},
	head: ({ params }) => ({
		meta: [titleMeta([m.discussions_new_heading(), projectTitle(params.org, params.project)])],
	}),
	// Starting a discussion requires a signed-in user; `discussions.create`
	// remains the real boundary (including each category's posting policy).
	loader: async ({ context, location, params }) => {
		requireAuth(context, location);
		const projectData = await context.queryClient.ensureQueryData(
			convexQuery(nativeApi.projects.getBySlugs, {
				organizationSlug: params.org,
				projectSlug: params.project,
			})
		);
		if (!projectData?.project) throw notFound();
		const access = await context.queryClient.ensureQueryData(
			convexQuery(nativeApi.discussions.viewerAccess, { projectId: projectData.project.id })
		);
		if (!access?.enabled) throw notFound();
	},
	component: NewDiscussionRoute,
});

type PostableCategory = NonNullable<
	FunctionReturnType<typeof nativeApi.discussions.viewerAccess>
>['categories'][number];

function NewDiscussionRoute() {
	const params = Route.useParams();
	const search = Route.useSearch();
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
	if (access && !access.enabled) throw notFound();
	const categories = access?.categories.filter((category) => category.canPost) ?? [];
	if (!projectId || !access?.canCreate || categories.length === 0)
		return (
			<div className='container py-10'>
				<EmptyState
					action={
						<Button asChild variant='outline'>
							<Link params={params} to='/@{$org}/$project/discussions'>
								{m.discussions_back()}
							</Link>
						</Button>
					}
					description={
						access?.writable === false
							? m.discussions_cannot_create_archived_description()
							: m.discussions_new_cannot_create_description()
					}
					title={m.discussions_cannot_create_title()}
				/>
			</div>
		);
	return (
		<NewDiscussionForm
			categories={categories}
			initialCategorySlug={search.category}
			params={params}
			projectId={projectId}
		/>
	);
}

function NewDiscussionForm({
	categories,
	initialCategorySlug,
	params,
	projectId,
}: {
	/** Only the categories the viewer can post in; never empty. */
	categories: Array<PostableCategory>;
	initialCategorySlug: string | undefined;
	params: { org: string; project: string };
	projectId: Id<'projects'>;
}) {
	const navigate = useNavigate();
	const create = useMutation(nativeApi.discussions.create);
	const editorRef = useRef<MarkdownEditorRef>(null);
	const [categoryId, setCategoryId] = useState(
		() => (categories.find((category) => category.slug === initialCategorySlug) ?? categories[0]).id
	);
	// A category can be removed (or locked to the team) while the form is open.
	const category = categories.find((item) => item.id === categoryId);
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
		if (!category) return setError(m.discussions_new_category_required());
		if (!trimmedTitle) return setError(m.discussions_title_required());
		if (trimmedTitle.length > FORM_LIMITS.discussionTitle)
			return setError(m.discussions_title_too_long({ count: FORM_LIMITS.discussionTitle }));
		if (!text.trim() || !content) return setError(m.discussions_body_required());
		// Count visible text, not HTML markup; the server caps stored HTML length.
		if (text.length > FORM_LIMITS.discussionBody)
			return setError(m.discussions_body_too_long({ count: FORM_LIMITS.discussionBody }));
		setSubmitting(true);
		try {
			const result = await create({
				projectId,
				categoryId: category.id,
				title: trimmedTitle,
				body: content,
			});
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
			<div className='border-b bg-muted/50'>
				<div className='container pt-12 pb-6'>
					<h1 className='text-2xl font-bold md:text-3xl'>{m.discussions_new_heading()}</h1>
				</div>
			</div>
			<div className='container py-6'>
				<form
					className={cn('flex flex-col gap-6', { 'pointer-events-none opacity-50': submitting })}
					onSubmit={(event) => {
						event.preventDefault();
						void submit();
					}}
				>
					<div className='flex flex-col gap-2'>
						<label className='text-sm font-medium' htmlFor='discussion-category'>
							{m.discussions_new_field_category()}
						</label>
						<Select
							disabled={submitting}
							items={categories.map((item) => ({ label: item.name, value: item.id }))}
							onValueChange={(value) => {
								if (value) setCategoryId(value);
							}}
							value={category?.id ?? null}
						>
							<SelectTrigger className='w-64 max-w-full' id='discussion-category'>
								<SelectValue placeholder={m.discussions_new_category_placeholder()} />
							</SelectTrigger>
							<SelectContent>
								{categories.map((item) => (
									<SelectItem key={item.id} value={item.id}>
										<BoardIcon icon={item.icon} name={item.name} size='14px' />
										{item.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{category?.description ? (
							<p className='text-sm text-muted-foreground'>{category.description}</p>
						) : null}
					</div>
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
