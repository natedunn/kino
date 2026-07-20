import type { ReactNode } from 'react';

import { useRef, useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useBlocker, useNavigate } from '@tanstack/react-router';
import { Plus, ShieldCheck, Trash2 } from 'lucide-react';

import { InlineAlert } from '@/components/inline-alert';
import { EmptyState } from '@/components/kino/common';
import { Label, LabelDescription, LabelWrapper } from '@/components/label';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { GithubIcon } from '@/icons';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { titleMeta } from '@/lib/seo';
import { cn } from '@/lib/utils';
import {
	filterSlugInput,
	FORM_LIMITS,
	MAX_PROJECT_URLS,
	projectFormSchema,
	SLUG_INPUT_PATTERN,
	validationMessage,
} from '@/lib/validation';

type ProjectVisibility = 'public' | 'private' | 'archived';

const VISIBILITY_LABELS: Record<ProjectVisibility, string> = {
	archived: 'Archived',
	private: 'Private',
	public: 'Public',
};

type ProjectUrl = {
	source?: string | null;
	text: string;
	url: string;
	verifiedAt?: number | null;
};

type ProjectUrlValue = { source?: string; text: string; url: string };

type GeneralSettingsFormValues = {
	description: string;
	name: string;
	slug: string;
	urls: Array<ProjectUrlValue>;
	visibility: ProjectVisibility;
};

// A settings card split into a bg-accent header (label + description) and a
// bg-card body (the field), divided by a full-width border.
function SectionCard({
	children,
	description,
	label,
}: {
	children: ReactNode;
	description?: ReactNode;
	label: string;
}) {
	return (
		<div className='overflow-hidden rounded-xl border bg-card'>
			<div className='bg-accent p-5'>
				<LabelWrapper className='mb-0'>
					<Label>{label}</Label>
					{description ? <LabelDescription>{description}</LabelDescription> : null}
				</LabelWrapper>
			</div>
			<div className='border-t bg-card p-5'>{children}</div>
		</div>
	);
}

export const Route = createFileRoute('/@{$org}/$project/settings/general/')({
	head: () => ({
		meta: [titleMeta(['General Settings'])],
	}),
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(
			crpcServer.project.getDetails.queryOptions({
				orgSlug: params.org,
				slug: params.project,
			})
		);
	},
	component: ProjectGeneralSettingsRoute,
});

