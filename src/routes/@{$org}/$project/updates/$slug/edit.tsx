import type { MarkdownEditorRef } from '@/components/editor/markdown-editor';
import type { UpdateCategory } from '../-components/category-badge';

import { useMemo, useRef, useState } from 'react';
import { revalidateLogic, useForm } from '@tanstack/react-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
	createFileRoute,
	getRouteApi,
	Link,
	notFound,
	redirect,
	useNavigate,
} from '@tanstack/react-router';
import { ArrowLeft, Image, LinkIcon, Settings2, Tag, Trash2 } from 'lucide-react';

import { LazyMarkdownEditor } from '@/components/editor/markdown-editor.lazy';
import { sanitizeEditorContent } from '@/components/editor/sanitize-content';
import { InlineAlert } from '@/components/inline-alert';
import { SidebarSection } from '@/components/sidebar-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { authClient } from '@/lib/convex/auth-client';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { localizeError } from '@/lib/errors';
import { useSidebarState } from '@/lib/hooks/use-sidebar-state';
import { projectTitle, titleFromSlug, titleMeta } from '@/lib/seo';
import { cn } from '@/lib/utils';
import { updateFormSchema, validationMessage } from '@/lib/validation';
import * as m from '@/paraglide/messages.js';

import { CoverImageUpload } from '../-components/cover-image-upload';
import {
	CategoryField,
	RelatedFeedbackField,
	TagsField,
	UpdateEditorCard,
	UpdateTitleInput,
} from '../-components/update-editor-fields';

type UpdateFormValues = {
	category: UpdateCategory;
	content: string;
	coverImageId: string | null;
	relatedFeedbackIds: Array<string>;
	tags: Array<string>;
	title: string;
};

const SIDEBAR_STORAGE_KEY = 'update-editor-sidebar-state';

const DEFAULT_SIDEBAR_STATE = {
	coverImage: true,
	relatedFeedback: false,
	settings: true,
	tags: true,
};

const routeApi = getRouteApi('/@{$org}/$project/updates/$slug/edit');

export const Route = createFileRoute('/@{$org}/$project/updates/$slug/edit')({
	component: EditUpdateRoute,
	loader: async ({ context, params }) => {
		const projectData = await context.queryClient.ensureQueryData(
			crpcServer.project.getDetails.queryOptions({
				orgSlug: params.org,
				slug: params.project,
			})
		);

		if (!projectData?.project?.id) {
			throw notFound();
		}

		if (!projectData.permissions.canManageContent) {
			throw redirect({
				to: '/@{$org}/$project/updates/$slug',
				params: {
					org: params.org,
					project: params.project,
					slug: params.slug,
				},
			});
		}

		const updateData = await context.queryClient.ensureQueryData(
			crpcServer.update.getBySlug.queryOptions({
				projectId: projectData.project.id,
				slug: params.slug,
			})
		);

		if (!updateData?.update) {
			throw notFound();
		}

		return {
			title: updateData.update.title,
		};
	},
	head: ({ loaderData, params }) => ({
		meta: [
			titleMeta([
				loaderData?.title ?? titleFromSlug(params.slug),
				projectTitle(params.org, params.project),
			]),
		],
	}),
});

