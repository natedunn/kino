import type { FunctionReturnType } from 'convex/server';
import type { Id } from '../../../../../../../convex/native/_generated/dataModel';

import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useMutation } from 'convex/react';
import { FolderPlus, Pen } from 'lucide-react';

import { resolveBoardIconName } from '@/components/board-icon';
import { IconSelector } from '@/components/icon-selector';
import { InlineAlert } from '@/components/inline-alert';
import { Label, LabelDescription, LabelWrapper } from '@/components/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	ResponsiveDialog,
	ResponsiveDialogBody,
	ResponsiveDialogContent,
	ResponsiveDialogFooter,
	ResponsiveDialogHeader,
} from '@/components/ui/responsive-dialog';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { iconRegistryOptions } from '@/icons';
import { localizeError } from '@/lib/errors';
import {
	filterSlugInput,
	FORM_LIMITS,
	normalizeSlugInput,
	SLUG_INPUT_PATTERN,
	SLUG_PATTERN,
} from '@/lib/validation';
import * as m from '@/paraglide/messages.js';

import { api } from '../../../../../../../convex/native/_generated/api';

export type DiscussionCategory = NonNullable<
	FunctionReturnType<typeof api.discussionCategories.list>
>[number];

type CategoryFormat = DiscussionCategory['format'];
type CategoryPostingPolicy = DiscussionCategory['postingPolicy'];

// Matches the server's category slug rule (1-64 chars).
const CATEGORY_SLUG_MAX = 64;

const FORMAT_LABELS: Record<CategoryFormat, () => string> = {
	open: m.settings_discussions_format_open,
	qa: m.settings_discussions_format_qa,
};

const FORMAT_HELP: Record<CategoryFormat, () => string> = {
	open: m.settings_discussions_format_open_help,
	qa: m.settings_discussions_format_qa_help,
};

const POSTING_LABELS: Record<CategoryPostingPolicy, () => string> = {
	everyone: m.settings_discussions_posting_everyone,
	team: m.settings_discussions_posting_team,
};

const POSTING_HELP: Record<CategoryPostingPolicy, () => string> = {
	everyone: m.settings_discussions_posting_everyone_help,
	team: m.settings_discussions_posting_team_help,
};

type CategoryDialogProps = {
	// `null` creates a new category; otherwise edits the given one.
	category: DiscussionCategory | null;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	projectId: Id<'projects'>;
};

export function CategoryDialog({ category, onOpenChange, open, projectId }: CategoryDialogProps) {
	return (
		<ResponsiveDialog onOpenChange={onOpenChange} open={open}>
			<ResponsiveDialogContent
				className='flex flex-col gap-0 overflow-hidden p-0'
				dialogClassName='max-h-[88vh] sm:max-w-lg'
				showCloseButton={false}
			>
				<ResponsiveDialogHeader
					icon={category ? <Pen /> : <FolderPlus />}
					subtitle={
						category
							? m.settings_discussions_category_edit_subtitle()
							: m.settings_discussions_category_new_subtitle()
					}
					title={
						category
							? m.settings_discussions_category_edit()
							: m.settings_discussions_category_new()
					}
				/>
				{/* Keyed so reopening for another category starts from fresh values. */}
				<CategoryForm
					category={category}
					key={category?.id ?? 'new'}
					onDone={() => onOpenChange(false)}
					projectId={projectId}
				/>
			</ResponsiveDialogContent>
		</ResponsiveDialog>
	);
}

