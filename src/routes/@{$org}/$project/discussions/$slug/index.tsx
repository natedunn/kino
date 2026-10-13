import type { EmoteContent } from '@/components/emote';
import type { FunctionReturnType } from 'convex/server';
import type { ThreadComment } from '../../-components/comment-thread';
import type { Id } from '../../../../../../convex/native/_generated/dataModel';

import { useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound, useNavigate, useRouter } from '@tanstack/react-router';
import { useMutation, usePaginatedQuery } from 'convex/react';
import { ArrowLeft, Check, MessageSquare, Pencil, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthSession } from '@/lib/auth/auth-client';
import { localizeError } from '@/lib/errors';
import { projectTitle, titleFromSlug, titleMeta } from '@/lib/seo';
import { formatRelativeDay } from '@/lib/utils/format-timestamp';
import { FORM_LIMITS } from '@/lib/validation';
import * as m from '@/paraglide/messages.js';

import { CommentCard, CommentEditorProvider, CommentForm } from '../../-components/comment-thread';
import { api as nativeApi } from '../../../../../../convex/native/_generated/api';

const REPLIES_PAGE_SIZE = 30;

export const Route = createFileRoute('/@{$org}/$project/discussions/$slug/')({
	loader: async ({ context, params }) => {
		const projectData = await context.queryClient.ensureQueryData(
			convexQuery(nativeApi.projects.getBySlugs, {
				organizationSlug: params.org,
				projectSlug: params.project,
			})
		);
		if (!projectData?.project) throw notFound();
		const detail = await context.queryClient.ensureQueryData(
			convexQuery(nativeApi.discussions.detail, {
				projectId: projectData.project.id,
				slug: params.slug,
			})
		);
		if (!detail) throw notFound();
		return { title: detail.discussion.title };
	},
	head: ({ loaderData, params }) => ({
		meta: [
			titleMeta([
				loaderData?.title ?? titleFromSlug(params.slug),
				projectTitle(params.org, params.project),
			]),
		],
	}),
	component: DiscussionDetailRoute,
});

type DiscussionComment = NonNullable<
	NonNullable<FunctionReturnType<typeof nativeApi.discussions.detail>>['firstComment']
>;

