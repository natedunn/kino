import type { TargetGranularity } from '@convex/target';
import type { ThreadComment } from '../../../-components/comment-thread';
import type { Id } from '../../../../../../../convex/native/_generated/dataModel';

import { useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link, notFound, useNavigate, useParams } from '@tanstack/react-router';
import { useConvex, useMutation as useConvexMutation } from 'convex/react';
import {
	Bell,
	Calendar,
	Check,
	Info,
	Link as LinkIcon,
	MessageSquare,
	Tag,
	Users,
} from 'lucide-react';

import { EMOTE_EMOJI } from '@/components/emote/types';
import { SidebarSection } from '@/components/sidebar-section';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
	ResponsiveSideDrawer,
	ResponsiveSideDrawerBody,
	ResponsiveSideDrawerContent,
	ResponsiveSideDrawerHeader,
	ResponsiveSideDrawerTrigger,
} from '@/components/ui/responsive-side-drawer';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { StatusIcon } from '@/icons';
import { useAuthSession } from '@/lib/auth/auth-client';
import { localizeError } from '@/lib/errors';
import { formatTimestamp } from '@/lib/utils/format-timestamp';
import * as m from '@/paraglide/messages.js';

import { UpvoteButton } from '../../-components/upvote-button';
import {
	CommentEditorProvider,
	CommentForm,
	CommentCard as ThreadCommentCard,
} from '../../../-components/comment-thread';
import { api as nativeApi } from '../../../../../../../convex/native/_generated/api';
import { FeedbackEventItem } from './feedback-event-item';
import { FeedbackTargetDrawer, formatFeedbackTarget } from './feedback-target-drawer';
import { NativeGithubConnections } from './native-github-connections';

const ROUTE = '/@{$org}/$project/feedback/$slug/' as const;
const STATUS_OPTIONS = [
	{ label: m.feedback_status_open, value: 'open' },
	{ label: m.feedback_status_in_progress, value: 'in-progress' },
	{ label: m.feedback_status_paused, value: 'paused' },
	{ label: m.feedback_status_completed, value: 'completed' },
	{ label: m.feedback_status_closed, value: 'closed' },
] as const;
const PRIORITY_OPTIONS = [
	{ label: m.feedback_priority_none, value: 'none' },
	{ label: m.feedback_priority_low, value: 'low' },
	{ label: m.feedback_priority_medium, value: 'medium' },
	{ label: m.feedback_priority_high, value: 'high' },
	{ label: m.feedback_priority_urgent, value: 'urgent' },
] as const;

type Comment = {
	id: Id<'feedbackComments'>;
	creationTime: number;
	author: { id: string; name: string; username: string } | null;
	canDelete: boolean;
	canEdit: boolean;
	content: string;
	updatedTime?: number | null;
	emotes: Array<{ authorProfileIds: Array<string>; content: string; count: number }>;
	replyFeedbackCommentId: Id<'feedbackComments'> | null;
};
type Timeline =
	| { type: 'comment'; creationTime: number; data: Comment }
	| {
			type: 'event';
			creationTime: number;
			data: {
				id: Id<'feedbackEvents'>;
				actor: Comment['author'];
				eventType: string;
				metadata: { oldValue?: string; newValue?: string } | null;
			};
	  };
type Detail = {
	author: Comment['author'];
	assignedProfile: Comment['author'];
	board: { id: Id<'feedbackBoards'>; name: string } | null;
	currentProfile: { id: string } | null;
	feedback: {
		createdAt: number;
		id: Id<'feedback'>;
		answerCommentId: Id<'feedbackComments'> | null;
		assignedProfileId: Id<'profiles'> | null;
		boardId: Id<'feedbackBoards'>;
		priority: (typeof PRIORITY_OPTIONS)[number]['value'];
		status: (typeof STATUS_OPTIONS)[number]['value'];
		tags: Array<string>;
		target: string | null;
		targetGranularity: TargetGranularity | null;
		title: string;
		upvotes: number;
	};
	firstComment: Comment | null;
	following: boolean;
	hasUpvoted: boolean;
	permissions: { canManageContent: boolean };
	related: Array<{ id: Id<'feedback'>; slug: string; status: string; title: string }>;
	timeline: Array<Timeline>;
	timelineCursor: string | null;
	watchers: Array<Comment['author']>;
};

