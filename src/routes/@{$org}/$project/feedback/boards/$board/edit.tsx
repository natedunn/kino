import { useMemo, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';

import { resolveBoardIconName } from '@/components/board-icon';
import { IconSelector } from '@/components/icon-selector';
import { InlineAlert } from '@/components/inline-alert';
import { EmptyState } from '@/components/kino/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { iconRegistryOptions } from '@/icons';
import ChevronLeft from '@/icons/chevron-left';
import { boardsServer as crpcServer, useBoardsAPI as useCRPC } from '@/lib/convex/boards-api';
import { localizeError } from '@/lib/errors';
import { projectTitle, titleMeta } from '@/lib/seo';
import {
	boardFormSchema,
	filterSlugInput,
	FORM_LIMITS,
	SLUG_INPUT_PATTERN,
	validationMessage,
} from '@/lib/validation';
import * as m from '@/paraglide/messages.js';

export const Route = createFileRoute('/@{$org}/$project/feedback/boards/$board/edit')({
	loader: async ({ context, params }) => {
		const projectData = await context.queryClient.ensureQueryData(
			crpcServer.project.getDetails.queryOptions({
				orgSlug: params.org,
				slug: params.project,
			})
		);
		if (!projectData?.permissions.canManageContent) {
			throw redirect({
				to: '/@{$org}/$project/feedback',
				params: { org: params.org, project: params.project },
			});
		}
		const board = await context.queryClient.ensureQueryData(
			crpcServer.feedbackBoard.get.queryOptions({
				id: params.board,
				orgSlug: params.org,
				projectSlug: params.project,
			})
		);

		return {
			title: board?.name,
		};
	},
	head: ({ loaderData, params }) => ({
		meta: [
			titleMeta([
				loaderData?.title ?? m.feedback_board(),
				projectTitle(params.org, params.project),
			]),
		],
	}),
	component: EditBoardRoute,
});

function EditBoardRoute() {
	const params = Route.useParams();
	const navigate = useNavigate();
	const crpc = useCRPC();
	const [formError, setFormError] = useState<string | null>(null);

	const projectQuery = useQuery(
		crpc.project.getDetails.queryOptions({
			orgSlug: params.org,
			slug: params.project,
		})
	);
	const boardQuery = useQuery(
		crpc.feedbackBoard.get.queryOptions({
			id: params.board,
			orgSlug: params.org,
			projectSlug: params.project,
		})
	);
	const updateMutation = useMutation(
		crpc.feedbackBoard.update.mutationOptions({
			onSuccess: () => {
				navigate({
					params,
					to: '/@{$org}/$project/settings/boards',
				});
			},
		})
	);
	const deleteMutation = useMutation(
		crpc.feedbackBoard.remove.mutationOptions({
			onSuccess: () => {
				navigate({
					params: { org: params.org, project: params.project },
					to: '/@{$org}/$project/settings/boards',
				});
			},
		})
	);

	const formDefaultValues = useMemo(
		() => ({
			description: boardQuery.data?.description ?? '',
			icon: resolveBoardIconName({
				icon: boardQuery.data?.icon,
				name: boardQuery.data?.name,
			}),
			name: boardQuery.data?.name ?? '',
			slug: boardQuery.data?.slug ?? '',
		}),
		[
			boardQuery.data?.description,
			boardQuery.data?.icon,
			boardQuery.data?.name,
			boardQuery.data?.slug,
		]
	);

	const form = useForm({
		defaultValues: formDefaultValues,
		onSubmit: async ({ value }) => {
			if (!boardQuery.data) return;
			setFormError(null);
			const parsed = boardFormSchema.safeParse(value);
			if (!parsed.success) {
				setFormError(validationMessage(parsed.error));
				return;
			}

			await updateMutation.mutateAsync({
				id: boardQuery.data.id,
				description: parsed.data.description || undefined,
				icon: parsed.data.icon || undefined,
				name: parsed.data.name,
				orgSlug: params.org,
				projectSlug: params.project,
				slug: parsed.data.slug,
			});
		},
	});

	if (!projectQuery.data?.permissions.canManageContent) {
		return (
			<EmptyState
				title={m.project_boards_unavailable()}
				description={m.project_boards_unavailable_description()}
			/>
		);
	}

	if (!boardQuery.data) {
		return <EmptyState title={m.board_missing()} description={m.board_missing_help()} />;
	}
	return (
		<div className='container'>
			<div className='space-y-6 py-12'>
				<Link
					className='link-text inline-flex items-center gap-2 text-muted-foreground hocus:text-foreground'
					params={{ org: params.org, project: params.project }}
					to='/@{$org}/$project/settings/boards'
				>
					<ChevronLeft className='size-3' />
					{m.board_back()}
				</Link>
				<h1 className='text-3xl font-bold'>{m.board_edit_heading()}</h1>
				<div>
					<form
						className='space-y-5'
						onSubmit={(event) => {
							event.preventDefault();
							event.stopPropagation();
							void form.handleSubmit();
						}}
					>
						<form.Field name='name'>
							{(field) => (
								<div className='grid gap-2'>
									<label className='text-sm font-medium'>{m.board_name()}</label>
									<p className='text-sm text-muted-foreground'>{m.board_name_help()}</p>
									<Input
										maxLength={FORM_LIMITS.boardName}
										onChange={(event) => field.handleChange(event.target.value)}
										value={field.state.value}
									/>
								</div>
							)}
						</form.Field>
						<form.Field name='icon'>
							{(field) => (
								<div className='grid gap-2'>
									<label className='text-sm font-medium'>{m.board_icon()}</label>
									<p className='text-sm text-muted-foreground'>{m.board_icon_help()}</p>
									<IconSelector
										contentClassName='w-96'
										onValueChange={(value) => field.handleChange(value)}
										options={iconRegistryOptions}
										value={field.state.value}
									/>
								</div>
							)}
						</form.Field>
						<form.Field name='slug'>
							{(field) => (
								<div className='grid gap-2'>
									<label className='text-sm font-medium'>{m.board_slug()}</label>
									<p className='text-sm text-muted-foreground'>{m.board_slug_help()}</p>
									<Input
										autoCapitalize='none'
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
						<form.Field name='description'>
							{(field) => (
								<div className='grid gap-2'>
									<label className='text-sm font-medium'>{m.board_description()}</label>
									<p className='text-sm text-muted-foreground'>{m.board_edit_description_help()}</p>
									<Textarea
										maxLength={FORM_LIMITS.boardDescription}
										onChange={(event) => field.handleChange(event.target.value)}
										value={field.state.value}
									/>
								</div>
							)}
						</form.Field>
						{(formError ?? updateMutation.error ?? deleteMutation.error) ? (
							<InlineAlert variant='danger'>
								{formError ?? localizeError(updateMutation.error ?? deleteMutation.error)}
							</InlineAlert>
						) : null}
						<div className='flex items-center justify-between gap-4'>
							<form.Subscribe
								selector={(state) => ({
									isSubmitting: state.isSubmitting,
									name: state.values.name,
									slug: state.values.slug,
								})}
							>
								{({ isSubmitting, name, slug }) => {
									const disabled =
										!name.trim() || !slug.trim() || isSubmitting || updateMutation.isPending;

									return (
										<Button disabled={disabled} type='submit'>
											{isSubmitting || updateMutation.isPending
												? m.board_updating()
												: m.board_update()}
										</Button>
									);
								}}
							</form.Subscribe>
							<Button
								disabled={deleteMutation.isPending}
								onClick={() => {
									const project = projectQuery.data?.project;
									const board = boardQuery.data;
									if (!project || !board) return;
									if (window.confirm(m.board_delete_confirm())) {
										deleteMutation.mutate({
											boardId: board.id,
											projectId: project.id,
										});
									}
								}}
								type='button'
								variant='destructive'
							>
								{deleteMutation.isPending ? m.board_deleting() : m.board_delete()}
							</Button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}