function ProjectGeneralSettingsRoute() {
	const params = Route.useParams();
	const navigate = useNavigate();
	const crpc = useCRPC();
	const queryClient = useQueryClient();
	const [formError, setFormError] = useState<string | null>(null);

	const detailsQuery = useQuery(
		crpc.project.getDetails.queryOptions({
			orgSlug: params.org,
			slug: params.project,
		})
	);

	const updateMutation = useMutation(crpc.project.update.mutationOptions());
	const importMutation = useMutation(crpc.projectExternal.importGithubUrls.mutationOptions());

	const project = detailsQuery.data?.project;
	const canEdit = detailsQuery.data?.permissions.canEdit ?? false;
	const initialUrls = (project?.urls ?? []) as Array<ProjectUrl>;

	const importInfoQuery = useQuery(
		crpc.project.getGithubImportInfo.queryOptions(
			{ id: project?.id ?? '' },
			{ enabled: !!project?.id }
		)
	);

	const invalidateDetails = () =>
		queryClient.invalidateQueries({
			queryKey: crpc.project.getDetails.queryKey({
				orgSlug: params.org,
				slug: params.project,
			}),
		});

	const form = useForm({
		defaultValues: {
			description: project?.description ?? '',
			name: project?.name ?? '',
			slug: project?.slug ?? '',
			urls: initialUrls.map((entry) => ({
				source: entry.source ?? undefined,
				text: entry.text,
				url: entry.url,
			})),
			visibility: (project?.visibility ?? 'public') as ProjectVisibility,
		} satisfies GeneralSettingsFormValues,
		onSubmit: async ({ value, formApi }) => {
			if (!project) return;
			setFormError(null);

			// Drop link rows the user left entirely blank so they don't trip the
			// "label/url required" validation on an empty extra row.
			const urls = value.urls.filter((entry) => entry.text.trim() || entry.url.trim());

			const parsed = projectFormSchema.safeParse({
				description: value.description,
				name: value.name,
				slug: value.slug,
				urls,
				visibility: value.visibility,
			});
			if (!parsed.success) {
				setFormError(validationMessage(parsed.error));
				return;
			}

			try {
				const updated = await updateMutation.mutateAsync({
					description: parsed.data.description ?? '',
					id: project.id,
					name: parsed.data.name,
					slug: parsed.data.slug,
					urls: parsed.data.urls ?? [],
					visibility: parsed.data.visibility,
				});

				formApi.reset({
					description: updated.description ?? '',
					name: updated.name ?? value.name,
					slug: updated.slug ?? value.slug,
					// Reset from the server's re-verified result so link provenance
					// (which stayed "github" vs got downgraded) matches what persisted.
					urls: ((updated.urls ?? []) as Array<ProjectUrl>).map((entry) => ({
						source: entry.source ?? undefined,
						text: entry.text,
						url: entry.url,
					})),
					visibility: (updated.visibility ?? value.visibility) as ProjectVisibility,
				});
				await invalidateDetails();

				if (updated.slug && updated.slug !== params.project) {
					bypassBlockerRef.current = true;
					await navigate({
						params: { org: params.org, project: updated.slug },
						replace: true,
						to: '/@{$org}/$project/settings/general',
					});
					bypassBlockerRef.current = false;
				}
			} catch (error) {
				setFormError(error instanceof Error ? error.message : 'Unable to update project');
			}
		},
	});

	const isDirty = useStore(form.store, (state) => state.isDirty);
	// Guards the programmatic navigate after a slug change (the form is already
	// reset by then) so it isn't caught by the unsaved-changes blocker below.
	const bypassBlockerRef = useRef(false);
	const blocker = useBlocker({
		enableBeforeUnload: () => isDirty && !bypassBlockerRef.current,
		shouldBlockFn: () => isDirty && !bypassBlockerRef.current,
		withResolver: true,
	});

	if (detailsQuery.isLoading) {
		return (
			<div className='max-w-3xl space-y-4'>
				<div className='h-16 animate-pulse rounded-lg bg-muted/40' />
				<div className='h-72 animate-pulse rounded-xl bg-muted/40' />
			</div>
		);
	}

	if (!project || !canEdit) {
		return (
			<EmptyState
				title='Project editing unavailable'
				description='Only project and organization editors can change these settings.'
			/>
		);
	}

	const isSaving = updateMutation.isPending;

	return (
		<section className='max-w-3xl'>
			<form
				className='flex flex-col gap-6'
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					void form.handleSubmit();
				}}
			>
				<div
					className={cn('flex flex-col gap-6', {
						'pointer-events-none opacity-50': isSaving,
					})}
				>
					<SectionCard description='Displayed across Kino on your project pages.' label='Name'>
						<form.Field name='name'>
							{(field) => (
								<Input
									autoFocus
									maxLength={FORM_LIMITS.projectName}
									onChange={(event) => field.handleChange(event.target.value)}
									value={field.state.value}
								/>
							)}
						</form.Field>
					</SectionCard>

					<SectionCard
						description='Unique identifier used in your project URL. Changing the slug will update every link to your project.'
						label='Slug'
					>
						<form.Field name='slug'>
							{(field) => (
								<div className='flex items-stretch overflow-hidden rounded-md border bg-background focus-within:ring-1 focus-within:ring-ring'>
									<span className='flex items-center bg-muted/60 px-3 font-mono text-sm text-muted-foreground'>
										@{params.org}/
									</span>
									<Input
										autoCapitalize='none'
										className='rounded-none border-0 bg-transparent focus-visible:ring-0'
										maxLength={FORM_LIMITS.projectSlug}
										onChange={(event) =>
											field.handleChange(
												filterSlugInput(event.target.value, FORM_LIMITS.projectSlug)
											)
										}
										pattern={SLUG_INPUT_PATTERN}
										spellCheck={false}
										value={field.state.value}
									/>
								</div>
							)}
						</form.Field>
					</SectionCard>

					<SectionCard
						description='A short summary of what this project is about.'
						label='Description'
					>
						<form.Field name='description'>
							{(field) => (
								<Textarea
									maxLength={FORM_LIMITS.projectDescription}
									onChange={(event) => field.handleChange(event.target.value)}
									size='lg'
									value={field.state.value}
								/>
							)}
						</form.Field>
					</SectionCard>

					<SectionCard
						description={<>Website, docs, socials, or anything else. Up to {MAX_PROJECT_URLS}.</>}
						label='Links'
					>
						<form.Field mode='array' name='urls'>
							{(field) => {
								const urls = field.state.value;
								const canImport =
									(importInfoQuery.data?.connected ?? false) &&
									!urls.some((entry) => entry.source === 'github') &&
									urls.length < MAX_PROJECT_URLS;

								return (
									<div className='flex flex-col gap-3'>
										{urls.map((entry, index) =>
											entry.source === 'github' ? (
												// Verified (GitHub) links live in the same list but are
												// read-only. They're staged like everything else and
												// re-verified server-side on Save.
												<div
													className='flex flex-col gap-2 sm:flex-row sm:items-start'
													key={`github-${entry.url}`}
												>
													<div className='relative w-full sm:w-40 sm:shrink-0'>
														<ShieldCheck className='pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-emerald-600' />
														<Input
															aria-label='Verified link label'
															className='w-full pl-8'
															readOnly
															value={entry.text}
														/>
													</div>
													<div className='flex gap-2 sm:flex-1'>
														<Input
															aria-label='Verified link URL'
															className='flex-1'
															readOnly
															value={entry.url}
														/>
														<Button
															aria-label='Remove verified link'
															onClick={() => field.removeValue(index)}
															size='icon'
															type='button'
															variant='ghost'
														>
															<Trash2 className='size-4' />
														</Button>
													</div>
												</div>
											) : (
												<div className='flex flex-col gap-2 sm:flex-row sm:items-start' key={index}>
													<form.Field name={`urls[${index}].text`}>
														{(sub) => (
															<Input
																aria-label='Link label'
																className='w-full sm:w-40 sm:shrink-0'
																maxLength={FORM_LIMITS.urlLabel}
																onChange={(event) => sub.handleChange(event.target.value)}
																placeholder='Label'
																value={sub.state.value}
															/>
														)}
													</form.Field>
													<div className='flex gap-2 sm:flex-1'>
														<form.Field name={`urls[${index}].url`}>
															{(sub) => (
																<Input
																	aria-label='Link URL'
																	className='flex-1'
																	inputMode='url'
																	maxLength={FORM_LIMITS.url}
																	onChange={(event) => sub.handleChange(event.target.value)}
																	placeholder='https://example.com'
																	value={sub.state.value}
																/>
															)}
														</form.Field>
														<Button
															aria-label='Remove link'
															onClick={() => field.removeValue(index)}
															size='icon'
															type='button'
															variant='ghost'
														>
															<Trash2 className='size-4' />
														</Button>
													</div>
												</div>
											)
										)}

										<div className='flex flex-wrap items-center gap-2'>
											<Button
												disabled={urls.length >= MAX_PROJECT_URLS}
												onClick={() =>
													field.pushValue({
														source: undefined,
														text: '',
														url: '',
													})
												}
												size='sm'
												type='button'
												variant='outline'
											>
												<Plus className='size-4' />
												Add link
											</Button>
											{canImport ? (
												<Button
													disabled={importMutation.isPending}
													onClick={async () => {
														setFormError(null);
														try {
															const result = await importMutation.mutateAsync({
																id: project.id,
															});
															// Stage the links in the form — nothing persists
															// until Save. The repo link is prepended and
															// shown verified (re-checked server-side); the
															// homepage comes in as a normal editable link.
															if (
																!field.state.value.some((entry) => entry.url === result.repoUrl)
															) {
																field.insertValue(0, {
																	source: 'github',
																	text: 'Repository',
																	url: result.repoUrl,
																});
															}
															const homepage = result.homepage;
															if (
																homepage &&
																field.state.value.length < MAX_PROJECT_URLS &&
																!field.state.value.some((entry) => entry.url === homepage)
															) {
																field.pushValue({
																	source: undefined,
																	text: 'Website',
																	url: homepage,
																});
															}
														} catch (error) {
															setFormError(
																error instanceof Error
																	? error.message
																	: 'Unable to import from GitHub'
															);
														}
													}}
													size='sm'
													type='button'
													variant='outline'
												>
													<GithubIcon className='size-4' />
													{importMutation.isPending
														? 'Adding…'
														: `Add from ${importInfoQuery.data?.repoFullName ?? 'GitHub'}`}
												</Button>
											) : null}
										</div>
									</div>
								);
							}}
						</form.Field>
					</SectionCard>

					<SectionCard
						description='Public projects are visible to everyone. Private projects are only visible to members.'
						label='Visibility'
					>
						<form.Field name='visibility'>
							{(field) => (
								<Select
									onValueChange={(value) => field.handleChange(value as ProjectVisibility)}
									value={field.state.value}
								>
									<SelectTrigger className='w-full sm:w-56'>
										<SelectValue placeholder='Select visibility'>
											{(value) => VISIBILITY_LABELS[value as ProjectVisibility]}
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='public'>Public</SelectItem>
										<SelectItem value='private'>Private</SelectItem>
									</SelectContent>
								</Select>
							)}
						</form.Field>
					</SectionCard>
				</div>

				{(formError ?? updateMutation.error) ? (
					<InlineAlert variant='danger'>
						Unable to update project: {formError ?? updateMutation.error?.message}
					</InlineAlert>
				) : null}

				<div className='sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t bg-background/80 py-4 backdrop-blur md:-ml-8 md:w-[calc(100%_+_2rem)]'>
					<form.Subscribe
						selector={(state) => ({
							isSubmitting: state.isSubmitting,
							name: state.values.name,
							slug: state.values.slug,
						})}
					>
						{({ isSubmitting, name, slug }) => {
							const saving = isSubmitting || updateMutation.isPending;
							const cannotSave = !isDirty || !name.trim() || !slug.trim() || saving;

							return (
								<>
									<Button
										disabled={!isDirty || saving}
										onClick={() => {
											setFormError(null);
											form.reset();
										}}
										type='button'
										variant='ghost'
									>
										Reset
									</Button>
									<Button
										className={cn({
											'opacity-50 grayscale select-none': cannotSave,
										})}
										disabled={cannotSave}
										type='submit'
									>
										{saving ? 'Saving...' : 'Save changes'}
									</Button>
								</>
							);
						}}
					</form.Subscribe>
				</div>
			</form>

			{blocker.status === 'blocked' ? (
				<Dialog
					open
					onOpenChange={(open) => {
						if (!open) blocker.reset();
					}}
				>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Discard unsaved changes?</DialogTitle>
							<DialogDescription>
								You have unsaved changes to this project. If you leave now, your changes will be
								lost.
							</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<Button onClick={() => blocker.reset()} type='button' variant='outline'>
								Stay
							</Button>
							<Button onClick={() => blocker.proceed()} type='button' variant='destructive'>
								Leave
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			) : null}
		</section>
	);
}