function CategoryForm({
	category,
	onDone,
	projectId,
}: {
	category: DiscussionCategory | null;
	onDone: () => void;
	projectId: Id<'projects'>;
}) {
	const createCategory = useMutation(api.discussionCategories.create);
	const updateCategory = useMutation(api.discussionCategories.update);
	const [formError, setFormError] = useState<string | null>(null);
	// New categories derive their slug from the name until the slug is edited.
	const [slugEdited, setSlugEdited] = useState(category !== null);

	const form = useForm({
		defaultValues: {
			description: category?.description ?? '',
			format: category?.format ?? 'open',
			icon: category ? resolveBoardIconName({ icon: category.icon }) : 'chat',
			name: category?.name ?? '',
			postingPolicy: category?.postingPolicy ?? 'everyone',
			slug: category?.slug ?? '',
		},
		onSubmit: async ({ value }) => {
			setFormError(null);
			const name = value.name.trim();
			const slug = value.slug.trim();
			if (!name) {
				setFormError(m.settings_discussions_name_required());
				return;
			}
			if (!SLUG_PATTERN.test(slug)) {
				setFormError(m.settings_discussions_slug_invalid());
				return;
			}

			const fields = {
				description: value.description.trim() || undefined,
				format: value.format,
				icon: value.icon,
				name,
				postingPolicy: value.postingPolicy,
				slug,
			};
			try {
				if (category) await updateCategory({ categoryId: category.id, ...fields });
				else await createCategory({ projectId, ...fields });
				onDone();
			} catch (error) {
				setFormError(localizeError(error, m.settings_discussions_category_save_failed()));
			}
		},
	});

	return (
		<form
			className='flex min-h-0 flex-1 flex-col'
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				void form.handleSubmit();
			}}
		>
			<ResponsiveDialogBody className='space-y-5'>
				<form.Field name='name'>
					{(field) => (
						<div className='grid gap-2'>
							<Label htmlFor='category-name'>{m.settings_discussions_field_name()}</Label>
							<Input
								autoFocus
								id='category-name'
								maxLength={FORM_LIMITS.discussionCategoryName}
								onChange={(event) => {
									field.handleChange(event.target.value);
									if (!slugEdited)
										form.setFieldValue(
											'slug',
											normalizeSlugInput(event.target.value, CATEGORY_SLUG_MAX)
										);
								}}
								value={field.state.value}
							/>
						</div>
					)}
				</form.Field>
				<form.Field name='slug'>
					{(field) => (
						<div className='grid gap-2'>
							<LabelWrapper className='mb-0'>
								<Label htmlFor='category-slug'>{m.settings_discussions_field_slug()}</Label>
								<LabelDescription>{m.settings_discussions_field_slug_help()}</LabelDescription>
							</LabelWrapper>
							<Input
								autoCapitalize='none'
								id='category-slug'
								maxLength={CATEGORY_SLUG_MAX}
								onChange={(event) => {
									setSlugEdited(true);
									field.handleChange(filterSlugInput(event.target.value, CATEGORY_SLUG_MAX));
								}}
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
							<LabelWrapper className='mb-0'>
								<Label htmlFor='category-description'>
									{m.settings_discussions_field_description()}
								</Label>
								<LabelDescription>
									{m.settings_discussions_field_description_help()}
								</LabelDescription>
							</LabelWrapper>
							<Textarea
								id='category-description'
								maxLength={FORM_LIMITS.discussionCategoryDescription}
								onChange={(event) => field.handleChange(event.target.value)}
								value={field.state.value}
							/>
						</div>
					)}
				</form.Field>
				<form.Field name='icon'>
					{(field) => (
						<div className='grid gap-2'>
							<Label>{m.settings_discussions_field_icon()}</Label>
							<IconSelector
								contentClassName='w-96'
								onValueChange={(value) => field.handleChange(value)}
								options={iconRegistryOptions}
								value={field.state.value}
							/>
						</div>
					)}
				</form.Field>
				<form.Field name='format'>
					{(field) => (
						<div className='grid gap-2'>
							<Label>{m.settings_discussions_field_format()}</Label>
							<Select
								onValueChange={(value) => field.handleChange(value as CategoryFormat)}
								value={field.state.value}
							>
								<SelectTrigger className='w-full'>
									<SelectValue>{(value) => FORMAT_LABELS[value as CategoryFormat]()}</SelectValue>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='open'>{m.settings_discussions_format_open()}</SelectItem>
									<SelectItem value='qa'>{m.settings_discussions_format_qa()}</SelectItem>
								</SelectContent>
							</Select>
							<p className='text-xs text-muted-foreground'>{FORMAT_HELP[field.state.value]()}</p>
						</div>
					)}
				</form.Field>
				<form.Field name='postingPolicy'>
					{(field) => (
						<div className='grid gap-2'>
							<Label>{m.settings_discussions_field_posting()}</Label>
							<Select
								onValueChange={(value) => field.handleChange(value as CategoryPostingPolicy)}
								value={field.state.value}
							>
								<SelectTrigger className='w-full'>
									<SelectValue>
										{(value) => POSTING_LABELS[value as CategoryPostingPolicy]()}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='everyone'>
										{m.settings_discussions_posting_everyone()}
									</SelectItem>
									<SelectItem value='team'>{m.settings_discussions_posting_team()}</SelectItem>
								</SelectContent>
							</Select>
							<p className='text-xs text-muted-foreground'>{POSTING_HELP[field.state.value]()}</p>
						</div>
					)}
				</form.Field>
				{formError ? <InlineAlert variant='danger'>{formError}</InlineAlert> : null}
			</ResponsiveDialogBody>
			<ResponsiveDialogFooter>
				<form.Subscribe
					selector={(state) => ({
						isSubmitting: state.isSubmitting,
						name: state.values.name,
						slug: state.values.slug,
					})}
				>
					{({ isSubmitting, name, slug }) => (
						<>
							<Button
								disabled={isSubmitting}
								onClick={onDone}
								size='sm'
								type='button'
								variant='outline'
							>
								{m.common_cancel()}
							</Button>
							<Button
								disabled={!name.trim() || !slug.trim() || isSubmitting}
								size='sm'
								type='submit'
							>
								{category
									? isSubmitting
										? m.common_saving()
										: m.common_save()
									: isSubmitting
										? m.settings_discussions_category_creating()
										: m.settings_discussions_category_create()}
							</Button>
						</>
					)}
				</form.Subscribe>
			</ResponsiveDialogFooter>
		</form>
	);
}