function EditUpdateRoute() {
	const params = routeApi.useParams();
	const navigate = useNavigate();
	const crpc = useCRPC();
	const session = authClient.useSession();
	const [formError, setFormError] = useState('');
	const contentEditorRef = useRef<MarkdownEditorRef>(null);
	const { state: sidebarState, setSection: setSidebarSection } = useSidebarState(
		SIDEBAR_STORAGE_KEY,
		DEFAULT_SIDEBAR_STATE
	);

	const projectQuery = useQuery(
		crpc.project.getDetails.queryOptions({
			orgSlug: params.org,
			slug: params.project,
		})
	);
	const updateQuery = useQuery(
		crpc.update.getBySlug.queryOptions(
			{
				projectId: projectQuery.data?.project?.id ?? '',
				slug: params.slug,
			},
			{ enabled: !!projectQuery.data?.project }
		)
	);

	const saveMutation = useMutation(
		crpc.update.update.mutationOptions({
			onError: (error) => setFormError(localizeError(error, m.common_try_again())),
			onSuccess: () => {
				contentEditorRef.current?.clearLocalDraft();
				navigate({
					params,
					to: '/@{$org}/$project/updates/$slug',
				});
			},
		})
	);
	const publishMutation = useMutation(
		crpc.update.publish.mutationOptions({
			onError: (error) => setFormError(localizeError(error, m.common_try_again())),
			onSuccess: () => {
				navigate({
					params,
					to: '/@{$org}/$project/updates/$slug',
				});
			},
		})
	);
	const unpublishMutation = useMutation(
		crpc.update.unpublish.mutationOptions({
			onError: (error) => setFormError(localizeError(error, m.common_try_again())),
		})
	);
	const deleteMutation = useMutation(
		crpc.update.remove.mutationOptions({
			onError: (error) => setFormError(localizeError(error, m.common_try_again())),
			onSuccess: () => {
				contentEditorRef.current?.clearLocalDraft();
				navigate({
					params: { org: params.org, project: params.project },
					to: '/@{$org}/$project/updates',
				});
			},
		})
	);

	const updateData = updateQuery.data;
	const update = updateData?.update;
	const relatedFeedbackIdsKey = useMemo(
		() => JSON.stringify((update?.relatedFeedbackIds ?? []).map(String)),
		[update?.relatedFeedbackIds]
	);
	const tagsKey = useMemo(() => JSON.stringify((update?.tags ?? []).map(String)), [update?.tags]);
	const formDefaultValues = useMemo<UpdateFormValues>(
		() => ({
			category: (update?.category ?? 'changelog') as UpdateCategory,
			content: update?.content ?? '',
			coverImageId: update?.coverImageId ?? null,
			relatedFeedbackIds: (update?.relatedFeedbackIds ?? []).map(String),
			tags: (update?.tags ?? []).map(String),
			title: update?.title ?? '',
		}),
		// `tagsKey`/`relatedFeedbackIdsKey` are stringified snapshots of the raw
		// arrays used in the body; depending on the raw arrays would churn identity.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[
			relatedFeedbackIdsKey,
			tagsKey,
			update?.category,
			update?.content,
			update?.coverImageId,
			update?.id,
			update?.title,
		]
	);

	const form = useForm({
		defaultValues: formDefaultValues,
		onSubmit: async ({ value }) => {
			if (!update) return;
			setFormError('');
			const parsed = updateFormSchema.safeParse({
				content: sanitizeEditorContent(value.content),
				tags: value.tags,
				title: value.title,
			});
			if (!parsed.success) {
				setFormError(validationMessage(parsed.error));
				return;
			}
			await saveMutation.mutateAsync({
				category: value.category,
				content: parsed.data.content,
				id: update.id,
				relatedFeedbackIds: value.relatedFeedbackIds,
				tags: parsed.data.tags,
				title: parsed.data.title,
			});
		},
		validationLogic: revalidateLogic({
			mode: 'submit',
			modeAfterSubmission: 'change',
		}),
	});

	if (!session.data?.user) {
		return <InlineAlert variant='warning'>{m.updates_sign_in_edit()}</InlineAlert>;
	}

	if ((projectQuery.isLoading || updateQuery.isLoading) && !update) {
		return <div className='h-52 animate-pulse rounded-lg bg-muted/40' />;
	}

	if (
		!projectQuery.data?.project ||
		!projectQuery.data.permissions.canManageContent ||
		!update ||
		!updateData.canEdit
	) {
		return <InlineAlert variant='warning'>{m.updates_edit_unavailable()}</InlineAlert>;
	}

	const project = projectQuery.data.project;

	const isPublished = update.status === 'published';

	return (
		<form
			className='flex flex-1 flex-col'
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				void form.handleSubmit();
			}}
		>
			{/* Sticky header bar */}
			<div className='sticky top-0 z-10 border-b bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80'>
				<div className='container flex items-center justify-between gap-4 py-3'>
					<div className='flex items-center gap-3'>
						<Link
							aria-label={m.updates_back_single()}
							className='inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground'
							params={params}
							to='/@{$org}/$project/updates/$slug'
						>
							<ArrowLeft className='size-3.5' />
							<span aria-hidden='true' className='hidden sm:inline'>
								{m.updates_back_single()}
							</span>
						</Link>
						<Separator className='hidden h-4 sm:block' orientation='vertical' />
						<span className='hidden text-sm font-medium text-muted-foreground sm:inline'>
							{m.updates_edit()}
						</span>
						{isPublished ? (
							<Badge
								className='bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
								variant='outline'
							>
								{m.updates_status_published()}
							</Badge>
						) : (
							<Badge
								className='bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
								variant='outline'
							>
								{m.updates_status_draft()}
							</Badge>
						)}
					</div>

					<div className='flex items-center gap-2'>
						{isPublished ? (
							<Button
								disabled={unpublishMutation.isPending}
								onClick={() => unpublishMutation.mutate({ id: update.id })}
								size='sm'
								type='button'
								variant='ghost'
							>
								{unpublishMutation.isPending ? m.updates_unpublishing() : m.updates_unpublish()}
							</Button>
						) : (
							<Button
								disabled={publishMutation.isPending}
								onClick={() => publishMutation.mutate({ id: update.id })}
								size='sm'
								type='button'
								variant='outline'
							>
								{publishMutation.isPending ? m.updates_publishing() : m.updates_publish()}
							</Button>
						)}
						<form.Subscribe
							selector={(state) => ({
								content: state.values.content,
								isSubmitting: state.isSubmitting,
								title: state.values.title,
							})}
						>
							{({ content, isSubmitting, title }) => {
								const visuallyDisabled =
									!title.trim() ||
									!sanitizeEditorContent(content) ||
									isSubmitting ||
									saveMutation.isPending;

								return (
									<Button
										className={cn({
											'opacity-50 grayscale select-none': visuallyDisabled,
										})}
										disabled={visuallyDisabled}
										size='sm'
										type='submit'
									>
										{saveMutation.isPending ? m.updates_saving() : m.updates_save_changes()}
									</Button>
								);
							}}
						</form.Subscribe>
					</div>
				</div>
			</div>

			{formError ? (
				<div className='container pt-4'>
					<InlineAlert variant='danger'>
						{m.updates_update_failed({ error: formError })}
					</InlineAlert>
				</div>
			) : null}

			{/* Two-column layout */}
			<div className='container flex flex-1 flex-col gap-8 md:grid md:grid-cols-12 md:grid-rows-1'>
				{/* Sidebar */}
				<div className='order-last py-6 md:col-span-4 md:border-l md:border-border/75'>
					<div className='sticky top-14 flex flex-col gap-6 md:pl-8'>
						<SidebarSection
							icon={<Settings2 className='size-3.5' />}
							onOpenChange={(open) => setSidebarSection('settings', open)}
							open={sidebarState.settings}
							title={m.updates_settings()}
						>
							<form.Field name='category'>
								{(field) => (
									<CategoryField
										onValueChange={(value) => field.handleChange(value)}
										value={field.state.value}
									/>
								)}
							</form.Field>
						</SidebarSection>

						<SidebarSection
							icon={<Image className='size-3.5' />}
							onOpenChange={(open) => setSidebarSection('coverImage', open)}
							open={sidebarState.coverImage}
							title={m.updates_cover_image()}
						>
							<form.Field name='coverImageId'>
								{(field) => (
									<CoverImageUpload
										currentCoverImageUrl={updateData.coverImageUrl}
										onChange={(value) => field.handleChange(value)}
										onError={(message) => setFormError(message)}
										updateId={update.id}
									/>
								)}
							</form.Field>
						</SidebarSection>

						<SidebarSection
							icon={<Tag className='size-3.5' />}
							onOpenChange={(open) => setSidebarSection('tags', open)}
							open={sidebarState.tags}
							title={m.updates_tags()}
						>
							<form.Field name='tags'>
								{(field) => (
									<TagsField
										onChange={(tags) => field.handleChange(tags)}
										value={field.state.value}
									/>
								)}
							</form.Field>
						</SidebarSection>

						<SidebarSection
							icon={<LinkIcon className='size-3.5' />}
							onOpenChange={(open) => setSidebarSection('relatedFeedback', open)}
							open={sidebarState.relatedFeedback}
							title={m.updates_related_feedback()}
						>
							<form.Field name='relatedFeedbackIds'>
								{(field) => (
									<RelatedFeedbackField
										onChange={(ids) => field.handleChange(ids)}
										projectId={project.id}
										selectedIds={field.state.value}
									/>
								)}
							</form.Field>
						</SidebarSection>

						<Separator />
						<Button
							className='w-full gap-2 text-muted-foreground hover:text-destructive'
							disabled={deleteMutation.isPending}
							onClick={() => {
								if (window.confirm(m.updates_delete_confirm())) {
									deleteMutation.mutate({ id: update.id });
								}
							}}
							size='sm'
							type='button'
							variant='ghost'
						>
							<Trash2 className='size-3.5' />
							{deleteMutation.isPending ? m.updates_deleting() : m.updates_delete()}
						</Button>
					</div>
				</div>

				{/* Main content area */}
				<div className='flex flex-col gap-6 py-8 md:col-span-8'>
					<UpdateEditorCard
						editor={
							<form.Field name='content'>
								{(field) => (
									<LazyMarkdownEditor
										ariaLabel={m.updates_content()}
										localDraftKey='update-edit-content'
										minHeight='200px'
										onChange={(html) => field.handleChange(html)}
										placeholder={m.updates_content_placeholder()}
										ref={contentEditorRef}
										value={field.state.value}
										variant='borderless'
									/>
								)}
							</form.Field>
						}
						title={
							<form.Field name='title'>
								{(field) => (
									<UpdateTitleInput
										onChange={(value) => field.handleChange(value)}
										value={field.state.value}
									/>
								)}
							</form.Field>
						}
					/>
				</div>
			</div>
		</form>
	);
}
