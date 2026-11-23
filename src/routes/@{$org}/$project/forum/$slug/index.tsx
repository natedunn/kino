import type { EmoteContent } from '@/components/emote';
import type { TopicDetail } from '../-components/detail-sidebar';
import type { ThreadComment } from '../../-components/comment-thread';
import type { Id } from '../../../../../../convex/native/_generated/dataModel';

import { useEffect, useRef, useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router';
import { useMutation, usePaginatedQuery } from 'convex/react';
import {
	ArrowDown,
	ArrowLeft,
	Check,
	CircleCheck,
	Info,
	Lock,
	MessageSquare,
	Pencil,
	Pin,
} from 'lucide-react';

import { BoardIcon } from '@/components/board-icon';
import { InlineAlert } from '@/components/inline-alert';
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
import { useAuthSession } from '@/lib/auth/auth-client';
import { localizeError } from '@/lib/errors';
import { projectTitle, titleFromSlug, titleMeta } from '@/lib/seo';
import { formatRelativeDay } from '@/lib/utils/format-timestamp';
import { FORM_LIMITS } from '@/lib/validation';
import * as m from '@/paraglide/messages.js';

import { DetailAnswer } from '../-components/detail-answer';
import { DetailEventItem } from '../-components/detail-event-item';
import { DetailFollowButton, DetailSidebarSections } from '../-components/detail-sidebar';
import { firstUnreadReply, UnreadDivider, useTopicVisit } from '../-components/detail-unread';
import { CommentCard, CommentEditorProvider, CommentForm } from '../../-components/comment-thread';
import { api as nativeApi } from '../../../../../../convex/native/_generated/api';

const REPLIES_PAGE_SIZE = 30;

export const Route = createFileRoute('/@{$org}/$project/forum/$slug/')({
	loader: async ({ context, params }) => {
		const projectData = await context.queryClient.ensureQueryData(
			convexQuery(nativeApi.projects.getBySlugs, {
				organizationSlug: params.org,
				projectSlug: params.project,
			})
		);
		if (!projectData?.project) throw notFound();
		const projectId = projectData.project.id;
		// `detail` is null when the topic is missing or the forum is off.
		const [detail] = await Promise.all([
			context.queryClient.ensureQueryData(
				convexQuery(nativeApi.forum.detail, { projectId, slug: params.slug })
			),
			context.queryClient.ensureQueryData(convexQuery(nativeApi.forum.viewerAccess, { projectId })),
		]);
		if (!detail) throw notFound();
		return { title: detail.topic.title };
	},
	head: ({ loaderData, params }) => ({
		meta: [
			titleMeta([
				loaderData?.title ?? titleFromSlug(params.slug),
				projectTitle(params.org, params.project),
			]),
		],
	}),
	component: TopicDetailRoute,
});

type TopicComment = NonNullable<TopicDetail['firstComment']>;

function toThreadComment(comment: TopicComment): ThreadComment {
	return {
		id: comment.id,
		author: comment.author,
		content: comment.content,
		createdAt: comment.creationTime,
		updatedTime: comment.updatedTime,
		canEdit: comment.canEdit,
		canDelete: comment.canDelete,
		emoteCounts: Object.fromEntries(
			comment.emotes.map((emote) => [
				emote.content,
				{ authorProfileIds: emote.authorProfileIds, count: emote.count },
			])
		),
	};
}

// For replies that are already rendered: their CommentCard only reads the hash on mount.
function scrollToComment(commentId: string) {
	window.history.replaceState(window.history.state, '', `#comment-${commentId}`);
	document
		.getElementById(`comment-${commentId}`)
		?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function TopicDetailRoute() {
	const params = Route.useParams();
	const router = useRouter();
	const session = useAuthSession();
	const { data: projectData } = useSuspenseQuery(
		convexQuery(nativeApi.projects.getBySlugs, {
			organizationSlug: params.org,
			projectSlug: params.project,
		})
	);
	if (!projectData?.project) throw notFound();
	const projectId = projectData.project.id;
	const { data: detail } = useSuspenseQuery(
		convexQuery(nativeApi.forum.detail, { projectId, slug: params.slug })
	);
	const { data: access } = useSuspenseQuery(
		convexQuery(nativeApi.forum.viewerAccess, { projectId })
	);
	if (!detail) throw notFound();
	const topic = detail.topic;
	const answerId = topic.answerCommentId;

	const replies = usePaginatedQuery(
		nativeApi.forum.replies,
		{ topicId: topic.id },
		{ initialNumItems: REPLIES_PAGE_SIZE }
	);
	const mutations = {
		addComment: useMutation(nativeApi.forum.addComment),
		updateComment: useMutation(nativeApi.forum.updateComment),
		removeComment: useMutation(nativeApi.forum.removeComment),
		toggleReaction: useMutation(nativeApi.forum.toggleReaction),
		updateTitle: useMutation(nativeApi.forum.updateTitle),
		setAnswer: useMutation(nativeApi.forum.setAnswer),
	};
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [editingTitle, setEditingTitle] = useState(false);
	const [titleDraft, setTitleDraft] = useState(topic.title);
	const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
	// Set when "Jump to reply" targets an answer that isn't loaded yet.
	const [pendingJump, setPendingJump] = useState(false);
	// Events sit between replies by time. Only show the ones up to the newest
	// loaded reply, so older pages never slot in under later events.
	const lastReplyTime = replies.results.at(-1)?.creationTime;
	const visibleEvents = detail.events.filter(
		(event) =>
			replies.status === 'Exhausted' ||
			(lastReplyTime !== undefined && event.createdAt <= lastReplyTime)
	);
	const visit = useTopicVisit(topic.id, !!detail.viewerProfileId);
	const firstUnread = firstUnreadReply(replies.results, visit, detail.viewerProfileId);
	const timeline = [
		// Listed first so the stable sort keeps it just above its reply.
		...(firstUnread ? [{ kind: 'divider' as const, at: firstUnread.creationTime }] : []),
		...replies.results.map((reply) => ({ kind: 'reply' as const, at: reply.creationTime, reply })),
		...visibleEvents.map((event) => ({ kind: 'event' as const, at: event.createdAt, event })),
	].sort((a, b) => a.at - b.at);
	const answerLoaded = !!answerId && replies.results.some((reply) => reply.id === answerId);
	// Set while paging replies to find the first unread one.
	const [pendingUnreadJump, setPendingUnreadJump] = useState(false);
	const showUnreadJump =
		!!visit?.unread && topic.commentCount > 0 && (!!firstUnread || replies.status !== 'Exhausted');

	// Page through replies until the answer is rendered. Its CommentCard reads
	// the `#comment-<id>` hash on mount, then scrolls to and highlights itself.
	useEffect(() => {
		if (!pendingJump) return;
		if (answerLoaded || replies.status === 'Exhausted') setPendingJump(false);
		else if (replies.status === 'CanLoadMore') replies.loadMore(REPLIES_PAGE_SIZE);
	}, [answerLoaded, pendingJump, replies]);

	useEffect(() => {
		if (!pendingUnreadJump) return;
		if (firstUnread) {
			setPendingUnreadJump(false);
			scrollToComment(firstUnread.id);
		} else if (replies.status === 'Exhausted') setPendingUnreadJump(false);
		else if (replies.status === 'CanLoadMore') replies.loadMore(REPLIES_PAGE_SIZE);
	}, [firstUnread, pendingUnreadJump, replies]);

	// Unread topics in the list link here with `#unread`; land on the first one.
	const autoJumped = useRef<Id<'forumTopics'> | null>(null);
	useEffect(() => {
		if (!visit || autoJumped.current === topic.id) return;
		autoJumped.current = topic.id;
		if (visit.unread && window.location.hash === '#unread') setPendingUnreadJump(true);
	}, [topic.id, visit]);

	function jumpToAnswer() {
		if (!answerId) return;
		const hash = `comment-${answerId}`;
		window.history.replaceState(window.history.state, '', `#${hash}`);
		const element = document.getElementById(hash);
		if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
		else setPendingJump(true);
	}

	async function run<T>(operation: () => Promise<T>, fallback = m.common_something_went_wrong()) {
		setError(null);
		setBusy(true);
		try {
			return await operation();
		} catch (mutationError) {
			setError(localizeError(mutationError, fallback));
			throw mutationError;
		} finally {
			setBusy(false);
		}
	}

	async function saveTitle() {
		await run(
			() => mutations.updateTitle({ topicId: topic.id, title: titleDraft }),
			m.forum_title_save_failed()
		)
			.then(() => {
				setEditingTitle(false);
				// The document title comes from loader data; re-run it for the new title.
				void router.invalidate();
			})
			.catch(() => undefined);
	}

	const commentHandlers = {
		currentProfileId: detail.viewerProfileId ?? undefined,
		isDeleting: busy,
		isUpdating: busy,
		onDelete: (commentId: string) =>
			void run(() =>
				mutations.removeComment({ commentId: commentId as Id<'forumComments'> })
			).catch(() => undefined),
		onToggleEmote: detail.writable
			? (commentId: string, content: EmoteContent) =>
					void run(() =>
						mutations.toggleReaction({
							commentId: commentId as Id<'forumComments'>,
							content,
						})
					).catch(() => undefined)
			: undefined,
		onUpdate: (commentId: string, content: string) =>
			mutations.updateComment({ commentId: commentId as Id<'forumComments'>, content }),
	};
	const authorBadge = (
		<span className='inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium'>
			<Check className='size-3' />
			{m.forum_author_badge()}
		</span>
	);
	const answerBadge = (
		<span className='inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400'>
			<CircleCheck className='size-3' />
			{m.forum_detail_answer()}
		</span>
	);
	const chipClassName =
		'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium';
	const sidebarSections = (
		<DetailSidebarSections
			categories={access?.categories ?? []}
			detail={detail}
			projectId={projectId}
		/>
	);

	return (
		<div className='flex flex-1 flex-col'>
			<div className='border-b'>
				<div className='container flex flex-col gap-3 pt-8 pb-6 [--max-width:52rem] lg:[--max-width:75rem]'>
					<Link
						className='link-text inline-flex w-fit items-center gap-1.5 text-sm'
						params={{ org: params.org, project: params.project }}
						search={detail.category ? { category: detail.category.slug } : {}}
						to='/@{$org}/$project/forum'
					>
						<ArrowLeft className='size-3.5' />
						{m.forum_detail_back()}
					</Link>
					{detail.category || topic.pinned || topic.locked ? (
						<div className='flex flex-wrap items-center gap-2'>
							{detail.category ? (
								<span className={chipClassName}>
									<BoardIcon
										className='size-3.5'
										icon={detail.category.icon}
										name={detail.category.name}
									/>
									{detail.category.name}
								</span>
							) : null}
							{topic.pinned ? (
								<span className={chipClassName}>
									<Pin className='size-3' />
									{m.forum_detail_pinned()}
								</span>
							) : null}
							{topic.locked ? (
								<span className={`${chipClassName} text-muted-foreground`}>
									<Lock className='size-3' />
									{m.forum_detail_locked()}
								</span>
							) : null}
						</div>
					) : null}
					{editingTitle ? (
						<form
							className='flex gap-2'
							onSubmit={(event) => {
								event.preventDefault();
								void saveTitle();
							}}
						>
							<Input
								aria-label={m.forum_field_title()}
								autoFocus
								disabled={busy}
								maxLength={FORM_LIMITS.forumTopicTitle}
								onChange={(event) => setTitleDraft(event.target.value)}
								value={titleDraft}
							/>
							<Button disabled={busy || !titleDraft.trim()} type='submit'>
								{m.common_save()}
							</Button>
							<Button
								disabled={busy}
								onClick={() => {
									setTitleDraft(topic.title);
									setEditingTitle(false);
								}}
								type='button'
								variant='ghost'
							>
								{m.common_cancel()}
							</Button>
						</form>
					) : (
						<div className='flex items-start justify-between gap-4'>
							<h1 className='text-2xl font-bold break-words md:text-3xl'>{topic.title}</h1>
							{detail.canEditTitle ? (
								<Button
									aria-label={m.forum_edit_title()}
									className='shrink-0'
									onClick={() => {
										setTitleDraft(topic.title);
										setEditingTitle(true);
									}}
									size='icon'
									variant='ghost'
								>
									<Pencil className='size-4' />
								</Button>
							) : null}
						</div>
					)}
					<p className='text-sm text-muted-foreground' suppressHydrationWarning>
						{m.forum_started_on({ time: formatRelativeDay(topic.createdAt) })}
						{' · '}
						{m.forum_reply_count({ count: topic.commentCount })}
					</p>
					{showUnreadJump ? (
						<div>
							<Button
								disabled={pendingUnreadJump}
								onClick={() => setPendingUnreadJump(true)}
								size='sm'
								variant='outline'
							>
								<ArrowDown className='size-3.5' />
								{m.forum_unread_jump()}
							</Button>
						</div>
					) : null}
				</div>
			</div>
			<div className='container flex flex-1 flex-col [--max-width:52rem] lg:[--max-width:75rem]'>
				<div className='flex flex-1 flex-col gap-6 lg:grid lg:grid-cols-12 lg:gap-8'>
					<aside className='hidden lg:order-last lg:col-span-4 lg:block lg:border-l lg:border-border/75 lg:py-8'>
						<div className='flex flex-col gap-6 lg:sticky lg:top-4 lg:pl-8'>
							<div className='flex gap-2'>
								<DetailFollowButton className='flex-1' detail={detail} onError={setError} />
							</div>
							{sidebarSections}
						</div>
					</aside>
					<main className='min-w-0 lg:col-span-8'>
						<div className='flex items-center gap-2 py-4 lg:hidden'>
							<DetailFollowButton detail={detail} onError={setError} />
							<ResponsiveSideDrawer onOpenChange={setDetailsDrawerOpen} open={detailsDrawerOpen}>
								<ResponsiveSideDrawerTrigger
									render={<Button className='ml-auto' size='lg' variant='outline' />}
								>
									<Info className='size-4' />
									{m.forum_detail_details()}
								</ResponsiveSideDrawerTrigger>
								<ResponsiveSideDrawerContent>
									<ResponsiveSideDrawerHeader icon={<Info />} title={m.forum_detail_details()} />
									<ResponsiveSideDrawerBody className='flex flex-col gap-6'>
										{sidebarSections}
									</ResponsiveSideDrawerBody>
								</ResponsiveSideDrawerContent>
							</ResponsiveSideDrawer>
						</div>
						<div className='flex flex-col gap-4 py-8'>
							{error ? (
								<p
									aria-live='polite'
									className='rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive'
									role='alert'
								>
									{error}
								</p>
							) : null}
							<CommentEditorProvider>
								<ul
									className={`relative flex flex-col gap-6 ${timeline.length || detail.answer ? 'before:absolute before:top-0 before:bottom-0 before:left-[33px] before:z-0 before:border-r before:border-border' : ''}`}
								>
									{detail.firstComment ? (
										<CommentCard
											badges={authorBadge}
											comment={toThreadComment(detail.firstComment)}
											maxLength={FORM_LIMITS.forumTopicBody}
											verb={m.forum_started_verb()}
											{...commentHandlers}
										/>
									) : null}
									{detail.answer ? (
										<DetailAnswer answer={detail.answer} onJump={jumpToAnswer} />
									) : null}
									{replies.results.length ? (
										<li className='relative z-10 flex items-center gap-1.5 bg-background py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase'>
											<MessageSquare className='size-3.5' />
											{m.forum_replies_heading()}
										</li>
									) : null}
									{timeline.map((item, index) => {
										if (item.kind === 'divider') return <UnreadDivider key='unread-divider' />;
										if (item.kind === 'event')
											return (
												<DetailEventItem
													event={item.event}
													isLast={
														index === timeline.length - 1 &&
														replies.status !== 'CanLoadMore' &&
														replies.status !== 'LoadingMore'
													}
													key={item.event.id}
													params={{ org: params.org, project: params.project }}
												/>
											);
										const { reply } = item;
										const isAnswer = reply.id === answerId;
										const isAuthor = reply.author?.id === detail.author?.id;
										return (
											<CommentCard
												badges={
													isAuthor || isAnswer ? (
														<>
															{isAuthor ? authorBadge : null}
															{isAnswer ? answerBadge : null}
														</>
													) : undefined
												}
												className={isAnswer ? 'border-green-500 dark:border-green-600' : undefined}
												comment={toThreadComment(reply)}
												dropdownItems={
													detail.canMarkAnswer ? (
														<DropdownMenuItem
															onClick={() =>
																void run(
																	() =>
																		mutations.setAnswer({
																			topicId: topic.id,
																			commentId: isAnswer ? null : reply.id,
																		}),
																	m.forum_detail_answer_failed()
																).catch(() => undefined)
															}
														>
															<CircleCheck className='size-3.5' />
															{isAnswer
																? m.forum_detail_unmark_answer()
																: m.forum_detail_mark_answer()}
														</DropdownMenuItem>
													) : undefined
												}
												key={reply.id}
												verb={m.forum_replied_verb()}
												{...commentHandlers}
											/>
										);
									})}
									{replies.status === 'CanLoadMore' || replies.status === 'LoadingMore' ? (
										<li className='relative z-10'>
											<Button
												disabled={replies.status === 'LoadingMore'}
												onClick={() => replies.loadMore(REPLIES_PAGE_SIZE)}
												variant='outline'
											>
												{replies.status === 'LoadingMore'
													? m.forum_loading_replies()
													: m.forum_show_more_replies()}
											</Button>
										</li>
									) : null}
								</ul>
								{topic.locked && detail.writable ? (
									<InlineAlert className='flex items-center gap-2'>
										<Lock className='size-4 shrink-0' />
										{detail.canReply
											? m.forum_detail_locked_notice_team()
											: m.forum_detail_locked_notice()}
									</InlineAlert>
								) : null}
								{detail.canReply ? (
									<CommentForm
										isAuthenticated={!!session.user}
										isSubmitting={busy}
										onSubmit={async (content) => {
											// CommentForm reports its own failure and keeps the draft.
											setBusy(true);
											try {
												await mutations.addComment({ topicId: topic.id, content });
											} finally {
												setBusy(false);
											}
										}}
										placeholder={m.forum_reply_placeholder()}
										redirectTo={`/@${params.org}/${params.project}/topics/${params.slug}`}
										signedOut='rich'
										submitLabel={m.forum_reply_submit()}
									/>
								) : null}
							</CommentEditorProvider>
						</div>
					</main>
				</div>
			</div>
		</div>
	);
}