function toThreadComment(comment: DiscussionComment): ThreadComment {
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

function DiscussionDetailRoute() {
	const params = Route.useParams();
	const navigate = useNavigate();
	const router = useRouter();
	const session = useAuthSession();
	const { data: projectData } = useSuspenseQuery(
		convexQuery(nativeApi.projects.getBySlugs, {
			organizationSlug: params.org,
			projectSlug: params.project,
		})
	);
	if (!projectData?.project) throw notFound();
	const { data: detail } = useSuspenseQuery(
		convexQuery(nativeApi.discussions.detail, {
			projectId: projectData.project.id,
			slug: params.slug,
		})
	);
	if (!detail) throw notFound();
	const discussion = detail.discussion;

	const replies = usePaginatedQuery(
		nativeApi.discussions.replies,
		{ discussionId: discussion.id },
		{ initialNumItems: REPLIES_PAGE_SIZE }
	);
	const mutations = {
		addComment: useMutation(nativeApi.discussions.addComment),
		updateComment: useMutation(nativeApi.discussions.updateComment),
		removeComment: useMutation(nativeApi.discussions.removeComment),
		toggleReaction: useMutation(nativeApi.discussions.toggleReaction),
		updateTitle: useMutation(nativeApi.discussions.updateTitle),
		remove: useMutation(nativeApi.discussions.remove),
	};
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [editingTitle, setEditingTitle] = useState(false);
	const [titleDraft, setTitleDraft] = useState(discussion.title);

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
			() => mutations.updateTitle({ discussionId: discussion.id, title: titleDraft }),
			m.discussions_title_save_failed()
		)
			.then(() => {
				setEditingTitle(false);
				// The document title comes from loader data; re-run it for the new title.
				void router.invalidate();
			})
			.catch(() => undefined);
	}

	async function deleteDiscussion() {
		if (!window.confirm(m.discussions_delete_confirm())) return;
		await run(
			() => mutations.remove({ discussionId: discussion.id }),
			m.discussions_delete_failed()
		)
			.then(() => navigate({ params, to: '/@{$org}/$project/discussions' }))
			.catch(() => undefined);
	}

	const commentHandlers = {
		currentProfileId: detail.viewerProfileId ?? undefined,
		isDeleting: busy,
		isUpdating: busy,
		onDelete: (commentId: string) =>
			void run(() =>
				mutations.removeComment({ commentId: commentId as Id<'discussionComments'> })
			).catch(() => undefined),
		onToggleEmote: detail.writable
			? (commentId: string, content: EmoteContent) =>
					void run(() =>
						mutations.toggleReaction({
							commentId: commentId as Id<'discussionComments'>,
							content,
						})
					).catch(() => undefined)
			: undefined,
		onUpdate: (commentId: string, content: string) =>
			mutations.updateComment({ commentId: commentId as Id<'discussionComments'>, content }),
	};
	const authorBadge = (
		<span className='inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium'>
			<Check className='size-3' />
			{m.discussions_author_badge()}
		</span>
	);

	return (
		<div className='flex flex-1 flex-col'>
			<div className='border-b'>
				<div className='container flex flex-col gap-3 pt-8 pb-6 [--max-width:52rem]'>
					<Link
						className='link-text inline-flex w-fit items-center gap-1.5 text-sm'
						params={params}
						to='/@{$org}/$project/discussions'
					>
						<ArrowLeft className='size-3.5' />
						{m.discussions_back()}
					</Link>
					{editingTitle ? (
						<form
							className='flex gap-2'
							onSubmit={(event) => {
								event.preventDefault();
								void saveTitle();
							}}
						>
							<Input
								aria-label={m.discussions_field_title()}
								autoFocus
								disabled={busy}
								maxLength={FORM_LIMITS.discussionTitle}
								onChange={(event) => setTitleDraft(event.target.value)}
								value={titleDraft}
							/>
							<Button disabled={busy || !titleDraft.trim()} type='submit'>
								{m.common_save()}
							</Button>
							<Button
								disabled={busy}
								onClick={() => {
									setTitleDraft(discussion.title);
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
							<h1 className='text-2xl font-bold break-words md:text-3xl'>{discussion.title}</h1>
							<div className='flex shrink-0 gap-1'>
								{detail.canEditTitle ? (
									<Button
										aria-label={m.discussions_edit_title()}
										onClick={() => {
											setTitleDraft(discussion.title);
											setEditingTitle(true);
										}}
										size='icon'
										variant='ghost'
									>
										<Pencil className='size-4' />
									</Button>
								) : null}
								{detail.canDelete ? (
									<Button
										aria-label={m.discussions_delete()}
										className='text-destructive'
										disabled={busy}
										onClick={() => void deleteDiscussion()}
										size='icon'
										variant='ghost'
									>
										<Trash2 className='size-4' />
									</Button>
								) : null}
							</div>
						</div>
					)}
					<p className='text-sm text-muted-foreground' suppressHydrationWarning>
						{m.discussions_started_on({ time: formatRelativeDay(discussion.createdAt) })}
						{' · '}
						{m.discussions_reply_count({ count: discussion.commentCount })}
					</p>
				</div>
			</div>
			<div className='container flex flex-col gap-4 py-8 [--max-width:52rem]'>
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
						className={`relative flex flex-col gap-6 ${replies.results.length ? 'before:absolute before:top-0 before:bottom-0 before:left-[33px] before:z-0 before:border-r before:border-border' : ''}`}
					>
						{detail.firstComment ? (
							<CommentCard
								badges={authorBadge}
								comment={toThreadComment(detail.firstComment)}
								maxLength={FORM_LIMITS.discussionBody}
								verb={m.discussions_started_verb()}
								{...commentHandlers}
							/>
						) : null}
						{replies.results.length ? (
							<li className='relative z-10 flex items-center gap-1.5 bg-background py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase'>
								<MessageSquare className='size-3.5' />
								{m.discussions_replies_heading()}
							</li>
						) : null}
						{replies.results.map((reply) => (
							<CommentCard
								badges={reply.author?.id === detail.author?.id ? authorBadge : undefined}
								comment={toThreadComment(reply)}
								key={reply.id}
								verb={m.discussions_replied_verb()}
								{...commentHandlers}
							/>
						))}
						{replies.status === 'CanLoadMore' || replies.status === 'LoadingMore' ? (
							<li className='relative z-10'>
								<Button
									disabled={replies.status === 'LoadingMore'}
									onClick={() => replies.loadMore(REPLIES_PAGE_SIZE)}
									variant='outline'
								>
									{replies.status === 'LoadingMore'
										? m.discussions_loading_replies()
										: m.discussions_show_more_replies()}
								</Button>
							</li>
						) : null}
					</ul>
					{detail.writable ? (
						<CommentForm
							isAuthenticated={!!session.user}
							isSubmitting={busy}
							onSubmit={async (content) => {
								// CommentForm reports its own failure and keeps the draft.
								setBusy(true);
								try {
									await mutations.addComment({ discussionId: discussion.id, content });
								} finally {
									setBusy(false);
								}
							}}
							placeholder={m.discussions_reply_placeholder()}
							redirectTo={`/@${params.org}/${params.project}/discussions/${params.slug}`}
							signedOut='rich'
							submitLabel={m.discussions_reply_submit()}
						/>
					) : null}
				</CommentEditorProvider>
			</div>
		</div>
	);
}
