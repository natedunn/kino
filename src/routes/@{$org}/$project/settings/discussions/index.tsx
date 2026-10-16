import type { DiscussionCategory } from './-components/category-dialog';

import { useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery, useMutation as useTanstackMutation } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation } from 'convex/react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';

import { BoardIcon } from '@/components/board-icon';
import { InlineAlert } from '@/components/inline-alert';
import { EmptyState } from '@/components/kino/common';
import { Label, LabelDescription, LabelWrapper } from '@/components/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Pen from '@/icons/pen';
import { settingsServer, useSettingsAPI } from '@/lib/convex/settings-api';
import { localizeError } from '@/lib/errors';
import { titleMeta } from '@/lib/seo';
import { toast } from '@/lib/toast';
import * as m from '@/paraglide/messages.js';

import { ArchivedSettingsNotice } from '../-components/archived-notice';
import { api } from '../../../../../../convex/native/_generated/api';
import { CategoryDialog } from './-components/category-dialog';
import { DeleteCategoryDialog } from './-components/delete-category-dialog';
import { Switch } from './-components/switch';

// Mirrors MAX_CATEGORIES in convex/native/discussionCategories.ts.
const MAX_CATEGORIES = 25;

export const Route = createFileRoute('/@{$org}/$project/settings/discussions/')({
	head: () => ({
		meta: [titleMeta([m.settings_discussions()])],
	}),
	loader: async ({ context, params }) => {
		const details = await context.queryClient.ensureQueryData(
			settingsServer.project.getDetails.queryOptions({
				orgSlug: params.org,
				slug: params.project,
			})
		);
		const projectId = details?.project.id;
		if (projectId) {
			await context.queryClient.ensureQueryData(
				convexQuery(api.discussionCategories.list, { projectId })
			);
		}
	},
	component: DiscussionsSettingsRoute,
});

