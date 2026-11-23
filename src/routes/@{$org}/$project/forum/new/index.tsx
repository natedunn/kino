import type { MarkdownEditorRef } from '@/components/editor/markdown-editor';
import type { FunctionReturnType } from 'convex/server';
import type { PollDraft } from '../-components/new-poll-fields';
import type { Id } from '../../../../../../convex/native/_generated/dataModel';

import { useEffect, useRef, useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound, useNavigate } from '@tanstack/react-router';
import { useMutation } from 'convex/react';

import { BoardIcon } from '@/components/board-icon';
import {
	getEditorDraftStorageKey,
	readEditorDraft,
	removeEditorDraft,
	writeEditorDraft,
} from '@/components/editor/local-draft';
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

import { NewPollFields, pollDraftError } from '../-components/new-poll-fields';
import { NewTopicSuggestions } from '../-components/new-topic-suggestions';
import { api as nativeApi } from '../../../../../../convex/native/_generated/api';

type NewTopicSearch = { category?: string };

export const Route = createFileRoute('/@{$org}/$project/forum/new/')({
	validateSearch: (search: Record<string, unknown>): NewTopicSearch => {
		const category = typeof search.category === 'string' ? search.category.trim() : '';
		return category ? { category } : {};
	},
	head: ({ params }) => ({
		meta: [titleMeta([m.forum_new_heading(), projectTitle(params.org, params.project)])],
	}),
	// Starting a topic requires a signed-in user; `forum.create`
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
			convexQuery(nativeApi.forum.viewerAccess, { projectId: projectData.project.id })
		);
		if (!access?.enabled) throw notFound();
	},
	component: NewTopicRoute,
});

type PostableCategory = NonNullable<
	FunctionReturnType<typeof nativeApi.forum.viewerAccess>
>['categories'][number];

function NewTopicRoute() {
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
		convexQuery(nativeApi.forum.viewerAccess, projectId ? { projectId } : 'skip')
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
							<Link params={params} to='/@{$org}/$project/forum'>
								{m.forum_back()}
							</Link>
						</Button>
					}
					description={
						access?.writable === false
							? m.forum_cannot_create_archived_description()
							: m.forum_new_cannot_create_description()
					}
					title={m.forum_cannot_create_title()}
				/>
			</div>
		);
	return (
		<NewTopicForm
			categories={categories}
			initialCategorySlug={search.category}
			params={params}
			projectId={projectId}
		/>
	);
}

function NewTopicForm({
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
	const create = useMutation(nativeApi.forum.create);
	const editorRef = useRef<MarkdownEditorRef>(null);
	const [categoryId, setCategoryId] = useState(
		() => (categories.find((category) => category.slug === initialCategorySlug) ?? categories[0]).id
	);
	// A category can be removed (or locked to the team) while the form is open.
	const category = categories.find((item) => item.id === categoryId);
	const [title, setTitle] = useState('');
	// The body editor keeps its own local draft; keep the title beside it so
	// following the "post as feedback" link and coming back loses neither.
	const titleDraftKey = `topic-new-title:${projectId}`;
	const [body, setBody] = useState('');
	const [poll, setPoll] = useState<PollDraft | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		const key = getEditorDraftStorageKey(titleDraftKey);
		const draft = key ? readEditorDraft(key) : null;
		if (draft) setTitle((current) => current || draft);
	}, [titleDraftKey]);

	function changeTitle(value: string) {
		setTitle(value);
		const key = getEditorDraftStorageKey(titleDraftKey);
		if (!key) return;
		if (value.trim()) writeEditorDraft(key, value);
		else removeEditorDraft(key);
	}

	async function submit() {
		if (submitting) return;
		setError(null);
		const trimmedTitle = title.trim();
		const text = editorRef.current?.getText() ?? '';
		const content = sanitizeEditorContent(editorRef.current?.getHTML() ?? body);
		if (!category) return setError(m.forum_new_category_required());
		if (!trimmedTitle) return setError(m.forum_title_required());
		if (trimmedTitle.length > FORM_LIMITS.forumTopicTitle)
			return setError(m.forum_title_too_long({ count: FORM_LIMITS.forumTopicTitle }));
		if (!text.trim() || !content) return setError(m.forum_body_required());
		// Count visible text, not HTML markup; the server caps stored HTML length.
		if (text.length > FORM_LIMITS.forumTopicBody)
			return setError(m.forum_body_too_long({ count: FORM_LIMITS.forumTopicBody }));
		const pollError = poll && pollDraftError(poll);
		if (pollError) return setError(pollError);
		setSubmitting(true);
		try {
			const result = await create({
				projectId,
				categoryId: category.id,
				title: trimmedTitle,
				body: content,
				...(poll
					? {
							poll: {
								options: poll.options.map((option) => option.label.trim()),
								multiple: poll.multiple,
							},
						}
					: {}),
			});
			editorRef.current?.clearLocalDraft();
			const titleKey = getEditorDraftStorageKey(titleDraftKey);
			if (titleKey) removeEditorDraft(titleKey);
			await navigate({
				params: { ...params, slug: result.slug },
				to: '/@{$org}/$project/forum/$slug',
			});
		} catch (createError) {
			setError(localizeError(createError, m.forum_create_failed()));
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div>
			<div className='border-b bg-muted/50'>
				<div className='container pt-12 pb-6'>
					<h1 className='text-2xl font-bold md:text-3xl'>{m.forum_new_heading()}</h1>
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
						<label className='text-sm font-medium' htmlFor='topic-category'>
							{m.forum_new_field_category()}
						</label>
						<Select
							disabled={submitting}
							items={categories.map((item) => ({ label: item.name, value: item.id }))}
							onValueChange={(value) => {
								if (value) setCategoryId(value);
							}}
							value={category?.id ?? null}
						>
							<SelectTrigger className='w-64 max-w-full' id='topic-category'>
								<SelectValue placeholder={m.forum_new_category_placeholder()} />
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
						<label className='text-sm font-medium' htmlFor='topic-title'>
							{m.forum_field_title()}
						</label>
						<Input
							autoFocus
							disabled={submitting}
							id='topic-title'
							maxLength={FORM_LIMITS.forumTopicTitle}
							onChange={(event) => changeTitle(event.target.value)}
							placeholder={m.forum_title_placeholder()}
							value={title}
						/>
						<NewTopicSuggestions
							categoryFormat={category?.format}
							params={params}
							projectId={projectId}
							title={title}
						/>
					</div>
					<div className='flex flex-col gap-2'>
						<span className='text-sm font-medium'>{m.forum_field_body()}</span>
						<LazyMarkdownEditor
							ariaLabel={m.forum_field_body()}
							disabled={submitting}
							localDraftKey={`topic-new:${projectId}`}
							minHeight='160px'
							onChange={setBody}
							onSubmitShortcut={() => void submit()}
							placeholder={m.forum_body_placeholder()}
							ref={editorRef}
							value={body}
						/>
					</div>
					<NewPollFields disabled={submitting} draft={poll} onChange={setPoll} />
					{error ? <InlineAlert variant='danger'>{error}</InlineAlert> : null}
					<div className='flex justify-end gap-2'>
						<Button asChild type='button' variant='ghost'>
							<Link params={params} to='/@{$org}/$project/forum'>
								{m.common_cancel()}
							</Link>
						</Button>
						<Button disabled={submitting} type='submit'>
							{submitting ? m.forum_creating() : m.forum_create()}
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
}