function displayName(profile: Comment['author']) {
	return profile?.name || profile?.username || m.feedback_unknown_user();
}

function timelineKey(item: Timeline) {
	return `${item.type}:${item.data.id}`;
}

export function mergeNativeFeedbackTimeline(...groups: Array<Array<Timeline>>) {
	const items = new Map<string, Timeline>();
	for (const item of groups.flat()) items.set(timelineKey(item), item);
	return [...items.values()].sort(
		(left, right) =>
			left.creationTime - right.creationTime || timelineKey(left).localeCompare(timelineKey(right))
	);
}

export function NativeFeedbackDetailRoute() {
	const params = useParams({ from: ROUTE });
	const navigate = useNavigate();
	const convex = useConvex();
	const session = useAuthSession();
	const { data: projectData } = useSuspenseQuery(
		convexQuery(nativeApi.projects.getBySlugs, {
			organizationSlug: params.org,
			projectSlug: params.project,
		})
	);
	if (!projectData?.project) throw notFound();
	const { data: rawDetail } = useSuspenseQuery(
		convexQuery(nativeApi.feedback.getDetail, {
			projectId: projectData.project.id,
			slug: params.slug,
		})
	);
	const { data: boards } = useSuspenseQuery(
		convexQuery(nativeApi.feedbackBoards.list, { projectId: projectData.project.id })
	);
	const { data: assignable } = useSuspenseQuery(
		convexQuery(nativeApi.feedback.listAssignableProfiles, { projectId: projectData.project.id })
	);
	const { data: candidates } = useSuspenseQuery(
		convexQuery(nativeApi.feedback.searchForLinking, {
			projectId: projectData.project.id,
			search: '',
		})
	);
	if (!rawDetail) throw notFound();
	const detail = rawDetail as Detail;
	const feedback = detail.feedback;
	const canEdit =
		detail.permissions.canManageContent || detail.currentProfile?.id === detail.author?.id;

	const mutations = {
		addRelation: useConvexMutation(nativeApi.feedback.addRelation),
		createComment: useConvexMutation(nativeApi.feedbackComments.create),
		removeComment: useConvexMutation(nativeApi.feedbackComments.remove),
		removeFeedback: useConvexMutation(nativeApi.feedback.remove),
		removeRelation: useConvexMutation(nativeApi.feedback.removeRelation),
		setAnswer: useConvexMutation(nativeApi.feedback.setAnswerComment),
		toggleEmote: useConvexMutation(nativeApi.feedbackComments.toggleEmote),
		toggleFollow: useConvexMutation(nativeApi.feedback.toggleFollow),
		updateAssigned: useConvexMutation(nativeApi.feedback.updateAssigned),
		updateBoard: useConvexMutation(nativeApi.feedback.updateBoard),
		updateComment: useConvexMutation(nativeApi.feedbackComments.update),
		updatePriority: useConvexMutation(nativeApi.feedback.updatePriority),
		updateStatus: useConvexMutation(nativeApi.feedback.updateStatus),
		updateTags: useConvexMutation(nativeApi.feedback.updateTags),
		updateTarget: useConvexMutation(nativeApi.feedback.updateTarget),
		updateTitle: useConvexMutation(nativeApi.feedback.updateTitle),
	};
	const [replyTo, setReplyTo] = useState<Id<'feedbackComments'> | null>(null);
	const [title, setTitle] = useState(feedback.title);
	const [editTitle, setEditTitle] = useState(false);
	const [tags, setTags] = useState(feedback.tags.join(', '));
	const [targetDrawerOpen, setTargetDrawerOpen] = useState(false);
	const [relationId, setRelationId] = useState('');
	const [extraTimeline, setExtraTimeline] = useState<Array<Timeline>>([]);
	const [cursor, setCursor] = useState<string | null>(detail.timelineCursor);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [sidebarOpen, setSidebarOpen] = useState({
		details: true,
		people: true,
		labels: true,
		related: true,
	});
	const [metadataDrawerOpen, setMetadataDrawerOpen] = useState(false);
	const timeline = mergeNativeFeedbackTimeline(extraTimeline, detail.timeline);

	async function performMutation<T>(
		operation: () => Promise<T>,
		onSuccess?: (result: T) => void | Promise<void>,
		fallback = m.common_something_went_wrong()
	) {
		setError(null);
		setBusy(true);
		try {
			const result = await operation();
			await onSuccess?.(result);
			return result;
		} catch (mutationError) {
			setError(localizeError(mutationError, fallback));
			return undefined;
		} finally {
			setBusy(false);
		}
	}

	async function submitComment(content: string) {
		setError(null);
		setBusy(true);
		try {
			await mutations.createComment({
				feedbackId: feedback.id,
				content,
				...(replyTo ? { replyFeedbackCommentId: replyTo } : {}),
			});
			setReplyTo(null);
		} catch (mutationError) {
			setError(localizeError(mutationError, m.feedback_comment_post_failed()));
			throw mutationError;
		} finally {
			setBusy(false);
		}
	}

	async function loadMore() {
		if (!cursor) return;
		setError(null);
		setBusy(true);
		try {
			const page = await convex.query(nativeApi.feedback.listTimelinePage, {
				feedbackId: feedback.id,
				paginationOpts: { cursor, numItems: 20 },
			});
			if (page) {
				setExtraTimeline((current) =>
					mergeNativeFeedbackTimeline(page.page as Array<Timeline>, current)
				);
				setCursor(page.isDone ? null : page.continueCursor);
			}
		} catch (loadError) {
			setError(localizeError(loadError, m.feedback_load_more_failed()));
		} finally {
			setBusy(false);
		}
	}

	function NativeCommentCard({ item, initial = false }: { item: Comment; initial?: boolean }) {
		const emoteCounts = Object.fromEntries(
			item.emotes.flatMap((emote) => {
				const entry = Object.entries(EMOTE_EMOJI).find(([, emoji]) => emoji === emote.content);
				return entry
					? [[entry[0], { authorProfileIds: emote.authorProfileIds, count: emote.count }]]
					: [];
			})
		) as ThreadComment['emoteCounts'];
		return (
			<ThreadCommentCard
				badges={
					<>
						{item.author?.id === detail.author?.id ? (
							<span className='inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium'>
								<Check className='size-3' />
								{m.feedback_author()}
							</span>
						) : null}
						{feedback.answerCommentId === item.id ? (
							<span className='inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400'>
								<Check className='size-3' />
								{m.feedback_answer()}
							</span>
						) : null}
					</>
				}
				className={
					feedback.answerCommentId === item.id
						? 'border-green-500 dark:border-green-600'
						: undefined
				}
				comment={{
					id: item.id,
					author: item.author,
					content: item.content,
					createdAt: item.creationTime,
					updatedTime: item.updatedTime ?? null,
					canDelete: item.canDelete,
					canEdit: item.canEdit,
					emoteCounts,
				}}
				currentProfileId={detail.currentProfile?.id}
				dropdownItems={
					<>
						{session.user && !item.replyFeedbackCommentId && !initial ? (
							<DropdownMenuItem onClick={() => setReplyTo(item.id)}>
								{m.feedback_reply()}
							</DropdownMenuItem>
						) : null}
						{canEdit && !item.replyFeedbackCommentId && !initial ? (
							<DropdownMenuItem
								onClick={() =>
									void performMutation(() =>
										mutations.setAnswer({
											feedbackId: feedback.id,
											...(feedback.answerCommentId === item.id ? {} : { commentId: item.id }),
										})
									)
								}
							>
								<Check className='size-3.5' />
								{feedback.answerCommentId === item.id
									? m.feedback_unmark_answer()
									: m.feedback_mark_answer()}
							</DropdownMenuItem>
						) : null}
					</>
				}
				isDeleting={busy}
				isUpdating={busy}
				onDelete={(commentId) =>
					void performMutation(() =>
						mutations.removeComment({ commentId: commentId as Id<'feedbackComments'> })
					)
				}
				onToggleEmote={(commentId, content) =>
					void performMutation(() =>
						mutations.toggleEmote({
							feedbackId: feedback.id,
							feedbackCommentId: commentId as Id<'feedbackComments'>,
							content: EMOTE_EMOJI[content],
						})
					)
				}
				onUpdate={async (commentId, content) => {
					await mutations.updateComment({
						commentId: commentId as Id<'feedbackComments'>,
						content,
					});
				}}
				verb={initial ? m.feedback_opened_this_feedback() : m.feedback_commented()}
			/>
		);
	}

	const relationOptions = candidates.filter(
		(item: { id: Id<'feedback'>; slug: string; status: string; title: string }) =>
			item.id !== feedback.id && !detail.related.some((related) => related.id === item.id)
	);
	const sectionChange = (section: keyof typeof sidebarOpen) => (open: boolean) =>
		setSidebarOpen((current) => ({ ...current, [section]: open }));
	const actionButtons = (
		<>
			<UpvoteButton
				className='lg:flex-1'
				feedbackId={feedback.id}
				initialCount={feedback.upvotes}
				initialHasUpvoted={detail.hasUpvoted}
				inline
				isAuthenticated={!!session.user}
			/>
			<Button
				className='lg:flex-1'
				disabled={!session.user || busy}
				onClick={() =>
					void performMutation(() => mutations.toggleFollow({ feedbackId: feedback.id }))
				}
				size='lg'
				variant='outline'
			>
				<Bell className='size-4' />
				{detail.following ? m.feedback_unfollow() : m.feedback_follow()}
			</Button>
		</>
	);
	const sidebarSections = (
		<>
			<SidebarSection
				icon={<Info className='size-3.5' />}
				title={m.feedback_details()}
				open={sidebarOpen.details}
				onOpenChange={sectionChange('details')}
			>
				<div className='flex flex-col'>
					<Choice
						inline
						label={m.feedback_board()}
						disabled={!canEdit || busy}
						value={feedback.boardId}
						options={(boards ?? []).map((item: { id: Id<'feedbackBoards'>; name: string }) => ({
							label: item.name,
							value: item.id,
						}))}
						onChange={(value) =>
							void performMutation(() =>
								mutations.updateBoard({
									feedbackId: feedback.id,
									boardId: value as Id<'feedbackBoards'>,
								})
							)
						}
					/>
					<Choice
						inline
						label={m.feedback_status()}
						disabled={!canEdit || busy}
						value={feedback.status}
						options={STATUS_OPTIONS.map((item) => ({ label: item.label(), value: item.value }))}
						onChange={(value) =>
							void performMutation(() =>
								mutations.updateStatus({
									feedbackId: feedback.id,
									status: value as typeof feedback.status,
								})
							)
						}
					/>
					<Choice
						inline
						label={m.feedback_priority()}
						disabled={!detail.permissions.canManageContent || busy}
						value={feedback.priority}
						options={PRIORITY_OPTIONS.map((item) => ({ label: item.label(), value: item.value }))}
						onChange={(value) =>
							void performMutation(() =>
								mutations.updatePriority({
									feedbackId: feedback.id,
									priority: value as typeof feedback.priority,
								})
							)
						}
					/>
					<div className='flex items-center justify-between py-1.5'>
						<span className='text-sm text-muted-foreground'>{m.feedback_target()}</span>
						{detail.permissions.canManageContent ? (
							<Button
								className='max-w-52 justify-end'
								disabled={busy}
								onClick={() => setTargetDrawerOpen(true)}
								size='default'
								type='button'
								variant='secondary'
							>
								<Calendar className='size-3.5' />
								<span className='truncate'>
									{formatFeedbackTarget(feedback.target, feedback.targetGranularity)}
								</span>
							</Button>
						) : (
							<span className='max-w-52 truncate text-sm text-muted-foreground'>
								{formatFeedbackTarget(feedback.target, feedback.targetGranularity)}
							</span>
						)}
					</div>
				</div>
			</SidebarSection>
			<NativeGithubConnections
				feedbackId={feedback.id}
				orgSlug={params.org}
				projectSlug={params.project}
				canManage={detail.permissions.canManageContent && !projectData.isArchived}
			/>
			<SidebarSection
				icon={<Users className='size-3.5' />}
				title={m.feedback_people()}
				open={sidebarOpen.people}
				onOpenChange={sectionChange('people')}
			>
				<div className='flex flex-col gap-2'>
					<Choice
						inline
						label={m.feedback_assignee()}
						disabled={!detail.permissions.canManageContent || busy}
						value={feedback.assignedProfileId ?? ''}
						options={[
							{ label: m.feedback_unassigned(), value: '' },
							...assignable
								.filter(Boolean)
								.map((item: { id: Id<'profiles'>; name: string; username: string } | null) => ({
									label: item!.name || item!.username,
									value: item!.id,
								})),
						]}
						onChange={(value) =>
							void performMutation(() =>
								mutations.updateAssigned({
									feedbackId: feedback.id,
									...(value ? { assignedProfileId: value as Id<'profiles'> } : {}),
								})
							)
						}
					/>
					<div className='flex items-center justify-between gap-2 py-1.5 text-sm'>
						<span className='text-muted-foreground'>{m.feedback_author()}</span>
						<span>{displayName(detail.author)}</span>
					</div>
					<div className='flex items-start justify-between gap-2 py-1.5 text-sm'>
						<span className='text-muted-foreground'>{m.feedback_watchers()}</span>
						<span className='text-right'>
							{detail.watchers.filter(Boolean).map(displayName).join(', ') || '—'}
						</span>
					</div>
				</div>
			</SidebarSection>
			<SidebarSection
				icon={<Tag className='size-3.5' />}
				title={m.feedback_labels()}
				open={sidebarOpen.labels}
				onOpenChange={sectionChange('labels')}
			>
				<div className='space-y-2'>
					{feedback.tags.length ? (
						<div className='flex flex-wrap gap-1'>
							{feedback.tags.map((tag) => (
								<span className='rounded-md border px-2 py-0.5 text-xs' key={tag}>
									{tag}
								</span>
							))}
						</div>
					) : null}
					{detail.permissions.canManageContent ? (
						<div className='flex gap-2'>
							<Input
								value={tags}
								disabled={busy}
								placeholder={m.feedback_labels_placeholder()}
								onChange={(event) => setTags(event.target.value)}
							/>
							<Button
								disabled={busy}
								onClick={() =>
									void performMutation(() =>
										mutations.updateTags({ feedbackId: feedback.id, tags: tags.split(',') })
									)
								}
							>
								{m.common_save()}
							</Button>
						</div>
					) : null}
				</div>
			</SidebarSection>
			<SidebarSection
				icon={<LinkIcon className='size-3.5' />}
				title={m.feedback_related()}
				open={sidebarOpen.related}
				onOpenChange={sectionChange('related')}
			>
				<div className='space-y-2'>
					{detail.related.map((item) => (
						<div className='flex items-center gap-2' key={item.id}>
							<Link
								className='min-w-0 flex-1 truncate text-sm underline'
								to='/@{$org}/$project/feedback/$slug'
								params={{ org: params.org, project: params.project, slug: item.slug }}
								preload='intent'
							>
								{item.title}
							</Link>
							{detail.permissions.canManageContent ? (
								<Button
									disabled={busy}
									size='sm'
									variant='ghost'
									onClick={() =>
										void performMutation(() =>
											mutations.removeRelation({
												feedbackId: feedback.id,
												relatedFeedbackId: item.id,
											})
										)
									}
								>
									{m.common_remove()}
								</Button>
							) : null}
						</div>
					))}
					{detail.permissions.canManageContent && relationOptions.length ? (
						<div className='flex gap-2'>
							<Choice
								value={relationId}
								options={relationOptions.map((item: { id: Id<'feedback'>; title: string }) => ({
									label: item.title,
									value: item.id,
								}))}
								placeholder={m.feedback_related_select()}
								onChange={setRelationId}
							/>
							<Button
								disabled={!relationId || busy}
								onClick={() =>
									void performMutation(
										() =>
											mutations.addRelation({
												feedbackId: feedback.id,
												relatedFeedbackId: relationId as Id<'feedback'>,
											}),
										() => setRelationId('')
									)
								}
							>
								{m.common_add()}
							</Button>
						</div>
					) : null}
				</div>
			</SidebarSection>
		</>
	);
	const deleteButton = detail.permissions.canManageContent ? (
		<Button
			disabled={busy}
			variant='outline'
			className='text-destructive'
			onClick={() => {
				if (window.confirm(m.feedback_delete_description()))
					void performMutation(
						() => mutations.removeFeedback({ feedbackId: feedback.id }),
						() =>
							navigate({
								to: '/@{$org}/$project/feedback',
								params: { org: params.org, project: params.project },
							}),
						m.feedback_delete_failed()
					);
			}}
		>
			{m.common_delete()}
		</Button>
	) : null;
	return (
		<div className='flex flex-1 flex-col'>
			<FeedbackTargetDrawer
				currentGranularity={feedback.targetGranularity}
				currentTarget={feedback.target}
				isSaving={busy}
				onOpenChange={setTargetDrawerOpen}
				onSave={async (value) => {
					setError(null);
					setBusy(true);
					try {
						await mutations.updateTarget({ feedbackId: feedback.id, ...(value ?? {}) });
					} catch (mutationError) {
						setError(localizeError(mutationError, m.feedback_target_save_failed()));
						throw mutationError;
					} finally {
						setBusy(false);
					}
				}}
				open={targetDrawerOpen}
			/>
			<div className='border-b'>
				<div className='container flex items-start gap-4 pt-10 pb-6 [--max-width:52rem] lg:[--max-width:75rem]'>
					<div className='mt-1'>
						<StatusIcon colored size='28' status={feedback.status} />
					</div>
					<div className='flex flex-1 flex-col gap-2'>
						{editTitle ? (
							<div className='flex gap-2'>
								<Input value={title} onChange={(event) => setTitle(event.target.value)} />
								<Button
									disabled={busy}
									onClick={() =>
										void performMutation(
											() => mutations.updateTitle({ feedbackId: feedback.id, title }),
											() => setEditTitle(false),
											m.feedback_title_save_failed()
										)
									}
								>
									{m.common_save()}
								</Button>
							</div>
						) : canEdit ? (
							<button
								type='button'
								className='group -mx-3 -my-1.5 rounded-lg px-3 py-1.5 text-left hover:bg-accent'
								onClick={() => setEditTitle(true)}
							>
								<h1 className='text-xl md:text-3xl'>{feedback.title}</h1>
							</button>
						) : (
							<h1 className='text-xl md:text-3xl'>{feedback.title}</h1>
						)}
						<div className='text-sm text-muted-foreground' suppressHydrationWarning>
							{feedback.status === 'open' ? m.feedback_opened() : m.feedback_updated()}{' '}
							{formatTimestamp(feedback.createdAt)} · {feedback.upvotes}{' '}
							{m.feedback_upvote_count({ count: feedback.upvotes })}
							{canEdit ? (
								<span className='md:hidden'>
									{' · '}
									<button
										className='font-medium text-foreground underline underline-offset-2'
										onClick={() => setEditTitle(true)}
										type='button'
									>
										{m.feedback_edit_title()}
									</button>
								</span>
							) : null}
						</div>
					</div>
				</div>
			</div>
			<div className='container flex flex-1 flex-col [--max-width:52rem] lg:[--max-width:75rem]'>
				<div className='flex flex-1 flex-col gap-6 lg:grid lg:grid-cols-12 lg:gap-8'>
					<aside className='hidden lg:order-last lg:col-span-4 lg:block lg:border-l lg:border-border/75 lg:py-8'>
						<div className='flex flex-col gap-6 lg:sticky lg:top-4 lg:pl-8'>
							<div className='flex gap-2'>{actionButtons}</div>
							{sidebarSections}
							{deleteButton ? <div className='border-t pt-4'>{deleteButton}</div> : null}
						</div>
					</aside>
					<main className='min-w-0 lg:col-span-8'>
						<div className='flex items-center gap-2 py-4 lg:hidden'>
							{actionButtons}
							<ResponsiveSideDrawer open={metadataDrawerOpen} onOpenChange={setMetadataDrawerOpen}>
								<ResponsiveSideDrawerTrigger
									render={<Button className='ml-auto' size='lg' variant='outline' />}
								>
									<Info className='size-4' />
									{m.feedback_details()}
								</ResponsiveSideDrawerTrigger>
								<ResponsiveSideDrawerContent>
									<ResponsiveSideDrawerHeader icon={<Info />} title={m.feedback_details()} />
									<ResponsiveSideDrawerBody className='flex flex-col gap-6'>
										{sidebarSections}
										{deleteButton}
									</ResponsiveSideDrawerBody>
								</ResponsiveSideDrawerContent>
							</ResponsiveSideDrawer>
						</div>
						{error ? (
							<p
								aria-live='polite'
								className='rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive'
								role='alert'
							>
								{error}
							</p>
						) : null}
						<div className='flex flex-col gap-4 py-8'>
							<div className='flex w-full items-center border-b pb-2'>
								<h2 className='flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase'>
									<MessageSquare className='size-3.5' />
									{m.feedback_discussion()}
								</h2>
							</div>
							<CommentEditorProvider>
								<ul
									className={`relative flex flex-col gap-6 ${timeline.length ? 'before:absolute before:top-0 before:bottom-0 before:left-[33px] before:z-0 before:border-r before:border-border' : ''}`}
								>
									{detail.firstComment ? (
										<NativeCommentCard item={detail.firstComment} initial />
									) : null}
									{cursor ? (
										<li className='relative z-10'>
											<Button variant='outline' disabled={busy} onClick={() => void loadMore()}>
												{busy ? m.feedback_loading_comments() : m.feedback_show_more_comments()}
											</Button>
										</li>
									) : null}
									{timeline.map((item, index) =>
										item.type === 'comment' ? (
											<NativeCommentCard key={item.data.id} item={item.data} />
										) : (
											<FeedbackEventItem
												key={item.data.id}
												event={{
													id: item.data.id,
													actor: item.data.actor,
													createdAt: item.creationTime,
													eventType: item.data.eventType,
													metadata: item.data.metadata,
												}}
												isLast={index === timeline.length - 1}
											/>
										)
									)}
								</ul>
								{replyTo ? (
									<div className='flex items-center gap-2 text-sm'>
										{m.feedback_reply()}
										<Button size='sm' variant='ghost' onClick={() => setReplyTo(null)}>
											{m.common_cancel()}
										</Button>
									</div>
								) : null}
								<CommentForm
									isAuthenticated={!!session.user}
									isSubmitting={busy}
									onSubmit={submitComment}
									placeholder={m.feedback_leave_comment()}
									redirectTo={`/@${params.org}/${params.project}/feedback/${params.slug}`}
									signedOut='rich'
									submitLabel={m.feedback_post_comment()}
								/>
							</CommentEditorProvider>
						</div>
					</main>
				</div>
			</div>
		</div>
	);
}

function Choice({
	inline,
	label,
	value,
	options,
	onChange,
	disabled,
	placeholder,
}: {
	inline?: boolean;
	label?: string;
	value: string;
	options: Array<{ label: string; value: string }>;
	onChange: (value: string) => void;
	disabled?: boolean;
	placeholder?: string;
}) {
	return (
		<div className={inline ? 'flex min-w-0 items-center justify-between gap-2 py-1.5' : 'min-w-0'}>
			{label ? (
				<label
					className={
						inline ? 'text-sm text-muted-foreground' : 'mb-2 block text-sm text-muted-foreground'
					}
				>
					{label}
				</label>
			) : null}
			<Select
				disabled={disabled}
				items={options}
				value={value}
				onValueChange={(next) => next !== null && onChange(next)}
			>
				<SelectTrigger className={inline ? 'min-w-32' : undefined}>
					<SelectValue placeholder={placeholder} />
				</SelectTrigger>
				<SelectContent>
					{options.map((item) => (
						<SelectItem key={item.value} value={item.value}>
							{item.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