function DiscussionsSettingsRoute() {
	const params = Route.useParams();
	const crpc = useSettingsAPI();

	const detailsQuery = useQuery(
		crpc.project.getDetails.queryOptions({
			orgSlug: params.org,
			slug: params.project,
		})
	);
	const project = detailsQuery.data?.project;
	const categoriesQuery = useQuery(
		convexQuery(api.discussionCategories.list, project ? { projectId: project.id } : 'skip')
	);

	const updateProject = useTanstackMutation(crpc.project.update.mutationOptions());
	const reorderCategories = useMutation(api.discussionCategories.reorder).withOptimisticUpdate(
		(store, { categoryIds, projectId }) => {
			const current = store.getQuery(api.discussionCategories.list, { projectId });
			if (!current) return;
			const byId = new Map(current.map((category) => [category.id, category]));
			store.setQuery(
				api.discussionCategories.list,
				{ projectId },
				categoryIds.flatMap((id) => byId.get(id) ?? [])
			);
		}
	);

	// Dialogs keep their last category while closing so the content doesn't
	// change mid-animation; `category: null` in the editor means "new category".
	const [editor, setEditor] = useState<{ category: DiscussionCategory | null; open: boolean }>({
		category: null,
		open: false,
	});
	const [deleter, setDeleter] = useState<{ category: DiscussionCategory | null; open: boolean }>({
		category: null,
		open: false,
	});

	if (!project && detailsQuery.isLoading) {
		return <div className='h-64 animate-pulse rounded-xl border bg-muted/30' />;
	}

	const permissions = detailsQuery.data?.permissions;
	if (!project || !(permissions?.canEditSettings || permissions?.canManageContent)) {
		return (
			<EmptyState
				title={m.settings_discussions_unavailable()}
				description={m.settings_discussions_unavailable_description()}
			/>
		);
	}

	const isArchived = project.visibility === 'archived';
	const canToggle = permissions.canEditSettings && !isArchived;
	const canManage = permissions.canManageContent && !isArchived;
	const categories = categoriesQuery.data ?? [];
	// Reflect the pending value so the switch responds before the save lands.
	const enabled = updateProject.isPending
		? (updateProject.variables.discussionsEnabled ?? project.discussionsEnabled)
		: project.discussionsEnabled;

	const setEnabled = (discussionsEnabled: boolean) => {
		// updateProject replaces every editable field, so resend the current ones.
		updateProject.mutate({
			description: project.description,
			discussionsEnabled,
			id: project.id,
			name: project.name,
			slug: project.slug,
			updatesFeaturedMode: project.updatesFeaturedMode,
			urls: project.urls.map(({ source, text, url }) => ({ source, text, url })),
			visibility: project.visibility,
		});
	};

	const move = async (index: number, offset: -1 | 1) => {
		const ids = categories.map((category) => category.id);
		const [moved] = ids.splice(index, 1);
		if (!moved) return;
		ids.splice(index + offset, 0, moved);
		try {
			await reorderCategories({ categoryIds: ids, projectId: project.id });
		} catch (error) {
			await toast.error(localizeError(error, m.settings_discussions_reorder_failed()));
		}
	};

	return (
		<section className='space-y-6'>
			{isArchived ? <ArchivedSettingsNotice /> : null}
			<header className='border-b pb-4'>
				<h2 className='text-xl font-semibold'>{m.settings_discussions()}</h2>
				<p className='mt-1 text-sm text-muted-foreground'>{m.settings_discussions_description()}</p>
			</header>

			<div className='flex items-start justify-between gap-6 rounded-xl border bg-card p-5'>
				<LabelWrapper className='mb-0'>
					<Label htmlFor='discussions-enabled'>{m.settings_discussions_enable_label()}</Label>
					<LabelDescription>{m.settings_discussions_enable_description()}</LabelDescription>
					{permissions.canEditSettings ? null : (
						<LabelDescription>{m.settings_discussions_enable_read_only()}</LabelDescription>
					)}
				</LabelWrapper>
				<Switch
					checked={enabled}
					disabled={!canToggle || updateProject.isPending}
					id='discussions-enabled'
					onCheckedChange={setEnabled}
				/>
			</div>
			{updateProject.error ? (
				<InlineAlert variant='danger'>
					{localizeError(updateProject.error, m.settings_discussions_toggle_failed())}
				</InlineAlert>
			) : null}

			<div className='space-y-4'>
				<div className='flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between'>
					<div>
						<h3 className='text-base font-semibold'>{m.settings_discussions_categories()}</h3>
						<p className='mt-1 text-sm text-muted-foreground'>
							{permissions.canManageContent
								? m.settings_discussions_categories_description()
								: m.settings_discussions_categories_read_only()}
						</p>
					</div>
					{canManage ? (
						<Button
							disabled={categories.length >= MAX_CATEGORIES}
							onClick={() => setEditor({ category: null, open: true })}
							title={
								categories.length >= MAX_CATEGORIES
									? m.settings_discussions_category_limit({ count: MAX_CATEGORIES })
									: undefined
							}
						>
							<Plus className='size-4' />
							{m.settings_discussions_category_new()}
						</Button>
					) : null}
				</div>

				{categoriesQuery.isLoading ? (
					<div className='h-48 animate-pulse rounded-xl border bg-muted/30' />
				) : (
					<ul className='divide-y overflow-hidden rounded-xl border bg-card'>
						{categories.map((category, index) => (
							<li className='flex items-start gap-4 p-4' key={category.id}>
								<div className='flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40'>
									<BoardIcon icon={category.icon} name={category.name} size='20px' />
								</div>
								<div className='min-w-0 flex-1'>
									<div className='flex flex-wrap items-center gap-2'>
										<span className='truncate font-semibold'>{category.name}</span>
										{category.format === 'qa' ? (
											<Badge variant='secondary'>{m.settings_discussions_badge_qa()}</Badge>
										) : null}
										{category.postingPolicy === 'team' ? (
											<Badge variant='outline'>{m.settings_discussions_badge_team()}</Badge>
										) : null}
									</div>
									<div className='mt-1 text-sm text-muted-foreground'>
										{category.description ?? (
											<span className='italic opacity-60'>
												{m.settings_discussions_category_no_description()}
											</span>
										)}
									</div>
								</div>
								{canManage ? (
									<div className='flex shrink-0 items-center gap-0.5'>
										<Button
											aria-label={m.settings_discussions_category_move_up({ name: category.name })}
											disabled={index === 0}
											onClick={() => void move(index, -1)}
											size='icon-sm'
											variant='ghost'
										>
											<ArrowUp className='size-4' />
										</Button>
										<Button
											aria-label={m.settings_discussions_category_move_down({
												name: category.name,
											})}
											disabled={index === categories.length - 1}
											onClick={() => void move(index, 1)}
											size='icon-sm'
											variant='ghost'
										>
											<ArrowDown className='size-4' />
										</Button>
										<Button
											aria-label={m.settings_discussions_category_edit_name({
												name: category.name,
											})}
											onClick={() => setEditor({ category, open: true })}
											size='icon-sm'
											variant='ghost'
										>
											<Pen size='14px' />
										</Button>
										<Button
											aria-label={m.settings_discussions_category_delete_name({
												name: category.name,
											})}
											disabled={categories.length <= 1}
											onClick={() => setDeleter({ category, open: true })}
											size='icon-sm'
											title={
												categories.length <= 1 ? m.settings_discussions_delete_last() : undefined
											}
											variant='ghost'
										>
											<Trash2 className='size-4' />
										</Button>
									</div>
								) : null}
							</li>
						))}
					</ul>
				)}
			</div>

			<CategoryDialog
				category={editor.category}
				onOpenChange={(open) => setEditor((current) => ({ ...current, open }))}
				open={editor.open}
				projectId={project.id}
			/>
			<DeleteCategoryDialog
				categories={categories}
				category={deleter.category}
				onOpenChange={(open) => setDeleter((current) => ({ ...current, open }))}
				open={deleter.open}
			/>
		</section>
	);
}
